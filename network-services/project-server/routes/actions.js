/**
 * routes/actions.js — Action plugin discovery API.
 *
 * GET /api/actions/plugins
 *   Scans <root>/library/<category>/<action>/action.json (plus category.json
 *   for category metadata) and returns all plugin definitions grouped by
 *   category, ready to merge into the IDE's ACTION_LIBRARY.
 *
 * Response shape:
 *   {
 *     "<categoryId>": {
 *       label:   string,
 *       icon:    string,
 *       color:   string,
 *       actions: {
 *         "<action.id>": { label, desc, params, ... }
 *       }
 *     },
 *     ...
 *   }
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname }     from 'path';
import { fileURLToPath }     from 'url';

const __dir      = dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = join(__dir, '..', '..', '..', 'library');

export function registerActionsRoute(app) {
  /**
   * GET /api/actions/plugins
   * Returns all discovered plugins merged into ACTION_LIBRARY-compatible shape.
   */
  app.get('/api/actions/plugins', async (_req, res) => {
    try {
      const result = {};

      let catDirs;
      try {
        catDirs = await readdir(LIBRARY_DIR, { withFileTypes: true });
      } catch {
        return res.json({});
      }

      for (const catEnt of catDirs) {
        if (!catEnt.isDirectory()) continue;
        const catId  = catEnt.name;
        const catDir = join(LIBRARY_DIR, catId);

        // Read category.json for label/icon/color
        let catMeta = {};
        try {
          catMeta = JSON.parse(await readFile(join(catDir, 'category.json'), 'utf8'));
        } catch { /* category.json optional */ }

        let actionDirs;
        try { actionDirs = await readdir(catDir, { withFileTypes: true }); }
        catch { continue; }

        for (const actEnt of actionDirs) {
          if (!actEnt.isDirectory()) continue;
          const manifestPath = join(catDir, actEnt.name, 'action.json');

          let manifest;
          try {
            manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
          } catch { continue; }

          if (!manifest.id || !manifest.label) continue;

          if (!result[catId]) {
            result[catId] = {
              label:   catMeta.name  ?? catId.charAt(0).toUpperCase() + catId.slice(1),
              icon:    catMeta.icon  ?? 'puzzle',
              color:   catMeta.color ?? 'var(--sol-base1)',
              actions: {},
            };
          }

          result[catId].actions[manifest.id] = {
            label:  manifest.label,
            desc:   manifest.desc   ?? '',
            params: manifest.params ?? [],
            ...(manifest.version ? { version: manifest.version } : {}),
          };
        }
      }

      res.json(result);
    } catch (err) {
      console.error('[actions/plugins]', err);
      res.status(500).json({ error: err.message });
    }
  });
}
