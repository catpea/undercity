/**
 * src/server/index.js — HTTP server setup.
 *
 * createServer(options?) builds the Express-compatible app.
 * listen(app, port?)   starts it and returns {server, port, url, close}.
 *
 * Options accepted by createServer():
 *   projDir  — absolute path to the projects directory  (default: <root>/projects)
 *   genDir   — absolute path to the generated directory (default: <root>/generated)
 *
 * Passing explicit directories is how integration tests achieve full isolation:
 *   const app = createServer({ projDir: tmpDir, genDir: tmpGenDir });
 *   const { url, close } = await listen(app, 0);  // port 0 → OS picks one
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import express from '../../packages/undercity-http-server/index.js';

import { registerProjectRoutes }  from './routes/projects.js';
import { registerGenerateRoute }  from './routes/generate.js';
import { registerAIRoute }        from './routes/ai.js';
import { registerSubmitRoute }    from './routes/submit.js';
import { registerTemplatesRoute } from './routes/templates.js';
import { registerActionsRoute }   from './routes/actions.js';
import { registerResetRoute }     from './routes/reset.js';
import { registerThingsRoute }    from './routes/things.js';

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, '..', '..');

const DEFAULT_PROJ   = join(ROOT, 'projects');
const DEFAULT_GENDIR = join(ROOT, 'generated');
const DEFAULT_PORT   = process.env.PORT ?? 3000;

// ── App factory ────────────────────────────────────────────────────────────────

export function createServer({ projDir = DEFAULT_PROJ, genDir = DEFAULT_GENDIR } = {}) {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '4mb' }));

  // Static assets
  app.use('/lib/bootstrap', express.static(join(ROOT, 'generator', 'base')));
  app.use('/packages',      express.static(join(ROOT, 'packages')));
  app.use('/src',           express.static(join(ROOT, 'src')));
  app.use('/generated',     express.static(genDir));
  app.use('/actions',       express.static(join(ROOT, 'actions')));
  app.use('/',              express.static(join(ROOT, 'public')));

  // API routes
  registerProjectRoutes(app, projDir);
  registerGenerateRoute(app, projDir, genDir);
  registerAIRoute(app);
  registerSubmitRoute(app);
  registerTemplatesRoute(app);
  registerActionsRoute(app);
  registerResetRoute(app, projDir, genDir);
  registerThingsRoute(app);

  // Serve thing.json and associated assets
  app.use('/things', express.static(join(ROOT, 'things')));

  return app;
}

// ── Server lifecycle ───────────────────────────────────────────────────────────

/**
 * Start the app listening. Returns a promise that resolves once the server
 * is ready, yielding { server, port, url, close }.
 *
 * Pass port = 0 for a random available port (useful in tests).
 */
export function listen(app, port) {
  const listenPort = port ?? Number(DEFAULT_PORT);
  return new Promise((resolve, reject) => {
    const srv = app.listen(listenPort, () => {
      const addr = srv.address();
      const p    = addr.port;
      if (!port) {
        // Production boot — emit to stdout
        console.log(`\n  Undercity IDE  →  http://localhost:${p}\n`);
      }
      resolve({
        server: srv,
        port:   p,
        url:    `http://localhost:${p}`,
        close:  () => new Promise((res, rej) => srv.close(err => err ? rej(err) : res())),
      });
    });
    srv.on('error', reject);
  });
}
