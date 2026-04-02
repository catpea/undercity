// library/display/text/library.js
import { Emitter } from 'framework';
import './af-display-text.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-display-text');
  el.setAttribute('content', String(params.text ?? ''));
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
