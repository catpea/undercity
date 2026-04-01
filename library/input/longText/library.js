// library/input/longText/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-long-text';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const label       = document.createElement('label');
      label.textContent = params.label ?? '';

      const textarea         = document.createElement('textarea');
      textarea.name          = params.key;
      textarea.placeholder   = params.placeholder ?? '';
      textarea.rows          = params.rows        ?? 4;
      textarea.required      = params.required    ?? false;
      textarea.spellcheck    = params.spellcheck  ?? true;

      this.append(label, textarea);

      // Push: Inventory → DOM
      this.#scope.add(
        ctx.inventory.subscribe(inv => {
          const v = String(inv[params.key] ?? '');
          if (textarea.value !== v) textarea.value = v;
        })
      );

      // Push: DOM → Inventory
      this.#scope.add(
        on(textarea, 'input', () => {
          ctx.inventory.value = { ...ctx.inventory.value, [params.key]: textarea.value };
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
