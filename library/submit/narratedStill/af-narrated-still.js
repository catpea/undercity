// library/submit/narratedStill/af-narrated-still.js
//
// <af-narrated-still>
//
// Purpose-built submit component for the video-from-audio-and-jpg processor.
// Handles the full job lifecycle — submit, verify, poll, store outputs —
// and optionally downloads finished output files into inventory via the
// inventory-cache server.
//
// Observed attributes:
//   url          — task-queue server URL (default http://localhost:4000)
//   cache-url    — inventory-cache server URL (default http://localhost:5000)
//   video-key    — inventory key for video.mp4; blank = don't store
//   cover-key    — inventory key for cover.avif; blank = don't store
//   text-key     — inventory key for text.md; blank = don't store
//   omit         — comma-separated inventory keys to exclude from submission
//   preview      — present = show inventory preview table
//   manual-retry — present = show Retry button on terminal states

// ── Processor identity ────────────────────────────────────────────────────────

const JOB_TYPE = 'video-from-audio-and-jpg';

// Files this processor writes and how to store them.
const OUTPUTS = [
  { attr: 'video-key', filename: 'video.mp4',  mime: 'video/mp4',     label: 'video.mp4'  },
  { attr: 'cover-key', filename: 'cover.avif', mime: 'image/avif',    label: 'cover.avif' },
  { attr: 'text-key',  filename: 'text.md',    mime: 'text/markdown', label: 'text.md'    },
];

// ── State machine ─────────────────────────────────────────────────────────────

const S = Object.freeze({
  IDLE:      'idle',
  SUBMIT:    'submitting',
  VERIFY:    'verifying',
  PENDING:   'pending',
  ACTIVE:    'active',
  STORING:   'storing',
  DONE:      'done',
  DUPLICATE: 'duplicate',
  ERROR:     'error',
});

// ── UUID helper ───────────────────────────────────────────────────────────────

function randomUUID() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Template ──────────────────────────────────────────────────────────────────

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/lib/bootstrap/css/bootstrap.min.css">
  <style>
    :host { display: block; font-family: monospace; font-size: 0.85rem; }
    .section-title { font-weight: bold; letter-spacing: .04em; text-transform: uppercase; font-size: .75rem; }
    .col-key  { color: var(--sol-cyan,    #2aa198); white-space: nowrap; }
    .col-type { color: var(--sol-base1,   #93a1a1); white-space: nowrap; }
    .col-stat { color: var(--sol-magenta, #d33682); white-space: nowrap; }
    .col-prev img, .col-prev video { max-height: 60px; max-width: 90px; border-radius: 3px; display: block; }
    .col-prev audio { width: 140px; }
    .log-body { background: var(--sol-base03,#002b36); border: 1px solid var(--sol-base02,#073642);
      border-radius: 4px; padding: 6px 8px; max-height: 200px; overflow-y: auto; margin-top: 6px; }
    .log-entry { margin: 0; line-height: 1.5; font-size: .8rem; }
    .log-ts    { color: var(--sol-base01,#586e75); margin-right: 6px; }
    .log-info  { color: var(--sol-base0, #839496); }
    .log-warn  { color: var(--sol-yellow,#b58900); }
    .log-error { color: var(--sol-red,   #dc322f); }
  </style>

  <div class="mb-3">
    <span class="section-title text-secondary me-1">Server</span>
    <span part="health-badge" class="badge bg-secondary">checking…</span>
    <small part="server-url" class="text-muted ms-1"></small>
  </div>

  <div part="preview-section" class="mb-3" hidden>
    <div class="section-title text-secondary mb-1">Preview</div>
    <table class="table table-sm table-borderless mb-0" style="font-size:.8rem;">
      <thead class="table-dark"><tr><th>Key</th><th>Type</th><th>Stats</th><th>Preview</th></tr></thead>
      <tbody part="preview-body"></tbody>
    </table>
  </div>

  <div part="settings-section" class="mb-3" hidden>
    <div class="section-title mb-1" style="color:var(--sol-red,#dc322f)">Missing Required Fields</div>
    <div part="settings-body" style="font-size:.8rem;"></div>
  </div>

  <div class="mb-3 d-flex align-items-center gap-2 flex-wrap">
    <button part="submit-btn" class="btn btn-sm btn-outline-primary" disabled>Submit</button>
    <button part="retry-btn"  class="btn btn-sm btn-outline-secondary" hidden>Retry</button>
    <span   part="job-status" class="badge" hidden></span>
  </div>

  <div part="progress-section" class="mb-3" hidden>
    <div class="section-title text-secondary mb-1">Progress</div>
    <div class="progress mb-1" style="height:8px;">
      <div part="progress-bar" class="progress-bar" style="width:0%;transition:width .3s ease;"></div>
    </div>
    <small part="progress-msg" class="text-muted"></small>
  </div>

  <div part="log-section" class="mb-3" hidden>
    <div class="d-flex align-items-center gap-2">
      <span class="section-title text-secondary">Log</span>
      <button part="log-toggle" class="btn btn-sm btn-outline-secondary py-0" type="button"
              aria-expanded="false">▼ show</button>
    </div>
    <div part="log-body" class="collapse log-body"></div>
  </div>

  <div part="stored-section" class="mb-3" hidden>
    <div class="section-title text-secondary mb-1">Stored in Inventory</div>
    <div part="stored-body" style="font-size:.8rem;"></div>
  </div>
`;

// ── Component ─────────────────────────────────────────────────────────────────

class AfNarratedStill extends HTMLElement {
  static observedAttributes = ['url', 'cache-url', 'video-key', 'cover-key', 'text-key',
                                'omit', 'preview', 'manual-retry'];

  // DOM refs
  #root; #healthBadge; #serverUrl; #previewSection; #previewBody;
  #settingsSection; #settingsBody; #submitBtn; #retryBtn; #jobStatus;
  #progressSection; #progressBar; #progressMsg;
  #logSection; #logToggle; #logBody; #storedSection; #storedBody;

  // Runtime state
  #invSub       = null;
  #healthTimer  = null;
  #pollTimer    = null;
  #jobId        = null;
  #submissionId = null;
  #state        = S.IDLE;
  #logOpen      = false;
  #seenLogCount = 0;
  #settings     = null;
  #healthOnline = false;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.appendChild(template.content.cloneNode(true));
    const $ = s => this.#root.querySelector(`[part="${s}"]`);
    this.#healthBadge     = $('health-badge');
    this.#serverUrl       = $('server-url');
    this.#previewSection  = $('preview-section');
    this.#previewBody     = $('preview-body');
    this.#settingsSection = $('settings-section');
    this.#settingsBody    = $('settings-body');
    this.#submitBtn       = $('submit-btn');
    this.#retryBtn        = $('retry-btn');
    this.#jobStatus       = $('job-status');
    this.#progressSection = $('progress-section');
    this.#progressBar     = $('progress-bar');
    this.#progressMsg     = $('progress-msg');
    this.#logSection      = $('log-section');
    this.#logToggle       = $('log-toggle');
    this.#logBody         = $('log-body');
    this.#storedSection   = $('stored-section');
    this.#storedBody      = $('stored-body');
    this.#jobId = randomUUID();
    this.#submitBtn.addEventListener('click', () => this.#handleSubmit());
    this.#retryBtn.addEventListener('click',  () => this.#handleRetry());
    this.#logToggle.addEventListener('click', () => this.#toggleLog());
  }

  connectedCallback() {
    this.#applyAttrs();
    this.#startHealthPolling();
    const inv = globalThis.Inventory;
    if (inv?.subscribeAll) {
      this.#invSub = inv.subscribeAll(() => {
        if (this.#attr('preview') !== null) this.#renderPreview();
        this.#updateValidation();
      });
    }
  }

  disconnectedCallback() {
    this.#invSub?.dispose();
    this.#invSub = null;
    clearInterval(this.#healthTimer);
    clearInterval(this.#pollTimer);
    this.#healthTimer = this.#pollTimer = null;
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    this.#applyAttrs();
    this.#settings = null;
    this.#settingsSection.hidden = true;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  #attr(name) { return this.getAttribute(name); }
  #baseUrl()  { return (this.#attr('url') || 'http://localhost:4000').replace(/\/$/, ''); }
  #cacheUrl() { return (this.#attr('cache-url') || 'http://localhost:5000').replace(/\/$/, ''); }

  #omitSet() {
    return new Set((this.#attr('omit') || '').split(',').map(s => s.trim()).filter(Boolean));
  }

  #filteredSnapshot() {
    const data = globalThis.Inventory?.get() ?? {};
    const omit = this.#omitSet();
    const out = {};
    for (const [k, v] of Object.entries(data)) { if (!omit.has(k)) out[k] = v; }
    return out;
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

  // ── Preview table ─────────────────────────────────────────────────────────────

  #renderPreview() {
    const data  = this.#filteredSnapshot();
    const tbody = this.#previewBody;
    tbody.innerHTML = '';
    const keys = Object.keys(data);
    if (!keys.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4; td.style.cssText = 'color:var(--sol-base01,#586e75);font-style:italic;padding:8px;';
      td.textContent = '(inventory is empty)';
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }
    for (const key of keys) tbody.appendChild(this.#buildPreviewRow(key, data[key]));
  }

  #buildPreviewRow(key, val) {
    const tr   = document.createElement('tr');
    const cell = (cls, txt) => { const td = document.createElement('td'); td.className = cls; td.textContent = txt; return td; };
    tr.append(cell('col-key', key), cell('col-type', _inferType(val)), cell('col-stat', _humanStat(val)));
    const tdP = document.createElement('td'); tdP.className = 'col-prev';
    _renderPreviewInto(val, tdP);
    tr.appendChild(tdP);
    return tr;
  }

  // ── Health polling ────────────────────────────────────────────────────────────

  #startHealthPolling() {
    this.#checkHealth();
    this.#healthTimer = setInterval(() => this.#checkHealth(), 5000);
  }

  async #checkHealth() {
    this.#setBadge(this.#healthBadge, 'checking', 'checking…');
    try {
      const res = await fetch(`${this.#baseUrl()}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data  = await res.json().catch(() => ({}));
      this.#setBadge(this.#healthBadge, 'online', data.version ? `online v${data.version}` : 'online');
      this.#healthOnline = true;
      if (!this.#settings) await this.#fetchSettings();
      this.#refreshSubmitBtn();
    } catch {
      this.#setBadge(this.#healthBadge, 'offline', 'offline');
      this.#healthOnline = false;
      this.#refreshSubmitBtn();
    }
  }

  // ── Settings fetch + validation ───────────────────────────────────────────────

  async #fetchSettings() {
    try {
      const res = await fetch(`${this.#baseUrl()}/task/${encodeURIComponent(JOB_TYPE)}/settings`,
        { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return;
      this.#settings = await res.json();
      this.#updateValidation();
    } catch { /* no settings file — skip validation */ }
  }

  #updateValidation() {
    if (!this.#settings?.fields) {
      this.#settingsSection.hidden = true;
      this.#refreshSubmitBtn();
      return;
    }
    const inventory = this.#filteredSnapshot();
    const missing = [];
    for (const [key, spec] of Object.entries(this.#settings.fields)) {
      if (!spec.required) continue;
      const val = inventory[key];
      if (val === undefined || val === null) { missing.push({ key, spec }); continue; }
      if (spec.type === 'file' && (typeof val !== 'object' || !val.url)) missing.push({ key, spec });
    }
    if (missing.length) {
      this.#settingsSection.hidden = false;
      this.#settingsBody.innerHTML = '';
      for (const { key, spec } of missing) {
        const p = document.createElement('p');
        p.className = 'mb-1'; p.style.color = 'var(--sol-red,#dc322f)';
        const strong = document.createElement('strong'); strong.textContent = key;
        p.append('✗ ', strong);
        if (spec.description) {
          const small = document.createElement('small');
          small.style.color = 'var(--sol-base1,#93a1a1)';
          small.textContent = ` — ${spec.description}`;
          p.appendChild(small);
        }
        this.#settingsBody.appendChild(p);
      }
    } else {
      this.#settingsSection.hidden = true;
    }
    this.#refreshSubmitBtn();
  }

  #refreshSubmitBtn() {
    if (this.#state !== S.IDLE) return;
    this.#submitBtn.disabled = !(this.#healthOnline && this.#settingsSection.hidden);
  }

  // ── Submit flow ───────────────────────────────────────────────────────────────

  async #handleSubmit() {
    if (this.#state !== S.IDLE) return;
    this.#setState(S.SUBMIT);
    this.#submitBtn.disabled = true;
    const base   = this.#baseUrl();
    const fields = this.#filteredSnapshot();
    try {
      // Deduplication check
      const dupRes = await fetch(`${base}/job/${this.#jobId}`);
      if (dupRes.ok) {
        const dup = await dupRes.json();
        if (dup.submission) {
          this.#submissionId = dup.submission.id;
          this.#setState(S.DUPLICATE);
          this.#startJobPolling();
          return;
        }
      }
      // POST /submit
      const submitRes = await fetch(`${base}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: this.#jobId, formId: JOB_TYPE, fields }),
      });
      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({ error: submitRes.statusText }));
        throw new Error(err.error || submitRes.statusText);
      }
      const { id: submissionId } = await submitRes.json();
      this.#submissionId = submissionId;
      // Checksum verify
      this.#setState(S.VERIFY);
      const ok = await this.#verifySubmission(base, submissionId, fields);
      if (!ok) throw new Error('Checksum mismatch — some fields may not have been stored correctly.');
      // Kick off polling
      this.#setState(S.PENDING);
      this.#progressSection.hidden = false;
      this.#logSection.hidden      = false;
      this.#appendLog('info', `Submitted as job ${this.#jobId}`);
      this.#appendLog('info', `Submission ID: ${submissionId}`);
      this.#startJobPolling();
    } catch (err) {
      this.#setState(S.ERROR);
      this.#appendLog('error', err.message);
      this.#logSection.hidden = false;
      if (!this.#logOpen) this.#toggleLog();
    }
  }

  async #verifySubmission(base, id, submittedFields) {
    try {
      const res = await fetch(`${base}/submission/${id}`);
      if (!res.ok) return false;
      const { submission } = await res.json();
      if (!submission?.fields) return false;
      for (const key of Object.keys(submittedFields)) {
        if (!(key in submission.fields)) return false;
        const origUrl   = _dataUrl(submittedFields[key]);
        const storedUrl = _dataUrl(submission.fields[key]);
        if (origUrl && storedUrl && origUrl.length !== storedUrl.length) return false;
      }
      return true;
    } catch { return false; }
  }

  // ── Job polling ───────────────────────────────────────────────────────────────

  #startJobPolling() {
    clearInterval(this.#pollTimer);
    this.#pollTimer = setInterval(() => this.#pollJob(), 2000);
    this.#pollJob();
  }

  async #pollJob() {
    const base = this.#baseUrl();
    try {
      const progRes = await fetch(`${base}/job/${this.#jobId}/progress`);
      if (progRes.ok) {
        const prog = await progRes.json();
        this.#updateProgress(prog);
        if (prog.state === 'done') {
          clearInterval(this.#pollTimer);
          this.#progressBar.classList.add('bg-success');
          this.#setState(S.STORING);
          await this.#storeOutputs();
          this.#setState(S.DONE);
        } else if (prog.state === 'error') {
          clearInterval(this.#pollTimer);
          this.#progressBar.classList.add('bg-danger');
          this.#setState(S.ERROR);
        } else if (prog.state === 'active') {
          this.#setState(S.ACTIVE);
        }
      }
      const logRes = await fetch(`${base}/job/${this.#jobId}/log`);
      if (logRes.ok) {
        const { entries = [] } = await logRes.json();
        for (const e of entries.slice(this.#seenLogCount)) this.#appendLog(e.level || 'info', e.message);
        this.#seenLogCount = entries.length;
        if (entries.length > this.#seenLogCount - (entries.length - this.#seenLogCount) && !this.#logOpen)
          this.#showLogHint();
      }
    } catch { /* server processing — retry on next tick */ }
  }

  // ── Output storage ────────────────────────────────────────────────────────────

  async #storeOutputs() {
    const base  = this.#baseUrl();
    const cache = this.#cacheUrl();
    const sid   = this.#submissionId;

    let anyStored = false;

    for (const out of OUTPUTS) {
      const key = (this.#attr(out.attr) || '').trim();
      if (!key) continue;

      // Fetch the output file from the task-queue server
      let blob = null;
      let chosenFilename = out.filename;
      let chosenMime     = out.mime;

      for (const candidate of [out, ...(out.fallback ? [out.fallback] : [])]) {
        try {
          const r = await fetch(`${base}/job-output/${sid}/${candidate.filename}`,
            { signal: AbortSignal.timeout(30_000) });
          if (r.ok) { blob = await r.blob(); chosenFilename = candidate.filename; chosenMime = candidate.mime; break; }
        } catch { /* try next candidate */ }
      }

      if (!blob) {
        this.#appendLog('warn', `${out.label} not found in job output — skipping inventory storage.`);
        continue;
      }

      // Upload to inventory-cache (use submissionId as stable session)
      try {
        const uploadRes = await fetch(`${cache}/v1/${sid}/${chosenFilename}`, {
          method: 'PUT',
          headers: { 'Content-Type': chosenMime, 'X-File-Name': encodeURIComponent(chosenFilename) },
          body: blob,
          signal: AbortSignal.timeout(60_000),
        });
        if (!uploadRes.ok) throw new Error(`Cache upload failed (${uploadRes.status})`);
        const entry = await uploadRes.json(); // { url, key, mime, name, size, expiresAt }
        globalThis.Inventory?.set(key, { url: entry.url, name: entry.name, type: entry.mime, size: entry.size });
        this.#appendLog('info', `${chosenFilename} → inventory["${key}"]`);
        // Show in stored-section
        const p = document.createElement('p');
        p.className = 'mb-1';
        p.style.color = 'var(--sol-green,#859900)';
        p.textContent = `✓ ${chosenFilename} → "${key}"`;
        this.#storedBody.appendChild(p);
        anyStored = true;
      } catch (err) {
        this.#appendLog('warn', `Failed to cache ${chosenFilename}: ${err.message}`);
      }
    }

    if (anyStored) this.#storedSection.hidden = false;
  }

  // ── Retry ─────────────────────────────────────────────────────────────────────

  async #handleRetry() {
    const base = this.#baseUrl();
    if (this.#submissionId) {
      try { await fetch(`${base}/clear/${this.#submissionId}`, { method: 'DELETE' }); } catch { /* ignore */ }
    }
    this.#reset();
  }

  #reset() {
    clearInterval(this.#pollTimer);
    this.#pollTimer     = null;
    this.#jobId         = randomUUID();
    this.#submissionId  = null;
    this.#seenLogCount  = 0;
    this.#logBody.innerHTML     = '';
    this.#storedBody.innerHTML  = '';
    this.#progressBar.style.width = '0%';
    this.#progressBar.classList.remove('bg-success', 'bg-danger');
    this.#progressMsg.textContent = '';
    this.#progressSection.hidden  = true;
    this.#logSection.hidden       = true;
    this.#storedSection.hidden    = true;
    this.#logOpen                 = false;
    this.#logToggle.textContent   = '▼ show';
    this.#logToggle.setAttribute('aria-expanded', 'false');
    this.#logBody.classList.remove('show');
    this.#setState(S.IDLE);
    this.#refreshSubmitBtn();
  }

  #updateProgress({ percent = 0, message = '' } = {}) {
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    this.#progressBar.style.width = `${pct}%`;
    this.#progressMsg.textContent = message || `${pct}%`;
  }

  // ── Log UI ────────────────────────────────────────────────────────────────────

  #appendLog(level, message) {
    const p  = document.createElement('p');
    p.className = 'log-entry';
    const ts = document.createElement('span'); ts.className = 'log-ts';   ts.textContent = new Date().toLocaleTimeString();
    const ms = document.createElement('span'); ms.className = `log-${level}`; ms.textContent = message;
    p.append(ts, ms);
    this.#logBody.appendChild(p);
    this.#logBody.scrollTop = this.#logBody.scrollHeight;
  }

  #toggleLog() {
    this.#logOpen = !this.#logOpen;
    this.#logBody.classList.toggle('show', this.#logOpen);
    this.#logToggle.setAttribute('aria-expanded', String(this.#logOpen));
    this.#logToggle.textContent = this.#logOpen ? '▲ hide' : '▼ show';
  }

  #showLogHint() {
    if (!this.#logOpen && !this.#logToggle.textContent.includes('new'))
      this.#logToggle.textContent = '▼ show (new)';
  }

  // ── State helpers ─────────────────────────────────────────────────────────────

  #setState(state) {
    this.#state = state;
    const labels = {
      [S.IDLE]:'', [S.SUBMIT]:'submitting…', [S.VERIFY]:'verifying…',
      [S.PENDING]:'pending', [S.ACTIVE]:'active', [S.STORING]:'storing…',
      [S.DONE]:'done', [S.DUPLICATE]:'already submitted', [S.ERROR]:'error',
    };
    const classes = {
      [S.SUBMIT]:'badge bg-info text-dark', [S.VERIFY]:'badge bg-warning text-dark',
      [S.PENDING]:'badge bg-info text-dark', [S.ACTIVE]:'badge bg-primary',
      [S.STORING]:'badge bg-warning text-dark',
      [S.DONE]:'badge bg-success', [S.DUPLICATE]:'badge bg-secondary', [S.ERROR]:'badge bg-danger',
    };
    if (state === S.IDLE) {
      this.#jobStatus.hidden = true;
    } else {
      this.#jobStatus.hidden    = false;
      this.#jobStatus.className = classes[state] ?? 'badge bg-secondary';
      this.#jobStatus.textContent = labels[state] ?? state;
    }
    const terminal = [S.DONE, S.ERROR, S.DUPLICATE].includes(state);
    this.#retryBtn.hidden = !(this.#attr('manual-retry') !== null && terminal);
  }

  #setBadge(el, cls, label) {
    const map = { checking:'badge bg-warning text-dark', online:'badge bg-success', offline:'badge bg-danger' };
    el.className = map[cls] ?? 'badge bg-secondary';
    el.textContent = label;
  }
}

// ── Pure display helpers ──────────────────────────────────────────────────────

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
    const m = String(val.type ?? '');
    if (m.startsWith('image/')) return 'image';
    if (m.startsWith('audio/')) return 'audio';
    if (m.startsWith('video/')) return 'video';
    return m ? 'file' : 'object';
  }
  if (typeof val === 'string' && val.length > 100) return 'long text';
  return typeof val;
}

function _humanStat(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object' && !Array.isArray(val)) {
    const m = String(val.type ?? '');
    const sz = val.size ?? val.fileSize ?? 0;
    const s = sz ? _fmtBytes(sz) : '?';
    if (m.startsWith('image/')) return `${s}${val.width && val.height ? ` ${val.width}×${val.height}` : ''}`;
    if (m.startsWith('audio/')) return `${s}${val.duration != null ? ` ${_fmtDur(val.duration)}` : ''}`;
    if (m.startsWith('video/')) return `${s}${val.duration != null ? ` ${_fmtDur(val.duration)}` : ''}`;
    return sz ? s : '—';
  }
  if (typeof val === 'string') return val.length > 100 ? `${val.trim().split(/\s+/).length} words` : `${val.length} chars`;
  return String(val);
}

function _fmtBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(2)} MB`;
}

function _fmtDur(s) {
  if (!isFinite(s) || s < 0) return '?:??';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

function _renderPreviewInto(val, container) {
  if (!val || typeof val !== 'object' || !val.url) return;
  const m = String(val.type ?? '');
  if (m.startsWith('image/')) {
    const img = document.createElement('img');
    img.alt = val.name ?? ''; img.onerror = () => img.remove(); img.src = val.url;
    container.appendChild(img); return;
  }
  if (m.startsWith('audio/')) {
    const a = document.createElement('audio');
    a.controls = true; a.onerror = () => a.remove(); a.src = val.url;
    container.appendChild(a); return;
  }
  if (m.startsWith('video/')) {
    const v = document.createElement('video');
    v.controls = true; v.onerror = () => v.remove(); v.src = val.url;
    container.appendChild(v); return;
  }
  const a = document.createElement('a');
  a.href = val.url; a.download = val.name ?? ''; a.textContent = val.name ?? 'download';
  a.style.fontSize = '.8rem'; container.appendChild(a);
}

// ── Registration ──────────────────────────────────────────────────────────────

customElements.define('af-narrated-still', AfNarratedStill);
export { AfNarratedStill };
