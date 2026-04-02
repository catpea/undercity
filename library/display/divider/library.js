// library/display/divider/library.js
import { Emitter } from 'framework';

export function run(_params, ctx) {
  const emitter = new Emitter();
  try {
    ctx.display.divider();
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }
  return emitter;
}
