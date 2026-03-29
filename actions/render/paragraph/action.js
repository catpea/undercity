/** render.paragraph — Append a styled paragraph */
import { _container } from '../../_shared/container.js';

export function paragraph(text, style = 'muted') {
  const p = document.createElement('p');
  p.className = style === 'body' ? 'mb-3' : `text-${style} small mb-2`;
  p.textContent = String(text ?? '');
  _container().appendChild(p);
}
