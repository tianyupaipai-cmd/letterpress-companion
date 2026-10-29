/* 设置 #/settings：我们俩（名字头像、App 名）、连接、外观、通知、数据、关于 */
(function () {
  const U = YY.util, api = YY.api, I = U.icon;
  const DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>';
  const VERSION = '1.0.0';

  // 头像：前端先裁成 256×256 的正方形再传
  function shrink(file, size = 256) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const s = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.86));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const sw = (key, on, label) => `<button type="button" class="switch" role="switch" data-sw="${key}" aria-checked="${!!on}" aria-label="${label}"><i></i></button>`;

  YY.pages.settings = {
    async render(view) {
      view.innerHTML = `<div class="page-root">
        <header class="ch-head">
          <button type="button" class="ibtn rz" data-act="drawer" aria-label="打开侧边栏">${I.menu}</button>
          <div class="ch-title"><b><span>设置</span></b></div>
          <span class="ibtn flat" aria-hidden="true"></span>
        </header>
        <div class="crease ch-crease"></div>
        <div class="set"></div>
      </div>`;
      const root = view.firstElementChild;
      const body = U.$('.set', root);
      const profile = YY.sidebar.profile();
      let settings = await api.getSettings();
      let be = { ok: false };

      function paint() {
        const look = YY.look.get();
        const wins = YY.sidebar.windows();
        const work = wins.filter((w) => w.kind === 'work').length;
        const voice = U.store.get('voiceUrl', '');
        const n = settings.notify;
        const ava = (p) => (p.avatar ? `<img src="${U.esc(p.avatar)}" alt="">` : `<span>${U.esc(String(p.name).charAt(0))}</span>`);
        body.innerHTML = `
          <section class="us rz" aria-label="我们俩">
            <div class="us-pair">
              <div class="us-who"><button type="button" class="us-ava" data-ava="him" aria-label="换他的头像">${ava(profile.him)}</button><button type="button" class="us-name" data-name="him">${U.esc(profile.him.name)}</button></div>
              <span class="us-link" aria-hidden="true"></span>
              <div class="us-who"><button type="button" class="us-ava" data-ava="me" aria-label="换我的头像">${ava(profile.me)}</button><button type="button" class="us-name" data-name="me">${U.esc(profile.me.name)}</button></div>
            </div>
            <span class="us-tip">点头像换图，点名字改名</span>
            <button type="button" class="us-app wl" data-name="app"><span>App 名</span><b>${U.esc(profile.appName)}</b>${I.edit}</button>
          </section>

          <span class="set-lbl">连接</span>
          <div class="set-card rz">
            <button type="button" class="srow" data-act="base"><b>后端</b><span class="v mono">${U.esc(api.base || '还没填')}</span><i class="dot ${!api.base ? '' : be.ok ? 'ok' : 'bad'}"></i></button>
            <button type="button" class="srow" data-act="voice"><b>PaiVoice</b><span class="v mono">${voice ? U.esc(voice) : '没填 · 通话用演示'}</span><i class="dot ${voice ? 'ok' : ''}"></i></button>
            <a class="srow" href="#/windows" style="text-decoration:none;color:inherit"><b>窗口管理</b><span class="v">伴侣 + ${work} 台工作机</span>${I.chevRight}</a>
          </div>

          <span class="set-lbl">外观</span>
          <div class="set-card pad rz">
            <div class="srow tall"><b>强调色</b><span class="swatches" role="radiogroup" aria-label="强调色">${YY.look.ACCENTS.map((a) => `<button type="button" role="radio" data-accent="${a.color}" aria-checked="${look.accent === a.color}" aria-label="${a.name}" style="background:${a.color}">${look.accent === a.color ? `<i style="background:${a.color}"></i>` : ''}</button>`).join('')}</span></div>
            <div class="srow tall"><b>纸</b><span class="papers" role="radiogroup" aria-label="纸的颜色">${YY.look.PAPERS.map((p) => `<button type="button" role="radio" data-paper="${p.key}" aria-checked="${look.paper === p.key}" style="background:${p.paper}">${p.name}</button>`).join('')}</span></div>
            <label class="srow tall fs-row"><b>字号</b><span class="a">A</span><input type="range" min="0.9" max="1.25" step="0.05" value="${look.fs}" aria-label="聊天字号"><span class="a big">A</span></label>
            <div class="srow tall"><span class="t"><b>压印动效</b><small>叠纸、发牌、消息压进纸里</small></span>${sw('motion', look.motion, '压印动效')}</div>
            <div class="srow tall"><span class="t"><b>光跟着时间走</b><small>早上从左照，傍晚从右照</small></span>${sw('light', look.light, '光跟着时间走')}</div>
          </div>

          <span class="set-lbl">通知</span>
          <div class="set-card pad rz">
            <div class="srow"><span class="t"><b>他发消息</b></span>${sw('n.him', n.him, '他发消息时通知')}</div>
            <div class="srow"><span class="t"><b>工作机要你批准</b><small>审批、选项卡出来时提醒</small></span>${sw('n.approve', n.approve, '工作机要批准时通知')}</div>
            <div class="srow"><span class="t"><b>安静时段</b><small>这段时间只收他的消息</small></span><button type="button" class="quiet-v wl-s" data-act="quiet" ${n.quiet ? '' : 'disabled'}>${U.esc(n.quietFrom)} – ${U.esc(n.quietTo)}</button>${sw('n.quiet', n.quiet, '安静时段')}</div>
          </div>

          <span class="set-lbl">数据</span>
          <div class="set-card rz">
            <button type="button" class="srow" data-act="export"><b>导出聊天记录</b><span class="v"></span>${DL}</button>
            <button type="button" class="srow" data-act="clear"><b>清掉这台手机上的缓存</b><span class="v">${cacheSize()}</span></button>
          </div>

          <span class="set-lbl">关于</span>
          <div class="about wl"><b>${U.esc(profile.appName)}</b><span class="mono">版本 ${VERSION} · 前端</span><small>字体：思源宋体、JetBrains Mono（OFL 可商用）<br>正文用系统自带字体</small></div>`;
      }

      function cacheSize() {
        let n = 0;
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('yy.')) n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) { /* 读不到就算 0 */ }
        return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
      }

      function textSheet(title, value, ph, onSave, mono = false) {
        U.openSheet(`<div class="bs-title"><h2>${title}</h2></div><form class="link-form"><label class="sr" for="tx">${title}</label>
          <input id="tx" class="wl" value="${U.esc(value)}" placeholder="${U.esc(ph)}" style="${mono ? '' : 'font-family:var(--font-sans)'}" autocomplete="off">
          <div class="row"><button type="button" data-close>取消</button><button type="submit" class="btn-accent">保存</button></div></form>`, (el, done) => {
          const inp = U.$('input', el);
          setTimeout(() => inp.focus(), 300);
          U.$('form', el).addEventListener('submit', async (e) => { e.preventDefault(); await onSave(inp.value.trim()); done(); paint(); });
        }, title);
      }

      // 侧边栏也跟着变
      function syncSidebar() {
        const h1 = U.$('.sb-top h1');
        if (h1) h1.textContent = profile.appName;
        document.title = profile.appName;
        YY.sidebar.setCurrent(null);
      }

      async function saveNotify(patch) {
        settings = await api.saveSettings({ notify: patch });
        // 打开通知时问一次系统权限
        if (Object.values(patch).some((v) => v === true) && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      }

      root.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-act]');
        if (a) {
          const k = a.dataset.act;
          if (k === 'drawer') YY.shell.open();
          if (k === 'base') textSheet('后端地址', api.base, 'https://你的服务器地址', async (v) => { U.store.set('apiBase', v); const r = await api.ping(); be.ok = r.ok; U.toast(r.ok ? '连上了 · ' + r.version : '连不上，检查一下地址'); }, true);
          if (k === 'voice') textSheet('PaiVoice 地址', U.store.get('voiceUrl', ''), 'wss://你的通话服务地址', async (v) => { U.store.set('voiceUrl', v); U.toast(v ? '存好了，刷新一下 App 生效' : '清掉了，通话用演示'); }, true);
          if (k === 'quiet') {
            const n = settings.notify;
            U.openSheet(`<div class="bs-title"><h2>安静时段</h2></div><form class="add-form">
              <label class="field wl"><span>从</span><input type="time" name="f" value="${n.quietFrom}"></label>
              <label class="field wl"><span>到</span><input type="time" name="t" value="${n.quietTo}"></label>
              <button type="submit" class="add-save btn-accent">保存</button></form>`, (el, done) => {
              U.$('form', el).addEventListener('submit', async (ev) => { ev.preventDefault(); await saveNotify({ quietFrom: U.$('[name="f"]', el).value, quietTo: U.$('[name="t"]', el).value }); done(); paint(); });
            }, '安静时段');
          }
          if (k === 'export') { const url = await api.exportAll(); const l = document.createElement('a'); l.href = url; l.download = '聊天记录.txt'; l.click(); U.toast('导出好了'); }
          if (k === 'clear') {
            U.openSheet(`<div class="bs-title"><h2>清掉缓存？</h2></div><p class="soft" style="font-size:13px;margin:0 0 16px">只清这台手机上的东西（外观、筛选、语速这些），聊天记录和照片都在服务器上，不会丢。后端地址会保留。</p>
              <div class="menu rz-s"><button type="button" class="danger" data-ok>${I.x}清掉</button><button type="button" data-close>算了</button></div>`, (el, done) => {
              U.$('[data-ok]', el).addEventListener('click', () => {
                const keep = ['yy.apiBase', 'yy.voiceUrl'];
                try { Object.keys(localStorage).filter((k2) => k2.startsWith('yy.') && !keep.includes(k2)).forEach((k2) => localStorage.removeItem(k2)); } catch (err) { /* 私密模式 */ }
                YY.look.apply(); done(); U.toast('清好了'); paint();
              });
            }, '清缓存');
          }
          return;
        }
        const av = e.target.closest('[data-ava]');
        if (av) {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = 'image/*';
          inp.addEventListener('change', async () => {
            if (!inp.files[0]) return;
            const url = await shrink(inp.files[0]);
            const who = av.dataset.ava;
            await api.saveProfile({ [who]: { avatar: url } });
            profile[who].avatar = url; paint(); syncSidebar();
          });
          inp.click(); return;
        }
        const nm = e.target.closest('[data-name]');
        if (nm) {
          const who = nm.dataset.name;
          if (who === 'app') textSheet('App 名', profile.appName, 'App 名', async (v) => { if (!v) return; await api.saveProfile({ appName: v }); profile.appName = v; syncSidebar(); });
          else textSheet(who === 'him' ? '他的名字' : '我的名字', profile[who].name, '名字', async (v) => { if (!v) return; await api.saveProfile({ [who]: { name: v } }); profile[who].name = v; syncSidebar(); });
          return;
        }
        const ac = e.target.closest('[data-accent]');
        if (ac) { YY.look.set({ accent: ac.dataset.accent }); paint(); return; }
        const pp = e.target.closest('[data-paper]');
        if (pp) { YY.look.set({ paper: pp.dataset.paper }); paint(); return; }
        const s = e.target.closest('[data-sw]');
        if (s) {
          const on = s.getAttribute('aria-checked') !== 'true';
          s.setAttribute('aria-checked', on);
          const key = s.dataset.sw;
          if (key.startsWith('n.')) { await saveNotify({ [key.slice(2)]: on }); paint(); }
          else YY.look.set({ [key]: on });
        }
      });
      root.addEventListener('input', (e) => { if (e.target.type === 'range') YY.look.set({ fs: Number(e.target.value) }); });

      paint();
      api.getBackend().then((r) => { be = r; paint(); });
    }
  };
})();
