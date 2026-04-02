#!/usr/bin/env node
// example/task-queue/task-queue.js
//
// Pure Node.js task queue server — no external dependencies.
//
// A Form is a named collection of Fields.  Each Field has a name, a value,
// and optional type metadata (mirrors what input controls store in Inventory).
//
// Files are sent as base64-encoded data URLs so that the client never needs
// a real upload endpoint — everything stays in the page until the user
// explicitly submits.
//
// Endpoints
// ─────────
//   POST   /submit          Submit a form { formId, fields: { key: Field } }
//   GET    /queue           List pending submission IDs + formId + timestamp
//   GET    /dequeue         Pop the oldest pending submission (moves → active)
//   GET    /submission/:id  Read a specific submission by UUID
//   DELETE /clear/:id       Remove a submission (call after processing)
//   GET    /status          Queue stats
//
// Storage layout
// ──────────────
//   incoming/
//     <uuid>/
//       form.json    ← { id, formId, timestamp, fields }
//
//   active/
//     <uuid> → symlink or copy of the incoming directory (simple move)
//
// Run:  node task-queue.js [port]   (default port: 4000)

import { createServer }                       from 'node:http';
import { randomUUID }                         from 'node:crypto';
import { mkdirSync, writeFileSync,
         readdirSync, readFileSync,
         rmSync, renameSync, existsSync }     from 'node:fs';
import { join, resolve }                      from 'node:path';

// ── Storage roots ─────────────────────────────────────────────────────────────

const ROOT     = resolve(import.meta.dirname, 'data');
const INCOMING = join(ROOT, 'incoming');
const ACTIVE   = join(ROOT, 'active');

for (const dir of [ROOT, INCOMING, ACTIVE]) {
  mkdirSync(dir, { recursive: true });
}

// ── Field / Form types ────────────────────────────────────────────────────────

/**
 * Field  — one form control's submitted value.
 *
 * Scalar field:
 *   { name: string, value: string | number | boolean, type?: string }
 *
 * File field:
 *   { name: string, value: string (data URL), type: string (MIME),
 *     fileName: string, fileSize: number }
 *
 * Multi-file field:
 *   { name: string, value: Array<FileField> }
 */

/**
 * Form submission stored on disk:
 *   { id: uuid, formId: string, timestamp: ISO string, fields: Record<string, Field> }
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type':  'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(json);
}

function listDir(dir) {
  try { return readdirSync(dir); } catch { return []; }
}

function readSubmission(dir, id) {
  const file = join(dir, id, 'form.json');
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

// ── Route handlers ────────────────────────────────────────────────────────────

function handleSubmit(req, res) {
  readBody(req).then(raw => {
    let body;
    try { body = JSON.parse(raw); } catch {
      return send(res, 400, { error: 'Request body must be JSON.' });
    }

    const { formId, fields } = body;

    if (!formId || typeof formId !== 'string') {
      return send(res, 400, { error: 'formId (string) is required.' });
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return send(res, 400, { error: 'fields (object) is required.' });
    }

    const id        = randomUUID();
    const timestamp = new Date().toISOString();
    const submission = { id, formId, timestamp, fields };

    const dir = join(INCOMING, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'form.json'), JSON.stringify(submission, null, 2), 'utf8');

    send(res, 201, { id, formId, timestamp });
  }).catch(err => send(res, 500, { error: err.message }));
}

function handleQueue(_req, res) {
  const ids = listDir(INCOMING);
  const items = ids.flatMap(id => {
    const s = readSubmission(INCOMING, id);
    if (!s) return [];
    return [{ id: s.id, formId: s.formId, timestamp: s.timestamp }];
  });
  // Oldest first
  items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  send(res, 200, { pending: items.length, items });
}

function handleDequeue(_req, res) {
  const ids = listDir(INCOMING);
  if (ids.length === 0) {
    return send(res, 200, { submission: null });
  }

  // Pick the oldest
  const submissions = ids.flatMap(id => {
    const s = readSubmission(INCOMING, id);
    return s ? [s] : [];
  });
  submissions.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const submission = submissions[0];
  const srcDir     = join(INCOMING, submission.id);
  const dstDir     = join(ACTIVE,   submission.id);

  try {
    renameSync(srcDir, dstDir);
  } catch (err) {
    return send(res, 500, { error: `Could not move to active: ${err.message}` });
  }

  send(res, 200, { submission });
}

function handleGetSubmission(id, res) {
  const s = readSubmission(INCOMING, id) ?? readSubmission(ACTIVE, id);
  if (!s) return send(res, 404, { error: `Submission ${id} not found.` });
  send(res, 200, { submission: s });
}

function handleClear(id, res) {
  const inDir = join(INCOMING, id);
  const acDir = join(ACTIVE,   id);

  if (existsSync(inDir)) {
    rmSync(inDir, { recursive: true, force: true });
    return send(res, 200, { cleared: id, from: 'incoming' });
  }
  if (existsSync(acDir)) {
    rmSync(acDir, { recursive: true, force: true });
    return send(res, 200, { cleared: id, from: 'active' });
  }

  send(res, 404, { error: `Submission ${id} not found.` });
}

function handleStatus(_req, res) {
  send(res, 200, {
    pending: listDir(INCOMING).length,
    active:  listDir(ACTIVE).length,
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function router(req, res) {
  const { method, url: rawUrl } = req;
  const url  = new URL(rawUrl, 'http://localhost');
  const path = url.pathname.replace(/\/$/, '') || '/';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  if (method === 'POST'   && path === '/submit')        return handleSubmit(req, res);
  if (method === 'GET'    && path === '/queue')         return handleQueue(req, res);
  if (method === 'GET'    && path === '/dequeue')       return handleDequeue(req, res);
  if (method === 'GET'    && path === '/status')        return handleStatus(req, res);

  const subMatch = path.match(/^\/submission\/(.+)$/);
  if (method === 'GET' && subMatch) {
    const id = subMatch[1];
    if (!UUID_RE.test(id)) return send(res, 400, { error: 'Invalid submission ID.' });
    return handleGetSubmission(id, res);
  }

  const clearMatch = path.match(/^\/clear\/(.+)$/);
  if (method === 'DELETE' && clearMatch) {
    const id = clearMatch[1];
    if (!UUID_RE.test(id)) return send(res, 400, { error: 'Invalid submission ID.' });
    return handleClear(id, res);
  }

  send(res, 404, { error: `No route: ${method} ${path}` });
}

// ── Server ────────────────────────────────────────────────────────────────────

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4000);

const server = createServer(router);

server.listen(PORT, () => {
  console.log(`Task queue listening on http://localhost:${PORT}`);
  console.log(`Storage: ${ROOT}`);
  console.log('');
  console.log('  POST   /submit            Submit a form');
  console.log('  GET    /queue             List pending submissions');
  console.log('  GET    /dequeue           Pop the oldest submission → active');
  console.log('  GET    /submission/:id    Read a specific submission');
  console.log('  DELETE /clear/:id         Remove a processed submission');
  console.log('  GET    /status            Queue stats');
});
