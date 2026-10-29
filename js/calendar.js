/* 日历 #/calendar：月历 + 当天（他的日记 / OB 记忆 / 待办备忘闹钟 / 纪念日 / 经期）+ 记一笔（连接桥） */
(function () {
  const U = YY.util, api = YY.api, I = U.icon;
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const TYPES = [
    { k: 'todo', name: '待办', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>' },
    { k: 'memo', name: '备忘', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8.5 9h7M8.5 12.5h5"/></svg>' },
    { k: 'alarm', name: '闹钟', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2 1.5M5 4L3 6M19 4l2 2"/></svg>' },
    { k: 'period', name: '经期', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5z"/></svg>' },
    { k: 'anniv', name: '纪念日', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>' }
  ];
  const bridgeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15c3-5 6-7.5 9-7.5s6 2.5 9 7.5"/><path d="M3 15h18M7 15v-3.2M12 15V7.5M17 15v-3.2"/></svg>';
  const FILTERS = [
    { k: 'diary', name: '日记' }, { k: 'ob', name: 'OB 记忆' }, { k: 'item', name: '待办备忘' }, { k: 'period', name: '经期' }, { k: 'anniv', name: '纪念日' }
  ];

  const repeatLabel = (r = []) => {
    const k = r.slice().sort().join('');
    if (!r.length) return '一次';
    if (k === '1234567') return '每天';
    if (k === '12345') return '工作日';
    if (k === '67') return '周末';
    return '周' + r.slice().sort().map((n) => '一二三四五六日'[n - 1]).join('');
  };

  YY.pages.calendar = {
    async render(view) {
      const today = ymd(new Date());
      const st = { y: new Date().getFullYear(), m: new Date().getMonth() + 1, sel: today, month: {}, filters: U.store.get('calFilters', { diary: true, ob: true, item: true, period: true, anniv: true }) };

      view.innerHTML = `<div class="page-root">
        <header class="ch-head">
          <button type="button" class="ibtn rz" data-act="drawer" aria-label="打开侧边栏">${I.menu}</button>
          <div class="ch-title"><b><span>日历</span></b></div>
          <button type="button" class="ibtn rz" data-act="add" aria-label="记一笔">${I.plus}</button>
        </header>
        <div class="crease ch-crease"></div>
        <div class="cal">
          <section class="cal-sec">
            <div class="cal-month">
              <b></b><span class="yr"></span><span class="sp"></span>
              <button type="button" class="ibtn rz-s" data-act="prev" aria-label="上个月">${I.back}</button>
              <button type="button" class="pill rz-s" data-act="today">今天</button>
              <button type="button" class="ibtn rz-s" data-act="next" aria-label="下个月">${I.chevRight}</button>
            </div>
            <div class="cal-legend" role="group" aria-label="显示哪些">${FILTERS.map((f) => `<button type="button" data-f="${f.k}" aria-pressed="${!!st.filters[f.k]}"><i class="mk ${f.k}"></i>${f.name}</button>`).join('')}</div>
            <div class="cal-grid-box rz">
              <div class="cal-week" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
              <div class="cal-grid" role="grid"></div>
            </div>
          </section>
          <section class="cal-sec cal-dayview" aria-live="polite"></section>
        </div></div>`;
      const root = view.firstElementChild;   // 事件绑在这一页自己的根上，不绑共用的 #view

      const gridEl = U.$('.cal-grid', view);
      const dayEl = U.$('.cal-dayview', view);

      async function paintMonth() {
        U.$('.cal-month b', view).textContent = st.m + ' 月';
        U.$('.cal-month .yr', view).textContent = st.y;
        st.month = await api.getMonth(st.y, st.m);
        const first = new Date(st.y, st.m - 1, 1);
        const lead = (first.getDay() + 6) % 7;
        const days = new Date(st.y, st.m, 0).getDate();
        const cells = [];
        for (let i = 0; i < lead; i++) cells.push('<span class="cal-day blank"></span>');
        for (let d = 1; d <= days; d++) {
          const k = st.y + '-' + pad(st.m) + '-' + pad(d);
          const info = st.month[k] || {};
          const f = st.filters;
          const cls = ['cal-day', k > today ? 'future' : '', k === today ? 'today' : '', k === st.sel ? 'on' : '', info.anniv && f.anniv ? 'anniv' : '',
            info.period && f.period ? 'period' : '', info.ps && f.period ? 'ps' : '', info.pe && f.period ? 'pe' : ''].filter(Boolean).join(' ');
          const dots = (info.diary && f.diary ? '<i class="mk diary"></i>' : '') + (info.ob && f.ob ? '<i class="mk ob"></i>' : '') + (info.item && f.item ? '<i class="mk item"></i>' : '') + (info.anniv && f.anniv ? '<i class="mk anniv"></i>' : '');
          cells.push(`<button type="button" class="${cls}" data-d="${k}" aria-label="${st.m} 月 ${d} 日${k === today ? '，今天' : ''}" ${k === st.sel ? 'aria-selected="true"' : ''}><span class="n">${d}</span><span class="dots">${dots}</span></button>`);
        }
        gridEl.innerHTML = cells.join('');
      }

      async function paintDay() {
        const d = new Date(st.sel + 'T00:00:00');
        const r = await api.getDay(st.sel);
        const isToday = st.sel === today;
        const head = `<div class="cal-dayhead"><b>${d.getMonth() + 1} 月 ${d.getDate()} 日</b><span>周${WEEK[d.getDay()]}${isToday ? ' · 今天' : ''}</span>
          <button type="button" class="pill rz-s" data-act="add">${I.plus}记一笔</button></div>`;
        const blocks = [];
        r.anniv.forEach((a) => blocks.push(`<div class="cal-flag rz-s"><i class="mk anniv"></i>${U.esc(a.title)}${a.date !== st.sel ? `<span class="soft" style="margin-left:auto;font-size:12px">第 ${d.getFullYear() - Number(a.date.slice(0, 4))} 年</span>` : ''}</div>`));
        if (r.period) blocks.push(`<div class="cal-flag wl-s"><i class="mk period" style="background:#E6C9C0"></i>经期第 ${r.period.day} 天</div>`);
        if (r.diary) blocks.push(`<article class="cal-card rz">
            <div class="cal-card-head"><i class="mk diary"></i><b>他的日记</b><span class="mono">连接桥 · 日记</span></div>
            <div class="diary-title">${U.esc(r.diary.title)}</div>
            <p class="diary-ex">${U.esc(r.diary.excerpt)}</p>
            <button type="button" class="more-link" data-act="diary">读全文${I.chevRight}</button>
          </article>`);
        if (r.ob.length) blocks.push(`<article class="cal-card rz" style="padding-bottom:8px;gap:0">
            <div class="cal-card-head" style="padding-bottom:8px"><i class="mk ob"></i><b>OB 记忆</b><span class="mono">${r.ob.length} 条</span></div>
            ${r.ob.map((o) => `<div class="ob-row"><span class="mono">${U.esc(o.time)}</span><span class="t">${U.esc(o.text)}${o.important ? '<span class="tag">他标了重要</span>' : ''}</span></div>`).join('')}
          </article>`);
        if (r.items.length) blocks.push(`<article class="cal-card rz">
            <div class="cal-card-head"><i class="mk item"></i><b>待办 · 备忘 · 闹钟</b><span class="mono">已告诉他</span></div>
            ${r.items.map((it) => {
              const by = it.by === 'him' ? '他记的' : '我记的';
              if (it.type === 'todo') return `<button type="button" class="it-row${it.done ? ' done' : ''}" data-todo="${U.esc(it.id)}" role="checkbox" aria-checked="${!!it.done}"><span class="box">${it.done ? I.check : ''}</span><span class="txt">${U.esc(it.title)}</span><span class="by">${by}</span></button>`;
              if (it.type === 'alarm') return `<div class="it-row"><span class="box">${TYPES[2].icon}</span><span class="txt"><span class="mono">${U.esc(it.time)}</span>${U.esc(it.title)}</span><span class="by">${repeatLabel(it.repeat)}${it.callMe ? ' · 他叫你' : ''}</span></div>`;
              return `<div class="it-row"><span class="box">${TYPES[1].icon}</span><span class="txt">${U.esc(it.title)}</span><span class="by">${by}</span></div>`;
            }).join('')}
          </article>`);
        if (!blocks.length) blocks.push('<p class="cal-empty">这天没有记录</p>');
        blocks.push(`<div class="cal-note wl">${bridgeIcon}<span>你记的会通过连接桥告诉他，他记的也会出现在这里</span></div>`);
        dayEl.innerHTML = head + blocks.join('');
      }

      async function refresh() { await paintMonth(); await paintDay(); }

      // ---- 记一笔 ----
      function openAdd(type = 'todo') {
        const f = { type, date: st.sel, title: '', time: '07:30', repeat: [1, 2, 3, 4, 5], callMe: true, end: '', yearly: true };
        const d = new Date(st.sel + 'T00:00:00');
        const close = U.openSheet(`
          <div class="bs-title"><h2>记一笔</h2><span class="mono">${d.getMonth() + 1} 月 ${d.getDate()} 日</span></div>
          <div class="add-types" role="radiogroup" aria-label="记什么">${TYPES.map((t) => `<button type="button" role="radio" data-t="${t.k}" aria-checked="${t.k === type}">${t.icon}${t.name}</button>`).join('')}</div>
          <form class="add-form"></form>`, (el, done) => {
          const form = U.$('form', el);
          const paint = () => {
            U.$$('[data-t]', el).forEach((b) => b.setAttribute('aria-checked', b.dataset.t === f.type));
            const title = (label, ph) => `<label class="field wl"><span>${label}</span><input name="title" value="${U.esc(f.title)}" placeholder="${ph}"></label>`;
            const date = (label, name = 'date') => `<label class="field wl"><span>${label}</span><input type="date" name="${name}" value="${U.esc(f[name])}"></label>`;
            const sw = (name, t, s) => `<div class="sw-row"><span class="t"><b>${t}</b><small>${s}</small></span><button type="button" class="switch" role="switch" data-sw="${name}" aria-checked="${!!f[name]}" aria-label="${t}"><i></i></button></div>`;
            let body = '';
            if (f.type === 'todo') body = title('要做', '比如：周六订位置') + date('哪天');
            if (f.type === 'memo') body = `<label class="field wl area"><span>记下</span><textarea name="title" placeholder="想记的事">${U.esc(f.title)}</textarea></label>` + date('哪天');
            if (f.type === 'alarm') body = `<label class="big-time wl"><span class="sr">时间</span><input type="time" name="time" value="${U.esc(f.time)}"></label>
              <div class="repeat" role="group" aria-label="重复">${['一', '二', '三', '四', '五', '六', '日'].map((w, i) => `<button type="button" data-r="${i + 1}" aria-pressed="${f.repeat.includes(i + 1)}">${w}</button>`).join('')}</div>
              ${title('写什么', '比如：起床，今天有早会')}
              ${sw('callMe', '到点让他叫你', '他会发消息给你，不只是响铃')}`;
            if (f.type === 'period') body = date('开始') + date('结束（可以先不填）', 'end');
            if (f.type === 'anniv') body = title('什么日子', '比如：第一次见面') + date('哪天') + sw('yearly', '每年提醒', '到了那天他会记得');
            form.innerHTML = body + `<div class="crease"></div><div class="add-tip">${bridgeIcon}保存后通过连接桥送进他的窗口，日历上也会显示</div><button type="submit" class="add-save btn-accent">保存</button>`;
            U.$$('[data-r]', form).forEach((b) => b.addEventListener('click', () => { const n = +b.dataset.r; f.repeat = f.repeat.includes(n) ? f.repeat.filter((x) => x !== n) : f.repeat.concat(n).sort(); b.setAttribute('aria-pressed', f.repeat.includes(n)); }));
            U.$$('[data-sw]', form).forEach((b) => b.addEventListener('click', () => { f[b.dataset.sw] = !f[b.dataset.sw]; b.setAttribute('aria-checked', f[b.dataset.sw]); }));
            U.$$('input, textarea', form).forEach((inp) => inp.addEventListener('input', () => { f[inp.name] = inp.value; }));
          };
          U.$$('[data-t]', el).forEach((b) => b.addEventListener('click', () => { f.type = b.dataset.t; paint(); }));
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (['todo', 'memo', 'anniv'].includes(f.type) && !f.title.trim()) { U.toast('写点什么再保存'); return; }
            if (f.type === 'alarm' && !f.time) { U.toast('选个时间'); return; }
            const item = { type: f.type, date: f.date || st.sel, title: f.title.trim() || (f.type === 'period' ? '经期' : f.type === 'alarm' ? '闹钟' : '') };
            if (f.type === 'alarm') Object.assign(item, { time: f.time, repeat: f.repeat, callMe: f.callMe });
            if (f.type === 'period' && f.end) item.end = f.end;
            if (f.type === 'anniv') item.yearly = f.yearly;
            await api.saveItem(item);
            done();
            U.toast('记下了，也告诉他了');
            refresh();
          });
          paint();
        }, '记一笔');
        return close;
      }

      function openDiary() {
        api.getDiary(st.sel).then((dia) => {
          if (!dia) return;
          U.openSheet(`<div class="bs-title"><h2>${U.esc(dia.title)}</h2><span class="mono">${st.sel}</span></div><div class="md diary-full">${YY.md(dia.text)}</div>`, null, '他的日记');
        });
      }

      // ---- 事件 ----
      root.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-act]');
        if (a) {
          const k = a.dataset.act;
          if (k === 'drawer') YY.shell.open();
          if (k === 'add') openAdd();
          if (k === 'diary') openDiary();
          if (k === 'prev' || k === 'next') { const d = new Date(st.y, st.m - 1 + (k === 'next' ? 1 : -1), 1); st.y = d.getFullYear(); st.m = d.getMonth() + 1; paintMonth(); }
          if (k === 'today') { st.y = new Date().getFullYear(); st.m = new Date().getMonth() + 1; st.sel = today; refresh(); }
          return;
        }
        const day = e.target.closest('[data-d]');
        if (day) { st.sel = day.dataset.d; U.$$('.cal-day.on', gridEl).forEach((x) => { x.classList.remove('on'); x.removeAttribute('aria-selected'); }); day.classList.add('on'); day.setAttribute('aria-selected', 'true'); paintDay(); return; }
        const fb = e.target.closest('[data-f]');
        if (fb) { st.filters[fb.dataset.f] = !st.filters[fb.dataset.f]; fb.setAttribute('aria-pressed', st.filters[fb.dataset.f]); U.store.set('calFilters', st.filters); paintMonth(); return; }
        const td = e.target.closest('[data-todo]');
        if (td) { const done = td.getAttribute('aria-checked') !== 'true'; await api.toggleItem(td.dataset.todo, done); paintDay(); }
      });

      refresh();
    }
  };
})();
