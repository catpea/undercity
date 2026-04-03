// library/input/longText/library.js
//
// IDE-side action runner for Input > Ask For Long Text.
// Creates an <af-ask-for-long-text> element and emits it for Savant to render.
import { Emitter } from 'framework';
import './af-ask-for-long-text.js';

export function run(params, ctx) {
  const emitter = new Emitter();

  const el = document.createElement('af-ask-for-long-text');
  if (params.key)         el.setAttribute('key',         params.key);
  if (params.label)       el.setAttribute('label',       params.label);
  if (params.placeholder) el.setAttribute('placeholder', params.placeholder);
  if (params.rows)        el.setAttribute('rows',        String(params.rows));
  if (params.required)    el.setAttribute('required',    '');
  if (params.spellcheck === false || params.spellcheck === 'false') {
    el.setAttribute('spellcheck', 'false');
  }
  if (params.helpText)        el.setAttribute('help',             params.helpText);
  if (params.size)            el.setAttribute('size',             params.size);
  if (params.validFeedback)   el.setAttribute('valid-feedback',   params.validFeedback);
  if (params.invalidFeedback) el.setAttribute('invalid-feedback', params.invalidFeedback);

  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
