/**
 * server.js — Undercity IDE entry point.
 *
 * Thin boot file. All server logic lives in src/server/.
 * Run:  node server.js
 *       node --watch server.js
 */

import { createServer, listen } from './src/server/index.js';

listen(createServer());
