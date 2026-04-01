// library/input/number/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-number';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const label       = document.createElement('label');
      label.textContent = params.label ?? '';

      const input       = document.createElement('input');
      input.type        = 'number';
      input.name        = params.key;
      input.placeholder = params.placeholder ?? '';
      input.required    = params.required    ?? false;
      input.step        = params.step        ?? 1;
      if (params.min != null) input.min = params.min;
      if (params.max != null) input.max = params.max;

      this.append(label, input);

      // Push: Inventory → DOM
      this.#scope.add(
        ctx.inventory.subscribe(inv => {
          const v = inv[params.key];
          const s = v != null ? String(v) : '';
          if (input.value !== s) input.value = s;
        })
      );

      // Push: DOM → Inventory
      this.#scope.add(
        on(input, 'input', () => {
          const n = input.value === '' ? null : parseFloat(input.value);
          ctx.inventory.value = { ...ctx.inventory.value, [params.key]: n };
        })
      );
    }

    disconnectedCallback() {
      this.#scope.dispose();
    }
  });
}

export function run(params, ctx) {
  const emitter = new Emitter();
  const el      = Object.assign(document.createElement(TAG), { params, ctx });
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
