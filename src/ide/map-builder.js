/**
 * map-builder.js — SVG map builder for the Undercity IDE.
 *
 * Renders the flow graph as a zoomable/pannable SVG with:
 *   ●  Room   — circle, cyan border
 *   ◆  Diamond   — rotated square, yellow border
 *   ◎  Terminal  — double circle, green border
 *
 * Tools:  select | room | diamond | terminal | connect | delete
 *
 * Events emitted (use .on()):
 *   nodeSelected(node)
 *   nodeDeselected()
 *   nodeDoubleClicked(node)
 *   edgeCreated(edge)
 *   contextMenu({ node, x, y })
 */

import { Emitter, on as domOn, Disposable } from '/src/lib/signal.js';
import { Scope } from '/src/lib/scope.js';
import { Graph, NodeType } from '/src/ide/graph.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GRID   = 40;
const NODE_R = 18;   // room/terminal radius
const DIA_H  = 20;   // diamond half-height
const ENTRY_BADGE_R = 5;

// ── Arrowhead marker ──────────────────────────────────────────────────────────
function makeArrowMarker(svg) {
  const defs = el(SVG_NS, 'defs');
  const marker = el(SVG_NS, 'marker');
  attr(marker, { id: 'arrowhead', markerWidth: 8, markerHeight: 6,
                 refX: 6, refY: 3, orient: 'auto' });
  const poly = el(SVG_NS, 'polygon');
  attr(poly, { points: '0 0, 8 3, 0 6', fill: 'var(--sol-base01)' });
  marker.appendChild(poly);
  defs.appendChild(marker);
  svg.prepend(defs);
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function el(ns, tag) { return document.createElementNS(ns, tag); }
function attr(el, obj) { for (const [k, v] of Object.entries(obj)) el.setAttribute(k, v); }
function snap(v) { return Math.round(v / GRID) * GRID; }

// ── MapBuilder ────────────────────────────────────────────────────────────────
export class MapBuilder extends Emitter {
  /** @type {Graph}          */ graph;
  /** @type {SVGSVGElement}  */ svg;
  /** @type {SVGGElement}    */ layerGrid;
  /** @type {SVGGElement}    */ layerEdges;
  /** @type {SVGGElement}    */ layerNodes;
  /** @type {SVGGElement}    */ layerLabels;
  /** @type {SVGGElement}    */ layerTemp;

  #scope = new Scope();
  #tool  = 'select';
  #viewBox = { x: 0, y: 0, w: 1200, h: 700 };

  // dragging
  #dragNode   = null;
  #dragOffset = { x: 0, y: 0 };
  #panning    = false;
  #panStart   = { x: 0, y: 0, vx: 0, vy: 0 };

  // connecting
  #connecting = false;
  #connFrom   = null;
  #tempLine   = null;

  // selection
  #selected   = null;

  // DOM → graph id maps
  #nodeEls = new Map(); // nodeId → { group, shape, label }
  #edgeEls = new Map(); // edgeId → { line, label }

  constructor(svgEl, graph) {
    super();
    this.svg   = svgEl;
    this.graph = graph;

    this.#buildLayers();
    makeArrowMarker(this.svg);
    this.#applyViewBox();
    this.#renderGrid();
    this.#bindGraphEvents();
    this.#bindSVGEvents();
  }

  // ── Layers ─────────────────────────────────────────────────────────────────
  #buildLayers() {
    for (const id of ['layer-grid','layer-edges','layer-nodes','layer-labels','layer-temp']) {
      const g = el(SVG_NS, 'g');
      g.id = id;
      this.svg.appendChild(g);
    }
    this.layerGrid   = this.svg.querySelector('#layer-grid');
    this.layerEdges  = this.svg.querySelector('#layer-edges');
    this.layerNodes  = this.svg.querySelector('#layer-nodes');
    this.layerLabels = this.svg.querySelector('#layer-labels');
    this.layerTemp   = this.svg.querySelector('#layer-temp');
  }

  // ── Grid ──────────────────────────────────────────────────────────────────
  #renderGrid() {
    this.layerGrid.innerHTML = '';
    const vb = this.#viewBox;
    const pad = GRID * 3;
    const x0 = Math.floor((vb.x - pad) / GRID) * GRID;
    const y0 = Math.floor((vb.y - pad) / GRID) * GRID;
    const x1 = Math.ceil((vb.x + vb.w + pad) / GRID) * GRID;
    const y1 = Math.ceil((vb.y + vb.h + pad) / GRID) * GRID;

    const bg = el(SVG_NS, 'rect');
    attr(bg, { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'var(--sol-base03)' });
    this.layerGrid.appendChild(bg);

    for (let x = x0; x <= x1; x += GRID) {
      const major = x % (GRID * 5) === 0;
      const line = el(SVG_NS, 'line');
      attr(line, { x1: x, y1: y0, x2: x, y2: y1,
                   stroke: major ? 'var(--sol-base01)' : 'var(--sol-base02)',
                   'stroke-width': major ? 0.8 : 0.4, opacity: 0.6 });
      this.layerGrid.appendChild(line);
    }
    for (let y = y0; y <= y1; y += GRID) {
      const major = y % (GRID * 5) === 0;
      const line = el(SVG_NS, 'line');
      attr(line, { x1: x0, y1: y, x2: x1, y2: y,
                   stroke: major ? 'var(--sol-base01)' : 'var(--sol-base02)',
                   'stroke-width': major ? 0.8 : 0.4, opacity: 0.6 });
      this.layerGrid.appendChild(line);
    }
  }

  // ── ViewBox ───────────────────────────────────────────────────────────────
  #applyViewBox() {
    const vb = this.#viewBox;
    this.svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  // ── Graph event wiring ────────────────────────────────────────────────────
  #bindGraphEvents() {
    const g = this.graph;
    this.#scope.add(g.on('nodeAdded',    n    => this.#renderNode(n)));
    this.#scope.add(g.on('nodeUpdated',  n    => this.#refreshNode(n)));
    this.#scope.add(g.on('nodeRemoved',  ({id})=> this.#removeNodeEl(id)));
    this.#scope.add(g.on('edgeAdded',    e    => this.#renderEdge(e)));
    this.#scope.add(g.on('edgeRemoved',  ({id})=> this.#removeEdgeEl(id)));
    this.#scope.add(g.on('entryChanged', ()   => this.#refreshAllEntryBadges()));
    this.#scope.add(g.on('graphLoaded',  ()   => this.#renderAll()));
  }

  // ── SVG event wiring ──────────────────────────────────────────────────────
  #bindSVGEvents() {
    const s = this.svg;
    this.#scope.add(domOn(s, 'mousedown',   e => this.#onMouseDown(e)));
    this.#scope.add(domOn(s, 'mousemove',   e => this.#onMouseMove(e)));
    this.#scope.add(domOn(s, 'mouseup',     e => this.#onMouseUp(e)));
    this.#scope.add(domOn(s, 'wheel',       e => this.#onWheel(e), { passive: false }));
    this.#scope.add(domOn(s, 'contextmenu', e => this.#onContextMenu(e)));
    this.#scope.add(domOn(s, 'dblclick',    e => this.#onDblClick(e)));
  }

  // ── Coordinate helpers ────────────────────────────────────────────────────
  svgPoint(clientX, clientY) {
    const r  = this.svg.getBoundingClientRect();
    const vb = this.#viewBox;
    return {
      x: (clientX - r.left) / r.width  * vb.w + vb.x,
      y: (clientY - r.top)  / r.height * vb.h + vb.y,
    };
  }

  // ── Tool ──────────────────────────────────────────────────────────────────
  setTool(tool) {
    this.#tool = tool;
    this.svg.className.baseVal = this.svg.className.baseVal
      .replace(/mode-\S+/g, '').trim();
    if (tool !== 'select') this.svg.classList.add(`mode-${tool}`);
    this.#cancelConnect();
  }

  // ── Mouse events ──────────────────────────────────────────────────────────
  #onMouseDown(e) {
    if (e.button !== 0) return;
    const pos   = this.svgPoint(e.clientX, e.clientY);
    const nodeId = e.target.closest('[data-nid]')?.dataset.nid;
    const node   = nodeId ? this.graph.nodes.get(nodeId) : null;

    if (this.#tool === 'connect') {
      if (node) { this.#startConnect(node, pos); }
      return;
    }

    if (this.#tool === 'select') {
      if (node) {
        this.#selectNode(node);
        this.#dragNode   = node;
        this.#dragOffset = { x: pos.x - node.x.value, y: pos.y - node.y.value };
        e.preventDefault();
      } else {
        this.#deselectNode();
        this.#panning  = true;
        this.#panStart = { x: e.clientX, y: e.clientY, vx: this.#viewBox.x, vy: this.#viewBox.y };
        this.svg.classList.add('dragging');
        e.preventDefault();
      }
      return;
    }

    // Creation tools
    if (['room','diamond','terminal'].includes(this.#tool)) {
      const sp = { x: snap(pos.x), y: snap(pos.y) };
      this.graph.addNode({ type: this.#tool, x: sp.x, y: sp.y });
    }

    if (this.#tool === 'delete' && node) {
      this.graph.removeNode(nodeId);
    }
  }

  #onMouseMove(e) {
    const pos = this.svgPoint(e.clientX, e.clientY);

    if (this.#dragNode) {
      const nx = snap(pos.x - this.#dragOffset.x);
      const ny = snap(pos.y - this.#dragOffset.y);
      this.#dragNode.x.value = nx;
      this.#dragNode.y.value = ny;
      this.#refreshEdgesForNode(this.#dragNode.id);
      return;
    }

    if (this.#panning) {
      const r  = this.svg.getBoundingClientRect();
      const dx = (e.clientX - this.#panStart.x) / r.width  * this.#viewBox.w;
      const dy = (e.clientY - this.#panStart.y) / r.height * this.#viewBox.h;
      this.#viewBox.x = this.#panStart.vx - dx;
      this.#viewBox.y = this.#panStart.vy - dy;
      this.#applyViewBox();
      this.#renderGrid();
      return;
    }

    if (this.#connecting && this.#tempLine) {
      attr(this.#tempLine, { x2: pos.x, y2: pos.y });
    }
  }

  #onMouseUp(e) {
    if (this.#dragNode) {
      this.#dragNode = null;
      return;
    }

    if (this.#panning) {
      this.#panning = false;
      this.svg.classList.remove('dragging');
      return;
    }

    if (this.#connecting) {
      const nodeId = e.target.closest('[data-nid]')?.dataset.nid;
      if (nodeId && nodeId !== this.#connFrom.id) {
        const edge = this.graph.addEdge(this.#connFrom.id, nodeId);
        this.emit('edgeCreated', edge);
      }
      this.#cancelConnect();
    }
  }

  #onWheel(e) {
    e.preventDefault();
    const pos = this.svgPoint(e.clientX, e.clientY);
    const f   = e.deltaY > 0 ? 1.12 : 0.88;
    const vb  = this.#viewBox;
    vb.w  *= f;
    vb.h  *= f;
    vb.x  += (pos.x - vb.x) * (1 - f);
    vb.y  += (pos.y - vb.y) * (1 - f);
    this.#applyViewBox();
    this.#renderGrid();
  }

  #onContextMenu(e) {
    e.preventDefault();
    const nodeId = e.target.closest('[data-nid]')?.dataset.nid;
    if (!nodeId) return;
    const node = this.graph.nodes.get(nodeId);
    if (!node) return;
    this.emit('contextMenu', { node, x: e.clientX, y: e.clientY });
  }

  #onDblClick(e) {
    const nodeId = e.target.closest('[data-nid]')?.dataset.nid;
    if (!nodeId) return;
    const node = this.graph.nodes.get(nodeId);
    if (node) this.emit('nodeDoubleClicked', node);
  }

  // ── Connection helpers ────────────────────────────────────────────────────
  #startConnect(node, pos) {
    this.#connecting = true;
    this.#connFrom   = node;
    this.#tempLine   = el(SVG_NS, 'line');
    attr(this.#tempLine, { class: 'temp-edge', x1: node.x.value, y1: node.y.value, x2: pos.x, y2: pos.y });
    this.layerTemp.appendChild(this.#tempLine);
  }

  #cancelConnect() {
    this.#connecting = false;
    this.#connFrom   = null;
    this.#tempLine?.remove();
    this.#tempLine   = null;
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  #selectNode(node) {
    if (this.#selected?.id === node.id) return;
    this.#deselectNode();
    this.#selected = node;
    const els = this.#nodeEls.get(node.id);
    els?.group.classList.add('selected');
    this.emit('nodeSelected', node);
  }

  #deselectNode() {
    if (!this.#selected) return;
    const els = this.#nodeEls.get(this.#selected.id);
    els?.group.classList.remove('selected');
    this.#selected = null;
    this.emit('nodeDeselected');
  }

  selectNode(id) {
    const node = this.graph.nodes.get(id);
    if (node) this.#selectNode(node);
  }

  deselect() { this.#deselectNode(); }

  get selectedNode() { return this.#selected; }

  // ── Render: node ─────────────────────────────────────────────────────────
  #renderNode(node) {
    // Group
    const group = el(SVG_NS, 'g');
    group.classList.add('node-group', `node-${node.type}`);
    attr(group, { 'data-nid': node.id, cursor: 'pointer' });

    // Shape
    const shape = this.#makeShape(node);
    group.appendChild(shape);

    // Entry badge
    if (node.meta.isEntry) {
      const badge = this.#makeEntryBadge(node.x.value, node.y.value);
      badge.classList.add('entry-badge');
      group.appendChild(badge);
    }

    this.layerNodes.appendChild(group);

    // Label (separate layer so it sits above edges)
    const label = el(SVG_NS, 'text');
    label.classList.add('node-label');
    attr(label, { x: node.x.value, y: node.y.value + (node.type === NodeType.TERMINAL ? 0 : 0), 'data-nid': node.id, 'pointer-events': 'none' });
    label.textContent = node.label.value;
    this.layerLabels.appendChild(label);

    // Subscribe to signal changes
    const scope = this.#scope.scope(`node-${node.id}`);
    scope.add(node.x.subscribe(nx => {
      this.#updateShapePos(node, shape, nx, node.y.value);
      attr(label, { x: nx });
      this.#refreshEdgesForNode(node.id);
    }, false));
    scope.add(node.y.subscribe(ny => {
      this.#updateShapePos(node, shape, node.x.value, ny);
      attr(label, { y: ny });
      this.#refreshEdgesForNode(node.id);
    }, false));
    scope.add(node.label.subscribe(lbl => { label.textContent = lbl; }, false));

    this.#nodeEls.set(node.id, { group, shape, label });
  }

  #makeShape(node) {
    const x = node.x.value, y = node.y.value;
    switch (node.type) {
      case NodeType.ROOM: {
        const c = el(SVG_NS, 'circle');
        attr(c, { cx: x, cy: y, r: NODE_R, class: 'body' });
        return c;
      }
      case NodeType.DIAMOND: {
        const p = el(SVG_NS, 'polygon');
        p.classList.add('body');
        this.#setDiamondPoints(p, x, y);
        return p;
      }
      case NodeType.TERMINAL: {
        const g = el(SVG_NS, 'g');
        const outer = el(SVG_NS, 'circle');
        attr(outer, { cx: x, cy: y, r: NODE_R, class: 'body' });
        const inner = el(SVG_NS, 'circle');
        attr(inner, { cx: x, cy: y, r: NODE_R - 5, class: 'inner' });
        g.appendChild(outer);
        g.appendChild(inner);
        return g;
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
    // Entry badge
    const badge = shape.closest('.node-group')?.querySelector('.entry-badge');
    if (badge) attr(badge, { cx: x + NODE_R - 4, cy: y - NODE_R + 4 });
  }

  #makeEntryBadge(x, y) {
    const c = el(SVG_NS, 'circle');
    attr(c, { cx: x + NODE_R - 4, cy: y - NODE_R + 4, r: ENTRY_BADGE_R,
              fill: 'var(--sol-violet)', stroke: 'none' });
    return c;
  }

  #refreshNode(node) {
    // Re-render from scratch (label/type changes)
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
    for (const node of this.graph.nodes.values()) {
      const els = this.#nodeEls.get(node.id);
      if (!els) continue;
      els.group.querySelector('.entry-badge')?.remove();
      if (node.meta.isEntry) {
        const badge = this.#makeEntryBadge(node.x.value, node.y.value);
        badge.classList.add('entry-badge');
        els.group.appendChild(badge);
      }
    }
  }

  // ── Render: edge ─────────────────────────────────────────────────────────
  #renderEdge(edge) {
    const from = this.graph.nodes.get(edge.fromId);
    const to   = this.graph.nodes.get(edge.toId);
    if (!from || !to) return;

    const line = el(SVG_NS, 'line');
    line.classList.add('edge-line');
    attr(line, {
      'data-eid':             edge.id,
      x1:                     from.x.value,
      y1:                     from.y.value,
      x2:                     to.x.value,
      y2:                     to.y.value,
      'marker-end':           'url(#arrowhead)',
      'stroke-width':         2,
    });

    // Shorten endpoints so arrow doesn't overlap node circles
    this.#shortenEdge(line, from, to);

    const midX = (from.x.value + to.x.value) / 2;
    const midY = (from.y.value + to.y.value) / 2;

    const label = el(SVG_NS, 'text');
    label.classList.add('edge-label');
    attr(label, { x: midX, y: midY - 7 });
    label.textContent = edge.label.value;

    this.layerEdges.appendChild(line);
    this.layerLabels.appendChild(label);

    const scope = this.#scope.scope(`edge-${edge.id}`);
    scope.add(edge.label.subscribe(lbl => { label.textContent = lbl; }, false));

    this.#edgeEls.set(edge.id, { line, label });
  }

  #shortenEdge(line, from, to) {
    const dx = to.x.value - from.x.value;
    const dy = to.y.value - from.y.value;
    const d  = Math.hypot(dx, dy) || 1;
    const r1 = from.type === NodeType.DIAMOND ? DIA_H * 1.6 : NODE_R;
    const r2 = to.type   === NodeType.DIAMOND ? DIA_H * 1.6 : NODE_R + 4;
    attr(line, {
      x1: from.x.value + (dx / d) * r1,
      y1: from.y.value + (dy / d) * r1,
      x2: to.x.value   - (dx / d) * r2,
      y2: to.y.value   - (dy / d) * r2,
    });
  }

  #refreshEdgesForNode(nodeId) {
    for (const [eid, edge] of this.graph.edges) {
      if (edge.fromId !== nodeId && edge.toId !== nodeId) continue;
      const from = this.graph.nodes.get(edge.fromId);
      const to   = this.graph.nodes.get(edge.toId);
      const els  = this.#edgeEls.get(eid);
      if (!from || !to || !els) continue;
      this.#shortenEdge(els.line, from, to);
      const midX = (from.x.value + to.x.value) / 2;
      const midY = (from.y.value + to.y.value) / 2;
      attr(els.label, { x: midX, y: midY - 7 });
    }
  }

  #removeEdgeEl(id) {
    const els = this.#edgeEls.get(id);
    if (!els) return;
    els.line.remove();
    els.label.remove();
    this.#edgeEls.delete(id);
    this.#scope.scope(`edge-${id}`).dispose();
  }

  // ── Render all (after graph load) ─────────────────────────────────────────
  #renderAll() {
    this.layerNodes.innerHTML  = '';
    this.layerEdges.innerHTML  = '';
    this.layerLabels.innerHTML = '';
    this.#nodeEls.clear();
    this.#edgeEls.clear();

    for (const node of this.graph.nodes.values()) this.#renderNode(node);
    for (const edge of this.graph.edges.values()) this.#renderEdge(edge);
  }

  // ── Center view on graph ──────────────────────────────────────────────────
  fitView() {
    if (this.graph.nodes.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.graph.nodes.values()) {
      minX = Math.min(minX, n.x.value); minY = Math.min(minY, n.y.value);
      maxX = Math.max(maxX, n.x.value); maxY = Math.max(maxY, n.y.value);
    }
    const pad = 80;
    this.#viewBox = { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    this.#applyViewBox();
    this.#renderGrid();
  }

  dispose() { this.#scope.dispose(); }
}
