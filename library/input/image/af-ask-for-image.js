// library/input/image/af-ask-for-image.js
//
// <af-ask-for-image key="avatar" label="Profile Picture">
//
// Observed attributes:
//   key      — Inventory key (required)
//   label    — human-readable label (defaults to key)
//   accept   — MIME filter (default: "image/*")
//   required — boolean presence attribute
//
// On change: creates a blob URL, shows an inline preview, stores
// { name, size, type, url } in Inventory. Shadow DOM, Signal model.

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
    .preview {
      display: none;
      margin-top: .5rem;
    }
    .preview img {
      max-height: 160px;
      max-width: 100%;
      border-radius: .375rem;
      display: block;
      border: 1px solid var(--bs-border-color, #495057);
    }
    .error { display: none; margin-top: .25rem; font-size: .875em; color: var(--bs-danger, #dc3545); }
  </style>
  <label part="label"></label>
  <input part="input" type="file" accept="image/*">
  <div part="preview" class="preview">
    <img part="preview-img" alt="Preview">
  </div>
  <div part="error" class="error"></div>
`;

class AfAskForImage extends HTMLElement {
  static observedAttributes = ['key', 'label', 'accept', 'required'];

  #key      = new Signal('');
  #label    = new Signal('');
  #accept   = new Signal('image/*');
  #required = new Signal(false);
  #scope    = new Scope();

  #labelEl;
  #inputEl;
  #previewEl;
  #previewImg;

  constructor() {
    super();
    const root      = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl   = root.querySelector('[part="label"]');
    this.#inputEl   = root.querySelector('[part="input"]');
    this.#previewEl = root.querySelector('[part="preview"]');
    this.#previewImg = root.querySelector('[part="preview-img"]');
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')      this.#key.value      = next ?? '';
    if (attr === 'label')    this.#label.value    = next ?? '';
    if (attr === 'accept')   this.#accept.value   = next ?? 'image/*';
    if (attr === 'required') this.#required.value = next !== null;
  }

  connectedCallback() {
    const combined = Signal.combineLatest([this.#key, this.#label, this.#accept, this.#required]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, accept, required]) => {
      const id = `af-img-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id     = id;
      this.#inputEl.name   = key;
      this.#inputEl.accept = accept;
      if (required) this.#inputEl.setAttribute('required', '');
      else          this.#inputEl.removeAttribute('required');
      this.#bindChange();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }

  #bindChange() {
    const key = this.#key.peek();
    const ev  = this.#scope.scope('ev');
    ev.dispose();
    ev.add(on(this.#inputEl, 'change', () => {
      const file = this.#inputEl.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const val = { name: file.name, size: file.size, type: file.type, url };
      if (key) globalThis.Inventory?.set(key, val);
      this.#previewImg.src        = url;
      this.#previewImg.alt        = file.name;
      this.#previewEl.style.display = 'block';
    }));
  }
}

customElements.define('af-ask-for-image', AfAskForImage);
export { AfAskForImage };
