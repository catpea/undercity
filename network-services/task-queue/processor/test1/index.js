// processor/test1/index.js
//
// Demo handler — echoes every submitted field, simulates multi-step progress,
// and writes a summary.txt to the output directory.
//
// Use this handler to verify the full pipeline (submit → dequeue → progress →
// log → done) without needing ffmpeg or any external tool.
//
// Expected formId: "test1"
// Expected fields: any — this handler accepts whatever it receives.

import { writeFileSync } from 'node:fs';
import { join }          from 'node:path';

/**
 * @param {Record<string, import('../../processor.js').FieldInfo>} fields
 * @param {import('../../processor.js').Ctx} ctx
 */
export async function handle(fields, ctx) {
  const keys = Object.keys(fields);

  // ── Step 1: Inventory (0–25%) ─────────────────────────────────────────────
  await ctx.progress(5, 'Inspecting fields…');
  await ctx.log(`Received ${keys.length} field(s): ${keys.join(', ')}`);

  for (const [key, f] of Object.entries(fields)) {
    if (f.warning) {
      await ctx.log(`[${key}] WARNING: ${f.warning}`, 'warn');
    } else if (f.isFile) {
      await ctx.log(`[${key}] file  type=${f.type}  size=${fmtBytes(f.size)}  path=${f.path}`);
    } else {
      await ctx.log(`[${key}] value type=${f.type}  value="${String(f.value ?? '').slice(0, 80)}"`);
    }
  }

  await ctx.progress(25, 'Field inspection complete.');

  // ── Step 2: Simulate work (25–75%) ───────────────────────────────────────
  await ctx.log('Simulating workload…');
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    await sleep(300);
    const pct = 25 + Math.round(((i + 1) / steps) * 50);
    await ctx.progress(pct, `Step ${i + 1} / ${steps}`);
    await ctx.log(`Completed step ${i + 1}`);
  }

  // ── Step 3: Write summary (75–95%) ───────────────────────────────────────
  await ctx.progress(80, 'Writing summary…');

  const lines = [
    `# Job Summary`,
    ``,
    `jobId         ${ctx.jobId}`,
    `submissionId  ${ctx.submissionId}`,
    `formId        ${ctx.formId}`,
    `processed     ${new Date().toISOString()}`,
    ``,
    `## Fields`,
    ``,
    ...Object.entries(fields).map(([key, f]) => {
      if (f.warning) return `- ${key}  [WARNING: ${f.warning}]`;
      if (f.isFile)  return `- ${key}  ${f.type}  ${fmtBytes(f.size)}  ${f.path ?? '(no path)'}`;
      return `- ${key}  ${f.type}  "${String(f.value ?? '').slice(0, 80)}"`;
    }),
    ``,
    `## Output`,
    ``,
    `${ctx.outputDir}`,
  ];

  const summaryPath = join(ctx.outputDir, 'summary.txt');
  writeFileSync(summaryPath, lines.join('\n') + '\n', 'utf8');
  await ctx.log(`Summary written to ${summaryPath}`);
  await ctx.progress(95, 'Summary written.');

  // ── Step 4: Done (100%) ───────────────────────────────────────────────────
  await sleep(100);
  await ctx.log('test1 handler complete.');
  // processor.js posts 100% / done after handle() returns successfully
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
