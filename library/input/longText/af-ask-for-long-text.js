// library/input/longText/af-ask-for-long-text.js
//
// <af-ask-for-long-text
//   key="bio"
//   label="About You"
//   placeholder="..."
//   rows="4"
//   help="Give enough detail for a teammate to continue the work."
//   size="lg"
// >
//
// Observed attributes:
//   key              — Inventory key (required)
//   label            — human-readable label (defaults to key value)
//   placeholder      — textarea placeholder text
//   rows             — number of visible rows (default: 4)
//   required         — boolean presence attribute
//   spellcheck       — "true" | "false" (default: "true")
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

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; margin-bottom: 1rem; }

    label {
      display: block;
      margin-bottom: .25rem;
      font-size: .875rem;
      font-weight: 500;
      color: var(--bs-body-color, #dee2e6);
    }

    textarea {
      display: block;
      width: 100%;
      padding: .375rem .75rem;
      font-size: 1rem;
      line-height: 1.5;
      color: var(--bs-body-color, #dee2e6);
      background-color: var(--bs-body-bg, #212529);
      border: 1px solid var(--bs-border-color, #495057);
      border-radius: .375rem;
      resize: vertical;
      box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
    }

    textarea:focus {
      outline: 0;
      border-color: #86b7fe;
      box-shadow: 0 0 0 .25rem rgba(13, 110, 253, .25);
    }

    textarea.is-valid {
      border-color: var(--bs-form-valid-border-color, var(--bs-success, #198754));
    }

    textarea.is-valid:focus {
      border-color: var(--bs-form-valid-border-color, var(--bs-success, #198754));
      box-shadow: 0 0 0 .25rem rgba(25, 135, 84, .2);
    }

    textarea.is-invalid {
      border-color: var(--bs-form-invalid-border-color, var(--bs-danger, #dc3545));
    }

    textarea.is-invalid:focus {
      border-color: var(--bs-form-invalid-border-color, var(--bs-danger, #dc3545));
      box-shadow: 0 0 0 .25rem rgba(220, 53, 69, .2);
    }

    :host([size="sm"]) textarea {
      padding: .25rem .5rem;
      font-size: .875rem;
      border-radius: .25rem;
    }

    :host([size="lg"]) textarea {
      padding: .5rem 1rem;
      font-size: 1.25rem;
      border-radius: .5rem;
    }

    .form-text {
      display: block;
      margin-top: .25rem;
      font-size: .875em;
      color: var(--bs-secondary-color, #6c757d);
    }

    .valid-feedback,
    .invalid-feedback {
      display: none;
      width: 100%;
      margin-top: .25rem;
      font-size: .875em;
    }

    .valid-feedback {
      color: var(--bs-form-valid-color, var(--bs-success, #198754));
    }

    .invalid-feedback {
      color: var(--bs-form-invalid-color, var(--bs-danger, #dc3545));
    }

    .valid-feedback[data-visible="true"],
    .invalid-feedback[data-visible="true"] {
      display: block;
    }
  </style>

  <label part="label"></label>
  <textarea part="textarea"></textarea>
  <div part="help" class="form-text" hidden></div>
  <div part="valid-feedback" class="valid-feedback" hidden></div>
  <div part="invalid-feedback" class="invalid-feedback" hidden></div>
`;

class AfAskForLongText extends HTMLElement {
  static observedAttributes = [
    'key',
    'label',
    'placeholder',
    'rows',
    'required',
    'spellcheck',
    'help',
    'size',
    'valid-feedback',
    'invalid-feedback',
  ];

  #key             = new Signal('');
  #label           = new Signal('');
  #placeholder     = new Signal('');
  #rows            = new Signal('4');
  #required        = new Signal(false);
  #spellcheck      = new Signal(true);
  #help            = new Signal('');
  #size            = new Signal('');
  #validFeedback   = new Signal('');
  #invalidFeedback = new Signal('');
  #scope           = new Scope();

  #labelEl;
  #textareaEl;
  #helpEl;
  #validEl;
  #invalidEl;
  #validation;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl    = root.querySelector('[part="label"]');
    this.#textareaEl = root.querySelector('[part="textarea"]');
    this.#helpEl     = root.querySelector('[part="help"]');
    this.#validEl    = root.querySelector('[part="valid-feedback"]');
    this.#invalidEl  = root.querySelector('[part="invalid-feedback"]');
    this.#validation = new FieldValidationController(this, {
      getControls:       () => [this.#textareaEl],
      getPrimaryControl: () => this.#textareaEl,
      getHelpEl:         () => this.#helpEl,
      getValidEl:        () => this.#validEl,
      getInvalidEl:      () => this.#invalidEl,
      getInvalidMessage: () => defaultInvalidMessage(this.#textareaEl, this.#label.peek() || this.#key.peek()),
    });
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')              this.#key.value             = next ?? '';
    if (attr === 'label')            this.#label.value           = next ?? '';
    if (attr === 'placeholder')      this.#placeholder.value     = next ?? '';
    if (attr === 'rows')             this.#rows.value            = next ?? '4';
    if (attr === 'required')         this.#required.value        = boolAttr(next);
    if (attr === 'spellcheck')       this.#spellcheck.value      = next !== 'false';
    if (attr === 'help')             this.#help.value            = next ?? '';
    if (attr === 'size')             this.#size.value            = normalizeSize(next ?? '');
    if (attr === 'valid-feedback')   this.#validFeedback.value   = next ?? '';
    if (attr === 'invalid-feedback') this.#invalidFeedback.value = next ?? '';
  }

  connectedCallback() {
    this.setAttribute('data-af-validatable', '');

    const combined = Signal.combineLatest([
      this.#key,
      this.#label,
      this.#placeholder,
      this.#rows,
      this.#required,
      this.#spellcheck,
      this.#help,
      this.#size,
      this.#validFeedback,
      this.#invalidFeedback,
    ]);

    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([
      key,
      label,
      placeholder,
      rows,
      required,
      spellcheck,
      help,
      size,
      validFeedback,
      invalidFeedback,
    ]) => {
      const fieldId = safeFieldId('af-long-text', key || 'field');

      if (size) this.setAttribute('size', size);
      else      this.removeAttribute('size');

      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', fieldId);

      this.#textareaEl.id          = fieldId;
      this.#textareaEl.name        = key;
      this.#textareaEl.placeholder = placeholder;
      this.#textareaEl.rows        = Number(rows) || 4;
      this.#textareaEl.spellcheck  = spellcheck;

      this.#helpEl.id    = `${fieldId}-help`;
      this.#validEl.id   = `${fieldId}-valid`;
      this.#invalidEl.id = `${fieldId}-invalid`;

      setBooleanAttribute(this.#textareaEl, 'required', required);

      this.#validation.configure({
        helpText:        help,
        validFeedback,
        invalidFeedback,
      });

      this.#bindInventory();
    }));
  }

  disconnectedCallback() {
    this.#scope.dispose();
  }

  checkValidity() {
    return this.#validation.checkValidity();
  }

  reportValidity() {
    return this.#validation.reportValidity({ focus: true });
  }

  #bindInventory() {
    const key = this.#key.peek();
    const inv = this.#scope.scope('inv');
    inv.dispose();

    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;

    inv.add(globalThis.Inventory.subscribe(key, (value) => {
      const next = String(value ?? '');
      if (this.#textareaEl.value !== next) this.#textareaEl.value = next;
      this.#validation.refresh();
    }));

    inv.add(on(this.#textareaEl, 'input', () => {
      globalThis.Inventory?.set?.(key, this.#textareaEl.value);
      this.#validation.refresh();
    }));
  }
}

customElements.define('af-ask-for-long-text', AfAskForLongText);
export { AfAskForLongText };
