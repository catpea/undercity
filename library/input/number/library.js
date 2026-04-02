// library/input/number/library.js
import { Emitter } from 'framework';
import './af-ask-for-number.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-number');
  if (params.key)         el.setAttribute('key',         params.key);
  if (params.label)       el.setAttribute('label',       params.label);
  if (params.placeholder) el.setAttribute('placeholder', params.placeholder);
  if (params.min  != null) el.setAttribute('min',  params.min);
  if (params.max  != null) el.setAttribute('max',  params.max);
  if (params.step != null) el.setAttribute('step', params.step);
  if (params.required)    el.setAttribute('required',    '');
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
