// 录一段演示视频：真浏览器里把所有模块走一遍（开发用，不用部署）
// 用法：先在项目目录开 python3 -m http.server 4360，再 node tools/demo.mjs，视频出在 previews/演示视频.webm
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://localhost:4360/';
const OUT = new URL('../previews/', import.meta.url).pathname;
const W = 390, H = 844;
const VW = W, VH = H;   // 鼠标坐标就是手机尺寸
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: 'zh-CN', hasTouch: false
});
// 演示用：麦克风直接给「拿不到」，走演示录音；点哪里画一个小圆点
await ctx.addInitScript(() => {
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('demo'));
  addEventListener('pointerdown', (e) => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;background:rgba(217,119,87,.28);border:2px solid rgba(217,119,87,.6);z-index:99999;pointer-events:none;transition:transform .5s,opacity .5s`;
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 600);
  }, true);
});
const page = await ctx.newPage();
// 不用自带录像（它按 1 倍抓），直接从内核逐帧抓两倍清晰度的画面，最后用 ffmpeg 拼
const fs = require('fs');
const FR = OUT + '_video/frames/';
fs.mkdirSync(FR, { recursive: true });
const frames = [];
const cdp = await ctx.newCDPSession(page);
cdp.on('Page.screencastFrame', async (f) => {
  const name = String(frames.length).padStart(6, '0') + '.jpg';
  fs.writeFileSync(FR + name, Buffer.from(f.data, 'base64'));
  frames.push({ f: name, t: f.metadata.timestamp * 1000 - t0 });
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
const t0 = Date.now();
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });
const marks = [];   // 每一段的开始时间和字幕，录完交给 ffmpeg 压到视频下面
const cap = (text) => marks.push({ t: (Date.now() - t0) / 1000, text });
const tap = async (sel, pause = 700) => { await page.locator(sel).first().click(); await wait(pause); };
const type = async (sel, text, pause = 400) => { await page.locator(sel).first().click(); await page.keyboard.type(text, { delay: 90 }); await wait(pause); };
const scrollIn = (sel, y) => page.evaluate(([s, v]) => { const el = document.querySelector(s); el.scrollTo({ top: v === 'end' ? el.scrollHeight : v, behavior: 'smooth' }); }, [sel, y]);
const drawer = async (item) => { await tap('[data-act="drawer"]', 1200); await tap(item, 1400); };

await page.goto(BASE + '#/chat');
await wait(2200);

// ── 1 聊天：审批卡 → 允许 → 他接着跑命令、回复
cap('聊天 · 审批卡：允许后他接着跑命令');
await scrollIn('.msgs', 'end'); await wait(1200);
await tap('[data-approve="allow"]', 4200);

// ── 2 选项模式：他出两道题，选完提交
cap('选项模式：他出两道题，选完提交');
await type('#cp-input', '周末想出门，不知道去哪');
await tap('[data-act="send"]', 4200);
await tap('.q-opt >> nth=0', 900);
await tap('[data-qnext]', 1000);
await tap('.q-opt >> nth=1', 900);
await tap('[data-qnext]', 3800);

// ── 3 斜杠命令：/c → 压缩上下文（右上角圆环变了）
cap('斜杠命令：/compact 压缩上下文，右上角圆环跟着变');
await type('#cp-input', '/c', 1500);
await tap('[data-cmd="compact"]', 1800);

// ── 4 ＋ 附件
cap('＋ 附件：拍照 / 照片 / 文件 / 网页链接');
await tap('[data-act="plus"]', 1800);
await page.mouse.click(VW / 2, 240); await wait(900);

// ── 5 语音条：按住说话 → 松开发送 → 他回一条语音 → 播放、转文字
cap('语音条：按住说话、松开发送，他回语音，可转文字');
await tap('[data-act="mic"]', 900);
const hold = await page.locator('.hold').boundingBox();
await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2);
await page.mouse.down(); await wait(2600); await page.mouse.up(); await wait(3200);
await tap('.vbub.his [data-vplay] >> nth=-1', 1600);
await tap('[data-vtrans] >> nth=-1', 2400);
await tap('[data-act="kbd"]', 800);

// ── 6 语音通话：接通、他说话时圆章跟着动、字幕 → 收起回聊天 → 挂断
cap('语音通话：圆章跟着他的声音动，实时字幕，可收起');
await tap('a[href="#/call"]', 8500);
await tap('[data-act="min"]', 2200);
await tap('.call-pill', 1500);
await tap('[data-act="hang"]', 2500);

// ── 7 侧边栏（叠纸 + 发牌）→ 工作机
cap('侧边栏：叠纸 + 发牌，伴侣和工作机');
await tap('[data-act="drawer"]', 1800);
await tap('.sb-work >> nth=0', 2200);
await page.locator('.tool-row').nth(1).click(); await wait(1600);

// ── 8 日历：点一天 → 记一笔（闹钟）→ 保存
cap('日历：日记 / OB / 经期，记一笔走连接桥');
await drawer('.tile[href="#/calendar"]');
await tap('.cal-day.period >> nth=1', 1400);
await tap('.cal-day.today', 1200);
await scrollIn('.cal', 520); await wait(1600);
await tap('[data-act="add"] >> nth=0', 1000);
await tap('[data-t="alarm"]', 1000);
await tap('[data-r="6"]', 500);
await page.locator('.add-form [name="title"]').fill('周末也早点起'); await wait(600);
await tap('.add-save', 2000);

// ── 9 相册：切「他存的」→ 看大图 → 左右划 → 返回
cap('相册：两个人都能存、能管，谁存的一目了然');
await drawer('.tile[href="#/album"]');
await tap('[data-who="him"]', 1200);
await tap('[data-who="all"]', 1000);
await tap('[data-ph="p3"]', 2200);
await tap('[data-x="close"]', 1200);

// ── 10 心潮念：收音机指针扫过去、此刻在想压辊压字、键盘按一下弹出来、梦展开
cap('心潮念：收音机调频、压辊压字、键盘按一下弹出来');
await drawer('.tile[href="#/mood"]');
await wait(2000);
await tap('[data-mark="2"]', 1400);
await scrollIn('.md-page', 560); await wait(1400);
await tap('[data-key="favored"]', 1500);
await tap('[data-key="curiosity"]', 1500);
await tap('[data-key="possess"]', 1400);
await scrollIn('.md-page', 'end'); await wait(3200);
await tap('[data-dream="0"]', 2600);
await page.mouse.click(VW / 2, 200); await wait(900);

// ── 11 窗口管理：接入一台新工作机（自动认出 Codex、测三步）→ 进它的聊天
cap('窗口管理：接入新工作机，自动认出、测三步');
await page.goto(BASE + '#/windows'); await wait(1600);
await tap('[data-attach="work:3"]', 2000);
await page.locator('.nw [name="name"]').fill('博客'); await wait(700);
await tap('.nw-btns .btn-accent', 2200);

// ── 12 设置：换强调色和纸 → 回聊天看效果 → 换回来
cap('设置：换强调色和纸，全局跟着变');
await page.goto(BASE + '#/settings'); await wait(1600);
await tap('[data-accent="#7C8FA6"]', 900);
await tap('[data-paper="old"]', 1200);
await page.goto(BASE + '#/chat'); await wait(2200);
await page.evaluate(() => { localStorage.removeItem('yy.look'); YY.look.apply(); }); await wait(1500);

cap('');
await cdp.send('Page.stopScreencast');
await wait(300);
fs.writeFileSync(OUT + '_video/frames.json', JSON.stringify(frames));
await ctx.close();
await browser.close();
require('fs').writeFileSync(OUT + '_video/marks.json', JSON.stringify(marks));
console.log('done');
