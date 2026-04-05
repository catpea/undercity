// library/submit/pictureInPicture/library.js
//
// IDE-side action runner. Creates <af-picture-in-picture> and emits it for Savant to render.
import { Emitter } from 'framework';
import './af-picture-in-picture.js';

export function run(params, ctx) {
  const emitter = new Emitter();

  const el = document.createElement('af-picture-in-picture');
  if (params.url)         el.setAttribute('url',          params.url);
  if (params.videoKey)    el.setAttribute('video-key',    params.videoKey);
  if (params.previewKey)  el.setAttribute('preview-key',  params.previewKey);
  if (params.textKey)     el.setAttribute('text-key',     params.textKey);
  if (params.omit)        el.setAttribute('omit',         params.omit);
  if (params.preview)     el.setAttribute('preview',      'true');
  if (params.manualRetry) el.setAttribute('manual-retry', 'true');

  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
