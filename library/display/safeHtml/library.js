// library/display/safeHtml/library.js
// IDE-side: delegates to ctx.display.safeHtml() which uses the savant sanitizer.
// Generated pages use af-display-safe-html via the runtime display.js.
import { Emitter } from 'framework';

export function run(params, ctx) {
  const emitter = new Emitter();
  try {
    ctx.display.safeHtml(params.html);
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }
  return emitter;
}
