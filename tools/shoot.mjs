// 截每页的预览图到 previews/（开发用，不用部署）
// 用法：先在项目目录开 python3 -m http.server 4360，再 node tools/shoot.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://localhost:4360/';
const OUT = new URL('../previews/', import.meta.url).pathname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'zh-CN' });
const go = async (hash) => { await page.goto(BASE + hash); await page.reload(); await wait(1200); };
const shot = (name) => page.screenshot({ path: OUT + name + '.png' });

// 01 对话中（审批卡）
await go('#/chat');
await shot('01-聊天-对话中');

// 02 侧边栏
await page.click('[data-act="drawer"]');
await wait(1100);
await shot('02-侧边栏');

// 03 选项模式
await go('#/chat');
await page.fill('#cp-input', '周末去哪');
await page.click('[data-act="send"]');
await wait(3500);
await page.click('.q-opt >> nth=0');
await wait(200);
await shot('03-聊天-选项模式');

// 04 加号附件
await page.click('[data-act="plus"]');
await wait(700);
await shot('04-加号-附件');
await page.click('.bs-mask');
await wait(400);

// 05 斜杠命令
await page.fill('#cp-input', '/c');
await page.dispatchEvent('#cp-input', 'input');
await wait(500);
await shot('05-斜杠命令');

// 06 工作机
await go('#/chat/desk');
await page.click('.tool-row >> nth=1');
await wait(300);
await shot('06-工作机');

// 07 语音通话（等他说到一半）
await go('#/call');
await wait(7700);
await shot('07-语音通话');

// 08 日历
await go('#/calendar');
await shot('08-日历');

// 09 记一笔（闹钟）
await page.click('[data-act="add"] >> nth=0');
await wait(500);
await page.click('[data-t="alarm"]');
await wait(400);
await shot('09-记一笔');

// 10 语音条（放着他那条、展开文字）
await go('#/chat');
await page.evaluate(() => { document.querySelector('.msgs').scrollTop = 0; });
await page.click('.vbub.his [data-vplay] >> nth=0');
await page.click('[data-vtrans] >> nth=0');
await wait(1600);
await shot('10-语音条');

// 11 相册
await go('#/album');
await shot('11-相册');

// 12 看大图（他存的、他写了一句）
await page.click('[data-ph="p3"]');
await wait(500);
await shot('12-相册-看大图');

// 13 窗口管理
await go('#/windows');
await shot('13-窗口管理');

// 14 接入新工作机
await page.click('[data-attach="work:3"]');
await wait(1400);
await page.fill('.nw [name="name"]', '博客');
await shot('14-接入新工作机');

// 15 设置
await go('#/settings');
await shot('15-设置');

// 16 心潮念（等针扫到、压辊压完）
await go('#/mood');
await wait(2600);
await shot('16-心潮念');
await page.evaluate(() => { document.querySelector('.md-page').scrollTop = 560; });
await page.click('[data-key="curiosity"]');
await wait(1200);
await shot('17-心潮念-键盘');

await browser.close();
console.log('done');
