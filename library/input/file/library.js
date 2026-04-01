// library/input/file/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-file';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const label       = document.createElement('label');
      label.textContent = params.label ?? '';

      const input       = document.createElement('input');
      input.type        = 'file';
      input.name        = params.key;
      input.required    = params.required ?? false;
      input.accept      = params.accept   ?? '*/*';
      if (params.multiple) input.multiple = true;

      this.append(label, input);

      // No Inventory → DOM binding (file inputs can't be set programmatically)

      // Push: DOM → Inventory
      this.#scope.add(
        on(input, 'change', () => {
          const files = Array.from(input.files ?? []);
          const make  = f => ({ name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f) });
          ctx.inventory.value = {
            ...ctx.inventory.value,
            [params.key]: params.multiple ? files.map(make) : (files[0] ? make(files[0]) : null),
          };
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
