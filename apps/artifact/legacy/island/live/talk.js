
/* ===== Ambienti: Home page and the 📺 Talk show environment =====
   Talk show: a host and guests from the archive, a studio audience, the observer as director.
   Every line is one Claude call; audience reactions, applause and approval are computed here, at no cost. */

/* ---------- Home: the environments ---------- */
function homeEnsure() {
  if ($('homeView')) return;
  const v = document.createElement('div'); v.id = 'homeView'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Ambienti');
  v.innerHTML = `<div class="hvBox"><h1>Esperimento sociale</h1><p class="hvSub">I personaggi sono il patrimonio, gli ambienti sono palcoscenici. Scegli dove metterli.</p>
  <div class="hvGrid">
   <div class="envCard isle"><div class="envArt">🏝</div><h2>L'isola</h2><p>Naufraghi che devono sopravvivere. Tu osservi e intervieni come un dio.</p><p class="legend">1–8 personaggi · circa 6–8 chiamate a Claude per personaggio al giorno</p><p class="hvState" id="hvIsle"></p><button id="hvIsleGo" class="primary">Entra nell'isola</button></div>
   <div class="envCard talk"><div class="envArt">📺</div><h2>Il talk show</h2><p>Un salotto televisivo di tarda sera: un conduttore, ospiti diversissimi, il pubblico in sala. Tu sei il regista.</p><p class="legend">1 conduttore + 2–8 ospiti · 1 chiamata per battuta</p><p class="hvState" id="hvTalk"></p><button id="hvTalkGo" class="primary">Entra in studio</button></div>
   <div class="envCard ship"><div class="envArt">🚀</div><h2>La nave stellare Venture</h2><p>Il ponte di comando: un capitano, i suoi ufficiali, una missione che nessuno conosce davvero. Tu sei il Comando e il destino.</p><p class="legend">3–7 ufficiali · circa 5–8 chiamate a Claude per turno · ponte 3D in arrivo</p><p class="hvState" id="hvShip"></p><span class="hvBtns"><button id="hvShipGo" class="primary">🚀 Prepara la missione</button> <button id="hvShipCrew">👥 Scegli l'equipaggio</button> <button id="hvShipRank" title="Le missioni giocate a confronto">🏆 Classifica</button> <button id="hvShipLast" hidden title="Rivedi la missione conclusa: esito, resoconto, romanzo">📖 Ultima missione</button></span></div>
   <div class="envCard novel"><div class="envArt">📖</div><h2>Il romanzo</h2><p>Racconti un'idea e i personaggi; un autore la trasforma in un romanzo che segui capitolo per capitolo, e puoi intervenire.</p><p class="legend">da 10 a 120 pagine, anche in serie (cicli, storie in più volumi, saghe) · circa 4 chiamate a Claude per capitolo</p><p class="hvState" id="hvNovel"></p><span class="hvBtns"><button id="hvNovelGo" class="primary">✍ Nuovo romanzo</button> <button id="hvNovelResume" hidden>▶ Riprendi</button> <button id="hvNovelLast" hidden title="Riapri il romanzo concluso: libro, resoconto, seconda stesura, serie">📖 Ultimo romanzo</button> <button id="hvNovelSeries" hidden title="Le tue serie: continua con il prossimo volume">📚 Serie</button> <button id="hvNovelBooks" hidden>📘 Libri scritti</button></span></div>
   <div class="envCard arch"><div class="envArt">👥</div><h2>Archivio personaggi</h2><p>Crea, modifica, carica da file, disattiva o elimina i personaggi. Chi nasce in un ambiente finisce qui.</p><p class="hvState" id="hvArch"></p><button id="hvArchGo">Apri l'archivio</button></div>
  </div></div>`;
  document.body.appendChild(v);
  $('hvIsleGo').onclick = () => { homeHide(); };
  $('hvTalkGo').onclick = () => { homeHide(); tsOpenSetup(); };
  $('hvArchGo').onclick = () => { archOpen(); };
  $('hvShipRank').onclick = () => vShowRanking();
  $('hvShipLast').onclick = () => { const g = vLoadGame(); if (g) vPlay(g); };
  $('hvShipGo').onclick = () => { const g = vLoadGame(); if (g && !g.ended) vPlay(g); else vOpenSetup(); };
  $('hvShipCrew').onclick = () => { archOpen('futuro'); };
  $('hvNovelGo').onclick = () => { RM.N = null; rmOpenSetup(rmBlankSetup()); };
  $('hvNovelResume').onclick = () => { const n = rmLoad(); if (n) { if (n.status === 'planned') { RM.N = n; rmRenderPlan(); } else rmOpenWork(n); } };
  $('hvNovelBooks').onclick = () => rmShowBooks();
  $('hvNovelLast').onclick = () => { const n = rmLoad(); if (n) rmOpenWork(n); };
  $('hvNovelSeries').onclick = () => rmShowSeries();
}
function homeShow() { homeEnsure(); $('homeView').hidden = false; homeRefresh(); }
function homeHide() { if ($('homeView')) $('homeView').hidden = true; }
async function homeRefresh() {
  await ARCH.ready; const n = ARCH.chars.filter((c) => !c.disabled && c.status !== 'deceduto').length, d = ARCH.chars.filter((c) => c.status === 'deceduto').length;
  const nf = ARCH.chars.filter((c) => !c.disabled && c.status !== 'deceduto' && archEra(c) === 'futuro').length;
  const nr = ARCH.chars.filter((c) => !c.disabled && c.status !== 'deceduto' && archEra(c) === 'romanzo').length;
  setText($('hvArch'), `${n - nf - nr} del presente · ${nf} del futuro${nr ? ` · ${nr} dei romanzi` : ''}${d ? ` · ${d} deceduti` : ''}`);
  const cr = crewLoad().slots.length; const vg = vLoadGame(); const live = vg && !vg.ended;
  setText($('hvShip'), live ? `Missione in corso: «${vg.mission.title}», turno ${vg.turn} di ~${vg.maxTurns}` : nf ? `${cr ? `Equipaggio pronto: ${cr} person${cr === 1 ? 'a' : 'e'}` : 'Nessun equipaggio scelto'} · ${nf} ufficiali in archivio` : 'Nessun ufficiale: carica l\'equipaggio pronto');
  setText($('hvShipGo'), live ? '▶ Riprendi la missione' : '🚀 Prepara la missione'); $('hvShipLast').hidden = !(vg && vg.ended);
  if (vg && vg.ended && !live) setText($('hvShip'), `Ultima missione: «${vg.mission.title}», conclusa al turno ${vg.turn} · ${$('hvShip').textContent}`);
  const s = typeof saved !== 'undefined' && saved; setText($('hvIsle'), s ? (s.ended ? `Ultima partita finita al giorno ${s.day}` : `Partita in corso: giorno ${s.day}, ${s.agents.filter((a) => a.alive).length} in vita`) : 'Nessuna partita salvata');
  const nv = rmLoad(), bk = rmBooks(); const nlive = nv && nv.status !== 'ended' && nv.plan; $('hvNovelResume').hidden = !nlive; $('hvNovelBooks').hidden = !bk.length; $('hvNovelLast').hidden = !(nv && nv.status === 'ended'); $('hvNovelSeries').hidden = !rmSeries().length;
  setText($('hvNovel'), (nlive ? `In scrittura: «${nv.setup.title || 'senza titolo'}», capitolo ${nv.chapters.length} di ~${nv.target}` : 'Nessun romanzo in corso') + (bk.length ? ` · ${bk.length} libr${bk.length === 1 ? 'o' : 'i'} scritt${bk.length === 1 ? 'o' : 'i'}` : '') + (rmSeries().length ? ` · ${rmSeries().length} seri${rmSeries().length === 1 ? 'e' : 'e'}` : ''));
  const t = tsLoad(); setText($('hvTalk'), t ? (t.ended ? `Ultima puntata: «${t.title}», conclusa` : `Puntata in corso: «${t.title}», battuta ${t.lines.length}`) : 'Nessuna puntata ancora');
}
window.homeShow = homeShow;

/* ---------- talk show: session, storage ---------- */
const TS = { s: null, running: false, busy: false, next: null, sample: null, cool: 0, display: Promise.resolve(), raf: 0, three: null, cam: 'wide' };
const TS_KEY = 'talk-sessione';
function tsLoad() { try { return JSON.parse(localStorage.getItem(TS_KEY) || 'null'); } catch (e) { return null; } }
function tsSave() { if (!TS.s) return; try { localStorage.setItem(TS_KEY, JSON.stringify(TS.s)); } catch (e) { const s = Object.assign({}, TS.s, { lines: TS.s.lines.slice(-200) }); try { localStorage.setItem(TS_KEY, JSON.stringify(s)); } catch (e2) {} } }
const STYLES = { ironico: 'ironico e pungente: punzecchia gli ospiti con battute, ma tiene il controllo', provocatore: 'provocatore: mette gli ospiti uno contro l\'altro, cerca lo scontro e la frase forte', paterno: 'paterno: accoglie, ascolta, fa parlare tutti, stempera i conflitti', severo: 'severo: pretende risposte precise, interrompe chi divaga, non fa sconti a nessuno', neutro: 'neutro: fa domande chiare, lascia parlare, non prende posizione' };
const AUD = { caloroso: 'caloroso, applaude volentieri', tiepido: 'tiepido, difficile da conquistare', ostile: 'ostile, pronto a fischiare', diviso: 'diviso in due fazioni rumorose' };
const SHOW_NAMES = ['Parole a mezzanotte', 'Il salotto delle undici', 'Notte di opinioni', 'A tu per tu', 'Fuori onda', 'La poltrona rossa', 'Chi ha ragione?', 'Ultima parola'];
const TONE_ICON = { "d'accordo": '🤝', calmo: '😌', ironico: '😏', appassionato: '🔥', acceso: '😠', offeso: '😤', conciliante: '🕊', commosso: '🥲', triste: '🥲', annoiato: '😐', provocatorio: '😈', divertito: '😄' };

/* who a person is, for the prompts: the archive sheet, shortened; secrets and goals only for that person */
function tsSheet(c, own, present) {
  const cut = (t, n) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };
  const s = c.sections || {}; const P = [];
  if (c.short) P.push(c.short);
  [['identita', 'Chi sei', 300], ['storia', 'La tua storia', 500], ['carattere', 'Carattere', 400], ['valori', 'Convinzioni', 450], ['paure', 'Paure e punti deboli', 300], ['parlata', 'Come parli', 350], ['relazioni_stile', 'Come tratti gli altri', 300]].forEach(([k, l, n]) => { if (s[k]) P.push(`${l}: ${cut(s[k], n)}`); });
  if (c.temper) P.push(`Temperamento: ${c.temper}.`);
  if (own && (c.secrets || []).length) P.push(`Segreti che custodisci (nessuno li conosce: puoi difenderli, negarli o, se lo decidi tu, rivelarli): ${c.secrets.map((x) => cut(x, 220)).join(' | ')}`);
  if (own && (c.goals || []).length) P.push(`Cosa vuoi ottenere stasera, senza dirlo: ${c.goals.map((x) => cut(x, 200)).join(' | ')}`);
  const rel = (c.relations || []).map((r) => { const o = archGet(r.to); return o && present.includes(o.name) ? `${o.name} (${r.type}${r.view ? ': ' + cut(r.view, 140) : ''})` : null; }).filter(Boolean);
  if (own && rel.length) P.push(`Persone presenti che conosci già: ${rel.join('; ')}.`);
  return P.join('\n');
}
function tsPeople() { const s = TS.s; return [s.host].concat(s.guests); }
function tsGet(name) { return tsPeople().find((p) => normName(p.name) === normName(name)); }
function tsChar(p) { return archGet(p.archId) || { name: p.name, short: p.short || '', sections: {}, secrets: [], goals: [], relations: [] }; }

/* ---------- calling Claude: own queue with back-off on rate limits ---------- */
async function tsAsk(prompt, quick) {
  if (!TS.sample) { try { TS.sample = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { TS.sample = null; } }
  if (!TS.sample) throw new Error('Claude non disponibile: apri la pagina da claude.ai.');
  const opts = (quick || TS.s.model === 'haiku') ? { model: 'claude-haiku-5-5', modelTier: 'quick', cache: false } : { model: 'claude-sonnet-5-5', modelTier: 'default', effort: 'low', cache: false };
  for (let attempt = 0; ; attempt++) {
    while (Date.now() < TS.cool) { tsQueueText(`📺 Pubblicità · Claude chiede di rallentare: si riprende tra ${Math.ceil((TS.cool - Date.now()) / 1000)} s`); await new Promise((r) => setTimeout(r, 1000)); }
    try { return await TS.sample.json(prompt, opts); }
    catch (e) { if (e && e.code === 'rate_limited' && attempt < 5) { TS.cool = Date.now() + 15000 * 2 ** attempt; tsBreak('rate'); continue; } throw e; }
  }
}

/* ---------- the turn ---------- */
function tsRecent(n) { return TS.s.lines.filter((l) => !l.sys).slice(-n).map((l) => `${l.offair ? '(FUORI ONDA, credeva di non essere ripreso) ' : ''}${l.director ? (l.label && !/REGIA/.test(l.label) ? `${l.who} (${l.sub || 'voce da fuori'}, lo sentono tutti in studio)` : 'LA REGIA (voce fuori campo dalla cabina, la sentono tutti in studio)') : l.who}${l.to && l.to !== 'tutti' ? ' → ' + l.to : ''}${l.tono ? ' [' + l.tono + ']' : ''}: «${l.text}»${l.react ? ' (pubblico: ' + l.react + ')' : ''}${l.chorus && l.chorus.length ? ' [in sottofondo: ' + l.chorus.map((c) => `${c.n} «${c.t}»`).join(', ') + ']' : ''}`).join('\n'); }
function tsGuestList() { return TS.s.guests.filter((g) => !g.left).map((g) => `- ${g.name}, ${g.age} anni${g.role ? ', invitato come «' + g.role + '»' : ''}: ${tsChar(g).short || ''}`).join('\n'); }
function tsHostPrompt() {
  const s = TS.s; const h = s.host; const seg = s.topics[s.seg] || null; const present = tsPeople().map((p) => p.name);
  const pend = s.ear.filter((e) => e.state === 'attesa'); const cmds = s.cmds.splice(0);
  const due = seg ? (seg.q || []).filter((q) => !q.done) : [];
  const segLines = s.lines.filter((l) => l.seg === s.seg && !l.sys).length; const perSeg = Math.max(6, Math.round(s.maxLines / Math.max(1, s.topics.length)));
  const first = !s.lines.some((l) => !l.sys);
  return `Sei ${h.name}, ${h.age} anni, e stasera conduci il talk show televisivo «${s.title}», in onda in tarda serata da uno studio con il pubblico in sala: un salotto con ospiti diversissimi tra loro. È tutto vero e in diretta: non sei un'intelligenza artificiale e non lo dici mai.
CHI SEI:
${tsSheet(tsChar(h), true, present)}
${s.series && s.series.prev ? `PUNTATA PRECEDENTE (n. ${s.series.n - 1}), che tu ricordi bene: ${s.series.prev}\n` : ''}${s.isleNote ? `GLI OSPITI VENGONO DA UN NAUFRAGIO: ${s.isleNote}\n` : ''}${s.justIn ? `È APPENA ENTRATO IN STUDIO, A SORPRESA: ${s.justIn}. Accoglilo e presentalo al pubblico e agli altri ospiti.\n` : ''}STILE DI CONDUZIONE STASERA: ${STYLES[s.style] || STYLES.ironico}.
OSPITI IN STUDIO:
${tsGuestList()}
${(() => { const w = s.guests.filter((g) => !g.left && g.listen && g.listen.voglia >= 2).map((g) => `${g.name}${g.listen.voglia >= 3 ? ' (scalpita)' : ''}${g.listen.verso && g.listen.verso !== 'tutti' ? ' contro/verso ' + g.listen.verso : ''}`); const quiet = s.guests.filter((g) => !g.left && !(g.listen && g.listen.voglia >= 2)).map((g) => g.name); const m = s.modCue; s.modCue = null; return (w.length ? `IN STUDIO ADESSO VOGLIONO PARLARE: ${w.join(', ')}.${m && m.length ? ' Stanno parlando in troppi: MODERA, decidi tu a chi dare la parola e in che ordine, calma chi esagera.' : ''}\n` : '') + (quiet.length ? `Più silenziosi in questo momento: ${quiet.join(', ')} (coinvolgili se serve).\n` : '') + (s.host.listen && s.host.listen.pensa ? `Mentre ascoltavi hai pensato: «${s.host.listen.pensa}».\n` : ''); })()}
${s.guests.some((g) => g.left) ? 'Hanno lasciato lo studio: ' + s.guests.filter((g) => g.left).map((g) => g.name).join(', ') + '.\n' : ''}PUBBLICO: ${AUD[s.audience] || AUD.caloroso}; applausometro ora ${Math.round(s.applause)}/100.${s.audienceQ.length ? ` Una persona del pubblico ha una domanda che puoi leggere quando vuoi: «${s.audienceQ[0].text}»${s.audienceQ[0].to ? ' (per ' + s.audienceQ[0].to + ')' : ''}.` : ''}
${tsMindText(h)}${tsEventText()}SCALETTA: ${s.topics.map((t, i) => `${i === s.seg ? '▶ ' : ''}${i + 1}. ${t.t}`).join(' · ')}
${seg ? `Tema in corso: «${seg.t}» (${segLines} battute su circa ${perSeg}).${segLines >= perSeg ? ' È ora di chiudere questo tema e passare al prossimo (fine_segmento: true).' : ''}` : 'La scaletta è finita: chiudi la puntata, saluta ospiti e pubblico (fine_puntata: true).'}
${due.length ? 'Domande che devi fare in questo tema: ' + due.map((q) => `[${q.id}] a ${q.to || 'tutti'}: «${q.text}»`).join(' ; ') : ''}
${pend.length ? `IN AURICOLARE (lo senti solo tu, dalla regia; decidi tu se e come usarlo, ma è la regia: di solito la si ascolta): ${pend.map((e) => `[${e.id}]${e.now ? ' (SUBITO)' : ''} «${e.text}»`).join(' ; ')}` : ''}
${cmds.length ? 'LA REGIA CHIEDE ADESSO: ' + cmds.map((c) => ({ prossima: 'passa alla prossima domanda o al prossimo tema', incalza: 'incalza l\'ultimo che ha parlato, non mollarlo', calma: 'calma gli animi, riporta la discussione su toni civili', applauso: 'chiedi un applauso al pubblico', pubblicita: 'annuncia la pubblicità (pubblicita: true)' }[c] || c)).join('; ') : ''}
${first ? 'È L\'APERTURA: saluta il pubblico, presenta il programma e gli ospiti in modo brillante, poi fai la prima domanda.' : 'Ultime battute in studio:\n' + tsRecent(14)}
Rispondi con UNA battuta parlata, come in tv, naturale, nel tuo modo di parlare. ${tsFormat(h)} Fai domande, punzecchia, dai la parola, interrompi chi divaga. Quando gli ospiti discutono tra loro lasciali fare finché è interessante, mettili uno contro l'altro se serve, e intervieni quando si ripetono, degenerano o qualcuno resta escluso; puoi anche parlare sopra a chi divaga ("interrompe": true).
Rispondi SOLO con JSON: {"dice":"la tua battuta","a":"nome dell'ospite a cui ti rivolgi, oppure tutti, oppure pubblico","tono":"ironico|provocatorio|calmo|appassionato|acceso|conciliante|commosso|divertito","prossimo":"nome dell'ospite che deve rispondere adesso, oppure vuoto","auricolare":[{"id":numero,"esito":"usato|rimandato|ignorato","perche":"breve"}],"domanda_fatta":id di una domanda obbligatoria che hai appena fatto oppure null,"domanda_pubblico_letta":true|false,"fine_segmento":true|false,"pubblicita":true|false,"fine_puntata":true|false,"interrompe":true|false,"pensa":"cosa pensi davvero e non dici","opinioni":[{"su":"nome","voto":da -3 a 3,"perche":"in poche parole"}] (solo se la tua opinione su un ospite è cambiata, altrimenti [])}
Puoi andare avanti da solo: i suggerimenti della regia sono facoltativi, decidi tu ritmo, domande, a chi dare la parola e quando chiudere un tema.`;
}
function tsOpinionsOf(p) { const s = TS.s; const m = Object.values(s.rel || {}).filter((r) => r.a === p.name); return m.length ? `Cosa pensi adesso degli altri (da come è andata finora): ${m.map((r) => `${r.b} ${r.v > 0 ? '+' : ''}${r.v} (${r.why})`).join('; ')}.\n` : ''; }
function tsCueText(g) { const s = TS.s; const dl = s.duel && (s.duel.a === g.name || s.duel.b === g.name) ? `SEI IN PIEDI AL CENTRO DELLO STUDIO, FACCIA A FACCIA CON ${s.duel.a === g.name ? s.duel.b : s.duel.a}: botta e risposta, rivolgiti solo a lui/lei, guardalo in faccia, non mollare.\n` : ''; const c = s.cue && s.cue.who === g.name ? s.cue : null; const live = tsPeople().filter((p) => p !== g && p !== s.host && !p.left);
  const fr = live.filter((p) => tsFeel(g, p.name) >= 1).map((p) => p.name), en = live.filter((p) => tsFeel(g, p.name) <= -1).map((p) => p.name);
  let t = (fr.length ? `In studio ti senti vicino a: ${fr.join(', ')}. ` : '') + (en.length ? `Non sopporti: ${en.join(', ')}. ` : '');
  if (c) t += `\nNON SEI STATO INTERPELLATO, MA INTERVIENI: ${c.b ? `${c.a} e ${c.b} stanno discutendo` : `${c.a} ha appena detto la sua`}. Entra nella discussione come faresti tu: ${c.side ? `difendi ${c.side}` : c.against ? `attacca ${c.against}` : 'prendi posizione (dai ragione a uno, dai torto all\'altro, o smonta entrambi)'}, rivolgendoti a qualcuno di loro per nome. Puoi anche interromperli.`;
  return dl + (t ? t + '\n' : ''); }
/* rhythm: real talk shows mix one-liners, normal answers and the odd rant; heated moments get shorter and overlap */
function tsFormat(p) { const s = TS.s; const last = s.lines.filter((l) => !l.sys).slice(-1)[0]; const hot = last && /acces|offes|provoc/.test(last.tono || ''); const urge = p.listen && p.listen.voglia >= 3;
  const r = Math.random(); let f;
  if (p === s.host) f = r < 0.35 ? 'frecciata' : r < 0.9 ? 'normale' : 'lunga';
  else if (hot || urge) f = r < 0.6 ? 'frecciata' : r < 0.9 ? 'normale' : 'sfogo';
  else f = r < 0.35 ? 'frecciata' : r < 0.85 ? 'normale' : 'sfogo';
  p.fmt = f;
  const F = { frecciata: 'QUESTA VOLTA: una FRECCIATA secca, da 3 a 12 parole al massimo (una battuta, una presa in giro, un\'esclamazione, una domanda tagliente).', normale: 'QUESTA VOLTA: una risposta normale, 1-2 frasi, al massimo 35 parole.', sfogo: 'QUESTA VOLTA: uno SFOGO, ti lasci andare: 3-4 frasi, al massimo 70 parole, con passione.', lunga: 'QUESTA VOLTA: puoi articolare un po\' di più, 2-3 frasi, al massimo 50 parole.' };
  return F[f] + ' Sii vivo e divertente come in un talk show vero, se è nel tuo carattere: battute, ironia, sarcasmo, soprannomi agli altri, esempi concreti e coloriti, riprendi cose dette prima (anche per rinfacciarle). Niente frasi fatte, niente discorsi da comizio, niente "con tutto il rispetto".'; }
function tsGuestPrompt(g) {
  const s = TS.s; const present = tsPeople().map((p) => p.name); const c = tsChar(g);
  const last = s.lines.filter((l) => !l.sys).slice(-1)[0];
  const others = tsPeople().filter((p) => p !== g && !p.left).map((p) => `${p.name}${p === s.host ? ' (il conduttore)' : ''}: ${tsChar(p).short || ''}`).join('\n');
  return `Sei ${g.name}, ${g.age} anni, ospite stasera in studio al talk show televisivo «${s.title}», con il pubblico in sala. È tutto vero e in diretta: non sei un'intelligenza artificiale e non lo dici mai.
CHI SEI:
${tsSheet(c, true, present)}
${g.role ? `Ti hanno invitato come: ${g.role}.` : ''}${g.memory && (c.lives || []).length ? `\nRicordi della tua vita: ${(c.lives || []).map((l) => l.death ? 'sei sopravvissuto a molto' : '').filter(Boolean).join('; ')}` : ''}
${s.series && s.series.prev && g.memory ? `Ricordi la puntata precedente: ${s.series.prev}\n` : ''}${(s.isleMem || {})[g.archId] ? `RICORDI DELL'ISOLA (li hai vissuti davvero): ${s.isleMem[g.archId]}\n` : ''}${g.surprise && !g.spoke ? 'Sei appena entrato in studio a sorpresa: fatti notare.\n' : ''}IN STUDIO CON TE:
${others}
${tsOpinionsOf(g)}Il tuo gradimento presso il pubblico finora: ${Math.round(s.approval[g.name] || 0)} (da −100 a +100).
${tsMindText(g)}${tsEventText()}Ultime battute in studio:
${tsRecent(14)}
${g.listen && g.listen.pensa ? `Mentre ascoltavi hai pensato: «${g.listen.pensa}»${g.listen.voglia >= 3 ? ' e non riesci a trattenerti' : ''}.\n` : ''}${tsCueText(g)}${last && normName(last.to) === normName(g.name) ? `${last.who} si è appena rivolto a te: tocca a te rispondere.` : (last && last.who !== s.host.name ? `Ha appena parlato ${last.who}${last.to && last.to !== 'tutti' ? ' rivolto a ' + last.to : ''}: puoi rispondergli direttamente, o rivolgerti a qualcun altro.` : 'Prendi la parola adesso.')}
È un talk show vero: non parli solo con il conduttore. Rispondi direttamente agli altri ospiti chiamandoli per nome, ribatti a chi ti ha attaccato, dai ragione a chi la pensa come te (anche schierandoti con lui contro un altro), contraddici, prendi in giro, parla sopra a chi sta parlando se ti scalda ("interrompe": true, e allora la battuta è breve e secca, come quando ci si accavalla). Rispondi come faresti davvero tu, con le tue convinzioni (anche discutibili, anche sbagliate) e il tuo modo di parlare: puoi attaccare, difenderti, fare battute, cercare l'applauso, offenderti, tacere o alzarti e andartene. Niente prediche, niente buonismo finto.
${tsFormat(g)}
Rispondi SOLO con JSON: {"dice":"la tua battuta (vuota se taci)","a":"nome di chi ti rivolgi, oppure tutti, oppure pubblico","tono":"calmo|ironico|appassionato|acceso|offeso|conciliante|d'accordo|commosso|annoiato|provocatorio","vuole_parlare":true|false,"se_ne_va":true|false,"interrompe":true|false,"segreto":"tenuto|a_rischio|rivelato","pensa":"cosa pensi davvero e non dici","opinioni":[{"su":"nome di qualcuno in studio","voto":da -3 a 3,"perche":"in poche parole"}] (solo se quello che pensi di qualcuno è cambiato o si è appena formato, altrimenti [])}`;
}
/* ---------- everyone listens: after each line, one light call gives every person in studio a thought and an urge to speak ---------- */
async function tsListen(line) {
  const s = TS.s; if (!s || s.listen === false || !line || line.sys) return; const ppl = tsPeople().filter((p) => !p.left && p.name !== line.who); if (!ppl.length) return;
  const cut = (x, n) => { x = String(x || ''); return x.length > n ? x.slice(0, n) + '…' : x; };
  const who = ppl.map((p) => { const c = tsChar(p); const live = tsPeople().filter((o) => o !== p && !o.left); const fr = live.filter((o) => tsFeel(p, o.name) >= 1).map((o) => o.name), en = live.filter((o) => tsFeel(p, o.name) <= -1).map((o) => o.name);
    return `- ${p.name}${p === s.host ? ' (IL CONDUTTORE: modera, decide i tempi)' : ''}: ${cut(c.short, 160)} Temperamento: ${c.temper || '—'}. Convinzioni: ${cut((c.sections || {}).valori, 220)}${fr.length ? ' Gli stanno simpatici: ' + fr.join(', ') + '.' : ''}${en.length ? ' Non sopporta: ' + en.join(', ') + '.' : ''}`; }).join('\n');
  const prompt = `Studio di un talk show televisivo, «${s.title}». Tutti ascoltano quello che viene detto e reagiscono dentro di sé, ciascuno secondo il proprio carattere e le proprie convinzioni.
Ultime battute:\n${tsRecent(6)}
${tsEventText()}È APPENA STATO DETTO, da ${line.who}${line.to && line.to !== 'tutti' ? ' a ' + line.to : ''}${line.tono ? ' (' + line.tono + ')' : ''}: «${line.text}»
Chi ascolta:\n${who}
Per ognuno di loro: cosa pensa in questo momento (una frase, nella sua testa, nel suo modo di parlare), quanta voglia ha di intervenire adesso (0 = nessuna, 1 = poca, 2 = vuole dire la sua, 3 = non si trattiene, sta per interrompere), verso chi rivolgerebbe la parola e se è d'accordo o no con ${line.who}. Sii realistico e vario, NON tutti fremono: di solito solo una o due persone hanno voglia 2-3 (chi è chiamato in causa, chi ha convinzioni opposte o un conto in sospeso), gli altri 0-1. Per ognuno indica anche cosa gli SCAPPA DI BOCCA ad alta voce mentre l'altro parla ("sbotta": un'esclamazione di 1-5 parole come in un vero talk show, «Ma va'!», «Bravo!», «Sì, vabbè…», «Vergogna!», «Ahahah», oppure vuoto se sta zitto: al massimo 2-3 persone sbottano) e il gesto che fa ("gesto"). Il conduttore ha voglia alta quando bisogna moderare (troppi vogliono parlare, toni esagerati, qualcuno escluso, si va fuori tema).
Indica infine cosa fa il PUBBLICO in sala ("pubblico": risate|applausi|mormorio|fischi|ooh|silenzio) ed eventualmente una voce dalla platea ("voce_pubblico": 1-5 parole, oppure vuoto).
Rispondi SOLO con JSON: {"ascolto":[{"nome":"...","pensa":"...","voglia":0-3,"verso":"nome o tutti","posizione":"d'accordo|contrario|indifferente","sbotta":"... oppure vuoto","gesto":"niente|ride|annuisce|scuote la testa|si alza e punta il dito|braccia incrociate|applaude|sbuffa|si gira dall'altra parte|mani nei capelli"}],"pubblico":"...","voce_pubblico":"..."}`;
  let out = null; try { out = await tsAsk(prompt, true); } catch (e) { return; }
  (out && Array.isArray(out.ascolto) ? out.ascolto : []).forEach((r) => { const p = tsGet(String(r.nome || '')); if (!p || p.left || p.name === line.who) return; const v = Math.max(0, Math.min(3, Math.round(+r.voglia || 0)));
    p.listen = { t: s.lines.length, pensa: String(r.pensa || '').slice(0, 200), voglia: v, verso: String(r.verso || '').slice(0, 40), pos: String(r.posizione || '').slice(0, 15), su: line.who, sbotta: String(r.sbotta || '').trim().slice(0, 50), gesto: String(r.gesto || '').toLowerCase() }; if (p !== s.host) p.hand = v >= 2; });
  tsChorus(line, ppl.filter((p) => p.listen && p.listen.su === line.who && p.listen.t === s.lines.length), out || {});
  line.listen = ppl.filter((p) => p.listen && p.listen.su === line.who && p.listen.t === s.lines.length).map((p) => ({ n: p.name, pensa: p.listen.pensa, v: p.listen.voglia, pos: p.listen.pos }));
  tsSave(); tsRenderChips(); if (typeof tsRenderTranscript === 'function') tsRenderTranscript();
}
/* how strongly g feels about person n: opinions formed in studio first, then the archive relations */
function tsFeel(g, n) { const s = TS.s; const r = (s.rel || {})[g.name + '>' + n]; if (r) return r.v; const c = tsChar(g); const o = (c.relations || []).find((x) => { const z = archGet(x.to); return z && z.name === n; }); return o ? (o.int || 0) : 0; }
function tsPickNext(last) {
  const s = TS.s; const live = s.guests.filter((g) => !g.left); s.cue = null;
  if (!last || !live.length) return s.host;
  if (s.forceNext && last.who === s.host.name) { const fg = tsGet(s.forceNext); s.forceNext = null; if (fg && !fg.left) return fg; }
  if (s.duel && !last.director) { if (s.duel.left <= 0 || !tsGet(s.duel.a) || !tsGet(s.duel.b)) { s.lines.push({ sys: true, text: `🥊 Fine del faccia a faccia tra ${s.duel.a} e ${s.duel.b}: tornano a sedersi`, seg: s.seg }); s.duel = null; return s.host; } const nx = last.who === s.duel.a ? s.duel.b : s.duel.a; s.duel.left--; return tsGet(nx); }
  if (last.director) { const tg = tsGet(last.to || ''); if (tg && !tg.left) return tg; const u = live.filter((g) => g.listen && g.listen.voglia >= 2).sort((a, b) => b.listen.voglia - a.listen.voglia)[0]; return u && Math.random() < 0.6 ? u : s.host; }
  const G = s.lines.filter((l) => !l.sys); const prev = G[G.length - 2];
  if (last.who === s.host.name) { const g = tsGet(last.next || '') || tsGet(last.to || ''); if (g && g !== s.host && !g.left) return g; return live.slice().sort((a, b) => (a.spoke || 0) - (b.spoke || 0))[0]; }
  const streak = (() => { let n = 0; for (let i = G.length - 1; i >= 0; i--) { if (G[i].who === s.host.name) break; n++; } return n; })();
  if (s.cmds.length || s.ear.some((e) => e.state === 'attesa' && e.now)) return s.host;
  const hot = /acces|offes|provoc|appassion/.test(last.tono || ''); const cap = s.style === 'provocatore' ? 8 : hot ? 7 : 5;
  if (streak >= cap) return s.host;
  // the two people currently going at it (the speaker and the one before, or the one addressed)
  const other = tsGet(last.to || '') && last.to !== s.host.name ? last.to : prev && prev.who !== s.host.name ? prev.who : null;
  const pair = [last.who, other].filter(Boolean);
  const duelLen = (() => { let n = 0; for (let i = G.length - 1; i >= 0 && n < 6; i--) { if (pair.includes(G[i].who) && G[i].who !== s.host.name) n++; else break; } return n; })();
  const third = live.filter((g) => !pair.includes(g.name));
  const silent = (g) => { let k = 0; for (let i = G.length - 1; i >= 0 && G[i].who !== g.name; i--) k++; return k; };
  const urge = (g) => (g.listen && g.listen.su === last.who ? g.listen.voglia : 0);
  const eager = live.filter((g) => g.name !== last.who && urge(g) >= 2); const hl = s.host.listen && s.host.listen.su === last.who ? s.host.listen.voglia : 0;
  if (eager.length >= 3 && Math.random() < 0.55 || (hl >= 3 && streak >= 2) || (hl >= 2 && streak >= 4)) { s.modCue = eager.map((g) => g.name); return s.host; }
  const score = (g) => urge(g) * 2.2 + (g.listen && g.listen.su === last.who && g.listen.verso && [last.who, other].includes(g.listen.verso) ? 0.8 : 0) + scoreH(g);
  const scoreH = (g) => { const fa = tsFeel(g, last.who), fb = other ? tsFeel(g, other) : 0; const named = String(last.text || '').toLowerCase().includes(g.name.toLowerCase().split(' ')[0]) ? 3 : 0;
    return Math.abs(fa) * 1.1 + Math.abs(fb) * 0.8 + Math.abs(fa - fb) * 0.6 + named + (g.hand ? 2.5 : 0) + Math.min(3, silent(g) / 3) + (hot ? 0.8 : 0) + Math.random() * 2; };
  const best = third.map((g) => ({ g, w: score(g) })).sort((a, b) => b.w - a.w)[0];
  const top = live.filter((g) => g.name !== last.who).map((g) => ({ g, w: score(g) })).sort((a, b) => b.w - a.w)[0];
  if (top && urge(top.g) >= 3 && Math.random() < 0.75) { s.cue = { who: top.g.name, a: last.who, b: other, urge: 3 }; return top.g; }
  // a third voice breaks into a two-way exchange: the longer the duel, the likelier
  const pThird = duelLen >= 3 ? 0.85 : duelLen >= 2 ? 0.6 : hot ? 0.45 : 0.3;
  if (best && Math.random() < pThird) { const g = best.g; const fa = tsFeel(g, last.who), fb = other ? tsFeel(g, other) : 0;
    s.cue = { who: g.name, a: last.who, b: other, side: fa >= 1 && fa > fb ? last.who : fb >= 1 && fb > fa ? other : null, against: fa <= -1 && fa < fb ? last.who : fb <= -1 && fb < fa ? other : null }; return g; }
  const addressed = tsGet(last.to || ''); if (addressed && addressed !== s.host && !addressed.left && addressed.name !== last.who && duelLen < 4) return addressed;
  if (best && Math.random() < 0.5) { s.cue = { who: best.g.name, a: last.who, b: other }; return best.g; }
  return s.host;
}
async function tsTurn() {
  const s = TS.s; const last = s.lines.filter((l) => !l.sys).slice(-1)[0]; const who = tsPickNext(last);
  const isHost = who === s.host; who.thinking = Date.now(); tsRenderChips(); tsQueueText();
  let out = null; try { out = await tsAsk(isHost ? tsHostPrompt() : tsGuestPrompt(who)); } catch (e) { who.thinking = 0; tsQueueText(); throw e; }
  who.thinking = 0; who.whisper = null;
  out = out || {}; const text = String(out.dice || '').trim().slice(0, 600); const to = String(out.a || 'tutti').trim(); const tono = String(out.tono || '').toLowerCase().slice(0, 20);
  const line = { who: who.name, to: tsGet(to) ? tsGet(to).name : /pubblic/i.test(to) ? 'pubblico' : 'tutti', text: text || '(resta in silenzio)', tono, seg: s.seg, host: isHost, t: s.lines.length, think: String(out.pensa || '').slice(0, 300), next: isHost ? String(out.prossimo || '') : '' };
  if (isHost) { s.justIn = '';
    (Array.isArray(out.auricolare) ? out.auricolare : []).forEach((r) => { const e = s.ear.find((x) => x.id === +r.id); if (e && e.state === 'attesa' && /usat|riman|ignor/.test(r.esito || '')) { e.state = /usat/.test(r.esito) ? 'usato' : /riman/.test(r.esito) ? 'rimandato' : 'ignorato'; e.why = String(r.perche || '').slice(0, 160); e.at = s.lines.length; if (e.state !== 'rimandato') {} else e.state = 'attesa'; line.ear = true; } });
    const seg = s.topics[s.seg]; if (seg && out.domanda_fatta != null) { const q = (seg.q || []).find((x) => x.id === +out.domanda_fatta); if (q) q.done = true; }
    if (out.domanda_pubblico_letta && s.audienceQ.length) { s.audienceQ.shift(); }
  } else {
    who.spoke = (who.spoke || 0) + 1; who.hand = !!out.vuole_parlare; who.mood = tono;
    if (out.segreto && /rischio|rivel/.test(out.segreto)) { who.secret = /rivel/.test(out.segreto) ? 'rivelato' : 'a rischio'; line.secret = who.secret; }
  }
  (Array.isArray(out.opinioni) ? out.opinioni : []).slice(0, 3).forEach((o) => { const t = tsGet(String(o && o.su || '')); const v = Math.max(-3, Math.min(3, Math.round(+o.voto))); if (!t || t === who || isNaN(v)) return; s.rel = s.rel || {}; const k = who.name + '>' + t.name; const prev = s.rel[k]; s.rel[k] = { a: who.name, b: t.name, v, why: String(o.perche || '').slice(0, 160), t: s.lines.length }; if (!prev || prev.v !== v) line.op = (line.op || []).concat([`${t.name} ${prev ? (v > prev.v ? '↑' : '↓') : ''}${v > 0 ? '+' : ''}${v}`]); });
  if ((out.interrompe === true || out.interrompe === 'true') && last && last.who !== who.name) line.interrupt = last.who;
  s.lines.push(line); tsReact(line, who);
  if (!isHost && (out.se_ne_va === true || out.se_ne_va === 'true')) { who.left = true; s.lines.push({ sys: true, text: `🚪 ${who.name} si alza e lascia lo studio.`, seg: s.seg }); }
  if (isHost && out.fine_segmento) { s.seg++; s.lines.push({ sys: true, text: s.topics[s.seg] ? `▶ Nuovo tema: «${s.topics[s.seg].t}»` : '▶ Scaletta finita: chiusura', seg: s.seg }); }
  if (isHost && out.pubblicita) tsBreak('cmd');
  const spoken = s.lines.filter((l) => !l.sys).length;
  if (isHost && (out.fine_puntata || (spoken >= s.maxLines && s.seg >= s.topics.length))) tsEnd();
  else if (spoken >= s.maxLines + 4 && !isHost) { s.seg = s.topics.length; }
  tsSave(); return line;
}
function tsReact(line, who) { // the studio reacts (code, no calls): applause, laughs, murmurs, boos
  const s = TS.s; const t = line.tono || ''; const host = line.host; let r = '', d = 0;
  const hot = /acces|offes|provoc/.test(t), fun = /ironic|divert/.test(t), warm = /appassion|commoss|concilian|accordo/.test(t);
  const mood = s.audience; const rnd = Math.random();
  if (line.text === '(resta in silenzio)') { r = 'brusio'; d = -3; }
  else if (hot) { if (mood === 'ostile' || (mood === 'diviso' && rnd < 0.5) || rnd < 0.25) { r = 'fischi'; d = -8; } else { r = 'ooh!'; d = 4; } }
  else if (fun) { r = rnd < 0.7 ? 'risate' : 'qualche risata'; d = 6; }
  else if (warm) { r = mood === 'tiepido' && rnd < 0.5 ? 'applauso timido' : 'applausi'; d = 8; }
  else if (/annoiat/.test(t)) { r = 'brusio'; d = -4; }
  else { r = rnd < 0.35 ? 'qualche applauso' : ''; d = r ? 2 : 0; }
  if (mood === 'caloroso' && d > 0) d += 2; if (mood === 'ostile' && d > 0) d = Math.round(d / 2);
  line.react = r; s.applause = Math.max(0, Math.min(100, s.applause * 0.85 + (50 + d * 4) * 0.15 + d));
  if (!host) s.approval[who.name] = Math.max(-100, Math.min(100, (s.approval[who.name] || 0) + d));
}
function tsBreak(why) { if (why === 'cmd' && TS.s && Math.random() < 0.7) setTimeout(() => tsOffAir(), 300); TS.breakUntil = Date.now() + (why === 'rate' ? Math.max(6000, TS.cool - Date.now()) : 7000); if (TS.s) TS.s.lines.push({ sys: true, text: why === 'rate' ? '📺 Pubblicità (Claude chiede una pausa)' : '📺 Pubblicità', seg: TS.s.seg }); tsRenderTranscript(); }
function tsEnd() {
  const s = TS.s; s.ended = true; TS.running = false;
  const rank = s.guests.slice().sort((a, b) => (s.approval[b.name] || 0) - (s.approval[a.name] || 0));
  s.winner = rank[0] ? rank[0].name : ''; s.lines.push({ sys: true, text: `🏁 Fine della puntata. Il pubblico ha premiato ${s.winner || 'nessuno'}.`, seg: s.seg });
  tsPeople().forEach((p) => { const c = archGet(p.archId); if (c) { const key = `talk:${s.id}`; if (!(c.sessions || []).includes(key)) { c.sessions = (c.sessions || []).concat([key]); archSave(c, `puntata «${s.title}»`); } } });
  tsSave(); tsRenderAll(); setTimeout(tsEndCard, 1500);
}
async function tsLoop() {
  if (TS.loopOn) return; TS.loopOn = true;
  try {
    while (TS.running && TS.s && !TS.s.ended) {
      if (TS.breakUntil && Date.now() < TS.breakUntil) { tsQueueText(`📺 Pubblicità · si riprende tra ${Math.ceil((TS.breakUntil - Date.now()) / 1000)} s`); await new Promise((r) => setTimeout(r, 500)); continue; }
      if (TS.s.pendingGuest) tsGuestEnters();
      let line;
      if (TS.s.pendingDir) { const d = TS.s.pendingDir; TS.s.pendingDir = null; const dl = { who: d.who || 'La regia', label: d.label || '📢 LA REGIA', sub: d.sub || 'voce fuori campo', to: d.to, text: d.text, tono: d.tono || '', director: true, seg: TS.s.seg, t: TS.s.lines.length }; TS.s.lines.push(dl); tsSave();
        await TS.display; TS.display = tsShowLine(dl); if (TS.s.listen !== false) TS.listenP = tsListen(dl); await new Promise((r) => setTimeout(r, 400)); }
      if (TS.listenP) { await Promise.race([TS.listenP, new Promise((r) => setTimeout(r, 15000))]); TS.listenP = null; }
      try { line = await tsTurn(); } catch (e) { TS.running = false; toastMsg('⚠ ' + (e && e.message ? e.message : 'Claude non risponde') + ' · Puntata in pausa: riprendi con ▶.'); break; }
      if (line.interrupt && TS.cutCurrent) { const wait = Math.max(0, (TS.curStart || 0) + (TS.curMin || 1500) - performance.now()); await new Promise((r) => setTimeout(r, wait)); if (TS.cutCurrent) TS.cutCurrent(); }
      if (TS.s.listen !== false) TS.listenP = tsListen(line);
      await TS.display; TS.display = tsShowLine(line); // the next line is requested while this one is still being "spoken"
      await new Promise((r) => setTimeout(r, 400));
    }
  } finally { TS.loopOn = false; tsRenderAll(); }
}

/* ---------- director: earpiece, commands, audience questions, inner voice ---------- */
function tsEar(text, now) { const s = TS.s; const id = (s.earId = (s.earId || 0) + 1); s.ear.push({ id, text: text.slice(0, 300), now: !!now, state: 'attesa', sent: s.lines.length }); s.dir.push({ t: s.lines.length, text: `🎧 «${text}»${now ? ' (subito)' : ''}` }); tsSave(); tsRenderDirector(); }
function tsCmd(c) { const s = TS.s; if (c === 'pubblicita') { tsBreak('cmd'); } else s.cmds.push(c); s.dir.push({ t: s.lines.length, text: { prossima: '⏭ prossima domanda', incalza: '🔥 incalza', calma: '🕊 calma gli animi', applauso: '👏 applauso', pubblicita: '📺 pubblicità' }[c] }); if (c === 'applauso') { s.applause = Math.min(100, s.applause + 20); } tsSave(); tsRenderDirector(); tsRenderTop(); }

/* ---------- setup screen ---------- */
function tsOpenSetup() {
  window.__talkActive = true; tsEnsureViews(); $('tsSetup').hidden = false; $('tsPlay').hidden = true; tsFillSetup();
}
async function tsFillSetup() {
  await ARCH.ready; const box = $('tsSetup'); const prev = tsLoad();
  const avail = ARCH.chars.filter((c) => !c.disabled && archEra(c) === 'presente' && c.status !== 'deceduto').sort((a, b) => a.name.localeCompare(b.name));
  const cfg = (prev && !prev.ended) ? null : (TS.cfg || {});
  $('tsResume').innerHTML = prev ? `<div class="avNote">${prev.ended ? `Ultima puntata: «${esc(prev.title)}», conclusa (${prev.lines.filter((l) => !l.sys).length} battute).` : `Puntata in corso: «${esc(prev.title)}», battuta ${prev.lines.filter((l) => !l.sys).length}.`} <button id="tsResumeGo">${prev.ended ? '👁 Rivedi' : '▶ Riprendi'}</button></div>` : '';
  if ($('tsResumeGo')) $('tsResumeGo').onclick = () => { TS.s = prev; tsStartView(); };
  $('tsHost').innerHTML = avail.map((c) => `<option value="${c.id}">${esc(c.name)} · ${c.age}</option>`).join('');
  $('tsGuests').innerHTML = avail.map((c) => `<label class="tsG"><input type="checkbox" value="${c.id}"> <b>${esc(c.name)}</b> <span class="legend">${esc((c.short || '').slice(0, 70))}</span> <input class="tsRole" data-id="${c.id}" placeholder="perché è invitato (es. il polemista)" maxlength="40"></label>`).join('') || '<p class="legend">L\'archivio è vuoto: crea dei personaggi.</p>';
  const capo = avail.find((c) => /dott|medic|capuozzo/i.test(c.name + c.short)); if (capo) $('tsHost').value = capo.id;
  if (!$('tsTitle').value) $('tsTitle').value = SHOW_NAMES[Math.floor(Math.random() * SHOW_NAMES.length)];
  const cfg2 = TS.cfg; if (cfg2 && cfg2.series) { $('tsSeries').hidden = false; $('tsSeries').innerHTML = `🔁 Puntata ${cfg2.series.n} della serie «${esc(cfg2.title)}». Conduttore e ospiti ricordano la puntata precedente.`; $('tsTitle').value = cfg2.title; if (archGet(cfg2.host)) $('tsHost').value = cfg2.host; document.querySelectorAll('#tsGuests input[type=checkbox]').forEach((x) => { x.checked = cfg2.guests.includes(x.value); }); $('tsStyle').value = cfg2.style; $('tsAud').value = cfg2.audience; } else $('tsSeries').hidden = true;
  tsCheckSetup();
}
function tsRenderMinds() { const s = TS.s; const el = $('tsMinds'); if (!s || !el) return; const m = tsPeople().filter((p) => p.mindset); el.innerHTML = m.map((p) => `<div>📌 ${esc(p.name)}: «${esc(p.mindset)}» <button class="link" data-unmind="${esc(p.name)}" title="togli questo pensiero fisso">✕</button></div>`).join('');
  el.querySelectorAll('[data-unmind]').forEach((b) => { b.onclick = () => { const p = tsGet(b.dataset.unmind); if (p) { p.mindset = null; s.dir.push({ t: s.lines.length, text: `💭 tolto il pensiero fisso a ${p.name}` }); tsSave(); tsRenderMinds(); tsRenderDirector(); } }; }); }
function tsEventText() { const s = TS.s; return s.event && s.lines.length - s.event.t <= 5 ? `È APPENA SUCCESSO IN STUDIO (reagisci come faresti davvero, se ti tocca): ${s.event.text}\n` : ''; }
function tsMindText(p) { return (p.mindset ? `Da un po' hai un pensiero fisso, come tuo: «${p.mindset}». Ti condiziona.\n` : '') + (p.whisper ? `Un pensiero ti attraversa la mente, come tuo: «${p.whisper}». Valutalo come qualsiasi idea tua.\n` : ''); }
function tsBetOptions() { const ids = [...document.querySelectorAll('#tsGuests input[type=checkbox]:checked')].map((x) => archGet(x.value)).filter(Boolean); const v = $('tsBetWin').value; $('tsBetWin').innerHTML = '<option value="">—</option>' + ids.map((c) => `<option${c.name === v ? ' selected' : ''}>${esc(c.name)}</option>`).join(''); }
function tsCheckSetup() { tsBetOptions();
  const host = $('tsHost').value; const gs = [...document.querySelectorAll('#tsGuests input[type=checkbox]:checked')].map((x) => x.value).filter((id) => id !== host);
  document.querySelectorAll('#tsGuests input[type=checkbox]').forEach((x) => { x.disabled = x.value === host; if (x.value === host) x.checked = false; });
  const n = gs.length; const ok = host && n >= 2 && n <= 8; $('tsGo').disabled = !ok;
  const lines = +$('tsLines').value; setText($('tsWhy'), !host ? 'Scegli un conduttore.' : n < 2 ? `Scegli almeno 2 ospiti (ora ${n}).` : n > 8 ? `Al massimo 8 ospiti (ora ${n}).` : `Pronto: ${n} ospiti · circa ${lines} battute = circa ${lines} chiamate a Claude${$('tsListen') && $('tsListen').checked ? ` + ${lines} leggere per l'ascolto` : ''} · ${Math.round(lines * 15 / 60)}–${Math.round(lines * 25 / 60)} minuti.`);
}
function tsStartNew() {
  const host = archGet($('tsHost').value); const ids = [...document.querySelectorAll('#tsGuests input[type=checkbox]:checked')].map((x) => x.value).filter((id) => id !== host.id);
  const role = (id) => (document.querySelector(`.tsRole[data-id="${id}"]`) || {}).value || '';
  const mk = (c, r) => ({ archId: c.id, name: c.name, age: c.age, sex: c.sex, role: r || '', spoke: 0, memory: $('tsMem').checked });
  const topics = $('tsTopics').value.split('\n').map((x) => x.trim()).filter(Boolean); const segs = []; let qid = 0;
  topics.forEach((t) => { const m = t.match(/^>\s*(?:a\s+)?([^:]+):\s*(.+)$/i); if (m && segs.length) { const to = archByName(m[1].trim())[0]; segs[segs.length - 1].q.push({ id: ++qid, to: to ? to.name : m[1].trim(), text: m[2].trim(), done: false }); } else segs.push({ t: t.replace(/^\d+[.)]\s*/, ''), q: [] }); });
  if (!segs.length) segs.push({ t: 'Presentazioni e opinioni libere', q: [] }, { t: 'Chi ha ragione?', q: [] }, { t: 'Saluti finali', q: [] });
  TS.s = { id: 't' + Date.now().toString(36), title: $('tsTitle').value.trim() || 'Parole a mezzanotte', date: new Date().toISOString(), host: mk(host, 'conduttore'), guests: ids.map((id) => mk(archGet(id), role(id))),
    style: $('tsStyle').value, audience: $('tsAud').value, model: $('tsModel').value, listen: $('tsListen').checked, bets: { win: $('tsBetWin').value, leave: $('tsBetLeave').value, secret: $('tsBetSecret').value }, series: TS.cfg && TS.cfg.series ? TS.cfg.series : null, isleMem: TS.isleMem || {}, isleNote: TS.isleNote || '', maxLines: +$('tsLines').value, topics: segs, seg: 0, lines: [], dir: [], ear: [], cmds: [], audienceQ: [], applause: 50, approval: {}, ended: false };
  TS.cfg = null; TS.isleMem = null; TS.isleNote = '';
  tsSave(); tsStartView();
}

/* ---------- views ---------- */
function tsEnsureViews() {
  if ($('tsSetup')) return;
  const st = document.createElement('div'); st.id = 'tsSetup'; st.hidden = true; st.className = 'tsSetup';
  st.innerHTML = `<div class="hvBox"><div class="row" style="justify-content:space-between;align-items:center"><h1 style="margin:0">📺 Il talk show</h1><span><button id="tsArch">👥 Archivio</button> <button id="tsHome">⌂ Ambienti</button></span></div>
  <div id="tsResume"></div>
  <div class="tsForm"><label>Nome del programma <span class="row" style="gap:6px"><input id="tsTitle" maxlength="50"><button id="tsDice" type="button" title="Un altro nome inventato">🎲</button></span></label>
  <label>🎙 Conduttore (dall'archivio) <select id="tsHost"></select></label>
  <label>Stile del conduttore <select id="tsStyle"><option value="ironico">Ironico</option><option value="provocatore">Provocatore</option><option value="paterno">Paterno</option><option value="severo">Severo</option><option value="neutro">Neutro</option></select></label>
  <label>Pubblico in sala <select id="tsAud"><option value="caloroso">Caloroso</option><option value="tiepido">Tiepido</option><option value="ostile">Ostile</option><option value="diviso">Diviso</option></select></label>
  <label>Durata <select id="tsLines"><option value="20">Breve · 20 battute</option><option value="40" selected>Normale · 40 battute</option><option value="70">Lunga · 70 battute</option><option value="120">Maratona · 120 battute</option></select></label>
  <label>Mente <select id="tsModel"><option value="sonnet">Sonnet (più ricco)</option><option value="haiku">Haiku (consuma meno)</option></select></label></div>
  <h3>🛋 Ospiti (2–8) <button id="tsNew" type="button">＋ Crea un personaggio nuovo</button></h3><div id="tsGuests" class="tsGuests"></div>
  <label class="legend"><input type="checkbox" id="tsListen" checked> 🧠 tutti ascoltano e pensano a ogni battuta, e chi se la sente interviene (1 chiamata leggera in più per battuta)</label><br>
  <label class="legend"><input type="checkbox" id="tsMem" checked> gli ospiti portano con sé quello che hanno vissuto (la loro storia nell'archivio)</label>
  <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0"><button id="tsFromIsle" type="button" title="Mette in studio i naufraghi dell'ultima partita dell'isola, con i loro ricordi">🏝 Ospiti dall'ultima partita dell'isola</button><span id="tsIsleNote" class="legend"></span></div>
  <div id="tsSeries" class="avNote" hidden></div>
  <h3>🎲 Scommesse prima della puntata <small class="legend">facoltative: le verifichi alla fine</small></h3>
  <div class="tsForm"><label>Chi vincerà la serata? <select id="tsBetWin"><option value="">—</option></select></label><label>Qualcuno lascerà lo studio? <select id="tsBetLeave"><option value="">—</option><option value="si">Sì</option><option value="no">No</option></select></label><label>Verrà fuori un segreto? <select id="tsBetSecret"><option value="">—</option><option value="si">Sì</option><option value="no">No</option></select></label></div>
  <h3>📋 Scaletta <small class="legend">un tema per riga; per una domanda obbligatoria aggiungi sotto il tema una riga «&gt; Nome: domanda»</small></h3>
  <textarea id="tsTopics" rows="5" placeholder="Si può credere a tutto?\n> Davide: perché ce l'ha tanto con i complottisti?\nDio, patria o nessuno dei due?\nCosa vi portate a casa stasera?"></textarea>
  <div class="row" style="align-items:center;gap:10px;margin-top:8px"><button id="tsGo" class="primary big">▶ Va in onda</button><span id="tsWhy" class="legend"></span></div></div>`;
  document.body.appendChild(st);
  const pl = document.createElement('div'); pl.id = 'tsPlay'; pl.hidden = true;
  pl.innerHTML = `<div id="tsTop"><span class="onair">● ON AIR</span> <b id="tsTitleBar"></b> <span id="tsSeg" class="legend"></span><span style="flex:1"></span><span class="tsMeter" title="Applausometro"><span>👏</span><span class="vu" id="tsVu"></span></span>
   <button id="tsVoiceBtn" title="Voci: ogni personaggio parla ad alta voce con la sua voce (i fumetti restano)">🔇 Voci</button><button id="tsPlayBtn">⏸ Pausa</button><button id="tsRepBtn2" title="Resoconto in diretta: indicatori di ospiti e conduttore, relazioni">📊</button><button id="tsEndBtn" title="Fine puntata: vincitore, pagella, copione, racconto" hidden>🏁 Risultati</button><button id="tsDl" title="Scarica la trascrizione (.md)">⇩ Trascrizione</button><button id="tsExit" title="Torna agli ambienti (la puntata resta salvata)">⌂</button></div>
  <div id="tsMain"><div id="tsLeft"><div class="tsHead">📜 Trascrizione <button id="tsOrder" title="Inverti l'ordine">⇅</button></div><div id="tsTranscript" role="log" aria-live="polite"></div></div>
   <div id="tsCenter"><div id="tsCanvas"></div><div id="tsLower" hidden></div><div id="tsShot" class="tsShot"></div><div id="tsCamBar" role="radiogroup" aria-label="Regia della camera"><button data-cam="auto" class="on" title="Regia automatica (tasto 1)">🎬 Auto</button><button data-cam="totale" title="Tutti (2)">Totale</button><button data-cam="parla" title="Chi parla (3)">Chi parla</button><button data-cam="conduttore" title="Il conduttore (4)">Conduttore</button><button data-cam="pubblico" title="Il pubblico (5)">Pubblico</button></div><div id="tsBreak" hidden>📺 Torniamo dopo la pubblicità</div></div>
   <div id="tsRight"><div class="tsHead">🎬 Regia</div>
    <label class="tsLab">🎬 Parla in studio (ti sentono tutti, ospiti e pubblico)<input id="tsDirSay" placeholder="es. Benito, ripeta quello che ha detto prima!"></label><div class="row" style="gap:6px"><select id="tsDirTo"></select><button id="tsDirGo">📢 Di' in onda</button></div>
    <label class="tsLab">🎧 Auricolare (lo sente solo il conduttore)<textarea id="tsEarText" rows="2" placeholder="es. chiedi a Fidel cosa pensa di Benito"></textarea></label>
    <div class="row" style="gap:6px;align-items:center"><label class="legend"><input type="checkbox" id="tsEarNow"> subito</label><button id="tsEarGo">Invia</button></div>
    <div id="tsEarList" class="tsEarList"></div>
    <div class="tsHead">📣 Il pubblico (sei tu il capo-claque)</div><div class="tsClaque"><button data-claque="applausi" title="applausi all'ultima battuta">👏</button><button data-claque="risate" title="risate">😂</button><button data-claque="ooh" title="ooh!">😮</button><button data-claque="fischi" title="fischi">👎</button><button data-claque="standing" title="standing ovation">🙌</button></div>
    <div class="tsHead">Comandi</div><div class="tsCmds"><button data-cmd="prossima">⏭ Prossima</button><button data-cmd="incalza">🔥 Incalza</button><button data-cmd="calma">🕊 Calma</button><button data-cmd="applauso">👏 Applauso</button><button data-cmd="pubblicita">📺 Pubblicità</button><button id="tsSurprise" title="Fai entrare un ospite a sorpresa: dall'archivio o nuovo">🚪 Ospite a sorpresa</button></div>
    <div class="tsHead">🎬 Momenti di show</div><div class="tsMoms"><div class="row" style="gap:4px"><button id="tsMomBru" title="il conduttore fa una domanda personale e scomoda">🎯 A bruciapelo a</button><select id="tsMomTo"></select></div><div class="row" style="gap:4px"><button id="tsMomDuel" title="due ospiti al centro, botta e risposta">🥊 Faccia a faccia</button><select id="tsDuelA"></select><select id="tsDuelB"></select></div><div class="row" style="gap:4px"><button id="tsMomVote" title="chi ha ragione? vota il pubblico da casa">📊 Televoto</button><button id="tsMomOff" title="pubblicità: gli ospiti credono di non essere ripresi">🔇 Fuori onda</button></div></div>
    <label class="tsLab">Stile <select id="tsStyleLive"><option value="ironico">Ironico</option><option value="provocatore">Provocatore</option><option value="paterno">Paterno</option><option value="severo">Severo</option><option value="neutro">Neutro</option></select></label>
    <div class="tsHead">📋 Scaletta</div><div id="tsScal"></div>
    <label class="tsLab">🙋 Domanda dal pubblico<input id="tsAQ" placeholder="testo della domanda"></label><div class="row" style="gap:6px"><select id="tsAQto"></select><button id="tsAQgo">In coda</button></div>
    <label class="tsLab">💭 Voce interiore<input id="tsWh" placeholder="un pensiero che sentirà come suo"></label><div class="row" style="gap:6px;flex-wrap:wrap"><select id="tsWhTo" title="a chi"></select><select id="tsWhLast" title="quanto dura"><option value="1">per la prossima battuta</option><option value="99">fisso, finché non lo togli</option></select><button id="tsWhGo">Suggerisci</button></div><div id="tsMinds" class="legend"></div><label class="tsLab">⚡ Succede in studio<input id="tsEv" placeholder="es. salta la luce, telefonata in diretta, uno spettatore urla…"></label><div class="row" style="gap:4px;flex-wrap:wrap"><button id="tsEvGo">Fallo succedere</button><button class="tsEvQ" data-ev="Per qualche secondo salta la luce in studio: buio e brusio, poi torna.">💡 Buio</button><button data-twist="tel">☎ Telefonata</button><button data-twist="urlo">📣 Spettatore</button><button data-twist="ex">💔 Entra l'ex</button><button data-twist="anonimo">✉ Messaggio anonimo</button><button data-twist="video">📼 Vecchio video</button><button class="tsEvQ" data-ev="La redazione passa al conduttore una notizia clamorosa appena uscita che riguarda il tema della serata.">📰 Notizia</button><button class="tsEvQ" data-ev="Sul maxischermo dello studio compare una vecchia foto imbarazzante di uno degli ospiti.">🖼 Foto</button></div>
    <div class="tsHead">🗒 Log di regia</div><div id="tsDirLog" class="tsDirLog"></div></div></div>
  <div id="tsBottom"><div id="tsQueue" role="status"></div><div id="tsChips"></div></div>`;
  document.body.appendChild(pl);
  // wiring
  $('tsHome').onclick = () => { tsLeave(); homeShow(); }; $('tsArch').onclick = () => archOpen();
  $('tsDice').onclick = () => { $('tsTitle').value = SHOW_NAMES[Math.floor(Math.random() * SHOW_NAMES.length)]; };
  $('tsGuests').addEventListener('change', tsCheckSetup); $('tsHost').onchange = tsCheckSetup; $('tsLines').onchange = tsCheckSetup;
  $('tsNew').onclick = () => { archEdit(archBlank({ origin: { env: 'talk', label: `nato in studio · ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}` } }), true, 'Il personaggio che crei qui entra anche nell\'archivio.'); const iv = setInterval(() => { if (!$('avEditor')) { clearInterval(iv); tsFillSetup(); } }, 400); };
  $('tsGo').onclick = tsStartNew;
  $('tsFromIsle').onclick = tsFromIsland;
  $('tsEndBtn').onclick = tsEndCard; $('tsRepBtn2').onclick = tsOpenReport; $('tsSurprise').onclick = tsSurprisePicker;
  $('tsVoiceBtn').onclick = tsVoiceToggle;
  pl.querySelectorAll('[data-cam]').forEach((b) => { b.onclick = () => tsCamMode(b.dataset.cam); });
  addEventListener('keydown', (e) => { if (!window.__talkActive || $('tsPlay').hidden || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return; const m = { 1: 'auto', 2: 'totale', 3: 'parla', 4: 'conduttore', 5: 'pubblico' }[e.key]; if (m) tsCamMode(m); });
  $('tsPlayBtn').onclick = () => { if (!TS.s || TS.s.ended) return; TS.running = !TS.running; tsRenderTop(); if (TS.running) tsLoop(); };
  $('tsExit').onclick = () => { TS.running = false; tsLeave(); homeShow(); };
  $('tsDl').onclick = () => saveFile(`${normName(TS.s.title).replace(/[^a-z0-9]+/g, '-')}-trascrizione.md`, tsTranscriptMd());
  $('tsOrder').onclick = () => { TS.newestTop = !TS.newestTop; tsRenderTranscript(true); };
  $('tsEarGo').onclick = () => { const t = $('tsEarText').value.trim(); if (!t) return; tsEar(t, $('tsEarNow').checked); $('tsEarText').value = ''; $('tsEarNow').checked = false; };
  $('tsEarText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('tsEarGo').click(); } });
  pl.querySelectorAll('[data-cmd]').forEach((b) => { b.onclick = () => tsCmd(b.dataset.cmd); });
  $('tsStyleLive').onchange = (e) => { TS.s.style = e.target.value; TS.s.dir.push({ t: TS.s.lines.length, text: `🎙 stile → ${e.target.value}` }); tsSave(); tsRenderDirector(); };
  $('tsAQgo').onclick = () => { const t = $('tsAQ').value.trim(); if (!t) return; TS.s.audienceQ.push({ text: t, to: $('tsAQto').value }); TS.s.dir.push({ t: TS.s.lines.length, text: `🙋 domanda dal pubblico: «${t}»` }); $('tsAQ').value = ''; tsSave(); tsRenderDirector(); };
  $('tsWhGo').onclick = () => { const t = $('tsWh').value.trim(); if (!t) return; const s = TS.s; const to = $('tsWhTo').value; const lasting = $('tsWhLast').value === '99';
    const targets = to === '*' ? tsPeople() : to === '*g' ? s.guests.slice() : [tsGet(to)].filter(Boolean); targets.filter((p) => !p.left).forEach((p) => { if (lasting) p.mindset = t; else p.whisper = t; });
    s.dir.push({ t: s.lines.length, text: `💭 ${lasting ? 'pensiero fisso' : 'voce interiore'} a ${to === '*' ? 'tutti' : to === '*g' ? 'tutti gli ospiti' : to}: «${t}»` }); $('tsWh').value = ''; tsSave(); tsRenderDirector(); tsRenderMinds(); };
  const voiceEv = async (kind, txt) => { const s = TS.s; if (!s || s.ended) return; ev(txt);
    const g = s.guests.filter((x) => !x.left); const tgtHint = g.map((x) => x.name).join(', ');
    const p = kind === 'tel' ? `Talk show televisivo «${s.title}», in diretta. Arriva una TELEFONATA IN DIRETTA da un telespettatore inventato (nome, età, città: realistici e italiani), arrabbiato o appassionato con uno degli ospiti per qualcosa che ha detto davvero in puntata. Ospiti: ${tgtHint}. Conduttore: ${s.host.name}.
Ultime battute:\n${tsRecent(10)}
Scrivi cosa dice al telefono: diretto, colorito, credibile, 2-3 frasi (massimo 50 parole), riferito a cose dette davvero. Rispondi SOLO con JSON: {"chi":"Nome, età, città","a":"nome dell'ospite a cui si rivolge","dice":"...","tono":"acceso|ironico|commosso|provocatorio"}`
      : `Talk show televisivo «${s.title}», in diretta. Uno SPETTATORE IN SALA si alza e urla verso il palco, prima che la sicurezza lo faccia sedere. Ospiti: ${tgtHint}. Conduttore: ${s.host.name}.
Ultime battute:\n${tsRecent(8)}
Scrivi cosa urla: una o due frasi brevi e colorite (massimo 25 parole), riferite a qualcosa detto davvero. Rispondi SOLO con JSON: {"chi":"descrizione breve, es. un signore in terza fila","a":"nome dell'ospite preso di mira","dice":"...","tono":"acceso|ironico|provocatorio"}`;
    toastMsg(kind === 'tel' ? '☎ Squilla il telefono in studio…' : '📣 Qualcuno si alza in platea…');
    try { const o = await tsAsk(p, true); const to = tsGet(String(o.a || '')); s.pendingDir = { who: String(o.chi || (kind === 'tel' ? 'Un telespettatore' : 'Uno spettatore')).slice(0, 60), label: kind === 'tel' ? '☎ AL TELEFONO' : '📣 DALLA PLATEA', sub: kind === 'tel' ? 'telefonata in diretta' : 'spettatore in sala', text: String(o.dice || '').slice(0, 300), to: to ? to.name : 'tutti', tono: String(o.tono || '') };
      tsSave(); if (!TS.running && !s.ended) { TS.running = true; tsLoop(); } } catch (e) { toastMsg('⚠ La linea è caduta: riprova.'); } };
  const ev = (txt) => { const s = TS.s; if (!s || s.ended || !txt) return; s.event = { text: txt, t: s.lines.length }; s.lines.push({ sys: true, text: '⚡ ' + txt, seg: s.seg }); s.dir.push({ t: s.lines.length, text: `⚡ evento: ${txt}` }); s.applause = Math.max(0, Math.min(100, s.applause + 5)); tsSave(); tsRenderAll(); toastMsg('⚡ ' + txt); };
  $('tsDirGo').onclick = () => { const s = TS.s; const t = $('tsDirSay').value.trim(); if (!s || s.ended || !t) return; s.pendingDir = { text: t.slice(0, 300), to: $('tsDirTo').value || 'tutti' }; s.dir.push({ t: s.lines.length, text: `📢 in onda: «${t}»` }); $('tsDirSay').value = ''; tsSave(); tsRenderDirector(); toastMsg('📢 La regia parlerà in onda alla fine della battuta in corso.'); if (!TS.running && !s.ended) { TS.running = true; tsLoop(); } };
  $('tsEvGo').onclick = () => { const x = $('tsEv').value.trim(); if (!x) return; const k = /telefon|chiama in diretta/i.test(x) ? 'tel' : /urla|grida|spettator|dal pubblico/i.test(x) ? 'urlo' : ''; if (k) tsTwist(k, x); else ev(x); $('tsEv').value = ''; };
  pl.querySelectorAll('.tsEvQ').forEach((b) => { b.onclick = () => ev(b.dataset.ev); });
  tsFunWire(pl);
}
function tsStartView() {
  window.__talkActive = true; $('tsSetup').hidden = true; $('tsPlay').hidden = false; homeHide();
  if (typeof ENG !== 'undefined' && ENG.G) { ENG.G.running = false; try { setPlay(false); } catch (e) {} }
  const s = TS.s; s.guests.concat([s.host]).forEach((p) => { p.thinking = 0; });
  $('tsStyleLive').value = s.style; const opts = s.guests.map((g) => `<option>${esc(g.name)}</option>`).join(''); $('tsAQto').innerHTML = `<option value="">a tutti</option>${opts}`; tsFunFill(); $('tsDirTo').innerHTML = `<option value="tutti">a tutti</option><option>${esc(s.host.name)}</option>${opts}`; $('tsWhTo').innerHTML = `<option value="*">tutti (anche il conduttore)</option><option value="*g">tutti gli ospiti</option><option>${esc(s.host.name)}</option>${opts}`; tsRenderMinds();
  tsBuild3D(); tsRenderAll(true);
  if (!s.ended) { TS.running = true; tsRenderTop(); tsLoop(); }
}
function tsLeave() { TS.running = false; window.__talkActive = false; if ($('tsSetup')) $('tsSetup').hidden = true; if ($('tsPlay')) $('tsPlay').hidden = true; cancelAnimationFrame(TS.raf); TS.raf = 0; }

/* ---------- rendering (DOM: append-only transcript, chips, queue, director) ---------- */
function tsLineHtml(l) {
  if (l.sys) return `<div class="tLine sys">${esc(l.text)}</div>`;
  const ic = TONE_ICON[l.tono] || '';
  return `<div class="tLine ${l.host ? 'host' : ''} ${l.director ? 'director' : ''} ${l.offair ? 'offair' : ''} ${/acces|offes/.test(l.tono || '') ? 'hot' : ''}"><div class="tMeta"><b>${esc(l.who)}</b> → ${esc(l.to || 'tutti')}${l.tono ? ` <span class="tTone">${ic} ${esc(l.tono)}</span>` : ''}${l.interrupt ? ` <span class="tInt" title="parla sopra a ${esc(l.interrupt)}">⚡ interrompe ${esc(l.interrupt)}</span>` : ''}${l.cut ? ' <span class="tInt" title="è stato interrotto">✂ interrotto</span>' : ''}${l.ear ? ' <span title="segue un suggerimento della regia">🎧</span>' : ''}${l.secret ? ` <span class="tSecret" title="solo tu lo vedi">⚠ segreto ${esc(l.secret)}</span>` : ''}</div><div class="tText">«${esc(l.text)}»</div>${l.react ? `<div class="tReact">👥 ${esc(l.react)}</div>` : ''}${l.chorus && l.chorus.length || l.crowdVoice ? `<div class="tChorus">🗯 ${(l.chorus || []).map((c) => `<b>${esc(c.n)}</b> «${esc(c.t)}»`).join(' · ')}${l.crowdVoice ? ` · 👥 «${esc(l.crowdVoice)}»` : ''}</div>` : ''}${l.listen && l.listen.length ? `<details class="tListen"><summary>🧠 cosa pensano gli altri (${l.listen.filter((x) => x.v >= 2).length} vogliono intervenire)</summary>${l.listen.map((x) => `<div><b>${esc(x.n)}</b> ${'✋'.repeat(Math.min(3, x.v))} <i>${esc(x.pos || '')}</i>: «${esc(x.pensa)}»</div>`).join('')}</details>` : ''}${l.op ? `<div class="tReact" title="opinione che cambia: solo tu la vedi">💭 ${esc(l.op.join(' · '))}</div>` : ''}</div>`;
}
function tsRenderTranscript(force) {
  const box = $('tsTranscript'); if (!box || !TS.s) return; const L = TS.s.lines.filter((l) => l.shown !== false);
  if (force || box.dataset.n == null || +box.dataset.n > L.length || TS.newestTop) { box.innerHTML = (TS.newestTop ? L.slice().reverse() : L).map(tsLineHtml).join(''); box.dataset.n = L.length; if (!TS.newestTop) box.scrollTop = box.scrollHeight; return; }
  const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  L.slice(+box.dataset.n).forEach((l) => box.insertAdjacentHTML('beforeend', tsLineHtml(l))); box.dataset.n = L.length; if (atEnd) box.scrollTop = box.scrollHeight;
}
function tsRenderChips() {
  const s = TS.s; if (!s || !$('tsChips')) return;
  $('tsChips').innerHTML = [s.host].concat(s.guests).map((p) => { const ap = Math.round(s.approval[p.name] || 0); const st = p.left ? '🚪 ha lasciato lo studio' : p.thinking ? `💭 pensa · ${Math.round((Date.now() - p.thinking) / 1000)} s` : p === TS.speaking ? '🎙 parla' : p.hand ? '✋ vuole parlare' : p.mood && /acces|offes/.test(p.mood) ? `${TONE_ICON[p.mood]} ${p.mood}` : '';
    return `<div class="tsChip ${p === s.host ? 'host' : ''} ${p.left ? 'left' : ''} ${p === TS.speaking ? 'on' : ''}"><b>${esc(p.name)}</b>${p === s.host ? ' <small>🎙 conduce</small>' : ''}<div class="legend">${st || '&nbsp;'}</div>${p.listen && p !== TS.speaking && !p.thinking && s.lines.length - p.listen.t <= 2 ? `<div class="tsThought" title="${esc(p.listen.pensa)}">${'✋'.repeat(Math.min(3, p.listen.voglia))}${p.listen.voglia ? ' ' : ''}💭 ${esc(p.listen.pensa.slice(0, 60))}${p.listen.pensa.length > 60 ? '…' : ''}</div>` : ''}${p.mindset ? '<small title="pensiero fisso suggerito da te">📌</small>' : ''}${p === s.host ? '' : `<div class="ap" role="meter" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="${ap}" aria-valuetext="gradimento ${ap}"><span style="left:50%;width:${Math.abs(ap) / 2}%;${ap < 0 ? 'transform:translateX(-100%);background:#b5452e' : 'background:#5f8f4a'}"></span></div><small>${ap > 0 ? '+' : ''}${ap}</small>`}${p.secret ? ' <small title="solo tu lo vedi">⚠</small>' : ''}</div>`; }).join('');
}
function tsQueueText(t) {
  if (!$('tsQueue')) return; const s = TS.s; if (t) { setText($('tsQueue'), t); return; }
  const th = s ? tsPeople().find((p) => p.thinking) : null;
  setText($('tsQueue'), !s ? '' : s.ended ? `🏁 Puntata conclusa · vincitore della serata: ${s.winner || '—'}` : !TS.running ? '⏸ In pausa · premi ▶ per riprendere' : th ? `⏳ ${th.name} ${th === s.host ? 'prepara la prossima domanda' : 'ci pensa su'}… ${Math.round((Date.now() - th.thinking) / 1000)} s${Date.now() - th.thinking > 12000 ? ' · Claude è lento in questo momento' : ''}` : '🎙 In onda');
}
function tsRenderTop() { const s = TS.s; if (!s || !$('tsTop')) return; setText($('tsTitleBar'), s.title); const spoken = s.lines.filter((l) => !l.sys).length; setText($('tsSeg'), `${s.topics[s.seg] ? `tema ${s.seg + 1}/${s.topics.length}: ${s.topics[s.seg].t}` : 'chiusura'} · battuta ${spoken}/${s.maxLines}`);
  $('tsVu').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(s.applause / 10) ? 'on' : ''}"></i>`).join(''); $('tsVu').setAttribute('aria-label', `applausometro ${Math.round(s.applause)}`);
  $('tsPlayBtn').textContent = s.ended ? '🏁 Finita' : TS.running ? '⏸ Pausa' : '▶ Riprendi'; $('tsPlayBtn').disabled = !!s.ended; $('tsEndBtn').hidden = !s.ended; }
function tsRenderDirector() {
  const s = TS.s; if (!s || !$('tsEarList')) return;
  $('tsEarList').innerHTML = s.ear.slice(-6).reverse().map((e) => `<div class="ear ${e.state}">${e.state === 'attesa' ? '⏳' : e.state === 'usato' ? '✓' : '✕'} «${esc(e.text)}»${e.now ? ' <small>subito</small>' : ''}${e.why ? `<div class="legend">${esc(s.host.name)}: ${esc(e.why)}</div>` : ''}</div>`).join('');
  $('tsScal').innerHTML = s.topics.map((t, i) => `<div class="${i === s.seg ? 'cur' : i < s.seg ? 'done' : ''}">${i < s.seg ? '✓' : i === s.seg ? '▶' : '·'} ${esc(t.t)}${(t.q || []).map((q) => `<div class="legend">${q.done ? '☑' : '☐'} a ${esc(q.to || 'tutti')}: ${esc(q.text)}</div>`).join('')}</div>`).join('');
  $('tsDirLog').innerHTML = s.dir.slice(-12).reverse().map((d) => `<div>${esc(d.text)} <small>(battuta ${d.t})</small></div>`).join('') || '<div class="legend">Nessun intervento ancora.</div>';
}
function tsRenderAll(force) { tsRenderTop(); tsRenderTranscript(force); tsRenderChips(); tsRenderDirector(); tsQueueText(); if (TS.three) TS.three.setPeople(); }
function tsShowLine(line) { // "spoken": lower third, spotlight, camera cut, text appearing at reading speed
  TS.curLine = line;
  TS.lastLineAt = performance.now();
  return new Promise((done) => {
    const s = TS.s; const p = tsGet(line.who); TS.speaking = p || null;
    line.shown = true; tsRenderTranscript(); tsRenderChips(); tsRenderTop(); tsRenderDirector(); tsQueueText();
    if (p && $('tsLower')) { const c = tsChar(p); $('tsLower').hidden = false; $('tsLower').innerHTML = `<b>${esc(p.name.toUpperCase())}</b><span>${esc(p === s.host ? 'il conduttore' : p.role || (c.short || '').slice(0, 50))}</span>`; }
    if (TS.three) { if (TS.camMode === 'auto' || !TS.camMode) TS.three.focus(p, line); else TS.three.manual(TS.camMode, p); }
    const text = line.text || ''; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cps = 32; const typeMs = reduce ? 0 : text.length / cps * 1000; const holdMs = Math.max(1800, Math.min(5000, 1000 + text.length * 22)); // typing at a calm reading pace, then time to finish reading
    const b = TS.three && TS.three.bub;
    if (b && line.director) { TS.bubble = { p: null, dir: true }; b.hidden = false; b.className = 'director'; b.style.left = '50%'; b.style.top = '120px'; b.innerHTML = `<div class="bWho">${esc(line.label || '📢 LA REGIA')}${line.label && !/REGIA/.test(line.label) ? ' · ' + esc(line.who) : ''} → ${esc(line.to || 'tutti')}</div><div class="bTxt"></div>`; const el = b.querySelector('.bTxt'); let i = 0; const step = () => { if (!TS.bubble || !TS.bubble.dir) return; i = Math.min(text.length, i + 2); el.textContent = '«' + text.slice(0, i) + (i < text.length ? '▍' : '»'); if (i < text.length) setTimeout(step, 1000 / cps * 2); }; reduce ? (el.textContent = '«' + text + '»') : step(); if ($('tsLower')) { $('tsLower').hidden = false; $('tsLower').innerHTML = `<b>${esc((line.label && !/REGIA/.test(line.label) ? line.who : 'LA REGIA').toUpperCase())}</b><span>${esc(line.sub || 'voce fuori campo')}</span>`; } }
    if (b && p) { TS.bubble = { p }; b.hidden = false; b.className = (p === s.host ? 'host ' : '') + (/acces|offes/.test(line.tono || '') ? 'hot' : '');
      b.innerHTML = `<div class="bWho">💬 ${esc(p.name)} → ${esc(line.to || 'tutti')}${line.tono ? ` <span>${TONE_ICON[line.tono] || ''} ${esc(line.tono)}</span>` : ''}</div><div class="bTxt"></div>`;
      const el = b.querySelector('.bTxt'); if (reduce) el.textContent = '«' + text + '»'; else { let i = 0; const step = () => { if (!TS.bubble || TS.bubble.p !== p) return; i = Math.min(text.length, i + 2); el.textContent = '«' + text.slice(0, i) + (i < text.length ? '▍' : '»'); if (i < text.length) setTimeout(step, 2000 / cps); }; step(); } }
    let ended = false; const finish = () => { if (ended) return; ended = true; if (TS.cutCurrent === cut) TS.cutCurrent = null; TS.speaking = null; tsRenderChips(); if (b && TS.bubble && (TS.bubble.p === p || (line.director && TS.bubble.dir))) { b.hidden = true; TS.bubble = null; } done(); };
    TS.curStart = performance.now(); TS.curMin = 1200 + Math.min(2500, typeMs * 0.45);
    const cut = () => { if (ended) return; line.cut = true; if (b && !b.hidden) { const g = b.cloneNode(true); g.id = ''; g.classList.add('tsGhost'); const tx = g.querySelector('.bTxt'); if (tx) tx.textContent = tx.textContent.replace(/[▍»]+$/, '') + '—»'; b.parentElement.appendChild(g); setTimeout(() => g.remove(), 1600); }
      if (TS.voiceOn && TS.tts) { try { TS.tts.stop(); } catch (e) {} } finish(); tsRenderTranscript(); };
    TS.cutCurrent = cut;
    if (TS.voiceOn && TS.tts && p && text !== '(resta in silenzio)') { const t0 = Date.now(); TS.tts.speak(text, { voice: tsVoiceOf(p), language: 'it' }).then(() => setTimeout(finish, Math.max(400, Math.min(16000, typeMs + holdMs) - (Date.now() - t0) < 0 ? 400 : 600))).catch((e) => { if (e && (e.code === 'not_granted' || e.code === 'unavailable')) { TS.voiceOn = false; tsVoiceBtnSync(); } setTimeout(finish, Math.max(300, Math.min(16000, typeMs + holdMs) - (Date.now() - t0))); }); }
    else setTimeout(finish, Math.min(16000, typeMs + holdMs));
  });
}
setInterval(() => { if (window.__talkActive && TS.s && !TS.s.ended && TS.running) { tsQueueText(); tsRenderChips(); if (TS.breakUntil && $('tsBreak')) $('tsBreak').hidden = Date.now() > TS.breakUntil; } }, 1000);
function tsTranscriptMd() {
  const s = TS.s; const L = [`# ${s.title}`, `Puntata del ${new Date(s.date).toLocaleDateString('it-IT')} · conduce ${s.host.name}`, '', `Ospiti: ${s.guests.map((g) => g.name + (g.role ? ' (' + g.role + ')' : '')).join(', ')}`, `Scaletta: ${s.topics.map((t) => t.t).join(' · ')}`, ''];
  s.lines.forEach((l) => { if (l.sys) L.push('', `*${l.text}*`, ''); else L.push(`**${l.who}** → ${l.to}${l.tono ? ' _(' + l.tono + ')_' : ''}${l.interrupt ? ' _(interrompe ' + l.interrupt + ')_' : ''}: «${l.text}${l.cut ? '—' : ''}»${l.react ? ` — _pubblico: ${l.react}_` : ''}`); });
  if (s.ended) L.push('', `Vincitore della serata: ${s.winner || '—'}`, '', '## Gradimento finale', ...s.guests.map((g) => `- ${g.name}: ${Math.round(s.approval[g.name] || 0)}`));
  if (s.dir.length) L.push('', '## Appendice: interventi della regia', ...s.dir.map((d) => `- battuta ${d.t}: ${d.text}`));
  return L.join('\n') + '\n';
}

/* ---------- the 3D studio (original set: no real show, no logos) ---------- */
/* stylised but recognisable people: sex, age (grey hair), beard, long hair, skin and clothes stable per person */
function tsLook(p, col, standing) {
  const c = (typeof tsChar === 'function' && tsChar(p)) || {}; const key = p.archId || p.name; let h = 0; for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (arr, k) => arr[(h >>> k) % arr.length]; const f = (p.sex || c.sex) === 'f'; const age = +(p.age || c.age || 40);
  const skins = [0xf1c9a5, 0xe0ac69, 0xc68642, 0x8d5524, 0xf3d6c0, 0xd9a273];
  const hair = age >= 62 ? pick([0xd8d8d8, 0xc9c9c9, 0xe8e4dc], 3) : age >= 50 ? pick([0x8a8a8a, 0x5a4a3a, 0x9a9a9a], 3) : pick([0x2a1a10, 0x4a3020, 0x6a4a2a, 0xb08a4a, 0x1a1a1a, 0x8a3a1a, 0xd8c070], 3);
  const shirt = standing ? 0x2a2a34 : pick([0xf2efe6, 0x26324a, 0xd8c9a6, 0x1f1f24, 0x8a8f96, 0x6a1f2a, 0x55603a, 0x4a6a8a, 0xe8d6e0, 0x3a5a4a], 9);
  const pants = pick([0x2b2b38, 0x3a3226, 0x4a4a52, 0x24324a, 0x5a4632], 5);
  const nm = (c.name || p.name || '').toLowerCase(); const bearded = !f && (/barb|baff|barba/.test(JSON.stringify(c.sections || {}).toLowerCase()) || (h >>> 7) % 3 === 0);
  return { skin: pick(skins, 1), hair, longHair: f, beard: bearded, shirt, pants };
}
function tsBuild3D() {
  const host = $('tsCanvas'); if (!host || typeof THREE === 'undefined') return;
  if (TS.three) { TS.three.setPeople(); tsAnim(); return; }
  const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(1.5, devicePixelRatio)); R.shadowMap.enabled = true; host.appendChild(R.domElement);
  const S = new THREE.Scene(); S.background = new THREE.Color(0x120a0e); S.fog = new THREE.Fog(0x120a0e, 26, 70);
  const C = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
  S.add(new THREE.HemisphereLight(0xb0a0c0, 0x302020, 0.9)); const fill = new THREE.DirectionalLight(0xffe2b8, 0.6); fill.position.set(0, 6, 14); S.add(fill);
  const key = new THREE.SpotLight(0xffd59a, 1.3, 60, 0.6, 0.5); key.position.set(0, 16, 10); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); S.add(key); key.target.position.set(0, 0, -1); S.add(key.target);
  const cold = new THREE.PointLight(0x4a6aa8, 0.6, 40); cold.position.set(0, 6, 12); S.add(cold);
  const mat = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, emissive: e || 0x000000 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat(0x1a1214)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.4, 48, 1, false, -Math.PI / 2, Math.PI), mat(0x7a4a2a)); stage.position.set(0, 0.2, -2); stage.receiveShadow = true; S.add(stage);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.06, 6, 64, Math.PI), mat(0xc08a2e, 0x3a2a08)); rim.rotation.x = -Math.PI / 2; rim.rotation.z = Math.PI; rim.position.set(0, 0.42, -2); S.add(rim); TS.rim = rim;
  for (let i = 0; i < 26; i++) { const a = Math.PI + (i / 25) * Math.PI; const f = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 9, 8), mat(0x5e1022)); f.position.set(Math.cos(a) * 11.5, 4.5, -2 + Math.sin(a) * 6.5 - 1); S.add(f); }
  // the show's disc with its name, drawn on a canvas
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const g = cv.getContext('2d');
  const drawDisc = () => { g.clearRect(0, 0, 512, 512); const grd = g.createRadialGradient(256, 256, 40, 256, 256, 250); grd.addColorStop(0, '#ffd27a'); grd.addColorStop(1, '#7a3a10'); g.fillStyle = grd; g.beginPath(); g.arc(256, 256, 248, 0, 7); g.fill(); g.fillStyle = '#1a0a06'; g.font = 'bold 56px Georgia'; g.textAlign = 'center'; const words = (TS.s.title || '').split(' '); const lines = []; let cur = ''; words.forEach((w) => { if ((cur + ' ' + w).trim().length > 12) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }); lines.push(cur.trim()); lines.forEach((l, i) => g.fillText(l, 256, 256 + (i - (lines.length - 1) / 2) * 62 + 20)); };
  drawDisc(); const tex = new THREE.CanvasTexture(cv); const disc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshBasicMaterial({ map: tex })); disc.position.set(0, 5.8, -8.4); S.add(disc);
  { const warm = new THREE.SpotLight(0xffb070, 0.9, 40, 0.5, 0.6); warm.position.set(-8, 10, 6); warm.target.position.set(-2, 0, -2); S.add(warm, warm.target); const warm2 = new THREE.SpotLight(0xff9fb0, 0.7, 40, 0.5, 0.6); warm2.position.set(8, 10, 6); warm2.target.position.set(3, 0, -2); S.add(warm2, warm2.target);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 0.55, 24), mat(0x2a1a14)); table.position.set(1.1, 0.68, 0.4); S.add(table); const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 24), mat(0xc9a86a, 0x221608)); top.position.set(1.1, 0.98, 0.4); S.add(top);
    [[-0.2, 0.2], [0.3, -0.1], [0.1, 0.35]].forEach(([dx, dz]) => { const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.6 })); gl.position.set(1.1 + dx, 1.11, 0.4 + dz); S.add(gl); });
    const rug = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40), mat(0x4a1a2a)); rug.rotation.x = -Math.PI / 2; rug.position.set(1.1, 0.42, -1.2); S.add(rug);
    [-9.5, 9.5].forEach((x) => { const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.8, 10), mat(0x8a6a4a)); pot.position.set(x, 0.8, -3); S.add(pot); const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), mat(0x2f6a3a)); leaf.position.set(x, 2, -3); S.add(leaf); });
    const scr = document.createElement('canvas'); scr.width = 512; scr.height = 288; TS.screenCv = scr; const sx = scr.getContext('2d'); sx.fillStyle = '#101820'; sx.fillRect(0, 0, 512, 288); sx.fillStyle = '#c08a2e'; sx.font = 'bold 34px serif'; sx.textAlign = 'center'; sx.fillText('IN DIRETTA', 256, 156);
    const stex = new THREE.CanvasTexture(scr); TS.screenTex = stex; const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.5), new THREE.MeshBasicMaterial({ map: stex })); screen.position.set(-6.5, 5.6, -7.9); S.add(screen); const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.7, 0.08), mat(0x111111)); frame.position.set(-6.5, 5.6, -7.95); S.add(frame); }
  const onair = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0xd6291f })); onair.position.set(6.5, 7.5, -7.5); S.add(onair);
  // audience: instanced figures on tiers
  const N = 96; const bodyG = THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.28, 0.5, 3, 6) : new THREE.CylinderGeometry(0.28, 0.3, 1, 6);
  const crowd = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), N); const M = new THREE.Matrix4(); const seats = [];
  // the audience sits in front of the stage, behind the main camera: seen in the reverse shots
  for (let i = 0; i < N; i++) { const row = Math.floor(i / 24), k = i % 24; const x = (k - 11.5) * 1.0 + (row % 2) * 0.5; const z = 12.5 + row * 1.5 + Math.abs(x) * 0.05; const y = 0.6 + row * 0.6; seats.push([x, y, z]); M.makeTranslation(x, y, z); crowd.setMatrixAt(i, M); crowd.setColorAt(i, new THREE.Color().setHSL(Math.random(), 0.35, 0.35 + Math.random() * 0.25)); }
  S.add(crowd);
  for (let row = 0; row < 4; row++) { const st = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6 * row + 0.3, 1.5), mat(0x2a1a1e)); st.position.set(0, (0.6 * row + 0.3) / 2, 12.5 + row * 1.5); S.add(st); }
  const people = new THREE.Group(); S.add(people); const P = {};
  const colors = [0x3f6b9a, 0x9a3f3f, 0x4a8a4a, 0x8a6a2a, 0x6a4a8a, 0x2a7a7a, 0xa05a80, 0x7a7a3a];
  function setPeople() {
    const s = TS.s; while (people.children.length) people.remove(people.children[0]); Object.keys(P).forEach((k) => delete P[k]);
    const gs = s.guests; const n = gs.length;
    const mk = (p, x, z, col, standing) => { const grp = new THREE.Group(); grp.position.set(x, 0.4, z);
      if (!standing) { const ch = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 1.1), mat(col)); ch.position.y = 0.25; ch.castShadow = true; grp.add(ch); const bk = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.05, 0.25), mat(col)); bk.position.set(0, 0.75, -0.45); grp.add(bk); [-0.56, 0.56].forEach((x) => { const ar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 1.0), mat(new THREE.Color(col).multiplyScalar(0.8).getHex())); ar.position.set(x, 0.62, 0.02); grp.add(ar); }); }
      const look = tsLook(p, col, standing); let fig = null, head;
      if (window.SC && SC.makePerson) { fig = SC.makePerson(look); if (fig.root.parent) fig.root.parent.remove(fig.root); fig.root.scale.setScalar(standing ? 1.3 : 1.3); fig.root.position.set(0, standing ? 0 : 0.5 - 0.2 * 1.3 + 0.02, standing ? 0 : -0.12); grp.add(fig.root); head = fig.head; SC.posePerson(fig, standing ? 'idle' : 'sit', 0); }
      else { const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, standing ? 1.4 : 1.0, 10), mat(look.shirt)); body.position.y = standing ? 0.7 : 1.05; grp.add(body); head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mat(look.skin)); head.position.y = standing ? 1.65 : 1.8; grp.add(head); }
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; grp.add(ring);
      grp.lookAt(0, 0.4, 8); if (p.left) grp.visible = false; people.add(grp); P[p.name] = { grp, head, ring, base: head.position.y, col, host: standing, fig, ph: Math.random() * 10 }; };
    mk(s.host, Math.min(-6.2, 1.1 - Math.max(8.6, (n - 1) * 1.85) / 2 - 3), 0.2, 0x222222, true);
    const span = Math.max(8.6, (n - 1) * 1.85); gs.forEach((g, i) => { const f = n === 1 ? 0.5 : i / (n - 1); mk(g, 1.1 - span / 2 + f * span, -2.2 - Math.sin(f * Math.PI) * (1.4 + span * 0.08), colors[i % colors.length], false); if (g.left) P[g.name].grp.visible = false; });
    drawDisc(); tex.needsUpdate = true; if (typeof syncTags === 'function') syncTags();
  }
  let shot = { pos: new THREE.Vector3(-0.4, 7, 16), look: new THREE.Vector3(-0.4, 1.3, -2.2) }; const camPos = shot.pos.clone(), camLook = shot.look.clone();
  const WIDE = () => { const ng = TS.s ? TS.s.guests.length : 4; const half = Math.max(8.2, (Math.max(8.6, (ng - 1) * 1.85) + 6) / 2 + 0.6); const d = Math.max(12, half / (Math.tan(THREE.MathUtils.degToRad(C.fov / 2)) * Math.max(0.6, C.aspect))); return { pos: new THREE.Vector3(-0.4, 2.2 + d * 0.3, -2.2 + d), look: new THREE.Vector3(-0.4, 1.3, -2.2), name: 'totale' }; };
  function headOf(p) { const o = p && P[p.name]; if (!o) return null; const v = new THREE.Vector3(); o.head.getWorldPosition(v); return v; }
  function frontShot(v, d, up) { const dir = new THREE.Vector3(v.x * 0.15, 0, 9).sub(new THREE.Vector3(v.x, 0, v.z)).normalize(); return { pos: new THREE.Vector3(v.x + dir.x * d, v.y + up, v.z + dir.z * d), look: new THREE.Vector3(v.x, v.y - up * 0.45, v.z) }; }
  let lastCut = 0, lastShot = 'totale';
  function focus(p, line) { // TV direction: the wide shot that shows everybody is the base; cuts to the speaker, the host, two people facing off, the audience
    Object.values(P).forEach((o) => { o.ring.material.opacity = 0; }); const o = p && P[p.name]; if (o) o.ring.material.opacity = 0.85;
    const now = performance.now(); if (now - lastCut < 2500 && line && !line.interrupt) return; lastCut = now;
    const s = TS.s; const hot = line && /acces|offes|commoss|provoc/.test(line.tono || ''); const r = Math.random(); const v = headOf(p);
    const to = line && tsGet(line.to || ''); const vt = to && to !== p ? headOf(to) : null;
    let pick = 'totale';
    if (!line || !v) pick = 'totale';
    else if (line && /fischi|ooh/.test(line.react || '') && r < 0.18) pick = 'pubblico';
    else if (hot && r < 0.55) pick = 'primo piano';
    else if (vt && r < 0.3) pick = 'due';
    else if (r < 0.42 && tsReactor(p)) { const rx = tsReactor(p); setTimeout(() => { if (TS.speaking === p) { const vr = headOf(rx); if (vr) { shot = frontShot(vr, 5.5, 0.4); shot.name = 'reazione'; if ($('tsShot')) setText($('tsShot'), '🎥 reazione · ' + rx.name); setTimeout(() => { if (TS.speaking === p) { shot = frontShot(v, 8.5, 0.9); } }, 1800); } } }, 1600); pick = 'mezza figura'; }
    else if (lastShot !== 'totale' && r < 0.55) pick = 'totale';
    else if (r < 0.75) pick = 'mezza figura';
    else pick = 'totale';
    lastShot = pick;
    if (pick === 'totale') shot = WIDE();
    else if (pick === 'pubblico') { shot = { pos: new THREE.Vector3(0, 4.2, 4), look: new THREE.Vector3(0, 1.8, 15) }; setTimeout(() => { lastCut = 0; focus(p); }, 2200); }
    else if (pick === 'primo piano') shot = frontShot(v, 4.6, 0.25);
    else if (pick === 'due') { const m = v.clone().add(vt).multiplyScalar(0.5); const span = v.distanceTo(vt); shot = frontShot(m, Math.max(7, span * 1.35), 1.4); }
    else shot = frontShot(v, 8.5, 0.9);
    shot.name = pick; if ($('tsShot')) setText($('tsShot'), '🎥 ' + pick + (p && pick !== 'totale' && pick !== 'pubblico' ? ' · ' + p.name : ''));
  }
  shot = WIDE();
  function manual(mode, p) { const s = TS.s; Object.values(P).forEach((o) => { o.ring.material.opacity = 0; }); if (p && P[p.name]) P[p.name].ring.material.opacity = 0.85;
    if (mode === 'totale') shot = WIDE(); else if (mode === 'pubblico') shot = { pos: new THREE.Vector3(0, 4.2, 4), look: new THREE.Vector3(0, 1.8, 15) };
    else { const who = mode === 'conduttore' ? s.host : p || TS.speaking || s.host; const v = headOf(who); shot = v ? frontShot(v, 8.5, 0.9) : WIDE(); }
    if ($('tsShot')) setText($('tsShot'), '🎥 ' + { totale: 'totale', pubblico: 'pubblico', conduttore: 'conduttore', parla: 'chi parla' }[mode] + ' · regia manuale'); }
  function resize() { const w = host.clientWidth || 640, h = host.clientHeight || 360; R.setSize(w, h); C.aspect = w / h; C.updateProjectionMatrix(); }
  addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(host); resize(); setPeople();
  let t0 = performance.now();
  const bub = document.createElement('div'); bub.id = 'tsBubble'; bub.hidden = true; host.parentElement.appendChild(bub); const tmpV = new THREE.Vector3();
  function tagBoxEl() { let b = host.parentElement.querySelector('#tsTags'); if (!b) { b = document.createElement('div'); b.id = 'tsTags'; host.parentElement.appendChild(b); } return b; }
  function syncTags() { const tagBox = tagBoxEl(); const TAG = TS.tags = {}; tagBox.innerHTML = ''; Object.entries(P).forEach(([n, o]) => { const d = document.createElement('div'); d.className = 'tsTag' + (o.host ? ' host' : ''); d.style.setProperty('--c', '#' + new THREE.Color(o.host ? 0xc08a2e : o.col).getHexString()); d.innerHTML = `<b>${esc(n)}</b>${o.host ? '<small>conduttore</small>' : ''}`; tagBox.appendChild(d); TAG[n] = d; }); }
  const tv2 = new THREE.Vector3();
  function placeTags() { const w = host.clientWidth, h = host.clientHeight; const TAG = TS.tags || {}; Object.entries(P).forEach(([n, o]) => { const d = TAG[n]; if (!d) return; if (!o.grp.visible) { d.hidden = true; return; } (o.inDuel && o.fig ? o.fig.root : o.grp).getWorldPosition(tv2); tv2.y += 0.05; tv2.z += 0.75; tv2.project(C); const vis = tv2.z < 1 && Math.abs(tv2.x) < 1.1 && Math.abs(tv2.y) < 1.1; d.hidden = !vis; if (!vis) return; d.style.left = ((tv2.x * 0.5 + 0.5) * w) + 'px'; d.style.top = Math.min(h - 24, (-tv2.y * 0.5 + 0.5) * h) + 'px'; d.classList.toggle('on', !!(TS.speaking && TS.speaking.name === n)); });
    // labels never cover each other: when two would overlap, the later one drops one row lower
    const shown = Object.values(TAG).filter((d) => !d.hidden).map((d) => ({ d, x: parseFloat(d.style.left), y: parseFloat(d.style.top), w: d.offsetWidth })).sort((a, b) => a.x - b.x); const rows = [];
    shown.forEach((it) => { let r = 0; while (rows[r] != null && rows[r] > it.x - it.w / 2 - 4) r++; rows[r] = it.x + it.w / 2; if (r) it.d.style.top = Math.min(h - 24, it.y + r * 21) + 'px'; }); }
  function placeBubble() { const p = TS.bubble && TS.bubble.p; const o = p && P[p.name]; if (!o || bub.hidden) return; o.head.getWorldPosition(tmpV); tmpV.y += 0.5; tmpV.project(C);
    const w = host.clientWidth, h = host.clientHeight; let x = (tmpV.x * 0.5 + 0.5) * w, y = (-tmpV.y * 0.5 + 0.5) * h; const bw = bub.offsetWidth, bh = bub.offsetHeight;
    x = Math.max(8 + bw / 2, Math.min(w - 8 - bw / 2, x)); y = Math.max(8 + bh, Math.min(h - 70, y)); if (tmpV.z > 1) { y = 8 + bh; } bub.style.left = x + 'px'; bub.style.top = y + 'px'; }
  const murBox = document.createElement('div'); murBox.id = 'tsMurBox'; host.parentElement.appendChild(murBox); const MUR = [];
  function murmur(name, text, cls) { const o = name ? P[name] : null; const d = document.createElement('div'); d.className = 'tsMur ' + (cls || ''); d.textContent = text; murBox.appendChild(d); MUR.push({ o, d, until: performance.now() + 2600 + text.length * 40 }); }
  const mv = new THREE.Vector3();
  function placeMurs(now) { const w = host.clientWidth, h = host.clientHeight; for (let i = MUR.length - 1; i >= 0; i--) { const m = MUR[i]; if (now > m.until) { m.d.remove(); MUR.splice(i, 1); continue; } if (!m.o) { m.d.style.left = (w / 2 + (i % 3 - 1) * 140) + 'px'; m.d.style.top = (h - 70 - (i % 2) * 34) + 'px'; continue; } m.o.head.getWorldPosition(mv); mv.y += 0.35; mv.project(C); if (mv.z > 1) { m.d.hidden = true; continue; } m.d.hidden = false; m.d.style.left = ((mv.x * 0.5 + 0.5) * w) + 'px'; m.d.style.top = ((-mv.y * 0.5 + 0.5) * h) + 'px'; m.d.style.opacity = Math.min(1, (m.until - now) / 600); } }
  TS.three = { setPeople, focus, manual, murmur, P, R, S, C, tick: (now) => {
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now; const k = 1 - Math.pow(0.02, dt);
    camPos.lerp(shot.pos, k); camLook.lerp(shot.look, k); C.position.copy(camPos); C.lookAt(camLook);
    const sp = TS.speaking && P[TS.speaking.name]; const lastL = TS.s && TS.s.lines.length ? TS.s.lines[TS.s.lines.length - 1] : null; const laughing = lastL && /risat/.test(lastL.react || '') && now - (TS.lastLineAt || 0) < 4000; const t2 = now / 1000;
    Object.entries(P).forEach(([n, o]) => { if (!o.fig) { o.head.position.y = o.base + (sp === o ? Math.abs(Math.sin(now / 140)) * 0.04 : 0); return; }
      const me = sp === o; const anim = o.host ? (me ? 'talkstand' : 'idle') : me ? 'talk' : 'sit'; SC.posePerson(o.fig, anim, t2 + o.ph); tsPose(n, o, me, t2 + o.ph, now);
      if (!o.host && !me && sp) { const tgt = new THREE.Vector3(); sp.grp.getWorldPosition(tgt); const here = new THREE.Vector3(); o.grp.getWorldPosition(here); const ang = Math.atan2(tgt.x - here.x, tgt.z - here.z) - o.grp.rotation.y; o.fig.head.rotation.y = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(ang), Math.cos(ang)))); }
      if (!o.host && laughing && !me && !(o.gest && o.gest.until > now)) { o.fig.torso.rotation.x = -0.1 + Math.abs(Math.sin(t2 * 11 + o.ph)) * 0.12; } });
    const ap = TS.s ? TS.s.applause / 100 : 0.5; const wave = TS.s && TS.s.lines.length && (TS.s.lines[TS.s.lines.length - 1].react || '').match(/applaus|risat|ooh/) ? 1 : 0;
    for (let i = 0; i < N; i++) { const b = seats[i]; M.makeTranslation(b[0], b[1] + (wave ? Math.max(0, Math.sin(now / 90 + i)) * 0.06 * ap : 0), b[2]); crowd.setMatrixAt(i, M); } crowd.instanceMatrix.needsUpdate = true;
    rim.material.emissive.setHex(ap > 0.8 ? 0x8a5a10 : 0x3a2a08);
    R.render(S, C); placeBubble(); placeTags(); placeMurs(now); }, bub };
  tsAnim();
}
function tsAnim() { cancelAnimationFrame(TS.raf); const loop = (now) => { if (!window.__talkActive || !TS.three) return; TS.three.tick(now); TS.raf = requestAnimationFrame(loop); }; TS.raf = requestAnimationFrame(loop); }

function tsCard(title, html, wide) { const el = funCard(title, html, wide); el.style.zIndex = window.__talkActive ? 70 : ''; return el; }
function tsOpenReport() { const s = TS.s; if (!s) return; const fname = `${normName(s.title).replace(/[^a-z0-9]+/g, '-')}-resoconto.pdf`;
  const el = rpOpen(tsReport(s), fname, s.ended && !s.story ? '<button id="rpStoryBtn" title="Una chiamata a Claude: il racconto della puntata entra nel resoconto">✍ Aggiungi il racconto romanzato</button>' : '');
  el.querySelector('#rpPdfBtn').onclick = async (e) => { const b = e.target; b.disabled = true; b.textContent = '📘 Impagino…'; try { const { r, pages } = await rpPdf(tsReport(s), fname); if (r !== 'error') toastMsg(r === 'declined' ? 'Download annullato.' : `📘 Resoconto salvato (${pages} pagine).`); } catch (er) { toastMsg('⚠ Non riesco a creare il PDF.'); } finally { b.disabled = false; b.textContent = '📘 Scarica il resoconto (PDF)'; } };
  const sb = el.querySelector('#rpStoryBtn'); if (sb) sb.onclick = async () => { sb.disabled = true; sb.textContent = '✍ Scrivo il racconto…'; try { await tsWriteStory(); sb.textContent = '✓ Racconto pronto: è nel resoconto'; } catch (er) { sb.disabled = false; sb.textContent = '✍ Aggiungi il racconto romanzato'; toastMsg('⚠ Non riesco a scrivere il racconto ora.'); } };
}
/* ---------- camera direction by hand ---------- */
function tsCamMode(m) { TS.camMode = m; document.querySelectorAll('#tsCamBar [data-cam]').forEach((b) => b.classList.toggle('on', b.dataset.cam === m)); if (!TS.three) return; if (m === 'auto') TS.three.focus(TS.speaking, null); else TS.three.manual(m, TS.speaking); if (TS.s) { TS.s.dir.push({ t: TS.s.lines.length, text: `🎥 camera: ${m}` }); tsRenderDirector(); } }

/* ---------- voices (platform text-to-speech), one per person ---------- */
const VOICES = ['buttery', 'airy', 'glassy', 'rounded'];
function tsVoiceOf(p) { const s = TS.s; if (p === s.host) return 'buttery'; const i = s.guests.indexOf(p); return VOICES[(i + 1) % VOICES.length]; }
function tsVoiceBtnSync() { const b = $('tsVoiceBtn'); if (b) { b.textContent = TS.voiceOn ? '🔊 Voci' : '🔇 Voci'; b.setAttribute('aria-pressed', String(!!TS.voiceOn)); } }
async function tsVoiceToggle() {
  if (TS.voiceOn) { TS.voiceOn = false; try { TS.tts && await TS.tts.stop(); } catch (e) {} tsVoiceBtnSync(); return; }
  try { TS.tts = TS.tts || (window.claude && window.claude.use ? await window.claude.use('tts') : null); } catch (e) { TS.tts = null; }
  if (!TS.tts) { toastMsg('Le voci non sono disponibili in questa vista (per esempio Safari o l\'app mobile): restano i fumetti.'); return; }
  TS.voiceOn = true; tsVoiceBtnSync(); toastMsg('🔊 Voci attive: ogni personaggio parla con la sua voce. Le battute restano scritte nei fumetti e nella trascrizione.');
}

/* ---------- surprise guest: from the archive or created on the spot (it goes into the archive) ---------- */
function tsSurprisePicker() {
  const s = TS.s; if (!s || s.ended) return; if (s.guests.filter((g) => !g.left).length >= 9) { toastMsg('In studio ci sono già 9 ospiti.'); return; }
  const here = new Set(tsPeople().map((p) => p.archId)); const av = ARCH.chars.filter((c) => !c.disabled && archEra(c) === 'presente' && c.status !== 'deceduto' && !here.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  const el = tsCard('🚪 Ospite a sorpresa', `<p>Chi entra in studio? Entrerà alla fine della battuta in corso, e il conduttore lo presenterà.</p><label>Dall'archivio <select id="tsSpPick">${av.map((c) => `<option value="${c.id}">${esc(c.name)} · ${esc((c.short || '').slice(0, 60))}</option>`).join('') || '<option value="">(nessuno disponibile)</option>'}</select></label>
   <label>Perché è qui <input id="tsSpRole" placeholder="es. il testimone, l'ex di qualcuno…" maxlength="40"></label>
   <div class="row" style="gap:8px;margin-top:8px"><button id="tsSpGo" class="primary">🚪 Fallo entrare</button><button id="tsSpNew">＋ Crea un personaggio nuovo</button><button data-close>Annulla</button></div>`);
  el.querySelector('#tsSpGo').onclick = () => { const id = el.querySelector('#tsSpPick').value; if (!id) return; s.pendingGuest = { id, role: el.querySelector('#tsSpRole').value.trim() }; s.dir.push({ t: s.lines.length, text: `🚪 ospite a sorpresa: ${archGet(id).name}` }); el.hidden = true; tsSave(); tsRenderDirector(); toastMsg(`🚪 ${archGet(id).name} entrerà alla fine della battuta in corso.`); };
  el.querySelector('#tsSpNew').onclick = () => { el.hidden = true; const before = new Set(ARCH.chars.map((c) => c.id)); archEdit(archBlank({ origin: { env: 'talk', label: `nato in studio · «${s.title}»` } }), true, 'Il nuovo ospite entra anche nell\'archivio.'); const iv = setInterval(() => { if ($('avEditor')) return; clearInterval(iv); const n = ARCH.chars.find((c) => !before.has(c.id)); if (n) { s.pendingGuest = { id: n.id, role: '' }; s.dir.push({ t: s.lines.length, text: `🚪 ospite a sorpresa (nuovo): ${n.name}` }); tsSave(); tsRenderDirector(); toastMsg(`🚪 ${n.name} entrerà alla fine della battuta in corso.`); } }, 400); };
}
function tsGuestEnters() {
  const s = TS.s; const pg = s.pendingGuest; s.pendingGuest = null; const c = archGet(pg.id); if (!c) return;
  const g = { archId: c.id, name: c.name, age: c.age, sex: c.sex, role: pg.role || 'ospite a sorpresa', spoke: 0, memory: true, surprise: true };
  s.guests.push(g); s.justIn = `${c.name}${pg.role ? ', ' + pg.role : ''}: ${c.short || ''}`; s.lines.push({ sys: true, text: `🚪 Entra in studio, a sorpresa, ${c.name}`, seg: s.seg }); s.applause = Math.min(100, s.applause + 12);
  const opts = s.guests.map((x) => `<option>${esc(x.name)}</option>`).join(''); $('tsAQto').innerHTML = `<option value="">a tutti</option>${opts}`; tsFunFill(); $('tsDirTo').innerHTML = `<option value="tutti">a tutti</option><option>${esc(s.host.name)}</option>${opts}`; $('tsWhTo').innerHTML = `<option value="*">tutti (anche il conduttore)</option><option value="*g">tutti gli ospiti</option><option>${esc(s.host.name)}</option>${opts}`; tsRenderMinds();
  if (TS.three) TS.three.setPeople(); tsSave(); tsRenderAll();
}

/* ---------- guests from the island: memories built from what happened there (no calls) ---------- */
function tsFromIsland() {
  let G = (typeof ENG !== 'undefined' && ENG.G) || null; if (!G) { try { G = JSON.parse(localStorage.getItem('isola-esperimento-v1') || 'null'); } catch (e) { G = null; } } if (!G || !G.agents) { setText($('tsIsleNote'), 'Nessuna partita dell\'isola salvata.'); return; }
  const mem = {}; const alive = [], dead = [];
  G.agents.forEach((a) => { const c = a.archId ? archGet(a.archId) : archByName(a.name)[0]; if (!c) return;
    const ev = (G.chronicle || []).filter((x) => x.text.includes(a.name) && x.kind !== 'act').slice(-6).map((x) => `giorno ${x.day}: ${x.text}`).join(' · ');
    const th = (a.thoughts || []).slice(-2).map((x) => x.text).join(' / ');
    if (a.alive || a.departed) { alive.push(c); mem[c.id] = `sei stato naufrago su un'isola deserta per ${G.day} giorni con ${G.agents.filter((o) => o !== a).map((o) => o.name).join(', ')}. ${G.ended ? 'Come è finita: ' + G.ended + '. ' : ''}Cose che ricordi: ${ev}${th ? '. Gli ultimi tuoi pensieri laggiù: ' + th : ''}`.slice(0, 1400); }
    else dead.push(`${a.name} (${a.deathCause || 'morto'}, giorno ${a.deathDay || '?'})`); });
  if (!alive.length) { setText($('tsIsleNote'), `Nell'ultima partita non è sopravvissuto nessuno${dead.length ? ': ' + dead.join(', ') : ''}. Puoi invitare altri personaggi e parlare di loro.`); TS.isleNote = dead.length ? `nell'ultima avventura sull'isola sono morti ${dead.join(', ')}` : ''; return; }
  document.querySelectorAll('#tsGuests input[type=checkbox]').forEach((x) => { x.checked = alive.some((c) => c.id === x.value); });
  TS.isleMem = mem; TS.isleNote = `${alive.map((c) => c.name).join(', ')} sono sopravvissuti a un naufragio su un'isola deserta (${G.day} giorni)${dead.length ? `; non ce l'hanno fatta: ${dead.join(', ')}` : ''}`;
  setText($('tsIsleNote'), `✓ In studio: ${alive.map((c) => c.name).join(', ')}, con i ricordi dell'isola.${dead.length ? ' Morti: ' + dead.join(', ') + ' (se ne potrà parlare).' : ''}`);
  if (!$('tsTopics').value.trim()) $('tsTopics').value = 'Come siete sopravvissuti?\nChi si è comportato peggio sull\'isola?\nVi siete perdonati?';
  tsCheckSetup();
}

/* ---------- end of the episode: podium, best lines, bets, report card, script, story, next episode ---------- */
function tsBest(n) { const w = (r) => /applausi$|ooh/.test(r || '') ? 3 : /risate|applaus/.test(r || '') ? 2 : /fischi/.test(r || '') ? 2 : r ? 1 : 0; return TS.s.lines.filter((l) => !l.sys && !l.director && !l.offair && l.text !== '(resta in silenzio)').map((l) => ({ l, w: w(l.react) + (l.text.length > 60 ? 0.5 : 0) })).sort((a, b) => b.w - a.w).filter((x, i, arr) => arr.findIndex((y) => y.l.text === x.l.text) === i).slice(0, n).map((x) => x.l); }
function tsBetsResult() { const s = TS.s; const b = s.bets || {}; const out = []; let pts = 0;
  if (b.win) { const ok = b.win === s.winner; pts += ok ? 3 : 0; out.push(`${ok ? '✓' : '✗'} Vincitore: hai detto ${b.win}, ha vinto ${s.winner || '—'}`); }
  if (b.leave) { const left = s.guests.some((g) => g.left); const ok = (b.leave === 'si') === left; pts += ok ? 1 : 0; out.push(`${ok ? '✓' : '✗'} Qualcuno se ne va: ${left ? 'sì' : 'no'}`); }
  if (b.secret) { const sec = s.guests.some((g) => g.secret === 'rivelato'); const ok = (b.secret === 'si') === sec; pts += ok ? 1 : 0; out.push(`${ok ? '✓' : '✗'} Un segreto viene fuori: ${sec ? 'sì' : 'no'}`); }
  return { out, pts }; }
function tsEndCard() {
  const s = TS.s; if (!s || !s.ended) return; const rank = s.guests.slice().sort((a, b) => (s.approval[b.name] || 0) - (s.approval[a.name] || 0)); const bets = tsBetsResult();
  const el = tsCard(`🏁 «${esc(s.title)}»: fine della puntata`, `<div class="tsPodium">${rank.slice(0, 3).map((g, i) => `<div class="pod p${i + 1}"><div class="medal">${['🥇', '🥈', '🥉'][i]}</div><b>${esc(g.name)}</b><small>gradimento ${Math.round(s.approval[g.name] || 0)}</small></div>`).join('')}</div>
   <h4>Le battute migliori</h4>${tsBest(5).map((l) => `<p class="best"><b>${esc(l.who)}</b>: «${esc(l.text)}» <small>👥 ${esc(l.react || '')}</small></p>`).join('')}
   ${bets.out.length ? `<h4>Le tue scommesse · ${bets.pts} punti</h4>${bets.out.map((x) => `<div>${esc(x)}</div>`).join('')}` : ''}
   <div id="tsReport" class="story"></div>
   <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px"><button id="tsRepBtn" title="Una chiamata a Claude">📝 Pagella del conduttore</button><button id="tsScript">⇩ Copione (.md)</button><button id="tsTr">⇩ Trascrizione (.md)</button><button id="tsStory" title="Una chiamata a Claude, poi PDF">📖 Racconto della puntata (PDF)</button><button id="tsReplayBtn" title="rivedi in studio i 5 momenti migliori">🎬 Rivedi i momenti migliori</button><button id="tsRep" title="Indicatori dei personaggi e del conduttore, relazioni, racconto: a schermo e in PDF">📊 Resoconto</button><button id="tsNext" class="primary">🔁 Prossima puntata della serie</button><button id="tsHomeEnd">⌂ Ambienti</button></div>`, true);
  if (s.report) $('tsReport').innerHTML = s.report;
  el.querySelector('#tsRepBtn').onclick = tsReportCard; el.querySelector('#tsScript').onclick = () => saveFile(`${normName(s.title).replace(/[^a-z0-9]+/g, '-')}-copione.md`, tsScriptMd());
  el.querySelector('#tsTr').onclick = () => saveFile(`${normName(s.title).replace(/[^a-z0-9]+/g, '-')}-trascrizione.md`, tsTranscriptMd());
  el.querySelector('#tsStory').onclick = (e) => tsStoryPdf(e.target); el.querySelector('#tsReplayBtn').onclick = () => { el.hidden = true; tsReplay(); }; el.querySelector('#tsRep').onclick = () => { el.hidden = true; tsOpenReport(); }; el.querySelector('#tsNext').onclick = () => { el.hidden = true; tsNextEpisode(); }; el.querySelector('#tsHomeEnd').onclick = () => { el.hidden = true; tsLeave(); homeShow(); };
}
async function tsReportCard() {
  const s = TS.s; const btn = document.getElementById('tsRepBtn'); if (btn) { btn.disabled = true; btn.textContent = '📝 Scrivo la pagella…'; }
  try { const out = await tsAsk(`Sei un critico televisivo severo ma giusto. Ecco la trascrizione di una puntata del talk show «${s.title}», condotta da ${s.host.name} con ${s.guests.map((g) => g.name).join(', ')}. Suggerimenti dalla regia al conduttore: ${s.ear.map((e) => `«${e.text}» (${e.state})`).join('; ') || 'nessuno'}.
Trascrizione:
${s.lines.map((l) => l.sys ? `[${l.text}]` : `${l.who} → ${l.to}: «${l.text}»${l.react ? ' (' + l.react + ')' : ''}`).join('\n').slice(-12000)}
Dai i voti da 1 a 10 al conduttore (ritmo, ironia, equità con gli ospiti, uso dei suggerimenti della regia) con una motivazione breve per ciascuno, e un voto con una riga di giudizio per ogni ospite. Usa i nomi esattamente come sono scritti.
Rispondi SOLO con JSON: {"conduttore":[{"voce":"ritmo","voto":n,"perche":"..."}],"ospiti":[{"nome":"...","voto":n,"giudizio":"..."}],"commento":"due frasi sulla puntata"}`);
    const html = `<h4>📝 Pagella</h4><p><b>${esc(s.host.name)}</b> (conduttore): ${(out.conduttore || []).map((v) => `${esc(v.voce)} <b>${v.voto}</b> <small>${esc(v.perche || '')}</small>`).join(' · ')}</p>${(out.ospiti || []).map((o) => `<p><b>${esc(o.nome)}</b> <b>${o.voto}</b>: ${esc(o.giudizio || '')}</p>`).join('')}<p><i>${esc(out.commento || '')}</i></p>`;
    s.report = html; tsSave(); if ($('tsReport')) $('tsReport').innerHTML = html; if (btn) btn.hidden = true;
  } catch (e) { toastMsg('⚠ Non riesco a scrivere la pagella ora: riprova.'); if (btn) { btn.disabled = false; btn.textContent = '📝 Pagella del conduttore'; } }
}
function tsScriptMd() { const s = TS.s; const L = [`# ${s.title}`, `### Copione della puntata del ${new Date(s.date).toLocaleDateString('it-IT')}`, '', `**Conduce:** ${s.host.name}  `, `**Ospiti:** ${s.guests.map((g) => g.name + (g.role ? ' (' + g.role + ')' : '')).join(', ')}`, '', '---', ''];
  s.lines.forEach((l) => { if (l.sys) L.push(`*${l.text.replace(/^[^\wÀ-ÿ]+/, '')}*`, ''); else { L.push(`**${l.who.toUpperCase()}**${l.tono || (l.to && l.to !== 'tutti') ? ` _(${[l.tono, l.to && l.to !== 'tutti' ? 'a ' + l.to : ''].filter(Boolean).join(', ')})_` : ''}  `, l.text, ''); if (l.react) L.push(`> _(il pubblico: ${l.react})_`, ''); } });
  return L.join('\n') + '\n'; }
async function tsWriteStory() { const s = TS.s; if (s.story) return s.story;
  const out = await tsAsk(`Sei uno scrittore. Racconta come un capitolo di romanzo la puntata del talk show televisivo «${s.title}», condotta da ${s.host.name}, con ospiti ${s.guests.map((g) => g.name + (g.role ? ' (' + g.role + ')' : '')).join(', ')}. Fedele ai fatti: usa le battute vere come dialoghi tra «», non inventare battute importanti né eventi, e chiama i personaggi ESATTAMENTE con questi nomi, anche se sembrano soprannomi. Racconta anche cosa pensavano davvero (lo trovi tra parentesi quadre come PENSA) e come sono cambiati i rapporti tra loro. Terza persona, passato remoto, ambientato nello studio televisivo. ${NOVEL_STYLE} 900-1300 parole, paragrafi separati da una riga vuota.
Trascrizione:\n${s.lines.map((l) => l.sys ? `[${l.text}]` : `${l.who} → ${l.to}${l.tono ? ' [' + l.tono + ']' : ''}: «${l.text}»${l.react ? ' (pubblico: ' + l.react + ')' : ''}${l.think ? ' [PENSA: ' + l.think + ']' : ''}`).join('\n').slice(-16000)}
Rispondi SOLO con JSON: {"titolo":"titolo del racconto","testo":"..."}`);
  s.story = { title: String(out.titolo || s.title), text: String(out.testo || '') }; tsSave(); return s.story; }
async function tsStoryPdf(btn) {
  const s = TS.s; const label = btn.textContent; btn.disabled = true; btn.textContent = '✍ Scrivo il racconto…';
  try {
    if (!s.story) await tsWriteStory();
    btn.textContent = '📖 Impagino…'; const { jsPDF } = await loadJsPDF(); const doc = new jsPDF({ unit: 'mm', format: 'a5' }); const PW = 148, PH = 210, MX = 18, TW = PW - 2 * MX; let y = 50;
    doc.setFont('times', 'bold'); doc.setFontSize(20); doc.splitTextToSize(pdfClean(s.story.title), TW).forEach((l) => { doc.text(l, PW / 2, y, { align: 'center' }); y += 9; });
    doc.setFont('times', 'italic'); doc.setFontSize(11); doc.text(pdfClean(`dal talk show «${s.title}»`), PW / 2, y + 4, { align: 'center' }); doc.addPage(); y = 22;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5); s.story.text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean).forEach((p, k) => { doc.splitTextToSize(pdfClean((k ? '      ' : '') + p), TW).forEach((l) => { if (y > PH - 20) { doc.addPage(); y = 22; } doc.text(l, MX, y); y += 4.7; }); y += 1; });
    const n = doc.getNumberOfPages(); for (let i = 2; i <= n; i++) { doc.setPage(i); doc.setFontSize(8.5); doc.text(String(i), PW / 2, PH - 10, { align: 'center' }); }
    const r = await saveFile(`${normName(s.title).replace(/[^a-z0-9]+/g, '-')}-racconto.pdf`, doc.output('blob')); if (r !== 'error') toastMsg(r === 'declined' ? 'Download annullato: il racconto resta pronto.' : `📖 Racconto salvato (${n} pagine).`);
  } catch (e) { toastMsg('⚠ Non riesco a scrivere il racconto ora: riprova.'); } finally { btn.disabled = false; btn.textContent = label; }
}
async function tsNextEpisode() {
  const s = TS.s; toastMsg('🔁 Preparo la prossima puntata: riassumo questa per la memoria di conduttore e ospiti…'); let prev = '';
  try { const out = await tsAsk(`Riassumi in 5-7 frasi, fedeli ai fatti e con i nomi esatti, cosa è successo in questa puntata del talk show «${s.title}» (chi ha litigato con chi, chi ha vinto, frasi memorabili, chi se n'è andato, segreti emersi):
${s.lines.map((l) => l.sys ? `[${l.text}]` : `${l.who} → ${l.to}: «${l.text}»`).join('\n').slice(-12000)}
Rispondi SOLO con JSON: {"riassunto":"..."}`); prev = String(out.riassunto || '').slice(0, 1500); } catch (e) { prev = `vinse ${s.winner || 'nessuno'}; ${tsBest(3).map((l) => l.who + ': «' + l.text + '»').join(' ')}`; }
  TS.cfg = { title: s.title, host: s.host.archId, guests: s.guests.filter((g) => !g.left).map((g) => g.archId), style: s.style, audience: s.audience, series: { n: ((s.series && s.series.n) || 1) + 1, prev } };
  tsLeave(); tsOpenSetup();
}

/* Home at start, unless an island game is being resumed automatically */
setTimeout(() => { let auto = null; try { auto = sessionStorage.getItem('isola-autostart') || sessionStorage.getItem('isola-autoresume'); } catch (e) {} if (!auto && !(ENG.G && ENG.G.running)) homeShow(); }, 50);
window.__TS = TS;
