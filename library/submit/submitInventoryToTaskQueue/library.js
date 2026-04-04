// library/submit/submitInventoryToTaskQueue/library.js
//
// IDE-side action runner. Creates <af-submit-inventory-to-task-queue> and
// emits it for Savant to render.
import { Emitter } from 'framework';
import './af-submit-inventory-to-task-queue.js';

export function run(params, ctx) {
  const emitter = new Emitter();

  const el = document.createElement('af-submit-inventory-to-task-queue');
  if (params.url)         el.setAttribute('url',          params.url);
  if (params.jobType)     el.setAttribute('job-type',     params.jobType);
  if (params.key)         el.setAttribute('key',          params.key);
  if (params.omit)        el.setAttribute('omit',         params.omit);
  if (params.manualRetry) el.setAttribute('manual-retry', 'true');
  if (params.manualAbort) el.setAttribute('manual-abort', 'true');
  if (params.keepJobUrl)  el.setAttribute('keep-job-url', 'true');
  if (params.preview)     el.setAttribute('preview',      'true');

  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
