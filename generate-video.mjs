#!/usr/bin/env node
/**
 * generate-video.mjs — Generic PPT-to-MP4 converter with 豆包 TTS narration.
 *
 * Usage:
 *   node generate-video.mjs <project-dir> [options]
 *   node generate-video.mjs --list-voices [keyword]   List all available voices
 *
 * Options:
 *   --voice <voice_type>     Override DOUBAO_VOICE from .env
 *   --skip-screenshots       Skip Phase 1 (reuse existing slide_NN.png in tmp/)
 *   --skip-audio             Skip Phase 2 (reuse existing slide_NN.pcm in tmp/)
 *   --list-voices [keyword]  Print voice catalog and exit (optional keyword filter)
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
 *
 * Prerequisites:
 *   Set DOUBAO_APP_ID and DOUBAO_ACCESS_TOKEN in .env
 *   开通方式: 火山方舟 → 体验中心 → 语音模型 → 开通语音模型 (Doubao-语音合成)
 *   控制台: https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?tab=TTS
 *
 * Default voice: zh_male_shaonianzixin_moon_bigtts  (少年梓辛/Brayan)
 *
 * Available voices (run --list-voices to filter):
 *
 *  ID                                                      名称                     语言                    场景        版本   说明
 *  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *  zh_female_vv_uranus_bigtts                              Vivi 2.0                 中/日/印尼/西语+四川/陕西/东北  通用   2.0  情感变化、指令遵循、ASMR，多语种+方言
 *  zh_female_xiaohe_uranus_bigtts                          小何 2.0                 中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_male_m191_uranus_bigtts                              云舟 2.0                 中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_male_taocheng_uranus_bigtts                          小天 2.0                 中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_male_liufei_uranus_bigtts                            刘飞 2.0                 中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_male_sophie_uranus_bigtts                            魅力苏菲 2.0             中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_female_qingxinnvsheng_uranus_bigtts                  清新女声 2.0             中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_female_cancan_uranus_bigtts                          知性灿灿 2.0             中文                    角色扮演    2.0  情感变化、指令遵循、ASMR
 *  zh_female_sajiaoxuemei_uranus_bigtts                    撒娇学妹 2.0             中文                    角色扮演    2.0  情感变化、指令遵循、ASMR
 *  zh_female_tianmeixiaoyuan_uranus_bigtts                 甜美小源 2.0             中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_female_tianmeitaozi_uranus_bigtts                    甜美桃子 2.0             中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_female_shuangkuaisisi_uranus_bigtts                  爽快思思 2.0             中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_female_peiqi_uranus_bigtts                           佩奇猪 2.0               中文                    视频配音    2.0  情感变化、指令遵循、ASMR
 *  zh_female_linjianvhai_uranus_bigtts                     邻家女孩 2.0             中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_male_shaonianzixin_uranus_bigtts                     少年梓辛 2.0             中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_male_sunwukong_uranus_bigtts                         猴哥 2.0                 中文                    视频配音    2.0  情感变化、指令遵循、ASMR
 *  zh_female_yingyujiaoxue_uranus_bigtts                   Tina老师 2.0             中/英式英语             教育        2.0  情感变化、指令遵循、ASMR
 *  zh_female_kefunvsheng_uranus_bigtts                     暖阳女声 2.0             中文                    客服        2.0  情感变化、指令遵循、ASMR
 *  zh_female_xiaoxue_uranus_bigtts                         儿童绘本 2.0             中文                    有声阅读    2.0  情感变化、指令遵循、ASMR
 *  zh_male_dayi_uranus_bigtts                              大壹 2.0                 中文                    视频配音    2.0  情感变化、指令遵循、ASMR
 *  zh_female_mizai_uranus_bigtts                           黑猫侦探社咪仔 2.0       中文                    视频配音    2.0  情感变化、指令遵循、ASMR
 *  zh_female_jitangnv_uranus_bigtts                        鸡汤女 2.0               中文                    视频配音    2.0  情感变化、指令遵循、ASMR
 *  zh_female_meilinvyou_uranus_bigtts                      魅力女友 2.0             中文                    通用        2.0  情感变化、指令遵循、ASMR
 *  zh_female_liuchangnv_uranus_bigtts                      流畅女声 2.0             中文                    视频配音    2.0  情感变化、指令遵循、ASMR
 *  zh_male_ruyayichen_uranus_bigtts                        儒雅逸辰 2.0             中文                    视频配音    2.0  情感变化、指令遵循、ASMR
 *  en_male_tim_uranus_bigtts                               Tim                      美式英语                多语种      2.0  情感变化、指令遵循、ASMR
 *  en_female_dacey_uranus_bigtts                           Dacey                    美式英语                多语种      2.0  情感变化、指令遵循、ASMR
 *  en_female_stokie_uranus_bigtts                          Stokie                   美式英语                多语种      2.0  情感变化、指令遵循、ASMR
 *  zh_male_shaonianzixin_moon_bigtts                       少年梓辛/Brayan ⭐ DEFAULT 中/美式英语            通用        1.0  默认推荐，豆包/Cici/剪映
 *  zh_female_linjianvhai_moon_bigtts                       邻家女孩                 中文                    通用        1.0  豆包、Cici
 *  zh_male_yuanboxiaoshu_moon_bigtts                       渊博小叔                 中文                    通用        1.0  豆包、Cici、剪映，知识讲解首选
 *  zh_male_yangguangqingnian_moon_bigtts                   阳光青年                 中文                    通用        1.0  豆包、Cici、StoryAi
 *  zh_female_tianmeixiaoyuan_moon_bigtts                   甜美小源                 中文                    通用        1.0  豆包
 *  zh_female_qingchezizi_moon_bigtts                       清澈梓梓                 中文                    通用        1.0  豆包
 *  zh_male_jieshuoxiaoming_moon_bigtts                     解说小明                 中文                    通用        1.0  豆包，解说风格
 *  zh_female_kailangjiejie_moon_bigtts                     开朗姐姐                 中文                    通用        1.0  豆包
 *  zh_male_linjiananhai_moon_bigtts                        邻家男孩                 中文                    通用        1.0  豆包
 *  zh_female_tianmeiyueyue_moon_bigtts                     甜美悦悦                 中文                    通用        1.0  豆包
 *  zh_female_xinlingjitang_moon_bigtts                     心灵鸡汤                 中文                    通用        1.0  豆包
 *  zh_female_qinqienvsheng_moon_bigtts                     亲切女声                 中文                    通用        1.0  豆包
 *  zh_female_shuangkuaisisi_moon_bigtts                    爽快思思/Skye            中/美式英语             通用        1.0  豆包、Cici、web demo
 *  zh_male_jieshuonansheng_mars_bigtts                     磁性解说男声 ⭐           中文                    视频配音    1.0  解说首选，剪映
 *  zh_female_meiyayueyue_mars_bigtts                       魅雅悦悦                 中文                    视频配音    1.0  剪映
 *  zh_female_qingxuanfeiyan_mars_bigtts                    清璇飞燕                 中文                    视频配音    1.0  剪映
 *  zh_male_zhubo_mars_bigtts                               主播男声                 中文                    视频配音    1.0  剪映
 *  zh_female_zhubo_mars_bigtts                             主播女声                 中文                    视频配音    1.0  剪映
 *  zh_male_chunhui_mars_bigtts                             春晖男声                 中文                    视频配音    1.0  剪映
 *  zh_female_chunhui_mars_bigtts                           春晖女声                 中文                    视频配音    1.0  剪映
 *  zh_male_dongfang_mars_bigtts                            东方男声                 中文                    视频配音    1.0  剪映
 *  zh_female_dongfang_mars_bigtts                          东方女声                 中文                    视频配音    1.0  剪映
 *  zh_male_cangjing_mars_bigtts                            苍劲男声                 中文                    视频配音    1.0  剪映
 *  zh_female_cangjing_mars_bigtts                          苍劲女声                 中文                    视频配音    1.0  剪映
 *  zh_male_wenzhong_mars_bigtts                            温钟男声                 中文                    视频配音    1.0  剪映
 *  zh_female_wenzhong_mars_bigtts                          温钟女声                 中文                    视频配音    1.0  剪映
 *  zh_male_huanpei_mars_bigtts                             欢沛男声                 中文                    视频配音    1.0  剪映
 *  zh_female_huanpei_mars_bigtts                           欢沛女声                 中文                    视频配音    1.0  剪映
 *  zh_male_sichuanv2_mars_bigtts                           四川话男声               四川话                  口音        1.0
 *  zh_female_sichuanv2_mars_bigtts                         四川话女声               四川话                  口音        1.0
 *  zh_male_dongbei_mars_bigtts                             东北话男声               东北话                  口音        1.0
 *  zh_female_dongbei_mars_bigtts                           东北话女声               东北话                  口音        1.0
 *  zh_male_shanxi_mars_bigtts                              陕西话男声               陕西话                  口音        1.0
 *  zh_female_shanxi_mars_bigtts                            陕西话女声               陕西话                  口音        1.0
 *  zh_male_henan_mars_bigtts                               河南话男声               河南话                  口音        1.0
 *  zh_female_henan_mars_bigtts                             河南话女声               河南话                  口音        1.0
 *  zh_male_cantonese_mars_bigtts                           粤语男声                 粤语                    口音        1.0
 *  zh_female_cantonese_mars_bigtts                         粤语女声                 粤语                    口音        1.0
 *  zh_male_shanghai_mars_bigtts                            上海话男声               上海话                  口音        1.0
 *  zh_female_shanghai_mars_bigtts                          上海话女声               上海话                  口音        1.0
 *  zh_male_taiwan_mars_bigtts                              台湾话男声               台湾腔                  口音        1.0
 *  zh_female_taiwan_mars_bigtts                            台湾话女声               台湾腔                  口音        1.0
 *  zh_male_IP_luban_mars_bigtts                            鲁班                     中文                    IP仿音      1.0
 *  zh_male_IP_zhugeliang_mars_bigtts                       诸葛亮                   中文                    IP仿音      1.0
 *  zh_male_IP_caocao_mars_bigtts                           曹操                     中文                    IP仿音      1.0
 *  zh_female_IP_xishi_mars_bigtts                          西施                     中文                    IP仿音      1.0
 *  zh_female_IP_wangzhaojun_mars_bigtts                    王昭君                   中文                    IP仿音      1.0
 *  zh_female_IP_diaochan_mars_bigtts                       貂蝉                     中文                    IP仿音      1.0
 *  zh_female_IP_yangguifei_mars_bigtts                     杨贵妃                   中文                    IP仿音      1.0
 *  zh_male_MC_emotion_mars_bigtts                          多情感男声               中文                    多情感      1.0
 *  zh_female_MC_emotion_mars_bigtts                        多情感女声               中文                    多情感      1.0
 *  en_male_adam_mars_bigtts                                Adam                     美式英语                英语        1.0
 *  en_female_anna_mars_bigtts                              Anna                     美式英语                英语        1.0
 *  en_male_bob_mars_bigtts                                 Bob                      美式英语                英语        1.0
 *  en_female_clara_mars_bigtts                             Clara                    美式英语                英语        1.0
 *  en_male_david_mars_bigtts                               David                    美式英语                英语        1.0
 *  en_female_emily_mars_bigtts                             Emily                    美式英语                英语        1.0
 *  en_male_frank_mars_bigtts                               Frank                    美式英语                英语        1.0
 *  en_female_grace_mars_bigtts                             Grace                    美式英语                英语        1.0
 *  en_male_henry_mars_bigtts                               Henry                    美式英语                英语        1.0
 *  en_female_iris_mars_bigtts                              Iris                     美式英语                英语        1.0
 *  en_male_jack_mars_bigtts                                Jack                     美式英语                英语        1.0
 *  en_female_julia_mars_bigtts                             Julia                    美式英语                英语        1.0
 *  ICL_zh_male_jiangjunnansheng_cs_tob                     将军男声                 中文                    客服        1.0
 *  ICL_zh_female_wenrounvsheng_cs_tob                      温柔女声                 中文                    客服        1.0
 *  ICL_zh_male_qingchennansheng_cs_tob                     清晨男声                 中文                    客服        1.0
 *  ICL_zh_female_aiyuanvsheng_cs_tob                       爱悦女声                 中文                    客服        1.0
 *  ICL_zh_male_chengshunansheng_cs_tob                     成熟男声                 中文                    客服        1.0
 *  ICL_zh_female_kailangtingting_cs_tob                    开朗婷婷                 中文                    客服        1.0
 *  ICL_zh_male_qingxinmumu_cs_tob                          清新沐沐                 中文                    客服        1.0
 *  ICL_zh_male_shuanglangxiaoyang_cs_tob                   爽朗小阳                 中文                    客服        1.0
 *  ICL_zh_female_wenwanshanshan_cs_tob                     温婉珊珊                 中文                    客服        1.0
 *  ICL_zh_female_tianmeixiaoyu_cs_tob                      甜美小雨                 中文                    客服        1.0
 *  ICL_zh_female_reqingaina_cs_tob                         热情艾娜                 中文                    客服        1.0
 *  ICL_zh_female_qingyingduoduo_cs_tob                     轻盈朵朵                 中文                    客服        1.0
 *  saturn_zh_female_qingyingduoduo_cs_tob                  轻盈朵朵 2.0             中文                    客服        2.0  指令遵循
 *  saturn_zh_female_wenwanshanshan_cs_tob                  温婉珊珊 2.0             中文                    客服        2.0  指令遵循
 *  saturn_zh_female_reqingaina_cs_tob                      热情艾娜 2.0             中文                    客服        2.0  指令遵循
 */

// ── Voice Catalog ─────────────────────────────────────────────────────────────
// Source: https://www.volcengine.com/docs/6561/1257544
// Fields: id, name, lang, scene, desc, model
// model: 2.0 = uranus_bigtts, 1.0 = moon_bigtts/mars_bigtts

const VOICE_CATALOG = [
  // ── 2.0 通用声音 (uranus_bigtts) ──────────────────────────────────────────
  { id: 'zh_female_vv_uranus_bigtts',              name: 'Vivi 2.0',       lang: '中/日/印尼/西语+四川/陕西/东北',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR，多语种+方言' },
  { id: 'zh_female_xiaohe_uranus_bigtts',          name: '小何 2.0',       lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_male_m191_uranus_bigtts',              name: '云舟 2.0',       lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_male_taocheng_uranus_bigtts',          name: '小天 2.0',       lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_male_liufei_uranus_bigtts',            name: '刘飞 2.0',       lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_male_sophie_uranus_bigtts',            name: '魅力苏菲 2.0',   lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_qingxinnvsheng_uranus_bigtts',  name: '清新女声 2.0',   lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_cancan_uranus_bigtts',          name: '知性灿灿 2.0',   lang: '中文',  scene: '角色扮演', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_sajiaoxuemei_uranus_bigtts',    name: '撒娇学妹 2.0',   lang: '中文',  scene: '角色扮演', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_tianmeixiaoyuan_uranus_bigtts', name: '甜美小源 2.0',   lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_tianmeitaozi_uranus_bigtts',    name: '甜美桃子 2.0',   lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_shuangkuaisisi_uranus_bigtts',  name: '爽快思思 2.0',   lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_peiqi_uranus_bigtts',           name: '佩奇猪 2.0',     lang: '中文',  scene: '视频配音', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_linjianvhai_uranus_bigtts',     name: '邻家女孩 2.0',   lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_male_shaonianzixin_uranus_bigtts',     name: '少年梓辛 2.0',   lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_male_sunwukong_uranus_bigtts',         name: '猴哥 2.0',       lang: '中文',  scene: '视频配音', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_yingyujiaoxue_uranus_bigtts',   name: 'Tina老师 2.0',   lang: '中/英式英语', scene: '教育', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_kefunvsheng_uranus_bigtts',     name: '暖阳女声 2.0',   lang: '中文',  scene: '客服',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_xiaoxue_uranus_bigtts',         name: '儿童绘本 2.0',   lang: '中文',  scene: '有声阅读', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_male_dayi_uranus_bigtts',              name: '大壹 2.0',       lang: '中文',  scene: '视频配音', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_mizai_uranus_bigtts',           name: '黑猫侦探社咪仔 2.0', lang: '中文', scene: '视频配音', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_jitangnv_uranus_bigtts',        name: '鸡汤女 2.0',     lang: '中文',  scene: '视频配音', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_meilinvyou_uranus_bigtts',      name: '魅力女友 2.0',   lang: '中文',  scene: '通用',   model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_female_liuchangnv_uranus_bigtts',      name: '流畅女声 2.0',   lang: '中文',  scene: '视频配音', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'zh_male_ruyayichen_uranus_bigtts',        name: '儒雅逸辰 2.0',   lang: '中文',  scene: '视频配音', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'en_male_tim_uranus_bigtts',               name: 'Tim',            lang: '美式英语', scene: '多语种', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'en_female_dacey_uranus_bigtts',           name: 'Dacey',          lang: '美式英语', scene: '多语种', model: '2.0', desc: '情感变化、指令遵循、ASMR' },
  { id: 'en_female_stokie_uranus_bigtts',          name: 'Stokie',         lang: '美式英语', scene: '多语种', model: '2.0', desc: '情感变化、指令遵循、ASMR' },

  // ── 1.0 通用声音 (moon_bigtts) ────────────────────────────────────────────
  { id: 'zh_male_shaonianzixin_moon_bigtts',       name: '少年梓辛/Brayan ⭐', lang: '中/美式英语', scene: '通用', model: '1.0', desc: '默认推荐，豆包/Cici/剪映' },
  { id: 'zh_female_linjianvhai_moon_bigtts',       name: '邻家女孩',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包、Cici' },
  { id: 'zh_male_yuanboxiaoshu_moon_bigtts',       name: '渊博小叔',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包、Cici、剪映，知识讲解首选' },
  { id: 'zh_male_yangguangqingnian_moon_bigtts',   name: '阳光青年',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包、Cici、StoryAi' },
  { id: 'zh_female_tianmeixiaoyuan_moon_bigtts',   name: '甜美小源',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包' },
  { id: 'zh_female_qingchezizi_moon_bigtts',       name: '清澈梓梓',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包' },
  { id: 'zh_male_jieshuoxiaoming_moon_bigtts',     name: '解说小明',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包，解说风格' },
  { id: 'zh_female_kailangjiejie_moon_bigtts',     name: '开朗姐姐',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包' },
  { id: 'zh_male_linjiananhai_moon_bigtts',        name: '邻家男孩',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包' },
  { id: 'zh_female_tianmeiyueyue_moon_bigtts',     name: '甜美悦悦',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包' },
  { id: 'zh_female_xinlingjitang_moon_bigtts',     name: '心灵鸡汤',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包' },
  { id: 'zh_female_qinqienvsheng_moon_bigtts',     name: '亲切女声',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包' },
  { id: 'zh_female_shuangkuaisisi_moon_bigtts',    name: '爽快思思/Skye',   lang: '中/美式英语', scene: '通用', model: '1.0', desc: '豆包、Cici、web demo' },
  { id: 'zh_male_wennuanahu_moon_bigtts',          name: '温暖阿虎/Alvin',  lang: '中/美式英语', scene: '通用', model: '1.0', desc: '豆包、Cici' },
  { id: 'zh_male_jingqiangkanye_moon_bigtts',      name: '京腔侃爷/Harmony', lang: '中（北京腔）/英', scene: '通用', model: '1.0', desc: '豆包、Cici、web demo' },
  { id: 'zh_male_shenyeboke_moon_bigtts',          name: '深夜播客',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包，低沉深夜风格' },
  { id: 'zh_female_gaolengyujie_moon_bigtts',      name: '高冷御姐',        lang: '中文',  scene: '角色扮演', model: '1.0', desc: '豆包、Cici' },
  { id: 'zh_male_aojiaobazong_moon_bigtts',        name: '傲娇霸总',        lang: '中文',  scene: '角色扮演', model: '1.0', desc: '豆包' },
  { id: 'zh_female_meilinvyou_moon_bigtts',        name: '魅力女友',        lang: '中文',  scene: '角色扮演', model: '1.0', desc: '豆包、剪映' },
  { id: 'zh_female_sajiaonvyou_moon_bigtts',       name: '柔美女友',        lang: '中文',  scene: '角色扮演', model: '1.0', desc: '豆包、剪映' },
  { id: 'zh_female_yuanqinvyou_moon_bigtts',       name: '撒娇学妹',        lang: '中文',  scene: '角色扮演', model: '1.0', desc: '豆包、剪映' },
  { id: 'zh_male_dongfanghaoran_moon_bigtts',      name: '东方浩然',        lang: '中文',  scene: '角色扮演', model: '1.0', desc: '豆包' },
  { id: 'zh_male_wenrouxiaoya_moon_bigtts',        name: '温柔小雅',        lang: '中文',  scene: '视频配音', model: '1.0', desc: '豆包' },

  // ── 口音特色 (moon_bigtts) ────────────────────────────────────────────────
  { id: 'zh_female_wanwanxiaohe_moon_bigtts',      name: '湾湾小何',        lang: '中（台湾腔）', scene: '口音', model: '1.0', desc: '豆包、Cici' },
  { id: 'zh_male_yuzhouzixuan_moon_bigtts',        name: '豫州子轩',        lang: '中（河南口音）', scene: '口音', model: '1.0', desc: '豆包' },
  { id: 'zh_female_daimengchuanmei_moon_bigtts',   name: '呆萌川妹',        lang: '中（四川口音）', scene: '口音', model: '1.0', desc: '豆包、Cici' },
  { id: 'zh_male_guangxiyuanzhou_moon_bigtts',     name: '广西远舟',        lang: '中（广西口音）', scene: '口音', model: '1.0', desc: '豆包' },
  { id: 'zh_female_wanqudashu_moon_bigtts',        name: '湾区大叔',        lang: '中（广东口音）', scene: '口音', model: '1.0', desc: '豆包、Cici' },
  { id: 'zh_male_guozhoudege_moon_bigtts',         name: '广州德哥',        lang: '中（广东口音）', scene: '口音', model: '1.0', desc: '豆包、Cici' },
  { id: 'zh_male_haoyuxiaoge_moon_bigtts',         name: '浩宇小哥',        lang: '中（青岛口音）', scene: '口音', model: '1.0', desc: '豆包' },
  { id: 'zh_male_beijingxiaoye_moon_bigtts',       name: '北京小爷',        lang: '中（北京口音）', scene: '口音', model: '1.0', desc: '豆包' },
  { id: 'zh_female_meituojieer_moon_bigtts',       name: '妹坨洁儿',        lang: '中（长沙口音）', scene: '口音', model: '1.0', desc: '豆包、剪映' },

  // ── 视频配音 (mars_bigtts) ────────────────────────────────────────────────
  { id: 'zh_male_jieshuonansheng_mars_bigtts',     name: '磁性解说男声/Morgan', lang: '中/美式英语', scene: '视频配音', model: '1.0', desc: '⭐解说首选，抖音/剪映' },
  { id: 'zh_male_baqiqingshu_mars_bigtts',         name: '霸气青叔',        lang: '中文',  scene: '有声阅读', model: '1.0', desc: '番茄小说、豆包、剪映' },
  { id: 'zh_male_ruyaqingnian_mars_bigtts',        name: '儒雅青年',        lang: '中文',  scene: '有声阅读', model: '1.0', desc: '番茄小说、豆包、剪映' },
  { id: 'zh_male_qingcang_mars_bigtts',            name: '擎苍',            lang: '中文',  scene: '有声阅读', model: '1.0', desc: '低沉有力，番茄小说/剪映/豆包/抖音' },
  { id: 'zh_male_changtianyi_mars_bigtts',         name: '悬疑解说',        lang: '中文',  scene: '视频配音', model: '1.0', desc: '悬疑旁白，剪映/抖音/豆包' },
  { id: 'zh_female_jitangmeimei_mars_bigtts',      name: '鸡汤妹妹/Hope',   lang: '中/美式英语', scene: '视频配音', model: '1.0', desc: '抖音、豆包' },
  { id: 'zh_female_tiexinnvsheng_mars_bigtts',     name: '贴心女声/Candy',  lang: '中/美式英语', scene: '视频配音', model: '1.0', desc: '中英双语' },
  { id: 'zh_female_mengyatou_mars_bigtts',         name: '萌丫头/Cutey',    lang: '中/美式英语', scene: '视频配音', model: '1.0', desc: '中英双语' },
  { id: 'zh_female_vv_mars_bigtts',                name: 'Vivi',            lang: '中文',  scene: '通用',   model: '1.0', desc: '通用' },
  { id: 'zh_male_yangguangqingnian_mars_bigtts',   name: '活力小哥',        lang: '中文',  scene: '有声阅读', model: '1.0', desc: '' },
  { id: 'zh_female_wenroushunv_mars_bigtts',       name: '温柔淑女',        lang: '中文',  scene: '有声阅读', model: '1.0', desc: '番茄小说、豆包、剪映' },
  { id: 'zh_male_fanjuanqingnian_mars_bigtts',     name: '反卷青年',        lang: '中文',  scene: '有声阅读', model: '1.0', desc: '' },
  { id: 'zh_female_gufengshaoyu_mars_bigtts',      name: '古风少御',        lang: '中文',  scene: '有声阅读', model: '1.0', desc: '' },
  { id: 'zh_male_sunwukong_mars_bigtts',           name: '猴哥',            lang: '中文',  scene: '视频配音', model: '1.0', desc: '剪映/抖音/豆包' },
  { id: 'zh_male_xionger_mars_bigtts',             name: '熊二',            lang: '中文',  scene: '视频配音', model: '1.0', desc: '抖音/剪映/豆包' },
  { id: 'zh_female_peiqi_mars_bigtts',             name: '佩奇猪',          lang: '中文',  scene: '视频配音', model: '1.0', desc: '抖音/剪映/豆包' },
  { id: 'zh_female_wuzetian_mars_bigtts',          name: '武则天',          lang: '中文',  scene: '视频配音', model: '1.0', desc: '剪映' },
  { id: 'zh_female_yingtaowanzi_mars_bigtts',      name: '樱桃丸子',        lang: '中文',  scene: '视频配音', model: '1.0', desc: '剪映订阅/抖音/豆包' },
  { id: 'zh_male_silang_mars_bigtts',              name: '四郎',            lang: '中文',  scene: '视频配音', model: '1.0', desc: '抖音/剪映/豆包' },
  { id: 'zh_male_naiqimengwa_mars_bigtts',         name: '奶气萌娃',        lang: '中文',  scene: '角色扮演', model: '1.0', desc: '剪映/豆包' },
  { id: 'zh_female_popo_mars_bigtts',              name: '婆婆',            lang: '中文',  scene: '视频配音', model: '1.0', desc: '剪映/抖音/豆包' },
  { id: 'zh_male_tiancaitongsheng_mars_bigtts',    name: '天才童声',        lang: '中文',  scene: '视频配音', model: '1.0', desc: '' },
  { id: 'zh_female_shaoergushi_mars_bigtts',       name: '少儿故事',        lang: '中文',  scene: '视频配音', model: '1.0', desc: '' },
  { id: 'zh_female_qiaopinvsheng_mars_bigtts',     name: '俏皮女声',        lang: '中文',  scene: '视频配音', model: '1.0', desc: '' },
  { id: 'zh_female_jiaochuan_mars_bigtts',         name: '娇喘女声',        lang: '中文',  scene: '视频配音', model: '1.0', desc: '剪映/抖音' },
  { id: 'zh_male_qingyiyuxuan_mars_bigtts',        name: '阳光阿辰',        lang: '中文',  scene: '通用',   model: '1.0', desc: '' },
  { id: 'zh_male_wenrouxiaoge_mars_bigtts',        name: '温柔小哥',        lang: '中文',  scene: '通用',   model: '1.0', desc: '' },
  { id: 'zh_female_cancan_mars_bigtts',            name: '灿灿/Shiny',      lang: '中/美式英语', scene: '通用', model: '1.0', desc: '' },
  { id: 'zh_male_xudong_conversation_wvae_bigtts', name: '快乐小东',        lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包/Cici/web demo' },
  { id: 'zh_female_maomao_conversation_wvae_bigtts', name: '文静毛毛',      lang: '中文',  scene: '视频配音', model: '1.0', desc: '豆包/web demo' },
  { id: 'zh_male_M100_conversation_wvae_bigtts',   name: '悠悠君子',        lang: '中文',  scene: '视频配音', model: '1.0', desc: '豆包/Cici/web demo' },
  { id: 'zh_female_sophie_conversation_wvae_bigtts', name: '魅力苏菲',      lang: '中文',  scene: '通用',   model: '1.0', desc: '' },
  { id: 'zh_male_bv139_audiobook_ummv3_bigtts',    name: '高冷沉稳',        lang: '中文',  scene: '角色扮演', model: '1.0', desc: '猫箱' },

  // ── IP仿音 / 特色 (mars_bigtts) ───────────────────────────────────────────
  { id: 'zh_male_hupunan_mars_bigtts',             name: '沪普男',          lang: '中文',  scene: 'IP仿音', model: '1.0', desc: '豆包' },
  { id: 'zh_male_lubanqihao_mars_bigtts',          name: '鲁班七号',        lang: '中文',  scene: 'IP仿音', model: '1.0', desc: '抖音/剪映/豆包' },
  { id: 'zh_female_yangmi_mars_bigtts',            name: '林潇',            lang: '中文',  scene: 'IP仿音', model: '1.0', desc: '剪映/抖音/豆包' },
  { id: 'zh_female_linzhiling_mars_bigtts',        name: '玲玲姐姐',        lang: '中文',  scene: 'IP仿音', model: '1.0', desc: '剪映/抖音/豆包' },
  { id: 'zh_female_jiyejizi2_mars_bigtts',         name: '春日部姐姐',      lang: '中文',  scene: 'IP仿音', model: '1.0', desc: '抖音/剪映/豆包' },
  { id: 'zh_male_tangseng_mars_bigtts',            name: '唐僧',            lang: '中文',  scene: 'IP仿音', model: '1.0', desc: '抖音/豆包' },
  { id: 'zh_male_zhuangzhou_mars_bigtts',          name: '庄周',            lang: '中文',  scene: 'IP仿音', model: '1.0', desc: '剪映/抖音' },
  { id: 'zh_male_zhubajie_mars_bigtts',            name: '猪八戒',          lang: '中文',  scene: 'IP仿音', model: '1.0', desc: '剪映/豆包' },
  { id: 'zh_female_naying_mars_bigtts',            name: '直率英子',        lang: '中文',  scene: 'IP仿音', model: '1.0', desc: '剪映/抖音/豆包' },
  { id: 'zh_male_zhoujielun_emo_v2_mars_bigtts',   name: '双节棍小哥',      lang: '中（台湾腔）', scene: 'IP仿音', model: '1.0', desc: '抖音/剪映/豆包' },

  // ── 多情感 (mars_bigtts) ──────────────────────────────────────────────────
  { id: 'zh_male_lengkugege_emo_v2_mars_bigtts',   name: '冷酷哥哥（多情感）', lang: '中文', scene: '多情感', model: '1.0', desc: '生气/冷漠/恐惧/开心/厌恶/中性/悲伤/沮丧' },
  { id: 'zh_female_tianxinxiaomei_emo_v2_mars_bigtts', name: '甜心小美（多情感）', lang: '中文', scene: '多情感', model: '1.0', desc: '悲伤/恐惧/厌恶/中性，剪映' },
  { id: 'zh_female_gaolengyujie_emo_v2_mars_bigtts', name: '高冷御姐（多情感）', lang: '中文', scene: '多情感', model: '1.0', desc: '开心/悲伤/生气/惊讶/恐惧/厌恶/激动/冷漠/中性，剪映' },
  { id: 'zh_male_aojiaobazong_emo_v2_mars_bigtts', name: '傲娇霸总（多情感）', lang: '中文', scene: '多情感', model: '1.0', desc: '中性/开心/愤怒/厌恶，剪映' },
  { id: 'zh_male_guangzhoudege_emo_mars_bigtts',   name: '广州德哥（多情感）', lang: '中文', scene: '多情感', model: '1.0', desc: '生气/恐惧/中性，剪映' },
  { id: 'zh_male_jingqiangkanye_emo_mars_bigtts',  name: '京腔侃爷（多情感）', lang: '中文', scene: '多情感', model: '1.0', desc: '开心/生气/惊讶/厌恶/中性，剪映' },
  { id: 'zh_female_roumeinvyou_emo_v2_mars_bigtts', name: '柔美女友（多情感）', lang: '中文', scene: '多情感', model: '1.0', desc: '开心/悲伤/生气/惊讶/恐惧/厌恶/激动/冷漠/中性' },
  { id: 'zh_male_yangguangqingnian_emo_v2_mars_bigtts', name: '阳光青年（多情感）', lang: '中文', scene: '多情感', model: '1.0', desc: '开心/悲伤/生气/恐惧/激动/冷漠/中性' },
  { id: 'zh_female_shuangkuaisisi_emo_v2_mars_bigtts', name: '爽快思思（多情感）', lang: '中/英式英语', scene: '多情感', model: '1.0', desc: '开心/悲伤/生气/惊讶/激动/冷漠/中性' },
  { id: 'zh_male_shenyeboke_emo_v2_mars_bigtts',   name: '深夜播客（多情感）', lang: '中文', scene: '多情感', model: '1.0', desc: '惊讶/悲伤/中性/厌恶/开心/恐惧/激动/沮丧/冷漠/生气，猫箱' },
  { id: 'en_female_candice_emo_v2_mars_bigtts',    name: 'Candice',        lang: '美式英语', scene: '多情感', model: '1.0', desc: '深情/愤怒/ASMR/闲聊/兴奋/愉悦/中性/温暖' },
  { id: 'en_female_skye_emo_v2_mars_bigtts',       name: 'Serena',         lang: '美式英语', scene: '多情感', model: '1.0', desc: '深情/愤怒/ASMR/闲聊/兴奋/愉悦/中性/悲伤/温暖' },
  { id: 'en_male_glen_emo_v2_mars_bigtts',         name: 'Glen',           lang: '美式英语', scene: '多情感', model: '1.0', desc: '深情/愤怒/ASMR/闲聊/兴奋/愉悦/中性/悲伤/温暖' },
  { id: 'en_male_sylus_emo_v2_mars_bigtts',        name: 'Sylus',          lang: '美式英语', scene: '多情感', model: '1.0', desc: '深情/愤怒/ASMR/权威/闲聊/兴奋/愉悦/中性/悲伤/温暖' },
  { id: 'en_male_corey_emo_v2_mars_bigtts',        name: 'Corey',          lang: '英式英语', scene: '多情感', model: '1.0', desc: '愤怒/ASMR/权威/闲聊/深情/兴奋/愉悦/中性/悲伤/温暖' },
  { id: 'en_female_nadia_tips_emo_v2_mars_bigtts', name: 'Nadia',          lang: '英式英语', scene: '多情感', model: '1.0', desc: '深情/愤怒/ASMR/闲聊/兴奋/愉悦/中性/悲伤/温暖' },

  // ── 英语 (moon/mars_bigtts) ───────────────────────────────────────────────
  { id: 'en_female_lauren_moon_bigtts',            name: 'Lauren',         lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_male_campaign_jamal_moon_bigtts',      name: 'Energetic Male II', lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_male_chris_moon_bigtts',               name: 'Gotham Hero',    lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_product_darcie_moon_bigtts',    name: 'Flirty Female',  lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_emotional_moon_bigtts',         name: 'Peaceful Female', lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_nara_moon_bigtts',              name: 'Nara',           lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_male_bruce_moon_bigtts',               name: 'Bruce',          lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_male_michael_moon_bigtts',             name: 'Michael',        lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_male_adam_mars_bigtts',                name: 'Adam',           lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_amanda_mars_bigtts',            name: 'Amanda',         lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_male_jackson_mars_bigtts',             name: 'Jackson',        lang: '美式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_daisy_moon_bigtts',             name: 'Delicate Girl',  lang: '英式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_male_dave_moon_bigtts',                name: 'Dave',           lang: '英式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_male_hades_moon_bigtts',               name: 'Hades',          lang: '英式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_onez_moon_bigtts',              name: 'Onez',           lang: '英式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_emily_mars_bigtts',             name: 'Emily',          lang: '英式英语', scene: '多语种', model: '1.0', desc: '豆包' },
  { id: 'en_male_smith_mars_bigtts',               name: 'Smith',          lang: '英式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_anna_mars_bigtts',              name: 'Anna',           lang: '英式英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_sarah_mars_bigtts',             name: 'Sarah',          lang: '澳洲英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_male_dryw_mars_bigtts',                name: 'Dryw',           lang: '澳洲英语', scene: '多语种', model: '1.0', desc: '' },
  { id: 'en_female_dacey_conversation_wvae_bigtts', name: 'Daisy',         lang: '美式英语', scene: '多语种', model: '1.0', desc: '豆包/Cici/web demo' },
  { id: 'en_male_charlie_conversation_wvae_bigtts', name: 'Owen',          lang: '美式英语', scene: '多语种', model: '1.0', desc: '豆包/Cici' },
  { id: 'en_female_sarah_new_conversation_wvae_bigtts', name: 'Luna',      lang: '美式英语', scene: '多语种', model: '1.0', desc: '豆包/Cici/web demo' },
  { id: 'en_male_jason_conversation_wvae_bigtts',  name: '开朗学长',       lang: '中文',  scene: '通用',   model: '1.0', desc: '豆包' },

  // ── 客服专用 ──────────────────────────────────────────────────────────────
  { id: 'zh_female_kefunvsheng_mars_bigtts',       name: '暖阳女声',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_female_lixingyuanzi_cs_tob',       name: '理性圆子',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_female_qingtiantaotao_cs_tob',     name: '清甜桃桃',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_female_qingxixiaoxue_cs_tob',      name: '清晰小雪',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_female_qingtianmeimei_cs_tob',     name: '清甜莓莓',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_female_kailangtingting_cs_tob',    name: '开朗婷婷',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_male_qingxinmumu_cs_tob',          name: '清新沐沐',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_male_shuanglangxiaoyang_cs_tob',   name: '爽朗小阳',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_female_wenwanshanshan_cs_tob',     name: '温婉珊珊',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_female_tianmeixiaoyu_cs_tob',      name: '甜美小雨',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_female_reqingaina_cs_tob',         name: '热情艾娜',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'ICL_zh_female_qingyingduoduo_cs_tob',     name: '轻盈朵朵',        lang: '中文',  scene: '客服',   model: '1.0', desc: '' },
  { id: 'saturn_zh_female_qingyingduoduo_cs_tob',  name: '轻盈朵朵 2.0',    lang: '中文',  scene: '客服',   model: '2.0', desc: '指令遵循' },
  { id: 'saturn_zh_female_wenwanshanshan_cs_tob',  name: '温婉珊珊 2.0',    lang: '中文',  scene: '客服',   model: '2.0', desc: '指令遵循' },
  { id: 'saturn_zh_female_reqingaina_cs_tob',      name: '热情艾娜 2.0',    lang: '中文',  scene: '客服',   model: '2.0', desc: '指令遵循' },
];

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

// --list-voices [keyword]
if (args[0] === '--list-voices') {
  const keyword = args[1]?.toLowerCase();
  const filtered = keyword
    ? VOICE_CATALOG.filter(v =>
        v.id.toLowerCase().includes(keyword) ||
        v.name.toLowerCase().includes(keyword) ||
        v.lang.toLowerCase().includes(keyword) ||
        v.scene.toLowerCase().includes(keyword) ||
        v.desc.toLowerCase().includes(keyword))
    : VOICE_CATALOG;
  console.log(`\n${'ID'.padEnd(55)} ${'名称'.padEnd(22)} ${'语言'.padEnd(18)} ${'场景'.padEnd(10)} ${'版本'.padEnd(5)} 说明`);
  console.log('─'.repeat(130));
  for (const v of filtered) {
    console.log(`${v.id.padEnd(55)} ${v.name.padEnd(22)} ${v.lang.padEnd(18)} ${v.scene.padEnd(10)} ${v.model.padEnd(5)} ${v.desc}`);
  }
  console.log(`\n共 ${filtered.length} 个语音`);
  process.exit(0);
}

const projectArg = args.find(a => !a.startsWith('--'));
if (!projectArg) {
  console.error('Usage: node generate-video.mjs <project-dir> [--voice <voice>] [--screenshots-only] [--skip-screenshots] [--skip-audio] [--concat-only]');
  console.error('       node generate-video.mjs --list-voices [keyword]');
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
