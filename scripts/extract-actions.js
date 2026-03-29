#!/usr/bin/env node
/**
 * scripts/extract-actions.js
 *
 * Reads ACTION_LIBRARY from action-library.js and generates:
 *   actions/{category}/{method}/action.json   — action definition
 *   actions/{category}/{method}/action.test.js — test stub
 *
 * Run: node scripts/extract-actions.js
 * Safe to re-run — skips files that already exist (use --force to overwrite).
 */

import { mkdir, writeFile, access } from 'fs/promises';
import { join, dirname }           from 'path';
import { fileURLToPath }           from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');

const { ACTION_LIBRARY } = await import('../public/js/action-library.js');

const force = process.argv.includes('--force');

let created = 0, skipped = 0;

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function writeIfNew(p, content) {
  if (!force && await exists(p)) { skipped++; return; }
  await writeFile(p, content, 'utf8');
  created++;
}

// Generate a minimal test stub for an action
function makeTestStub(actionId, def, catId) {
  const [ns, method] = actionId.split('.');
  const nsCapital = ns.charAt(0).toUpperCase() + ns.slice(1);

  // Build test expectations based on params
  const paramCount = (def.params ?? []).filter(p => p.name !== 'into').length;
  const paramDefaults = (def.params ?? [])
    .filter(p => p.name !== 'into')
    .map(p => {
      if (p.type === 'boolean') return String(p.default ?? false);
      if (p.type === 'number')  return String(p.default ?? 0);
      if (p.type === 'select')  return JSON.stringify(p.default ?? p.options?.[0] ?? '');
      return JSON.stringify(p.default ?? p.placeholder ?? '');
    });

  return `/**
 * action.test.js — Unit tests for ${actionId}
 * ${def.label}: ${def.desc ?? ''}
 *
 * Each test receives (RT, sandbox) where:
 *   RT      — the generated runtime module (Inventory, Navigator, Actions, ...)
 *   sandbox — a <div> containing #pw-content, #pw-form, #pw-loading
 */

export const tests = [

  {
    name: '${actionId} — is exported from runtime',
    run(RT) {
      const ns = RT.${nsCapital} ?? RT.${ns};
      if (!ns) throw new Error('Namespace ${nsCapital}/${ns} not found in runtime');
      if (typeof ns.${method} !== 'function') throw new Error('${actionId} is not a function');
    },
  },

${paramCount === 0 ? `  {
    name: '${actionId} — can be called with no arguments',
    async run(RT, sandbox) {
      // Smoke test: calling the action should not throw
      // (may produce DOM changes or be a no-op depending on state)
      try {
        await RT.${nsCapital ?? ns}.${method}?.();
      } catch (e) {
        // Some actions require specific DOM state — acceptable
        if (e instanceof TypeError) throw e;
      }
    },
  },` : `  {
    name: '${actionId} — can be called with default params',
    async run(RT, sandbox) {
      try {
        await RT.${nsCapital}.${method}?.(${paramDefaults.join(', ')});
      } catch (e) {
        if (e instanceof TypeError) throw e;
      }
    },
  },`}

];
`;
}

for (const [catId, cat] of Object.entries(ACTION_LIBRARY)) {
  for (const [actionId, def] of Object.entries(cat.actions ?? {})) {
    const [ns, method] = actionId.split('.');
    if (!method) continue; // skip malformed ids

    const dir = join(ROOT, 'actions', ns, method);
    await mkdir(dir, { recursive: true });

    // action.json
    const jsonPath = join(dir, 'action.json');
    const json = {
      id:            actionId,
      category:      catId,
      categoryLabel: cat.label,
      icon:          cat.icon,
      color:         cat.color,
      label:         def.label,
      desc:          def.desc ?? '',
      version:       '1.0.0',
      params:        def.params ?? [],
    };
    await writeIfNew(jsonPath, JSON.stringify(json, null, 2) + '\n');

    // action.test.js
    const testPath = join(dir, 'action.test.js');
    await writeIfNew(testPath, makeTestStub(actionId, def, catId));
  }
}

console.log(`Done: ${created} files created, ${skipped} skipped (use --force to overwrite).`);
