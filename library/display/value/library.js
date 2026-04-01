// library/display/value/library.js
import { Emitter } from 'framework';

export function run(params, ctx) {
  const emitter = new Emitter();

  try {
    const el = document.querySelector(params.selector);
    if (!el) throw new Error(`display.value: selector not found: ${params.selector}`);

    ctx.scope.add(
      ctx.inventory.subscribe(inv => {
        el.textContent = String(inv[params.key] ?? '');
      })
    );

    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }

  return emitter;
}
