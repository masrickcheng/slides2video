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
 *   --skip-tts-preprocess    Skip LLM text preprocessing before TTS
 *   --no-llm                 Alias for --skip-tts-preprocess
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
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const DEFAULT_OPENAI_MODEL = 'gpt-5.5';

// ── Config ────────────────────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [rawKey, ...rawValueParts] = line.split('=');
    const key = rawKey.trim();
    const value = rawValueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) values[key] = value;
  }
  return values;
}

// Auto-load repo-level .env. Secrets stay in .env; .env.example documents keys.
const envPath = path.join(__dirname, '.env');
for (const [key, value] of Object.entries(parseEnvFile(envPath))) {
  process.env[key] ??= value;
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
  console.error('Usage: node generate-video.mjs <project-dir|deck.pptx> [--voice <voice>] [--screenshots-only] [--skip-screenshots] [--skip-images] [--skip-audio] [--skip-tts-preprocess] [--no-llm] [--concat-only]');
  console.error('       node generate-video.mjs --list-voices [keyword]');
  process.exit(1);
}

const SCREENSHOTS_ONLY = args.includes('--screenshots-only');
const SKIP_SCREENSHOTS = args.includes('--skip-screenshots') || args.includes('--skip-images') || args.includes('--concat-only');
const SKIP_AUDIO       = args.includes('--skip-audio')       || args.includes('--concat-only') || SCREENSHOTS_ONLY;
const SKIP_TTS_PREPROCESS = args.includes('--skip-tts-preprocess') || args.includes('--no-llm') || SKIP_AUDIO;
const VOICE_ARG = getOptionValue('--voice');
const PPTX_IMAGE_WIDTH = 1920;
const PPTX_IMAGE_HEIGHT = 1080;
const PPTX_TEXT_JSON = 'scripts.json';
const RAW_PPTX_TEXT_JSON = 'raw_scripts.json';
const TTS_PREPROCESS_PROMPT = 'tts_text_preprocessing_prompt.md';
const TEXT_ROW_TOLERANCE_POINTS = 15;
let USE_RAW_SCRIPTS_FOR_THIS_RUN = false;

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
  const rawJsonFile = path.join(TMP, RAW_PPTX_TEXT_JSON);
  const txtFile  = path.join(PROJECT, 'scripts.txt');

  if (USE_RAW_SCRIPTS_FOR_THIS_RUN && fs.existsSync(rawJsonFile)) {
    const data = JSON.parse(fs.readFileSync(rawJsonFile, 'utf8'));
    if (!Array.isArray(data)) {
      throw new Error(`Invalid ${RAW_PPTX_TEXT_JSON} in ${TMP}: expected an array.`);
    }
    return { scripts: data, voice: null, source: 'raw' };
  }

  if (fs.existsSync(jsonFile)) {
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    if (Array.isArray(data)) return { scripts: data, voice: null, source: 'final' };
    // { voice?, scripts: [] }
    if (!Array.isArray(data.scripts)) {
      throw new Error(`Invalid scripts.json in ${PROJECT}: expected an array or an object with a scripts array.`);
    }
    return { scripts: data.scripts, voice: data.voice ?? null, source: 'final' };
  }
  if (fs.existsSync(txtFile)) {
    const scripts = fs.readFileSync(txtFile, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    return { scripts, voice: null, source: 'txt' };
  }
  if (fs.existsSync(rawJsonFile)) {
    const data = JSON.parse(fs.readFileSync(rawJsonFile, 'utf8'));
    if (!Array.isArray(data)) {
      throw new Error(`Invalid ${RAW_PPTX_TEXT_JSON} in ${TMP}: expected an array.`);
    }
    return { scripts: data, voice: null, source: 'raw' };
  }
  throw new Error(`No scripts.json or scripts.txt found in ${PROJECT}, and no ${RAW_PPTX_TEXT_JSON} found in ${TMP}`);
}

let SCRIPTS = [];
let scriptVoice = null;
let scriptSource = null;
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
  scriptSource = loaded.source;
  VOICE = resolveVoice();
  TOTAL = SCRIPTS.length;
}

const pad   = n => String(n).padStart(2, '0');
const AUDIO_EXT = 'mp3';

// ── OpenAI-compatible LLM helpers ────────────────────────────────────────────

function isRealSecret(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  const upper = text.toUpperCase();
  return !upper.startsWith('YOUR_') && !['TODO', 'TBD', 'CHANGE_ME', 'CHANGEME', 'PLACEHOLDER'].includes(upper);
}

function openaiModelCandidates(model, fallbackModel = '') {
  const candidates = [];
  for (const value of [model, fallbackModel]) {
    const text = String(value ?? '').trim();
    if (text && !candidates.includes(text)) candidates.push(text);
  }
  return candidates;
}

function extractOpenaiText(body) {
  if (typeof body.output_text === 'string') return body.output_text.trim();

  const chunks = [];
  if (Array.isArray(body.output)) {
    for (const item of body.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const content of item.content) {
        if (typeof content?.text === 'string') chunks.push(content.text);
      }
    }
  }
  if (chunks.length) return chunks.join('\n').trim();

  if (Array.isArray(body.choices)) {
    for (const choice of body.choices) {
      const content = choice?.message?.content;
      if (typeof content === 'string') chunks.push(content);
      else if (typeof choice?.text === 'string') chunks.push(choice.text);
    }
  }
  return chunks.join('\n').trim();
}

function isTransientOpenaiStatus(status) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function retryDelay(attempt) {
  return Math.min(30, 2 ** attempt) + Math.random();
}

async function openaiResponseJson(endpoint, payload, apiKey, retries, timeoutSeconds) {
  let lastError = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${text.slice(0, 500)}`;
        if (attempt >= retries || !isTransientOpenaiStatus(response.status)) {
          const error = new Error(lastError);
          error.retryable = false;
          throw error;
        }
      } else {
        return JSON.parse(text);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (err?.retryable === false) throw err;
      if (attempt >= retries) throw new Error(lastError, { cause: err });
    } finally {
      clearTimeout(timeout);
    }

    const delay = retryDelay(attempt);
    console.log(`  OpenAI attempt ${attempt + 1} failed, retrying in ${delay.toFixed(1)}s: ${lastError.slice(0, 240)}`);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));
  }
  throw new Error(lastError || 'OpenAI request failed');
}

function stripMarkdownFence(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function parsePreprocessedScripts(text) {
  const body = JSON.parse(stripMarkdownFence(text));
  const scripts = Array.isArray(body) ? body : body?.scripts;
  if (!Array.isArray(scripts)) {
    throw new Error('LLM response must be a JSON array or an object with a scripts array.');
  }
  return scripts.map((script, index) => {
    if (typeof script !== 'string') {
      throw new Error(`LLM response script ${index + 1} is not a string.`);
    }
    return script.trim();
  });
}

async function preprocessScriptsForTts() {
  if (SKIP_TTS_PREPROCESS) {
    writeFinalScriptsJson();
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!isRealSecret(apiKey)) {
    console.log('TTS prep: skipped (OPENAI_API_KEY is not configured).\n');
    writeFinalScriptsJson();
    return;
  }

  const promptFile = path.join(__dirname, TTS_PREPROCESS_PROMPT);
  if (!fs.existsSync(promptFile)) {
    throw new Error(`TTS preprocessing prompt not found: ${promptFile}`);
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '');
  const endpoint = baseUrl.endsWith('/v1') ? `${baseUrl}/responses` : `${baseUrl}/v1/responses`;
  const models = openaiModelCandidates(
    process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    process.env.OPENAI_FALLBACK_MODEL || ''
  );
  const retries = Number(process.env.OPENAI_RETRIES || 3);
  const timeoutSeconds = Number(process.env.OPENAI_TIMEOUT_SECONDS || 300);
  const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 8192);
  const prompt = fs.readFileSync(promptFile, 'utf8');

  const requestBody = {
    instructions: prompt,
    hard_requirements: [
      `必须输出 ${TOTAL} 条脚本，顺序与输入 scripts 数组完全一致。`,
      '只输出 JSON，不要输出 Markdown、解释或额外文字。',
      '输出可以是 JSON 字符串数组，或 {"scripts": [...]}。',
    ],
    scripts: SCRIPTS,
  };

  console.log('📝 TTS prep: preprocessing scripts with LLM...');
  for (let index = 0; index < models.length; index++) {
    const currentModel = models[index];
    console.log(`  model → ${currentModel}`);
    const payload = {
      model: currentModel,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify(requestBody, null, 2) }],
        },
      ],
      max_output_tokens: maxOutputTokens,
    };

    try {
      const body = await openaiResponseJson(endpoint, payload, apiKey, retries, timeoutSeconds);
      const preprocessed = parsePreprocessedScripts(extractOpenaiText(body));
      if (preprocessed.length !== TOTAL) {
        throw new Error(`LLM returned ${preprocessed.length} scripts, expected ${TOTAL}.`);
      }
      SCRIPTS = preprocessed;
      writeFinalScriptsJson();
      console.log(`  text → ${PPTX_TEXT_JSON}`);
      console.log('  Done.\n');
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (index + 1 < models.length) {
        console.log(`  model ${currentModel} failed, trying fallback ${models[index + 1]}: ${message}`);
      } else {
        throw new Error(`TTS preprocessing failed for model ${currentModel}: ${message}`, { cause: err });
      }
    }
  }
}

function writeFinalScriptsJson() {
  if (scriptSource === 'final') return;
  fs.writeFileSync(path.join(PROJECT, PPTX_TEXT_JSON), JSON.stringify(SCRIPTS, null, 2), 'utf8');
  scriptSource = 'final';
}

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
  const textJsonFile = path.join(TMP, RAW_PPTX_TEXT_JSON);
  const finalTextJsonFile = path.join(path.dirname(pptxFile), PPTX_TEXT_JSON);

  const ps = `
$ErrorActionPreference = 'Stop'
$pptx = ${psQuote(pptxFile)}
$outDir = ${psQuote(TMP)}
$textJsonFile = ${psQuote(textJsonFile)}
$finalTextJsonFile = ${psQuote(finalTextJsonFile)}
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
  [System.IO.File]::WriteAllText($finalTextJsonFile, $json, $utf8NoBom)
  Write-Host ("  text -> {0}" -f (Split-Path $textJsonFile -Leaf))
  Write-Host ("  text -> {0}" -f (Split-Path $finalTextJsonFile -Leaf))
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
    USE_RAW_SCRIPTS_FOR_THIS_RUN = true;
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
      console.log(`✅ Raw scripts saved to ${path.join(TMP, RAW_PPTX_TEXT_JSON)}`);
      console.log(`✅ Scripts saved to ${path.join(path.dirname(PPTX), PPTX_TEXT_JSON)}`);
    }
    return;
  }

  loadRuntimeScripts();
  assertSlideImagesComplete();
  console.log(`Slides  : ${TOTAL}`);
  console.log('Engine  : edge_tts');
  console.log(`Voice   : ${VOICE}\n`);

  await preprocessScriptsForTts();
  if (!SKIP_AUDIO) await generateAudio();
  buildAndConcat();

  console.log(`✅ Video ready: ${OUTPUT}`);
  console.log(`   Run: open "${OUTPUT}"`);
}

main().catch(err => { console.error(err); process.exit(1); });
