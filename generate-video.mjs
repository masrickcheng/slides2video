#!/usr/bin/env node
/**
 * generate-video.mjs — Generic PPT-to-MP4 converter with 豆包 TTS narration.
 *
 * Usage:
 *   node generate-video.mjs <project-dir> [options]
 *
 * Options:
 *   --voice <voice_type>     Override DOUBAO_VOICE from .env
 *   --skip-screenshots       Skip Phase 1 (reuse existing slide_NN.png in tmp/)
 *   --skip-audio             Skip Phase 2 (reuse existing slide_NN.pcm in tmp/)
 *
 * Inputs (inside <project-dir>):
 *   scripts.json             Narration scripts — see format below
 *   slide_01.png …           Pre-rendered slide images (optional; if absent and
 *                            index.html exists, Playwright captures them)
 *
 * scripts.json format:
 *   Simple array:
 *     ["Slide 1 narration.", "Slide 2 narration.", ...]
 *
 *   With voice override:
 *     { "voice": "zh_male_shaonianzixin_moon_bigtts", "scripts": ["...", ...] }
 *
 * Output:
 *   <project-dir>/output.mp4
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

// Auto-load .env from ppt/
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const projectArg = args.find(a => !a.startsWith('--'));
if (!projectArg) {
  console.error('Usage: node generate-video.mjs <project-dir> [--voice <voice>] [--screenshots-only] [--skip-screenshots] [--skip-audio] [--concat-only]');
  process.exit(1);
}

const PROJECT   = path.resolve(__dirname, projectArg);
const TMP       = path.join(PROJECT, 'tmp');
const OUTPUT    = path.join(PROJECT, 'output.mp4');
const HTML      = path.join(PROJECT, 'index.html');

const SCREENSHOTS_ONLY = args.includes('--screenshots-only');
const SKIP_SCREENSHOTS = args.includes('--skip-screenshots') || args.includes('--concat-only');
const SKIP_AUDIO       = args.includes('--skip-audio')       || args.includes('--concat-only') || SCREENSHOTS_ONLY;
const voiceIdx = args.indexOf('--voice');
const VOICE_ARG = voiceIdx !== -1 ? args[voiceIdx + 1] : null;

// ── Load scripts ──────────────────────────────────────────────────────────────

function loadScripts() {
  const jsonFile = path.join(PROJECT, 'scripts.json');
  const txtFile  = path.join(PROJECT, 'scripts.txt');

  if (fs.existsSync(jsonFile)) {
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    if (Array.isArray(data)) return { scripts: data, voice: null };
    // { voice?, scripts: [] }
    return { scripts: data.scripts, voice: data.voice ?? null };
  }
  if (fs.existsSync(txtFile)) {
    const scripts = fs.readFileSync(txtFile, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    return { scripts, voice: null };
  }
  throw new Error(`No scripts.json or scripts.txt found in ${PROJECT}`);
}

const { scripts: SCRIPTS, voice: scriptVoice } = loadScripts();
const VOICE = VOICE_ARG ?? scriptVoice ?? process.env.DOUBAO_VOICE ?? 'zh_male_shaonianzixin_moon_bigtts';
const TOTAL = SCRIPTS.length;
const pad   = n => String(n).padStart(2, '0');

// ── Phase 1: Screenshots ──────────────────────────────────────────────────────

async function captureSlides() {
  // Check if pre-rendered images exist in the project dir
  const preRendered = Array.from({ length: TOTAL }, (_, i) =>
    path.join(PROJECT, `slide_${pad(i + 1)}.png`)
  ).filter(f => fs.existsSync(f));

  if (preRendered.length === TOTAL) {
    console.log('📸 Phase 1: Using pre-rendered slide images...');
    for (let i = 0; i < TOTAL; i++) {
      const src = path.join(PROJECT, `slide_${pad(i + 1)}.png`);
      const dst = path.join(TMP, `slide_${pad(i + 1)}.png`);
      fs.copyFileSync(src, dst);
      console.log(`  slide ${pad(i + 1)}/${TOTAL} → copied from project dir`);
    }
    console.log('  Done.\n');
    return;
  }

  if (!fs.existsSync(HTML)) {
    throw new Error(
      `No slide_NN.png files found in ${PROJECT} and no index.html to capture from.\n` +
      `Either place slide_01.png…slide_${pad(TOTAL)}.png in the project dir, or add an index.html.`
    );
  }

  console.log('📸 Phase 1: Capturing slides via Playwright...');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  // deviceScaleFactor:2 → screenshots at 780×1688 (retina 2x, much sharper)
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page    = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`file://${HTML}`);
  await page.waitForLoadState('networkidle');

  for (let i = 0; i < TOTAL; i++) {
    await page.evaluate(idx => window.goTo(idx), i);
    await page.waitForTimeout(600);
    const file = path.join(TMP, `slide_${pad(i + 1)}.png`);
    await page.screenshot({ path: file });
    console.log(`  slide ${pad(i + 1)}/${TOTAL} → ${path.basename(file)}`);
  }

  await browser.close();
  console.log('  Done.\n');
}

// ── Phase 2: TTS Audio (豆包 V3 HTTP Chunked) ─────────────────────────────────

async function ttsDoubao(text) {
  // Model 1.0 voices (_moon_bigtts)    → seed-tts-1.0
  // Model 2.0 voices (_saturn/_uranus) → seed-tts-2.0
  const resourceId = (VOICE.includes('_saturn_') || VOICE.includes('_uranus_'))
    ? 'seed-tts-2.0' : 'seed-tts-1.0';

  const res = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-App-Key':    process.env.DOUBAO_APP_ID,
      'X-Api-Access-Key': process.env.DOUBAO_ACCESS_TOKEN,
      'X-Api-Resource-Id': resourceId,
    },
    body: JSON.stringify({
      user: { uid: 'tts-gen' },
      req_params: {
        text,
        speaker: VOICE,
        audio_params: { format: 'pcm', sample_rate: 24000 },
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`豆包 TTS HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }

  // Response: newline-delimited JSON, each line: {"code":0,"data":"<base64 pcm>"}
  // Final line: {"code":20000000,"message":"OK"}
  const chunks = [];
  let buf = '';
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const obj = JSON.parse(line);
      if (obj.code !== 0 && obj.code !== 20000000)
        throw new Error(`豆包 TTS error ${obj.code}: ${obj.message}`);
      if (obj.data) chunks.push(Buffer.from(obj.data, 'base64'));
    }
  }
  if (buf.trim()) {
    const obj = JSON.parse(buf);
    if (obj.code !== 0 && obj.code !== 20000000)
      throw new Error(`豆包 TTS error ${obj.code}: ${obj.message}`);
    if (obj.data) chunks.push(Buffer.from(obj.data, 'base64'));
  }

  if (chunks.length === 0) throw new Error('豆包 TTS: no audio received');
  return Buffer.concat(chunks);
}

async function generateAudio() {
  console.log('🔊 Phase 2: Generating TTS audio via 豆包...');
  for (let i = 0; i < TOTAL; i++) {
    const file = path.join(TMP, `slide_${pad(i + 1)}.pcm`);
    const buf  = await ttsDoubao(SCRIPTS[i]);
    fs.writeFileSync(file, buf);
    console.log(`  audio ${pad(i + 1)}/${TOTAL} → ${path.basename(file)}`);
  }
  console.log('  Done.\n');
}

// ── Phase 3+4: Build + concat via filter_complex (frame-perfect A/V sync) ─────
//
// Each slide's video duration is set to the exact PCM duration computed from
// file size (bytes / (sampleRate * 2)).  A single ffmpeg pass feeds all images
// and PCM files simultaneously through the concat filter, so there is no
// intermediate AAC encoding, no resample drift, and no per-clip quantisation
// error.  This is the only approach that guarantees sample-accurate sync.

function buildAndConcat() {
  console.log('🎬 Phase 3+4: Building video via filter_complex concat...');

  // Exact duration per slide (s16le 24kHz mono → bytes / 48000 bytes/sec)
  const durations = Array.from({ length: TOTAL }, (_, i) => {
    const pcm = path.join(TMP, `slide_${pad(i + 1)}.pcm`);
    return fs.statSync(pcm).size / (24000 * 2);
  });

  // Build input args: pairs of (image, pcm) for each slide
  const inputs = durations.flatMap((dur, i) => [
    `-loop 1 -t ${dur.toFixed(6)} -r 25 -i "${path.join(TMP, `slide_${pad(i + 1)}.png`)}"`,
    `-f s16le -ar 24000 -ac 1 -i "${path.join(TMP, `slide_${pad(i + 1)}.pcm`)}"`,
  ]);

  // filter_complex: interleave video+audio streams into concat
  const refs   = Array.from({ length: TOTAL }, (_, i) => `[${i * 2}:v][${i * 2 + 1}:a]`).join('');
  const filter = `${refs}concat=n=${TOTAL}:v=1:a=1[outv][outa]`;

  // Write filter to a tmp file to avoid shell arg-length limits
  const filterFile = path.join(TMP, 'filter.txt');
  fs.writeFileSync(filterFile, filter);

  execSync(
    `ffmpeg -y ${inputs.join(' ')} ` +
    `-filter_complex_script "${filterFile}" ` +
    `-map "[outv]" -map "[outa]" ` +
    `-c:v libx264 -tune stillimage -crf 18 -preset slow -pix_fmt yuv420p ` +
    `-c:a aac -b:a 128k -ar 44100 ` +
    `"${OUTPUT}"`,
    { stdio: 'inherit' }
  );

  console.log(`  Done → ${OUTPUT}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DOUBAO_APP_ID || !process.env.DOUBAO_ACCESS_TOKEN) {
    console.error('Error: DOUBAO_APP_ID and DOUBAO_ACCESS_TOKEN must be set in ppt/.env');
    process.exit(1);
  }

  if (!fs.existsSync(PROJECT)) {
    console.error(`Error: project directory not found: ${PROJECT}`);
    process.exit(1);
  }

  console.log(`Project : ${PROJECT}`);
  console.log(`Slides  : ${TOTAL}`);
  console.log(`Voice   : ${VOICE}\n`);

  // Wipe tmp only on a full run; preserve it when skipping phases
  if (!SKIP_SCREENSHOTS && !SKIP_AUDIO) {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  fs.mkdirSync(TMP, { recursive: true });

  if (!SKIP_SCREENSHOTS) await captureSlides();
  if (SCREENSHOTS_ONLY) {
    console.log(`✅ Screenshots saved to ${TMP}`);
    return;
  }
  if (!SKIP_AUDIO) await generateAudio();
  buildAndConcat();

  console.log(`✅ Video ready: ${OUTPUT}`);
  console.log(`   Run: open "${OUTPUT}"`);
}

main().catch(err => { console.error(err); process.exit(1); });
