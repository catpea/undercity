// library/input/password/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-password';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const label       = document.createElement('label');
      label.textContent = params.label ?? '';

      const input       = document.createElement('input');
      input.type        = 'password';
      input.name        = params.key;
      input.placeholder = params.placeholder ?? '';
      input.required    = params.required    ?? true;

      this.append(label, input);

      let meter = null;
      if (params.strengthMeter) {
        meter = document.createElement('div');
        meter.className = 'strength-meter';
        meter.textContent = '';
        this.append(meter);
      }

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
          if (meter) {
            const len = input.value.length;
            if (len === 0)      meter.textContent = '';
            else if (len < 8)   meter.textContent = 'Weak';
            else if (len < 14)  meter.textContent = 'Fair';
            else                meter.textContent = 'Strong';
          }
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
