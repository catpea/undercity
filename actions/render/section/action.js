/** render.section — Append an uppercase section label */
import { _container } from '../../_shared/container.js';

export function section(title) {
  const div = document.createElement('div');
  div.className = 'text-uppercase fw-semibold text-muted small mt-3 mb-1';
  div.style.letterSpacing = '.08em';
  div.textContent = String(title ?? '');
  _container().appendChild(div);
}
