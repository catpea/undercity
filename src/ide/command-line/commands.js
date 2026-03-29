/**
 * command-line/commands.js — Built-in command definitions for the Undercity IDE.
 *
 * Commands are plain objects:
 * {
 *   name:        string           — command name (may be multi-word: "scaffold form")
 *   category:    string           — grouping label for the palette
 *   description: string           — one-line summary shown in the palette
 *   usage:       string           — usage string shown in detail view
 *   args?:       ArgDef[]         — positional argument definitions
 *   flags?:      Record<string, FlagDef>  — flag definitions for documentation
 *   execute:     async (ctx) => void     — ctx = { args, flags, app }
 * }
 *
 * Commands have access to the full App instance via `ctx.app`, allowing them
 * to read/write the graph, open projects, show toasts, etc.
 */

// ── Project commands ──────────────────────────────────────────────────────────

export const projectCommands = [
  {
    name:        'new project',
    category:    'Project',
    description: 'Create a new project',
    usage:       'new project <id> [--name <name>] [--desc <description>]',
    execute: async ({ args, flags, app }) => {
      const id   = args[0] ?? flags.id;
      const name = flags.name ?? id ?? 'Untitled';
      const desc = flags.desc ?? flags.description ?? '';
      if (!id) { app.toast('Usage: new project <id>', 'error'); return; }
      await app.createProject({ id, name, description: desc,
        graph: { nodes: [], edges: [] }, inventory: { schema: {} }, customActions: {} });
    },
  },
  {
    name:        'open',
    category:    'Project',
    description: 'Open a project by ID',
    usage:       'open <project-id>',
    execute: async ({ args, app }) => {
      const id = args[0];
      if (!id) { app.toast('Usage: open <project-id>', 'error'); return; }
      await app.openProject(id);
    },
  },
  {
    name:        'save',
    category:    'Project',
    description: 'Save the current project',
    usage:       'save',
    execute: async ({ app }) => { await app.saveProject(); },
  },
  {
    name:        'generate',
    category:    'Project',
    description: 'Generate Bootstrap output for the current project',
    usage:       'generate [--open]',
    execute: async ({ flags, app }) => {
      const result = await app.generateProject();
      if (flags.open && result?.path) window.open(result.path, '_blank');
    },
  },
];

// ── Graph commands ────────────────────────────────────────────────────────────

export const graphCommands = [
  {
    name:        'add room',
    category:    'Graph',
    description: 'Add a room node to the graph',
    usage:       'add room <label> [--template <template>] [--entry]',
    execute: async ({ args, flags, app }) => {
      const label    = args.join(' ') || 'New Room';
      const template = flags.template ?? null;
      const isEntry  = !!flags.entry;
      const node = app.graph.addNode({ type: 'room', label, template });
      if (isEntry) app.graph.setEntry(node.id);
      app.markDirty();
      app.toast(`Added room: `, 'success');
    },
  },
  {
    name:        'add diamond',
    category:    'Graph',
    description: 'Add a logic-routing diamond node',
    usage:       'add diamond <label>',
    execute: async ({ args, app }) => {
      const label = args.join(' ') || 'Logic Check';
      app.graph.addNode({ type: 'diamond', label });
      app.markDirty();
      app.toast(`Added diamond: ${label}`, 'success');
    },
  },
  {
    name:        'add terminal',
    category:    'Graph',
    description: 'Add a terminal (end-state) node',
    usage:       'add terminal <label> [--message <msg>]',
    execute: async ({ args, flags, app }) => {
      const label   = args.join(' ') || 'End';
      const message = flags.message ?? '';
      app.graph.addNode({ type: 'terminal', label, meta: { message } });
      app.markDirty();
      app.toast(`Added terminal: ${label}`, 'success');
    },
  },
  {
    name:        'fit',
    category:    'View',
    description: 'Fit the graph to the viewport',
    usage:       'fit',
    execute: async ({ app }) => { app.fitView(); },
  },
  {
    name:        'list nodes',
    category:    'Graph',
    description: 'List all nodes in the current graph',
    usage:       'list nodes',
    execute: async ({ app }) => {
      const nodes = [...app.graph.nodes.values()];
      if (!nodes.length) { app.toast('Graph is empty', 'info'); return; }
      const msg = nodes.map(n => `${n.id}: ${n.label.value} (${n.type})`).join('\n');
      console.table(nodes.map(n => ({ id: n.id, label: n.label.value, type: n.type })));
      app.toast(`${nodes.length} nodes — see console`, 'info');
    },
  },
];

// ── Scaffold commands (plugin-aware) ─────────────────────────────────────────

export const scaffoldCommands = [
  {
    name:        'scaffold form',
    category:    'Generator',
    description: 'Add a form-builder room with configurable fields',
    usage:       'scaffold form <room-id> [--title <title>] [--fields <name:type,...>] [--submit <label>]',
    execute: async ({ args, flags, app }) => {
      const id     = args[0];
      if (!id) { app.toast('Usage: scaffold form <room-id>', 'error'); return; }

      const fields = (flags.fields ?? 'email:email,password:password').split(',').map(spec => {
        const [name, type = 'text'] = spec.split(':');
        return { name: name.trim(), type: type.trim(), label: name.trim(), required: true };
      });

      app.graph.addNode({
        type:     'room',
        id,
        label:    flags.title ?? id,
        template: 'form-builder',
        meta: {
          form: {
            title:       flags.title ?? id,
            submitLabel: flags.submit ?? 'Submit',
            fields,
          },
        },
      });
      app.markDirty();
      app.toast(`Scaffolded form room: ${id}`, 'success');
    },
  },
  {
    name:        'scaffold wizard',
    category:    'Generator',
    description: 'Add a multi-step wizard room',
    usage:       'scaffold wizard <room-id> [--steps <step1,step2,...>] [--title <title>]',
    execute: async ({ args, flags, app }) => {
      const id    = args[0];
      if (!id) { app.toast('Usage: scaffold wizard <room-id>', 'error'); return; }

      const stepIds = (flags.steps ?? 'step-1,step-2').split(',').map(s => s.trim());
      const steps   = stepIds.map(sid => ({
        id:     sid,
        title:  sid.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        fields: [],
      }));

      app.graph.addNode({
        type:     'room',
        id,
        label:    flags.title ?? id,
        template: 'wizard',
        meta: { wizard: { title: flags.title ?? id, steps } },
      });
      app.markDirty();
      app.toast(`Scaffolded wizard room: ${id} (${steps.length} steps)`, 'success');
    },
  },
  {
    name:        'set transition',
    category:    'Project',
    description: 'Set the page transition animation style',
    usage:       'set transition <fade|slide|push|zoom|none>',
    execute: async ({ args, app }) => {
      const type = args[0] ?? 'fade';
      const allowed = ['fade', 'slide', 'push', 'zoom', 'none'];
      if (!allowed.includes(type)) {
        app.toast(`Unknown transition: ${type}. Use: ${allowed.join(', ')}`, 'error');
        return;
      }
      if (!app.project) { app.toast('No project open', 'error'); return; }
      app.project.meta = { ...(app.project.meta ?? {}), transition: type };
      app.markDirty();
      app.toast(`Transition set to: ${type}`, 'success');
    },
  },
];

// ── Help command ──────────────────────────────────────────────────────────────

export const helpCommands = [
  {
    name:        'help',
    category:    'General',
    description: 'Show available commands or details for a specific command',
    usage:       'help [command-name]',
    execute: async ({ args, app }) => {
      const target = args.join(' ');
      if (target) {
        const cmd = app.getCommand(target);
        if (cmd) { console.info(`[${cmd.name}]\n${cmd.usage}\n${cmd.description}`); app.toast(cmd.usage, 'info'); }
        else { app.toast(`Unknown command: ${target}`, 'error'); }
      } else {
        const all = app.listCommands();
        console.table(all.map(c => ({ name: c.name, category: c.category, description: c.description })));
        app.toast(`${all.length} commands — see console`, 'info');
      }
    },
  },
];

// ── All built-in commands ─────────────────────────────────────────────────────

export const ALL_COMMANDS = [
  ...projectCommands,
  ...graphCommands,
  ...scaffoldCommands,
  ...helpCommands,
];
