// ── Render (Page Builder) ─────────────────────────────────────────────────────
// Appends Bootstrap-styled components into Bootstrap .card > .card-body sections.
// Use on rooms with template: "blank". Call render.clear in Enter first.
// render.divider() closes the current card and starts a new one.
import { Navigator }                           from './navigator.js';
import { _renderMd }                           from './md-renderer.js';
import { _pwContainer, _pwInsert, _pwCardBody } from './page-helpers.js';

export const Render = (() => {
  function _root() { return _pwContainer(); }
  function _newCard(root) {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    const body = document.createElement('div');
    body.className = 'card-body';
    card.appendChild(body);
    _pwInsert(root, card);
    return card;
  }
  function _card() { return _pwCardBody(); }
  function _esc(s)    { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _escA(s)   { return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _navFn(id) { return 'goTo_' + String(id).replace(/[^a-zA-Z0-9]/g,'_'); }

  return {
    /** Clear #pw-content — call first in Enter to rebuild. */
    clear() { const r=_root(); if(r) r.innerHTML=''; },

    /** Close the current card and start a fresh one. */
    divider() { _newCard(_root()); },

    /** Append a heading. */
    title(text, size='h2') {
      const el=document.createElement(size);
      el.className='pw-heading mb-1';
      el.textContent=String(text??'');
      _card().appendChild(el);
    },

    /** Append a muted subtitle. */
    subtitle(text) {
      const p=document.createElement('p');
      p.className='text-muted small mb-4';
      p.textContent=String(text??'');
      _card().appendChild(p);
    },

    /** Append a paragraph. style: muted|info|success|warning|danger|body */
    paragraph(text, style='muted') {
      const p=document.createElement('p');
      p.className=style==='body'?'mb-3':`text-${style} small mb-2`;
      p.textContent=String(text??'');
      _card().appendChild(p);
    },

    /** Append a Bootstrap form field. Supports type='textarea'. */
    field(name='', label='', type='text', placeholder='', autocomplete='', required=false) {
      const id=`pw-field-${_escA(name)}`;
      const req=Boolean(required)||(String(required)==='true');
      const isTA=type==='textarea';
      const div=document.createElement('div');
      div.className='mb-3';
      const inputHtml=isTA
        ? `<textarea id="${id}" name="${_escA(name)}" rows="4"
  class="form-control pw-input"
  placeholder="${_escA(placeholder)}"
  ${req?'aria-required="true" required':''}
  aria-describedby="${id}-error ${id}-ok"></textarea>`
        : `<input type="${_escA(type)}" id="${id}" name="${_escA(name)}"
  class="form-control pw-input"
  placeholder="${_escA(placeholder)}"
  ${autocomplete?'autocomplete="'+_escA(autocomplete)+'"':''}${req?' aria-required="true" required':''}
  aria-describedby="${id}-error ${id}-ok">`;
      div.innerHTML=`<label for="${id}" class="form-label">${_esc(label)}</label>
${inputHtml}
<div id="${id}-ok" class="valid-feedback">Looks good!</div>
<div id="${id}-error" class="invalid-feedback" data-error="${_escA(name)}"></div>`;
      _card().appendChild(div);
    },

    /** Append a multi-line textarea field. */
    textarea(name='', label='', placeholder='', rows=4, required=false) {
      Render.field(name, label, 'textarea', placeholder, '', required);
    },

    /** Append a Bootstrap <select> dropdown. options: CSV string or array. */
    select(name='', label='', options='', defaultVal='', required=false) {
      const id=`pw-field-${_escA(name)}`;
      const req=Boolean(required)||(String(required)==='true');
      const opts=(Array.isArray(options)?options:String(options).split(','))
        .map(o=>o.trim()).filter(Boolean)
        .map(o=>`<option value="${_escA(o)}"${o===defaultVal?' selected':''}>${_esc(o)}</option>`)
        .join('');
      const div=document.createElement('div');
      div.className='mb-3';
      div.innerHTML=`<label for="${id}" class="form-label">${_esc(label)}</label>
<select id="${id}" name="${_escA(name)}" class="form-select pw-input"${req?' required':''} aria-describedby="${id}-error ${id}-ok">
  <option value="" disabled${defaultVal?'':' selected'}>Choose…</option>
  ${opts}
</select>
<div id="${id}-ok" class="valid-feedback">Looks good!</div>
<div id="${id}-error" class="invalid-feedback" data-error="${_escA(name)}"></div>`;
      _card().appendChild(div);
    },

    /** Append a Bootstrap checkbox. */
    checkbox(name='', label='', checked=false, required=false) {
      const id=`pw-field-${_escA(name)}`;
      const req=Boolean(required)||(String(required)==='true');
      const chk=Boolean(checked)||(String(checked)==='true');
      const div=document.createElement('div');
      div.className='mb-3 form-check';
      div.innerHTML=`<input class="form-check-input pw-input" type="checkbox" id="${id}" name="${_escA(name)}"
  ${chk?'checked':''}
  ${req?'required':''}
  aria-describedby="${id}-error">
<label class="form-check-label" for="${id}">${_esc(label)}</label>
<div id="${id}-error" class="invalid-feedback" data-error="${_escA(name)}"></div>`;
      _card().appendChild(div);
    },

    /** Append a Bootstrap alert box (hidden by default if text is empty). */
    alert(id='pw-alert', type='danger', text='') {
      const div=document.createElement('div');
      div.id=id;
      div.className=`alert alert-${_escA(type)} py-2${text?'':' d-none'}`;
      div.setAttribute('role','alert');
      div.setAttribute('aria-live','polite');
      if(text) div.textContent=String(text);
      _card().appendChild(div);
    },

    /** Append a button that calls goTo_<target>() (runs Exit then navigates). */
    button(label='', target='', variant='primary', full=true) {
      const btn=document.createElement('button');
      btn.type='button';
      btn.className=`btn btn-${_escA(variant)} fw-semibold${(full===true||String(full)==='true')?' w-100 mt-3':' mt-2'}`;
      btn.textContent=String(label);
      btn.addEventListener('click',()=>{
        const fn=_navFn(target);
        if(typeof window[fn]==='function') window[fn]();
        else if(target) Navigator.goto(target);
      });
      _card().appendChild(btn);
    },

    /** Append a small centred text link navigating to a room. */
    link(text='', target='', prefix='') {
      const p=document.createElement('p');
      p.className='text-center text-muted small mt-3 mb-0';
      const a=document.createElement('a');
      a.href='#';
      a.className='text-info';
      a.textContent=String(text);
      a.addEventListener('click', e => {
        e.preventDefault();
        const fn=_navFn(target);
        if(typeof window[fn]==='function') window[fn]();
        else if(target) Navigator.goto(target);
      });
      if(prefix) p.append(String(prefix)+' ');
      p.appendChild(a);
      _card().appendChild(p);
    },

    /** Append an uppercase section label. */
    section(title) {
      const div=document.createElement('div');
      div.className='text-uppercase fw-semibold text-muted small mt-3 mb-1';
      div.style.letterSpacing='.08em';
      div.textContent=String(title??'');
      _card().appendChild(div);
    },

    /** Append a rendered Markdown block. */
    markdown(content) {
      const html=_renderMd(String(content??''));
      const div=document.createElement('div');
      div.className='af-md mb-3';
      div.innerHTML=html;
      _card().appendChild(div);
    },
  };
})();
