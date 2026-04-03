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
// Endpoints (original)
// ─────────────────────
//   POST   /submit          Submit a form { formId, jobId?, fields }
//   GET    /queue           List pending submission IDs + formId + timestamp
//   GET    /dequeue         Pop the oldest pending submission (moves → active)
//   GET    /submission/:id  Read a specific submission by UUID
//   DELETE /clear/:id       Remove a submission (call after processing)
//   GET    /status          Queue stats
//
// Endpoints (new — job tracking)
// ────────────────────────────────
//   GET    /health                 Server health + version
//   GET    /job/:jobId             Look up a submission by client-provided jobId
//   GET    /job/:jobId/progress    Read current progress { percent, message, state }
//   POST   /job/:jobId/progress    Worker posts progress update
//   GET    /job/:jobId/log         Read all log entries
//   POST   /job/:jobId/log         Worker appends a log entry { level?, message }
//
// Storage layout
// ──────────────
//   data/
//     incoming/<uuid>/
//       form.json      ← { id, jobId?, formId, timestamp, fields }
//       progress.json  ← { percent, message, state, updatedAt }
//       log.json       ← [ { timestamp, level, message }, … ]
//     active/<uuid>/
//       (same — moved here on /dequeue)
//     jobs/
//       <jobId>        ← plain text file containing the submission UUID
//
// Run:  node task-queue.js [port]   (default port: 4000)

import { createServer }                        from 'node:http';
import { randomUUID }                          from 'node:crypto';
import { mkdirSync, writeFileSync,
         readdirSync, readFileSync,
         rmSync, renameSync, existsSync }      from 'node:fs';
import { join, resolve }                       from 'node:path';

const VERSION = '2.0.0';

// ── Storage roots ─────────────────────────────────────────────────────────────

const ROOT     = resolve(import.meta.dirname, 'data');
const INCOMING = join(ROOT, 'incoming');
const ACTIVE   = join(ROOT, 'active');
const JOBS     = join(ROOT, 'jobs');      // jobId → submissionId index

for (const dir of [ROOT, INCOMING, ACTIVE, JOBS]) {
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
    'Content-Type':                'application/json',
    'Cache-Control':               'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(json);
}

function listDir(dir) {
  try { return readdirSync(dir); } catch { return []; }
}

/** Find which data directory (INCOMING or ACTIVE) holds this submission UUID. */
function findSubmissionDir(id) {
  const inDir = join(INCOMING, id);
  if (existsSync(inDir)) return inDir;
  const acDir = join(ACTIVE, id);
  if (existsSync(acDir)) return acDir;
  return null;
}

function readSubmission(dir, id) {
  const file = join(dir, id, 'form.json');
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

/** Resolve a client-provided jobId to its submission UUID, or null. */
function resolveJobId(jobId) {
  const file = join(JOBS, jobId);
  if (!existsSync(file)) return null;
  try { return readFileSync(file, 'utf8').trim(); } catch { return null; }
}

/** Locate submission dir by jobId (searching both INCOMING and ACTIVE). */
function findDirByJobId(jobId) {
  const submissionId = resolveJobId(jobId);
  if (!submissionId) return { submissionId: null, dir: null };
  const dir = findSubmissionDir(submissionId);
  return { submissionId, dir };
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

// ── Route handlers ────────────────────────────────────────────────────────────

// GET /health
function handleHealth(_req, res) {
  send(res, 200, {
    ok:      true,
    version: VERSION,
    pending: listDir(INCOMING).length,
    active:  listDir(ACTIVE).length,
  });
}

// POST /submit
function handleSubmit(req, res) {
  readBody(req).then(raw => {
    let body;
    try { body = JSON.parse(raw); } catch {
      return send(res, 400, { error: 'Request body must be JSON.' });
    }

    const { formId, jobId, fields } = body;

    if (!formId || typeof formId !== 'string') {
      return send(res, 400, { error: 'formId (string) is required.' });
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return send(res, 400, { error: 'fields (object) is required.' });
    }

    // Deduplication — if a jobId is supplied and already exists, return existing
    if (jobId && typeof jobId === 'string') {
      const existingId = resolveJobId(jobId);
      if (existingId) {
        const existing = readSubmission(INCOMING, existingId)
                      ?? readSubmission(ACTIVE,   existingId);
        if (existing) {
          return send(res, 200, {
            id:        existing.id,
            formId:    existing.formId,
            timestamp: existing.timestamp,
            duplicate: true,
          });
        }
      }
    }

    const id        = randomUUID();
    const timestamp = new Date().toISOString();
    const submission = { id, jobId: jobId ?? null, formId, timestamp, fields };

    const dir = join(INCOMING, id);
    mkdirSync(dir, { recursive: true });
    writeJson(join(dir, 'form.json'), submission);

    // Initialise progress and log files
    writeJson(join(dir, 'progress.json'), { percent: 0, message: 'queued', state: 'pending', updatedAt: timestamp });
    writeJson(join(dir, 'log.json'), []);

    // Write jobId index file
    if (jobId && typeof jobId === 'string') {
      writeFileSync(join(JOBS, jobId), id, 'utf8');
    }

    send(res, 201, { id, formId, timestamp });
  }).catch(err => send(res, 500, { error: err.message }));
}

// GET /queue
function handleQueue(_req, res) {
  const ids   = listDir(INCOMING);
  const items = ids.flatMap(id => {
    const s = readSubmission(INCOMING, id);
    if (!s) return [];
    return [{ id: s.id, jobId: s.jobId, formId: s.formId, timestamp: s.timestamp }];
  });
  items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  send(res, 200, { pending: items.length, items });
}

// GET /dequeue
function handleDequeue(_req, res) {
  const ids = listDir(INCOMING);
  if (ids.length === 0) return send(res, 200, { submission: null });

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

  // Update progress state → active
  const progFile = join(dstDir, 'progress.json');
  const prog     = readJson(progFile, {});
  prog.state     = 'active';
  prog.updatedAt = new Date().toISOString();
  writeJson(progFile, prog);

  send(res, 200, { submission });
}

// GET /submission/:id
function handleGetSubmission(id, res) {
  const s = readSubmission(INCOMING, id) ?? readSubmission(ACTIVE, id);
  if (!s) return send(res, 404, { error: `Submission ${id} not found.` });
  send(res, 200, { submission: s });
}

// DELETE /clear/:id
function handleClear(id, res) {
  const inDir = join(INCOMING, id);
  const acDir = join(ACTIVE,   id);

  let from = null;
  if (existsSync(inDir)) { rmSync(inDir, { recursive: true, force: true }); from = 'incoming'; }
  else if (existsSync(acDir)) { rmSync(acDir, { recursive: true, force: true }); from = 'active'; }

  if (!from) return send(res, 404, { error: `Submission ${id} not found.` });
  send(res, 200, { cleared: id, from });
}

// GET /status
function handleStatus(_req, res) {
  send(res, 200, {
    pending: listDir(INCOMING).length,
    active:  listDir(ACTIVE).length,
  });
}

// ── Job endpoints ─────────────────────────────────────────────────────────────

// GET /job/:jobId
function handleGetJob(jobId, res) {
  const { submissionId, dir } = findDirByJobId(jobId);
  if (!dir) return send(res, 404, { error: `Job ${jobId} not found.` });
  const submission = readJson(join(dir, 'form.json'), null);
  if (!submission) return send(res, 404, { error: `Submission data missing for job ${jobId}.` });
  send(res, 200, { submission });
}

// GET /job/:jobId/progress
function handleGetProgress(jobId, res) {
  const { dir } = findDirByJobId(jobId);
  if (!dir) return send(res, 404, { error: `Job ${jobId} not found.` });
  const progress = readJson(join(dir, 'progress.json'), { percent: 0, message: '', state: 'pending' });
  send(res, 200, progress);
}

// POST /job/:jobId/progress  { percent, message, state? }
function handlePostProgress(jobId, req, res) {
  readBody(req).then(raw => {
    let body;
    try { body = JSON.parse(raw); } catch {
      return send(res, 400, { error: 'Body must be JSON.' });
    }
    const { dir } = findDirByJobId(jobId);
    if (!dir) return send(res, 404, { error: `Job ${jobId} not found.` });

    const progFile = join(dir, 'progress.json');
    const existing = readJson(progFile, {});
    const updated  = {
      ...existing,
      percent:   body.percent   ?? existing.percent   ?? 0,
      message:   body.message   ?? existing.message   ?? '',
      state:     body.state     ?? existing.state     ?? 'active',
      updatedAt: new Date().toISOString(),
    };
    writeJson(progFile, updated);
    send(res, 200, updated);
  }).catch(err => send(res, 500, { error: err.message }));
}

// GET /job/:jobId/log
function handleGetLog(jobId, res) {
  const { dir } = findDirByJobId(jobId);
  if (!dir) return send(res, 404, { error: `Job ${jobId} not found.` });
  const entries = readJson(join(dir, 'log.json'), []);
  send(res, 200, { entries });
}

// POST /job/:jobId/log  { level?, message }
function handlePostLog(jobId, req, res) {
  readBody(req).then(raw => {
    let body;
    try { body = JSON.parse(raw); } catch {
      return send(res, 400, { error: 'Body must be JSON.' });
    }
    if (!body.message || typeof body.message !== 'string') {
      return send(res, 400, { error: 'message (string) is required.' });
    }
    const { dir } = findDirByJobId(jobId);
    if (!dir) return send(res, 404, { error: `Job ${jobId} not found.` });

    const logFile = join(dir, 'log.json');
    const entries = readJson(logFile, []);
    const entry   = {
      timestamp: new Date().toISOString(),
      level:     body.level ?? 'info',
      message:   body.message,
    };
    entries.push(entry);
    writeJson(logFile, entries);
    send(res, 201, entry);
  }).catch(err => send(res, 500, { error: err.message }));
}

// ── Router ────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function router(req, res) {
  const { method, url: rawUrl } = req;
  const url  = new URL(rawUrl, 'http://localhost');
  const path = url.pathname.replace(/\/$/, '') || '/';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // Original routes
  if (method === 'GET'    && path === '/health')   return handleHealth(req, res);
  if (method === 'POST'   && path === '/submit')   return handleSubmit(req, res);
  if (method === 'GET'    && path === '/queue')    return handleQueue(req, res);
  if (method === 'GET'    && path === '/dequeue')  return handleDequeue(req, res);
  if (method === 'GET'    && path === '/status')   return handleStatus(req, res);

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

  // Job tracking routes
  const jobMatch = path.match(/^\/job\/([^/]+)(\/progress|\/log)?$/);
  if (jobMatch) {
    const jobId  = jobMatch[1];
    const suffix = jobMatch[2] ?? '';
    if (!UUID_RE.test(jobId)) return send(res, 400, { error: 'Invalid job ID.' });

    if (suffix === ''          && method === 'GET')    return handleGetJob(jobId, res);
    if (suffix === '/progress' && method === 'GET')    return handleGetProgress(jobId, res);
    if (suffix === '/progress' && method === 'POST')   return handlePostProgress(jobId, req, res);
    if (suffix === '/log'      && method === 'GET')    return handleGetLog(jobId, res);
    if (suffix === '/log'      && method === 'POST')   return handlePostLog(jobId, req, res);
  }

  send(res, 404, { error: `No route: ${method} ${path}` });
}

// ── Server ────────────────────────────────────────────────────────────────────

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4000);

const server = createServer(router);

server.listen(PORT, () => {
  console.log(`Task queue v${VERSION} listening on http://localhost:${PORT}`);
  console.log(`Storage: ${ROOT}`);
  console.log('');
  console.log('  GET    /health                  Server health + version');
  console.log('  POST   /submit                  Submit a form (jobId? for dedup)');
  console.log('  GET    /queue                   List pending submissions');
  console.log('  GET    /dequeue                 Pop the oldest submission → active');
  console.log('  GET    /submission/:id           Read a specific submission');
  console.log('  DELETE /clear/:id               Remove a processed submission');
  console.log('  GET    /status                  Queue stats');
  console.log('');
  console.log('  GET    /job/:jobId              Lookup by client jobId');
  console.log('  GET    /job/:jobId/progress     Read job progress');
  console.log('  POST   /job/:jobId/progress     Update job progress (worker)');
  console.log('  GET    /job/:jobId/log           Read job log');
  console.log('  POST   /job/:jobId/log           Append log entry (worker)');
});
