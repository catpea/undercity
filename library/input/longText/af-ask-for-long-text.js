// library/input/longText/af-ask-for-long-text.js
//
// <af-ask-for-long-text key="bio" label="About You" placeholder="..." rows="4">
//
// Observed attributes:
//   key          — Inventory key (required)
//   label        — human-readable label (defaults to key value)
//   placeholder  — textarea placeholder text
//   rows         — number of visible rows (default: 4)
//   required     — boolean, presence alone means required
//   spellcheck   — "true" | "false" (default: "true")
//
// Two-way binding via globalThis.Inventory — works in both the IDE preview
// and generated pages, because both expose the singleton at globalThis.Inventory.

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      margin-bottom: 1rem;
      font-family: var(--bs-font-sans-serif, system-ui, sans-serif);
    }

    label {
      display: block;
      margin-bottom: 0.25rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--bs-body-color, #dee2e6);
    }

    textarea {
      display: block;
      width: 100%;
      padding: 0.375rem 0.75rem;
      font-size: 1rem;
      line-height: 1.5;
      color: var(--bs-body-color, #dee2e6);
      background-color: var(--bs-body-bg, #212529);
      border: 1px solid var(--bs-border-color, #495057);
      border-radius: 0.375rem;
      resize: vertical;
      box-sizing: border-box;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }

    textarea:focus {
      outline: 0;
      border-color: #86b7fe;
      box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
    }

    .error {
      display: none;
      margin-top: 0.25rem;
      font-size: 0.875em;
      color: var(--bs-danger, #dc3545);
    }
  </style>
  <label part="label"></label>
  <textarea part="textarea"></textarea>
  <div part="error" class="error"></div>
`;

class AfAskForLongText extends HTMLElement {
  static observedAttributes = ['key', 'label', 'placeholder', 'rows', 'required', 'spellcheck'];

  #label;
  #textarea;
  #sub = null;

  constructor() {
    super();
    const root     = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#label    = root.querySelector('[part="label"]');
    this.#textarea = root.querySelector('[part="textarea"]');
  }

  // ── Attribute mirrors ───────────────────────────────────────────────────────

  get key()         { return this.getAttribute('key')         ?? ''; }
  get label()       { return this.getAttribute('label')       ?? ''; }
  get placeholder() { return this.getAttribute('placeholder') ?? ''; }
  get rows()        { return Number(this.getAttribute('rows')) || 4; }
  get required()    { return this.hasAttribute('required'); }
  get spellcheck_() { return this.getAttribute('spellcheck') !== 'false'; }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  connectedCallback() {
    this.#syncView();
    this.#bindInventory();
    this.#textarea.addEventListener('input', this.#onInput);
  }

  disconnectedCallback() {
    this.#sub?.dispose();
    this.#sub = null;
    this.#textarea.removeEventListener('input', this.#onInput);
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    this.#syncView();
    if (attr === 'key' && this.isConnected) {
      this.#sub?.dispose();
      this.#sub = null;
      this.#bindInventory();
    }
  }

  // ── View sync ───────────────────────────────────────────────────────────────

  #syncView() {
    const key = this.key;
    const id  = `af-alt-${key || 'field'}`;

    this.#label.textContent    = this.label || key;
    this.#label.setAttribute('for', id);
    this.#textarea.id          = id;
    this.#textarea.name        = key;
    this.#textarea.placeholder = this.placeholder;
    this.#textarea.rows        = this.rows;
    this.#textarea.spellcheck  = this.spellcheck_;

    if (this.required) this.#textarea.setAttribute('required', '');
    else               this.#textarea.removeAttribute('required');
  }

  // ── Inventory binding ───────────────────────────────────────────────────────

  #bindInventory() {
    const key = this.key;
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;

    this.#sub = globalThis.Inventory.subscribe(key, v => {
      const nv = String(v ?? '');
      if (this.#textarea.value !== nv) this.#textarea.value = nv;
    });
  }

  #onInput = () => {
    const key = this.key;
    if (key && typeof globalThis.Inventory?.set === 'function') {
      globalThis.Inventory.set(key, this.#textarea.value);
    }
  };
}

customElements.define('af-ask-for-long-text', AfAskForLongText);
export { AfAskForLongText };
