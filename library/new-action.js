#!/usr/bin/env node
/**
 * new-action.js — Scaffolding CLI for the Undercity action library.
 *
 * Usage:
 *   node library/new-action.js --category <id> --name <camelCaseName>
 *   node library/new-action.js --category <id> --regen   (regenerate index without adding a new action)
 *
 * What it does:
 *   1. Creates library/<category>/<name>/action.json   (IDE metadata stub)
 *   2. Creates library/<category>/<name>/library.js    (runtime stub)
 *   3. Creates library/<category>/category.json        (if not already present)
 *   4. Regenerates library/<category>/index.js         (aggregates all actions)
 *   5. Updates library/index.json                      (registers the category)
 *   6. Regenerates library/index.js                    (top-level entry point)
 */

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT       = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = join(ROOT, '..');
const ICONS_SRC  = join(REPO_ROOT, '.temp', 'bootstrap-icons');
const ICONS_DEST = join(REPO_ROOT, 'public', 'icons');
const HAS_ICONS  = existsSync(ICONS_SRC);

if (!HAS_ICONS) {
  console.warn('');
  console.warn('  WARNING: Bootstrap Icons not found.');
  console.warn('  Icons referenced in action.json will not be copied to public/icons/.');
  console.warn('');
  console.warn('  To fix, clone bootstrap-icons into .temp/:');
  console.warn('    git clone https://github.com/twbs/icons .temp/bootstrap-icons');
  console.warn('');
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const args  = process.argv.slice(2);
const get   = flag => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const has   = flag => args.includes(flag);

const category = get('--category');
const name     = get('--name');
const regenOnly = has('--regen');

if (!category || (!name && !regenOnly)) {
  console.error('Usage: node library/new-action.js --category <id> --name <camelCaseName>');
  console.error('       node library/new-action.js --category <id> --regen');
  process.exit(1);
}

if (!/^[a-z][a-z0-9]*$/.test(category)) {
  console.error(`Error: category must be lowercase letters/digits, got "${category}"`);
  process.exit(1);
}
if (!regenOnly && !/^[a-z][a-zA-Z0-9]*$/.test(name)) {
  console.error(`Error: name must be camelCase, got "${name}"`);
  process.exit(1);
}

// ── Paths ─────────────────────────────────────────────────────────────────────

const categoryDir  = join(ROOT, category);
const actionDir    = name ? join(categoryDir, name) : null;
const actionJson   = actionDir ? join(actionDir, 'action.json') : null;
const libraryJs    = actionDir ? join(actionDir, 'library.js')  : null;
const componentTag = name ? `af-${toKebab(name)}` : null;
const componentJs  = actionDir ? join(actionDir, `${componentTag}.js`) : null;
const categoryJson = join(categoryDir, 'category.json');
const categoryIdx  = join(categoryDir, 'index.js');
const indexJson    = join(ROOT, 'index.json');
const indexJs      = join(ROOT, 'index.js');

// ── --regen mode: just regenerate indices ────────────────────────────────────

if (regenOnly) {
  if (!existsSync(categoryDir)) {
    console.error(`Error: category directory not found: ${categoryDir}`);
    process.exit(1);
  }
  // Copy icons for every action in this category
  readdirSync(categoryDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(categoryDir, d.name, 'action.json')))
    .forEach(d => {
      const meta = JSON.parse(readFileSync(join(categoryDir, d.name, 'action.json'), 'utf8'));
      copyIcon(meta.icon);
    });
  if (existsSync(categoryJson)) {
    const catMeta = JSON.parse(readFileSync(categoryJson, 'utf8'));
    copyIcon(catMeta.icon);
  }
  regenerateCategoryIndex(categoryDir, category, categoryIdx);
  const idxRaw  = existsSync(indexJson) ? readFileSync(indexJson, 'utf8').trim() : '';
  const idxData = idxRaw ? JSON.parse(idxRaw) : { categories: [] };
  if (!idxData.categories.includes(category)) {
    idxData.categories.push(category);
    idxData.categories.sort();
    writeFileSync(indexJson, JSON.stringify(idxData, null, 2) + '\n');
  }
  regenerateIndexJs(idxData.categories, indexJs);
  console.log(`✓ Regenerated  ${relative(categoryIdx)}`);
  console.log(`✓ Regenerated  ${relative(indexJs)}`);
  process.exit(0);
}

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

// ── 3. Copy icon SVG to public/icons/ ────────────────────────────────────────

copyIcon(actionMeta.icon);

// ── 4. library.js stub + af-*.js web component stub ──────────────────────────

writeFileSync(libraryJs, libraryStub(componentTag, name));
writeFileSync(componentJs, componentStub(componentTag, name));

// ── 5. category.json (create only if missing) ─────────────────────────────────

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

// ── 6. Regenerate category index.js ──────────────────────────────────────────

regenerateCategoryIndex(categoryDir, category, categoryIdx);

// ── 7. Update index.json ──────────────────────────────────────────────────────

const indexRaw  = existsSync(indexJson) ? readFileSync(indexJson, 'utf8').trim() : '';
const indexData = indexRaw ? JSON.parse(indexRaw) : { categories: [] };

if (!indexData.categories.includes(category)) {
  indexData.categories.push(category);
  indexData.categories.sort();
}
writeFileSync(indexJson, JSON.stringify(indexData, null, 2) + '\n');

// ── 8. Regenerate top-level index.js ─────────────────────────────────────────

regenerateIndexJs(indexData.categories, indexJs);

// ── Done ──────────────────────────────────────────────────────────────────────

console.log(`
✓ Created  ${relative(actionJson)}
✓ Created  ${relative(libraryJs)}
✓ Created  ${relative(componentJs)}
✓ Updated  ${relative(categoryIdx)}
✓ Updated  ${relative(indexJson)}
✓ Updated  ${relative(indexJs)}

Next steps:
  1. Edit ${relative(actionJson)}
     • Set "label", "desc", "icon", "color"
     • Define "params" array

  2. Edit ${relative(componentJs)}
     • Implement the web component (tag: <${componentTag}>)
     • Add observed attributes, template, connectedCallback

  3. Edit ${relative(libraryJs)}
     • The run() stub already imports and creates <${componentTag}>
     • Attach params as attributes before emitting 'render'
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function copyIcon(iconName) {
  if (!iconName || !HAS_ICONS) return;
  const src  = join(ICONS_SRC,  `${iconName}.svg`);
  const dest = join(ICONS_DEST, `${iconName}.svg`);
  if (!existsSync(src)) {
    console.warn(`  Warning: icon "${iconName}" not found in .temp/bootstrap-icons/`);
    return;
  }
  if (existsSync(dest)) return; // already present, don't overwrite
  mkdirSync(ICONS_DEST, { recursive: true });
  copyFileSync(src, dest);
  console.log(`✓ Copied   public/icons/${iconName}.svg`);
}

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

function libraryStub(tag, actionName) {
  return `// library/${category}/${actionName}/library.js
//
// IDE-side action runner. Creates <${tag}> and emits it for Savant to render.
import { Emitter } from 'framework';
import './${tag}.js';

export function run(params, ctx) {
  const emitter = new Emitter();

  const el = document.createElement('${tag}');
  // TODO: map params to element attributes
  // if (params.key) el.setAttribute('key', params.key);

  emitter.emit('render', el);
  emitter.emit('done');
  return emitter;
}
`;
}

function componentStub(tag, actionName) {
  const className = tag
    .split('-')
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join('');

  return `// library/${category}/${actionName}/${tag}.js
//
// <${tag}> — TODO: describe this component.
//
// Observed attributes:
//   TODO: list attributes here
//
// Uses globalThis.Inventory for reactive data — works in both the IDE preview
// and generated pages.

const template = document.createElement('template');
template.innerHTML = \`
  <style>
    :host { display: block; }
    /* TODO: add component styles */
  </style>
  <!-- TODO: add component HTML -->
  <slot></slot>
\`;

class ${className} extends HTMLElement {
  static observedAttributes = [/* 'key', 'label', ... */];

  #sub = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.#syncView();
    // TODO: subscribe to globalThis.Inventory if needed
    // this.#sub = globalThis.Inventory?.subscribe('key', v => { ... });
  }

  disconnectedCallback() {
    this.#sub?.dispose();
    this.#sub = null;
  }

  attributeChangedCallback(attr, prev, next) {
    if (prev === next) return;
    this.#syncView();
  }

  #syncView() {
    // TODO: update DOM from attributes
  }
}

customElements.define('${tag}', ${className});
export { ${className} };
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
