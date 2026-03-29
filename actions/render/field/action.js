/** render.field — Append a Bootstrap form field (label + input + error div) */
import { _container, _escA } from '../../_shared/container.js';

export function field(name = '', label = '', type = 'text', placeholder = '', autocomplete = '', required = false) {
  const id  = `pw-field-${_escA(name)}`;
  const req = Boolean(required) || (String(required) === 'true');
  const div = document.createElement('div');
  div.className = 'mb-3';
  div.innerHTML = `<label for="${id}" class="form-label">${String(label ?? '')}</label>
<input type="${_escA(type)}" id="${id}" name="${_escA(name)}"
  class="form-control pw-input"
  placeholder="${_escA(placeholder)}"
  ${autocomplete ? `autocomplete="${_escA(autocomplete)}"` : ''}${req ? ' aria-required="true" required' : ''}
  aria-describedby="${id}-error">
<div id="${id}-error" class="invalid-feedback" data-error="${_escA(name)}"></div>`;
  _container().appendChild(div);
}
