// library/input/url/library.js
import { Emitter } from 'framework';
import './af-ask-for-url.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-url');
  if (params.key)         el.setAttribute('key',         params.key);
  if (params.label)       el.setAttribute('label',       params.label);
  if (params.placeholder) el.setAttribute('placeholder', params.placeholder);
  if (params.required)    el.setAttribute('required',    '');
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
