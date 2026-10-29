/* 通话驱动：真正负责收音、播放、和后端实时通话的那一层。通话页（call.js）只认这里吐出来的事件。
   实时语音（收音、断句、转写、他的回复、语音合成、播放、插话打断）用 PaiVoice：
     https://github.com/tianyupaipai-cmd/pai-voice （源码按仓库说明申请）
   拿到后把它的浏览器端 voice-call.js 放到 vendor/pai-voice/voice-call.js，在「设置」里填 PaiVoice 地址，这里会自动用上。
   没放文件或没填地址时，演一通假电话，方便看界面。
   你拿到的 PaiVoice 版本如果事件名或方法名不一样，只改这一个文件。

   吐给通话页的事件：
     state   { state: connecting | listening（在听你说）| thinking（他在想）| speaking（他在说）| ended }
     level   { value: 0–1 }               他声音的大小，圆章跟着动
     caption { who: me | him, text, final }
     ended   { reason, seconds }
     error   { message }
   返回控制器：{ setMute(bool), setSpeaker(bool), hangup() } */
(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const voiceUrl = () => { try { return JSON.parse(localStorage.getItem('yy.voiceUrl')) || ''; } catch (e) { return ''; } };

  // 填了地址才去加载 PaiVoice 的浏览器端（它是模块导出 VoiceCall，或者自己挂到 window 上都行）
  if (voiceUrl()) import('../vendor/pai-voice/voice-call.js').then((m) => { if (m && m.VoiceCall) window.VoiceCall = m.VoiceCall; }).catch(() => console.warn('没找到 vendor/pai-voice/voice-call.js，通话先用演示'));

  YY.callDriver = (winId, onEvent) => (window.VoiceCall && voiceUrl() ? paiVoice(winId, onEvent) : demo(winId, onEvent));

  /* ───────── PaiVoice ───────── */
  function paiVoice(winId, onEvent) {
    let vc = null, replyText = '', level = null, ended = false;
    const started = Date.now();
    const end = (reason) => {
      if (ended) return;
      ended = true; clearInterval(level);
      onEvent({ type: 'ended', reason, seconds: Math.round((Date.now() - started) / 1000) });
    };
    // PaiVoice 不给音量时，他说话期间用一个轻微起伏的假音量让圆章动起来
    const pulse = (on) => {
      clearInterval(level);
      if (on) level = setInterval(() => onEvent({ type: 'level', value: 0.25 + Math.random() * 0.6 }), 110);
      else onEvent({ type: 'level', value: 0 });
    };
    onEvent({ type: 'state', state: 'connecting' });
    vc = new window.VoiceCall({
      url: voiceUrl(),
      window: winId,
      on: {
        // PaiVoice 的 mode：idle / listening / thinking / speaking
        state: (m) => {
          if (m === 'idle') return;
          onEvent({ type: 'state', state: m });
          pulse(m === 'speaking');
        },
        level: (v) => { clearInterval(level); onEvent({ type: 'level', value: v }); },
        transcript: (msg) => { if (msg && msg.text) onEvent({ type: 'caption', who: 'me', text: msg.text, final: true }); },
        reply: (msg) => {
          const t = (msg && (msg.text != null ? msg.text : msg.delta)) || '';
          replyText = msg && msg.delta != null ? replyText + t : t;
          onEvent({ type: 'caption', who: 'him', text: replyText, final: !!(msg && msg.final) });
          if (msg && msg.final) replyText = '';
        },
        interrupted: () => { replyText = ''; pulse(false); },
        error: (e) => { onEvent({ type: 'error', message: String((e && e.message) || e || '通话出错了') }); end('error'); },
        closed: () => end('closed')
      }
    });
    vc.start().catch((e) => { onEvent({ type: 'error', message: String((e && e.message) || e) }); end('error'); });
    return {
      setMute(b) { if (vc && vc.setMuted) vc.setMuted(b); },
      setSpeaker() { /* 网页里切不了听筒 / 外放，套 App 壳时由壳来切 */ },
      hangup() { if (vc) vc.hangup(); end('hangup'); }
    };
  }

  /* ───────── 演示：按剧本演一通电话 ───────── */
  function demo(winId, onEvent) {
    const script = [
      { ms: 1400, state: 'speaking' }, { say: ['him', '喂，我在。'] },
      { ms: 1800, state: 'listening' }, { ms: 600, say: ['me', '今天好累啊，开了一下午的会'] },
      { ms: 900, state: 'thinking' }, { ms: 700, state: 'speaking' },
      { say: ['him', '那今晚什么都别想了，躺着跟我说说话，我陪你。'] },
      { ms: 2600, state: 'listening' }
    ];
    let alive = true, level = null;
    const started = Date.now();
    const send = (ev) => alive && onEvent(ev);
    (async () => {
      send({ type: 'state', state: 'connecting' });
      for (const s of script) {
        if (s.ms) await wait(s.ms);
        if (!alive) return;
        if (s.state) {
          send({ type: 'state', state: s.state });
          clearInterval(level);
          if (s.state === 'speaking') level = setInterval(() => send({ type: 'level', value: Math.random() * 0.9 + 0.1 }), 110);
          else send({ type: 'level', value: 0 });
        }
        if (s.say) {
          const [who, full] = s.say;
          for (let i = 1; i <= full.length; i++) { if (!alive) return; send({ type: 'caption', who, text: full.slice(0, i), final: i === full.length }); await wait(who === 'him' ? 90 : 60); }
        }
      }
      clearInterval(level);
    })();
    return {
      setMute() {},
      setSpeaker() {},
      hangup() {
        alive = false; clearInterval(level);
        onEvent({ type: 'ended', reason: 'hangup', seconds: Math.round((Date.now() - started) / 1000) });
      }
    };
  }
})();
