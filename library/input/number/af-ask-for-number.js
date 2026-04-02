// library/input/number/af-ask-for-number.js
//
// <af-ask-for-number key="age" label="Age" min="0" max="120">
//
// Observed attributes:
//   key         — Inventory key (required)
//   label       — human-readable label (defaults to key value)
//   placeholder — input placeholder text
//   min         — minimum value
//   max         — maximum value
//   step        — step increment (default: 1)
//   required    — boolean presence attribute
//
// Input type: number, inputmode="numeric". Inventory stores Number (or null if empty).
// Two-way binding via globalThis.Inventory. Shadow DOM with Bootstrap-compatible styles.

import { Signal, on } from 'framework';
import { Scope }      from 'scope';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }
    label { display: block; margin-bottom: .25rem; font-size: .875rem; font-weight: 500; color: var(--bs-body-color, #dee2e6); }
    input {
      display: block; width: 100%; padding: .375rem .75rem;
      font-size: 1rem; line-height: 1.5;
      color: var(--bs-body-color, #dee2e6);
      background-color: var(--bs-body-bg, #212529);
      border: 1px solid var(--bs-border-color, #495057);
      border-radius: .375rem; box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
    }
    input:focus { outline: 0; border-color: #86b7fe; box-shadow: 0 0 0 .25rem rgba(13,110,253,.25); }
    .hint  { margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .error { display: none; margin-top: .25rem; font-size: .875em; color: var(--bs-danger, #dc3545); }
  </style>
  <label part="label"></label>
  <input part="input" type="number" inputmode="numeric">
  <div part="error" class="error"></div>
`;

class AfAskForNumber extends HTMLElement {
  static observedAttributes = ['key', 'label', 'placeholder', 'min', 'max', 'step', 'required'];

  #key         = new Signal('');
  #label       = new Signal('');
  #placeholder = new Signal('');
  #min         = new Signal('');
  #max         = new Signal('');
  #step        = new Signal('1');
  #required    = new Signal(false);
  #scope       = new Scope();

  #labelEl;
  #inputEl;

  constructor() {
    super();
    const root    = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl = root.querySelector('[part="label"]');
    this.#inputEl = root.querySelector('[part="input"]');
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')         this.#key.value         = next ?? '';
    if (attr === 'label')       this.#label.value       = next ?? '';
    if (attr === 'placeholder') this.#placeholder.value = next ?? '';
    if (attr === 'min')         this.#min.value         = next ?? '';
    if (attr === 'max')         this.#max.value         = next ?? '';
    if (attr === 'step')        this.#step.value        = next ?? '1';
    if (attr === 'required')    this.#required.value    = next !== null;
  }

  connectedCallback() {
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#placeholder,
      this.#min, this.#max, this.#step, this.#required,
    ]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, placeholder, min, max, step, required]) => {
      const id = `af-num-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id          = id;
      this.#inputEl.name        = key;
      this.#inputEl.placeholder = placeholder;
      this.#inputEl.step        = step || '1';
      if (min !== '') this.#inputEl.setAttribute('min', min);
      else            this.#inputEl.removeAttribute('min');
      if (max !== '') this.#inputEl.setAttribute('max', max);
      else            this.#inputEl.removeAttribute('max');
      if (required) this.#inputEl.setAttribute('required', '');
      else          this.#inputEl.removeAttribute('required');
      if (this.isConnected) this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }

  #bindInventory() {
    const key = this.#key.peek();
    const inv = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;
    inv.add(globalThis.Inventory.subscribe(key, v => {
      const nv = String(v ?? '');
      if (this.#inputEl.value !== nv) this.#inputEl.value = nv;
    }));
    inv.add(on(this.#inputEl, 'input', () => {
      const v = this.#inputEl.value;
      globalThis.Inventory.set(key, v === '' ? null : Number(v));
    }));
  }
}

customElements.define('af-ask-for-number', AfAskForNumber);
export { AfAskForNumber };
