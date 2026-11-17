// Shared plate-map drawing for plate designs (used by the Plate Designer and, for linked designs, the Reader).
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROWL = 'ABCDEFGHIJKLMNOP';
  const SPAL = ['#185FA5', '#D85A30', '#1D9E75', '#BA7517', '#7F77DD', '#D4537E', '#639922', '#E24B4A', '#378ADD', '#5DCAA5', '#3C3489', '#888780', '#EF9F27', '#993556', '#0F6E56', '#854F0B', '#534AB7', '#A32D2D', '#2B6CB0', '#B7791F'];
  const TPAL = ['#B0171F', '#1F3FD1', '#0A8A4E', '#7B2CBF', '#C2650A', '#0E7490', '#9D174D', '#4D7C0F'];
  const TASKC = { UNKNOWN: '#1F3FD1', NTC: '#888780', STANDARD: '#C2650A', POSITIVE: '#0A8A4E', NRT: '#9D174D' };
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const dims = fmt => fmt == 384 ? { R: 16, C: 24 } : { R: 8, C: 12 };
  const split = p => ({ r: ROWL.indexOf(p[0]), c: +p.slice(1) });
  const posOrder = (a, b) => { const A = split(a), B = split(b); return A.r - B.r || A.c - B.c; };
  const targetsOf = w => String(w.target || '').split(/\s*[,;+]\s*/).filter(Boolean);
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

  // o: { colorBy, sel (Set of selected wells), forExport, light (print colours) }
  function svg(p, o) {
    o = o || {}; const forExport = !!o.forExport, sel = o.sel || new Set(), printing = !!o.light;
    const { R, C } = dims(p.fmt), big = C <= 12, cell = big ? 66 : 32, pad = 30;
    const W = pad + C * cell + 6, H = pad + R * cell + 6;
    const ink = cv('--ink'), muted = cv('--muted'), bg = forExport ? '#ffffff' : cv('--bg'), acc = cv('--accent');
    const light = forExport || printing, inkE = light ? '#1d2329' : ink, mutedE = light ? '#5d6670' : muted, bgE = light ? '#ffffff' : bg;
    const pal = palettes(p), by = o.colorBy || 'sample';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${forExport ? `width="${W * 2}" height="${H * 2}"` : ''} font-family="-apple-system,Segoe UI,Roboto,Arial,sans-serif" role="img" aria-label="Plate map of ${esc(p.name)}">`;
    if (forExport) s += `<rect width="${W}" height="${H}" fill="${bg}"/>`;
    s += `<text class="hdr" data-all="1" x="10" y="18" font-size="11" fill="${mutedE}" style="cursor:pointer">◢</text>`;
    for (let j = 1; j <= C; j++) s += `<text class="hdr" data-col="${j}" x="${pad + (j - 0.5) * cell}" y="19" text-anchor="middle" font-size="${big ? 12 : 10}" font-weight="600" fill="${inkE}" style="cursor:pointer">${j}</text>`;
    for (let i = 0; i < R; i++) s += `<text class="hdr" data-row="${ROWL[i]}" x="12" y="${pad + (i + 0.5) * cell + 4}" text-anchor="middle" font-size="${big ? 12 : 10}" font-weight="600" fill="${inkE}" style="cursor:pointer">${ROWL[i]}</text>`;
    const cut = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
    for (let i = 0; i < R; i++) for (let j = 1; j <= C; j++) {
      const pos = ROWL[i] + j, w = p.wells[pos], x = pad + (j - 1) * cell, y = pad + i * cell, cx = x + cell / 2, cy = y + cell / 2, r = cell / 2 - (big ? 3 : 2);
      s += `<g class="well${sel.has(pos) && !forExport ? ' sel' : ''}" data-pos="${pos}">`;
      if (!forExport && o.sel) s += `<rect class="selr" x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="6" fill="${acc}" fill-opacity=".14" stroke="${acc}" stroke-width="2"/>`;
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
  window.PLATE = { svg, palettes, colorFor, wellColor, wrap, fmtQty, compress, summaryOf, dims, split, posOrder, targetsOf, TASKC };
})();
