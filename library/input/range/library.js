// library/input/range/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-range';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const label       = document.createElement('label');
      label.textContent = params.label ?? '';

      const min  = params.min  ?? 0;
      const max  = params.max  ?? 100;
      const step = params.step ?? 1;

      const input  = document.createElement('input');
      input.type   = 'range';
      input.name   = params.key;
      input.min    = min;
      input.max    = max;
      input.step   = step;

      const span = document.createElement('span');
      span.className = 'range-value';
      span.style.display = (params.showValue ?? true) ? '' : 'none';
      span.textContent = String(min);

      const row = document.createElement('div');
      row.append(input, span);

      this.append(label, row);

      // Push: Inventory → DOM
      this.#scope.add(
        ctx.inventory.subscribe(inv => {
          const v = inv[params.key];
          const s = v != null ? String(v) : String(min);
          if (input.value !== s) {
            input.value      = s;
            span.textContent = s;
          }
        })
      );

      // Push: DOM → Inventory
      this.#scope.add(
        on(input, 'input', () => {
          const n = parseFloat(input.value);
          span.textContent = input.value;
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
