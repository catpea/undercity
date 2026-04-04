#!/usr/bin/env node
// example/task-queue/processor.js
//
// Task processor — polls the queue, dispatches jobs to handlers, reports
// progress back to the server in real time.
//
// ── Handler discovery ─────────────────────────────────────────────────────────
// Handlers live in processor/<formId>/index.js.
// A handler directory is ACTIVE if its index.js exists.
// If no handler exists for a job's formId, the job is marked as an error.
//
// ── Handler contract ──────────────────────────────────────────────────────────
//   export async function handle(fields, ctx) { ... }
//
//   fields  — object where each key is a field name from the submission.
//             File fields (data URL) are decoded to real files on disk.
//             Scalar fields (string, number, boolean) are passed as-is.
//
//   fields[key] shape for FILES:
//     { key, name, type, size, path, isFile: true }
//     path — absolute path to a temp file. Valid for the duration of handle().
//
//   fields[key] shape for SCALARS:
//     { key, value, type, isFile: false }
//
//   ctx shape:
//     ctx.jobId         — client-provided UUID
//     ctx.submissionId  — server-assigned UUID
//     ctx.formId        — the formId string (matches handler directory name)
//     ctx.outputDir     — absolute path, pre-created. Write all output here.
//     ctx.log(msg, level='info')           — post a log entry to the server
//     ctx.progress(percent, message='')    — post a progress update (0–100)
//     ctx.spawn(command, args, opts)       — run a child process, pipe its
//                                            stderr/stdout to the job log, and
//                                            auto-parse ffmpeg time= output for
//                                            progress. opts:
//                                              duration      — total seconds
//                                              progressStart — percent at start
//                                              progressEnd   — percent at end
//
// ── Output ────────────────────────────────────────────────────────────────────
// data/output/<submissionId>/  — permanent output files
// data/tmp/<submissionId>/     — temp decoded inputs, cleaned up after handle()
//
// ── Run ───────────────────────────────────────────────────────────────────────
//   node processor.js [server-url]   (default: http://localhost:4000)

import { existsSync, mkdirSync, writeFileSync, rmSync, watch } from 'node:fs';
import { readdir }                                       from 'node:fs/promises';
import { join, resolve, extname }                        from 'node:path';
import { spawn }                                         from 'node:child_process';

const VERSION        = '1.0.0';
const SERVER         = (process.argv[2] ?? process.env.QUEUE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const QUEUE_ROOT     = process.env.TASK_QUEUE_ROOT ?? '/tmp/undercity-task-queue';
const PROC_DIR       = resolve(import.meta.dirname, 'processor');
const OUT_DIR        = join(QUEUE_ROOT, 'output');
const TMP_DIR        = join(QUEUE_ROOT, 'tmp');
const INCOMING_DIR   = join(QUEUE_ROOT, 'incoming');
const RETRY_MS       = 8000;   // wait after a network error before retrying

// ── Idle strategy ─────────────────────────────────────────────────────────────
// Default: fs.watch — the OS wakes workers the instant a job directory appears
//          in data/incoming/. Zero activity while truly idle.
//
// Alternative: set QUEUE_LONG_POLL=<seconds> (e.g. QUEUE_LONG_POLL=25).
//   Workers pass ?wait=N to /dequeue and the server holds the connection open,
//   returning the moment a job is queued. No filesystem access needed — useful
//   when workers and the queue server run on separate machines.
const LONG_POLL_SECS = Number(process.env.QUEUE_LONG_POLL ?? 0);

for (const dir of [OUT_DIR, TMP_DIR]) mkdirSync(dir, { recursive: true });

// ── ANSI helpers ──────────────────────────────────────────────────────────────
// No npm. Plain ANSI escape sequences only.

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  cyan:   '\x1b[36m',
};

function stamp() {
  return `${C.dim}${new Date().toLocaleTimeString()}${C.reset}`;
}

const TAGS = {
  info:  `${C.cyan}${C.bold}  info${C.reset}`,
  warn:  `${C.yellow}${C.bold}  warn${C.reset}`,
  error: `${C.red}${C.bold} error${C.reset}`,
  ok:    `${C.green}${C.bold}    ok${C.reset}`,
  job:   `${C.blue}${C.bold}   job${C.reset}`,
  step:  `${C.magenta}${C.bold}  step${C.reset}`,
  wait:  `${C.dim}${C.bold}  wait${C.reset}`,
};

function log(level, ...parts) {
  const tag = TAGS[level] ?? TAGS.info;
  process.stdout.write(`${stamp()} ${tag}  ${parts.join(' ')}\n`);
}

// ── MIME → file extension map ─────────────────────────────────────────────────

const MIME_TO_EXT = new Map([
  ['image/jpeg',        '.jpg'],
  ['image/jpg',         '.jpg'],
  ['image/png',         '.png'],
  ['image/gif',         '.gif'],
  ['image/webp',        '.webp'],
  ['image/avif',        '.avif'],
  ['image/svg+xml',     '.svg'],
  ['audio/mpeg',        '.mp3'],
  ['audio/mp3',         '.mp3'],
  ['audio/wav',         '.wav'],
  ['audio/x-wav',       '.wav'],
  ['audio/ogg',         '.ogg'],
  ['audio/webm',        '.webm'],
  ['audio/aac',         '.aac'],
  ['audio/flac',        '.flac'],
  ['video/mp4',         '.mp4'],
  ['video/webm',        '.webm'],
  ['video/quicktime',   '.mov'],
  ['video/x-msvideo',   '.avi'],
  ['application/pdf',   '.pdf'],
  ['text/plain',        '.txt'],
  ['text/html',         '.html'],
  ['text/markdown',     '.md'],
]);

function mimeToExt(mimeType, originalName) {
  if (MIME_TO_EXT.has(mimeType)) return MIME_TO_EXT.get(mimeType);
  const fromName = extname(originalName || '');
  return fromName || '.bin';
}

// ── Server API helpers ────────────────────────────────────────────────────────

async function api(method, path, body, timeoutMs = 10_000) {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body:    body ? JSON.stringify(body) : undefined,
    signal:  AbortSignal.timeout(timeoutMs),
  });
  return res.json();
}

async function dequeue() {
  if (LONG_POLL_SECS > 0) {
    // Ask the server to hold the connection until a job arrives or the wait
    // period elapses. Add a generous margin to the fetch timeout so we never
    // abort a valid long-poll response early.
    return api('GET', `/dequeue?wait=${LONG_POLL_SECS}`, null, (LONG_POLL_SECS + 15) * 1000);
  }
  return api('GET', '/dequeue');
}
async function postProgress(jobId, percent, message, state) {
  return api('POST', `/job/${jobId}/progress`, { percent, message, state });
}
async function postLog(jobId, message, level = 'info')    {
  return api('POST', `/job/${jobId}/log`, { level, message });
}

// ── Field decoder ─────────────────────────────────────────────────────────────
// Decodes data URL fields to real files in a temp directory.
// Blob URL fields cannot be decoded server-side — they get path: null + a warning.
// Scalar fields (string, number, boolean) get value + isFile: false.

async function decodeFields(rawFields, tmpDir) {
  mkdirSync(tmpDir, { recursive: true });

  const fields = {};

  for (const [key, raw] of Object.entries(rawFields)) {
    // ── Scalar ──────────────────────────────────────────────────────────────
    if (raw === null || typeof raw !== 'object') {
      fields[key] = { key, value: raw, type: typeof raw, isFile: false };
      continue;
    }

    // ── File object with a URL ───────────────────────────────────────────────
    const { url, name = '', type = 'application/octet-stream', size = 0 } = raw;

    if (!url) {
      // Object without url — pass value through as scalar
      fields[key] = { key, value: raw, type: 'object', isFile: false };
      continue;
    }

    if (url.startsWith('data:')) {
      // data:mime/type;base64,<data>
      const commaIdx = url.indexOf(',');
      if (commaIdx === -1) {
        fields[key] = { key, name, type, size, path: null, isFile: true,
          warning: 'Malformed data URL — no comma separator.' };
        continue;
      }
      const ext      = mimeToExt(type, name);
      const tmpPath  = join(tmpDir, `${key}${ext}`);
      const b64      = url.slice(commaIdx + 1);
      writeFileSync(tmpPath, Buffer.from(b64, 'base64'));
      fields[key] = { key, name, type, size, path: tmpPath, isFile: true };
      continue;
    }

    if (url.startsWith('blob:')) {
      // Blob URLs are browser-context objects — they cannot be fetched server-side.
      // The field metadata is available but the file content is inaccessible.
      fields[key] = { key, name, type, size, path: null, isFile: true,
        warning: 'Blob URL — file content not accessible server-side. ' +
                 'Submit files as data URLs (base64) to enable server decoding.' };
      continue;
    }

    // HTTP/HTTPS URL — download to temp file
    try {
      const ext      = mimeToExt(type, name);
      const tmpPath  = join(tmpDir, `${key}${ext}`);
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const buffer   = Buffer.from(await response.arrayBuffer());
      writeFileSync(tmpPath, buffer);
      const kb = (buffer.byteLength / 1024).toFixed(1);
      fields[key] = { key, name, type, size, path: tmpPath, url, isFile: true,
        downloadNote: `Downloaded ${kb} KB from ${url}` };
    } catch (err) {
      fields[key] = { key, name, type, size, path: null, url, isFile: true,
        warning: `Failed to download (${url}): ${err.message}` };
    }
  }

  return fields;
}

// ── ctx.spawn — child process with live log forwarding and ffmpeg progress ────
//
// Runs command with args. Sends every line of stdout/stderr to the job log.
// If opts.duration is given (seconds), parses ffmpeg `time=HH:MM:SS.ss` lines
// and posts progress updates scaled to [progressStart, progressEnd].
//
// opts:
//   duration      {number}  total duration in seconds (enables ffmpeg progress)
//   progressStart {number}  percent value at start of this command   (default 0)
//   progressEnd   {number}  percent value at end of this command     (default 100)

function makeSpawn(jobId) {
  return function spawnCommand(command, args, opts = {}) {
    const { duration = null, progressStart = 0, progressEnd = 100 } = opts;
    const range = progressEnd - progressStart;

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      function handleLine(line) {
        if (!line.trim()) return;

        // Always log the line (fire-and-forget — do not await in stream handler)
        postLog(jobId, line).catch(() => {});

        // Parse ffmpeg time= progress if duration is known
        if (duration) {
          const m = line.match(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
          if (m) {
            const elapsed = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
            const frac    = Math.min(1, elapsed / duration);
            const pct     = Math.round(progressStart + frac * range);
            const msg     = `${Math.round(elapsed)}s / ${Math.round(duration)}s`;
            postProgress(jobId, pct, msg, 'active').catch(() => {});
          }
        }
      }

      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout.on('data', chunk => {
        stdoutBuf += chunk.toString();
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop();         // keep incomplete last line
        lines.forEach(handleLine);
      });

      child.stderr.on('data', chunk => {
        stderrBuf += chunk.toString();
        // ffmpeg uses \r for in-place progress lines; split on both
        const lines = stderrBuf.split(/[\n\r]/);
        stderrBuf = lines.pop();
        lines.forEach(handleLine);
      });

      child.on('close', code => {
        // Flush any remaining buffered output
        if (stdoutBuf.trim()) handleLine(stdoutBuf);
        if (stderrBuf.trim()) handleLine(stderrBuf);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${command} exited with code ${code}`));
        }
      });

      child.on('error', err => reject(new Error(`Failed to start ${command}: ${err.message}`)));
    });
  };
}

// ── Handler discovery ─────────────────────────────────────────────────────────

async function discoverHandlers() {
  const entries = await readdir(PROC_DIR, { withFileTypes: true }).catch(() => []);
  const handlers = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const indexPath = join(PROC_DIR, entry.name, 'index.js');
    if (existsSync(indexPath)) handlers.push(entry.name);
  }
  return handlers;
}

// ── Job runner ────────────────────────────────────────────────────────────────

async function runJob(submission) {
  const { id: submissionId, jobId, formId } = submission;
  const label = `${C.cyan}${formId}${C.reset} ${C.dim}(${submissionId.slice(0, 8)}…)${C.reset}`;

  log('job', `Starting ${label}`);
  await postLog(jobId, `Job started — formId: ${formId}  submissionId: ${submissionId}`).catch(() => {});

  // ── Find handler ──────────────────────────────────────────────────────────
  const handlerPath = join(PROC_DIR, formId, 'index.js');
  if (!existsSync(handlerPath)) {
    const msg = `No handler for formId "${formId}". Create processor/${formId}/index.js.`;
    log('warn', msg);
    await postProgress(jobId, 0, msg, 'error').catch(() => {});
    await postLog(jobId, msg, 'error').catch(() => {});
    return;
  }

  // ── Prepare directories ───────────────────────────────────────────────────
  const outputDir = join(OUT_DIR, submissionId);
  const tmpDir    = join(TMP_DIR, submissionId);
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(tmpDir,    { recursive: true });

  // ── Decode fields ──────────────────────────────────────────────────────────
  log('step', `Decoding fields for ${label}`);
  await postProgress(jobId, 2, 'Decoding fields…', 'active').catch(() => {});
  const fields = await decodeFields(submission.fields ?? {}, tmpDir);

  // Log a summary of decoded fields
  for (const [key, f] of Object.entries(fields)) {
    if (f.warning) {
      log('warn', `  field ${C.yellow}${key}${C.reset}: ${f.warning}`);
      await postLog(jobId, `Field [${key}] warning: ${f.warning}`, 'warn').catch(() => {});
    } else if (f.isFile) {
      const note = f.downloadNote ?? `path: ${f.path}`;
      log('info', `  field ${C.cyan}${key}${C.reset}: ${f.type}  ${C.dim}→ ${f.path}${C.reset}`);
      await postLog(jobId, `Field [${key}] (${f.type}): ${note}`).catch(() => {});
    } else {
      const preview = String(f.value ?? '').slice(0, 60);
      log('info', `  field ${C.cyan}${key}${C.reset}: ${f.type}  "${preview}"`);
      await postLog(jobId, `Field [${key}]: "${preview}"`).catch(() => {});
    }
  }

  // ── Build ctx ──────────────────────────────────────────────────────────────
  const ctx = {
    jobId,
    submissionId,
    formId,
    outputDir,

    /** Post a log entry to the server AND print it locally. */
    async log(message, level = 'info') {
      log(level, ` ${C.dim}[handler]${C.reset}`, message);
      await postLog(jobId, message, level).catch(() => {});
    },

    /** Post a progress update (0–100) to the server AND print it locally. */
    async progress(percent, message = '') {
      const bar   = '█'.repeat(Math.round(percent / 5)).padEnd(20, '░');
      const label = message ? `  ${message}` : '';
      log('step', `${bar} ${String(percent).padStart(3)}%${label}`);
      await postProgress(jobId, percent, message, 'active').catch(() => {});
    },

    /** Spawn a child process, forward its output to the job log, and
     *  auto-parse ffmpeg progress if opts.duration is provided. */
    spawn: makeSpawn(jobId),
  };

  // ── Invoke handler ─────────────────────────────────────────────────────────
  let handler;
  try {
    handler = await import(`file://${handlerPath}`);
  } catch (err) {
    const msg = `Failed to import handler: ${err.message}`;
    log('error', msg);
    await postProgress(jobId, 0, msg, 'error').catch(() => {});
    await postLog(jobId, msg, 'error').catch(() => {});
    return;
  }

  if (typeof handler.handle !== 'function') {
    const msg = `Handler at processor/${formId}/index.js does not export handle().`;
    log('error', msg);
    await postProgress(jobId, 0, msg, 'error').catch(() => {});
    await postLog(jobId, msg, 'error').catch(() => {});
    return;
  }

  try {
    const handlerResult = await handler.handle(fields, ctx);
    log('ok', `Finished ${label}  → ${C.dim}${outputDir}${C.reset}`);
    // Post result alongside the done progress update so the client can read it
    const doneBody = { percent: 100, message: 'Done.', state: 'done' };
    if (handlerResult !== null && handlerResult !== undefined && typeof handlerResult === 'object') {
      doneBody.result = handlerResult;
    }
    await api('POST', `/job/${jobId}/progress`, doneBody).catch(() => {});
    await postLog(jobId, `Job complete. Output directory: ${outputDir}`, 'info').catch(() => {});
  } catch (err) {
    log('error', `Handler threw: ${err.message}`);
    await postProgress(jobId, 0, err.message, 'error').catch(() => {});
    await postLog(jobId, err.message, 'error').catch(() => {});
  } finally {
    // ── Cleanup temp files ─────────────────────────────────────────────────
    rmSync(tmpDir, { recursive: true, force: true });
    log('info', `Cleaned up tmp for ${label}`);
  }
}

// ── Idle wait strategy ────────────────────────────────────────────────────────
//
// fs.watch mode (default):
//   Open an OS directory watch on data/incoming/. The kernel wakes us the
//   instant any entry is added or removed — zero CPU, zero network, zero log
//   spam. On wakeup we call /dequeue; if another worker already claimed the job
//   (the rename fired our watch too) we re-enter the watch silently.
//
// Long-poll mode (QUEUE_LONG_POLL=N):
//   The /dequeue request itself blocks on the server for up to N seconds, so
//   waitForWork() is a no-op — we just loop back and call dequeue() again.
//   Useful when workers run on a separate machine with no shared filesystem.

let _watcher = null;  // held so shutdown() can unblock a sleeping worker

function waitForWork() {
  if (LONG_POLL_SECS > 0) {
    // Server-side wait already elapsed; loop immediately.
    return Promise.resolve();
  }
  return new Promise(resolve => {
    mkdirSync(INCOMING_DIR, { recursive: true });
    const w = watch(INCOMING_DIR, () => { w.close(); _watcher = null; resolve(); });
    w.on('error',   ()  => { w.close(); _watcher = null; resolve(); });
    _watcher = w;
  });
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

let running = true;
let idle    = false;  // suppress repeated "queue empty" lines per worker

async function pollLoop() {
  while (running) {
    try {
      const { submission } = await dequeue();

      if (submission) {
        idle = false;
        await runJob(submission);
        // No sleep after a job — check immediately for the next one.
      } else {
        if (!idle) {
          const modeLabel = LONG_POLL_SECS > 0
            ? `long-polling (wait=${LONG_POLL_SECS}s)`
            : `watching ${INCOMING_DIR}`;
          log('wait', `Queue empty — ${modeLabel}`);
          idle = true;
        }
        await waitForWork();
      }
    } catch (err) {
      log('error', `Poll error: ${err.message}`);
      log('wait', `Retrying in ${RETRY_MS / 1000}s…`);
      await sleep(RETRY_MS);
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown(signal) {
  log('info', `Received ${signal}. Finishing current job then exiting…`);
  running = false;
  // Unblock any worker sitting in waitForWork() so the loop can exit cleanly.
  if (_watcher) { _watcher.close(); _watcher = null; }
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Startup ───────────────────────────────────────────────────────────────────

async function main() {
  const handlers = await discoverHandlers();

  const line1 = `  Undercity Task Processor  v${VERSION}`;
  const line2 = `  Server   ${SERVER}`;
  const line3 = `  Output   ${OUT_DIR}`;
  const line4 = `  Handlers ${handlers.length ? handlers.join(' · ') : '(none found)'}`;
  const width  = Math.max(line1.length, line2.length, line3.length, line4.length) + 2;
  const bar    = '─'.repeat(width);

  console.log(`\n${C.cyan}┌${bar}┐${C.reset}`);
  console.log(`${C.cyan}│${C.reset}${C.bold}${line1.padEnd(width)}${C.reset}${C.cyan}│${C.reset}`);
  console.log(`${C.cyan}│${C.reset}${line2.padEnd(width)}${C.cyan}│${C.reset}`);
  console.log(`${C.cyan}│${C.reset}${line3.padEnd(width)}${C.cyan}│${C.reset}`);
  console.log(`${C.cyan}│${C.reset}${C.green}${line4.padEnd(width)}${C.reset}${C.cyan}│${C.reset}`);
  console.log(`${C.cyan}└${bar}┘${C.reset}\n`);

  if (handlers.length === 0) {
    log('warn', `No handlers found in ${PROC_DIR}`);
    log('warn', 'Create processor/<formId>/index.js exporting handle(fields, ctx).');
  }

  // Check server is reachable before starting
  log('info', `Checking server at ${SERVER} …`);
  try {
    const health = await api('GET', '/health');
    log('ok', `Server online  v${health.version}  pending=${health.pending}  active=${health.active}`);
  } catch {
    log('warn', 'Server unreachable. Will retry with each poll.');
  }

  console.log('');
  log('info', 'Starting poll loop. Press Ctrl-C to stop gracefully.\n');
  await pollLoop();
  log('info', 'Processor stopped.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
