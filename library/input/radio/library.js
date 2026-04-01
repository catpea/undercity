// library/input/radio/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = 'uc-input-radio';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      const options = (params.options ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const fieldset = document.createElement('fieldset');
      const legend   = document.createElement('legend');
      legend.textContent = params.label ?? '';
      fieldset.append(legend);

      const radios = options.map(opt => {
        const lbl   = document.createElement('label');
        const radio = document.createElement('input');
        radio.type  = 'radio';
        radio.name  = params.key;
        radio.value = opt;
        if (params.required) radio.required = true;
        const txt       = document.createElement('span');
        txt.textContent = opt;
        lbl.append(radio, txt);
        fieldset.append(lbl);
        return radio;
      });

      this.append(fieldset);

      // Push: Inventory → DOM
      this.#scope.add(
        ctx.inventory.subscribe(inv => {
          const v = inv[params.key] ?? '';
          for (const radio of radios) {
            radio.checked = radio.value === v;
          }
        })
      );

      // Push: DOM → Inventory (one listener on fieldset via event delegation)
      this.#scope.add(
        on(fieldset, 'change', () => {
          const checked = radios.find(r => r.checked);
          if (checked) {
            ctx.inventory.value = { ...ctx.inventory.value, [params.key]: checked.value };
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
