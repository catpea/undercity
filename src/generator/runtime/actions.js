// ── Actions ───────────────────────────────────────────────────────────────────
// Built-in action library: DOM, Forms, HTTP, UI feedback, input prompts.
// All methods are usable from runPayload steps via namespace "Actions" or its
// aliases: actions, dom, form, ui, http.
import { Inventory }          from './inventory.js';
import { Navigator }          from './navigator.js';
import { User }               from './user.js';
import { _pwRegisterBinding } from './page-helpers.js';

export const Actions = {
  // ── DOM — show/hide/toggle ─────────────────────────────────────────────────
  show(sel)                { document.querySelectorAll(sel).forEach(el => el.classList.remove('d-none')); },
  hide(sel)                { document.querySelectorAll(sel).forEach(el => el.classList.add('d-none')); },
  toggle(sel)              { document.querySelectorAll(sel).forEach(el => el.classList.toggle('d-none')); },
  setText(sel, text)       { document.querySelectorAll(sel).forEach(el => el.textContent = text); },
  setHtml(sel, html)       { document.querySelectorAll(sel).forEach(el => el.innerHTML = html); },
  setAttr(sel, attr, val)  { document.querySelectorAll(sel).forEach(el => el.setAttribute(attr, val)); },
  addClass(sel, cls)       { document.querySelectorAll(sel).forEach(el => el.classList.add(cls)); },
  removeClass(sel, cls)    { document.querySelectorAll(sel).forEach(el => el.classList.remove(cls)); },
  toggleClass(sel, cls)    { document.querySelectorAll(sel).forEach(el => el.classList.toggle(cls)); },
  setStyle(sel, prop, val) { document.querySelectorAll(sel).forEach(el => el.style[prop] = val); },
  scroll(sel, block='start') { document.querySelector(sel)?.scrollIntoView({ behavior:'smooth', block }); },
  focus(sel)               { document.querySelector(sel)?.focus(); },

  // ── Forms — Bootstrap is-invalid / invalid-feedback pattern ───────────────
  getField(name)      { return document.querySelector(`[name="${name}"]`)?.value?.trim() ?? ''; },
  setField(name, invKey) { const el = document.querySelector(`[name="${name}"]`); if (el) el.value = String(Inventory.get(invKey) ?? ''); },
  clearField(name)    { Actions.setField(name, ''); },
  setError(name, msg) {
    const input = document.querySelector(`[name="${name}"]`);
    const errEl = document.querySelector(`[data-error="${name}"]`);
    input?.classList.add('is-invalid');
    input?.setAttribute('aria-invalid', 'true');
    if (errEl) errEl.textContent = msg;
  },
  clearErrors() {
    document.querySelectorAll('[data-error]').forEach(el => { el.textContent = ''; });
    document.querySelectorAll('.is-invalid').forEach(el => { el.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); });
  },
  serializeForm(sel) {
    const form = document.querySelector(sel);
    return form ? Object.fromEntries(new FormData(form).entries()) : {};
  },
  /** Run HTML5 + custom validation. Marks is-valid/is-invalid on each field, returns true if all pass. */
  validate(sel = 'form') {
    const form = document.querySelector(sel);
    if (!form) return true;
    let valid = true;
    form.querySelectorAll('[required],[minlength],[maxlength],[pattern],[min],[max]').forEach(el => {
      if (!el.checkValidity()) {
        el.classList.add('is-invalid');
        el.classList.remove('is-valid');
        valid = false;
      } else {
        el.classList.remove('is-invalid');
        el.classList.add('is-valid');
      }
    });
    if (!valid) {
      const first = form.querySelector('.is-invalid');
      first?.focus();
      first?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return valid;
  },
  getSelect(name)   { const el = document.querySelector(`[name="${name}"]`); return el?.value ?? ''; },
  getCheck(name)    { const el = document.querySelector(`[name="${name}"]`); return el?.checked ?? false; },
  setCheck(name, v) { const el = document.querySelector(`[name="${name}"]`); if (el) el.checked = !!v; },
  getRange(name)    { const el = document.querySelector(`[name="${name}"]`); return el ? Number(el.value) : 0; },
  bindField(fieldName, invKey) {
    const el = document.querySelector(`[name="${fieldName}"]`);
    if (!el) return;
    const disposer = Inventory.subscribe(invKey, v => {
      if (!el.ownerDocument.contains(el)) return;
      const nv = String(v ?? '');
      if (el.value !== nv) el.value = nv;
    });
    const onInput = () => Inventory.set(invKey, el.value);
    el.addEventListener('input', onInput);
    _pwRegisterBinding(() => { el.removeEventListener('input', onInput); disposer.dispose(); });
  },

  // ── HTTP ───────────────────────────────────────────────────────────────────
  async fetch(url, opts = {}) { const r = await fetch(url, opts); return r.ok ? r.json() : Promise.reject(await r.text()); },
  async get(url)               { return Actions.fetch(url); },
  async post(url, body)        { return Actions.fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); },

  // Submit: POST inventory (or a subset) to a URL.
  async submit(url, fields = null) {
    const data = fields ? Object.fromEntries(fields.map(k => [k, Inventory.get(k)])) : Inventory.dump();
    const res  = await Actions.post(url, data);
    Inventory.set('lastSubmitResponse', res);
    return res;
  },

  // ── UI feedback ────────────────────────────────────────────────────────────
  toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3 shadow-sm fade show`;
    el.style.cssText = 'z-index:9999;min-width:220px;max-width:360px';
    el.setAttribute('role', 'alert');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },
  loading(show = true) { document.getElementById('pw-loading')?.classList.toggle('d-none', !show); },

  // ── Input prompts ──────────────────────────────────────────────────────────
  askInput(label = 'Input', placeholder = '', type = 'text') {
    return new Promise(resolve => {
      const modal = document.getElementById('pw-input-modal');
      if (!modal) { resolve(null); return; }
      modal.querySelector('#pw-input-label').textContent = label;
      const inp = modal.querySelector('#pw-input-field');
      inp.type = type; inp.placeholder = placeholder; inp.value = '';
      const bsModal = bootstrap.Modal.getOrCreateInstance(modal);
      const handler = () => { const val = inp.value; resolve(val); bsModal.hide(); };
      modal.querySelector('#pw-input-confirm').onclick = handler;
      bsModal.show();
    });
  },
  askText(label = 'Input', placeholder = '', multiline = false) {
    return new Promise(resolve => {
      const modal = document.getElementById('pw-input-modal');
      if (!modal) { resolve(null); return; }
      modal.querySelector('#pw-input-label').textContent = label;
      const body = modal.querySelector('.modal-body');
      let field = modal.querySelector('#pw-input-field');
      let ta = modal.querySelector('#pw-input-textarea');
      if (multiline) {
        if (!ta) {
          ta = document.createElement('textarea');
          ta.id = 'pw-input-textarea';
          ta.className = 'form-control pw-input';
          ta.rows = 5;
          body.appendChild(ta);
        }
        field.style.display = 'none';
        ta.style.display = '';
        ta.placeholder = placeholder; ta.value = '';
        field = ta;
      } else {
        if (ta) ta.style.display = 'none';
        field.style.display = '';
        field.type = 'text'; field.placeholder = placeholder; field.value = '';
      }
      const bsModal = bootstrap.Modal.getOrCreateInstance(modal);
      const handler = () => { const val = field.value; resolve(val); bsModal.hide(); };
      modal.querySelector('#pw-input-confirm').onclick = handler;
      bsModal.show();
    });
  },
  askVideoUpload({ accept = 'video/*', into } = {}) {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept; inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = () => {
        const file = inp.files[0] ?? null;
        if (file && into) Inventory.set(into, { name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) });
        resolve(file); inp.remove();
      };
      inp.click();
    });
  },

  delay(ms)    { return new Promise(r => setTimeout(r, ms)); },
  log(...args) { console.log('[Undercity]', ...args); },
};
