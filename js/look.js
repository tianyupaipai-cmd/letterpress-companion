/* 外观：强调色、纸、聊天字号、压印动效、光的方向。只存在这台手机上，打开 App 就套上。 */
(function () {
  const U = YY.util;
  const root = document.documentElement;

  // 强调色 → 纸上用的深一档文字色（保证对比度够）
  const ACCENTS = [
    { color: '#D97757', ink: '#A9512F', name: '陶土' },
    { color: '#C9876A', ink: '#93573A', name: '杏' },
    { color: '#7C8FA6', ink: '#4F627A', name: '雾蓝' },
    { color: '#8A9A7B', ink: '#56664A', name: '橄榄' }
  ];
  const PAPERS = [
    { key: 'warm', name: '暖', paper: '#F4F1EA', under: '#ECE8DE', dim: '#EDE9E1' },
    { key: 'ivory', name: '象牙', paper: '#F7F5F0', under: '#EEEAE1', dim: '#EFECE5' },
    { key: 'old', name: '旧纸', paper: '#F1EDE4', under: '#E8E3D7', dim: '#EAE6DC' }
  ];
  const DEFAULT = { accent: '#D97757', paper: 'ivory', fs: 1, motion: true, light: true };

  let timer = null;
  function light(on) {
    clearInterval(timer);
    const set = () => {
      // 早上从左上照，过了中午慢慢换到右上（所有凹凸的阴影跟着换边）
      const h = new Date().getHours() + new Date().getMinutes() / 60;
      const lx = Math.max(-1, Math.min(1, (13 - h) / 4));
      root.style.setProperty('--lx', (Math.abs(lx) < .35 ? (lx < 0 ? -.35 : .35) : lx).toFixed(2));
    };
    if (on) { set(); timer = setInterval(set, 10 * 60000); }
    else root.style.setProperty('--lx', '1');
  }

  function apply(v) {
    const a = ACCENTS.find((x) => x.color === v.accent) || ACCENTS[0];
    const p = PAPERS.find((x) => x.key === v.paper) || PAPERS[1];
    root.style.setProperty('--accent', a.color);
    root.style.setProperty('--accent-ink', a.ink);
    root.style.setProperty('--paper', p.paper);
    root.style.setProperty('--paper-under', p.under);
    root.style.setProperty('--paper-dim', p.dim);
    root.style.setProperty('--fs', v.fs);
    root.classList.toggle('no-motion', !v.motion);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = p.paper;
    light(v.light);
  }

  YY.look = {
    ACCENTS, PAPERS,
    get: () => Object.assign({}, DEFAULT, U.store.get('look', {})),
    set(patch) { const v = Object.assign(this.get(), patch); U.store.set('look', v); apply(v); return v; },
    apply() { apply(this.get()); }
  };
})();
