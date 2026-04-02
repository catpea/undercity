// library/input/checkbox/library.js
import { Emitter } from 'framework';
import './af-ask-with-checkbox.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-with-checkbox');
  if (params.key)      el.setAttribute('key',      params.key);
  if (params.label)    el.setAttribute('label',    params.label);
  if (params.required) el.setAttribute('required', '');
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
