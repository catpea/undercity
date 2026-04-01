/**
 * page.js — HTML page builder for generated Undercity room and diamond pages.
 *
 * Rooms get a full Bootstrap layout. Diamond nodes get a minimal
 * "processing" page (spinner + auto-routing script) so that navigation to
 * them never produces a 404 / blank page.
 *
 * Layout (per Bootstrap 5.3 conventions):
 *   <body class="d-flex flex-column min-vh-100">   ← full-height flex column
 *     <nav>                                          ← optional project header
 *     <main class="flex-grow-1 d-flex align-items-center py-5">
 *       <div class="container-sm">
 *         <!-- template content -->
 *       </div>
 *     </main>
 *     <footer>
 *   </body>
 */

import { BUILT_IN_TEMPLATES, defaultPageHTML, errorHTML, escHtml } from './templates.js';

// ── Shared page shell ─────────────────────────────────────────────────────────

function pageShell({ proj, node, headExtra = '', bodyContent, scriptContent }) {
  return `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark" data-af-icon-base="./icons/">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(node.label)} — ${escHtml(proj.name)}</title>
  <link rel="stylesheet" href="lib/bootstrap.min.css">
  <link rel="stylesheet" href="css/flow.css">
  <script type="module" src="js/af-icons.js"></script>
${headExtra}</head>
<body class="pw-page d-flex flex-column min-vh-100" data-node="${node.id}">

  <!-- Full-page loading overlay (shown by Actions.loading()) -->
  <div id="pw-loading"
       class="d-none position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
       style="background:rgba(0,43,54,.82);z-index:9999"
       aria-live="assertive" aria-label="Loading">
    <div class="spinner-border text-info" role="status">
      <span class="visually-hidden">Loading…</span>
    </div>
  </div>

  <!-- Input modal (used by Actions.askInput()) -->
  <div class="modal fade" id="pw-input-modal" tabindex="-1" aria-labelledby="pw-input-label" aria-modal="true">
    <div class="modal-dialog modal-sm modal-dialog-centered">
      <div class="modal-content pw-modal-content">
        <div class="modal-header border-0 pb-0">
          <label class="modal-title fs-6 fw-semibold" id="pw-input-label">Input</label>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <input type="text" id="pw-input-field" class="form-control pw-input" aria-labelledby="pw-input-label">
        </div>
        <div class="modal-footer border-0 pt-0">
          <button type="button" class="btn btn-primary btn-sm px-4" id="pw-input-confirm">OK</button>
        </div>
      </div>
    </div>
  </div>

${bodyContent}

  <script src="lib/bootstrap.bundle.min.js"></script>
${scriptContent}
</body>
</html>`;
}

// ── Room page ──────────────────────────────────────────────────────────────

/**
 * Build a complete HTML page for a room (non-diamond) node.
 */
export function buildNodePage(proj, node, nodes, edges, registry) {
  if (node.type === 'diamond') return buildDiamondPage(proj, node, nodes, edges);

  const outEdges   = edges.filter(e => e.fromId === node.id);
  const onEnter    = node.payload?.onEnter ?? [];
  const onExit     = node.payload?.onExit  ?? [];
  const isEntry    = node.meta?.isEntry    ?? false;
  const isTerminal = node.type === 'terminal';

  const content = buildPageContent(proj, node, outEdges, nodes, registry);

  // Build nav entries for window._PW_NAV (used by room.showNav)
  const navEntries = outEdges.map(e => {
    const target = nodes.find(n => n.id === e.toId);
    return { id: e.toId, label: target?.label ?? e.toId };
  });

  const bodyContent = `  <!-- Project nav -->
  <nav class="navbar navbar-expand-lg navbar-dark border-bottom border-secondary" id="pw-navbar">
    <div class="container-lg">
      <span class="navbar-brand fw-bold text-info">${escHtml(proj.name)}</span>
      <button class="navbar-toggler" type="button"
              data-bs-toggle="collapse" data-bs-target="#pw-navbar-nav"
              aria-controls="pw-navbar-nav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="pw-navbar-nav">
        <ul class="navbar-nav ms-auto mb-2 mb-lg-0" id="pw-nav-list">
          <!-- room.showNav() injects <li> items here -->
        </ul>
      </div>
    </div>
  </nav>

  <!-- Main content — vertically centred -->
  <main class="flex-grow-1 d-flex align-items-center py-5" id="pw-main">
    <div class="container-sm">
      ${content}
    </div>
  </main>

  <footer class="py-3 border-top border-secondary text-center">
    <small class="text-muted">Powered by <span class="text-info">Undercity</span></small>
  </footer>`;

  const scriptContent = buildPageScript(node, outEdges, onEnter, onExit, isEntry, isTerminal, navEntries);

  return pageShell({ proj, node, bodyContent, scriptContent });
}

// ── Diamond page ──────────────────────────────────────────────────────────────

/**
 * Build a minimal "processing" page for a diamond (routing) node.
 *
 * The diamond page shows a loading spinner, runs its onEnter payload (which
 * typically calls an API), then evaluates conditions to route to the next
 * room. This avoids the blank-page bug when navigating to a diamond (spinner).
 */
function buildDiamondPage(proj, node, nodes, edges) {
  const outEdges = edges.filter(e => e.fromId === node.id);
  const onEnter  = node.payload?.onEnter ?? [];
  const routes   = node.routes  ?? [];

  const bodyContent = `  <!-- Diamond routing page: shows spinner while evaluating conditions -->
  <main class="flex-grow-1 d-flex align-items-center justify-content-center min-vh-100">
    <div id="pw-diamond-state" class="text-center">
      <div class="spinner-border text-info mb-3" role="status" style="width:3rem;height:3rem">
        <span class="visually-hidden">Processing…</span>
      </div>
      <p class="text-muted small">Processing…</p>
    </div>
    <div id="pw-diamond-error" class="text-center d-none">
      <p class="text-danger mb-3">Something went wrong. Please go back and try again.</p>
      <button class="btn btn-outline-secondary btn-sm me-2" onclick="window.history.back()">Go Back</button>
      <button class="btn btn-outline-info btn-sm" onclick="window.location.reload()">Retry</button>
    </div>
  </main>`;

  const scriptContent = `  <script type="module">
    import { Inventory, Navigator, Actions, Bus, runPayload, route, History, User, Display, Render, Media } from './js/runtime.js';

    const TIMEOUT_MS = 30000;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      document.getElementById('pw-diamond-state').classList.add('d-none');
      document.getElementById('pw-diamond-error').classList.remove('d-none');
    }, TIMEOUT_MS);

    try {
      // Run the diamond's onEnter payload (typically an API call), then route
      await runPayload(${JSON.stringify(onEnter, null, 4)});
      if (!timedOut) {
        clearTimeout(timer);
        route(${JSON.stringify(routes, null, 4)});
      }
    } catch (e) {
      clearTimeout(timer);
      console.error('[diamond]', e);
      document.getElementById('pw-diamond-state').classList.add('d-none');
      document.getElementById('pw-diamond-error').classList.remove('d-none');
    }
  </script>`;

  return pageShell({ proj, node, bodyContent, scriptContent });
}

// ── Inner content builder ─────────────────────────────────────────────────────

function buildPageContent(proj, node, outEdges, nodes, registry) {
  const tmpl = node.template ?? 'default';

  // Plugin-registered templates take priority
  const pluginTemplate = registry?.templateFor(tmpl);
  if (pluginTemplate) return pluginTemplate(proj, node, outEdges, nodes);

  // Built-in templates
  const builtIn = BUILT_IN_TEMPLATES[tmpl];
  if (builtIn) return builtIn(node, outEdges, nodes);

  // Fallback
  return defaultPageHTML(node, outEdges, nodes);
}

// ── Inline script block ───────────────────────────────────────────────────────

// Lifecycle event keys that are NOT room-event listeners
const _LIFECYCLE_KEYS = new Set(['onEnter', 'onExit', 'onBack', 'onReset', 'onUnload']);

function buildPageScript(node, outEdges, onEnter, onExit, isEntry, isTerminal, navEntries = []) {
  // goTo_* helpers built later (after things are processed, to include thing onExit)

  // Room-event listeners defined directly on the node (non-lifecycle payload keys)
  const roomListeners = Object.entries(node.payload ?? {})
    .filter(([key]) => !_LIFECYCLE_KEYS.has(key))
    .map(([key, steps]) =>
      `    Room.on(${JSON.stringify(key)}, async ({ event, data, room }) => {
      Inventory.set('_event', { name: event, data, room });
      await runPayload(${JSON.stringify(steps, null, 6)});
    });`
    ).join('\n');

  // Things instantiation — register each thing, wire room-event listeners,
  // and collect lifecycle payloads to run inline at the right time.
  const things = node.things ?? [];

  // thing onEnter payloads — run before the room's own onEnter
  const thingOnEnterBlocks = [];
  // thing onExit payloads  — run inside each goTo_* helper (before navigate)
  const thingOnExitPayloads = [];

  const thingsBlock = things.length === 0 ? '' : [
    `    // Instantiate Things inhabiting this room`,
    ...things.map(t => {
      const evEntries = Object.entries(t.events ?? {})
        .filter(([key]) => !_LIFECYCLE_KEYS.has(key))   // room events only
        .map(([key, steps]) => {
          // FormThing's 'take' event: only fire when room.take targets this thing's id
          // (or when no specific form is targeted, for backwards compat).
          const guard = (t.type === 'FormThing' && key === 'take')
            ? `      if (data?.form && data.form !== ${JSON.stringify(t.id)}) return;\n`
            : '';
          return `    Room.on(${JSON.stringify(key)}, async ({ event, data, room }) => {
${guard}      Inventory.set('_event', { name: event, data, thing: ${JSON.stringify(t.id)}, room });
      await runPayload(${JSON.stringify(steps, null, 6)});
    });`;
        }).join('\n');

      // Collect thing lifecycle payloads for inline execution
      if (t.events?.onEnter?.length) thingOnEnterBlocks.push(t.events.onEnter);
      if (t.events?.onExit?.length)  thingOnExitPayloads.push(t.events.onExit);

      return `    Things.register(${JSON.stringify(t.id)}, createThing(${JSON.stringify(t.type)}, ${JSON.stringify(t.id)}, ${JSON.stringify(t.config ?? {})}));
${evEntries}`;
    }),
  ].join('\n');

  // thing onEnter inline calls (one await per thing that has onEnter)
  const thingOnEnterCode = thingOnEnterBlocks
    .map(steps => `    await runPayload(${JSON.stringify(steps, null, 4)});`)
    .join('\n');

  // Rebuild goTo_* helpers to also run thing onExit payloads
  const thingOnExitCode = thingOnExitPayloads
    .map(steps => `      await runPayload(${JSON.stringify(steps)});`)
    .join('\n');

  const namedNavWithThings = outEdges.map(e => {
    const fn = `goTo_${e.toId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return `    async function ${fn}() {
${thingOnExitCode}
      await runPayload(${JSON.stringify(onExit)});
      Navigator.goto('${e.toId}');
    }
    window.${fn} = ${fn};`;
  }).join('\n');

  const hasThings = things.length > 0;
  const importLine = hasThings
    ? `import { Inventory, Navigator, Actions, Bus, runPayload, route, User, Media, Room, Things, createThing, Input } from './js/runtime.js';`
    : `import { Inventory, Navigator, Actions, Bus, runPayload, route, User, Media, Room, Input } from './js/runtime.js';`;

  // _PW_NAV: array of { id, label, call } for room.showNav()
  // call references the goTo_* helpers defined above, so it's generated as code.
  const pwNavCode = navEntries.length === 0 ? '' : `
    // Navigation map for room.showNav() — one entry per connected room
    window._PW_NAV = [
${navEntries.map(e => {
    const fn = `goTo_${e.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const label = String(e.label ?? e.id);
    return `      { id: ${JSON.stringify(e.id)}, label: ${JSON.stringify(label)}, call: () => typeof ${fn} === 'function' ? ${fn}() : Navigator.goto(${JSON.stringify(e.id)}) },`;
  }).join('\n')}
    ];`;

  return `  <script type="module">
    ${importLine}

${!isTerminal ? `    // Navigation helpers — registered BEFORE onEnter so they're available during payload
${namedNavWithThings}
${pwNavCode}` : ''}
${thingsBlock ? `\n${thingsBlock}` : ''}
${roomListeners ? `\n    // Room-event listeners\n${roomListeners}` : ''}
${thingOnEnterCode ? `\n    // Thing onEnter payloads\n${thingOnEnterCode}` : ''}
    // Room onEnter payload
    await runPayload(${JSON.stringify(onEnter, null, 4)});
  </script>`;
}
