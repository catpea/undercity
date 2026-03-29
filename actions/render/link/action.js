/** render.link — Append a small centred text link */
import { _container } from '../../_shared/container.js';

export function link(text = '', target = '', prefix = '') {
  const p = document.createElement('p');
  p.className = 'text-center text-muted small mt-3 mb-0';
  const a = document.createElement('a');
  a.href = '#';
  a.className = 'text-info';
  a.textContent = String(text);
  a.addEventListener('click', e => {
    e.preventDefault();
    const fn = 'goTo_' + String(target).replace(/[^a-zA-Z0-9]/g, '_');
    if (typeof window[fn] === 'function') window[fn]();
    else if (target && typeof window.Navigator !== 'undefined') window.Navigator.goto(target);
  });
  if (prefix) p.append(String(prefix) + ' ');
  p.appendChild(a);
  _container().appendChild(p);
}
