# PPT Video Generator

Converts an HTML slide deck (or pre-rendered PNG images) into a single MP4 video with AI-narrated voiceover using 豆包 TTS.

## Prerequisites

```bash
brew install ffmpeg
npm install
npx playwright install chromium      # only needed if using Playwright capture
```

## Getting a 豆包 API Key

1. Log in to [火山方舟控制台](https://console.volcengine.com/ark)
2. 体验中心 → 语音模型 → **开通语音模型** (Doubao-语音合成)
3. 进入 **API Key 管理** → 新建 API Key，复制 `Access Token`
4. 进入 **应用管理** → 创建应用，复制 `App ID`

直达链接：https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?tab=TTS

Set credentials in `.env` (at repo root):

```
DOUBAO_APP_ID=your_app_id
DOUBAO_ACCESS_TOKEN=your_access_token
DOUBAO_VOICE=zh_male_shaonianzixin_moon_bigtts   # optional, this is the default
```

## Usage

```bash
node generate-video.mjs <project-dir> [options]
```

Examples:

```bash
node generate-video.mjs ppt/my-project
node generate-video.mjs ppt/my-project --voice zh_male_yuanboxiaoshu_moon_bigtts
node generate-video.mjs --list-voices
node generate-video.mjs --list-voices 男
```

### Options

| Flag | Description |
|---|---|
| `--voice <voice_type>` | Override the TTS voice for this run |
| `--skip-screenshots` | Skip Phase 1 — reuse existing `tmp/slide_NN.png` |
| `--skip-audio` | Skip Phase 2 — reuse existing `tmp/slide_NN.pcm` |
| `--list-voices [keyword]` | Print full voice catalog and exit; keyword filters by ID/name/lang/scene |

## Project Directory Structure

```
<repo>/
  generate-video.mjs      ← the script
  package.json
  .env                    ← DOUBAO credentials (git-ignored)
  ppt/
    my-project/
      scripts.json        ← narration scripts (required)
      index.html          ← slide deck (optional, for Playwright capture)
      slide_01.png        ← pre-rendered images (optional, skips Playwright)
      slide_02.png
      tmp/                ← intermediate files (auto-created, git-ignored)
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
  "voice": "zh_male_jieshuonansheng_mars_bigtts",
  "scripts": [
    "Slide 1 narration.",
    "Slide 2 narration."
  ]
}
```

Alternatively use `scripts.txt` — one line per slide, blank lines ignored.

## Slide Images

Images are resolved in this order:

1. **Pre-rendered PNGs** — if `slide_01.png … slide_NN.png` all exist in the project dir, they are used directly (no Playwright needed).
2. **Playwright capture** — if any PNG is missing and `index.html` is present, the script launches headless Chromium, navigates to the file, and calls `window.goTo(i)` to advance slides. Viewport: `390 × 844`.

For Playwright capture, add this helper to your `index.html`:

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

## Resuming a Failed Run

```bash
# Re-run only Phase 3+4 (screenshots and audio already in tmp/)
node generate-video.mjs my-project --skip-screenshots --skip-audio

# Re-run Phase 2+3+4 (screenshots already in tmp/)
node generate-video.mjs my-project --skip-screenshots
```

## Voice Reference

Default: `zh_male_shaonianzixin_moon_bigtts` (少年梓辛/Brayan)

Run `node generate-video.mjs --list-voices` for the full catalog. Highlights:

| Voice ID | 名称 | 场景 | 版本 |
|---|---|---|---|
| `zh_male_shaonianzixin_moon_bigtts` | 少年梓辛/Brayan ⭐ **default** | 通用 | 1.0 |
| `zh_male_yuanboxiaoshu_moon_bigtts` | 渊博小叔 | 通用/知识讲解 | 1.0 |
| `zh_male_jieshuonansheng_mars_bigtts` | 磁性解说男声 ⭐ | 视频配音 | 1.0 |
| `zh_male_jieshuoxiaoming_moon_bigtts` | 解说小明 | 通用 | 1.0 |
| `zh_female_shuangkuaisisi_moon_bigtts` | 爽快思思/Skye | 通用 | 1.0 |
| `zh_female_linjianvhai_moon_bigtts` | 邻家女孩 | 通用 | 1.0 |
| `zh_male_shaonianzixin_uranus_bigtts` | 少年梓辛 2.0 | 通用 | 2.0 |
| `zh_female_vv_uranus_bigtts` | Vivi 2.0 | 通用/多语种+方言 | 2.0 |
| `zh_male_cantonese_mars_bigtts` | 粤语男声 | 口音 | 1.0 |
| `zh_male_sichuanv2_mars_bigtts` | 四川话男声 | 口音 | 1.0 |
| `en_male_adam_mars_bigtts` | Adam | 英语 | 1.0 |
| `en_male_tim_uranus_bigtts` | Tim | 英语 2.0 | 2.0 |

Full catalog source: https://www.volcengine.com/docs/6561/1257544
