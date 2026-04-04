// library/submit/submitInventoryToTaskQueue/af-submit-inventory-to-task-queue.js
//
// <af-submit-inventory-to-task-queue>
//
// Observed attributes:
//   url      — base URL of the task-queue server (default: http://localhost:4000)
//   job-type — formId / job-type the worker uses to pick up this submission
//   omit     — comma-separated Inventory keys to exclude from submission
//   preview  — any non-null value enables the preview table
//
// Features
// ────────
//   • Server health polling — shows Online / Offline badge, disables submit when down
//   • Preview table — human-readable summary of every field being submitted
//     (file size, image dimensions, word count for long text)
//   • Deduplication — generates a stable session-scoped jobId; the server
//     rejects duplicate jobIds so clicking Submit twice is harmless
//   • Checksum verification — after uploading, fetches the stored submission
//     back and checks that every key landed correctly
//   • Live progress bar — polls GET /job/:jobId/progress while job is active
//   • Live log viewer — polls GET /job/:jobId/log so you can follow ffmpeg
//     output, errors, etc. in real time without leaving the IDE

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: monospace;
      font-size: 0.85rem;
      color: var(--sol-base0, #839496);
    }

    /* ── layout ── */
    .section { margin-bottom: 14px; }
    .section-title {
      display: inline-block;
      color: var(--sol-base1, #93a1a1);
      font-weight: bold;
      margin-bottom: 6px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 0.75rem;
    }

    /* ── badges ── */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.75rem;
      font-weight: bold;
      letter-spacing: 0.02em;
    }
    .badge-unknown  { background: var(--sol-base02, #073642); color: var(--sol-base01, #586e75); }
    .badge-checking { background: var(--sol-base02, #073642); color: var(--sol-yellow,  #b58900); }
    .badge-online   { background: var(--sol-base02, #073642); color: var(--sol-green,   #859900); }
    .badge-offline  { background: var(--sol-base02, #073642); color: var(--sol-red,     #dc322f); }
    .badge-pending  { background: var(--sol-base02, #073642); color: var(--sol-cyan,    #2aa198); }
    .badge-active   { background: var(--sol-base02, #073642); color: var(--sol-blue,    #268bd2); }
    .badge-done     { background: var(--sol-base02, #073642); color: var(--sol-green,   #859900); }
    .badge-error    { background: var(--sol-base02, #073642); color: var(--sol-red,     #dc322f); }
    .badge-dupe     { background: var(--sol-base02, #073642); color: var(--sol-violet,  #6c71c4); }
    .badge-verifying { background: var(--sol-base02, #073642); color: var(--sol-yellow, #b58900); }

    /* ── table ── */
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 4px 8px;
      background: var(--sol-base02, #073642);
      color: var(--sol-base1, #93a1a1);
      border-bottom: 2px solid var(--sol-base01, #586e75);
    }
    td {
      padding: 4px 8px;
      border-bottom: 1px solid var(--sol-base02, #073642);
      vertical-align: top;
    }
    tr:hover td { background: rgba(255,255,255,.03); }
    .col-key  { color: var(--sol-cyan,    #2aa198); white-space: nowrap; }
    .col-type { color: var(--sol-base1,   #93a1a1); white-space: nowrap; }
    .col-stat { color: var(--sol-magenta, #d33682); white-space: nowrap; }
    .col-prev { }
    .col-prev img,
    .col-prev video { max-height: 60px; max-width: 90px; border-radius: 3px; display: block; }
    .col-prev audio  { width: 140px; }

    /* ── action bar ── */
    .action-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    button {
      font-family: monospace;
      font-size: 0.85rem;
      padding: 4px 14px;
      border: 1px solid var(--sol-base01, #586e75);
      background: var(--sol-base02, #073642);
      color: var(--sol-base0, #839496);
      border-radius: 3px;
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      background: var(--sol-base01, #586e75);
      color: var(--sol-base3, #fdf6e3);
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── progress bar ── */
    .progress {
      height: 8px;
      background: var(--sol-base02, #073642);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .progress-bar {
      height: 100%;
      width: 0%;
      background: var(--sol-blue, #268bd2);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .progress-bar.done { background: var(--sol-green, #859900); }
    .progress-bar.error { background: var(--sol-red, #dc322f); }
    .progress-msg { color: var(--sol-base1, #93a1a1); font-size: 0.8rem; }

    /* ── log ── */
    .log-header { display: flex; align-items: center; gap: 8px; }
    .log-toggle {
      font-size: 0.7rem;
      padding: 1px 6px;
      cursor: pointer;
    }
    .log-body {
      background: var(--sol-base03, #002b36);
      border: 1px solid var(--sol-base02, #073642);
      border-radius: 3px;
      padding: 6px 8px;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 6px;
    }
    .log-entry { margin: 0; line-height: 1.5; }
    .log-ts    { color: var(--sol-base01, #586e75); margin-right: 6px; }
    .log-info  { color: var(--sol-base0, #839496); }
    .log-warn  { color: var(--sol-yellow, #b58900); }
    .log-error { color: var(--sol-red, #dc322f); }

    [hidden] { display: none !important; }
  </style>

  <!-- ── Health ───────────────────────────────────────────── -->
  <div class="section">
    <span class="section-title">Server</span>
    &nbsp;
    <span part="health-badge" class="badge badge-checking">checking…</span>
    &nbsp;
    <span part="server-url" style="color:var(--sol-base01,#586e75);font-size:0.75rem;"></span>
  </div>

  <!-- ── Preview ─────────────────────────────────────────── -->
  <div part="preview-section" class="section" hidden>
    <div class="section-title">Preview</div>
    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Type</th>
          <th>Stats</th>
          <th>Preview</th>
        </tr>
      </thead>
      <tbody part="preview-body"></tbody>
    </table>
  </div>

  <!-- ── Action bar ──────────────────────────────────────── -->
  <div class="section action-bar">
    <button part="submit-btn" disabled>Submit</button>
    <span part="job-status" class="badge badge-unknown" hidden></span>
    <span part="job-id-display" style="color:var(--sol-base01,#586e75);font-size:0.75rem;" hidden></span>
  </div>

  <!-- ── Progress ────────────────────────────────────────── -->
  <div part="progress-section" class="section" hidden>
    <div class="section-title">Progress</div>
    <div class="progress">
      <div part="progress-bar" class="progress-bar"></div>
    </div>
    <span part="progress-msg" class="progress-msg"></span>
  </div>

  <!-- ── Log ─────────────────────────────────────────────── -->
  <div part="log-section" class="section" hidden>
    <div class="log-header">
      <span class="section-title">Log</span>
      <button part="log-toggle" class="log-toggle">▼ show</button>
    </div>
    <div part="log-body" class="log-body" hidden></div>
  </div>
`;

// ── State machine values ──────────────────────────────────────────────────────

const S = Object.freeze({
  IDLE:      'idle',
  SUBMIT:    'submitting',
  VERIFY:    'verifying',
  PENDING:   'pending',
  ACTIVE:    'active',
  DONE:      'done',
  DUPLICATE: 'duplicate',
  ERROR:     'error',
});

// ── Component ─────────────────────────────────────────────────────────────────

class AfSubmitInventoryToTaskQueue extends HTMLElement {
  static observedAttributes = ['url', 'job-type', 'omit', 'preview'];

  // DOM refs
  #root = null;
  #healthBadge   = null;
  #serverUrl     = null;
  #previewSection = null;
  #previewBody   = null;
  #submitBtn     = null;
  #jobStatus     = null;
  #jobIdDisplay  = null;
  #progressSection = null;
  #progressBar   = null;
  #progressMsg   = null;
  #logSection    = null;
  #logToggle     = null;
  #logBody       = null;

  // Runtime state
  #invSub      = null;
  #healthTimer = null;
  #pollTimer   = null;
  #jobId       = null;   // client-generated UUID, stable for this component instance
  #submissionId = null;  // server-assigned UUID returned by POST /submit
  #state       = S.IDLE;
  #logOpen     = false;
  #seenLogCount = 0;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.appendChild(template.content.cloneNode(true));

    this.#healthBadge    = this.#root.querySelector('[part="health-badge"]');
    this.#serverUrl      = this.#root.querySelector('[part="server-url"]');
    this.#previewSection = this.#root.querySelector('[part="preview-section"]');
    this.#previewBody    = this.#root.querySelector('[part="preview-body"]');
    this.#submitBtn      = this.#root.querySelector('[part="submit-btn"]');
    this.#jobStatus      = this.#root.querySelector('[part="job-status"]');
    this.#jobIdDisplay   = this.#root.querySelector('[part="job-id-display"]');
    this.#progressSection = this.#root.querySelector('[part="progress-section"]');
    this.#progressBar    = this.#root.querySelector('[part="progress-bar"]');
    this.#progressMsg    = this.#root.querySelector('[part="progress-msg"]');
    this.#logSection     = this.#root.querySelector('[part="log-section"]');
    this.#logToggle      = this.#root.querySelector('[part="log-toggle"]');
    this.#logBody        = this.#root.querySelector('[part="log-body"]');

    // Stable jobId for this page-load instance
    this.#jobId = crypto.randomUUID();

    this.#submitBtn.addEventListener('click', () => this.#handleSubmit());
    this.#logToggle.addEventListener('click', () => this.#toggleLog());
  }

  connectedCallback() {
    this.#applyAttrs();
    this.#startHealthPolling();

    const inv = globalThis.Inventory;
    if (inv?.subscribeAll) {
      this.#invSub = inv.subscribeAll(() => {
        if (this.#attr('preview') !== null) this.#renderPreview();
      });
    }
  }

  disconnectedCallback() {
    this.#invSub?.dispose();
    this.#invSub = null;
    clearInterval(this.#healthTimer);
    clearInterval(this.#pollTimer);
    this.#healthTimer = null;
    this.#pollTimer   = null;
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    this.#applyAttrs();
  }

  // ── Attribute helpers ───────────────────────────────────────────────────────

  #attr(name) { return this.getAttribute(name); }

  #baseUrl() {
    return (this.#attr('url') || 'http://localhost:4000').replace(/\/$/, '');
  }

  #omitSet() {
    const raw = this.#attr('omit') || '';
    return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
  }

  #filteredSnapshot() {
    // Inventory.get() with no argument returns a shallow copy of all stored keys.
    // DO NOT use snapshot(), .data, or dump() — they do not exist or lose live
    // Blob/File references (dump() round-trips through JSON).
    // See: src/generator/runtime/inventory.js → get(key)
    const data = globalThis.Inventory?.get() ?? {};
    const omit = this.#omitSet();
    const result = {};
    for (const [k, v] of Object.entries(data)) {
      if (!omit.has(k)) result[k] = v;
    }
    return result;
  }

  #applyAttrs() {
    this.#serverUrl.textContent = this.#baseUrl();
    if (this.#attr('preview') !== null) {
      this.#previewSection.hidden = false;
      this.#renderPreview();
    } else {
      this.#previewSection.hidden = true;
    }
  }

  // ── Preview table ────────────────────────────────────────────────────────────

  #renderPreview() {
    const data  = this.#filteredSnapshot();
    const tbody = this.#previewBody;
    tbody.innerHTML = '';

    const keys = Object.keys(data);
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan   = 4;
      td.style.color      = 'var(--sol-base01,#586e75)';
      td.style.fontStyle  = 'italic';
      td.style.padding    = '8px';
      td.textContent = '(inventory is empty)';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    for (const key of keys) {
      tbody.appendChild(this.#buildPreviewRow(key, data[key]));
    }
  }

  #buildPreviewRow(key, val) {
    const tr = document.createElement('tr');

    const tdKey  = _cell('col-key',  key);
    const tdType = _cell('col-type', _inferType(val));
    const tdStat = _cell('col-stat', _humanStat(val));
    const tdPrev = document.createElement('td');
    tdPrev.className = 'col-prev';
    _renderPreviewInto(val, tdPrev);

    // If this entry has a cache URL, confirm size against the server async.
    this.#enrichStatFromCache(tdStat, val);

    tr.append(tdKey, tdType, tdStat, tdPrev);
    return tr;
  }

  // Fires a HEAD request to the inventory-cache server for any entry whose URL
  // already points there (i.e. the background upload in Inventory completed).
  // On success, rewrites the stat cell with the server-confirmed size + a ✓.
  #enrichStatFromCache(tdStat, val) {
    if (typeof val?.url !== 'string') return;
    if (!val.url.startsWith('http://localhost:5000/v1/')) return;

    const mime = String(val.type ?? '');
    fetch(val.url, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
      .then(res => {
        if (!res.ok) return;
        const len = Number(res.headers.get('Content-Length') ?? 0);
        if (!len) return;
        const sizeStr = _fmtBytes(len);
        const dur  = val.duration != null ? ` ${_fmtDuration(val.duration)}` : '';
        const dims = (val.width && val.height) ? ` ${val.width}×${val.height}` : '';
        if      (mime.startsWith('image/')) tdStat.textContent = `${sizeStr}${dims} ✓`;
        else if (mime.startsWith('audio/')) tdStat.textContent = `${sizeStr}${dur} ✓`;
        else if (mime.startsWith('video/')) tdStat.textContent = `${sizeStr}${dur}${dims} ✓`;
        else                                tdStat.textContent = `${sizeStr} ✓`;
      })
      .catch(() => { /* cache unavailable — leave stat as-is */ });
  }

  // ── Health polling ──────────────────────────────────────────────────────────

  #startHealthPolling() {
    this.#checkHealth();
    this.#healthTimer = setInterval(() => this.#checkHealth(), 5000);
  }

  async #checkHealth() {
    this.#setBadge(this.#healthBadge, 'checking', 'checking…');
    try {
      const res = await fetch(`${this.#baseUrl()}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const label = data.version ? `online v${data.version}` : 'online';
        this.#setBadge(this.#healthBadge, 'online', label);
        if (this.#state === S.IDLE) this.#submitBtn.disabled = false;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      this.#setBadge(this.#healthBadge, 'offline', 'offline');
      if (this.#state === S.IDLE) this.#submitBtn.disabled = true;
    }
  }

  // ── Submit flow ─────────────────────────────────────────────────────────────

  async #handleSubmit() {
    if (this.#state !== S.IDLE) return;
    this.#setState(S.SUBMIT);
    this.#submitBtn.disabled = true;

    const base    = this.#baseUrl();
    const jobType = this.#attr('job-type') || 'undercity-submission';
    const fields  = this.#filteredSnapshot();

    try {
      // ── 1. Deduplication check ────────────────────────────────────────────
      const dupRes = await fetch(`${base}/job/${this.#jobId}`);
      if (dupRes.ok) {
        const dup = await dupRes.json();
        if (dup.submission) {
          this.#submissionId = dup.submission.id;
          this.#setState(S.DUPLICATE);
          this.#showJobId();
          this.#startJobPolling();
          return;
        }
      }

      // ── 2. POST /submit ───────────────────────────────────────────────────
      const submitRes = await fetch(`${base}/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jobId: this.#jobId, formId: jobType, fields }),
      });
      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({ error: submitRes.statusText }));
        throw new Error(err.error || submitRes.statusText);
      }
      const { id: submissionId } = await submitRes.json();
      this.#submissionId = submissionId;

      // ── 3. Checksum verification ──────────────────────────────────────────
      this.#setState(S.VERIFY);
      const verifyOk = await this.#verifySubmission(base, submissionId, fields);
      if (!verifyOk) {
        throw new Error('Checksum mismatch — some fields may not have been stored correctly.');
      }

      // ── 4. Kick off job polling ───────────────────────────────────────────
      this.#setState(S.PENDING);
      this.#showJobId();
      this.#progressSection.hidden = false;
      this.#logSection.hidden = false;
      this.#appendLog('info', `Submitted as job ${this.#jobId}`);
      this.#appendLog('info', `Server submission ID: ${submissionId}`);
      this.#startJobPolling();

    } catch (err) {
      this.#setState(S.ERROR);
      this.#appendLog('error', err.message);
      this.#logSection.hidden = false;
      if (!this.#logOpen) this.#toggleLog();
    }
  }

  // ── Checksum verification ────────────────────────────────────────────────────

  async #verifySubmission(base, id, submittedFields) {
    try {
      const res = await fetch(`${base}/submission/${id}`);
      if (!res.ok) return false;
      const { submission } = await res.json();
      if (!submission?.fields) return false;

      const storedFields = submission.fields;
      for (const key of Object.keys(submittedFields)) {
        if (!(key in storedFields)) return false;

        const orig   = submittedFields[key];
        const stored = storedFields[key];

        // For file/data-URL fields, compare the data-URL length as a proxy checksum
        const origUrl   = _dataUrl(orig);
        const storedUrl = _dataUrl(stored);
        if (origUrl && storedUrl && origUrl.length !== storedUrl.length) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  // ── Job polling ──────────────────────────────────────────────────────────────

  #startJobPolling() {
    clearInterval(this.#pollTimer);
    this.#pollTimer = setInterval(() => this.#pollJob(), 2000);
    this.#pollJob();
  }

  async #pollJob() {
    const base = this.#baseUrl();
    const jobId = this.#jobId;

    try {
      // Progress
      const progRes = await fetch(`${base}/job/${jobId}/progress`);
      if (progRes.ok) {
        const prog = await progRes.json();
        this.#updateProgress(prog);
        if (prog.state === 'done') {
          this.#setState(S.DONE);
          clearInterval(this.#pollTimer);
          this.#progressBar.classList.add('done');
        } else if (prog.state === 'error') {
          this.#setState(S.ERROR);
          clearInterval(this.#pollTimer);
          this.#progressBar.classList.add('error');
        } else if (prog.state === 'active') {
          this.#setState(S.ACTIVE);
        }
      }

      // Logs (append-only, track seen count)
      const logRes = await fetch(`${base}/job/${jobId}/log`);
      if (logRes.ok) {
        const { entries = [] } = await logRes.json();
        const newEntries = entries.slice(this.#seenLogCount);
        for (const entry of newEntries) {
          this.#appendLog(entry.level || 'info', entry.message);
        }
        this.#seenLogCount = entries.length;
        if (newEntries.length > 0 && !this.#logOpen) this.#showLogHint();
      }
    } catch {
      // server may be processing — silently retry
    }
  }

  #updateProgress({ percent = 0, message = '' } = {}) {
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    this.#progressBar.style.width = `${pct}%`;
    this.#progressMsg.textContent = message || `${pct}%`;
  }

  // ── Log UI ───────────────────────────────────────────────────────────────────

  #appendLog(level, message) {
    const p = document.createElement('p');
    p.className = 'log-entry';

    const ts = document.createElement('span');
    ts.className   = 'log-ts';
    ts.textContent = new Date().toLocaleTimeString();

    const msg = document.createElement('span');
    msg.className   = `log-${level}`;
    msg.textContent = message;

    p.append(ts, msg);
    this.#logBody.appendChild(p);
    this.#logBody.scrollTop = this.#logBody.scrollHeight;
  }

  #toggleLog() {
    this.#logOpen = !this.#logOpen;
    this.#logBody.hidden  = !this.#logOpen;
    this.#logToggle.textContent = this.#logOpen ? '▲ hide' : '▼ show';
  }

  #showLogHint() {
    if (this.#logToggle.textContent.includes('new')) return;
    if (!this.#logOpen) this.#logToggle.textContent = '▼ show (new entries)';
  }

  // ── State helpers ────────────────────────────────────────────────────────────

  #setState(state) {
    this.#state = state;
    const labels = {
      [S.IDLE]:      '',
      [S.SUBMIT]:    'submitting…',
      [S.VERIFY]:    'verifying…',
      [S.PENDING]:   'pending',
      [S.ACTIVE]:    'active',
      [S.DONE]:      'done',
      [S.DUPLICATE]: 'already submitted',
      [S.ERROR]:     'error',
    };
    const badge = this.#jobStatus;
    if (state === S.IDLE) {
      badge.hidden = true;
      return;
    }
    badge.hidden = false;
    badge.textContent = labels[state] ?? state;
    badge.className   = `badge badge-${state === S.VERIFY ? 'verifying' : state}`;
  }

  #showJobId() {
    const el = this.#jobIdDisplay;
    el.hidden = false;
    el.textContent = `jobId: ${this.#jobId}`;
  }

  #setBadge(el, cls, label) {
    el.className   = `badge badge-${cls}`;
    el.textContent = label;
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function _cell(cls, text) {
  const td = document.createElement('td');
  td.className   = cls;
  td.textContent = text;
  return td;
}

function _dataUrl(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.startsWith('data:')) return val;
  if (typeof val === 'object' && typeof val.url === 'string' && val.url.startsWith('data:')) return val.url;
  return null;
}

function _inferType(val) {
  if (val === null || val === undefined) return 'null';
  if (Array.isArray(val)) return `array[${val.length}]`;
  if (typeof val === 'object') {
    const mime = String(val.type ?? '');
    if (mime.startsWith('image/')) return `image`;
    if (mime.startsWith('audio/')) return `audio`;
    if (mime.startsWith('video/')) return `video`;
    if (mime)                      return `file`;
    return 'object';
  }
  if (typeof val === 'string' && val.length > 100) return 'long text';
  return typeof val;
}

function _humanStat(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object' && !Array.isArray(val)) {
    const mime    = String(val.type ?? '');
    // val.size is the actual byte count set by input components; never use URL length.
    const size    = val.size ?? val.fileSize ?? 0;
    const sizeStr = size ? _fmtBytes(size) : '?';
    if (mime.startsWith('image/')) {
      const dims = (val.width && val.height) ? ` ${val.width}×${val.height}` : '';
      return `${sizeStr}${dims}`;
    }
    if (mime.startsWith('audio/')) {
      const dur = val.duration != null ? ` ${_fmtDuration(val.duration)}` : '';
      return `${sizeStr}${dur}`;
    }
    if (mime.startsWith('video/')) {
      const dur  = val.duration != null ? ` ${_fmtDuration(val.duration)}` : '';
      const dims = (val.width && val.height) ? ` ${val.width}×${val.height}` : '';
      return `${sizeStr}${dur}${dims}`;
    }
    if (size) return sizeStr;
    return '—';
  }
  if (typeof val === 'string') {
    if (val.length > 100) {
      const words = val.trim().split(/\s+/).filter(Boolean).length;
      return `${words} words`;
    }
    return `${val.length} chars`;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return `${val.length} items`;
  return '—';
}

function _fmtDuration(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '?:??';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function _fmtBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function _renderPreviewInto(val, container) {
  if (!val || typeof val !== 'object' || !val.url) return;

  // Blob URLs (blob:http://…) are bound to the browsing context that created
  // them. They become inaccessible after page navigation, cross-origin load,
  // or when served from sessionStorage in a different document. Always attach
  // an onerror handler so the preview degrades gracefully instead of throwing
  // a SecurityError.
  const mime = String(val.type ?? '');

  if (mime.startsWith('image/')) {
    const img = document.createElement('img');
    img.alt     = val.name ?? '';
    img.onerror = () => { img.replaceWith(_unavailableNote(val.name ?? 'image')); };
    img.src     = val.url;   // assign src AFTER onerror so the handler is in place
    container.appendChild(img);
    return;
  }

  if (mime.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.onerror  = () => { audio.replaceWith(_unavailableNote(val.name ?? 'audio')); };
    audio.src      = val.url;
    container.appendChild(audio);
    return;
  }

  if (mime.startsWith('video/')) {
    const video = document.createElement('video');
    video.controls = true;
    video.onerror  = () => { video.replaceWith(_unavailableNote(val.name ?? 'video')); };
    video.src      = val.url;
    container.appendChild(video);
    return;
  }

  const a = document.createElement('a');
  a.href        = val.url;
  a.download    = val.name ?? '';
  a.textContent = val.name ?? 'download';
  a.style.fontSize = '0.8rem';
  container.appendChild(a);
}

/** Small italic note shown when a media URL is inaccessible. */
function _unavailableNote(label) {
  const span = document.createElement('span');
  span.style.cssText = 'font-style:italic;color:var(--sol-base01,#586e75);font-size:0.75rem;';
  span.textContent   = `[${label} — url unavailable]`;
  return span;
}

// ── Registration ──────────────────────────────────────────────────────────────

customElements.define('af-submit-inventory-to-task-queue', AfSubmitInventoryToTaskQueue);
export { AfSubmitInventoryToTaskQueue };
