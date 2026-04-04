/**
 * server.js — Undercity IDE entry point.
 *
 * Thin boot file. All server logic lives in network-services/project-server/.
 * Run:  node server.js
 *       node --watch server.js
 */

import { createServer, listen } from './network-services/project-server/index.js';

listen(createServer());
