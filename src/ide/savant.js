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

import { Signal, Emitter } from 'framework';
import { Scope } from 'scope';
import { SavantChat } from '/src/ide/savant-chat.js';
import { THING_LIBRARY, getThingEvents } from '/src/ide/thing-library.js';
import { API } from '/src/ide/project-api.js';
import { WORKFLOW_STEPS_TAG } from '/src/ide/workflow-steps.js';

function isStepDisabled(step) {
  return step?.disabled === true;
}

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

// ── Action Library (populated exclusively via registerCategory) ───────────────
// No static import from action-library.js. All categories arrive via App.use().
const ACTION_LIBRARY = {};
const STEP_UI_ID = Symbol('workflowStepUiId');

function createStepUiId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  #event      = 'Enter';
  #category   = null;
  #customActions = {};  // id → def (AI-generated or project-level)
  #chat       = null;
  _projectId  = '';
  #workflowStepsEl;
  #workflowMessageEl;
  #workflowRoutesEl;

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
    this.#workflowStepsEl = document.createElement(WORKFLOW_STEPS_TAG);
    this.#workflowStepsEl.hidden = true;
    this.#workflowStepsEl.renderBody = (item, card) => {
      return this.#createStepBody(item.stepId, item.step, item.def, card.mode);
    };
    this.#workflowMessageEl = document.createElement('div');
    this.#workflowMessageEl.className = 'wf-empty';
    this.#workflowMessageEl.hidden = true;
    this.#workflowRoutesEl = document.createElement('div');
    this.#workflowRoutesEl.hidden = true;
    this.#wfSteps.replaceChildren(
      this.#workflowMessageEl,
      this.#workflowStepsEl,
      this.#workflowRoutesEl,
    );
    this.#bindWorkflowEvents();

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

    // Wire workspace import button — imports addStep commands from a JSON file
    document.getElementById('wf-import-btn')?.addEventListener('click', () => {
      if (!this.#node) { return; }
      const input  = document.createElement('input');
      input.type   = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        let cmds;
        try {
          cmds = JSON.parse(await file.text());
        } catch {
          alert('Import failed: file is not valid JSON');
          return;
        }
        if (!Array.isArray(cmds)) {
          alert('Import failed: expected an array of MCP commands');
          return;
        }
        let count = 0;
        for (const cmd of cmds) {
          if (cmd.cmd !== 'addStep') continue;
          if (!cmd.step) continue;
          this.#node.addStep(cmd.event ?? 'Enter', cmd.step);
          count++;
        }
        const t = document.createElement('div');
        t.textContent = count
          ? `Imported ${count} step${count !== 1 ? 's' : ''} from "${file.name}"`
          : `No addStep commands found in "${file.name}"`;
        t.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--sol-cyan,#2aa198);color:#002b36;padding:6px 16px;border-radius:6px;font-size:12px;z-index:9999;pointer-events:none';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2200);
      });
      input.click();
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

  #bindWorkflowEvents() {
    this.#workflowStepsEl.addEventListener('workflow-step-toggle-disabled', (event) => {
      this.#toggleStepDisabled(event.detail.stepId);
    });

    this.#workflowStepsEl.addEventListener('workflow-step-delete', (event) => {
      const current = this.#findCurrentStep(event.detail.stepId);
      if (!current) return;
      this.#node.removeStep(this.#event, current.index);
    });

    this.#workflowStepsEl.addEventListener('workflow-step-move-up', (event) => {
      const current = this.#findCurrentStep(event.detail.stepId);
      if (!current || current.index === 0) return;
      this.#node.moveStep(this.#event, current.index, current.index - 1);
    });

    this.#workflowStepsEl.addEventListener('workflow-step-move-down', (event) => {
      const current = this.#findCurrentStep(event.detail.stepId);
      if (!current || current.index >= current.steps.length - 1) return;
      this.#node.moveStep(this.#event, current.index, current.index + 1);
    });

    this.#workflowStepsEl.addEventListener('workflow-step-reorder', (event) => {
      const { stepId, targetStepId, placement } = event.detail;
      this.#moveStepRelative(stepId, targetStepId, placement);
    });

    this.#workflowStepsEl.addEventListener('workflow-insert-step', (event) => {
      const { stepId, insertIndex } = event.detail;
      this.#moveStepToInsertIndex(stepId, insertIndex);
    });

    this.#workflowStepsEl.addEventListener('workflow-insert-action', (event) => {
      const { actionId, insertIndex } = event.detail;
      const def = this.#findActionDef(actionId);
      if (def) this.#addStepAt(actionId, def, insertIndex);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  setNode(node) {
    this.#nodeScope.dispose();
    this.#thingCtx = null;
    this.#thingNameSig = null;
    this.#node = node;
    this.#event = 'Enter';
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

    // Seed library default events only when the thing has never had events set.
    // Once any events exist (including renamed ones), leave them untouched.
    const existing = thingDef.events ?? {};
    if (Object.keys(existing).length === 0) {
      const seeded = Object.fromEntries(
        getThingEvents(thingDef.type).map(({ key }) => [key, []])
      );
      thingDef.events = seeded;
      parentNode.updateThing(thingDef.id, { events: seeded });
    }

    this.#node = this.#makeThingProxy(thingDef, parentNode);
    // Default to first event key — don't assume 'Enter' exists on every Thing.
    this.#event = Object.keys(thingDef.events)[0] ?? 'Enter';
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
    { key: 'Enter',  label: 'Enter'  },
    { key: 'Exit',   label: 'Exit'   },
    { key: 'Back',   label: 'Back'   },
    { key: 'Reset',  label: 'Reset'  },
    { key: 'Unload', label: 'Unload' },
  ];
  static #LIFECYCLE_KEYS = new Set(['Enter','Exit','Back','Reset','Unload']);

  #buildEventTabs() {
    const container = this.#eventTabs;
    container.innerHTML = '';

    if (!this.#node) { this.#updateEventTabsUI(); return; }

    if (this.#node._isThing) {
      // All thing events are regular payload keys — defaults are seeded in setThing()
      // so they behave exactly like custom events: renameable, removable, exact-case.
      const payload = this.#node.payload.peek();
      for (const key of Object.keys(payload)) {
        container.appendChild(this.#makeTab(key, key, true));
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
    btn.addEventListener('click', () => this.setEvent(key));

    if (removable) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'evt-tab-label';
      labelSpan.title = 'Double-click to rename';
      labelSpan.textContent = label;
      labelSpan.addEventListener('dblclick', e => { e.preventDefault(); this.#spawnTabRename(btn); });
      btn.appendChild(labelSpan);

      const x = document.createElement('span');
      x.className = 'evt-tab-remove';
      x.textContent = '×';
      x.title = 'Remove listener';
      x.addEventListener('click', e => {
        e.stopPropagation();
        const p = { ...this.#node.payload.peek() };
        delete p[key];
        if (this.#node._isThing && this.#thingCtx) {
          const { thingDef, parentNode } = this.#thingCtx;
          thingDef.events = p;
          parentNode.updateThing(thingDef.id, { events: p });
        }
        this.#node.payload.value = p;
        this.emit('payload:changed');
        if (this.#event === key) {
          // Fall back to first remaining key; 'Enter' only if nothing else exists.
          const fallback = Object.keys(p)[0] ?? 'Enter';
          this.setEvent(fallback);
        }
      });
      btn.appendChild(x);
    } else {
      btn.textContent = label;
    }

    return btn;
  }

  #spawnTabRename(btn) {
    // Only one inline rename at a time
    if (this.#eventTabs.querySelector('.evt-tab-rename-input')) return;
    const key       = btn.dataset.event;
    const labelSpan = btn.querySelector('.evt-tab-label');
    if (!labelSpan) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'evt-tab-rename-input';
    input.value = key;
    input.spellcheck = false;
    labelSpan.replaceWith(input);
    input.select();

    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const raw    = save ? input.value.trim().replace(/\s+/g, '_') : '';
      const newKey = (save && raw) ? raw : key;

      // Restore label span (whether renamed or cancelled)
      const newSpan = document.createElement('span');
      newSpan.className = 'evt-tab-label';
      newSpan.title = 'Double-click to rename';
      newSpan.textContent = newKey;
      newSpan.addEventListener('dblclick', e => { e.preventDefault(); this.#spawnTabRename(btn); });
      if (input.parentNode) input.replaceWith(newSpan);

      if (save && newKey !== key) {
        // Update active event BEFORE payload.value triggers #buildEventTabs(),
        // so the rebuilt tabs correctly mark the renamed tab as active.
        if (this.#event === key) this.#event = newKey;
        const p = { ...this.#node.payload.peek() };
        p[newKey] = p[key] ?? [];
        delete p[key];
        if (this.#node._isThing && this.#thingCtx) {
          const { thingDef, parentNode } = this.#thingCtx;
          thingDef.events = p;
          parentNode.updateThing(thingDef.id, { events: p });
        }
        this.#node.payload.value = p;   // fires #buildEventTabs + #renderWorkflow
        this.emit('payload:changed');
      }
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  #updateEventTabsUI() {
    const payload = this.#node?.payload?.peek() ?? {};
    this.#eventTabs.querySelectorAll('.evt-tab').forEach(btn => {
      const key = btn.dataset.event;
      btn.classList.toggle('active', key === this.#event);

      // Remove old badge
      btn.querySelector('.evt-badge')?.remove();

      // Count steps for this event (routes count for Enter on diamonds)
      let count = 0;
      if (this.#node?.type === 'diamond' && key === 'Enter') {
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
      const map = { Enter:'ENTER', Exit:'EXIT', Back:'BACK', Reset:'RESET', Unload:'UNLOAD' };
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
      <textarea class="form-control form-control-sm cat-ai-input" rows="2" placeholder="Describe a new action… e.g. 'Video upload with thumbnail frame selector'"></textarea>
      <button class="btn btn-sm btn-violet w-100 mt-1 cat-ai-btn"><i class="bi bi-magic" aria-hidden="true"></i> Generate Action</button>
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
    item.innerHTML = `<i class="bi bi-${icon} cat-icon" aria-hidden="true"></i><span>${label}</span>`;
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
    const steps = p[this.#event] ?? [];
    steps.forEach(step => this.#ensureStepUiId(step));
    return steps;
  }

  #ensureStepUiId(step) {
    if (!step || typeof step !== 'object') return '';
    if (!step[STEP_UI_ID]) step[STEP_UI_ID] = createStepUiId();
    return step[STEP_UI_ID];
  }

  #findCurrentStep(stepId) {
    const steps = this.#getSteps();
    const index = steps.findIndex(step => this.#ensureStepUiId(step) === stepId);
    if (index < 0) return null;
    return { index, step: steps[index], steps };
  }

  #moveStepToInsertIndex(stepId, insertIndex) {
    if (!this.#node) return;

    const current = this.#findCurrentStep(stepId);
    if (!current) return;

    const boundedInsertIndex = Math.max(0, Math.min(insertIndex, current.steps.length));
    let targetIndex = boundedInsertIndex;
    if (targetIndex > current.index) targetIndex -= 1;
    targetIndex = Math.max(0, Math.min(targetIndex, current.steps.length - 1));

    if (targetIndex === current.index) return;
    this.#node.moveStep(this.#event, current.index, targetIndex);
  }

  #moveStepRelative(stepId, targetStepId, placement) {
    if (stepId === targetStepId) return;
    const target = this.#findCurrentStep(targetStepId);
    if (!target) return;
    const insertIndex = placement === 'after' ? target.index + 1 : target.index;
    this.#moveStepToInsertIndex(stepId, insertIndex);
  }

  #createStepBody(stepId, step, def, mode) {
    const body = document.createElement('div');
    body.className = 'step-params open';
    this.#renderStepParamsInMode(body, stepId, step, def, mode);
    return body;
  }

  #describeWorkflowSteps(steps) {
    const totalSteps = steps.length;
    return steps.map((step, index) => {
      const stepId = this.#ensureStepUiId(step);
      const def = findAction(step.action) ?? this.#customActions[step.action] ?? null;
      return {
        stepId,
        step,
        def,
        index,
        totalSteps,
        disabled: isStepDisabled(step),
        unloaded: !def,
      };
    });
  }

  #collectLiveStepIds() {
    if (!this.#node) return [];
    const payload = this.#node.payload?.peek() ?? {};
    const liveIds = [];
    for (const value of Object.values(payload)) {
      if (!Array.isArray(value)) continue;
      for (const step of value) liveIds.push(this.#ensureStepUiId(step));
    }
    return liveIds;
  }

  #showWorkflowMessage(html) {
    this.#workflowRoutesEl.hidden = true;
    this.#workflowStepsEl.hidden = true;
    this.#workflowMessageEl.hidden = false;
    this.#workflowMessageEl.innerHTML = html;
  }

  #showWorkflowSteps(steps) {
    this.#workflowMessageEl.hidden = true;
    this.#workflowRoutesEl.hidden = true;
    this.#workflowStepsEl.hidden = false;
    this.#workflowStepsEl.liveStepIds = this.#collectLiveStepIds();
    this.#workflowStepsEl.items = this.#describeWorkflowSteps(steps);
  }

  #renderWorkflow() {
    this.#updateEventTabsUI();

    if (!this.#node) {
      this.#workflowStepsEl.liveStepIds = [];
      this.#workflowStepsEl.items = [];
      this.#showWorkflowMessage('Select a room or diamond<br>on the map to edit its flow.');
      return;
    }

    if (this.#node.type === 'diamond' && this.#event === 'Enter') {
      // Show routes editor for diamonds
      this.#renderRoutesEditor();
      return;
    }

    this.#showWorkflowSteps(this.#getSteps());
  }

  #findActionDef(actionId) {
    for (const cat of Object.values(ACTION_LIBRARY)) {
      if (cat.actions?.[actionId]) return cat.actions[actionId];
    }
    return this.#customActions[actionId] ?? null;
  }

  #toggleStepDisabled(stepId) {
    if (!this.#node) return;
    const current = this.#findCurrentStep(stepId);
    if (!current) return;
    this.#node.updateStep(this.#event, current.index, {
      ...current.step,
      disabled: isStepDisabled(current.step) ? undefined : true,
    });
  }

  #renderStepParamsInMode(container, stepId, step, def, mode) {
    container.innerHTML = '';
    if (mode === 'json') {
      this.#renderJsonMode(container, stepId, step);
    } else if (mode === 'basic') {
      this.#renderBasicMode(container, stepId, step, def);
    } else {
      this.#renderConfigureMode(container, stepId, step, def);
    }
  }

  // ── Basic mode — friendly, no code fields ──────────────────────────────────
  #renderBasicMode(container, stepId, step, def) {
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
      const uid   = `p-${stepId}-${p.name}`;
      const row   = document.createElement('div');
      const lbl   = document.createElement('label');
      const input = this.#makeParamInput(p, step.params?.[p.name] ?? p.default ?? '');
      input.id = uid;
      input.addEventListener('change', () => {
        const storedVal = input.type === 'checkbox' ? input.checked : input.value;
        const current = this.#findCurrentStep(stepId);
        if (!current) return;
        this.#node.updateStep(this.#event, current.index, {
          params: { ...(current.step.params ?? {}), [p.name]: storedVal },
        });
      });
      if (p.type === 'boolean') {
        row.className = 'mb-2 form-check form-switch';
        lbl.className = 'form-check-label';
        lbl.textContent = p.label;
        lbl.htmlFor = uid;
        row.appendChild(input);
        row.appendChild(lbl);
      } else {
        row.className = 'mb-2';
        lbl.className = 'form-label mb-1';
        lbl.textContent = p.label;
        lbl.htmlFor = uid;
        row.appendChild(lbl);
        row.appendChild(input);
      }
      if (p.helpText) {
        const help = document.createElement('div');
        help.className = 'form-text';
        help.textContent = p.helpText;
        row.appendChild(help);
      }
      container.appendChild(row);
    }

    // Show any code params as a note prompting Configure
    const codeParams = (def.params ?? []).filter(p => p.type === 'code' || p.type === 'textarea');
    if (codeParams.length > 0) {
      const note = document.createElement('div');
      note.className = 'step-basic-code-note';
      note.innerHTML = `<i class="bi bi-gear" aria-hidden="true"></i> <span>${codeParams.map(p => p.label).join(', ')} — switch to <strong>Configure</strong> to edit</span>`;
      container.appendChild(note);
    }
  }

  // ── Configure mode — all params ────────────────────────────────────────────
  #renderConfigureMode(container, stepId, step, def) {
    const params = def.params ?? [];
    if (params.length === 0) {
      const note = document.createElement('div');
      note.className = 'step-basic-desc';
      note.textContent = def.desc ?? 'No parameters.';
      container.appendChild(note);
      return;
    }

    for (const p of params) {
      const uid   = `p-${stepId}-${p.name}`;
      const row   = document.createElement('div');
      const lbl   = document.createElement('label');
      const input = this.#makeParamInput(p, step.params?.[p.name] ?? p.default ?? '');
      input.id = uid;
      input.addEventListener('change', () => {
        const storedVal = input.type === 'checkbox' ? input.checked : input.value;
        const current = this.#findCurrentStep(stepId);
        if (!current) return;
        this.#node.updateStep(this.#event, current.index, {
          params: { ...(current.step.params ?? {}), [p.name]: storedVal },
        });
      });
      if (p.type === 'boolean') {
        row.className = 'mb-2 form-check form-switch';
        lbl.className = 'form-check-label';
        lbl.innerHTML = `${p.label}${p.type === 'code' ? ' <span class="param-code-badge">JS</span>' : ''}`;
        lbl.htmlFor = uid;
        row.appendChild(input);
        row.appendChild(lbl);
      } else {
        row.className = 'mb-2';
        lbl.className = 'form-label mb-1';
        lbl.innerHTML = `${p.label}${p.type === 'code' ? ' <span class="param-code-badge">JS</span>' : ''}`;
        lbl.htmlFor = uid;
        row.appendChild(lbl);
        row.appendChild(input);
      }
      if (p.helpText) {
        const help = document.createElement('div');
        help.className = 'form-text';
        help.textContent = p.helpText;
        row.appendChild(help);
      }
      container.appendChild(row);
    }
  }

  // ── JSON mode — raw step object editor ─────────────────────────────────────
  #renderJsonMode(container, stepId, step) {
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
        const current = this.#findCurrentStep(stepId);
        if (!current) return;
        this.#node.updateStep(this.#event, current.index, parsed);
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
      sel.className = 'form-select form-select-sm';
      for (const opt of (paramDef.options ?? [])) {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === value) o.selected = true;
        sel.appendChild(o);
      }
      return sel;
    }

    if (paramDef.type === 'boolean') {
      const cb = document.createElement('input');
      cb.type      = 'checkbox';
      cb.className = 'form-check-input';
      cb.setAttribute('role', 'switch');
      cb.checked   = value === true || value === 'true';
      return cb;
    }

    if (paramDef.type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.className = 'form-control form-control-sm';
      ta.rows = 2;
      ta.value = value ?? '';
      ta.placeholder = paramDef.placeholder ?? '';
      return ta;
    }

    if (paramDef.type === 'room') {
      // Dropdown populated by app via needNodeOptions event
      const sel = document.createElement('select');
      sel.className = 'form-select form-select-sm';
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
      inp.className = 'form-control form-control-sm param-input-inv-key';
      inp.value = keyName;
      inp.placeholder = paramDef.placeholder ?? 'inventoryKey';
      return inp;
    }

    const inp = document.createElement('input');
    inp.className = 'form-control form-control-sm';
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
    const step = { action: actionId, params };
    const stepId = this.#ensureStepUiId(step);
    this.#node.addStep(this.#event, step);
    requestAnimationFrame(() => {
      this.#workflowStepsEl.expandStep(stepId);
    });
  }

  #addStepAt(actionId, def, insertIndex) {
    if (!this.#node) return;
    const params = {};
    for (const p of (def.params ?? [])) {
      params[p.name] = p.default ?? '';
    }
    const step = { action: actionId, params };
    this.#ensureStepUiId(step);
    this.#node.insertStep(this.#event, insertIndex, step);
  }

  // ── Diamond routes editor ─────────────────────────────────────────────────
  #renderRoutesEditor() {
    this.#workflowMessageEl.hidden = true;
    this.#workflowStepsEl.hidden = true;
    this.#workflowRoutesEl.hidden = false;
    this.#workflowRoutesEl.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;color:var(--text-muted);margin-bottom:8px';
    header.textContent = 'Routes are evaluated top-to-bottom. First match wins. Use inventory.key syntax.';
    this.#workflowRoutesEl.appendChild(header);

    const routes = this.#node.routes.peek() ?? [];
    routes.forEach((route, i) => {
      this.#workflowRoutesEl.appendChild(this.#makeRouteRow(route, i));
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-sm btn-outline-secondary w-100 add-route-btn';
    addBtn.textContent = '+ Add Route';
    addBtn.addEventListener('click', () => {
      const rs = [...(this.#node.routes.peek() ?? [])];
      rs.push({ condition: 'true', target: '', label: 'Default' });
      this.#node.routes.value = rs;
      this.#renderWorkflow();
    });
    this.#workflowRoutesEl.appendChild(addBtn);
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
        <button class="btn btn-sm btn-outline-secondary route-toggle-mode" title="${parsed ? 'Switch to expression mode' : 'Switch to visual mode'}">${parsed ? '{ }' : '◈'}</button>
      </div>
      <div class="route-footer">
        <select class="route-target">
          <option value="">— target room —</option>
        </select>
        <button class="btn btn-sm btn-link p-0 text-danger route-del" title="Delete route"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
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
    this.#aiBtn.innerHTML = `<i class="bi bi-arrow-repeat" aria-hidden="true"></i> Generating…`;

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
      this.#aiBtn.innerHTML = `<i class="bi bi-magic" aria-hidden="true"></i> Generate Action`;
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
