// library/input/checkbox/af-ask-with-checkbox.js
//
// <af-ask-with-checkbox key="agreed" label="I agree to the terms">
//
// Observed attributes:
//   key      — Inventory key (required)
//   label    — checkbox label text (defaults to key)
//   required — boolean presence attribute
//
// Stores boolean in Inventory. Shadow DOM, Signal model.

import { Signal, on } from 'framework';
import { Scope }      from 'scope';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }
    .row {
      display: flex;
      align-items: center;
      gap: .5rem;
    }
    input[type="checkbox"] {
      width: 1.1em;
      height: 1.1em;
      flex-shrink: 0;
      cursor: pointer;
      accent-color: var(--bs-primary, #0d6efd);
    }
    label {
      font-size: .9375rem;
      color: var(--bs-body-color, #dee2e6);
      cursor: pointer;
      user-select: none;
    }
    .error { display: none; margin-top: .25rem; font-size: .875em; color: var(--bs-danger, #dc3545); }
  </style>
  <div class="row">
    <input part="input" type="checkbox">
    <label part="label"></label>
  </div>
  <div part="error" class="error"></div>
`;

class AfAskWithCheckbox extends HTMLElement {
  static observedAttributes = ['key', 'label', 'required'];

  #key      = new Signal('');
  #label    = new Signal('');
  #required = new Signal(false);
  #scope    = new Scope();

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
    if (attr === 'key')      this.#key.value      = next ?? '';
    if (attr === 'label')    this.#label.value    = next ?? '';
    if (attr === 'required') this.#required.value = next !== null;
  }

  connectedCallback() {
    const combined = Signal.combineLatest([this.#key, this.#label, this.#required]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, required]) => {
      const id = `af-chk-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id   = id;
      this.#inputEl.name = key;
      if (required) this.#inputEl.setAttribute('required', '');
      else          this.#inputEl.removeAttribute('required');
      this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }

  #bindInventory() {
    const key = this.#key.peek();
    const inv = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;
    inv.add(globalThis.Inventory.subscribe(key, v => {
      if (this.#inputEl.checked !== !!v) this.#inputEl.checked = !!v;
    }));
    inv.add(on(this.#inputEl, 'change', () => {
      globalThis.Inventory.set(key, this.#inputEl.checked);
    }));
  }
}

customElements.define('af-ask-with-checkbox', AfAskWithCheckbox);
export { AfAskWithCheckbox };
