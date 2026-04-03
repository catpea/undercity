/**
 * app.js — Undercity IDE Application.
 *
 * App extends Emitter and acts as the central host for:
 *   • Plugin registration (App.use(plugin))
 *   • The command palette (Ctrl+K)
 *   • Project management (open, save, generate, preview)
 *   • Graph + UI wiring (MapBuilder, Savant, PropertiesPanel)
 *   • Undo/redo via CommandHistory
 *   • Auto-save after each mutation
 *   • Copy / Cut / Paste
 *
 * Plugin interface:
 *   const MyPlugin = {
 *     name: 'my-plugin',
 *     install(app) {
 *       app.registerCommand({ name: '…', … });
 *       app.on('project:opened', proj => { … });
 *     }
 *   };
 *   app.use(MyPlugin);
 */

import library             from '/library/index.js';
import { Emitter }         from '/src/lib/signal.js';
import { Scope }           from '/src/lib/scope.js';
import { normalizeIconName } from '/src/lib/icons.js';
import { Graph, NodeType } from '/src/ide/graph.js';
import { THING_LIBRARY }  from '/src/ide/thing-library.js';
import '/src/ide/undercity-map.js';
import { Savant }         from '/src/ide/savant.js';
import { API }             from '/src/ide/project-api.js';
import { CommandPalette }  from '/src/ide/command-line/index.js';
import { ALL_COMMANDS }    from '/src/ide/command-line/commands.js';
import { CommandHistory }  from '/src/ide/history.js';

function withDisabledStepFlag(cmd, step) {
  if (step?.disabled === true) cmd.disabled = true;
  return cmd;
}

function stepDisabledLabel(step) {
  return step?.disabled === true ? ' *(disabled in generated code)*' : '';
}

// ── App class ─────────────────────────────────────────────────────────────────

class App extends Emitter {
  // Private state
  #project      = null;
  #graph        = new Graph();
  #mapBuilder   = null;
  #savant      = null;
  #isDirty      = false;
  #commands     = new Map();
  #plugins      = [];
  #scope        = new Scope();
  #propsScope   = new Scope();  // reset each time the props panel opens
  #palette      = null;
  #history      = new CommandHistory();
  #clipboard    = null;     // { node: NodeJSON } | null
  #autoSaveTimer = null;
  #historyRestoring = false; // true during undo/redo (suppresses auto-save)
  #selectedEdge = null;     // currently selected GraphEdge | null

  // ── Accessors ──────────────────────────────────────────────────────

  get project()    { return this.#project; }
  get graph()      { return this.#graph; }
  get isDirty()    { return this.#isDirty; }

  // ── Plugin system ──────────────────────────────────────────────────

  /**
   * Register a plugin. The plugin's `install(app)` method is called
   * immediately, allowing it to register commands, listen to events, etc.
   * Returns `this` for chaining: app.use(A).use(B).
   */
  use(plugin) {
    if (typeof plugin.install !== 'function') {
      throw new TypeError(`Plugin "${plugin.name ?? '?'}" must have an install(app) method`);
    }
    plugin.install(this);
    this.#plugins.push(plugin);
    this.emit('plugin:installed', plugin);
    return this;
  }

  // ── Command system ─────────────────────────────────────────────────

  /** Register a command definition. Overwrites any existing command with the same name. */
  registerCommand(def) {
    this.#commands.set(def.name, def);
    this.emit('command:registered', def);
  }

  /** Execute a command by name with pre-resolved args/flags. */
  async execute(name, args = [], flags = {}) {
    const cmd = this.#commands.get(name);
    if (!cmd) throw new Error(`Unknown command: ${name}`);
    return cmd.execute({ args, flags, app: this });
  }

  /** Look up a registered command by name. */
  getCommand(name) { return this.#commands.get(name) ?? null; }

  /** Register (or replace) an action category in the Savant. Used by category plugins. */
  registerActions(catId, def) {
    this.#savant?.registerCategory(catId, def);
  }

  /**
   * Register a category from the new library/ format.
   * meta: { id, name, icon, color, description }
   * actionsMap: { [actionId]: { label, desc, params, run, ... } }
   */
  registerCategory(meta, actionsMap) {
    const actions = {};
    for (const [id, def] of Object.entries(actionsMap)) {
      const { run: _run, ...rest } = def;
      actions[id] = rest;
    }
    this.#savant?.registerCategory(meta.id, {
      label:   meta.name,
      icon:    meta.icon,
      color:   meta.color,
      actions,
    });
  }

  /** List all registered commands. */
  listCommands()   { return [...this.#commands.values()]; }

  // ── Project management ─────────────────────────────────────────────

  async loadProjectList() {
    try {
      const projects = await API.listProjects();
      const sel = document.getElementById('project-select');
      sel.innerHTML = '<option value="">— select project —</option>';
      for (const p of projects) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (this.#project?.id === p.id) opt.selected = true;
        sel.appendChild(opt);
      }
      return projects;
    } catch (err) {
      this.toast(`Failed to load projects: ${err.message}`, 'error');
      return [];
    }
  }

  async openProject(id) {
    try {
      const proj = await API.getProject(id);
      this.#project = proj;
      this.#graph   = new Graph();
      if (proj.graph) this.#graph.fromJSON(proj.graph);

      // Reset undo/redo when opening a new project
      this.#history.clear();

      // Re-wire map
      this.#mapBuilder.setGraph(this.#graph);
      this.#bindMapEvents();

      // Re-wire savant
      this.#savant.setNode(null);
      this.#savant.setProjectId(proj.id);
      for (const [id, def] of Object.entries(proj.customActions ?? {})) {
        this.#savant.addCustomAction(id, def);
      }

      this.markClean();
      this.#mapBuilder.fitView();
      this.#addRecent(proj);
      localStorage.setItem('pw-last-project', proj.id);
      window.currentProject = this.#project;
      this.toast(`Opened: ${proj.name}`, 'info');
      this.emit('project:opened', proj);
      this.#hideWelcome();
    } catch (err) {
      this.toast(`Error loading project: ${err.message}`, 'error');
    }
  }

  async saveProject() {
    if (!this.#project) { this.toast('No project open', 'error'); return; }
    try {
      const data = {
        ...this.#project,
        graph:         this.#graph.toJSON(),
        customActions: this.#savant.getCustomActions(),
      };
      await API.saveProject(this.#project.id, data);
      this.#project = data;
      this.markClean();
      this.toast('Project saved', 'success');
      this.emit('project:saved', data);
    } catch (err) {
      this.toast(`Save failed: ${err.message}`, 'error');
    }
  }

  /** Silent background save — no toast, no dirty update. */
  async #silentSave() {
    if (!this.#project || !this.#isDirty) return;
    try {
      const data = {
        ...this.#project,
        graph:         this.#graph.toJSON(),
        customActions: this.#savant.getCustomActions(),
      };
      await API.saveProject(this.#project.id, data);
      this.#project = data;
      this.markClean();
    } catch { /* silent — user can save manually */ }
  }

  /** Schedule a silent auto-save after a short debounce. */
  #scheduleAutoSave() {
    if (this.#historyRestoring) return; // don't auto-save during undo/redo
    clearTimeout(this.#autoSaveTimer);
    this.#autoSaveTimer = setTimeout(() => this.#silentSave(), 800);
  }

  async createProject(data) {
    try {
      const proj = await API.createProject({
        ...data,
        graph:         data.graph         ?? { nodes: [], edges: [] },
        inventory:     data.inventory     ?? { schema: {} },
        customActions: data.customActions ?? {},
      });
      await this.loadProjectList();
      const sel = document.getElementById('project-select');
      sel.value = proj.id;
      await this.openProject(proj.id);
      return proj;
    } catch (err) {
      this.toast(`Create failed: ${err.message}`, 'error');
      throw err;
    }
  }

  async generateProject() {
    if (!this.#project) { this.toast('No project open', 'error'); return null; }
    const btn = document.getElementById('btn-generate');
    btn.innerHTML = buttonLabel('arrow-repeat', 'Generating…');
    btn.disabled    = true;
    try {
      await API.saveProject(this.#project.id, { ...this.#project, graph: this.#graph.toJSON() });
      const result = await API.generateProject(this.#project.id);
      this.toast(`Generated ${result.files.length} files → ${result.path}`, 'success');
      this.emit('project:generated', result);
      return result;
    } catch (err) {
      this.toast(`Generate failed: ${err.message}`, 'error');
      return null;
    } finally {
      btn.innerHTML = buttonLabel('lightning-charge', 'Generate');
      btn.disabled    = false;
    }
  }

  // ── Undo / Redo ───────────────────────────────────────────────────

  undo() {
    const prev = this.#history.undo(this.#graph.toJSON());
    if (!prev) { this.toast('Nothing to undo', 'info'); return; }
    this.#restoreGraph(prev);
    this.toast('Undo', 'info');
  }

  redo() {
    const next = this.#history.redo(this.#graph.toJSON());
    if (!next) { this.toast('Nothing to redo', 'info'); return; }
    this.#restoreGraph(next);
    this.toast('Redo', 'info');
  }

  #restoreGraph(graphJSON) {
    this.#historyRestoring = true;
    this.#graph.fromJSON(graphJSON);
    this.#mapBuilder.setGraph(this.#graph);
    this.#bindMapEvents();
    this.#savant.setNode(null);
    this.#closePropsPanel();
    this.markDirty();
    this.#historyRestoring = false;
  }

  // ── Copy / Cut / Paste ────────────────────────────────────────────

  copySelected() {
    const node = this.#mapBuilder?.selectedNode;
    if (!node) { this.toast('Select a node first', 'info'); return; }
    this.#clipboard = { node: node.toJSON() };
    this.toast(`Copied: ${node.label.value}`, 'info');
  }

  cutSelected() {
    const node = this.#mapBuilder?.selectedNode;
    if (!node) { this.toast('Select a node first', 'info'); return; }
    this.#clipboard = { node: node.toJSON() };
    this.#history.record(this.#graph.toJSON());
    this.#graph.removeNode(node.id);
    this.#closePropsPanel();
    this.#savant.setNode(null);
    this.markDirty();
    this.toast(`Cut: ${this.#clipboard.node.label}`, 'info');
  }

  paste() {
    if (!this.#clipboard?.node) { this.toast('Nothing to paste', 'info'); return; }
    this.#history.record(this.#graph.toJSON());
    const src = this.#clipboard.node;
    // Paste with 80px offset; clear isEntry so we don't accidentally clone the lobby
    this.#graph.addNode({
      ...src,
      id:    undefined,
      x:     (src.x ?? 200) + 80,
      y:     (src.y ?? 200) + 80,
      label: src.label + ' (copy)',
      meta:  { ...src.meta, isEntry: false },
    });
    this.markDirty();
  }

  // ── Dirty tracking ─────────────────────────────────────────────────

  markDirty() {
    this.#isDirty = true;
    const btn = document.getElementById('btn-save');
    btn.innerHTML = buttonLabel('record-circle', 'Save');
    btn.classList.add('primary');
    this.emit('dirty:changed', true);
    this.#scheduleAutoSave();
  }

  markClean() {
    this.#isDirty = false;
    const btn = document.getElementById('btn-save');
    btn.innerHTML = buttonLabel('floppy', 'Save');
    btn.classList.remove('primary');
    this.emit('dirty:changed', false);
  }

  // ── View ──────────────────────────────────────────────────────────

  fitView() { this.#mapBuilder?.fitView(); }

  /** Export current map as MCP JSON (addNode + addEdge + addAction commands) and copy to clipboard. */
  #exportMapMcp() {
    const nodes = [...this.#graph.nodes.values()];
    const edges = [...this.#graph.edges.values()];
    const cmds  = [];

    // addNode commands
    for (const n of nodes) {
      const cmd = {
        cmd:   'addNode',
        type:  n.type ?? 'room',
        label: n.label?.value ?? n.label ?? n.id,
      };
      if (n.meta?.isEntry) cmd.entry = true;
      if (n.template)      cmd.template = n.template;
      cmds.push(cmd);
    }

    // addEdge commands
    for (const e of edges) {
      const from = nodes.find(n => n.id === e.fromId);
      const to   = nodes.find(n => n.id === e.toId);
      if (!from || !to) continue;
      const cmd = {
        cmd:  'addEdge',
        from: from.label?.value ?? from.label ?? from.id,
        to:   to.label?.value   ?? to.label   ?? to.id,
      };
      if (e.label?.value)     cmd.label     = e.label.value;
      if (e.condition?.value) cmd.condition = e.condition.value;
      cmds.push(cmd);
    }

    // addAction commands — one per step in every node's payload events
    for (const n of nodes) {
      const nodeLabel = n.label?.value ?? n.label ?? n.id;
      const payload   = n.payload?.peek?.() ?? n.payload ?? {};
      for (const [event, steps] of Object.entries(payload)) {
        if (!Array.isArray(steps)) continue;
        for (const step of steps) {
          if (!step?.action) continue;
          const cmd = withDisabledStepFlag({ cmd: 'addAction', node: nodeLabel, event, action: step.action }, step);
          if (step.params && Object.keys(step.params).length > 0) cmd.params = step.params;
          cmds.push(cmd);
        }
      }
    }

    const json = JSON.stringify(cmds, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      this.toast(`Copied ${cmds.length} MCP commands to clipboard`, 'info');
    }).catch(() => {
      const win = window.open('', '_blank', 'width=700,height=520');
      if (win) { win.document.write(`<pre style="font:13px monospace;padding:16px">${json.replace(/</g,'&lt;')}</pre>`); }
    });
  }

  /** Export current map as Markdown instructions an AI can read and reproduce. */
  #exportMapMarkdown() {
    const nodes    = [...this.#graph.nodes.values()];
    const edges    = [...this.#graph.edges.values()];
    const proj     = this.#project;
    const projName = proj?.name ?? proj?.id ?? 'Untitled Project';
    const lines    = [];

    lines.push(`# ${projName} — Map Blueprint`);
    lines.push('');
    lines.push('This document describes the structure and logic of an Undercity MUD map.');
    lines.push('An AI assistant can use these instructions to recreate the map exactly.');
    lines.push('');

    // ── Rooms / nodes ──────────────────────────────────────────────────────────
    lines.push('## Rooms');
    lines.push('');
    lines.push('Each room is a node on the map. Type can be `room`, `diamond` (logic branch), or `terminal` (end state).');
    lines.push('');

    for (const n of nodes) {
      const label   = n.label?.value ?? n.label ?? n.id;
      const type    = n.type ?? 'room';
      const isEntry = n.meta?.isEntry ? ' *(entry point)*' : '';
      const tmpl    = n.template ? ` — template: \`${n.template}\`` : '';
      lines.push(`### ${label}${isEntry}`);
      lines.push(`- **Type:** ${type}${tmpl}`);

      // Navigation edges out of this node
      const out = edges.filter(e => e.fromId === n.id);
      if (out.length > 0) {
        lines.push('- **Exits:**');
        for (const e of out) {
          const toNode  = nodes.find(nd => nd.id === e.toId);
          const toLabel = toNode ? (toNode.label?.value ?? toNode.label ?? toNode.id) : e.toId;
          const edgeLabel = e.label?.value ? ` — \`${e.label.value}\`` : '';
          const cond      = e.condition?.value ? ` *(condition: ${e.condition.value})*` : '';
          lines.push(`  - → ${toLabel}${edgeLabel}${cond}`);
        }
      }

      // Actions / payload
      const payload = n.payload?.peek?.() ?? n.payload ?? {};
      const events  = Object.entries(payload).filter(([, steps]) => Array.isArray(steps) && steps.length > 0);
      if (events.length > 0) {
        lines.push('- **Actions:**');
        for (const [event, steps] of events) {
          lines.push(`  - **${event}** event:`);
          for (const step of steps) {
            if (!step?.action) continue;
            const paramStr = step.params && Object.keys(step.params).length > 0
              ? ' — params: ' + Object.entries(step.params).map(([k, v]) => `\`${k}=${JSON.stringify(v)}\``).join(', ')
              : '';
            lines.push(`    - \`${step.action}\`${paramStr}${stepDisabledLabel(step)}`);
          }
        }
      }

      // Things (FormThing, WorkflowThing, etc.)
      const things = n.things?.peek?.() ?? [];
      if (things.length > 0) {
        lines.push('- **Things:**');
        for (const t of things) {
          const tName = t.config?.name ?? t.id;
          lines.push(`  - \`${t.type}\` — **${tName}** (id: \`${t.id}\`)`);
          const tEvents = Object.entries(t.events ?? {}).filter(([, steps]) => Array.isArray(steps) && steps.length > 0);
          for (const [evt, steps] of tEvents) {
            lines.push(`    - **${evt}** event:`);
            for (const step of steps) {
              if (!step?.action) continue;
              const ps = step.params && Object.keys(step.params).length > 0
                ? ' — ' + Object.entries(step.params).map(([k, v]) => `\`${k}=${JSON.stringify(v)}\``).join(', ')
                : '';
              lines.push(`      - \`${step.action}\`${ps}${stepDisabledLabel(step)}`);
            }
          }
        }
      }

      lines.push('');
    }

    // ── MCP commands to recreate the map ───────────────────────────────────────
    lines.push('## How to Recreate This Map (MCP Commands)');
    lines.push('');
    lines.push('Paste the following JSON array into the AI chat to rebuild this map from scratch:');
    lines.push('');
    lines.push('```json');

    const cmds = [];
    for (const n of nodes) {
      const label = n.label?.value ?? n.label ?? n.id;
      const cmd   = { cmd: 'addNode', type: n.type ?? 'room', label };
      if (n.meta?.isEntry) cmd.entry = true;
      if (n.template)      cmd.template = n.template;
      cmds.push(cmd);
    }
    for (const e of edges) {
      const from = nodes.find(n => n.id === e.fromId);
      const to   = nodes.find(n => n.id === e.toId);
      if (!from || !to) continue;
      const cmd  = {
        cmd:  'addEdge',
        from: from.label?.value ?? from.label ?? from.id,
        to:   to.label?.value   ?? to.label   ?? to.id,
      };
      if (e.label?.value)     cmd.label     = e.label.value;
      if (e.condition?.value) cmd.condition = e.condition.value;
      cmds.push(cmd);
    }
    for (const n of nodes) {
      const nodeLabel = n.label?.value ?? n.label ?? n.id;
      const payload   = n.payload?.peek?.() ?? n.payload ?? {};
      for (const [event, steps] of Object.entries(payload)) {
        if (!Array.isArray(steps)) continue;
        for (const step of steps) {
          if (!step?.action) continue;
          const cmd = withDisabledStepFlag({ cmd: 'addAction', node: nodeLabel, event, action: step.action }, step);
          if (step.params && Object.keys(step.params).length > 0) cmd.params = step.params;
          cmds.push(cmd);
        }
      }
    }

    lines.push(JSON.stringify(cmds, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push(`*Exported from Undercity IDE — ${new Date().toISOString()}*`);

    const md = lines.join('\n');
    navigator.clipboard.writeText(md).then(() => {
      this.toast('Copied Markdown blueprint to clipboard', 'info');
    }).catch(() => {
      const win = window.open('', '_blank', 'width=800,height=600');
      if (win) { win.document.write(`<pre style="font:13px monospace;padding:16px;white-space:pre-wrap">${md.replace(/</g,'&lt;')}</pre>`); }
    });
  }

  toast(msg, type = 'info') {
    const area = document.getElementById('toast-area');
    const el   = document.createElement('div');
    el.className = `ide-toast ${type}`;
    el.textContent = msg;
    area.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  // ── Map event wiring ──────────────────────────────────────────────

  #bindMapEvents() {
    this.#scope.scope('map').dispose();
    const ms = this.#scope.scope('map');

    // Record snapshot before map-initiated mutations
    ms.add(this.#mapBuilder.on('beforeChange', () => {
      this.#history.record(this.#graph.toJSON());
    }));

    // Track edge selection
    ms.add(this.#mapBuilder.on('edgeSelected', edge => {
      this.#selectedEdge = edge;
      this.#openEdgePropsPanel(edge);
    }));
    ms.add(this.#mapBuilder.on('edgeDeselected', () => {
      this.#selectedEdge = null;
      this.#closePropsPanel();
    }));

    ms.add(this.#mapBuilder.on('nodeSelected', node => {
      this.#savant.setNode(node);
      this.#openPropsPanel(node);
      this.markDirty();
    }));

    ms.add(this.#mapBuilder.on('nodeDeselected', () => {
      this.#closePropsPanel();
      this.#savant.setNode(null);
    }));

    // Auto-select a node immediately after it is added to the graph
    ms.add(this.#graph.on('nodeAdded', node => {
      this.#mapBuilder.selectNode(node.id);
    }));

    ms.add(this.#mapBuilder.on('nodeDoubleClicked', node => {
      const label = prompt('Rename room:', node.label.value);
      if (label !== null) {
        const trimmed = label.trim();
        if (trimmed) {
          const duplicate = [...this.#graph.nodes.values()].find(
            n => n.id !== node.id && n.label.value.trim().toLowerCase() === trimmed.toLowerCase()
          );
          if (duplicate) {
            this.toast(`"${trimmed}" is already used by another room`, 'warning');
            return;
          }
        }
        this.#history.record(this.#graph.toJSON());
        node.label.value = trimmed || node.label.value;
        this.markDirty();
      }
    }));

    ms.add(this.#mapBuilder.on('edgeCreated', () => this.markDirty()));

    ms.add(this.#mapBuilder.on('contextMenu', ({ node, x, y }) => {
      this.#showContextMenu(node, x, y);
    }));
  }

  // ── Properties panel ─────────────────────────────────────────────

  #openPropsPanel(node) {
    this.#propsScope.dispose();
    const panel = document.getElementById('props-panel');
    panel.classList.add('open');
    document.getElementById('props-title').textContent = node.label.value;
    this.#renderPropsBody(node);

    // Push: re-render only the things list when node.things changes
    if (node.things) {
      this.#propsScope.add(
        node.things.subscribe(() => this.#renderThingsList(node), false)
      );
    }

    this.emit('props:opened', node);
  }

  #closePropsPanel() {
    this.#propsScope.dispose();
    document.getElementById('props-panel').classList.remove('open');
    this.emit('props:closed');
  }

  #openEdgePropsPanel(edge) {
    this.#propsScope.dispose();
    const fromNode = this.#graph.nodes.get(edge.fromId);
    const toNode   = this.#graph.nodes.get(edge.toId);
    const isDiamond = fromNode?.type === 'diamond';
    const panel = document.getElementById('props-panel');
    panel.classList.add('open');
    document.getElementById('props-title').textContent = 'Connector';
    const body = document.getElementById('props-body');
    body.innerHTML = `
      <div class="props-section">
        <div class="props-section-title">Connection</div>
        <div class="props-field">
          <label class="props-label">From</label>
          <div class="props-value">${escAttr(fromNode?.label.value ?? edge.fromId)}</div>
        </div>
        <div class="props-field">
          <label class="props-label">To</label>
          <div class="props-value">${escAttr(toNode?.label.value ?? edge.toId)}</div>
        </div>
        <div class="props-field">
          <label class="props-label">Label</label>
          <input class="props-input" id="edge-label" value="${escAttr(edge.label.value)}">
        </div>
        ${isDiamond ? `
        <div class="props-field">
          <label class="props-label">Condition <span class="props-hint">(JS expression)</span></label>
          <input class="props-input" id="edge-condition" value="${escAttr(edge.condition.value)}" placeholder="inventory.get('key') === 'value'">
        </div>` : ''}
      </div>`;

    document.getElementById('edge-label').addEventListener('input', e => {
      edge.label.value = e.target.value;
      this.markDirty();
    });
    if (isDiamond) {
      document.getElementById('edge-condition').addEventListener('input', e => {
        edge.condition.value = e.target.value;
        this.markDirty();
      });
    }
  }

  #renderPropsBody(node) {
    const body = document.getElementById('props-body');
    body.innerHTML = `
      <div class="props-section">
        <div class="props-section-title">Identity</div>
        <div class="props-field">
          <label class="props-label">Label</label>
          <input class="props-input" id="prop-label" value="${escAttr(node.label.value)}">
        </div>
        <div class="props-field">
          <label class="props-label">Type</label>
          <select class="props-select" id="prop-type">
            <option value="room"  ${node.type === 'room'  ? 'selected' : ''}> Room</option>
            <option value="diamond"  ${node.type === 'diamond'  ? 'selected' : ''}>Diamond (Logic Joint)</option>
            <option value="terminal" ${node.type === 'terminal' ? 'selected' : ''}>Terminal (End State)</option>
          </select>
        </div>
        <div class="props-field">
          <label class="props-label">
            <input type="checkbox" id="prop-entry" ${node.meta?.isEntry ? 'checked' : ''}> Entry point (Lobby)
          </label>
        </div>
      </div>
      ${node.type === 'room' && node.meta?.isEntry ? `
      <div class="props-section">
        <div class="props-section-title">Lobby Meta</div>
        <div class="props-field">
          <label class="props-label">App Name</label>
          <input class="props-input" id="prop-meta-appName" value="${escAttr(node.meta?.appName ?? '')}">
        </div>
        <div class="props-field">
          <label class="props-label">Tagline</label>
          <input class="props-input" id="prop-meta-tagline" value="${escAttr(node.meta?.tagline ?? '')}">
        </div>
        <div class="props-field">
          <label class="props-label">Icon (Bootstrap icon name)</label>
          <input class="props-input" id="prop-meta-icon" value="${escAttr(node.meta?.icon ?? '')}" placeholder="shield-lock">
        </div>
      </div>` : ''}
      ${node.type === 'terminal' ? this.#terminalMetaHTML(node) : ''}
      ${node.type === 'room' ? this.#thingsHTML() : ''}`;

    // Live-update handlers
    document.getElementById('prop-label').addEventListener('input', e => {
      const newLabel = e.target.value.trim();
      // Duplicate room name guard — warn but don't block typing
      if (newLabel) {
        const duplicate = [...this.#graph.nodes.values()].find(
          n => n.id !== node.id && n.label.value.trim().toLowerCase() === newLabel.toLowerCase()
        );
        if (duplicate) {
          e.target.classList.add('is-invalid');
          let errEl = e.target.nextElementSibling;
          if (!errEl?.classList.contains('invalid-feedback')) {
            errEl = document.createElement('div');
            errEl.className = 'invalid-feedback';
            e.target.insertAdjacentElement('afterend', errEl);
          }
          errEl.textContent = `Another room is already named "${duplicate.label.value}".`;
        } else {
          e.target.classList.remove('is-invalid');
          const errEl = e.target.nextElementSibling;
          if (errEl?.classList.contains('invalid-feedback')) errEl.textContent = '';
        }
      }
      node.label.value = e.target.value;
      document.getElementById('props-title').textContent = e.target.value;
      this.markDirty();
    });

    document.getElementById('prop-type').addEventListener('change', () => {
      this.toast('Type changes require removing and re-adding the node', 'info');
    });

    document.getElementById('prop-entry').addEventListener('change', e => {
      if (e.target.checked) this.#graph.setEntry(node.id);
      else node.meta.isEntry = false;
      this.markDirty();
      // Re-render so Lobby Meta section appears/disappears
      this.#renderPropsBody(node);
    });

    if (node.type === 'terminal') {
      ['message', 'nextLabel', 'nextHref'].forEach(k => {
        const el = document.getElementById(`prop-meta-${k}`);
        if (el) el.addEventListener('input', ev => { node.meta[k] = ev.target.value; this.markDirty(); });
      });
    }

    if (node.type === 'room') {
      ['appName', 'tagline', 'icon'].forEach(k => {
        const el = document.getElementById(`prop-meta-${k}`);
        if (el) el.addEventListener('input', ev => {
          if (!node.meta) node.meta = {};
          node.meta[k] = ev.target.value;
          this.markDirty();
        });
      });
    }

    if (node.type === 'room') {
      this.#renderThingsList(node);   // initial population
      this.#wireThingsPanel(node);    // wire controls once
    }
  }

  #terminalMetaHTML(node) {
    const m = node.meta ?? {};
    return `
      <div class="props-section">
        <div class="props-section-title">Terminal Metadata</div>
        <div class="props-field">
          <label class="props-label">Message</label>
          <input class="props-input" id="prop-meta-message" value="${escAttr(m.message ?? '')}">
        </div>
        <div class="props-field">
          <label class="props-label">Button Label</label>
          <input class="props-input" id="prop-meta-nextLabel" value="${escAttr(m.nextLabel ?? '')}">
        </div>
        <div class="props-field">
          <label class="props-label">Button URL</label>
          <input class="props-input" id="prop-meta-nextHref" value="${escAttr(m.nextHref ?? '')}">
        </div>
      </div>`;
  }

  // ── Things panel ──────────────────────────────────────────────

  /** Static scaffold: just the section shell with the add controls. */
  #thingsHTML() {
    const typeOptions = Object.entries(THING_LIBRARY)
      .map(([k, v]) => `<option value="${escAttr(k)}">${escHtml(v.label)}</option>`)
      .join('');
    return `
      <div class="props-section" id="things-section">
        <div class="props-section-title">Things
          <select id="thing-type-select" class="things-add-select">${typeOptions}</select>
          <button id="thing-add-btn" class="things-add-btn">+ Add</button>
        </div>
        <div id="things-list"></div>
      </div>`;
  }

  /** Render the thing cards into #things-list. Called by the push subscription. */
  #renderThingsList(node) {
    const list = document.getElementById('things-list');
    if (!list) return;
    const things = node.things.peek();
    if (!things.length) {
      list.innerHTML = '<div class="things-empty">No things yet</div>';
      return;
    }
    list.innerHTML = things.map(t => {
      const lib  = THING_LIBRARY[t.type] ?? {};
      const icon = lib.icon  ?? 'box';
      const col  = lib.color ?? 'var(--text-muted)';
      const lbl  = t.config?.name || lib.label || t.type;
      const cfg  = Object.entries(t.config ?? {})
        .filter(([k]) => k !== 'name')
        .map(([k, v]) => `<span class="thing-cfg-item"><b>${escHtml(k)}</b>: ${escHtml(String(v))}</span>`)
        .join('');
      return `
        <div class="thing-card" data-thing-id="${escAttr(t.id)}">
          <div class="thing-card-head" style="--thing-color:${col}">
            <i class="bi bi-${icon}"></i>
            <span class="thing-card-label" title="Double-click to rename">${escHtml(lbl)}</span>
            <div class="thing-card-actions">
              <button class="thing-btn thing-edit" title="Edit workflows">⚙</button>
              <button class="thing-btn thing-remove" title="Remove">×</button>
            </div>
          </div>
          ${cfg ? `<div class="thing-card-cfg">${cfg}</div>` : ''}
        </div>`;
    }).join('');
  }

  /** Wire the static add-button + delegated list clicks (called once per panel open). */
  #wireThingsPanel(node) {
    const section = document.getElementById('things-section');
    if (!section) return;

    section.querySelector('#thing-add-btn').addEventListener('click', () => {
      const sel   = section.querySelector('#thing-type-select').value;
      const label = THING_LIBRARY[sel]?.label ?? sel;
      const t     = node.addThing({ type: sel, config: { name: label } });
      this.markDirty();
      this.#openThingConfig(node, t);
      // #renderThingsList will fire via the node.things subscription
    });

    section.querySelector('#things-list').addEventListener('click', e => {
      const card = e.target.closest('.thing-card');
      if (!card) return;
      const id = card.dataset.thingId;
      if (e.target.classList.contains('thing-remove')) {
        node.removeThing(id);
        this.markDirty();
        // #renderThingsList fires via subscription
      } else if (e.target.classList.contains('thing-edit')) {
        const t = node.things.peek().find(x => x.id === id);
        if (t) this.#openThingConfig(node, t);
      }
    });

    section.querySelector('#things-list').addEventListener('dblclick', e => {
      const labelEl = e.target.closest('.thing-card-label');
      if (!labelEl) return;
      const card = labelEl.closest('.thing-card');
      const id   = card?.dataset.thingId;
      const t    = node.things.peek().find(x => x.id === id);
      if (!t) return;

      const prev = t.config?.name || labelEl.textContent;
      const input = document.createElement('input');
      input.className = 'thing-label-input';
      input.value = prev;
      labelEl.replaceWith(input);
      input.select();
      input.focus();

      const commit = () => {
        const name = input.value.trim() || prev;
        const newLabel = document.createElement('span');
        newLabel.className = 'thing-card-label';
        newLabel.title = 'Double-click to rename';
        newLabel.textContent = name;
        input.replaceWith(newLabel);
        if (name !== prev) {
          node.updateThing(id, { config: { ...(t.config ?? {}), name } });
          this.#savant?.updateThingName(name);
          this.markDirty();
        }
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e2 => {
        if (e2.key === 'Enter')  { e2.preventDefault(); input.blur(); }
        if (e2.key === 'Escape') { input.value = prev;  input.blur(); }
      });
    });
  }

  #openThingConfig(node, thingDef) {
    if (this.#savant) {
      this.#savant.setThing(thingDef, node);
    }
  }

  // ── Context menu ──────────────────────────────────────────────────

  #ctxNode = null;

  #showContextMenu(node, x, y) {
    this.#ctxNode = node;
    const menu = document.getElementById('ctx-menu');
    menu.style.left = `${x}px`;
    menu.style.top  = `${y}px`;
    menu.classList.add('open');
  }

  // ── Recent projects (localStorage) ────────────────────────────────

  #addRecent(proj) {
    try {
      const list = JSON.parse(localStorage.getItem('pw-recent') ?? '[]');
      const next = [
        { id: proj.id, name: proj.name, description: proj.description ?? '' },
        ...list.filter(p => p.id !== proj.id),
      ].slice(0, 8);
      localStorage.setItem('pw-recent', JSON.stringify(next));
    } catch { /* ignore */ }
  }

  #getRecent() {
    try { return JSON.parse(localStorage.getItem('pw-recent') ?? '[]'); } catch { return []; }
  }

  // ── Welcome screen ────────────────────────────────────────────────

  async #showWelcome() {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;

    // Populate recent projects
    const recent = this.#getRecent();
    const recentEl = document.getElementById('welcome-recent-list');
    const recentSection = document.getElementById('welcome-recent-section');
    if (recentEl) {
      if (recent.length) {
        recentSection?.classList.remove('d-none-ish');
        recentEl.innerHTML = recent.map(p => `
          <div class="welcome-recent-item" data-pid="${escAttr(p.id)}">
            <af-icon name="folder2-open"></af-icon>
            <div class="wr-info">
              <div class="wr-name">${escHtml(p.name)}</div>
              ${p.description ? `<div class="wr-desc">${escHtml(p.description)}</div>` : ''}
            </div>
            <small>${escHtml(p.id)}</small>
          </div>`).join('');
        recentEl.querySelectorAll('.welcome-recent-item').forEach(item => {
          item.addEventListener('click', () => {
            this.openProject(item.dataset.pid);
          });
        });
      } else {
        recentSection?.classList.add('d-none-ish');
      }
    }

    // Populate templates
    const tmplEl = document.getElementById('welcome-template-list');
    if (tmplEl) {
      try {
        const templates = await API.listTemplates();
        tmplEl.innerHTML = templates.slice(0, 6).map(t => `
          <div class="welcome-tmpl-card" data-tid="${escAttr(t.id)}">
            <div class="welcome-tmpl-icon"><af-icon name="${normalizeIconName(t.icon, 'stars')}"></af-icon></div>
            <div class="welcome-tmpl-name">${escHtml(t.name)}</div>
          </div>`).join('');
        tmplEl.querySelectorAll('.welcome-tmpl-card').forEach(card => {
          const tid = card.dataset.tid;
          const tmpl = templates.find(t => t.id === tid);
          card.addEventListener('click', () => {
            this.#hideWelcome();
            if (tmpl && this._selectTemplate) {
              this._selectTemplate(tmpl);
            } else {
              document.getElementById('btn-new')?.click();
            }
          });
        });
      } catch { tmplEl.innerHTML = ''; }
    }

    modal.classList.add('open');
  }

  #hideWelcome() {
    document.getElementById('welcome-modal')?.classList.remove('open');
  }

  // ── Toolbar button wiring ─────────────────────────────────────────

  #bindToolbar() {
    const $ = id => document.getElementById(id);

    $('btn-save')    .addEventListener('click', () => this.saveProject());
    $('btn-generate').addEventListener('click', () => this.generateProject());
    $('btn-fit-view').addEventListener('click', () => this.fitView());

    // Export map as MCP JSON (addNode + addEdge + addAction commands)
    $('btn-export-map')?.addEventListener('click', () => this.#exportMapMcp());
    // Export map as Markdown AI instructions
    $('btn-export-markdown')?.addEventListener('click', () => this.#exportMapMarkdown());
    $('btn-cmd')?.addEventListener('click', () => this.#palette?.open());

    // Undo / Redo buttons
    $('btn-undo')?.addEventListener('click', () => this.undo());
    $('btn-redo')?.addEventListener('click', () => this.redo());

    // Preview: generate + open in new tab
    $('btn-preview')?.addEventListener('click', async () => {
      const result = await this.generateProject();
      if (result?.path) window.open(result.path, '_blank');
    });

    // Reset: wipe all projects + generated files, clear browser state
    $('btn-reset')?.addEventListener('click', async () => {
      const confirmed = window.confirm(
        'Reset everything?\n\nThis will delete ALL projects and generated files, and clear all browser storage.\n\nThis cannot be undone.'
      );
      if (!confirmed) return;
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          // Clear all browser storage for this origin
          localStorage.clear();
          sessionStorage.clear();
          location.reload();
        } else {
          this.toast('Reset failed: ' + (data.error ?? 'unknown error'), 'error');
        }
      } catch (e) {
        this.toast('Reset failed: ' + e.message, 'error');
      }
    });

    // ── Save as Template ─────────────────────────────────────────────
    $('btn-save-template')?.addEventListener('click', () => {
      if (!this.#project) { this.toast('No project open', 'error'); return; }
      const p = this.#project;
      $('tmpl-save-name').value     = p.name     ?? '';
      $('tmpl-save-id').value       = p.id       ?? '';
      $('tmpl-save-desc').value     = p.description ?? '';
      $('tmpl-save-icon').value     = p.meta?.icon  ?? '';
      $('tmpl-save-category').value = 'custom';
      $('save-template-modal').classList.add('open');
    });
    $('btn-tmpl-save-cancel')?.addEventListener('click', () => $('save-template-modal').classList.remove('open'));
    $('save-template-modal')?.addEventListener('click', e => {
      if (e.target === $('save-template-modal')) $('save-template-modal').classList.remove('open');
    });

    // Auto-generate id from name
    $('tmpl-save-name')?.addEventListener('input', () => {
      if (!$('tmpl-save-id').dataset.userEdited) {
        $('tmpl-save-id').value = $('tmpl-save-name').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
    });
    $('tmpl-save-id')?.addEventListener('input', () => {
      $('tmpl-save-id').dataset.userEdited = $('tmpl-save-id').value ? '1' : '';
    });

    $('btn-tmpl-save-confirm')?.addEventListener('click', async () => {
      const name     = $('tmpl-save-name').value.trim();
      const id       = $('tmpl-save-id').value.trim();
      const desc     = $('tmpl-save-desc').value.trim();
      const icon     = $('tmpl-save-icon').value.trim() || 'stars';
      const category = $('tmpl-save-category').value.trim() || 'custom';
      if (!name || !id) { this.toast('Name and ID required', 'error'); return; }
      try {
        await API.saveTemplate({
          id, name,
          description: desc,
          icon,
          category,
          graph:         this.#graph.toJSON(),
          inventory:     this.#project?.inventory ?? { schema: {} },
          customActions: this.#project?.customActions ?? {},
        });
        this.toast(`Template "${name}" saved`, 'success');
        $('save-template-modal').classList.remove('open');
      } catch (e) {
        this.toast('Save failed: ' + e.message, 'error');
      }
    });

    // ── Template gallery / New project modal ─────────────────────────
    let _selectedTemplate = null;

    const openGallery = async () => {
      $('new-project-modal').classList.add('open');
      $('new-proj-step-gallery').style.display = '';
      $('new-proj-step-name').style.display = 'none';
      $('new-proj-id').value = '';
      $('new-proj-name').value = '';
      _selectedTemplate = null;
      // Load and render templates
      const gallery = $('template-gallery');
      gallery.innerHTML = '<div class="tmpl-loading">Loading…</div>';
      try {
        const templates = await API.listTemplates();
        gallery.innerHTML = '';
        for (const tmpl of templates) {
          const card = document.createElement('div');
          card.className = 'tmpl-card';
          card.dataset.tmplId = tmpl.id;
          const iconName = normalizeIconName(tmpl.icon, 'stars');
          card.innerHTML = `
            <div class="tmpl-card-icon"><af-icon name="${iconName}"></af-icon></div>
            <div class="tmpl-card-name">${escHtml(tmpl.name)}</div>
            <div class="tmpl-card-desc">${escHtml(tmpl.description)}</div>`;
          card.addEventListener('click', () => selectTemplate(tmpl));
          gallery.appendChild(card);
        }
      } catch {
        gallery.innerHTML = '<div class="tmpl-loading">Could not load templates.</div>';
      }
    };

    const selectTemplate = (tmpl) => {
      _selectedTemplate = tmpl;
      $('new-project-modal').classList.add('open');
      $('new-proj-step-gallery').style.display = 'none';
      $('new-proj-step-name').style.display = '';
      $('tmpl-selected-badge').innerHTML =
        `<span class="tmpl-badge"><af-icon name="${normalizeIconName(tmpl.icon, 'stars')}"></af-icon><span>${escHtml(tmpl.name)}</span></span>`;
      $('new-proj-name').value = '';
      $('new-proj-id').value = '';
      if ($('new-proj-desc')) $('new-proj-desc').value = '';
      delete $('new-proj-id').dataset.userEdited;
      $('new-proj-name').focus();
    };
    // Expose so #showWelcome can pre-select a template and go straight to step 2
    this._selectTemplate = selectTemplate;

    $('btn-new').addEventListener('click', openGallery);

    $('btn-new-cancel').addEventListener('click', () => $('new-project-modal').classList.remove('open'));
    $('btn-new-back')?.addEventListener('click', () => {
      $('new-proj-step-gallery').style.display = '';
      $('new-proj-step-name').style.display = 'none';
    });
    $('new-project-modal').addEventListener('click', e => {
      if (e.target === $('new-project-modal')) $('new-project-modal').classList.remove('open');
    });

    // Auto-generate ID from name
    $('new-proj-name').addEventListener('input', () => {
      const raw = $('new-proj-name').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!$('new-proj-id').dataset.userEdited) $('new-proj-id').value = raw;
    });
    $('new-proj-id').addEventListener('input', () => {
      $('new-proj-id').dataset.userEdited = $('new-proj-id').value ? '1' : '';
    });

    $('btn-new-cancel-2')?.addEventListener('click', () => $('new-project-modal').classList.remove('open'));

    $('btn-new-confirm').addEventListener('click', async () => {
      const rawId = $('new-proj-id').value.trim().replace(/\s+/g,'-').toLowerCase();
      const name  = $('new-proj-name').value.trim();
      const desc  = $('new-proj-desc')?.value.trim() ?? '';
      if (!rawId || !name) { this.toast('Name and ID are required', 'error'); return; }

      let projectData = { id: rawId, name, description: desc };
      if (_selectedTemplate && _selectedTemplate.id !== 'blank') {
        try {
          const full = await API.getTemplate(_selectedTemplate.id);
          projectData = { ...full, id: rawId, name,
            description: desc || full.description || '',
            created:  undefined, modified: undefined };
        } catch { /* fall through to blank */ }
      }

      await this.createProject(projectData);
      $('new-project-modal').classList.remove('open');
    });

    // Project selector
    $('project-select').addEventListener('change', e => {
      if (e.target.value) this.openProject(e.target.value);
    });

    // Properties panel close
    $('props-close').addEventListener('click', () => {
      this.#closePropsPanel();
      this.#mapBuilder?.deselect();
    });

    // Context menu actions
    document.addEventListener('click', () => document.getElementById('ctx-menu').classList.remove('open'));
    document.getElementById('ctx-menu').querySelectorAll('[data-ctx]').forEach(item => {
      item.addEventListener('click', () => {
        if (!this.#ctxNode) return;
        const action = item.dataset.ctx;
        if (action === 'set-entry') {
          this.#history.record(this.#graph.toJSON());
          this.#graph.setEntry(this.#ctxNode.id);
          this.markDirty();
          this.toast('Entry set', 'success');
        }
        if (action === 'rename') {
          const l = prompt('Rename:', this.#ctxNode.label.value);
          if (l !== null) {
            this.#history.record(this.#graph.toJSON());
            this.#ctxNode.label.value = l.trim() || this.#ctxNode.label.value;
            this.markDirty();
          }
        }
        if (action === 'duplicate') {
          this.#history.record(this.#graph.toJSON());
          this.#graph.addNode({
            ...this.#ctxNode.toJSON(),
            id: undefined,
            x: this.#ctxNode.x.value + 80,
            y: this.#ctxNode.y.value + 80,
            meta: { ...this.#ctxNode.meta, isEntry: false },
          });
          this.markDirty();
        }
        if (action === 'copy')  { this.#clipboard = { node: this.#ctxNode.toJSON() }; this.toast(`Copied: ${this.#ctxNode.label.value}`, 'info'); }
        if (action === 'cut')   { this.#clipboard = { node: this.#ctxNode.toJSON() }; this.#history.record(this.#graph.toJSON()); this.#graph.removeNode(this.#ctxNode.id); this.#closePropsPanel(); this.#savant.setNode(null); this.markDirty(); this.toast('Cut', 'info'); }
        if (action === 'delete') {
          this.#history.record(this.#graph.toJSON());
          this.#graph.removeNode(this.#ctxNode.id);
          this.#closePropsPanel();
          this.#savant.setNode(null);
          this.markDirty();
        }
        this.#ctxNode = null;
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      const el = e.target;
      const isEditing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;

      // Ctrl+S — save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.saveProject(); return; }

      // Undo/Redo — only when not editing text
      if (!isEditing) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); return; }

        // Copy / Cut / Paste
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); this.copySelected(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') { e.preventDefault(); this.cutSelected(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); this.paste(); return; }

        // Delete key — remove selected node or edge
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const node = this.#mapBuilder?.selectedNode;
          if (node) {
            this.#history.record(this.#graph.toJSON());
            this.#graph.removeNode(node.id);
            this.#closePropsPanel();
            this.#savant.setNode(null);
            this.markDirty();
            return;
          }
          if (this.#selectedEdge) {
            this.#history.record(this.#graph.toJSON());
            this.#graph.removeEdge(this.#selectedEdge.id);
            this.#selectedEdge = null;
            this.markDirty();
            return;
          }
        }
      }

      // Tool keyboard shortcuts (always active unless editing)
      if (!isEditing) {
        const toolKeys = { v: 'select', s: 'room', d: 'diamond', t: 'terminal', c: 'connect' };
        const tool = toolKeys[e.key];
        if (tool) document.querySelector(`.map-tool[data-tool="${tool}"]`)?.click();
      }
    });

    // Map tool buttons
    document.querySelectorAll('.map-tool[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.map-tool').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.#mapBuilder?.setTool(btn.dataset.tool);
      });
    });

    // Welcome modal
    $('welcome-close')?.addEventListener('click', () => this.#hideWelcome());
    $('welcome-modal')?.addEventListener('click', e => {
      if (e.target === $('welcome-modal')) this.#hideWelcome();
    });
    $('welcome-new-btn')?.addEventListener('click', () => {
      this.#hideWelcome();
      openGallery();
    });
  }

  // ── Split pane resize ─────────────────────────────────────────────

  #initSplitResize() {
    const handle = document.getElementById('split-handle');
    const body   = document.getElementById('ide-body');
    let frac     = 0.6;  // top-pane fraction of available height
    let dragging = false, startY = 0, startFrac = 0;

    const applyFrac = () => {
      const total = body.clientHeight - 8;
      if (total <= 0) return;
      const topPx = Math.round(total * frac);
      const botPx = total - topPx;
      if (topPx < 150 || botPx < 120) return;
      body.style.gridTemplateRows = `${topPx}px 8px ${botPx}px`;
    };

    handle.addEventListener('mousedown', e => {
      dragging  = true;
      startY    = e.clientY;
      startFrac = frac;
      document.body.style.cursor     = 'ns-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const total = body.clientHeight - 8;
      if (total <= 0) return;
      frac = Math.min(
        Math.max(startFrac + (e.clientY - startY) / total, 150 / total),
        1 - 120 / total,
      );
      applyFrac();
    });
    document.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
    });
    window.addEventListener('resize', applyFrac);
    applyFrac();  // Sync grid with frac on init so there's no mismatch on first drag
  }

  // ── Savant column resize ─────────────────────────────────────────

  #initSavantResize() {
    const body = document.getElementById('savant-body');
    if (!body) return;
    let col1 = 160, col2 = 220, col3 = 260;

    const updateCols = () => {
      body.style.gridTemplateColumns = `${col1}px 4px ${col2}px 4px 1fr 4px ${col3}px`;
    };

    // direction: 1 = dragging right increases column (default), -1 = reversed (chat pane)
    const setupHandle = (id, getV, setV, direction = 1) => {
      const handle = document.getElementById(id);
      if (!handle) return;
      let dragging = false, startX = 0, startV = 0;
      handle.addEventListener('mousedown', e => {
        dragging = true; startX = e.clientX; startV = getV();
        document.body.style.cssText += ';cursor:ew-resize;user-select:none';
        e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        setV(Math.max(80, startV + direction * (e.clientX - startX)));
        updateCols();
      });
      document.addEventListener('mouseup', () => {
        if (dragging) { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
      });
    };

    setupHandle('aw-h1', () => col1, v => { col1 = v; });
    setupHandle('aw-h2', () => col2, v => { col2 = v; });
    // aw-h3 is left of chat pane: drag right → shrink chat, drag left → grow chat
    setupHandle('aw-h3', () => col3, v => { col3 = v; }, -1);
  }

  // ── Savant init ──────────────────────────────────────────────────

  #initSavant() {
    const container = document.getElementById('savant-pane');
    this.#savant = new Savant(container);

    this.#savant.on('thing:exit', parentNode => this.#openPropsPanel(parentNode));
    this.#savant.on('toast', ({ msg, type }) => this.toast(msg, type));
    this.#savant.on('customActionsChanged', () => this.markDirty());
    this.#savant.on('payload:changed',      () => this.markDirty());

    this.#savant.on('needNodeOptions', ({ select, currentValue }) => {
      select.innerHTML = '<option value="">— target room —</option>';
      for (const node of this.#graph.nodes.values()) {
        if (node.type === NodeType.DIAMOND) continue;
        const opt = document.createElement('option');
        opt.value = node.id;
        opt.textContent = `${node.label.value} (${node.id})`;
        if (node.id === currentValue) opt.selected = true;
        select.appendChild(opt);
      }
    });

    this.#savant.on('needInventoryKeys', ({ select, currentValue }) => {
      // Preserve the placeholder option
      const existing = [...select.options].map(o => o.value);
      const schema = this.#project?.inventory?.schema ?? {};
      for (const key of Object.keys(schema)) {
        if (!existing.includes(key)) {
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = key;
          select.appendChild(opt);
        }
      }
      // Also allow custom key not in schema
      if (currentValue && !Object.keys(schema).includes(currentValue)) {
        const opt = document.createElement('option');
        opt.value = currentValue;
        opt.textContent = currentValue;
        select.appendChild(opt);
      }
      if (currentValue) select.value = currentValue;
    });

    // ── AI Chat command executor ──────────────────────────────────────
    this.#savant.setChatExecutor(commands => {
      try {
        this.#history.record(this.#graph.toJSON());
        // Build a label→node map for resolution
        const resolveNode = (ref) => {
          if (!ref) return null;
          // Try exact ID first
          const byId = this.#graph.nodes.get(ref);
          if (byId) return byId;
          // Try case-insensitive label
          const lower = String(ref).toLowerCase();
          for (const n of this.#graph.nodes.values()) {
            if (n.label.value.toLowerCase() === lower) return n;
          }
          return null;
        };
        // First pass: collect addNode temp-id map (labels assigned in this batch)
        const created = new Map(); // label → GraphNode
        for (const cmd of commands) {
          if (cmd.cmd === 'addNode') {
            const x = cmd.x ?? (200 + Math.random() * 400);
            const y = cmd.y ?? (200 + Math.random() * 300);
            const node = this.#graph.addNode({ type: cmd.type ?? 'room', label: cmd.label ?? 'Room', x, y });
            if (cmd.entry) this.#graph.setEntry(node.id);
            created.set((cmd.label ?? '').toLowerCase(), node);
          }
        }
        // Second pass: edges and steps
        for (const cmd of commands) {
          if (cmd.cmd === 'addNode') continue; // already done
          if (cmd.cmd === 'addEdge') {
            const fromNode = created.get((cmd.from ?? '').toLowerCase()) ?? resolveNode(cmd.from);
            const toNode   = created.get((cmd.to   ?? '').toLowerCase()) ?? resolveNode(cmd.to);
            if (!fromNode || !toNode) continue;
            const edge = this.#graph.addEdge(fromNode.id, toNode.id);
            if (cmd.label) edge.label.value = cmd.label;
            if (cmd.condition) edge.condition.value = cmd.condition;
          } else if (cmd.cmd === 'addAction') {
            // addAction is the export-side name; addStep is the original internal form
            const node = created.get((cmd.node ?? '').toLowerCase()) ?? resolveNode(cmd.node);
            if (!node) throw new Error(`addAction: node "${cmd.node}" not found`);
            if (!cmd.action) continue;
            const event = cmd.event ?? 'Enter';
            node.addStep(event, { action: cmd.action, params: cmd.params ?? {}, ...(cmd.disabled === true ? { disabled: true } : {}) });
          } else if (cmd.cmd === 'addStep') {
            const node = created.get((cmd.node ?? '').toLowerCase()) ?? resolveNode(cmd.node);
            if (!node) throw new Error(`addStep: node "${cmd.node}" not found`);
            if (!cmd.step) continue;
            const event = cmd.event ?? 'Enter';
            node.addStep(event, cmd.step);
          } else if (cmd.cmd === 'setLabel') {
            const node = created.get((cmd.node ?? '').toLowerCase()) ?? resolveNode(cmd.node);
            if (node && cmd.label) node.label.value = cmd.label;
          } else if (cmd.cmd === 'setEntry') {
            const node = created.get((cmd.node ?? '').toLowerCase()) ?? resolveNode(cmd.node);
            if (node) this.#graph.setEntry(node.id);
          }
        }
        this.markDirty();
        return { ok: true };
      } catch (e) {
        return { error: e.message };
      }
    });
  }

  // ── Command palette init ──────────────────────────────────────────

  #initPalette() {
    this.#palette = new CommandPalette(this);
    for (const cmd of ALL_COMMANDS) this.registerCommand(cmd);
    this.#palette.registerAll(this.listCommands());
    this.emit('palette:ready', this.#palette);
  }

  // ── Boot ──────────────────────────────────────────────────────────

  async boot() {
    this.#initSavant();
    this.use(library);
    this.#initSplitResize();
    this.#initSavantResize();
    this.#initPalette();
    this.#bindToolbar();

    // Initial map canvas — the <undercity-map> element is already in the DOM
    this.#mapBuilder = document.getElementById('undercity-map');
    this.#mapBuilder.setGraph(this.#graph);
    this.#bindMapEvents();

    // Load projects
    await this.loadProjectList();

    // Re-open last project, or show welcome screen
    const lastId = localStorage.getItem('pw-last-project');
    const sel    = document.getElementById('project-select');
    const hasLast = lastId && sel.querySelector(`option[value="${lastId}"]`);

    if (hasLast) {
      sel.value = lastId;
      await this.openProject(lastId);
    } else {
      this.#showWelcome();
    }

    // Expose for AI console backwards-compat
    window.currentProject = this.#project;
    window.ideSavant = this.#savant;
    window.dispatchEvent(new CustomEvent('savant-ready', { detail: this.#savant }));

    this.emit('ready', this);
    return this;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buttonLabel(iconName, label) {
  return `<af-icon name="${iconName}"></af-icon><span>${escHtml(label)}</span>`;
}

// ── Boot ─────────────────────────────────────────────────────────────────────

export const app = new App();

app.boot().catch(err => {
  console.error('[Undercity] Boot error:', err);
  document.getElementById('toast-area')?.insertAdjacentHTML('beforeend',
    `<div class="ide-toast error">Boot error: ${err.message}</div>`);
});

export default app;
