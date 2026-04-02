// library/input/password/af-ask-for-password.js
//
// <af-ask-for-password key="pw" label="Password" strength-meter>
//
// Observed attributes:
//   key           — Inventory key (required)
//   label         — human-readable label (defaults to key value)
//   placeholder   — input placeholder text
//   required      — boolean presence attribute
//   strength-meter — presence triggers password strength bar + label
//
// Strength scoring: 0-4 based on length≥8, uppercase, digit, symbol.
// Colors: danger/warning/info/success. Labels: Weak/Fair/Good/Strong.
// Two-way binding via globalThis.Inventory. Shadow DOM with Bootstrap-compatible styles.

import { Signal, on } from 'framework';
import { Scope }      from 'scope';

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
    input:focus { outline: 0; border-color: #86b7fe; box-shadow: 0 0 0 .25rem rgba(13,110,253,.25); }
    .hint  { margin-top: .25rem; font-size: .875em; color: var(--bs-secondary-color, #6c757d); }
    .error { display: none; margin-top: .25rem; font-size: .875em; color: var(--bs-danger, #dc3545); }
    .strength-bar { height: 4px; background: var(--bs-border-color, #495057); border-radius: 2px; margin-top: .375rem; overflow: hidden; }
    .strength-bar-inner { height: 100%; width: 0; transition: width .2s, background-color .2s; }
    .strength-label { margin-top: .25rem; font-size: .75em; color: var(--bs-secondary-color, #6c757d); }
    .d-none { display: none !important; }
  </style>
  <label part="label"></label>
  <input part="input" type="password" autocomplete="current-password" spellcheck="false">
  <div part="strength-wrap" class="d-none">
    <div class="strength-bar"><div part="strength-bar-inner" class="strength-bar-inner"></div></div>
    <div part="strength-label" class="strength-label"></div>
  </div>
  <div part="error" class="error"></div>
`;

const STRENGTH_COLORS = ['', '#dc3545', '#ffc107', '#0dcaf0', '#198754'];
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

class AfAskForPassword extends HTMLElement {
  static observedAttributes = ['key', 'label', 'placeholder', 'required', 'strength-meter'];

  #key           = new Signal('');
  #label         = new Signal('');
  #placeholder   = new Signal('');
  #required      = new Signal(false);
  #strengthMeter = new Signal(false);
  #scope         = new Scope();

  #labelEl;
  #inputEl;
  #strengthWrap;
  #strengthBar;
  #strengthLabel;

  constructor() {
    super();
    const root          = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#labelEl        = root.querySelector('[part="label"]');
    this.#inputEl        = root.querySelector('[part="input"]');
    this.#strengthWrap   = root.querySelector('[part="strength-wrap"]');
    this.#strengthBar    = root.querySelector('[part="strength-bar-inner"]');
    this.#strengthLabel  = root.querySelector('[part="strength-label"]');
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')           this.#key.value           = next ?? '';
    if (attr === 'label')         this.#label.value         = next ?? '';
    if (attr === 'placeholder')   this.#placeholder.value   = next ?? '';
    if (attr === 'required')      this.#required.value      = next !== null;
    if (attr === 'strength-meter') this.#strengthMeter.value = next !== null;
  }

  connectedCallback() {
    const combined = Signal.combineLatest([
      this.#key, this.#label, this.#placeholder, this.#required, this.#strengthMeter,
    ]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, placeholder, required, strengthMeter]) => {
      const id = `af-pw-${key || 'field'}`;
      this.#labelEl.textContent = label || key;
      this.#labelEl.setAttribute('for', id);
      this.#inputEl.id          = id;
      this.#inputEl.name        = key;
      this.#inputEl.placeholder = placeholder || 'Enter password';
      if (required) this.#inputEl.setAttribute('required', '');
      else          this.#inputEl.removeAttribute('required');
      if (strengthMeter) this.#strengthWrap.classList.remove('d-none');
      else               this.#strengthWrap.classList.add('d-none');
      if (this.isConnected) this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }

  #bindInventory() {
    const key     = this.#key.peek();
    const showBar = this.#strengthMeter.peek();
    const inv     = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;
    inv.add(globalThis.Inventory.subscribe(key, v => {
      const nv = String(v ?? '');
      if (this.#inputEl.value !== nv) this.#inputEl.value = nv;
    }));
    inv.add(on(this.#inputEl, 'input', () => {
      globalThis.Inventory.set(key, this.#inputEl.value);
      if (showBar) this.#updateStrength(this.#inputEl.value);
    }));
  }

  #updateStrength(v) {
    let score = 0;
    if (v.length >= 8)           score++;
    if (/[A-Z]/.test(v))        score++;
    if (/[0-9]/.test(v))        score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    this.#strengthBar.style.width           = (score * 25) + '%';
    this.#strengthBar.style.backgroundColor = STRENGTH_COLORS[score] ?? '';
    this.#strengthLabel.textContent         = STRENGTH_LABELS[score] ?? '';
  }
}

customElements.define('af-ask-for-password', AfAskForPassword);
export { AfAskForPassword };
