// library/input/color/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-color';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const label       = document.createElement('label');
      label.textContent = params.label ?? '';

      const defaultColor = params.default ?? '#268bd2';

      const input = document.createElement('input');
      input.type  = 'color';
      input.name  = params.key;

      const span = document.createElement('span');
      span.className = 'color-hex';

      const row = document.createElement('div');
      row.append(input, span);

      this.append(label, row);

      // Push: Inventory → DOM
      this.#scope.add(
        ctx.inventory.subscribe(inv => {
          const v = String(inv[params.key] ?? defaultColor);
          if (input.value !== v) {
            input.value      = v;
            span.textContent = v;
          }
        })
      );

      // Push: DOM → Inventory
      this.#scope.add(
        on(input, 'input', () => {
          span.textContent = input.value;
          ctx.inventory.value = { ...ctx.inventory.value, [params.key]: input.value };
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
