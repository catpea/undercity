// library/submit/narratedStill/library.js
//
// IDE-side action runner. Creates <af-narrated-still> and emits it for Savant to render.
import { Emitter } from 'framework';
import './af-narrated-still.js';

export function run(params, ctx) {
  const emitter = new Emitter();

  const el = document.createElement('af-narrated-still');
  if (params.url)         el.setAttribute('url',          params.url);
  if (params.videoKey)    el.setAttribute('video-key',    params.videoKey);
  if (params.coverKey)    el.setAttribute('cover-key',    params.coverKey);
  if (params.textKey)     el.setAttribute('text-key',     params.textKey);
  if (params.omit)        el.setAttribute('omit',         params.omit);
  if (params.preview)     el.setAttribute('preview',      'true');
  if (params.manualRetry) el.setAttribute('manual-retry', 'true');

  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
