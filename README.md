# PPT Video Generator

Converts an HTML slide deck (or pre-rendered PNG images) into a single MP4 video with AI-narrated voiceover using 豆包 TTS.

## Prerequisites

```bash
brew install ffmpeg
npm install                          # inside ppt/
npx playwright install chromium      # only needed if using Playwright capture
```

Set credentials in `ppt/.env`:

```
DOUBAO_APP_ID=your_app_id
DOUBAO_ACCESS_TOKEN=your_access_token
DOUBAO_VOICE=zh_male_shaonianzixin_moon_bigtts   # optional default voice
```

Credentials are from the [Volcengine console](https://console.volcengine.com/) → 语音技术 → 语音合成 (BigTTS).

## Usage

```bash
node generate-video.mjs <project-dir> [options]
```

Run from the `ppt/` directory:

```bash
cd ppt
node generate-video.mjs lingti-ai-platform
```

### Options

| Flag | Description |
|---|---|
| `--voice <voice_type>` | Override the TTS voice for this run |
| `--skip-screenshots` | Skip Phase 1 — reuse existing `tmp/slide_NN.png` |
| `--skip-audio` | Skip Phase 2 — reuse existing `tmp/slide_NN.pcm` |

## Project Directory Structure

Each project lives in its own subdirectory under `ppt/`:

```
ppt/
  generate-video.mjs      ← the script
  package.json
  .env                    ← DOUBAO credentials (git-ignored)
  my-project/
    scripts.json          ← narration scripts (required)
    index.html            ← slide deck (optional, for Playwright capture)
    slide_01.png          ← pre-rendered images (optional, skip Playwright)
    slide_02.png
    ...
```

### scripts.json

**Simple array:**
```json
["Slide 1 narration.", "Slide 2 narration.", "..."]
```

**With voice override:**
```json
{
  "voice": "zh_male_shaonianzixin_moon_bigtts",
  "scripts": [
    "Slide 1 narration.",
    "Slide 2 narration."
  ]
}
```

**Alternatively**, use `scripts.txt` — one line per slide, blank lines ignored.

## Slide Images

The script resolves slide images in this order:

1. **Pre-rendered PNGs** — if `slide_01.png … slide_NN.png` all exist in the project dir, they are used directly (no Playwright needed).
2. **Playwright capture** — if any PNG is missing and `index.html` is present, the script launches a headless Chromium browser, navigates to the HTML file, and calls `window.goTo(i)` to advance slides. Viewport: `390 × 844`.

For Playwright capture, add this helper to your `index.html` script:

```js
window.goTo = function(i) {
  slides.forEach((s, j) => s.classList.toggle('active', j === i));
  cur = i;
  updateDots();
};
```

## Output

`<project-dir>/output.mp4` — a single MP4 with per-slide still images and continuous AAC audio (no gaps between slides).

## Pipeline

| Phase | Description |
|---|---|
| 1 | Capture or copy slide PNGs → `tmp/slide_NN.png` |
| 2 | Generate TTS audio via 豆包 V3 API → `tmp/slide_NN.pcm` (24 kHz PCM) |
| 3 | Encode per-slide MP4 clips (libx264 + AAC) → `tmp/clip_NN.mp4` |
| 4 | Concatenate video streams (copy) + binary-concat PCM audio → final mux → `output.mp4` |

The gapless audio technique (Phase 4) extracts audio from each clip as raw PCM at 44.1 kHz, binary-concatenates them, then encodes AAC once in the final mux — avoiding the ~23 ms encoder-delay gap that would appear if AAC streams were naively concatenated.

## Voice Reference

Common 豆包 voices (Model 1.0, `seed-tts-1.0`):

| Voice ID | Description |
|---|---|
| `zh_male_shaonianzixin_moon_bigtts` | 少年自信男声 |
| `zh_female_qingxin_moon_bigtts` | 清新女声 |
| `zh_male_jingqiang_moon_bigtts` | 精干男声 |

Model 2.0 voices contain `_saturn_` or `_uranus_` and use `seed-tts-2.0`.

## Resuming a Failed Run

If the run fails partway through, use skip flags to resume from where it left off:

```bash
# Re-run only Phase 3+4 (screenshots and audio already in tmp/)
node generate-video.mjs my-project --skip-screenshots --skip-audio

# Re-run Phase 2+3+4 (screenshots already in tmp/)
node generate-video.mjs my-project --skip-screenshots
```
