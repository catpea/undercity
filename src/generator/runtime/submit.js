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

};
