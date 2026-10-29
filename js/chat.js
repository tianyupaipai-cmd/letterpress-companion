/* 聊天页：#/chat 是伴侣，#/chat/窗口id 是工作机。两种用同一套。
   他的回复按 parts 一段段画：思考、工具、正文、审批、选项。事件从 api.subscribe 推过来。 */
(function () {
  const U = YY.util, api = YY.api, I = U.icon;

  YY.pages.chat = {
    async render(view, winId) {
      const wins = YY.sidebar.windows();
      const profile = YY.sidebar.profile();
      const win = winId ? wins.find((w) => w.id === winId) : wins.find((w) => w.kind === 'companion');
      if (!win) { view.innerHTML = '<p class="soft" style="padding:120px 24px;text-align:center">没有这个窗口</p>'; return; }
      YY.sidebar.setCurrent(win.id);
      const isComp = win.kind === 'companion';
      const title = isComp ? profile.him.name : win.name;

      view.innerHTML = `
        <header class="ch-head">
          <button type="button" class="ibtn rz" data-act="drawer" aria-label="打开侧边栏">${I.menu}</button>
          <button type="button" class="ch-title" data-act="switch" aria-label="切换窗口"><b><span>${U.esc(title)}</span>${I.chevDown}</b><small>${U.esc(win.agent)} · ${U.esc(win.target)}</small></button>
          ${isComp ? `<a href="#/call" class="ibtn rz" aria-label="语音通话">${I.phone}</a>` : ''}
          <button type="button" class="ibtn wl ring" data-act="ctx" aria-label="上下文用量">
            <svg viewBox="0 0 30 30" aria-hidden="true"><circle class="track" cx="15" cy="15" r="11" fill="none" stroke-width="3.2"/><circle class="arc" cx="15" cy="15" r="11" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="0 69.1" transform="rotate(-90 15 15)"/></svg>
            <span>0</span>
          </button>
        </header>
        <div class="crease ch-crease"></div>
        <div class="msgs" role="log" aria-live="polite"></div>
        <div class="status idle" aria-live="polite"></div>
        <div class="cp"></div>`;

      const msgsEl = U.$('.msgs', view);
      const statusEl = U.$('.status', view);
      const ringEl = U.$('.ring', view);
      const state = { list: [], hasMore: false, busy: false, ctx: { used: 0, max: 1 }, lastEventAt: Date.now(), status: 'idle' };
      const byId = new Map();   // msgId → { data, el, ui }

      const composer = YY.composer.mount(U.$('.cp', view), {
        winId: win.id, agent: win.agent,
        placeholder: '回复 ' + title + '…',
        onSend: async (payload) => {
          const m = await api.sendMessage(win.id, payload);
          addMessage(m, true);
          scrollBottom(true);
        },
        onVoice: async ({ blob, seconds }) => {
          const att = await api.uploadVoice(blob, seconds);
          const m = await api.sendMessage(win.id, { text: '', attachments: [att] });
          addMessage(m, true);
          scrollBottom(true);
        },
        onCommand: (name, args) => api.runCommand(win.id, name, args),
        onStop: () => api.interrupt(win.id)
      });

      // ---- 顶栏 ----
      U.$('[data-act="drawer"]', view).addEventListener('click', () => YY.shell.open());
      U.$('[data-act="switch"]', view).addEventListener('click', openSwitch);
      ringEl.addEventListener('click', openCtx);

      function paintRing() {
        const pct = Math.round((state.ctx.used / state.ctx.max) * 100);
        U.$('.arc', ringEl).setAttribute('stroke-dasharray', (69.1 * pct / 100).toFixed(1) + ' 69.1');
        U.$('span', ringEl).textContent = pct;
        ringEl.classList.toggle('warn', pct >= 85);
        ringEl.setAttribute('aria-label', '上下文已用 ' + pct + '%');
      }

      function openCtx() {
        const pct = Math.round((state.ctx.used / state.ctx.max) * 100);
        const k = (n) => Math.round(n / 1000) + 'k';
        U.openSheet(`
          <div class="bs-title"><h2>上下文</h2><span class="mono">${U.esc(win.target)}</span></div>
          <div class="ctx-big"><b>${pct}%</b><span>${k(state.ctx.used)} / ${k(state.ctx.max)}</span></div>
          <div class="ctx-bar wl"><i style="width:${pct}%"></i></div>
          <p class="ctx-tip">${pct >= 85 ? '快满了，压缩一下他会记得更清楚。' : '用到八成多的时候，可以压缩一下。'}</p>
          <div class="ctx-btns">
            <button type="button" class="rz-s" data-cmd="compact">压缩<small>/compact</small></button>
            <button type="button" class="rz-s" data-cmd="context">看详情<small>/context</small></button>
          </div>`, (el, close) => {
          U.$$('[data-cmd]', el).forEach((b) => b.addEventListener('click', () => { close(); api.runCommand(win.id, b.dataset.cmd); }));
        }, '上下文用量');
      }

      function openSwitch() {
        const list = YY.sidebar.windows();
        U.openSheet(`
          <div class="bs-title"><h2>切换</h2></div>
          <div class="menu rz-s">${list.map((w) => `<button type="button" data-id="${w.id}">${w.kind === 'companion' ? I.wave : I.term}<span style="flex:1">${U.esc(w.kind === 'companion' ? profile.him.name : w.name)}</span><span class="mono soft" style="font-size:11px">${w.state === 'offline' ? '离线' : U.esc(w.agent)}</span></button>`).join('')}</div>`, (el, close) => {
          U.$$('[data-id]', el).forEach((b) => b.addEventListener('click', () => {
            close();
            const w = list.find((x) => x.id === b.dataset.id);
            location.hash = w.kind === 'companion' ? '#/chat' : '#/chat/' + encodeURIComponent(w.id);
          }));
        }, '切换窗口');
      }

      // ---- 消息 ----
      const nearBottom = () => msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 120;
      const scrollBottom = (force) => { if (force || nearBottom()) requestAnimationFrame(() => { msgsEl.scrollTop = msgsEl.scrollHeight; }); };

      function textOf(m) {
        return m.role === 'me' ? m.text : (m.parts || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n\n');
      }

      function attHTML(a) {
        if (a.kind === 'image') return `<button type="button" class="att img rz-s" data-view="${U.esc(a.url)}" aria-label="看大图 ${U.esc(a.name)}">${a.url ? `<img src="${U.esc(a.url)}" alt="">` : `<span style="display:flex;height:100%;align-items:center;justify-content:center;color:var(--ink-3)">${I.image}</span>`}</button>`;
        if (a.kind === 'link') return `<a class="linkcard rz-s" href="${U.esc(a.url)}" target="_blank" rel="noopener noreferrer"><span class="fav wl">${I.globe}</span><span class="t"><b>${U.esc(a.title || a.domain)}</b><small>${U.esc(a.url)}</small></span>${I.ext}</a>`;
        return `<a class="att file rz-s" ${a.url ? `href="${U.esc(a.url)}" download="${U.esc(a.name)}"` : ''}>${I.file}<span style="display:flex;flex-direction:column"><b>${U.esc(a.name)}</b><small>${U.fmtSize(a.size || 0)} · ${U.ext(a.name)}</small></span></a>`;
      }

      // 语音条（key = 消息id:位置，播放器靠它认是哪一条）
      const PLAY = '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.8l7 4.2-7 4.2z"/></svg>';
      const PAUSE = '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2.5 1.5h2.4v9H2.5zM7.1 1.5h2.4v9H7.1z"/></svg>';
      function voiceHTML(v, key, mine, extra = '') {
        const hs = YY.voice.bars(key, v.seconds || 1);
        return `<div class="vbub ${mine ? 'mine' : 'his rz'}" data-vkey="${key}">
          <button type="button" class="vplay ${mine ? 'rz-s' : 'rz-s'}" data-vplay="${key}" aria-label="${mine ? '播放你的语音' : '播放他的语音'}">${PLAY}</button>
          <span class="vbars" aria-hidden="true">${hs.map((h) => `<i style="height:${h}px"></i>`).join('')}</span>
          <span class="vlen">${YY.voice.len(v.seconds || 0)}</span>${extra}
        </div>`;
      }

      function meHTML(m) {
        const atts = (m.attachments || []);
        const voices = atts.filter((a) => a.kind === 'voice');
        const files = atts.filter((a) => a.kind !== 'link' && a.kind !== 'voice');
        const links = atts.filter((a) => a.kind === 'link');
        return voices.map((v, i) => voiceHTML(v, m.id + ':a' + i, true) + (v.transcript ? `<span class="vtrans-me">“${U.esc(v.transcript)}”</span>` : '')).join('') +
          (files.length ? `<div class="atts">${files.map(attHTML).join('')}</div>` : '') +
          (links.length ? links.map(attHTML).join('') : '') +
          (m.quote ? `<div class="quote wl-s"><span>引用：${U.esc(m.quote.text)}</span></div>` : '') +
          (m.text ? `<div class="bubble-me">${U.esc(m.text)}</div>` : '');
      }

      const toolIcon = (p) => {
        if (p.status === 'running') return `<span class="ic run">${I.spin}</span>`;
        if (p.status === 'error') return `<span class="ic err">${I.x}</span>`;
        if (p.status === 'done' && p.icon !== 'bash') return `<span class="ic ok">${I.check}</span>`;
        return `<span class="ic">${p.icon === 'edit' ? I.edit : p.icon === 'read' ? I.read : I.term}</span>`;
      };
      const outHTML = (s) => U.esc(s || '').replace(/\[\[err\]\](.*)/g, '<span class="err">$1</span>');

      function partHTML(p, i, rec) {
        const ui = rec.ui;
        if (p.type === 'thinking') {
          const open = !!ui.open[i];
          return `<button type="button" class="think rz-s" data-toggle="${i}" aria-expanded="${open}">${I.clock}思考了 ${p.seconds || 1} 秒<span class="chev">${I.chevRight}</span></button>` +
            (open ? `<div class="think-body wl-s">${U.esc(p.text || '')}</div>` : '');
        }
        if (p.type === 'text') {
          const live = rec.streaming && i === rec.data.parts.length - 1;
          return `<div class="md" data-text="${i}">${YY.md(p.text)}${live ? '<span class="caret" aria-hidden="true"></span>' : ''}</div>`;
        }
        if (p.type === 'tool') {
          const open = !!ui.open[i];
          const ms = p.ms ? (p.ms >= 1000 ? (p.ms / 1000).toFixed(1) + 's' : (p.ms / 1000).toFixed(1) + 's') : '';
          return `<div class="tool"><button type="button" class="tool-row" data-toggle="${i}" aria-expanded="${open}" ${p.output ? '' : 'disabled'}>
              ${toolIcon(p)}<span class="name">${U.esc(p.name)}</span><span class="arg">${U.esc(p.arg || '')}</span>
              ${p.output ? `<span class="chev">${I.chevDown}</span>` : `<span class="ms">${p.status === 'running' ? '…' : ms}</span>`}
            </button>${open && p.output ? `<div class="tool-out cut">${outHTML(p.output)}</div>` : ''}</div>`;
        }
        if (p.type === 'voice') {
          const key = rec.data.id + ':' + i;
          const open = !!ui.vt[i];
          return `<div style="display:flex;flex-direction:column;gap:10px">` +
            voiceHTML(p, key, false, p.heard ? '' : '<i class="vnew" aria-label="没听过"></i>') +
            (open && p.transcript ? `<div class="vtrans wl-s">${U.esc(p.transcript)}</div>` : '') +
            `<div class="vctl">${p.transcript ? `<button type="button" data-vtrans="${i}">${open ? '收起文字' : '转文字'}</button>` : ''}<button type="button" data-vrate>${rate}×</button></div></div>`;
        }
        if (p.type === 'approval') {
          if (p.state !== 'pending') {
            const label = { allow: '已允许', allow_session: '已允许 · 本会话不再问', deny: '已拒绝' }[p.state] || p.state;
            return `<div class="ask-done rz-s${ui.stamped === i ? ' stamp' : ''}">${p.state === 'deny' ? I.x : I.check}${label}<span class="mono">${U.esc(p.command)}</span></div>` +
              (p.note ? `<p class="soft" style="margin:-4px 0 0;font-size:13px">你说：${U.esc(p.note)}</p>` : '');
          }
          return `<section class="ask rz" aria-label="需要你批准">
            <div class="ask-head">${I.shield}<b>需要你批准</b><span class="mono">${U.esc(p.tool)}</span></div>
            <div class="ask-cmd cut">${U.esc(p.command)}</div>
            ${p.cwd ? `<div class="ask-cwd">在 ${U.esc(p.cwd)}</div>` : ''}
            ${ui.denyOpen === i ? `<form class="ask-note" data-deny="${i}">
                <label class="sr" for="deny-${i}">告诉他换个做法</label>
                <input id="deny-${i}" class="wl" placeholder="告诉他换个做法（可以不写）">
                <button type="submit" class="rz-s">发送</button>
              </form>` : `<div class="ask-opts">
                <button type="button" class="ask-opt primary" data-approve="allow" data-i="${i}"><span class="mono">1</span>允许</button>
                <button type="button" class="ask-opt rz-s" data-approve="allow_session" data-i="${i}"><span class="mono">2</span>允许，这个会话里不再问</button>
                <button type="button" class="ask-opt deny" data-approve="deny" data-i="${i}"><span class="mono">3</span>拒绝，告诉他换个做法</button>
              </div>`}
          </section>`;
        }
        if (p.type === 'question') {
          if (p.state !== 'pending') {
            const summary = p.state === 'skipped' ? '跳过了' : '你选了：' + (p.answers || []).map((a) => a.picked.join('、')).join(' · ');
            return `<div class="ask-done rz-s${ui.stamped === i ? ' stamp' : ''}">${p.state === 'skipped' ? I.x : I.check}<span style="font-family:var(--font-sans);font-size:13px;color:var(--ink-2)">${U.esc(summary)}</span></div>`;
          }
          const qs = ui.q[i] = ui.q[i] || { tab: 0, picks: p.questions.map(() => []), other: p.questions.map(() => '') };
          const cur = p.questions[qs.tab];
          const picked = qs.picks[qs.tab];
          const otherOn = !!qs.other[qs.tab].trim();
          const ready = picked.length || otherOn;
          const last = qs.tab === p.questions.length - 1;
          return `<section class="q rz" aria-label="他的提问">
            ${p.questions.length > 1 ? `<div class="q-tabs">${p.questions.map((x, t) => `<button type="button" class="q-tab${t === qs.tab ? ' on' : ''}${t !== qs.tab && (qs.picks[t].length || qs.other[t].trim()) ? ' done' : ''}" data-qtab="${t}" data-i="${i}">${U.esc(x.header || '第 ' + (t + 1) + ' 题')}</button>`).join('')}<span class="mono">${qs.tab + 1} / ${p.questions.length}</span></div>` : ''}
            <div class="q-title">${U.esc(cur.question)}${cur.multi ? '<small>可以多选</small>' : ''}</div>
            <div class="q-opts" role="${cur.multi ? 'group' : 'radiogroup'}">
              ${cur.options.map((o, k) => `<button type="button" class="q-opt${cur.multi ? ' multi' : ''}${picked.includes(o.label) ? ' on' : ''}" data-qopt="${k}" data-i="${i}" role="${cur.multi ? 'checkbox' : 'radio'}" aria-checked="${picked.includes(o.label)}">
                <span class="mark"></span><span class="txt"><b>${U.esc(o.label)}</b>${o.desc ? `<small>${U.esc(o.desc)}</small>` : ''}</span></button>`).join('')}
              <label class="q-other${otherOn ? ' on' : ''}"><span class="mark"></span><input data-qother="${i}" value="${U.esc(qs.other[qs.tab])}" placeholder="其他，自己写…" aria-label="其他答案"></label>
            </div>
            <div class="q-foot">
              ${qs.tab > 0 ? `<button type="button" class="back" data-qback="${i}">上一题</button>` : `<button type="button" class="skip" data-qskip="${i}">跳过</button>`}
              <button type="button" class="next btn-accent" data-qnext="${i}" ${ready ? '' : 'disabled'}>${last ? '提交' : '下一题'}${last ? '' : `<span style="width:14px;height:14px;display:inline-flex">${I.chevRight}</span>`}</button>
            </div>
          </section>`;
        }
        return '';
      }

      // 连着的工具调用合成一张卡
      function himInner(rec, animateFrom = Infinity) {
        const parts = rec.data.parts || [];
        let html = `<div class="him-name"><span class="seal rz-s"><i></i></span>${U.esc(profile.him.name && isComp ? profile.him.name : win.name)}</div>`;
        let i = 0;
        while (i < parts.length) {
          const cls = i >= animateFrom ? ' part' : '';
          if (parts[i].type === 'tool') {
            let group = '';
            const start = i;
            while (i < parts.length && parts[i].type === 'tool') { group += partHTML(parts[i], i, rec); i++; }
            html += `<div class="tools rz${start >= animateFrom ? ' part' : ''}">${group}</div>`;
            continue;
          }
          html += cls ? `<div class="${cls.trim()}" style="display:contents">${partHTML(parts[i], i, rec)}</div>` : partHTML(parts[i], i, rec);
          i++;
        }
        const waiting = parts.some((p) => (p.type === 'approval' || p.type === 'question') && p.state === 'pending');
        if (!rec.streaming && !waiting && parts.some((p) => p.type === 'text')) {
          const fb = rec.data.feedback;
          html += `<div class="acts">
            <button type="button" data-a="copy" aria-label="复制">${I.copy}</button>
            <button type="button" data-a="redo" aria-label="重新生成">${I.redo}</button>
            <button type="button" data-a="up" class="${fb === 'up' ? 'on' : ''}" aria-label="有帮助" aria-pressed="${fb === 'up'}">${I.up}</button>
            <button type="button" data-a="down" class="${fb === 'down' ? 'on' : ''}" aria-label="没帮助" aria-pressed="${fb === 'down'}">${I.down}</button>
          </div>`;
        }
        return html;
      }

      function paintHim(rec, animateFrom) {
        rec.el.classList.toggle('streaming', !!rec.streaming);
        rec.el.innerHTML = himInner(rec, animateFrom);
        // display:contents 包裹层里的动画要挂到真正的子元素上
        U.$$('.part[style*="contents"]', rec.el).forEach((w) => { Array.from(w.children).forEach((c) => c.classList.add('part')); w.replaceWith(...w.children); });
        // 重画时正在放的那条语音保持「播放中」
        const pk = YY.voice.playing();
        const pb = pk && pk.startsWith(rec.data.id + ':') && U.$(`[data-vkey="${CSS.escape(pk)}"]`, rec.el);
        if (pb) { pb.classList.add('playing'); U.$('.vplay', pb).innerHTML = PAUSE; }
      }

      let lastTime = 0;
      function addMessage(m, fresh = false, prepend = false) {
        const t = new Date(m.time).getTime();
        const frag = document.createDocumentFragment();
        if (!prepend && t - lastTime > 10 * 60000) {
          const ts = document.createElement('div'); ts.className = 'ts'; ts.textContent = U.tsLabel(m.time); frag.appendChild(ts);
        }
        if (!prepend) lastTime = t;
        const el = document.createElement('div');
        el.dataset.id = m.id;
        const rec = { data: m, el, ui: { open: {}, q: {}, vt: {} }, streaming: false };
        byId.set(m.id, rec);
        if (m.role === 'me') {
          el.className = 'me' + (fresh ? ' new' : '');
          el.innerHTML = meHTML(m);
        } else if (m.role === 'sys') {
          el.className = 'sysline'; el.textContent = m.text;
        } else {
          el.className = 'him';
          paintHim(rec);
        }
        frag.appendChild(el);
        U.$('.empty', msgsEl) && U.$('.empty', msgsEl).remove();
        if (prepend) msgsEl.insertBefore(frag, msgsEl.querySelector('.more') ? msgsEl.querySelector('.more').nextSibling : msgsEl.firstChild);
        else msgsEl.appendChild(frag);
        return rec;
      }

      function showEmpty() {
        const h = new Date().getHours();
        const hi = h < 5 ? '还没睡呀' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
        msgsEl.innerHTML = `<div class="empty"><span class="roller" aria-hidden="true"></span><h2>${hi}，${U.esc(profile.me.name)}</h2><p>${isComp ? '想说什么都可以' : '给这台工作机派点活'}</p></div>`;
      }

      // ---- 语音条播放 ----
      let rate = U.store.get('voiceRate', 1);
      function playVoice(key) {
        const [msgId, pos] = key.split(':');
        const r = byId.get(msgId);
        if (!r) return;
        const v = pos[0] === 'a' ? r.data.attachments[+pos.slice(1)] : r.data.parts[+pos];
        const box = () => U.$(`[data-vkey="${CSS.escape(key)}"]`, msgsEl);
        const paintBar = (p, t) => {
          const b = box(); if (!b) return;
          const bars = U.$$('.vbars i', b);
          bars.forEach((x, k) => x.classList.toggle('on', k < Math.round(p * bars.length)));
          U.$('.vlen', b).textContent = t == null ? YY.voice.len(v.seconds) : YY.voice.len(t) + ' / ' + YY.voice.len(v.seconds);
        };
        const started = YY.voice.play(key, {
          url: v.url, seconds: v.seconds, rate,
          onTick: paintBar,
          onEnd: () => { const b = box(); if (b) { b.classList.remove('playing'); U.$('.vplay', b).innerHTML = PLAY; paintBar(0, null); } }
        });
        if (!started) return;
        const b = box(); b.classList.add('playing'); U.$('.vplay', b).innerHTML = PAUSE;
        // 他的语音听过了，小红点去掉
        if (pos[0] !== 'a' && !v.heard) { v.heard = true; const dot = U.$('.vnew', b); if (dot) dot.remove(); api.markHeard(win.id, msgId, +pos); }
      }

      // ---- 点击（事件委托） ----
      msgsEl.addEventListener('click', async (e) => {
        const vp = e.target.closest('[data-vplay]');
        if (vp) { playVoice(vp.dataset.vplay); return; }
        const vr = e.target.closest('[data-vrate]');
        if (vr) { rate = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1; U.store.set('voiceRate', rate); YY.voice.setRate(rate); U.$$('[data-vrate]', msgsEl).forEach((b) => { b.textContent = rate + '×'; }); return; }
        const view = e.target.closest('[data-view]');
        if (view && view.dataset.view) { openViewer(view.dataset.view); return; }
        const host = e.target.closest('.him');
        if (e.target.closest('.more')) { loadOlder(); return; }
        if (!host) return;
        const rec = byId.get(host.dataset.id);
        const vt = e.target.closest('[data-vtrans]');
        if (vt) { const i = +vt.dataset.vtrans; rec.ui.vt[i] = !rec.ui.vt[i]; paintHim(rec); return; }
        const tg = e.target.closest('[data-toggle]');
        if (tg) { const i = +tg.dataset.toggle; rec.ui.open[i] = !rec.ui.open[i]; paintHim(rec); return; }
        const ap = e.target.closest('[data-approve]');
        if (ap) {
          const i = +ap.dataset.i, p = rec.data.parts[i];
          if (ap.dataset.approve === 'deny') { rec.ui.denyOpen = i; paintHim(rec); setTimeout(() => { const inp = U.$('#deny-' + i, rec.el); inp && inp.focus(); }, 50); return; }
          answerApproval(rec, i, p, ap.dataset.approve, '');
          return;
        }
        const qt = e.target.closest('[data-qtab]');
        if (qt) { rec.ui.q[+qt.dataset.i].tab = +qt.dataset.qtab; paintHim(rec); return; }
        const qo = e.target.closest('[data-qopt]');
        if (qo) {
          const i = +qo.dataset.i, qs = rec.ui.q[i], cur = rec.data.parts[i].questions[qs.tab];
          const label = cur.options[+qo.dataset.qopt].label;
          const arr = qs.picks[qs.tab];
          if (cur.multi) { const k = arr.indexOf(label); if (k >= 0) arr.splice(k, 1); else arr.push(label); }
          else { qs.picks[qs.tab] = arr[0] === label ? [] : [label]; qs.other[qs.tab] = ''; }
          paintHim(rec); return;
        }
        const qb = e.target.closest('[data-qback]');
        if (qb) { rec.ui.q[+qb.dataset.qback].tab--; paintHim(rec); return; }
        const qsk = e.target.closest('[data-qskip]');
        if (qsk) { const i = +qsk.dataset.qskip; await api.answerQuestion(win.id, rec.data.id, rec.data.parts[i].id, [], true); return; }
        const qn = e.target.closest('[data-qnext]');
        if (qn) {
          const i = +qn.dataset.qnext, qs = rec.ui.q[i], p = rec.data.parts[i];
          if (qs.tab < p.questions.length - 1) { qs.tab++; paintHim(rec); return; }
          const answers = p.questions.map((x, t) => ({ header: x.header, picked: qs.picks[t].concat(qs.other[t].trim() ? [qs.other[t].trim()] : []) }));
          await api.answerQuestion(win.id, rec.data.id, p.id, answers);
          return;
        }
        const a = e.target.closest('[data-a]');
        if (a) {
          const k = a.dataset.a;
          if (k === 'copy') U.copy(textOf(rec.data));
          if (k === 'redo') { await api.regenerate(win.id, rec.data.id); rec.el.remove(); byId.delete(rec.data.id); }
          if (k === 'up' || k === 'down') {
            rec.data.feedback = rec.data.feedback === k ? null : k;
            api.setFeedback(win.id, rec.data.id, rec.data.feedback);
            paintHim(rec);
          }
        }
      });
      msgsEl.addEventListener('input', (e) => {
        const inp = e.target.closest('[data-qother]');
        if (!inp) return;
        const rec = byId.get(inp.closest('.him').dataset.id), i = +inp.dataset.qother, qs = rec.ui.q[i];
        qs.other[qs.tab] = inp.value;
        if (inp.value.trim() && !rec.data.parts[i].questions[qs.tab].multi) qs.picks[qs.tab] = [];
        // 只更新按钮和选中样式，不重画整张卡（不然输入框会丢焦点）
        const card = inp.closest('.q');
        U.$$('.q-opt', card).forEach((b, k) => { const on = qs.picks[qs.tab].includes(rec.data.parts[i].questions[qs.tab].options[k].label); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        inp.closest('.q-other').classList.toggle('on', !!inp.value.trim());
        U.$('.next', card).disabled = !(qs.picks[qs.tab].length || inp.value.trim());
      });
      msgsEl.addEventListener('submit', (e) => {
        const f = e.target.closest('[data-deny]');
        if (!f) return;
        e.preventDefault();
        const rec = byId.get(f.closest('.him').dataset.id), i = +f.dataset.deny;
        answerApproval(rec, i, rec.data.parts[i], 'deny', U.$('input', f).value.trim());
      });

      async function answerApproval(rec, i, p, choice, note) {
        rec.ui.denyOpen = null;
        rec.ui.stamped = i;
        await api.answerApproval(win.id, rec.data.id, p.id, choice, note);
      }

      // 长按：复制 / 引用 / 编辑重发（你的）/ 重新生成（他的）
      U.longPress(msgsEl, (e) => {
        const host = e.target.closest('.me, .him');
        if (!host || e.target.closest('button, a, input, .ask, .q')) return;
        const rec = byId.get(host.dataset.id);
        if (!rec) return;
        const mine = rec.data.role === 'me';
        const text = textOf(rec.data);
        const imgs = (rec.data.attachments || []).filter((a) => a.kind === 'image');
        U.openSheet(`<div class="menu rz-s">
            <button type="button" data-m="copy">${I.copy}复制</button>
            <button type="button" data-m="quote">${I.quote}引用</button>
            ${mine ? `<button type="button" data-m="edit">${I.edit}编辑后重发</button>` : `<button type="button" data-m="redo">${I.redo}重新生成</button>`}
            ${imgs.length ? `<button type="button" data-m="album">${I.album}存进相册</button>` : ''}
          </div>`, (el, close) => {
          U.$$('[data-m]', el).forEach((b) => b.addEventListener('click', async () => {
            close();
            const k = b.dataset.m;
            if (k === 'copy') U.copy(text);
            if (k === 'quote') composer.setQuote({ id: rec.data.id, text: text.replace(/\s+/g, ' ').slice(0, 60) });
            if (k === 'redo') { await api.regenerate(win.id, rec.data.id); rec.el.remove(); byId.delete(rec.data.id); }
            if (k === 'edit') openEdit(rec);
            if (k === 'album') { await api.savePhotos(imgs, { source: 'chat' }); U.toast('存进相册了'); }
          }));
        }, '消息操作');
      });

      function openEdit(rec) {
        U.openSheet(`<div class="bs-title"><h2>编辑后重发</h2></div>
          <label class="sr" for="edit-in">消息</label>
          <textarea id="edit-in" class="edit-area wl">${U.esc(rec.data.text)}</textarea>
          <p class="soft" style="font-size:12px;margin:8px 0 0">重发以后，这条后面的对话会重新来过。</p>
          <div class="edit-btns"><button type="button" data-close>取消</button><button type="button" class="btn-accent" data-ok>重发</button></div>`, (el, close) => {
          U.$('[data-ok]', el).addEventListener('click', async () => {
            const text = U.$('textarea', el).value.trim();
            if (!text) return;
            close();
            // 这条和它后面的都拿掉
            let n = rec.el;
            while (n) { const next = n.nextSibling; if (n.dataset && n.dataset.id) byId.delete(n.dataset.id); n.remove(); n = next; }
            const m = await api.editMessage(win.id, rec.data.id, text);
            addMessage(m, true); scrollBottom(true);
          });
        }, '编辑消息');
      }

      function openViewer(src) {
        const v = document.createElement('div');
        v.className = 'viewer';
        v.innerHTML = `<img src="${U.esc(src)}" alt=""><button type="button" aria-label="关闭">${I.x}</button>`;
        v.addEventListener('click', () => v.remove());
        document.body.appendChild(v);
      }

      // ---- 状态小字 ----
      function setStatus(s, text) {
        state.status = s;
        statusEl.className = 'status ' + (s === 'idle' ? 'idle' : s === 'stuck' ? 'stuck' : s === 'waiting' ? '' : 'busy');
        statusEl.innerHTML = s === 'idle' ? '' : `<i></i><span>${U.esc(text || '')}</span>${s === 'stuck' ? '<button type="button" data-int>中断</button>' : ''}`;
        const b = U.$('[data-int]', statusEl);
        if (b) b.addEventListener('click', () => api.interrupt(win.id));
        state.busy = s === 'thinking' || s === 'responding' || s === 'stuck';
        composer.setBusy(state.busy);
      }
      // 两分钟没动静就提示卡住了
      const watchdog = setInterval(() => {
        if ((state.status === 'thinking' || state.status === 'responding') && Date.now() - state.lastEventAt > 120000) setStatus('stuck', '卡住了 · 两分钟没动静');
      }, 5000);

      // ---- 事件流 ----
      function onEvent(ev) {
        state.lastEventAt = Date.now();
        const rec = ev.msgId && byId.get(ev.msgId);
        const stick = nearBottom();   // 改之前在底部，改完继续贴底
        const scrollBottom = () => { if (stick) requestAnimationFrame(() => { msgsEl.scrollTop = msgsEl.scrollHeight; }); };
        switch (ev.type) {
          case 'turn.start': {
            const r = addMessage({ id: ev.msgId, role: 'him', time: ev.time || new Date().toISOString(), parts: [], feedback: null });
            r.streaming = true; paintHim(r); scrollBottom(true); break;
          }
          case 'part.add':
            if (!rec) break;
            rec.data.parts.push(ev.part); paintHim(rec, rec.data.parts.length - 1); scrollBottom(); break;
          case 'part.update':
            if (!rec) break;
            Object.assign(rec.data.parts[ev.index], ev.patch); paintHim(rec); scrollBottom(); break;
          case 'text.delta': {
            if (!rec) break;
            const p = rec.data.parts[ev.index];
            p.text += ev.delta;
            const box = U.$(`[data-text="${ev.index}"]`, rec.el);
            if (box) box.innerHTML = YY.md(p.text) + '<span class="caret" aria-hidden="true"></span>';
            scrollBottom(); break;
          }
          case 'turn.end':
            if (!rec) break;
            rec.streaming = false; paintHim(rec); break;
          case 'status': setStatus(ev.state, ev.text); break;
          case 'context': state.ctx = { used: ev.used, max: ev.max }; paintRing(); break;
          case 'sys': addMessage({ id: 'sys' + Date.now(), role: 'sys', time: new Date().toISOString(), text: ev.text }); scrollBottom(true); break;
          default: break;
        }
      }

      // ---- 翻更早的 ----
      async function loadOlder() {
        const first = state.list[0];
        if (!first) return;
        const h0 = msgsEl.scrollHeight;
        const r = await api.getHistory(win.id, { before: first.id });
        state.list = r.messages.concat(state.list);
        r.messages.slice().reverse().forEach((m) => addMessage(m, false, true));
        state.hasMore = r.hasMore;
        if (!r.hasMore) { const b = U.$('.more', msgsEl); b && b.remove(); }
        msgsEl.scrollTop = msgsEl.scrollHeight - h0;
      }

      // ---- 开始 ----
      const unsub = api.subscribe(win.id, onEvent);
      const [hist, ctx] = await Promise.all([api.getHistory(win.id), api.getContext(win.id)]);
      state.list = hist.messages; state.hasMore = hist.hasMore; state.ctx = ctx;
      paintRing();
      if (!hist.messages.length) showEmpty();
      else {
        if (hist.hasMore) msgsEl.insertAdjacentHTML('afterbegin', '<button type="button" class="more">加载更早的</button>');
        hist.messages.forEach((m) => addMessage(m));
        const pending = hist.messages.flatMap((m) => m.parts || []).find((p) => (p.type === 'approval' || p.type === 'question') && p.state === 'pending');
        if (pending) setStatus('waiting', pending.type === 'approval' ? '等你批准 · 已暂停' : '等你选 · 也可以直接打字回答');
        const running = hist.messages.flatMap((m) => m.parts || []).find((p) => p.type === 'tool' && p.status === 'running');
        if (running) setStatus('responding', '正在' + running.name + '…');
      }
      // 从搜索结果跳过来：滚到那条
      const jump = (location.hash.split('?m=')[1] || '');
      const target = jump && U.$(`[data-id="${CSS.escape(decodeURIComponent(jump))}"]`, msgsEl);
      if (target) { target.scrollIntoView({ block: 'center' }); target.animate([{ transform: 'scale(1.02)' }, { transform: 'none' }], { duration: 500 }); }
      else scrollBottom(true);
      api.markRead(win.id);

      // 换页时收尾
      YY.pages.chat.cleanup = () => { unsub(); clearInterval(watchdog); YY.voice.stop(); };
    }
  };
})();
