/**
 * lexer.js — Tokenizer for the Undercity command DSL.
 *
 * Produces a flat token stream from a source string.
 * Tokens carry their kind, literal text, and source span [start, end).
 *
 * Token kinds:
 *   IDENT   — identifier or bareword:  foo, scaffold, my-value
 *   NUMBER  — integer or float:         42, 3.14, -7
 *   STRING  — quoted literal:           "hello", 'world', `raw`
 *   FLAG    — double-dash flag name:    --name, --output-dir
 *   EQ      — equals sign:              =
 *   COMMA   — comma:                    ,
 *   PIPE    — pipe:                     |
 *   SEMI    — semicolon:                ;
 *   EOF     — end of input
 *   BAD     — unrecognised character
 */

export const T = Object.freeze({
  IDENT:  'IDENT',
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  FLAG:   'FLAG',
  EQ:     'EQ',
  COMMA:  'COMMA',
  PIPE:   'PIPE',
  SEMI:   'SEMI',
  EOF:    'EOF',
  BAD:    'BAD',
});

const IDENT_CONTINUE = /[-a-zA-Z0-9_]/;
const IDENT_START    = /[a-zA-Z_]/;
const DIGIT          = /[0-9]/;

/**
 * Tokenise `source` and return an immutable token array.
 * The last token is always EOF.
 *
 * @param {string} source
 * @returns {{ kind: string, text: string, start: number, end: number }[]}
 */
export function lex(source) {
  const tokens = [];
  let pos = 0;

  // ── Helpers ──────────────────────────────────────────────────────────
  const at    = (off = 0)  => source[pos + off] ?? '';
  const eat   = ()          => source[pos++];
  const mark  = ()          => pos;
  const slice = (s)         => source.slice(s, pos);
  const tok   = (kind, text, start) =>
    Object.freeze({ kind, text, start, end: pos });

  // ── Main scan loop ───────────────────────────────────────────────────
  while (pos < source.length) {
    const start = mark();
    const ch    = at();

    // Whitespace — skip
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      pos++;
      continue;
    }

    // Line comment (#) — skip to end of line
    if (ch === '#') {
      while (pos < source.length && at() !== '\n') pos++;
      continue;
    }

    // ── Quoted strings ──────────────────────────────────────────────
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = eat(); // opening quote
      let text = '';
      while (pos < source.length && at() !== q) {
        if (at() === '\\') { eat(); text += eat() ?? ''; }
        else text += eat();
      }
      if (at() === q) eat(); // closing quote (omit if EOF)
      tokens.push(tok(T.STRING, text, start));
      continue;
    }

    // ── Flags: --name ────────────────────────────────────────────────
    if (ch === '-' && at(1) === '-') {
      pos += 2; // consume '--'
      const nameStart = mark();
      while (pos < source.length && IDENT_CONTINUE.test(at())) pos++;
      const name = source.slice(nameStart, pos);
      tokens.push(tok(T.FLAG, name, start));
      continue;
    }

    // ── Numbers (possibly negative: -42) ────────────────────────────
    if (DIGIT.test(ch) || (ch === '-' && DIGIT.test(at(1)))) {
      if (ch === '-') eat();
      while (DIGIT.test(at())) eat();
      if (at() === '.' && DIGIT.test(at(1))) {
        eat(); // decimal point
        while (DIGIT.test(at())) eat();
      }
      tokens.push(tok(T.NUMBER, slice(start), start));
      continue;
    }

    // ── Identifiers / barewords ──────────────────────────────────────
    if (IDENT_START.test(ch)) {
      while (IDENT_CONTINUE.test(at())) eat();
      tokens.push(tok(T.IDENT, slice(start), start));
      continue;
    }

    // ── Single-character tokens ──────────────────────────────────────
    eat();
    switch (ch) {
      case '=': tokens.push(tok(T.EQ,    '=', start)); break;
      case ',': tokens.push(tok(T.COMMA, ',', start)); break;
      case '|': tokens.push(tok(T.PIPE,  '|', start)); break;
      case ';': tokens.push(tok(T.SEMI,  ';', start)); break;
      default:  tokens.push(tok(T.BAD,   ch,  start)); break;
    }
  }

  tokens.push(Object.freeze({ kind: T.EOF, text: '', start: pos, end: pos }));
  return tokens;
}
