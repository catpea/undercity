/**
 * generator/index.js — Project code generation orchestrator.
 *
 * generateProject(proj, outDir, reg?) is the single entry point. It:
 *   1. Creates the output directory structure
 *   2. Copies static runtime ESM modules to js/runtime/
 *   3. Writes js/runtime/config.js and js/runtime/extensions.js (generated)
 *   4. Writes one HTML page per non-diamond node
 *      • The entry node's page is written as index.html (static-hosting friendly)
 *      • Diamond nodes get a routing-only page so navigation never 404s
 *   5. Writes flow.css (with plugin CSS extensions)
 *   6. Copies Bootstrap dist files
 *   7. Runs all plugin afterGenerate hooks
 *
 * Generated file tree:
 *   generated/<id>/
 *     index.html          ← entry node (was lobby.html, now browser-friendly)
 *     <room-id>.html   × N  (other rooms)
 *     <diamond-id>.html   × N  (routing pages — spinner + auto-route)
 *     icons/*.svg         ← Bootstrap icon subset used by the generated app
 *     js/af-icons.js      ← <af-icon> web component
 *     js/runtime/         ← static ESM modules (copied as-is)
 *       index.js, config.js, extensions.js, bus.js, inventory.js, ...
 *     css/flow.css
 *     css/transitions.css (if multipage plugin enabled)
 *     lib/bootstrap.min.css
 *     lib/bootstrap.bundle.min.js
 */

import { writeFile, mkdir, copyFile, readdir } from 'fs/promises';
import { join, dirname }                        from 'path';
import { fileURLToPath }                        from 'url';

import { buildRuntimeConfig, buildRuntimeExtensions } from './runtime.js';
import { buildNodePage }                              from './page.js';
import { buildFlowCSS }                               from './css.js';
import { normalizeIconName }                          from '../lib/icons.js';
import { registry as defaultRegistry }                from '../../plugins/index.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');
const GENERATED_ICON_NAMES = new Set([
  'check-circle',
  'clipboard-check',
  'exclamation-triangle',
  'pencil-square',
  'stars',
]);

function collectGeneratedIconNames(nodes) {
  const names = new Set(GENERATED_ICON_NAMES);

  for (const node of nodes) {
    if (node.meta?.icon) {
      names.add(normalizeIconName(node.meta.icon, 'stars'));
    }
  }

  return [...names];
}

/**
 * Generate a complete Bootstrap application for `proj` into `outDir`.
 *
 * @param {object}          proj   - Persisted project descriptor
 * @param {string}          outDir - Absolute path to the output directory
 * @param {PluginRegistry}  [reg]  - Plugin registry (defaults to global registry)
 * @returns {Promise<string[]>} list of generated relative file paths
 */
export async function generateProject(proj, outDir, reg = defaultRegistry) {
  const nodes = proj.graph?.nodes ?? [];
  const edges = proj.graph?.edges ?? [];
  const files = [];

  // Create output directories
  await mkdir(join(outDir, 'js', 'runtime'),    { recursive: true });
  await mkdir(join(outDir, 'js', 'components'), { recursive: true });
  await mkdir(join(outDir, 'css'),              { recursive: true });
  await mkdir(join(outDir, 'lib'),              { recursive: true });
  await mkdir(join(outDir, 'icons'),            { recursive: true });

  // Copy static runtime ESM modules (all .js files in src/generator/runtime/)
  const runtimeSrcDir = join(__dir, 'runtime');
  const runtimeFiles  = (await readdir(runtimeSrcDir)).filter(f => f.endsWith('.js'));
  for (const f of runtimeFiles) {
    await copyFile(join(runtimeSrcDir, f), join(outDir, 'js', 'runtime', f));
    files.push(`js/runtime/${f}`);
  }

  // Write the two generated files (project-specific)
  const configSrc = buildRuntimeConfig(proj, nodes);
  await writeFile(join(outDir, 'js', 'runtime', 'config.js'), configSrc, 'utf8');
  files.push('js/runtime/config.js');

  const extSrc = buildRuntimeExtensions(reg.runtimeExtensions(proj));
  await writeFile(join(outDir, 'js', 'runtime', 'extensions.js'), extSrc, 'utf8');
  files.push('js/runtime/extensions.js');

  await copyFile(join(ROOT, 'src', 'ide', 'af-icons.js'), join(outDir, 'js', 'af-icons.js'));
  await copyFile(join(ROOT, 'src', 'lib', 'signal.js'),  join(outDir, 'js', 'signal.js'));
  await copyFile(join(ROOT, 'src', 'lib', 'scope.js'),   join(outDir, 'js', 'scope.js'));
  files.push('js/af-icons.js', 'js/signal.js', 'js/scope.js');

  // Web components — collect all af-*.js from library/*/*/
  // Copy each to js/components/ and generate a barrel js/components.js
  const libraryDir     = join(ROOT, 'library');
  const componentFiles = [];
  const categories     = (await readdir(libraryDir, { withFileTypes: true }))
    .filter(d => d.isDirectory()).map(d => d.name);
  for (const cat of categories) {
    const catDir = join(libraryDir, cat);
    const actions = (await readdir(catDir, { withFileTypes: true }).catch(() => []))
      .filter(d => d.isDirectory()).map(d => d.name);
    for (const act of actions) {
      const actDir = join(catDir, act);
      const entries = (await readdir(actDir).catch(() => [])).filter(f => /^af-.+\.js$/.test(f));
      for (const f of entries) {
        await copyFile(join(actDir, f), join(outDir, 'js', 'components', f));
        componentFiles.push(f);
        files.push(`js/components/${f}`);
      }
    }
  }
  const barrelSrc = componentFiles.map(f => `import './components/${f}';`).join('\n') + '\n';
  await writeFile(join(outDir, 'js', 'components.js'), barrelSrc, 'utf8');
  files.push('js/components.js');

  // HTML pages — all nodes get a page (diamonds get a routing-only page)
  for (const node of nodes) {
    const html = buildNodePage(proj, node, nodes, edges, reg);

    // Entry node → index.html (browser-friendly, works with static hosting)
    const fname = node.meta?.isEntry ? 'index.html' : `${node.id}.html`;
    await writeFile(join(outDir, fname), html, 'utf8');
    files.push(fname);
  }

  // flow.css (base + plugin CSS extensions)
  const cssSrc = buildFlowCSS(proj, reg.cssExtensions(proj));
  await writeFile(join(outDir, 'css', 'flow.css'), cssSrc, 'utf8');
  files.push('css/flow.css');

  // Bootstrap dist files — sourced from generator/base/ (not tmp/)
  const baseSrc = join(ROOT, 'generator', 'base');
  await copyFile(join(baseSrc, 'css', 'bootstrap.min.css'),      join(outDir, 'lib', 'bootstrap.min.css'));
  await copyFile(join(baseSrc, 'js',  'bootstrap.bundle.min.js'), join(outDir, 'lib', 'bootstrap.bundle.min.js'));
  files.push('lib/bootstrap.min.css', 'lib/bootstrap.bundle.min.js');

  const iconSrc = join(baseSrc, 'icons');
  for (const name of collectGeneratedIconNames(nodes)) {
    const relPath = `icons/${name}.svg`;
    await copyFile(join(iconSrc, `${name}.svg`), join(outDir, 'icons', `${name}.svg`));
    files.push(relPath);
  }

  // Plugin afterGenerate hooks (e.g. multipage writes transitions.css)
  await reg.runAfterGenerate(proj, outDir, files);

  return files;
}
