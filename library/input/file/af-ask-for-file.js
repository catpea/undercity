// library/input/file/af-ask-for-file.js
//
// <af-ask-for-file key="docs" label="Upload Documents" accept=".pdf,.doc" multiple>
//
// Observed attributes:
//   key              — Inventory key (required)
//   label            — human-readable label (defaults to key value)
//   accept           — MIME types / extensions filter (default: "*/*")
//   multiple         — boolean presence attribute
//   required         — boolean presence attribute
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
    label { display: block; margin-bottom: .25rem; font-size: .875rem; font-weight: 500; color: var(--bs-body-color, #dee2e6); }
    input[type="file"] {
      display: block;
      width: 100%;
      color: var(--bs-body-color, #dee2e6);
      background-color: var(--bs-body-bg, #212529);
      border: 1px solid var(--bs-border-color, #495057);
      border-radius: .375rem;
      padding: .375rem .75rem;
      box-sizing: border-box;
      cursor: pointer;
    }
    input[type="file"].is-valid { border-color: var(--bs-form-valid-border-color, var(--bs-success, #198754)); }
    input[type="file"].is-invalid { border-color: var(--bs-form-invalid-border-color, var(--bs-danger, #dc3545)); }
    input[type="file"]::file-selector-button {
      padding: .25rem .5rem;
      margin-right: .75rem;
      background: var(--bs-primary, #0d6efd);
      color: #fff;
      border: none;
      border-radius: .25rem;
      cursor: pointer;
    }
    :host([size="sm"]) input[type="file"] { padding: .25rem .5rem; font-size: .875rem; }
    :host([size="sm"]) input[type="file"]::file-selector-button { padding: .2rem .45rem; }
    :host([size="lg"]) input[type="file"] { padding: .5rem 1rem; font-size: 1.125rem; }
    :host([size="lg"]) input[type="file"]::file-selector-button { padding: .35rem .75rem; }
    .selection { display: block; margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .form-text { display: block; margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .valid-feedback, .invalid-feedback { display: none; width: 100%; margin-top: .25rem; font-size: .875em; }
    .valid-feedback { color: var(--bs-form-valid-color, var(--bs-success, #198754)); }
    .invalid-feedback { color: var(--bs-form-invalid-color, var(--bs-danger, #dc3545)); }
    .valid-feedback[data-visible="true"], .invalid-feedback[data-visible="true"] { display: block; }
  </style>
  <label part="label"></label>
  <input part="input" type="file">
  <div part="selection" class="selection" hidden></div>
  <div part="help" class="form-text" hidden></div>
  <div part="valid-feedback" class="valid-feedback" hidden></div>
  <div part="invalid-feedback" class="invalid-feedback" hidden></div>
`;

class AfAskForFile extends HTMLElement {
  static observedAttributes = ['key', 'label', 'accept', 'multiple', 'required', 'help', 'size', 'valid-feedback', 'invalid-feedback'];

  #key             = new Signal('');
  #label           = new Signal('');
  #accept          = new Signal('*/*');
  #multiple        = new Signal(false);
  #required        = new Signal(false);
  #help            = new Signal('');
  #size            = new Signal('');
  #validFeedback   = new Signal('');
  #invalidFeedback = new Signal('');
  #scope           = new Scope();

  #labelEl;
  #inputEl;
  #selectionEl;
  #helpEl;
  #validEl;
  #invalidEl;
  #validation;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl     = root.querySelector('[part="label"]');
    this.#inputEl     = root.querySelector('[part="input"]');
    this.#selectionEl = root.querySelector('[part="selection"]');
    this.#helpEl      = root.querySelector('[part="help"]');
    this.#validEl     = root.querySelector('[part="valid-feedback"]');
    this.#invalidEl   = root.querySelector('[part="invalid-feedback"]');
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
    if (attr === 'accept')           this.#accept.value          = next ?? '*/*';
    if (attr === 'multiple')         this.#multiple.value        = boolAttr(next);
    if (attr === 'required')         this.#required.value        = boolAttr(next);
    if (attr === 'help')             this.#help.value            = next ?? '';
    if (attr === 'size')             this.#size.value            = normalizeSize(next ?? '');
    if (attr === 'valid-feedback')   this.#validFeedback.value   = next ?? '';
    if (attr === 'invalid-feedback') this.#invalidFeedback.value = next ?? '';
  }

  connectedCallback() {
    this.setAttribute('data-af-validatable', '');
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#accept, this.#multiple, this.#required,
      this.#help, this.#size, this.#validFeedback, this.#invalidFeedback,
    ]);

    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, accept, multiple, required, help, size, validFeedback, invalidFeedback]) => {
      const fieldId = safeFieldId('af-file', key || 'field');
      if (size) this.setAttribute('size', size);
      else      this.removeAttribute('size');

      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', fieldId);
      this.#inputEl.id          = fieldId;
      this.#inputEl.name        = key;
      this.#inputEl.accept      = accept;
      this.#inputEl.multiple    = multiple;

      this.#helpEl.id    = `${fieldId}-help`;
      this.#validEl.id   = `${fieldId}-valid`;
      this.#invalidEl.id = `${fieldId}-invalid`;

      setBooleanAttribute(this.#inputEl, 'required', required);

      this.#validation.configure({ helpText: help, validFeedback, invalidFeedback });
      this.#bindChange();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
  checkValidity() { return this.#validation.checkValidity(); }
  reportValidity() { return this.#validation.reportValidity({ focus: true }); }

  #bindChange() {
    const key   = this.#key.peek();
    const multi = this.#multiple.peek();
    const ev    = this.#scope.scope('ev');
    ev.dispose();

    ev.add(on(this.#inputEl, 'change', () => {
      const files = Array.from(this.#inputEl.files ?? []);

      if (!files.length) {
        this.#selectionEl.hidden = true;
        this.#selectionEl.textContent = '';
        if (key) globalThis.Inventory?.set?.(key, multi ? [] : null);
        this.#validation.refresh();
        return;
      }

      const mapped = files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }));

      this.#selectionEl.hidden = false;
      this.#selectionEl.textContent = files.map((file) => file.name).join(', ');
      if (key) globalThis.Inventory?.set?.(key, multi ? mapped : mapped[0]);
      this.#validation.refresh();
    }));
  }
}

customElements.define('af-ask-for-file', AfAskForFile);
export { AfAskForFile };
