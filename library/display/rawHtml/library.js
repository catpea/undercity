// library/display/rawHtml/library.js
import { Emitter } from 'framework';
import './af-display-raw-html.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-display-raw-html');
  el.setAttribute('html', String(params.html ?? ''));
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
