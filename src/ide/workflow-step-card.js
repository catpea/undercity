import { Signal, on } from 'framework';
import { Scope } from 'scope';

export const WORKFLOW_STEP_CARD_TAG = 'uc-workflow-step-card';
export const WORKFLOW_STEP_DRAG_MIME = 'application/x-undercity-step-id';

const STEP_MODES = new Set(['basic', 'configure', 'json']);

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .card {
      background: var(--bg-raised);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      transition: opacity var(--transition), border-color var(--transition), box-shadow var(--transition);
    }

    .card[data-disabled="true"] {
      background: linear-gradient(180deg, rgba(181, 137, 0, .09), rgba(181, 137, 0, .03)), var(--bg-raised);
      border-color: rgba(181, 137, 0, .38);
    }

    .card[data-collapsed="true"] {
      opacity: 0.85;
    }

    .card[data-unloaded="true"] {
      border-color: var(--danger, #dc3545);
      opacity: 0.75;
    }

    .card[data-unloaded="true"][data-disabled="true"] {
      border-color: rgba(181, 137, 0, .45);
    }

    .card[data-drop-position="before"] {
      box-shadow: inset 0 3px 0 0 var(--accent);
    }

    .card[data-drop-position="after"] {
      box-shadow: inset 0 -3px 0 0 var(--accent);
    }

    .card[data-dragging="true"] {
      opacity: 0.4;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 7px 10px;
    }

    .drag-handle {
      cursor: grab;
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1;
      padding: 0 2px;
      flex-shrink: 0;
      user-select: none;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .number {
      font-size: 9px;
      font-weight: 800;
      color: var(--text-muted);
      background: var(--bg);
      border-radius: 3px;
      padding: 1px 4px;
      min-width: 20px;
      text-align: center;
      flex-shrink: 0;
    }

    .action-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-em);
    }

    .card[data-disabled="true"] .action-name {
      color: var(--text-muted);
      text-decoration: line-through;
    }

    .card[data-unloaded="true"] .action-name {
      color: var(--danger, #dc3545);
      font-style: italic;
    }

    .card[data-unloaded="true"][data-disabled="true"] .action-name {
      color: var(--sol-yellow);
    }

    .disabled-badge {
      flex-shrink: 0;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .05em;
      text-transform: uppercase;
      color: var(--sol-yellow);
      background: rgba(181, 137, 0, .14);
      border: 1px solid rgba(181, 137, 0, .28);
      border-radius: 999px;
      padding: 1px 6px;
    }

    .collapse-button {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      padding: 0 4px;
      flex-shrink: 0;
    }

    .collapse-button:hover {
      color: var(--text);
    }

    .mode-pills {
      display: flex;
      flex-shrink: 0;
      overflow: hidden;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 20px;
    }

    .mode-pill {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .04em;
      padding: 2px 8px;
      transition: background var(--transition), color var(--transition);
    }

    .mode-pill:hover:not([data-active="true"]) {
      color: var(--text-em);
    }

    .mode-pill[data-active="true"] {
      background: var(--accent);
      color: #fff;
    }

    .action-id {
      flex-shrink: 0;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--bg);
      color: var(--text-muted);
      font-size: 10px;
    }

    .controls {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .step-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 13px;
      line-height: 1;
      padding: 0 2px;
      transition: color var(--transition), opacity var(--transition);
    }

    .step-button:hover:not(:disabled) {
      color: var(--text-em);
    }

    .step-button:disabled {
      opacity: 0.35;
      cursor: default;
    }

    .step-button[data-role="delete"]:hover {
      color: var(--danger);
    }

    .toggle-button af-icon {
      font-size: 13px;
    }

    .toggle-button[data-disabled="true"] {
      color: var(--sol-yellow);
    }

    .toggle-button[data-disabled="true"]:hover {
      color: var(--sol-yellow);
    }

    .params {
      display: block;
    }

    .params[hidden] {
      display: none;
    }

    ::slotted(.step-params) {
      display: flex;
      flex-direction: column;
    }
  </style>

  <article part="card" class="card">
    <div part="header" class="header">
      <span part="drag-handle" class="drag-handle" draggable="true" title="Drag to reorder">⠿</span>
      <span part="number" class="number"></span>
      <span part="action-name" class="action-name"></span>
      <span part="disabled-badge" class="disabled-badge" hidden>Disabled</span>
      <button part="collapse-button" class="collapse-button" type="button" title="Collapse"></button>
      <div part="mode-pills" class="mode-pills" role="group" aria-label="Step display mode">
        <button part="mode-pill" class="mode-pill" data-mode="basic" type="button" title="Simple view">Basic</button>
        <button part="mode-pill" class="mode-pill" data-mode="configure" type="button" title="All parameters">Configure</button>
        <button part="mode-pill" class="mode-pill" data-mode="json" type="button" title="Raw JSON">JSON</button>
      </div>
      <code part="action-id" class="action-id" hidden></code>
      <div part="controls" class="controls">
        <button part="toggle-button" class="step-button toggle-button" type="button" title="Disable in generated code">
          <af-icon name="eye"></af-icon>
        </button>
        <button part="move-up-button" class="step-button" data-role="move-up" type="button" title="Move up">↑</button>
        <button part="move-down-button" class="step-button" data-role="move-down" type="button" title="Move down">↓</button>
        <button part="delete-button" class="step-button" data-role="delete" type="button" title="Delete">
          <af-icon name="x-lg"></af-icon>
        </button>
      </div>
    </div>
    <section part="params" class="params">
      <slot name="body"></slot>
    </section>
  </article>
`;

function boolAttr(value) {
  return value !== null;
}

function normalizeMode(value) {
  return STEP_MODES.has(value) ? value : 'basic';
}

function createEvent(name, detail) {
  return new CustomEvent(name, {
    bubbles: true,
    composed: true,
    detail,
  });
}

function stepIdFromTransfer(dataTransfer) {
  const explicit = dataTransfer?.getData(WORKFLOW_STEP_DRAG_MIME) ?? '';
  if (explicit) return explicit;
  const raw = dataTransfer?.getData('text/plain') ?? '';
  return raw.startsWith('step:') ? raw.slice(5) : '';
}

class WorkflowStepCard extends HTMLElement {
  static observedAttributes = [
    'step-id',
    'step-number',
    'action-label',
    'action-id',
    'disabled',
    'unloaded',
    'can-move-up',
    'can-move-down',
  ];

  #stepId = new Signal('');
  #stepNumber = new Signal('1');
  #actionLabel = new Signal('');
  #actionId = new Signal('');
  #disabled = new Signal(false);
  #unloaded = new Signal(false);
  #canMoveUp = new Signal(false);
  #canMoveDown = new Signal(false);
  #collapsed = new Signal(false);
  #mode = new Signal('basic');
  #dropPosition = new Signal('');
  #dragging = new Signal(false);
  #scope = new Scope();

  #cardEl;
  #actionNameEl;
  #actionIdEl;
  #numberEl;
  #disabledBadgeEl;
  #collapseBtn;
  #modePillsEl;
  #modeButtons;
  #toggleBtn;
  #toggleIconEl;
  #upBtn;
  #downBtn;
  #deleteBtn;
  #paramsEl;
  #dragHandleEl;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));

    this.#cardEl = root.querySelector('.card');
    this.#actionNameEl = root.querySelector('.action-name');
    this.#actionIdEl = root.querySelector('.action-id');
    this.#numberEl = root.querySelector('.number');
    this.#disabledBadgeEl = root.querySelector('.disabled-badge');
    this.#collapseBtn = root.querySelector('.collapse-button');
    this.#modePillsEl = root.querySelector('.mode-pills');
    this.#modeButtons = [...root.querySelectorAll('.mode-pill')];
    this.#toggleBtn = root.querySelector('.toggle-button');
    this.#toggleIconEl = this.#toggleBtn.querySelector('af-icon');
    this.#upBtn = root.querySelector('[data-role="move-up"]');
    this.#downBtn = root.querySelector('[data-role="move-down"]');
    this.#deleteBtn = root.querySelector('[data-role="delete"]');
    this.#paramsEl = root.querySelector('.params');
    this.#dragHandleEl = root.querySelector('.drag-handle');
  }

  get stepId() {
    return this.#stepId.peek();
  }

  get mode() {
    return this.#mode.peek();
  }

  set mode(value) {
    this.#mode.value = normalizeMode(value);
  }

  get collapsed() {
    return this.#collapsed.peek();
  }

  seedUiState({ mode = 'basic', collapsed = false } = {}) {
    this.#mode.value = normalizeMode(mode);
    this.#collapsed.value = collapsed === true;
  }

  setBody(node) {
    if (!node) {
      this.replaceChildren();
      return;
    }
    node.slot = 'body';
    this.replaceChildren(node);
  }

  expand() {
    this.#collapsed.value = false;
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'step-id') this.#stepId.value = next ?? '';
    if (attr === 'step-number') this.#stepNumber.value = next ?? '1';
    if (attr === 'action-label') this.#actionLabel.value = next ?? '';
    if (attr === 'action-id') this.#actionId.value = next ?? '';
    if (attr === 'disabled') this.#disabled.value = boolAttr(next);
    if (attr === 'unloaded') this.#unloaded.value = boolAttr(next);
    if (attr === 'can-move-up') this.#canMoveUp.value = boolAttr(next);
    if (attr === 'can-move-down') this.#canMoveDown.value = boolAttr(next);
  }

  connectedCallback() {
    const combined = Signal.combineLatest([
      this.#stepId,
      this.#stepNumber,
      this.#actionLabel,
      this.#actionId,
      this.#disabled,
      this.#unloaded,
      this.#canMoveUp,
      this.#canMoveDown,
      this.#collapsed,
      this.#mode,
      this.#dropPosition,
      this.#dragging,
    ]);

    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([
      stepId,
      stepNumber,
      actionLabel,
      actionId,
      disabled,
      unloaded,
      canMoveUp,
      canMoveDown,
      collapsed,
      mode,
      dropPosition,
      dragging,
    ]) => {
      this.dataset.stepId = stepId;

      this.#numberEl.textContent = stepNumber;
      this.#actionNameEl.textContent = actionLabel || 'Untitled action';
      this.#actionIdEl.textContent = actionId;
      this.#actionIdEl.hidden = !unloaded;

      this.#disabledBadgeEl.hidden = !disabled;
      this.#collapseBtn.hidden = unloaded;
      this.#modePillsEl.hidden = unloaded;
      this.#paramsEl.hidden = unloaded || collapsed;

      this.#collapseBtn.textContent = collapsed ? '▸' : '▾';
      this.#collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
      this.#collapseBtn.setAttribute('aria-expanded', String(!collapsed));

      this.#toggleBtn.title = disabled ? 'Enable in generated code' : 'Disable in generated code';
      this.#toggleBtn.setAttribute('aria-pressed', String(disabled));
      this.#toggleBtn.dataset.disabled = String(disabled);
      this.#toggleIconEl.setAttribute('name', disabled ? 'eye-slash' : 'eye');

      this.#upBtn.disabled = !canMoveUp;
      this.#downBtn.disabled = !canMoveDown;

      this.#cardEl.dataset.disabled = String(disabled);
      this.#cardEl.dataset.unloaded = String(unloaded);
      this.#cardEl.dataset.collapsed = String(collapsed);
      this.#cardEl.dataset.dropPosition = dropPosition;
      this.#cardEl.dataset.dragging = String(dragging);

      this.#modeButtons.forEach((button) => {
        const active = button.dataset.mode === mode;
        button.dataset.active = String(active);
        button.setAttribute('aria-pressed', String(active));
      });
    }));

    this.#scope.add(on(this.#collapseBtn, 'click', (event) => {
      event.stopPropagation();
      this.#collapsed.value = !this.#collapsed.peek();
    }));

    this.#modeButtons.forEach((button) => {
      this.#scope.add(on(button, 'click', (event) => {
        event.stopPropagation();
        const nextMode = normalizeMode(button.dataset.mode);
        if (nextMode === this.#mode.peek()) return;
        this.#mode.value = nextMode;
        this.dispatchEvent(createEvent('workflow-step-modechange', {
          stepId: this.#stepId.peek(),
          mode: nextMode,
        }));
      }));
    });

    this.#scope.add(on(this.#toggleBtn, 'click', () => {
      this.dispatchEvent(createEvent('workflow-step-toggle-disabled', {
        stepId: this.#stepId.peek(),
      }));
    }));

    this.#scope.add(on(this.#deleteBtn, 'click', () => {
      this.dispatchEvent(createEvent('workflow-step-delete', {
        stepId: this.#stepId.peek(),
      }));
    }));

    this.#scope.add(on(this.#upBtn, 'click', () => {
      this.dispatchEvent(createEvent('workflow-step-move-up', {
        stepId: this.#stepId.peek(),
      }));
    }));

    this.#scope.add(on(this.#downBtn, 'click', () => {
      this.dispatchEvent(createEvent('workflow-step-move-down', {
        stepId: this.#stepId.peek(),
      }));
    }));

    this.#scope.add(on(this.#dragHandleEl, 'dragstart', (event) => {
      const stepId = this.#stepId.peek();
      if (!stepId) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(WORKFLOW_STEP_DRAG_MIME, stepId);
      event.dataTransfer.setData('text/plain', `step:${stepId}`);
      this.#dragging.value = true;
    }));

    this.#scope.add(on(this.#dragHandleEl, 'dragend', () => {
      this.#dragging.value = false;
      this.#dropPosition.value = '';
    }));

    this.#scope.add(on(this, 'dragover', (event) => {
      const hasStepDrag = event.dataTransfer?.types.includes(WORKFLOW_STEP_DRAG_MIME);
      const hasTextDrag = event.dataTransfer?.types.includes('text/plain');
      if (!hasStepDrag && !hasTextDrag) return;
      event.preventDefault();
      this.#dropPosition.value = this.#dropPositionForPointer(event.clientY);
    }));

    this.#scope.add(on(this, 'dragleave', () => {
      this.#dropPosition.value = '';
    }));

    this.#scope.add(on(this, 'drop', (event) => {
      event.preventDefault();
      const stepId = stepIdFromTransfer(event.dataTransfer);
      if (!stepId || stepId === this.#stepId.peek()) {
        this.#dropPosition.value = '';
        return;
      }

      const placement = this.#dropPositionForPointer(event.clientY);
      this.#dropPosition.value = '';
      this.dispatchEvent(createEvent('workflow-step-reorder', {
        stepId,
        targetStepId: this.#stepId.peek(),
        placement,
      }));
    }));
  }

  disconnectedCallback() {
    this.#dragging.value = false;
    this.#dropPosition.value = '';
    this.#scope.dispose();
  }

  #dropPositionForPointer(clientY) {
    const { top, height } = this.getBoundingClientRect();
    return clientY < top + (height / 2) ? 'before' : 'after';
  }
}

if (!customElements.get(WORKFLOW_STEP_CARD_TAG)) {
  customElements.define(WORKFLOW_STEP_CARD_TAG, WorkflowStepCard);
}

export { WorkflowStepCard };
