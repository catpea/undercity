/**
 * routes/templates.js — Read-only access to built-in project templates.
 *
 * GET /api/templates
 *   Returns the list of available templates (id, name, description, icon,
 *   category, preview). Does NOT include the full graph — the client fetches
 *   the full body via GET /api/templates/:id when the user confirms creation.
 *
 * GET /api/templates/:id
 *   Returns the full template JSON (including graph, inventory, customActions).
 *
 * Templates live in <root>/templates/*.json.
 */

import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join, dirname }     from 'node:path';
import { fileURLToPath }     from 'node:url';

import { normalizeIconName } from '../../lib/icons.js';

const __dir    = dirname(fileURLToPath(import.meta.url));
const TMPL_DIR = join(__dir, '..', '..', '..', 'templates');

/** Read and parse all template JSONs. Cached for the process lifetime. */
let _cache = null;

function normalizeTemplate(template) {
  const graph = template.graph
    ? {
        ...template.graph,
        nodes: (template.graph.nodes ?? []).map(node => ({
          ...node,
          meta: node.meta?.icon
            ? { ...node.meta, icon: normalizeIconName(node.meta.icon, 'stars') }
            : node.meta,
        })),
      }
    : template.graph;

  return {
    ...template,
    icon: normalizeIconName(template.icon, 'stars'),
    graph,
  };
}

async function loadTemplates() {
  if (_cache) return _cache;
  try {
    const files = (await readdir(TMPL_DIR)).filter(f => f.endsWith('.json'));
    const all   = await Promise.all(
      files.map(async f => {
        try { return JSON.parse(await readFile(join(TMPL_DIR, f), 'utf8')); }
        catch { return null; }
      })
    );
    _cache = all.filter(Boolean).map(normalizeTemplate);
  } catch {
    _cache = [];
  }
  return _cache;
}

export function registerTemplatesRoute(app) {

  // List — lightweight (no graph payload)
  app.get('/api/templates', async (_req, res) => {
    const all  = await loadTemplates();
    const list = all.map(({ id, name, description, icon, category, preview }) =>
      ({ id, name, description, icon: icon ?? 'stars', category: category ?? 'general', preview: preview ?? '' })
    );
    res.json(list);
  });

  // Full template (used when user confirms "Create from this template")
  app.get('/api/templates/:id', async (req, res) => {
    const all  = await loadTemplates();
    const tmpl = all.find(t => t.id === req.params.id);
    if (!tmpl) return res.status(404).json({ error: 'Template not found' });
    res.json(tmpl);
  });

  // Save project as template (POST /api/templates)
  // Body: { id, name, description, icon, category, graph, inventory, customActions }
  app.post('/api/templates', async (req, res) => {
    const { id, name, description, icon, category, graph, inventory, customActions } = req.body ?? {};
    if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
    // Sanitize id to safe filename
    const safeId = String(id).toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const tmpl = {
      id:           safeId,
      name:         String(name),
      description:  String(description ?? ''),
      icon:         String(icon ?? 'stars'),
      category:     String(category ?? 'custom'),
      preview:      '',
      graph:        graph ?? { nodes: [], edges: [] },
      inventory:    inventory ?? { schema: {} },
      customActions: customActions ?? {},
    };
    await writeFile(join(TMPL_DIR, `${safeId}.json`), JSON.stringify(tmpl, null, 2), 'utf8');
    _cache = null; // invalidate cache
    res.json(tmpl);
  });

  // Update an existing template (PUT /api/templates/:id) — same body shape
  app.put('/api/templates/:id', async (req, res) => {
    const safeId = String(req.params.id).toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const filePath = join(TMPL_DIR, `${safeId}.json`);
    try { await readFile(filePath); } catch { return res.status(404).json({ error: 'Template not found' }); }
    const { name, description, icon, category, graph, inventory, customActions } = req.body ?? {};
    const existing = JSON.parse(await readFile(filePath, 'utf8'));
    const updated = {
      ...existing,
      ...(name        !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(icon        !== undefined && { icon }),
      ...(category    !== undefined && { category }),
      ...(graph       !== undefined && { graph }),
      ...(inventory   !== undefined && { inventory }),
      ...(customActions !== undefined && { customActions }),
    };
    await writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');
    _cache = null;
    res.json(updated);
  });

  // Delete a template (DELETE /api/templates/:id)
  app.delete('/api/templates/:id', async (req, res) => {
    const safeId = String(req.params.id).toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    try {
      await unlink(join(TMPL_DIR, `${safeId}.json`));
      _cache = null;
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'Template not found' });
    }
  });
}
