/**
 * runtime.js — Generates the two project-specific runtime files.
 *
 * All other runtime modules are static ESM files in src/generator/runtime/
 * that are copied as-is to js/runtime/ at build time. Only these two tiny
 * files are generated per project:
 *
 *   js/runtime/config.js     — project-specific constants (inventory defaults,
 *                              project ID, entry node ID)
 *   js/runtime/extensions.js — optional plugin code blocks
 *
 * Generated pages import from './js/runtime/index.js' which re-exports
 * everything from the static modules plus the two generated files.
 */

/**
 * Build config.js — the tiny generated file that provides project-specific
 * constants to the static runtime modules.
 *
 * @param {object}   proj  - Project descriptor
 * @param {object[]} nodes - Graph nodes
 * @returns {string} config.js source
 */
export function buildRuntimeConfig(proj, nodes) {
  const inventory = proj.inventory?.schema ?? {};
  const defaults  = Object.fromEntries(
    Object.entries(inventory).map(([k, v]) => [k, v.default ?? null])
  );
  const entryId = nodes.find(n => n.meta?.isEntry)?.id ?? 'index';

  return `// ── Generated project config ─────────────────────────────────────────────────
// Project : ${proj.name}
// Generated: ${new Date().toISOString()}
// Do not edit — regenerated on every build.
export const PROJ_ID            = ${JSON.stringify(proj.id)};
export const ENTRY_ID           = ${JSON.stringify(entryId)};
export const INVENTORY_DEFAULTS = ${JSON.stringify(defaults, null, 2)};
`;
}

/**
 * Build extensions.js — optional plugin JS blocks.
 * Returns an empty module if no plugins contribute extensions.
 *
 * @param {string[]} extensions - JS source blocks from plugins
 * @returns {string} extensions.js source
 */
export function buildRuntimeExtensions(extensions = []) {
  if (!extensions.length) {
    return `// ── Plugin extensions (none) ─────────────────────────────────────────────────\n`;
  }
  return `// ── Plugin extensions ────────────────────────────────────────────────────────
import { registerNamespace } from './registry.js';

${extensions.join('\n\n')}
`;
}
