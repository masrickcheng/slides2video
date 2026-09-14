# PPT Video Generator

Converts a PowerPoint `.pptx` into a single MP4 video with Edge TTS narration.

## Prerequisites

```bash
brew install ffmpeg
npm install
```

For PPTX input on Windows, installed Microsoft PowerPoint is used first. If PowerPoint is unavailable, or on macOS, install LibreOffice. Poppler is recommended for higher-quality PDF rendering in the LibreOffice fallback path; if `pdftoppm` is unavailable, the script tries ffmpeg as a fallback.

macOS:

```bash
brew install --cask libreoffice
brew install poppler
```

Windows:

- Install Microsoft PowerPoint, or install LibreOffice from https://www.libreoffice.org/
- Install ffmpeg and make `ffmpeg` available on PATH
- Optional but recommended for LibreOffice fallback: install Poppler and make `pdftoppm` available on PATH

## TTS

The script uses Edge TTS with voice `zh-CN-XiaoxiaoNeural` by default, so no API key is required.

Voice and LLM settings live in the repo-level `.env` file. Start from `.env.example`:

```
EDGE_TTS_VOICE=zh-CN-XiaoxiaoNeural

OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com
OPENAI_MODEL=gpt-5.5
OPENAI_FALLBACK_MODEL=gpt-5.4
OPENAI_RETRIES=3
OPENAI_TIMEOUT_SECONDS=300
OPENAI_MAX_OUTPUT_TOKENS=8192
```

When PowerPoint text extraction is available, the raw extracted narration is written to both `<project-dir>/tmp/raw_scripts.json` and `<project-dir>/scripts.json`. Before calling Edge TTS, the script preprocesses that raw text with an OpenAI-compatible Responses API using the prompt in `tts_text_preprocessing_prompt.md`, then writes the final TTS-ready narration back to `<project-dir>/scripts.json`. If `OPENAI_API_KEY` is not configured, or `--no-llm` is used, preprocessing is skipped and the raw `scripts.json` remains usable for TTS.

`scripts.json` is the final file used for TTS.

## Usage

```bash
node generate-video.mjs <project-dir|deck.pptx> [options]
```

Examples:

```bash
node generate-video.mjs ppt/my-project
node generate-video.mjs ppt/my-project/deck.pptx
node generate-video.mjs ppt/my-project --voice zh-CN-YunxiNeural
node generate-video.mjs --list-voices
node generate-video.mjs --list-voices zh-CN
```

### Options

| Flag | Description |
|---|---|
| `--voice <voice_name>` | Override the TTS voice for this run |
| `--skip-screenshots` | Skip Phase 1 — reuse existing `tmp/slide_NN.png` |
| `--skip-audio` | Skip Phase 3 — reuse existing `tmp/slide_NN.mp3` |
| `--skip-tts-preprocess` | Skip Phase 2 — the LLM preprocessing step before Edge TTS |
| `--no-llm` | Alias for `--skip-tts-preprocess` |
| `--list-voices [keyword]` | Print the bundled Edge TTS voice list and exit |

## Project Directory Structure

```
<repo>/
  generate-video.mjs      ← the script
  package.json
  .env.example            ← environment template
  .env                    ← local voice and LLM settings (git-ignored)
  ppt/
    my-project/
      scripts.json        ← narration scripts (required)
      deck.pptx           ← slide deck (required)
      tmp/                ← intermediate files, including raw_scripts.json (auto-created, git-ignored)
      output.mp4          ← final output (git-ignored)
```

### scripts.json

**Simple array:**
```json
["Slide 1 narration.", "Slide 2 narration.", "..."]
```

**With per-project voice override:**
```json
{
  "voice": "zh-CN-XiaoxiaoNeural",
  "scripts": [
    "Slide 1 narration.",
    "Slide 2 narration."
  ]
}
```

Alternatively use `scripts.txt` — one line per slide, blank lines ignored.

When generated from PowerPoint text extraction, `tmp/raw_scripts.json` is the direct extracted draft, and `scripts.json` initially receives the same content. After optional LLM preprocessing, `scripts.json` is overwritten with the final TTS-ready text. Each array item is a single-line string with no carriage returns or line feeds; the JSON file itself still uses normal pretty-printed formatting.

## PPTX Slide Capture

The script looks for a single `.pptx` in the project directory. On Windows it exports PNGs directly with Microsoft PowerPoint first; otherwise it converts the PPTX to PDF with LibreOffice, then renders each page to `tmp/slide_NN.png`. If multiple `.pptx` files exist, pass the intended file explicitly.

You can also pass a PPTX file directly:

```bash
node generate-video.mjs ppt/my-project/deck.pptx
```

PPTX slide count must match the number of scripts. PPTX input is rendered as landscape `1920 × 1080` images by default.

When the Windows PowerPoint export path is used, the script also writes `tmp/raw_scripts.json` and an initial `scripts.json`. They contain one narration string per slide, assembled from text-bearing shapes read through PowerPoint Shape objects. Text entries are ordered visually top-to-bottom, then left-to-right within rows whose `top` values differ by no more than 15 points. Any carriage returns or line feeds inside extracted text are replaced with spaces before writing.

## Output

`<project-dir>/output.mp4` — a single MP4 with per-slide still images and continuous AAC audio (no gaps between slides).

## Pipeline

| Phase | Description |
|---|---|
| 1 | Capture PPTX slides → `tmp/slide_NN.png`; with PowerPoint, also extract slide text → `tmp/raw_scripts.json` and initial `scripts.json` |
| 2 | Preprocess `tmp/raw_scripts.json` with `tts_text_preprocessing_prompt.md` when `OPENAI_API_KEY` is configured, then write final narration to `scripts.json` |
| 3 | Generate TTS audio from final narration → Edge TTS writes `tmp/slide_NN.mp3` |
| 4 | Build one ffmpeg concat graph from all slide images and audio files → `output.mp4` |

The gapless audio technique (Phase 4) extracts audio from each clip as raw PCM at 44.1 kHz, binary-concatenates them, then encodes AAC once in the final mux — avoiding the ~23 ms encoder-delay gap that would appear if AAC streams were naively concatenated.

## Resuming a Failed Run

```bash
# Re-run only Phase 4 (screenshots and audio already in tmp/)
node generate-video.mjs my-project --skip-screenshots --skip-audio

# Re-run Phase 2+3+4 (screenshots already in tmp/)
node generate-video.mjs my-project --skip-screenshots
```

## Voice Reference

Default voice: `zh-CN-XiaoxiaoNeural`

Bundled Edge TTS voices:

| Name | Label | Gender | Description |
|---|---|---|---|
| `zh-CN-XiaoxiaoNeural` | 晓晓 | 女 | 默认声音 |
| `zh-CN-YunxiNeural` | 云希 | 男 | 成熟男声，新闻播报 |
| `zh-CN-XiaoyiNeural` | 晓伊 | 女 |  |
| `zh-CN-YunjianNeural` | 云健 | 男 |  |

Run `node generate-video.mjs --list-voices [keyword]` to filter the list.
