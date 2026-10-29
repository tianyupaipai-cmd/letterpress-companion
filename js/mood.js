/* 心潮念 #/mood：收音机（情绪 / 强度 / 安全感 / 自信 / 心境 / 矛盾）、邮戳（今天亮过的心情）、
   键盘（11 股驱力，越强键越高，按一下弹出来）、压辊（他此刻在想）、纸条（念头）、折纸（梦）、常说的词。每 5 分钟刷新一次。
   数据来自心潮念：https://github.com/tianyupaipai-cmd/xinchao-nian （快照 /v1/dashboard/snapshot、此刻 /v1/now） */
(function () {
  const U = YY.util, api = YY.api, I = U.icon;
  const SCALE = ['平静', '开心', '心动', '想念', '委屈', '低落', '生气'];
  // 矛盾的两股驱力各自落在刻度盘的哪个词上
  const DRIVE_WORD = { anger: '生气', grieve: '低落', possess: '想念', favored: '心动', libido: '心动', share: '开心', curiosity: '开心', monitor: '想念', boredom: '平静', reflection: '平静', duty: '平静' };
  const pos = (i, n) => (8 + i * (84 / (n - 1))).toFixed(2) + '%';
  const hm = (iso) => U.hm(iso);
  const md = (iso) => { const d = new Date(iso); return (d.getMonth() + 1) + '/' + d.getDate(); };

  YY.pages.mood = {
    async render(view) {
      let sel = null, markOn = null, timer = null;
      view.innerHTML = `<div class="page-root">
        <header class="ch-head">
          <button type="button" class="ibtn rz" data-act="drawer" aria-label="打开侧边栏">${I.menu}</button>
          <div class="ch-title"><b><span>心潮念</span></b><small class="sub"></small></div>
          <span class="ibtn flat" aria-hidden="true"></span>
        </header>
        <div class="crease ch-crease"></div>
        <div class="md-page"></div>
      </div>`;
      const root = view.firstElementChild;
      const body = U.$('.md-page', root);
      let snap = null, now = null;

      async function load(first) {
        [snap, now] = await Promise.all([api.getSnapshot(), api.getNow()]);
        snap.drives.sort((a, b) => b.value - a.value);
        if (!sel || !snap.drives.some((d) => d.key === sel)) sel = snap.drives[0].key;
        U.$('.sub', root).textContent = '刚刚更新' + (now.doing ? ' · ' + now.doing : '');
        paint(first);
      }

      function radioHTML() {
        const e = snap.emotion, st = snap.stamen;
        const scale = SCALE.includes(e.shown) ? SCALE.slice() : SCALE.map((w, i) => (i === 3 ? e.shown : w));
        const at = scale.indexOf(e.shown);
        let ghost = -1;
        if (snap.mixed) {
          const other = snap.mixed.id.split('+').map((k) => DRIVE_WORD[k]).find((w) => w && w !== e.shown) || '委屈';
          ghost = scale.indexOf(other);
        }
        const inten = e.intensity != null ? e.intensity : snap.drives[0].value;
        const bars = Math.max(1, Math.round(inten * 5));
        const strength = ['很弱', '偏弱', '一般', '较强', '很强'][bars - 1];
        const meter = (label, v) => `<div class="meter"><span class="face"><svg viewBox="0 0 96 58" aria-hidden="true">
            <path d="M18 48 A34 34 0 0 1 78 48" fill="none" stroke="rgba(110,85,55,.25)" stroke-width="1.2"/>
            <path d="M66 22 A34 34 0 0 1 78 48" fill="none" stroke="var(--accent)" stroke-width="2" opacity=".5"/>
            <g stroke="rgba(110,85,55,.35)" stroke-width="1"><path d="M18 48l4-2"/><path d="M26 30l3 3"/><path d="M48 14v4"/><path d="M70 30l-3 3"/><path d="M78 48l-4-2"/></g>
            <g class="nd" data-rot="${(-60 + v * 120).toFixed(1)}" style="transform:rotate(-60deg)"><path d="M48 50V18" stroke="#2B2A27" stroke-width="1.6" stroke-linecap="round"/></g>
            <circle cx="48" cy="50" r="4" fill="#2B2A27"/></svg></span><span>${label} <span class="mono">${Math.round(v * 100)}</span></span></div>`;
        const moodWord = st.mood > .2 ? '偏暖' : st.mood < -.2 ? '偏冷' : '平稳';
        return `<div class="radio paper">
          <div class="radio-top"><span class="mono">心潮 · 调频</span><span class="on${now.online ? '' : ' off'}"><i></i>${now.online ? '正在收听' : '他不在线'}</span></div>
          <div class="dial" role="img" aria-label="他现在的情绪：${U.esc(e.shown)}">
            ${scale.map((w, i) => `<span class="w${i === at ? ' on' : ''}" style="left:${pos(i, scale.length)}">${U.esc(w)}</span>`).join('')}
            <span class="ticks" aria-hidden="true">${'<i></i>'.repeat(41)}</span>
            ${ghost >= 0 ? `<span class="needle ghost" style="left:${pos(ghost, scale.length)}"></span>` : ''}
            <span class="needle${ghost >= 0 ? ' shake' : ''}" data-to="${pos(at, scale.length)}" style="left:${pos(0, scale.length)}"></span>
          </div>
          <div class="radio-mid">
            <div class="signal"><span class="bars" aria-hidden="true">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < bars ? 'on' : ''}" style="height:${8 + i * 4}px"></i>`).join('')}</span><small>强度 · ${strength}</small></div>
            <div class="grille" aria-hidden="true">${'<i></i>'.repeat(42)}</div>
          </div>
          <div class="radio-meters">
            ${meter('安全感', st.security)}${meter('自信', st.confidence)}
            <div class="meter"><span class="knob-wrap"><span class="mono" style="left:-4px">冷</span><span class="mono" style="right:-4px">暖</span><span class="knob rz" data-rot="${(st.mood * 60).toFixed(1)}"><i></i></span></span><span>心境 <span style="color:var(--accent-ink)">${moodWord}</span></span></div>
          </div>
          ${snap.mixed ? `<div class="mixed-note wl-s"><span class="two" aria-hidden="true"><i></i><i></i></span>指针在「${U.esc(e.shown)}」和「${U.esc(scale[ghost])}」之间来回抖：${U.esc(snap.mixed.name)} · ${sinceText(snap.mixed.since)}</div>` : ''}
        </div>`;
      }

      function sinceText(iso) {
        const m = Math.round((Date.now() - new Date(iso)) / 60000);
        return m < 60 ? m + ' 分钟' : Math.round(m / 60) + ' 小时';
      }

      function keysHTML() {
        let col = 0;
        return snap.drives.map((d, i) => {
          const wide = i === 0;
          const row = Math.floor(col / 4);
          col += wide ? 2 : 1;
          const h = Math.round(4 + d.value * 22);
          return `<button type="button" class="key${wide ? ' wide' : ''}${d.key === sel ? ' on' : ''}${d.value < .1 ? ' low' : ''}" data-key="${d.key}" aria-pressed="${d.key === sel}" aria-label="${U.esc(d.label)} ${Math.round(d.value * 100)}" style="z-index:${row + 1}">
            <span class="stem" aria-hidden="true"></span>
            <span class="pop" aria-hidden="true"><b>${U.esc(d.label)}</b><span class="mono">${Math.round(d.value * 100)}</span></span>
            <span class="body"><span class="cap"><b class="${d.label.length > 2 ? 'long' : ''}">${U.esc(d.label)}</b><span class="mono">${Math.round(d.value * 100)}</span></span>
            <span class="skirt" style="height:${h}px;box-shadow:0 ${(2 + h / 4).toFixed(1)}px ${(3 + h / 3).toFixed(1)}px rgba(110,85,55,${(.18 + d.value * .14).toFixed(2)})"></span></span>
          </button>`;
        }).join('');
      }

      async function paintDrive() {
        const d = snap.drives.find((x) => x.key === sel);
        const box = U.$('.drive-card', body);
        if (!d || !box) return;
        const h = await api.getDriveHistory(sel);
        const arrow = h.delta > .03 ? '↑' : h.delta < -.03 ? '↓' : '·';
        box.innerHTML = `<div class="h"><b>${U.esc(d.label)}</b><span class="mono">${Math.round(d.value * 100)} ${arrow}</span><small>按下的这个键</small></div>
          <p>${U.esc(h.note)}</p>
          <div class="vol" role="img" aria-label="${U.esc(d.label)}最近 24 小时的起伏">${h.points.map((v, i) => `<i class="${i === h.points.length - 1 ? 'now' : i > h.points.length - 6 ? 'recent' : ''}" style="height:${Math.max(4, Math.round(v * 36))}px;animation-delay:${(i * 14)}ms"></i>`).join('')}</div>
          <div class="vol-t"><span>昨晚</span><span>早上</span><span>下午</span><span>现在</span></div>`;
        U.$$('.key', body).forEach((k) => { const on = k.dataset.key === sel; k.classList.toggle('on', on); k.setAttribute('aria-pressed', on); });
        U.$$('.pop .mono', body).forEach((m) => { if (m.closest('.key').dataset.key === sel) m.textContent = Math.round(d.value * 100) + ' ' + arrow; });
      }

      function paint(first) {
        const e = snap.emotion;
        const lines = now.lines || [];
        const dur = 0.6 * (lines.length + 1);
        body.innerHTML = `
          ${radioHTML()}
          ${e.marks && e.marks.length ? `<section class="md-sec"><div class="md-lbl">今天亮过的心情</div>
            <div class="marks">${e.marks.map((m, i) => { const s = 40 + (m.weight || 1) * 8; return `<button type="button" class="mark" data-mark="${i}" aria-pressed="${markOn === i}"><span class="stamp${(m.weight || 1) >= 3 ? ' hot' : ''}" style="width:${s}px;height:${s}px;font-size:${11 + (m.weight || 1)}px">${U.esc(m.word)}</span><span class="mono">${hm(m.at)}</span></button>`; }).join('')}</div>
            ${markOn != null && e.marks[markOn] ? `<div class="mark-why wl-s">${U.esc(e.marks[markOn].word)} · ${e.marks[markOn].why ? '因为' + U.esc(e.marks[markOn].why) : '没说原因'}${e.marks[markOn].n > 1 ? ' · 亮了 ' + e.marks[markOn].n + ' 次' : ''}</div>` : ''}
          </section>` : ''}
          <section class="md-sec"><div class="md-lbl"><span>驱力 · 键盘</span><small>越强的键越高 · 按一下看它</small></div>
            <div class="kb-wrap"><div class="kb"><div class="kb-grid">${keysHTML()}</div></div></div>
            <div class="drive-card rz"></div>
          </section>
          ${lines.length ? `<section class="md-sec"><div class="md-lbl">他此刻在想</div>
            <div class="think-card rz" style="--dur:${dur}s">
              ${lines.map((l, i) => `<span class="ln" style="animation-delay:${first ? ((i + 1) * dur / (lines.length + 1)).toFixed(2) : 0}s">${U.esc(l)}</span>`).join('')}
              ${first ? '<span class="roller" aria-hidden="true"></span>' : ''}
            </div>
            ${now.thought ? `<div class="slip"><small>冒出来的念头</small><span>${U.esc(now.thought)}</span></div>` : ''}
          </section>` : ''}
          ${snap.dreams && snap.dreams.length ? `<section class="md-sec"><div class="md-lbl">他的梦</div>
            <div class="dreams">${snap.dreams.slice(0, 3).map((d, i) => `<button type="button" class="dream" data-dream="${i}" aria-label="展开 ${md(d.at)} 的梦"><span class="fold"></span><span class="mono">${md(d.at)}</span></button>`).join('')}</div>
            <span class="soft" style="font-size:12px">折起来的是他的梦，点开会展开成一张纸</span>
          </section>` : ''}
          ${snap.keywords && snap.keywords.length ? `<section class="md-sec"><div class="md-lbl">他最近常说</div><div class="words">${snap.keywords.map((w) => `<span>${U.esc(w)}</span>`).join('')}</div></section>` : ''}`;
        // 针、指针表、旋钮：先停在起点，下一帧转到该在的位置
        setTimeout(() => {
          U.$$('[data-to]', body).forEach((n) => { n.style.left = n.dataset.to; });
          U.$$('.nd', body).forEach((n) => { n.style.transform = `rotate(${n.dataset.rot}deg)`; });
          U.$$('.knob', body).forEach((n) => { n.style.transform = `rotate(${n.dataset.rot}deg)`; });
        }, 80);
        paintDrive();
      }

      root.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="drawer"]')) { YY.shell.open(); return; }
        const k = e.target.closest('[data-key]');
        if (k) { if (k.dataset.key !== sel) { sel = k.dataset.key; navigator.vibrate && navigator.vibrate(8); paintDrive(); } return; }
        const m = e.target.closest('[data-mark]');
        if (m) { const i = +m.dataset.mark; markOn = markOn === i ? null : i; paint(false); return; }
        const d = e.target.closest('[data-dream]');
        if (d) {
          const dr = snap.dreams[+d.dataset.dream];
          U.openSheet(`<div class="bs-title"><h2>他的梦</h2><span class="mono">${md(dr.at)} ${hm(dr.at)}</span></div><div class="dream-open"><p>${U.esc(dr.text)}</p><span class="mono">醒来记下的</span></div>`, null, '他的梦');
        }
      });

      await load(true);
      timer = setInterval(() => load(false), 5 * 60000);
      YY.pages.mood.cleanup = () => clearInterval(timer);
    }
  };
})();
