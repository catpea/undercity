// ── Submit ────────────────────────────────────────────────────────────────────
// Actions that submit Inventory data to external services.
// Called by runPayload() when action names begin with "submit."
import { _pwCardBody } from './page-helpers.js';

export const Submit = {

  // ── Submit Inventory To Task Queue ──────────────────────────────────────────
  // Appends <af-submit-inventory-to-task-queue> to the current card body.
  // The component handles health checks, deduplication, checksum verification,
  // progress polling, and live log streaming — all without any server-side
  // template involvement.
  submitInventoryToTaskQueue({ url, jobType, key, omit, manualRetry, manualAbort, keepJobUrl, preview } = {}) {
    const el = document.createElement('af-submit-inventory-to-task-queue');
    if (url)         el.setAttribute('url',          url);
    if (jobType)     el.setAttribute('job-type',     jobType);
    if (key)         el.setAttribute('key',          key);
    if (omit)        el.setAttribute('omit',         omit);
    if (manualRetry) el.setAttribute('manual-retry', 'true');
    if (manualAbort) el.setAttribute('manual-abort', 'true');
    if (keepJobUrl)  el.setAttribute('keep-job-url', 'true');
    if (preview)     el.setAttribute('preview',      'true');
    _pwCardBody().appendChild(el);
  },

  // ── Narrated Still ──────────────────────────────────────────────────────────
  // video-from-audio-and-jpg processor. Outputs video.mp4, cover.avif, text.md.
  narratedStill({ url, cacheUrl, videoKey, coverKey, textKey, omit, preview, manualRetry } = {}) {
    const el = document.createElement('af-narrated-still');
    if (url)         el.setAttribute('url',          url);
    if (cacheUrl)    el.setAttribute('cache-url',    cacheUrl);
    if (videoKey)    el.setAttribute('video-key',    videoKey);
    if (coverKey)    el.setAttribute('cover-key',    coverKey);
    if (textKey)     el.setAttribute('text-key',     textKey);
    if (omit)        el.setAttribute('omit',         omit);
    if (preview)     el.setAttribute('preview',      'true');
    if (manualRetry) el.setAttribute('manual-retry', 'true');
    _pwCardBody().appendChild(el);
  },

  // ── Loop Clip ───────────────────────────────────────────────────────────────
  // video-from-looping-clip-over-mp3 processor. Outputs video.mp4, cover.avif, text.md.
  loopClip({ url, cacheUrl, videoKey, coverKey, textKey, omit, preview, manualRetry } = {}) {
    const el = document.createElement('af-loop-clip');
    if (url)         el.setAttribute('url',          url);
    if (cacheUrl)    el.setAttribute('cache-url',    cacheUrl);
    if (videoKey)    el.setAttribute('video-key',    videoKey);
    if (coverKey)    el.setAttribute('cover-key',    coverKey);
    if (textKey)     el.setAttribute('text-key',     textKey);
    if (omit)        el.setAttribute('omit',         omit);
    if (preview)     el.setAttribute('preview',      'true');
    if (manualRetry) el.setAttribute('manual-retry', 'true');
    _pwCardBody().appendChild(el);
  },

  // ── Picture In Picture ──────────────────────────────────────────────────────
  // picture-in-picture processor. Outputs video.mp4, preview.avif (or .mp4), text.md.
  pictureInPicture({ url, cacheUrl, videoKey, previewKey, textKey, omit, preview, manualRetry } = {}) {
    const el = document.createElement('af-picture-in-picture');
    if (url)         el.setAttribute('url',          url);
    if (cacheUrl)    el.setAttribute('cache-url',    cacheUrl);
    if (videoKey)    el.setAttribute('video-key',    videoKey);
    if (previewKey)  el.setAttribute('preview-key',  previewKey);
    if (textKey)     el.setAttribute('text-key',     textKey);
    if (omit)        el.setAttribute('omit',         omit);
    if (preview)     el.setAttribute('preview',      'true');
    if (manualRetry) el.setAttribute('manual-retry', 'true');
    _pwCardBody().appendChild(el);
  },

};
