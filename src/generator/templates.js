/**
 * templates.js — Built-in HTML page templates for generated Undercity apps.
 *
 * SUPPORTED TEMPLATES
 * ───────────────────
 * Only two templates are active. All form controls, buttons, and UI are built
 * exclusively through Savant actions (input.*, display.*, submit.*, etc.) — NOT
 * through static HTML templates.
 *
 *   "lobby"  — Entry / welcome page. Icon, app name, tagline, out-edge buttons.
 *   "blank"  — Empty shell (#pw-content). All content is rendered at runtime
 *              by Savant actions in the room's Enter payload.
 *   null     — Default: card with the room label as an H1 heading.
 *
 * LEGACY TEMPLATES (DELETED)
 * ──────────────────────────
 * login-form, forgot-form, signup-form, success, error, submit-review were
 * removed. They hard-coded form markup that duplicated and conflicted with the
 * Savant action library. If you need a login form, build it with input.* actions
 * inside a blank room.
 *
 * Plugins may still register additional templates via PluginRegistry.
 */

import { normalizeIconName } from '../lib/icons.js';

// ── Escaping helpers ──────────────────────────────────────────────────────────

/** Escape a string for safe insertion into an HTML attribute value. */
export function escAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape a string for safe insertion into HTML text content. */
export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Derive the `goTo_*` JS function name from a graph edge.
 * Uses toId so the name is always unique within a page.
 *
 * @param {{ toId: string }} edge
 * @returns {string}
 */
function _goToFn(edge) {
  return `goTo_${edge.toId.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Human-readable button label for a graph edge.
 * Prefers edge.label → target node label → edge.toId.
 *
 * @param {{ label?: string, toId: string }} edge
 * @param {Array<{ id: string, label?: string }>} nodes
 * @returns {string}
 */
function _edgeBtnLabel(edge, nodes) {
  if (edge.label?.trim()) return edge.label.trim();
  const target = nodes?.find?.(n => n.id === edge.toId);
  if (target?.label) return target.label;
  return edge.toId;
}

// ── Default page (template: null) ─────────────────────────────────────────────

/**
 * Default room page — a single card containing the room label as an H1.
 * Rendered when `node.template` is null or unrecognised.
 *
 * @param {{ label?: string }} node
 * @returns {string} Inner HTML for the <main> container.
 */
export function defaultPageHTML(node, outEdges, nodes) {
  return `<div class="card mb-3">
      <div class="card-body">
        <h1 class="pw-heading">${escHtml(node.label)}</h1>
      </div>
    </div>`;
}

// ── Lobby (template: "lobby") ─────────────────────────────────────────────────

/**
 * Entry / welcome page — app icon, name, tagline, and navigation buttons
 * derived from the room's out-edges.
 *
 * node.meta fields:
 *   appName  {string} — heading (default: node.label)
 *   tagline  {string} — short pitch line
 *   icon     {string} — Bootstrap icon name without .svg extension (default: "stars")
 *
 * Out-edge labels are classified by regex:
 *   Primary   — sign-in / start / continue / enter
 *   Secondary — sign-up / register / create
 *   Tertiary  — forgot / reset / help → rendered as plain text links
 *   Other     — any remaining edge → secondary button
 *
 * @param {{ label?: string, meta?: object }} node
 * @param {Array<{ toId: string, label?: string }>} outEdges
 * @param {Array<{ id: string, label?: string }>} nodes
 * @returns {string} Inner HTML for the <main> container.
 */
export function lobbyHTML(node = {}, outEdges = [], nodes = []) {
  const meta     = node.meta ?? {};
  const title    = escHtml(meta.appName ?? node.label ?? 'Welcome');
  const tagline  = escHtml(meta.tagline ?? meta.description ?? '');
  const iconName = normalizeIconName(meta.icon, 'stars');
  const icon     = `<af-icon name="${iconName}" class="pw-lobby-glyph"></af-icon>`;

  const isPrimary   = e => /sign.in|log.?in|start|begin|continue|enter/i.test(e.label ?? '');
  const isSecondary = e => /sign.?up|create|register|join/i.test(e.label ?? '');
  const isTertiary  = e => /forgot|reset|help|learn/i.test(e.label ?? '');

  const primaryEdges   = outEdges.filter(isPrimary);
  const secondaryEdges = outEdges.filter(e => !isPrimary(e) && isSecondary(e));
  const tertiaryEdges  = outEdges.filter(isTertiary);
  const otherEdges     = outEdges.filter(e => !isPrimary(e) && !isSecondary(e) && !isTertiary(e));

  // Fill the primary slot with "other" edges if no primary-labelled edge exists
  const primaryBtns = [...primaryEdges, ...otherEdges.splice(0, 1 - primaryEdges.length)]
    .map(e => `<button type="button" class="btn btn-primary btn-lg w-100" onclick="${_goToFn(e)}()">${escHtml(_edgeBtnLabel(e, nodes))}</button>`)
    .join('\n          ');

  const secondaryBtns = [...secondaryEdges, ...otherEdges]
    .map(e => `<button type="button" class="btn btn-outline-secondary btn-lg w-100" onclick="${_goToFn(e)}()">${escHtml(_edgeBtnLabel(e, nodes))}</button>`)
    .join('\n          ');

  const tertiaryLinks = tertiaryEdges
    .map(e => `<a href="#" onclick="event.preventDefault();${_goToFn(e)}()" class="text-muted small text-decoration-none">${escHtml(_edgeBtnLabel(e, nodes))}</a>`)
    .join(' &nbsp;·&nbsp; ');

  const fallback = outEdges.length === 0
    ? `<p class="text-muted fst-italic">No paths configured yet.</p>`
    : '';

  return `<div class="pw-lobby text-center py-4 py-md-5">
    <div class="pw-lobby-icon mb-4" aria-hidden="true">
      <div class="d-inline-flex align-items-center justify-content-center rounded-4 pw-lobby-icon-bg"
           style="width:88px;height:88px;font-size:2.6rem;
                  background:linear-gradient(135deg,var(--pw-cyan,#2aa198),var(--pw-blue,#268bd2))">
        ${icon}
      </div>
    </div>
    <h1 class="display-6 fw-bold mb-2">${title}</h1>
    ${tagline ? `<p class="text-muted mb-5 mx-auto" style="max-width:360px">${tagline}</p>` : '<div class="mb-5"></div>'}
    <div class="d-grid gap-3 mx-auto" style="max-width:320px">
      ${primaryBtns}
      ${secondaryBtns}
      ${fallback}
    </div>
    ${tertiaryLinks ? `<p class="mt-4 mb-0">${tertiaryLinks}</p>` : ''}
  </div>`;
}

// ── Blank (template: "blank") ─────────────────────────────────────────────────

/**
 * Blank runtime-rendered page — an empty #pw-content div inside #pw-form.
 *
 * Use with Savant actions in the room's Enter payload (input.*, display.*,
 * submit.*, etc.) to build the full page content at runtime.
 *
 * The <form> wrapper enables Bootstrap validation via Actions.validate('#pw-form').
 *
 * @param {{ label?: string }} node
 * @returns {string} Inner HTML for the <main> container.
 */
export function blankPageHTML(node = {}) {
  const title = escHtml(node.label ?? 'Page');
  return `<form id="pw-form" novalidate onsubmit="event.preventDefault()">
      <div id="pw-content" aria-label="${title} content">
        <!-- Built at runtime by Savant actions in the room's Enter payload -->
      </div>
    </form>`;
}

// ── Template registry ─────────────────────────────────────────────────────────

/**
 * Map of built-in template keys to their generator functions.
 *
 * To add a template: register it here AND in the Savant IDE template picker.
 * To add a plugin template: use PluginRegistry.registerTemplate() instead.
 *
 * @type {Record<string, (node: object, outEdges: object[], nodes: object[]) => string>}
 */
export const BUILT_IN_TEMPLATES = {
  'lobby': (node, outEdges, nodes) => lobbyHTML(node, outEdges, nodes),
  'blank': (node)                   => blankPageHTML(node),
};
