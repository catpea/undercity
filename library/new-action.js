#!/usr/bin/env node
/**
 * new-action.js — Scaffolding CLI for the Undercity action library.
 *
 * Usage:
 *   node library/new-action.js --category <id> --name <camelCaseName>
 *
 * What it does:
 *   1. Creates library/<category>/<name>/action.json   (IDE metadata stub)
 *   2. Creates library/<category>/<name>/library.js    (runtime stub)
 *   3. Creates library/<category>/category.json        (if not already present)
 *   4. Regenerates library/<category>/index.js         (aggregates all actions)
 *   5. Updates library/index.json                      (registers the category)
 *   6. Regenerates library/index.js                    (top-level entry point)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const get  = flag => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const category = get('--category');
const name     = get('--name');

if (!category || !name) {
  console.error('Usage: node library/new-action.js --category <id> --name <camelCaseName>');
  process.exit(1);
}

if (!/^[a-z][a-z0-9]*$/.test(category)) {
  console.error(`Error: category must be lowercase letters/digits, got "${category}"`);
  process.exit(1);
}
if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
  console.error(`Error: name must be camelCase, got "${name}"`);
  process.exit(1);
}

// ── Paths ─────────────────────────────────────────────────────────────────────

const categoryDir = join(ROOT, category);
const actionDir   = join(categoryDir, name);
const actionJson  = join(actionDir, 'action.json');
const libraryJs   = join(actionDir, 'library.js');
const categoryJson = join(categoryDir, 'category.json');
const categoryIdx  = join(categoryDir, 'index.js');
const indexJson    = join(ROOT, 'index.json');
const indexJs      = join(ROOT, 'index.js');

// ── Guard: don't overwrite existing action ────────────────────────────────────

if (existsSync(actionDir)) {
  console.error(`Error: action already exists at ${actionDir}`);
  process.exit(1);
}

// ── 1. Create action directory ────────────────────────────────────────────────

mkdirSync(actionDir, { recursive: true });

// ── 2. action.json stub ───────────────────────────────────────────────────────

const actionMeta = {
  id:      `${category}.${name}`,
  icon:    'question-circle',
  color:   'var(--sol-blue)',
  label:   titleCase(name),
  desc:    'TODO: describe when this action runs and where results go.',
  version: '1.0.0',
  params:  [],
};
writeFileSync(actionJson, JSON.stringify(actionMeta, null, 2) + '\n');

// ── 3. library.js stub ────────────────────────────────────────────────────────

const isInput   = category === 'input';
const TAG       = `uc-${category}-${toKebab(name)}`;

const libraryStub = isInput ? inputStub(TAG, name) : plainStub(name);
writeFileSync(libraryJs, libraryStub);

// ── 4. category.json (create only if missing) ─────────────────────────────────

if (!existsSync(categoryJson)) {
  const catMeta = {
    id:          category,
    name:        titleCase(category),
    icon:        'question-circle',
    color:       'var(--sol-blue)',
    description: `TODO: describe the ${category} category.`,
  };
  writeFileSync(categoryJson, JSON.stringify(catMeta, null, 2) + '\n');
}

// ── 5. Regenerate category index.js ──────────────────────────────────────────

regenerateCategoryIndex(categoryDir, category, categoryIdx);

// ── 6. Update index.json ──────────────────────────────────────────────────────

const indexRaw  = existsSync(indexJson) ? readFileSync(indexJson, 'utf8').trim() : '';
const indexData = indexRaw ? JSON.parse(indexRaw) : { categories: [] };

if (!indexData.categories.includes(category)) {
  indexData.categories.push(category);
  indexData.categories.sort();
}
writeFileSync(indexJson, JSON.stringify(indexData, null, 2) + '\n');

// ── 7. Regenerate top-level index.js ─────────────────────────────────────────

regenerateIndexJs(indexData.categories, indexJs);

// ── Done ──────────────────────────────────────────────────────────────────────

console.log(`
✓ Created  ${relative(actionJson)}
✓ Created  ${relative(libraryJs)}
✓ Updated  ${relative(categoryIdx)}
✓ Updated  ${relative(indexJson)}
✓ Updated  ${relative(indexJs)}

Next steps:
  1. Edit ${relative(actionJson)}
     • Set "label", "desc", "icon", "color"
     • Define "params" array

  2. Edit ${relative(libraryJs)}
     • Implement the run() function
     ${isInput ? `• The Web Component stub (TAG="${TAG}") is ready — fill in connectedCallback` : ''}
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function regenerateCategoryIndex(catDir, catId, outPath) {
  // Collect all action subdirectories that have an action.json
  const actions = readdirSync(catDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(n => existsSync(join(catDir, n, 'action.json')))
    .sort();

  // Read category metadata
  const catMetaRaw = existsSync(join(catDir, 'category.json'))
    ? JSON.parse(readFileSync(join(catDir, 'category.json'), 'utf8'))
    : { id: catId, name: catId, icon: 'puzzle', color: 'var(--sol-base1)', description: '' };

  // Read each action.json and inline as JS — avoids JSON import assertion compat issues
  const importLines = actions.map(n =>
    `import { run as ${n}Run } from './${n}/library.js';`
  ).join('\n');

  const registrations = actions.map(n => {
    const meta = JSON.parse(readFileSync(join(catDir, n, 'action.json'), 'utf8'));
    return `      ${JSON.stringify(meta.id)}: { ...${JSON.stringify(meta)}, run: ${n}Run },`;
  }).join('\n');

  const exportName = `${catId}Category`;
  const catMetaInline = JSON.stringify(catMetaRaw);

  const src = `// library/${catId}/index.js — generated by new-action.js, do not edit by hand
${importLines}

const categoryMeta = ${catMetaInline};

export const ${exportName} = {
  name: \`library/\${categoryMeta.id}\`,
  install(app) {
    app.registerCategory(categoryMeta, {
${registrations}
    });
  },
};
`;
  writeFileSync(outPath, src);
}

function regenerateIndexJs(categories, outPath) {
  // room is always first (foundational), then alphabetical
  const ordered = [
    ...categories.filter(c => c === 'room'),
    ...categories.filter(c => c !== 'room').sort(),
  ];

  const imports = ordered.map(c =>
    `import { ${c}Category } from './${c}/index.js';`
  ).join('\n');

  const uses = ordered.map(c =>
    `    app.use(${c}Category);`
  ).join('\n');

  const src = `// library/index.js — generated by new-action.js, do not edit by hand
${imports}

export default {
  name: 'undercity/library',
  install(app) {
${uses}
  },
};
`;
  writeFileSync(outPath, src);
}

function inputStub(tag, actionName) {
  return `// library/${category}/${actionName}/library.js
import { Emitter, on } from 'framework';
import { Scope }       from 'scope';

const TAG = '${tag}';

if (!customElements.get(TAG)) {
  customElements.define(TAG, class extends HTMLElement {
    #scope = new Scope();

    connectedCallback() {
      const { params, ctx } = this;

      // TODO: build DOM
      // const label = document.createElement('label');
      // label.textContent = params.label ?? '';
      // const input = document.createElement('input');
      // input.type = 'text';
      // input.name = params.key;
      // this.append(label, input);

      // TODO: Push — Inventory → DOM
      // this.#scope.add(
      //   ctx.inventory.subscribe(inv => {
      //     const v = String(inv[params.key] ?? '');
      //     if (input.value !== v) input.value = v;
      //   })
      // );

      // TODO: Push — DOM → Inventory
      // this.#scope.add(
      //   on(input, 'input', () => {
      //     ctx.inventory.value = { ...ctx.inventory.value, [params.key]: input.value };
      //   })
      // );
    }

    disconnectedCallback() {
      this.#scope.dispose();
    }
  });
}

export function run(params, ctx) {
  const emitter = new Emitter();
  const el      = Object.assign(document.createElement(TAG), { params, ctx });
  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
`;
}

function plainStub(actionName) {
  return `// library/${category}/${actionName}/library.js
import { Emitter } from 'framework';

export function run(params, ctx) {
  const emitter = new Emitter();

  try {
    // TODO: implement action
    emitter.emit('done');
  } catch (err) {
    emitter.emit('error', err);
  }

  return emitter;
}
`;
}

function titleCase(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

function toKebab(str) {
  return str.replace(/([A-Z])/g, m => '-' + m.toLowerCase());
}

function relative(p) {
  return p.replace(ROOT + '/', 'library/');
}
