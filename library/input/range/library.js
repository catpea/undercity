// library/input/range/library.js
import { Emitter } from 'framework';
import './af-ask-for-range.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-range');
  if (params.key)   el.setAttribute('key',   params.key);
  if (params.label) el.setAttribute('label', params.label);
  if (params.min  != null) el.setAttribute('min',  params.min);
  if (params.max  != null) el.setAttribute('max',  params.max);
  if (params.step != null) el.setAttribute('step', params.step);
  if (params.showValue || params['show-value']) el.setAttribute('show-value', '');
  if (params.helpText)        el.setAttribute('help',             params.helpText);
  if (params.size)            el.setAttribute('size',             params.size);
  if (params.validFeedback)   el.setAttribute('valid-feedback',   params.validFeedback);
  if (params.invalidFeedback) el.setAttribute('invalid-feedback', params.invalidFeedback);
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
