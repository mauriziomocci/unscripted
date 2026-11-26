/* ===== Talk show: what makes it alive. Studio chorus, bodies that react, show moments, the user as claque leader, twists, replay ===== */

/* ---------- the chorus: what slips out of people's mouths while someone else talks ---------- */
function tsChorus(line, ppl, out) {
  const s = TS.s; const now = performance.now(); const ch = [];
  ppl.forEach((p) => { const L = p.listen; if (!L) return; const o = TS.three && TS.three.P[p.name];
    if (o && L.gesto && !/niente/.test(L.gesto)) o.gest = { k: L.gesto, until: now + 5200 + Math.random() * 1500 };
    if (L.sbotta && L.sbotta.length > 1) ch.push({ n: p.name, t: L.sbotta }); });
  const crowd = String(out.voce_pubblico || '').trim().slice(0, 40);
  line.chorus = ch.slice(0, 3); if (crowd) line.crowdVoice = crowd;
  if (out.pubblico && /risat|applaus|fischi|ooh/.test(out.pubblico) && !line.react) line.react = String(out.pubblico).slice(0, 20);
  // shown while the line is still being said, a little after it starts, staggered like real voices
  if (TS.three && line.shown !== false) {
    line.chorus.forEach((c, i) => setTimeout(() => { if (TS.three) TS.three.murmur(c.n, c.t, 'p'); }, 500 + i * 650 + Math.random() * 500));
    if (crowd) setTimeout(() => { if (TS.three) TS.three.murmur(null, '👥 ' + crowd, 'crowd'); }, 900 + Math.random() * 900);
  }
}

/* ---------- bodies: gestures from the listening, standing up to rant or to point a finger ---------- */
function tsPose(n, o, me, ph, now) {
  const f = o.fig; if (!f) return; if (!o.seat) o.seat = f.root.position.clone();
  const s = TS.s; const p = tsGet(n); const g = o.gest && o.gest.until > now ? o.gest.k : '';
  const duel = s && s.duel && (s.duel.a === n || s.duel.b === n);
  const rant = me && p && p !== s.host && (p.fmt === 'sfogo' || /acces|offes/.test((TS.curLine && TS.curLine.tono) || ''));
  const stand = !o.host && (duel || rant || /si alza/.test(g));
  if (!o.host) { if (stand) { SC.posePerson(f, me ? 'talkstand' : 'idle', ph); f.root.position.set(0, 0, 0.95); } else f.root.position.copy(o.seat); }
  if (duel) { // both walk to the centre and face each other
    const mine = s.duel.a === n; const W = new THREE.Vector3(mine ? -0.4 : 2.6, 0.4, 2.6); const other = new THREE.Vector3(mine ? 2.6 : -0.4, 0.4, 2.6);
    o.duelPos = o.duelPos || f.root.position.clone(); const loc = o.grp.worldToLocal(W.clone()); o.duelPos.lerp(loc, 0.06); f.root.position.copy(o.duelPos); f.root.lookAt(other.x, f.root.getWorldPosition(new THREE.Vector3()).y, other.z); o.inDuel = true; }
  else if (o.inDuel) { o.inDuel = false; o.duelPos = null; f.root.rotation.set(0, 0, 0); }
  const { torso, head, armL, armR } = f;
  if (me) { // talking with the hands, more when heated
    const k = rant || duel ? 1.6 : 1; armR.rotation.x = -0.7 * k + Math.sin(ph * 5) * 0.35 * k; armR.rotation.z = 0.25; if (rant || duel) { armL.rotation.x = -0.6 + Math.sin(ph * 4 + 1) * 0.4; armL.rotation.z = -0.2; } return; }
  if (!g) return;
  if (/ride/.test(g)) { torso.rotation.x = -0.25 + Math.abs(Math.sin(ph * 12)) * 0.18; head.rotation.x = -0.35; armL.rotation.x = -0.7; armR.rotation.x = -0.7; }
  else if (/annuisce/.test(g)) head.rotation.x = 0.12 + Math.sin(ph * 6) * 0.22;
  else if (/scuote/.test(g)) head.rotation.y = Math.sin(ph * 9) * 0.5;
  else if (/punta/.test(g) || /si alza/.test(g)) { armR.rotation.x = -1.55; armR.rotation.z = 0.05 + Math.sin(ph * 3) * 0.05; head.rotation.x = -0.1; }
  else if (/braccia/.test(g)) { armL.rotation.x = -1.3; armL.rotation.z = -0.95; armR.rotation.x = -1.2; armR.rotation.z = 0.95; torso.rotation.y = 0.35; head.rotation.y = 0.3; }
  else if (/applaude/.test(g)) { const c = Math.sin(ph * 16); armL.rotation.x = -1.4; armR.rotation.x = -1.4; armL.rotation.z = -0.5 + c * 0.35; armR.rotation.z = 0.5 - c * 0.35; }
  else if (/sbuffa/.test(g)) { torso.rotation.x = 0.35; head.rotation.x = 0.45; head.rotation.y = Math.sin(ph * 1.5) * 0.2; }
  else if (/gira/.test(g)) { torso.rotation.y = 0.9; head.rotation.y = 0.7; }
  else if (/capelli/.test(g)) { armL.rotation.x = -2.8; armR.rotation.x = -2.8; armL.rotation.z = -0.5; armR.rotation.z = 0.5; head.rotation.x = 0.3; }
}
/* the most visible reaction to whoever is speaking: for the reverse shots */
function tsReactor(p) { const s = TS.s; if (!s || !TS.three) return null; const now = performance.now();
  const c = tsPeople().filter((x) => x !== p && !x.left).map((x) => { const o = TS.three.P[x.name]; return { x, w: (o && o.gest && o.gest.until > now && !/niente/.test(o.gest.k) ? 2 : 0) + (x.listen ? x.listen.voglia : 0) + Math.random() }; }).sort((a, b) => b.w - a.w)[0];
  return c && c.w >= 2.5 ? c.x : null; }

/* the studio's screen: shows the twists (old video, anonymous message, televote) */
function tsScreen(title, text) { const cv = TS.screenCv; if (!cv) return; const x = cv.getContext('2d'); x.fillStyle = '#0c1218'; x.fillRect(0, 0, 512, 288); x.fillStyle = '#c08a2e'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(title, 256, 52);
  x.fillStyle = '#f4f1ea'; x.font = '22px sans-serif'; const words = String(text || '').split(' '); let ln = '', y = 100; words.forEach((w) => { if (x.measureText(ln + w).width > 470) { x.fillText(ln, 256, y); ln = ''; y += 30; } ln += w + ' '; }); if (y < 280) x.fillText(ln, 256, y); if (TS.screenTex) TS.screenTex.needsUpdate = true; }

/* ---------- show moments ---------- */
function tsMoment(kind, a, b) {
  const s = TS.s; if (!s || s.ended) return;
  const say = (txt) => { s.dir.push({ t: s.lines.length, text: txt }); tsRenderDirector(); };
  if (kind === 'bruciapelo') { const g = tsGet(a); if (!g) return; s.cmds.push(`DOMANDA A BRUCIAPELO a ${g.name}: fagli adesso una domanda personale, scomoda e secca, di quelle che mettono in difficoltà (sul suo passato, una contraddizione, qualcosa che nasconde), e pretendi una risposta`); s.forceNext = g.name; say(`🎯 domanda a bruciapelo a ${g.name}`); toastMsg(`🎯 Il conduttore sta per fare una domanda a bruciapelo a ${g.name}.`); }
  if (kind === 'duello') { const x = tsGet(a), y = tsGet(b); if (!x || !y || x === y) { toastMsg('Scegli due ospiti diversi.'); return; } s.duel = { a: x.name, b: y.name, left: 6, next: x.name }; s.lines.push({ sys: true, text: `🥊 Faccia a faccia: ${x.name} contro ${y.name}, al centro dello studio`, seg: s.seg }); s.event = { text: `il conduttore ha chiamato ${x.name} e ${y.name} al centro dello studio per un FACCIA A FACCIA: si alzano e si fronteggiano, botta e risposta, gli altri guardano`, t: s.lines.length }; say(`🥊 faccia a faccia ${x.name} – ${y.name}`); }
  if (kind === 'televoto') tsTelevote();
  if (kind === 'fuorionda') { tsBreak('cmd'); tsOffAir(); }
  tsSave(); tsRenderAll(); if (!TS.running && !s.ended) { TS.running = true; tsLoop(); }
}
/* televote: no calls, the audience's mood (approval) plus a bit of chance */
function tsTelevote() {
  const s = TS.s; const g = s.guests.filter((x) => !x.left); if (!g.length) return;
  const w = g.map((x) => Math.max(3, 50 + (s.approval[x.name] || 0) * 0.8 + (Math.random() - 0.5) * 30)); const tot = w.reduce((a, b) => a + b, 0);
  const res = g.map((x, i) => ({ n: x.name, p: Math.round(w[i] / tot * 100) })).sort((a, b) => b.p - a.p);
  const txt = res.map((r) => `${r.n} ${r.p}%`).join(' · ');
  s.lines.push({ sys: true, text: `📊 Televoto «chi ha ragione stasera?»: ${txt}`, seg: s.seg }); s.event = { text: `il televoto da casa dice: ${txt}. Ha vinto ${res[0].n}, ultimo ${res[res.length - 1].n}`, t: s.lines.length };
  s.approval[res[0].n] = Math.min(100, (s.approval[res[0].n] || 0) + 10); s.applause = Math.min(100, s.applause + 15);
  tsScreen('TELEVOTO', res.slice(0, 4).map((r) => `${r.n} ${r.p}%`).join('   '));
  const el = document.createElement('div'); el.className = 'tsVote'; el.innerHTML = `<b>📊 TELEVOTO · chi ha ragione stasera?</b>${res.map((r) => `<div class="vr"><span>${esc(r.n)}</span><i><u style="width:0%" data-w="${r.p}"></u></i><em>${r.p}%</em></div>`).join('')}`;
  ($('tsCenter') || document.body).appendChild(el); setTimeout(() => el.querySelectorAll('u').forEach((u) => { u.style.width = u.dataset.w + '%'; }), 60); setTimeout(() => el.remove(), 7000);
  s.dir.push({ t: s.lines.length, text: `📊 televoto: ${txt}` });
}
/* off air: during the break they think the cameras are off and say what they really think */
async function tsOffAir() {
  const s = TS.s; const g = s.guests.filter((x) => !x.left); if (g.length < 2 || TS.offAirBusy) return; TS.offAirBusy = true;
  TS.breakUntil = Math.max(TS.breakUntil || 0, Date.now() + 16000);
  try {
    const who = g.map((x) => `- ${x.name}: ${(tsChar(x).short || '').slice(0, 140)}${x.listen && x.listen.pensa ? ' (pensa: «' + x.listen.pensa + '»)' : ''}`).join('\n');
    const out = await tsAsk(`Talk show «${s.title}». È partita la PUBBLICITÀ: gli ospiti credono che telecamere e microfoni siano spenti e parlano tra loro a bassa voce, senza filtri: pettegolezzi, cattiverie, alleanze, confessioni, battute che in onda non direbbero mai. Il conduttore ${s.host.name} è dietro le quinte.
Ospiti:\n${who}
Ultime battute in onda:\n${tsRecent(10)}
Scrivi 3 o 4 battute di questo fuori onda tra due o tre di loro, brevi (al massimo 20 parole), ognuna nel modo di parlare di chi la dice, coerenti con quello che è successo.
Rispondi SOLO con JSON: {"fuori_onda":[{"chi":"nome","a":"nome","dice":"..."}]}`, true);
    const L = (out && Array.isArray(out.fuori_onda) ? out.fuori_onda : []).slice(0, 4).filter((x) => tsGet(String(x.chi || '')));
    if (!L.length) return;
    s.lines.push({ sys: true, text: '🔇 FUORI ONDA (credono di non essere ripresi)', seg: s.seg });
    for (const x of L) { const p = tsGet(x.chi); const l = { who: p.name, to: tsGet(String(x.a || '')) ? tsGet(x.a).name : 'tutti', text: String(x.dice || '').slice(0, 200), tono: 'fuori onda', offair: true, seg: s.seg, t: s.lines.length };
      s.lines.push(l); tsRenderTranscript(); if (TS.three) { TS.three.murmur(p.name, '🔇 ' + l.text, 'off'); } await new Promise((r) => setTimeout(r, 2600 + l.text.length * 35)); }
    s.event = { text: `durante la pubblicità, a microfoni che credevano spenti, si sono detti: ${L.map((x) => `${x.chi} a ${x.a}: «${x.dice}»`).join(' ; ')}. Il pubblico in studio li ha sentiti`, t: s.lines.length };
    tsSave();
  } catch (e) { /* the break goes on silently */ } finally { TS.offAirBusy = false; }
}

/* ---------- the user as claque leader: the audience reacts to the last line ---------- */
function tsClaque(kind) {
  const s = TS.s; if (!s || s.ended) return; const l = s.lines.filter((x) => !x.sys && !x.director && !x.offair).slice(-1)[0]; if (!l) return;
  const K = { applausi: ['applausi scroscianti', 10, '👏👏👏'], risate: ['risate fragorose', 8, '😂 ahahah'], ooh: ['ooh!', 4, '😮 ooooh'], fischi: ['fischi e buu', -10, '👎 buuuu'], standing: ['standing ovation', 18, '🙌 BRAVO!'] }[kind]; if (!K) return;
  l.react = K[0]; l.claque = true; if (tsGet(l.who) && l.who !== s.host.name) s.approval[l.who] = Math.max(-100, Math.min(100, (s.approval[l.who] || 0) + K[1]));
  s.applause = Math.max(0, Math.min(100, s.applause + K[1] * 1.5));
  if (TS.three) { TS.three.murmur(null, K[2], 'crowd'); TS.lastLineAt = performance.now(); }
  s.dir.push({ t: s.lines.length, text: `📣 pubblico: ${K[0]} a ${l.who}` }); tsSave(); tsRenderAll();
}

/* ---------- twists with a voice: phone call, shouting spectator, the ex, anonymous message, old video ---------- */
const TWISTS = {
  tel: { label: '☎ AL TELEFONO', sub: 'telefonata in diretta', toast: '☎ Squilla il telefono in studio…', ev: 'Arriva una telefonata in diretta.',
    ask: (s, g) => `Arriva una TELEFONATA IN DIRETTA da un telespettatore inventato (nome, età, città: realistici e italiani), arrabbiato o appassionato con uno degli ospiti per qualcosa che ha detto davvero in puntata. Scrivi cosa dice al telefono: diretto, colorito, credibile, 2-3 frasi (massimo 50 parole).` },
  urlo: { label: '📣 DALLA PLATEA', sub: 'spettatore in sala', toast: '📣 Qualcuno si alza in platea…', ev: 'Uno spettatore in sala si alza e urla verso il palco.',
    ask: () => `Uno SPETTATORE IN SALA si alza e urla verso il palco, prima che la sicurezza lo faccia sedere. Scrivi cosa urla: una o due frasi brevi e colorite (massimo 25 parole), riferite a qualcosa detto davvero. In "chi" una descrizione breve, es. «un signore in terza fila».` },
  ex: { label: '💔 ENTRA IN STUDIO', sub: 'ospite a sorpresa', toast: '💔 Qualcuno entra dalla porta dello studio…', ev: 'Entra a sorpresa in studio l\'ex di uno degli ospiti.',
    ask: () => `Entra a sorpresa in studio l'EX (ex moglie, ex marito, ex fidanzato/a: scegli tu in modo credibile) di uno degli ospiti, con nome inventato. Si piazza davanti al suo ex e dice qualcosa di pungente e personale che lo mette in imbarazzo, coerente con il suo carattere e la sua storia. 2-3 frasi, massimo 50 parole. In "chi" nome e chi è (es. «Loredana, l'ex moglie di Benito»).` },
  anonimo: { label: '✉ MESSAGGIO ANONIMO', sub: 'letto in diretta', toast: '✉ In redazione è arrivato un messaggio anonimo…', ev: 'Arriva in redazione un messaggio anonimo su uno degli ospiti, e viene letto in diretta.',
    ask: () => `In redazione arriva un MESSAGGIO ANONIMO su uno degli ospiti, che viene letto in diretta: rivela o insinua qualcosa di imbarazzante e credibile su di lui (puoi ispirarti ai suoi punti deboli, senza inventare reati). 1-2 frasi, massimo 40 parole. In "chi" scrivi «Messaggio anonimo».` },
  video: { label: '📼 SUL MAXISCHERMO', sub: 'video d\'archivio', toast: '📼 Sul maxischermo parte un vecchio video…', ev: 'Sul maxischermo dello studio parte un vecchio video di uno degli ospiti.',
    ask: () => `Sul maxischermo parte un VECCHIO VIDEO di qualche anno fa in cui uno degli ospiti diceva il contrario di quello che sostiene stasera, o faceva una figura imbarazzante. Scrivi la frase che si sente nel video, detta da lui con le sue parole di allora (massimo 35 parole). In "chi" scrivi «Video del <anno>, <nome dell'ospite>».` },
};
async function tsTwist(kind, txt) {
  const s = TS.s; const T = TWISTS[kind]; if (!s || s.ended || !T) return;
  const g = s.guests.filter((x) => !x.left); toastMsg(T.toast);
  s.lines.push({ sys: true, text: '⚡ ' + (txt || T.ev), seg: s.seg }); s.event = { text: txt || T.ev, t: s.lines.length }; tsRenderAll();
  const prompt = `Talk show televisivo «${s.title}», in diretta. Conduttore: ${s.host.name}. Ospiti: ${g.map((x) => `${x.name} (${(tsChar(x).short || '').slice(0, 120)})`).join('; ')}.
Ultime battute:\n${tsRecent(10)}
${txt ? 'Indicazione della regia: ' + txt + '\n' : ''}${T.ask(s, g)}
Rispondi SOLO con JSON: {"chi":"...","a":"nome dell'ospite preso di mira","dice":"...","tono":"acceso|ironico|commosso|provocatorio"}`;
  try { const o = await tsAsk(prompt, true); const to = tsGet(String(o.a || '')); const who = String(o.chi || T.sub).slice(0, 70);
    if (kind === 'video' || kind === 'anonimo') tsScreen(kind === 'video' ? 'VIDEO D\'ARCHIVIO' : 'MESSAGGIO ANONIMO', `${to ? to.name + ': ' : ''}«${String(o.dice || '')}»`);
    s.pendingDir = { who, label: T.label, sub: T.sub, text: String(o.dice || '').slice(0, 300), to: to ? to.name : 'tutti', tono: String(o.tono || '') };
    s.dir.push({ t: s.lines.length, text: `${T.label}: ${who}` }); tsSave(); tsRenderDirector(); if (!TS.running && !s.ended) { TS.running = true; tsLoop(); } }
  catch (e) { toastMsg('⚠ Il colpo di scena non è partito: riprova.'); }
}

/* ---------- replay of the best moments at the end ---------- */
async function tsReplay() {
  const s = TS.s; if (!s || TS.replaying) return; const best = tsBest(5).sort((a, b) => (a.t || 0) - (b.t || 0)); if (!best.length) return;
  TS.replaying = true; const tag = document.createElement('div'); tag.className = 'tsReplayTag'; tag.textContent = '⏪ REPLAY · i momenti migliori'; ($('tsCenter') || document.body).appendChild(tag);
  try { for (let i = 0; i < best.length; i++) { tag.textContent = `⏪ REPLAY · ${i + 1}/${best.length}`; const l = Object.assign({}, best[i], { replay: true }); await tsShowLine(l); if (l.chorus && TS.three) l.chorus.forEach((c, k) => setTimeout(() => TS.three.murmur(c.n, c.t, 'p'), 300 + k * 500)); await new Promise((r) => setTimeout(r, 700)); } }
  finally { tag.remove(); TS.replaying = false; }
}

/* ---------- controls ---------- */
function tsFunFill() {
  const s = TS.s; if (!s || !$('tsMomTo')) return; const g = s.guests.filter((x) => !x.left).map((x) => `<option>${esc(x.name)}</option>`).join('');
  ['tsMomTo', 'tsDuelA', 'tsDuelB'].forEach((id, i) => { const el = $(id); const v = el.value; el.innerHTML = g; if (v) el.value = v; else if (id === 'tsDuelB' && el.options[1]) el.selectedIndex = 1; });
}
function tsFunWire(pl) {
  pl.querySelectorAll('[data-claque]').forEach((b) => { b.onclick = () => tsClaque(b.dataset.claque); });
  $('tsMomBru').onclick = () => tsMoment('bruciapelo', $('tsMomTo').value);
  $('tsMomDuel').onclick = () => tsMoment('duello', $('tsDuelA').value, $('tsDuelB').value);
  $('tsMomVote').onclick = () => tsMoment('televoto');
  $('tsMomOff').onclick = () => tsMoment('fuorionda');
  pl.querySelectorAll('[data-twist]').forEach((b) => { b.onclick = () => tsTwist(b.dataset.twist); });
}
