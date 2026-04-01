// library/input/checkbox/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-checkbox';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const label    = document.createElement('label');
      const input    = document.createElement('input');
      input.type     = 'checkbox';
      input.name     = params.key;
      input.required = params.required ?? false;

      const span       = document.createElement('span');
      span.textContent = params.label ?? '';

      label.append(input, span);
      this.append(label);

      // Push: Inventory → DOM
      this.#scope.add(
        ctx.inventory.subscribe(inv => {
          const v = !!inv[params.key];
          if (input.checked !== v) input.checked = v;
        })
      );

      // Push: DOM → Inventory
      this.#scope.add(
        on(input, 'change', () => {
          ctx.inventory.value = { ...ctx.inventory.value, [params.key]: input.checked };
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
