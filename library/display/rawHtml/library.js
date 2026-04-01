// library/display/rawHtml/library.js
import { Emitter } from 'framework';

export function run(params, ctx) {
  const emitter = new Emitter();

  try {
    const el = document.querySelector(params.selector);
    if (!el) throw new Error(`display.rawHtml: selector not found: ${params.selector}`);
    el.innerHTML = params.html ?? '';
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }

  return emitter;
}
