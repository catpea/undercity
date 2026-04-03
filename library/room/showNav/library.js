// library/room/showNav/library.js
import { Emitter } from 'framework';
import './af-show-navigation-buttons.js';

export function run(params, ctx) {
  const emitter = new Emitter();

  const el = document.createElement('af-show-navigation-buttons');
  if (params.variant) el.setAttribute('variant', params.variant);
  if (params.size)    el.setAttribute('size',    params.size);
  if (params.outline) el.setAttribute('outline', '');
  if (params.full)    el.setAttribute('full',    '');
  if (params.group)   el.setAttribute('group',   '');

  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
