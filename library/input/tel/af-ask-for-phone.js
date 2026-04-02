// library/input/tel/af-ask-for-phone.js
//
// <af-ask-for-phone key="phone" label="Phone Number">
//
// Observed attributes:
//   key         — Inventory key (required)
//   label       — human-readable label (defaults to key value)
//   placeholder — input placeholder text
//   required    — boolean presence attribute
//   pattern     — HTML pattern attribute for format validation
//
// Input type: tel, inputmode="tel", autocomplete="tel".
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
  <input part="input" type="tel" inputmode="tel" autocomplete="tel" spellcheck="false">
  <div part="error" class="error"></div>
`;

class AfAskForPhone extends HTMLElement {
  static observedAttributes = ['key', 'label', 'placeholder', 'required', 'pattern'];

  #key         = new Signal('');
  #label       = new Signal('');
  #placeholder = new Signal('');
  #required    = new Signal(false);
  #pattern     = new Signal('');
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
    if (attr === 'required')    this.#required.value    = next !== null;
    if (attr === 'pattern')     this.#pattern.value     = next ?? '';
  }

  connectedCallback() {
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#placeholder, this.#required, this.#pattern,
    ]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, placeholder, required, pattern]) => {
      const id = `af-tel-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id          = id;
      this.#inputEl.name        = key;
      this.#inputEl.placeholder = placeholder || '+1 (555) 000-0000';
      if (required) this.#inputEl.setAttribute('required', '');
      else          this.#inputEl.removeAttribute('required');
      if (pattern) this.#inputEl.setAttribute('pattern', pattern);
      else         this.#inputEl.removeAttribute('pattern');
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
      globalThis.Inventory.set(key, this.#inputEl.value);
    }));
  }
}

customElements.define('af-ask-for-phone', AfAskForPhone);
export { AfAskForPhone };
