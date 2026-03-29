/**
 * undercity-parser — Top-down descent parser for the Undercity command DSL.
 *
 * Architecture inspired by the TypeScript compiler's parser:
 *   • A token cursor with peek() / advance() / expect() / match()
 *   • Diagnostic accumulation instead of exception-based error handling
 *   • Error recovery via synchronisation on well-known token boundaries
 *   • Each parse function is a method; grammar is made explicit in code structure
 *
 * Grammar (EBNF):
 *   program     = { command ( ';' | EOF ) }
 *   command     = IDENT { IDENT }   piece*
 *   piece       = flag | value
 *   flag        = FLAG [ ( '=' | ' ' ) value ]
 *   value       = list | atom
 *   list        = atom { ',' atom }
 *   atom        = STRING | NUMBER | IDENT
 *
 * Examples:
 *   new project --id my-app --name "My App"
 *   scaffold form --fields "email:email,password:password" --submit next
 *   open form1 ; save
 *   help scaffold
 */

import { lex, T } from './lexer.js';

export { T } from './lexer.js';

// ── AST node constructors ─────────────────────────────────────────────────────

/** @typedef {{ kind:'program', commands:CommandNode[], diagnostics:Diagnostic[] }} ProgramNode */
/** @typedef {{ kind:'command', name:string, args:ValueNode[], flags:Record<string,ValueNode|null>, start:number, end:number }} CommandNode */
/** @typedef {{ kind:'value', type:'string'|'number'|'ident'|'list', value:*, raw:string }} ValueNode */
/** @typedef {{ message:string, token:object, start:number, end:number }} Diagnostic */

export class ParseError extends Error {
  constructor(message, token) {
    super(message);
    this.name  = 'ParseError';
    this.token = token;
  }
}

export class Diagnostic {
  constructor(message, token) {
    this.message = message;
    this.token   = token;
    this.start   = token?.start ?? 0;
    this.end     = token?.end   ?? 0;
  }
  toString() { return `[${this.start}] ${this.message}`; }
}

// ── Parser class ──────────────────────────────────────────────────────────────

class Parser {
  #tokens;
  #pos         = 0;
  #diagnostics = [];

  constructor(tokens) { this.#tokens = tokens; }

  get diagnostics() { return this.#diagnostics; }

  // ── Token cursor ────────────────────────────────────────────────────

  /** Return the token at `offset` ahead without consuming. */
  peek(offset = 0) {
    const idx = this.#pos + offset;
    return this.#tokens[idx] ?? this.#tokens[this.#tokens.length - 1]; // EOF
  }

  /** Consume and return the current token. */
  advance() {
    const t = this.#tokens[this.#pos];
    if (this.#pos < this.#tokens.length - 1) this.#pos++;
    return t;
  }

  /**
   * parseExpected (TypeScript-inspired):
   * Consume the current token if it matches `kind`; otherwise record a
   * diagnostic and return a synthetic token — allowing the parse to continue.
   */
  expect(kind) {
    const t = this.peek();
    if (t.kind === kind) return this.advance();
    this.#diagnostics.push(new Diagnostic(
      `Expected ${kind} but found ${t.kind} '${t.text}'`, t
    ));
    return { kind, text: '', start: t.start, end: t.start, synthetic: true };
  }

  /**
   * Consume and return the token only if it matches one of the given kinds;
   * otherwise return null (non-destructive lookahead + conditional consume).
   */
  match(...kinds) {
    return kinds.includes(this.peek().kind) ? this.advance() : null;
  }

  /** True if the current token is any of the given kinds. */
  is(...kinds) { return kinds.includes(this.peek().kind); }

  // ── Grammar rules ────────────────────────────────────────────────────

  parseProgram() {
    const commands = [];

    while (!this.is(T.EOF)) {
      this.match(T.SEMI); // skip empty / extra semicolons
      if (this.is(T.EOF)) break;
      const cmd = this.parseCommand();
      if (cmd) commands.push(cmd);
      // Synchronise: consume terminator if present
      this.match(T.SEMI, T.PIPE);
    }

    return { kind: 'program', commands, diagnostics: this.#diagnostics };
  }

  parseCommand() {
    const first = this.peek();
    if (!this.is(T.IDENT)) {
      this.#diagnostics.push(new Diagnostic(
        `Expected a command name (identifier) but found ${first.kind} '${first.text}'`, first
      ));
      // Error recovery: skip one token and try again
      this.advance();
      return null;
    }

    // Collect multi-word command name (up to 2 words, e.g. "scaffold form")
    const nameParts = [this.advance().text]; // first word always consumed
    if (this.is(T.IDENT) && !this.#nextLooksLikeFlag() && nameParts.length < 2) {
      // Second word is part of the name only if it is followed by a flag, EOF, or SEMI
      const ahead = this.peek(1);
      if (ahead.kind === T.FLAG || ahead.kind === T.EOF || ahead.kind === T.SEMI) {
        nameParts.push(this.advance().text);
      }
    }
    const name  = nameParts.join(' ');
    const args  = [];
    const flags = {};

    // Parse interleaved flags and positional arguments
    while (!this.is(T.EOF, T.SEMI, T.PIPE)) {
      if (this.is(T.FLAG)) {
        const { flagName, value } = this.parseFlag();
        flags[flagName] = value;
      } else {
        const v = this.#tryParseValue();
        if (v !== null) args.push(v);
        else { this.advance(); } // skip unrecognised token (error recovery)
      }
    }

    return { kind: 'command', name, args, flags, start: first.start, end: this.peek().start };
  }

  parseFlag() {
    const token = this.advance(); // FLAG token (text is already stripped of '--')
    const flagName = token.text;
    let value = null;

    if (this.match(T.EQ)) {
      // --flag=value
      value = this.parseValue();
    } else if (this.#looksLikeValueToken(this.peek())) {
      // --flag value  (space-separated, only if next token looks like a value)
      value = this.parseValue();
    }
    // No value → boolean flag (value stays null)

    return { flagName, value };
  }

  parseValue() {
    const atom = this.parseAtom();
    if (!atom) return null;

    // List: atom , atom , ...
    if (this.is(T.COMMA)) {
      const items = [atom];
      while (this.match(T.COMMA)) {
        const next = this.parseAtom();
        if (next) items.push(next);
        else break;
      }
      return {
        kind:  'value',
        type:  'list',
        items,
        value: items.map(i => i.value),
        raw:   items.map(i => i.raw).join(','),
      };
    }

    return atom;
  }

  parseAtom() {
    const t = this.peek();
    if (t.kind === T.STRING) {
      this.advance();
      return { kind: 'value', type: 'string', value: t.text, raw: `"${t.text}"` };
    }
    if (t.kind === T.NUMBER) {
      this.advance();
      return { kind: 'value', type: 'number', value: Number(t.text), raw: t.text };
    }
    if (t.kind === T.IDENT) {
      this.advance();
      return { kind: 'value', type: 'ident', value: t.text, raw: t.text };
    }
    return null;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  #looksLikeValueToken(token) {
    return token.kind === T.STRING ||
           token.kind === T.NUMBER ||
           token.kind === T.IDENT;
  }

  #tryParseValue() {
    return this.#looksLikeValueToken(this.peek()) ? this.parseValue() : null;
  }

  #nextLooksLikeFlag() {
    return this.peek().kind === T.FLAG;
  }

  /** Parse a bare sequence of positional args and flags (no command name). */
  parseArgsAndFlags() {
    const args  = {};
    const flags = {};
    const argList = [];

    while (!this.is(T.EOF, T.SEMI, T.PIPE)) {
      if (this.is(T.FLAG)) {
        const { flagName, value } = this.parseFlag();
        flags[flagName] = value;
      } else {
        const v = this.#tryParseValue();
        if (v !== null) argList.push(v);
        else this.advance(); // skip unknown token
      }
    }

    return { args: argList, flags };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a full program (may contain multiple ';'-separated commands).
 * Never throws — errors are recorded in the returned `.diagnostics` array.
 */
export function parse(source) {
  const tokens = lex(source);
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

/**
 * Parse exactly one command from `source`.
 * Returns `{ command, diagnostics }`.
 */
export function parseCommand(source) {
  const tokens = lex(source.trim());
  const parser = new Parser(tokens);
  const command = parser.parseCommand();
  return { command, diagnostics: parser.diagnostics };
}

/**
 * Flatten a flags map into a plain object with resolved scalar/array values.
 *
 *   null              → true   (boolean flag: --verbose)
 *   ValueNode(ident)  → string
 *   ValueNode(list)   → string[]
 *   ValueNode(number) → number
 */
export function resolveFlags(flags) {
  const out = {};
  for (const [k, v] of Object.entries(flags ?? {})) {
    if (v === null)               out[k] = true;
    else if (v.type === 'list')   out[k] = v.value;   // string[]
    else                          out[k] = v.value;   // scalar
  }
  return out;
}

/**
 * Flatten positional args to their scalar values.
 */
export function resolveArgs(args) {
  return (args ?? []).map(a => a.value);
}

/**
 * Parse a bare args+flags string (no command name at the start).
 * Used by the command palette to extract args after stripping the command name.
 *
 *   parseArgsAndFlags('login --fields email:email,pass:pw --title "Sign In"')
 *   → { args: ['login'], flags: { fields: ['email:email','pass:pw'], title: 'Sign In' } }
 */
export function parseArgsAndFlags(source) {
  const tokens = lex(source.trim());
  const parser = new Parser(tokens);
  const { args, flags } = parser.parseArgsAndFlags();
  return {
    args:        resolveArgs(args),
    flags:       resolveFlags(flags),
    rawArgs:     args,
    rawFlags:    flags,
    diagnostics: parser.diagnostics,
  };
}
