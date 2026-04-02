// library/input/datetimeLocal/library.js
import { Emitter } from 'framework';
import './af-ask-for-datetime.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-datetime');
  if (params.key)      el.setAttribute('key',      params.key);
  if (params.label)    el.setAttribute('label',    params.label);
  if (params.min)      el.setAttribute('min',      params.min);
  if (params.max)      el.setAttribute('max',      params.max);
  if (params.required) el.setAttribute('required', '');
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
