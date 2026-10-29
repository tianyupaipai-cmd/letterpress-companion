/* 侧边栏：功能入口（心潮念 / 日历 / 相册）+ 伴侣 + 工作机 + 搜索聊天记录 */
(function () {
  const U = YY.util, api = YY.api, I = U.icon;
  let wins = [], profile = null, current = null, el = null, query = '';

  const initial = (name) => U.esc(String(name || '?').trim().charAt(0));
  const agentTag = (a) => (a === 'codex' ? 'CX' : 'CC');

  function companionHTML(w) {
    const ava = profile.him.avatar ? `<img src="${U.esc(profile.him.avatar)}" alt="">` : initial(profile.him.name);
    return `<a href="#/chat" class="sb-companion rz${current === w.id ? ' on' : ''}" data-win="${w.id}" ${current === w.id ? 'aria-current="page"' : ''}>
      <span class="ava wl">${ava}<i class="st ${w.state}"></i></span>
      <span class="sb-row-main">
        <span class="sb-row-head"><b>${U.esc(profile.him.name)}</b><span class="time">${U.when(w.time)}</span></span>
        <span class="sb-row-last"><span>${U.esc(w.last || '')}</span>${w.unread ? `<i class="badge">${w.unread}</i>` : ''}</span>
        <span class="sb-row-sub">${U.esc(w.agent)} · ${U.esc(w.target)}</span>
      </span>
    </a>`;
  }

  function workHTML(w) {
    const off = w.state === 'offline';
    return `<a href="#/chat/${encodeURIComponent(w.id)}" class="sb-work${current === w.id ? ' on' : ''}${off ? ' off' : ''}" data-win="${w.id}" ${current === w.id ? 'aria-current="page"' : ''}>
      <span class="ava ${off ? '' : 'rz-s'}">${agentTag(w.agent)}${off ? '' : `<i class="st ${w.state === 'busy' ? 'busy' : 'online'}"></i>`}</span>
      <span class="sb-row-main">
        <span class="sb-row-head"><b>${U.esc(w.name)}</b>${off ? '<span class="tag">离线</span>' : `<span class="tag">${U.esc(w.agent)}</span>`}<span class="time">${U.when(w.time)}</span></span>
        <span class="sb-row-last"><span>${U.esc(w.last || '')}</span>${w.unread ? `<i class="badge">${w.unread}</i>` : ''}</span>
      </span>
    </a>`;
  }

  function listsHTML() {
    const comp = wins.find((w) => w.kind === 'companion');
    const work = wins.filter((w) => w.kind === 'work');
    const online = work.filter((w) => w.state !== 'offline').length;
    return `
      ${comp ? `<div class="sb-label">伴侣</div>${companionHTML(comp)}` : ''}
      <div class="sb-label">工作机<span class="acts">
        <a href="#/windows" aria-label="窗口管理">${I.sliders}</a>
        <a href="#/windows/new" aria-label="接入新工作机">${I.plus}</a>
      </span></div>
      <div class="sb-list">${work.length ? work.map(workHTML).join('') : '<p class="sb-empty">还没有接入工作机，点右上角 ＋ 接一台。</p>'}</div>
      <div class="crease"></div>
      <div class="sb-me">
        <span class="ava rz-s">${profile.me.avatar ? `<img src="${U.esc(profile.me.avatar)}" alt="">` : initial(profile.me.name)}</span>
        <span class="who"><b>${U.esc(profile.me.name)}</b><span>工作机 ${online}/${work.length} 在线</span></span>
        <a href="#/settings" class="ibtn rz-s" aria-label="设置">${I.gear}</a>
      </div>`;
  }

  async function resultsHTML(q) {
    const hits = await api.search(q);
    if (!hits.length) return '<p class="sb-empty">没有找到「' + U.esc(q) + '」</p>';
    const name = (id) => { const w = wins.find((x) => x.id === id); return w ? (w.kind === 'companion' ? profile.him.name : w.name) : id; };
    const mark = (s) => U.esc(s).split(U.esc(q)).join('<mark>' + U.esc(q) + '</mark>');
    return hits.map((h) => {
      const w = wins.find((x) => x.id === h.winId);
      const href = w && w.kind === 'companion' ? '#/chat' : '#/chat/' + encodeURIComponent(h.winId);
      return `<a class="sb-hit rz-s" href="${href}?m=${encodeURIComponent(h.msgId)}"><span class="who">${U.esc(name(h.winId))} · ${h.who === 'me' ? '我' : '他'}<span class="mono">${U.when(h.time)}</span></span><span class="snip">${mark(h.snippet)}</span></a>`;
    }).join('');
  }

  async function paintBody() {
    const body = U.$('.sb-body', el);
    if (query) {
      body.innerHTML = '<div class="sb-results">…</div>';
      const html = await resultsHTML(query);
      if (query) body.innerHTML = '<div class="sb-label">搜索结果</div><div class="sb-results">' + html + '</div>';
    } else body.innerHTML = listsHTML();
    U.$$('a', body).forEach((a) => a.addEventListener('click', () => YY.shell.close()));
  }

  YY.sidebar = {
    async mount(root) {
      el = root;
      [profile, wins] = await Promise.all([api.getProfile(), api.listWindows()]);
      el.innerHTML = `<nav class="sb" aria-label="侧边栏">
        <div class="sb-top"><h1>${U.esc(profile.appName)}</h1></div>
        <label class="sb-search wl">${I.search}<input type="search" placeholder="搜索聊天记录" aria-label="搜索聊天记录"></label>
        <div class="sb-tiles">
          <a href="#/mood" class="tile rz">${I.wave}<span>心潮念</span><i class="dot" aria-label="有新动静"></i></a>
          <a href="#/calendar" class="tile rz">${I.calendar}<span>日历</span></a>
          <a href="#/album" class="tile rz">${I.album}<span>相册</span></a>
        </div>
        <div class="sb-body" style="display:flex;flex-direction:column;gap:16px;flex:1;min-height:0"></div>
      </nav>`;
      U.$$('.tile', el).forEach((a) => a.addEventListener('click', () => YY.shell.close()));
      let t = null;
      U.$('input', el).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { query = e.target.value.trim(); paintBody(); }, 250); });
      api.onWindows(async (id, patch) => {
        if (id === '*') wins.splice(0, wins.length, ...(await api.listWindows()));   // 增删、排序：整个重拉
        else { const w = wins.find((x) => x.id === id); if (w) Object.assign(w, patch); }
        if (!query) paintBody();
      });
      paintBody();
    },
    setCurrent(id) { current = id; if (el && !query) paintBody(); },
    windows: () => wins,
    profile: () => profile
  };
})();
