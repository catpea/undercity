/** render.divider — Append a horizontal divider */
import { _container } from '../../_shared/container.js';

export function divider() {
  const hr = document.createElement('hr');
  hr.className = 'my-3 border-secondary';
  _container().appendChild(hr);
}
