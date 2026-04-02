// library/input/radio/library.js
import { Emitter } from 'framework';
import './af-ask-with-radio.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-with-radio');
  if (params.key)      el.setAttribute('key',      params.key);
  if (params.label)    el.setAttribute('label',    params.label);
  if (params.required) el.setAttribute('required', '');
  const opts = Array.isArray(params.options)
    ? params.options.join(',')
    : String(params.options ?? '');
  if (opts) el.setAttribute('options', opts);
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
