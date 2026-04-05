/**
 * undercity-map.js — <undercity-map> Web Component
 *
 * Industry-standard ZUI (Zooming User Interface) implemented as a Web Component.
 *
 *   ● Room   — circle, cyan border
 *   ◆ Diamond   — rotated rect, yellow border
 *   ◎ Terminal  — double circle, green border
 *
 * Tools: select | room | diamond | terminal | connect | delete
 *
 * ZUI model:
 *   A single <g class="scene"> carries transform="translate(tx,ty) scale(s)".
 *   All world coordinates live inside scene. screenToWorld converts pointer
 *   coordinates by inverting the transform: wx = (sx - tx) / scale.
 *
 * Events (via .on() Emitter API, same as old MapBuilder):
 *   nodeSelected(node)
 *   nodeDeselected()
 *   nodeDoubleClicked(node)
 *   edgeCreated(edge)
 *   contextMenu({ node, x, y })
 *
 * Public API:
 *   setGraph(graph)    — wire up a Graph instance
 *   setTool(name)      — 'select' | 'room' | 'diamond' | 'terminal' | 'connect' | 'delete'
 *   fitView()          — zoom/pan to fit all nodes
 *   selectNode(id)     — programmatically select a node
 *   deselect()         — clear selection
 *   selectedNode       — getter, returns selected GraphNode or null
 *   dispose()          — clean up subscriptions
 */

import { Emitter } from '/src/lib/signal.js';
import { Scope }   from '/src/lib/scope.js';
import { NodeType } from '/src/ide/graph.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SVG_NS          = 'http://www.w3.org/2000/svg';
const GRID            = 40;
const NODE_R          = 18;   // room / terminal outer radius
const DIA_H           = 20;   // diamond half-height
const MIN_SCALE       = 0.08;
const MAX_SCALE       = 12;
const ARROW_LEN       = 10;
const ARROW_WID       = 5;
const MIN_PLACE_DIST  = 50;   // minimum world-px between nodes when placing
const LABEL_OFFSET_Y  = NODE_R + 14; // pixels below shape centre

// ── Shadow DOM CSS ────────────────────────────────────────────────────────────

const SHADOW_CSS = /* css */`
:host {
  display: block;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}
:host(.mode-room),
:host(.mode-diamond),
:host(.mode-terminal) { cursor: crosshair; }
:host(.mode-connect)  { cursor: cell; }
:host(.mode-delete)   { cursor: not-allowed; }
:host(.dragging)      { cursor: grabbing; }

svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ── Node shapes ── */
.node-room circle.body   { fill: var(--sol-base02); stroke: var(--sol-cyan);   stroke-width: 2.5; }
.node-diamond  .body        { fill: var(--sol-base02); stroke: var(--sol-yellow); stroke-width: 2.5; }
.node-terminal circle.body  { fill: var(--sol-base02); stroke: var(--sol-green);  stroke-width: 2.5; }
.node-terminal circle.inner { fill: none;              stroke: var(--sol-green);  stroke-width: 1.5; }

/* Entry (Lobby) room — colored fill so it stands out */
.node-room.entry circle.body {
  fill: color-mix(in srgb, var(--sol-cyan) 22%, var(--sol-base02));
  stroke: var(--sol-cyan);
  stroke-width: 3.5;
}

/* Thing satellite dots inside the room circle */
.thing-dot { pointer-events: none; }

/* LoD: thing dots hidden at low zoom, shown when lod-near */
.thing-dot { display: none; }
svg.lod-near .thing-dot { display: block; }

.node-group { cursor: pointer; }
.node-group:hover .body { stroke-width: 3.5; }
.node-group.selected .body {
  stroke-width: 3.5;
  filter: drop-shadow(0 0 6px currentColor);
}

/* ── Labels ── */
.node-label {
  font: bold 11px/1 system-ui;
  fill: var(--sol-base1);
  text-anchor: middle;
  dominant-baseline: hanging;
  pointer-events: none;
}
.edge-label {
  font: 10px system-ui;
  fill: var(--text-muted, #586e75);
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}

/* ── Edges ── */
.edge-line  { fill: none; stroke: var(--sol-base01); stroke-width: 2; stroke-linecap: round; }
.edge-arrow { fill: var(--sol-base01); stroke: none; }
.edge-hit   { fill: none; stroke: transparent; stroke-width: 14; cursor: pointer; }
.edge-line.edge-selected  { stroke: var(--sol-cyan); stroke-width: 3; }
.edge-arrow.edge-selected { fill: var(--sol-cyan); }
.temp-edge  { fill: none; stroke: var(--sol-cyan); stroke-width: 2; stroke-dasharray: 6 4; pointer-events: none; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function svgEl(tag)         { return document.createElementNS(SVG_NS, tag); }
function attr(el, obj)      { for (const [k, v] of Object.entries(obj)) el.setAttribute(k, v); }
function snap(v)            { return Math.round(v / GRID) * GRID; }
function clamp(v, lo, hi)   { return Math.max(lo, Math.min(hi, v)); }

/** Compute arrowhead polygon points at (tx,ty) coming from direction (dx,dy). */
function arrowPoints(dx, dy, tx, ty) {
  const angle = Math.atan2(dy, dx);
  const lx = tx - ARROW_LEN * Math.cos(angle - ARROW_WID / ARROW_LEN);
  const ly = ty - ARROW_LEN * Math.sin(angle - ARROW_WID / ARROW_LEN);
  const rx = tx - ARROW_LEN * Math.cos(angle + ARROW_WID / ARROW_LEN);
  const ry = ty - ARROW_LEN * Math.sin(angle + ARROW_WID / ARROW_LEN);
  return `${tx},${ty} ${lx},${ly} ${rx},${ry}`;
}

/** Find the nearest [data-nid] ancestor of the event target. Works for pointer events WITHOUT capture. */
function findNodeId(e) {
  return e.target.closest?.('[data-nid]')?.dataset?.nid ?? null;
}

/** Find the nearest [data-eid] ancestor of the event target. Works for pointer events WITHOUT capture. */
function findEdgeId(e) {
  return e.target.closest?.('[data-eid]')?.dataset?.eid ?? null;
}

// ── UndercityMap Web Component ──────────────────────────────────────────────────

class UndercityMap extends HTMLElement {

  // ── Emitter proxy (keep same .on() API as old MapBuilder) ─────────────────
  #emitter = new Emitter();
  on(evt, fn)   { return this.#emitter.on(evt, fn); }
  emit(evt, d)  { this.#emitter.emit(evt, d); }

  // ── ZUI state ──────────────────────────────────────────────────────────────
  #tx = 0;  #ty = 0;  #scale = 1;
  #initialCentered = false;

  // ── Graph / reactive bindings ──────────────────────────────────────────────
  #graph = null;
  #scope = new Scope();

  // ── Tool ───────────────────────────────────────────────────────────────────
  #tool = 'select';

  // ── Pointer drag state ─────────────────────────────────────────────────────
  #dragNode   = null;
  #dragOffset = { x: 0, y: 0 };
  #panning    = false;
  #panStart   = { x: 0, y: 0, tx: 0, ty: 0 };

  // ── Connect state ──────────────────────────────────────────────────────────
  #connecting = false;
  #connFrom   = null;
  #tempLine   = null;

  // ── Drag change tracking (for undo) ────────────────────────────────────────
  #dragMoved  = false;

  // ── Edge selection ─────────────────────────────────────────────────────────
  #selectedEdge = null;

  // ── Selection ──────────────────────────────────────────────────────────────
  #selected = null;

  // ── DOM element maps ───────────────────────────────────────────────────────
  #nodeEls = new Map();  // nodeId → { group, shape, label }
  #edgeEls = new Map();  // edgeId → { line, arrow, label }

  // ── SVG elements (created in connectedCallback) ────────────────────────────
  #svg;
  #scene;
  #layerEdges;
  #layerNodes;
  #layerLabels;
  #layerTemp;

  // ── ResizeObserver ─────────────────────────────────────────────────────────
  #ro;

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  connectedCallback() {
    if (this.shadowRoot) return;  // guard against re-connection

    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    shadow.appendChild(style);

    const svg = svgEl('svg');
    this.#svg = svg;
    shadow.appendChild(svg);

    this.#buildDefs(svg);
    this.#buildScene(svg);
    this.#applyTransform();
    this.#bindPointerEvents();
    this.#bindWheelEvents();

    this.#ro = new ResizeObserver(() => this.#onResize());
    this.#ro.observe(this);
  }

  disconnectedCallback() {
    this.#ro?.disconnect();
    this.dispose();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SVG setup
  // ═══════════════════════════════════════════════════════════════════════════

  #buildDefs(svg) {
    const defs = svgEl('defs');

    // ── Infinite grid: minor (40px) + major (200px) patterns ───────────────
    //
    // Both use patternUnits="userSpaceOnUse" so they live in world coordinates.
    // The patterns are applied to a huge rect inside the scene group, so they
    // automatically move and scale with the scene transform — no re-render needed.

    const pMinor = svgEl('pattern');
    attr(pMinor, { id: 'pw-grid-minor', width: GRID, height: GRID,
                   patternUnits: 'userSpaceOnUse' });
    const ml = svgEl('line');
    attr(ml, { x1: 0, y1: 0, x2: GRID, y2: 0,
               stroke: 'var(--sol-base02)', 'stroke-width': 0.5, opacity: 0.8 });
    const mv = svgEl('line');
    attr(mv, { x1: 0, y1: 0, x2: 0, y2: GRID,
               stroke: 'var(--sol-base02)', 'stroke-width': 0.5, opacity: 0.8 });
    pMinor.appendChild(ml);
    pMinor.appendChild(mv);
    defs.appendChild(pMinor);

    const pMajor = svgEl('pattern');
    attr(pMajor, { id: 'pw-grid-major', width: GRID * 5, height: GRID * 5,
                   patternUnits: 'userSpaceOnUse' });
    const mbg = svgEl('rect');
    attr(mbg, { width: GRID * 5, height: GRID * 5, fill: 'url(#pw-grid-minor)' });
    const majH = svgEl('line');
    attr(majH, { x1: 0, y1: 0, x2: GRID * 5, y2: 0,
                 stroke: 'var(--sol-base01)', 'stroke-width': 0.8, opacity: 0.5 });
    const majV = svgEl('line');
    attr(majV, { x1: 0, y1: 0, x2: 0, y2: GRID * 5,
                 stroke: 'var(--sol-base01)', 'stroke-width': 0.8, opacity: 0.5 });
    pMajor.appendChild(mbg);
    pMajor.appendChild(majH);
    pMajor.appendChild(majV);
    defs.appendChild(pMajor);

    svg.appendChild(defs);
  }

  #buildScene(svg) {
    const scene = svgEl('g');
    scene.classList.add('scene');
    this.#scene = scene;
    svg.appendChild(scene);

    // Grid background rect — enormous so the infinite grid always fills the view
    const bg = svgEl('rect');
    attr(bg, { x: -100000, y: -100000, width: 200000, height: 200000,
               fill: 'var(--sol-base03)' });
    scene.appendChild(bg);

    const grid = svgEl('rect');
    attr(grid, { x: -100000, y: -100000, width: 200000, height: 200000,
                 fill: 'url(#pw-grid-major)' });
    scene.appendChild(grid);

    // Layered render order: edges → nodes → labels → temp
    this.#layerEdges  = this.#addLayer('layer-edges');
    this.#layerNodes  = this.#addLayer('layer-nodes');
    this.#layerLabels = this.#addLayer('layer-labels');
    this.#layerTemp   = this.#addLayer('layer-temp');
  }

  #addLayer(id) {
    const g = svgEl('g');
    g.id = id;
    this.#scene.appendChild(g);
    return g;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Resize
  // ═══════════════════════════════════════════════════════════════════════════

  #onResize() {
    // SVG fills 100%/100% via CSS — sizing is automatic.
    // On first resize, centre the world origin in the viewport so the grid
    // looks good before any graph is loaded.
    if (!this.#initialCentered) {
      const W = this.clientWidth;
      const H = this.clientHeight;
      if (W > 0 && H > 0) {
        this.#tx = W / 2;
        this.#ty = H / 2;
        this.#applyTransform();
        this.#initialCentered = true;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Transform
  // ═══════════════════════════════════════════════════════════════════════════

  #applyTransform() {
    this.#scene.setAttribute(
      'transform',
      `translate(${this.#tx},${this.#ty}) scale(${this.#scale})`,
    );
    // Level-of-Detail: reveal thing dots when zoomed in enough
    this.#svg.classList.toggle('lod-near', this.#scale >= 1.2);
  }

  /**
   * Hit-test using shadowRoot.elementsFromPoint — safe to call AFTER pointer capture is set,
   * because elementsFromPoint ignores capture and always returns what's visually at that point.
   */
  #nodeIdAtPoint(clientX, clientY) {
    const els = this.shadowRoot?.elementsFromPoint(clientX, clientY) ?? [];
    for (const el of els) {
      const nid = el.dataset?.nid ?? el.closest?.('[data-nid]')?.dataset?.nid;
      if (nid) return nid;
    }
    return null;
  }

  #edgeIdAtPoint(clientX, clientY) {
    const els = this.shadowRoot?.elementsFromPoint(clientX, clientY) ?? [];
    for (const el of els) {
      const eid = el.dataset?.eid ?? el.closest?.('[data-eid]')?.dataset?.eid;
      if (eid) return eid;
    }
    return null;
  }

  /** Convert a screen (client) point to world coordinates. */
  #screenToWorld(clientX, clientY) {
    const rect = this.#svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.#tx) / this.#scale,
      y: (clientY - rect.top  - this.#ty) / this.#scale,
    };
  }

  /** Zoom by factor around a screen point (clientX, clientY). */
  #zoom(factor, clientX, clientY) {
    const rect = this.#svg.getBoundingClientRect();
    const sx   = clientX - rect.left;
    const sy   = clientY - rect.top;
    // World point under the cursor
    const wx   = (sx - this.#tx) / this.#scale;
    const wy   = (sy - this.#ty) / this.#scale;
    this.#scale = clamp(this.#scale * factor, MIN_SCALE, MAX_SCALE);
    // Keep the same world point under the cursor
    this.#tx = sx - wx * this.#scale;
    this.#ty = sy - wy * this.#scale;
    this.#applyTransform();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Input events
  // ═══════════════════════════════════════════════════════════════════════════

  #bindPointerEvents() {
    const s = this.#svg;
    s.addEventListener('pointerdown',   e => this.#onPointerDown(e));
    s.addEventListener('pointermove',   e => this.#onPointerMove(e));
    s.addEventListener('pointerup',     e => this.#onPointerUp(e));
    s.addEventListener('pointercancel', e => this.#onPointerUp(e));
    s.addEventListener('contextmenu',   e => this.#onContextMenu(e));
    s.addEventListener('dblclick',      e => this.#onDblClick(e));
  }

  #bindWheelEvents() {
    // Must be non-passive to call preventDefault and stop page scroll
    this.#svg.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
      this.#zoom(factor, e.clientX, e.clientY);
    }, { passive: false });
  }

  #onPointerDown(e) {
    if (e.button !== 0) return;
    // Flush any pending input change before preventDefault() suppresses focus
    // transfer. Without this, an input that the user just finished typing in
    // would never receive blur → change, so its value would be lost when the
    // workspace is cleared by the nodeDeselected / nodeSelected handlers.
    document.activeElement?.blur();
    e.preventDefault();
    this.#svg.setPointerCapture(e.pointerId);

    const pos    = this.#screenToWorld(e.clientX, e.clientY);
    const nodeId = findNodeId(e);
    const node   = nodeId ? this.#graph?.nodes.get(nodeId) : null;

    switch (this.#tool) {
      case 'connect':
        if (node) this.#startConnect(node, pos);
        return;

      case 'select':
        if (node) {
          this.#deselectEdge();
          this.#selectNode(node);
          this.#dragNode   = node;
          this.#dragMoved  = false;
          this.#dragOffset = { x: pos.x - node.x.value, y: pos.y - node.y.value };
        } else {
          this.#deselectNode();
          // Check for edge click before starting pan
          const edgeId = findEdgeId(e);
          if (edgeId) {
            const edge = this.#graph?.edges.get(edgeId);
            if (edge) { this.#selectEdge(edge); return; }
          }
          this.#deselectEdge();
          this.#panning  = true;
          this.#panStart = { x: e.clientX, y: e.clientY, tx: this.#tx, ty: this.#ty };
          this.classList.add('dragging');
        }
        return;

      case 'room':
      case 'diamond':
      case 'terminal': {
        const sx = snap(pos.x), sy = snap(pos.y);
        // Guard: don't stack nodes on top of each other
        const tooClose = [...(this.#graph?.nodes.values() ?? [])].some(n => {
          return Math.hypot(n.x.value - sx, n.y.value - sy) < MIN_PLACE_DIST;
        });
        if (!tooClose) {
          this.emit('beforeChange');
          this.#graph?.addNode({ type: this.#tool, x: sx, y: sy });
        }
        return;
      }

      case 'delete':
        if (node) {
          this.emit('beforeChange');
          this.#graph?.removeNode(nodeId);
        } else {
          const delEdgeId = findEdgeId(e);
          if (delEdgeId) { this.emit('beforeChange'); this.#graph?.removeEdge(delEdgeId); }
        }
        return;
    }
  }

  #onPointerMove(e) {
    if (this.#dragNode) {
      const pos = this.#screenToWorld(e.clientX, e.clientY);
      const nx  = snap(pos.x - this.#dragOffset.x);
      const ny  = snap(pos.y - this.#dragOffset.y);
      // Emit beforeChange on the FIRST actual pixel of movement (not on every move)
      if (!this.#dragMoved && (nx !== this.#dragNode.x.value || ny !== this.#dragNode.y.value)) {
        this.#dragMoved = true;
        this.emit('beforeChange');
      }
      this.#dragNode.x.value = nx;
      this.#dragNode.y.value = ny;
      this.#refreshEdgesForNode(this.#dragNode.id);
      return;
    }

    if (this.#panning) {
      this.#tx = this.#panStart.tx + (e.clientX - this.#panStart.x);
      this.#ty = this.#panStart.ty + (e.clientY - this.#panStart.y);
      this.#applyTransform();
      return;
    }

    if (this.#connecting && this.#tempLine) {
      const pos = this.#screenToWorld(e.clientX, e.clientY);
      attr(this.#tempLine, { x2: pos.x, y2: pos.y });
    }
  }

  #onPointerUp(e) {
    try { this.#svg.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

    if (this.#dragNode) {
      this.#dragNode = null;
      return;
    }

    if (this.#panning) {
      this.#panning = false;
      this.classList.remove('dragging');
      return;
    }

    if (this.#connecting) {
      // IMPORTANT: e.target is the pointer-captured SVG, NOT the element under the cursor.
      // Use shadowRoot.elementsFromPoint to find the actual node under the mouse.
      const nodeId = this.#nodeIdAtPoint(e.clientX, e.clientY);
      if (nodeId && nodeId !== this.#connFrom?.id) {
        this.emit('beforeChange');
        const edge = this.#graph.addEdge(this.#connFrom.id, nodeId);
        this.emit('edgeCreated', edge);
      }
      this.#cancelConnect();
    }
  }

  #onContextMenu(e) {
    e.preventDefault();
    const nodeId = findNodeId(e);
    if (!nodeId) return;
    const node = this.#graph?.nodes.get(nodeId);
    if (node) this.emit('contextMenu', { node, x: e.clientX, y: e.clientY });
  }

  #onDblClick(e) {
    const nodeId = findNodeId(e);
    if (!nodeId) return;
    const node = this.#graph?.nodes.get(nodeId);
    if (node) this.emit('nodeDoubleClicked', node);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Connect tool
  // ═══════════════════════════════════════════════════════════════════════════

  #startConnect(node, pos) {
    this.#connecting = true;
    this.#connFrom   = node;
    this.#tempLine   = svgEl('line');
    attr(this.#tempLine, {
      class: 'temp-edge',
      x1: node.x.value, y1: node.y.value,
      x2: pos.x,        y2: pos.y,
    });
    this.#layerTemp.appendChild(this.#tempLine);
  }

  #cancelConnect() {
    this.#connecting = false;
    this.#connFrom   = null;
    this.#tempLine?.remove();
    this.#tempLine   = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Selection
  // ═══════════════════════════════════════════════════════════════════════════

  #selectNode(node) {
    if (this.#selected?.id === node.id) return;
    this.#deselectNode();
    this.#selected = node;
    this.#nodeEls.get(node.id)?.group.classList.add('selected');
    this.emit('nodeSelected', node);
  }

  #deselectNode() {
    if (!this.#selected) return;
    this.#nodeEls.get(this.#selected.id)?.group.classList.remove('selected');
    this.#selected = null;
    this.emit('nodeDeselected');
  }

  selectNode(id) {
    const node = this.#graph?.nodes.get(id);
    if (node) this.#selectNode(node);
  }

  deselect() { this.#deselectNode(); this.#deselectEdge(); }

  get selectedNode() { return this.#selected; }
  get selectedEdge() { return this.#selectedEdge; }

  #selectEdge(edge) {
    if (this.#selectedEdge?.id === edge.id) return;
    this.#deselectEdge();
    this.#selectedEdge = edge;
    const els = this.#edgeEls.get(edge.id);
    if (els) {
      els.line.classList.add('edge-selected');
      els.arrow.classList.add('edge-selected');
    }
    this.emit('edgeSelected', edge);
  }

  #deselectEdge() {
    if (!this.#selectedEdge) return;
    const els = this.#edgeEls.get(this.#selectedEdge.id);
    if (els) {
      els.line.classList.remove('edge-selected');
      els.arrow.classList.remove('edge-selected');
    }
    this.#selectedEdge = null;
    this.emit('edgeDeselected');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Graph wiring
  // ═══════════════════════════════════════════════════════════════════════════

  setGraph(graph) {
    this.#scope.scope('graph').dispose();
    this.#clearAll();
    this.#graph = graph;
    if (!graph) return;

    const gs = this.#scope.scope('graph');
    gs.add(graph.on('nodeAdded',    n      => this.#renderNode(n)));
    gs.add(graph.on('nodeUpdated',  n      => this.#refreshNode(n)));
    gs.add(graph.on('nodeRemoved',  ({id}) => this.#removeNodeEl(id)));
    gs.add(graph.on('edgeAdded',    e      => this.#renderEdge(e)));
    gs.add(graph.on('edgeRemoved',  ({id}) => this.#removeEdgeEl(id)));
    gs.add(graph.on('entryChanged', ()     => this.#refreshAllEntryBadges()));
    gs.add(graph.on('graphLoaded',  ()     => this.#renderAll()));

    this.#renderAll();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Node rendering
  // ═══════════════════════════════════════════════════════════════════════════

  #renderNode(node) {
    // Group (hit-target for all pointer events on this node)
    const group = svgEl('g');
    group.classList.add('node-group', `node-${node.type}`);
    if (node.meta?.isEntry) group.classList.add('entry');
    attr(group, { 'data-nid': node.id });
    group.appendChild(this.#makeShape(node));

    // Thing dots — small satellites inside the room circle
    if (node.type === NodeType.ROOM && node.things) {
      this.#renderThingDots(group, node);
    }

    this.#layerNodes.appendChild(group);

    // Label lives in its own layer (above edges), positioned below the shape
    const label = svgEl('text');
    label.classList.add('node-label');
    attr(label, { x: node.x.value, y: node.y.value + LABEL_OFFSET_Y, 'data-nid': node.id });
    label.textContent = node.label.value;
    this.#layerLabels.appendChild(label);

    // Reactive signal subscriptions
    const shape = group.firstElementChild;
    const scope = this.#scope.scope(`node-${node.id}`);

    scope.add(node.x.subscribe(nx => {
      this.#updateShapePos(node, shape, nx, node.y.value);
      attr(label, { x: nx });
      this.#refreshEdgesForNode(node.id);
      if (node.type === NodeType.ROOM && node.things) {
        group.querySelectorAll('.thing-dot').forEach(d => d.remove());
        this.#renderThingDots(group, node);
      }
    }, false));

    scope.add(node.y.subscribe(ny => {
      this.#updateShapePos(node, shape, node.x.value, ny);
      attr(label, { y: ny + LABEL_OFFSET_Y });
      this.#refreshEdgesForNode(node.id);
      if (node.type === NodeType.ROOM && node.things) {
        group.querySelectorAll('.thing-dot').forEach(d => d.remove());
        this.#renderThingDots(group, node);
      }
    }, false));

    scope.add(node.label.subscribe(lbl => { label.textContent = lbl; }, false));

    // Push: redraw thing dots when things array changes
    if (node.type === NodeType.ROOM && node.things) {
      scope.add(node.things.subscribe(() => {
        group.querySelectorAll('.thing-dot').forEach(d => d.remove());
        this.#renderThingDots(group, node);
      }, false));
    }

    this.#nodeEls.set(node.id, { group, shape, label });
  }

  /** Render small satellite circles for each Thing inside a room. */
  #renderThingDots(group, node) {
    const things = node.things.peek();
    if (!things.length) return;
    const x = node.x.value, y = node.y.value;
    const n = things.length;
    const dotR  = 3.5;
    const orbit = NODE_R - dotR - 2;   // keep dots inside the room circle

    // Spread dots evenly around a small arc at the bottom of the circle
    const startAngle = Math.PI * 0.55;
    const endAngle   = Math.PI * 0.95;
    things.forEach((t, i) => {
      const angle = n === 1
        ? Math.PI * 0.75
        : startAngle + (endAngle - startAngle) * (i / (n - 1));
      const cx = x + Math.cos(angle) * orbit;
      const cy = y + Math.sin(angle) * orbit;
      const dot = svgEl('circle');
      dot.classList.add('thing-dot');
      // Color from THING_LIBRARY if available (resolved in CSS var)
      const colorMap = {
        WorkflowThing:       'var(--sol-green)',
        PersonaLiveThing:    'var(--sol-violet)',
        AuthServerThing:     'var(--sol-blue)',
        TestAuthServerThing: 'var(--sol-cyan)',
      };
      attr(dot, { cx, cy, r: dotR, fill: colorMap[t.type] ?? 'var(--sol-orange)', stroke: 'none' });
      group.appendChild(dot);
    });
  }

  #makeShape(node) {
    const x = node.x.value, y = node.y.value;
    switch (node.type) {
      case NodeType.ROOM: {
        const c = svgEl('circle');
        attr(c, { cx: x, cy: y, r: NODE_R, class: 'body' });
        return c;
      }
      case NodeType.DIAMOND: {
        const p = svgEl('polygon');
        p.classList.add('body');
        this.#setDiamondPoints(p, x, y);
        return p;
      }
      case NodeType.TERMINAL: {
        const g = svgEl('g');
        const outer = svgEl('circle');
        attr(outer, { cx: x, cy: y, r: NODE_R,     class: 'body' });
        const inner = svgEl('circle');
        attr(inner, { cx: x, cy: y, r: NODE_R - 5, class: 'inner' });
        g.appendChild(outer);
        g.appendChild(inner);
        return g;
      }
      default: {
        const c = svgEl('circle');
        attr(c, { cx: x, cy: y, r: NODE_R, class: 'body' });
        return c;
      }
    }
  }

  #setDiamondPoints(poly, x, y) {
    const w = DIA_H * 1.6, h = DIA_H;
    attr(poly, { points: `${x},${y-h} ${x+w},${y} ${x},${y+h} ${x-w},${y}` });
  }

  #updateShapePos(node, shape, x, y) {
    switch (node.type) {
      case NodeType.ROOM:
        attr(shape, { cx: x, cy: y });
        break;
      case NodeType.DIAMOND:
        this.#setDiamondPoints(shape, x, y);
        break;
      case NodeType.TERMINAL:
        attr(shape.children[0], { cx: x, cy: y });
        attr(shape.children[1], { cx: x, cy: y });
        break;
    }
  }

  #refreshNode(node) {
    this.#removeNodeEl(node.id);
    this.#renderNode(node);
    this.#refreshEdgesForNode(node.id);
  }

  #removeNodeEl(id) {
    const els = this.#nodeEls.get(id);
    if (!els) return;
    els.group.remove();
    els.label.remove();
    this.#nodeEls.delete(id);
    this.#scope.scope(`node-${id}`).dispose();
    if (this.#selected?.id === id) {
      this.#selected = null;
      this.emit('nodeDeselected');
    }
  }

  #refreshAllEntryBadges() {
    for (const node of (this.#graph?.nodes.values() ?? [])) {
      const els = this.#nodeEls.get(node.id);
      if (!els) continue;
      els.group.classList.toggle('entry', !!node.meta?.isEntry);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge rendering
  //
  // We draw arrowheads as inline <polygon> elements rather than SVG markers
  // because marker-end url(#id) references do not resolve inside a shadow root.
  // ═══════════════════════════════════════════════════════════════════════════

  #renderEdge(edge) {
    const from = this.#graph?.nodes.get(edge.fromId);
    const to   = this.#graph?.nodes.get(edge.toId);
    if (!from || !to) return;

    const line = svgEl('line');
    line.classList.add('edge-line');
    attr(line, { 'data-eid': edge.id, 'stroke-width': 2 });

    const arrow = svgEl('polygon');
    arrow.classList.add('edge-arrow');

    // Wide transparent hit area makes the thin line much easier to click/select
    const hitLine = svgEl('line');
    hitLine.classList.add('edge-hit');
    attr(hitLine, { 'data-eid': edge.id });

    this.#updateEdgeGeom(line, arrow, hitLine, from, to);

    const midX = (from.x.value + to.x.value) / 2;
    const midY = (from.y.value + to.y.value) / 2;

    const label = svgEl('text');
    label.classList.add('edge-label');
    attr(label, { x: midX, y: midY - 8 });
    label.textContent = edge.label.value;

    this.#layerEdges.appendChild(line);
    this.#layerEdges.appendChild(arrow);
    this.#layerEdges.appendChild(hitLine);  // on top for pointer events
    this.#layerLabels.appendChild(label);

    const scope = this.#scope.scope(`edge-${edge.id}`);
    scope.add(edge.label.subscribe(lbl => { label.textContent = lbl; }, false));

    this.#edgeEls.set(edge.id, { line, arrow, hitLine, label });
  }

  /** Compute line endpoints (shortened so they don't overlap node shapes) and arrowhead. */
  #updateEdgeGeom(line, arrow, hitLine, from, to) {
    const dx = to.x.value - from.x.value;
    const dy = to.y.value - from.y.value;
    const d  = Math.hypot(dx, dy) || 1;
    const r1 = from.type === NodeType.DIAMOND ? DIA_H * 1.6 : NODE_R;
    const r2 = to.type   === NodeType.DIAMOND ? DIA_H * 1.6 : NODE_R + 4;

    const x1 = from.x.value + (dx / d) * r1;
    const y1 = from.y.value + (dy / d) * r1;
    const x2 = to.x.value   - (dx / d) * r2;
    const y2 = to.y.value   - (dy / d) * r2;

    attr(line,    { x1, y1, x2, y2 });
    attr(arrow,   { points: arrowPoints(dx, dy, x2, y2) });
    if (hitLine) attr(hitLine, { x1, y1, x2, y2 });
  }

  #refreshEdgesForNode(nodeId) {
    for (const [eid, edge] of (this.#graph?.edges ?? new Map())) {
      if (edge.fromId !== nodeId && edge.toId !== nodeId) continue;
      const from = this.#graph.nodes.get(edge.fromId);
      const to   = this.#graph.nodes.get(edge.toId);
      const els  = this.#edgeEls.get(eid);
      if (!from || !to || !els) continue;
      this.#updateEdgeGeom(els.line, els.arrow, els.hitLine, from, to);
      const midX = (from.x.value + to.x.value) / 2;
      const midY = (from.y.value + to.y.value) / 2;
      attr(els.label, { x: midX, y: midY - 8 });
    }
  }

  #removeEdgeEl(id) {
    const els = this.#edgeEls.get(id);
    if (!els) return;
    els.line.remove();
    els.arrow.remove();
    els.hitLine?.remove();
    els.label.remove();
    this.#edgeEls.delete(id);
    this.#scope.scope(`edge-${id}`).dispose();
    if (this.#selectedEdge?.id === id) {
      this.#selectedEdge = null;
      this.emit('edgeDeselected');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Bulk render
  // ═══════════════════════════════════════════════════════════════════════════

  #renderAll() {
    this.#clearAll();
    if (!this.#graph) return;
    for (const node of this.#graph.nodes.values()) this.#renderNode(node);
    for (const edge of this.#graph.edges.values()) this.#renderEdge(edge);
  }

  #clearAll() {
    if (!this.#layerNodes) return;  // not yet connected
    this.#layerNodes.innerHTML  = '';
    this.#layerEdges.innerHTML  = '';
    this.#layerLabels.innerHTML = '';
    this.#nodeEls.clear();
    this.#edgeEls.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  setTool(tool) {
    this.#tool = tool;
    for (const cls of [...this.classList]) {
      if (cls.startsWith('mode-')) this.classList.remove(cls);
    }
    if (tool !== 'select') this.classList.add(`mode-${tool}`);
    this.#cancelConnect();
  }

  fitView() {
    if (!this.#graph || this.#graph.nodes.size === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.#graph.nodes.values()) {
      minX = Math.min(minX, n.x.value); minY = Math.min(minY, n.y.value);
      maxX = Math.max(maxX, n.x.value); maxY = Math.max(maxY, n.y.value);
    }

    const W   = this.clientWidth  || 800;
    const H   = this.clientHeight || 600;
    const pad = 100;
    const gW  = maxX - minX + pad * 2;
    const gH  = maxY - minY + pad * 2;

    this.#scale = clamp(Math.min(W / gW, H / gH), MIN_SCALE, MAX_SCALE);
    this.#tx    = W / 2 - ((minX + maxX) / 2) * this.#scale;
    this.#ty    = H / 2 - ((minY + maxY) / 2) * this.#scale;
    this.#applyTransform();
  }

  dispose() {
    this.#scope.dispose();
  }
}

customElements.define('undercity-map', UndercityMap);
