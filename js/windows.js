/* 窗口管理 #/windows（#/windows/new 直接打开「接入新工作机」）
   后端状态、伴侣（换绑窗口 / 改名）、工作机（拖动排序、左滑移除、点开改名换绑）、tmux 里还没接的窗口 */
(function () {
  const U = YY.util, api = YY.api, I = U.icon;
  const GRIP = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2.5 4.5h9M2.5 7h9M2.5 9.5h9"/></svg>';
  const ST = { online: '在线', busy: '忙', offline: '离线' };
  const AG = (a) => (a === 'codex' ? 'Codex' : a === 'claude' ? 'Claude Code' : '没认出');

  YY.pages.windows = {
    async render(view, arg) {
      view.innerHTML = `<div class="page-root">
        <header class="ch-head">
          <button type="button" class="ibtn rz" data-act="drawer" aria-label="打开侧边栏">${I.menu}</button>
          <div class="ch-title"><b><span>窗口管理</span></b></div>
          <button type="button" class="ibtn rz" data-act="new" aria-label="接入新工作机">${I.plus}</button>
        </header>
        <div class="crease ch-crease"></div>
        <div class="wm"></div>
      </div>`;
      const root = view.firstElementChild;
      const body = U.$('.wm', root);
      const profile = YY.sidebar.profile();

      async function paint() {
        const [be, wins, free] = await Promise.all([api.getBackend(), api.listWindows(), api.listTmuxFree()]);
        const comp = wins.find((w) => w.kind === 'companion');
        const work = wins.filter((w) => w.kind === 'work');
        body.innerHTML = `
          <div class="be wl${be.ok ? '' : ' bad'}" role="status">
            <span class="dot" aria-hidden="true"></span>
            <span class="t"><b>${be.ok ? '后端已连接' : '后端连不上'}</b><small>${U.esc(be.host || api.base || '还没填地址')} · ${be.ms} ms · tmux ${be.sessions} 个会话</small></span>
            <button type="button" class="rz-s" data-act="test">测试</button>
          </div>
          ${comp ? `<div class="wm-label">伴侣</div>
          <div class="comp-card rz">
            <div class="top"><span class="ava wl">${U.esc(String(profile.him.name).charAt(0))}<i class="st ${comp.state}"></i></span>
              <span class="t"><b>${U.esc(profile.him.name)}</b><small>只有一个，聊天、通话、日历都连着它</small></span></div>
            <div class="crease"></div>
            <div class="kv"><span>tmux</span><span class="mono">${U.esc(comp.target)}</span><span>运行的是</span><span>${AG(comp.agent)}</span><span>工作目录</span><span class="mono">${U.esc(comp.dir || '~')}</span></div>
            <div class="btn-row"><button type="button" class="rz-s" data-edit="${comp.id}" data-what="target">换绑窗口</button><button type="button" class="rz-s" data-act="settings">改名字头像</button></div>
          </div>` : ''}
          <div class="wm-label"><span>工作机 · ${work.length}</span><small>按住 ≡ 拖动排序</small></div>
          <div class="wl-list rz">${work.length ? work.map((w) => `
            <div class="wrow-wrap" data-id="${w.id}">
              <button type="button" class="wrow-del" data-del="${w.id}" tabindex="-1">移除</button>
              <div class="wrow${w.state === 'offline' ? ' off' : ''}">
                <span class="handle" aria-label="拖动排序">${GRIP}</span>
                <span class="ava ${w.state === 'offline' ? '' : 'rz-s'}">${w.agent === 'codex' ? 'CX' : 'CC'}</span>
                <button type="button" class="t" data-edit="${w.id}"><span><b>${U.esc(w.name)}</b><i class="st-pill ${w.state}">${ST[w.state] || w.state}</i></span><small>${U.esc(w.target)} · ${U.esc(w.dir || '~')}</small></button>
                ${I.chevRight}
              </div>
            </div>`).join('') : '<p class="wm-empty">还没有工作机，点右上角 ＋ 接一台</p>'}</div>
          <div class="wm-label">tmux 里还没接的窗口</div>
          <div class="free wl">${free.length ? free.map((f) => `<div class="free-row"><span class="mono">${U.esc(f.target)} <small>· ${U.esc(f.agent ? AG(f.agent) : f.cmd)} · ${U.esc(f.dir)}</small></span><button type="button" class="rz-s" data-attach="${U.esc(f.target)}">接入</button></div>`).join('') : '<p class="wm-empty" style="padding:14px 0">都接上了</p>'}</div>
          <p class="wm-tip">从 App 里移除工作机，只是不在这里显示，不会关掉 tmux 里的窗口。左滑一行可以移除。</p>`;
        bindRows();
      }

      // ---- 拖动排序 + 左滑移除 ----
      function bindRows() {
        const list = U.$('.wl-list', body);
        U.$$('.wrow-wrap', list).forEach((wrap) => {
          const row = U.$('.wrow', wrap);
          // 拖动：按住把手上下拖，松手按位置排好
          U.$('.handle', row).addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const h = U.$('.handle', row);
            try { h.setPointerCapture(e.pointerId); } catch (err) { /* 拿不到就算了，照样能拖 */ }
            const y0 = e.clientY;
            const items = U.$$('.wrow-wrap', list);
            const rects = items.map((x) => x.getBoundingClientRect());
            const from = items.indexOf(wrap);
            let to = from;
            row.classList.add('dragging');
            const move = (ev) => {
              const dy = ev.clientY - y0;
              row.style.transform = `translateY(${dy}px)`;
              const mid = rects[from].top + rects[from].height / 2 + dy;
              to = rects.findIndex((r) => mid < r.bottom);
              if (to < 0) to = items.length - 1;
            };
            const up = async () => {
              h.removeEventListener('pointermove', move);
              row.classList.remove('dragging'); row.style.transform = '';
              if (to !== from) {
                const ids = items.map((x) => x.dataset.id);
                ids.splice(to, 0, ids.splice(from, 1)[0]);
                await api.reorderWindows(ids);
                paint();
              }
            };
            h.addEventListener('pointermove', move);
            h.addEventListener('pointerup', up, { once: true });
            h.addEventListener('pointercancel', up, { once: true });
          });
          // 左滑：露出「移除」
          let x0 = null, dx = 0;
          row.addEventListener('touchstart', (e) => { if (e.target.closest('.handle')) return; x0 = e.touches[0].clientX; dx = 0; row.style.transition = 'none'; wrap.classList.add('swiping'); }, { passive: true });
          row.addEventListener('touchmove', (e) => { if (x0 == null) return; dx = Math.min(0, e.touches[0].clientX - x0); row.style.transform = `translateX(${Math.max(dx, -100)}px)`; }, { passive: true });
          row.addEventListener('touchend', () => {
            if (x0 == null) return;
            row.style.transition = '';
            row.style.transform = dx < -50 ? 'translateX(-84px)' : '';
            if (dx >= -50) setTimeout(() => wrap.classList.remove('swiping'), 260);
            x0 = null;
          });
        });
      }

      function openEdit(id, what) {
        const w = YY.sidebar.windows().find((x) => x.id === id);
        if (!w) return;
        const isComp = w.kind === 'companion';
        api.listTmuxFree().then((free) => {
          U.openSheet(`<div class="bs-title"><h2>${isComp ? '换绑伴侣的窗口' : U.esc(w.name)}</h2><span class="mono">${U.esc(w.target)}</span></div>
            <form class="nw">
              ${isComp ? '' : `<label class="field wl"><span>名字</span><input name="name" value="${U.esc(w.name)}"></label>`}
              <div class="nw-sub">绑哪个 tmux 窗口</div>
              <div class="nw-opts" role="radiogroup">${[{ target: w.target, agent: w.agent, dir: w.dir, cur: true }].concat(free).map((f, i) => `<button type="button" class="nw-opt" role="radio" data-t="${U.esc(f.target)}" aria-checked="${i === 0}"><span class="mark"></span><span class="mono">${U.esc(f.target)}</span><span class="mono">${U.esc(f.dir || '')}</span>${f.cur ? '<span class="tag">现在绑的</span>' : ''}</button>`).join('')}</div>
              <button type="submit" class="add-save btn-accent">保存</button>
              ${isComp ? '' : `<button type="button" class="add-save wl" data-rm style="color:var(--err-ink)">从 App 移除</button>`}
            </form>`, (el, done) => {
            let target = w.target;
            U.$$('[data-t]', el).forEach((b) => b.addEventListener('click', () => { target = b.dataset.t; U.$$('[data-t]', el).forEach((x) => x.setAttribute('aria-checked', x === b)); }));
            U.$('form', el).addEventListener('submit', async (e) => {
              e.preventDefault();
              const patch = { target };
              const n = U.$('[name="name"]', el);
              if (n && n.value.trim()) patch.name = n.value.trim();
              await api.updateWindow(id, patch);
              done(); U.toast('改好了'); paint();
            });
            const rm = U.$('[data-rm]', el);
            if (rm) rm.addEventListener('click', async () => { done(); await removeWin(id); });
          }, isComp ? '换绑窗口' : '工作机');
        });
      }

      async function removeWin(id) {
        await api.removeWindow(id);
        U.toast('移除了，tmux 里的窗口还在');
        paint();
      }

      // ---- 接入新工作机 ----
      function openNew(preset = '') {
        api.listTmuxFree().then((free) => {
          const f = { name: '', target: preset || (free[0] ? free[0].target : '__new'), agent: 'claude', ok: false };
          U.openSheet(`<div class="bs-title"><h2>接入新工作机</h2></div>
            <form class="nw">
              <label class="field wl"><span>名字</span><input name="name" placeholder="比如：博客" required></label>
              <div class="nw-sub">选一个 tmux 窗口</div>
              <div class="nw-opts" role="radiogroup" aria-label="tmux 窗口">
                ${free.map((x) => `<button type="button" class="nw-opt" role="radio" data-t="${U.esc(x.target)}" aria-checked="${x.target === f.target}"><span class="mark"></span><span class="mono">${U.esc(x.target)}</span><span class="mono">${U.esc(x.dir)}</span>${x.agent ? `<span class="tag">认出是 ${AG(x.agent)}</span>` : ''}</button>`).join('')}
                <button type="button" class="nw-opt" role="radio" data-t="__new" aria-checked="${f.target === '__new'}"><span class="mark"></span><span>新开一个窗口…</span></button>
              </div>
              <div class="agent-seg" role="radiogroup" aria-label="运行的是">
                <button type="button" role="radio" data-a="claude">Claude Code</button><button type="button" role="radio" data-a="codex">Codex</button>
              </div>
              <div class="probe cut" aria-live="polite"></div>
              <div class="nw-btns"><button type="button" class="rz-s" data-probe>再测一次</button><button type="submit" class="btn-accent" disabled>接入</button></div>
            </form>`, (el, done) => {
            const paintAgent = () => U.$$('[data-a]', el).forEach((b) => b.setAttribute('aria-checked', b.dataset.a === f.agent));
            const probe = async () => {
              const box = U.$('.probe', el);
              const ok = U.$('[type="submit"]', el);
              box.innerHTML = '正在试…'; ok.disabled = true;
              const r = await api.probeWindow(f.target);
              if (r.agent) { f.agent = r.agent; paintAgent(); }
              box.innerHTML = r.steps.map((s) => `<span class="${s.ok ? 'ok' : 'no'}">${s.ok ? '✓' : '✕'}</span> ${U.esc(s.text)}`).join('<br>');
              f.ok = r.steps.every((s) => s.ok) || f.target === '__new';
              ok.disabled = !f.ok;
            };
            U.$$('[data-t]', el).forEach((b) => b.addEventListener('click', () => { f.target = b.dataset.t; U.$$('[data-t]', el).forEach((x) => x.setAttribute('aria-checked', x === b)); probe(); }));
            U.$$('[data-a]', el).forEach((b) => b.addEventListener('click', () => { f.agent = b.dataset.a; paintAgent(); }));
            U.$('[data-probe]', el).addEventListener('click', probe);
            U.$('form', el).addEventListener('submit', async (e) => {
              e.preventDefault();
              const name = U.$('[name="name"]', el).value.trim();
              if (!name) { U.toast('起个名字'); return; }
              const w = await api.attachWindow({ name, target: f.target, agent: f.agent });
              done(); U.toast('接上了');
              location.hash = '#/chat/' + encodeURIComponent(w.id);
            });
            paintAgent(); probe();
          }, '接入新工作机', () => { if (location.hash === '#/windows/new') history.replaceState(null, '', '#/windows'); });
        });
      }

      root.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-act]');
        if (a) {
          const k = a.dataset.act;
          if (k === 'drawer') YY.shell.open();
          if (k === 'new') openNew();
          if (k === 'settings') location.hash = '#/settings';
          if (k === 'test') { const r = await api.getBackend(); U.toast(r.ok ? '连上了 · ' + r.ms + ' ms' : '连不上'); paint(); }
          return;
        }
        const ed = e.target.closest('[data-edit]');
        if (ed) { openEdit(ed.dataset.edit, ed.dataset.what); return; }
        const at = e.target.closest('[data-attach]');
        if (at) { openNew(at.dataset.attach); return; }
        const del = e.target.closest('[data-del]');
        if (del) removeWin(del.dataset.del);
      });

      await paint();
      if (arg === 'new') openNew();
    }
  };
})();
