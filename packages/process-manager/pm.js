#!/usr/bin/env node
// packages/process-manager/pm.js
//
// Lightweight foreground process orchestrator — pm2's ecosystem.json format,
// zero external dependencies.
//
// Runs in the foreground: all managed processes live as children. Ctrl-C (or
// SIGTERM) gracefully stops every child. This is the right model for Docker,
// dev boxes, and simple deployments — no hidden daemon, no surprises.
//
// ── Worker scaling ─────────────────────────────────────────────────────────────
// Set instances: "max" to spawn one worker per logical CPU. The task-queue uses
// the "competing consumers" pattern: every worker independently polls /dequeue,
// which atomically claims a job via renameSync(incoming → active). No locking,
// no coordination — each CPU stays busy as long as there is work.
//
// ── Usage ──────────────────────────────────────────────────────────────────────
//   pm start <ecosystem.json>     Start all apps (blocks — Ctrl-C stops all)
//   pm logs  <name> [lines]       Print last N lines of a process log (default 80)
//   pm help                       Show this help text
//
// ── ecosystem.json format ──────────────────────────────────────────────────────
//   {
//     "apps": [
//       {
//         "name":            "my-service",   // label in output and log filenames
//         "script":          "src/index.js", // path relative to ecosystem.json
//         "instances":       1,              // integer, or "max" (os.cpus().length)
//         "env":             {},             // always applied
//         "env_development": {},             // merged when NODE_ENV=development
//         "env_production":  {},             // merged when NODE_ENV=production
//         "restart_delay":   1000,           // ms before first restart (default 1000)
//         "max_restarts":    10              // give up after N consecutive crashes
//       }
//     ]
//   }
//
// ── Log files ──────────────────────────────────────────────────────────────────
// Written to <ecosystem-dir>/logs/<name>-out.log and ...-err.log (append mode).
// A process that runs stably for 30 s has its crash counter and backoff reset,
// so transient restarts do not permanently cap the retry count.

import { spawn }        from 'node:child_process';
import { cpus }         from 'node:os';
import {
  readFileSync,
  mkdirSync, existsSync,
  createWriteStream,
}                       from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';

// ── ANSI colour helpers ───────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
};

// Each app gets one colour from this palette (cycles if there are many apps).
const PALETTE = [C.cyan, C.green, C.magenta, C.yellow, C.blue, C.white];

function ts() {
  return `${C.dim}${new Date().toLocaleTimeString('en', { hour12: false })}${C.reset}`;
}

// ── CLI dispatch ──────────────────────────────────────────────────────────────

const [,, cmd, ...argv] = process.argv;

switch (cmd) {
  case 'start': {
    const eco = argv[0];
    if (!eco) die('Usage: pm start <ecosystem.json>');
    startAll(resolve(process.cwd(), eco));
    break;
  }
  case 'logs': {
    const name  = argv[0];
    const lines = Number(argv[1] ?? 80);
    if (!name) die('Usage: pm logs <name> [lines=80]');
    showLogs(name, lines);
    break;
  }
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    printHelp();
    break;
  default:
    printHelp();
    die(`Unknown command: ${cmd}`);
}

// ── startAll — read ecosystem, spawn everything ───────────────────────────────

function startAll(ecosystemPath) {
  if (!existsSync(ecosystemPath)) die(`Ecosystem file not found: ${ecosystemPath}`);

  const eco     = JSON.parse(readFileSync(ecosystemPath, 'utf8'));
  const ecoDir  = dirname(ecosystemPath);
  const nodeEnv = process.env.NODE_ENV ?? 'production';
  const cpuN    = cpus().length;
  const logsDir = join(ecoDir, 'logs');

  mkdirSync(logsDir, { recursive: true });

  // ── Startup banner ────────────────────────────────────────────────────────
  const ecoRel = relative(process.cwd(), ecosystemPath);
  const W = 44;
  const bar = '─'.repeat(W);
  console.log(`\n${C.cyan}${C.bold}  ┌${bar}┐${C.reset}`);
  const rows = [
    ['ecosystem', ecoRel],
    ['NODE_ENV',  nodeEnv],
    ['CPUs',      String(cpuN)],
    ['logs',      relative(process.cwd(), logsDir)],
  ];
  for (const [k, v] of rows) {
    const line = `  ${k.padEnd(10)} ${v}`;
    console.log(`${C.cyan}${C.bold}  │${C.reset}${line.padEnd(W + 2)}${C.cyan}${C.bold}│${C.reset}`);
  }
  console.log(`${C.cyan}${C.bold}  └${bar}┘${C.reset}\n`);

  // ── Expand app definitions → concrete instances ───────────────────────────
  const instances = [];
  let paletteIdx = 0;

  for (const app of eco.apps ?? []) {
    const count  = app.instances === 'max' ? cpuN : (Number(app.instances) || 1);
    const colour = PALETTE[paletteIdx++ % PALETTE.length];
    const script = resolve(ecoDir, app.script);

    // cwd defaults to the script's directory (so relative imports inside the
    // script resolve correctly without any extra configuration).
    const cwd = app.cwd ? resolve(ecoDir, app.cwd) : dirname(script);

    // Merge environment: inherited → app.env → env-specific block
    const envKey = `env_${nodeEnv}`;
    const merged = {
      ...process.env,
      ...app.env,
      ...(app[envKey] ?? {}),
      NODE_ENV: nodeEnv,
    };

    for (let i = 0; i < count; i++) {
      // Single instances keep their plain name. Multiple instances get "[i]"
      // suffix so log files don't collide and output is distinguishable.
      const label = count > 1 ? `${app.name}[${i}]` : app.name;
      instances.push({
        label,
        script,
        cwd,
        env:          merged,
        colour,
        restartDelay: app.restart_delay ?? 1000,
        maxRestarts:  app.max_restarts  ?? 10,
        logsDir,
        // mutable lifecycle state — reset in spawnInst on each respawn
        restarts: 0,
        backoff:  app.restart_delay ?? 1000,
        child:    null,
      });
    }
  }

  // ── Print launch plan ─────────────────────────────────────────────────────
  const nameW = Math.max(...instances.map(i => i.label.length), 12);
  for (const inst of instances) {
    const scriptRel = relative(ecoDir, inst.script);
    console.log(`  ${inst.colour}${C.bold}${inst.label.padEnd(nameW)}${C.reset}  ${C.dim}${scriptRel}${C.reset}`);
  }
  console.log('');

  // ── Spawn all instances ───────────────────────────────────────────────────
  for (const inst of instances) spawnInst(inst);

  // ── Graceful shutdown on Ctrl-C / SIGTERM ─────────────────────────────────
  let stopping = false;

  function shutdown(sig) {
    if (stopping) return;
    stopping = true;
    console.log(`\n${ts()} ${C.yellow}${C.bold} shutdown ${C.reset} (${sig}) — stopping all processes…`);

    for (const inst of instances) {
      if (inst.child) {
        inst.maxRestarts = -1; // prevent auto-restart while draining
        inst.child.kill('SIGTERM');
      }
    }

    // Force-kill anything still alive after 5 s
    const force = setTimeout(() => {
      for (const inst of instances) inst.child?.kill('SIGKILL');
      process.exit(0);
    }, 5000);
    force.unref(); // do not keep the event loop alive just for this timer
  }

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ── spawnInst — spawn one process, pipe its output, handle restarts ───────────

function spawnInst(inst) {
  const nameTag = `${inst.colour}${C.bold}${inst.label.padEnd(16)}${C.reset}`;

  // Open log files in append mode so restarts don't clobber previous output.
  const outLog = createWriteStream(join(inst.logsDir, `${inst.label}-out.log`), { flags: 'a' });
  const errLog = createWriteStream(join(inst.logsDir, `${inst.label}-err.log`), { flags: 'a' });

  const child = spawn(process.execPath, [inst.script], {
    cwd:   inst.cwd,
    env:   inst.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  inst.child = child;
  console.log(`${ts()} ${nameTag}  ${C.green}▶ start${C.reset}   pid=${C.bold}${child.pid}${C.reset}`);

  // ── Stability timer — if the process runs for 30 s without crashing,
  //    reset the crash counter and backoff. This way a service that regularly
  //    restarts (e.g. due to occasional transient errors) is not permanently
  //    penalised by the max_restarts cap.
  const stableTimer = setTimeout(() => {
    inst.restarts = 0;
    inst.backoff  = inst.restartDelay;
  }, 30_000);
  stableTimer.unref();

  // ── Line-by-line stdout/stderr routing ────────────────────────────────────
  function pipeLines(stream, logStream, isErr) {
    let buf = '';
    stream.on('data', chunk => {
      buf += chunk.toString();
      // Split on \n. The last element is an incomplete line — keep it buffered.
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const isoStamp = new Date().toISOString();
        const sigil    = isErr ? `${C.red}err${C.reset}` : `${C.dim}out${C.reset}`;
        console.log(`${ts()} ${nameTag}  ${sigil}  ${line}`);
        logStream.write(`${isoStamp}  ${line}\n`);
      }
    });
  }

  pipeLines(child.stdout, outLog, false);
  pipeLines(child.stderr, errLog, true);

  // ── Exit handling + auto-restart with exponential backoff ─────────────────
  child.on('exit', (code, signal) => {
    clearTimeout(stableTimer);
    inst.child = null;
    outLog.end();
    errLog.end();

    // Clean exit — no restart needed.
    if (code === 0) {
      console.log(`${ts()} ${nameTag}  ${C.green}✔ done${C.reset}   code=0`);
      return;
    }

    const why = signal ? `signal=${signal}` : `exit=${code}`;

    // Gave up — too many crashes.
    if (inst.restarts >= inst.maxRestarts) {
      console.log(`${ts()} ${nameTag}  ${C.red}${C.bold}✖ gave up${C.reset}  ${why}  (${inst.restarts}/${inst.maxRestarts} restarts)`);
      return;
    }

    inst.restarts++;
    console.log(`${ts()} ${nameTag}  ${C.yellow}↺ restart${C.reset}  ${why}  attempt ${inst.restarts}/${inst.maxRestarts} in ${inst.backoff}ms`);

    setTimeout(() => spawnInst(inst), inst.backoff);

    // Exponential backoff: 1 s → 2 s → 4 s → … → 30 s (ceiling)
    inst.backoff = Math.min(inst.backoff * 2, 30_000);
  });

  child.on('error', err => {
    clearTimeout(stableTimer);
    console.error(`${ts()} ${nameTag}  ${C.red}spawn error: ${err.message}${C.reset}`);
  });
}

// ── showLogs — print the tail of a process log file ──────────────────────────

function showLogs(name, n) {
  // Search for the log file in the most likely locations.
  const candidates = [
    join(process.cwd(), 'network-services', 'logs', `${name}-out.log`),
    join(process.cwd(), 'logs', `${name}-out.log`),
  ];

  const found = candidates.find(existsSync);
  if (!found) {
    console.error(`No log found for "${name}". Searched:\n${candidates.map(p => `  ${p}`).join('\n')}`);
    process.exit(1);
  }

  const lines = readFileSync(found, 'utf8').split('\n').filter(Boolean);
  const tail  = lines.slice(-n);
  console.log(`${C.dim}── ${found} (last ${tail.length} of ${lines.length} lines) ──${C.reset}`);
  for (const line of tail) console.log(line);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function die(msg) {
  console.error(`${C.red}error:${C.reset} ${msg}`);
  process.exit(1);
}

function printHelp() {
  console.log(`
  ${C.cyan}${C.bold}pm${C.reset} — Lightweight process orchestrator

  ${C.bold}Commands:${C.reset}
    start <ecosystem.json>    Start all apps  ${C.dim}(foreground — Ctrl-C stops all)${C.reset}
    logs  <name> [lines]      Print last N lines of a process log  ${C.dim}(default 80)${C.reset}
    help                      Show this message

  ${C.bold}ecosystem.json:${C.reset}
    {
      "apps": [
        {
          "name":            "task-worker",
          "script":          "task-queue/processor.js",
          "instances":       "max",        // or an integer; "max" = one per CPU
          "env":             { "QUEUE_URL": "http://localhost:4000" },
          "env_development": { "DEBUG": "*" },
          "restart_delay":   1000,         // ms to first restart
          "max_restarts":    10            // give up after N consecutive crashes
        }
      ]
    }

  ${C.bold}Worker pattern:${C.reset}
    Set instances: "max" on your processor. Each worker competes for jobs by
    calling GET /dequeue, which atomically claims one job (renameSync incoming
    → active). No locking needed — the filesystem rename is the mutex.

  ${C.bold}Log files:${C.reset}  <ecosystem-dir>/logs/<name>-out.log  and  ...-err.log
`);
}
