// ── Input ─────────────────────────────────────────────────────────────────────
// 18 smart inline form inputs. Each method creates a named web component
// and appends it to the current card body. Components manage their own
// two-way Inventory binding and lifecycle internally.
import { _pwCardBody } from './page-helpers.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function _el(tag)             { return document.createElement(tag); }
function _set(el, attr, val)  { el.setAttribute(attr, String(val ?? '')); }
function _flag(el, attr, on)  { if (on) el.setAttribute(attr, ''); }
function _append(el)          { _pwCardBody().appendChild(el); return el; }

function _input(tag, key, label, placeholder, required) {
  const el = _el(tag);
  _set(el, 'key', key);
  if (label)       _set(el, 'label', label);
  if (placeholder) _set(el, 'placeholder', placeholder);
  _flag(el, 'required', Boolean(required) || required === 'true');
  return el;
}

export const Input = {

  // ── Ask For Text ─────────────────────────────────────────────────────────
  text(key, label = '', placeholder = '', required = false, autocomplete = '', spellcheck = false) {
    const el = _input('af-ask-for-text', key, label, placeholder, required);
    if (autocomplete) _set(el, 'autocomplete', autocomplete);
    if (spellcheck)   el.setAttribute('spellcheck', 'true');
    return _append(el);
  },

  // ── Ask For Long Text ────────────────────────────────────────────────────
  longText(key, label = '', placeholder = '', rows = 4, required = false, spellcheck = true) {
    const el = _input('af-ask-for-long-text', key, label, placeholder, required);
    _set(el, 'rows', Number(rows) || 4);
    if (!(Boolean(spellcheck) || spellcheck === 'true')) el.setAttribute('spellcheck', 'false');
    return _append(el);
  },

  // ── Ask For Email Address ────────────────────────────────────────────────
  email(key, label = '', placeholder = '', required = true) {
    return _append(_input('af-ask-for-email', key, label, placeholder, required));
  },

  // ── Ask For Password ─────────────────────────────────────────────────────
  password(key, label = '', placeholder = '', required = true, strengthMeter = false) {
    const el = _input('af-ask-for-password', key, label, placeholder, required);
    _flag(el, 'strength-meter', Boolean(strengthMeter) || strengthMeter === 'true');
    return _append(el);
  },

  // ── Ask For Phone Number ─────────────────────────────────────────────────
  tel(key, label = '', placeholder = '', pattern = '', required = false) {
    const el = _input('af-ask-for-phone', key, label, placeholder, required);
    if (pattern) _set(el, 'pattern', pattern);
    return _append(el);
  },

  // ── Ask For Web Address ──────────────────────────────────────────────────
  url(key, label = '', placeholder = '', required = false) {
    return _append(_input('af-ask-for-url', key, label, placeholder, required));
  },

  // ── Ask For Number ────────────────────────────────────────────────────────
  number(key, label = '', placeholder = '', min = null, max = null, step = 1, required = false) {
    const el = _input('af-ask-for-number', key, label, placeholder, required);
    if (min  != null) _set(el, 'min',  min);
    if (max  != null) _set(el, 'max',  max);
    _set(el, 'step', Number(step) || 1);
    return _append(el);
  },

  // ── Ask For Numeric Range ─────────────────────────────────────────────────
  range(key, label = '', min = 0, max = 100, step = 1, showValue = true) {
    const el = _el('af-ask-for-range');
    _set(el, 'key',  key);
    if (label) _set(el, 'label', label);
    _set(el, 'min',  min);
    _set(el, 'max',  max);
    _set(el, 'step', Number(step) || 1);
    _flag(el, 'show-value', Boolean(showValue) || showValue === 'true');
    return _append(el);
  },

  // ── Ask For Date ─────────────────────────────────────────────────────────
  date(key, label = '', min = '', max = '', required = false) {
    const el = _input('af-ask-for-date', key, label, '', required);
    if (min) _set(el, 'min', min);
    if (max) _set(el, 'max', max);
    return _append(el);
  },

  // ── Ask For Date & Time ───────────────────────────────────────────────────
  datetimeLocal(key, label = '', min = '', max = '', required = false) {
    const el = _input('af-ask-for-datetime', key, label, '', required);
    if (min) _set(el, 'min', min);
    if (max) _set(el, 'max', max);
    return _append(el);
  },

  // ── Ask For Time ─────────────────────────────────────────────────────────
  time(key, label = '', min = '', max = '', required = false) {
    const el = _input('af-ask-for-time', key, label, '', required);
    if (min) _set(el, 'min', min);
    if (max) _set(el, 'max', max);
    return _append(el);
  },

  // ── Ask For Month ─────────────────────────────────────────────────────────
  month(key, label = '', required = false) {
    return _append(_input('af-ask-for-month', key, label, '', required));
  },

  // ── Ask For Week ─────────────────────────────────────────────────────────
  week(key, label = '', required = false) {
    return _append(_input('af-ask-for-week', key, label, '', required));
  },

  // ── Ask For Color ─────────────────────────────────────────────────────────
  color(key, label = '', defaultColor = '#268bd2') {
    const el = _el('af-ask-for-color');
    _set(el, 'key',   key);
    if (label) _set(el, 'label', label);
    if (defaultColor) _set(el, 'default', defaultColor);
    return _append(el);
  },

  // ── Ask With Checkbox ─────────────────────────────────────────────────────
  checkbox(key, label = '', required = false) {
    const el = _el('af-ask-with-checkbox');
    _set(el, 'key', key);
    if (label) _set(el, 'label', label);
    _flag(el, 'required', Boolean(required) || required === 'true');
    return _append(el);
  },

  // ── Ask With Radio Buttons ────────────────────────────────────────────────
  radio(key, label = '', options = '', required = false) {
    const el = _el('af-ask-with-radio');
    _set(el, 'key', key);
    if (label) _set(el, 'label', label);
    const opts = Array.isArray(options) ? options.join(',') : String(options ?? '');
    if (opts) _set(el, 'options', opts);
    _flag(el, 'required', Boolean(required) || required === 'true');
    return _append(el);
  },

  // ── Ask For File ──────────────────────────────────────────────────────────
  file(key, label = '', accept = '*/*', multiple = false, required = false) {
    const el = _el('af-ask-for-file');
    _set(el, 'key', key);
    if (label)  _set(el, 'label', label);
    if (accept) _set(el, 'accept', accept);
    _flag(el, 'multiple', Boolean(multiple) || multiple === 'true');
    _flag(el, 'required', Boolean(required) || required === 'true');
    return _append(el);
  },

  // ── Ask For Image ──────────────────────────────────────────────────────────
  image(key, label = '', accept = 'image/*', required = false) {
    const el = _el('af-ask-for-image');
    _set(el, 'key', key);
    if (label)  _set(el, 'label', label);
    if (accept) _set(el, 'accept', accept);
    _flag(el, 'required', Boolean(required) || required === 'true');
    return _append(el);
  },

};
