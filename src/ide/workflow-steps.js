import { Signal, on } from 'framework';
import { Scope } from 'scope';
import '/src/ide/wf-repeater.js';
import {
  WORKFLOW_STEP_CARD_TAG,
  WORKFLOW_STEP_DRAG_MIME,
} from '/src/ide/workflow-step-card.js';

export const WORKFLOW_STEPS_TAG = 'uc-workflow-steps';

const template = document.createElement('template');
template.innerHTML = `
  <div part="empty" class="wf-empty wf-drop-target" hidden>No steps yet. Drag an action here or click to add.</div>
  <div part="leading-drop-zone" class="wf-drop-zone" hidden></div>
  <wf-repeater part="list"></wf-repeater>
`;

function textDragData(dataTransfer) {
  return dataTransfer?.getData('text/plain') ?? '';
}

function actionIdFromTransfer(dataTransfer) {
  const raw = textDragData(dataTransfer);
  return raw.startsWith('action:') ? raw.slice(7) : '';
}

function stepIdFromTransfer(dataTransfer) {
  const explicit = dataTransfer?.getData(WORKFLOW_STEP_DRAG_MIME) ?? '';
  if (explicit) return explicit;
  const raw = textDragData(dataTransfer);
  return raw.startsWith('step:') ? raw.slice(5) : '';
}

function createEvent(name, detail) {
  return new CustomEvent(name, {
    bubbles: true,
    composed: true,
    detail,
  });
}

class WorkflowSteps extends HTMLElement {
  #scope = new Scope();
  #items = new Signal([]);
  #liveStepIds = new Signal([]);
  #renderBody = null;
  #rowCache = new Map();
  #itemById = new Map();
  #domReady = false;

  #emptyEl;
  #leadingDropZoneEl;
  #repeaterEl;

  constructor() { super(); }

  set items(value) {
    this.#items.value = Array.isArray(value) ? value : [];
  }

  get items() {
    return this.#items.peek();
  }

  set liveStepIds(value) {
    this.#liveStepIds.value = Array.isArray(value) ? value : [];
  }

  set renderBody(value) {
    this.#renderBody = typeof value === 'function' ? value : null;
    this.#refreshVisibleBodies();
  }

  connectedCallback() {
    this.#ensureDom();
    this.#repeaterEl.key = item => item.stepId;
    this.#repeaterEl.signal = this.#items;
    this.#repeaterEl.renderItem = item => this.#getOrCreateRow(item);
    this.#repeaterEl.updateItem = (row, item, prevItem) => this.#updateRow(row, item, prevItem);
    this.#repeaterEl.removeItem = (row, item) => this.#cacheRow(row, item.stepId);

    this.#setupDropZone(this.#emptyEl, () => 0);
    this.#setupDropZone(this.#leadingDropZoneEl, () => 0);

    this.#scope.add(this.#items);
    this.#scope.add(this.#liveStepIds);
    this.#scope.add(this.#items.subscribe(items => {
      this.#itemById = new Map(items.map(item => [item.stepId, item]));
      const hasItems = items.length > 0;
      this.#emptyEl.hidden = hasItems;
      this.#leadingDropZoneEl.hidden = !hasItems;
    }));

    this.#scope.add(this.#liveStepIds.subscribe(liveIds => {
      const live = new Set(liveIds);
      for (const [stepId, row] of this.#rowCache) {
        if (live.has(stepId)) continue;
        row._rowScope?.dispose();
        this.#rowCache.delete(stepId);
      }
    }));

    this.#scope.add(on(this, 'workflow-step-modechange', (event) => {
      this.#refreshBody(event.detail.stepId);
    }));
  }

  disconnectedCallback() {
    this.#scope.dispose();
  }

  expandStep(stepId) {
    const row = this.#rowCache.get(stepId) ?? this.querySelector(`[data-step-id="${stepId}"]`);
    const card = row?._card ?? null;
    card?.expand?.();
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  #ensureDom() {
    if (this.#domReady) return;
    this.appendChild(template.content.cloneNode(true));
    this.#emptyEl = this.querySelector('[part="empty"]');
    this.#leadingDropZoneEl = this.querySelector('[part="leading-drop-zone"]');
    this.#repeaterEl = this.querySelector('[part="list"]');
    this.#domReady = true;
  }

  #refreshVisibleBodies() {
    for (const [stepId] of this.#itemById) this.#refreshBody(stepId);
  }

  #refreshBody(stepId) {
    const item = this.#itemById.get(stepId);
    const row = this.#rowCache.get(stepId) ?? this.querySelector(`[data-step-id="${stepId}"]`);
    if (!item || !row) return;
    this.#renderRowBody(row, item);
  }

  #getOrCreateRow(item) {
    const cached = this.#rowCache.get(item.stepId);
    if (cached) {
      this.#rowCache.delete(item.stepId);
      return cached;
    }

    const row = document.createElement('div');
    row.className = 'workflow-step-row';
    row.dataset.stepId = item.stepId;
    row._rowScope = new Scope();

    const card = document.createElement(WORKFLOW_STEP_CARD_TAG);
    card.setAttribute('step-id', item.stepId);
    card.seedUiState({ mode: item.step._uiMode ?? 'basic', collapsed: false });

    const dropZone = document.createElement('div');
    dropZone.className = 'wf-drop-zone';
    this.#setupDropZone(dropZone, () => Number.parseInt(dropZone.dataset.insertIndex ?? '0', 10), row._rowScope);

    row._card = card;
    row._dropZone = dropZone;
    row.append(card, dropZone);
    return row;
  }

  #cacheRow(row, stepId) {
    row._dropZone?.classList.remove('drag-over');
    this.#rowCache.set(stepId, row);
  }

  #updateRow(row, item, prevItem) {
    row.dataset.stepId = item.stepId;
    row._dropZone.dataset.insertIndex = String(item.index + 1);

    const card = row._card;
    card.setAttribute('step-id', item.stepId);
    card.setAttribute('step-number', String(item.index + 1));
    card.setAttribute('action-label', item.def?.label ?? 'Action not loaded');
    card.setAttribute('action-id', item.step.action ?? '');
    card.toggleAttribute('disabled', item.disabled);
    card.toggleAttribute('unloaded', item.unloaded);
    card.toggleAttribute('can-move-up', item.index > 0);
    card.toggleAttribute('can-move-down', item.index < item.totalSteps - 1);

    const bodyDirty = !prevItem
      || prevItem.step !== item.step
      || prevItem.def !== item.def
      || row._renderedMode !== card.mode;

    if (bodyDirty) this.#renderRowBody(row, item);
  }

  #renderRowBody(row, item) {
    if (!this.#renderBody) return;
    const body = this.#renderBody(item, row._card);
    row._card.setBody(body);
    row._renderedStep = item.step;
    row._renderedDef = item.def;
    row._renderedMode = row._card.mode;
  }

  #setupDropZone(el, getInsertIndex, scope = this.#scope) {
    scope.add(on(el, 'dragover', event => {
      const hasPlainText = event.dataTransfer?.types.includes('text/plain');
      const hasStepDrag = event.dataTransfer?.types.includes(WORKFLOW_STEP_DRAG_MIME);
      if (!hasPlainText && !hasStepDrag) return;
      event.preventDefault();
      el.classList.add('drag-over');
    }));

    scope.add(on(el, 'dragleave', () => {
      el.classList.remove('drag-over');
    }));

    scope.add(on(el, 'drop', event => {
      event.preventDefault();
      el.classList.remove('drag-over');

      const insertIndex = getInsertIndex();
      const stepId = stepIdFromTransfer(event.dataTransfer);
      if (stepId) {
        this.dispatchEvent(createEvent('workflow-insert-step', { stepId, insertIndex }));
        return;
      }

      const actionId = actionIdFromTransfer(event.dataTransfer);
      if (actionId) {
        this.dispatchEvent(createEvent('workflow-insert-action', { actionId, insertIndex }));
      }
    }));
  }
}

if (!customElements.get(WORKFLOW_STEPS_TAG)) {
  customElements.define(WORKFLOW_STEPS_TAG, WorkflowSteps);
}

export { WorkflowSteps };
