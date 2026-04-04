// library/input/audio/af-ask-for-audio.js
//
// <af-ask-for-audio key="audioTrack" label="Audio Track">
//
// Observed attributes:
//   key              — Inventory key (required)
//   label            — human-readable label (defaults to key value)
//   accept           — MIME filter (default: "audio/*")
//   required         — boolean presence attribute
//   help             — Bootstrap-style .form-text helper copy
//   size             — "" | "sm" | "lg"
//   valid-feedback   — optional success message
//   invalid-feedback — optional error message
//
// Inventory entry written on file selection:
//   { name, size, type, url, duration }
//   url      — blob URL (valid in this browsing context only)
//   duration — audio duration in seconds (or null if not yet known)

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format seconds as m:ss (e.g. 183.4 → "3:03") */
function _fmtDuration(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '?:??';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format byte count as human-readable string */
function _fmtBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Template ──────────────────────────────────────────────────────────────────

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
    input[type="file"].is-valid   { border-color: var(--bs-form-valid-border-color,   var(--bs-success, #198754)); }
    input[type="file"].is-invalid { border-color: var(--bs-form-invalid-border-color, var(--bs-danger,  #dc3545)); }
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
    :host([size="lg"]) input[type="file"] { padding: .5rem 1rem;  font-size: 1.125rem; }

    .preview { margin-top: .5rem; }
    .preview[hidden] { display: none !important; }

    audio {
      display: block;
      width: 100%;
      border-radius: .375rem;
      accent-color: var(--bs-primary, #0d6efd);
    }

    .stats {
      display: flex;
      gap: .75rem;
      margin-top: .375rem;
      font-size: .8rem;
      color: var(--bs-secondary-color, #6c757d);
      flex-wrap: wrap;
    }
    .stats span::before { content: attr(data-icon) " "; }

    .form-text { display: block; margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .valid-feedback, .invalid-feedback { display: none; width: 100%; margin-top: .25rem; font-size: .875em; }
    .valid-feedback   { color: var(--bs-form-valid-color,   var(--bs-success, #198754)); }
    .invalid-feedback { color: var(--bs-form-invalid-color, var(--bs-danger,  #dc3545)); }
    .valid-feedback[data-visible="true"], .invalid-feedback[data-visible="true"] { display: block; }
  </style>
  <label part="label"></label>
  <input part="input" type="file" accept="audio/*">
  <div part="preview" class="preview" hidden>
    <audio part="player" controls preload="metadata"></audio>
    <div part="stats" class="stats">
      <span part="stat-duration" data-icon="♩"></span>
      <span part="stat-size"     data-icon="⬡"></span>
      <span part="stat-type"     data-icon="◈"></span>
    </div>
  </div>
  <div part="help" class="form-text" hidden></div>
  <div part="valid-feedback"   class="valid-feedback"   hidden></div>
  <div part="invalid-feedback" class="invalid-feedback" hidden></div>
`;

// ── Element ───────────────────────────────────────────────────────────────────

class AfAskForAudio extends HTMLElement {
  static observedAttributes = ['key', 'label', 'accept', 'required', 'help', 'size', 'valid-feedback', 'invalid-feedback'];

  #key             = new Signal('');
  #label           = new Signal('');
  #accept          = new Signal('audio/*');
  #required        = new Signal(false);
  #help            = new Signal('');
  #size            = new Signal('');
  #validFeedback   = new Signal('');
  #invalidFeedback = new Signal('');
  #scope           = new Scope();

  #labelEl;
  #inputEl;
  #previewEl;
  #playerEl;
  #statDuration;
  #statSize;
  #statType;
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
    this.#previewEl   = root.querySelector('[part="preview"]');
    this.#playerEl    = root.querySelector('[part="player"]');
    this.#statDuration = root.querySelector('[part="stat-duration"]');
    this.#statSize    = root.querySelector('[part="stat-size"]');
    this.#statType    = root.querySelector('[part="stat-type"]');
    this.#helpEl      = root.querySelector('[part="help"]');
    this.#validEl     = root.querySelector('[part="valid-feedback"]');
    this.#invalidEl   = root.querySelector('[part="invalid-feedback"]');
    this.#validation  = new FieldValidationController(this, {
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
    if (attr === 'accept')           this.#accept.value          = next ?? 'audio/*';
    if (attr === 'required')         this.#required.value        = boolAttr(next);
    if (attr === 'help')             this.#help.value            = next ?? '';
    if (attr === 'size')             this.#size.value            = normalizeSize(next ?? '');
    if (attr === 'valid-feedback')   this.#validFeedback.value   = next ?? '';
    if (attr === 'invalid-feedback') this.#invalidFeedback.value = next ?? '';
  }

  connectedCallback() {
    this.setAttribute('data-af-validatable', '');
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#accept, this.#required,
      this.#help, this.#size, this.#validFeedback, this.#invalidFeedback,
    ]);

    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, accept, required, help, size, validFeedback, invalidFeedback]) => {
      const fieldId = safeFieldId('af-audio', key || 'field');
      if (size) this.setAttribute('size', size);
      else      this.removeAttribute('size');

      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', fieldId);
      this.#inputEl.id     = fieldId;
      this.#inputEl.name   = key;
      this.#inputEl.accept = accept;

      this.#helpEl.id    = `${fieldId}-help`;
      this.#validEl.id   = `${fieldId}-valid`;
      this.#invalidEl.id = `${fieldId}-invalid`;

      setBooleanAttribute(this.#inputEl, 'required', required);
      this.#validation.configure({ helpText: help, validFeedback, invalidFeedback });
      this.#bindChange();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }
  checkValidity()  { return this.#validation.checkValidity(); }
  reportValidity() { return this.#validation.reportValidity({ focus: true }); }

  #bindChange() {
    const key = this.#key.peek();
    const ev  = this.#scope.scope('ev');
    ev.dispose();

    ev.add(on(this.#inputEl, 'change', () => {
      const file = this.#inputEl.files?.[0] ?? null;

      if (!file) {
        this.#previewEl.hidden = true;
        this.#playerEl.src = '';
        if (key) globalThis.Inventory?.set?.(key, null);
        this.#validation.refresh();
        return;
      }

      const url = URL.createObjectURL(file);
      this.#playerEl.src        = url;
      this.#previewEl.hidden    = false;
      this.#statSize.textContent = _fmtBytes(file.size);
      this.#statType.textContent = file.type || 'audio';
      this.#statDuration.textContent = '…';

      // Write inventory immediately with what we have; update duration once known.
      const entry = { name: file.name, size: file.size, type: file.type, url, duration: null };
      if (key) globalThis.Inventory?.set?.(key, entry);

      const onMeta = () => {
        this.#playerEl.removeEventListener('loadedmetadata', onMeta);
        const dur = isFinite(this.#playerEl.duration) ? this.#playerEl.duration : null;
        this.#statDuration.textContent = dur !== null ? _fmtDuration(dur) : '?:??';
        entry.duration = dur;
        if (key) globalThis.Inventory?.set?.(key, { ...entry });
      };
      this.#playerEl.addEventListener('loadedmetadata', onMeta);

      this.#validation.refresh();
    }));
  }
}

customElements.define('af-ask-for-audio', AfAskForAudio);
export { AfAskForAudio };
