/**
 * routes/projects.js — Project CRUD REST API.
 *
 * GET    /api/projects          → list all project summaries
 * GET    /api/projects/:id      → get full project
 * POST   /api/projects          → create project  (body: project object with .id)
 * PUT    /api/projects/:id      → update project  (body: partial project object)
 * DELETE /api/projects/:id      → delete project
 */

import { readFile, writeFile, readdir, mkdir, rm, access } from 'fs/promises';
import { join } from 'path';

// ── Storage helpers ───────────────────────────────────────────────────────────

async function pathExists(p) {
  try { await access(p); return true; } catch { return false; }
}

export async function readProject(projDir, id) {
  const p = join(projDir, id, 'project.json');
  if (!await pathExists(p)) return null;
  return JSON.parse(await readFile(p, 'utf8'));
}

export async function writeProject(projDir, id, data) {
  const dir = join(projDir, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'project.json'), JSON.stringify(data, null, 2), 'utf8');
}

// ── Route factory ─────────────────────────────────────────────────────────────

/**
 * Register all project CRUD routes on `app`.
 *
 * @param {object} app     - Express-compatible app
 * @param {string} projDir - Absolute path to projects directory
 */
export function registerProjectRoutes(app, projDir) {

  // List
  app.get('/api/projects', async (_req, res) => {
    try {
      await mkdir(projDir, { recursive: true });
      const entries = await readdir(projDir, { withFileTypes: true });
      const summaries = await Promise.all(
        entries.filter(d => d.isDirectory()).map(async d => {
          const proj = await readProject(projDir, d.name);
          if (!proj) return null;
          return { id: proj.id, name: proj.name, description: proj.description, modified: proj.modified };
        })
      );
      res.json(summaries.filter(Boolean));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get one
  app.get('/api/projects/:id', async (req, res) => {
    const proj = await readProject(projDir, req.params.id);
    if (!proj) return res.status(404).json({ error: 'Project not found' });
    res.json(proj);
  });

  // Create
  app.post('/api/projects', async (req, res) => {
    try {
      const now  = new Date().toISOString();
      const data = { ...req.body, created: now, modified: now };
      if (!data.id) return res.status(400).json({ error: 'id required' });
      await writeProject(projDir, data.id, data);
      res.status(201).json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update
  app.put('/api/projects/:id', async (req, res) => {
    try {
      const existing = await readProject(projDir, req.params.id);
      const data = {
        ...(existing ?? {}),
        ...req.body,
        id:       req.params.id,
        modified: new Date().toISOString(),
      };
      await writeProject(projDir, req.params.id, data);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete
  app.delete('/api/projects/:id', async (req, res) => {
    try {
      await rm(join(projDir, req.params.id), { recursive: true, force: true });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
