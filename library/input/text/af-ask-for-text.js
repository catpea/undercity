// library/input/text/af-ask-for-text.js
//
// <af-ask-for-text key="username" label="Username" placeholder="Enter name">
//
// Observed attributes:
//   key          — Inventory key (required)
//   label        — human-readable label (defaults to key value)
//   placeholder  — input placeholder text
//   required     — boolean presence attribute
//   autocomplete — autocomplete hint (e.g. "name", "username")
//   spellcheck   — "true" | "false" (default: "false")
//
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
  <input part="input" type="text">
  <div part="error" class="error"></div>
`;

class AfAskForText extends HTMLElement {
  static observedAttributes = ['key', 'label', 'placeholder', 'required', 'autocomplete', 'spellcheck'];

  #key          = new Signal('');
  #label        = new Signal('');
  #placeholder  = new Signal('');
  #required     = new Signal(false);
  #autocomplete = new Signal('');
  #spellcheck   = new Signal(false);
  #scope        = new Scope();

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
    if (attr === 'key')          this.#key.value          = next ?? '';
    if (attr === 'label')        this.#label.value        = next ?? '';
    if (attr === 'placeholder')  this.#placeholder.value  = next ?? '';
    if (attr === 'required')     this.#required.value     = next !== null;
    if (attr === 'autocomplete') this.#autocomplete.value = next ?? '';
    if (attr === 'spellcheck')   this.#spellcheck.value   = next === 'true';
  }

  connectedCallback() {
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#placeholder,
      this.#required, this.#autocomplete, this.#spellcheck,
    ]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, placeholder, required, autocomplete, spellcheck]) => {
      const id = `af-text-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id          = id;
      this.#inputEl.name        = key;
      this.#inputEl.placeholder = placeholder;
      this.#inputEl.spellcheck  = spellcheck;
      if (required) this.#inputEl.setAttribute('required', '');
      else          this.#inputEl.removeAttribute('required');
      if (autocomplete) this.#inputEl.setAttribute('autocomplete', autocomplete);
      else              this.#inputEl.removeAttribute('autocomplete');
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

customElements.define('af-ask-for-text', AfAskForText);
export { AfAskForText };
