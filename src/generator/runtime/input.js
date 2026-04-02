// ── Input ─────────────────────────────────────────────────────────────────────
// 18 smart inline form inputs. Each is a standalone, self-contained component.
// Every method renders a form field directly into _pwCardBody(),
// sets data-pw-input="key" on the element, and establishes a two-way reactive
// bind between the DOM field and Inventory.
import { Inventory }                          from './inventory.js';
import { _pwCardBody, _pwRegisterBinding }    from './page-helpers.js';

const _esc  = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const _escA = s => String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export const Input = {

  // ── Ask For Text ────────────────────────────────────────────────────────────
  text(key, label = '', placeholder = '', required = false, autocomplete = '', spellcheck = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="text" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control" placeholder="${_escA(placeholder)}"
  ${req ? 'required aria-required="true"' : ''}
  ${autocomplete ? `autocomplete="${_escA(autocomplete)}"` : ''}
  spellcheck="${spellcheck ? 'true' : 'false'}"
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onInput = () => Inventory.set(key, inp.value);
    inp.addEventListener('input', onInput);
    _pwRegisterBinding(() => { inp.removeEventListener('input', onInput); sub.dispose(); });
  },

  // ── Ask For Long Text ────────────────────────────────────────────────────────
  longText(key, label = '', placeholder = '', rows = 4, required = false, spellcheck = true) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<textarea id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control" rows="${Number(rows) || 4}" placeholder="${_escA(placeholder)}"
  ${req ? 'required aria-required="true"' : ''}
  spellcheck="${spellcheck ? 'true' : 'false'}"
  aria-describedby="${id}-err"></textarea>
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('textarea');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onInput = () => Inventory.set(key, inp.value);
    inp.addEventListener('input', onInput);
    _pwRegisterBinding(() => { inp.removeEventListener('input', onInput); sub.dispose(); });
  },

  // ── Ask For Email Address ────────────────────────────────────────────────────
  email(key, label = '', placeholder = '', required = true) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="email" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control" placeholder="${_escA(placeholder || 'you@example.com')}"
  autocomplete="email" inputmode="email" spellcheck="false"
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}">Please enter a valid email address.</div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onInput = () => Inventory.set(key, inp.value);
    inp.addEventListener('input', onInput);
    _pwRegisterBinding(() => { inp.removeEventListener('input', onInput); sub.dispose(); });
  },

  // ── Ask For Password ─────────────────────────────────────────────────────────
  password(key, label = '', placeholder = '', required = true, strengthMeter = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    const showMeter = Boolean(strengthMeter) || strengthMeter === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="password" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control" placeholder="${_escA(placeholder || 'Enter password')}"
  autocomplete="current-password" spellcheck="false"
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err ${showMeter ? id + '-strength' : ''}">
${showMeter ? `<div id="${id}-strength" class="progress mt-1" style="height:4px" aria-hidden="true">
  <div class="progress-bar" role="progressbar" style="width:0%;transition:width .2s"></div>
</div>
<small id="${id}-strength-label" class="text-muted"></small>` : ''}
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onInput = () => {
      Inventory.set(key, inp.value);
      if (showMeter) {
        const v = inp.value;
        let score = 0;
        if (v.length >= 8)            score++;
        if (/[A-Z]/.test(v))         score++;
        if (/[0-9]/.test(v))         score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        const pct = score * 25;
        const colours = ['','danger','warning','info','success'];
        const labels  = ['','Weak','Fair','Good','Strong'];
        const bar = wrap.querySelector('.progress-bar');
        const lbl = wrap.querySelector('#' + id + '-strength-label');
        if (bar) { bar.style.width = pct + '%'; bar.className = 'progress-bar' + (colours[score] ? ' bg-' + colours[score] : ''); }
        if (lbl) lbl.textContent = labels[score] ?? '';
      }
    };
    inp.addEventListener('input', onInput);
    _pwRegisterBinding(() => { inp.removeEventListener('input', onInput); sub.dispose(); });
  },

  // ── Ask For Phone Number ─────────────────────────────────────────────────────
  tel(key, label = '', placeholder = '', pattern = '', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="tel" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control" placeholder="${_escA(placeholder || '+1 (555) 000-0000')}"
  autocomplete="tel" inputmode="tel" spellcheck="false"
  ${pattern ? `pattern="${_escA(pattern)}"` : ''}
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}">Please enter a valid phone number.</div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onInput = () => Inventory.set(key, inp.value);
    inp.addEventListener('input', onInput);
    _pwRegisterBinding(() => { inp.removeEventListener('input', onInput); sub.dispose(); });
  },

  // ── Ask For Web Address ───────────────────────────────────────────────────────
  url(key, label = '', placeholder = '', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="url" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control" placeholder="${_escA(placeholder || 'https://example.com')}"
  autocomplete="url" inputmode="url" spellcheck="false"
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}">Please enter a valid web address.</div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onInput = () => Inventory.set(key, inp.value);
    inp.addEventListener('input', onInput);
    _pwRegisterBinding(() => { inp.removeEventListener('input', onInput); sub.dispose(); });
  },

  // ── Ask For Number ────────────────────────────────────────────────────────────
  number(key, label = '', placeholder = '', min = null, max = null, step = 1, required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="number" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control" placeholder="${_escA(placeholder)}"
  inputmode="numeric"
  ${min != null ? `min="${Number(min)}"` : ''}
  ${max != null ? `max="${Number(max)}"` : ''}
  step="${Number(step) || 1}"
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onInput = () => Inventory.set(key, inp.value === '' ? null : Number(inp.value));
    inp.addEventListener('input', onInput);
    _pwRegisterBinding(() => { inp.removeEventListener('input', onInput); sub.dispose(); });
  },

  // ── Ask For Numeric Range ─────────────────────────────────────────────────────
  range(key, label = '', min = 0, max = 100, step = 1, showValue = true) {
    const id = `pw-in-${_escA(key)}`;
    const showV = Boolean(showValue) || showValue === 'true';
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const initVal = Number(Inventory.get(key) ?? min);
    wrap.innerHTML = `<label for="${id}" class="form-label d-flex justify-content-between">
  <span>${_esc(label || key)}</span>
  ${showV ? `<span id="${id}-val" class="badge bg-secondary">${initVal}</span>` : ''}
</label>
<input type="range" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-range"
  min="${Number(min)}" max="${Number(max)}" step="${Number(step) || 1}"
  value="${initVal}">`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const valDisplay = showV ? wrap.querySelector('#' + id + '-val') : null;
    const sub = Inventory.subscribe(key, v => {
      const nv = String(v ?? min);
      if (inp.value !== nv) { inp.value = nv; if (valDisplay) valDisplay.textContent = nv; }
    });
    const onInput = () => {
      Inventory.set(key, Number(inp.value));
      if (valDisplay) valDisplay.textContent = inp.value;
    };
    inp.addEventListener('input', onInput);
    _pwRegisterBinding(() => { inp.removeEventListener('input', onInput); sub.dispose(); });
  },

  // ── Ask For Date ─────────────────────────────────────────────────────────────
  date(key, label = '', min = '', max = '', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="date" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control"
  ${min ? `min="${_escA(min)}"` : ''}
  ${max ? `max="${_escA(max)}"` : ''}
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onChange = () => Inventory.set(key, inp.value);
    inp.addEventListener('change', onChange);
    _pwRegisterBinding(() => { inp.removeEventListener('change', onChange); sub.dispose(); });
  },

  // ── Ask For Date & Time ───────────────────────────────────────────────────────
  datetimeLocal(key, label = '', min = '', max = '', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="datetime-local" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control"
  ${min ? `min="${_escA(min)}"` : ''}
  ${max ? `max="${_escA(max)}"` : ''}
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onChange = () => Inventory.set(key, inp.value);
    inp.addEventListener('change', onChange);
    _pwRegisterBinding(() => { inp.removeEventListener('change', onChange); sub.dispose(); });
  },

  // ── Ask For Time ─────────────────────────────────────────────────────────────
  time(key, label = '', min = '', max = '', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="time" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control"
  ${min ? `min="${_escA(min)}"` : ''}
  ${max ? `max="${_escA(max)}"` : ''}
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onChange = () => Inventory.set(key, inp.value);
    inp.addEventListener('change', onChange);
    _pwRegisterBinding(() => { inp.removeEventListener('change', onChange); sub.dispose(); });
  },

  // ── Ask For Month ─────────────────────────────────────────────────────────────
  month(key, label = '', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="month" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control"
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onChange = () => Inventory.set(key, inp.value);
    inp.addEventListener('change', onChange);
    _pwRegisterBinding(() => { inp.removeEventListener('change', onChange); sub.dispose(); });
  },

  // ── Ask For Week ─────────────────────────────────────────────────────────────
  week(key, label = '', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="week" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control"
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.value = String(init);
    const sub = Inventory.subscribe(key, v => { const nv = String(v ?? ''); if (inp.value !== nv) inp.value = nv; });
    const onChange = () => Inventory.set(key, inp.value);
    inp.addEventListener('change', onChange);
    _pwRegisterBinding(() => { inp.removeEventListener('change', onChange); sub.dispose(); });
  },

  // ── Ask For Color ─────────────────────────────────────────────────────────────
  color(key, label = '', defaultColor = '#268bd2') {
    const id = `pw-in-${_escA(key)}`;
    const initVal = String(Inventory.get(key) ?? defaultColor ?? '#268bd2');
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<div class="d-flex align-items-center gap-2">
  <input type="color" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
    class="form-control form-control-color"
    value="${_escA(initVal)}" title="Pick a color">
  <code id="${id}-hex" class="text-muted small">${_esc(initVal)}</code>
</div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const hexDisplay = wrap.querySelector('#' + id + '-hex');
    const sub = Inventory.subscribe(key, v => {
      const nv = String(v ?? defaultColor ?? '#268bd2');
      if (inp.value !== nv) { inp.value = nv; hexDisplay.textContent = nv; }
    });
    const onInput = () => { Inventory.set(key, inp.value); hexDisplay.textContent = inp.value; };
    inp.addEventListener('input', onInput);
    _pwRegisterBinding(() => { inp.removeEventListener('input', onInput); sub.dispose(); });
  },

  // ── Ask With Checkbox ─────────────────────────────────────────────────────────
  checkbox(key, label = '', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3 form-check';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<input type="checkbox" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-check-input"
  ${req ? 'required' : ''}
  aria-describedby="${id}-err">
<label class="form-check-label" for="${id}">${_esc(label || key)}</label>
<div id="${id}-err" class="invalid-feedback d-block" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const init = Inventory.get(key);
    if (init != null) inp.checked = !!init;
    const sub = Inventory.subscribe(key, v => { if (inp.checked !== !!v) inp.checked = !!v; });
    const onChange = () => Inventory.set(key, inp.checked);
    inp.addEventListener('change', onChange);
    _pwRegisterBinding(() => { inp.removeEventListener('change', onChange); sub.dispose(); });
  },

  // ── Ask With Radio Buttons ────────────────────────────────────────────────────
  radio(key, label = '', options = '', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const req = Boolean(required) || required === 'true';
    const opts = (Array.isArray(options) ? options : String(options).split(','))
      .map(o => o.trim()).filter(Boolean);
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const radios = opts.map((opt, i) => {
      const rid = id + '-' + i;
      return `<div class="form-check">
  <input type="radio" id="${_escA(rid)}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
    class="form-check-input" value="${_escA(opt)}"
    ${req ? 'required' : ''}>
  <label class="form-check-label" for="${_escA(rid)}">${_esc(opt)}</label>
</div>`;
    }).join('');
    wrap.innerHTML = `<fieldset>
<legend class="form-label">${_esc(label || key)}</legend>
${radios}
<div id="${id}-err" class="invalid-feedback d-block" data-error="${_escA(key)}"></div>
</fieldset>`;
    _pwCardBody().appendChild(wrap);
    const inputs = [...wrap.querySelectorAll('input[type="radio"]')];
    const current = Inventory.get(key);
    if (current != null) inputs.forEach(r => { r.checked = r.value === String(current); });
    const sub = Inventory.subscribe(key, v => {
      inputs.forEach(r => { r.checked = r.value === String(v ?? ''); });
    });
    const onChange = () => {
      const checked = inputs.find(r => r.checked);
      if (checked) Inventory.set(key, checked.value);
    };
    inputs.forEach(r => r.addEventListener('change', onChange));
    _pwRegisterBinding(() => { inputs.forEach(r => r.removeEventListener('change', onChange)); sub.dispose(); });
  },

  // ── Ask For File ──────────────────────────────────────────────────────────────
  file(key, label = '', accept = '*/*', multiple = false, required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    const multi = Boolean(multiple) || multiple === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="file" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control"
  accept="${_escA(accept || '*/*')}"
  ${multi ? 'multiple' : ''}
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-hint" class="form-text text-muted small"></div>
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const hint = wrap.querySelector('#' + id + '-hint');
    const onChange = () => {
      const files = Array.from(inp.files ?? []);
      if (!files.length) return;
      const mapped = files.map(f => ({ name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f) }));
      const val = multi ? mapped : mapped[0];
      Inventory.set(key, val);
      hint.textContent = files.map(f => f.name).join(', ');
    };
    inp.addEventListener('change', onChange);
    _pwRegisterBinding(() => inp.removeEventListener('change', onChange));
  },

  // ── Ask For Image ──────────────────────────────────────────────────────────────
  image(key, label = '', accept = 'image/*', required = false) {
    const id = `pw-in-${_escA(key)}`;
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const req = Boolean(required) || required === 'true';
    wrap.innerHTML = `<label for="${id}" class="form-label">${_esc(label || key)}</label>
<input type="file" id="${id}" name="${_escA(key)}" data-pw-input="${_escA(key)}"
  class="form-control"
  accept="${_escA(accept || 'image/*')}"
  ${req ? 'required aria-required="true"' : ''}
  aria-describedby="${id}-err">
<div id="${id}-preview" class="mt-2 d-none">
  <img class="img-thumbnail" style="max-height:160px;max-width:100%" alt="Preview">
</div>
<div id="${id}-err" class="invalid-feedback" data-error="${_escA(key)}"></div>`;
    _pwCardBody().appendChild(wrap);
    const inp = wrap.querySelector('input');
    const previewWrap = wrap.querySelector('#' + id + '-preview');
    const previewImg  = previewWrap.querySelector('img');
    const onChange = () => {
      const file = inp.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      Inventory.set(key, { name: file.name, size: file.size, type: file.type, url });
      previewImg.src = url;
      previewWrap.classList.remove('d-none');
    };
    inp.addEventListener('change', onChange);
    _pwRegisterBinding(() => inp.removeEventListener('change', onChange));
  },

};
