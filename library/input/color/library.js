// library/input/color/library.js
import { Emitter } from 'framework';
import './af-ask-for-color.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-color');
  if (params.key)          el.setAttribute('key',     params.key);
  if (params.label)        el.setAttribute('label',   params.label);
  if (params.defaultColor) el.setAttribute('default', params.defaultColor);
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
