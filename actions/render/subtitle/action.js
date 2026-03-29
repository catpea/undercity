/** render.subtitle — Append a muted subtitle paragraph */
import { _container } from '../../_shared/container.js';

export function subtitle(text) {
  const p = document.createElement('p');
  p.className = 'text-muted small mb-4';
  p.textContent = String(text ?? '');
  _container().appendChild(p);
}
