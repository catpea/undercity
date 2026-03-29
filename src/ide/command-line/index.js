/**
 * command-line/index.js — Mozilla Ubiquity-inspired command palette.
 *
 * Triggered by Ctrl+K (or the "⌘" toolbar button).
 * As the user types, the input is parsed in real-time and matching commands
 * are ranked/highlighted. Pressing Enter executes; Escape closes.
 *
 * Features:
 *   • Real-time token highlighting (verb=cyan, flag=yellow, value=green, error=red)
 *   • Fuzzy command search by name and description
 *   • Arrow-key navigation through suggestions
 *   • Command history (Up/Down when input is empty)
 *   • Preview pane showing usage + description of the selected command
 *   • Keyboard shortcuts: Ctrl+K open, Escape close, Tab complete
 */

import { parseCommand, parseArgsAndFlags, resolveFlags, resolveArgs } from './parser.js';

// ── Fuzzy match ───────────────────────────────────────────────────────────────

function fuzzyScore(query, target) {
  if (!query) return 1;
  query  = query.toLowerCase();
  target = target.toLowerCase();
  if (target.startsWith(query)) return 3;
  if (target.includes(query))   return 2;
  // Character-by-character match
  let qi = 0;
  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i] === query[qi]) qi++;
  }
  return qi === query.length ? 1 : 0;
}

function rankCommands(query, commands) {
  if (!query.trim()) return commands.slice(0, 10);
  const word = query.split(' ')[0].toLowerCase();
  return commands
    .map(cmd => ({
      cmd,
      score: Math.max(
        fuzzyScore(query.trim(), cmd.name),
        fuzzyScore(word, cmd.name.split(' ')[0]),
        query.length > 2 ? fuzzyScore(query.trim(), cmd.description) : 0
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ cmd }) => cmd);
}

// ── Token highlighting ────────────────────────────────────────────────────────

function highlightInput(source, command) {
  if (!source.trim()) return '';
  const { command: ast } = parseCommand(source);
  if (!ast) return escHtml(source);

  // Build a mapping of source ranges → colour class
  const ranges = [];
  const push = (start, end, cls) => { if (start < end) ranges.push({ start, end, cls }); };

  // Command name tokens
  const nameParts = ast.name.split(' ');
  let cursor = source.indexOf(nameParts[0]);
  for (const part of nameParts) {
    const idx = source.indexOf(part, cursor);
    if (idx !== -1) { push(idx, idx + part.length, 'cmd-verb'); cursor = idx + part.length; }
  }

  // Args
  for (const arg of ast.args ?? []) {
    push(arg.start ?? 0, arg.end ?? 0, 'cmd-arg');
  }

  // Flags and their values
  for (const [, flagNode] of Object.entries(ast.flags ?? {})) {
    if (typeof flagNode === 'object' && flagNode !== null) {
      if (flagNode.start !== undefined) push(flagNode.start, flagNode.end ?? flagNode.start, 'cmd-flag');
    }
  }

  if (!ranges.length) return escHtml(source);

  // Merge ranges into coloured spans
  ranges.sort((a, b) => a.start - b.start);
  let result = '';
  let pos = 0;
  for (const { start, end, cls } of ranges) {
    if (start > pos) result += escHtml(source.slice(pos, start));
    result += `<span class="cmd-${cls}">${escHtml(source.slice(start, end))}</span>`;
    pos = end;
  }
  result += escHtml(source.slice(pos));
  return result;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── CommandPalette class ──────────────────────────────────────────────────────

export class CommandPalette {
  #app;
  #commands  = [];
  #history   = [];
  #histIdx   = -1;
  #selIdx    = 0;
  #visible   = false;

  // DOM refs
  #overlay;
  #inputWrapper;
  #highlight;
  #input;
  #results;
  #preview;

  constructor(app) {
    this.#app = app;
    this.#build();
    this.#bindKeys();
  }

  /** Register commands (called by App after plugins are loaded). */
  registerAll(commands) {
    this.#commands.push(...commands);
  }

  // ── DOM ──────────────────────────────────────────────────────────────

  #build() {
    this.#overlay = document.createElement('div');
    this.#overlay.id = 'cmd-overlay';
    this.#overlay.innerHTML = `
      <div id="cmd-modal">
        <div id="cmd-input-row">
          <span id="cmd-prompt">⌘</span>
          <div id="cmd-input-wrap">
            <div id="cmd-highlight" aria-hidden="true"></div>
            <input id="cmd-input" type="text" spellcheck="false"
                   autocomplete="off" placeholder="Type a command…" />
          </div>
        </div>
        <div id="cmd-results"></div>
        <div id="cmd-preview"></div>
      </div>`;

    document.body.appendChild(this.#overlay);

    this.#highlight = this.#overlay.querySelector('#cmd-highlight');
    this.#input     = this.#overlay.querySelector('#cmd-input');
    this.#results   = this.#overlay.querySelector('#cmd-results');
    this.#preview   = this.#overlay.querySelector('#cmd-preview');

    this.#input.addEventListener('input',   () => this.#refresh());
    this.#input.addEventListener('keydown', e  => this.#onKey(e));
    this.#overlay.addEventListener('click', e  => { if (e.target === this.#overlay) this.close(); });
  }

  #bindKeys() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.#visible ? this.close() : this.open();
      }
    });
  }

  // ── Open / close ─────────────────────────────────────────────────────

  open() {
    this.#visible = true;
    this.#overlay.classList.add('open');
    this.#input.value = '';
    this.#selIdx = 0;
    this.#histIdx = -1;
    this.#refresh();
    requestAnimationFrame(() => this.#input.focus());
  }

  close() {
    this.#visible = false;
    this.#overlay.classList.remove('open');
  }

  // ── Keyboard handler ─────────────────────────────────────────────────

  #onKey(e) {
    const items = this.#results.querySelectorAll('.cmd-item');
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.#selIdx = Math.min(this.#selIdx + 1, items.length - 1);
        this.#updateSelection(items);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.#selIdx > 0) {
          this.#selIdx--;
          this.#updateSelection(items);
        } else if (!this.#input.value && this.#history.length) {
          this.#histIdx = Math.min(this.#histIdx + 1, this.#history.length - 1);
          this.#input.value = this.#history[this.#histIdx] ?? '';
          this.#refresh();
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (items[this.#selIdx]) {
          const name = items[this.#selIdx].dataset.name;
          this.#input.value = name + ' ';
          this.#refresh();
        }
        break;
      case 'Enter':
        e.preventDefault();
        const selected = items[this.#selIdx]?.dataset?.name;
        if (selected) this.#execute(selected);
        else if (this.#input.value.trim()) this.#execute(null);
        break;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  #refresh() {
    const raw     = this.#input.value;
    const matches = rankCommands(raw, this.#commands);

    // Highlight overlay (mirrors the input text with colour spans)
    this.#highlight.innerHTML = highlightInput(raw, this.#commands[0]);

    // Results list
    this.#selIdx = Math.min(this.#selIdx, Math.max(0, matches.length - 1));
    this.#results.innerHTML = matches.map((cmd, i) => `
      <div class="cmd-item${i === this.#selIdx ? ' selected' : ''}" data-name="${escHtml(cmd.name)}">
        <span class="cmd-item-name">${escHtml(cmd.name)}</span>
        <span class="cmd-item-cat">${escHtml(cmd.category ?? '')}</span>
        <span class="cmd-item-desc">${escHtml(cmd.description ?? '')}</span>
      </div>`).join('');

    this.#results.querySelectorAll('.cmd-item').forEach((el, i) => {
      el.addEventListener('mouseenter', () => { this.#selIdx = i; this.#updateSelection(this.#results.querySelectorAll('.cmd-item')); });
      el.addEventListener('click',      () => this.#execute(el.dataset.name));
    });

    // Preview pane
    const sel = matches[this.#selIdx];
    this.#preview.innerHTML = sel
      ? `<span class="cmd-prev-usage">${escHtml(sel.usage ?? sel.name)}</span>
         <span class="cmd-prev-desc">${escHtml(sel.description ?? '')}</span>`
      : '';
  }

  #updateSelection(items) {
    items.forEach((el, i) => el.classList.toggle('selected', i === this.#selIdx));
    // Update preview
    const name = items[this.#selIdx]?.dataset?.name;
    const cmd  = this.#commands.find(c => c.name === name);
    this.#preview.innerHTML = cmd
      ? `<span class="cmd-prev-usage">${escHtml(cmd.usage ?? cmd.name)}</span>
         <span class="cmd-prev-desc">${escHtml(cmd.description ?? '')}</span>`
      : '';
  }

  // ── Execution ────────────────────────────────────────────────────────

  async #execute(cmdName) {
    const raw = this.#input.value.trim() || cmdName;
    if (!raw) return;

    // Add to history
    if (this.#history[0] !== raw) this.#history.unshift(raw);
    if (this.#history.length > 50) this.#history.pop();
    this.#histIdx = -1;

    this.close();

    // Resolve command by longest-prefix match (handles multi-word names like
    // "scaffold form" or "add room" when followed by positional args).
    // Sort longest-name-first so "scaffold form" beats "scaffold".
    const sorted = this.#commands.slice().sort((a, b) => b.name.length - a.name.length);
    let cmd = null;
    let argsInput = '';

    if (cmdName) {
      // Clicked a suggestion: cmdName is the exact command name; args come from raw
      cmd = this.#commands.find(c => c.name === cmdName);
      argsInput = raw.startsWith(cmdName) ? raw.slice(cmdName.length).trim() : raw;
    }

    if (!cmd) {
      // Typed input: find the longest matching command name prefix
      for (const c of sorted) {
        if (raw === c.name || raw.startsWith(c.name + ' ') || raw.startsWith(c.name + '\t')) {
          cmd       = c;
          argsInput = raw.slice(c.name.length).trim();
          break;
        }
      }
    }

    if (!cmd) {
      this.#app.toast(`Unknown command: ${raw.split(' ')[0]}`, 'error');
      return;
    }

    // Parse the args/flags portion directly (no dummy verb — avoids two-word name heuristic)
    const { args, flags, diagnostics } = parseArgsAndFlags(argsInput);

    if (diagnostics.length) {
      console.warn('[CommandPalette] parse diagnostics:', diagnostics.map(d => d.toString()));
    }

    try {
      await cmd.execute({ args, flags, app: this.#app });
    } catch (err) {
      this.#app.toast(`Command error: ${err.message}`, 'error');
      console.error('[CommandPalette]', err);
    }
  }
}
