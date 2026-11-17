// qPCR Plate Designer: lay out plates well by well and keep a protocol record (reagents, cycling, log, notes).
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROWL = 'ABCDEFGHIJKLMNOP';
  const FIELDS = ['sample', 'target', 'task', 'dye', 'quencher', 'qty', 'group', 'input', 'note'];
  const SPAL = ['#185FA5', '#D85A30', '#1D9E75', '#BA7517', '#7F77DD', '#D4537E', '#639922', '#E24B4A', '#378ADD', '#5DCAA5', '#3C3489', '#888780', '#EF9F27', '#993556', '#0F6E56', '#854F0B', '#534AB7', '#A32D2D', '#2B6CB0', '#B7791F'];
  const TPAL = ['#B0171F', '#1F3FD1', '#0A8A4E', '#7B2CBF', '#C2650A', '#0E7490', '#9D174D', '#4D7C0F'];
  const TASKC = { UNKNOWN: '#1F3FD1', NTC: '#888780', STANDARD: '#C2650A', POSITIVE: '#0A8A4E', NRT: '#9D174D' };
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const STORE = 'qpcr-designer-v1';
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const dims = fmt => fmt == 384 ? { R: 16, C: 24 } : { R: 8, C: 12 };
  const split = p => ({ r: ROWL.indexOf(p[0]), c: +p.slice(1) });
  const posOrder = (a, b) => { const A = split(a), B = split(b); return A.r - B.r || A.c - B.c; };
  const targetsOf = w => String(w.target || '').split(/\s*[,;+]\s*/).filter(Boolean);

  const PRESETS = {
    std: [{ stage: 'Hold (UNG)', temp: 50, time: '2:00', cycles: 1, collect: false }, { stage: 'Hold (activation)', temp: 95, time: '10:00', cycles: 1, collect: false },
      { stage: 'PCR', temp: 95, time: '0:15', cycles: 40, collect: false }, { stage: 'PCR', temp: 60, time: '1:00', cycles: 40, collect: true }],
    fast: [{ stage: 'Hold (UNG)', temp: 50, time: '2:00', cycles: 1, collect: false }, { stage: 'Hold (activation)', temp: 95, time: '0:20', cycles: 1, collect: false },
      { stage: 'PCR', temp: 95, time: '0:01', cycles: 40, collect: false }, { stage: 'PCR', temp: 60, time: '0:20', cycles: 40, collect: true }],
    sybr: [{ stage: 'Hold (UNG)', temp: 50, time: '2:00', cycles: 1, collect: false }, { stage: 'Hold (activation)', temp: 95, time: '2:00', cycles: 1, collect: false },
      { stage: 'PCR', temp: 95, time: '0:15', cycles: 40, collect: false }, { stage: 'PCR', temp: 60, time: '1:00', cycles: 40, collect: true },
      { stage: 'Melt curve', temp: 95, time: '0:15', cycles: 1, collect: false }, { stage: 'Melt curve', temp: 60, time: '1:00', cycles: 1, collect: false },
      { stage: 'Melt curve', temp: 95, time: '0:15', cycles: 1, collect: true, note: '0.15 °C/s, continuous' }]
  };
  const DEFAULT_MIX = [
    { name: '2× master mix', stock: '2×', final: '1×', vol: 10, inMix: true, lot: '' },
    { name: 'Primer/probe assay', stock: '20×', final: '1×', vol: 1, inMix: true, lot: '' },
    { name: 'Nuclease-free water', stock: '', final: '', vol: 7, inMix: true, lot: '' },
    { name: 'Template (cDNA)', stock: '', final: '', vol: 2, inMix: false, lot: '' }];
  const META = [['project', 'Project / experiment'], ['date', 'Date', 'date'], ['operator', 'Operator'], ['instrument', 'Instrument'],
    ['block', 'Block / plate'], ['chemistry', 'Chemistry'], ['runFile', 'Run file name'], ['expType', 'Experiment type'], ['passive', 'Passive reference']];
  const OUTLINE = {
    design: '<h3>Purpose</h3><p><br></p><h3>Samples</h3><table><thead><tr><th>Sample</th><th>Description</th><th>Source / date</th><th>Notes</th></tr></thead><tbody><tr><td><br></td><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td><td><br></td></tr></tbody></table><h3>Experiment</h3><p><br></p><h3>Controls</h3><p><br></p>',
    results: '<h3>Results</h3><p><br></p><h3>Summary</h3><p><br></p><h3>Conclusion</h3><p><br></p>' };
  const QUICK = ['RNA extracted', 'DNase treatment', 'RNA quantified', 'cDNA synthesis (RT)', 'Master mix prepared', 'Plate loaded', 'Plate sealed & spun', 'Run started', 'Run finished', 'Data exported'];

  function newPlate(name, fmt) {
    return { id: Math.random().toString(36).slice(2, 9), name: name || 'Plate ' + (state.plates.length + 1), fmt: fmt || 96, wells: {},
      meta: { project: '', date: today(), operator: '', instrument: 'QuantStudio 5', block: fmt == 384 ? '384-well' : '96-well 0.2 mL', chemistry: 'TaqMan', runFile: '', samples: '', aim: '' },
      mix: { vol: 20, n: '', over: 10, comps: JSON.parse(JSON.stringify(DEFAULT_MIX)) },
      cyc: JSON.parse(JSON.stringify(PRESETS.std)), log: [], design: OUTLINE.design, results: '' };
  }

  // ---------- state, persistence, undo ----------
  let state = { plates: [], cur: 0, colorBy: 'sample' };
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.plates && s.plates.length) state = s; } catch (e) { /* no storage */ }
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
  // older saves kept the aim, sample source and notes as plain text; move them into the two rich boxes
  function upgrade(p) {
    if (p.design == null) {
      const parts = [];
      if (p.meta && p.meta.aim) parts.push('<h3>Purpose</h3>' + textToHtml(p.meta.aim));
      if (p.meta && p.meta.samples) parts.push('<h3>Samples</h3>' + textToHtml(p.meta.samples));
      p.design = parts.join('');
    }
    if (p.results == null) p.results = p.notes ? textToHtml(p.notes) : '';
    if (p.meta) { delete p.meta.aim; delete p.meta.samples; }
    delete p.notes;
    return p;
  }
  state.plates.forEach(upgrade);
  if (!state.plates.length) state.plates.push(newPlate('Plate 1', 96));
  const P = () => state.plates[Math.min(state.cur, state.plates.length - 1)];
  let sel = new Set(), anchor = null, clip = null, printing = false;
  const undo = [];
  let saveT;
  function saveNow() { clearTimeout(saveT); try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* no storage: project files still work */ } }
  function persist() { clearTimeout(saveT); saveT = setTimeout(saveNow, 300); }
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  function snap() { undo.push(JSON.stringify(state)); if (undo.length > 60) undo.shift(); }
  function doUndo() { if (!undo.length) return status('Nothing to undo'); state = JSON.parse(undo.pop()); sel.clear(); renderAll(); persist(); status('Undone'); }
  function status(t) { $('#status').textContent = t; clearTimeout(status.t); status.t = setTimeout(() => $('#status').textContent = '', 4000); }

  // ---------- colors ----------
  function palettes(p) {
    const ws = Object.values(p.wells), uniq = a => [...new Set(a.filter(Boolean))];
    const pos = Object.keys(p.wells).sort(posOrder);
    return { sample: uniq(pos.map(k => p.wells[k].sample)), target: uniq(pos.flatMap(k => targetsOf(p.wells[k]))), group: uniq(ws.map(w => w.group)) };
  }
  function colorFor(kind, v, pal) {
    if (!v) return null;
    if (kind === 'task') return TASKC[v] || '#888780';
    const i = pal[kind].indexOf(v);
    return (kind === 'target' ? TPAL : SPAL)[(kind === 'group' ? i + 4 : i) % (kind === 'target' ? TPAL.length : SPAL.length)];
  }
  const wellColor = (w, pal, by) => by === 'target' ? colorFor('target', targetsOf(w)[0], pal) : colorFor(by, w[by], pal);

  // ---------- plate SVG ----------
  function plateSVG(p, forExport) {
    const { R, C } = dims(p.fmt), big = C <= 12, cell = big ? 66 : 32, pad = 30;
    const W = pad + C * cell + 6, H = pad + R * cell + 6;
    const ink = cv('--ink'), muted = cv('--muted'), bg = forExport ? '#ffffff' : cv('--bg'), acc = cv('--accent');
    const light = forExport || printing, inkE = light ? '#1d2329' : ink, mutedE = light ? '#5d6670' : muted, bgE = light ? '#ffffff' : bg;
    const pal = palettes(p), by = state.colorBy;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${forExport ? `width="${W * 2}" height="${H * 2}"` : ''} font-family="-apple-system,Segoe UI,Roboto,Arial,sans-serif" role="img" aria-label="Plate map of ${esc(p.name)}">`;
    if (forExport) s += `<rect width="${W}" height="${H}" fill="${bg}"/>`;
    s += `<text class="hdr" data-all="1" x="10" y="18" font-size="11" fill="${mutedE}" style="cursor:pointer">◢</text>`;
    for (let j = 1; j <= C; j++) s += `<text class="hdr" data-col="${j}" x="${pad + (j - 0.5) * cell}" y="19" text-anchor="middle" font-size="${big ? 12 : 10}" font-weight="600" fill="${inkE}" style="cursor:pointer">${j}</text>`;
    for (let i = 0; i < R; i++) s += `<text class="hdr" data-row="${ROWL[i]}" x="12" y="${pad + (i + 0.5) * cell + 4}" text-anchor="middle" font-size="${big ? 12 : 10}" font-weight="600" fill="${inkE}" style="cursor:pointer">${ROWL[i]}</text>`;
    const cut = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
    for (let i = 0; i < R; i++) for (let j = 1; j <= C; j++) {
      const pos = ROWL[i] + j, w = p.wells[pos], x = pad + (j - 1) * cell, y = pad + i * cell, cx = x + cell / 2, cy = y + cell / 2, r = cell / 2 - (big ? 3 : 2);
      s += `<g class="well${sel.has(pos) && !forExport ? ' sel' : ''}" data-pos="${pos}">`;
      if (!forExport) s += `<rect class="selr" x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="6" fill="${acc}" fill-opacity=".14" stroke="${acc}" stroke-width="2"/>`;
      if (!w) { s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgE}" fill-opacity=".5" stroke="${mutedE}" stroke-opacity=".35"/></g>`; continue; }
      const col = wellColor(w, pal, by) || '#888780', ntc = w.task === 'NTC';
      s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ntc ? bgE : col}" fill-opacity="${ntc ? 1 : .2}" stroke="${col}" stroke-width="${big ? 2 : 1.5}" ${ntc ? 'stroke-dasharray="4 3"' : ''}/>`;
      // target marks: small colored bars along the bottom of the well (one per target, so multiplex shows several)
      const ts = targetsOf(w);
      if (by !== 'target' && ts.length) {
        const bw = big ? 8 : 5, gap = 2, tot = ts.length * bw + (ts.length - 1) * gap;
        ts.forEach((t, k) => { s += `<rect x="${cx - tot / 2 + k * (bw + gap)}" y="${cy + r - (big ? 9 : 6)}" width="${bw}" height="${big ? 3 : 2}" rx="1" fill="${colorFor('target', t, pal)}"/>`; });
      }
      if (w.note && big) s += `<circle cx="${x + cell - 9}" cy="${y + 9}" r="3" fill="${acc}"/>`;
      if (big) {
        const name = w.sample || (ntc ? 'NTC' : '');
        const lines = wrap(name, 10), fs = Math.max(...lines.map(t => t.length)) > 8 ? 9 : 10;
        const sub = w.task === 'STANDARD' && w.qty !== '' && w.qty != null ? fmtQty(w.qty) : ts.join('+');
        const y0 = lines.length > 1 ? cy - 12 : cy - 4;
        lines.forEach((t, k) => { s += `<text x="${cx}" y="${y0 + k * 11}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="${inkE}" pointer-events="none">${esc(t)}</text>`; });
        if (sub) s += `<text x="${cx}" y="${cy + (lines.length > 1 ? 11 : 9)}" text-anchor="middle" font-size="8.5" fill="${mutedE}" pointer-events="none">${esc(cut(sub, 12))}</text>`;
      } else if (w.sample) {
        s += `<text x="${cx}" y="${cy + 2.5}" text-anchor="middle" font-size="7.5" fill="${inkE}" pointer-events="none">${esc(cut(w.sample, 5))}</text>`;
      }
      s += '</g>';
    }
    return s + '</svg>';
  }
  // split a name into at most two lines at the separator closest to the middle, keeping it readable inside a well
  function wrap(name, n) {
    if (name.length <= n) return [name];
    let best = -1;
    for (let i = 1; i < name.length - 1; i++) if (/[-_ ]/.test(name[i]) && (best < 0 || Math.abs(i - name.length / 2) < Math.abs(best - name.length / 2))) best = i;
    const parts = best > 0 ? [name.slice(0, name[best] === ' ' ? best : best + 1).trim(), name.slice(best + 1).trim()] : [name.slice(0, n), name.slice(n)];
    return parts.map(t => t.length > n + 1 ? t.slice(0, n) + '…' : t);
  }
  function fmtQty(q) { const v = parseFloat(q); if (!Number.isFinite(v)) return String(q); return Math.abs(v) >= 1e4 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(1).replace('e+', 'e') : String(+v.toPrecision(4)); }

  // ---------- render ----------
  function renderTabs() {
    $('#tabs').innerHTML = state.plates.map((p, i) => `<div class="tab${i === state.cur ? ' on' : ''}" role="tab" aria-selected="${i === state.cur}" data-i="${i}" tabindex="0">${esc(p.name || 'Untitled')}${state.plates.length > 1 ? `<button class="x" data-del="${i}" aria-label="Delete ${esc(p.name)}">×</button>` : ''}</div>`).join('') +
      '<div class="tab add" data-add="1" tabindex="0">+ New plate</div><div class="tab add" data-dup="1" tabindex="0">Duplicate this plate</div>';
  }
  function renderPlate() {
    const p = P();
    $('#plate').innerHTML = plateSVG(p, false);
    const pal = palettes(p), by = state.colorBy, items = pal[by] || [];
    let lg = by === 'task' ? Object.keys(TASKC).filter(t => Object.values(p.wells).some(w => w.task === t)).map(t => `<span><i class="dot" style="--c:${TASKC[t]}"></i>${t}</span>`).join('')
      : items.map(v => `<span><i class="dot" style="--c:${colorFor(by, v, pal)}"></i>${esc(v)}</span>`).join('');
    if (by !== 'target' && pal.target.length) lg += '<span style="flex-basis:100%;height:0"></span>' + pal.target.map(t => `<span><i class="sq" style="--c:${colorFor('target', t, pal)}"></i>${esc(t)}</span>`).join('');
    lg += `<span><i class="dot" style="--c:transparent;border:1.5px dashed var(--muted)"></i>NTC</span>` + (dims(p.fmt).C <= 12 ? `<span><i class="dot" style="--c:var(--accent);width:7px;height:7px"></i>has a note</span>` : '');
    $('#legend').innerHTML = lg;
    const n = Object.keys(p.wells).length, { R, C } = dims(p.fmt);
    $('#printsub').textContent = `${p.fmt}-well plate · ${n} of ${R * C} wells used`;
  }
  function refreshSel() {
    $('#plate').querySelectorAll('.well').forEach(g => g.classList.toggle('sel', sel.has(g.dataset.pos)));
    const list = [...sel].sort(posOrder);
    $('#selhead').textContent = list.length ? `${list.length} well${list.length > 1 ? 's' : ''} selected: ${compress(list)}` : 'No wells selected';
    loadForm();
    if (list.length === 1) showInfo(list[0]); else if (!list.length) showInfo(null);
  }
  function showInfo(pos) {
    const w = pos && P().wells[pos];
    if (!pos) { $('#info').innerHTML = 'Hover over a well to see everything recorded for it.'; return; }
    if (!w) { $('#info').innerHTML = `<b>${pos}</b> · empty`; return; }
    const parts = [['Sample', w.sample], ['Target', w.target], ['Task', w.task], ['Reporter', w.dye], ['Quencher', w.quencher], ['Quantity', w.qty], ['Group', w.group], ['Template', w.input]].filter(x => x[1]);
    $('#info').innerHTML = `<b>${pos}</b> · ` + parts.map(([k, v]) => `${k} <b>${esc(v)}</b>`).join(' · ') + (w.note ? `<br>Note: ${esc(w.note)}` : '');
  }
  function compress(list) {
    const out = []; let i = 0;
    while (i < list.length) {
      let j = i; const a = split(list[i]);
      while (j + 1 < list.length) { const b = split(list[j + 1]); if (b.r === a.r && b.c === split(list[j]).c + 1) j++; else break; }
      out.push(j > i ? `${list[i]}–${list[j]}` : list[i]); i = j + 1;
    }
    // a single column run (A1, B1, C1) reads better as A1–C1
    if (out.length > 2 && out.every(x => !x.includes('–'))) { const S = list.map(split); if (S.every(q => q.c === S[0].c) && S.every((q, k) => !k || q.r === S[k - 1].r + 1)) return `${list[0]}–${list[list.length - 1]}`; }
    return out.join(', ');
  }

  // summary by sample × target
  function summaryOf(p) {
    const groups = new Map();
    Object.keys(p.wells).sort(posOrder).forEach(k => { const w = p.wells[k]; (targetsOf(w).length ? targetsOf(w) : ['']).forEach(t => {
      const g = (w.sample || '') + '\u0000' + t; if (!groups.has(g)) groups.set(g, { sample: w.sample, target: t, task: new Set(), group: new Set(), qty: new Set(), wells: [] });
      const G = groups.get(g); G.wells.push(k); if (w.task) G.task.add(w.task); if (w.group) G.group.add(w.group); if (w.qty !== '' && w.qty != null) G.qty.add(fmtQty(w.qty)); }); });
    return groups;
  }
  function renderTables() {
    const p = P(), keys = Object.keys(p.wells).sort(posOrder), groups = summaryOf(p);
    const pal = palettes(p);
    $('#summary').innerHTML = groups.size ? `<table><thead><tr><th>Sample</th><th>Target</th><th>Task</th><th>Group</th><th>Quantity</th><th class="num">n</th><th>Wells</th></tr></thead><tbody>` +
      [...groups.values()].map(G => `<tr><td><i class="dot" style="--c:${colorFor('sample', G.sample, pal) || 'transparent'}"></i>${esc(G.sample || '—')}</td><td>${G.target ? `<i class="sq" style="--c:${colorFor('target', G.target, pal)}"></i>` : ''}${esc(G.target || '—')}</td><td>${esc([...G.task].join(', '))}</td><td>${esc([...G.group].join(', '))}</td><td>${esc([...G.qty].join(', '))}</td><td class="num">${G.wells.length}</td><td>${compress(G.wells)}</td></tr>`).join('') + '</tbody></table>'
      : '<p class="hint">No wells filled yet. Select wells on the plate and fill in the panel on the right.</p>';
    $('#wells').innerHTML = keys.length ? '<table><thead><tr><th>Well</th><th>Sample</th><th>Target</th><th>Task</th><th>Reporter</th><th>Quencher</th><th>Quantity</th><th>Group</th><th>Template</th><th>Note</th></tr></thead><tbody>' +
      keys.map(k => { const w = p.wells[k]; return `<tr><td><b>${k}</b></td>${['sample', 'target', 'task', 'dye', 'quencher', 'qty', 'group', 'input', 'note'].map(f => `<td>${esc(w[f] || '')}</td>`).join('')}</tr>`; }).join('') + '</tbody></table>' : '<p class="hint">No wells filled yet.</p>';
    // datalists
    const fill = (id, arr) => $(id).innerHTML = arr.map(v => `<option value="${esc(v)}">`).join('');
    const all = state.plates.flatMap(q => Object.values(q.wells));
    fill('#dl_sample', [...new Set(all.map(w => w.sample).filter(Boolean))]);
    fill('#dl_target', [...new Set(all.flatMap(targetsOf))]);
    fill('#dl_group', [...new Set(all.map(w => w.group).filter(Boolean))]);
    renderMix();
  }

  // ---------- record: meta, mix, cycling, log ----------
  function renderMeta() {
    const p = P();
    $('#meta').innerHTML = META.map(([k, lab, t]) => `<label class="${t === 'wide' ? 'wide' : ''}">${lab}${t === 'wide' ? `<textarea data-meta="${k}" rows="2">${esc(p.meta[k] || '')}</textarea>` : `<input data-meta="${k}" type="${t === 'date' ? 'date' : 'text'}" value="${esc(p.meta[k] || '')}">`}</label>`).join('');
    document.querySelectorAll('.rich').forEach(el => { el.innerHTML = sanitize(p[el.dataset.key]); });
  }
  const numv = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
  const r1 = v => Number.isFinite(v) ? (Math.round(v * 10) / 10).toLocaleString() : '—';
  function mixReactions(p) { const auto = Object.keys(p.wells).length; const n = p.mix.n === '' || p.mix.n == null ? auto : numv(p.mix.n); return { auto, n, total: n * (1 + numv(p.mix.over) / 100) }; }
  function renderMix(full) {
    const p = P(), m = p.mix, { auto, n, total } = mixReactions(p);
    if (full) {
      $('#m_vol').value = m.vol; $('#m_n').value = m.n; $('#m_over').value = m.over;
      $('#mix').innerHTML = '<thead><tr><th>Component</th><th>Stock</th><th>Final</th><th class="num">µL / rxn</th><th>In master mix</th><th class="num">µL total</th><th>Lot / notes</th><th class="del"></th></tr></thead><tbody>' +
        m.comps.map((c, i) => `<tr data-i="${i}"><td><input data-f="name" value="${esc(c.name)}"></td><td><input data-f="stock" value="${esc(c.stock)}" style="width:70px"></td><td><input data-f="final" value="${esc(c.final)}" style="width:70px"></td><td><input data-f="vol" value="${esc(c.vol)}" inputmode="decimal" style="width:70px;text-align:right"></td><td><input type="checkbox" data-f="inMix" ${c.inMix ? 'checked' : ''} style="width:auto"></td><td class="num" data-tot="${i}"></td><td><input data-f="lot" value="${esc(c.lot)}"></td><td class="del"><button class="rm" data-rm="${i}" aria-label="Remove component">×</button></td></tr>`).join('') +
        (m.comps.length ? '' : '<tr><td colspan="8" class="hint">No components recorded. Add the reaction recipe with “Add component”.</td></tr>') + '</tbody><tfoot><tr><th>Total</th><th></th><th></th><th class="num" id="m_sum"></th><th></th><th class="num" id="m_sumt"></th><th colspan="2"></th></tr></tfoot>';
    }
    $('#m_n').placeholder = auto;
    m.comps.forEach((c, i) => { const td = $(`[data-tot="${i}"]`); if (td) td.textContent = c.inMix ? r1(numv(c.vol) * total) : `${r1(numv(c.vol))} per well`; });
    const sum = m.comps.reduce((a, c) => a + numv(c.vol), 0), mixPer = m.comps.filter(c => c.inMix).reduce((a, c) => a + numv(c.vol), 0);
    if ($('#m_sum')) { $('#m_sum').innerHTML = r1(sum) + (Math.abs(sum - numv(m.vol)) > 1e-6 ? ` <span style="color:var(--bad)">≠ ${r1(numv(m.vol))}</span>` : ''); $('#m_sumt').textContent = r1(mixPer * total); }
    $('#m_auto').textContent = `${auto} wells filled · ${r1(total)} reactions with overage` + (mixPer ? ` · dispense ${r1(mixPer)} µL mix per well` : '');
    // per target
    const byT = {}; Object.values(p.wells).forEach(w => targetsOf(w).forEach(t => byT[t] = (byT[t] || 0) + 1));
    const ts = Object.keys(byT), inMix = m.comps.filter(c => c.inMix);
    $('#mixper').innerHTML = ts.length > 1 && inMix.length ? '<table style="margin-top:8px"><thead><tr><th>Mix per target</th><th class="num">Wells</th><th class="num">Rxns + overage</th>' + inMix.map(c => `<th class="num">${esc(c.name)} (µL)</th>`).join('') + '<th class="num">Total (µL)</th></tr></thead><tbody>' +
      ts.map(t => { const k = byT[t] * (1 + numv(m.over) / 100); return `<tr><td>${esc(t)}</td><td class="num">${byT[t]}</td><td class="num">${r1(k)}</td>` + inMix.map(c => `<td class="num">${r1(numv(c.vol) * k)}</td>`).join('') + `<td class="num">${r1(mixPer * k)}</td></tr>`; }).join('') + '</tbody></table>' : '';
  }
  function renderCyc() {
    const p = P();
    $('#cyc').innerHTML = '<thead><tr><th>Stage</th><th class="num">Temp (°C)</th><th>Time (m:ss)</th><th class="num">Cycles</th><th>Collect data</th><th>Notes</th><th class="del"></th></tr></thead><tbody>' +
      p.cyc.map((c, i) => `<tr data-i="${i}"><td><input data-f="stage" value="${esc(c.stage)}"></td><td><input data-f="temp" value="${esc(c.temp)}" inputmode="decimal" style="width:70px;text-align:right"></td><td><input data-f="time" value="${esc(c.time)}" style="width:80px"></td><td><input data-f="cycles" value="${esc(c.cycles)}" inputmode="numeric" style="width:60px;text-align:right"></td><td><input type="checkbox" data-f="collect" ${c.collect ? 'checked' : ''} style="width:auto"></td><td><input data-f="note" value="${esc(c.note || '')}"></td><td class="del"><button class="rm" data-rm="${i}" aria-label="Remove step">×</button></td></tr>`).join('') + (p.cyc.length ? '' : '<tr><td colspan="7" class="hint">No program recorded. Choose a preset or add steps.</td></tr>') + '</tbody>';
  }
  function renderLog() {
    const p = P();
    p.log.sort((a, b) => String(a.t || '').localeCompare(String(b.t || '')));
    $('#log').innerHTML = p.log.length ? p.log.map((e, i) => `<li data-i="${i}"><span class="when"><input type="date" data-f="d" value="${esc(String(e.t || '').slice(0, 10))}" aria-label="Date"><input type="time" data-f="h" value="${esc(String(e.t || '').slice(11, 16))}" aria-label="Time (optional)"></span><input data-f="step" value="${esc(e.step)}" placeholder="Step"><textarea data-f="text" rows="1" placeholder="Details: volumes, lots, deviations…">${esc(e.text)}</textarea><button class="rm" data-rm="${i}" aria-label="Remove entry">×</button></li>`).join('')
      : '<li class="hint" style="display:block">No entries yet.</li>';
    $('#log').querySelectorAll('textarea').forEach(grow);
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
  const growAll = () => document.querySelectorAll('#sheet textarea').forEach(grow);
  document.addEventListener('input', e => { if (e.target.tagName === 'TEXTAREA') grow(e.target); });
  function renderAll() {
    const p = P();
    renderTabs(); $('#pname').value = p.name; $('#fmt').value = String(p.fmt);
    document.querySelectorAll('#colorby button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === state.colorBy));
    renderPlate(); refreshSel(); renderTables(); renderMeta(); renderMix(true); renderCyc(); renderLog(); growAll();
  }
  function changed() { renderPlate(); refreshSel(); renderTables(); persist(); }

  // ---------- selection (click, drag, headers) ----------
  const svgEl = () => $('#plate svg');
  let drag = null;
  function rect(a, b) { const A = split(a), B = split(b), out = []; for (let r = Math.min(A.r, B.r); r <= Math.max(A.r, B.r); r++) for (let c = Math.min(A.c, B.c); c <= Math.max(A.c, B.c); c++) out.push(ROWL[r] + c); return out; }
  $('#plate').addEventListener('pointerdown', e => {
    const g = e.target.closest('.well'), h = e.target.closest('.hdr'); if (!g && !h) return;
    e.preventDefault(); const { R, C } = dims(P().fmt);
    if (h) {
      let list = [];
      if (h.dataset.all) for (let r = 0; r < R; r++) for (let c = 1; c <= C; c++) list.push(ROWL[r] + c);
      else if (h.dataset.row) for (let c = 1; c <= C; c++) list.push(h.dataset.row + c);
      else for (let r = 0; r < R; r++) list.push(ROWL[r] + h.dataset.col);
      if (!e.shiftKey) sel.clear(); list.forEach(p => sel.add(p)); refreshSel(); return;
    }
    const pos = g.dataset.pos;
    if (e.shiftKey && anchor && !(e.metaKey || e.ctrlKey)) { drag = { base: new Set(sel), from: anchor }; rect(anchor, pos).forEach(p => sel.add(p)); }
    else if (e.metaKey || e.ctrlKey) { sel.has(pos) ? sel.delete(pos) : sel.add(pos); anchor = pos; drag = null; refreshSel(); return; }
    else { drag = { base: new Set(), from: pos }; sel = new Set([pos]); anchor = pos; }
    refreshSel();
  });
  window.addEventListener('pointermove', e => {
    if (!drag) { const g = e.target.closest && e.target.closest('#plate .well'); if (g && sel.size !== 1) showInfo(g.dataset.pos); return; }
    const el = document.elementFromPoint(e.clientX, e.clientY), g = el && el.closest && el.closest('#plate .well'); if (!g) return;
    sel = new Set([...drag.base, ...rect(drag.from, g.dataset.pos)]); refreshSel();
  });
  window.addEventListener('pointerup', () => { drag = null; });
  $('#plate').addEventListener('pointerleave', () => { if (!drag && sel.size !== 1) showInfo(null); });

  // ---------- editor form ----------
  let loaded = {}, dirty = new Set();
  function loadForm() {
    const p = P(), list = [...sel]; dirty.clear(); loaded = {};
    FIELDS.forEach(f => {
      const el = $('#f_' + f), vals = new Set(list.map(k => (p.wells[k] && p.wells[k][f]) || ''));
      const v = vals.size === 1 ? [...vals][0] : ''; loaded[f] = v; el.value = v;
      el.placeholder = vals.size > 1 ? 'mixed — leave blank to keep' : (f === 'group' ? 'condition / treatment' : f === 'input' ? 'e.g. 2 µL cDNA 1:10' : '');
      el.classList.toggle('mixed', vals.size > 1); el.disabled = !list.length;
    });
    ['#apply', '#clearw'].forEach(id => $(id).disabled = !list.length);
  }
  FIELDS.forEach(f => { const el = $('#f_' + f); el.addEventListener('input', () => dirty.add(f)); el.addEventListener('change', () => dirty.add(f));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && el.tagName !== 'TEXTAREA') { e.preventDefault(); apply(); } }); });
  function setWell(p, pos, patch) {
    const w = Object.assign({}, p.wells[pos] || {}, patch);
    FIELDS.forEach(f => { if (w[f] == null || w[f] === '') delete w[f]; else w[f] = String(w[f]).trim(); });
    if (Object.keys(w).length) p.wells[pos] = w; else delete p.wells[pos];
  }
  function apply() {
    if (!sel.size) return; const p = P(), patch = {};
    dirty.forEach(f => patch[f] = $('#f_' + f).value);
    if (!Object.keys(patch).length) return status('Nothing changed');
    snap(); [...sel].forEach(pos => setWell(p, pos, patch)); changed(); status(`Updated ${sel.size} well${sel.size > 1 ? 's' : ''}`);
  }
  $('#apply').addEventListener('click', apply);
  function clearSel() { if (!sel.size) return; snap(); const p = P(); sel.forEach(pos => delete p.wells[pos]); changed(); status('Cleared'); }
  $('#clearw').addEventListener('click', clearSel);

  function orderSel(dir) { return [...sel].sort((a, b) => { const A = split(a), B = split(b); return dir === 'col' ? A.c - B.c || A.r - B.r : A.r - B.r || A.c - B.c; }); }
  $('#s_go').addEventListener('click', () => {
    if (!sel.size) return status('Select wells first');
    const list = orderSel($('#s_dir').value), reps = Math.max(1, +$('#s_reps').value || 1), pre = $('#s_prefix').value, st = +$('#s_start').value || 1, p = P();
    snap(); list.forEach((pos, i) => setWell(p, pos, { sample: pre + (st + Math.floor(i / reps)) })); changed();
    status(`${Math.ceil(list.length / reps)} samples × ${reps} replicates`);
  });
  $('#d_go').addEventListener('click', () => {
    if (!sel.size) return status('Select wells first');
    const list = orderSel($('#d_dir').value), reps = Math.max(1, +$('#d_reps').value || 1), top = parseFloat($('#d_top').value), fold = parseFloat($('#d_fold').value), name = $('#d_name').value, p = P();
    if (!Number.isFinite(top) || !(fold > 0)) return status('Enter a top quantity and dilution factor');
    snap(); list.forEach((pos, i) => { const k = Math.floor(i / reps); setWell(p, pos, { sample: `${name}${k + 1}`, task: 'STANDARD', qty: String(+(top / Math.pow(fold, k)).toPrecision(6)) }); }); changed();
    status(`${Math.ceil(list.length / reps)}-point standard curve`);
  });
  function copy() { if (!sel.size) return; const list = [...sel], A = list.map(split); const r0 = Math.min(...A.map(a => a.r)), c0 = Math.min(...A.map(a => a.c)); clip = list.map((p, i) => ({ dr: A[i].r - r0, dc: A[i].c - c0, w: P().wells[p] ? { ...P().wells[p] } : null })); status(`Copied ${list.length} wells`); }
  function paste() {
    if (!clip || !sel.size) return status(clip ? 'Select where to paste' : 'Copy wells first');
    const p = P(), t = split([...sel].sort(posOrder)[0]), { R, C } = dims(p.fmt); snap(); const ns = new Set();
    clip.forEach(({ dr, dc, w }) => { const r = t.r + dr, c = t.c + dc; if (r >= R || c > C) return; const pos = ROWL[r] + c; ns.add(pos); if (w) p.wells[pos] = { ...w }; else delete p.wells[pos]; });
    sel = ns; changed(); status(`Pasted ${ns.size} wells`);
  }
  $('#copy').addEventListener('click', copy); $('#paste').addEventListener('click', paste);

  document.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); doUndo(); }
    else if (typing) return;
    else if (mod && e.key.toLowerCase() === 'c' && sel.size) { e.preventDefault(); copy(); }
    else if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); }
    else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); const { R, C } = dims(P().fmt); for (let r = 0; r < R; r++) for (let c = 1; c <= C; c++) sel.add(ROWL[r] + c); refreshSel(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && sel.size) { e.preventDefault(); clearSel(); }
    else if (e.key === 'Escape') { sel.clear(); refreshSel(); }
  });

  // ---------- plate-level controls ----------
  $('#tabs').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) { const i = +del.dataset.del; if (!confirm(`Delete “${state.plates[i].name}” and its record? (Undo can bring it back.)`)) return; snap(); state.plates.splice(i, 1); state.cur = Math.max(0, Math.min(state.cur, state.plates.length - 1)); sel.clear(); renderAll(); persist(); return; }
    const t = e.target.closest('.tab'); if (!t) return;
    if (t.dataset.add) { snap(); state.plates.push(newPlate('', P().fmt)); state.cur = state.plates.length - 1; }
    else if (t.dataset.dup) { snap(); const c = JSON.parse(JSON.stringify(P())); c.id = Math.random().toString(36).slice(2, 9); c.name = P().name + ' (copy)'; c.log = []; c.results = ''; c.meta.date = today(); c.meta.runFile = ''; state.plates.push(c); state.cur = state.plates.length - 1; }
    else state.cur = +t.dataset.i;
    sel.clear(); renderAll(); persist();
  });
  $('#tabs').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('tab')) e.target.click(); });
  $('#pname').addEventListener('change', e => { P().name = e.target.value.trim() || 'Untitled'; renderTabs(); persist(); });
  $('#fmt').addEventListener('change', e => {
    const p = P(), f = +e.target.value, { R, C } = dims(f), out = Object.keys(p.wells).filter(k => { const s = split(k); return s.r >= R || s.c > C; });
    if (out.length && !confirm(`${out.length} filled wells don't fit a ${f}-well plate and will be removed. Continue?`)) { e.target.value = p.fmt; return; }
    snap(); out.forEach(k => delete p.wells[k]); p.fmt = f; if (/^(96|384)/.test(p.meta.block)) p.meta.block = f == 384 ? '384-well' : '96-well 0.2 mL'; sel.clear(); renderAll(); persist();
  });
  $('#colorby').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.colorBy = b.dataset.c; document.querySelectorAll('#colorby button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderPlate(); refreshSel(); persist(); });

  // record edits
  $('#meta').addEventListener('input', e => { const k = e.target.dataset.meta; if (k) { P().meta[k] = e.target.value; persist(); } });
  [['#m_vol', 'vol'], ['#m_n', 'n'], ['#m_over', 'over']].forEach(([id, k]) => $(id).addEventListener('input', e => { P().mix[k] = e.target.value; renderMix(); persist(); }));
  $('#mix').addEventListener('input', e => { const tr = e.target.closest('tr[data-i]'), f = e.target.dataset.f; if (!tr || !f) return; P().mix.comps[+tr.dataset.i][f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; renderMix(); persist(); });
  $('#mix').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; snap(); P().mix.comps.splice(+b.dataset.rm, 1); renderMix(true); persist(); });
  $('#m_add').addEventListener('click', () => { P().mix.comps.push({ name: '', stock: '', final: '', vol: 0, inMix: true, lot: '' }); renderMix(true); persist(); });
  $('#m_fill').addEventListener('click', () => {
    const m = P().mix, w = m.comps.find(c => /water/i.test(c.name)); if (!w) return status('Add a component named “water” first');
    const other = m.comps.filter(c => c !== w).reduce((a, c) => a + numv(c.vol), 0), v = numv(m.vol) - other;
    if (v < 0) return status('Other components already exceed the reaction volume');
    w.vol = +v.toFixed(2); renderMix(true); persist();
  });
  $('#cyc').addEventListener('input', e => { const tr = e.target.closest('tr[data-i]'), f = e.target.dataset.f; if (!tr || !f) return; P().cyc[+tr.dataset.i][f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; persist(); });
  $('#cyc').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; snap(); P().cyc.splice(+b.dataset.rm, 1); renderCyc(); persist(); });
  $('#c_add').addEventListener('click', () => { const last = P().cyc[P().cyc.length - 1] || {}; P().cyc.push({ stage: last.stage || '', temp: '', time: '', cycles: last.cycles || 1, collect: false }); renderCyc(); persist(); });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { snap(); P().cyc = JSON.parse(JSON.stringify(PRESETS[b.dataset.preset])); if (b.dataset.preset === 'sybr') P().meta.chemistry = 'SYBR Green'; renderCyc(); renderMeta(); persist(); }));
  $('#quick').innerHTML = QUICK.map(q => `<button data-q="${esc(q)}">+ ${esc(q)}</button>`).join('');
  $('#quick').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; addLog(b.dataset.q); });
  $('#l_add').addEventListener('click', () => addLog(''));
  function addLog(step) { const p = P(); p.log.push({ t: nowLocal(), step, text: '' }); renderLog(); persist(); const items = $('#log').querySelectorAll('li textarea'); const last = [...$('#log').querySelectorAll('li')].find(li => p.log[+li.dataset.i] && p.log[+li.dataset.i].step === step && p.log[+li.dataset.i].text === ''); (last ? last.querySelector(step ? 'textarea' : 'input[data-f=step]') : items[items.length - 1]).focus(); }
  $('#log').addEventListener('input', e => {
    const li = e.target.closest('li[data-i]'), f = e.target.dataset.f; if (!li || !f) return; const entry = P().log[+li.dataset.i];
    if (f === 'd' || f === 'h') { const d = li.querySelector('[data-f=d]').value, h = li.querySelector('[data-f=h]').value; entry.t = d ? (h ? d + 'T' + h : d) : ''; }
    else entry[f] = e.target.value;
    persist();
  });
  $('#log').addEventListener('change', e => { if (e.target.dataset.f === 'd' || e.target.dataset.f === 'h') renderLog(); });
  $('#log').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; snap(); P().log.splice(+b.dataset.rm, 1); renderLog(); persist(); });

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
  function setupRich(box) {
    const key = box.dataset.rich;
    box.innerHTML = `<div class="tb noprint" role="toolbar" aria-label="Formatting">
      <button data-cmd="h3" title="Heading">H</button><button data-cmd="p" title="Normal text">¶</button>
      <button data-cmd="bold" title="Bold (⌘B)"><b>B</b></button><button data-cmd="italic" title="Italic (⌘I)"><i>I</i></button><button data-cmd="underline" title="Underline (⌘U)"><u>U</u></button>
      <button data-cmd="insertUnorderedList" title="Bulleted list">• List</button><button data-cmd="insertOrderedList" title="Numbered list">1. List</button>
      <span class="sep"></span><button data-cmd="table" title="Insert a table">Table</button>
      <button data-t="rowAfter" title="Add a row below">+ Row</button><button data-t="colAfter" title="Add a column to the right">+ Column</button>
      <button data-t="delRow" title="Delete this row">− Row</button><button data-t="delCol" title="Delete this column">− Column</button>
      <span class="sep"></span><button data-cmd="removeFormat" title="Clear formatting">Clear format</button><button data-cmd="outline" title="Insert section headings">Outline</button><button data-cmd="markdown" title="Turn Markdown and $…$ math typed in this box into formatting">Format Markdown</button></div>
      <div class="rich" contenteditable="true" spellcheck="true" data-key="${key}" data-ph="${esc(box.dataset.ph)}" role="textbox" aria-multiline="true" aria-label="${key === 'design' ? 'Design sheet' : 'Results and conclusions'}"></div>`;
    const ed = box.querySelector('.rich'), tb = box.querySelector('.tb');
    const save = () => { P()[key] = sanitize(ed.innerHTML); persist(); };
    const sync = () => { const c = cellAtCaret(ed); tb.querySelectorAll('[data-t]').forEach(b => b.disabled = !c); };
    tb.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    tb.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const cmd = b.dataset.cmd;
      if (document.activeElement !== ed && cmd !== 'outline') { ed.focus(); caretInto(ed); }
      if (cmd === 'h3' || cmd === 'p') document.execCommand('formatBlock', false, cmd);
      else if (cmd === 'table') { const head = '<tr>' + '<th>Column</th>'.repeat(3) + '</tr>', row = '<tr>' + '<td><br></td>'.repeat(3) + '</tr>'; document.execCommand('insertHTML', false, `<table><thead>${head}</thead><tbody>${row}${row}</tbody></table><p><br></p>`); }
      else if (cmd === 'markdown') { formatMarkdown(ed); }
      else if (cmd === 'outline') { if (!sanitize(ed.innerHTML)) ed.innerHTML = OUTLINE[key]; else ed.insertAdjacentHTML('beforeend', OUTLINE[key]); ed.focus(); caretInto(ed.querySelector('p') || ed); }
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
  }
  document.querySelectorAll('.richbox').forEach(setupRich);
  document.addEventListener('change', e => {
    const t = e.target; if (!/^(INPUT|TEXTAREA)$/.test(t.tagName) || !/text|search|^$/.test(t.type || '') && t.tagName === 'INPUT') return;
    const ion = ION.test(t.value); ION.lastIndex = 0; if (!MATH1.test(t.value) && !ion) return;
    t.value = mathUnicode(t.value); t.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);

  // ---------- files ----------
  function dl(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  const safeName = s => (s || 'plate').replace(/[^\w.-]+/g, '_');
  $('#save').addEventListener('click', () => { const name = safeName(P().meta.project || P().name) + '_' + today() + '.qpcrplan.json'; dl(name, new Blob([JSON.stringify({ app: 'qpcr-plate-designer', version: 1, saved: new Date().toISOString(), ...state }, null, 1)], { type: 'application/json' })); status('Saved ' + name); });
  $('#openbtn').addEventListener('click', () => $('#openf').click());
  $('#openf').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!d.plates || !Array.isArray(d.plates)) throw new Error('not a plate designer project'); d.plates.forEach(upgrade);
      const replace = confirm(`Open “${f.name}” (${d.plates.length} plate${d.plates.length > 1 ? 's' : ''})?\n\nOK = replace the plates open now\nCancel = add them alongside`);
      snap(); if (replace) { state.plates = d.plates; state.cur = 0; } else { state.plates.push(...d.plates); state.cur = state.plates.length - d.plates.length; }
      sel.clear(); renderAll(); persist(); status('Opened ' + f.name);
    } catch (err) { status('Could not open ' + f.name + ': ' + err.message); }
  });
  $('#importbtn').addEventListener('click', () => $('#importf').click());
  async function importFiles(files) {
    const done = [], errs = [];
    for (const f of files) { try { done.push(await importRun(f)); } catch (err) { errs.push(f.name + ': ' + (err.message || err)); } }
    if (done.length) { snap();
      const blank = q => !Object.keys(q.wells).length && !q.log.length && !q.results && (!q.design || q.design === OUTLINE.design);
      if (state.plates.length === 1 && blank(state.plates[0])) state.plates = [];
      const first = state.plates.length; state.plates.push(...done); state.cur = first; sel.clear(); renderAll(); persist(); }
    status((done.length ? `Imported ${done.length} plate${done.length > 1 ? 's' : ''} (${done.map(p => Object.keys(p.wells).length + ' wells').join(', ')})` : '') + (errs.length ? ' · Could not import ' + errs.join('; ') : ''));
  }
  $('#importf').addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) importFiles(fs); });
  document.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => { const fs = [...e.dataTransfer.files].filter(f => /\.(eds|xlsx?|ods|txt|csv)$/i.test(f.name)); if (!fs.length) return; e.preventDefault(); importFiles(fs); });
  function tableFromRows(rows) {
    const h = rows.findIndex(r => r && r.some(x => String(x == null ? '' : x).trim() === 'Well Position')); if (h < 0) return null;
    const head = rows[h].map(x => String(x == null ? '' : x).trim()), body = rows.slice(h + 1).filter(r => r && r.some(v => v != null && v !== ''));
    const meta = {}; rows.slice(0, h).forEach(r => { const m = /^\*?\s*([^=]+?)\s*=\s*(.*)$/.exec(String(r[0] || '')); if (m) meta[m[1]] = m[2]; else if (r[0] != null && r[1] != null) meta[String(r[0]).trim()] = r[1]; });
    return { head, body, meta, col: (...ns) => { for (const n of ns) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; } };
  }
  async function importRun(f) {
    const p = newPlate(f.name.replace(/\.[^.]+$/, ''), 96); p.meta.runFile = f.name; let rows = [];
    if (/\.eds$/i.test(f.name)) {
      const d = await QPCR.parseEDS(await f.arrayBuffer(), JSZip);
      rows = d.wells.map(w => ({ pos: w.pos, sample: w.sample, target: w.target, task: w.task }));
      if (d.ncol > 12) p.fmt = 384;
      if (d.info.start) p.meta.date = new Date(d.info.start.getTime() - d.info.start.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
      if (d.info.protocol && d.info.protocol.stages.length) {
        const pr = d.info.protocol; if (pr.volume) p.mix.vol = pr.volume;
        p.cyc = pr.stages.flatMap((st, i) => st.steps.map(s => ({ stage: (st.reps > 1 ? 'PCR' : 'Stage ' + (i + 1)), temp: s.temp, time: Math.floor(s.hold / 60) + ':' + String(s.hold % 60).padStart(2, '0'), cycles: st.reps, collect: s.collect })));
      }
    } else {
      let T;
      if (/\.(txt|csv)$/i.test(f.name)) { const txt = await f.text(), sep = /\t/.test(txt) ? '\t' : ','; T = tableFromRows(txt.split(/\r?\n/).map(l => l.split(sep).map(x => x.replace(/^"|"$/g, '')))); }
      else { const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }); const get = n => wb.Sheets[wb.SheetNames.find(s => s.toLowerCase() === n.toLowerCase())];
        const ws = get('Sample Setup') || get('Results'); if (!ws) throw new Error('no “Sample Setup” or “Results” sheet'); T = tableFromRows(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })); }
      if (!T) throw new Error('no table with a “Well Position” column');
      const iW = T.col('Well Position'), iS = T.col('Sample Name'), iT = T.col('Target Name'), iK = T.col('Task'), iR = T.col('Reporter'), iQ = T.col('Quencher'), iN = T.col('Quantity'), iB = T.col('Biogroup Name', 'Biological Group'), iC = T.col('Comments');
      const g = i => r => i >= 0 && r[i] != null ? String(r[i]).trim() : '';
      rows = T.body.map(r => ({ pos: g(iW)(r), sample: g(iS)(r), target: g(iT)(r), task: g(iK)(r).toUpperCase(), dye: g(iR)(r), quencher: g(iQ)(r), qty: g(iN)(r), group: g(iB)(r), note: g(iC)(r) })).filter(r => /^[A-P]\d{1,2}$/.test(r.pos));
      if (/384/.test(String(T.meta['Block Type'] || '')) || rows.some(r => split(r.pos).r >= 8 || split(r.pos).c > 12)) p.fmt = 384;
      const M = k => { const v = T.meta[k]; return v == null || /^null$/i.test(String(v).trim()) ? '' : String(v).trim(); };
      const stamp = v => { const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/.exec(v); return m ? `${m[1]}T${m[2].padStart(2, '0')}:${m[3]}` : ''; };
      const end = stamp(M('Experiment Run End Time')), made = stamp(M('Date Created'));
      if (end) p.meta.date = end.slice(0, 10);
      if (M('Chemistry')) p.meta.chemistry = /sybr/i.test(M('Chemistry')) ? 'SYBR Green' : /taqman/i.test(M('Chemistry')) ? 'TaqMan' : M('Chemistry').replace(/_/g, ' ');
      const inst = [M('Instrument Type').replace(/ System$/, ''), M('Instrument Name')].filter(Boolean).join(' · '); if (inst) p.meta.instrument = inst;
      if (M('Block Type')) p.meta.block = M('Block Type');
      if (M('Experiment File Name')) p.meta.runFile = M('Experiment File Name').split(/[\\/]/).pop();
      if (M('Experiment Type')) p.meta.expType = M('Experiment Type').replace(/Cт/g, 'Ct');
      p.meta.passive = M('Passive Reference') || 'None';
      if (M('Experiment Name') && M('Experiment Name') !== p.name) p.meta.expName = M('Experiment Name');
      if (M('Experiment Comment')) p.design = '<h3>Experiment comment (from QuantStudio)</h3>' + textToHtml(M('Experiment Comment'));
      p.cyc = []; // the export does not contain the run method
      p.mix.comps = []; p.mix.vol = ''; // nor the reaction recipe
      if (end) p.log.push({ t: end, step: 'Run finished', text: [inst && 'On ' + inst, M('Quantification Cycle Method') && 'Analysis: ' + M('Quantification Cycle Method') + (M('Stage/ Cycle where Ct Analysis is performed') ? ' at ' + M('Stage/ Cycle where Ct Analysis is performed') : '')].filter(Boolean).join('. ') });
      if (made) p.log.push({ t: made, step: 'Results exported', text: 'Exported from QuantStudio as ' + f.name });
    }
    if (p.fmt === 384) p.meta.block = '384-well';
    const placeholders = rows.filter(r => !r.sample && r.target).map(r => r.pos);
    rows = rows.filter(r => r.sample);
    if (!rows.length) throw new Error('no wells with a sample name');
    // QuantStudio often leaves NTC wells as UNKNOWN; a sample named "NTC" is treated as a no-template control
    const ntc = [];
    rows.forEach(r => { if ((!r.task || r.task === 'UNKNOWN') && /(^|[^a-z])ntc/i.test(r.sample)) { r.task = 'NTC'; ntc.push(r.pos); } });
    // merge multiplex rows (one row per target in the same well)
    rows.forEach(r => {
      const w = p.wells[r.pos];
      if (!w) { const o = {}; FIELDS.forEach(k => { if (r[k]) o[k] = r[k]; }); p.wells[r.pos] = o; return; }
      ['target', 'dye', 'quencher'].forEach(k => { if (r[k] && !String(w[k] || '').split(', ').includes(r[k])) w[k] = w[k] ? w[k] + ', ' + r[k] : r[k]; });
    });
    const notes = ['From ' + f.name + ': ' + Object.keys(p.wells).length + ' wells'];
    if (ntc.length) notes.push(`task set to NTC for ${ntc.length} wells named NTC (${compress([...new Set(ntc)].sort(posOrder))})`);
    if (placeholders.length) notes.push(`skipped ${placeholders.length} wells with a target but no sample (${compress([...new Set(placeholders)].sort(posOrder))})`);
    if (!p.cyc.length) notes.push('the export has no run method or reaction recipe; add them below');
    p.log.push({ t: nowLocal(), step: 'Layout imported', text: notes.join('; ') + '.' });
    return p;
  }

  function platePNG(p) {
    return new Promise((ok, bad) => {
      const svg = plateSVG(p, true), img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url); c.toBlob(b => ok({ blob: b, url: c.toDataURL('image/png'), w: img.width / 2, h: img.height / 2 })); };
      img.onerror = bad; img.src = url;
    });
  }
  $('#xpng').addEventListener('click', async () => { const p = P(), r = await platePNG(p); dl(safeName(p.name) + '_platemap.png', r.blob); });

  // ---------- reports: one HTML record per plate, printed to PDF or converted to Word ----------
  function legendText(p) {
    const pal = palettes(p), by = state.colorBy, parts = [];
    const name = { sample: 'Fill colour = sample', target: 'Fill colour = target', group: 'Fill colour = group', task: 'Fill colour = task' }[by];
    if (pal.target.length && by !== 'target') parts.push('bars at the bottom of each well = target (' + pal.target.join(', ') + ')');
    parts.push('dashed outline = NTC');
    return name + '; ' + parts.join('; ') + '.';
  }
  function reportHTML(p, img) {
    const T = (head, rows) => '<table><thead><tr>' + head.map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${esc(c == null ? '' : c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    const { R, C } = dims(p.fmt), keys = Object.keys(p.wells).sort(posOrder);
    let h = `<h1>${esc(p.name)}</h1>`;
    const meta = META.map(([k, lab]) => [lab, p.meta[k]]).filter(([, v]) => v);
    h += '<h2>Design</h2>' + (meta.length ? T(['Detail', ''], meta).replace('<thead><tr><th>Detail</th><th></th></tr></thead>', '') : '');
    h += sanitize(p.design) || '<p><em>No design notes.</em></p>';
    h += `<h2>Plate layout</h2><p>${p.fmt}-well plate · ${keys.length} of ${R * C} wells used. ${esc(legendText(p))}</p>`;
    h += img ? `<p><img data-plate="1" src="${img.url}" width="${img.w}" height="${img.h}" alt="Plate map"></p>` : '';
    const groups = [...summaryOf(p).values()];
    if (groups.length) h += '<h3>Plate map summary</h3>' + T(['Sample', 'Target', 'Task', 'Group', 'Quantity', 'n', 'Wells'], groups.map(G => [G.sample || '—', G.target || '—', [...G.task].join(', '), [...G.group].join(', '), [...G.qty].join(', '), String(G.wells.length), compress(G.wells)]));
    if (keys.length) h += '<h3>All wells</h3>' + T(['Well', 'Sample', 'Target', 'Task', 'Reporter', 'Quencher', 'Qty', 'Group', 'Template', 'Note'], keys.map(k => [k, ...FIELDS.map(f => p.wells[k][f] || '')]));
    h += '<h2>Results and conclusions</h2>' + (sanitize(p.results) || '<p><em>No results recorded yet.</em></p>');
    h += '<h2>Protocol record</h2>';
    const m = p.mix, comps = m.comps || [];
    if (comps.length) { const { total } = mixReactions(p); h += `<h3>Reaction setup and master mix</h3><p>Reaction volume ${esc(m.vol || '—')} µL · ${r1(total)} reactions including ${esc(m.over || 0)}% overage.</p>` + T(['Component', 'Stock', 'Final', 'µL / rxn', 'In mix', 'µL total', 'Lot / notes'], comps.map(c => [c.name, c.stock, c.final, String(c.vol), c.inMix ? 'yes' : 'per well', c.inMix ? r1(numv(c.vol) * total) : '', c.lot])); }
    else h += '<h3>Reaction setup and master mix</h3><p><em>Not recorded.</em></p>';
    h += '<h3>Thermal cycling</h3>' + (p.cyc.length ? T(['Stage', 'Temp (°C)', 'Time', 'Cycles', 'Data collection', 'Notes'], p.cyc.map(c => [c.stage, String(c.temp), c.time, String(c.cycles), c.collect ? 'yes' : '', c.note || ''])) : '<p><em>Not recorded.</em></p>');
    const log = [...p.log].sort((a, b) => String(a.t || '').localeCompare(String(b.t || '')));
    h += '<h3>Log</h3>' + (log.length ? T(['Date', 'Time', 'Step', 'Details'], log.map(e => [String(e.t || '').slice(0, 10), String(e.t || '').slice(11, 16), e.step, e.text])) : '<p><em>No entries.</em></p>');
    return h;
  }
  const scopePlates = () => $('#xscope').value === 'all' ? state.plates : [P()];
  const reportName = ps => safeName(ps.length > 1 ? (ps[0].meta.project || 'qPCR_plates') + '_all_plates' : ps[0].name);

  // PDF: the report in a hidden frame, printed with the browser's "Save as PDF"
  $('#xpdf').addEventListener('click', async () => {
    const ps = scopePlates(); status('Preparing PDF…');
    const parts = []; for (const p of ps) parts.push(reportHTML(p, await platePNG(p)));
    const css = `@page{margin:16mm}body{font:10.5pt/1.45 -apple-system,"Segoe UI",Roboto,Arial,"PingFang SC",sans-serif;color:#111}h1{font-size:18pt;margin:0 0 6pt}h2{font-size:13pt;margin:16pt 0 6pt;border-bottom:1px solid #bbb;padding-bottom:2pt;break-after:avoid}h3{font-size:11pt;margin:12pt 0 4pt;break-after:avoid}h4{font-size:10.5pt;margin:10pt 0 4pt}p{margin:4pt 0}ul,ol{margin:4pt 0;padding-left:18pt}table{border-collapse:collapse;margin:6pt 0;font-size:9pt;width:100%}th,td{border:1px solid #bbb;padding:3pt 5pt;text-align:left;vertical-align:top}th{background:#eee}tr{break-inside:avoid}img{max-width:100%;height:auto}sup,sub{font-size:.75em;line-height:0}code{font-family:Menlo,Consolas,monospace;font-size:9pt}blockquote{margin:4pt 0;padding-left:8pt;border-left:2pt solid #bbb;color:#444}.plate+.plate{break-before:page}`;
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    const d = f.contentDocument; d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(reportName(ps))}</title><style>${css}</style></head><body>${parts.map(x => `<section class="plate">${x}</section>`).join('')}</body></html>`); d.close();
    await Promise.all([...d.images].map(i => i.decode().catch(() => {})));
    status('In the print dialog, choose “Save as PDF”.');
    f.contentWindow.focus(); f.contentWindow.print();
    setTimeout(() => f.remove(), 60000);
  });

  // Word: a real .docx (Office Open XML) built from the same report HTML
  function docxFrom(htmlParts, images) {
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
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${Math.round(w)}" cy="${hgt}"/><wp:docPr id="${imgN}" name="Plate map ${imgN}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imgN}" name="${X(im.name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(w)}" cy="${hgt}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
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
    z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>qPCR plate record</dc:title><dc:creator>qPCR Workbench</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
    z.file('word/document.xml', doc); z.file('word/styles.xml', styles); z.file('word/numbering.xml', numbering);
    z.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${rels.join('')}</Relationships>`);
    images.forEach(im => z.file('word/media/' + im.name, im.blob));
    return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  $('#xdocx').addEventListener('click', async () => {
    const ps = scopePlates(); status('Preparing Word document…');
    try {
      const images = [], parts = [];
      for (const p of ps) { const im = await platePNG(p); const idx = images.push({ ...im, name: `plate${images.length + 1}.png` }) - 1; parts.push(reportHTML(p, im).replace('data-plate="1"', `data-idx="${idx}"`)); }
      const blob = await docxFrom(parts, images); const name = reportName(ps) + '.docx'; dl(name, blob); status('Saved ' + name);
    } catch (err) { status('Could not make the Word file: ' + (err.message || err)); }
  });
  const csvq = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  $('#xcsv').addEventListener('click', () => {
    const p = P(), keys = Object.keys(p.wells).sort(posOrder), H = ['Well', 'Sample', 'Target', 'Task', 'Reporter', 'Quencher', 'Quantity', 'Group', 'Template', 'Note'];
    const lines = [H.join(',')].concat(keys.map(k => [k, ...FIELDS.map(f => p.wells[k][f] || '')].map(v => csvq(String(v))).join(',')));
    dl(safeName(p.name) + '_wells.csv', new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }));
  });
  $('#xqs').addEventListener('click', () => {
    const p = P(), { C } = dims(p.fmt), keys = Object.keys(p.wells).sort(posOrder);
    const head = [`* Block Type = ${p.fmt == 384 ? '384-Well Block' : '96-Well Block (0.2mL)'}`, `* Chemistry = ${/sybr/i.test(p.meta.chemistry) ? 'SYBR_GREEN' : 'TAQMAN'}`, `* Experiment Name = ${p.name}`, '', '[Sample Setup]',
      ['Well', 'Well Position', 'Sample Name', 'Biogroup Name', 'Target Name', 'Task', 'Reporter', 'Quencher', 'Quantity', 'Comments'].join('\t')];
    const rows = [];
    keys.forEach(k => { const w = p.wells[k], s = split(k), idx = s.r * C + s.c, ts = targetsOf(w).length ? targetsOf(w) : [''], ds = String(w.dye || '').split(/\s*,\s*/), qs = String(w.quencher || '').split(/\s*,\s*/);
      ts.forEach((t, i) => rows.push([idx, k, w.sample || '', w.group || '', t, w.task || (w.sample ? 'UNKNOWN' : ''), ds[i] || ds[0] || '', qs[i] || qs[0] || '', w.qty || '', (w.note || '').replace(/[\t\n]/g, ' ')].join('\t'))); });
    dl(safeName(p.name) + '_sample_setup.txt', new Blob([head.concat(rows).join('\r\n') + '\r\n'], { type: 'text/plain' }));
  });

  // ---------- print ----------
  let wasOpen = false;
  const pm = window.matchMedia('print'); pm.addEventListener('change', () => { printing = pm.matches; renderPlate(); refreshSel(); });
  window.addEventListener('beforeprint', () => { printing = true; renderPlate(); const d = $('#wellsd'); wasOpen = d.open; d.open = true; sel.clear(); refreshSel(); document.querySelectorAll('#sheet textarea').forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }); });
  window.addEventListener('afterprint', () => { printing = false; renderPlate(); refreshSel(); $('#wellsd').open = wasOpen; });
  $('#undo').addEventListener('click', doUndo);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderPlate);

  // style for selection rects (kept here so the SVG stays self-contained for export)
  const st = document.createElement('style'); st.textContent = '#plate .well .selr{display:none}#plate .well.sel .selr{display:inline}'; document.head.appendChild(st);
  renderAll();
})();
