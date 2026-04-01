// library/display/clear/library.js
import { Emitter } from 'framework';

export function run(params, ctx) {
  const emitter = new Emitter();

  try {
    const el = document.querySelector(params.selector);
    if (!el) throw new Error(`display.clear: selector not found: ${params.selector}`);
    el.innerHTML = '';
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }

  return emitter;
}
