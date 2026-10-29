/* 相册 #/album：全部 / 我存的 / 他存的、相簿、照片按日期、看大图、最近删除。两个人都能存、能删、能整理。 */
(function () {
  const U = YY.util, api = YY.api, I = U.icon;
  const PIC = '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M3 16l5-4.5 3.5 3 3-2.5L19 16"/><circle cx="15" cy="7.5" r="1.6"/></svg>';
  const ic = {
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5h6l2 2h9v9h-17z"/><path d="M12 12.5v4M10 14.5h4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M5 5.5h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-7.5L7 20.5V17H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
    more: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="4.5" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="15.5" cy="10" r="1.6"/></svg>'
  };
  const printHTML = (p) => `<span class="pr"${p && !p.url && p.fill ? ` style="background:${U.esc(p.fill)}"` : ''}>${p && p.url ? `<img src="${U.esc(p.url)}" alt="" loading="lazy">` : PIC}</span>`;
  const whoHTML = (by) => `<span class="who ${by === 'him' ? 'him' : ''}" aria-hidden="true">${by === 'him' ? '他' : '我'}</span>`;
  const dayKey = (iso) => { const d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const dayLabel = (iso) => {
    const d = new Date(iso), t = new Date();
    const diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    return diff === 0 ? '今天' : diff === 1 ? '昨天' : (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  };

  YY.pages.album = {
    async render(view) {
      const st = { who: U.store.get('albumWho', 'all'), album: '', photos: [], albums: [] };
      view.innerHTML = `<div class="page-root">
        <header class="ch-head">
          <button type="button" class="ibtn rz" data-act="drawer" aria-label="打开侧边栏">${I.menu}</button>
          <div class="ch-title"><b><span>相册</span></b></div>
          <button type="button" class="ibtn rz" data-act="upload" aria-label="存照片">${I.plus}</button>
        </header>
        <div class="crease ch-crease"></div>
        <div class="alb"></div>
      </div>`;
      const root = view.firstElementChild;
      const body = U.$('.alb', root);

      async function paint() {
        const [photos, albums, counts, trash] = await Promise.all([api.listPhotos({ who: st.who, album: st.album }), api.listAlbums(), api.photoCounts(), api.listTrash()]);
        st.photos = photos; st.albums = albums;
        const cur = albums.find((a) => a.id === st.album);
        const groups = [];
        photos.forEach((p) => { const k = dayKey(p.date); let g = groups.find((x) => x.k === k); if (!g) groups.push(g = { k, date: p.date, list: [] }); g.list.push(p); });
        const albumOf = (p) => (albums.find((a) => a.id === p.album) || {}).name || '';
        body.innerHTML = `
          <div class="seg wl" role="tablist" aria-label="谁存的">
            ${[['all', '全部'], ['me', '我存的'], ['him', '他存的']].map(([k, n]) => `<button type="button" role="tab" data-who="${k}" aria-selected="${st.who === k}">${n} <span class="mono">${counts[k]}</span></button>`).join('')}
          </div>
          <div>
            <div class="sec-label"><span>相簿${cur ? ' · ' + U.esc(cur.name) : ''}</span>${cur ? `<button type="button" data-album="">看全部</button>` : `<button type="button" data-act="newAlbum">${I.plus}新建</button>`}</div>
            <div class="albums">${albums.map((a) => `<button type="button" class="album rz${a.id === st.album ? ' on' : ''}" data-album="${a.id}" aria-pressed="${a.id === st.album}">
              <span class="cov wl-s">${printHTML(a.cover)}</span>
              <b>${U.esc(a.name)}</b><small>${a.count} 张 · ${a.by === 'him' ? '他建的' : '我建的'}</small></button>`).join('')}</div>
          </div>
          ${groups.length ? groups.map((g) => `
            <div class="day-h"><b>${dayLabel(g.date)}</b><span class="mono">${dayLabel(g.date) === '今天' || dayLabel(g.date) === '昨天' ? (new Date(g.date).getMonth() + 1) + ' 月 ' + new Date(g.date).getDate() + ' 日' : ''}${albumOf(g.list[0]) && !st.album ? ' ' + U.esc(albumOf(g.list[0])) : ''}</span></div>
            <div class="grid3">${g.list.map((p) => `<button type="button" class="cell wl-s" data-ph="${p.id}" aria-label="${p.by === 'him' ? '他存的' : '我存的'}照片">${printHTML(p)}${whoHTML(p.by)}</button>`).join('')}</div>`).join('')
            : `<p class="alb-empty">${st.who === 'him' ? '他还没存照片' : '这里还没有照片，点右上角存一张'}</p>`}
          <button type="button" class="trash-link wl" data-act="trash">${ic.trash}<span class="t"><span>最近删除 · ${trash.length}</span><small>两个人谁删的都能在 30 天内找回</small></span>${I.chevRight}</button>`;
      }

      // ---- 看大图 ----
      function openPhoto(id) {
        let idx = st.photos.findIndex((p) => p.id === id);
        if (idx < 0) return;
        const el = document.createElement('section');
        el.className = 'ph paper';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', '照片');
        document.body.appendChild(el);
        const close = () => { el.remove(); paint(); };
        const draw = () => {
          const p = st.photos[idx];
          const d = new Date(p.date);
          const albumName = (st.albums.find((a) => a.id === p.album) || {}).name;
          el.innerHTML = `
            <header class="ch-head">
              <button type="button" class="ibtn rz" data-x="close" aria-label="返回相册">${I.back}</button>
              <div class="ch-title"><b><span>${d.getMonth() + 1} 月 ${d.getDate()} 日</span></b><small>${U.hm(p.date)} · ${idx + 1} / ${st.photos.length}</small></div>
              <span class="ibtn flat" aria-hidden="true"></span>
            </header>
            <div class="ph-stage">${printHTML(p)}</div>
            <section class="ph-info rz">
              <div class="ph-who">${whoHTML(p.by)}<span class="t"><b>${p.by === 'him' ? '他存的' : '我存的'}</b><small>${p.source === 'chat' ? '从聊天里存的' : '自己传的'}${albumName ? ' · 在「' + U.esc(albumName) + '」' : ''}</small></span>${albumName ? `<span class="tag">${U.esc(albumName)}</span>` : ''}</div>
              ${p.noteHim ? `<div class="crease"></div><div class="ph-note"><span>他写</span><p>${U.esc(p.noteHim)}</p></div>` : ''}
              <label class="ph-mine wl-s"><span>我写</span><input value="${U.esc(p.noteMe || '')}" placeholder="写一句…" aria-label="写一句"></label>
            </section>
            <div style="flex:1"></div>
            <div class="ph-acts">
              <label>${p.url ? `<a class="rz" href="${U.esc(p.url)}" download aria-label="存到手机">${ic.download}</a>` : `<button type="button" class="rz" data-x="save" aria-label="存到手机">${ic.download}</button>`}存到手机</label>
              <label><button type="button" class="rz" data-x="move" aria-label="移到相簿">${ic.folder}</button>移到相簿</label>
              <label><button type="button" class="rz" data-x="chat" aria-label="发到聊天">${ic.chat}</button>发到聊天</label>
              <label><button type="button" class="wl del" data-x="del" aria-label="删除">${ic.trash}</button>删除</label>
            </div>`;
          const inp = U.$('.ph-mine input', el);
          inp.addEventListener('change', () => { p.noteMe = inp.value.trim(); api.setPhotoNote(p.id, p.noteMe); U.toast('写好了，他也能看到'); });
        };
        el.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-x]');
          if (!b) return;
          const p = st.photos[idx];
          const k = b.dataset.x;
          if (k === 'close') close();
          if (k === 'save') U.toast('演示照片没有原图，接上后端就能存');
          if (k === 'chat') {
            const comp = YY.sidebar.windows().find((w) => w.kind === 'companion');
            await api.sendMessage(comp.id, { text: '', attachments: [{ kind: 'image', name: '照片', size: 0, url: p.url }] });
            U.toast('发给他了');
          }
          if (k === 'move') {
            U.openSheet(`<div class="bs-title"><h2>移到相簿</h2></div><div class="menu rz-s">
              ${st.albums.map((a) => `<button type="button" data-to="${a.id}">${ic.folder}<span style="flex:1">${U.esc(a.name)}</span>${a.id === p.album ? I.check : ''}</button>`).join('')}
              <button type="button" data-to="">${I.x}<span style="flex:1">不放相簿</span></button></div>`, (sh, done) => {
              U.$$('[data-to]', sh).forEach((x) => x.addEventListener('click', async () => { done(); p.album = x.dataset.to; await api.movePhoto(p.id, p.album); draw(); U.toast('移好了'); }));
            }, '移到相簿');
          }
          if (k === 'del') {
            U.openSheet(`<div class="bs-title"><h2>删除这张？</h2></div>
              <p class="soft" style="font-size:13px;margin:0 0 16px">${p.by === 'him' ? '这是他存的。' : ''}删除后放进「最近删除」，30 天内两个人都能找回。</p>
              <div class="menu rz-s"><button type="button" class="danger" data-ok>${ic.trash}删除</button><button type="button" data-close>${I.x}算了</button></div>`, (sh, done) => {
              U.$('[data-ok]', sh).addEventListener('click', async () => {
                done();
                await api.deletePhoto(p.id);
                st.photos.splice(idx, 1);
                U.toast('放进最近删除了');
                if (!st.photos.length) { close(); return; }
                idx = Math.min(idx, st.photos.length - 1); draw();
              });
            }, '删除照片');
          }
        });
        // 左右划切换
        let x0 = null;
        el.addEventListener('touchstart', (e) => { if (e.target.closest('.ph-stage')) x0 = e.touches[0].clientX; }, { passive: true });
        el.addEventListener('touchend', (e) => {
          if (x0 == null) return;
          const dx = e.changedTouches[0].clientX - x0; x0 = null;
          if (Math.abs(dx) < 50) return;
          idx = Math.max(0, Math.min(st.photos.length - 1, idx + (dx < 0 ? 1 : -1))); draw();
        });
        draw();
        YY.pages.album.cleanup = () => el.remove();
      }

      function openTrash() {
        api.listTrash().then((list) => {
          U.openSheet(`<div class="bs-title"><h2>最近删除</h2><span class="mono">30 天后自动清掉</span></div>
            ${list.length ? `<div class="grid3">${list.map((p) => `<button type="button" class="cell wl-s" data-back="${p.id}" aria-label="找回这张">${printHTML(p)}<span class="who ${p.deletedBy === 'him' ? 'him' : ''}" style="width:auto;padding:0 6px;border-radius:11px;font-weight:400">${p.deletedBy === 'him' ? '他删的' : '我删的'}</span></button>`).join('')}</div>
            <p class="soft" style="font-size:12px;margin:12px 0 0">点一张就放回相册</p>` : '<p class="alb-empty">没有删掉的照片</p>'}`, (sh, done) => {
            U.$$('[data-back]', sh).forEach((b) => b.addEventListener('click', async () => { await api.restorePhoto(b.dataset.back); done(); U.toast('放回去了'); paint(); }));
          }, '最近删除');
        });
      }

      function upload() {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
        inp.addEventListener('change', async () => {
          if (!inp.files.length) return;
          await api.savePhotos(Array.from(inp.files), { album: st.album });
          U.toast('存好了，他也能看到');
          paint();
        });
        inp.click();
      }

      root.addEventListener('click', (e) => {
        const a = e.target.closest('[data-act]');
        if (a) {
          const k = a.dataset.act;
          if (k === 'drawer') YY.shell.open();
          if (k === 'upload') upload();
          if (k === 'trash') openTrash();
          if (k === 'newAlbum') U.openSheet(`<div class="bs-title"><h2>新建相簿</h2></div><form class="link-form"><label class="sr" for="alb-name">名字</label><input id="alb-name" class="wl" placeholder="比如：第一次旅行" required style="font-family:var(--font-sans)"><div class="row"><button type="button" data-close>取消</button><button type="submit" class="btn-accent">建好</button></div></form>`, (sh, done) => {
            U.$('form', sh).addEventListener('submit', async (ev) => { ev.preventDefault(); const n = U.$('input', sh).value.trim(); if (!n) return; done(); await api.createAlbum(n); U.toast('建好了'); paint(); });
          }, '新建相簿');
          return;
        }
        const w = e.target.closest('[data-who]');
        if (w) { st.who = w.dataset.who; U.store.set('albumWho', st.who); paint(); return; }
        const al = e.target.closest('[data-album]');
        if (al) { st.album = st.album === al.dataset.album ? '' : al.dataset.album; paint(); return; }
        const ph = e.target.closest('[data-ph]');
        if (ph) openPhoto(ph.dataset.ph);
      });

      paint();
    }
  };
})();
