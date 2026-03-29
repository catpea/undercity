/**
 * plugins/wizard.js — Multi-step wizard generation plugin.
 *
 * Registers the `wizard` template type. A wizard room renders all
 * its steps on a single page and navigates between them client-side,
 * storing progress in Inventory so the user can resume where they left off.
 *
 * Node meta shape:
 * {
 *   "wizard": {
 *     "title": "Account Setup",
 *     "steps": [
 *       {
 *         "id": "profile",
 *         "title": "Your Profile",
 *         "fields": [
 *           { "name": "displayName", "type": "text",  "label": "Display Name", "required": true },
 *           { "name": "bio",         "type": "textarea", "label": "Short Bio" }
 *         ]
 *       },
 *       {
 *         "id": "billing",
 *         "title": "Billing",
 *         "fields": [
 *           { "name": "plan", "type": "select", "label": "Plan",
 *             "options": ["Free", "Pro", "Enterprise"] }
 *         ]
 *       }
 *     ],
 *     "finishTarget": "dashboard"
 *   }
 * }
 */

import { escHtml, escAttr } from '../src/generator/templates.js';

// ── Field renderer (shared with forms plugin logic) ───────────────────────────

function renderField(field) {
  const { name, type = 'text', label, placeholder = '', required, rows, options } = field;
  const id    = `wz-field-${escAttr(name)}`;
  const base  = `name="${escAttr(name)}" id="${id}"${required ? ' required' : ''}${placeholder ? ` placeholder="${escAttr(placeholder)}"` : ''}`;

  if (type === 'textarea') {
    return `
        <div class="mb-3">
          <label class="form-label" for="${id}">${escHtml(label ?? name)}${required ? ' <span class="text-danger">*</span>' : ''}</label>
          <textarea class="form-control pw-input" ${base} rows="${rows ?? 3}"></textarea>
          <div class="d-none text-danger small mt-1" data-error="${escAttr(name)}"></div>
        </div>`;
  }
  if (type === 'select') {
    const opts = (options ?? []).map(o => {
      const v = typeof o === 'object' ? o.value : o;
      const l = typeof o === 'object' ? o.label : o;
      return `<option value="${escAttr(v)}">${escHtml(l)}</option>`;
    }).join('');
    return `
        <div class="mb-3">
          <label class="form-label" for="${id}">${escHtml(label ?? name)}</label>
          <select class="form-select pw-input" ${base}><option value="">— choose —</option>${opts}</select>
          <div class="d-none text-danger small mt-1" data-error="${escAttr(name)}"></div>
        </div>`;
  }
  return `
      <div class="mb-3">
        <label class="form-label" for="${id}">${escHtml(label ?? name)}${required ? ' <span class="text-danger">*</span>' : ''}</label>
        <input type="${escAttr(type)}" class="form-control pw-input" ${base}>
        <div class="d-none text-danger small mt-1" data-error="${escAttr(name)}"></div>
      </div>`;
}

// ── Template builder ──────────────────────────────────────────────────────────

function buildWizardPage(proj, node, outEdges) {
  const wz           = node.meta?.wizard ?? {};
  const title        = wz.title        ?? node.label ?? 'Setup Wizard';
  const steps        = wz.steps        ?? [];
  const finishTarget = wz.finishTarget ?? outEdges[0]?.toId ?? null;
  const onExitJSON   = JSON.stringify(node.payload?.onExit ?? [], null, 6);

  // Progress indicators
  const progressItems = steps.map((step, i) => `
        <div class="pw-wz-step${i === 0 ? ' active' : ''}" data-wz-step="${i}">
          <span class="pw-wz-num">${i + 1}</span>
          <span class="pw-wz-title">${escHtml(step.title ?? step.id)}</span>
        </div>`).join('');

  // Step panels
  const panels = steps.map((step, i) => {
    const fieldsHTML = (step.fields ?? []).map(renderField).join('');
    return `
        <div class="pw-wz-panel${i === 0 ? '' : ' d-none'}" data-wz-panel="${i}">
          <h5 class="pw-heading mb-4">${escHtml(step.title ?? step.id)}</h5>
          ${fieldsHTML || '<p class="text-muted">No fields defined for this step.</p>'}
        </div>`;
  }).join('');

  const stepDefs = JSON.stringify(steps.map(s => ({
    id:     s.id,
    fields: (s.fields ?? []).map(f => ({ name: f.name, required: !!f.required, type: f.type ?? 'text' })),
  })), null, 6);

  return `
    <!-- Wizard: ${escHtml(title)} -->
    <div class="pw-card col-md-7 mx-auto">
      <h2 class="pw-heading mb-4">${escHtml(title)}</h2>

      <!-- Progress bar -->
      <div class="pw-wz-progress mb-4">${progressItems}
      </div>

      <!-- Step content -->
      <form id="pw-wz-form" novalidate>
        ${panels}
        <div id="pw-wz-error" class="d-none alert alert-danger py-2 mb-3"></div>
      </form>

      <!-- Navigation -->
      <div class="d-flex justify-content-between mt-4">
        <button id="pw-wz-back"   class="btn btn-outline-secondary d-none">← Back</button>
        <div class="ms-auto d-flex gap-2">
          <button id="pw-wz-next"   class="btn btn-primary">Next →</button>
          <button id="pw-wz-finish" class="btn btn-success d-none">Finish ✓</button>
        </div>
      </div>
    </div>

    <style>
      .pw-wz-progress { display:flex; gap:0; }
      .pw-wz-step { display:flex; align-items:center; gap:8px; padding:8px 16px; font-size:12px;
                    color:var(--sol-text); border-bottom:2px solid transparent; }
      .pw-wz-step.active  { color:var(--sol-cyan);  border-color:var(--sol-cyan); }
      .pw-wz-step.done    { color:var(--sol-green); border-color:var(--sol-green); }
      .pw-wz-num  { display:inline-flex; align-items:center; justify-content:center;
                    width:22px; height:22px; border-radius:50%; font-size:11px; font-weight:700;
                    background:rgba(38,139,210,.2); color:var(--sol-blue); }
      .pw-wz-step.active .pw-wz-num { background:var(--sol-cyan); color:#002b36; }
      .pw-wz-step.done   .pw-wz-num { background:var(--sol-green); color:#002b36; }
    </style>

    <script type="module">
      import { Inventory, Navigator, runPayload } from './js/runtime.js';

      const STEPS       = ${stepDefs};
      const ON_EXIT     = ${onExitJSON};
      const FINISH_TO   = ${finishTarget ? `'${finishTarget}'` : 'null'};
      const STEP_KEY    = '__wz_step_${node.id}__';
      let current = Inventory.get(STEP_KEY) ?? 0;

      const panels   = document.querySelectorAll('[data-wz-panel]');
      const progSteps= document.querySelectorAll('[data-wz-step]');
      const btnBack  = document.getElementById('pw-wz-back');
      const btnNext  = document.getElementById('pw-wz-next');
      const btnFin   = document.getElementById('pw-wz-finish');

      function showStep(n) {
        current = Math.max(0, Math.min(n, STEPS.length - 1));
        Inventory.set(STEP_KEY, current);
        panels.forEach((p, i)    => p.classList.toggle('d-none', i !== current));
        progSteps.forEach((s, i) => {
          s.classList.toggle('active', i === current);
          s.classList.toggle('done',   i < current);
        });
        btnBack.classList.toggle('d-none', current === 0);
        btnNext.classList.toggle('d-none', current === STEPS.length - 1);
        btnFin.classList.toggle('d-none',  current !== STEPS.length - 1);
      }

      function validateStep(idx) {
        const step = STEPS[idx] ?? {};
        const errors = {};
        for (const f of step.fields ?? []) {
          if (!f.required) continue;
          const el  = document.querySelector(\`[name="\${f.name}"]\`);
          const val = f.type === 'checkbox' ? el?.checked : el?.value?.trim();
          if (!val) errors[f.name] = \`\${f.name} is required\`;
        }
        return errors;
      }

      function saveStep(idx) {
        for (const f of (STEPS[idx]?.fields ?? [])) {
          const el = document.querySelector(\`[name="\${f.name}"]\`);
          if (el) Inventory.set(f.name, f.type === 'checkbox' ? el.checked : el.value);
        }
      }

      btnBack.addEventListener('click', () => showStep(current - 1));

      btnNext.addEventListener('click', () => {
        const errors = validateStep(current);
        document.querySelectorAll('[data-error]').forEach(e => { e.textContent=''; e.classList.add('d-none'); });
        if (Object.keys(errors).length) {
          for (const [name, msg] of Object.entries(errors)) {
            const el = document.querySelector(\`[data-error="\${name}"]\`);
            if (el) { el.textContent = msg; el.classList.remove('d-none'); }
          }
          return;
        }
        saveStep(current);
        showStep(current + 1);
      });

      btnFin.addEventListener('click', async () => {
        const errors = validateStep(current);
        if (Object.keys(errors).length) { btnNext.click(); return; }
        saveStep(current);
        Inventory.delete(STEP_KEY);
        await runPayload(ON_EXIT);
        if (FINISH_TO) Navigator.goto(FINISH_TO);
      });

      showStep(current);
    </script>`;
}

// ── Plugin manifest ───────────────────────────────────────────────────────────

const WizardPlugin = {
  name:        'wizard',
  version:     '1.0.0',
  description: 'Multi-step wizard pages with progress indicator and inventory persistence',

  install(registry) {
    registry.addTemplate('wizard', buildWizardPage);
  },

  commands: [
    {
      name:        'scaffold wizard',
      category:    'Generator',
      description: 'Add a wizard room with multiple steps',
      usage:       'scaffold wizard <room-id> [--steps <step1,step2,...>] [--title <title>]',
    },
  ],
};

export default WizardPlugin;
