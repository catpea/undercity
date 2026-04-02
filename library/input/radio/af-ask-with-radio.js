// library/input/radio/af-ask-with-radio.js
//
// <af-ask-with-radio key="plan" label="Choose a plan" options="Starter,Pro,Enterprise">
//
// Observed attributes:
//   key      — Inventory key (required)
//   label    — fieldset legend (defaults to key)
//   options  — comma-separated list of choices e.g. "Yes,No,Maybe"
//   required — boolean presence attribute
//
// Stores the selected string in Inventory. Shadow DOM, Signal model.
// Re-renders radio buttons when options attribute changes.

import { Signal, on } from 'framework';
import { Scope }      from 'scope';

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
      margin-bottom: .25rem;
    }
    input[type="radio"] {
      width: 1.1em;
      height: 1.1em;
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
    .error { display: none; margin-top: .25rem; font-size: .875em; color: var(--bs-danger, #dc3545); }
  </style>
  <fieldset>
    <legend part="legend"></legend>
    <div part="options"></div>
  </fieldset>
  <div part="error" class="error"></div>
`;

class AfAskWithRadio extends HTMLElement {
  static observedAttributes = ['key', 'label', 'options', 'required'];

  #key      = new Signal('');
  #label    = new Signal('');
  #options  = new Signal([]);
  #required = new Signal(false);
  #scope    = new Scope();

  #legendEl;
  #optionsEl;

  constructor() {
    super();
    const root      = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#legendEl  = root.querySelector('[part="legend"]');
    this.#optionsEl = root.querySelector('[part="options"]');
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    if (attr === 'key')      this.#key.value      = next ?? '';
    if (attr === 'label')    this.#label.value    = next ?? '';
    if (attr === 'required') this.#required.value = next !== null;
    if (attr === 'options') {
      this.#options.value = (next ?? '').split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  connectedCallback() {
    const combined = Signal.combineLatest([this.#key, this.#label, this.#options, this.#required]);
    this.#scope.add(combined);
    this.#scope.add(combined.subscribe(([key, label, opts, required]) => {
      this.#legendEl.textContent = label || key;
      this.#buildOptions(key, opts, required);
      this.#bindInventory();
    }));
  }

  disconnectedCallback() { this.#scope.dispose(); }

  #buildOptions(key, opts, required) {
    const radios = this.#scope.scope('radios');
    radios.dispose();
    this.#optionsEl.innerHTML = '';

    opts.forEach((opt, i) => {
      const id  = `af-radio-${key || 'field'}-${i}`;
      const row = document.createElement('div');
      row.className = 'option';

      const input = document.createElement('input');
      input.type  = 'radio';
      input.id    = id;
      input.name  = key;
      input.value = opt;
      if (required) input.setAttribute('required', '');

      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.textContent = opt;

      row.append(input, label);
      this.#optionsEl.appendChild(row);

      radios.add(on(input, 'change', () => {
        if (input.checked) globalThis.Inventory?.set(key, opt);
      }));
    });
  }

  #bindInventory() {
    const key = this.#key.peek();
    const inv = this.#scope.scope('inv');
    inv.dispose();
    if (!key || typeof globalThis.Inventory?.subscribe !== 'function') return;
    inv.add(globalThis.Inventory.subscribe(key, v => {
      const inputs = [...this.#optionsEl.querySelectorAll('input[type="radio"]')];
      inputs.forEach(r => { r.checked = r.value === String(v ?? ''); });
    }));
  }
}

customElements.define('af-ask-with-radio', AfAskWithRadio);
export { AfAskWithRadio };
