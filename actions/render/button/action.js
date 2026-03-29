/** render.button — Append a Bootstrap button that navigates to a target room */
import { _container, _escA } from '../../_shared/container.js';

export function button(label = '', target = '', variant = 'primary', full = true) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-${_escA(variant)} fw-semibold${(full === true || String(full) === 'true') ? ' w-100 mt-3' : ' mt-2'}`;
  btn.textContent = String(label);
  btn.addEventListener('click', () => {
    const fn = 'goTo_' + String(target).replace(/[^a-zA-Z0-9]/g, '_');
    if (typeof window[fn] === 'function') window[fn]();
    else if (target && typeof window.Navigator !== 'undefined') window.Navigator.goto(target);
  });
  _container().appendChild(btn);
}
