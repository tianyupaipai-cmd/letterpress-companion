/* 语音通话 #/call。通话放在全局 YY.call 里，收起回聊天页也不断，聊天页顶上浮一个小条点回来。
   真正的收音和播放在 js/call-driver.js（接 PaiVoice）。 */
(function () {
  const U = YY.util, api = YY.api, I = U.icon;
  const STATE_TEXT = { connecting: '正在接通…', speaking: '他在说', thinking: '他在想', listening: '在听你说', ended: '已挂断' };
  const mmss = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const ic = {
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    caps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M7 11h4M13 11h4M7 14.5h6M15 14.5h2"/></svg>'
  };

  // 一通电话的状态（页面换走了也留着）
  const call = YY.call = {
    active: false, state: 'connecting', seconds: 0, mute: false, speaker: true, caps: U.store.get('callCaps', true),
    lines: [], seq: 0, level: 0, ctl: null, winId: null, timer: null, listeners: new Set(),
    start(winId) {
      Object.assign(call, { active: true, state: 'connecting', seconds: 0, mute: false, lines: [], level: 0, winId });
      call.ctl = api.startCall(winId, call.onEvent);
      call.timer = setInterval(() => { if (call.state !== 'connecting') call.seconds++; call.emit('tick'); }, 1000);
    },
    onEvent(ev) {
      if (ev.type === 'state') call.state = ev.state;
      if (ev.type === 'level') call.level = ev.value;
      if (ev.type === 'caption') {
        const last = call.lines[call.lines.length - 1];
        if (last && last.who === ev.who && !last.final) Object.assign(last, ev);
        else call.lines.push({ id: ++call.seq, who: ev.who, text: ev.text, final: ev.final });
        call.lines = call.lines.slice(-2);   // 只留最近两句
      }
      if (ev.type === 'error') U.toast(ev.message);
      if (ev.type === 'ended') { call.end(false); return; }
      call.emit(ev.type);
    },
    end(byMe = true) {
      if (!call.active) return;
      call.active = false; call.state = 'ended';
      if (byMe && call.ctl) call.ctl.hangup();
      clearInterval(call.timer);
      call.emit('ended');
      paintPill();
    },
    emit(type) { call.listeners.forEach((fn) => fn(type)); }
  };

  // 收起后浮在别的页上的小条
  function paintPill() {
    let pill = U.$('.call-pill');
    const show = call.active && !/^#\/call/.test(location.hash);
    if (!show) { if (pill) pill.remove(); return; }
    if (!pill) {
      pill = document.createElement('a');
      pill.className = 'call-pill';
      pill.href = '#/call';
      document.body.appendChild(pill);
    }
    pill.innerHTML = '<i aria-hidden="true"></i>通话中<span class="mono">' + mmss(call.seconds) + '</span>';
  }
  call.listeners.add((type) => { if (type === 'tick') paintPill(); });
  window.addEventListener('hashchange', paintPill);

  YY.pages.call = {
    async render(view) {
      const wins = YY.sidebar.windows();
      const profile = YY.sidebar.profile();
      const win = wins.find((w) => w.kind === 'companion');
      if (!call.active) call.start(win.id);
      paintPill();

      const face = profile.him.avatar ? `<img src="${U.esc(profile.him.avatar)}" alt="">` : `<span>${U.esc(String(profile.him.name).charAt(0))}</span>`;
      view.innerHTML = `<div class="call" aria-label="语音通话">
        <div class="call-top">
          <button type="button" class="ibtn rz" data-act="min" aria-label="收起到聊天">${ic.down}</button>
          <span class="time" aria-live="off"></span>
          <span class="gap"></span>
        </div>
        <div class="call-who"><b>${U.esc(profile.him.name)}</b><small>${U.esc(win.agent)} · ${U.esc(win.target)}</small></div>
        <div class="medal" aria-hidden="true">
          <span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span>
          <svg class="arc" viewBox="0 0 290 290"><circle cx="145" cy="145" r="119" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="120 628" transform="rotate(-70 145 145)"/></svg>
          <span class="disc rz">${face}</span>
        </div>
        <div class="call-state rz-s" role="status"><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="st"></span></div>
        <section class="caps wl" aria-label="实时字幕" aria-live="polite"></section>
        <span class="caps-tip">通话里说的话会记进聊天</span>
        <div class="call-btns">
          <label><button type="button" class="rz" data-act="mute" aria-pressed="false" aria-label="静音">${I.mic}</button>静音</label>
          <label><button type="button" class="rz" data-act="speaker" aria-pressed="true" aria-label="扬声器">${ic.speaker}</button>扬声器</label>
          <label><button type="button" class="rz" data-act="caps" aria-pressed="true" aria-label="字幕">${ic.caps}</button>字幕</label>
          <label><button type="button" class="hang" data-act="hang" aria-label="挂断">${I.phone}</button>挂断</label>
        </div>
      </div>`;

      const root = U.$('.call', view);
      const capsEl = U.$('.caps', root);

      function paint(type) {
        if (!document.body.contains(root)) return;
        root.classList.toggle('connecting', call.state === 'connecting');
        root.classList.toggle('speaking', call.state === 'speaking');
        root.classList.toggle('listening', call.state === 'listening');
        root.classList.toggle('no-caps', !call.caps);
        U.$('.time', root).textContent = call.state === 'connecting' ? '正在接通' : (call.state === 'ended' ? '已挂断 · ' : '通话中 · ') + mmss(call.seconds);
        U.$('.st', root).textContent = call.mute && call.state === 'listening' ? '已静音' : STATE_TEXT[call.state];
        root.style.setProperty('--lv', call.state === 'speaking' ? call.level.toFixed(2) : 0);
        if (type === 'caption' || type === undefined) {
          // 句子没变只改文字；有新的一句才重排，新句加入场动画
          const ids = call.lines.map((l) => l.id).join(',');
          if (capsEl.dataset.ids !== ids) {
            const old = (capsEl.dataset.ids || '').split(',');
            capsEl.innerHTML = call.lines.map((l) => `<div class="ln ${l.who === 'him' ? 'from-him' : ''}${old.includes(String(l.id)) ? '' : ' new'}"><b>${l.who === 'him' ? '他' : '你'}</b><span></span></div>`).join('');
            capsEl.dataset.ids = ids;
          }
          U.$$('.ln span', capsEl).forEach((sp, i) => {
            const l = call.lines[i], text = U.esc(l.text);
            // 他正在说的那句，最新几个字用强调色
            sp.innerHTML = l.who === 'him' && !l.final && i === call.lines.length - 1 && text.length > 3 ? text.slice(0, -3) + '<em>' + text.slice(-3) + '</em>' : text;
          });
        }
        const set = (act, on) => U.$(`[data-act="${act}"]`, root).setAttribute('aria-pressed', on);
        set('mute', call.mute); set('speaker', call.speaker); set('caps', call.caps);
        if (type === 'ended') setTimeout(() => { if (location.hash === '#/call') location.hash = '#/chat'; }, 900);
      }

      U.$('[data-act="min"]', root).addEventListener('click', () => { location.hash = '#/chat'; });
      U.$('[data-act="mute"]', root).addEventListener('click', () => { call.mute = !call.mute; call.ctl && call.ctl.setMute(call.mute); paint('x'); });
      U.$('[data-act="speaker"]', root).addEventListener('click', () => { call.speaker = !call.speaker; call.ctl && call.ctl.setSpeaker(call.speaker); paint('x'); });
      U.$('[data-act="caps"]', root).addEventListener('click', () => { call.caps = !call.caps; U.store.set('callCaps', call.caps); paint('x'); });
      U.$('[data-act="hang"]', root).addEventListener('click', () => call.end(true));

      call.listeners.add(paint);
      YY.pages.call.cleanup = () => call.listeners.delete(paint);
      paint();
    }
  };
})();
