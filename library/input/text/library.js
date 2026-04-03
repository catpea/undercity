// library/input/text/library.js
import { Emitter } from 'framework';
import './af-ask-for-text.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-text');
  if (params.key)          el.setAttribute('key',          params.key);
  if (params.label)        el.setAttribute('label',        params.label);
  if (params.placeholder)  el.setAttribute('placeholder',  params.placeholder);
  if (params.required)     el.setAttribute('required',     '');
  if (params.autocomplete) el.setAttribute('autocomplete', params.autocomplete);
  if (params.spellcheck)   el.setAttribute('spellcheck',   'true');
  if (params.helpText)        el.setAttribute('help',             params.helpText);
  if (params.size)            el.setAttribute('size',             params.size);
  if (params.validFeedback)   el.setAttribute('valid-feedback',   params.validFeedback);
  if (params.invalidFeedback) el.setAttribute('invalid-feedback', params.invalidFeedback);
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
