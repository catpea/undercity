// library/input/month/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-month';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const label       = document.createElement('label');
      label.textContent = params.label ?? '';

      const input    = document.createElement('input');
      input.type     = 'month';
      input.name     = params.key;
      input.required = params.required ?? false;

      this.append(label, input);

      // Push: Inventory → DOM
      this.#scope.add(
        ctx.inventory.subscribe(inv => {
          const v = String(inv[params.key] ?? '');
          if (input.value !== v) input.value = v;
        })
      );

      // Push: DOM → Inventory
      this.#scope.add(
        on(input, 'input', () => {
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
