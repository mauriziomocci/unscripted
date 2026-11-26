/* ---------- shared report for every environment: indicators per person, relations, chapters → card + book-like PDF ----------
   An environment builds a report object and hands it to rpCard / rpPdf:
   { env, title, subtitle, date, people: [{ name, role, badge, stats: [[label, value]], bars: [[label, 0..100]], note }],
     relations: [{ a, b, v (-3..3), why }], sections: [{ title, text }], chapters: [{ title, text }], appendix: [{ title, text }] } */
const RP_POS = '#2f8f46', RP_NEG = '#b5352a', RP_MID = '#8a7f6a';
function rpColor(v) { return v > 0.5 ? RP_POS : v < -0.5 ? RP_NEG : RP_MID; }
function rpRelWord(v) { return v >= 2 ? 'stima' : v > 0.5 ? 'simpatia' : v <= -2 ? 'ostilità' : v < -0.5 ? 'antipatia' : 'neutrale'; }

/* relation graph as SVG (arrows A → B, colour by feeling, width by strength) */
function rpRelSvg(names, rels, W = 560, H = 380) {
  if (names.length < 2) return '<p class="legend">Servono almeno due persone per le relazioni.</p>';
  const cx = W / 2, cy = H / 2 + 4, R = Math.min(H / 2 - 40, 60 + names.length * 18); const P = {};
  names.forEach((n, i) => { const t = -Math.PI / 2 + i / names.length * Math.PI * 2; P[n] = [cx + Math.cos(t) * R, cy + Math.sin(t) * R]; });
  const marks = [RP_POS, RP_NEG, RP_MID].map((c) => `<marker id="rp${c.slice(1)}" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('');
  const edges = rels.filter((r) => P[r.a] && P[r.b] && r.a !== r.b).map((r) => { const [x1, y1] = P[r.a], [x2, y2] = P[r.b]; const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.12; const c = rpColor(r.v);
    return `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" stroke="${c}" stroke-width="${1.4 + Math.min(3, Math.abs(r.v))}" fill="none" marker-end="url(#rp${c.slice(1)})" opacity=".85"><title>${esc(r.a)} → ${esc(r.b)}: ${esc(rpRelWord(r.v))}${r.why ? ' · ' + esc(r.why) : ''}</title></path>`; }).join('');
  const nodes = names.map((n) => { const [x, y] = P[n]; return `<g><circle cx="${x}" cy="${y}" r="19" fill="#f3ead3" stroke="#4a3a24" stroke-width="2"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#3a2e1c">${esc(n.slice(0, 2).toUpperCase())}</text><text x="${x}" y="${y + 35}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#3a2e1c">${esc(n)}</text></g>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-height:46vh" role="img" aria-label="Grafo delle relazioni"><defs>${marks}</defs>${edges}${nodes}</svg>`;
}

/* on-screen card: people with indicators, relations, sections */
function rpHtml(rep) {
  const people = rep.people.map((p) => `<div class="rpP"><div class="rpH"><b>${esc(p.name)}</b> ${p.badge ? `<span class="rpBadge">${esc(p.badge)}</span>` : ''}<small>${esc(p.role || '')}</small></div>
    ${(p.bars || []).map(([l, v]) => `<div class="rpBar"><span>${esc(l)}</span><i><u style="width:${Math.max(0, Math.min(100, v))}%"></u></i><em>${Math.round(v)}</em></div>`).join('')}
    <div class="rpStats">${(p.stats || []).map(([l, v]) => `<span><small>${esc(l)}</small> ${esc(String(v))}</span>`).join('')}</div>${p.note ? `<p class="rpNote">${esc(p.note)}</p>` : ''}</div>`).join('');
  const rels = rep.relations.length ? rep.relations.slice().sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).map((r) => `<tr><td><b>${esc(r.a)}</b> → ${esc(r.b)}</td><td style="color:${rpColor(r.v)}">${esc(rpRelWord(r.v))} (${r.v > 0 ? '+' : ''}${r.v})</td><td><i>${esc(r.why || '')}</i></td></tr>`).join('') : '<tr><td>Nessuna relazione registrata.</td></tr>';
  return `<div class="rpGrid">${people}</div>${(rep.sections || []).map((s) => `<h4>${esc(s.title)}</h4><p>${esc(s.text)}</p>`).join('')}
   <h4>❤️ Relazioni</h4><div class="legend">Come ognuno vede gli altri, alla fine. Verde: positiva; rossa: negativa; grigia: neutrale. Passa sopra una freccia per leggere.</div>
   ${rpRelSvg(rep.people.map((p) => p.name), rep.relations)}<div style="max-height:24vh;overflow:auto"><table class="relT">${rels}</table></div>`;
}

/* book-like PDF (A5): cover, cast with indicators, relations (diagram + table), sections, chapters, appendix */
async function rpPdf(rep, filename) {
  const { jsPDF } = await loadJsPDF(); const doc = new jsPDF({ unit: 'mm', format: 'a5' }); const PW = 148, PH = 210, MX = 16, TW = PW - 2 * MX; let y = 0;
  const T = (s) => pdfClean(String(s == null ? '' : s));
  const page = () => { doc.addPage(); y = 20; }; const need = (h) => { if (y + h > PH - 16) page(); };
  const para = (text, size = 10, style = 'normal', indent = 0) => { doc.setFont('times', style); doc.setFontSize(size); String(text || '').split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean).forEach((p, k) => { doc.splitTextToSize(T((indent && k ? '      ' : '') + p), TW).forEach((l) => { need(size * 0.45); doc.text(l, MX, y); y += size * 0.45; }); y += 1.2; }); };
  const head = (t, size = 15) => { need(16); doc.setFont('times', 'bold'); doc.setFontSize(size); doc.splitTextToSize(T(t), TW).forEach((l) => { doc.text(l, MX, y); y += size * 0.5; }); y += 2; };
  // cover
  y = 60; doc.setFont('times', 'italic'); doc.setFontSize(11); doc.text(T(rep.env || ''), PW / 2, y - 14, { align: 'center' });
  doc.setFont('times', 'bold'); doc.setFontSize(22); doc.splitTextToSize(T(rep.title), TW).forEach((l) => { doc.text(l, PW / 2, y, { align: 'center' }); y += 10; });
  doc.setFont('times', 'italic'); doc.setFontSize(11); doc.splitTextToSize(T(rep.subtitle || ''), TW).forEach((l) => { doc.text(l, PW / 2, y + 2, { align: 'center' }); y += 5.5; });
  doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.text(T(new Date(rep.date || Date.now()).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })), PW / 2, PH - 28, { align: 'center' });
  // people
  page(); head('I personaggi');
  rep.people.forEach((p) => { need(30); doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.text(T(p.name + (p.badge ? '  · ' + p.badge : '')), MX, y); y += 5; doc.setFont('times', 'italic'); doc.setFontSize(9.5); if (p.role) { doc.text(T(p.role), MX, y); y += 4.6; }
    (p.bars || []).forEach(([l, v]) => { need(5); doc.setFont('times', 'normal'); doc.setFontSize(9); doc.text(T(l), MX, y); doc.setDrawColor(150); doc.rect(MX + 38, y - 2.6, 60, 3); doc.setFillColor(190, 138, 46); doc.rect(MX + 38, y - 2.6, 60 * Math.max(0, Math.min(100, v)) / 100, 3, 'F'); doc.text(String(Math.round(v)), MX + 101, y); y += 4.6; });
    const st = (p.stats || []).map(([l, v]) => `${l}: ${v}`).join(' · '); if (st) { para(st, 9); }
    if (p.note) para(p.note, 9.5, 'italic'); y += 3; });
  // relations
  if (rep.people.length > 1) { page(); head('Le relazioni');
    const names = rep.people.map((p) => p.name); const cx = PW / 2, cy = y + 48, R = 38; const P = {}; names.forEach((n, i) => { const t = -Math.PI / 2 + i / names.length * Math.PI * 2; P[n] = [cx + Math.cos(t) * R, cy + Math.sin(t) * R]; });
    rep.relations.forEach((r) => { if (!P[r.a] || !P[r.b]) return; const c = rpColor(r.v); doc.setDrawColor(parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)); doc.setLineWidth(0.25 + Math.min(1.2, Math.abs(r.v) * 0.35)); const [x1, y1] = P[r.a], [x2, y2] = P[r.b]; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1; const ex = x2 - dx / L * 6, ey = y2 - dy / L * 6, sx = x1 + dx / L * 6 + (-dy / L) * 0.9, sy = y1 + dy / L * 6 + (dx / L) * 0.9; doc.line(sx, sy, ex + (-dy / L) * 0.9, ey + (dx / L) * 0.9); const ax = ex + (-dy / L) * 0.9, ay = ey + (dx / L) * 0.9; doc.line(ax, ay, ax - dx / L * 2 + dy / L * 1.2, ay - dy / L * 2 - dx / L * 1.2); doc.line(ax, ay, ax - dx / L * 2 - dy / L * 1.2, ay - dy / L * 2 + dx / L * 1.2); });
    doc.setLineWidth(0.3); doc.setDrawColor(74, 58, 36); names.forEach((n) => { const [x, yy] = P[n]; doc.setFillColor(243, 234, 211); doc.circle(x, yy, 5, 'FD'); doc.setFont('times', 'bold'); doc.setFontSize(7.5); doc.text(T(n.slice(0, 2).toUpperCase()), x, yy + 1.2, { align: 'center' }); doc.setFontSize(7.5); doc.text(T(n), x, yy + 9, { align: 'center' }); });
    y = cy + R + 16; doc.setFont('times', 'italic'); doc.setFontSize(8.5); doc.text(T('Verde: positiva · rossa: negativa · grigia: neutrale. La freccia va da chi giudica a chi è giudicato.'), MX, y); y += 7;
    rep.relations.slice().sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).forEach((r) => para(`${r.a} -> ${r.b}: ${rpRelWord(r.v)} (${r.v > 0 ? '+' : ''}${r.v})${r.why ? ' — ' + r.why : ''}`, 9)); }
  (rep.sections || []).forEach((s) => { page(); head(s.title); para(s.text, 10, 'normal', 1); });
  (rep.chapters || []).forEach((c, i) => { page(); doc.setFont('times', 'italic'); doc.setFontSize(10); doc.text(T(rep.chapters.length > 1 ? `Capitolo ${i + 1}` : 'Il racconto'), PW / 2, y + 6, { align: 'center' }); y += 14; doc.setFont('times', 'bold'); doc.setFontSize(15); doc.splitTextToSize(T(c.title), TW).forEach((l) => { doc.text(l, PW / 2, y, { align: 'center' }); y += 7; }); y += 6; para(c.text, 10.5, 'normal', 1); });
  (rep.appendix || []).forEach((a) => { page(); head(a.title, 13); para(a.text, 8.5); });
  const n = doc.getNumberOfPages(); for (let i = 2; i <= n; i++) { doc.setPage(i); doc.setFont('times', 'normal'); doc.setFontSize(8.5); doc.text(String(i), PW / 2, PH - 9, { align: 'center' }); }
  const r = await saveFile(filename, doc.output('blob')); return { r, pages: n };
}

/* ---------- talk show → report ---------- */
function tsIndicators(s) {
  const L = s.lines.filter((l) => !l.sys && l.text !== '(resta in silenzio)'); const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
  const allW = L.reduce((a, l) => a + words(l.text), 0) || 1; const hotRe = /acces|offes|provoc/; const warmRe = /concilian|commoss|appassion/;
  const people = tsPeople().map((p) => { const mine = L.filter((l) => l.who === p.name); const toMe = L.filter((l) => l.to === p.name);
    const tones = {}; mine.forEach((l) => { if (l.tono) tones[l.tono] = (tones[l.tono] || 0) + 1; }); const topTone = Object.entries(tones).sort((a, b) => b[1] - a[1])[0];
    const reacts = (re) => mine.filter((l) => re.test(l.react || '')).length;
    const share = Math.round(mine.reduce((a, l) => a + words(l.text), 0) / allW * 100);
    const attacked = toMe.filter((l) => hotRe.test(l.tono || '')).length; const attacks = mine.filter((l) => hotRe.test(l.tono || '') && l.to !== 'tutti' && l.to !== 'pubblico').length;
    const isHost = p === s.host;
    const o = { name: p.name, role: isHost ? 'conduttore' : (p.role || 'ospite'), badge: isHost ? '🎙 conduce' : p.left ? '🚪 se n\'è andato' : s.winner === p.name ? '🏆 vincitore della serata' : p.surprise ? '🚪 ospite a sorpresa' : '',
      bars: [['Tempo di parola', share * (isHost ? 1 : 2.5)], ['Accensione', mine.length ? mine.filter((l) => hotRe.test(l.tono || '')).length / mine.length * 100 : 0]],
      stats: [['battute', mine.length], ['tono prevalente', topTone ? topTone[0] : '—'], ['applausi', reacts(/applaus/)], ['risate', reacts(/risat/)], ['fischi', reacts(/fischi/)], ['attacchi fatti', attacks], ['attacchi subiti', attacked], ['interruzioni fatte', mine.filter((l) => l.interrupt).length], ['interrotto', mine.filter((l) => l.cut).length], ['d\'accordo con altri', mine.filter((l) => /accordo|concilian/.test(l.tono || '') && tsGet(l.to) && l.to !== s.host.name).length]], note: '' };
    if (!isHost) { o.bars.unshift(['Gradimento', 50 + (s.approval[p.name] || 0) / 2]); if (p.secret) o.stats.push(['segreto', p.secret]); o.bars[1][1] = Math.min(100, share * 2.5); }
    else { const qs = mine.filter((l) => /\?/.test(l.text)); const per = {}; qs.forEach((l) => { if (tsGet(l.to)) per[l.to] = (per[l.to] || 0) + 1; }); const counts = s.guests.map((g) => per[g.name] || 0); const mx = Math.max(1, ...counts), mn = Math.min(...counts);
      const ear = s.ear || []; o.stats = [['battute', mine.length], ['domande', qs.length], ['tono prevalente', topTone ? topTone[0] : '—'], ['suggerimenti usati', ear.filter((e) => e.state === 'usato').length + '/' + ear.length], ['ignorati', ear.filter((e) => e.state === 'ignorato').length], ['temi', Math.min(s.seg, s.topics.length) + '/' + s.topics.length]];
      o.bars = [['Tempo di parola', share], ['Equità con gli ospiti', counts.length ? (mn / mx) * 100 : 100], ['Controllo dello studio', Math.max(0, 100 - L.filter((l) => !l.host && hotRe.test(l.tono || '')).length / Math.max(1, L.length) * 160)], ['Applausometro finale', s.applause]];
      o.note = `Domande per ospite: ${s.guests.map((g) => `${g.name} ${per[g.name] || 0}`).join(', ')}.`; }
    return o; });
  return people;
}
function tsRelations(s) {
  const names = tsPeople().map((p) => p.name); const R = {};
  // starting point: what the archive says among the people present
  tsPeople().forEach((p) => { const c = tsChar(p); (c.relations || []).forEach((r) => { const o = archGet(r.to); if (o && names.includes(o.name) && o.name !== p.name) R[p.name + '>' + o.name] = { a: p.name, b: o.name, v: r.int || 0, why: r.view || r.type || '', from: 'prima della puntata' }; }); });
  // what happened in studio: hot/warm lines addressed to someone
  s.lines.filter((l) => !l.sys && !l.director && tsGet(l.to) && l.to !== l.who).forEach((l) => { const k = l.who + '>' + l.to; const r = R[k] || (R[k] = { a: l.who, b: l.to, v: 0, why: '' }); const d = /acces|offes|provoc/.test(l.tono || '') ? -0.35 : /concilian|commoss/.test(l.tono || '') ? 0.35 : /ironic|divert/.test(l.tono || '') ? 0.05 : 0; r.v = Math.max(-3, Math.min(3, r.v + d)); });
  // what they said they think (their own words, from the replies)
  Object.values(s.rel || {}).forEach((x) => { const k = x.a + '>' + x.b; R[k] = Object.assign(R[k] || { a: x.a, b: x.b }, { v: x.v, why: x.why }); });
  return Object.values(R).map((r) => Object.assign(r, { v: Math.round(r.v * 2) / 2 })).filter((r) => r.v !== 0 || r.why);
}
function tsReport(s) {
  const sec = []; const bets = tsBetsResult();
  sec.push({ title: 'La puntata', text: `«${s.title}», condotto da ${s.host.name} (stile ${s.style}, pubblico ${s.audience}). Ospiti: ${s.guests.map((g) => g.name + (g.role ? ', ' + g.role : '')).join('; ')}. Battute: ${s.lines.filter((l) => !l.sys).length}. Temi: ${s.topics.map((t) => t.t).join(' · ')}. ${s.winner ? 'Il pubblico ha premiato ' + s.winner + '.' : ''}${s.guests.some((g) => g.left) ? ' Hanno lasciato lo studio: ' + s.guests.filter((g) => g.left).map((g) => g.name).join(', ') + '.' : ''}${bets.out.length ? '\n\nScommesse: ' + bets.out.join('; ') + ` (${bets.pts} punti).` : ''}` });
  const best = tsBest(6); if (best.length) sec.push({ title: 'Le battute migliori', text: best.map((l) => `${l.who}: «${l.text}»${l.react ? ' (' + l.react + ')' : ''}`).join('\n') });
  if (s.report) sec.push({ title: 'La pagella', text: s.report.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
  if ((s.ear || []).length) sec.push({ title: 'La regia', text: s.ear.map((e) => `«${e.text}» → ${e.state}${e.why ? ' (' + e.why + ')' : ''}`).join('\n') });
  return { env: '📺 Talk show', title: s.title, subtitle: `Resoconto della puntata${s.series ? ' n. ' + s.series.n : ''} · conduce ${s.host.name}`, date: s.date, people: tsIndicators(s), relations: tsRelations(s), sections: sec,
    chapters: s.story ? [{ title: s.story.title, text: s.story.text }] : [], appendix: [{ title: 'Trascrizione', text: s.lines.map((l) => l.sys ? `[${l.text}]` : `${l.who} → ${l.to}${l.tono ? ' (' + l.tono + ')' : ''}: ${l.text}${l.react ? '  [' + l.react + ']' : ''}`).join('\n') }] };
}

/* ---------- island → report ---------- */
function isleReport(G) {
  const soc = G.social || []; const cnt = (n, kinds) => soc.filter((x) => kinds.includes(x.kind) && (x.who || []).includes(n)).length;
  const people = G.agents.map((a) => { const st = a.stats || {}; const said = soc.filter((x) => x.kind === 'parla' && (x.who || [])[0] === a.name).length;
    const days = a.alive ? G.day : (a.deathDay || G.day);
    return { name: a.name, role: `${a.sex === 'f' ? 'donna' : 'uomo'}, ${a.age} anni${a.temper ? ' · ' + a.temper : ''}`,
      badge: !a.alive ? '✝ ' + (a.deathCause || 'morto') + (a.deathDay ? ', giorno ' + a.deathDay : '') : a.departed ? '⛵ partito' : 'vivo',
      bars: [['Salute', st.hp || 0], ['Umore', st.umore || 0], ['Mente', st.mente || 0], ['Sazietà', st.sat || 0], ['Acqua', st.hyd || 0], ['Ansia', st.ansia || 0]],
      stats: [['giorni sull\'isola', days], ['parole agli altri', said], ['aiuti', cnt(a.name, ['aiuto'])], ['conflitti', cnt(a.name, ['conflitto'])], ['furti', cnt(a.name, ['furto'])], ['giochi', cnt(a.name, ['gioco'])], ['incontri', cnt(a.name, ['incontro'])]],
      note: (a.thoughts || []).slice(-1).map((t) => 'Ultimo pensiero: ' + t.text)[0] || '' }; });
  const relations = []; G.agents.forEach((a) => Object.entries(a.relations || {}).forEach(([b, txt]) => { if (b === a.name || !G.agents.some((o) => o.name === b)) return; const v = Math.max(-3, Math.min(3, Math.round(relScore(txt) * 2) / 2)); relations.push({ a: a.name, b, v, why: String(txt).slice(0, 160) }); }));
  const N = G.novel || {}; const chapters = Object.keys(N.chapters || {}).map(Number).sort((x, y) => x - y).map((d) => ({ title: N.chapters[d].title, text: N.chapters[d].text }));
  const sections = [{ title: 'L\'esperimento', text: `${G.agents.length} naufraghi, ${G.day} giorni. ${G.ended ? 'Esito: ' + G.ended + '.' : 'Esperimento in corso.'}` }].concat((G.socialDays || []).filter((d) => d.text).slice(-6).map((d) => ({ title: `Il gruppo, giorno ${d.day}`, text: d.text })));
  return { env: '🏝 L\'isola', title: N.title || 'L\'isola', subtitle: 'Resoconto dell\'esperimento · indicatori, relazioni' + (chapters.length ? ' e romanzo' : ''), date: new Date().toISOString(), people, relations, sections, chapters,
    appendix: [{ title: 'Cronaca', text: (G.chronicle || []).filter((c) => c.kind !== 'act').map((c) => `G${c.day} ${String(Math.floor(c.h)).padStart(2, '0')}:00  ${c.text}`).join('\n').slice(0, 120000) }] };
}
/* ---------- Venture → report ---------- */
/** Builds the shared report object from a Venture game: crew indicators, relations from the archive sheets, mission sections, novel, log. */
function ventureReport(G) {
  const cap = VENTURE.captain(G); const L = G.log; const by = (n, k) => L.filter((l) => l.kind === k && l.who === n).length;
  const people = G.crew.map((c) => { const rolls = G.rolls.filter((r) => r.who === c.name); const ok = rolls.filter((r) => r.ok).length; const lis = (G.lastListen || []).find((u) => u.nome === c.name);
    return { name: c.name, role: `${VENTURE.STATION_LABEL[c.station]} · ${c.age} anni${c.temper ? ' · ' + c.temper : ''}`, badge: c.dead ? '† morto' : c === cap ? '⭐ al comando' : c.injured ? '🩹 ferito' : 'in servizio',
      bars: rolls.length ? [['Azioni riuscite', Math.round(ok / rolls.length * 100)]] : [],
      stats: [['battute', by(c.name, 'line')], ['ordini dati', by(c.name, 'order')], ['obiezioni', by(c.name, 'object')], ['rifiuti', by(c.name, 'refuse')], ['azioni tentate', rolls.length], ['umore', c.mood || 'il solito'], ['accordo finale', lis ? lis.accordo : '—']],
      note: (L.filter((l) => l.kind === 'thought' && l.who === c.name).slice(-1)[0] || {}).text ? 'Ultimo pensiero: ' + L.filter((l) => l.kind === 'thought' && l.who === c.name).slice(-1)[0].text : '' }; });
  const relations = []; G.crew.forEach((c) => (c.relations || []).forEach((r) => { if (G.crew.some((x) => x.name === r.to) && r.to !== c.name) relations.push({ a: c.name, b: r.to, v: Math.max(-3, Math.min(3, c.trust && c.trust[r.to] != null ? c.trust[r.to] : +r.int || 0)), why: [r.type, r.view].filter(Boolean).join(': ').slice(0, 160) }); }));
  const R = G.report || {}; const N = G.novel || {}; const chapters = Object.keys(N.chapters || {}).map(Number).sort((a, b) => a - b).map((k) => ({ title: N.chapters[k].title, text: N.chapters[k].text }));
  const sh = G.ship; const sections = [{ title: 'La missione', text: `«${G.mission.title}». ${G.mission.fields.spunto || ''} Turni giocati: ${G.turn} di ~${G.maxTurns}. ${G.ended ? 'Esito: ' + G.ended.text + '.' : 'Missione in corso.'}` },
    { title: 'La nave', text: `Scafo ${sh.hull}/100 · morale ${sh.morale} · siluri ${sh.torpedoes} · navette ${sh.shuttles} · feriti ${sh.wounded + G.crew.filter((c) => c.injured).length} · morti ${sh.deaths || 0}. Sistemi non a posto: ${Object.entries(sh.systems).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ' ' + v).join(', ') || 'nessuno'}.` }];
  if (R.rapporto) sections.push({ title: 'Rapporto al Comando', text: R.rapporto }); if (R.confronto) sections.push({ title: 'Cosa credevano e cosa c\'era davvero', text: R.confronto });
  if (G.known.length) sections.push({ title: 'Accertato dall\'equipaggio', text: G.known.join('\n') });
  if (G.diary.length) sections.push({ title: 'Diario del capitano', text: G.diary.map((d) => `Turno ${d.t}: ${d.text}`).join('\n') });
  if (G.decisions.length) sections.push({ title: 'Decisioni chiave', text: G.decisions.slice(-30).join('\n') });
  const med = VENTURE.medals(G); if (med.length) sections.push({ title: 'Medaglie', text: med.map((m) => `${m.icon} ${m.name} (${m.to === 'nave' ? 'alla nave' : m.to}): ${m.why}`).join('\n') });
  const ag = G.crew.filter((c) => c.agenda); if (G.ended && ag.length) sections.push({ title: 'Agende segrete', text: ag.map((c) => { const v = ((G.report || {}).agende || []).find((x) => x.nome === c.name); return `${c.name}: ${c.agenda.text}${v ? (v.ok ? ' — riuscita' : ' — non riuscita') + (v.perche ? ': ' + v.perche : '') : ''}`; }).join('\n') });
  const cmd = G.log.filter((l) => l.kind === 'cmdask' || l.kind === 'cmdreply'); if (cmd.length) sections.push({ title: 'Consultazioni con il Comando', text: cmd.map((l) => `Turno ${l.t} · ${l.who}: ${l.text}`).join('\n') });
  sections.push({ title: 'Punteggio', text: `${VENTURE.score(G)} punti${(G.liveBets || []).some((b) => b.done) ? ` · scommesse vinte ${(G.liveBets || []).filter((b) => b.won).length} su ${(G.liveBets || []).filter((b) => b.done).length}` : ''}` });
  if (G.amend.length) sections.push({ title: 'Interventi della regia', text: G.amend.map((a) => `Turno ${a.t}: ${a.text} → ${a.effects}`).join('\n') });
  return { env: '🚀 La Venture', title: N.title || G.mission.title, subtitle: 'Resoconto della missione · equipaggio, relazioni' + (chapters.length ? ' e romanzo' : ''), date: new Date().toISOString(), people, relations, sections, chapters,
    appendix: [{ title: 'Registro del ponte', text: L.filter((l) => !l.hidden).map((l) => `T${l.t} ${l.who ? l.who + ': ' : ''}${l.text}`).join('\n').slice(0, 120000) }] };
}
/** Report of a novel: characters' arc, plan versus reality, honest reader, checks and interventions. Chapters are left out: the book is its own download. */
function romanzoReport(N) {
  const P = N.plan || { question: '', laws: [], stages: [], ending: { text: '' } }; const scene = (n) => N.log.filter((l) => l.kind === 'act' && l.who === n).length;
  const people = N.cast.map((c) => ({ name: c.name, role: `${c.role || 'comprimario'} · ${c.age} anni${c.temper ? ' · ' + c.temper : ''}`, badge: !c.alive ? '† cap. ' + c.died : c.late ? 'entrato al cap. ' + c.since : c.born ? 'nato nella storia' : 'vivo',
    bars: N.chapters.length ? [['Presenza nei capitoli', Math.round(N.chapters.filter((ch) => (ch.present || []).includes(c.name)).length / N.chapters.length * 100)]] : [],
    stats: [['scene', c.scenes || 0], ['battute', c.lines || 0], ['scelte', scene(c.name)], ['segreto', c.secret || '—']].concat(c.cause ? [['causa della morte', c.cause]] : []), note: c.lastThought ? 'Ultimo pensiero: ' + c.lastThought : '' }));
  const sections = [{ title: 'La storia', text: `${(ROMANZO.GENRES[N.setup.genre] || {}).name || ''} · ${N.chapters.length} capitoli, circa ${Math.round(N.chapters.reduce((t, c) => t + (c.words || 0), 0) / ROMANZO.WORDS_PER_PAGE)} pagine. ${N.status === 'ended' ? 'Romanzo concluso.' : 'Romanzo in corso.'}\nIdea: ${N.setup.idea}` },
    { title: 'Il piano e la realtà', text: [`Domanda centrale: ${P.question}`, P.laws.length ? 'Leggi: ' + P.laws.join(' · ') : '', ...P.stages.map((s, i) => `${s.reached ? '✓' : '✗'} Tappa ${i + 1}: ${s.fact}${s.reached ? ' (cap. ' + s.reached + ')' : ''}`), `Finale ${N.flags.endingChanged ? 'cambiato' : 'previsto'}: ${P.ending.text || '—'}`].filter(Boolean).join('\n') }];
  if (N.series) { const S = N.series; const st = S.plan && S.plan.steps.find((x) => x.n === S.n); sections.unshift({ title: 'La serie', text: `«${S.title}», volume ${S.n} di ${S.volumes} (${ROMANZO.SERIES_KINDS[S.kind].name}).${S.plan ? ' Filo: ' + S.plan.question + '.' : ''}${st ? ' Passo di questo volume: ' + st.fact + '.' : ''}${(S.previous || []).length ? '\nVolumi precedenti: ' + S.previous.map((b) => '«' + b.title + '»').join(', ') + '.' : ''}` }); }
  if (P.dossier) sections.push({ title: 'Il delitto', text: `Colpevole: ${P.dossier.culprit} · movente: ${P.dossier.motive} · metodo: ${P.dossier.method}\nIndizi: ${P.dossier.clues.map((c) => 'cap. ' + c.chapter + ' ' + c.text + (c.shown ? ' ✓' : '')).join('; ')}` });
  if (N.reader.length) sections.push({ title: 'Il lettore onesto', text: N.reader.map((r) => `Cap. ${r.ch}: «${r.guess}» (${r.sure}%)${r.bored.length ? ' · si annoia: ' + r.bored.join('; ') : ''}${r.lost.length ? ' · non capisce: ' + r.lost.join('; ') : ''}`).join('\n') });
  const pr = N.promises; if (pr.length) sections.push({ title: 'Promesse al lettore', text: `${pr.filter((p) => p.closed).length} mantenute su ${pr.length}.\n` + pr.map((p) => `${p.closed ? '✓' : '○'} ${p.text}${p.closed ? ' (cap. ' + p.opened + '→' + p.closed + ')' : ''}`).join('\n') });
  const fixed = N.checks.filter((k) => k.fixed); if (fixed.length) sections.push({ title: 'Correzioni dell\'editor', text: fixed.map((k) => `Cap. ${k.ch}: ${k.grave.join('; ')}`).join('\n') });
  if (N.quality) { const q = ROMANZO.qualitySummary(N.quality); const rv = N.quality.revision; sections.push({ title: 'Controllo della qualità', text: [`Lettore pignolo e rilettura finale: ${q.sentences} frasi corrette, ${q.rewrites} capitoli riscritti.`, rv ? `Revisione del testo: ${rv.fixed} frasi corrette, ${rv.rewrites} capitoli riscritti.` : '', q.threads.length ? 'Fili rimasti aperti: ' + q.threads.join('; ') : '', q.residual.length ? 'Da rivedere: ' + q.residual.map((r) => (r.ch ? 'cap. ' + r.ch + ': ' : '') + r.text).join('; ') : 'Nessun problema rimasto tra quelli che il controllo automatico sa trovare.'].filter(Boolean).join('\n') }); }
  const dir = N.log.filter((l) => l.kind === 'director' || l.kind === 'revise'); if (dir.length) sections.push({ title: 'Interventi e ritocchi', text: dir.map((l) => `Cap. ${l.ch}: ${l.text}`).join('\n') });
  return { env: '📖 Il romanzo', title: (N.novel && N.novel.title) || N.setup.title || 'Il romanzo', subtitle: 'Resoconto della scrittura · personaggi, piano, lettore', date: new Date().toISOString(), people, relations: [], sections, chapters: [],
    appendix: [{ title: 'Registro dell\'autore', text: N.log.filter((l) => l.kind !== 'plan' || N.status === 'ended').map((l) => `Cap. ${l.ch} ${l.who ? l.who + ': ' : ''}${l.text}`).join('\n').slice(0, 120000) }] };
}
function rpOpen(rep, fname, extra) {
  const el = funCard(`📊 Resoconto · ${esc(rep.title)}`, `${rpHtml(rep)}<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button id="rpPdfBtn" class="primary">📘 Scarica il resoconto (PDF)</button>${extra || ''}</div>`, true);
  if (window.__talkActive) el.style.zIndex = 70; if (window.__romanzoActive) el.style.zIndex = 85;
  el.querySelector('#rpPdfBtn').onclick = async (e) => { const b = e.target; b.disabled = true; b.textContent = '📘 Impagino…'; try { const { r, pages } = await rpPdf(typeof rep === 'function' ? rep() : rep, fname); if (r !== 'error') toastMsg(r === 'declined' ? 'Download annullato.' : `📘 Resoconto salvato (${pages} pagine).`); } catch (er) { toastMsg('⚠ Non riesco a creare il PDF: ' + (er && er.message || er)); } finally { b.disabled = false; b.textContent = '📘 Scarica il resoconto (PDF)'; } };
  return el;
}
