/* 路由和叠纸侧边栏。
   #/chat 伴侣 · #/chat/窗口id 工作机 · #/call 语音通话 · #/mood 心潮念 · #/calendar 日历 · #/album 相册 · #/windows 窗口管理 · #/settings 设置 */
(function () {
  const U = YY.util;
  const shell = U.$('#shell');
  const view = U.$('#view');

  const routes = [
    { re: /^#\/chat$/, page: 'chat' },
    { re: /^#\/chat\/(.+)$/, page: 'chat' },
    { re: /^#\/call$/, page: 'call' },
    { re: /^#\/calendar$/, page: 'calendar' },
    { re: /^#\/album$/, page: 'album' },
    { re: /^#\/settings$/, page: 'settings' },
    { re: /^#\/mood$/, page: 'mood' },
    { re: /^#\/windows(?:\/(new))?$/, page: 'windows' }
  ];

  // 叠纸：打开侧边栏 = 聊天这张纸往右沉，露出下面一层
  YY.shell = {
    open() { shell.classList.add('open'); },
    close() { shell.classList.remove('open'); },
    toggle() { shell.classList.toggle('open'); }
  };
  U.$('#scrim').addEventListener('click', () => YY.shell.close());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') YY.shell.close(); });

  // 从屏幕左边缘往右划打开，打开时往左划收起
  let sx = null, sy = null;
  document.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dy < 60) {
      if (!shell.classList.contains('open') && sx < 24 && dx > 60) YY.shell.open();
      else if (shell.classList.contains('open') && dx < -60) YY.shell.close();
    }
    sx = null;
  }, { passive: true });

  // 外观（强调色、纸、字号、动效、光的方向）见 js/look.js
  YY.look.apply();

  async function go() {
    const hash = location.hash || '#/chat';
    const path = hash.split('?')[0];
    const r = routes.find((x) => x.re.test(path)) || routes[0];
    const arg = (path.match(r.re) || [])[1];
    Object.values(YY.pages).forEach((p) => { if (p.cleanup) { p.cleanup(); p.cleanup = null; } });
    U.closeSheets();
    YY.shell.close();
    if (r.page !== 'chat') YY.sidebar.setCurrent(null);
    try { await YY.pages[r.page].render(view, arg && decodeURIComponent(arg)); }
    catch (e) { console.error(e); view.innerHTML = '<p class="soft" style="padding:120px 24px;text-align:center">没加载出来，刷新一下试试</p>'; }
  }

  window.addEventListener('hashchange', go);
  YY.sidebar.mount(U.$('#drawer')).then(go);
})();
