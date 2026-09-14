# PPT Video Generator

Converts a PowerPoint `.pptx` into a single MP4 video with AI-narrated voiceover. Edge TTS is the default engine; 豆包 TTS is also supported.

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

## TTS Engines

By default, the script uses Edge TTS with voice `zh-CN-XiaoxiaoNeural`, so no API key is required.

Engine settings live in `.env`:

```
TTS_ENGINE=edge_tts
EDGE_TTS_VOICE=zh-CN-XiaoxiaoNeural
```

When `TTS_ENGINE=edge_tts`, legacy 豆包 voice IDs in `scripts.json` are ignored and `EDGE_TTS_VOICE` is used instead.

To use 豆包 instead, set credentials in `.env` (at repo root):

1. Log in to [火山方舟控制台](https://console.volcengine.com/ark)
2. 体验中心 → 语音模型 → **开通语音模型** (Doubao-语音合成)
3. 进入 **API Key 管理** → 新建 API Key，复制 `Access Token`
4. 进入 **应用管理** → 创建应用，复制 `App ID`

直达链接：https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?tab=TTS

```
TTS_ENGINE=doubao
DOUBAO_APP_ID=your_app_id
DOUBAO_ACCESS_TOKEN=your_access_token
DOUBAO_VOICE=zh_male_shaonianzixin_moon_bigtts   # optional, this is the default
```

## Usage

```bash
node generate-video.mjs <project-dir|deck.pptx> [options]
```

Examples:

```bash
node generate-video.mjs ppt/my-project
node generate-video.mjs ppt/my-project/deck.pptx
node generate-video.mjs ppt/my-project --voice zh_male_yuanboxiaoshu_moon_bigtts
node generate-video.mjs --list-voices
node generate-video.mjs --list-voices 男
```

### Options

| Flag | Description |
|---|---|
| `--voice <voice_name>` | Override the TTS voice for this run |
| `--skip-screenshots` | Skip Phase 1 — reuse existing `tmp/slide_NN.png` |
| `--skip-audio` | Skip Phase 2 — reuse existing `tmp/slide_NN.mp3` or `tmp/slide_NN.pcm` |
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
      deck.pptx           ← slide deck (required)
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
  "voice": "zh-CN-XiaoxiaoNeural",
  "scripts": [
    "Slide 1 narration.",
    "Slide 2 narration."
  ]
}
```

Alternatively use `scripts.txt` — one line per slide, blank lines ignored.

## PPTX Slide Capture

The script looks for a single `.pptx` in the project directory. On Windows it exports PNGs directly with Microsoft PowerPoint first; otherwise it converts the PPTX to PDF with LibreOffice, then renders each page to `tmp/slide_NN.png`. If multiple `.pptx` files exist, pass the intended file explicitly.

You can also pass a PPTX file directly:

```bash
node generate-video.mjs ppt/my-project/deck.pptx
```

PPTX slide count must match the number of scripts. PPTX input is rendered as landscape `1920 × 1080` images by default.

## Output

`<project-dir>/output.mp4` — a single MP4 with per-slide still images and continuous AAC audio (no gaps between slides).

## Pipeline

| Phase | Description |
|---|---|
| 1 | Capture PPTX slides → `tmp/slide_NN.png` |
| 2 | Generate TTS audio → Edge TTS writes `tmp/slide_NN.mp3`; 豆包 writes `tmp/slide_NN.pcm` |
| 3+4 | Build one ffmpeg concat graph from all slide images and audio files → `output.mp4` |

The gapless audio technique (Phase 4) extracts audio from each clip as raw PCM at 44.1 kHz, binary-concatenates them, then encodes AAC once in the final mux — avoiding the ~23 ms encoder-delay gap that would appear if AAC streams were naively concatenated.

## Resuming a Failed Run

```bash
# Re-run only Phase 3+4 (screenshots and audio already in tmp/)
node generate-video.mjs my-project --skip-screenshots --skip-audio

# Re-run Phase 2+3+4 (screenshots already in tmp/)
node generate-video.mjs my-project --skip-screenshots
```

## Voice Reference

Default engine: `edge_tts`

Default voice: `zh-CN-XiaoxiaoNeural` (Edge TTS)

Default 豆包 voice: `zh_male_shaonianzixin_moon_bigtts` (少年梓辛/Brayan)

Run `node generate-video.mjs --list-voices [keyword]` to filter. Full catalog:

### 1.0 通用声音 (moon_bigtts)

| Voice ID | 名称 | 语言 | 说明 |
|---|---|---|---|
| `zh_male_shaonianzixin_moon_bigtts` | 少年梓辛/Brayan ⭐ **default** | 中/美式英语 | 默认推荐，豆包/Cici/剪映 |
| `zh_male_yuanboxiaoshu_moon_bigtts` | 渊博小叔 | 中文 | 知识讲解首选，豆包/Cici/剪映 |
| `zh_male_yangguangqingnian_moon_bigtts` | 阳光青年 | 中文 | 豆包/Cici/StoryAi |
| `zh_male_jieshuoxiaoming_moon_bigtts` | 解说小明 | 中文 | 解说风格 |
| `zh_male_linjiananhai_moon_bigtts` | 邻家男孩 | 中文 | 豆包 |
| `zh_female_linjianvhai_moon_bigtts` | 邻家女孩 | 中文 | 豆包/Cici |
| `zh_female_shuangkuaisisi_moon_bigtts` | 爽快思思/Skye | 中/美式英语 | 豆包/Cici/web demo |
| `zh_female_tianmeixiaoyuan_moon_bigtts` | 甜美小源 | 中文 | 豆包 |
| `zh_female_qingchezizi_moon_bigtts` | 清澈梓梓 | 中文 | 豆包 |
| `zh_female_kailangjiejie_moon_bigtts` | 开朗姐姐 | 中文 | 豆包 |
| `zh_female_tianmeiyueyue_moon_bigtts` | 甜美悦悦 | 中文 | 豆包 |
| `zh_female_xinlingjitang_moon_bigtts` | 心灵鸡汤 | 中文 | 豆包 |
| `zh_female_qinqienvsheng_moon_bigtts` | 亲切女声 | 中文 | 豆包 |

Full catalog source: https://www.volcengine.com/docs/6561/1257544
