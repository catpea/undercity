/**
 * savant-chat.js — Context-aware AI chat pane for the Savant.
 *
 * Uses OpenAI tool-calling to let the model invoke `undercity_commands` when
 * asked to build or modify the graph. Plain text questions get plain text
 * answers. Tool calls are rendered as executable command cards.
 *
 * History is stored in localStorage: undercity:chat:{projectId}:{nodeId}[:{thingId}]
 */

import { THING_LIBRARY } from '/src/ide/thing-library.js';
// ACTION_LIBRARY is injected via setActionLibrary() — not imported statically.
// This keeps savant-chat.js decoupled from the action registration system.

const ENDPOINT       = 'http://localhost:8191/v1/chat/completions';
const MODEL          = 'local';
const STORAGE_PREFIX = 'undercity:chat:';

/** Tool definition sent with every request so the model can create graph commands. */
const PATHWAY_TOOL = {
  type: 'function',
  function: {
    name: 'undercity_commands',
    description: 'Create or modify the Undercity flow graph. Call this whenever the user asks to build, create, add, or connect rooms/nodes.',
    parameters: {
      type: 'object',
      required: ['commands'],
      properties: {
        commands: {
          type: 'array',
          description: 'Commands to execute in order.',
          items: {
            type: 'object',
            properties: {
              cmd:       { type: 'string', enum: ['addNode', 'addEdge', 'addStep', 'setLabel', 'setEntry'],
                           description: 'Command type. Infer from context if omitted: node= means addNode, from/to= means addEdge.' },
              type:      { type: 'string', enum: ['room', 'diamond', 'terminal'], description: 'Node type for addNode (default: room)' },
              label:     { type: 'string',  description: 'Node label for addNode or new label for setLabel' },
              from:      { type: 'string',  description: 'Source node label/id for addEdge' },
              to:        { type: 'string',  description: 'Target node label/id for addEdge' },
              x:         { type: 'number',  description: 'X position (100-1200)' },
              y:         { type: 'number',  description: 'Y position (100-800)' },
              entry:     { type: 'boolean', description: 'Mark as entry/lobby node' },
              node:      { type: 'string',  description: 'Target node label/id for addStep/setLabel/setEntry. Omit to use the currently selected room.' },
              event:     { type: 'string',  description: 'Event name for addStep: onEnter|onExit|onBack|onReset|onUnload (default: onEnter)' },
              condition: { type: 'string',  description: 'JS condition for addEdge on diamond nodes' },
              step: {
                type: 'object',
                description: 'Step to add via addStep. Must have action (string) and params (object).',
                properties: {
                  action: { type: 'string', description: 'Action ID, e.g. "media.askAudioUpload" or "form.serialize"' },
                  params: { type: 'object', description: 'Parameter key/value pairs matching the action signature' },
                },
                required: ['action'],
              },
            },
          },
        },
      },
    },
  },
};

export class SavantChat {
  #containerEl;
  #messagesEl;
  #inputEl;
  #sendBtn;
  #clearBtn;
  #contextEl;

  #projectId   = '';
  #nodeId      = '';
  #thingId     = '';
  #eventKey    = '';
  #nodeLabel   = '';
  #thingLabel  = '';
  #nodePayload = null;

  #streaming   = false;

  /** Set by app.js: (commands[]) => {ok, error?} */
  onExecuteCommands = null;

  /** Injected via setActionLibrary() after Savant registers categories. */
  #actionLibrary = {};

  /** Called by Savant after registerCategory() so the AI prompt stays current. */
  setActionLibrary(lib) { this.#actionLibrary = lib ?? {}; }

  constructor(containerEl) {
    this.#containerEl = containerEl;
    this.#render();
  }

  /** Update context when the user selects a different room/thing/event. */
  setContext({ projectId = '', nodeId = '', nodeLabel = '', thingId = '', thingLabel = '', eventKey = '', nodePayload = null } = {}) {
    this.#projectId   = projectId;
    this.#nodeId      = nodeId;
    this.#nodeLabel   = nodeLabel;
    this.#thingId     = thingId;
    this.#thingLabel  = thingLabel;
    this.#eventKey    = eventKey;
    this.#nodePayload = nodePayload;
    this.#updateContextBar();
    this.#renderHistory();
  }

  // ── Storage ────────────────────────────────────────────────────────────────

  get #storageKey() {
    if (!this.#nodeId) return `${STORAGE_PREFIX}${this.#projectId}:workspace`;
    const parts = [`${STORAGE_PREFIX}${this.#projectId}`, this.#nodeId];
    if (this.#thingId) parts.push(this.#thingId);
    return parts.join(':');
  }

  #loadHistory() {
    try { return JSON.parse(localStorage.getItem(this.#storageKey) ?? '[]'); }
    catch { return []; }
  }

  #saveHistory(msgs) {
    try { localStorage.setItem(this.#storageKey, JSON.stringify(msgs)); }
    catch {}
  }

  // ── System prompt ──────────────────────────────────────────────────────────
  // Keep compact — shares the 8K context window with history + reasoning tokens.

  /** Generate one compact line per action category: id(p1,p2) id2(p1) … */
  #buildActionCatalog() {
    const lines = ['Steps use { action: "id", params: { key: val } }:'];
    for (const [, cat] of Object.entries(this.#actionLibrary)) {
      const ids = Object.entries(cat.actions).map(([id, def]) => {
        const pnames = def.params.map(p => p.name);
        return pnames.length ? `${id}(${pnames.join(',')})` : id;
      });
      lines.push(ids.join(' '));
    }
    return lines.join('\n');
  }

  #buildSystemPrompt() {
    const lines = [
      'You are an AI assistant inside Undercity IDE, a visual flow-based app builder.',
      'Rooms are rooms; inventory is session state. Be concise and direct.',
      '',
    ];

    if (!this.#nodeId) {
      lines.push('Workspace mode — no room selected. Help with flow design and architecture.');
    } else {
      if (this.#nodeLabel)  lines.push(`Room: "${this.#nodeLabel}" (id: ${this.#nodeId})`);
      if (this.#thingLabel) lines.push(`Thing: "${this.#thingLabel}"`);
      if (this.#eventKey)   lines.push(`Event: "${this.#eventKey}"`);
      if (this.#nodePayload && this.#eventKey) {
        const steps = this.#nodePayload[this.#eventKey] ?? [];
        lines.push(steps.length ? `Current steps: ${JSON.stringify(steps)}` : 'Current steps: (empty)');
      }
      if (this.#nodeLabel && this.#eventKey) {
        lines.push(`To add steps here: addStep with node="${this.#nodeLabel}" event="${this.#eventKey}"`);
      }
    }

    lines.push('');
    lines.push(this.#buildActionCatalog());
    lines.push('Things: ' + Object.keys(THING_LIBRARY).join(', '));
    lines.push('');
    lines.push('Use undercity_commands for graph/step changes. Reply in plain text for questions.');

    return lines.join('\n');
  }

  // ── DOM ────────────────────────────────────────────────────────────────────

  #render() {
    this.#containerEl.innerHTML = `
      <div id="chat-header">
        <span id="chat-title">AI Chat</span>
        <button id="chat-clear-btn" title="Clear history">↺</button>
      </div>
      <div id="chat-context-bar"></div>
      <div id="chat-messages"></div>
      <div id="chat-input-row">
        <textarea id="chat-input" rows="2" placeholder="Ask or say 'Build a login flow'…"></textarea>
        <button id="chat-send-btn">Send</button>
      </div>`;

    this.#messagesEl = this.#containerEl.querySelector('#chat-messages');
    this.#inputEl    = this.#containerEl.querySelector('#chat-input');
    this.#sendBtn    = this.#containerEl.querySelector('#chat-send-btn');
    this.#clearBtn   = this.#containerEl.querySelector('#chat-clear-btn');
    this.#contextEl  = this.#containerEl.querySelector('#chat-context-bar');

    this.#sendBtn.addEventListener('click', () => this.#send());
    this.#clearBtn.addEventListener('click', () => { this.#saveHistory([]); this.#renderHistory(); });
    this.#inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.#send(); }
    });

    this.#renderHistory();
  }

  #updateContextBar() {
    if (!this.#contextEl) return;
    if (!this.#nodeId) { this.#contextEl.textContent = 'Workspace'; return; }
    const parts = [];
    if (this.#nodeLabel)  parts.push(this.#nodeLabel);
    if (this.#thingLabel) parts.push(this.#thingLabel);
    if (this.#eventKey)   parts.push(this.#eventKey);
    this.#contextEl.textContent = parts.join(' / ');
  }

  #renderHistory() {
    if (!this.#messagesEl) return;
    const history = this.#loadHistory();
    this.#messagesEl.innerHTML = '';
    for (const msg of history) {
      if (msg.role === 'system') continue;
      if (msg.role === 'tool')   continue; // skip tool results in display
      if (msg.role === 'assistant' && msg._toolCommands) {
        const bubble = this.#makeBubble('assistant');
        bubble.appendChild(this.#makeCommandCard(msg._toolCommands, true));
        this.#messagesEl.appendChild(bubble);
      } else if (msg.role === 'assistant') {
        const bubble = this.#makeBubble('assistant');
        bubble.textContent = msg.content || '';
        this.#messagesEl.appendChild(bubble);
      } else {
        const bubble = this.#makeBubble(msg.role);
        bubble.textContent = msg.content || '';
        this.#messagesEl.appendChild(bubble);
      }
    }
    this.#scrollToBottom();
  }

  #makeBubble(role) {
    const div = document.createElement('div');
    div.className = `chat-bubble chat-${role}`;
    return div;
  }

  /** Build an executable command card. alreadyExecuted=true disables the button. */
  #makeCommandCard(commands, alreadyExecuted = false) {
    const card = document.createElement('div');
    card.className = 'chat-cmd-card';

    const counts = {};
    for (const c of commands) {
      const key = c.cmd ?? (c.from ? 'addEdge' : 'addNode');
      counts[key] = (counts[key] ?? 0) + 1;
    }

    const pre = document.createElement('pre');
    pre.className = 'chat-cmd-pre';
    pre.textContent = JSON.stringify(commands, null, 2);
    pre.style.display = 'none';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'chat-cmd-toggle';
    toggleBtn.textContent = '{ }';
    toggleBtn.addEventListener('click', () => {
      const shown = pre.style.display !== 'none';
      pre.style.display = shown ? 'none' : '';
      toggleBtn.classList.toggle('active', !shown);
    });

    const execBtn = document.createElement('button');
    execBtn.className = alreadyExecuted ? 'chat-cmd-exec done' : 'chat-cmd-exec';
    execBtn.textContent = alreadyExecuted ? '✓ Done' : '▶ Execute';
    execBtn.disabled = alreadyExecuted;

    const rerunBtn = document.createElement('button');
    rerunBtn.className = 'chat-cmd-rerun';
    rerunBtn.title = 'Re-run commands';
    rerunBtn.textContent = '↺';
    rerunBtn.style.display = alreadyExecuted ? '' : 'none';
    const _doRun = () => {
      const result = this.onExecuteCommands?.(commands);
      if (result?.error) {
        rerunBtn.title = result.error;
        rerunBtn.classList.add('error');
        setTimeout(() => { rerunBtn.classList.remove('error'); rerunBtn.title = 'Re-run commands'; }, 2000);
      } else {
        rerunBtn.classList.add('ok');
        setTimeout(() => rerunBtn.classList.remove('ok'), 800);
      }
    };

    if (!alreadyExecuted) {
      execBtn.addEventListener('click', () => {
        const result = this.onExecuteCommands?.(commands);
        execBtn.textContent = result?.error ? `✗ ${result.error}` : '✓ Done';
        execBtn.className   = result?.error ? 'chat-cmd-exec error' : 'chat-cmd-exec done';
        execBtn.disabled    = true;
        if (!result?.error) rerunBtn.style.display = '';
      });
    }
    rerunBtn.addEventListener('click', _doRun);

    const summary = document.createElement('div');
    summary.className = 'chat-cmd-summary';
    summary.textContent = Object.entries(counts).map(([k, v]) => `${v}× ${k}`).join(', ');

    const toolbar = document.createElement('div');
    toolbar.className = 'chat-cmd-toolbar';
    toolbar.append(summary, toggleBtn, execBtn, rerunBtn);

    card.append(toolbar, pre);
    return card;
  }

  #scrollToBottom() {
    if (this.#messagesEl) this.#messagesEl.scrollTop = this.#messagesEl.scrollHeight;
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  async #send() {
    const text = this.#inputEl.value.trim();
    if (!text || this.#streaming) return;
    this.#inputEl.value = '';

    const history = this.#loadHistory();
    // Keep last 6 messages to stay within 8K context budget
    const trimmed = history.slice(-6);

    const messages = [
      { role: 'system', content: this.#buildSystemPrompt() },
      ...trimmed,
      { role: 'user', content: text },
    ];

    history.push({ role: 'user', content: text });
    this.#saveHistory(history);

    // Show user bubble
    const userBubble = this.#makeBubble('user');
    userBubble.textContent = text;
    this.#messagesEl.appendChild(userBubble);

    // Thinking indicator
    const assistantBubble = this.#makeBubble('assistant');
    assistantBubble.dataset.streaming = '1';
    const thinkEl = document.createElement('span');
    thinkEl.className = 'chat-thinking';
    thinkEl.textContent = '⟳ Thinking…';
    assistantBubble.appendChild(thinkEl);
    this.#messagesEl.appendChild(assistantBubble);
    this.#scrollToBottom();

    this.#streaming = true;
    this.#sendBtn.disabled = true;

    try {
      const res = await fetch(ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:        MODEL,
          messages,
          tools:        [PATHWAY_TOOL],
          tool_choice:  'auto',
          stream:       true,
          max_tokens:   1500,
          temperature:  0.3,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let fullContent  = '';
      let toolArgsBuf  = '';
      let toolCallId   = '';
      let reasoning    = 0;
      let finishReason = null;
      let contentStarted = false;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data:')) continue;
          const data = trimmedLine.slice(5).trim();
          if (data === '[DONE]') break outer;
          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0] ?? {};
            const delta  = choice.delta ?? {};
            if (choice.finish_reason) finishReason = choice.finish_reason;

            // Reasoning phase — update indicator
            if (delta.reasoning_content) {
              reasoning++;
              thinkEl.textContent = `⟳ Thinking… (${reasoning} tokens)`;
            }

            // Plain text content
            if (delta.content) {
              if (!contentStarted) {
                contentStarted = true;
                assistantBubble.textContent = '';
              }
              fullContent += delta.content;
              assistantBubble.textContent = fullContent;
              this.#scrollToBottom();
            }

            // Tool call streaming — accumulate arguments JSON
            for (const tc of (delta.tool_calls ?? [])) {
              if (tc.id) toolCallId = tc.id;
              toolArgsBuf += tc.function?.arguments ?? '';
            }
          } catch { /* malformed SSE line */ }
        }
      }

      console.debug('[Chat] finish:', finishReason, '| reasoning:', reasoning,
        '| content:', fullContent.length, '| toolArgs:', toolArgsBuf.length);

      assistantBubble.removeAttribute('data-streaming');
      assistantBubble.textContent = '';

      if (finishReason === 'tool_calls' && toolArgsBuf) {
        // Parse commands from tool call arguments
        let commands;
        try {
          const parsed = JSON.parse(toolArgsBuf);
          commands = parsed.commands ?? (Array.isArray(parsed) ? parsed : [parsed]);
          // Normalise: infer missing `cmd` fields
          commands = commands.map(c => ({
            cmd: c.cmd ?? (c.step !== undefined ? 'addStep' : c.from !== undefined ? 'addEdge' : 'addNode'),
            ...c,
          }));
          // Context injection: fill node/event for addStep from current selection.
          // Guard: model sometimes puts a command keyword (e.g. "addStep") in the
          // node field by mistake — treat those as missing.
          const CMD_KEYWORDS = new Set(['addNode','addEdge','addStep','setLabel','setEntry']);
          commands = commands.map(c => {
            if (c.cmd !== 'addStep') return c;
            const modelNode = (c.node && !CMD_KEYWORDS.has(c.node)) ? c.node : null;
            return {
              ...c,
              node:  modelNode ?? this.#nodeLabel ?? c.node,
              event: c.event  ?? this.#eventKey  ?? 'onEnter',
            };
          });
        } catch (e) {
          assistantBubble.textContent = `⚠ Could not parse tool response: ${e.message}`;
          assistantBubble.classList.add('chat-error');
          history.pop(); // remove failed user message
          this.#saveHistory(history);
          return;
        }

        assistantBubble.appendChild(this.#makeCommandCard(commands, false));

        // Persist: assistant turn with tool call + placeholder tool result
        history.push({
          role: 'assistant',
          content: null,
          _toolCommands: commands,   // used for display-only on re-render
          tool_calls: [{
            id: toolCallId || 'call_0',
            type: 'function',
            function: { name: 'undercity_commands', arguments: toolArgsBuf },
          }],
        });
        // Some models need a tool result turn to continue conversation
        history.push({
          role: 'tool',
          tool_call_id: toolCallId || 'call_0',
          content: 'Commands ready for user to execute.',
        });
        this.#saveHistory(history);

      } else if (finishReason === 'length' && !fullContent) {
        assistantBubble.textContent = '⚠ Context limit reached during thinking. Clear history (↺) and try a shorter request.';
        assistantBubble.classList.add('chat-error');
        history.pop();
        this.#saveHistory(history);

      } else if (fullContent.trim()) {
        assistantBubble.textContent = fullContent;
        history.push({ role: 'assistant', content: fullContent });
        this.#saveHistory(history);

      } else {
        assistantBubble.textContent = '(no response — try rephrasing)';
        assistantBubble.classList.add('chat-error');
        history.pop();
        this.#saveHistory(history);
      }

      this.#scrollToBottom();

    } catch (err) {
      console.error('[Chat] error:', err);
      assistantBubble.textContent = `Error: ${err.message}`;
      assistantBubble.classList.add('chat-error');
    } finally {
      this.#streaming = false;
      this.#sendBtn.disabled = false;
      this.#inputEl.focus();
    }
  }
}
