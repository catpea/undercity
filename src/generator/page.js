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

import { BUILT_IN_TEMPLATES, defaultPageHTML, escHtml } from './templates.js';

function filterGeneratedSteps(steps = []) {
  return (steps ?? [])
    .filter(step => step?.action && step.disabled !== true)
    .map(({ disabled, ...step }) => step);
}

function filterGeneratedPayload(payload = {}) {
  const out = {};
  for (const [key, steps] of Object.entries(payload ?? {})) {
    out[key] = Array.isArray(steps) ? filterGeneratedSteps(steps) : steps;
  }
  return out;
}

function filterGeneratedThings(things = []) {
  return (things ?? []).map(thing => ({
    ...thing,
    events: filterGeneratedPayload(thing.events ?? {}),
  }));
}

function filterGeneratedNode(node) {
  return {
    ...node,
    payload: filterGeneratedPayload(node.payload ?? {}),
    things: filterGeneratedThings(node.things ?? []),
  };
}

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
  <script type="importmap">
  {"imports":{"framework":"./js/signal.js","form-field":"./js/form-field.js","scope":"./js/scope.js"}}
  </script>
  <script type="module" src="js/af-icons.js"></script>
  <script type="module" src="js/components.js"></script>
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
  const generatedNode = filterGeneratedNode(node);
  if (generatedNode.type === 'diamond') return buildDiamondPage(proj, generatedNode, nodes, edges);

  const outEdges   = edges.filter(e => e.fromId === generatedNode.id);
  const onEnter    = generatedNode.payload?.Enter ?? [];
  const onExit     = generatedNode.payload?.Exit  ?? [];
  const isEntry    = generatedNode.meta?.isEntry    ?? false;
  const isTerminal = generatedNode.type === 'terminal';

  const content = buildPageContent(proj, generatedNode, outEdges, nodes, registry);

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

  const scriptContent = buildPageScript(generatedNode, outEdges, onEnter, onExit, isEntry, isTerminal, navEntries);

  return pageShell({ proj, node: generatedNode, bodyContent, scriptContent });
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
  const onEnter  = node.payload?.Enter ?? [];
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
    import { Inventory, Navigator, Actions, Bus, runPayload, route, History, User, Display, Render, Media } from './js/runtime/index.js';

    const TIMEOUT_MS = 30000;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      document.getElementById('pw-diamond-state').classList.add('d-none');
      document.getElementById('pw-diamond-error').classList.remove('d-none');
    }, TIMEOUT_MS);

    try {
${onEnter.length ? `      // Run the diamond's Enter payload (typically an API call), then route
      await runPayload(${JSON.stringify(onEnter, null, 4)});
` : ''}      // Route after the Enter payload settles
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
const _LIFECYCLE_KEYS = new Set(['Enter', 'Exit', 'Back', 'Reset', 'Unload']);

function buildPageScript(node, outEdges, onEnter, onExit, isEntry, isTerminal, navEntries = []) {
  // goTo_* helpers built later (after things are processed, to include thing onExit)

  // Room-event listeners defined directly on the node (non-lifecycle payload keys)
  const roomListeners = Object.entries(node.payload ?? {})
    .filter(([key, steps]) => !_LIFECYCLE_KEYS.has(key) && Array.isArray(steps) && steps.length > 0)
    .map(([key, steps]) =>
      `    Room.on(${JSON.stringify(key)}, async ({ event, data, room }) => {
      await runPayload(${JSON.stringify(steps, null, 6)});
    });`
    ).join('\n');

  // Things instantiation — register each thing, wire room-event listeners,
  // and collect lifecycle payloads to run inline at the right time.
  const things = node.things ?? [];

  // thing Enter payloads — run before the room's own Enter
  const thingOnEnterBlocks = [];
  // thing Exit payloads  — run inside each goTo_* helper (before navigate)
  const thingOnExitPayloads = [];

  // Helper: sanitize a thing name into a valid JS identifier for use as a const name
  const toVarName = name => (name ?? '').replace(/[^a-zA-Z0-9_$]/g, '_') || '_thing';

  const thingsBlock = things.length === 0 ? '' : [
    `    // Things inhabiting this room`,
    ...things.map(t => {
      const thingName = t.config?.name ?? 'Thing';
      const varName   = toVarName(thingName);

      // Extra config beyond 'name' (e.g. personality, apiUrl, tokenInto)
      const { name: _n, ...extraConfig } = t.config ?? {};
      const configArg = Object.keys(extraConfig).length
        ? `, ${JSON.stringify(extraConfig)}`
        : '';

      // Instantiation line — clean OOP, UUID is a quiet second argument
      const instantiation = `    const ${varName} = new ${t.type}(${JSON.stringify(thingName)}, ${JSON.stringify(t.id)}${configArg});`;

      // Event listeners — target guard is baked into thing.on(), no manual matchTarget
      const evEntries = Object.entries(t.events ?? {})
        .filter(([key, steps]) => !_LIFECYCLE_KEYS.has(key) && Array.isArray(steps) && steps.length > 0)
        .map(([key, steps]) =>
          `    ${varName}.on(${JSON.stringify(key)}, async ({ event, data, room }) => {
      await runPayload(${JSON.stringify(steps, null, 6)});
    });`
        ).join('\n');

      // Collect thing lifecycle payloads for inline execution
      if (t.events?.Enter?.length) thingOnEnterBlocks.push(t.events.Enter);
      if (t.events?.Exit?.length)  thingOnExitPayloads.push(t.events.Exit);

      return `${instantiation}\n${evEntries}`;
    }),
  ].join('\n');

  // thing Enter inline calls (one await per thing that has Enter)
  const thingOnEnterCode = thingOnEnterBlocks
    .map(steps => `    await runPayload(${JSON.stringify(steps, null, 4)});`)
    .join('\n');

  // Build a minimal import list — only pull in the Thing classes actually used on this page
  const thingTypes = [...new Set(things.map(t => t.type))];
  const importLine = things.length > 0
    ? `import { Inventory, Navigator, Actions, Bus, runPayload, route, User, Media, Room, Things, Input, ${thingTypes.join(', ')} } from './js/runtime/index.js';`
    : `import { Inventory, Navigator, Actions, Bus, runPayload, route, User, Media, Room, Input } from './js/runtime/index.js';`;

  // Room.exits() — declare all exits in one call.
  // The onExit callback runs thing Exit payloads then the room Exit payload.
  let exitsCode = '';
  if (navEntries.length > 0) {
    // Right-align labels for readability
    const maxLen  = Math.max(...navEntries.map(e => String(e.label ?? e.id).length));
    const entries = navEntries
      .map(e => {
        const label = String(e.label ?? e.id);
        const pad   = ' '.repeat(maxLen - label.length);
        return `      { id: ${JSON.stringify(e.id)}, label: ${JSON.stringify(label)}${pad} }`;
      })
      .join(',\n');

    const exitSteps = [
      ...thingOnExitPayloads.map(steps => `      await runPayload(${JSON.stringify(steps)});`),
      ...(onExit.length ? [`      await runPayload(${JSON.stringify(onExit)});`] : []),
    ];

    const onExitArg = exitSteps.length
      ? `, async () => {\n${exitSteps.join('\n')}\n    }`
      : '';

    exitsCode = `    Room.exits([\n${entries},\n    ]${onExitArg});`;
  }

  return `  <script type="module">
    ${importLine}

${!isTerminal && exitsCode ? `${exitsCode}\n` : ''}${thingsBlock ? `\n${thingsBlock}\n` : ''}${roomListeners ? `\n    // Room event listeners\n${roomListeners}\n` : ''}${thingOnEnterCode ? `\n    // Thing Enter payloads\n${thingOnEnterCode}\n` : ''}
${onEnter.length ? `    // Enter
    await runPayload(${JSON.stringify(onEnter, null, 4)});
` : ''}
  </script>`;
}
