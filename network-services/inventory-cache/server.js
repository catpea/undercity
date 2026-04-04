#!/usr/bin/env node
// example/inventory-cache/server.js
//
// In-memory binary asset cache with a 60-minute TTL.
//
// Solves the blob-URL lifetime problem: the browser uploads a file once and
// gets back a stable http:// URL that survives page navigation, session
// restores, and cross-process access (e.g. the task-queue processor).
//
// Endpoints
// ─────────
//   GET    /health                   Server health + entry count
//   GET    /client.js                Browser ES module (served from disk)
//
//   PUT    /v1/:sessionId/:key       Upload file — raw body, Content-Type required
//                                     Header X-File-Name: <encoded filename>
//                                     Returns { url, key, mime, name, size, expiresAt }
//   GET    /v1/:sessionId/:key       Serve the stored file
//   HEAD   /v1/:sessionId/:key       Metadata headers only (no body)
//   DELETE /v1/:sessionId/:key       Remove entry
//   GET    /v1/:sessionId            List all keys for the session
//   GET    /v1/:sessionId/events     SSE stream — push events: set / delete / expire / snapshot
//
// Environment
// ───────────
//   PORT                default 5000
//   CACHE_TTL_MINUTES   default 60
//   MAX_UPLOAD_BYTES    default 524288000 (500 MB)
//
// Run:  node server.js [port]

import { createServer } from 'node:http';
import { readFileSync }  from 'node:fs';
import { resolve }       from 'node:path';

const VERSION   = '1.0.0';
const PORT      = Number(process.argv[2] ?? process.env.PORT ?? 5000);
const TTL_MS    = Number(process.env.CACHE_TTL_MINUTES ?? 60) * 60_000;
const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES  ?? 500 * 1024 * 1024);

// ── In-memory store ───────────────────────────────────────────────────────────
// Key: `${sessionId}\x00${key}`  (null byte cannot appear in URL segments)
// Value: { mime, name, size, data: Buffer, expires: number }

const store = new Map();

// ── SSE subscribers ───────────────────────────────────────────────────────────
// Map<sessionId, Set<{ res }>>

const subs = new Map();

function getSubs(sessionId) {
  if (!subs.has(sessionId)) subs.set(sessionId, new Set());
  return subs.get(sessionId);
}

function pushSSE(sessionId, event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of getSubs(sessionId)) {
    try { client.res.write(msg); } catch { /* connection already closed */ }
  }
}

// ── TTL sweep — runs every 60 s ───────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const [sk, entry] of store) {
    if (entry.expires < now) {
      store.delete(sk);
      const nul = sk.indexOf('\x00');
      const sessionId = sk.slice(0, nul);
      const key       = sk.slice(nul + 1);
      pushSSE(sessionId, 'expire', { key });
    }
  }
}, 60_000).unref();

// ── Helpers ───────────────────────────────────────────────────────────────────

// Allow alphanumeric, hyphen, underscore, dot — 1-128 chars.
const SAFE_RE = /^[a-zA-Z0-9_.-]{1,128}$/;
function safe(s) { return typeof s === 'string' && SAFE_RE.test(s); }

function sk(sessionId, key) { return `${sessionId}\x00${key}`; }

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type':                'application/json',
    'Cache-Control':               'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body, null, 2));
}

function readBinaryBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        req.destroy(new Error(`Upload exceeds limit (${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end',   () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Route handlers ────────────────────────────────────────────────────────────

// GET /health
function handleHealth(_req, res) {
  send(res, 200, {
    ok:         true,
    version:    VERSION,
    entries:    store.size,
    ttlMinutes: TTL_MS / 60_000,
    maxMB:      MAX_BYTES / 1024 / 1024,
  });
}

// GET /client.js — serve the browser client module from disk
const CLIENT_SRC = readFileSync(resolve(import.meta.dirname, 'client.js'), 'utf8');
function handleClientJs(_req, res) {
  res.writeHead(200, {
    'Content-Type':                'application/javascript',
    'Cache-Control':               'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(CLIENT_SRC);
}

// PUT /v1/:sessionId/:key
function handlePut(sessionId, key, req, res) {
  const mime     = req.headers['content-type'] || 'application/octet-stream';
  const rawName  = req.headers['x-file-name'];
  const name     = rawName ? decodeURIComponent(rawName) : key;

  readBinaryBody(req).then(data => {
    const expires   = Date.now() + TTL_MS;
    const isUpdate  = store.has(sk(sessionId, key));
    store.set(sk(sessionId, key), { mime, name, size: data.length, data, expires });

    const url     = `http://${req.headers.host}/v1/${sessionId}/${key}`;
    const payload = { url, key, mime, name, size: data.length, expiresAt: new Date(expires).toISOString() };

    pushSSE(sessionId, 'set', payload);
    send(res, isUpdate ? 200 : 201, payload);
  }).catch(err => send(res, 413, { error: err.message }));
}

// GET /v1/:sessionId/:key  (or HEAD)
function handleGet(sessionId, key, req, res) {
  const entry = store.get(sk(sessionId, key));
  if (!entry) return send(res, 404, { error: `${sessionId}/${key} not found` });

  // Touch TTL on access
  entry.expires = Date.now() + TTL_MS;

  res.writeHead(200, {
    'Content-Type':                entry.mime,
    'Content-Length':              entry.size,
    'Content-Disposition':         `inline; filename="${entry.name.replace(/"/g, '\\"')}"`,
    'Cache-Control':               'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(req.method === 'HEAD' ? undefined : entry.data);
}

// DELETE /v1/:sessionId/:key
function handleDelete(sessionId, key, res) {
  if (!store.has(sk(sessionId, key))) return send(res, 404, { error: `${sessionId}/${key} not found` });
  store.delete(sk(sessionId, key));
  pushSSE(sessionId, 'delete', { key });
  send(res, 200, { deleted: key });
}

// GET /v1/:sessionId — list keys
function handleList(sessionId, req, res) {
  const prefix = sessionId + '\x00';
  const keys   = [];
  for (const [k, v] of store) {
    if (!k.startsWith(prefix)) continue;
    const key = k.slice(prefix.length);
    keys.push({
      key,
      url:       `http://${req.headers.host}/v1/${sessionId}/${key}`,
      mime:      v.mime,
      name:      v.name,
      size:      v.size,
      expiresAt: new Date(v.expires).toISOString(),
    });
  }
  send(res, 200, { sessionId, count: keys.length, keys });
}

// GET /v1/:sessionId/events — SSE
function handleEvents(sessionId, req, res) {
  res.writeHead(200, {
    'Content-Type':                'text/event-stream',
    'Cache-Control':               'no-cache',
    'Connection':                  'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(': connected\n\n');

  // Send existing keys as an immediate snapshot so the subscriber starts informed
  const prefix = sessionId + '\x00';
  const current = [];
  for (const [k, v] of store) {
    if (!k.startsWith(prefix)) continue;
    const key = k.slice(prefix.length);
    current.push({
      key,
      url:  `http://${req.headers.host}/v1/${sessionId}/${key}`,
      mime: v.mime,
      name: v.name,
      size: v.size,
    });
  }
  res.write(`event: snapshot\ndata: ${JSON.stringify({ keys: current })}\n\n`);

  const client = { res };
  getSubs(sessionId).add(client);

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 30_000);

  req.on('close', () => {
    clearInterval(ping);
    getSubs(sessionId).delete(client);
    if (getSubs(sessionId).size === 0) subs.delete(sessionId);
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

function router(req, res) {
  const { method } = req;
  const path = new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '') || '/';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-File-Name',
    });
    return res.end();
  }

  if (method === 'GET' && path === '/health')    return handleHealth(req, res);
  if (method === 'GET' && path === '/client.js') return handleClientJs(req, res);

  // /v1/:sessionId/events  — must match before the /:key pattern
  const evMatch = path.match(/^\/v1\/([^/]+)\/events$/);
  if (evMatch && method === 'GET') {
    const sid = evMatch[1];
    if (!safe(sid)) return send(res, 400, { error: 'Invalid sessionId.' });
    return handleEvents(sid, req, res);
  }

  // /v1/:sessionId/:key
  const keyMatch = path.match(/^\/v1\/([^/]+)\/([^/]+)$/);
  if (keyMatch) {
    const [, sid, key] = keyMatch;
    if (!safe(sid)) return send(res, 400, { error: 'Invalid sessionId.' });
    if (!safe(key)) return send(res, 400, { error: 'Invalid key.' });
    if (method === 'PUT')                       return handlePut(sid, key, req, res);
    if (method === 'GET' || method === 'HEAD')  return handleGet(sid, key, req, res);
    if (method === 'DELETE')                    return handleDelete(sid, key, res);
  }

  // /v1/:sessionId
  const sessMatch = path.match(/^\/v1\/([^/]+)$/);
  if (sessMatch && method === 'GET') {
    const sid = sessMatch[1];
    if (!safe(sid)) return send(res, 400, { error: 'Invalid sessionId.' });
    return handleList(sid, req, res);
  }

  send(res, 404, { error: `No route: ${method} ${path}` });
}

// ── Start ─────────────────────────────────────────────────────────────────────

const server = createServer(router);
server.listen(PORT, () => {
  const ttl = TTL_MS / 60_000;
  console.log(`Inventory cache v${VERSION} listening on http://localhost:${PORT}`);
  console.log(`TTL: ${ttl} min  |  Max upload: ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB`);
  console.log('');
  console.log('  GET    /health                    Server health + entry count');
  console.log('  GET    /client.js                 Browser ES module');
  console.log('');
  console.log('  PUT    /v1/:sessionId/:key        Upload file (raw body, Content-Type required)');
  console.log('  GET    /v1/:sessionId/:key        Serve stored file');
  console.log('  HEAD   /v1/:sessionId/:key        File metadata (no body)');
  console.log('  DELETE /v1/:sessionId/:key        Remove entry');
  console.log('  GET    /v1/:sessionId             List session keys');
  console.log('  GET    /v1/:sessionId/events      SSE stream (set / delete / expire)');
});
