// library/input/email/library.js
import { Emitter } from 'framework';
import './af-ask-for-email.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-email');
  if (params.key)         el.setAttribute('key',         params.key);
  if (params.label)       el.setAttribute('label',       params.label);
  if (params.placeholder) el.setAttribute('placeholder', params.placeholder);
  if (params.required || params.required === undefined) el.setAttribute('required', '');
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
