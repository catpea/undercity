// library/display/value/library.js
import { Emitter } from 'framework';
import './af-display-value.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-display-value');
  el.setAttribute('key', String(params.key ?? ''));
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
