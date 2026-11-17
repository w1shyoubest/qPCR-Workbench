// Shared by the Reader and the Plate Designer: the safe rich-text subset, Markdown and $…$ symbols,
// the formatted text box, and report output (Word .docx and print-to-PDF).
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ---------- rich text (design sheet, results): only a small, safe subset of HTML is ever kept ----------
  const KEEP = { P: 'p', DIV: 'div', BR: 'br', B: 'strong', STRONG: 'strong', I: 'em', EM: 'em', U: 'u', H1: 'h3', H2: 'h3', H3: 'h3', H4: 'h4', H5: 'h4', H6: 'h4',
    UL: 'ul', OL: 'ol', LI: 'li', TABLE: 'table', THEAD: 'thead', TBODY: 'tbody', TFOOT: 'tbody', TR: 'tr', TH: 'th', TD: 'td', SUB: 'sub', SUP: 'sup', A: 'a', BLOCKQUOTE: 'blockquote', CODE: 'code', HR: 'hr', S: 's', DEL: 's' };
  const DROP = /^(SCRIPT|STYLE|META|TITLE|LINK|COLGROUP|COL|HEAD|svg|IMG|IFRAME|OBJECT|EMBED|TEMPLATE|NOSCRIPT|FORM|INPUT|BUTTON|SELECT|TEXTAREA)$/i;
  function sanitize(html) {
    const src = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html').body, out = document.createElement('div');
    (function walk(from, to) {
      for (const n of [...from.childNodes]) {
        if (n.nodeType === 3) { to.appendChild(document.createTextNode(n.nodeValue.replace(/\u200b/g, ''))); continue; }
        if (n.nodeType !== 1 || DROP.test(n.tagName)) continue;
        const st = (n.getAttribute('style') || '').toLowerCase();
        let tag = KEEP[n.tagName];
        if (n.tagName === 'B' && (/^docs-internal/.test(n.id || '') || /font-weight:\s*(normal|[1-5]00)/.test(st))) tag = null;
        if (!tag && n.tagName === 'SPAN') tag = /font-weight:\s*(bold|[6-9]00)/.test(st) ? 'strong' : /font-style:\s*italic/.test(st) ? 'em' : null;
        if (!tag) { walk(n, to); continue; }
        const e = document.createElement(tag);
        if (tag === 'a') { const h = n.getAttribute('href') || ''; if (/^(https?:|mailto:)/i.test(h)) { e.setAttribute('href', h); e.setAttribute('target', '_blank'); e.setAttribute('rel', 'noopener'); } }
        if (tag === 'td' || tag === 'th') ['colspan', 'rowspan'].forEach(a => { const v = parseInt(n.getAttribute(a), 10); if (v > 1 && v < 100) e.setAttribute(a, v); });
        walk(n, e); to.appendChild(e);
      }
    })(src, out);
    const h = out.innerHTML.trim();
    return /^(<(p|div)>)?(<br>)?(<\/(p|div)>)?$/.test(h) ? '' : h;
  }
  // ---------- LaTeX-style math ($\text{Ca}^{2+}$ → Ca²⁺) and Markdown ----------
  const TEX = { times: '×', pm: '±', mp: '∓', mu: 'µ', micro: 'µ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', kappa: 'κ', lambda: 'λ', pi: 'π', sigma: 'σ', Sigma: 'Σ', tau: 'τ', omega: 'ω', Omega: 'Ω', chi: 'χ',
    sim: '~', approx: '≈', simeq: '≃', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', ll: '≪', gg: '≫', propto: '∝', to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒', uparrow: '↑', downarrow: '↓',
    cdot: '·', bullet: '•', degree: '°', circ: '°', infty: '∞', prime: '′', partial: '∂', sqrt: '√', sum: 'Σ', percent: '%', ',': ' ', ';': ' ', ':': ' ', ' ': ' ', quad: ' ', qquad: '  ', '%': '%', '$': '$', '&': '&', '#': '#', '_': '_', '{': '{', '}': '}' };
  const SUPC = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', '°': '°' };
  const SUBC = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎' };
  // parse the inside of $...$; html=true gives <sup>/<sub>, html=false gives Unicode characters for plain-text fields
  function tex(src, html) {
    let i = 0;
    const group = () => { // {…} or a single token
      while (src[i] === ' ') i++;
      if (src[i] === '{') { let d = 1, j = i + 1; while (j < src.length && d) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; } const inner = src.slice(i + 1, j - 1); i = j; return tex(inner, html); }
      if (src[i] === '\\') return command();
      const c = src[i++] || ''; return html ? esc(c) : c;
    };
    const command = () => {
      i++; const m = /^([A-Za-z]+|.)/.exec(src.slice(i)); if (!m) return '\\'; i += m[1].length; const name = m[1];
      if (/^(text|mathrm|textrm|mathit|textit|mathbf|textbf|operatorname|mbox)$/.test(name)) { const g = group(); return html && /bf$/.test(name) ? `<strong>${g}</strong>` : html && /it$/.test(name) ? `<em>${g}</em>` : g; }
      if (name === 'frac') { const a = group(), b = group(); return a + '/' + b; }
      if (name === 'ce') return group();
      if (name in TEX) return html ? esc(TEX[name]) : TEX[name];
      return html ? esc('\\' + name) : '\\' + name;
    };
    const script = (map, tag) => { const g = group(); if (html) return `<${tag}>${g}</${tag}>`; const chars = [...g]; return chars.every(c => map[c]) ? chars.map(c => map[c]).join('') : (tag === 'sup' ? '^' : '_') + (chars.length > 1 ? '(' + g + ')' : g); };
    let out = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') out += command();
      else if (c === '^') { i++; while (src[i] === ' ') i++; if (src.slice(i, i + 5) === '\\circ') { i += 5; out += '°'; } else if (src.slice(i, i + 6) === '{\\circ') { i = src.indexOf('}', i) + 1; out += '°'; } else out += script(SUPC, 'sup'); }
      else if (c === '_') { i++; out += script(SUBC, 'sub'); }
      else if (c === '{' || c === '}') i++;
      else if (c === '~') { out += ' '; i++; }
      else if (c === '-') { out += '−'; i++; }
      else { out += html ? esc(c) : c; i++; }
    }
    return out;
  }
  // $...$ counts as math only when it looks like math (a backslash, ^, _ or {), so "$5 and $10" stays as text
  const MATH = /\$\$?([^$\n]*?[\\^_{][^$\n]*?|[-+=<>~±]{1,3})\$?\$/g;
  const MATH1 = /\$\$?([^$\n]*?[\\^_{][^$\n]*?|[-+=<>~±]{1,3})\$?\$/;
  const ION = /\b(Ca|Mg|Mn|Zn|Fe|Cu|Co|Ni|Cd|Sr|Ba|Hg|Pb)([23])\+(?![\w+])/g;
  const mathUnicode = t => String(t).replace(MATH, (_, m) => tex(m, false)).replace(ION, (_, el, n) => el + SUPC[n] + '⁺');
  function inlineMd(t) {
    const keep = [];
    const stash = h => '\u0000' + (keep.push(h) - 1) + '\u0000';
    let x = String(t).replace(/`([^`\n]+)`/g, (_, c) => stash('<code>' + esc(c) + '</code>')).replace(MATH, (_, m) => stash(tex(m, true)));
    x = esc(x).replace(ION, '$1<sup>$2+</sup>')
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, a, h) => `<a href="${h}" target="_blank" rel="noopener">${a}</a>`)
      .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, '<strong>$1</strong>').replace(/__(?=\S)([^_\n]*?\S)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/~~(?=\S)([^~\n]*?\S)~~/g, '<s>$1</s>');
    return x.replace(/\u0000(\d+)\u0000/g, (_, k) => keep[+k]);
  }
  const looksMd = t => /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|\|.*\|)|\*\*[^*]+\*\*|\$[^$\n]*[\\^_{][^$\n]*\$|`[^`]+`|\[[^\]]+\]\(https?:/.test(t);
  function mdToHtml(text) {
    const L = String(text || '').replace(/\r\n?/g, '\n').split('\n'), out = []; let i = 0;
    const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    while (i < L.length) {
      const l = L[i];
      if (!l.trim()) { i++; continue; }
      let m;
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(L[i + 1])) {
        const head = cells(l); i += 2; const rows = [];
        while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) rows.push(cells(L[i++]));
        out.push('<table><thead><tr>' + head.map(c => `<th>${inlineMd(c)}</th>`).join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + head.map((_, k) => `<td>${r[k] ? inlineMd(r[k]) : '<br>'}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
        continue;
      }
      if ((m = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l))) { out.push(m[1].length <= 2 ? `<h3>${inlineMd(m[2])}</h3>` : `<h4>${inlineMd(m[2])}</h4>`); i++; continue; }
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      const list = (re, tag) => { const items = []; while (i < L.length && re.test(L[i])) { let it = L[i].replace(re, ''); i++; while (i < L.length && L[i].trim() && /^\s{2,}\S/.test(L[i]) && !re.test(L[i])) it += ' ' + L[i++].trim(); items.push(`<li>${inlineMd(it)}</li>`); } out.push(`<${tag}>${items.join('')}</${tag}>`); };
      if (/^\s*[-*+•]\s+/.test(l)) { list(/^\s*[-*+•]\s+/, 'ul'); continue; }
      if (/^\s*\d+[.)]\s+/.test(l)) { list(/^\s*\d+[.)]\s+/, 'ol'); continue; }
      if (/^\s*>\s?/.test(l)) { const q = []; while (i < L.length && /^\s*>\s?/.test(L[i])) q.push(L[i++].replace(/^\s*>\s?/, '')); out.push('<blockquote>' + q.map(inlineMd).join('<br>') + '</blockquote>'); continue; }
      const para = []; while (i < L.length && L[i].trim() && !/^\s{0,3}(#{1,6}\s|[-*+•]\s|\d+[.)]\s|>)/.test(L[i]) && !/^\s*\|.*\|\s*$/.test(L[i])) para.push(L[i++]);
      if (!para.length) para.push(L[i++]);
      out.push('<p>' + para.map(inlineMd).join('<br>') + '</p>');
    }
    return out.join('');
  }
  // convert math inside the text of already-formatted HTML (e.g. pasted from a web page that left $…$ as text)
  function mathInHtml(html) {
    if (!/\$[^$]*[\\^_{]/.test(html) && !ION.test(html)) { ION.lastIndex = 0; return html; } ION.lastIndex = 0;
    const d = document.createElement('div'); d.innerHTML = html;
    const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT), nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => { const hasIon = ION.test(n.nodeValue); ION.lastIndex = 0; if (!MATH1.test(n.nodeValue) && !hasIon) return; const s = document.createElement('span'); s.innerHTML = esc(n.nodeValue).replace(MATH, (_, m) => tex(m.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), true)).replace(ION, '$1<sup>$2+</sup>'); n.replaceWith(...s.childNodes); });
    return d.innerHTML;
  }
  function textToHtml(t) {
    const bullet = /^\s*[•\-*]\s+/;
    return String(t || '').split(/\n\s*\n/).map(block => {
      const lines = block.split('\n').filter(l => l.trim());
      if (!lines.length) return '';
      if (lines.length > 1 && lines.every(l => l.includes('\t'))) return '<table><tbody>' + lines.map(l => '<tr>' + l.split('\t').map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      const ul = ls => '<ul>' + ls.map(l => '<li>' + esc(l.replace(bullet, '')) + '</li>').join('') + '</ul>';
      if (lines.every(l => bullet.test(l))) return ul(lines);
      if (lines.length > 1 && lines.slice(1).every(l => bullet.test(l))) return '<p>' + esc(lines[0]) + '</p>' + ul(lines.slice(1));
      return '<p>' + lines.map(esc).join('<br>') + '</p>';
    }).join('');
  }
  // ---------- rich editor ----------
  function cellAtCaret(root) { const s = getSelection(); if (!s.rangeCount) return null; let n = s.anchorNode; if (n && n.nodeType === 3) n = n.parentNode; const c = n && n.closest && n.closest('td,th'); return c && root.contains(c) ? c : null; }
  function caretInto(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function emptyCell(tagName) { const c = document.createElement(tagName); c.innerHTML = '<br>'; return c; }
  const TABLE_OPS = {
    rowAfter(c) {
      const tr = c.parentNode, n = document.createElement('tr');
      [...tr.cells].forEach(() => n.appendChild(emptyCell('td')));
      if (tr.parentNode.tagName === 'THEAD') { const t = tr.closest('table'), tb = t.tBodies[0] || t.appendChild(document.createElement('tbody')); tb.insertBefore(n, tb.firstChild); } else tr.after(n);
      return n.cells[Math.min(c.cellIndex, n.cells.length - 1)];
    },
    colAfter(c) { const i = c.cellIndex; [...c.closest('table').rows].forEach(r => { const ref = r.cells[Math.min(i, r.cells.length - 1)]; if (ref) ref.after(emptyCell(ref.tagName)); }); return c.nextElementSibling; },
    delRow(c) { const t = c.closest('table'), tr = c.parentNode, next = tr.nextElementSibling || tr.previousElementSibling; tr.remove(); if (!t.rows.length) { t.remove(); return null; } return next && next.cells[0]; },
    delCol(c) { const t = c.closest('table'), i = c.cellIndex; [...t.rows].forEach(r => r.cells[i] && r.cells[i].remove()); if (![...t.rows].some(r => r.cells.length)) { t.remove(); return null; } return t.rows[0].cells[Math.max(0, i - 1)]; }
  };
  // block of the caret: the nearest p/div/h*/li/td directly holding text
  function blockOf(ed) { const s = getSelection(); if (!s.rangeCount) return null; let n = s.anchorNode; while (n && n !== ed && !(n.nodeType === 1 && /^(P|DIV|H3|H4|LI|TD|TH|BLOCKQUOTE)$/.test(n.tagName))) n = n.parentNode; return n; }
  function autoFormat(ed, ch) {
    const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return;
    const node = s.anchorNode, off = s.anchorOffset; if (!node || node.nodeType !== 3) return;
    const before = node.nodeValue.slice(0, off);
    // block shortcuts at the start of a line: "# ", "## ", "- ", "* ", "1. ", "> "
    if (ch === ' ') {
      const blk = blockOf(ed), atStart = blk && blk !== ed ? (() => { const r = document.createRange(); r.setStart(blk, 0); r.setEnd(node, off); return r.toString(); })() : before;
      const m = /^(#{1,6}|[-*+]|\d+[.)]|>)\s$/.exec(atStart.replace(/ /g, ' '));
      if (m && (!blk || blk === ed || /^(P|DIV)$/.test(blk.tagName))) {
        const r = document.createRange(); r.setStart(node, off - m[0].length); r.setEnd(node, off); s.removeAllRanges(); s.addRange(r); document.execCommand('delete');
        const k = m[1];
        if (k[0] === '#') document.execCommand('formatBlock', false, k.length <= 2 ? 'h3' : 'h4');
        else if (k === '>') document.execCommand('formatBlock', false, 'blockquote');
        else document.execCommand(/\d/.test(k) ? 'insertOrderedList' : 'insertUnorderedList');
        return;
      }
    }
    // inline: $math$, **bold**, *italic*, `code` — converted as soon as the closing mark is typed
    const pats = [[/\$([^$\n]*[\\^_{][^$\n]*)\$$/, m => tex(m[1], true)], [/\*\*(?=\S)([^*\n]*?\S)\*\*$/, m => `<strong>${esc(m[1])}</strong>`],
      [/(?:^|[^*\w])\*(?=\S)([^*\n]*?\S)\*$/, m => `<em>${esc(m[1])}</em>`, 1], [/`([^`\n]+)`$/, m => `<code>${esc(m[1])}</code>`]];
    if (ch === '+') { const m = /\b(Ca|Mg|Mn|Zn|Fe|Cu|Co|Ni|Cd|Sr|Ba|Hg|Pb)([23])\+$/.exec(before); if (m) { const r = document.createRange(); r.setStart(node, off - m[2].length - 1); r.setEnd(node, off); s.removeAllRanges(); s.addRange(r); document.execCommand('insertHTML', false, `<sup>${m[2]}+</sup>\u200b`); } return; }
    if (!'$*`'.includes(ch)) return;
    for (const [re, fn, lead] of pats) {
      const m = re.exec(before.replace(/ /g, ' ')); if (!m) continue;
      const start = off - m[0].length + (lead && !m[0].startsWith('*') ? 1 : 0);
      const r = document.createRange(); r.setStart(node, start); r.setEnd(node, off); s.removeAllRanges(); s.addRange(r);
      document.execCommand('insertHTML', false, fn(m) + '​');
      return;
    }
  }
  // "Format Markdown": plain-text blocks are re-read as Markdown; math in any text is converted
  function formatMarkdown(ed) {
    const parts = [];
    for (const n of [...ed.childNodes]) {
      const plain = n.nodeType === 3 || (n.nodeType === 1 && /^(P|DIV)$/.test(n.tagName) && ![...n.querySelectorAll('*')].some(c => c.tagName !== 'BR'));
      if (plain) { const t = n.nodeType === 3 ? n.nodeValue : n.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); parts.push({ md: t }); }
      else parts.push({ html: n.nodeType === 1 ? n.outerHTML : '' });
    }
    // neighbouring plain blocks are joined so multi-line tables and lists survive
    const merged = []; parts.forEach(p => { const last = merged[merged.length - 1]; if (p.md != null && last && last.md != null) last.md += '\n' + p.md; else merged.push({ ...p }); });
    ed.innerHTML = sanitize(merged.map(p => p.md != null ? mdToHtml(p.md) : mathInHtml(p.html)).join(''));
  }
  function setupRich(box, opt) {
    const key = box.dataset.rich;
    box.innerHTML = `<div class="tb noprint" role="toolbar" aria-label="Formatting">
      <button data-cmd="h3" title="Heading">H</button><button data-cmd="p" title="Normal text">¶</button>
      <button data-cmd="bold" title="Bold (⌘B)"><b>B</b></button><button data-cmd="italic" title="Italic (⌘I)"><i>I</i></button><button data-cmd="underline" title="Underline (⌘U)"><u>U</u></button>
      <button data-cmd="insertUnorderedList" title="Bulleted list">• List</button><button data-cmd="insertOrderedList" title="Numbered list">1. List</button>
      <span class="sep"></span><button data-cmd="table" title="Insert a table">Table</button>
      <button data-t="rowAfter" title="Add a row below">+ Row</button><button data-t="colAfter" title="Add a column to the right">+ Column</button>
      <button data-t="delRow" title="Delete this row">− Row</button><button data-t="delCol" title="Delete this column">− Column</button>
      <span class="sep"></span><button data-cmd="removeFormat" title="Clear formatting">Clear format</button><button data-cmd="outline" title="Insert section headings">Outline</button><button data-cmd="markdown" title="Turn Markdown and $…$ math typed in this box into formatting">Format Markdown</button></div>
      <div class="rich" contenteditable="true" spellcheck="true" data-key="${key}" data-ph="${esc(box.dataset.ph)}" role="textbox" aria-multiline="true" aria-label="${esc(opt.label || key)}"></div>`;
    const ed = box.querySelector('.rich'), tb = box.querySelector('.tb');
    const save = () => opt.set(sanitize(ed.innerHTML));
    const sync = () => { const c = cellAtCaret(ed); tb.querySelectorAll('[data-t]').forEach(b => b.disabled = !c); };
    tb.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    tb.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const cmd = b.dataset.cmd;
      if (document.activeElement !== ed && cmd !== 'outline') { ed.focus(); caretInto(ed); }
      if (cmd === 'h3' || cmd === 'p') document.execCommand('formatBlock', false, cmd);
      else if (cmd === 'table') { const head = '<tr>' + '<th>Column</th>'.repeat(3) + '</tr>', row = '<tr>' + '<td><br></td>'.repeat(3) + '</tr>'; document.execCommand('insertHTML', false, `<table><thead>${head}</thead><tbody>${row}${row}</tbody></table><p><br></p>`); }
      else if (cmd === 'markdown') { formatMarkdown(ed); }
      else if (cmd === 'outline') { if (!sanitize(ed.innerHTML)) ed.innerHTML = opt.outline || ''; else ed.insertAdjacentHTML('beforeend', opt.outline || ''); ed.focus(); caretInto(ed.querySelector('p') || ed); }
      else if (cmd) document.execCommand(cmd, false, null);
      else if (b.dataset.t) { const c = cellAtCaret(ed); if (!c) return; const to = TABLE_OPS[b.dataset.t](c); if (to) caretInto(to); }
      save(); sync();
    });
    ed.addEventListener('blur', () => { const h = sanitize(ed.innerHTML); if (h !== ed.innerHTML) ed.innerHTML = h; });
    ed.addEventListener('input', e => { if (e.inputType === 'insertText') autoFormat(ed, e.data); save(); });
    ['keyup', 'mouseup', 'focus'].forEach(ev => ed.addEventListener(ev, sync));
    ed.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return; const c = cellAtCaret(ed); if (!c) return; e.preventDefault();
      const cells = [...c.closest('table').querySelectorAll('th,td')], i = cells.indexOf(c);
      let to = cells[i + (e.shiftKey ? -1 : 1)];
      if (!to && !e.shiftKey) to = TABLE_OPS.rowAfter(c);
      if (to) { caretInto(to); save(); sync(); }
    });
    ed.addEventListener('paste', e => {
      const cd = e.clipboardData; if (!cd) return; e.preventDefault();
      const html = cd.getData('text/html'), text = cd.getData('text/plain');
      const plainish = html && !/<(table|ul|ol|h[1-6]|strong|b|em|i)\b/i.test(html) && looksMd(text);
      document.execCommand('insertHTML', false, html && !plainish ? sanitize(mathInHtml(html)) : looksMd(text) ? sanitize(mdToHtml(text)) : textToHtml(text)); save();
    });
    ed.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) e.preventDefault(); });
    ed.addEventListener('click', e => { const a = e.target.closest('a'); if (a && (e.metaKey || e.ctrlKey)) window.open(a.href, '_blank', 'noopener'); });
    sync();
  return { ed, load(html) { ed.innerHTML = sanitize(html); } };
  }
  // plain inputs and textareas: $…$ math and ions become Unicode (Ca2+ → Ca²⁺) when the field is left
  document.addEventListener('change', e => {
    const t = e.target; if (!/^(INPUT|TEXTAREA)$/.test(t.tagName) || !/text|search|^$/.test(t.type || '') && t.tagName === 'INPUT') return;
    const ion = ION.test(t.value); ION.lastIndex = 0; if (!MATH1.test(t.value) && !ion) return;
    t.value = mathUnicode(t.value); t.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);

  // ---------- reports ----------
  const REPORT_CSS = `@page{margin:16mm}body{font:10.5pt/1.45 -apple-system,"Segoe UI",Roboto,Arial,"PingFang SC",sans-serif;color:#111}h1{font-size:18pt;margin:0 0 6pt}h2{font-size:13pt;margin:16pt 0 6pt;border-bottom:1px solid #bbb;padding-bottom:2pt;break-after:avoid}h3{font-size:11pt;margin:12pt 0 4pt;break-after:avoid}h4{font-size:10.5pt;margin:10pt 0 4pt}p{margin:4pt 0}ul,ol{margin:4pt 0;padding-left:18pt}table{border-collapse:collapse;margin:6pt 0;font-size:9pt;width:100%}th,td{border:1px solid #bbb;padding:3pt 5pt;text-align:left;vertical-align:top}th{background:#eee}tr{break-inside:avoid}img{max-width:100%;height:auto}sup,sub{font-size:.75em;line-height:0}code{font-family:Menlo,Consolas,monospace;font-size:9pt}blockquote{margin:4pt 0;padding-left:8pt;border-left:2pt solid #bbb;color:#444}.plate+.plate{break-before:page}`;
  // PDF: the report in a hidden frame, printed with the browser's "Save as PDF"
  async function printHTML(title, parts, extraCss) {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    const d = f.contentDocument; d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${REPORT_CSS}${extraCss || ''}</style></head><body>${parts.map(x => `<section class="plate">${x}</section>`).join('')}</body></html>`); d.close();
    await Promise.all([...d.images].map(i => i.decode().catch(() => {})));
    f.contentWindow.focus(); f.contentWindow.print();
    setTimeout(() => f.remove(), 60000);
  }
  // Word: a real .docx (Office Open XML) built from the same report HTML
  function docxFrom(htmlParts, images, title) {
    const X = t => String(t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rels = []; let nums = 2; const numDefs = [];
    const rel = (type, target, ext) => { const id = 'rId' + (rels.length + 10); rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${X(target)}"${ext ? ' TargetMode="External"' : ''}/>`); return id; };
    const run = (text, f) => {
      const pr = (f.b ? '<w:b/>' : '') + (f.i ? '<w:i/>' : '') + (f.u ? '<w:u w:val="single"/>' : '') + (f.s ? '<w:strike/>' : '') + (f.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : '') + (f.link ? '<w:rStyle w:val="Hyperlink"/>' : '') + (f.sup ? '<w:vertAlign w:val="superscript"/>' : f.sub ? '<w:vertAlign w:val="subscript"/>' : '') + (f.muted ? '<w:color w:val="555555"/>' : '');
      return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${X(text)}</w:t></w:r>`;
    };
    function inline(node, f) {
      let out = '';
      for (const n of node.childNodes) {
        if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, ' ').replace(/​/g, ''); if (t) out += run(t, f); continue; }
        if (n.nodeType !== 1) continue;
        const tg = n.tagName;
        if (tg === 'BR') out += '<w:r><w:br/></w:r>';
        else if (tg === 'IMG') out += imageRun(n);
        else if (tg === 'A' && n.getAttribute('href')) out += `<w:hyperlink r:id="${rel('hyperlink', n.getAttribute('href'), true)}">${inline(n, { ...f, link: 1 })}</w:hyperlink>`;
        else out += inline(n, { ...f, b: f.b || /^(STRONG|B|TH)$/.test(tg), i: f.i || /^(EM|I)$/.test(tg), u: f.u || tg === 'U', s: f.s || tg === 'S', sup: f.sup || tg === 'SUP', sub: f.sub || tg === 'SUB', code: f.code || tg === 'CODE' });
      }
      return out;
    }
    let imgN = 0;
    function imageRun(n) {
      const im = images[+n.dataset.idx]; if (!im) return '';
      const maxW = 6.3 * 914400, w = Math.min(maxW, im.w * 9525), hgt = Math.round(w * im.h / im.w), id = rel('image', 'media/' + im.name); imgN++;
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${Math.round(w)}" cy="${hgt}"/><wp:docPr id="${imgN}" name="Figure ${imgN}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imgN}" name="${X(im.name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(w)}" cy="${hgt}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }
    const para = (content, ppr) => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${content}</w:p>`;
    const BLOCK = /^(P|DIV|H1|H2|H3|H4|UL|OL|TABLE|BLOCKQUOTE|HR|SECTION)$/;
    function blocks(node, listCtx) {
      let out = '', buf = document.createElement('span');
      const flush = () => { if (buf.childNodes.length) { const c = inline(buf, {}); if (c.replace(/<[^>]+>/g, '').trim() || /<w:drawing>/.test(c)) out += para(c, listCtx ? '' : ''); buf = document.createElement('span'); } };
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 1 && BLOCK.test(n.tagName)) { flush(); out += block(n, listCtx); } else buf.appendChild(n.cloneNode(true));
      }
      flush(); return out;
    }
    function block(n, listCtx) {
      const tg = n.tagName;
      if (/^H[1-4]$/.test(tg)) return para(inline(n, {}), `<w:pStyle w:val="Heading${tg[1]}"/>`);
      if (tg === 'P') return para(inline(n, {}) || '');
      if (tg === 'DIV' || tg === 'SECTION') return [...n.children].some(c => BLOCK.test(c.tagName)) ? blocks(n, listCtx) : para(inline(n, {}));
      if (tg === 'HR') return para('', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="AAAAAA"/></w:pBdr>');
      if (tg === 'BLOCKQUOTE') return para(inline(n, { muted: 1 }), '<w:ind w:left="360"/>');
      if (tg === 'UL' || tg === 'OL') {
        const lvl = listCtx ? listCtx.lvl + 1 : 0, numId = tg === 'UL' ? 1 : (listCtx && listCtx.ol ? listCtx.numId : (numDefs.push(nums), nums++));
        let out = '';
        for (const li of n.children) {
          if (li.tagName !== 'LI') continue;
          const head = document.createElement('span'), rest = [];
          for (const c of [...li.childNodes]) { if (c.nodeType === 1 && /^(UL|OL|TABLE)$/.test(c.tagName)) rest.push(c); else if (c.nodeType === 1 && /^(P|DIV)$/.test(c.tagName) && !rest.length) [...c.childNodes].forEach(x => head.appendChild(x.cloneNode(true))); else if (!rest.length) head.appendChild(c.cloneNode(true)); else rest.push(c); }
          out += para(inline(head, {}), `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${Math.min(lvl, 8)}"/><w:numId w:val="${numId}"/></w:numPr>`);
          rest.forEach(c => { out += c.nodeType === 1 ? block(c, { lvl, ol: tg === 'OL', numId }) : ''; });
        }
        return out;
      }
      if (tg === 'TABLE') {
        const rows = [...n.rows]; if (!rows.length) return '';
        const ncol = Math.max(...rows.map(r => [...r.cells].reduce((a, c) => a + (+c.getAttribute('colspan') || 1), 0)), 1), colW = Math.floor(9360 / ncol);
        const headless = !n.tHead && rows.every(r => [...r.cells].length === 2) && ncol === 2;
        let t = `<w:tbl><w:tblPr><w:tblStyle w:val="RecordTable"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/><w:left w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/><w:right w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/></w:tblBorders><w:tblLayout w:type="autofit"/><w:tblLook w:val="04A0" w:firstRow="1"/></w:tblPr><w:tblGrid>${'<w:gridCol w:w="' + colW + '"/>'.repeat(ncol)}</w:tblGrid>`;
        rows.forEach((r, ri) => {
          const isHead = r.parentNode.tagName === 'THEAD';
          t += `<w:tr>${isHead ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`;
          [...r.cells].forEach((c, ci) => {
            const span = +c.getAttribute('colspan') || 1, th = c.tagName === 'TH' || (headless && ci === 0);
            const inner = [...c.children].some(x => BLOCK.test(x.tagName)) ? blocks(c, null) : para(inline(c, { b: th }));
            t += `<w:tc><w:tcPr><w:tcW w:w="${colW * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${th ? '<w:shd w:val="clear" w:color="auto" w:fill="EDEDED"/>' : ''}</w:tcPr>${inner || para('')}</w:tc>`;
          });
          t += '</w:tr>';
        });
        return t + '</w:tbl>' + para('', '<w:spacing w:after="0"/>');
      }
      return para(inline(n, {}));
    }
    const body = htmlParts.map((h, k) => { const d = document.createElement('div'); d.innerHTML = h; return (k ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '') + blocks(d, null); }).join('');
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const font = '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="PingFang SC" w:cs="Calibri"/>';
    const hd = (n, sz, extra) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n < 3 ? 280 : 200}" w:after="80"/>${extra || ''}<w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${font}<w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${hd(1, 36)}${hd(2, 28, '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BBBBBB"/></w:pBdr>')}${hd(3, 23)}${hd(4, 21)}
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1F3FD1"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="RecordTable"><w:name w:val="Record Table"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="BBBBBB"/><w:left w:val="single" w:sz="4" w:color="BBBBBB"/><w:bottom w:val="single" w:sz="4" w:color="BBBBBB"/><w:right w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideH w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideV w:val="single" w:sz="4" w:color="BBBBBB"/></w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
    const lvl = (i, fmt, text) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${360 + i * 360}" w:hanging="260"/></w:pPr></w:lvl>`;
    const bullets = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => lvl(i, 'bullet', ['•', '◦', '▪'][i % 3])).join('');
    const decimals = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => lvl(i, i % 2 ? 'lowerLetter' : 'decimal', `%${i + 1}.`)).join('');
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bullets}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${decimals}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${numDefs.map(id => `<w:num w:numId="${id}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join('')}</w:numbering>`;
    const z = new JSZip();
    z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(title || 'qPCR record')}</dc:title><dc:creator>qPCR Workbench</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
    z.file('word/document.xml', doc); z.file('word/styles.xml', styles); z.file('word/numbering.xml', numbering);
    z.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${rels.join('')}</Relationships>`);
    images.forEach(im => z.file('word/media/' + im.name, im.blob));
    return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ---------- report → Markdown notes (text only; figures stay in the Word/PDF report) ----------
  function htmlToMd(html) {
    const d = document.createElement('div'); d.innerHTML = html;
    const sup = t => [...t].every(c => SUPC[c]) ? [...t].map(c => SUPC[c]).join('') : '^' + t;
    const sub = t => [...t].every(c => SUBC[c]) ? [...t].map(c => SUBC[c]).join('') : '_' + t;
    function inl(n) {
      let o = '';
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { o += c.nodeValue.replace(/\s+/g, ' '); continue; }
        if (c.nodeType !== 1) continue;
        const t = c.tagName, x = inl(c);
        if (t === 'BR') o += '  \n';
        else if (t === 'IMG') o += '*(figure: see the Word or PDF report)*';
        else if (/^(STRONG|B)$/.test(t)) o += x.trim() ? `**${x.trim()}** ` : '';
        else if (/^(EM|I)$/.test(t)) o += x.trim() ? `*${x.trim()}* ` : '';
        else if (t === 'CODE') o += '`' + x + '`';
        else if (t === 'SUP') o += sup(x);
        else if (t === 'SUB') o += sub(x);
        else if (t === 'S') o += '~~' + x + '~~';
        else if (t === 'A') o += `[${x}](${c.getAttribute('href') || ''})`;
        else o += x;
      }
      return o.replace(/\*\* ([.,;:)])/g, '**$1').replace(/\* ([.,;:)])/g, '*$1');
    }
    const cell = c => inl(c).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim();
    function blk(n, depth) {
      const out = [];
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { if (c.nodeValue.trim()) out.push(c.nodeValue.trim()); continue; }
        if (c.nodeType !== 1) continue;
        const t = c.tagName;
        if (/^H[1-6]$/.test(t)) out.push('#'.repeat(+t[1]) + ' ' + inl(c).trim());
        else if (t === 'P') { const x = inl(c).trim(); if (x) out.push(x); }
        else if (t === 'DIV' || t === 'SECTION') out.push(...blk(c, depth));
        else if (t === 'HR') out.push('---');
        else if (t === 'BLOCKQUOTE') out.push(inl(c).trim().split('\n').map(l => '> ' + l).join('\n'));
        else if (t === 'UL' || t === 'OL') {
          const lines = []; let k = 1;
          for (const li of c.children) { if (li.tagName !== 'LI') continue;
            const head = document.createElement('span'), nested = [];
            for (const x of [...li.childNodes]) { if (x.nodeType === 1 && /^(UL|OL)$/.test(x.tagName)) nested.push(x); else head.appendChild(x.cloneNode(true)); }
            lines.push('  '.repeat(depth) + (t === 'OL' ? (k++) + '. ' : '- ') + inl(head).trim());
            nested.forEach(x => { const w = document.createElement('div'); w.appendChild(x.cloneNode(true)); lines.push(blk(w, depth + 1).join('\n')); });
          }
          out.push(lines.join('\n'));
        } else if (t === 'TABLE') {
          const rows = [...c.rows].map(r => [...r.cells].map(cell)); if (!rows.length) continue;
          const n = Math.max(...rows.map(r => r.length)), pad = r => r.concat(Array(n - r.length).fill(''));
          const head = c.tHead ? pad(rows.shift()) : Array(n).fill(' ');
          out.push(['| ' + head.join(' | ') + ' |', '|' + ' --- |'.repeat(n), ...rows.map(r => '| ' + pad(r).join(' | ') + ' |')].join('\n'));
        } else { const x = inl(c).trim(); if (x) out.push(x); }
      }
      return out;
    }
    return blk(d, 0).join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ---------- collapsible sections: click a section title (h2) to hide or show what follows it ----------
  // keep: titles that always stay open (the plate map, the curves). State is remembered per page.
  function collapsible(root, storeKey, keep) {
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(storeKey)) || {}; } catch (e) { /* no storage */ }
    const all = [];
    let body = null;
    for (const el of [...root.children]) {
      const h = el.tagName === 'H2' ? el : el.classList && el.classList.contains('dhead') ? el.querySelector('h2') : null;
      if (h) {
        const name = h.textContent.trim();
        if ((keep || []).includes(name)) { body = null; continue; }
        body = document.createElement('div'); body.className = 'secbody'; el.after(body);
        const b = body, tri = document.createElement('span'); tri.className = 'tri'; tri.setAttribute('aria-hidden', 'true');
        const note = document.createElement('span'); note.className = 'hidnote'; note.textContent = 'hidden · click to show';
        h.prepend(tri); h.append(note); h.classList.add('ctitle'); h.tabIndex = 0; h.setAttribute('role', 'button');
        const set = (open, remember) => { h.setAttribute('aria-expanded', open); b.classList.toggle('collapsed', !open); if (remember) { saved[name] = !open; try { localStorage.setItem(storeKey, JSON.stringify(saved)); } catch (e) { /* no storage */ } } if (open) window.dispatchEvent(new Event('resize')); };
        h.addEventListener('click', () => set(h.getAttribute('aria-expanded') !== 'true', true));
        h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.click(); } });
        set(!saved[name], false); all.push(set);
        continue;
      }
      if (body) body.appendChild(el);
    }
    return { expandAll: () => all.forEach(f => f(true, true)), collapseAll: () => all.forEach(f => f(false, true)) };
  }
  window.RICH = { esc, sanitize, textToHtml, mdToHtml, mathInHtml, mathUnicode, looksMd, setupRich, docxFrom, printHTML, REPORT_CSS, htmlToMd, collapsible };
})();
