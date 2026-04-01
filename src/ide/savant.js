/**
 * savant.js — Bottom-pane Savant UI.
 *
 * Layout: [Event Tabs] | Categories | Actions | Workflow
 *
 * Workflow shows the step list for the selected node's current event.
 * Clicking an action card appends it to the workflow.
 * Steps support inline param editing and drag-to-reorder.
 *
 * ACTION_LIBRARY starts empty. Categories are registered exclusively via
 * App.use(plugin) → app.registerActions(catId, def) → savant.registerCategory().
 * If actions/index.js has nothing registered, no categories appear.
 *
 * The AI section at the bottom of categories lets the user describe
 * a new action in plain language — the server calls localhost:8191 and
 * returns a definition placed in the correct category by ID prefix,
 * marked with a ✦ badge so the user knows it is AI-generated.
 */

import { Signal, Emitter } from '/src/lib/signal.js';
import { Scope } from '/src/lib/scope.js';
import { SavantChat } from '/src/ide/savant-chat.js';

function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
import { renderAfIcon } from '/src/lib/icons.js';

/** Copy MCP JSON commands to clipboard and show a transient toast. */
function _copyMcpJson(cmds) {
  const json = JSON.stringify(cmds, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    const t = document.createElement('div');
    t.textContent = `Copied ${cmds.length} command${cmds.length !== 1 ? 's' : ''} to clipboard`;
    t.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--sol-cyan,#2aa198);color:#002b36;padding:6px 16px;border-radius:6px;font-size:12px;z-index:9999;pointer-events:none';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }).catch(() => {
    // Fallback: open in a modal-style textarea
    const win = window.open('', '_blank', 'width=640,height=480');
    if (win) { win.document.write(`<pre style="font:13px monospace;padding:16px">${json.replace(/</g,'&lt;')}</pre>`); }
  });
}
import { THING_LIBRARY, getThingEvents } from '/src/ide/thing-library.js';
import { API } from '/src/ide/project-api.js';

// ── Action Library (populated exclusively via registerCategory) ───────────────
// No static import from action-library.js. All categories arrive via App.use().
const ACTION_LIBRARY = {};

function findAction(actionId) {
  for (const cat of Object.values(ACTION_LIBRARY)) {
    if (cat.actions?.[actionId]) return cat.actions[actionId];
  }
  return null;
}

// ── Savant ───────────────────────────────────────────────────────────────────
export class Savant extends Emitter {
  #scope      = new Scope();
  #nodeScope  = new Scope(); // reset when node changes
  #node       = null;
  #thingCtx   = null;  // { thingDef, parentNode } — set when editing a Thing
  #thingNameSig = null; // Signal<string> for the active thing's display name
  #event      = 'onEnter';
  #category   = null;
  #customActions = {};  // id → def (AI-generated or project-level)
  #chat       = null;
  _projectId  = '';
  // Step UI mode stored in memory, never persisted to project.json
  // Key format: "${nodeId}:${event}:${stepIndex}"
  #stepModes      = new Map();
  #collapsedSteps = new Set();

  // DOM refs
  #catPane; #actPane; #actList; #actPreview; #wfPane; #wfTitle; #wfSteps;
  #eventTabs; #breadcrumb;
  #aiInput; #aiBtn;
  // Currently previewed action
  #previewedAction = null; // { actionId, def }

  constructor(containerEl, { customActions = {} } = {}) {
    super();
    this.#catPane    = containerEl.querySelector('#cat-pane');
    this.#actPane    = containerEl.querySelector('#act-pane');
    this.#actList    = containerEl.querySelector('#act-list');
    this.#actPreview = containerEl.querySelector('#act-preview');
    this.#wfPane     = containerEl.querySelector('#wf-pane');
    this.#wfTitle    = containerEl.querySelector('#wf-title');
    this.#wfSteps    = containerEl.querySelector('#wf-steps');
    this.#eventTabs  = containerEl.querySelector('#event-tabs');
    this.#breadcrumb = containerEl.querySelector('#savant-breadcrumb');
    this.#customActions = customActions;

    // Wire workflow help toggle
    const wfHelpBtn = document.getElementById('wf-help-btn');
    const wfHelpPanel = document.getElementById('wf-help-panel');
    wfHelpBtn?.addEventListener('click', () => {
      const isHidden = wfHelpPanel.hidden;
      wfHelpPanel.hidden = !isHidden;
      wfHelpBtn.setAttribute('aria-expanded', String(isHidden));
      wfHelpBtn.classList.toggle('active', isHidden);
    });

    // Wire workspace export button — exports current node's workflow as MCP addStep JSON
    document.getElementById('wf-workspace-btn')?.addEventListener('click', () => {
      if (!this.#node) { return; }
      const nodeName  = this.#node.label?.value ?? this.#node.label ?? 'Room';
      const payload   = this.#node.payload?.peek() ?? {};
      const eventKeys = Object.keys(payload).filter(k => Array.isArray(payload[k]) && payload[k].length);
      if (!eventKeys.length) { return; }
      const cmds = eventKeys.flatMap(event =>
        payload[event].map(step => ({ cmd: 'addStep', node: nodeName, event, step }))
      );
      _copyMcpJson(cmds);
    });

    // Wire preview "Add" button
    containerEl.querySelector('#act-preview-add')?.addEventListener('click', () => {
      if (this.#previewedAction) {
        this.#addStep(this.#previewedAction.actionId, this.#previewedAction.def);
      }
    });

    this.#buildEventTabs();
    this.#buildCategories();
    this.#selectCategory(Object.keys(ACTION_LIBRARY)[0]);
    this.#renderWorkflow();

    const chatEl = containerEl.querySelector('#chat-pane');
    if (chatEl) {
      this.#chat = new SavantChat(chatEl);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  setNode(node) {
    this.#nodeScope.dispose();
    this.#thingCtx = null;
    this.#thingNameSig = null;
    this.#node = node;
    this.#event = 'onEnter';
    this.#updateBreadcrumb();
    if (node) {
      this.#nodeScope.add(
        node.label.subscribe(() => this.#updateBreadcrumb(), false)
      );
      this.#nodeScope.add(
        node.payload.subscribe(() => {
          this.#buildEventTabs();
          this.#renderWorkflow();
        }, false)
      );
    }
    this.#buildEventTabs();
    this.#renderWorkflow();
    this.#updateChatContext();
  }

  setEvent(event) {
    this.#event = event;
    this.#updateEventTabsUI();
    this.#renderWorkflow();
    this.#updateChatContext();
  }

  /**
   * Switch the Savant into Thing-editing mode.
   * thingDef = { id, type, config, events }  (plain object from node.things)
   * parentNode = the GraphNode that owns this thing
   */
  setThing(thingDef, parentNode) {
    this.#thingCtx = { thingDef, parentNode };
    this.#thingNameSig = new Signal(
      thingDef.config?.name || THING_LIBRARY[thingDef.type]?.label || thingDef.type
    );
    this.#nodeScope.dispose();
    this.#node = this.#makeThingProxy(thingDef, parentNode);
    this.#event = 'onEnter';
    this.#updateBreadcrumb();
    // Push: re-render whenever the thing's payload signal changes
    this.#nodeScope.add(
      this.#node.payload.subscribe(() => {
        this.#buildEventTabs();
        this.#renderWorkflow();
      }, false)
    );
    this.#buildEventTabs();
    this.#renderWorkflow();
    this.#updateChatContext();
  }

  #updateBreadcrumb() {
    if (!this.#breadcrumb) return;
    this.#breadcrumb.innerHTML = '';

    if (!this.#node) {
      const idle = document.createElement('span');
      idle.className = 'bc-item bc-idle';
      idle.textContent = 'No node selected';
      this.#breadcrumb.appendChild(idle);
      return;
    }

    if (this.#node._isThing && this.#thingCtx) {
      const { thingDef, parentNode } = this.#thingCtx;
      const roomLabel  = parentNode.label?.value ?? parentNode.label ?? 'Room';
      const thingLabel = this.#thingNameSig?.value
        ?? thingDef.config?.name
        ?? THING_LIBRARY[thingDef.type]?.label
        ?? thingDef.type;

      const roomBtn = document.createElement('button');
      roomBtn.className = 'bc-item bc-room bc-link';
      roomBtn.textContent = roomLabel;
      roomBtn.addEventListener('click', () => {
        this.setNode(parentNode);
        this.emit('thing:exit', parentNode);
      });

      const sep = document.createElement('span');
      sep.className = 'bc-sep';
      sep.textContent = '/';

      const thingSpan = document.createElement('span');
      thingSpan.className = 'bc-item bc-thing';
      thingSpan.textContent = thingLabel;

      this.#breadcrumb.append(roomBtn, sep, thingSpan);
    } else {
      const label = this.#node.label?.value ?? this.#node.label ?? 'Room';
      const type  = this.#node.type ?? '';

      const roomSpan = document.createElement('span');
      roomSpan.className = 'bc-item bc-room';
      roomSpan.textContent = label;

      const typeSpan = document.createElement('span');
      typeSpan.className = 'bc-type';
      typeSpan.textContent = type;

      this.#breadcrumb.append(roomSpan, typeSpan);
    }
  }

  /** Update the active thing's display name. Refreshes the breadcrumb live. */
  updateThingName(name) {
    if (this.#thingNameSig) this.#thingNameSig.value = name;
    this.#updateBreadcrumb();
  }

  /** Wrap a thingDef so it looks like a GraphNode to the Savant. */
  #makeThingProxy(thingDef, parentNode) {
    // Build a payload Signal from the thing's events object
    const payloadSig = new Signal({ ...thingDef.events });
    // Build event tabs from the thing type's defaultEvents + any custom keys
    const lib = THING_LIBRARY[thingDef.type] ?? {};
    const canAdd = lib.canAddEvents ?? false;

    const proxy = {
      id:       thingDef.id,
      type:     'room',   // so workflow renders normally
      label:    { value: thingDef.id, subscribe: (_cb, _i) => () => {} },
      payload:  payloadSig,
      routes:   { peek: () => [] },
      things:   { peek: () => [] },
      _isThing: true,
      _canAddEvents: canAdd,
      _thingType: thingDef.type,

      // GraphNode-compatible step mutation methods
      addStep(event, step) {
        const p = { ...payloadSig.peek() };
        p[event] = [...(p[event] ?? []), step];
        payloadSig.value = p;
        thingDef.events = p;
        parentNode.updateThing(thingDef.id, { events: p });
      },
      insertStep(event, index, step) {
        const p = { ...payloadSig.peek() };
        const steps = [...(p[event] ?? [])];
        steps.splice(index, 0, step);
        p[event] = steps;
        payloadSig.value = p;
        thingDef.events = p;
        parentNode.updateThing(thingDef.id, { events: p });
      },
      removeStep(event, index) {
        const p = { ...payloadSig.peek() };
        p[event] = (p[event] ?? []).filter((_, i) => i !== index);
        payloadSig.value = p;
        thingDef.events = p;
        parentNode.updateThing(thingDef.id, { events: p });
      },
      updateStep(event, index, step) {
        const p = { ...payloadSig.peek() };
        p[event] = (p[event] ?? []).map((s, i) => i === index ? { ...s, ...step } : s);
        payloadSig.value = p;
        thingDef.events = p;
        parentNode.updateThing(thingDef.id, { events: p });
      },
      moveStep(event, from, to) {
        const p = { ...payloadSig.peek() };
        const steps = [...(p[event] ?? [])];
        const [item] = steps.splice(from, 1);
        steps.splice(to, 0, item);
        p[event] = steps;
        payloadSig.value = p;
        thingDef.events = p;
        parentNode.updateThing(thingDef.id, { events: p });
      },
    };

    return proxy;
  }

  addCustomAction(id, def) {
    this.#customActions[id] = def;
    // Route to the correct category by ID prefix (e.g. "room.myAction" → room category).
    // Falls back to the first registered category if no prefix match.
    const prefixCat = id.includes('.') ? id.split('.')[0] : null;
    const targetCat = (prefixCat && ACTION_LIBRARY[prefixCat])
      ? prefixCat
      : Object.keys(ACTION_LIBRARY)[0];
    if (targetCat && ACTION_LIBRARY[targetCat]) {
      ACTION_LIBRARY[targetCat].actions[id] = { ...def, _aiGenerated: true };
      if (this.#category === targetCat) this.#renderActions(targetCat);
    }
    this.emit('customActionsChanged', this.#customActions);
  }

  getCustomActions() { return { ...this.#customActions }; }

  /**
   * Register (or replace) an entire action category.
   * Called by category plugins installed via App.use().
   */
  registerCategory(catId, def) {
    ACTION_LIBRARY[catId] = { ...def };
    this.#buildCategories();
    this.#selectCategory(this.#category ?? Object.keys(ACTION_LIBRARY)[0]);
    // Keep chat's action catalog in sync
    this.#chat?.setActionLibrary(ACTION_LIBRARY);
  }

  /**
   * @deprecated — server-side mergePlugins was removed in v2. Actions come exclusively
   * from App.use(ActionsPlugin). This stub is retained to avoid hard errors if old code
   * calls it, but it is a no-op.
   */
  mergePlugins(plugins = {}) {
    // no-op in v2 — use App.use(ActionsPlugin) instead
    console.warn('[Savant] mergePlugins() is deprecated and has no effect in v2. Use App.use(ActionsPlugin).');
  }

  // ── Event tabs ─────────────────────────────────────────────────────────────

  static #LIFECYCLE = [
    { key: 'onEnter',  label: 'Enter'  },
    { key: 'onExit',   label: 'Exit'   },
    { key: 'onBack',   label: 'Back'   },
    { key: 'onReset',  label: 'Reset'  },
    { key: 'onUnload', label: 'Unload' },
  ];
  static #LIFECYCLE_KEYS = new Set(['onEnter','onExit','onBack','onReset','onUnload']);

  #buildEventTabs() {
    const container = this.#eventTabs;
    container.innerHTML = '';

    if (!this.#node) { this.#updateEventTabsUI(); return; }

    if (this.#node._isThing) {
      // Thing mode — show defaultEvents from THING_LIBRARY, plus any custom keys
      const thingType   = this.#node._thingType;
      const defaultEvts = getThingEvents(thingType);
      const payload     = this.#node.payload.peek();

      for (const { key, label, fixed } of defaultEvts) {
        container.appendChild(this.#makeTab(key, label, !fixed));
      }
      // Extra event keys not in defaultEvents
      const defaultKeys = new Set(defaultEvts.map(e => e.key));
      for (const key of Object.keys(payload)) {
        if (!defaultKeys.has(key)) {
          container.appendChild(this.#makeTab(key, key, true));
        }
      }
      if (this.#node._canAddEvents) {
        container.appendChild(this.#makeAddTabBtn());
      }
    } else {
      // Room mode — lifecycle tabs
      for (const { key, label } of Savant.#LIFECYCLE) {
        container.appendChild(this.#makeTab(key, label));
      }

      // Custom event-listener tabs (non-lifecycle payload keys)
      const payload = this.#node.payload.peek();
      for (const key of Object.keys(payload)) {
        if (!Savant.#LIFECYCLE_KEYS.has(key)) {
          container.appendChild(this.#makeTab(key, key, true));
        }
      }

      // "+" button — only for room nodes (not diamonds)
      if (this.#node.type !== 'diamond') {
        container.appendChild(this.#makeAddTabBtn());
      }
    }

    this.#updateEventTabsUI();
  }

  #makeAddTabBtn() {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'evt-tab evt-tab-add';
    addBtn.title = 'Add event listener';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => this.#spawnTabInput(addBtn));
    return addBtn;
  }

  #spawnTabInput(addBtn) {
    // Only one inline input at a time
    if (this.#eventTabs.querySelector('.evt-tab-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'evt-tab evt-tab-input';
    input.placeholder = 'eventName';
    input.spellcheck = false;

    const commit = () => {
      const raw = input.value.trim().replace(/\s+/g, '_');
      input.remove();
      if (!raw) return;
      if (!this.#node._isThing && Savant.#LIFECYCLE_KEYS.has(raw)) return;
      const p = this.#node.payload.peek();
      if (p[raw] !== undefined) { this.setEvent(raw); return; }
      const np = { ...p, [raw]: [] };
      if (this.#node._isThing && this.#thingCtx) {
        const { thingDef, parentNode } = this.#thingCtx;
        thingDef.events = np;
        parentNode.updateThing(thingDef.id, { events: np });
      }
      this.#node.payload.value = np;
      this.setEvent(raw);
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); input.remove(); }
    });
    // blur fires when focus leaves — but commit() removes the input which triggers another blur,
    // so guard against double-fire with a flag
    input.addEventListener('blur', () => { input.remove(); });

    this.#eventTabs.insertBefore(input, addBtn);
    input.focus();
  }

  #makeTab(key, label, removable = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'evt-tab position-relative' + (key === this.#event ? ' active' : '');
    btn.dataset.event = key;
    btn.textContent = label;
    btn.addEventListener('click', () => this.setEvent(key));
    if (removable) {
      const x = document.createElement('span');
      x.className = 'evt-tab-remove';
      x.textContent = '×';
      x.title = 'Remove listener';
      x.addEventListener('click', e => {
        e.stopPropagation();
        const p = { ...this.#node.payload.peek() };
        delete p[key];
        if (this.#node._isThing && this.#thingCtx) {
          // Persist the change into the parent node's things array
          const { thingDef, parentNode } = this.#thingCtx;
          thingDef.events = p;
          parentNode.updateThing(thingDef.id, { events: p });
        }
        // Setting .value fires the subscription → #buildEventTabs + #renderWorkflow
        this.#node.payload.value = p;
        this.emit('payload:changed');
        if (this.#event === key) this.setEvent('onEnter');
      });
      btn.appendChild(x);
    }
    return btn;
  }

  #updateEventTabsUI() {
    const payload = this.#node?.payload?.peek() ?? {};
    this.#eventTabs.querySelectorAll('.evt-tab').forEach(btn => {
      const key = btn.dataset.event;
      btn.classList.toggle('active', key === this.#event);

      // Remove old badge
      btn.querySelector('.evt-badge')?.remove();

      // Count steps for this event (routes count for onEnter on diamonds)
      let count = 0;
      if (this.#node?.type === 'diamond' && key === 'onEnter') {
        count = (this.#node.routes?.peek() ?? []).length;
      } else {
        count = (payload[key] ?? []).length;
      }

      if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'evt-badge position-absolute top-0 start-100 translate-middle badge rounded-pill';
        badge.textContent = count > 99 ? '99+' : count;
        badge.setAttribute('aria-hidden', 'true');
        btn.appendChild(badge);
      }
    });
    if (this.#wfTitle) {
      const map = { onEnter:'ENTER', onExit:'EXIT', onBack:'BACK', onReset:'RESET', onUnload:'UNLOAD' };
      this.#wfTitle.textContent = `WORKFLOW  ·  ${map[this.#event] ?? this.#event}`;
    }
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  #buildCategories() {
    this.#catPane.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'cat-header';
    header.textContent = 'Categories';
    this.#catPane.appendChild(header);

    for (const [catId, cat] of Object.entries(ACTION_LIBRARY)) {
      this.#catPane.appendChild(this.#makeCatItem(catId, cat.icon, cat.label));
    }

    // AI input section
    const aiSection = document.createElement('div');
    aiSection.className = 'cat-ai-section';
    aiSection.innerHTML = `
      <textarea class="cat-ai-input" rows="2" placeholder="Describe a new action… e.g. 'Video upload with thumbnail frame selector'"></textarea>
      <button class="cat-ai-btn">${renderAfIcon('magic')}<span>Generate Action</span></button>
    `;
    this.#catPane.appendChild(aiSection);

    this.#aiInput = aiSection.querySelector('.cat-ai-input');
    this.#aiBtn   = aiSection.querySelector('.cat-ai-btn');
    this.#aiBtn.addEventListener('click', () => this.#generateAIAction());
  }

  #makeCatItem(catId, icon, label) {
    const item = document.createElement('div');
    item.className = 'cat-item';
    item.dataset.cat = catId;
    item.innerHTML = `${renderAfIcon(icon, { class: 'cat-icon' })}<span>${label}</span>`;
    item.addEventListener('click', () => this.#selectCategory(catId));
    return item;
  }

  #selectCategory(catId) {
    this.#category = catId;
    this.#catPane.querySelectorAll('.cat-item').forEach(el => {
      el.classList.toggle('active', el.dataset.cat === catId);
    });
    this.#renderActions(catId);
  }

  // ── Actions pane ───────────────────────────────────────────────────────────
  #renderActions(catId) {
    this.#actList.innerHTML = '';

    const actions = ACTION_LIBRARY[catId]?.actions ?? {};

    for (const [actionId, def] of Object.entries(actions)) {
      const card = document.createElement('div');
      card.className = 'act-card';
      if (def._aiGenerated) card.classList.add('act-card--ai');
      card.draggable = true;
      card.dataset.actionId = actionId;
      const nameEl = document.createElement('div');
      nameEl.className = 'act-card-name';
      nameEl.textContent = def.label;
      if (def._aiGenerated) {
        const badge = document.createElement('span');
        badge.className = 'act-card-ai-badge';
        badge.title = 'AI-generated action';
        badge.textContent = '✦';
        nameEl.appendChild(badge);
      }
      const descEl = document.createElement('div');
      descEl.className = 'act-card-desc';
      descEl.textContent = def.desc ?? '';
      card.append(nameEl, descEl);
      // Click → preview (not add)
      card.addEventListener('click', () => this.#showPreview(actionId, def, card));
      // Drag → allow dropping onto workflow
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', `action:${actionId}`);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      this.#actList.appendChild(card);
    }
  }

  // ── Action preview ─────────────────────────────────────────────────────────
  #showPreview(actionId, def, cardEl) {
    // Deselect previous
    this.#actList.querySelectorAll('.act-card.selected').forEach(c => c.classList.remove('selected'));
    cardEl?.classList.add('selected');
    this.#previewedAction = { actionId, def };

    const previewEmpty = document.getElementById('act-preview-empty');
    const previewBody  = document.getElementById('act-preview-body');
    const nameEl       = document.getElementById('act-preview-name');
    const descEl       = document.getElementById('act-preview-desc');
    const paramsEl     = document.getElementById('act-preview-params');

    previewEmpty.style.display = 'none';
    previewBody.style.display  = '';

    nameEl.textContent = def.label ?? actionId;
    descEl.textContent = def.desc ?? '';

    // Render param inputs as a visual preview (read-only-ish labels + types)
    paramsEl.innerHTML = '';
    for (const param of (def.params ?? [])) {
      if (param.name === 'into') continue; // meta param
      const row = document.createElement('div');
      row.className = 'act-preview-param';
      const lbl = document.createElement('span');
      lbl.className = 'act-preview-param-label';
      lbl.textContent = param.label ?? param.name;
      const typ = document.createElement('span');
      typ.className = 'act-preview-param-type';
      typ.textContent = param.type ?? 'text';
      if (param.default !== undefined) {
        typ.textContent += ` = ${JSON.stringify(param.default)}`;
      } else if (param.placeholder) {
        typ.textContent += ` — ${param.placeholder}`;
      }
      row.append(lbl, typ);
      paramsEl.appendChild(row);
    }
    if (!(def.params?.length)) {
      paramsEl.innerHTML = '<span style="color:var(--text-muted);font-size:11px">No parameters</span>';
    }
  }

  // ── Workflow ───────────────────────────────────────────────────────────────
  #getSteps() {
    if (!this.#node) return [];
    const p = this.#node.payload.peek();
    return p[this.#event] ?? [];
  }

  #renderWorkflow() {
    this.#updateEventTabsUI();
    this.#wfSteps.innerHTML = '';

    if (!this.#node) {
      this.#wfSteps.innerHTML = `<div class="wf-empty">Select a room or diamond<br>on the map to edit its flow.</div>`;
      return;
    }

    if (this.#node.type === 'diamond' && this.#event === 'onEnter') {
      // Show routes editor for diamonds
      this.#renderRoutesEditor();
      return;
    }

    const steps = this.#getSteps();
    if (steps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'wf-empty wf-drop-target';
      empty.textContent = 'No steps yet. Drag an action here or click to add.';
      this.#setupDropZone(empty, 0);
      this.#wfSteps.appendChild(empty);
      return;
    }

    // Render steps with drop zones between each one
    this.#wfSteps.appendChild(this.#makeDropZone(0));
    steps.forEach((step, i) => {
      this.#wfSteps.appendChild(this.#makeStepCard(step, i));
      this.#wfSteps.appendChild(this.#makeDropZone(i + 1));
    });
  }

  #makeDropZone(insertIndex) {
    const dz = document.createElement('div');
    dz.className = 'wf-drop-zone';
    this.#setupDropZone(dz, insertIndex);
    return dz;
  }

  #setupDropZone(el, insertIndex) {
    el.addEventListener('dragover', e => {
      const data = e.dataTransfer.types.includes('text/plain');
      if (data) { e.preventDefault(); el.classList.add('drag-over'); }
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const raw = e.dataTransfer.getData('text/plain');
      if (raw.startsWith('action:')) {
        const actionId = raw.slice(7);
        const def = this.#findActionDef(actionId);
        if (def) this.#addStepAt(actionId, def, insertIndex);
      }
      // step reorder drops are handled by the step card itself
    });
  }

  #findActionDef(actionId) {
    for (const cat of Object.values(ACTION_LIBRARY)) {
      if (cat.actions?.[actionId]) return cat.actions[actionId];
    }
    return this.#customActions[actionId] ?? null;
  }

  // ── Step card ──────────────────────────────────────────────────────────────
  // Each step card has three display modes (toggled via the pill switcher):
  //   Basic       — plain-language form, no code fields, friendly labels
  //   Configure   — all params with explicit type-matched inputs (default)
  //   JSON        — raw JSON editor for power users

  #stepModeKey(index) { return `${this.#node?.id}:${this.#event}:${index}`; }

  #getStepMode(step, index) {
    // Prefer memory map; fall back to any legacy _uiMode saved in step data
    return this.#stepModes.get(this.#stepModeKey(index)) ?? step._uiMode ?? 'basic';
  }

  #setStepMode(index, mode) {
    this.#stepModes.set(this.#stepModeKey(index), mode);
    // Re-render the workflow to reflect the new mode (no project.json mutation)
    this.#renderWorkflow();
  }

  #makeStepCard(step, index) {
    const def    = findAction(step.action) ?? this.#customActions[step.action] ?? null;

    // Unregistered action — render a degraded "not loaded" card
    if (!def) {
      const card = document.createElement('div');
      card.className = 'step-card step-card-unloaded';
      card.innerHTML = `
        <div class="step-header">
          <span class="step-drag-handle" draggable="true" title="Drag to reorder">⠿</span>
          <span class="step-number">${index + 1}</span>
          <span class="step-action-name step-unloaded-name">Action not loaded</span>
          <code class="step-unloaded-id">${escH(step.action)}</code>
          <div class="step-controls">
            <button class="step-btn del" title="Delete">${renderAfIcon('x-lg')}</button>
          </div>
        </div>`;
      const dragHandle = card.querySelector('.step-drag-handle');
      dragHandle.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
        card.style.opacity = '0.4';
      });
      dragHandle.addEventListener('dragend', () => { card.style.opacity = ''; });
      card.addEventListener('dragover',  e => { e.preventDefault(); card.style.outline = '1px solid var(--accent)'; });
      card.addEventListener('dragleave', () => { card.style.outline = ''; });
      card.addEventListener('drop', e => {
        e.preventDefault(); card.style.outline = '';
        const raw = e.dataTransfer.getData('text/plain');
        if (raw.startsWith('action:')) return;
        const fromIdx = parseInt(raw);
        if (!isNaN(fromIdx) && fromIdx !== index) this.#node.moveStep(this.#event, fromIdx, index);
      });
      card.querySelector('.step-btn.del').addEventListener('click', () => {
        this.#node.removeStep(this.#event, index);
      });
      return card;
    }

    const params = def.params ?? [];
    const card   = document.createElement('div');
    const isCollapsed = this.#collapsedSteps.has(this.#stepModeKey(index));
    card.className = 'step-card' + (isCollapsed ? ' collapsed' : '');

    const mode = this.#getStepMode(step, index);

    const header = document.createElement('div');
    header.className = 'step-header';
    header.innerHTML = `
      <span class="step-drag-handle" draggable="true" title="Drag to reorder">⠿</span>
      <span class="step-number">${index + 1}</span>
      <span class="step-action-name">${def.label ?? step.action}</span>
      <button class="step-collapse-btn" title="${isCollapsed ? 'Expand' : 'Collapse'}">${isCollapsed ? '▸' : '▾'}</button>
      <div class="step-mode-pills">
        <button class="step-mode-pill${mode === 'basic'     ? ' active' : ''}" data-mode="basic"     title="Simple view">Basic</button>
        <button class="step-mode-pill${mode === 'configure' ? ' active' : ''}" data-mode="configure" title="All parameters">Configure</button>
        <button class="step-mode-pill${mode === 'json'      ? ' active' : ''}" data-mode="json"      title="Raw JSON">JSON</button>
      </div>
      <div class="step-controls">
        <button class="step-btn" title="Move up">↑</button>
        <button class="step-btn" title="Move down">↓</button>
        <button class="step-btn del" title="Delete">${renderAfIcon('x-lg')}</button>
      </div>`;

    const paramsDiv = document.createElement('div');
    paramsDiv.className = 'step-params open';
    paramsDiv.style.display = isCollapsed ? 'none' : '';

    this.#renderStepParamsInMode(paramsDiv, step, index, def, mode);

    card.appendChild(header);
    card.appendChild(paramsDiv);

    // Collapse button
    const collapseBtn = header.querySelector('.step-collapse-btn');
    collapseBtn.addEventListener('click', e => {
      e.stopPropagation();
      const key = this.#stepModeKey(index);
      if (this.#collapsedSteps.has(key)) this.#collapsedSteps.delete(key);
      else this.#collapsedSteps.add(key);
      this.#renderWorkflow();
    });

    // Mode pill switching
    header.querySelectorAll('.step-mode-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const newMode = pill.dataset.mode;
        this.#setStepMode(index, newMode);
      });
    });

    // Button handlers
    const [upBtn, downBtn, delBtn] = header.querySelectorAll('.step-btn');
    delBtn.addEventListener('click', () => { this.#node.removeStep(this.#event, index); });
    upBtn.addEventListener('click',  () => { if (index > 0) this.#node.moveStep(this.#event, index, index - 1); });
    downBtn.addEventListener('click',() => {
      const steps = this.#getSteps();
      if (index < steps.length - 1) this.#node.moveStep(this.#event, index, index + 1);
    });

    // Drag-to-reorder — only the handle initiates drag so inputs stay interactive
    const dragHandle = header.querySelector('.step-drag-handle');
    dragHandle.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.effectAllowed = 'move';
      card.style.opacity = '0.4';
    });
    dragHandle.addEventListener('dragend', () => { card.style.opacity = ''; });
    card.addEventListener('dragover',  e => { e.preventDefault(); card.style.outline = '1px solid var(--accent)'; });
    card.addEventListener('dragleave', () => { card.style.outline = ''; });
    card.addEventListener('drop', e => {
      e.preventDefault(); card.style.outline = '';
      const raw = e.dataTransfer.getData('text/plain');
      if (raw.startsWith('action:')) return; // handled by drop zones
      const fromIdx = parseInt(raw);
      if (!isNaN(fromIdx) && fromIdx !== index) this.#node.moveStep(this.#event, fromIdx, index);
    });

    return card;
  }

  #renderStepParamsInMode(container, step, index, def, mode) {
    container.innerHTML = '';
    if (mode === 'json') {
      this.#renderJsonMode(container, step, index);
    } else if (mode === 'basic') {
      this.#renderBasicMode(container, step, index, def);
    } else {
      this.#renderConfigureMode(container, step, index, def);
    }
  }

  // ── Basic mode — friendly, no code fields ──────────────────────────────────
  #renderBasicMode(container, step, index, def) {
    const params = (def.params ?? []).filter(p => p.type !== 'code' && p.type !== 'textarea');

    if (params.length === 0 && def.desc) {
      const note = document.createElement('div');
      note.className = 'step-basic-desc';
      note.textContent = def.desc;
      container.appendChild(note);
      return;
    }

    if (params.length === 0) {
      const note = document.createElement('div');
      note.className = 'step-basic-desc';
      note.textContent = 'No configuration needed — this action runs automatically.';
      container.appendChild(note);
      return;
    }

    for (const p of params) {
      const row   = document.createElement('div');
      row.className = 'param-row';
      const lbl   = document.createElement('label');
      lbl.className = 'param-label';
      lbl.textContent = p.label;

      const hint = document.createElement('span');
      hint.className = 'param-hint';
      hint.textContent = p.placeholder ?? '';

      const input = this.#makeParamInput(p, step.params?.[p.name] ?? p.default ?? '');
      input.addEventListener('change', () => {
        const storedVal = input.value;
        this.#node.updateStep(this.#event, index, {
          params: { ...(step.params ?? {}), [p.name]: storedVal }
        });
      });
      row.appendChild(lbl);
      row.appendChild(input);
      container.appendChild(row);
    }

    // Show any code params as a note prompting Configure
    const codeParams = (def.params ?? []).filter(p => p.type === 'code' || p.type === 'textarea');
    if (codeParams.length > 0) {
      const note = document.createElement('div');
      note.className = 'step-basic-code-note';
      note.innerHTML = `${renderAfIcon('gear')} <span>${codeParams.map(p => p.label).join(', ')} — switch to <strong>Configure</strong> to edit</span>`;
      container.appendChild(note);
    }
  }

  // ── Configure mode — all params ────────────────────────────────────────────
  #renderConfigureMode(container, step, index, def) {
    const params = def.params ?? [];
    if (params.length === 0) {
      const note = document.createElement('div');
      note.className = 'step-basic-desc';
      note.textContent = def.desc ?? 'No parameters.';
      container.appendChild(note);
      return;
    }

    for (const p of params) {
      const row   = document.createElement('div');
      row.className = 'param-row';
      const lbl   = document.createElement('label');
      lbl.className = 'param-label';
      lbl.innerHTML = `${p.label}${p.type === 'code' ? ' <span class="param-code-badge">JS</span>' : ''}`;
      const input = this.#makeParamInput(p, step.params?.[p.name] ?? p.default ?? '');
      input.addEventListener('change', () => {
        const storedVal = input.value;
        this.#node.updateStep(this.#event, index, {
          params: { ...(step.params ?? {}), [p.name]: storedVal }
        });
      });
      row.appendChild(lbl);
      row.appendChild(input);
      container.appendChild(row);
    }
  }

  // ── JSON mode — raw step object editor ─────────────────────────────────────
  #renderJsonMode(container, step, index) {
    const { _uiMode, ...cleanStep } = step;
    const ta = document.createElement('textarea');
    ta.className = 'param-input step-json-editor';
    ta.rows = 6;
    ta.value = JSON.stringify(cleanStep, null, 2);
    ta.spellcheck = false;

    let parseErr = false;
    const errDiv = document.createElement('div');
    errDiv.className = 'step-json-error';
    errDiv.style.display = 'none';

    ta.addEventListener('input', () => {
      try {
        const parsed = JSON.parse(ta.value);
        parseErr = false;
        errDiv.style.display = 'none';
        ta.style.borderColor = '';
        this.#node.updateStep(this.#event, index, parsed);
      } catch (e) {
        parseErr = true;
        errDiv.textContent = e.message;
        errDiv.style.display = 'block';
        ta.style.borderColor = 'var(--danger)';
      }
    });

    container.appendChild(ta);
    container.appendChild(errDiv);
  }

  #makeParamInput(paramDef, value) {
    if (paramDef.type === 'select') {
      const sel = document.createElement('select');
      sel.className = 'param-input';
      for (const opt of (paramDef.options ?? [])) {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === value) o.selected = true;
        sel.appendChild(o);
      }
      return sel;
    }

    if (paramDef.type === 'boolean') {
      const sel = document.createElement('select');
      sel.className = 'param-input';
      for (const opt of ['true','false']) {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (String(value) === opt) o.selected = true;
        sel.appendChild(o);
      }
      return sel;
    }

    if (paramDef.type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.className = 'param-input';
      ta.rows = 2;
      ta.value = value ?? '';
      ta.placeholder = paramDef.placeholder ?? '';
      return ta;
    }

    if (paramDef.type === 'room') {
      // Dropdown populated by app via needNodeOptions event
      const sel = document.createElement('select');
      sel.className = 'param-input';
      const placeholder = document.createElement('option');
      placeholder.value = ''; placeholder.textContent = '— select room —';
      sel.appendChild(placeholder);
      sel.value = value ?? '';
      // Defer population until app wires needNodeOptions
      requestAnimationFrame(() => {
        this.emit('needNodeOptions', { select: sel, currentValue: value ?? '' });
      });
      return sel;
    }

    if (paramDef.type === 'inventory-key') {
      // inventory-key params are plain strings in v2 — no { $$inv } wrapper
      const keyName = typeof value === 'string' ? value : '';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'param-input param-input-inv-key';
      inp.value = keyName;
      inp.placeholder = paramDef.placeholder ?? 'inventoryKey';
      return inp;
    }

    const inp = document.createElement('input');
    inp.className = 'param-input';
    if (paramDef.type === 'number') inp.type = 'number';
    else if (paramDef.type === 'url') inp.type = 'url';
    else inp.type = 'text';
    inp.value = value ?? '';
    inp.placeholder = paramDef.placeholder ?? '';
    if (paramDef.type === 'code') inp.classList.add('param-input-code');
    return inp;
  }

  // ── Add step from action card ──────────────────────────────────────────────
  #addStep(actionId, def) {
    if (!this.#node) return;
    const params = {};
    for (const p of (def.params ?? [])) {
      params[p.name] = p.default ?? '';
    }
    this.#node.addStep(this.#event, { action: actionId, params });
    // Expand the last card after render
    requestAnimationFrame(() => {
      const cards = this.#wfSteps.querySelectorAll('.step-card');
      const last = cards[cards.length - 1];
      last?.querySelector('.step-params')?.classList.add('open');
      last?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  #addStepAt(actionId, def, insertIndex) {
    if (!this.#node) return;
    const params = {};
    for (const p of (def.params ?? [])) {
      params[p.name] = p.default ?? '';
    }
    this.#node.insertStep(this.#event, insertIndex, { action: actionId, params });
  }

  // ── Diamond routes editor ─────────────────────────────────────────────────
  #renderRoutesEditor() {
    this.#wfSteps.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;color:var(--text-muted);margin-bottom:8px';
    header.textContent = 'Routes are evaluated top-to-bottom. First match wins. Use inventory.key syntax.';
    this.#wfSteps.appendChild(header);

    const routes = this.#node.routes.peek() ?? [];
    routes.forEach((route, i) => {
      this.#wfSteps.appendChild(this.#makeRouteRow(route, i));
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'add-route-btn';
    addBtn.textContent = '+ Add Route';
    addBtn.addEventListener('click', () => {
      const rs = [...(this.#node.routes.peek() ?? [])];
      rs.push({ condition: 'true', target: '', label: 'Default' });
      this.#node.routes.value = rs;
      this.#renderWorkflow();
    });
    this.#wfSteps.appendChild(addBtn);
  }

  /** Parse a condition like `inventory.get('key') === 'val'` or `inventory.key === 'val'` into {key, op, value} */
  #parseCondition(cond) {
    // Match: inventory.get('key') op value  OR  inventory.key op value
    const m = cond.trim().match(/^inventory\.(?:get\(['"](.+?)['"]\)|(\w+))\s*(===|!==|==|!=|>=|<=|>|<|includes)\s*(.+)$/);
    if (!m) return null;
    const key = m[1] ?? m[2];
    const op  = m[3];
    let val   = m[4].trim();
    // Strip quotes from string values
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    return { key, op, val };
  }

  /** Build a condition expression from {key, op, val} */
  #buildCondition(key, op, val) {
    if (!key) return 'true';
    const valExpr = isNaN(val) && val !== 'true' && val !== 'false'
      ? `'${val.replace(/'/g, "\\'")}'`
      : val;
    return `inventory.get('${key}') ${op} ${valExpr}`;
  }

  #makeRouteRow(route, index) {
    const row = document.createElement('div');
    row.className = 'route-row';

    const parsed = this.#parseCondition(route.condition ?? '');

    row.innerHTML = `
      <div class="route-builder">
        <div class="route-visual${parsed ? '' : ' hidden'}">
          <select class="route-key"><option value="">— inventory key —</option></select>
          <select class="route-op">
            <option value="===">=== (equals)</option>
            <option value="!==">!== (not equals)</option>
            <option value=">=">>= (≥)</option>
            <option value="<=">&lt;= (≤)</option>
            <option value=">">> (greater)</option>
            <option value="<">&lt; (less)</option>
            <option value="includes">includes</option>
          </select>
          <input class="route-val" placeholder="value">
        </div>
        <div class="route-advanced${parsed ? ' hidden' : ''}">
          <input class="route-condition" placeholder="inventory.get('key') === 'value'" value="${escAttr(route.condition ?? '')}">
        </div>
        <button class="route-toggle-mode" title="${parsed ? 'Switch to expression mode' : 'Switch to visual mode'}">${parsed ? '{ }' : '◈'}</button>
      </div>
      <div class="route-footer">
        <select class="route-target">
          <option value="">— target room —</option>
        </select>
        <button class="route-del" title="Delete route">${renderAfIcon('x-lg')}</button>
      </div>`;

    const visualDiv  = row.querySelector('.route-visual');
    const advDiv     = row.querySelector('.route-advanced');
    const keySel     = row.querySelector('.route-key');
    const opSel      = row.querySelector('.route-op');
    const valInput   = row.querySelector('.route-val');
    const condInput  = row.querySelector('.route-condition');
    const toggleBtn  = row.querySelector('.route-toggle-mode');
    const tgtSel     = row.querySelector('.route-target');
    const delBtn     = row.querySelector('.route-del');

    // Populate inventory keys
    this.emit('needInventoryKeys', { select: keySel, currentValue: parsed?.key ?? '' });

    // Populate target options from graph
    this.emit('needNodeOptions', { select: tgtSel, currentValue: route.target });

    // Set visual values if parsed
    if (parsed) {
      keySel.value  = parsed.key;
      opSel.value   = parsed.op;
      valInput.value = parsed.val;
    }

    // Toggle between visual and advanced mode
    toggleBtn.addEventListener('click', () => {
      const isVisual = !visualDiv.classList.contains('hidden');
      if (isVisual) {
        // Switch to expression
        visualDiv.classList.add('hidden');
        advDiv.classList.remove('hidden');
        toggleBtn.textContent = '◈';
        toggleBtn.title = 'Switch to visual mode';
      } else {
        // Switch to visual — try to parse current expression
        const p2 = this.#parseCondition(condInput.value);
        if (p2) {
          this.emit('needInventoryKeys', { select: keySel, currentValue: p2.key });
          keySel.value   = p2.key;
          opSel.value    = p2.op;
          valInput.value = p2.val;
          visualDiv.classList.remove('hidden');
          advDiv.classList.add('hidden');
          toggleBtn.textContent = '{ }';
          toggleBtn.title = 'Switch to expression mode';
        } else {
          this.emit('toast', { msg: 'Cannot parse expression — edit manually', type: 'info' });
        }
      }
    });

    const syncFromVisual = () => {
      const cond = this.#buildCondition(keySel.value, opSel.value, valInput.value || 'true');
      condInput.value = cond;
      this.#updateRoute(index, { condition: cond });
    };

    keySel.addEventListener('change', syncFromVisual);
    opSel.addEventListener('change', syncFromVisual);
    valInput.addEventListener('input', syncFromVisual);
    condInput.addEventListener('change', () => this.#updateRoute(index, { condition: condInput.value }));

    tgtSel.addEventListener('change', () => this.#updateRoute(index, { target: tgtSel.value }));
    delBtn.addEventListener('click', () => {
      const rs = (this.#node.routes.peek() ?? []).filter((_, i) => i !== index);
      this.#node.routes.value = rs;
      this.#renderWorkflow();
    });

    return row;
  }

  #updateRoute(index, changes) {
    const routes = [...(this.#node.routes.peek() ?? [])];
    routes[index] = { ...routes[index], ...changes };
    this.#node.routes.value = routes;
  }

  // ── AI action generation ──────────────────────────────────────────────────
  async #generateAIAction() {
    const prompt = this.#aiInput.value.trim();
    if (!prompt) return;

    this.#aiBtn.disabled = true;
    this.#aiBtn.innerHTML = `${renderAfIcon('arrow-repeat')}<span>Generating…</span>`;

    try {
      const result = await API.generateAction(prompt);
      if (result?.id && result?.label) {
        this.addCustomAction(result.id, result);
        // Navigate to the category where the action landed
        const prefixCat = result.id.includes('.') ? result.id.split('.')[0] : null;
        const targetCat = (prefixCat && ACTION_LIBRARY[prefixCat])
          ? prefixCat
          : Object.keys(ACTION_LIBRARY)[0];
        if (targetCat) this.#selectCategory(targetCat);
        this.#aiInput.value = '';
        const catLabel = ACTION_LIBRARY[targetCat]?.label ?? targetCat;
        this.emit('toast', { msg: `Action "${result.label}" added to ${catLabel}`, type: 'success' });
      } else {
        this.emit('toast', { msg: 'AI returned an unexpected response.', type: 'error' });
      }
    } catch (err) {
      this.emit('toast', { msg: `AI error: ${err.message}`, type: 'error' });
    } finally {
      this.#aiBtn.disabled = false;
      this.#aiBtn.innerHTML = `${renderAfIcon('magic')}<span>Generate Action</span>`;
    }
  }

  // ── Chat context ──────────────────────────────────────────────────────────

  #updateChatContext() {
    if (!this.#chat) return;
    if (this.#node?._isThing && this.#thingCtx) {
      const { thingDef, parentNode } = this.#thingCtx;
      this.#chat.setContext({
        projectId:   this._projectId ?? '',
        nodeId:      parentNode.id,
        nodeLabel:   parentNode.label?.value ?? '',
        thingId:     thingDef.id,
        thingLabel:  THING_LIBRARY[thingDef.type]?.label ?? thingDef.type,
        eventKey:    this.#event,
        nodePayload: thingDef.events,
      });
    } else if (this.#node) {
      this.#chat.setContext({
        projectId:   this._projectId ?? '',
        nodeId:      this.#node.id,
        nodeLabel:   this.#node.label?.value ?? '',
        thingId:     '',
        thingLabel:  '',
        eventKey:    this.#event,
        nodePayload: this.#node.payload?.peek() ?? null,
      });
    } else {
      this.#chat.setContext({});
    }
  }

  /** Called by App when a project is opened so chat keys are scoped to the project. */
  setProjectId(id) {
    this._projectId = id;
    this.#updateChatContext();
  }

  /** Wire the executor callback that runs undercity-commands from the AI chat. */
  setChatExecutor(fn) {
    if (this.#chat) this.#chat.onExecuteCommands = fn;
  }

  dispose() { this.#scope.dispose(); this.#nodeScope.dispose(); }
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
