/**
 * generator/index.js — Project code generation orchestrator.
 *
 * generateProject(proj, outDir, reg?) is the single entry point. It:
 *   1. Creates the output directory structure
 *   2. Writes runtime.js (with plugin runtime extensions)
 *   3. Writes one HTML page per non-diamond node
 *      • The entry node's page is written as index.html (static-hosting friendly)
 *      • Diamond nodes get a routing-only page so navigation never 404s
 *   4. Writes flow.css (with plugin CSS extensions)
 *   5. Copies Bootstrap dist files
 *   6. Runs all plugin afterGenerate hooks
 *
 * Generated file tree:
 *   generated/<id>/
 *     index.html          ← entry node (was lobby.html, now browser-friendly)
 *     <room-id>.html   × N  (other rooms)
 *     <diamond-id>.html   × N  (routing pages — spinner + auto-route)
 *     icons/*.svg         ← Bootstrap icon subset used by the generated app
 *     js/af-icons.js      ← <af-icon> web component
 *     js/runtime.js
 *     css/flow.css
 *     css/transitions.css (if multipage plugin enabled)
 *     lib/bootstrap.min.css
 *     lib/bootstrap.bundle.min.js
 */

import { writeFile, mkdir, copyFile } from 'fs/promises';
import { join, dirname }              from 'path';
import { fileURLToPath }              from 'url';

import { buildRuntime }  from './runtime.js';
import { buildNodePage } from './page.js';
import { buildFlowCSS }  from './css.js';
import { normalizeIconName } from '../lib/icons.js';
import { registry as defaultRegistry } from '../../plugins/index.js';

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
  await mkdir(join(outDir, 'js'),  { recursive: true });
  await mkdir(join(outDir, 'css'), { recursive: true });
  await mkdir(join(outDir, 'lib'), { recursive: true });
  await mkdir(join(outDir, 'icons'), { recursive: true });

  // runtime.js
  const runtimeSrc = buildRuntime(
    proj, nodes, edges,
    reg.runtimeExtensions(proj)
  );
  await writeFile(join(outDir, 'js', 'runtime.js'), runtimeSrc, 'utf8');
  files.push('js/runtime.js');

  await copyFile(join(ROOT, 'public', 'js', 'af-icons.js'), join(outDir, 'js', 'af-icons.js'));
  files.push('js/af-icons.js');

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
