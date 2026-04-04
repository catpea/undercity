// processor/video-from-looping-clip-over-mp3/index.js
//
// Loops a short video clip over an MP3 for its full duration, then extracts
// a 10-second AVIF preview clip, and saves any text field as text.md.
//
// The clip repeats as many times as needed to cover the full MP3. The audio
// always plays in full — the video length matches the audio length exactly.
//
// Expected fields:
//   clip   — short video clip (MP4, WebM, MOV, …)  — required
//   audio  — MP3 audio track                        — required
//   title  — text (optional)                        — written to text.md
//   text   — text (optional)                        — written to text.md
//
// Output files written to ctx.outputDir:
//   video.mp4   — H.264 video looped to match audio duration
//   cover.avif  — 10-second extract from clip, encoded as AVIF preview
//   text.md     — contents of title + text fields (if provided)
//
// Requires: ffmpeg in PATH.

import { writeFileSync } from 'node:fs';
import { join }          from 'node:path';
import { execFile as _execFile } from 'node:child_process';
import { promisify }     from 'node:util';

const execFile = promisify(_execFile);

/**
 * @param {Record<string, import('../../processor.js').FieldInfo>} fields
 * @param {import('../../processor.js').Ctx} ctx
 */
export async function handle(fields, ctx) {

  // ── Validate required fields ──────────────────────────────────────────────
  assertFile(fields, 'clip',  ctx);
  assertFile(fields, 'audio', ctx);

  const clipPath  = fields.clip.path;
  const audioPath = fields.audio.path;

  if (!clipPath)  throw new Error('clip field has no decoded path — was it submitted as a data URL?');
  if (!audioPath) throw new Error('audio field has no decoded path — was it submitted as a data URL?');

  const videoOut = join(ctx.outputDir, 'video.mp4');
  const coverOut = join(ctx.outputDir, 'cover.avif');

  // ── Step 1: Probe audio duration for progress (0–5%) ─────────────────────
  await ctx.progress(2, 'Probing audio duration…');
  const duration = await probeDuration(audioPath);
  if (duration) {
    await ctx.log(`Audio duration: ${duration.toFixed(1)}s — clip will loop to fill this.`);
  } else {
    await ctx.log('Could not probe audio duration — progress will be indeterminate.', 'warn');
  }

  // ── Step 2: Loop clip over audio → video.mp4 (5–75%) ─────────────────────
  await ctx.progress(5, 'Encoding looping video…');
  await ctx.log(`ffmpeg: looping ${fields.clip.name} over ${fields.audio.name} → video.mp4`);

  // -stream_loop -1  : loop the video stream indefinitely
  // -shortest        : stop when the shortest stream (audio) ends
  // h264_nvenc is tried first; fall back to libx264 if GPU is unavailable
  // NOTE: -c:v (encoder) must come AFTER all -i inputs or ffmpeg treats it
  //       as a decoder for the input file.
  const inputArgs = [
    '-stream_loop', '-1',
    '-i',  clipPath,
    '-i',  audioPath,
  ];
  const outputArgs = [
    '-map',    '0:v:0',
    '-map',    '1:a:0',
    '-c:a',    'aac',
    '-b:a',    '128k',
    '-pix_fmt','yuv420p',
    '-shortest',
    videoOut,
  ];
  const videoEncoded = await tryGpuThenCpu(ctx, inputArgs, outputArgs,
    { duration, progressStart: 5, progressEnd: 75 });

  await ctx.log(`video.mp4 written → ${videoOut}`);
  await ctx.progress(75, 'Video encoded.');

  // ── Step 3: Extract AVIF preview (up to 10 s from 3 s in) (75–92%) ───────
  await ctx.progress(77, 'Extracting AVIF cover…');
  await ctx.log('ffmpeg: extracting cover preview from clip…');

  await ctx.spawn('ffmpeg', [
    '-hide_banner',
    '-y',
    '-ss',   '3',
    '-i',    clipPath,
    '-t',    '10',
    '-an',
    '-vf',   'fps=22,format=yuv420p',
    '-c:v',  'libaom-av1',
    '-still-picture', '0',
    '-crf',  '48',
    '-b:v',  '0',
    '-cpu-used', '8',
    '-row-mt', '1',
    '-f',    'avif',
    coverOut,
  ], { progressStart: 77, progressEnd: 92 });

  await ctx.log(`cover.avif written → ${coverOut}`);
  await ctx.progress(92, 'Cover extracted.');

  // ── Step 4: Save text fields (92–97%) ────────────────────────────────────
  await saveTextFields(fields, ctx);
  await ctx.progress(97, 'Text saved.');

  // ── Done ──────────────────────────────────────────────────────────────────
  await ctx.log('video-from-looping-clip-over-mp3 complete.');
  await ctx.log(`Output directory: ${ctx.outputDir}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function assertFile(fields, key, ctx) {
  if (!fields[key]) throw new Error(`Required field "${key}" not found in submission.`);
  if (!fields[key].isFile) throw new Error(`Field "${key}" is not a file.`);
  if (fields[key].warning) ctx.log(`[${key}] ${fields[key].warning}`, 'warn').catch(() => {});
}

async function probeDuration(filePath) {
  try {
    const { stdout } = await execFile('ffprobe', [
      '-v',      'error',
      '-select_streams', 'a:0',
      '-show_entries', 'format=duration',
      '-of',     'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const seconds = parseFloat(stdout.trim());
    return isNaN(seconds) ? null : seconds;
  } catch {
    return null;
  }
}

/**
 * Try encoding with h264_nvenc (GPU). If ffmpeg rejects it, fall back to
 * libx264 (CPU). Logs which encoder was used.
 *
 * inputArgs  — everything up to and including the last -i flag
 * outputArgs — map/codec/filter/output flags (no -c:v; we inject it here)
 */
async function tryGpuThenCpu(ctx, inputArgs, outputArgs, spawnOpts) {
  const gpuArgs = ['-hide_banner', '-y', ...inputArgs, '-c:v', 'h264_nvenc', ...outputArgs];
  try {
    await ctx.spawn('ffmpeg', gpuArgs, spawnOpts);
    await ctx.log('Encoded with h264_nvenc (GPU).');
    return 'nvenc';
  } catch {
    await ctx.log('h264_nvenc unavailable — falling back to libx264 (CPU).', 'warn');
    const cpuArgs = ['-hide_banner', '-y', ...inputArgs, '-c:v', 'libx264', '-preset', 'fast', ...outputArgs];
    await ctx.spawn('ffmpeg', cpuArgs, spawnOpts);
    await ctx.log('Encoded with libx264 (CPU).');
    return 'libx264';
  }
}

async function saveTextFields(fields, ctx) {
  const parts = [];
  if (fields.title?.value) parts.push(`# ${fields.title.value}`);
  if (fields.text?.value)  parts.push(String(fields.text.value));
  if (parts.length === 0) return;

  const textPath = join(ctx.outputDir, 'text.md');
  writeFileSync(textPath, parts.join('\n\n') + '\n', 'utf8');
  await ctx.log(`text.md written → ${textPath}`);
}
