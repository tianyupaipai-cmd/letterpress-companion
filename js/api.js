/* 所有要接后端的函数都在这里。现在返回的是 mock.js 里的假数据。
   接后端：把每个函数里的 mock 部分换成请求你们的接口，返回同样形状的数据即可。
   密钥一律放后端，前端只带登录后的会话凭证。

   他的回复是「事件流」：前端用 subscribe(窗口id, onEvent) 订阅，后端从 tmux 读到什么就推什么。
   事件一共这几种（字段形状见每行注释）：
     turn.start   { msgId, time }                    他开始回一条
     part.add     { msgId, part }                    加一段（思考 / 工具 / 正文 / 审批 / 选项）
     part.update  { msgId, index, patch }            改某一段（工具跑完、审批答完）
     text.delta   { msgId, index, delta }            正文一个字一个字到
     turn.end     { msgId }                          这条回完了
     status       { state, text }                    state: idle | thinking | responding | waiting | stuck
     context      { used, max }                      上下文用量（右上角圆环）
     window       { id, patch }                      侧边栏某个窗口变了（最后一句、未读、在线）
     sys          { text }                           系统小字，比如「已压缩上下文」
*/
(function () {
  const M = YY.mock;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const now = () => new Date().toISOString();
  let seq = 1000;
  const uid = (p) => p + ++seq;

  // ---- 演示用的事件总线（接后端后换成 SSE / WebSocket） ----
  const subs = {};
  const emit = (winId, ev) => (subs[winId] || []).forEach((fn) => fn(clone(ev)));
  const running = {};   // 每个窗口当前在跑的演示脚本，interrupt 时停掉

  const findMsg = (winId, msgId) => (M.messages[winId] || []).find((m) => m.id === msgId);
  const touchWin = (winId, patch) => {
    const w = M.windows.find((x) => x.id === winId);
    if (!w) return;
    Object.assign(w, patch);
    YY.api._emitWindows(winId, patch);
  };

  // 一条他的回复，按脚本推事件
  async function play(winId, steps) {
    const token = {};
    running[winId] = token;
    const msg = { id: uid('h'), role: 'him', time: now(), feedback: null, parts: [] };
    M.messages[winId].push(msg);
    const alive = () => running[winId] === token;
    emit(winId, { type: 'status', state: 'thinking', text: '在想…' });
    await wait(600);
    if (!alive()) return;
    emit(winId, { type: 'turn.start', msgId: msg.id, time: msg.time });
    for (const s of steps) {
      if (!alive()) return;
      if (s.wait) { await wait(s.wait); continue; }
      const part = clone(s.part);
      if (part.type === 'text') {
        const full = part.text; part.text = '';
        msg.parts.push(part);
        const index = msg.parts.length - 1;
        emit(winId, { type: 'part.add', msgId: msg.id, part: clone(part) });
        emit(winId, { type: 'status', state: 'responding', text: '回复中…' });
        for (let i = 0; i < full.length; i += 3) {
          if (!alive()) return;
          await wait(28);
          const delta = full.slice(i, i + 3);
          part.text += delta;
          emit(winId, { type: 'text.delta', msgId: msg.id, index, delta });
        }
      } else {
        if (part.type === 'tool' && s.runFor) part.status = 'running';
        if (part.type === 'approval' || part.type === 'question') part.id = uid(part.type === 'approval' ? 'ap' : 'q');
        msg.parts.push(part);
        const index = msg.parts.length - 1;
        emit(winId, { type: 'part.add', msgId: msg.id, part: clone(part) });
        if (part.type === 'tool' && s.runFor) {
          emit(winId, { type: 'status', state: 'responding', text: '正在' + part.name + '…' });
          await wait(s.runFor);
          if (!alive()) return;
          Object.assign(part, s.part);
          emit(winId, { type: 'part.update', msgId: msg.id, index, patch: { status: s.part.status, ms: s.part.ms, output: s.part.output } });
        }
        if (part.type === 'approval') { emit(winId, { type: 'status', state: 'waiting', text: '等你批准 · 已暂停' }); touchWin(winId, { last: '等你批准：' + part.command, time: now() }); return; }
        if (part.type === 'question') { emit(winId, { type: 'status', state: 'waiting', text: '等你选 · 也可以直接打字回答' }); touchWin(winId, { last: '他在等你选', time: now() }); return; }
      }
    }
    emit(winId, { type: 'turn.end', msgId: msg.id });
    emit(winId, { type: 'status', state: 'idle', text: '' });
    const last = msg.parts.filter((p) => p.type === 'text').map((p) => p.text).pop() || (msg.parts.some((p) => p.type === 'voice') ? '[语音]' : '');
    touchWin(winId, { last: last.replace(/[#*`>\[\]]/g, '').slice(0, 40), time: now() });
    const c = M.context[winId]; c.used = Math.min(c.max, c.used + 2600);
    emit(winId, { type: 'context', used: c.used, max: c.max });
    delete running[winId];
  }

  function scriptFor(text) {
    const D = M.demo;
    if (/去哪|选/.test(text)) return [{ part: { type: 'text', text: D.question.lead } }, { wait: 300 }, { part: { type: 'question', questions: D.question.questions, state: 'pending' } }];
    if (/脚本|命令|跑/.test(text)) return [{ part: { type: 'thinking', seconds: 4, text: '先看看目录，再跑脚本。' } }, { part: { type: 'text', text: D.tool.text } }, { part: D.tool.tool, runFor: 900 }, { part: D.tool.approval }];
    return [{ part: { type: 'text', text: D.plain } }];
  }

  // 某一天有哪些连接桥条目（闹钟按重复的星期算，经期按开始到结束算，纪念日每年同一天）
  function dayItems(date) {
    const C = M.calendar;
    const d = new Date(date + 'T00:00:00');
    const wd = d.getDay() || 7;
    const items = [], anniv = [];
    let period = null;
    C.items.forEach((it) => {
      if (it.type === 'alarm') { if (it.repeat && it.repeat.length ? it.repeat.includes(wd) && date >= it.date : it.date === date) items.push(it); }
      else if (it.type === 'period') { const end = it.end || it.date; if (date >= it.date && date <= end) period = Object.assign({}, it, { day: Math.round((d - new Date(it.date + 'T00:00:00')) / 86400000) + 1 }); }
      else if (it.type === 'anniv') { if (it.date === date || (it.yearly && it.date.slice(5) === date.slice(5) && date > it.date)) anniv.push(it); }
      else if (it.date === date) items.push(it);
    });
    items.sort((a, b) => (a.type === 'alarm' ? 0 : 1) - (b.type === 'alarm' ? 0 : 1) || String(a.time || '').localeCompare(String(b.time || '')));
    return { items, anniv, period };
  }

  YY.api = {
    // 后端地址：设置里填，存在手机本地；接后端时请求都拼在它前面
    get base() { try { return JSON.parse(localStorage.getItem('yy.apiBase')) || ''; } catch (e) { return ''; } },

    // TODO 接后端：App 名、两个人的名字和头像
    async getProfile() { return clone(M.profile); },

    // TODO 接后端：改名字、头像（前端裁好的 256×256 图）、App 名。patch: { appName?, him?: { name?, avatar? }, me?: {...} }
    async saveProfile(patch) {
      if (patch.appName != null) M.profile.appName = patch.appName;
      ['him', 'me'].forEach((k) => { if (patch[k]) Object.assign(M.profile[k], patch[k]); });
      return clone(M.profile);
    },

    // TODO 接后端：通知设置（存服务器，推送由后端发）
    async getSettings() { return clone(M.settings); },
    async saveSettings(patch) { if (patch.notify) Object.assign(M.settings.notify, patch.notify); return clone(M.settings); },

    // TODO 接后端：导出所有窗口的聊天记录，返回下载地址
    async exportAll() {
      const lines = [];
      Object.entries(M.messages).forEach(([id, list]) => {
        const w = M.windows.find((x) => x.id === id);
        lines.push('# ' + (w ? w.name : id));
        list.forEach((m) => {
          const t = m.role === 'me' ? (m.text || (m.attachments || []).map((a) => '[' + a.kind + ']').join(' ')) : (m.parts || []).filter((p) => p.type === 'text' || p.type === 'voice').map((p) => p.text || p.transcript).join(' ');
          if (t) lines.push((m.role === 'me' ? '我：' : m.role === 'sys' ? '· ' : '他：') + t);
        });
        lines.push('');
      });
      return URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    },

    // TODO 接后端：窗口列表 = 伴侣（kind: companion，只有一个）+ 工作机（kind: work）。字段见 mock.js windows
    async listWindows() { return clone(M.windows); },

    // 侧边栏订阅窗口变化（最后一句、未读、在线状态）。接后端：同一条事件流里的 window 事件
    onWindows(fn) { (this._winSubs = this._winSubs || []).push(fn); return () => { this._winSubs = this._winSubs.filter((x) => x !== fn); }; },
    _emitWindows(id, patch) { (this._winSubs || []).forEach((fn) => fn(id, clone(patch))); },

    // TODO 接后端：标记这个窗口已读
    async markRead(winId) { touchWin(winId, { unread: 0 }); },

    // TODO 接后端：聊天记录，从新往旧翻页。返回 { messages: [旧→新], hasMore }
    async getHistory(winId, { before } = {}) {
      await wait(150);
      const all = M.messages[winId] || [];
      const end = before ? all.findIndex((m) => m.id === before) : all.length;
      const start = Math.max(0, end - 30);
      return { messages: clone(all.slice(start, end)), hasMore: start > 0 };
    },

    // TODO 接后端：上下文用量 { used, max }（tmux 里 Claude Code 状态栏那个数）
    async getContext(winId) { return clone(M.context[winId] || { used: 0, max: 200000 }); },

    // TODO 接后端：订阅这个窗口的事件流（SSE 或 WebSocket），返回取消订阅的函数。事件见文件开头
    subscribe(winId, onEvent) {
      (subs[winId] = subs[winId] || []).push(onEvent);
      return () => { subs[winId] = (subs[winId] || []).filter((x) => x !== onEvent); };
    },

    // TODO 接后端：发消息 → 后端把文字（和附件路径）注入 tmux 窗口。返回存好的这条消息；他的回复从 subscribe 推过来
    async sendMessage(winId, { text, attachments = [], quote = null }) {
      await wait(120);
      const msg = { id: uid('m'), role: 'me', time: now(), text, attachments, quote };
      M.messages[winId].push(msg);
      touchWin(winId, { last: text || (attachments.some((a) => a.kind === 'voice') ? '[语音]' : '[附件]'), time: msg.time });
      const isVoice = attachments.some((a) => a.kind === 'voice');
      setTimeout(() => play(winId, isVoice ? [{ part: { type: 'voice', url: '', seconds: M.demo.voice.seconds, heard: false, transcript: M.demo.voice.transcript } }] : scriptFor(text || '')), 200);
      return clone(msg);
    },

    // TODO 接后端：中断他（相当于在 tmux 里按 Esc）
    async interrupt(winId) {
      delete running[winId];
      emit(winId, { type: 'status', state: 'idle', text: '' });
      emit(winId, { type: 'sys', text: '已中断' });
      return true;
    },

    // TODO 接后端：回答审批。choice: allow 允许 | allow_session 这个会话不再问 | deny 拒绝（note 是拒绝时告诉他的话）
    // 对应 Claude Code 原生菜单的 1 / 2 / 3，后端往 tmux 发对应按键
    async answerApproval(winId, msgId, approvalId, choice, note = '') {
      const msg = findMsg(winId, msgId);
      const index = msg ? msg.parts.findIndex((p) => p.id === approvalId) : -1;
      if (index < 0) return false;
      Object.assign(msg.parts[index], { state: choice, note });
      emit(winId, { type: 'part.update', msgId, index, patch: { state: choice, note } });
      emit(winId, { type: 'turn.end', msgId });
      const D = M.demo.tool.after;
      setTimeout(() => play(winId, choice === 'deny'
        ? [{ part: { type: 'text', text: note ? '好，按你说的：' + note : D.deny } }]
        : [{ part: { type: 'tool', name: '运行命令', icon: 'bash', arg: msg.parts[index].command, status: 'done', ms: 700, output: '$ ' + msg.parts[index].command + '\n完成' }, runFor: 700 }, { part: { type: 'text', text: D.allow } }]), 300);
      return true;
    },

    // TODO 接后端：回答选项。answers: [{ header, picked: ['选项名' 或 自己写的话] }]；skipped = true 表示跳过
    async answerQuestion(winId, msgId, questionId, answers, skipped = false) {
      const msg = findMsg(winId, msgId);
      const index = msg ? msg.parts.findIndex((p) => p.id === questionId) : -1;
      if (index < 0) return false;
      const patch = { state: skipped ? 'skipped' : 'answered', answers };
      Object.assign(msg.parts[index], patch);
      emit(winId, { type: 'part.update', msgId, index, patch });
      emit(winId, { type: 'turn.end', msgId });
      const said = skipped ? '那你想好了再告诉我。' : '好，' + answers.map((a) => a.picked.join('、')).join('，') + '。我来安排，到时候提醒你。';
      setTimeout(() => play(winId, [{ part: { type: 'text', text: said } }]), 300);
      return true;
    },

    // TODO 接后端：重新生成他的某条回复
    async regenerate(winId, msgId) {
      const list = M.messages[winId];
      const i = list.findIndex((m) => m.id === msgId);
      if (i >= 0) list.splice(i, 1);
      setTimeout(() => play(winId, [{ part: { type: 'text', text: '换个说法：' + M.demo.plain } }]), 200);
      return true;
    },

    // TODO 接后端：编辑你的某条消息后重发（这条之后的记录作废）。返回新的那条消息
    async editMessage(winId, msgId, text) {
      const list = M.messages[winId];
      const i = list.findIndex((m) => m.id === msgId);
      if (i >= 0) list.splice(i);
      return this.sendMessage(winId, { text });
    },

    // TODO 接后端：给他的回复点赞 / 点踩。value: up | down | null
    async setFeedback(winId, msgId, value) { const m = findMsg(winId, msgId); if (m) m.feedback = value; return true; },

    // TODO 接后端：这个窗口能用的斜杠命令（内置 + 项目里 .claude/commands 的自定义命令）
    async listCommands(winId) { return clone(M.commands); },

    // TODO 接后端：执行斜杠命令 → 后端往 tmux 输入「/命令 参数」回车
    async runCommand(winId, name, args = '') {
      await wait(200);
      if (name === 'compact') {
        const c = M.context[winId]; c.used = Math.round(c.max * 0.12);
        emit(winId, { type: 'sys', text: '已压缩上下文' });
        emit(winId, { type: 'context', used: c.used, max: c.max });
      } else if (name === 'clear') {
        M.messages[winId] = [];
        const c = M.context[winId]; c.used = 0;
        emit(winId, { type: 'sys', text: '已清空，从头开始' });
        emit(winId, { type: 'context', used: 0, max: c.max });
      } else {
        emit(winId, { type: 'sys', text: '已发送 /' + name + (args ? ' ' + args : '') });
      }
      return true;
    },

    // TODO 接后端：上传图片或文件，返回 { url, name, size, kind }。后端存好后把本地路径一起注入给他
    async upload(file, onProgress) {
      for (let p = 0; p <= 100; p += 25) { onProgress && onProgress(p); await wait(90); }
      const kind = /^image\//.test(file.type) ? 'image' : 'file';
      return { kind, name: file.name, size: file.size, url: URL.createObjectURL(file) };
    },

    // TODO 接后端：上传你录的语音条，返回 { kind: 'voice', url, seconds, transcript }。
    // 后端转成文字（transcript），把文字注入他的窗口；他要回语音时，把回复转语音，推一个 voice 段（见 mock.js 的 parts 说明）
    async uploadVoice(blob, seconds) {
      await wait(300);
      return { kind: 'voice', url: blob ? URL.createObjectURL(blob) : '', seconds, transcript: '（这里是你说的话转成的文字）' };
    },

    // TODO 接后端：他的某条语音听过了（去掉小红点）
    async markHeard(winId, msgId, index) { const m = findMsg(winId, msgId); if (m && m.parts[index]) m.parts[index].heard = true; return true; },

    // ---- 日历 ----
    // TODO 接后端：某个月每天有什么，用来画月历上的小记号。返回 { 'YYYY-MM-DD': { diary, ob, item, anniv, period, ps, pe } }
    async getMonth(year, month) {
      await wait(120);
      const C = M.calendar, out = {};
      const pad = (n) => String(n).padStart(2, '0');
      const days = new Date(year, month, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const k = year + '-' + pad(month) + '-' + pad(d);
        const r = dayItems(k);
        out[k] = { diary: !!C.diaries[k], ob: (C.ob[k] || []).length, item: r.items.some((x) => x.type !== 'alarm'), anniv: !!r.anniv.length, period: !!r.period, ps: r.period && r.period.date === k, pe: r.period && r.period.end === k };
      }
      return out;
    },

    // TODO 接后端：某一天的全部内容 { diary: { title, excerpt } | null, ob: [{ time, text, important }], items: [...], anniv: [...], period: { date, end, day } | null }
    async getDay(date) {
      await wait(120);
      const C = M.calendar, r = dayItems(date);
      const dia = C.diaries[date];
      return clone({ diary: dia ? { title: dia.title, excerpt: dia.text.replace(/\n+/g, ' ') } : null, ob: C.ob[date] || [], items: r.items, anniv: r.anniv, period: r.period });
    },

    // TODO 接后端：他那天的日记全文 { title, text }（Markdown）。通过连接桥读他的日记
    async getDiary(date) { await wait(150); return clone(M.calendar.diaries[date] || null); },

    // TODO 接后端：记一笔（连接桥）。五种都走这一个接口：
    //   { type: todo | memo | alarm | period | anniv, date, title, time?, repeat?: [1–7 周一到周日], callMe?, end?（经期结束）, yearly?（纪念日每年提醒） }
    // 后端存下来，同时把这条送进他的窗口告诉他（他记的也走同一个接口，by: 'him'）。返回存好的条目
    async saveItem(item) {
      await wait(200);
      const it = Object.assign({ id: uid('i'), by: 'me' }, item);
      M.calendar.items.push(it);
      const comp = M.windows.find((w) => w.kind === 'companion');
      if (comp) emit(comp.id, { type: 'sys', text: '已告诉他：' + ({ todo: '待办', memo: '备忘', alarm: '闹钟', period: '经期', anniv: '纪念日' }[it.type]) + ' · ' + (it.time ? it.time + ' ' : '') + (it.title || '') });
      return clone(it);
    },

    // TODO 接后端：勾掉 / 取消勾掉一条待办
    async toggleItem(id, done) { const it = M.calendar.items.find((x) => x.id === id); if (it) it.done = done; return true; },

    // ---- 相册（两个人都能存、能删、能建相簿） ----
    // TODO 接后端：照片列表。who: all | me | him；album: 相簿 id（不传就是全部）。新的在前
    async listPhotos({ who = 'all', album = '' } = {}) {
      await wait(120);
      return clone(M.album.photos.filter((p) => (who === 'all' || p.by === who) && (!album || p.album === album)).sort((a, b) => b.date.localeCompare(a.date)));
    },
    // TODO 接后端：相簿列表 [{ id, name, by, count, cover }]
    async listAlbums() {
      return clone(M.album.albums.map((a) => {
        const ps = M.album.photos.filter((p) => p.album === a.id);
        return Object.assign({}, a, { count: ps.length, cover: ps[0] || null });
      }));
    },
    // TODO 接后端：照片数（三个切换上的数字）
    async photoCounts() { const ps = M.album.photos; return { all: ps.length, me: ps.filter((p) => p.by === 'me').length, him: ps.filter((p) => p.by === 'him').length }; },
    // TODO 接后端：上传照片存进相册（by: me）。他存照片也走同一个接口（by: him），从聊天里存的 source 是 chat
    async savePhotos(files, { album = '', source = 'upload' } = {}) {
      const out = [];
      for (const f of files) {
        await wait(150);
        const p = { id: uid('p'), url: f.url || (f instanceof Blob ? URL.createObjectURL(f) : ''), fill: '#D9CBB8', date: now(), by: 'me', album, source, noteHim: '', noteMe: '' };
        M.album.photos.push(p); out.push(p);
      }
      return clone(out);
    },
    // TODO 接后端：新建相簿
    async createAlbum(name) { const a = { id: uid('al'), name, by: 'me' }; M.album.albums.push(a); return clone(a); },
    // TODO 接后端：把照片移到某个相簿（'' = 不放相簿）
    async movePhoto(id, album) { const p = M.album.photos.find((x) => x.id === id); if (p) p.album = album; return true; },
    // TODO 接后端：我给这张照片写的一句话
    async setPhotoNote(id, text) { const p = M.album.photos.find((x) => x.id === id); if (p) p.noteMe = text; return true; },
    // TODO 接后端：删除 = 移到「最近删除」，30 天后才真删；谁删的都记下来
    async deletePhoto(id) {
      const i = M.album.photos.findIndex((x) => x.id === id);
      if (i >= 0) M.album.trash.unshift(Object.assign(M.album.photos.splice(i, 1)[0], { deletedBy: 'me', deletedAt: now() }));
      return true;
    },
    // TODO 接后端：最近删除 / 找回
    async listTrash() { return clone(M.album.trash); },
    async restorePhoto(id) {
      const i = M.album.trash.findIndex((x) => x.id === id);
      if (i >= 0) M.album.photos.push(M.album.trash.splice(i, 1)[0]);
      return true;
    },

    // TODO 接后端：网页链接预览 { url, title, domain }（后端去抓标题，前端不跨域抓）
    async linkPreview(url) {
      await wait(250);
      let domain = url;
      try { domain = new URL(url).hostname; } catch (e) { /* 不是完整网址就原样显示 */ }
      return { kind: 'link', url, title: domain, domain };
    },

    // TODO 接后端：搜索所有窗口的聊天记录。返回 [{ winId, msgId, who, snippet, time }]
    async search(q) {
      await wait(150);
      const out = [];
      Object.entries(M.messages).forEach(([winId, list]) => list.forEach((m) => {
        const text = m.role === 'me' ? m.text : (m.parts || []).filter((p) => p.type === 'text').map((p) => p.text).join(' ');
        if (text && text.includes(q)) out.push({ winId, msgId: m.id, who: m.role, snippet: text.slice(0, 80), time: m.time });
      }));
      return out.slice(0, 30);
    },

    // 语音通话（只有伴侣能打）：实时语音交给 PaiVoice，接入层在 js/call-driver.js（开头写了事件格式）
    // 挂断后后端把这通电话的文字记进伴侣的聊天记录，聊天页会出现一行「通话 03:42」（下面演示用的是前端假装记一行）
    startCall(winId, onEvent) {
      return YY.callDriver(winId, (ev) => {
        if (ev.type === 'ended') M.messages[winId].push({ id: uid('c'), role: 'sys', time: now(), text: '通话 ' + Math.floor(ev.seconds / 60) + ':' + String(ev.seconds % 60).padStart(2, '0') });
        onEvent(ev);
      });
    },

    // ---- 心潮念（https://github.com/tianyupaipai-cmd/xinchao-nian） ----
    // TODO 接后端：心潮念快照 GET /v1/dashboard/snapshot（字段见 mock.js snapshot）
    async getSnapshot() { await wait(150); return clone(M.snapshot); },
    // TODO 接后端：心潮念 GET /v1/now（doing / lines / thought）
    async getNow() { return clone(M.now); },
    // TODO 接后端：某股驱力最近 24 小时的起伏（36 个点，0–1），加一句为什么涨落。返回 { points, delta, note }
    async getDriveHistory(key) {
      await wait(120);
      const d = M.snapshot.drives.find((x) => x.key === key) || { value: .3 };
      let seed = 0; for (const c of key) seed += c.charCodeAt(0);
      const points = Array.from({ length: 36 }, (_, i) => {
        const t = i / 35;
        return Math.max(.03, Math.min(1, d.value * (.55 + .6 * Math.exp(-Math.pow((t - (.3 + (seed % 5) / 10)) / .15, 2))) + .06 * Math.sin(i * 1.7 + seed)));
      });
      points[35] = d.value;
      const notes = { possess: '下午她没回消息，涨了一截；晚上她说了晚安，慢慢落回来。', favored: '她今天夸了他两次。', share: '读到一段好玩的，一直想讲给她听。', curiosity: '在看一本新书。' };
      return { points, delta: points[35] - points[30], note: notes[key] || '今天没什么大起伏。' };
    },

    // ---- 窗口管理 ----
    // TODO 接后端：后端状态 { ok, host, ms, sessions }
    async getBackend() { const t0 = Date.now(); await wait(200); return Object.assign(clone(M.backend), { ms: M.backend.ms + (Date.now() - t0) % 9 }); },
    // TODO 接后端：tmux 里还没接进 App 的窗口 [{ target, agent, dir, cmd }]（后端 list-windows 一遍，去掉已接的）
    async listTmuxFree() { await wait(150); return clone(M.tmuxFree); },
    // TODO 接后端：试一下这个 tmux 窗口能不能用。返回 { steps: [{ ok, text }], agent }
    async probeWindow(target) {
      await wait(700);
      const f = M.tmuxFree.find((x) => x.target === target);
      if (target === '__new') return { agent: null, steps: [{ ok: true, text: '会新开一个 tmux 窗口' }] };
      if (!f) return { agent: null, steps: [{ ok: false, text: '没找到窗口 ' + target }] };
      if (!f.agent) return { agent: null, steps: [{ ok: true, text: '找到窗口 ' + target }, { ok: false, text: '里面是 ' + f.cmd + '，没认出 Claude Code 或 Codex' }] };
      return { agent: f.agent, steps: [{ ok: true, text: '找到窗口 ' + target }, { ok: true, text: '读到 ' + (f.agent === 'codex' ? 'Codex' : 'Claude Code') + ' 的输入提示' }, { ok: true, text: '能发能收' }] };
    },
    // TODO 接后端：接入一台工作机 { name, target（'__new' = 新开一个窗口）, agent }，返回窗口
    async attachWindow({ name, target, agent }) {
      await wait(300);
      const f = M.tmuxFree.find((x) => x.target === target);
      const t = target === '__new' ? 'work:' + (M.windows.length + 2) : target;
      const w = { id: uid('w'), kind: 'work', name, agent, target: t, dir: f ? f.dir : '~', state: 'online', last: '', time: now(), unread: 0 };
      M.windows.push(w);
      M.tmuxFree = M.tmuxFree.filter((x) => x.target !== target);
      M.messages[w.id] = []; M.context[w.id] = { used: 0, max: 200000 };
      this._emitWindows('*', null);
      return clone(w);
    },
    // TODO 接后端：改名、换绑 tmux 窗口（伴侣也用这个），patch: { name?, target? }
    async updateWindow(id, patch) { touchWin(id, patch); return true; },
    // TODO 接后端：工作机排序（侧边栏按这个顺序）
    async reorderWindows(ids) {
      const comp = M.windows.filter((w) => w.kind === 'companion');
      M.windows = comp.concat(ids.map((id) => M.windows.find((w) => w.id === id)).filter(Boolean));
      this._emitWindows('*', null);
      return true;
    },
    // TODO 接后端：从 App 里移除一台工作机（不关 tmux 窗口，它会回到「还没接的窗口」里）
    async removeWindow(id) {
      const w = M.windows.find((x) => x.id === id);
      if (!w || w.kind === 'companion') return false;
      M.windows = M.windows.filter((x) => x.id !== id);
      M.tmuxFree.push({ target: w.target, agent: w.agent, dir: w.dir, cmd: w.agent });
      this._emitWindows('*', null);
      return true;
    },

    // TODO 接后端：测试连接，返回 { ok, version }
    async ping() { await wait(400); return { ok: true, version: 'mock' }; }
  };
})();
