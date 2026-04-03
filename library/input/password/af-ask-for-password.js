// library/input/password/af-ask-for-password.js
//
// <af-ask-for-password key="pw" label="Password" strength-meter>
//
// Observed attributes:
//   key              — Inventory key (required)
//   label            — human-readable label (defaults to key value)
//   placeholder      — input placeholder text
//   required         — boolean presence attribute
//   strength-meter   — boolean presence attribute
//   help             — Bootstrap-style .form-text helper copy
//   size             — "" | "sm" | "lg"
//   valid-feedback   — optional success message
//   invalid-feedback — optional error message

import { Signal, on } from 'framework';
import {
  FieldValidationController,
  boolAttr,
  defaultInvalidMessage,
  normalizeSize,
  safeFieldId,
  setBooleanAttribute,
} from 'form-field';
import { Scope } from 'scope';

const STRENGTH_COLORS = ['', '#dc3545', '#ffc107', '#0dcaf0', '#198754'];
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

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
    input:focus { outline: 0; border-color: #86b7fe; box-shadow: 0 0 0 .25rem rgba(13, 110, 253, .25); }
    input.is-valid { border-color: var(--bs-form-valid-border-color, var(--bs-success, #198754)); }
    input.is-valid:focus { border-color: var(--bs-form-valid-border-color, var(--bs-success, #198754)); box-shadow: 0 0 0 .25rem rgba(25, 135, 84, .2); }
    input.is-invalid { border-color: var(--bs-form-invalid-border-color, var(--bs-danger, #dc3545)); }
    input.is-invalid:focus { border-color: var(--bs-form-invalid-border-color, var(--bs-danger, #dc3545)); box-shadow: 0 0 0 .25rem rgba(220, 53, 69, .2); }
    :host([size="sm"]) input { padding: .25rem .5rem; font-size: .875rem; border-radius: .25rem; }
    :host([size="lg"]) input { padding: .5rem 1rem; font-size: 1.25rem; border-radius: .5rem; }
    .strength-wrap[hidden] { display: none !important; }
    .strength-bar { height: 4px; margin-top: .375rem; background: var(--bs-border-color, #495057); border-radius: 999px; overflow: hidden; }
    .strength-bar-inner { height: 100%; width: 0; transition: width .2s, background-color .2s; }
    .strength-label { margin-top: .25rem; font-size: .75em; color: var(--bs-secondary-color, #6c757d); }
    .form-text { display: block; margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .valid-feedback, .invalid-feedback { display: none; width: 100%; margin-top: .25rem; font-size: .875em; }
    .valid-feedback { color: var(--bs-form-valid-color, var(--bs-success, #198754)); }
    .invalid-feedback { color: var(--bs-form-invalid-color, var(--bs-danger, #dc3545)); }
    .valid-feedback[data-visible="true"], .invalid-feedback[data-visible="true"] { display: block; }
  </style>
  <label part="label"></label>
  <input part="input" type="password" autocomplete="current-password" spellcheck="false">
  <div part="strength-wrap" class="strength-wrap" hidden>
    <div class="strength-bar"><div part="strength-bar-inner" class="strength-bar-inner"></div></div>
    <div part="strength-label" class="strength-label"></div>
  </div>
  <div part="help" class="form-text" hidden></div>
  <div part="valid-feedback" class="valid-feedback" hidden></div>
  <div part="invalid-feedback" class="invalid-feedback" hidden></div>
`;

class AfAskForPassword extends HTMLElement {
  static observedAttributes = ['key', 'label', 'placeholder', 'required', 'strength-meter', 'help', 'size', 'valid-feedback', 'invalid-feedback'];

  #key             = new Signal('');
  #label           = new Signal('');
  #placeholder     = new Signal('');
  #required        = new Signal(false);
  #strengthMeter   = new Signal(false);
  #help            = new Signal('');
  #size            = new Signal('');
  #validFeedback   = new Signal('');
  #invalidFeedback = new Signal('');
  #scope           = new Scope();

  #labelEl;
  #inputEl;
  #strengthWrap;
  #strengthBar;
  #strengthLabel;
  #helpEl;
  #validEl;
  #invalidEl;
  #validation;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl       = root.querySelector('[part="label"]');
    this.#inputEl       = root.querySelector('[part="input"]');
    this.#strengthWrap  = root.querySelector('[part="strength-wrap"]');
    this.#strengthBar   = root.querySelector('[part="strength-bar-inner"]');
    this.#strengthLabel = root.querySelector('[part="strength-label"]');
    this.#helpEl        = root.querySelector('[part="help"]');
    this.#validEl       = root.querySelector('[part="valid-feedback"]');
    this.#invalidEl     = root.querySelector('[part="invalid-feedback"]');
    this.#validation = new FieldValidationController(this, {
      getControls:       () => [this.#inputEl],
      getPrimaryControl: () => this.#inputEl,
      getHelpEl:         () => this.#helpEl,
      getValidEl:        () => this.#validEl,
      getInvalidEl:      () => this.#invalidEl,
      getInvalidMessage: () => defaultInvalidMessage(this.#inputEl, this.#label.peek() || this.#key.peek()),
    });
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')              this.#key.value             = next ?? '';
    if (attr === 'label')            this.#label.value           = next ?? '';
    if (attr === 'placeholder')      this.#placeholder.value     = next ?? '';
    if (attr === 'required')         this.#required.value        = boolAttr(next);
    if (attr === 'strength-meter')   this.#strengthMeter.value   = boolAttr(next);
    if (attr === 'help')             this.#help.value            = next ?? '';
    if (attr === 'size')             this.#size.value            = normalizeSize(next ?? '');
    if (attr === 'valid-feedback')   this.#validFeedback.value   = next ?? '';
    if (attr === 'invalid-feedback') this.#invalidFeedback.value = next ?? '';
  }

  connectedCallback() {
    this.setAttribute('data-af-validatable', '');
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#placeholder, this.#required, this.#strengthMeter,
      this.#help, this.#size, this.#validFeedback, this.#invalidFeedback,
    ]);

    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, placeholder, required, strengthMeter, help, size, validFeedback, invalidFeedback]) => {
      const fieldId = safeFieldId('af-password', key || 'field');
      if (size) this.setAttribute('size', size);
      else      this.removeAttribute('size');

      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', fieldId);
      this.#inputEl.id          = fieldId;
      this.#inputEl.name        = key;
      this.#inputEl.placeholder = placeholder || 'Enter password';

      this.#helpEl.id    = `${fieldId}-help`;
      this.#validEl.id   = `${fieldId}-valid`;
      this.#invalidEl.id = `${fieldId}-invalid`;

      this.#strengthWrap.hidden = !strengthMeter;

      setBooleanAttribute(this.#inputEl, 'required', required);

      this.#validation.configure({ helpText: help, validFeedback, invalidFeedback });
      this.#bindInventory();
      this.#updateStrength(this.#inputEl.value);
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
  checkValidity() { return this.#validation.checkValidity(); }
  reportValidity() { return this.#validation.reportValidity({ focus: true }); }

  #bindInventory() {
    const key     = this.#key.peek();
    const showBar = this.#strengthMeter.peek();
    const inv     = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;

    inv.add(globalThis.Inventory.subscribe(key, (value) => {
      const next = String(value ?? '');
      if (this.#inputEl.value !== next) this.#inputEl.value = next;
      if (showBar) this.#updateStrength(next);
      this.#validation.refresh();
    }));

    inv.add(on(this.#inputEl, 'input', () => {
      globalThis.Inventory?.set?.(key, this.#inputEl.value);
      if (showBar) this.#updateStrength(this.#inputEl.value);
      this.#validation.refresh();
    }));
  }

  #updateStrength(value = '') {
    if (this.#strengthWrap.hidden) return;

    let score = 0;
    if (value.length >= 8)           score++;
    if (/[A-Z]/.test(value))         score++;
    if (/[0-9]/.test(value))         score++;
    if (/[^A-Za-z0-9]/.test(value))  score++;

    this.#strengthBar.style.width           = `${score * 25}%`;
    this.#strengthBar.style.backgroundColor = STRENGTH_COLORS[score] ?? '';
    this.#strengthLabel.textContent         = STRENGTH_LABELS[score] ?? '';
  }
}

customElements.define('af-ask-for-password', AfAskForPassword);
export { AfAskForPassword };
