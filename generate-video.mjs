#!/usr/bin/env node
/**
 * generate-video.mjs — Generic PPT-to-MP4 converter with TTS narration.
 *
 * Usage:
 *   node generate-video.mjs <project-dir|deck.pptx> [options]
 *   node generate-video.mjs --list-voices [keyword]   List all available voices
 *
 * Options:
 *   --voice <voice_name>     Override voice from scripts.json/.env
 *   --skip-screenshots       Skip Phase 1 (reuse existing slide_NN.png in tmp/)
 *   --skip-images            Alias for --skip-screenshots
 *   --skip-audio             Skip Phase 2 (reuse existing slide_NN.mp3 in tmp/)
 *   --list-voices [keyword]  Print voice catalog and exit (optional keyword filter)
 *
 * Inputs (inside <project-dir>):
 *   scripts.json             Narration scripts — see format below
 *   *.pptx                   PowerPoint slide deck (PowerPoint/LibreOffice captures it)
 *
 * scripts.json format:
 *   Simple array:
 *     ["Slide 1 narration.", "Slide 2 narration.", ...]
 *
 *   With voice override:
 *     { "voice": "zh-CN-XiaoxiaoNeural", "scripts": ["...", ...] }
 *
 * Output:
 *   <project-dir>/output.mp4
 * Default voice: zh-CN-XiaoxiaoNeural
 *
 * Available voices (run --list-voices to filter):
 *   zh-CN-XiaoxiaoNeural
 *   zh-CN-YunxiNeural
 *   zh-CN-XiaoyiNeural
 *   zh-CN-YunjianNeural
 */

// -- Voice Catalog -------------------------------------------------------------
const VOICE_CATALOG = [
  { name: 'zh-CN-XiaoxiaoNeural', label: '晓晓', gender: '女', desc: '默认声音' },
  { name: 'zh-CN-YunxiNeural', label: '云希', gender: '男', desc: '成熟男声，新闻播报' },
  { name: 'zh-CN-XiaoyiNeural', label: '晓伊', gender: '女', desc: '' },
  { name: 'zh-CN-YunjianNeural', label: '云健', gender: '男', desc: '' },
];
import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_EDGE_VOICE = 'zh-CN-XiaoxiaoNeural';

// ── Config ────────────────────────────────────────────────────────────────────

// Auto-load .env from ppt/
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

// Parse CLI args
const args = process.argv.slice(2);

// --list-voices [keyword]
if (args[0] === '--list-voices') {
  const keyword = args[1]?.toLowerCase();
  const filtered = keyword
    ? VOICE_CATALOG.filter(v =>
        v.name.toLowerCase().includes(keyword) ||
        v.label.toLowerCase().includes(keyword) ||
        v.gender.toLowerCase().includes(keyword) ||
        v.desc.toLowerCase().includes(keyword))
    : VOICE_CATALOG;
  console.log(`\n${'Name'.padEnd(55)} ${'Label'.padEnd(12)} ${'Gender'.padEnd(8)} Description`);
  console.log('─'.repeat(100));
  for (const v of filtered) {
    console.log(`${v.name.padEnd(55)} ${v.label.padEnd(12)} ${v.gender.padEnd(8)} ${v.desc}`);
  }
  console.log(`\n共 ${filtered.length} 个语音`);
  process.exit(0);
}

function getOptionValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

function getProjectArg() {
  const flagsWithValues = new Set(['--voice']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flagsWithValues.has(arg)) {
      i++;
      continue;
    }
    if (!arg.startsWith('--')) return arg;
  }
  return null;
}

const projectArg = getProjectArg();
if (!projectArg) {
  console.error('Usage: node generate-video.mjs <project-dir|deck.pptx> [--voice <voice>] [--screenshots-only] [--skip-screenshots] [--skip-images] [--skip-audio] [--concat-only]');
  console.error('       node generate-video.mjs --list-voices [keyword]');
  process.exit(1);
}

const SCREENSHOTS_ONLY = args.includes('--screenshots-only');
const SKIP_SCREENSHOTS = args.includes('--skip-screenshots') || args.includes('--skip-images') || args.includes('--concat-only');
const SKIP_AUDIO       = args.includes('--skip-audio')       || args.includes('--concat-only') || SCREENSHOTS_ONLY;
const VOICE_ARG = getOptionValue('--voice');
const PPTX_IMAGE_WIDTH = 1920;
const PPTX_IMAGE_HEIGHT = 1080;
const PPTX_TEXT_JSON = 'scripts.json';
const TEXT_ROW_TOLERANCE_POINTS = 15;

function resolveInput(inputArg) {
  const inputPath = path.resolve(__dirname, inputArg);
  const ext = path.extname(inputPath).toLowerCase();

  if (ext === '.pptx') {
    return {
      project: path.dirname(inputPath),
      pptx: inputPath,
    };
  }

  return {
    project: inputPath,
    pptx: null,
  };
}

const INPUT     = resolveInput(projectArg);
const PROJECT   = INPUT.project;
const TMP       = path.join(PROJECT, 'tmp');
const OUTPUT    = path.join(PROJECT, 'output.mp4');
let PPTX        = INPUT.pptx;

if (!fs.existsSync(PROJECT)) {
  console.error(`Error: project directory not found: ${PROJECT}`);
  process.exit(1);
}
if (PPTX && !fs.existsSync(PPTX)) {
  console.error(`Error: PPTX file not found: ${PPTX}`);
  process.exit(1);
}

// ── Load scripts ──────────────────────────────────────────────────────────────

function loadScripts() {
  const jsonFile = path.join(PROJECT, 'scripts.json');
  const txtFile  = path.join(PROJECT, 'scripts.txt');

  if (fs.existsSync(jsonFile)) {
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    if (Array.isArray(data)) return { scripts: data, voice: null };
    // { voice?, scripts: [] }
    if (!Array.isArray(data.scripts)) {
      throw new Error(`Invalid scripts.json in ${PROJECT}: expected an array or an object with a scripts array.`);
    }
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

let SCRIPTS = [];
let scriptVoice = null;
let VOICE = null;
let TOTAL = 0;

function resolveVoice() {
  if (VOICE_ARG) return VOICE_ARG;
  return scriptVoice ?? process.env.EDGE_TTS_VOICE ?? DEFAULT_EDGE_VOICE;
}

function loadRuntimeScripts() {
  const loaded = loadScripts();
  SCRIPTS = loaded.scripts;
  scriptVoice = loaded.voice;
  VOICE = resolveVoice();
  TOTAL = SCRIPTS.length;
}

const pad   = n => String(n).padStart(2, '0');
const AUDIO_EXT = 'mp3';

// ── External tools ────────────────────────────────────────────────────────────

function tryExec(command, cmdArgs) {
  try {
    execFileSync(command, cmdArgs, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function findFirstWorking(candidates, versionArgs = ['--version']) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) || !path.isAbsolute(candidate)) {
      if (tryExec(candidate, versionArgs)) return candidate;
    }
  }
  return null;
}

function findLibreOffice() {
  const candidates = process.platform === 'win32'
    ? [
        'soffice',
        'libreoffice',
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      ]
    : [
        'soffice',
        'libreoffice',
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
      ];
  return findFirstWorking(candidates);
}

function findPdfToPpm() {
  return findFirstWorking(['pdftoppm']);
}

function findFfmpeg() {
  return findFirstWorking(['ffmpeg']);
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function findPowerPointPowerShell() {
  const x86PowerPoint = 'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\POWERPNT.EXE';
  const x86PowerShell = 'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe';
  if (fs.existsSync(x86PowerPoint) && fs.existsSync(x86PowerShell)) return x86PowerShell;
  return 'powershell.exe';
}

// ── Phase 1: PPTX slide capture ───────────────────────────────────────────────

function findProjectPptx() {
  if (PPTX) return PPTX;

  const pptxFiles = fs.readdirSync(PROJECT)
    .filter(f => f.toLowerCase().endsWith('.pptx'))
    .sort();

  if (pptxFiles.length === 0) return null;
  if (pptxFiles.length > 1) {
    throw new Error(
      `Multiple .pptx files found in ${PROJECT}.\n` +
      `Please pass the intended file explicitly, for example: node generate-video.mjs "${path.join(PROJECT, pptxFiles[0])}"`
    );
  }
  return path.join(PROJECT, pptxFiles[0]);
}

function convertPptxToPdf(pptxFile) {
  const soffice = findLibreOffice();
  if (!soffice) {
    throw new Error(
      'LibreOffice was not found. Install LibreOffice and make `soffice` available on PATH, ' +
      'or use the default install location on Windows/macOS.'
    );
  }

  const pdfFile = path.join(TMP, `${path.basename(pptxFile, path.extname(pptxFile))}.pdf`);
  fs.rmSync(pdfFile, { force: true });
  execFileSync(soffice, [
    '--headless',
    '--convert-to', 'pdf',
    '--outdir', TMP,
    pptxFile,
  ], { stdio: 'inherit' });

  if (!fs.existsSync(pdfFile)) {
    throw new Error(`LibreOffice did not create the expected PDF: ${pdfFile}`);
  }

  return pdfFile;
}

function capturePptxWithPowerPoint(pptxFile) {
  if (process.platform !== 'win32') return false;
  const powerShell = findPowerPointPowerShell();
  const textJsonFile = path.join(path.dirname(pptxFile), PPTX_TEXT_JSON);

  const ps = `
$ErrorActionPreference = 'Stop'
$pptx = ${psQuote(pptxFile)}
$outDir = ${psQuote(TMP)}
$textJsonFile = ${psQuote(textJsonFile)}
$width = ${PPTX_IMAGE_WIDTH}
$height = ${PPTX_IMAGE_HEIGHT}
$rowTolerance = ${TEXT_ROW_TOLERANCE_POINTS}
$app = $null
$presentation = $null
function Add-ShapeTextBoxes($shape, $boxes) {
  try {
    if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
      $text = [string]$shape.TextFrame.TextRange.Text
      $trimmed = ($text -replace '[\\r\\n]+', ' ').Trim()
      if ($trimmed.Length -gt 0) {
        $boxes.Add([pscustomobject]@{
          text = $trimmed
          left = [double]$shape.Left
          top = [double]$shape.Top
          width = [double]$shape.Width
          height = [double]$shape.Height
        })
      }
    }
  } catch {}

  try {
    if ($shape.GroupItems -ne $null) {
      foreach ($childShape in $shape.GroupItems) {
        Add-ShapeTextBoxes $childShape $boxes
      }
    }
  } catch {}
}

function Get-SlideTextBoxes($slide) {
  $boxes = New-Object System.Collections.Generic.List[object]
  foreach ($shape in $slide.Shapes) {
    try {
      Add-ShapeTextBoxes $shape $boxes
    } catch {}
  }

  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($box in ($boxes | Sort-Object top, left)) {
    $row = $null
    foreach ($candidate in $rows) {
      if ([Math]::Abs($box.top - $candidate.top) -le $rowTolerance) {
        $row = $candidate
        break
      }
    }

    if ($row -eq $null) {
      $row = [pscustomobject]@{
        top = $box.top
        items = New-Object System.Collections.Generic.List[object]
      }
      $rows.Add($row)
    }

    $row.items.Add($box)
  }

  $ordered = New-Object System.Collections.Generic.List[object]
  foreach ($row in ($rows | Sort-Object top)) {
    foreach ($box in ($row.items | Sort-Object left)) {
      $ordered.Add($box)
    }
  }

  return $ordered
}
try {
  $app = New-Object -ComObject PowerPoint.Application
  $presentation = $app.Presentations.Open($pptx, $true, $false, $false)
  $slideTexts = New-Object System.Collections.Generic.List[object]
  for ($i = 1; $i -le $presentation.Slides.Count; $i++) {
    $slide = $presentation.Slides.Item($i)
    $out = Join-Path $outDir ("slide_{0:D2}.png" -f $i)
    $slide.Export($out, "PNG", $width, $height) | Out-Null
    $slideTexts.Add([pscustomobject]@{
      slideNumber = $i
      image = (Split-Path $out -Leaf)
      texts = @(Get-SlideTextBoxes $slide)
    })
    Write-Host ("  slide {0:D2}/{1} -> {2}" -f $i, $presentation.Slides.Count, (Split-Path $out -Leaf))
  }
  $scripts = @($slideTexts | ForEach-Object { ($_.texts | ForEach-Object { $_.text }) -join ' ' })
  $json = $scripts | ConvertTo-Json -Depth 4
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($textJsonFile, $json, $utf8NoBom)
  Write-Host ("  text -> {0}" -f (Split-Path $textJsonFile -Leaf))
}
catch {
  Write-Error $_
  exit 1
}
finally {
  try { if ($presentation -ne $null) { $presentation.Close() | Out-Null } } catch {}
  try { if ($app -ne $null) { $app.Quit() | Out-Null } } catch {}
  try { if ($presentation -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null } } catch {}
  try { if ($app -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null } } catch {}
}
`;

  try {
    execFileSync(powerShell, [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command', ps,
    ], { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function normalizeImage(inputFile, outputFile, width, height) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    throw new Error('ffmpeg was not found. Install ffmpeg and make it available on PATH.');
  }

  execFileSync(ffmpeg, [
    '-y',
    '-i', inputFile,
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=white`,
    '-frames:v', '1',
    outputFile,
  ], { stdio: 'ignore' });
}

function renderPdfWithPdftoppm(pdfFile) {
  const pdftoppm = findPdfToPpm();
  if (!pdftoppm) return false;

  const prefix = path.join(TMP, 'pptx_page');
  execFileSync(pdftoppm, ['-png', '-r', '144', pdfFile, prefix], { stdio: 'inherit' });

  const rendered = fs.readdirSync(TMP)
    .filter(f => /^pptx_page-\d+\.png$/i.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  for (let i = 0; i < rendered.length; i++) {
    const src = path.join(TMP, rendered[i]);
    const dst = path.join(TMP, `slide_${pad(i + 1)}.png`);
    normalizeImage(src, dst, PPTX_IMAGE_WIDTH, PPTX_IMAGE_HEIGHT);
    fs.rmSync(src, { force: true });
    console.log(`  slide ${pad(i + 1)}/${rendered.length} → ${path.basename(dst)}`);
  }

  return rendered.length > 0;
}

function renderPdfWithFfmpeg(pdfFile) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    throw new Error('ffmpeg was not found. Install ffmpeg and make it available on PATH.');
  }

  const outPattern = path.join(TMP, 'slide_%02d.png');
  execFileSync(ffmpeg, [
    '-y',
    '-i', pdfFile,
    '-vf', `scale=${PPTX_IMAGE_WIDTH}:${PPTX_IMAGE_HEIGHT}:force_original_aspect_ratio=decrease,pad=${PPTX_IMAGE_WIDTH}:${PPTX_IMAGE_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=white`,
    outPattern,
  ], { stdio: 'inherit' });
}

function assertSlideImagesComplete(expectedTotal = TOTAL) {
  if (!expectedTotal) return;

  const missing = [];
  for (let i = 0; i < expectedTotal; i++) {
    const file = path.join(TMP, `slide_${pad(i + 1)}.png`);
    if (!fs.existsSync(file)) missing.push(path.basename(file));
  }

  const extra = fs.readdirSync(TMP)
    .filter(f => /^slide_\d+\.png$/i.test(f))
    .filter(f => {
      const n = Number(f.match(/\d+/)[0]);
      return n > expectedTotal;
    });

  if (missing.length || extra.length) {
    throw new Error(
      `Rendered slide count does not match scripts count (${expectedTotal}).` +
      (missing.length ? ` Missing: ${missing.join(', ')}.` : '') +
      (extra.length ? ` Extra: ${extra.join(', ')}.` : '')
    );
  }
}

function capturePptxSlides(pptxFile) {
  if (!fs.existsSync(pptxFile)) {
    throw new Error(`PPTX file not found: ${pptxFile}`);
  }

  console.log('📸 Phase 1: Capturing slides from PPTX...');
  console.log(`  PPTX → ${pptxFile}`);
  console.log(`  Size → ${PPTX_IMAGE_WIDTH}x${PPTX_IMAGE_HEIGHT}`);
  for (const file of fs.readdirSync(TMP)) {
    if (/^(slide_\d+|pptx_page-\d+)\.png$/i.test(file)) {
      fs.rmSync(path.join(TMP, file), { force: true });
    }
  }

  if (capturePptxWithPowerPoint(pptxFile)) {
    console.log('  Done.\n');
    return;
  }

  if (process.platform === 'win32') {
    console.log('  PowerPoint export failed or is unavailable; trying LibreOffice PDF pipeline...');
  }

  const pdfFile = convertPptxToPdf(pptxFile);

  if (!renderPdfWithPdftoppm(pdfFile)) {
    console.log('  pdftoppm not found; trying ffmpeg PDF renderer...');
    renderPdfWithFfmpeg(pdfFile);
  }

  assertSlideImagesComplete();
  console.log('  Done.\n');
}

async function captureSlides() {
  const pptxFile = findProjectPptx();
  if (pptxFile) {
    PPTX = pptxFile;
    capturePptxSlides(pptxFile);
    return;
  }

  throw new Error(
    `No .pptx file found in ${PROJECT}.\n` +
    `Place a single .pptx in the project dir, or provide a .pptx file explicitly.`
  );
}

// ── Phase 2: TTS Audio ───────────────────────────────────────────────────────

async function ttsEdge(text) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  const chunks = [];
  try {
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
  } finally {
    tts.close();
  }
  if (chunks.length === 0) throw new Error('msedge-tts: no audio received');
  return Buffer.concat(chunks);
}

async function generateAudio() {
  console.log('🔊 Phase 2: Generating TTS audio via Edge TTS...');
  for (let i = 0; i < TOTAL; i++) {
    const file = path.join(TMP, `slide_${pad(i + 1)}.${AUDIO_EXT}`);
    const buf  = await ttsEdge(SCRIPTS[i]);
    fs.writeFileSync(file, buf);
    console.log(`  audio ${pad(i + 1)}/${TOTAL} → ${path.basename(file)}`);
  }
  console.log('  Done.\n');
}

// ── Phase 3+4: Build + concat via filter_complex (frame-perfect A/V sync) ─────
//
// Each slide's video duration is set to its audio duration. A single ffmpeg pass
// feeds all images and audio files through the concat filter, avoiding per-clip
// AAC concatenation gaps.

function audioPath(i) {
  return path.join(TMP, `slide_${pad(i + 1)}.${AUDIO_EXT}`);
}

function audioDuration(file) {
  return Number(execSync(
    `ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "${file}"`,
    { encoding: 'utf8' }
  ).trim());
}

function buildAndConcat() {
  console.log('🎬 Phase 3+4: Building video via filter_complex concat...');

  const durations = Array.from({ length: TOTAL }, (_, i) => {
    return audioDuration(audioPath(i));
  });

  // Build input args: pairs of (image, audio) for each slide
  const inputs = durations.flatMap((dur, i) => [
    `-loop 1 -t ${dur.toFixed(6)} -r 25 -i "${path.join(TMP, `slide_${pad(i + 1)}.png`)}"`,
    `-i "${audioPath(i)}"`,
  ]);

  // Normalize sample aspect ratio before concat; PowerPoint PNG exports can carry
  // non-1:1 SAR metadata even when pixel dimensions match.
  const videoFilters = Array.from({ length: TOTAL }, (_, i) => `[${i * 2}:v]setsar=1[v${i}]`).join(';');
  const refs = Array.from({ length: TOTAL }, (_, i) => `[v${i}][${i * 2 + 1}:a]`).join('');
  const filter = `${videoFilters};${refs}concat=n=${TOTAL}:v=1:a=1[outv][outa]`;

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
  console.log(`Project : ${PROJECT}`);
  if (PPTX) console.log(`PPTX    : ${PPTX}`);
  console.log('');

  // Wipe tmp only on a full run; preserve it when skipping phases
  if (!SKIP_SCREENSHOTS && !SKIP_AUDIO) {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  fs.mkdirSync(TMP, { recursive: true });

  if (!SKIP_SCREENSHOTS) await captureSlides();
  if (SCREENSHOTS_ONLY) {
    console.log(`✅ Screenshots saved to ${TMP}`);
    if (PPTX && process.platform === 'win32') {
      console.log(`✅ Scripts saved to ${path.join(path.dirname(PPTX), PPTX_TEXT_JSON)}`);
    }
    return;
  }

  loadRuntimeScripts();
  assertSlideImagesComplete();
  console.log(`Slides  : ${TOTAL}`);
  console.log('Engine  : edge_tts');
  console.log(`Voice   : ${VOICE}\n`);

  if (!SKIP_AUDIO) await generateAudio();
  buildAndConcat();

  console.log(`✅ Video ready: ${OUTPUT}`);
  console.log(`   Run: open "${OUTPUT}"`);
}

main().catch(err => { console.error(err); process.exit(1); });
