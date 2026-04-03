// library/input/color/library.js
import { Emitter } from 'framework';
import './af-ask-for-color.js';

export function run(params, ctx) {
  const emitter = new Emitter();
  const el = document.createElement('af-ask-for-color');
  if (params.key)          el.setAttribute('key',     params.key);
  if (params.label)        el.setAttribute('label',   params.label);
  if (params.default ?? params.defaultColor) el.setAttribute('default', params.default ?? params.defaultColor);
  if (params.helpText)        el.setAttribute('help',             params.helpText);
  if (params.size)            el.setAttribute('size',             params.size);
  if (params.validFeedback)   el.setAttribute('valid-feedback',   params.validFeedback);
  if (params.invalidFeedback) el.setAttribute('invalid-feedback', params.invalidFeedback);
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
