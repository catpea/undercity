// library/input/color/af-ask-for-color.js
//
// <af-ask-for-color key="theme" label="Theme Color" default="#268bd2">
//
// Observed attributes:
//   key     — Inventory key (required)
//   label   — human-readable label (defaults to key value)
//   default — default hex color value (defaults to '#268bd2')
//
// Shows a color picker and a <code class="hex"> display of the current hex value.
// Inventory stores string (hex color). Two-way binding via globalThis.Inventory.
// Shadow DOM with Bootstrap-compatible styles.

import { Signal, on } from 'framework';
import { Scope }      from 'scope';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }
    label { display: block; margin-bottom: .25rem; font-size: .875rem; font-weight: 500; color: var(--bs-body-color, #dee2e6); }
    .picker-row { display: flex; align-items: center; gap: .5rem; }
    input[type="color"] {
      width: 3rem; height: 2.25rem; padding: .25rem; cursor: pointer;
      border: 1px solid var(--bs-border-color, #495057);
      border-radius: .375rem; background: var(--bs-body-bg, #212529);
      box-sizing: border-box;
    }
    .hex { font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
  </style>
  <label part="label"></label>
  <div class="picker-row">
    <input part="input" type="input" title="Pick a color">
    <code part="hex" class="hex"></code>
  </div>
`;

class AfAskForColor extends HTMLElement {
  static observedAttributes = ['key', 'label', 'default'];

  #key     = new Signal('');
  #label   = new Signal('');
  #default = new Signal('#268bd2');
  #scope   = new Scope();

  #labelEl;
  #inputEl;
  #hexEl;

  constructor() {
    super();
    const root    = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl = root.querySelector('[part="label"]');
    this.#inputEl = root.querySelector('[part="input"]');
    this.#hexEl   = root.querySelector('[part="hex"]');
    // Ensure the input is properly typed
    this.#inputEl.type = 'color';
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')     this.#key.value     = next ?? '';
    if (attr === 'label')   this.#label.value   = next ?? '';
    if (attr === 'default') this.#default.value = next ?? '#268bd2';
  }

  connectedCallback() {
    const combined = Signal.combineLatest([this.#key, this.#label, this.#default]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, defaultColor]) => {
      const id = `af-color-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id   = id;
      this.#inputEl.name = key;
      // Set default value if no inventory value yet
      if (!this.#inputEl.value) {
        this.#inputEl.value    = defaultColor || '#268bd2';
        this.#hexEl.textContent = this.#inputEl.value;
      }
      if (this.isConnected) this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }

  #bindInventory() {
    const key          = this.#key.peek();
    const defaultColor = this.#default.peek();
    const inv          = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;
    inv.add(globalThis.Inventory.subscribe(key, v => {
      const nv = String(v ?? defaultColor ?? '#268bd2');
      if (this.#inputEl.value !== nv) {
        this.#inputEl.value    = nv;
        this.#hexEl.textContent = nv;
      }
    }));
    inv.add(on(this.#inputEl, 'input', () => {
      globalThis.Inventory.set(key, this.#inputEl.value);
      this.#hexEl.textContent = this.#inputEl.value;
    }));
  }
}

customElements.define('af-ask-for-color', AfAskForColor);
export { AfAskForColor };
