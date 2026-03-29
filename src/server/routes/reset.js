/**
 * routes/reset.js — Reset endpoint.
 *
 * POST /api/reset
 *   Deletes all generated output and all user projects, then responds { ok: true }.
 *   The client clears localStorage/sessionStorage and reloads.
 */

import { rm, readdir } from 'fs/promises';
import { join } from 'path';

export function registerResetRoute(app, projDir, genDir) {
  app.post('/api/reset', async (req, res) => {
    try {
      // Delete all generated output
      await rm(genDir, { recursive: true, force: true });

      // Delete all project files (keep the directory itself)
      const entries = await readdir(projDir).catch(() => []);
      await Promise.all(
        entries.map(f => rm(join(projDir, f), { recursive: true, force: true }))
      );

      res.json({ ok: true });
    } catch (e) {
      console.error('[reset]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}
