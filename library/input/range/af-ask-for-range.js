// library/input/range/af-ask-for-range.js
//
// <af-ask-for-range key="volume" label="Volume" min="0" max="100" show-value>
//
// Observed attributes:
//   key        — Inventory key (required)
//   label      — human-readable label (defaults to key value)
//   min        — minimum value (default: 0)
//   max        — maximum value (default: 100)
//   step       — step increment (default: 1)
//   show-value — presence shows a badge with the current value in the label row
//
// Input type: range. Inventory stores Number.
// Two-way binding via globalThis.Inventory. Shadow DOM with Bootstrap-compatible styles.

import { Signal, on } from 'framework';
import { Scope }      from 'scope';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }
    .label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: .25rem; }
    label { font-size: .875rem; font-weight: 500; color: var(--bs-body-color, #dee2e6); }
    .badge {
      font-size: .75rem; padding: .2em .5em; border-radius: .25rem;
      background-color: var(--bs-secondary-bg, #495057);
      color: var(--bs-body-color, #dee2e6);
    }
    input[type="range"] {
      display: block; width: 100%; cursor: pointer;
      accent-color: #0d6efd;
    }
    .hint  { margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .d-none { display: none !important; }
  </style>
  <div class="label-row">
    <label part="label"></label>
    <span part="badge" class="badge d-none"></span>
  </div>
  <input part="input" type="range">
`;

class AfAskForRange extends HTMLElement {
  static observedAttributes = ['key', 'label', 'min', 'max', 'step', 'show-value'];

  #key       = new Signal('');
  #label     = new Signal('');
  #min       = new Signal('0');
  #max       = new Signal('100');
  #step      = new Signal('1');
  #showValue = new Signal(false);
  #scope     = new Scope();

  #labelEl;
  #inputEl;
  #badgeEl;

  constructor() {
    super();
    const root    = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl = root.querySelector('[part="label"]');
    this.#inputEl = root.querySelector('[part="input"]');
    this.#badgeEl = root.querySelector('[part="badge"]');
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')        this.#key.value       = next ?? '';
    if (attr === 'label')      this.#label.value     = next ?? '';
    if (attr === 'min')        this.#min.value       = next ?? '0';
    if (attr === 'max')        this.#max.value       = next ?? '100';
    if (attr === 'step')       this.#step.value      = next ?? '1';
    if (attr === 'show-value') this.#showValue.value = next !== null;
  }

  connectedCallback() {
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#min, this.#max, this.#step, this.#showValue,
    ]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, min, max, step, showValue]) => {
      const id = `af-range-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id   = id;
      this.#inputEl.name = key;
      this.#inputEl.setAttribute('min',  min  || '0');
      this.#inputEl.setAttribute('max',  max  || '100');
      this.#inputEl.setAttribute('step', step || '1');
      if (showValue) this.#badgeEl.classList.remove('d-none');
      else           this.#badgeEl.classList.add('d-none');
      if (this.isConnected) this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }

  #bindInventory() {
    const key       = this.#key.peek();
    const showValue = this.#showValue.peek();
    const inv       = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;
    inv.add(globalThis.Inventory.subscribe(key, v => {
      const nv = String(v ?? this.#min.peek());
      if (this.#inputEl.value !== nv) {
        this.#inputEl.value = nv;
        if (showValue) this.#badgeEl.textContent = nv;
      }
    }));
    inv.add(on(this.#inputEl, 'input', () => {
      const val = Number(this.#inputEl.value);
      globalThis.Inventory.set(key, val);
      if (showValue) this.#badgeEl.textContent = this.#inputEl.value;
    }));
  }
}

customElements.define('af-ask-for-range', AfAskForRange);
export { AfAskForRange };
