// library/input/image/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-image';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const label       = document.createElement('label');
      label.textContent = params.label ?? '';

      const input    = document.createElement('input');
      input.type     = 'file';
      input.name     = params.key;
      input.accept   = params.accept   ?? 'image/*';
      input.required = params.required ?? false;

      const preview = document.createElement('img');
      preview.className    = 'image-preview';
      preview.style.display = 'none';

      this.append(label, input, preview);

      // No Inventory → DOM binding for file inputs

      // Push: DOM → Inventory
      this.#scope.add(
        on(input, 'change', () => {
          const file = input.files && input.files[0];
          if (!file) return;
          const url = URL.createObjectURL(file);
          preview.src          = url;
          preview.style.display = '';
          ctx.inventory.value = {
            ...ctx.inventory.value,
            [params.key]: { name: file.name, size: file.size, type: file.type, url },
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
