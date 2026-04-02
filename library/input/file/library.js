// library/input/file/library.js
import { Emitter } from 'framework';
import './af-ask-for-file.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-file');
  if (params.key)      el.setAttribute('key',      params.key);
  if (params.label)    el.setAttribute('label',    params.label);
  if (params.accept)   el.setAttribute('accept',   params.accept);
  if (params.multiple) el.setAttribute('multiple', '');
  if (params.required) el.setAttribute('required', '');
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
