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

Run `node generate-video.mjs --list-voices [keyword]` to filter. Full catalog:

### 2.0 通用声音 (uranus_bigtts)

| Voice ID | 名称 | 语言 | 说明 |
|---|---|---|---|
| `zh_female_vv_uranus_bigtts` | Vivi 2.0 | 中/日/印尼/西语+四川/陕西/东北 | 情感变化、指令遵循、ASMR，多语种+方言 |
| `zh_female_xiaohe_uranus_bigtts` | 小何 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_male_m191_uranus_bigtts` | 云舟 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_male_taocheng_uranus_bigtts` | 小天 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_male_liufei_uranus_bigtts` | 刘飞 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_male_sophie_uranus_bigtts` | 魅力苏菲 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_female_qingxinnvsheng_uranus_bigtts` | 清新女声 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_female_cancan_uranus_bigtts` | 知性灿灿 2.0 | 中文 | 角色扮演 |
| `zh_female_sajiaoxuemei_uranus_bigtts` | 撒娇学妹 2.0 | 中文 | 角色扮演 |
| `zh_female_tianmeixiaoyuan_uranus_bigtts` | 甜美小源 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_female_tianmeitaozi_uranus_bigtts` | 甜美桃子 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_female_shuangkuaisisi_uranus_bigtts` | 爽快思思 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_female_peiqi_uranus_bigtts` | 佩奇猪 2.0 | 中文 | 视频配音 |
| `zh_female_linjianvhai_uranus_bigtts` | 邻家女孩 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_male_shaonianzixin_uranus_bigtts` | 少年梓辛 2.0 | 中文 | 情感变化、指令遵循、ASMR |
| `zh_male_sunwukong_uranus_bigtts` | 猴哥 2.0 | 中文 | 视频配音 |
| `zh_female_yingyujiaoxue_uranus_bigtts` | Tina老师 2.0 | 中/英式英语 | 教育 |
| `zh_female_kefunvsheng_uranus_bigtts` | 暖阳女声 2.0 | 中文 | 客服 |
| `zh_female_xiaoxue_uranus_bigtts` | 儿童绘本 2.0 | 中文 | 有声阅读 |
| `zh_male_dayi_uranus_bigtts` | 大壹 2.0 | 中文 | 视频配音 |
| `zh_female_mizai_uranus_bigtts` | 黑猫侦探社咪仔 2.0 | 中文 | 视频配音 |
| `zh_female_jitangnv_uranus_bigtts` | 鸡汤女 2.0 | 中文 | 视频配音 |
| `zh_female_meilinvyou_uranus_bigtts` | 魅力女友 2.0 | 中文 | 通用 |
| `zh_female_liuchangnv_uranus_bigtts` | 流畅女声 2.0 | 中文 | 视频配音 |
| `zh_male_ruyayichen_uranus_bigtts` | 儒雅逸辰 2.0 | 中文 | 视频配音 |
| `en_male_tim_uranus_bigtts` | Tim | 美式英语 | 多语种 2.0 |
| `en_female_dacey_uranus_bigtts` | Dacey | 美式英语 | 多语种 2.0 |
| `en_female_stokie_uranus_bigtts` | Stokie | 美式英语 | 多语种 2.0 |

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

### 1.0 视频配音 (mars_bigtts)

| Voice ID | 名称 | 说明 |
|---|---|---|
| `zh_male_jieshuonansheng_mars_bigtts` | 磁性解说男声 ⭐ | 解说首选，剪映 |
| `zh_female_meiyayueyue_mars_bigtts` | 魅雅悦悦 | 剪映 |
| `zh_female_qingxuanfeiyan_mars_bigtts` | 清璇飞燕 | 剪映 |
| `zh_male_zhubo_mars_bigtts` | 主播男声 | 剪映 |
| `zh_female_zhubo_mars_bigtts` | 主播女声 | 剪映 |
| `zh_male_chunhui_mars_bigtts` | 春晖男声 | 剪映 |
| `zh_female_chunhui_mars_bigtts` | 春晖女声 | 剪映 |
| `zh_male_dongfang_mars_bigtts` | 东方男声 | 剪映 |
| `zh_female_dongfang_mars_bigtts` | 东方女声 | 剪映 |
| `zh_male_cangjing_mars_bigtts` | 苍劲男声 | 剪映 |
| `zh_female_cangjing_mars_bigtts` | 苍劲女声 | 剪映 |
| `zh_male_wenzhong_mars_bigtts` | 温钟男声 | 剪映 |
| `zh_female_wenzhong_mars_bigtts` | 温钟女声 | 剪映 |
| `zh_male_huanpei_mars_bigtts` | 欢沛男声 | 剪映 |
| `zh_female_huanpei_mars_bigtts` | 欢沛女声 | 剪映 |

### 口音特色

| Voice ID | 名称 | 语言 |
|---|---|---|
| `zh_male_sichuanv2_mars_bigtts` | 四川话男声 | 四川话 |
| `zh_female_sichuanv2_mars_bigtts` | 四川话女声 | 四川话 |
| `zh_male_dongbei_mars_bigtts` | 东北话男声 | 东北话 |
| `zh_female_dongbei_mars_bigtts` | 东北话女声 | 东北话 |
| `zh_male_shanxi_mars_bigtts` | 陕西话男声 | 陕西话 |
| `zh_female_shanxi_mars_bigtts` | 陕西话女声 | 陕西话 |
| `zh_male_henan_mars_bigtts` | 河南话男声 | 河南话 |
| `zh_female_henan_mars_bigtts` | 河南话女声 | 河南话 |
| `zh_male_cantonese_mars_bigtts` | 粤语男声 | 粤语 |
| `zh_female_cantonese_mars_bigtts` | 粤语女声 | 粤语 |
| `zh_male_shanghai_mars_bigtts` | 上海话男声 | 上海话 |
| `zh_female_shanghai_mars_bigtts` | 上海话女声 | 上海话 |
| `zh_male_taiwan_mars_bigtts` | 台湾话男声 | 台湾腔 |
| `zh_female_taiwan_mars_bigtts` | 台湾话女声 | 台湾腔 |

### IP 仿音

| Voice ID | 名称 |
|---|---|
| `zh_male_IP_luban_mars_bigtts` | 鲁班 |
| `zh_male_IP_zhugeliang_mars_bigtts` | 诸葛亮 |
| `zh_male_IP_caocao_mars_bigtts` | 曹操 |
| `zh_female_IP_xishi_mars_bigtts` | 西施 |
| `zh_female_IP_wangzhaojun_mars_bigtts` | 王昭君 |
| `zh_female_IP_diaochan_mars_bigtts` | 貂蝉 |
| `zh_female_IP_yangguifei_mars_bigtts` | 杨贵妃 |

### 多情感

| Voice ID | 名称 |
|---|---|
| `zh_male_MC_emotion_mars_bigtts` | 多情感男声 |
| `zh_female_MC_emotion_mars_bigtts` | 多情感女声 |

### 英语

| Voice ID | 名称 | 版本 |
|---|---|---|
| `en_male_adam_mars_bigtts` | Adam | 1.0 |
| `en_female_anna_mars_bigtts` | Anna | 1.0 |
| `en_male_bob_mars_bigtts` | Bob | 1.0 |
| `en_female_clara_mars_bigtts` | Clara | 1.0 |
| `en_male_david_mars_bigtts` | David | 1.0 |
| `en_female_emily_mars_bigtts` | Emily | 1.0 |
| `en_male_frank_mars_bigtts` | Frank | 1.0 |
| `en_female_grace_mars_bigtts` | Grace | 1.0 |
| `en_male_henry_mars_bigtts` | Henry | 1.0 |
| `en_female_iris_mars_bigtts` | Iris | 1.0 |
| `en_male_jack_mars_bigtts` | Jack | 1.0 |
| `en_female_julia_mars_bigtts` | Julia | 1.0 |
| `en_male_tim_uranus_bigtts` | Tim | 2.0 |
| `en_female_dacey_uranus_bigtts` | Dacey | 2.0 |
| `en_female_stokie_uranus_bigtts` | Stokie | 2.0 |

### 客服

| Voice ID | 名称 | 版本 |
|---|---|---|
| `ICL_zh_male_jiangjunnansheng_cs_tob` | 将军男声 | 1.0 |
| `ICL_zh_female_wenrounvsheng_cs_tob` | 温柔女声 | 1.0 |
| `ICL_zh_male_qingchennansheng_cs_tob` | 清晨男声 | 1.0 |
| `ICL_zh_female_aiyuanvsheng_cs_tob` | 爱悦女声 | 1.0 |
| `ICL_zh_male_chengshunansheng_cs_tob` | 成熟男声 | 1.0 |
| `ICL_zh_female_kailangtingting_cs_tob` | 开朗婷婷 | 1.0 |
| `ICL_zh_male_qingxinmumu_cs_tob` | 清新沐沐 | 1.0 |
| `ICL_zh_male_shuanglangxiaoyang_cs_tob` | 爽朗小阳 | 1.0 |
| `ICL_zh_female_wenwanshanshan_cs_tob` | 温婉珊珊 | 1.0 |
| `ICL_zh_female_tianmeixiaoyu_cs_tob` | 甜美小雨 | 1.0 |
| `ICL_zh_female_reqingaina_cs_tob` | 热情艾娜 | 1.0 |
| `ICL_zh_female_qingyingduoduo_cs_tob` | 轻盈朵朵 | 1.0 |
| `saturn_zh_female_qingyingduoduo_cs_tob` | 轻盈朵朵 2.0 | 2.0 |
| `saturn_zh_female_wenwanshanshan_cs_tob` | 温婉珊珊 2.0 | 2.0 |
| `saturn_zh_female_reqingaina_cs_tob` | 热情艾娜 2.0 | 2.0 |

Full catalog source: https://www.volcengine.com/docs/6561/1257544
