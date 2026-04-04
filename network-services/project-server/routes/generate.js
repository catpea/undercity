/**
 * routes/generate.js — Code generation endpoint.
 *
 * POST /api/projects/:id/generate
 *   Reads the project, calls generateProject(), returns the file list.
 */

import { mkdir } from 'fs/promises';
import { join }  from 'path';

import { readProject }     from './projects.js';
import { generateProject } from '../../../src/generator/index.js';

/**
 * @param {object} app     - Express-compatible app
 * @param {string} projDir - Absolute path to projects directory
 * @param {string} genDir  - Absolute path to generated output directory
 */
export function registerGenerateRoute(app, projDir, genDir) {

  app.post('/api/projects/:id/generate', async (req, res) => {
    try {
      const proj = await readProject(projDir, req.params.id);
      if (!proj) return res.status(404).json({ error: 'Project not found' });

      // ── Graph validation ─────────────────────────────────────────────────
      const nodes = proj.graph?.nodes ?? [];
      const edges = proj.graph?.edges ?? [];
      const nodeIds = new Set(nodes.map(n => n.id));

      const entryNode = nodes.find(n => n.meta?.isEntry);
      if (!entryNode) {
        return res.status(400).json({ error: 'Graph has no entry node. Mark one node as the entry point.' });
      }

      const badEdges = edges.filter(e => !nodeIds.has(e.toId) || !nodeIds.has(e.fromId));
      if (badEdges.length) {
        return res.status(400).json({
          error: `Graph has ${badEdges.length} edge(s) referencing missing nodes`,
          badEdges: badEdges.map(e => e.id),
        });
      }
      // ─────────────────────────────────────────────────────────────────────

      const outDir = join(genDir, proj.id);
      await mkdir(outDir, { recursive: true });

      const files = await generateProject(proj, outDir);
      res.json({ ok: true, files, path: `/generated/${proj.id}/` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
