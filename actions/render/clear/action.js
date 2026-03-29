/** render.clear — Clear #pw-content */
import { _container } from '../../_shared/container.js';

export function clear() {
  const c = _container();
  if (c) c.innerHTML = '';
}
