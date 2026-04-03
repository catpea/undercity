// library/input/radio/af-ask-with-radio.js
//
// <af-ask-with-radio key="plan" label="Choose a plan" options="Starter,Pro,Enterprise">
//
// Observed attributes:
//   key              — Inventory key (required)
//   label            — fieldset legend (defaults to key)
//   options          — comma-separated list of choices e.g. "Yes,No,Maybe"
//   required         — boolean presence attribute
//   help             — Bootstrap-style .form-text helper copy
//   size             — "" | "sm" | "lg"
//   valid-feedback   — optional success message
//   invalid-feedback — optional error message

import { Signal, on } from 'framework';
import {
  FieldValidationController,
  boolAttr,
  defaultChoiceInvalidMessage,
  normalizeSize,
  safeFieldId,
} from 'form-field';
import { Scope } from 'scope';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }
    fieldset { border: none; margin: 0; padding: 0; }
    legend {
      display: block;
      margin-bottom: .375rem;
      font-size: .875rem;
      font-weight: 500;
      color: var(--bs-body-color, #dee2e6);
    }
    .option {
      display: flex;
      align-items: center;
      gap: .5rem;
      margin-bottom: .35rem;
    }
    input[type="radio"] {
      width: 1.05rem;
      height: 1.05rem;
      margin: 0;
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
    :host([size="sm"]) input[type="radio"] { width: .95rem; height: .95rem; }
    :host([size="sm"]) legend, :host([size="sm"]) label { font-size: .875rem; }
    :host([size="lg"]) input[type="radio"] { width: 1.2rem; height: 1.2rem; }
    :host([size="lg"]) legend { font-size: 1rem; }
    :host([size="lg"]) label { font-size: 1.05rem; }
    .form-text { display: block; margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .valid-feedback, .invalid-feedback { display: none; width: 100%; margin-top: .25rem; font-size: .875em; }
    .valid-feedback { color: var(--bs-form-valid-color, var(--bs-success, #198754)); }
    .invalid-feedback { color: var(--bs-form-invalid-color, var(--bs-danger, #dc3545)); }
    .valid-feedback[data-visible="true"], .invalid-feedback[data-visible="true"] { display: block; }
  </style>
  <fieldset>
    <legend part="legend"></legend>
    <div part="options"></div>
  </fieldset>
  <div part="help" class="form-text" hidden></div>
  <div part="valid-feedback" class="valid-feedback" hidden></div>
  <div part="invalid-feedback" class="invalid-feedback" hidden></div>
`;

class AfAskWithRadio extends HTMLElement {
  static observedAttributes = ['key', 'label', 'options', 'required', 'help', 'size', 'valid-feedback', 'invalid-feedback'];

  #key             = new Signal('');
  #label           = new Signal('');
  #options         = new Signal([]);
  #required        = new Signal(false);
  #help            = new Signal('');
  #size            = new Signal('');
  #validFeedback   = new Signal('');
  #invalidFeedback = new Signal('');
  #scope           = new Scope();

  #legendEl;
  #optionsEl;
  #helpEl;
  #validEl;
  #invalidEl;
  #validation;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#legendEl   = root.querySelector('[part="legend"]');
    this.#optionsEl  = root.querySelector('[part="options"]');
    this.#helpEl     = root.querySelector('[part="help"]');
    this.#validEl    = root.querySelector('[part="valid-feedback"]');
    this.#invalidEl  = root.querySelector('[part="invalid-feedback"]');
    this.#validation = new FieldValidationController(this, {
      getControls:       () => [...this.#optionsEl.querySelectorAll('input[type="radio"]')],
      getPrimaryControl: () => this.#optionsEl.querySelector('input[type="radio"]'),
      getHelpEl:         () => this.#helpEl,
      getValidEl:        () => this.#validEl,
      getInvalidEl:      () => this.#invalidEl,
      getValidity:       () => {
        const inputs = [...this.#optionsEl.querySelectorAll('input[type="radio"]')];
        if (!inputs.length) return { valid: true };
        if (!this.#required.peek()) return { valid: true };
        return { valid: inputs.some((input) => input.checked) };
      },
      getInvalidMessage: () => {
        if (this.getAttribute('invalid-feedback')) return this.getAttribute('invalid-feedback');
        const label = String(this.#label.peek() || this.#key.peek() || '').trim();
        return label ? `Please choose an option for ${label.toLowerCase()}.` : defaultChoiceInvalidMessage('an option');
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
    if (attr === 'options') {
      this.#options.value = (next ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    }
  }

  connectedCallback() {
    this.setAttribute('data-af-validatable', '');
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#options, this.#required,
      this.#help, this.#size, this.#validFeedback, this.#invalidFeedback,
    ]);

    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, options, required, help, size, validFeedback, invalidFeedback]) => {
      const fieldId = safeFieldId('af-radio', key || 'field');
      if (size) this.setAttribute('size', size);
      else      this.removeAttribute('size');

      this.#legendEl.textContent = label || key;
      this.#helpEl.id            = `${fieldId}-help`;
      this.#validEl.id           = `${fieldId}-valid`;
      this.#invalidEl.id         = `${fieldId}-invalid`;

      this.#buildOptions(fieldId, key, options, required);
      this.#validation.configure({ helpText: help, validFeedback, invalidFeedback });
      this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
  checkValidity() { return this.#validation.checkValidity(); }
  reportValidity() { return this.#validation.reportValidity({ focus: true }); }

  #buildOptions(fieldId, key, options, required) {
    const radios = this.#scope.scope('radios');
    radios.dispose();
    this.#optionsEl.innerHTML = '';

    options.forEach((option, index) => {
      const id    = `${fieldId}-${index}`;
      const row   = document.createElement('div');
      row.className = 'option';

      const input = document.createElement('input');
      input.type  = 'radio';
      input.id    = id;
      input.name  = key;
      input.value = option;
      if (required) input.setAttribute('required', '');
      else          input.removeAttribute('required');

      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.textContent = option;

      row.append(input, label);
      this.#optionsEl.appendChild(row);

      radios.add(on(input, 'change', () => {
        if (input.checked) globalThis.Inventory?.set?.(key, option);
        this.#validation.refresh();
      }));
    });
  }

  #bindInventory() {
    const key = this.#key.peek();
    const inv = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;

    inv.add(globalThis.Inventory.subscribe(key, (value) => {
      const current = String(value ?? '');
      const inputs = [...this.#optionsEl.querySelectorAll('input[type="radio"]')];
      inputs.forEach((input) => { input.checked = input.value === current; });
      this.#validation.refresh();
    }));
  }
}

customElements.define('af-ask-with-radio', AfAskWithRadio);
export { AfAskWithRadio };
