/**
 * _shared/container.js — Shared helpers for action implementations.
 * Re-exported by action.js files so tests can import behavior directly.
 */

export function _container() {
  return document.getElementById('pw-content') ?? document.getElementById('pw-form') ?? document.body;
}

export function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function _escA(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
