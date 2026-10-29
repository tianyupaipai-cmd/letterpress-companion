/* 语音条：波形、播放器（同一时间只放一条）、录音（按住说话）。聊天页和输入栏都用它。 */
(function () {
  const U = YY.util;

  // 按一个种子生成固定的波形高度（同一条语音每次画出来一样）。后端以后给了真波形就用真的
  function bars(seed, seconds) {
    const n = Math.max(10, Math.min(32, Math.round(8 + seconds * 1.4)));
    let h = 0;
    for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: n }, (_, i) => Math.round(6 + Math.abs(Math.sin(i * 1.7 + h % 97) * Math.cos(i * 0.6 + h % 13)) * 20));
  }
  const len = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

  // ---- 播放器 ----
  let cur = null;   // { key, audio, timer, onTick, onEnd }
  function stop() {
    if (!cur) return;
    if (cur.audio) cur.audio.pause();
    clearInterval(cur.timer);
    const c = cur; cur = null;
    c.onEnd && c.onEnd();
  }
  // 有 url 就真放；演示数据没有 url 就按时长假装在放，方便看样子
  function play(key, { url, seconds, rate = 1, onTick, onEnd }) {
    if (cur && cur.key === key) { stop(); return false; }
    stop();
    const me = cur = { key, onTick, onEnd, rate };
    if (url) {
      const a = me.audio = new Audio(url);
      a.playbackRate = rate;
      a.addEventListener('timeupdate', () => onTick && onTick(a.currentTime / (a.duration || seconds), a.currentTime));
      a.addEventListener('ended', () => { if (cur === me) stop(); });
      a.play().catch(() => { U.toast('放不出来，稍后再试'); stop(); });
    } else {
      const t0 = Date.now();
      me.timer = setInterval(() => {
        const t = ((Date.now() - t0) / 1000) * me.rate;
        onTick && onTick(Math.min(1, t / seconds), t);
        if (t >= seconds && cur === me) stop();
      }, 100);
    }
    return true;
  }
  function setRate(rate) { if (!cur) return; cur.rate = rate; if (cur.audio) cur.audio.playbackRate = rate; }

  // ---- 录音 ----
  // start() 返回 { level(): 0–1, stop(): Promise<{ blob, seconds }>, cancel() }。拿不到麦克风时 blob 为 null（演示用）
  async function record() {
    const t0 = Date.now();
    let stream = null, rec = null, chunks = [], analyser = null, data = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      data = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) { stream = null; }
    const end = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); };
    return {
      real: !!stream,
      level() {
        if (!analyser) return 0.25 + Math.random() * 0.6;
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        return Math.min(1, peak / 64);
      },
      seconds: () => (Date.now() - t0) / 1000,
      stop() {
        return new Promise((resolve) => {
          const seconds = Math.round((Date.now() - t0) / 1000);
          if (!rec) { end(); resolve({ blob: null, seconds }); return; }
          rec.onstop = () => { end(); resolve({ blob: new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), seconds }); };
          rec.stop();
        });
      },
      cancel() { if (rec && rec.state !== 'inactive') rec.stop(); end(); }
    };
  }

  // 先要一次麦克风权限，免得按住说话时才弹窗把手势打断
  async function warmUp() {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); return true; }
    catch (e) { return false; }
  }

  YY.voice = { bars, len, play, stop, setRate, record, warmUp, playing: () => cur && cur.key };
})();
