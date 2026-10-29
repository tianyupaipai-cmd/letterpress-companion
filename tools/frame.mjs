// 画演示视频用的素材：纸色背景、手机外框（屏幕位置挖空）、片头、片尾。1080×1920 竖版
// 用法：node tools/frame.mjs，图出在 previews/_video/
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OUT = new URL('../previews/_video/', import.meta.url).pathname;

// 屏幕在画布里的位置（和 tools/cut.sh 里的数字对应）
const SW = 684, SH = 1480, SX = (1080 - SW) / 2, SY = 150;
const B = 20;   // 边框厚度
const FIBER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .37 0 0 0 0 .27 0 0 0 .22 -.05'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23f)'/%3E%3C/svg%3E")`;
const FONT = `<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@700;900&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">`;
const base = `*{margin:0;box-sizing:border-box}body{width:1080px;height:1920px;overflow:hidden;font-family:'PingFang SC',sans-serif}`;

const pages = {
  // 背景：纸色 + 纤维纹 + 手机下面的一团软影子
  bg: `<style>${base}body{background:#ECE7DD;background-image:${FIBER}}
    .sh{position:absolute;left:${SX - B}px;top:${SY - B}px;width:${SW + 2 * B}px;height:${SH + 2 * B}px;border-radius:${78}px;box-shadow:-3px -3px 0 rgba(255,255,255,.7),24px 40px 70px rgba(110,85,55,.28),60px 90px 140px rgba(110,85,55,.18)}</style><div class="sh"></div>`,
  // 外框：石墨色机身，屏幕处挖空（透明），四角盖住录屏的直角
  frame: `<style>${base}body{background:transparent}
    .ph{position:absolute;left:${SX - B}px;top:${SY - B}px;width:${SW + 2 * B}px;height:${SH + 2 * B}px;border-radius:78px;
      background:transparent;box-shadow:0 0 0 2px #4A4741 inset;}
    svg{position:absolute;left:0;top:0}</style>
    <svg width="1080" height="1920"><defs><mask id="m"><rect width="1080" height="1920" fill="white"/><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="58" fill="black"/></mask>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B3934"/><stop offset=".5" stop-color="#2B2A27"/><stop offset="1" stop-color="#211F1C"/></linearGradient></defs>
      <rect x="${SX - B}" y="${SY - B}" width="${SW + 2 * B}" height="${SH + 2 * B}" rx="78" fill="url(#g)" mask="url(#m)"/>
      <rect x="${SX - B + 1.5}" y="${SY - B + 1.5}" width="${SW + 2 * B - 3}" height="${SH + 2 * B - 3}" rx="76.5" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2" mask="url(#m)"/>
      <rect x="${SX - 3}" y="${SY - 3}" width="${SW + 6}" height="${SH + 6}" rx="61" fill="none" stroke="#151412" stroke-width="6"/>
      <rect x="${SX - B - 5}" y="${SY + 260}" width="5" height="90" rx="2.5" fill="#2B2A27"/><rect x="${SX - B - 5}" y="${SY + 370}" width="5" height="90" rx="2.5" fill="#2B2A27"/>
      <rect x="${SX + SW + B}" y="${SY + 300}" width="5" height="140" rx="2.5" fill="#2B2A27"/>
    </svg>`,
  card: (title, sub, foot) => `${FONT}<style>${base}body{background:#F3EFE7;background-image:${FIBER};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;color:#2B2A27}
    .seal{width:260px;height:260px;border-radius:50%;background:#F7F5F0;box-shadow:-3px -3px 0 rgba(255,255,255,.95),3px 3px 0 rgba(110,85,55,.12),14px 22px 30px rgba(110,85,55,.16),40px 60px 90px rgba(110,85,55,.14);display:flex;align-items:center;justify-content:center}
    .seal b{font-family:'Noto Serif SC',serif;font-size:96px;font-weight:900;color:#ECE8DF;text-shadow:-2px -2px 0 rgba(255,255,255,.95),3px 5px 5px rgba(110,85,55,.3)}
    h1{font-family:'Noto Serif SC',serif;font-size:76px;font-weight:900;letter-spacing:.08em;text-shadow:0 2px 0 rgba(255,255,255,.95),0 -1px 0 rgba(110,85,55,.15)}
    p{font-size:34px;color:#6E6A62;letter-spacing:.12em}
    .foot{position:absolute;bottom:140px;font-family:'JetBrains Mono',monospace;font-size:24px;color:#8C877D;letter-spacing:.2em}
    .line{width:120px;height:4px;background:linear-gradient(rgba(110,85,55,.18) 50%,rgba(255,255,255,.95) 50%)}</style>
    <div class="seal"><b>压</b></div><h1>${title}</h1><div class="line"></div><p>${sub}</p><div class="foot">${foot}</div>`
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const shot = async (name, html, transparent = false) => {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + name + '.png', omitBackground: transparent });
};
await shot('bg', pages.bg);
await shot('frame', pages.frame, true);
await shot('intro', pages.card('白纸压印', '一个会压印的伴侣 App', 'DEMO · 全模块演示'));
await shot('outro', pages.card('App 名', '聊天 · 通话 · 日历 · 相册 · 心潮念', '纯 HTML / CSS / JS · tmux 接入'));
await browser.close();
console.log('done', { SW, SH, SX, SY });
