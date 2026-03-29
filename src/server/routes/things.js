/**
 * GET /api/things — Return all built-in Thing type definitions.
 *
 * Scans things/*\/thing.json and returns the parsed objects.
 * Each thing.json must have at minimum: type, label, desc, icon, color.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdir, readFile } from 'fs/promises';

const __dir   = dirname(fileURLToPath(import.meta.url));
const THINGS  = join(__dir, '..', '..', '..', 'things');

export function registerThingsRoute(app) {
  app.get('/api/things', async (_req, res) => {
    try {
      const dirs    = await readdir(THINGS, { withFileTypes: true });
      const results = await Promise.all(
        dirs
          .filter(d => d.isDirectory())
          .map(async d => {
            const jsonPath = join(THINGS, d.name, 'thing.json');
            const raw = await readFile(jsonPath, 'utf8').catch(() => null);
            return raw ? JSON.parse(raw) : null;
          })
      );
      res.json(results.filter(Boolean));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
