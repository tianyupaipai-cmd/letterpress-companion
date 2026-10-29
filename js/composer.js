/* 输入栏：打字、＋ 附件（拍照 / 照片 / 文件 / 网页链接）、/ 斜杠命令、语音条（按住说话）、发送 / 中断 */
(function () {
  const U = YY.util, api = YY.api, I = U.icon;
  const MAX_FILES = 10, MAX_SIZE = 30 * 1048576;
  const KBD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14h8"/></svg>';

  YY.composer = {
    // opts: { winId, agent, placeholder, onSend({ text, attachments, quote }), onVoice({ blob, seconds }), onCommand(name, args), onStop() }
    mount(root, opts) {
      let busy = false, atts = [], quote = null, cmds = null, slashOn = false, slashIdx = 0, rec = null;

      root.className = 'composer rz';
      root.innerHTML = `
        <div class="cp-chips" hidden></div>
        <div class="quote wl-s" hidden><span></span><button type="button" aria-label="取消引用">${I.x}</button></div>
        <label class="sr" for="cp-input">回复</label>
        <textarea id="cp-input" class="wl" rows="1" placeholder="${U.esc(opts.placeholder)}" enterkeyhint="send"></textarea>
        <div class="cp-row">
          <button type="button" class="ibtn sm rz-s" data-act="plus" aria-label="添加图片或文件">${I.plus}</button>
          <button type="button" class="ibtn sm rz-s" data-act="slash" aria-label="斜杠命令"><span class="slash">/</span></button>
          <span class="agent rz-s">${opts.agent === 'codex' ? 'Codex' : 'Claude Code'}</span>
          <span class="spacer"></span>
          <button type="button" class="ibtn sm flat mic" data-act="mic" aria-label="发语音">${I.mic}</button>
          <button type="button" class="ibtn send rz-s accent" data-act="send" aria-label="发送">${I.send}</button>
        </div>
        <div class="cp-voice" hidden>
          <button type="button" class="ibtn rz-s" data-act="kbd" aria-label="切回打字">${KBD}</button>
          <button type="button" class="hold rz-s" aria-label="按住说话">按住 说话</button>
        </div>`;

      const ta = U.$('textarea', root);
      const chipsEl = U.$('.cp-chips', root);
      const quoteEl = U.$('.quote', root);
      const sendBtn = U.$('[data-act="send"]', root);
      const slashBtn = U.$('[data-act="slash"]', root);
      const plusBtn = U.$('[data-act="plus"]', root);

      const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; };
      const hasContent = () => ta.value.trim() || atts.some((a) => a.done);

      function paintSend() {
        const stop = busy && !hasContent();
        sendBtn.classList.toggle('stop', stop);
        sendBtn.innerHTML = stop ? I.stop : I.send;
        sendBtn.setAttribute('aria-label', stop ? '中断' : '发送');
        sendBtn.disabled = !stop && !hasContent();
        ta.classList.toggle('cmd', ta.value.startsWith('/'));
      }

      // ---- 附件 ----
      function paintChips() {
        chipsEl.hidden = !atts.length;
        chipsEl.innerHTML = atts.map((a, i) => `<span class="chip rz-s">
          ${a.kind === 'image' && a.url ? `<img class="th" src="${U.esc(a.url)}" alt="">` : `<span class="th">${a.kind === 'link' ? I.link : I.file}</span>`}
          <span class="mono">${U.esc(a.kind === 'link' ? a.domain : a.name)}</span>
          ${a.done ? '' : `<span class="bar"><i style="width:${a.p || 0}%"></i></span>`}
          <button type="button" data-rm="${i}" aria-label="移除">${I.x}</button></span>`).join('');
        U.$$('[data-rm]', chipsEl).forEach((b) => b.addEventListener('click', () => { atts.splice(+b.dataset.rm, 1); paintChips(); paintSend(); }));
      }

      async function addFiles(files) {
        for (const f of Array.from(files)) {
          if (atts.length >= MAX_FILES) { U.toast('一次最多 ' + MAX_FILES + ' 个'); break; }
          if (f.size > MAX_SIZE) { U.toast(f.name + ' 超过 30 MB'); continue; }
          const a = { kind: /^image\//.test(f.type) ? 'image' : 'file', name: f.name, size: f.size, p: 0, done: false };
          if (a.kind === 'image') a.url = URL.createObjectURL(f);
          atts.push(a); paintChips(); paintSend();
          try {
            const r = await api.upload(f, (p) => { a.p = p; const bar = chipsEl.querySelectorAll('.bar i')[atts.indexOf(a)]; if (bar) bar.style.width = p + '%'; });
            Object.assign(a, r, { done: true });
          } catch (e) { U.toast(f.name + ' 上传失败'); atts.splice(atts.indexOf(a), 1); }
          paintChips(); paintSend();
        }
      }

      const pick = (accept, capture, multiple = true) => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = accept; inp.multiple = multiple;
        if (capture) inp.setAttribute('capture', 'environment');
        inp.addEventListener('change', () => addFiles(inp.files));
        inp.click();
      };

      function openAttach() {
        plusBtn.classList.add('on');
        const close = U.openSheet(`
          <div class="bs-title"><h2>添加到对话</h2><span class="mono">最多 ${MAX_FILES} 个 · 单个 30 MB</span></div>
          <div class="att-grid">
            <button type="button" class="rz" data-k="camera">${I.camera}拍照</button>
            <button type="button" class="rz" data-k="image">${I.image}照片</button>
            <button type="button" class="rz" data-k="file">${I.file}文件</button>
            <button type="button" class="rz" data-k="link">${I.link}网页链接</button>
          </div>
          <p class="att-tip">图片和文件会传到你的服务器，再把路径交给他。网页链接他能打开来看。</p>`, (el, done) => {
          U.$$('[data-k]', el).forEach((b) => b.addEventListener('click', () => {
            const k = b.dataset.k;
            if (k === 'link') { done(); openLink(); return; }
            done();
            if (k === 'camera') pick('image/*', true, false);
            if (k === 'image') pick('image/*', false);
            if (k === 'file') pick('*/*', false);
          }));
        }, '添加附件', () => plusBtn.classList.remove('on'));
        return close;
      }

      function openLink() {
        U.openSheet(`
          <div class="bs-title"><h2>网页链接</h2></div>
          <form class="link-form">
            <label class="sr" for="link-in">网址</label>
            <input id="link-in" class="wl" type="text" inputmode="url" autocapitalize="off" placeholder="https://" required>
            <div class="row"><button type="button" data-close>取消</button><button type="submit" class="btn-accent">添加</button></div>
          </form>`, (el, close) => {
          const inp = U.$('input', el);
          setTimeout(() => inp.focus(), 300);
          U.$('form', el).addEventListener('submit', async (e) => {
            e.preventDefault();
            let url = inp.value.trim();
            if (!/^https?:\/\//.test(url)) url = 'https://' + url;
            close();
            const a = await api.linkPreview(url);
            atts.push(Object.assign(a, { done: true })); paintChips(); paintSend();
          });
        }, '添加网页链接');
      }

      // ---- 斜杠命令 ----
      async function paintSlash() {
        cmds = cmds || await api.listCommands(opts.winId);
        let panel = U.$('.slash-panel', root);
        const m = ta.value.match(/^\/(\S*)$/);
        if (!slashOn || (!m && ta.value !== '')) { if (panel) panel.remove(); slashBtn.classList.remove('on'); return; }
        slashBtn.classList.add('on');
        const q = m ? m[1].toLowerCase() : '';
        const list = cmds.filter((c) => c.name.startsWith(q));
        slashIdx = Math.min(slashIdx, Math.max(0, list.length - 1));
        if (!panel) { panel = document.createElement('section'); panel.className = 'slash-panel paper'; panel.setAttribute('aria-label', '斜杠命令'); root.prepend(panel); }
        const builtin = list.filter((c) => c.source === 'builtin');
        const custom = list.filter((c) => c.source !== 'builtin');
        const item = (c) => {
          const i = list.indexOf(c);
          return `<button type="button" class="slash-item${i === slashIdx ? ' on' : ''}" data-cmd="${U.esc(c.name)}">
            <span class="n"><em>/${U.esc(q)}</em>${U.esc(c.name.slice(q.length))}</span>
            <span class="d">${U.esc(c.desc)}${c.source !== 'builtin' ? `<span class="src wl-s">${c.source === 'project' ? '项目' : '个人'}</span>` : ''}</span></button>`;
        };
        panel.innerHTML = `<div class="slash-head"><span>命令</span><span class="mono">${q ? '匹配 “/' + U.esc(q) + '” · ' : ''}${list.length} 条</span></div>` +
          (list.length ? builtin.map(item).join('') + (builtin.length && custom.length ? '<div class="crease slash-sep"></div>' : '') + custom.map(item).join('') : '<p class="slash-none">没有这个命令，回车会原样发给他</p>');
        U.$$('[data-cmd]', panel).forEach((b) => b.addEventListener('click', () => runCmd(b.dataset.cmd, '')));
      }

      function runCmd(name, args) {
        slashOn = false; ta.value = ''; grow(); paintSlash(); paintSend();
        opts.onCommand(name, args);
      }

      // ---- 发送 ----
      function send() {
        if (busy && !hasContent()) { opts.onStop(); return; }
        const text = ta.value.trim();
        const cm = text.match(/^\/(\S+)\s*(.*)$/s);
        if (cm && !atts.length && cmds && cmds.some((c) => c.name === cm[1])) { runCmd(cm[1], cm[2]); return; }
        if (!hasContent()) return;
        if (atts.some((a) => !a.done)) { U.toast('还有附件没传完'); return; }
        opts.onSend({ text, attachments: atts.map(({ p, done, ...a }) => a), quote });
        ta.value = ''; atts = []; quote = null; slashOn = false;
        quoteEl.hidden = true; grow(); paintChips(); paintSlash(); paintSend();
      }

      // ---- 语音条：点麦克风切到「按住说话」，按住录、上滑取消、松开发送 ----
      const voiceEl = U.$('.cp-voice', root);
      const holdBtn = U.$('.hold', root);
      function setVoiceMode(on) {
        voiceEl.hidden = !on;
        ta.hidden = on;
        U.$('.cp-row', root).hidden = on;
        if (on) YY.voice.warmUp();
        else ta.focus();
      }
      let tick = null, startY = 0, cancelling = false;
      async function holdStart(e) {
        e.preventDefault();
        try { holdBtn.setPointerCapture(e.pointerId); } catch (err) { /* 同上 */ }
        startY = e.clientY; cancelling = false;
        holdBtn.classList.add('rec');
        holdBtn.innerHTML = `<span class="rdot"></span><span class="vbars">${'<i style="height:6px"></i>'.repeat(24)}</span><span class="mono">0:00</span>`;
        const hint = document.createElement('div');
        hint.className = 'hold-hint'; hint.setAttribute('role', 'status');
        hint.innerHTML = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11V3M4 6l3-3 3 3"/></svg><span>上滑取消 · 松开发送</span>`;
        root.appendChild(hint);
        rec = await YY.voice.record();
        if (!holdBtn.classList.contains('rec')) { rec.cancel(); rec = null; return; }   // 还没开始就松手了
        const levels = [];
        tick = setInterval(() => {
          levels.push(rec.level()); if (levels.length > 24) levels.shift();
          U.$$('.vbars i', holdBtn).forEach((b, i) => { b.style.height = Math.round(5 + (levels[i] || 0) * 21) + 'px'; });
          const m = U.$('.mono', holdBtn); if (m) m.textContent = YY.voice.len(rec.seconds());
        }, 90);
      }
      function holdMove(e) {
        if (!holdBtn.classList.contains('rec')) return;
        const c = startY - e.clientY > 60;
        if (c === cancelling) return;
        cancelling = c;
        holdBtn.classList.toggle('cancel', c);
        const hint = U.$('.hold-hint', root);
        if (hint) { hint.classList.toggle('cancel', c); U.$('span', hint).textContent = c ? '松开取消' : '上滑取消 · 松开发送'; }
      }
      async function holdEnd() {
        if (!holdBtn.classList.contains('rec')) return;
        clearInterval(tick);
        holdBtn.classList.remove('rec', 'cancel');
        holdBtn.textContent = '按住 说话';
        const hint = U.$('.hold-hint', root); if (hint) hint.remove();
        const r = rec; rec = null;
        if (!r) return;
        if (cancelling) { r.cancel(); return; }
        const out = await r.stop();
        if (out.seconds < 1) { U.toast('说得太短了'); return; }
        opts.onVoice(out);
      }
      holdBtn.addEventListener('pointerdown', holdStart);
      holdBtn.addEventListener('pointermove', holdMove);
      holdBtn.addEventListener('pointerup', holdEnd);
      holdBtn.addEventListener('pointercancel', holdEnd);
      holdBtn.addEventListener('contextmenu', (e) => e.preventDefault());
      U.$('[data-act="kbd"]', root).addEventListener('click', () => setVoiceMode(false));

      ta.addEventListener('input', () => {
        grow(); paintSend();
        if (ta.value.startsWith('/') && !/\s/.test(ta.value)) { slashOn = true; slashIdx = 0; }
        paintSlash();
      });
      ta.addEventListener('keydown', (e) => {
        const panel = U.$('.slash-panel', root);
        if (panel && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault();
          const n = U.$$('.slash-item', panel).length;
          slashIdx = (slashIdx + (e.key === 'ArrowDown' ? 1 : -1) + n) % Math.max(n, 1);
          paintSlash(); return;
        }
        if (e.key === 'Escape' && panel) { slashOn = false; paintSlash(); return; }
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) {
          e.preventDefault();
          const on = panel && U.$('.slash-item.on', panel);
          if (on && /^\/\S*$/.test(ta.value)) runCmd(on.dataset.cmd, ''); else send();
        }
      });
      sendBtn.addEventListener('click', send);
      plusBtn.addEventListener('click', openAttach);
      slashBtn.addEventListener('click', () => {
        slashOn = !slashOn;
        if (slashOn && !ta.value) ta.value = '/';
        if (!slashOn && ta.value === '/') ta.value = '';
        slashIdx = 0; grow(); paintSend(); paintSlash(); ta.focus();
      });
      U.$('[data-act="mic"]', root).addEventListener('click', () => setVoiceMode(true));
      U.$('button', quoteEl).addEventListener('click', () => { quote = null; quoteEl.hidden = true; });
      paintSend();

      return {
        setBusy(b) { busy = b; paintSend(); },
        setQuote(q) { quote = q; U.$('span', quoteEl).textContent = '引用：' + q.text; quoteEl.hidden = false; ta.focus(); },
        focus() { ta.focus(); }
      };
    }
  };
})();
