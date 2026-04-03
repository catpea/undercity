// form-field.js
//
// Shared helpers for Undercity input web components. These utilities keep the
// Bootstrap-inspired validation UX consistent across IDE preview and generated
// pages while the actual controls remain inside Shadow DOM.

export function boolAttr(value) {
  return value !== null && value !== 'false';
}

export function normalizeSize(value) {
  return value === 'sm' || value === 'lg' ? value : '';
}

export function safeFieldId(prefix, key = 'field') {
  const slug = String(key || 'field')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'field';
  return `${prefix}-${slug}`;
}

export function setBooleanAttribute(el, name, on) {
  if (!el) return;
  if (on) el.setAttribute(name, '');
  else    el.removeAttribute(name);
}

export function setOptionalAttribute(el, name, value) {
  if (!el) return;
  if (value == null || value === '') el.removeAttribute(name);
  else                               el.setAttribute(name, String(value));
}

export function setDescribedBy(el, ids = []) {
  if (!el) return;
  const value = [...new Set(ids.filter(Boolean))].join(' ');
  if (value) el.setAttribute('aria-describedby', value);
  else       el.removeAttribute('aria-describedby');
}

function fieldName(label, control) {
  return String(label || control?.name || 'This field').trim() || 'This field';
}

export function defaultInvalidMessage(control, label = '') {
  const name = fieldName(label, control);
  const lc   = name.charAt(0).toLowerCase() + name.slice(1);
  const v    = control?.validity;

  if (!v) return `Please provide a valid ${lc}.`;
  if (v.valueMissing) return `${name} is required.`;

  if (v.typeMismatch) {
    if (control?.type === 'email') return 'Please provide a valid email address.';
    if (control?.type === 'url')   return 'Please provide a valid URL.';
    return `Please provide a valid ${lc}.`;
  }

  if (v.patternMismatch)  return `Please match the requested format for ${lc}.`;
  if (v.rangeUnderflow)   return `Please enter ${lc} of ${control?.min} or more.`;
  if (v.rangeOverflow)    return `Please enter ${lc} of ${control?.max} or less.`;
  if (v.stepMismatch)     return `Please use increments of ${control?.step || 1}.`;
  if (v.tooShort)         return `${name} is too short.`;
  if (v.tooLong)          return `${name} is too long.`;
  if (v.badInput)         return `Please provide a valid ${lc}.`;
  if (control?.validationMessage) return control.validationMessage;

  return `Please provide a valid ${lc}.`;
}

export function defaultChoiceInvalidMessage(label = '') {
  const name = String(label || 'an option').trim();
  const lc   = name.charAt(0).toLowerCase() + name.slice(1);
  return `Please choose ${lc}.`;
}

function normalizeValidityResult(result) {
  if (typeof result === 'boolean') return { valid: result };
  if (result && typeof result === 'object') return { valid: result.valid !== false, ...result };
  return { valid: true };
}

export class FieldValidationController {
  #host;
  #getControls;
  #getPrimaryControl;
  #getHelpEl;
  #getValidEl;
  #getInvalidEl;
  #getValidity;
  #getInvalidMessage;
  #getValidMessage;

  #active = false;
  #helpText = '';
  #validFeedback = '';
  #invalidFeedback = '';
  #describedBy = [];

  constructor(host, {
    getControls,
    getPrimaryControl,
    getHelpEl,
    getValidEl,
    getInvalidEl,
    getValidity,
    getInvalidMessage,
    getValidMessage,
  }) {
    this.#host              = host;
    this.#getControls       = getControls;
    this.#getPrimaryControl = getPrimaryControl;
    this.#getHelpEl         = getHelpEl;
    this.#getValidEl        = getValidEl;
    this.#getInvalidEl      = getInvalidEl;
    this.#getValidity       = getValidity;
    this.#getInvalidMessage = getInvalidMessage;
    this.#getValidMessage   = getValidMessage;
  }

  configure({ helpText = '', validFeedback = '', invalidFeedback = '', describedBy = [] } = {}) {
    this.#helpText        = String(helpText ?? '');
    this.#validFeedback   = String(validFeedback ?? '');
    this.#invalidFeedback = String(invalidFeedback ?? '');
    this.#describedBy     = describedBy.filter(Boolean);
    this.#syncDescription();
    this.refresh();
  }

  checkValidity() {
    return this.#resolveValidity().valid;
  }

  reportValidity({ focus = true } = {}) {
    this.#active = true;
    const { valid } = this.#resolveValidity();
    this.#render(valid);
    if (!valid && focus) this.focus();
    return valid;
  }

  refresh() {
    const { valid } = this.#resolveValidity();
    this.#render(valid);
    return valid;
  }

  reset() {
    this.#active = false;
    this.#render(true);
  }

  focus() {
    const control = this.#getPrimaryControl?.();
    control?.focus?.();
    control?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  #resolveValidity() {
    const result = this.#getValidity?.();
    if (result != null) return normalizeValidityResult(result);

    const control = this.#getPrimaryControl?.();
    if (!control?.checkValidity) return { valid: true };
    return { valid: control.checkValidity() };
  }

  #controls() {
    return (this.#getControls?.() ?? []).filter(Boolean);
  }

  #syncDescription() {
    const helpEl = this.#getHelpEl?.();
    if (helpEl) {
      helpEl.textContent = this.#helpText;
      helpEl.hidden      = !this.#helpText;
    }

    const ids = [
      ...this.#describedBy,
      this.#helpText ? helpEl?.id : '',
      this.#getInvalidEl?.()?.id,
    ].filter(Boolean);

    for (const control of this.#controls()) {
      setDescribedBy(control, ids);
    }
  }

  #render(valid) {
    const state = this.#active ? (valid ? 'valid' : 'invalid') : '';

    for (const control of this.#controls()) {
      control.classList.toggle('is-valid',   state === 'valid');
      control.classList.toggle('is-invalid', state === 'invalid');
      if (state === 'invalid') control.setAttribute('aria-invalid', 'true');
      else                     control.removeAttribute('aria-invalid');
    }

    const primary    = this.#getPrimaryControl?.();
    const validEl    = this.#getValidEl?.();
    const invalidEl  = this.#getInvalidEl?.();
    const validText  = this.#validFeedback || this.#getValidMessage?.() || 'Looks good!';
    const invalidText = this.#invalidFeedback || this.#getInvalidMessage?.() || defaultInvalidMessage(primary);

    if (validEl) {
      validEl.textContent    = validText;
      validEl.dataset.visible = state === 'valid' ? 'true' : 'false';
      validEl.hidden         = state !== 'valid';
    }

    if (invalidEl) {
      invalidEl.textContent    = invalidText;
      invalidEl.dataset.visible = state === 'invalid' ? 'true' : 'false';
      invalidEl.hidden         = state !== 'invalid';
    }
  }
}
