// library/display/markdown/library.js
// IDE-side: delegates to ctx.display.markdown() which uses the savant renderer.
// Generated pages use af-display-markdown via the runtime display.js.
import { Emitter } from 'framework';

export function run(params, ctx) {
  const emitter = new Emitter();
  try {
    ctx.display.markdown(params.content);
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }
  return emitter;
}
