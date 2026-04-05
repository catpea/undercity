// processor/picture-in-picture/index.js
//
// Overlays a looping PiP clip over a main video with rounded corners and an
// optional border, then extracts an AVIF preview and saves text fields.
//
// This is a JavaScript port of rpip.sh. All rpip parameters are accepted as
// optional Inventory fields; sensible defaults match the original script.
//
// Required fields (from Inventory):
//   main — main background video (MP4, MOV, …)    — required
//   pip  — PiP source video clip (WebM, MP4, …)   — required
//
// Optional fields (all have defaults matching rpip.sh):
//   title / text   — written to text.md
//   pipStart       — clip start time in PiP source (default 20s)
//   pipEnd         — clip end time  in PiP source (default 50s)
//   pipScale       — PiP height fraction of main height (default 0.35)
//   pipSide        — LEFT or RIGHT (default LEFT)
//   pipMarginX     — horizontal margin from chosen side in px (default 20)
//   pipMarginY     — vertical margin from bottom in px (default 20)
//   pipRadius      — corner radius in px (default 2)
//   pipBorder      — border thickness in px; 0 disables (default 2)
//   pipBorderColor — ffmpeg color expression (default black@0.92)
//   pipAa          — alpha-blur sigma for anti-aliased corners; 0 disables (default 1.2)
//   venc           — output video encoder; "h264" auto-picks best H.264 (default h264)
//   aenc           — output audio encoder (default aac)
//   vbitrate       — target video bitrate (default 6M)
//   vmaxrate       — max video bitrate (default 8M)
//   vbufsize       — video encoder buffer size (default 12M)
//   gop            — keyframe interval in frames (default 60)
//   outFps         — output constant frame rate (default 30)
//   mixPipAudio    — 1 to mix PiP audio into output (default 0)
//   pipAudioVol    — PiP audio volume multiplier (default 1.0)
//   previewOut     — preview filename or "-" to skip (default preview.avif)
//   previewLen     — preview length in seconds (default 10)
//   previewStart   — start offset in output video for preview (default 0)
//   previewFps     — preview frame rate (default 12)
//   previewH       — preview height in pixels (default 1024)
//   previewCrf     — AV1 CRF for preview; higher = smaller (default 45)
//   previewCpuUsed — libaom-av1 cpu-used 0–8; 8 = fastest (default 8)
//   previewSquare  — 1 to crop preview to square (default 0)
//   previewSize    — square crop size when previewSquare=1 (default 512)
//
// Output files written to ctx.outputDir:
//   video.mp4     — composed video with PiP overlay
//   preview.avif  — silent preview (or .mp4 fallback); skipped when previewOut="-"
//   text.md       — contents of title + text fields (if provided)
//
// Requires: ffmpeg + ffprobe in PATH.

import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join }                               from 'node:path';
import { tmpdir }                             from 'node:os';
import { execFile as _execFile }              from 'node:child_process';
import { promisify }                          from 'node:util';

const execFile = promisify(_execFile);

/**
 * @param {Record<string, import('../../processor.js').FieldInfo>} fields
 * @param {import('../../processor.js').Ctx} ctx
 */
export async function handle(fields, ctx) {

  // ── Validate required fields ──────────────────────────────────────────────
  assertFile(fields, 'main', ctx);
  assertFile(fields, 'pip',  ctx);

  const mainPath = fields.main.path;
  const pipPath  = fields.pip.path;

  if (!mainPath) throw new Error('main field has no decoded path — was it submitted as a data URL?');
  if (!pipPath)  throw new Error('pip field has no decoded path — was it submitted as a data URL?');

  // ── Read optional params (fall back to rpip defaults) ────────────────────
  const pipStart       = num(fields.pipStart,       20);
  const pipEnd         = num(fields.pipEnd,         50);
  const pipScale       = num(fields.pipScale,       0.35);
  const pipSide        = str(fields.pipSide,        'LEFT').toUpperCase();
  const pipMarginX     = num(fields.pipMarginX,     20);
  const pipMarginY     = num(fields.pipMarginY,     20);
  const pipRadius      = num(fields.pipRadius,      2);
  const pipBorder      = num(fields.pipBorder,      2);
  const pipBorderColor = str(fields.pipBorderColor, 'black@0.92');
  const pipAa          = num(fields.pipAa,          1.2);
  const venc           = str(fields.venc,           'h264');
  const aenc           = str(fields.aenc,           'aac');
  const vbitrate       = str(fields.vbitrate,       '6M');
  const vmaxrate       = str(fields.vmaxrate,       '8M');
  const vbufsize       = str(fields.vbufsize,       '12M');
  const gop            = num(fields.gop,            60);
  const outFps         = num(fields.outFps,         30);
  const mixPipAudio    = num(fields.mixPipAudio,    0);
  const pipAudioVol    = num(fields.pipAudioVol,    1.0);
  const previewOut     = str(fields.previewOut,     'preview.avif');
  const previewLen     = num(fields.previewLen,     10);
  const previewStart   = num(fields.previewStart,   0);
  const previewFps     = num(fields.previewFps,     12);
  const previewH       = num(fields.previewH,       1024);
  const previewCrf     = num(fields.previewCrf,     45);
  const previewCpuUsed = num(fields.previewCpuUsed, 8);
  const previewSquare  = num(fields.previewSquare,  0);
  const previewSize    = num(fields.previewSize,    512);

  const videoOut   = join(ctx.outputDir, 'video.mp4');

  // ── Step 1: Pick encoders (2–8%) ──────────────────────────────────────────
  await ctx.progress(2, 'Detecting available encoders…');

  const vencPicked = await pickH264Encoder(venc);
  const snipVenc   = await pickPipSnipEncoder();
  const snipAenc   = await pickSnipAudioEncoder();

  if (!snipVenc) {
    throw new Error('Neither libvpx-vp9 nor libaom-av1 is available. Cannot create PiP snippet.');
  }

  await ctx.log(`Output encoder:       ${vencPicked}`);
  await ctx.log(`PiP snippet encoder:  ${snipVenc}`);
  await ctx.log(`PiP audio encoder:    ${snipAenc}`);
  await ctx.progress(8, 'Encoders detected.');

  // ── Step 2: Probe main video height (8–12%) ───────────────────────────────
  await ctx.progress(8, 'Probing main video height…');
  const mainH = await probeVideoHeight(mainPath);
  if (!mainH) throw new Error('Could not probe main video height via ffprobe.');
  await ctx.log(`Main video height: ${mainH}px`);

  // PiP height = round(mainH × pipScale), forced even
  let pipH = Math.round(mainH * pipScale);
  if (pipH < 2) pipH = 2;
  if (pipH % 2 === 1) pipH++;
  await ctx.log(`PiP target height:  ${pipH}px  (scale=${pipScale})`);
  await ctx.progress(12, `PiP height: ${pipH}px`);

  // ── Step 3: Create loopable PiP snippet (12–40%) ─────────────────────────
  // A pre-scaled snippet is created from [pipStart, pipEnd] of the PiP source.
  // It is then streamed in a loop during the main encode, avoiding redundant
  // per-frame scaling inside the complex filter.
  await ctx.progress(12, 'Creating PiP snippet…');
  await ctx.log(`ffmpeg: slicing PiP source ${pipStart}s–${pipEnd}s → snippet`);

  const workDir  = mkdtempSync(join(tmpdir(), 'undercity-pip-'));
  const snipPath = join(workDir, 'pip_snip.mkv');

  try {

    const snipArgs = [
      '-y', '-hide_banner',
      '-ss', String(pipStart), '-to', String(pipEnd), '-i', pipPath,
      '-vf', `fps=${outFps},scale=-2:${pipH},setsar=1,format=yuv420p`,
    ];

    if (snipVenc === 'libvpx-vp9') {
      snipArgs.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-row-mt', '1');
    } else {
      // libaom-av1
      snipArgs.push('-c:v', 'libaom-av1', '-crf', '35', '-b:v', '0', '-cpu-used', '8', '-row-mt', '1');
    }
    snipArgs.push('-c:a', snipAenc, '-ar', '48000', snipPath);

    await ctx.spawn('ffmpeg', snipArgs, { progressStart: 12, progressEnd: 40 });

    // Validate the snippet — ffmpeg can exit 0 yet write a corrupt/empty
    // container (e.g. VP9 input parse warnings suppressed, zero frames encoded).
    // A corrupt snippet makes the compositor fail with cryptic EBML errors.
    const snipDuration = await probeFileDuration(snipPath);
    if (!snipDuration || snipDuration < 0.1) {
      throw new Error(
        `PiP snippet is empty or unreadable after encoding (${snipPath}). ` +
        `Check that the pip source (${fields.pip.name}) contains video ` +
        `between ${pipStart}s and ${pipEnd}s, and that it is not corrupt.`,
      );
    }

    await ctx.log(`PiP snippet written → ${snipPath}  (${snipDuration.toFixed(1)}s)`);
    await ctx.progress(40, 'PiP snippet ready.');

    // ── Step 4: Build filter_complex for overlay (40–85%) ──────────────────
    await ctx.progress(42, 'Encoding main video with PiP overlay…');

    // Rounded-corner alpha mask (mirrors the geq expression from rpip.sh).
    // No or() function in ffmpeg geq — OR is approximated by summing booleans.
    //   dx = min(X, W-1-X),  dy = min(Y, H-1-Y)
    //   Opaque if: dx≥R  OR  dy≥R  OR  (dx-R)²+(dy-R)²≤R²
    const R  = pipRadius;
    const R2 = R * R;
    const maskExpr =
      `if(gte(min(X,W-1-X),${R})` +
      `+gte(min(Y,H-1-Y),${R})` +
      `+lte((min(X,W-1-X)-${R})*(min(X,W-1-X)-${R})` +
        `+(min(Y,H-1-Y)-${R})*(min(Y,H-1-Y)-${R}),${R2}),255,0)`;

    const aaFilter = pipAa > 0 ? `,gblur=sigma=${pipAa}` : '';

    // Horizontal placement — LEFT anchors to left edge, RIGHT to right edge
    const xExpr = pipSide === 'RIGHT' ? `W-w-${pipMarginX}` : String(pipMarginX);

    // Video filter chain:
    //  • [base]    — main video normalised to RGBA
    //  • [pip_pad] — snippet padded with border
    //  • [alpha]   — rounded-rect mask derived from the padded PiP geometry
    //  • [pip]     — snippet with rounded mask applied (alphamerge)
    //  • final     — PiP overlaid on base, anchored bottom-left or bottom-right
    const vf = [
      `[0:v]fps=${outFps},setsar=1,format=rgba[base]`,
      `[1:v]fps=${outFps},setsar=1,format=rgba,` +
        `pad=iw+2*${pipBorder}:ih+2*${pipBorder}:${pipBorder}:${pipBorder}:color=${pipBorderColor}[pip_pad]`,
      `[pip_pad]split[pip_rgb][pip_m]`,
      `[pip_m]format=gray,geq=lum='${maskExpr}'${aaFilter}[alpha]`,
      `[pip_rgb][alpha]alphamerge[pip]`,
      `[base][pip]overlay=x=${xExpr}:y=H-h-${pipMarginY}:format=auto[v]`,
    ].join(';');

    // Optional audio mix — blend main + PiP audio tracks
    let filterComplex;
    let amap;

    if (mixPipAudio === 1) {
      const af = [
        '[0:a]aresample=48000[a0]',
        `[1:a]aresample=48000,volume=${pipAudioVol}[a1]`,
        '[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[a]',
      ].join(';');
      filterComplex = `${vf};${af}`;
      amap = ['-map', '[a]'];
    } else {
      filterComplex = vf;
      amap = ['-map', '0:a?'];
    }

    await ctx.log(`ffmpeg: compositing ${fields.main.name} + PiP → video.mp4`);
    await ctx.log(`PiP side: ${pipSide}  radius=${pipRadius}  border=${pipBorder}  color=${pipBorderColor}`);

    await ctx.spawn('ffmpeg', [
      '-y', '-hide_banner',
      '-i',            mainPath,
      '-stream_loop', '-1', '-i', snipPath,
      '-filter_complex', filterComplex,
      '-map', '[v]',
      ...amap,
      '-c:v',      vencPicked,
      '-b:v',      vbitrate,
      '-maxrate',  vmaxrate,
      '-bufsize',  vbufsize,
      '-g',        String(gop),
      '-pix_fmt',  'yuv420p',
      '-c:a',      aenc,
      '-movflags', '+faststart',
      '-shortest',
      videoOut,
    ], { progressStart: 42, progressEnd: 85 });

    await ctx.log(`video.mp4 written → ${videoOut}`);
    await ctx.progress(85, 'Video encoded.');

  } finally {
    // ── Clean up PiP snippet temp dir ──────────────────────────────────────
    rmSync(workDir, { recursive: true, force: true });
    await ctx.log('Cleaned up PiP snippet temp dir.');
  }

  // ── Step 5: Extract preview (85–95%) ──────────────────────────────────────
  if (previewOut !== '-') {
    await ctx.progress(87, 'Extracting preview…');

    const previewPath = join(ctx.outputDir, previewOut);

    // Scale filter — square crop or fixed height
    const postVf = previewSquare === 1
      ? `crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2,scale=${previewSize}:${previewSize}`
      : `scale=-2:${previewH}`;

    const basePreviewArgs = [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-ss', String(previewStart), '-i', videoOut,
      '-t',  String(previewLen),
      '-an',
      '-vf', `fps=${previewFps},${postVf},setsar=1,format=yuv420p`,
    ];

    const isAvif = previewOut.toLowerCase().endsWith('.avif');
    let previewWritten = false;

    if (isAvif && await hasEncoder('libaom-av1')) {
      try {
        await ctx.spawn('ffmpeg', [
          ...basePreviewArgs,
          '-c:v',      'libaom-av1',
          '-crf',      String(previewCrf),
          '-b:v',      '0',
          '-cpu-used', String(previewCpuUsed),
          '-row-mt',   '1',
          '-f',        'avif',
          previewPath,
        ], { progressStart: 87, progressEnd: 95 });
        await ctx.log(`preview written → ${previewPath} (animated AVIF, silent)`);
        previewWritten = true;
      } catch {
        await ctx.log('AVIF preview failed — falling back to MP4 preview.', 'warn');
      }
    }

    if (!previewWritten) {
      // MP4 fallback (or explicit non-avif request)
      const mp4Path = isAvif ? previewPath.replace(/\.avif$/i, '.mp4') : previewPath;
      await ctx.spawn('ffmpeg', [
        ...basePreviewArgs,
        '-c:v',     vencPicked,
        '-b:v',     '400k',
        '-maxrate', '600k',
        '-bufsize', '800k',
        '-g',       String(gop),
        '-movflags', '+faststart',
        mp4Path,
      ], { progressStart: 87, progressEnd: 95 });
      if (isAvif) await ctx.log('AVIF unavailable — wrote MP4 preview instead.', 'warn');
      await ctx.log(`preview written → ${mp4Path}`);
    }

    await ctx.progress(95, 'Preview extracted.');
  } else {
    await ctx.progress(95, 'Preview skipped.');
  }

  // ── Step 6: Save text fields (95–98%) ─────────────────────────────────────
  await saveTextFields(fields, ctx);
  await ctx.progress(98, 'Text saved.');

  // ── Done ──────────────────────────────────────────────────────────────────
  await ctx.log('picture-in-picture complete.');
  await ctx.log(`Output directory: ${ctx.outputDir}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Assert that a required file field exists and is a file. */
function assertFile(fields, key, ctx) {
  if (!fields[key]) throw new Error(`Required field "${key}" not found in submission.`);
  if (!fields[key].isFile) throw new Error(`Field "${key}" is not a file.`);
  if (fields[key].warning) ctx.log(`[${key}] ${fields[key].warning}`, 'warn').catch(() => {});
}

/** Read a numeric field value, falling back to a default. */
function num(field, defaultVal) {
  if (!field) return defaultVal;
  const v = Number(field.value ?? field);
  return isNaN(v) ? defaultVal : v;
}

/** Read a string field value, falling back to a default. */
function str(field, defaultVal) {
  if (!field) return defaultVal;
  const v = String(field.value ?? field).trim();
  return v || defaultVal;
}

/** Return true if ffmpeg supports the given encoder name. */
async function hasEncoder(name) {
  try {
    await execFile('ffmpeg', ['-hide_banner', '-h', `encoder=${name}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pick the best available H.264 encoder.
 * "h264" auto-selects: libopenh264 → hardware encoders → libopenh264 fallback.
 * Any other value is used directly if available; libopenh264 is the last resort.
 */
async function pickH264Encoder(requested) {
  if (requested === 'h264') {
    if (await hasEncoder('libopenh264')) return 'libopenh264';
    for (const enc of ['h264_nvenc', 'h264_vaapi', 'h264_qsv', 'h264_amf', 'h264_v4l2m2m']) {
      if (await hasEncoder(enc)) return enc;
    }
    return 'libopenh264';
  }
  if (await hasEncoder(requested)) return requested;
  if (await hasEncoder('libopenh264')) return 'libopenh264';
  return requested;
}

/**
 * Pick the encoder for the intermediate PiP snippet (WebM container).
 * Prefers VP9; falls back to AV1. Returns null if neither is available.
 */
async function pickPipSnipEncoder() {
  if (await hasEncoder('libvpx-vp9'))  return 'libvpx-vp9';
  if (await hasEncoder('libaom-av1'))  return 'libaom-av1';
  return null;
}

/** Pick the audio encoder for the PiP snippet. */
async function pickSnipAudioEncoder() {
  if (await hasEncoder('libopus')) return 'libopus';
  return 'aac';
}

/**
 * Probe the total container duration of a media file via ffprobe.
 * Returns the duration in seconds, or null if the file is unreadable/empty.
 * Used to validate that encoded intermediate files contain actual content.
 */
async function probeFileDuration(filePath) {
  try {
    const { stdout } = await execFile('ffprobe', [
      '-v',            'error',
      '-show_entries', 'format=duration',
      '-of',           'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const d = parseFloat(stdout.trim());
    return isNaN(d) || d <= 0 ? null : d;
  } catch {
    return null;
  }
}

/** Probe the pixel height of the first video stream. Returns null on failure. */
async function probeVideoHeight(filePath) {
  try {
    const { stdout } = await execFile('ffprobe', [
      '-v',             'error',
      '-select_streams', 'v:0',
      '-show_entries',   'stream=height',
      '-of',             'csv=p=0',
      filePath,
    ]);
    const h = parseInt(stdout.trim(), 10);
    return isNaN(h) || h <= 0 ? null : h;
  } catch {
    return null;
  }
}

/** Write title + text fields to text.md in outputDir (if present). */
async function saveTextFields(fields, ctx) {
  const parts = [];
  if (fields.title?.value) parts.push(`# ${fields.title.value}`);
  if (fields.text?.value)  parts.push(String(fields.text.value));
  if (parts.length === 0) return;

  const textPath = join(ctx.outputDir, 'text.md');
  writeFileSync(textPath, parts.join('\n\n') + '\n', 'utf8');
  await ctx.log(`text.md written → ${textPath}`);
}
