/**
 * graph.js — Flow graph data model.
 *
 * Built on Signal + Emitter from the framework.
 * Three node types mirror the MUD metaphor:
 *
 *   room     ●  — A location the user inhabits. Has enter/exit payload.
 *   diamond  ◆  — A logic joint. Routes the user based on inventory.
 *   terminal ◎  — End state (success / failure / info). No outgoing edges.
 *
 * Connections are directed edges. On a diamond, each edge carries a condition.
 * When a room has multiple outgoing edges the user chooses the next path.
 */

import { Signal, Emitter } from '/src/lib/signal.js';

function _uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (LAN HTTP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? (crypto.getRandomValues(new Uint8Array(1))[0] & 15)
      : (Math.random() * 16 | 0);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export const NodeType = Object.freeze({
  ROOM:     'room',
  DIAMOND:  'diamond',
  TERMINAL: 'terminal',
});

// ── GraphNode ─────────────────────────────────────────────────────────────────
export class GraphNode {
  /** @type {string} */           id;
  /** @type {'room'|'diamond'|'terminal'} */ type;
  /** @type {Signal<string>} */   label;
  /** @type {Signal<number>} */   x;
  /** @type {Signal<number>} */   y;
  /** @type {Signal<object>} */   payload;   // { onEnter, onExit, onBack, onReset, onUnload }
  /** @type {Signal<object[]>} */ routes;    // diamond: [{ condition, target, label }]
  /** @type {string|null} */      template;
  /** @type {object} */           meta;
  /** @type {Signal<object[]>} */ things;    // [{id, type, config, events}]

  constructor(data = {}) {
    this.id       = data.id ?? _uuid().split('-')[0];
    // Normalize legacy type name: 'room' was renamed to 'room'
    const rawType = data.type ?? NodeType.ROOM;
    this.type     = rawType === 'room' ? NodeType.ROOM : rawType;
    this.label    = new Signal(data.label   ?? (this.type === NodeType.DIAMOND ? 'Logic Check' : 'Room'));
    this.x        = new Signal(data.x       ?? 200);
    this.y        = new Signal(data.y       ?? 200);
    this.payload  = new Signal(data.payload ?? {
      onEnter: [], onExit: [], onBack: [], onReset: [], onUnload: [],
    });
    this.routes   = new Signal(data.routes  ?? []);
    this.template = data.template ?? null;
    this.meta     = { ...(data.meta ?? {}) };
    this.things   = new Signal(data.things  ?? []);
  }

  /** Ensure all five lifecycle buckets exist; preserve any custom event keys. */
  ensurePayload() {
    const p = this.payload.peek();
    const out = {
      ...p,
      onEnter:  p.onEnter  ?? [],
      onExit:   p.onExit   ?? [],
      onBack:   p.onBack   ?? [],
      onReset:  p.onReset  ?? [],
      onUnload: p.onUnload ?? [],
    };
    this.payload.value = out;
    return out;
  }

  addStep(event, step) {
    const p = this.ensurePayload();
    p[event] = [...(p[event] ?? []), step];
    this.payload.value = { ...p };
  }

  insertStep(event, index, step) {
    const p = this.ensurePayload();
    const steps = [...(p[event] ?? [])];
    steps.splice(index, 0, step);
    p[event] = steps;
    this.payload.value = { ...p };
  }

  removeStep(event, index) {
    const p = this.ensurePayload();
    p[event] = p[event].filter((_, i) => i !== index);
    this.payload.value = { ...p };
  }

  updateStep(event, index, step) {
    const p = this.ensurePayload();
    p[event] = p[event].map((s, i) => i === index ? { ...s, ...step } : s);
    this.payload.value = { ...p };
  }

  moveStep(event, from, to) {
    const p = this.ensurePayload();
    const steps = [...p[event]];
    const [item] = steps.splice(from, 1);
    steps.splice(to, 0, item);
    p[event] = steps;
    this.payload.value = { ...p };
  }

  // ── Things ───────────────────────────────────────────────────────────────────

  addThing(thingDef) {
    // thingDef: { id?, type, config?, events? }
    const id = thingDef.id ?? _uuid().split('-')[0];
    const t  = { id, type: thingDef.type, config: thingDef.config ?? {}, events: thingDef.events ?? {} };
    this.things.value = [...this.things.peek(), t];
    return t;
  }

  removeThing(id) {
    this.things.value = this.things.peek().filter(t => t.id !== id);
  }

  updateThing(id, patch) {
    this.things.value = this.things.peek().map(t => t.id === id ? { ...t, ...patch } : t);
  }

  toJSON() {
    return {
      id:       this.id,
      type:     this.type,
      label:    this.label.peek(),
      x:        this.x.peek(),
      y:        this.y.peek(),
      payload:  this.payload.peek(),
      routes:   this.routes.peek(),
      template: this.template,
      meta:     this.meta,
      things:   this.things.peek(),
    };
  }
}

// ── GraphEdge ─────────────────────────────────────────────────────────────────
export class GraphEdge {
  /** @type {string} */         id;
  /** @type {string} */         fromId;
  /** @type {string} */         toId;
  /** @type {Signal<string>} */ label;
  /** @type {Signal<string>} */ condition; // optional JS expression

  constructor(data = {}) {
    this.id        = data.id ?? _uuid().split('-')[0];
    this.fromId    = data.fromId;
    this.toId      = data.toId;
    this.label     = new Signal(data.label     ?? '');
    this.condition = new Signal(data.condition ?? '');
  }

  toJSON() {
    return {
      id:        this.id,
      fromId:    this.fromId,
      toId:      this.toId,
      label:     this.label.peek(),
      condition: this.condition.peek(),
    };
  }
}

// ── Graph ─────────────────────────────────────────────────────────────────────
export class Graph extends Emitter {
  /** @type {Map<string, GraphNode>} */ nodes = new Map();
  /** @type {Map<string, GraphEdge>} */ edges = new Map();

  // ── Nodes ──────────────────────────────────────────────────────────────────
  addNode(data = {}) {
    const node = new GraphNode(data);
    this.nodes.set(node.id, node);
    this.emit('nodeAdded', node);
    return node;
  }

  updateNode(id, changes) {
    const node = this.nodes.get(id);
    if (!node) return;
    if (changes.label    !== undefined) node.label.value   = changes.label;
    if (changes.x        !== undefined) node.x.value       = changes.x;
    if (changes.y        !== undefined) node.y.value       = changes.y;
    if (changes.payload  !== undefined) node.payload.value = changes.payload;
    if (changes.routes   !== undefined) node.routes.value  = changes.routes;
    if (changes.template !== undefined) node.template      = changes.template;
    if (changes.meta     !== undefined) Object.assign(node.meta, changes.meta);
    this.emit('nodeUpdated', node);
  }

  removeNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    // Remove all incident edges and emit edgeRemoved so listeners can clean up visuals
    for (const [eid, edge] of [...this.edges]) {
      if (edge.fromId === id || edge.toId === id) {
        this.edges.delete(eid);
        this.emit('edgeRemoved', { id: eid });
      }
    }
    this.nodes.delete(id);
    this.emit('nodeRemoved', { id });
  }

  setEntry(id) {
    for (const node of this.nodes.values()) {
      node.meta.isEntry = (node.id === id);
    }
    this.emit('entryChanged', { id });
  }

  // ── Edges ──────────────────────────────────────────────────────────────────
  addEdge(fromId, toId, data = {}) {
    // Prevent duplicate
    for (const e of this.edges.values()) {
      if (e.fromId === fromId && e.toId === toId) return e;
    }
    const edge = new GraphEdge({ fromId, toId, ...data });
    this.edges.set(edge.id, edge);
    this.emit('edgeAdded', edge);
    return edge;
  }

  removeEdge(id) {
    const edge = this.edges.get(id);
    if (!edge) return;
    this.edges.delete(id);
    this.emit('edgeRemoved', { id });
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  outEdges(nodeId) {
    return [...this.edges.values()].filter(e => e.fromId === nodeId);
  }

  inEdges(nodeId) {
    return [...this.edges.values()].filter(e => e.toId === nodeId);
  }

  getEntry() {
    for (const node of this.nodes.values()) {
      if (node.meta.isEntry) return node;
    }
    return this.nodes.values().next().value ?? null;
  }

  // ── Serialisation ──────────────────────────────────────────────────────────
  toJSON() {
    return {
      nodes: [...this.nodes.values()].map(n => n.toJSON()),
      edges: [...this.edges.values()].map(e => e.toJSON()),
    };
  }

  /** Load from plain JSON (project.graph). Replaces existing data. */
  fromJSON(data) {
    this.nodes.clear();
    this.edges.clear();

    for (const n of (data.nodes ?? [])) {
      this.nodes.set(n.id, new GraphNode(n));
    }
    for (const e of (data.edges ?? [])) {
      this.edges.set(e.id, new GraphEdge(e));
    }

    this.emit('graphLoaded', this);
    return this;
  }
}
