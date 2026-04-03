// library/debug/inventoryDump/af-inventory-dump.js
//
// <af-inventory-dump> — live reactive table of every Inventory key/value.
//
// No attributes — renders all keys automatically.
// Subscribes to globalThis.Inventory.subscribeAll() so every write to any key
// triggers a full re-render of the table body.
//
// Works in both the IDE preview and generated pages because both contexts
// expose the singleton via globalThis.Inventory (set in inventory.js).

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; overflow-x: auto; }

    table {
      font-family: monospace;
      font-size: 0.85rem;
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

    .inv-key    { color: var(--sol-cyan,    #2aa198); white-space: nowrap; }
    .inv-type   { color: var(--sol-base1,   #93a1a1); white-space: nowrap; }
    .inv-val    { color: var(--sol-base0,   #839496); word-break: break-all; }
    .inv-val.is-null   { color: var(--sol-base01, #586e75); font-style: italic; }
    .inv-val.is-bool   { color: var(--sol-violet,  #6c71c4); }
    .inv-val.is-number { color: var(--sol-magenta, #d33682); }
    .inv-val.is-string { color: var(--sol-green,   #859900); }
    .inv-preview img,
    .inv-preview video { max-height: 80px; max-width: 120px; border-radius: 4px; display: block; }
    .inv-preview audio  { width: 160px; }
    .inv-empty {
      color: var(--sol-base01, #586e75);
      font-style: italic;
      padding: 8px;
    }

    .sub-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
    .sub-table td { padding: 1px 6px; color: var(--sol-base1, #93a1a1); }
    .sub-key { color: var(--sol-base01, #586e75); width: 5em; }
  </style>
  <table>
    <thead>
      <tr>
        <th>Key</th>
        <th>Type</th>
        <th>Value</th>
        <th>Preview</th>
      </tr>
    </thead>
    <tbody part="body"></tbody>
  </table>
`;

class AfInventoryDump extends HTMLElement {
  #tbody;
  #sub = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
    this.#tbody = root.querySelector('[part="body"]');
  }

  connectedCallback() {
    const inv = globalThis.Inventory;
    if (!inv?.subscribeAll) {
      this.#renderEmpty('(Inventory not available)');
      return;
    }
    this.#sub = inv.subscribeAll(data => this.#render(data));
  }

  disconnectedCallback() {
    this.#sub?.dispose();
    this.#sub = null;
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  #render(data) {
    const tbody = this.#tbody;
    tbody.innerHTML = '';
    const keys = Object.keys(data);

    if (keys.length === 0) {
      this.#renderEmpty('(inventory is empty)');
      return;
    }

    for (const key of keys) {
      tbody.appendChild(this.#buildRow(key, data[key]));
    }
  }

  #renderEmpty(message) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan   = 4;
    td.className = 'inv-empty';
    td.textContent = message;
    tr.appendChild(td);
    this.#tbody.appendChild(tr);
  }

  #buildRow(key, val) {
    const tr    = document.createElement('tr');
    const tdKey = _cell('inv-key',  key);
    const tdType = _cell('inv-type', _inferType(val));
    const tdVal  = document.createElement('td');
    const tdPrev = document.createElement('td');
    tdPrev.className = 'inv-preview';

    _renderValue(val, tdVal, tdPrev);

    tr.append(tdKey, tdType, tdVal, tdPrev);
    return tr;
  }
}

// ── Pure helper functions ─────────────────────────────────────────────────────

function _cell(cls, text) {
  const td = document.createElement('td');
  td.className   = cls;
  td.textContent = text;
  return td;
}

function _inferType(val) {
  if (val === null)            return 'null';
  if (Array.isArray(val))      return `array[${val.length}]`;
  if (typeof val === 'object') {
    const mime = String(val.type ?? '');
    if (mime.startsWith('image/')) return `image (${mime})`;
    if (mime.startsWith('audio/')) return `audio (${mime})`;
    if (mime.startsWith('video/')) return `video (${mime})`;
    if (mime)                      return `file  (${mime})`;
    return 'object';
  }
  return typeof val;
}

function _renderValue(val, tdVal, tdPrev) {
  if (val == null) {
    tdVal.className   = 'inv-val is-null';
    tdVal.textContent = String(val);
    return;
  }

  if (Array.isArray(val)) {
    tdVal.className = 'inv-val';
    val.forEach((item, i) => {
      const row   = document.createElement('div');
      row.style.marginBottom = '4px';
      const label = document.createElement('span');
      label.style.color   = 'var(--sol-base01)';
      label.textContent   = `[${i}] `;
      row.appendChild(label);
      _renderScalarInto(item, row);
      tdVal.appendChild(row);
      _renderPreviewInto(item, tdPrev);
    });
    return;
  }

  if (typeof val === 'object') {
    tdVal.className = 'inv-val';
    tdVal.appendChild(_buildSubTable(val));
    _renderPreviewInto(val, tdPrev);
    return;
  }

  if (typeof val === 'boolean') {
    tdVal.className   = 'inv-val is-bool';
    tdVal.textContent = String(val);
  } else if (typeof val === 'number') {
    tdVal.className   = 'inv-val is-number';
    tdVal.textContent = String(val);
  } else {
    tdVal.className   = 'inv-val is-string';
    tdVal.textContent = String(val);
  }
}

function _renderScalarInto(val, container) {
  const span = document.createElement('span');
  span.className   = 'inv-val is-string';
  span.textContent = val == null ? 'null'
                   : typeof val === 'object' ? JSON.stringify(val)
                   : String(val);
  container.appendChild(span);
}

function _buildSubTable(obj) {
  const t = document.createElement('table');
  t.className = 'sub-table';

  for (const [k, v] of Object.entries(obj)) {
    if (k === 'url') continue; // shown separately — can be enormous
    const tr = document.createElement('tr');
    const tk = document.createElement('td');
    tk.className   = 'sub-key';
    tk.textContent = k;
    const tv = document.createElement('td');
    tv.textContent = v == null ? 'null' : String(v);
    tr.append(tk, tv);
    t.appendChild(tr);
  }

  if (obj.url) {
    const tr = document.createElement('tr');
    const tk = document.createElement('td');
    tk.className   = 'sub-key';
    tk.textContent = 'url';
    const tv = document.createElement('td');
    tv.style.color  = 'var(--sol-base01)';
    tv.textContent  = obj.url.startsWith('blob:') ? obj.url
                    : obj.url.startsWith('data:') ? `[data URL — ${Math.round(obj.url.length / 1024)} KB]`
                    : obj.url;
    tr.append(tk, tv);
    t.appendChild(tr);
  }

  return t;
}

function _renderPreviewInto(val, container) {
  if (!val || typeof val !== 'object' || !val.url) return;

  // Blob URLs (blob:http://…) are bound to the browsing context that created
  // them. They become inaccessible after page navigation, cross-origin load,
  // or when restored from sessionStorage in a different document. Always
  // attach onerror BEFORE setting src so the handler is in place when the
  // browser attempts the load. Without this you get an uncaught SecurityError.
  const mime = String(val.type ?? '');

  if (mime.startsWith('image/')) {
    const img = document.createElement('img');
    img.alt     = val.name ?? '';
    img.onerror = () => { img.replaceWith(_unavailableNote(val.name ?? 'image')); };
    img.src     = val.url;   // assign AFTER onerror
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

/** Small italic note shown when a media URL is inaccessible (stale blob, CSP, etc.). */
function _unavailableNote(label) {
  const span = document.createElement('span');
  span.style.cssText = 'font-style:italic;color:var(--sol-base01,#586e75);font-size:0.75rem;';
  span.textContent   = `[${label} — url unavailable]`;
  return span;
}

// ── Registration ──────────────────────────────────────────────────────────────

customElements.define('af-inventory-dump', AfInventoryDump);
export { AfInventoryDump };
