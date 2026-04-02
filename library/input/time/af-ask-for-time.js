// library/input/time/af-ask-for-time.js
//
// <af-ask-for-time key="alarm" label="Alarm Time">
//
// Observed attributes:
//   key      — Inventory key (required)
//   label    — human-readable label (defaults to key value)
//   min      — minimum time (HH:MM)
//   max      — maximum time (HH:MM)
//   required — boolean presence attribute
//
// Input type: time. Binds on 'change' event.
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
    .error { display: none; margin-top: .25rem; font-size: .875em; color: var(--bs-danger, #dc3545); }
  </style>
  <label part="label"></label>
  <input part="input" type="time">
  <div part="error" class="error"></div>
`;

class AfAskForTime extends HTMLElement {
  static observedAttributes = ['key', 'label', 'min', 'max', 'required'];

  #key      = new Signal('');
  #label    = new Signal('');
  #min      = new Signal('');
  #max      = new Signal('');
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
    if (attr === 'min')      this.#min.value      = next ?? '';
    if (attr === 'max')      this.#max.value      = next ?? '';
    if (attr === 'required') this.#required.value = next !== null;
  }

  connectedCallback() {
    const combined = Signal.combineLatest([this.#key, this.#label, this.#min, this.#max, this.#required]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, min, max, required]) => {
      const id = `af-time-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id   = id;
      this.#inputEl.name = key;
      if (min) this.#inputEl.setAttribute('min', min);
      else     this.#inputEl.removeAttribute('min');
      if (max) this.#inputEl.setAttribute('max', max);
      else     this.#inputEl.removeAttribute('max');
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
    inv.add(on(this.#inputEl, 'change', () => {
      globalThis.Inventory.set(key, this.#inputEl.value);
    }));
  }
}

customElements.define('af-ask-for-time', AfAskForTime);
export { AfAskForTime };
