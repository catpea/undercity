// processor/video-from-audio-and-jpg/index.js
//
// Creates a video from a still image + audio track, then compresses the image
// as an AVIF cover, and saves any text field as text.md.
//
// Expected fields:
//   image  — image file (JPEG or PNG)  — required
//   audio  — audio file (MP3, WAV, …)  — required
//   title  — text (optional)           — written to text.md
//   text   — text (optional)           — written to text.md (appended after title)
//
// Output files written to ctx.outputDir:
//   video.mp4   — H.264 video, audio from field
//   cover.avif  — 1024×1024 AVIF compressed still image
//   text.md     — contents of title + text fields (if provided)
//
// Requires: ffmpeg in PATH.

import { writeFileSync, existsSync } from 'node:fs';
import { join }                      from 'node:path';
import { execFile as _execFile }     from 'node:child_process';
import { promisify }                 from 'node:util';

const execFile = promisify(_execFile);

/**
 * @param {Record<string, import('../../processor.js').FieldInfo>} fields
 * @param {import('../../processor.js').Ctx} ctx
 */
export async function handle(fields, ctx) {

  // ── Validate required fields ──────────────────────────────────────────────
  assertFile(fields, 'image', ctx);
  assertFile(fields, 'audio', ctx);

  const imagePath = fields.image.path;
  const audioPath = fields.audio.path;

  if (!imagePath) throw new Error('image field has no decoded path — was it submitted as a data URL?');
  if (!audioPath) throw new Error('audio field has no decoded path — was it submitted as a data URL?');

  const videoOut = join(ctx.outputDir, 'video.mp4');
  const coverOut = join(ctx.outputDir, 'cover.avif');

  // ── Step 1: Get audio duration for progress (0–5%) ───────────────────────
  await ctx.progress(2, 'Probing audio duration…');
  const duration = await probeDuration(audioPath);
  if (duration) {
    await ctx.log(`Audio duration: ${duration.toFixed(1)}s`);
  } else {
    await ctx.log('Could not probe duration — progress will be indeterminate.', 'warn');
  }

  // ── Step 2: Still image → video.mp4 (5–70%) ──────────────────────────────
  await ctx.progress(5, 'Encoding video…');
  await ctx.log(`ffmpeg: ${fields.image.name} + ${fields.audio.name} → video.mp4`);

  await ctx.spawn('ffmpeg', [
    '-hide_banner',
    '-y',
    '-loop',    '1',
    '-i',       imagePath,
    '-i',       audioPath,
    '-c:v',     'h264',
    '-tune',    'stillimage',
    '-c:a',     'aac',
    '-b:a',     '192k',
    '-pix_fmt', 'yuv420p',
    '-shortest',
    videoOut,
  ], { duration, progressStart: 5, progressEnd: 70 });

  await ctx.log(`video.mp4 written → ${videoOut}`);
  await ctx.progress(70, 'Video encoded.');

  // ── Step 3: Compress image as 1024×1024 AVIF cover (70–90%) ──────────────
  await ctx.progress(72, 'Encoding AVIF cover…');
  await ctx.log('ffmpeg: compressing still image as 1024×1024 AVIF…');

  await ctx.spawn('ffmpeg', [
    '-hide_banner',
    '-y',
    '-i',     imagePath,
    '-vf',    'scale=1024:1024:force_original_aspect_ratio=decrease,pad=1024:1024:(ow-iw)/2:(oh-ih)/2',
    '-c:v',   'libaom-av1',
    '-still-picture', '1',
    '-crf',   '35',
    '-b:v',   '0',
    '-cpu-used', '6',
    '-f',     'avif',
    coverOut,
  ], { progressStart: 72, progressEnd: 90 });

  await ctx.log(`cover.avif written → ${coverOut}`);
  await ctx.progress(90, 'Cover encoded.');

  // ── Step 4: Save text fields (90–95%) ────────────────────────────────────
  await saveTextFields(fields, ctx);
  await ctx.progress(95, 'Text saved.');

  // ── Done ──────────────────────────────────────────────────────────────────
  await ctx.log('video-from-audio-and-jpg complete.');
  await ctx.log(`Output directory: ${ctx.outputDir}`);
  // processor.js posts 100% / done after handle() returns
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

async function saveTextFields(fields, ctx) {
  const parts = [];
  if (fields.title?.value) parts.push(`# ${fields.title.value}`);
  if (fields.text?.value)  parts.push(String(fields.text.value));
  if (parts.length === 0) return;

  const textPath = join(ctx.outputDir, 'text.md');
  writeFileSync(textPath, parts.join('\n\n') + '\n', 'utf8');
  await ctx.log(`text.md written → ${textPath}`);
}
