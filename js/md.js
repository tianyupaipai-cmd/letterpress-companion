/* Markdown 渲染：标题、粗斜体、删除线、行内代码、链接、列表、引用、表格、分割线、代码块。
   先转义再替换，安全。流式输出时没闭合的代码块也按代码块显示。链接一律新窗口打开。 */
(function () {
  const U = YY.util;
  const esc = U.esc;

  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|[\s(（])(https?:\/\/[^\s<)）]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  const codeBlock = (lang, body) =>
    '<div class="code cut"><div class="code-head"><span>' + esc(lang || 'text') + '</span>' +
    '<button type="button" data-copy-code aria-label="复制代码">' + U.icon.copy + '复制</button></div>' +
    '<pre><code>' + esc(body) + '</code></pre></div>';

  const table = (rows) => {
    const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    return '<div class="tbl"><table><thead><tr>' + head.map((h) => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>' +
      body.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  };

  YY.md = (text) => {
    const lines = String(text || '').split('\n');
    const out = [];
    let list = null;      // { tag: 'ul'|'ol', items: [] }
    let para = [];
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('<' + list.tag + '>' + list.items.map((i) => '<li>' + inline(i) + '</li>').join('') + '</' + list.tag + '>'); list = null; } };
    const flush = () => { flushPara(); flushList(); };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fence = line.match(/^```\s*([\w+-]*)\s*$/);
      if (fence) {
        flush();
        const body = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
        out.push(codeBlock(fence[1], body.join('\n')));
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++].trim());
        i--;
        out.push(table(rows));
        continue;
      }
      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) { flush(); out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
      const ul = line.match(/^\s*[-*·]\s+(.*)$/);
      const ol = line.match(/^\s*\d+[.)、]\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        const tag = ul ? 'ul' : 'ol';
        if (list && list.tag !== tag) flushList();
        (list = list || { tag, items: [] }).items.push((ul || ol)[1]);
        continue;
      }
      if (/^>\s?/.test(line)) { flush(); out.push('<blockquote>' + inline(line.replace(/^>\s?/, '')) + '</blockquote>'); continue; }
      if (!line.trim()) { flush(); continue; }
      flushList();
      para.push(line);
    }
    flush();
    return out.join('');
  };

  // 代码块的复制按钮（事件委托，整页只绑一次）
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy-code]');
    if (!b) return;
    U.copy(b.closest('.code').querySelector('code').textContent);
  });
})();
