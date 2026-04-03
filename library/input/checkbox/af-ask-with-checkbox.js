// library/input/checkbox/af-ask-with-checkbox.js
//
// <af-ask-with-checkbox key="agreed" label="I agree to the terms">
//
// Observed attributes:
//   key              — Inventory key (required)
//   label            — checkbox label text (defaults to key)
//   required         — boolean presence attribute
//   help             — Bootstrap-style .form-text helper copy
//   size             — "" | "sm" | "lg"
//   valid-feedback   — optional success message
//   invalid-feedback — optional error message

import { Signal, on } from 'framework';
import {
  FieldValidationController,
  boolAttr,
  normalizeSize,
  safeFieldId,
  setBooleanAttribute,
} from 'form-field';
import { Scope } from 'scope';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }
    .form-check { display: flex; align-items: flex-start; gap: .5rem; }
    input[type="checkbox"] {
      width: 1.05rem;
      height: 1.05rem;
      margin: .2rem 0 0;
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
    input.is-valid { outline: 1px solid var(--bs-form-valid-border-color, var(--bs-success, #198754)); }
    input.is-invalid { outline: 1px solid var(--bs-form-invalid-border-color, var(--bs-danger, #dc3545)); }
    :host([size="sm"]) input[type="checkbox"] { width: .95rem; height: .95rem; }
    :host([size="sm"]) label { font-size: .875rem; }
    :host([size="lg"]) input[type="checkbox"] { width: 1.2rem; height: 1.2rem; }
    :host([size="lg"]) label { font-size: 1.05rem; }
    .form-text { display: block; margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .valid-feedback, .invalid-feedback { display: none; width: 100%; margin-top: .25rem; font-size: .875em; }
    .valid-feedback { color: var(--bs-form-valid-color, var(--bs-success, #198754)); }
    .invalid-feedback { color: var(--bs-form-invalid-color, var(--bs-danger, #dc3545)); }
    .valid-feedback[data-visible="true"], .invalid-feedback[data-visible="true"] { display: block; }
  </style>
  <div class="form-check">
    <input part="input" type="checkbox">
    <label part="label"></label>
  </div>
  <div part="help" class="form-text" hidden></div>
  <div part="valid-feedback" class="valid-feedback" hidden></div>
  <div part="invalid-feedback" class="invalid-feedback" hidden></div>
`;

class AfAskWithCheckbox extends HTMLElement {
  static observedAttributes = ['key', 'label', 'required', 'help', 'size', 'valid-feedback', 'invalid-feedback'];

  #key             = new Signal('');
  #label           = new Signal('');
  #required        = new Signal(false);
  #help            = new Signal('');
  #size            = new Signal('');
  #validFeedback   = new Signal('');
  #invalidFeedback = new Signal('');
  #scope           = new Scope();

  #labelEl;
  #inputEl;
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
    this.#helpEl    = root.querySelector('[part="help"]');
    this.#validEl   = root.querySelector('[part="valid-feedback"]');
    this.#invalidEl = root.querySelector('[part="invalid-feedback"]');
    this.#validation = new FieldValidationController(this, {
      getControls:       () => [this.#inputEl],
      getPrimaryControl: () => this.#inputEl,
      getHelpEl:         () => this.#helpEl,
      getValidEl:        () => this.#validEl,
      getInvalidEl:      () => this.#invalidEl,
      getValidity:       () => ({ valid: !this.#required.peek() || this.#inputEl.checked }),
      getInvalidMessage: () => {
        if (this.getAttribute('invalid-feedback')) return this.getAttribute('invalid-feedback');
        const label = String(this.#label.peek() || '').trim();
        return label ? `Please confirm ${label.toLowerCase()}.` : 'Please check this box to continue.';
      },
    });
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')              this.#key.value             = next ?? '';
    if (attr === 'label')            this.#label.value           = next ?? '';
    if (attr === 'required')         this.#required.value        = boolAttr(next);
    if (attr === 'help')             this.#help.value            = next ?? '';
    if (attr === 'size')             this.#size.value            = normalizeSize(next ?? '');
    if (attr === 'valid-feedback')   this.#validFeedback.value   = next ?? '';
    if (attr === 'invalid-feedback') this.#invalidFeedback.value = next ?? '';
  }

  connectedCallback() {
    this.setAttribute('data-af-validatable', '');
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#required, this.#help,
      this.#size, this.#validFeedback, this.#invalidFeedback,
    ]);

    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, required, help, size, validFeedback, invalidFeedback]) => {
      const fieldId = safeFieldId('af-checkbox', key || 'field');
      if (size) this.setAttribute('size', size);
      else      this.removeAttribute('size');

      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', fieldId);
      this.#inputEl.id          = fieldId;
      this.#inputEl.name        = key;

      this.#helpEl.id    = `${fieldId}-help`;
      this.#validEl.id   = `${fieldId}-valid`;
      this.#invalidEl.id = `${fieldId}-invalid`;

      setBooleanAttribute(this.#inputEl, 'required', required);

      this.#validation.configure({ helpText: help, validFeedback, invalidFeedback });
      this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
  checkValidity() { return this.#validation.checkValidity(); }
  reportValidity() { return this.#validation.reportValidity({ focus: true }); }

  #bindInventory() {
    const key = this.#key.peek();
    const inv = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;

    inv.add(globalThis.Inventory.subscribe(key, (value) => {
      const next = !!value;
      if (this.#inputEl.checked !== next) this.#inputEl.checked = next;
      this.#validation.refresh();
    }));

    inv.add(on(this.#inputEl, 'change', () => {
      globalThis.Inventory?.set?.(key, this.#inputEl.checked);
      this.#validation.refresh();
    }));
  }
}

customElements.define('af-ask-with-checkbox', AfAskWithCheckbox);
export { AfAskWithCheckbox };
