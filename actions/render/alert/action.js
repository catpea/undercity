/** render.alert — Append a Bootstrap alert box */
import { _container, _escA } from '../../_shared/container.js';

export function alert(id = 'pw-alert', type = 'danger', text = '') {
  const div = document.createElement('div');
  div.id = id;
  div.className = `alert alert-${_escA(type)} py-2${text ? '' : ' d-none'}`;
  div.setAttribute('role', 'alert');
  div.setAttribute('aria-live', 'polite');
  if (text) div.textContent = String(text);
  _container().appendChild(div);
}
