/** render.title — Append a heading to #pw-content */
import { _container } from '../../_shared/container.js';

export function title(text, size = 'h2') {
  const el = document.createElement(size);
  el.className = 'pw-heading mb-1';
  el.textContent = String(text ?? '');
  _container().appendChild(el);
}
