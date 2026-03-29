/**
 * routes/actions.js — Action plugin discovery API.
 *
 * GET /api/actions/plugins
 *   Scans <root>/actions/<category>/<action-name>/action.json and returns
 *   all plugin definitions grouped by category, ready to merge into the IDE's
 *   ACTION_LIBRARY.
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
 *
 * Each action.json must have at minimum: id, category, label, desc, params[].
 * Optional fields: categoryLabel, icon, color, version.
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname }     from 'path';
import { fileURLToPath }     from 'url';

const __dir      = dirname(fileURLToPath(import.meta.url));
const ACTIONS_DIR = join(__dir, '..', '..', '..', 'actions');

// Default icon/color per category (fallback when action.json omits them)
const CATEGORY_DEFAULTS = {
  display:        { icon: 'type',               color: 'var(--sol-cyan)'    },
  render:         { icon: 'layout-text-window', color: 'var(--sol-violet)'  },
  auth:           { icon: 'shield-lock',        color: 'var(--sol-blue)'    },
  media:          { icon: 'film',               color: 'var(--sol-magenta)' },
  data:           { icon: 'database',           color: 'var(--sol-yellow)'  },
  notification:   { icon: 'bell',               color: 'var(--sol-orange)'  },
};

export function registerActionsRoute(app) {
  /**
   * GET /api/actions/tests
   * Returns a list of { actionId, url } objects for all discovered action.test.js files.
   * The testbench can dynamically import these to run per-action tests.
   */
  app.get('/api/actions/tests', async (_req, res) => {
    try {
      const tests = [];
      let catDirs;
      try { catDirs = await readdir(ACTIONS_DIR, { withFileTypes: true }); }
      catch { return res.json([]); }

      for (const catEnt of catDirs) {
        if (!catEnt.isDirectory()) continue;
        const catDir = join(ACTIONS_DIR, catEnt.name);
        let actionDirs;
        try { actionDirs = await readdir(catDir, { withFileTypes: true }); }
        catch { continue; }

        for (const actEnt of actionDirs) {
          if (!actEnt.isDirectory()) continue;
          const testPath = join(catDir, actEnt.name, 'action.test.js');
          try {
            await readFile(testPath); // check existence
            tests.push({
              actionId: `${catEnt.name}.${actEnt.name}`,
              url: `/actions/${catEnt.name}/${actEnt.name}/action.test.js`,
            });
          } catch { /* no test file */ }
        }
      }
      res.json(tests);
    } catch (err) {
      console.error('[actions/tests]', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/actions/plugins
   * Returns all discovered plugins merged into ACTION_LIBRARY-compatible shape.
   */
  app.get('/api/actions/plugins', async (_req, res) => {
    try {
      const result = {};

      // Each sub-directory of actions/ is a category
      let catDirs;
      try {
        catDirs = await readdir(ACTIONS_DIR, { withFileTypes: true });
      } catch {
        return res.json({});   // actions/ dir missing → no plugins
      }

      for (const catEnt of catDirs) {
        if (!catEnt.isDirectory()) continue;
        const catId  = catEnt.name;
        const catDir = join(ACTIONS_DIR, catId);

        let actionDirs;
        try { actionDirs = await readdir(catDir, { withFileTypes: true }); }
        catch { continue; }

        for (const actEnt of actionDirs) {
          if (!actEnt.isDirectory()) continue;
          const manifestPath = join(catDir, actEnt.name, 'action.json');

          let manifest;
          try {
            manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
          } catch { continue; }   // skip malformed / missing manifests

          if (!manifest.id || !manifest.label) continue;

          // Initialise category bucket if first action from this category
          if (!result[catId]) {
            const defaults = CATEGORY_DEFAULTS[catId] ?? {};
            result[catId] = {
              label:   manifest.categoryLabel ?? catId.charAt(0).toUpperCase() + catId.slice(1),
              icon:    manifest.icon  ?? defaults.icon  ?? 'puzzle',
              color:   manifest.color ?? defaults.color ?? 'var(--sol-base1)',
              actions: {},
            };
          }

          result[catId].actions[manifest.id] = {
            label:  manifest.label,
            desc:   manifest.desc  ?? '',
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
