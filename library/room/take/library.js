// library/room/take/library.js
import { Emitter } from 'framework';

export function run(params, ctx) {
  const emitter = new Emitter();

  try {
    const fields = ctx.container.querySelectorAll('input, textarea, select');
    const data   = {};

    for (const field of fields) {
      if (!field.name) continue;
      if (field.type === 'checkbox') {
        data[field.name] = field.checked;
      } else if (field.type === 'radio') {
        if (field.checked) data[field.name] = field.value;
      } else {
        data[field.name] = field.value;
      }
    }

    ctx.inventory.value = { ...ctx.inventory.value, [params.into]: data };
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }

  return emitter;
}
