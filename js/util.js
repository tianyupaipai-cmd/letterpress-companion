/* 小工具：转义、提示、底部弹层、本地设置、时间、复制、长按、图标 */
(function () {
  const U = {};

  U.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  U.toast = (text, ms = 1600) => {
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, ms);
  };

  // 打开底部弹层。html 是内容，onMount(el, close) 里绑事件。返回 close()
  U.openSheet = (html, onMount, label = '', onClose = null) => {
    const mask = document.createElement('div');
    mask.className = 'bs-mask';
    const el = document.createElement('section');
    el.className = 'bs paper';
    el.setAttribute('role', 'dialog');
    if (label) el.setAttribute('aria-label', label);
    el.innerHTML = '<span class="bs-handle" aria-hidden="true"></span><div>' + html + '</div>';
    document.body.append(mask, el);
    requestAnimationFrame(() => { mask.classList.add('show'); el.classList.add('show'); });
    const close = () => {
      mask.classList.remove('show'); el.classList.remove('show');
      setTimeout(() => { mask.remove(); el.remove(); }, 300);
      if (onClose) onClose();
    };
    mask.addEventListener('click', close);
    U.$$('[data-close]', el).forEach((b) => b.addEventListener('click', close));
    // 往下拖把手收起
    let y0 = null;
    el.addEventListener('touchstart', (e) => { if (el.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 80) close(); y0 = null; });
    if (onMount) onMount(el, close);
    return close;
  };
  U.closeSheets = () => U.$$('.bs, .bs-mask, .viewer').forEach((x) => x.remove());

  // 只存在这台手机上的设置
  U.store = {
    get(key, dflt) { try { const v = localStorage.getItem('yy.' + key); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
    set(key, val) { try { localStorage.setItem('yy.' + key, JSON.stringify(val)); } catch (e) { /* 私密模式或空间满时不存 */ } }
  };

  const pad = (n) => String(n).padStart(2, '0');
  U.hm = (iso) => { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  // 侧边栏的时间：今天显示 21:46，昨天显示「昨天」，更早显示 10/21
  U.when = (iso) => {
    const d = new Date(iso), t = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = (day(t) - day(d)) / 86400000;
    if (diff === 0) return U.hm(iso);
    if (diff === 1) return '昨天';
    return (d.getMonth() + 1) + '/' + d.getDate();
  };
  // 消息之间隔了 10 分钟以上才插一行时间
  U.tsLabel = (iso) => {
    const w = U.when(iso);
    return /:/.test(w) ? '今天 ' + w : w + ' ' + U.hm(iso);
  };
  U.fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  U.ext = (name) => (String(name).split('.').pop() || '').toUpperCase().slice(0, 5);

  U.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (err) { /* 实在复制不了就算了 */ }
      ta.remove();
    }
    U.toast('已复制');
  };

  // 长按（手机）和右键（电脑）都触发
  U.longPress = (el, fn) => {
    let timer = null, moved = false;
    el.addEventListener('touchstart', (e) => { moved = false; timer = setTimeout(() => { if (!moved) { navigator.vibrate && navigator.vibrate(10); fn(e); } }, 480); }, { passive: true });
    el.addEventListener('touchmove', () => { moved = true; clearTimeout(timer); }, { passive: true });
    el.addEventListener('touchend', () => clearTimeout(timer));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); fn(e); });
  };

  const sv = (body, w = 1.5) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  U.icon = {
    menu: sv('<path d="M4 9h16M4 15h10"/>', 1.7),
    phone: sv('<path d="M6.2 4h3.1l1.6 4.1-2 1.3a10 10 0 0 0 5.6 5.6l1.3-2 4.1 1.6v3.1a2 2 0 0 1-2.1 2A15.6 15.6 0 0 1 4.2 6.1 2 2 0 0 1 6.2 4z"/>', 1.6),
    chevDown: sv('<path d="M7 10l5 5 5-5"/>', 1.7),
    chevRight: sv('<path d="M10 7l5 5-5 5"/>', 1.7),
    back: sv('<path d="M15 5l-7 7 7 7"/>', 1.7),
    plus: sv('<path d="M12 5v14M5 12h14"/>', 1.7),
    mic: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V20"/>'),
    send: sv('<path d="M12 19V5M6 11l6-6 6 6"/>', 2.2),
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
    search: sv('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
    copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>', 1.4),
    redo: sv('<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"/><path d="M19.5 4v4.5H15"/>'),
    up: sv('<path d="M7.5 10.5l3.8-7.5c1.4 0 2.6 1.2 2.3 2.6L13 9.5h5.3a2 2 0 0 1 2 2.4l-1.4 6.6a2.4 2.4 0 0 1-2.4 2H7.5z"/><path d="M3.5 10.5h4v10h-4z"/>', 1.3),
    down: sv('<path d="M16.5 13.5l-3.8 7.5c-1.4 0-2.6-1.2-2.3-2.6l.6-3.9H5.7a2 2 0 0 1-2-2.4l1.4-6.6a2.4 2.4 0 0 1 2.4-2h9z"/><path d="M20.5 13.5h-4v-10h4z"/>', 1.3),
    clock: sv('<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l2.8 1.8"/>', 1.4),
    check: sv('<path d="M5 12.5l4.5 4.5 9.5-10"/>', 2),
    x: sv('<path d="M6 6l12 12M18 6L6 18"/>', 1.8),
    term: sv('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>'),
    read: sv('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
    edit: sv('<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14 7l3 3"/>'),
    globe: sv('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17"/>', 1.3),
    ext: sv('<path d="M9 5h10v10M19 5L7 17"/>', 1.6),
    spin: sv('<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/>', 2),
    shield: sv('<path d="M12 3l7 2.6v5.4c0 4.3-3 7.3-7 8.6-4-1.3-7-4.3-7-8.6V5.6z"/>', 1.6),
    camera: sv('<path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.3"/>'),
    image: sv('<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 16l4.5-4 3.5 3 3-2.5L20 17"/><circle cx="15" cy="9" r="1.6"/>'),
    file: sv('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 16.5h4"/>'),
    link: sv('<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>'),
    quote: sv('<path d="M5 7h5v5H7c0 2 1 3 3 3M14 7h5v5h-3c0 2 1 3 3 3"/>'),
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M12 3l1.7 2.4 2.9-.7.7 2.9 2.5 1.6-1.2 2.8 1.2 2.8-2.5 1.6-.7 2.9-2.9-.7L12 21l-1.7-2.4-2.9.7-.7-2.9-2.5-1.6 1.2-2.8-1.2-2.8 2.5-1.6.7-2.9 2.9.7z"/>', 1.4),
    sliders: sv('<path d="M4 7h16M4 17h16"/><circle cx="15" cy="7" r="2" fill="var(--paper-under)"/><circle cx="9" cy="17" r="2" fill="var(--paper-under)"/>', 1.4),
    wave: sv('<path d="M3 12c2.2-3.2 4-3.2 6 0s3.8 3.2 6 0 4-3.2 6 0"/><path d="M3 17c2.2-2 4-2 6 0s3.8 2 6 0 4-2 6 0" opacity=".5"/><circle cx="12" cy="6" r="1.6"/>'),
    calendar: sv('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="15.5" cy="14.5" r="1.4"/>'),
    album: sv('<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 16l4.5-4 3.5 3 3-2.5L20 17"/><circle cx="15" cy="9" r="1.6"/>')
  };

  YY.util = U;
})();
