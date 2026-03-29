/**
 * plugins/forms.js — Declarative form generation plugin (JSONForms-inspired).
 *
 * Registers the `form-builder` template. Form configuration lives in
 * node.meta.form and supports a rich field schema:
 *
 * node.meta.form:
 * {
 *   "title":       "Contact Us",
 *   "subtitle":    "We'll get back to you shortly.",
 *   "submitLabel": "Send",
 *   "submitTarget": "next" | "<room-id>",
 *   "fields": [
 *     {
 *       "name":         "email",
 *       "type":         "email",         // text|email|password|tel|number|date|textarea|select|checkbox|radio|range
 *       "label":        "Email",
 *       "description":  "We'll never share your email.",    // help text below field
 *       "placeholder":  "you@example.com",
 *       "autocomplete": "email",
 *       "required":     true,
 *       "minLength":    2,
 *       "maxLength":    100,
 *       "min":          0,               // for number / range / date
 *       "max":          100,
 *       "step":         1,               // for number / range
 *       "pattern":      "^[A-Z].*",
 *       "options":      ["Option A", "Option B"],  // for select / radio
 *       "into":         "inventoryKey",  // where to store (default = name)
 *       "errorRequired":"Custom required message",
 *       "errorPattern": "Custom pattern message",
 *       "showIf":       { "field": "role", "value": "admin" }  // conditional display
 *     }
 *   ]
 * }
 *
 * Features added vs JSONForms reference:
 *   • Fully static-hosting friendly (all validation in browser)
 *   • Bootstrap 5.3 validation state (is-invalid / .invalid-feedback)
 *   • Proper label[for] + id + aria-describedby + aria-required + autocomplete
 *   • Conditional field show/hide based on sibling field value
 *   • Range field with live value display
 *   • Radio button group rendering
 *   • "into" meta-param: store result in a different inventory key
 */

import { escHtml, escAttr } from '../src/generator/templates.js';

// ── Field renderers ───────────────────────────────────────────────────────────

function fieldId(name) { return `field-${name}`; }
function errorId(name) { return `err-${name}`; }
function descId(name)  { return `desc-${name}`; }

function renderField(field) {
  const {
    name, type = 'text', label, placeholder = '', description,
    required, rows, options, autocomplete,
    minLength, maxLength, min, max, step, pattern, showIf,
  } = field;

  // Build aria-describedby linking error + optional description
  const described = [
    description ? descId(name) : '',
    errorId(name),
  ].filter(Boolean).join(' ');

  // Build common attributes for text-like inputs
  function commonAttrs(extra = '') {
    return [
      `id="${fieldId(name)}"`,
      `name="${escAttr(name)}"`,
      required    ? 'required aria-required="true"' : '',
      placeholder ? `placeholder="${escAttr(placeholder)}"` : '',
      autocomplete? `autocomplete="${escAttr(autocomplete)}"` : '',
      minLength   ? `minlength="${minLength}"` : '',
      maxLength   ? `maxlength="${maxLength}"` : '',
      min !== undefined ? `min="${min}"` : '',
      max !== undefined ? `max="${max}"` : '',
      step!== undefined ? `step="${step}"` : '',
      pattern     ? `pattern="${escAttr(pattern)}"` : '',
      `aria-describedby="${escAttr(described)}"`,
      extra,
    ].filter(Boolean).join(' ');
  }

  // ── Checkbox ───────────────────────────────────────────────────────────────
  if (type === 'checkbox') {
    const wrapper = `
      <div class="mb-3 form-check" data-field="${escAttr(name)}"${showIf ? ` data-show-if='${JSON.stringify(showIf)}'` : ''}>
        <input type="checkbox" class="form-check-input"
               id="${fieldId(name)}" name="${escAttr(name)}"
               ${required ? 'required aria-required="true"' : ''}
               aria-describedby="${errorId(name)}">
        <label class="form-check-label" for="${fieldId(name)}">
          ${escHtml(label ?? name)}${required ? ' <span class="text-danger" aria-hidden="true">*</span>' : ''}
        </label>
        ${description ? `<div id="${descId(name)}" class="form-text">${escHtml(description)}</div>` : ''}
        <div id="${errorId(name)}" class="invalid-feedback" data-error="${escAttr(name)}"></div>
      </div>`;
    return wrapper;
  }

  // ── Radio group ────────────────────────────────────────────────────────────
  if (type === 'radio') {
    const radios = (options ?? []).map((o, i) => {
      const val = typeof o === 'object' ? o.value : o;
      const lbl = typeof o === 'object' ? o.label : o;
      const rid = `${fieldId(name)}-${i}`;
      return `<div class="form-check">
          <input class="form-check-input" type="radio"
                 name="${escAttr(name)}" id="${rid}" value="${escAttr(val)}"
                 ${required && i === 0 ? 'required aria-required="true"' : ''}
                 aria-describedby="${errorId(name)}">
          <label class="form-check-label" for="${rid}">${escHtml(lbl)}</label>
        </div>`;
    }).join('\n        ');

    return `
      <div class="mb-3" role="group" aria-labelledby="${fieldId(name)}-legend"
           data-field="${escAttr(name)}"${showIf ? ` data-show-if='${JSON.stringify(showIf)}'` : ''}>
        <div id="${fieldId(name)}-legend" class="form-label">
          ${escHtml(label ?? name)}${required ? ' <span class="text-danger" aria-hidden="true">*</span>' : ''}
        </div>
        ${radios}
        ${description ? `<div id="${descId(name)}" class="form-text">${escHtml(description)}</div>` : ''}
        <div id="${errorId(name)}" class="invalid-feedback" data-error="${escAttr(name)}"></div>
      </div>`;
  }

  // ── Select ─────────────────────────────────────────────────────────────────
  if (type === 'select') {
    const opts = (options ?? []).map(o => {
      const val = typeof o === 'object' ? o.value : o;
      const lbl = typeof o === 'object' ? o.label : o;
      return `<option value="${escAttr(val)}">${escHtml(lbl)}</option>`;
    }).join('\n          ');

    return `
      <div class="mb-3" data-field="${escAttr(name)}"${showIf ? ` data-show-if='${JSON.stringify(showIf)}'` : ''}>
        <label for="${fieldId(name)}" class="form-label">
          ${escHtml(label ?? name)}${required ? ' <span class="text-danger" aria-hidden="true">*</span>' : ''}
        </label>
        <select class="form-select pw-input" ${commonAttrs()}>
          <option value="">— choose —</option>
          ${opts}
        </select>
        ${description ? `<div id="${descId(name)}" class="form-text">${escHtml(description)}</div>` : ''}
        <div id="${errorId(name)}" class="invalid-feedback" data-error="${escAttr(name)}"></div>
      </div>`;
  }

  // ── Textarea ───────────────────────────────────────────────────────────────
  if (type === 'textarea') {
    return `
      <div class="mb-3" data-field="${escAttr(name)}"${showIf ? ` data-show-if='${JSON.stringify(showIf)}'` : ''}>
        <label for="${fieldId(name)}" class="form-label">
          ${escHtml(label ?? name)}${required ? ' <span class="text-danger" aria-hidden="true">*</span>' : ''}
        </label>
        <textarea class="form-control pw-input" ${commonAttrs()} rows="${rows ?? 4}"></textarea>
        ${description ? `<div id="${descId(name)}" class="form-text">${escHtml(description)}</div>` : ''}
        <div id="${errorId(name)}" class="invalid-feedback" data-error="${escAttr(name)}"></div>
      </div>`;
  }

  // ── Range slider ───────────────────────────────────────────────────────────
  if (type === 'range') {
    return `
      <div class="mb-3" data-field="${escAttr(name)}"${showIf ? ` data-show-if='${JSON.stringify(showIf)}'` : ''}>
        <label for="${fieldId(name)}" class="form-label d-flex justify-content-between">
          <span>${escHtml(label ?? name)}${required ? ' <span class="text-danger" aria-hidden="true">*</span>' : ''}</span>
          <span id="${fieldId(name)}-val" class="text-info fw-semibold">${min ?? 0}</span>
        </label>
        <input type="range" class="form-range" ${commonAttrs()}
               oninput="document.getElementById('${fieldId(name)}-val').textContent=this.value">
        ${description ? `<div id="${descId(name)}" class="form-text">${escHtml(description)}</div>` : ''}
        <div id="${errorId(name)}" class="invalid-feedback" data-error="${escAttr(name)}"></div>
      </div>`;
  }

  // ── Standard inputs (text, email, password, number, tel, date, url …) ──────
  return `
      <div class="mb-3" data-field="${escAttr(name)}"${showIf ? ` data-show-if='${JSON.stringify(showIf)}'` : ''}>
        <label for="${fieldId(name)}" class="form-label">
          ${escHtml(label ?? name)}${required ? ' <span class="text-danger" aria-hidden="true">*</span>' : ''}
        </label>
        <input type="${escAttr(type)}" class="form-control pw-input" ${commonAttrs()}>
        ${description ? `<div id="${descId(name)}" class="form-text">${escHtml(description)}</div>` : ''}
        <div id="${errorId(name)}" class="invalid-feedback" data-error="${escAttr(name)}"></div>
      </div>`;
}

// ── Template builder ──────────────────────────────────────────────────────────

function buildFormPage(proj, node, outEdges) {
  const form         = node.meta?.form ?? {};
  const title        = form.title        ?? node.label ?? 'Form';
  const subtitle     = form.subtitle     ?? '';
  const submitLabel  = form.submitLabel  ?? 'Submit';
  const fields       = form.fields       ?? [];
  const submitTarget = form.submitTarget ?? 'next';

  // Resolve submit navigation target
  const nextId = submitTarget === 'next'
    ? (outEdges[0]?.toId ?? null)
    : submitTarget;

  const fieldHTML  = fields.map(renderField).join('');
  const fieldDefs  = JSON.stringify(fields, null, 6);
  const onExitJSON = JSON.stringify(node.payload?.onExit ?? [], null, 6);

  // Check if any fields have showIf (conditional display)
  const hasConditionals = fields.some(f => f.showIf);

  return `<div class="pw-card col-md-6 mx-auto">
      ${title    ? `<h2 class="pw-heading mb-1">${escHtml(title)}</h2>` : ''}
      ${subtitle ? `<p class="text-muted small mb-4">${escHtml(subtitle)}</p>` : ''}

      <form id="pw-dyn-form" novalidate>
        ${fieldHTML}
        <div id="pw-form-error" class="alert alert-danger py-2 mb-3 d-none" role="alert" aria-live="polite"></div>
        <button type="submit" class="btn btn-primary w-100 fw-semibold">${escHtml(submitLabel)}</button>
      </form>
    </div>

    <script type="module">
      import { Inventory, Navigator, runPayload, registerNamespace } from './js/runtime.js';
      // Forms is registered via the runtime extension — ensure it's available
      const { Forms } = await import('./js/runtime.js');

      const FIELDS  = ${fieldDefs};
      const ON_EXIT = ${onExitJSON};
      const NEXT    = ${nextId ? `'${nextId}'` : 'null'};

      // ── Conditional field visibility ─────────────────────────────────────
      ${hasConditionals ? `
      function _updateConditionals() {
        FIELDS.forEach(f => {
          if (!f.showIf) return;
          const wrapper = document.querySelector(\`[data-field="\${f.name}"]\`);
          const dep     = document.querySelector(\`[name="\${f.showIf.field}"]\`);
          if (!wrapper) return;
          const val = dep ? (dep.type === 'checkbox' ? dep.checked : dep.value) : '';
          const show = String(val) === String(f.showIf.value);
          wrapper.style.display = show ? '' : 'none';
          // Remove required from hidden fields so validation passes
          const inp = wrapper.querySelector('[required]');
          if (inp) inp.required = show && !!f.required;
        });
      }
      _updateConditionals();
      document.getElementById('pw-dyn-form').addEventListener('change', _updateConditionals);
      ` : ''}

      // ── Submit ──────────────────────────────────────────────────────────
      document.getElementById('pw-dyn-form').addEventListener('submit', async e => {
        e.preventDefault();

        // Clear previous validation state
        document.querySelectorAll('.is-invalid').forEach(el => {
          el.classList.remove('is-invalid');
          el.removeAttribute('aria-invalid');
        });
        document.getElementById('pw-form-error').classList.add('d-none');

        // Client-side validation via Forms.validate()
        let errors = {};
        if (typeof Forms !== 'undefined') {
          errors = Forms.validate(FIELDS);
        } else {
          // Fallback: use browser constraint validation
          FIELDS.forEach(f => {
            const el = document.querySelector(\`[name="\${f.name}"]\`);
            if (el && !el.checkValidity()) errors[f.name] = el.validationMessage;
          });
        }

        if (Object.keys(errors).length) {
          for (const [name, msg] of Object.entries(errors)) {
            const inp = document.querySelector(\`[name="\${name}"]\`);
            const errEl = document.getElementById(\`err-\${name}\`);
            inp?.classList.add('is-invalid');
            inp?.setAttribute('aria-invalid', 'true');
            if (errEl) errEl.textContent = msg;
          }
          // Focus first invalid field
          document.querySelector('.is-invalid')?.focus();
          return;
        }

        // Store field values in Inventory
        for (const f of FIELDS) {
          const wrapper = document.querySelector(\`[data-field="\${f.name}"]\`);
          if (wrapper?.style.display === 'none') continue;  // skip hidden conditionals
          const el = document.querySelector(\`[name="\${f.name}"]\`);
          if (!el) continue;
          const val = f.type === 'checkbox' ? el.checked
                    : f.type === 'radio'    ? (document.querySelector(\`[name="\${f.name}"]:checked\`)?.value ?? '')
                    : el.value;
          Inventory.set(f.into ?? f.name, val);
        }

        // Run exit payload then navigate
        await runPayload(ON_EXIT);
        if (NEXT) Navigator.goto(NEXT);
      });
    </script>`;
}

// ── Runtime extension (appended to every generated runtime.js) ────────────────

const RUNTIME_EXTENSION = `
// ── Forms (injected by FormsPlugin) ──────────────────────────────────────────
export const Forms = {
  /**
   * Validate fields-array against current DOM.
   * Returns { fieldName: errorMessage } for failed fields.
   * Supports: required, minLength, maxLength, pattern, min, max
   */
  validate(fields) {
    const errors = {};
    for (const f of fields) {
      // Skip conditionally hidden fields
      const wrapper = document.querySelector(\`[data-field="\${f.name}"]\`);
      if (wrapper?.style.display === 'none') continue;

      const el  = document.querySelector(\`[name="\${f.name}"]\`);
      if (!el) continue;

      const raw = f.type === 'checkbox' ? el.checked
                : f.type === 'radio'    ? (document.querySelector(\`[name="\${f.name}"]:checked\`)?.value ?? null)
                : el.value;
      const val = typeof raw === 'string' ? raw.trim() : raw;

      // Required check
      if (f.required && (val === '' || val === null || val === false || val === undefined)) {
        errors[f.name] = f.errorRequired ?? \`\${f.label ?? f.name} is required.\`;
        continue;
      }
      if (!val && val !== 0) continue;  // skip further checks if empty and not required

      // String length
      if (f.minLength && typeof val === 'string' && val.length < f.minLength) {
        errors[f.name] = \`Minimum \${f.minLength} characters required.\`;
        continue;
      }
      if (f.maxLength && typeof val === 'string' && val.length > f.maxLength) {
        errors[f.name] = \`Maximum \${f.maxLength} characters allowed.\`;
        continue;
      }

      // Numeric range
      if (f.min !== undefined && Number(val) < Number(f.min)) {
        errors[f.name] = \`Minimum value is \${f.min}.\`;
        continue;
      }
      if (f.max !== undefined && Number(val) > Number(f.max)) {
        errors[f.name] = \`Maximum value is \${f.max}.\`;
        continue;
      }

      // Pattern
      if (f.pattern && !new RegExp(f.pattern).test(val)) {
        errors[f.name] = f.errorPattern ?? 'Invalid format.';
      }
    }
    return errors;
  },
};

// Register with runPayload namespace resolver
registerNamespace('Forms', Forms);
registerNamespace('forms', Forms);`;

// ── Plugin manifest ───────────────────────────────────────────────────────────

const FormsPlugin = {
  name:        'forms',
  version:     '2.0.0',
  description: 'Declarative form generation with Bootstrap 5.3 validation (JSONForms-inspired)',

  install(registry) {
    registry.addTemplate('form-builder', buildFormPage);
    registry.addRuntimeExtension(() => RUNTIME_EXTENSION);
  },

  commands: [
    {
      name:        'scaffold form',
      category:    'Generator',
      description: 'Add a form-builder room with declarative fields',
      usage:       'scaffold form <room-id> [--title <title>] [--fields <name:type,...>]',
    },
  ],
};

export default FormsPlugin;
