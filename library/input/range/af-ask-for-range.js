// library/input/range/af-ask-for-range.js
//
// <af-ask-for-range key="volume" label="Volume" min="0" max="100" show-value>
//
// Observed attributes:
//   key              — Inventory key (required)
//   label            — human-readable label (defaults to key value)
//   min              — minimum value (default: 0)
//   max              — maximum value (default: 100)
//   step             — step increment (default: 1)
//   show-value       — presence shows a badge with the current value
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
    .label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: .35rem; gap: .75rem; }
    label { font-size: .875rem; font-weight: 500; color: var(--bs-body-color, #dee2e6); }
    .badge {
      padding: .2rem .5rem;
      border-radius: 999px;
      font-size: .75rem;
      background: var(--bs-secondary-bg, #495057);
      color: var(--bs-body-color, #dee2e6);
    }
    input[type="range"] { display: block; width: 100%; cursor: pointer; accent-color: var(--bs-primary, #0d6efd); }
    :host([size="sm"]) label { font-size: .8rem; }
    :host([size="sm"]) .badge { font-size: .7rem; }
    :host([size="lg"]) label { font-size: 1rem; }
    :host([size="lg"]) .badge { font-size: .85rem; padding: .25rem .625rem; }
    .form-text { display: block; margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .valid-feedback, .invalid-feedback { display: none; width: 100%; margin-top: .25rem; font-size: .875em; }
    .valid-feedback { color: var(--bs-form-valid-color, var(--bs-success, #198754)); }
    .invalid-feedback { color: var(--bs-form-invalid-color, var(--bs-danger, #dc3545)); }
    .valid-feedback[data-visible="true"], .invalid-feedback[data-visible="true"] { display: block; }
  </style>
  <div class="label-row">
    <label part="label"></label>
    <span part="badge" class="badge" hidden></span>
  </div>
  <input part="input" type="range">
  <div part="help" class="form-text" hidden></div>
  <div part="valid-feedback" class="valid-feedback" hidden></div>
  <div part="invalid-feedback" class="invalid-feedback" hidden></div>
`;

class AfAskForRange extends HTMLElement {
  static observedAttributes = ['key', 'label', 'min', 'max', 'step', 'show-value', 'help', 'size', 'valid-feedback', 'invalid-feedback'];

  #key             = new Signal('');
  #label           = new Signal('');
  #min             = new Signal('0');
  #max             = new Signal('100');
  #step            = new Signal('1');
  #showValue       = new Signal(false);
  #help            = new Signal('');
  #size            = new Signal('');
  #validFeedback   = new Signal('');
  #invalidFeedback = new Signal('');
  #scope           = new Scope();

  #labelEl;
  #badgeEl;
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
    this.#badgeEl   = root.querySelector('[part="badge"]');
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
    });
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')              this.#key.value             = next ?? '';
    if (attr === 'label')            this.#label.value           = next ?? '';
    if (attr === 'min')              this.#min.value             = next ?? '0';
    if (attr === 'max')              this.#max.value             = next ?? '100';
    if (attr === 'step')             this.#step.value            = next ?? '1';
    if (attr === 'show-value')       this.#showValue.value       = next !== null;
    if (attr === 'help')             this.#help.value            = next ?? '';
    if (attr === 'size')             this.#size.value            = normalizeSize(next ?? '');
    if (attr === 'valid-feedback')   this.#validFeedback.value   = next ?? '';
    if (attr === 'invalid-feedback') this.#invalidFeedback.value = next ?? '';
  }

  connectedCallback() {
    this.setAttribute('data-af-validatable', '');
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#min, this.#max, this.#step, this.#showValue,
      this.#help, this.#size, this.#validFeedback, this.#invalidFeedback,
    ]);

    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, min, max, step, showValue, help, size, validFeedback, invalidFeedback]) => {
      const fieldId = safeFieldId('af-range', key || 'field');
      if (size) this.setAttribute('size', size);
      else      this.removeAttribute('size');

      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', fieldId);
      this.#inputEl.id          = fieldId;
      this.#inputEl.name        = key;
      this.#inputEl.min         = min || '0';
      this.#inputEl.max         = max || '100';
      this.#inputEl.step        = step || '1';

      this.#helpEl.id    = `${fieldId}-help`;
      this.#validEl.id   = `${fieldId}-valid`;
      this.#invalidEl.id = `${fieldId}-invalid`;

      this.#badgeEl.hidden = !showValue;

      this.#validation.configure({ helpText: help, validFeedback, invalidFeedback });
      this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
  checkValidity() { return this.#validation.checkValidity(); }
  reportValidity() { return this.#validation.reportValidity({ focus: true }); }

  #bindInventory() {
    const key       = this.#key.peek();
    const showValue = this.#showValue.peek();
    const inv       = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;

    inv.add(globalThis.Inventory.subscribe(key, (value) => {
      const next = String(value ?? this.#min.peek());
      if (this.#inputEl.value !== next) this.#inputEl.value = next;
      if (showValue) this.#badgeEl.textContent = this.#inputEl.value;
      this.#validation.refresh();
    }));

    inv.add(on(this.#inputEl, 'input', () => {
      if (showValue) this.#badgeEl.textContent = this.#inputEl.value;
      globalThis.Inventory?.set?.(key, Number(this.#inputEl.value));
      this.#validation.refresh();
    }));
  }
}

customElements.define('af-ask-for-range', AfAskForRange);
export { AfAskForRange };
