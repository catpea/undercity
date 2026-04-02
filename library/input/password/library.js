// library/input/password/library.js
import { Emitter } from 'framework';
import './af-ask-for-password.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-password');
  if (params.key)          el.setAttribute('key',          params.key);
  if (params.label)        el.setAttribute('label',        params.label);
  if (params.placeholder)  el.setAttribute('placeholder',  params.placeholder);
  if (params.required)     el.setAttribute('required',     '');
  if (params.strengthMeter || params['strength-meter']) el.setAttribute('strength-meter', '');
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
