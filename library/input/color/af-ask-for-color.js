// library/input/color/af-ask-for-color.js
//
// <af-ask-for-color key="theme" label="Theme Color" default="#268bd2">
//
// Observed attributes:
//   key              — Inventory key (required)
//   label            — human-readable label (defaults to key value)
//   default          — default hex color value
//   help             — Bootstrap-style .form-text helper copy
//   size             — "" | "sm" | "lg"
//   valid-feedback   — optional success message
//   invalid-feedback — optional error message

import { Signal, on } from 'framework';
import {
  FieldValidationController,
  normalizeSize,
  safeFieldId,
} from 'form-field';
import { Scope } from 'scope';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }
    label { display: block; margin-bottom: .25rem; font-size: .875rem; font-weight: 500; color: var(--bs-body-color, #dee2e6); }
    .picker-row { display: flex; align-items: center; gap: .75rem; }
    input[type="color"] {
      width: 3rem;
      height: 2.25rem;
      padding: .2rem;
      cursor: pointer;
      border: 1px solid var(--bs-border-color, #495057);
      border-radius: .375rem;
      background: var(--bs-body-bg, #212529);
      box-sizing: border-box;
    }
    code { font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    :host([size="sm"]) input[type="color"] { width: 2.5rem; height: 2rem; }
    :host([size="sm"]) code { font-size: .8rem; }
    :host([size="lg"]) input[type="color"] { width: 3.5rem; height: 2.75rem; }
    :host([size="lg"]) code { font-size: .95rem; }
    .form-text { display: block; margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .valid-feedback, .invalid-feedback { display: none; width: 100%; margin-top: .25rem; font-size: .875em; }
    .valid-feedback { color: var(--bs-form-valid-color, var(--bs-success, #198754)); }
    .invalid-feedback { color: var(--bs-form-invalid-color, var(--bs-danger, #dc3545)); }
    .valid-feedback[data-visible="true"], .invalid-feedback[data-visible="true"] { display: block; }
  </style>
  <label part="label"></label>
  <div class="picker-row">
    <input part="input" type="color">
    <code part="hex"></code>
  </div>
  <div part="help" class="form-text" hidden></div>
  <div part="valid-feedback" class="valid-feedback" hidden></div>
  <div part="invalid-feedback" class="invalid-feedback" hidden></div>
`;

class AfAskForColor extends HTMLElement {
  static observedAttributes = ['key', 'label', 'default', 'help', 'size', 'valid-feedback', 'invalid-feedback'];

  #key             = new Signal('');
  #label           = new Signal('');
  #default         = new Signal('#268bd2');
  #help            = new Signal('');
  #size            = new Signal('');
  #validFeedback   = new Signal('');
  #invalidFeedback = new Signal('');
  #scope           = new Scope();

  #labelEl;
  #inputEl;
  #hexEl;
  #helpEl;
  #validEl;
  #invalidEl;
  #validation;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl   = root.querySelector('[part="label"]');
    this.#inputEl   = root.querySelector('[part="input"]');
    this.#hexEl     = root.querySelector('[part="hex"]');
    this.#helpEl    = root.querySelector('[part="help"]');
    this.#validEl   = root.querySelector('[part="valid-feedback"]');
    this.#invalidEl = root.querySelector('[part="invalid-feedback"]');
    this.#validation = new FieldValidationController(this, {
      getControls:       () => [this.#inputEl],
      getPrimaryControl: () => this.#inputEl,
      getHelpEl:         () => this.#helpEl,
      getValidEl:        () => this.#validEl,
      getInvalidEl:      () => this.#invalidEl,
    });
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')              this.#key.value             = next ?? '';
    if (attr === 'label')            this.#label.value           = next ?? '';
    if (attr === 'default')          this.#default.value         = next ?? '#268bd2';
    if (attr === 'help')             this.#help.value            = next ?? '';
    if (attr === 'size')             this.#size.value            = normalizeSize(next ?? '');
    if (attr === 'valid-feedback')   this.#validFeedback.value   = next ?? '';
    if (attr === 'invalid-feedback') this.#invalidFeedback.value = next ?? '';
  }

  connectedCallback() {
    this.setAttribute('data-af-validatable', '');
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#default, this.#help,
      this.#size, this.#validFeedback, this.#invalidFeedback,
    ]);

    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, defaultColor, help, size, validFeedback, invalidFeedback]) => {
      const fieldId = safeFieldId('af-color', key || 'field');
      if (size) this.setAttribute('size', size);
      else      this.removeAttribute('size');

      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', fieldId);
      this.#inputEl.id          = fieldId;
      this.#inputEl.name        = key;
      this.#helpEl.id           = `${fieldId}-help`;
      this.#validEl.id          = `${fieldId}-valid`;
      this.#invalidEl.id        = `${fieldId}-invalid`;

      if (!this.#inputEl.value) this.#inputEl.value = defaultColor || '#268bd2';
      this.#hexEl.textContent = this.#inputEl.value;

      this.#validation.configure({ helpText: help, validFeedback, invalidFeedback });
      this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
  checkValidity() { return this.#validation.checkValidity(); }
  reportValidity() { return this.#validation.reportValidity({ focus: true }); }

  #bindInventory() {
    const key          = this.#key.peek();
    const defaultColor = this.#default.peek() || '#268bd2';
    const inv          = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;

    inv.add(globalThis.Inventory.subscribe(key, (value) => {
      const next = String(value ?? defaultColor);
      if (this.#inputEl.value !== next) this.#inputEl.value = next;
      this.#hexEl.textContent = this.#inputEl.value;
      this.#validation.refresh();
    }));

    inv.add(on(this.#inputEl, 'input', () => {
      this.#hexEl.textContent = this.#inputEl.value;
      globalThis.Inventory?.set?.(key, this.#inputEl.value);
      this.#validation.refresh();
    }));
  }
}

customElements.define('af-ask-for-color', AfAskForColor);
export { AfAskForColor };
