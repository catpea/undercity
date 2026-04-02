// library/input/file/af-ask-for-file.js
//
// <af-ask-for-file key="docs" label="Upload Documents" accept=".pdf,.doc" multiple>
//
// Observed attributes:
//   key      — Inventory key (required)
//   label    — human-readable label (defaults to key)
//   accept   — MIME types / extensions filter (default: "*/*")
//   multiple — boolean presence attribute — allow multiple files
//   required — boolean presence attribute
//
// On change: stores { name, size, type, url } (or array of those) in Inventory.
// URL is a blob: URL created via URL.createObjectURL(). No Inventory→DOM sync
// (file inputs cannot be programmatically set). Shadow DOM, Signal model.

import { Signal, on } from 'framework';
import { Scope }      from 'scope';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }
    label {
      display: block; margin-bottom: .25rem;
      font-size: .875rem; font-weight: 500;
      color: var(--bs-body-color, #dee2e6);
    }
    input[type="file"] {
      display: block; width: 100%;
      color: var(--bs-body-color, #dee2e6);
      background-color: var(--bs-body-bg, #212529);
      border: 1px solid var(--bs-border-color, #495057);
      border-radius: .375rem;
      padding: .375rem .75rem;
      box-sizing: border-box;
      cursor: pointer;
    }
    input[type="file"]::file-selector-button {
      padding: .25rem .5rem;
      margin-right: .75rem;
      background: var(--bs-primary, #0d6efd);
      color: #fff;
      border: none;
      border-radius: .25rem;
      cursor: pointer;
    }
    .hint  { margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .error { display: none; margin-top: .25rem; font-size: .875em; color: var(--bs-danger, #dc3545); }
  </style>
  <label part="label"></label>
  <input part="input" type="file">
  <div part="hint"  class="hint"></div>
  <div part="error" class="error"></div>
`;

class AfAskForFile extends HTMLElement {
  static observedAttributes = ['key', 'label', 'accept', 'multiple', 'required'];

  #key      = new Signal('');
  #label    = new Signal('');
  #accept   = new Signal('*/*');
  #multiple = new Signal(false);
  #required = new Signal(false);
  #scope    = new Scope();

  #labelEl;
  #inputEl;
  #hintEl;

  constructor() {
    super();
    const root    = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl = root.querySelector('[part="label"]');
    this.#inputEl = root.querySelector('[part="input"]');
    this.#hintEl  = root.querySelector('[part="hint"]');
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')      this.#key.value      = next ?? '';
    if (attr === 'label')    this.#label.value    = next ?? '';
    if (attr === 'accept')   this.#accept.value   = next ?? '*/*';
    if (attr === 'multiple') this.#multiple.value = next !== null;
    if (attr === 'required') this.#required.value = next !== null;
  }

  connectedCallback() {
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#accept, this.#multiple, this.#required,
    ]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, accept, multiple, required]) => {
      const id = `af-file-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id     = id;
      this.#inputEl.name   = key;
      this.#inputEl.accept = accept;
      this.#inputEl.multiple = multiple;
      if (required) this.#inputEl.setAttribute('required', '');
      else          this.#inputEl.removeAttribute('required');
      this.#bindChange();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }

  #bindChange() {
    const key = this.#key.peek();
    const multi = this.#multiple.peek();
    const ev  = this.#scope.scope('ev');
    ev.dispose();
    ev.add(on(this.#inputEl, 'change', () => {
      const files = Array.from(this.#inputEl.files ?? []);
      if (!files.length) return;
      const mapped = files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        url:  URL.createObjectURL(f),
      }));
      const val = multi ? mapped : mapped[0];
      if (key) globalThis.Inventory?.set(key, val);
      this.#hintEl.textContent = files.map(f => f.name).join(', ');
    }));
  }
}

customElements.define('af-ask-for-file', AfAskForFile);
export { AfAskForFile };
