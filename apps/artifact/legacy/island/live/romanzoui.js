/* ---------- Il romanzo: text interface (setup, plan, chapter by chapter, notebook, interventions, book) ----------
   All story rules live in romanzo.js (ROMANZO); this file only renders and wires. */
const RM_SAVE = 'romanzo-opera', RM_PREFS = 'romanzo-prefs', RM_BOOKS = 'romanzo-libri', RM_SERIES = 'romanzo-serie';
/** Finished books kept in full in the browser; older ones are dropped (localStorage is small). */
const RM_KEEP_BOOKS = 10;
const RM = { N: null, S: null, running: false, pause: false, step: '', busy: false };
const RM_VIS_LABEL = { coautore: '🖋 Coautore: vedi tutto il piano e lo approvi', complice: '🔎 Complice: vedi la domanda e le tappe man mano', lettore: '📖 Lettore: tutto segreto fino alla fine' };
/** Minds for the novel, strongest first. */
const RM_MINDS = [['fable', 'Fable: la più forte'], ['opus', 'Opus: profonda'], ['sonnet', 'Sonnet: equilibrata'], ['haiku', 'Haiku: veloce e leggera']];
const RM_STEP_LABEL = { finale: 'l\'autore sceglie il finale', scena: 'l\'autore prepara la scena', personaggi: 'i personaggi decidono', scrittura: 'l\'autore scrive', controllo: 'l\'editor controlla', correzione: 'l\'autore corregge', lettore: 'il lettore onesto legge', revisione: 'l\'autore ritocca i capitoli precedenti', pignolo: 'il lettore pignolo controlla le frasi' };

function rmPrefs() { try { return JSON.parse(localStorage.getItem(RM_PREFS) || '{}'); } catch (e) { return {}; } }
function rmSavePrefs(p) { try { localStorage.setItem(RM_PREFS, JSON.stringify(p)); } catch (e) {} }
function rmLoad() { try { const n = JSON.parse(localStorage.getItem(RM_SAVE) || 'null'); return n && n.v === 1 ? n : null; } catch (e) { return null; } }
function rmSave() { try { localStorage.setItem(RM_SAVE, JSON.stringify(RM.N)); return true; } catch (e) { toastMsg('⚠ Spazio del browser pieno: scarica il libro per non perderlo.'); return false; } }
function rmSeries() { try { return JSON.parse(localStorage.getItem(RM_SERIES) || '[]'); } catch (e) { return []; } }
/** Saves (inserts or replaces) one series; series keep their volumes' text, so they are never trimmed. */
function rmPutSeries(Ser) { const L = rmSeries().filter((x) => x.id !== Ser.id); L.push(Ser); try { localStorage.setItem(RM_SERIES, JSON.stringify(L)); return true; } catch (e) { toastMsg('⚠ Spazio del browser pieno: scarica i libri della serie.'); return false; } }
const rmSeriesOf = (N) => (N && N.series ? rmSeries().find((x) => x.id === N.series.id) : null);
function rmBooks() { try { return JSON.parse(localStorage.getItem(RM_BOOKS) || '[]'); } catch (e) { return []; } }
function rmBlankSetup() { const p = rmPrefs(); return { title: '', genre: p.genre || '', style: '', styleCustom: '', pages: p.pages || 25, grade: '', setting: '', tone: '', idea: '', must: [], mustNot: [], characters: [] }; }

function rmEnsure() {
  if ($('rmView')) return; const v = document.createElement('div'); v.id = 'rmView'; v.hidden = true; v.setAttribute('role', 'main'); document.body.appendChild(v);
  v.addEventListener('click', rmClick); v.addEventListener('change', rmChange); v.addEventListener('input', rmInput);
}
function rmShow(html) { rmEnsure(); const v = $('rmView'); v.innerHTML = html; v.hidden = false; window.__ventureActive = true; window.__romanzoActive = true; /* the island loop sleeps while we write */ homeHide && homeHide(); }
function rmLeave() { RM.pause = true; LLM.setLight(''); /* other environments keep their own light mind */ if ($('rmView')) $('rmView').hidden = true; window.__ventureActive = false; window.__romanzoActive = false; homeShow(); }
const rmTop = (title, extra) => `<header class="rmTop"><h1>📖 ${esc(title)}</h1><span class="rmGrow"></span>${extra || ''}<button data-rm="home" title="Torna agli ambienti: l'opera resta salvata">⌂ Ambienti</button></header>`;

/* ---------- 1. setup: guided questions or a romanzo/1 file ---------- */
function rmOpenSetup(S) {
  RM.S = S || RM.S || rmBlankSetup(); rmRenderSetup();
}
function rmRenderSetup() {
  const S = RM.S, p = rmPrefs(), G = ROMANZO.GENRES, g = G[S.genre]; const styles = typeof NOVEL_STYLES !== 'undefined' ? NOVEL_STYLES : {};
  const est = ROMANZO.estimate(S.pages, { revise: p.revise !== false, secondDraft: !!p.secondDraft, series: !!(S.series || S.seriesId) }); const reason = ROMANZO.checkSetup(S);
  const arch = (typeof ARCH !== 'undefined' ? ARCH.chars : []).filter((c) => !c.disabled && c.status !== 'deceduto' && !S.characters.some((x) => x.name === c.name)).sort((a, b) => a.name.localeCompare(b.name));
  const eraName = { romanzo: '📖 Romanzo', presente: '🏝 Presente', futuro: '🚀 Futuro' }; const archOpts = ['romanzo', 'presente', 'futuro'].map((e) => { const l = arch.filter((c) => archEra(c) === e); return l.length ? `<optgroup label="${eraName[e]}">${l.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} · ${esc((c.short || '').slice(0, 50))}</option>`).join('')}</optgroup>` : ''; }).join('');
  const SL = rmSeries(), K = ROMANZO.SERIES_KINDS; const cur = S.seriesId ? SL.find((x) => x.id === S.seriesId) : null;
  const serBox = `<fieldset><legend>📚 Serie</legend><select id="rmSerMode" aria-label="Serie"><option value="">Romanzo singolo</option><option value="new"${S.series ? ' selected' : ''}>Nuova serie: questo è il volume 1</option>${SL.filter((x) => x.books.length < x.volumes && !rmPendingLegacy(x)).map((x) => `<option value="${esc(x.id)}"${cur && cur.id === x.id ? ' selected' : ''}>Volume ${x.books.length + 1} di «${esc(x.title)}»</option>`).join('')}</select>
    ${S.series ? `<label>Titolo della serie <input id="rmSerTitle" value="${esc(S.series.title)}" maxlength="90"></label><label>Tipo <select id="rmSerKind">${Object.entries(K).map(([k, x]) => `<option value="${k}"${S.series.kind === k ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><p class="rmMuted">${esc(K[S.series.kind].text)}</p><label>Volumi <input id="rmSerVol" type="number" min="${ROMANZO.MIN_VOLUMES}" max="${ROMANZO.MAX_VOLUMES}" value="${S.series.volumes}"></label><label>Filo comune o idea della serie <textarea id="rmSerThread" rows="3" maxlength="1200">${esc(S.series.thread)}</textarea></label>` : ''}
    ${cur ? `<p class="rmMuted">${esc(K[cur.kind].name)} · ${cur.books.length} volum${cur.books.length === 1 ? 'e scritto' : 'i scritti'}: ${cur.books.map((b) => '«' + esc(b.title) + '»').join(', ')}${cur.plan ? '<br>Filo: ' + esc(cur.plan.question) : ''}</p><p class="rmMuted">I personaggi tornano con ciò che hanno vissuto; «✨ Aiutami» propone l'idea del nuovo volume.</p>` : ''}</fieldset>`;
  const chRow = (c, i) => `<div class="rmChar"><input data-ci="${i}" data-cf="name" value="${esc(c.name)}" placeholder="Nome" aria-label="Nome"><select data-ci="${i}" data-cf="role" aria-label="Ruolo">${ROMANZO.ROLES.map((r) => `<option${c.role === r ? ' selected' : ''}>${r}</option>`).join('')}</select><select data-ci="${i}" data-cf="sex" aria-label="Sesso"><option value="f"${c.sex === 'f' ? ' selected' : ''}>donna</option><option value="m"${c.sex !== 'f' ? ' selected' : ''}>uomo</option></select><input data-ci="${i}" data-cf="age" type="number" min="1" max="999" value="${esc(c.age)}" aria-label="Età"><button data-rm="delchar" data-i="${i}" aria-label="Togli ${esc(c.name)}">✕</button>
    <input data-ci="${i}" data-cf="temper" value="${esc(c.temper)}" placeholder="Carattere" class="rmWide"><input data-ci="${i}" data-cf="wants" value="${esc(c.wants)}" placeholder="Cosa vuole" class="rmHalf"><input data-ci="${i}" data-cf="fears" value="${esc(c.fears)}" placeholder="Cosa teme" class="rmHalf"></div>`;
  rmShow(`${rmTop('Il romanzo · nuova storia')}<div class="rmSetup"><div class="rmForm">
   <p class="rmLead">Racconta l'idea: un autore la trasformerà in un romanzo, i personaggi vivranno la loro vita e tu seguirai la scrittura capitolo per capitolo. Puoi anche caricare un file .md o farti aiutare.</p>
   <div class="rmRow"><button data-rm="help" ${RM.busy ? 'disabled' : ''}>✨ Aiutami a completare</button><button data-rm="tpl">⇩ Modello .md</button><label class="rmFile">⇪ Carica .md<input id="rmFile" type="file" accept=".md,.txt,text/plain" hidden></label><button data-rm="paste" title="Incolla il testo di un file .md della storia">📋 Incolla .md</button></div>
   <label>Genere <select id="rmGenre"><option value="">— scegli —</option>${Object.entries(G).map(([k, x]) => `<option value="${k}"${S.genre === k ? ' selected' : ''}>${x.name}</option>`).join('')}</select></label>${g ? `<p class="rmMuted">${esc(g.rules)}</p>` : ''}
   <label>Titolo (facoltativo) <input id="rmTitle" value="${esc(S.title)}" maxlength="90"></label>
   <label>L'idea, in qualche riga <textarea id="rmIdea" rows="4" maxlength="2000">${esc(S.idea)}</textarea></label>
   <div class="rmRow"><label class="rmHalf">Ambientazione <input id="rmSetting" value="${esc(S.setting)}" maxlength="400"></label><label class="rmHalf">Tono <input id="rmTone" value="${esc(S.tone)}" maxlength="200"></label></div>
   <div class="rmRow"><label class="rmHalf">Deve succedere (una per riga) <textarea id="rmMust" rows="2">${esc((S.must || []).join('\n'))}</textarea></label><label class="rmHalf">Non deve succedere <textarea id="rmMustNot" rows="2">${esc((S.mustNot || []).join('\n'))}</textarea></label></div>
   <h2>Personaggi</h2>${S.characters.map(chRow).join('') || '<p class="rmMuted">Ancora nessuno.</p>'}
   <div class="rmRow"><button data-rm="addchar">＋ Nuovo personaggio</button>${arch.length ? `<select id="rmFromArch" aria-label="Dall'archivio"><option value="">👥 Dall'archivio (tutte le sezioni)…</option>${archOpts}</select>` : ''}</div>
  </div><aside class="rmSide"><h2>Come sarà</h2>
   <label>Pagine <input id="rmPages" type="number" min="10" max="120" value="${S.pages}"></label><p class="rmMuted">${est.chapters} capitoli di circa ${ROMANZO.CHAPTER_WORDS} parole.</p>
   ${serBox}
   <label>Stile dell'autore <select id="rmStyle"><option value="">${g ? 'Suggerito: ' + esc((styles[g.style] || {}).name || g.style) : 'Suggerito dal genere'}</option>${Object.entries(styles).map(([k, x]) => `<option value="${k}"${S.style === k ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="libero"${S.style === 'libero' ? ' selected' : ''}>✍ Stile mio…</option></select></label>
   ${S.style === 'libero' ? `<label>Descrivi lo stile <textarea id="rmStyleCustom" rows="3" maxlength="600" placeholder="frasi corte, tanto sarcasmo, niente descrizioni…">${esc(S.styleCustom)}</textarea></label>` : ''}
   <label>Grado di piano <select id="rmGrade"><option value="">${g ? 'Suggerito: ' + esc(g.grade) : 'Suggerito dal genere'}</option>${Object.entries(ROMANZO.GRADES).map(([k, x]) => `<option value="${k}"${S.grade === k ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
   <fieldset><legend>Il piano dell'autore</legend>${ROMANZO.VISIBILITY.slice().reverse().map((k) => `<label class="rmRadio"><input type="radio" name="rmVis" value="${k}"${(p.visibility || 'complice') === k ? ' checked' : ''}> ${RM_VIS_LABEL[k]}</label>`).join('')}<p class="rmMuted">Durante la scrittura puoi passare a vedere di più, mai di meno.</p></fieldset>
   <fieldset><legend>Menti</legend><p class="rmLbl">Autore e scrittura</p><div class="rmMinds" role="radiogroup" aria-label="Mente dell'autore">${RM_MINDS.map(([k, l]) => `<label title="${esc(l)}"><input type="radio" name="rmMindMain" value="${k}"${(p.mind || 'sonnet') === k ? ' checked' : ''}><span>${esc(l.split(':')[0])}</span></label>`).join('')}</div><p class="rmLbl">Personaggi, editor e lettore</p><div class="rmMinds" role="radiogroup" aria-label="Mente dei personaggi">${RM_MINDS.map(([k, l]) => `<label title="${esc(l)}"><input type="radio" name="rmMindLight" value="${k}"${(p.light || 'haiku') === k ? ' checked' : ''}><span>${esc(l.split(':')[0])}</span></label>`).join('')}</div><p class="rmMuted">Le menti più forti scrivono meglio ma consumano di più del tuo piano e sono più lente. Se la piattaforma non ne offre una, si passa da sola alla successiva.</p></fieldset>
   <label class="rmRadio"><input type="checkbox" id="rmRevise"${p.revise !== false ? ' checked' : ''}> Revisione all'indietro a ogni tappa</label>
   <label class="rmRadio"><input type="checkbox" id="rmDraft"${p.secondDraft ? ' checked' : ''}> Seconda stesura finale (−10%, ${est.chapters} chiamate in più)</label>
   <p><b>Stima:</b> ~${est.total} chiamate, ${est.minutes[0]}–${est.minutes[1]} minuti.</p>
   <button class="rmPrimary" data-rm="plan" ${reason || RM.busy ? 'aria-disabled="true"' : ''}>🖋 Fai il piano della storia</button><p id="rmStatus" role="status" class="${reason ? 'rmNote' : 'rmMuted'}">${reason || 'Pronto: l\'autore prepara il piano (1 chiamata).'}</p>
   ${rmLoad() && rmLoad().status !== 'ended' ? '<p><button data-rm="resume">▶ Riprendi l\'opera in corso</button></p>' : ''}${rmBooks().length ? '<p><button data-rm="books">📚 Libri scritti</button></p>' : ''}
  </aside></div>`);
}
function rmReadForm() {
  const S = RM.S; const v = (id) => ($(id) || {}).value; if (!$('rmIdea')) return;
  S.title = v('rmTitle') || ''; S.idea = v('rmIdea') || ''; S.setting = v('rmSetting') || ''; S.tone = v('rmTone') || ''; S.pages = +v('rmPages') || 25;
  S.must = (v('rmMust') || '').split('\n').map((x) => x.trim()).filter(Boolean); S.mustNot = (v('rmMustNot') || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if ($('rmStyleCustom')) S.styleCustom = v('rmStyleCustom');
  if (S.series && $('rmSerTitle')) { S.series.title = v('rmSerTitle') || ''; S.series.volumes = +v('rmSerVol') || 3; S.series.thread = v('rmSerThread') || ''; }
}

/** One line (or a short block) about the series, filtered by what the plan view allows. */
function rmSeriesBox(V, long) {
  const s = V && V.series; if (!s) return ''; const K = ROMANZO.SERIES_KINDS[s.kind];
  return `<div class="rmSer"><b>📚 «${esc(s.title)}»</b> · volume ${s.n} di ${s.volumes} · ${esc(K.name)}${s.question ? `<br>${s.kind === 'ciclo' ? 'Filo comune' : 'Domanda della serie'}: ${esc(s.question)}` : ''}${long && s.steps ? `<ol>${s.steps.map((x) => `<li${x.n === s.n ? ' class="ok"' : ''}>${esc(x.fact)}${x.n === s.n ? ' <small>(questo volume)</small>' : ''}</li>`).join('')}</ol>` : ''}${long && s.ending ? `<p><b>Finale della serie:</b> ${esc(s.ending)}</p>` : ''}</div>`;
}
/* ---------- 2. the plan ---------- */
async function rmMakePlan() {
  rmReadForm(); const S = RM.S; const why = ROMANZO.checkSetup(S); if (why) { toastMsg(why); return; } const p = rmPrefs();
  const Ser = S.seriesId ? rmSeries().find((x) => x.id === S.seriesId) : S.series ? ROMANZO.newSeries(S) : null;
  const N = ROMANZO.newWork(S, { visibility: p.visibility || 'complice', mind: p.mind, light: p.light || 'haiku', revise: p.revise !== false, secondDraft: !!p.secondDraft, series: Ser });
  const est = ROMANZO.estimate(S.pages, Object.assign({}, p, { series: !!Ser })); N.cap = Math.round(est.total * 1.3); LLM.reset(); LLM.setMind(N.mind); LLM.setLight(N.light);
  RM.busy = true; $('rmStatus').textContent = Ser && !Ser.plan ? '📚 L\'autore sta facendo il piano della serie e del primo volume…' : '🖋 L\'autore sta facendo il piano…';
  const ok = await ROMANZO.makePlan(N, LLM.ask); RM.busy = false;
  if (!ok) { toastMsg('L\'autore non è riuscito a fare il piano: riprova (forse serve almeno un personaggio in più o un\'idea più chiara).'); rmRenderSetup(); return; }
  if (Ser) { Ser.plan = Ser.plan || N.series.plan; rmPutSeries(Ser); }
  RM.N = N; rmSave(); rmRenderPlan();
}
function rmRenderPlan() {
  const N = RM.N, V = ROMANZO.planView(N), P = N.plan;
  const body = V.full ? `<p class="rmMuted">Sei coautore: puoi correggere il piano prima di cominciare. I personaggi saranno comunque liberi.</p>
    <label>Domanda centrale <textarea id="rmPQ" rows="2">${esc(P.question)}</textarea></label>
    <label>Leggi della premessa (una per riga) <textarea id="rmPL" rows="3">${esc(P.laws.join('\n'))}</textarea></label>
    ${P.world ? `<details><summary>🗺 Carta del mondo</summary><p>${esc(P.world.history.join(' · '))}</p><ul>${P.world.places.map((l) => `<li><b>${esc(l.name)}</b>: ${esc(l.text)} ${esc(l.dist)}</li>`).join('')}</ul><p>Calendario: ${esc(P.world.calendar)}</p><p>Nomi: ${esc(P.world.names)}</p></details>` : ''}
    ${P.dossier ? `<details open><summary>🔍 Dossier del delitto</summary><p><b>Colpevole:</b> ${esc(P.dossier.culprit)} · <b>movente:</b> ${esc(P.dossier.motive)} · <b>metodo:</b> ${esc(P.dossier.method)}</p><p><b>Chi indaga:</b> ${esc(P.dossier.detective)}</p><ul>${P.dossier.clues.map((c) => `<li>Cap. ${c.chapter}: ${esc(c.text)} <i>(camuffato: ${esc(c.disguise)})</i></li>`).join('')}</ul><p><b>Falsa soluzione:</b> ${esc(P.dossier.falseSolution.suspect)} — ${esc(P.dossier.falseSolution.clues.join('; '))}</p></details>` : ''}
    <label>Finale ${N.setup.grade === 'situazione' ? '(si sceglierà verso il 75%)' : ''} <textarea id="rmPE" rows="3"${N.setup.grade === 'situazione' ? ' disabled' : ''}>${esc(P.ending.text)}</textarea></label>
    <h3>Tappe</h3>${P.stages.map((s, i) => `<label>${i + 1}. ${s.final ? 'Finale' : 'Tappa'} (cap. ~${s.chapter}) <textarea data-ps="${i}" rows="2">${esc(s.fact)}</textarea></label>`).join('')}
    <details><summary>🤫 Segreti dei personaggi</summary><ul>${N.cast.map((c) => `<li><b>${esc(c.name)}</b>: ${esc(c.secret)}</li>`).join('')}</ul></details>`
    : V.question ? `<p class="rmBig">❓ ${esc(V.question)}</p><p>La storia ha <b>${V.stagesTotal} tappe</b>: le vedrai quando verranno raggiunte. Il finale resta segreto.</p>` : `<p class="rmBig">Il piano è pronto ed è segreto: lo scoprirai leggendo, e alla fine vedrai com'era.</p>`;
  rmShow(`${rmTop(N.setup.title || 'Il romanzo')}<div class="rmPlan">${rmSeriesBox(V, true)}<h2>Il piano dell'autore</h2>${body}
    <div class="rmRow"><button class="rmPrimary" data-rm="start">▶ ${V.full ? 'Approva e comincia' : 'Comincia a scrivere'}</button>${V.full ? '<button data-rm="replan">↻ Rifai il piano</button>' : ''}<span class="rmLbl">Ritmo</span><span class="rmMinds" role="radiogroup" aria-label="Ritmo">${[['capitolo', 'capitolo per capitolo'], ['continuo', 'continuo']].map(([k, l]) => `<label><input type="radio" name="rmMode" value="${k}"${(rmPrefs().mode === 'continuo') === (k === 'continuo') ? ' checked' : ''}><span>${l}</span></label>`).join('')}</span></div></div>`);
}
function rmApplyPlanEdits() {
  const N = RM.N, P = N.plan; if (!$('rmPQ')) return;
  P.question = $('rmPQ').value.trim().slice(0, 300) || P.question; P.laws = $('rmPL').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 4);
  if ($('rmPE') && !$('rmPE').disabled) P.ending.text = $('rmPE').value.trim().slice(0, 800);
  document.querySelectorAll('[data-ps]').forEach((t) => { const s = P.stages[+t.dataset.ps]; if (s && t.value.trim()) s.fact = t.value.trim().slice(0, 300); });
}

/* ---------- 3. writing, chapter by chapter ---------- */
function rmOpenWork(N) { N.quality = N.quality || { chapters: [], final: null }; N.ledger = N.ledger || { rule: '', timeline: [], facts: [], beats: [], recurring: [] }; RM.N = N; LLM.setMind(N.mind); LLM.setLight(N.light || 'haiku'); rmRenderWork(); }
function rmRenderWork() {
  const N = RM.N; if (!N) return; const V = ROMANZO.planView(N), end = N.status === 'ended';
  const pages = Math.round(N.chapters.reduce((t, c) => t + (c.words || 0), 0) / ROMANZO.WORDS_PER_PAGE);
  const book = N.chapters.map((c) => `<article class="rmCh" id="rmCh${c.n}"><h2><span>${c.n}</span> ${esc(c.title)}</h2>${c.text.split(/\n\s*\n|\n/).filter((x) => x.trim()).map((x) => `<p>${esc(x)}</p>`).join('')}</article>`).join('') || '<p class="rmMuted rmEmpty">Il primo capitolo arriverà qui.</p>';
  rmShow(`${rmTop(N.novel ? N.novel.title : N.setup.title || 'Il romanzo', `<span class="rmPill">${N.chapters.length}/~${N.target} capitoli · ~${pages} pagine</span>`)}
   <div class="rmWork"><main class="rmBook" id="rmBook" tabindex="-1">${book}<div id="rmStep" class="rmStep" role="status"></div>${end ? rmEndBox() : ''}</main>
   <aside class="rmNote" aria-label="Taccuino dell'autore">${rmNotebook(V)}</aside></div>`);
  rmStepSync(); const b = $('rmBook'); if (b) b.scrollTop = b.scrollHeight;
}
function rmNotebook(V) {
  const N = RM.N, end = N.status === 'ended', full = V.full; const open = N.promises.filter((p) => !p.closed), gags = N.promises.filter((p) => p.kind === 'gag');
  const stages = full ? N.plan.stages.map((s) => `<li class="${s.reached ? 'ok' : ''}">${s.reached ? '✓' : '○'} ${esc(s.fact)} <small>${s.reached ? 'cap. ' + s.reached : '~cap. ' + s.chapter}</small></li>`).join('')
    : V.stages ? V.stages.map((s) => `<li class="ok">✓ ${esc(s.fact)} <small>cap. ${s.reached}</small></li>`).join('') + `<li>○ ancora ${V.stagesTotal - V.stages.length} da scoprire</li>` : `<li>${V.stagesReached} di ${V.stagesTotal} tappe raggiunte</li>`;
  const last = N.reader[N.reader.length - 1]; const reader = !last ? '' : full ? `<p>🧐 Lettore onesto (cap. ${last.ch}): «${esc(last.guess)}» (${last.sure}%)${last.why ? ' — ' + esc(last.why) : ''}${last.bored.length ? '<br>si annoia: ' + esc(last.bored.join('; ')) : ''}${last.lost.length ? '<br>non capisce: ' + esc(last.lost.join('; ')) : ''}</p>` : `<p>🧐 ${esc((N.log.filter((l) => l.kind === 'reader').slice(-1)[0] || {}).text || '')}</p>`;
  const alive = N.cast.filter((c) => c.alive), deadC = N.cast.filter((c) => !c.alive);
  return `<h2>Taccuino dell'autore</h2>${rmSeriesBox(V, false)}${V.question ? `<p class="rmQ">❓ ${esc(V.question)}</p>` : ''}${V.endingChanged ? '<p class="rmNote">⚠ Il finale è cambiato rispetto al piano.</p>' : ''}
   <h3>Tappe</h3><ul class="rmStages">${stages}</ul>
   <h3>Promesse aperte (${open.length})</h3><ul class="rmProm">${open.slice(-8).map((p) => `<li>${p.kind === 'gag' ? '😄' : p.kind === 'indizio' ? '🔍' : '•'} ${esc(p.text)}</li>`).join('') || '<li>nessuna</li>'}</ul>${gags.length ? `<p class="rmMuted">Gag seminate: ${gags.length}, ripagate: ${gags.filter((p) => p.closed).length}</p>` : ''}
   <h3>Personaggi</h3><ul class="rmCast">${alive.map((c) => `<li><button data-rm="person" data-n="${esc(c.name)}">${esc(c.name)}</button> <small>${esc(c.role)}${c.late ? ' · entrato tardi' : ''}</small>${c.now ? `<br><small>vuole: ${esc(c.now)}</small>` : ''}${full && c.secret ? `<br><small>🤫 ${esc(c.secret)}</small>` : ''}${full && c.lastThought ? `<br><small>💭 ${esc(c.lastThought)}</small>` : ''}</li>`).join('')}${deadC.map((c) => `<li class="dead">† ${esc(c.name)} <small>cap. ${c.died}</small></li>`).join('')}</ul>
   ${reader}${N.quality && N.quality.chapters.length ? `<p class="rmMuted">🔎 Lettore pignolo: ${N.quality.chapters.reduce((t, c) => t + c.fixed, 0)} frasi corrette finora${N.quality.chapters.some((c) => c.residual.length) ? ' · da rivedere: ' + esc(N.quality.chapters.flatMap((c) => c.residual.map((r) => 'cap. ' + c.n + ': ' + r.text)).slice(-2).join('; ')) : ''}.</p>` : ''}${N.checks.filter((k) => k.fixed).length ? `<p class="rmMuted">✎ Controlli: ${N.checks.filter((k) => k.fixed).length} capitoli corretti dall'editor.</p>` : ''}
   ${end ? '' : `<h3>Intervieni</h3><div class="rmInt">
     <div class="rmRow">${RM.running ? '<button data-rm="pause">⏸ Fermati dopo questo capitolo</button>' : `<button class="rmPrimary" data-rm="write">▶ ${N.chapters.length ? 'Scrivi il prossimo capitolo' : 'Scrivi il primo capitolo'}</button>`}</div>
     <div class="rmRow"><span class="rmLbl">Ritmo</span><span class="rmMinds" role="radiogroup" aria-label="Ritmo">${[['capitolo', 'capitolo per capitolo'], ['continuo', 'continuo']].map(([k, l]) => `<label><input type="radio" name="rmMode" value="${k}"${(rmPrefs().mode === 'continuo') === (k === 'continuo') ? ' checked' : ''}><span>${l}</span></label>`).join('')}</span></div>
     <label>Fai succedere <input id="rmEv" maxlength="300" placeholder="Es. salta la corrente in tutta la villa"></label><button data-rm="event">Accadrà nel prossimo capitolo</button>
     <label>Sussurra a <select id="rmWho">${alive.map((c) => `<option>${esc(c.name)}</option>`).join('')}</select></label><input id="rmWh" maxlength="200" placeholder="Un pensiero che sentirà come suo"><button data-rm="whisper">💭 Sussurra</button>
     <div class="rmRow"><button data-rm="kill">† Fai morire…</button><button data-rm="add">＋ Aggiungi un personaggio</button></div>
     <div class="rmRow">${N.chapters.length ? '<button data-rm="redo">↻ Riscrivi l\'ultimo capitolo</button>' : ''}${N.visibility !== 'coautore' ? `<button data-rm="vis">👁 Vedi di più del piano</button>` : ''}</div>
     ${N.director.events.length || N.director.kills.length || N.director.adds.length || Object.keys(N.director.whispers).length ? `<p class="rmMuted">In attesa per il prossimo capitolo: ${[...N.director.events.map((e) => '«' + esc(e.slice(0, 40)) + '»'), ...N.director.kills.map((k) => '† ' + esc(k)), ...N.director.adds.map((c) => '＋ ' + esc(c.name)), ...Object.keys(N.director.whispers).map((n) => '💭 ' + esc(n))].join(' · ')}</p>` : ''}
   </div>`}
   <p class="rmMuted">🧠 Autore: ${esc(rmMindName(N.mind))} · personaggi: ${esc(rmMindName(N.light || 'haiku'))}${LLM.refused().length ? ` · non disponibili qui: ${esc(LLM.refused().join(', '))} (uso la successiva)` : ''}</p>
   <div class="rmRow"><button data-rm="book" ${N.chapters.length ? '' : 'disabled'}>📘 Libro</button><button data-rm="report" ${N.chapters.length ? '' : 'disabled'}>📊 Resoconto</button></div>`;
}
const rmMindName = (k) => (RM_MINDS.find((x) => x[0] === k) || [k, k])[1].split(':')[0];
function rmStepSync() { const s = $('rmStep'); if (s) s.innerHTML = RM.running ? `<span class="rmSpin" aria-hidden="true"></span> Capitolo ${RM.stepN || RM.N.chapters.length + 1}: ${esc(RM_STEP_LABEL[RM.step] || RM.step || 'in corso')}…` : ''; }
async function rmRun() {
  const N = RM.N; if (RM.running || !N || N.status === 'ended') return; RM.running = true; RM.pause = rmPrefs().mode !== 'continuo'; rmRenderWork();
  try {
    do {
      const s = LLM.stats(); if (N.cap && s.light + s.main >= N.cap) { toastMsg('Raggiunto il tetto di chiamate di questa opera: puoi alzarlo ricominciando, o scaricare il libro così com\'è.'); break; }
      RM.stepN = N.chapters.length + 1; const ch = await ROMANZO.writeChapter(N, { ask: LLM.ask, onStep: (st) => { RM.step = st; rmStepSync(); }, onChapter: () => { /* show the chapter at once: the reader and the revision may still be working on it */ rmSave(); rmRenderWork(); } });
      N.callStats = LLM.stats(); rmSave();
      if (!ch) { toastMsg('Il capitolo non è stato scritto: riprova tra poco.'); break; }
      rmRenderWork(); const el = $('rmCh' + ch.n); if (el) el.scrollIntoView({ block: 'start' });
    } while (!RM.pause && N.status !== 'ended');
  } finally { RM.running = false; RM.step = ''; if (N.status === 'ended') { await rmFinalCheck(N); rmFinished(); } rmRenderWork(); }
}
/** End of a book: the final reading of the whole text (contradictions, events told twice), once. */
async function rmFinalCheck(N) {
  N.quality = N.quality || { chapters: [], final: null }; N.ledger = N.ledger || { rule: '', timeline: [], facts: [], beats: [], recurring: [] }; if (N.quality.final || !N.chapters.length) return;
  RM.busy = true; try { await ROMANZO.finishBook(N, LLM.ask, (t) => toastMsg('🔎 ' + t + '…', true)); rmSave(); const q = ROMANZO.qualitySummary(N.quality); toastMsg(`🔎 Rilettura finita: ${q.sentences} frasi corrette, ${rmPlural(q.rewrites, 'capitolo riscritto', 'capitoli riscritti')}.`); }
  catch (e) { toastMsg('⚠ La rilettura finale non è riuscita: puoi rifarla con «🛠 Revisione del testo».'); } finally { RM.busy = false; }
}
/** «1 capitolo riscritto», «2 capitoli riscritti». */
const rmPlural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** Style text of a setup (chapters rewritten outside the full pipeline). */
function rmStyleOf(S) { if (S.style === 'libero' && S.styleCustom) return 'STILE: ' + S.styleCustom; const T = typeof NOVEL_STYLES !== 'undefined' ? NOVEL_STYLES : {}; return (T[S.style] || T.asimov || { text: '' }).text; }
/** «🛠 Revisione del testo» on any finished book: ledger from the text, final reading, picky reader on every chapter. */
async function rmRevise(chapters, ctx) {
  if (RM.busy) { toastMsg('Attendi…'); return null; } RM.busy = true; let res = null;
  try { res = await ROMANZO.revise(chapters, ctx, LLM.ask, (t) => toastMsg('🛠 ' + t + '…', true)); } catch (e) { res = null; } finally { RM.busy = false; }
  if (!res) { toastMsg('⚠ La revisione non è riuscita: riprova.'); return null; }
  const r = res.report; toastMsg(`🛠 Revisione fatta: ${r.fixed} frasi corrette, ${rmPlural(r.rewrites, 'capitolo riscritto', 'capitoli riscritti')}.`);
  funCard('🛠 Revisione del testo', `<p><b>${esc(ctx.title || 'Il libro')}</b>: ${r.fixed} frasi corrette dal lettore pignolo e dalla rilettura, ${r.rewrites} capitol${r.rewrites === 1 ? 'o riscritto' : 'i riscritti'}.</p>${r.threads.length ? `<p>Fili rimasti aperti: ${esc(r.threads.join('; '))}</p>` : ''}${r.residual.length ? `<p>Da rivedere a mano: ${esc(r.residual.map((x) => 'cap. ' + x.ch + ': ' + x.text).join('; '))}</p>` : '<p>Nessun problema rimasto tra quelli che il controllo automatico sa trovare.</p>'}<p class="legend">La versione precedente resta disponibile con «↶ Versione precedente».</p>`).style.zIndex = 85;
  return res;
}
/** Writes revised chapters back everywhere the book lives: the saved book list, its series volume, the open work. */
function rmSaveRevised(seed, chapters, prev) {
  const B = rmBooks(); const b = B.find((x) => x.seed === seed); if (b) { b.chapters = chapters.map((c) => ({ title: c.title, text: c.text })); b.revised = true; try { localStorage.setItem(RM_BOOKS, JSON.stringify(B)); } catch (e) { toastMsg('⚠ Spazio del browser pieno: scarica il libro.'); } }
  rmSeries().forEach((Ser) => { const v = Ser.books.find((x) => x.seed === seed); if (v) rmStoreChapters(seed, chapters, Ser, v.n); });
}
function rmEndBox() {
  const N = RM.N, P = N.plan;
  const q = ROMANZO.qualitySummary(N.quality), rv = N.quality && N.quality.revision;
  const qual = q.checked || rv ? `<p class="rmQual">🔎 <b>Controllo qualità:</b> ${q.sentences + (rv ? rv.fixed : 0)} frasi corrette, ${rmPlural(q.rewrites + (rv ? rv.rewrites : 0), 'capitolo riscritto', 'capitoli riscritti')}.${q.threads.length ? ' Fili rimasti aperti: ' + esc(q.threads.join('; ')) + '.' : ''}${q.residual.length && !rv ? ' Da rivedere: ' + esc(q.residual.slice(0, 4).map((r) => (r.ch ? 'cap. ' + r.ch + ': ' : '') + r.text).join('; ')) + '.' : ''}</p>` : '<p class="rmQual">🔎 Questo libro è stato scritto prima dei controlli di qualità: «🛠 Revisione del testo» lo rilegge tutto e corregge frasi, contraddizioni e ripetizioni.</p>';
  return `<section class="rmEnd"><h2>Fine</h2><p>${N.chapters.length} capitoli, circa ${Math.round(N.chapters.reduce((t, c) => t + (c.words || 0), 0) / ROMANZO.WORDS_PER_PAGE)} pagine.</p>${qual}
   <details${N.visibility !== 'coautore' ? ' open' : ''}><summary>Il piano e la realtà</summary><p><b>Domanda:</b> ${esc(P.question)}</p><p><b>Leggi:</b> ${esc(P.laws.join(' · '))}</p><p><b>Finale previsto:</b> ${esc(P.ending.text || '—')}</p>
    <ul>${P.stages.map((s) => `<li>${s.reached ? '✓' : '✗'} ${esc(s.fact)} <small>${s.reached ? 'cap. ' + s.reached : 'non raggiunta'}</small></li>`).join('')}</ul>${P.dossier ? `<p><b>Colpevole:</b> ${esc(P.dossier.culprit)} · ${esc(P.dossier.motive)}</p>` : ''}
    <ul>${N.cast.map((c) => `<li><b>${esc(c.name)}</b>: 🤫 ${esc(c.secret || '—')}</li>`).join('')}</ul></details>
   <div class="rmRow">${N.secondDraft && !N.chapters.every((c) => c.drafted) ? '<button data-rm="draft">✂ Seconda stesura (−10%)</button>' : ''}<button class="rmPrimary" data-rm="pdf">📘 Scarica il libro (PDF)</button><button data-rm="txt">📄 Testo</button><button data-rm="report">📊 Resoconto</button><button data-rm="ending" title="Controlla che il libro abbia un finale vero">🏁 Verifica il finale</button><button data-rm="orient" title="Ripassa l'apertura di ogni capitolo perché si capisca dove ci si trova">🧭 Orienta i capitoli</button><button data-rm="revise" title="Rilegge tutto il libro: frasi che non si capiscono, contraddizioni, eventi ripetuti, tic">🛠 Revisione del testo</button>${N.backup ? '<button data-rm="undo" title="Torna al testo di prima dell\'ultima revisione">↶ Versione precedente</button>' : ''}<button data-rm="new">✍ Nuovo romanzo</button></div>${rmSeriesEnd()}<p class="rmMuted">👥 I personaggi sono nella sezione «📖 Romanzo» dell'archivio${N.cast.some((c) => c.archId && !c.ownArch) ? ' (quelli presi da altre sezioni ricordano questo romanzo nella loro scheda)' : ''}.</p></section>`;
}
function rmSeriesEnd() {
  const N = RM.N, Ser = rmSeriesOf(N); if (!N.series) return '';
  if (!Ser || !N.series.inherited) return RM.busy ? '<p class="rmMuted"><span class="rmSpin" aria-hidden="true"></span> 📚 Salvo l\'eredità del volume nella serie…</p>' : '<div class="rmSer">📚 L\'eredità del volume non è ancora nella serie. <button class="rmPrimary" data-rm="legacy">Salvala ora</button></div>';
  const more = Ser.books.length < Ser.volumes;
  return `<div class="rmSer"><b>📚 «${esc(Ser.title)}»</b>: ${Ser.books.length} di ${Ser.volumes} volumi scritti.<div class="rmRow">${more ? `<button class="rmPrimary" data-rm="nextvol">📚 Continua la serie: volume ${Ser.books.length + 1}</button>` : '<b>Serie completa.</b>'}${Ser.books.length > 1 ? '<button data-rm="omni">📘 Tutta la serie (PDF)</button>' : ''}</div></div>`;
}
/** Keeps the finished book in the list of books written (last RM_KEEP_BOOKS). */
function rmFinished() {
  const N = RM.N; if (N.kept) return; N.kept = true;
  if (N.reclosing) { N.reclosing = false; const Ser = rmSeriesOf(N); if (Ser && N.series.inherited) rmStoreChapters(N.seed, N.chapters, Ser, N.series.n); } rmToArchive(N); if (N.series) rmLegacy(N); const b = rmBooks().filter((x) => x.seed !== N.seed);
  b.push({ seed: N.seed, title: (N.novel && N.novel.title) || N.setup.title || 'Senza titolo', genre: N.setup.genre, date: new Date().toISOString(), chapters: N.chapters.map((c) => ({ title: c.title, text: c.text })), epigraph: N.novel ? N.novel.epigraph : '' });
  try { localStorage.setItem(RM_BOOKS, JSON.stringify(b.slice(-RM_KEEP_BOOKS))); } catch (e) { toastMsg('⚠ Non riesco a conservare il libro nel browser: scaricalo.'); } rmSave();
}
async function rmBook(fmt) {
  const N = RM.N; if (!N || !N.chapters.length) return; if (RM.busy) return; RM.busy = true;
  try { if (!N.novel) { toastMsg('📖 Scelgo titolo ed epigrafe…', true); await ROMANZO.bookTitle(N, LLM.ask); rmSave(); }
    await novelBook({ title: N.novel.title, epigraph: N.novel.epigraph, cast: [], chapters: N.chapters.map((c) => ({ title: c.title, text: c.text })), ended: N.status === 'ended', base: 'romanzo-' + N.novel.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), fmt, onStep: (t) => toastMsg(t, true) });
  } finally { RM.busy = false; if (N.status === 'ended') { const b = rmBooks(); const x = b.find((y) => y.seed === N.seed); if (x && N.novel) { x.title = N.novel.title; x.epigraph = N.novel.epigraph; try { localStorage.setItem(RM_BOOKS, JSON.stringify(b)); } catch (e) {} } } rmRenderWork(); }
}
function rmShowBooks() {
  const b = rmBooks().slice().reverse(); const el = funCard('📚 Libri scritti', b.length ? `<ul>${b.map((x, i) => `<li><b>${esc(x.title)}</b> · ${esc((ROMANZO.GENRES[x.genre] || {}).name || '')} · ${x.chapters.length} capitoli · ${esc(new Date(x.date).toLocaleDateString('it-IT'))} <button data-bk="${i}" data-f="pdf">PDF</button> <button data-bk="${i}" data-f="txt">Testo</button> <button data-bkr="${i}" title="Rilegge tutto il libro e corregge frasi, contraddizioni e ripetizioni">🛠 Revisione</button>${x.revised ? ' <small>✓ rivisto</small>' : ''}</li>`).join('')}</ul>` : '<p>Nessun libro finito.</p>', true); el.style.zIndex = 85;
  el.querySelectorAll('[data-bkr]').forEach((btn) => { btn.onclick = async () => { const x = b[+btn.dataset.bkr]; el.hidden = true; const w = rmLoad(); const own = w && w.seed === x.seed ? w : null;
    /* the open work is the most recent text (second draft and orientation live there first) */
    if (own && own.chapters.length === x.chapters.length) x.chapters = own.chapters.map((c) => ({ title: c.title, text: c.text }));
    const res = await rmRevise(x.chapters, { title: x.title, question: own && own.plan ? own.plan.question : '', style: own ? rmStyleOf(own.setup) : '', names: own ? own.cast.map((c) => c.name) : [] }); if (!res) return;
    rmSaveRevised(x.seed, res.chapters, x.chapters); if (own) { own.backup = x.chapters; res.chapters.forEach((c, i) => { if (own.chapters[i]) { own.chapters[i].text = c.text; own.chapters[i].words = c.words; } }); own.quality = own.quality || { chapters: [], final: null }; own.quality.revision = res.report; try { localStorage.setItem(RM_SAVE, JSON.stringify(own)); } catch (e) {} if (RM.N && RM.N.seed === own.seed) { RM.N = own; rmRenderWork(); } } }; });
  el.querySelectorAll('[data-bk]').forEach((btn) => { btn.onclick = () => { const x = b[+btn.dataset.bk]; novelBook({ title: x.title, epigraph: x.epigraph, cast: [], chapters: x.chapters, ended: true, base: 'romanzo-' + x.seed, fmt: btn.dataset.f, onStep: (t) => toastMsg(t, true) }); }; });
}

/** End of a series volume: title (if missing) and legacy into the series bible, then save. */
async function rmLegacy(N) {
  let Ser = rmSeriesOf(N); if (!Ser || N.series.inherited) return; RM.busy = true;
  try { if (!N.novel) await ROMANZO.bookTitle(N, LLM.ask); Ser = await ROMANZO.legacy(Ser, N, LLM.ask); rmPutSeries(Ser); rmSave(); toastMsg(`📚 Volume ${N.series.n} aggiunto alla serie «${Ser.title}».`); }
  finally { RM.busy = false; if (RM.N === N) rmRenderWork(); }
}
/** Characters of a finished novel go to the «Romanzo» section of the archive; characters taken from other sections only remember the novel. */
function rmToArchive(N) {
  if (typeof archBlank === 'undefined' || typeof ARCH === 'undefined') return; const title = (N.novel && N.novel.title) || N.setup.title || 'senza titolo'; let n = 0;
  N.cast.forEach((c) => {
    const memo = { title, series: N.series ? N.series.title : '', volume: N.series ? N.series.n : 0, fate: c.alive ? (c.now ? 'vuole: ' + c.now : 'vivo') : `morto${c.cause ? ': ' + c.cause : ''}`, date: new Date().toISOString().slice(0, 10) };
    let a = c.archId ? archGet(c.archId) : ARCH.chars.find((x) => archEra(x) === 'romanzo' && x.name === c.name);
    if (!a) { a = archBlank({ era: 'romanzo', name: c.name, sex: c.sex, age: c.age, short: c.short || String(c.temper || '').split(';')[0].slice(0, 160) || c.wants || '', sections: Object.assign({}, c.temper ? { carattere: c.temper } : {}, c.fears ? { paure: c.fears } : {}), goals: c.wants ? [c.wants] : [], secrets: c.secret ? [c.secret] : [], origin: { env: 'romanzo', label: `${c.born ? 'nato' : 'creato'} nel romanzo «${title}»` }, novels: [] }); c.ownArch = true; n++; }
    else if (archEra(a) === 'romanzo') c.ownArch = true;
    a.novels = (a.novels || []).filter((x) => x.title !== title).concat([memo]).slice(-20);
    if (c.ownArch && !c.alive && a.status !== 'deceduto') { a.status = 'deceduto'; a.lives = (a.lives || []).concat([{ n: a.life || 1, death: { env: 'romanzo', label: `morto nel romanzo «${title}»${c.cause ? ' · ' + c.cause : ''}` } }]); }
    archSave(a, 'romanzo'); c.archId = a.id;
  });
  if (n) toastMsg(`👥 ${n} personaggi aggiunti alla sezione «📖 Romanzo» dell'archivio.`);
}
/** The finished volume of a series whose legacy was never saved (the page was closed during it). */
function rmPendingLegacy(Ser) { const w = rmLoad(); return w && w.series && w.series.id === Ser.id && w.status === 'ended' && !w.series.inherited ? w : null; }
/** Copies new chapter texts into the saved book list and, if given, into a series volume. */
function rmStoreChapters(seed, chapters, Ser, n) {
  const B = rmBooks(); const b = B.find((x) => x.seed === seed); if (b) { b.chapters = chapters.map((c) => ({ title: c.title, text: c.text })); try { localStorage.setItem(RM_BOOKS, JSON.stringify(B)); } catch (e) {} }
  if (Ser) { const v = Ser.books.find((x) => x.n === n); if (v) { v.chapters = chapters.map((c) => ({ title: c.title, text: c.text, summary: c.summary, oriented: !!c.oriented, closing: !!c.closing })); rmPutSeries(Ser); } }
}
/** Orientation pass on finished chapters: only the first paragraph changes, where the reader did not know where they were. */
async function rmOrient(chapters, ctx) {
  if (RM.busy) return null; RM.busy = true;
  try { const res = await ROMANZO.orientChapters(chapters, ctx, LLM.ask, (i, n) => toastMsg(`🧭 Oriento il capitolo ${i} di ${n}…`, true)); toastMsg(`🧭 Fatto: ${res.changed} capitol${res.changed === 1 ? 'o' : 'i'} su ${chapters.length} con un'apertura più chiara.`); return res; }
  finally { RM.busy = false; }
}
/** Style text of a series (for chapters written outside the full pipeline). */
function rmSeriesStyle(Ser) { const b = Ser.base || {}; if (b.style === 'libero' && b.styleCustom) return 'STILE: ' + b.styleCustom; const S = typeof NOVEL_STYLES !== 'undefined' ? NOVEL_STYLES : {}; return (S[b.style] || S.asimov || { text: '' }).text; }
/** «🏁 Verifica il finale»: one call reads the end of the book; if the story does not close, offers a closing chapter. */
async function rmEndingCheck(chapters, ctx, onClose) {
  if (RM.busy) return; RM.busy = true; toastMsg('🏁 Leggo il finale…', true); let res = null;
  try { res = await ROMANZO.checkEnding(chapters, ctx, LLM.ask); } finally { RM.busy = false; }
  if (!res) { toastMsg('⚠ Non sono riuscito a leggere il finale: riprova.'); return; }
  toastMsg(res.ok ? '🏁 Finale letto: regge.' : '🏁 Finale letto: manca qualcosa.');
  const el = funCard('🏁 Il finale', res.ok ? `<p>✓ <b>Il finale regge.</b> ${esc(res.verdict)}</p>` : `<p><b>Il finale non chiude la storia.</b> ${esc(res.verdict)}</p>${res.missing.length ? `<ul>${res.missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}<div class="row" style="gap:8px"><button class="primary" id="rmCloseGo">✍ Aggiungi un capitolo di chiusura</button></div>`); el.style.zIndex = 85;
  const go = el.querySelector('#rmCloseGo'); if (go) go.onclick = () => { el.hidden = true; onClose(res.missing); };
  return res;
}
/** «📚 Serie» from the home: every series with its volumes, continue, whole series as one book. */
function rmShowSeries() {
  const L = rmSeries().slice().reverse(); const K = ROMANZO.SERIES_KINDS;
  const el = funCard('📚 Le tue serie', L.map((s) => { const pend = rmPendingLegacy(s); const done = s.books.length + (pend ? 1 : 0);
    return `<div class="rmSer"><b>«${esc(s.title)}»</b> · ${esc(K[s.kind].name)} · ${done} di ${s.volumes} volumi${s.plan ? `<br><small>${esc(s.plan.question)}</small>` : ''}
      <ol>${s.books.map((b) => `<li>${esc(b.title)} <button data-sor="${esc(s.id)}" data-n="${b.n}" title="Ripassa l'apertura di ogni capitolo perché si capisca dove ci si trova">🧭 Orienta</button>${b.chapters.some((c) => c.oriented) ? ' <small>✓ orientato</small>' : ''} <button data-sfin="${esc(s.id)}" data-n="${b.n}" title="Controlla che il libro abbia un finale vero">🏁 Finale</button> <button data-srv="${esc(s.id)}" data-n="${b.n}" title="Rilegge tutto il volume e corregge frasi, contraddizioni e ripetizioni">🛠 Revisione</button>${b.chapters.some((c) => c.closing) ? ' <small>✓ chiusura aggiunta</small>' : ''}</li>`).join('')}${pend ? `<li>${esc((pend.novel && pend.novel.title) || pend.setup.title || 'Volume ' + pend.series.n)} <small>(l'eredità del volume sarà salvata ora)</small></li>` : ''}</ol>
      <div class="row" style="gap:6px;flex-wrap:wrap">${done < s.volumes ? `<button class="primary" data-sc="${esc(s.id)}">📚 Continua: volume ${done + 1}</button>` : '<b>Serie completa.</b>'}${s.books.length ? `<button data-so="${esc(s.id)}">📘 Tutta la serie (PDF)</button>` : ''}</div></div>`; }).join('') || '<p>Nessuna serie ancora.</p>', true);
  el.style.zIndex = 85;
  el.querySelectorAll('[data-sc]').forEach((b) => { b.onclick = async () => { b.disabled = true; el.hidden = true; await rmContinueSeries(b.dataset.sc); }; });
  el.querySelectorAll('[data-sor]').forEach((b) => { b.onclick = async () => { const Ser = rmSeries().find((x) => x.id === b.dataset.sor); const v = Ser && Ser.books.find((x) => x.n === +b.dataset.n); if (!v) return; el.hidden = true;
    const res = await rmOrient(v.chapters, { title: v.title, setting: v.setting || (Ser.base || {}).setting || '' }); if (res && res.changed) { res.chapters.forEach((c) => { if (c.oriented) c.oriented = true; }); rmStoreChapters(v.seed, res.chapters, Ser, v.n); const w = rmLoad(); if (w && w.seed === v.seed) { w.chapters.forEach((c, i) => { if (res.chapters[i]) { c.text = res.chapters[i].text; c.oriented = res.chapters[i].oriented; } }); try { localStorage.setItem(RM_SAVE, JSON.stringify(w)); } catch (e) {} } } }; });
  el.querySelectorAll('[data-sfin]').forEach((b) => { b.onclick = async () => { const Ser = rmSeries().find((x) => x.id === b.dataset.sfin); const v = Ser && Ser.books.find((x) => x.n === +b.dataset.n); if (!v) return; el.hidden = true;
    const ctx = { title: v.title, question: v.question || '', series: true, setting: v.setting || (Ser.base || {}).setting || '', style: rmSeriesStyle(Ser) };
    await rmEndingCheck(v.chapters, ctx, async (missing) => { if (RM.busy) return; RM.busy = true; toastMsg('✍ L\'autore scrive il capitolo di chiusura…', true); let ch = null;
      try { ch = await ROMANZO.closingChapter(v.chapters, ctx, missing, LLM.ask); } finally { RM.busy = false; }
      if (!ch) { toastMsg('⚠ Il capitolo di chiusura non è stato scritto: riprova.'); return; }
      const S2 = rmSeries().find((x) => x.id === Ser.id); const v2 = S2.books.find((x) => x.n === v.n); const all = v2.chapters.concat([ch]); rmStoreChapters(v2.seed, all, S2, v2.n);
      toastMsg(`✍ Aggiunto «${ch.title}» come ultimo capitolo di «${v.title}».`); }); }; });
  el.querySelectorAll('[data-srv]').forEach((b) => { b.onclick = async () => { const Ser = rmSeries().find((x) => x.id === b.dataset.srv); const v = Ser && Ser.books.find((x) => x.n === +b.dataset.n); if (!v) return; el.hidden = true;
    const res = await rmRevise(v.chapters, { title: v.title, question: v.question || '', style: rmSeriesStyle(Ser), names: (Ser.bible && Ser.bible.characters || []).map((c) => c.name) }); if (!res) return;
    rmSaveRevised(v.seed, res.chapters, v.chapters); const w = rmLoad(); if (w && w.seed === v.seed) { w.backup = v.chapters.map((c) => ({ title: c.title, text: c.text })); res.chapters.forEach((c, i) => { if (w.chapters[i]) { w.chapters[i].text = c.text; w.chapters[i].words = c.words; } }); try { localStorage.setItem(RM_SAVE, JSON.stringify(w)); } catch (e) {} } }; });
  el.querySelectorAll('[data-so]').forEach((b) => { b.onclick = () => rmOmnibus(rmSeries().find((x) => x.id === b.dataset.so)); });
}
/** Prepares the next volume; if the last volume's legacy is missing, saves it first. */
async function rmContinueSeries(id) {
  const pend = rmPendingLegacy(rmSeries().find((x) => x.id === id) || { id });
  if (pend) { rmOpenWork(pend); toastMsg('📚 Salvo prima l\'eredità del volume precedente…', true); await rmLegacy(pend); if (!pend.series.inherited) { toastMsg('⚠ Non sono riuscito a salvare l\'eredità: riprova.'); return; } }
  const Ser = rmSeries().find((x) => x.id === id); if (!Ser) return;
  RM.N = null; RM.S = ROMANZO.nextSetup(Ser); rmOpenSetup(RM.S); toastMsg(`📚 Volume ${Ser.books.length + 1} di «${Ser.title}»: i personaggi tornano con ciò che hanno vissuto. Scrivi l'idea o usa «✨ Aiutami».`);
}
async function rmOmnibus(Ser) {
  if (!Ser || !Ser.books.length || RM.busy) return; RM.busy = true;
  try { await novelBook({ title: Ser.title, epigraph: (Ser.books[0] || {}).epigraph || '', cast: [], chapters: Ser.books.flatMap((b) => b.chapters.map((c, i) => ({ title: i ? c.title : `Libro ${b.n} · ${b.title} — ${c.title}`, text: c.text }))), ended: Ser.books.length >= Ser.volumes, base: 'serie-' + Ser.id, fmt: 'pdf', onStep: (t) => toastMsg(t, true) }); } finally { RM.busy = false; }
}
/* ---------- clicks ---------- */
async function rmClick(e) {
  const b = e.target.closest('[data-rm]'); if (!b) return; const k = b.dataset.rm; const N = RM.N;
  if (k === 'home') return rmLeave();
  if (k === 'addchar') { rmReadForm(); RM.S.characters.push({ name: '', role: RM.S.characters.length ? 'comprimario' : 'protagonista', sex: 'f', age: 35, temper: '', wants: '', fears: '', short: '' }); return rmRenderSetup(); }
  if (k === 'delchar') { rmReadForm(); RM.S.characters.splice(+b.dataset.i, 1); return rmRenderSetup(); }
  if (k === 'help') { rmReadForm(); RM.busy = true; rmRenderSetup(); $('rmStatus').textContent = '✨ Completo la storia…'; RM.S = await ROMANZO.help(RM.S, LLM.ask, RM.S.seriesId ? rmSeries().find((x) => x.id === RM.S.seriesId) : null); RM.busy = false; return rmRenderSetup(); }
  if (k === 'tpl') { rmReadForm(); return saveFile('romanzo-modello.md', ROMANZO.toMd(RM.S.idea ? RM.S : Object.assign(rmBlankSetup(), { genre: 'giallo', characters: [{ name: 'Nome Cognome', role: 'detective', sex: 'f', age: 45, temper: '', wants: '', fears: '' }] }))); }
  if (k === 'paste') { const el = funCard('📋 Incolla la storia (.md)', '<p class="legend">Incolla qui il testo di un file nel formato del romanzo (lo stesso del «⇩ Modello .md»).</p><textarea id="rmPasteTxt" rows="14" style="width:100%;box-sizing:border-box;font:13px monospace"></textarea><div class="row" style="gap:8px;margin-top:8px"><button class="primary" id="rmPasteGo">Carica la storia</button></div>', true); el.style.zIndex = 85;
    el.querySelector('#rmPasteGo').onclick = () => { const t = el.querySelector('#rmPasteTxt').value; if (!t.trim()) return; RM.S = ROMANZO.parseMd(t); el.hidden = true; rmRenderSetup(); toastMsg('📋 Storia caricata dal testo incollato.'); }; el.querySelector('#rmPasteTxt').focus(); return; }
  if (k === 'plan') { if (RM.busy) { toastMsg('Attendi…'); return; } rmReadForm(); const why = ROMANZO.checkSetup(RM.S); if (why) { toastMsg(why); rmRefreshReady(); return; } return rmMakePlan(); }
  if (k === 'resume') return rmOpenWork(rmLoad());
  if (k === 'books') return rmShowBooks();
  if (k === 'replan') { RM.S = N.setup; RM.N = null; return rmMakePlan(); }
  if (k === 'start') { rmApplyPlanEdits(); rmSave(); rmRenderWork(); return rmRun(); }
  if (k === 'write') return rmRun();
  if (k === 'pause') { RM.pause = true; toastMsg('⏸ Mi fermo alla fine di questo capitolo.'); return; }
  if (k === 'event') { const t = ($('rmEv').value || '').trim(); if (!t) return; ROMANZO.director.event(N, t); rmSave(); toastMsg('🎬 Accadrà nel prossimo capitolo.'); return rmRenderWork(); }
  if (k === 'whisper') { const t = ($('rmWh').value || '').trim(); if (!t) return; ROMANZO.director.whisper(N, $('rmWho').value, t); rmSave(); toastMsg('💭 Lo sentirà come suo.'); return rmRenderWork(); }
  if (k === 'kill') { const who = prompt('Chi deve morire? (la causa la troverà l\'autore dentro la storia)\n' + N.cast.filter((c) => c.alive).map((c) => c.name).join(', ')); if (!who) return; const why = ROMANZO.director.kill(N, who.trim()); if (why) toastMsg(why); else { rmSave(); toastMsg('† Accadrà nel prossimo capitolo.'); } return rmRenderWork(); }
  if (k === 'add') { const name = prompt('Nome del nuovo personaggio (o di uno dell\'archivio):'); if (!name) return; const a = (typeof ARCH !== 'undefined' ? ARCH.chars : []).find((c) => c.name.toLowerCase() === name.trim().toLowerCase()); const role = a ? '' : prompt('In due parole: chi è? (es. un postino curioso)') || '';
    ROMANZO.director.add(N, a ? { name: a.name, sex: a.sex, age: a.age, temper: a.temper || '', short: a.short || '', archId: a.id } : { name: name.trim(), short: role }); rmSave(); toastMsg('＋ Entrerà nel prossimo capitolo.'); return rmRenderWork(); }
  if (k === 'redo') { const note = prompt('Cosa vuoi diverso nel capitolo riscritto? (facoltativo)') ; if (note === null) return; ROMANZO.dropLast(N, note); rmSave(); rmRenderWork(); return rmRun(); }
  if (k === 'vis') { const next = ROMANZO.VISIBILITY[ROMANZO.VISIBILITY.indexOf(N.visibility) + 1]; if (next && confirm(`Passare a «${RM_VIS_LABEL[next]}»? Non si potrà tornare indietro.`)) { ROMANZO.setVisibility(N, next); rmSave(); } return rmRenderWork(); }
  if (k === 'person') { const c = N.cast.find((x) => x.name === b.dataset.n); if (!c) return; const full = ROMANZO.planView(N).full || N.status === 'ended'; funCard(`👤 ${esc(c.name)}`, `<p>${esc(c.role)}, ${c.age} anni · ${esc(c.temper)}</p><p>Vuole: ${esc(c.wants)} · teme: ${esc(c.fears)}</p>${c.now ? `<p>Adesso vuole: ${esc(c.now)}</p>` : ''}${full ? `<p>🤫 ${esc(c.secret)}</p><p>💭 ${esc(c.lastThought)}</p>` : ''}<p class="legend">${c.scenes} scene, ${c.lines} battute${c.born ? ' · nato nella storia' : ''}</p>`).style.zIndex = 85; return; }
  if (k === 'book') { const el = funCard('📘 Il libro', `<p>${N.chapters.length} capitoli${N.status === 'ended' ? '' : ' (opera in corso: il libro finirà con «continua…»)'}.</p><div class="row" style="gap:8px"><button class="primary" data-f="pdf">PDF</button><button data-f="txt">Testo</button></div>`); el.style.zIndex = 85; el.querySelectorAll('[data-f]').forEach((x) => { x.onclick = () => { el.hidden = true; rmBook(x.dataset.f); }; }); return; }
  if (k === 'pdf' || k === 'txt') return rmBook(k);
  if (k === 'report') { const el = rpOpen(romanzoReport(N), `resoconto-romanzo-${N.seed}.pdf`); if (el) el.style.zIndex = 85; return; }
  if (k === 'draft') { RM.busy = true; await ROMANZO.secondDraft(N, LLM.ask, (t) => toastMsg('✂ ' + t, true)); RM.busy = false; rmSave(); { const Ser = rmSeriesOf(N); rmStoreChapters(N.seed, N.chapters, Ser && N.series && N.series.inherited ? Ser : null, N.series ? N.series.n : 0); } toastMsg('✂ Seconda stesura fatta.'); return rmRenderWork(); }
  if (k === 'new') { RM.N = null; RM.S = rmBlankSetup(); return rmRenderSetup(); }
  if (k === 'ending') { await rmEndingCheck(N.chapters, { title: (N.novel && N.novel.title) || N.setup.title, question: N.plan ? N.plan.question : '', series: !!N.series }, async (missing) => {
      ROMANZO.reopenForClosing(N); if (missing.length) ROMANZO.director.event(N, 'Il capitolo deve chiudere la storia: ' + missing.join('; ')); N.kept = false; N.reclosing = true; rmSave(); rmRenderWork(); await rmRun(); });
    return; }
  if (k === 'revise') { const prev = N.chapters.map((c) => ({ title: c.title, text: c.text })); const res = await rmRevise(N.chapters, { title: (N.novel && N.novel.title) || N.setup.title, question: N.plan ? N.plan.question : '', style: rmStyleOf(N.setup), names: N.cast.map((c) => c.name) });
    if (res) { N.backup = prev; res.chapters.forEach((c, i) => { N.chapters[i].text = c.text; N.chapters[i].words = c.words; N.chapters[i].revised = true; }); N.quality = N.quality || { chapters: [], final: null }; N.quality.revision = res.report; rmSave(); rmSaveRevised(N.seed, N.chapters, prev); }
    return rmRenderWork(); }
  if (k === 'undo') { if (!N.backup) return; const cur = N.chapters.map((c) => ({ title: c.title, text: c.text })); N.backup.forEach((c, i) => { if (N.chapters[i]) { N.chapters[i].text = c.text; N.chapters[i].words = (c.text.match(/\S+/g) || []).length; } }); N.backup = cur; rmSave(); rmSaveRevised(N.seed, N.chapters, cur); toastMsg('↶ Tornato al testo precedente (puoi rifare lo stesso pulsante per tornare indietro).'); return rmRenderWork(); }
  if (k === 'orient') { const res = await rmOrient(N.chapters, { title: (N.novel && N.novel.title) || N.setup.title, setting: N.setup.setting });
    if (res && res.changed) { res.chapters.forEach((c, i) => { N.chapters[i].text = c.text; N.chapters[i].words = (c.text.match(/\S+/g) || []).length; if (c.oriented) N.chapters[i].oriented = true; }); rmSave(); const Ser = rmSeriesOf(N); rmStoreChapters(N.seed, N.chapters, Ser && N.series.inherited ? Ser : null, N.series ? N.series.n : 0); }
    return rmRenderWork(); }
  if (k === 'legacy') { await rmLegacy(N); return rmRenderWork(); }
  if (k === 'nextvol') { const Ser = rmSeriesOf(N); if (Ser) await rmContinueSeries(Ser.id); return; }
  if (k === 'omni') return rmOmnibus(rmSeriesOf(N));
}
function rmChange(e) {
  const t = e.target; const p = rmPrefs();
  if (t.id === 'rmFile' && t.files && t.files[0]) { t.files[0].text().then((txt) => { RM.S = ROMANZO.parseMd(txt); rmRenderSetup(); toastMsg('⇪ Storia caricata dal file.'); }); return; }
  if (t.id === 'rmFromArch' && t.value) { rmReadForm(); const a = archGet(t.value); if (a) RM.S.characters.push({ name: a.name, role: RM.S.characters.length ? 'comprimario' : 'protagonista', sex: a.sex, age: a.age, temper: a.temper || '', wants: '', fears: '', short: a.short || '', archId: a.id }); return rmRenderSetup(); }
  if (t.id === 'rmGenre') { rmReadForm(); RM.S.genre = t.value; p.genre = t.value; rmSavePrefs(p); return rmRenderSetup(); }
  if (t.id === 'rmStyle') { rmReadForm(); RM.S.style = t.value; return rmRenderSetup(); }
  if (t.id === 'rmGrade') { RM.S.grade = t.value; return; }
  if (t.id === 'rmSerMode') { rmReadForm(); const S = RM.S; if (!t.value) { delete S.series; delete S.seriesId; } else if (t.value === 'new') { delete S.seriesId; S.series = S.series || { title: S.title || '', kind: 'ciclo', volumes: 3, thread: '' }; } else { const Ser = rmSeries().find((x) => x.id === t.value); if (Ser) { RM.S = ROMANZO.nextSetup(Ser); toastMsg(`📚 Volume ${Ser.books.length + 1} di «${Ser.title}»: genere, stile e personaggi ripresi dalla serie.`); } } return rmRenderSetup(); }
  if (t.id === 'rmSerKind') { rmReadForm(); RM.S.series.kind = t.value; return rmRenderSetup(); }
  if (t.id === 'rmPages') { rmReadForm(); p.pages = RM.S.pages; rmSavePrefs(p); return rmRenderSetup(); }
  if (t.name === 'rmVis') { p.visibility = t.value; rmSavePrefs(p); return; }
  if (t.name === 'rmMindMain') { p.mind = t.value; rmSavePrefs(p); return; }
  if (t.name === 'rmMindLight') { p.light = t.value; rmSavePrefs(p); return; }
  if (t.id === 'rmRevise') { p.revise = t.checked; rmSavePrefs(p); return rmRenderSetup(); }
  if (t.id === 'rmDraft') { p.secondDraft = t.checked; rmSavePrefs(p); return rmRenderSetup(); }
  if (t.name === 'rmMode') { p.mode = t.value; rmSavePrefs(p); if (t.value === 'capitolo' && RM.running) RM.pause = true; else if (RM.running) RM.pause = false; return; }
  if (t.dataset && t.dataset.ci != null) { const c = RM.S.characters[+t.dataset.ci]; if (c) c[t.dataset.cf] = t.dataset.cf === 'age' ? +t.value || 35 : t.value; }
}
function rmInput(e) { const t = e.target; if (t.dataset && t.dataset.ci != null) { const c = RM.S.characters[+t.dataset.ci]; if (c) c[t.dataset.cf] = t.dataset.cf === 'age' ? +t.value || 35 : t.value; }  rmRefreshReady(); }
/** Keeps the plan button and its status line in step with what the user is typing, without re-rendering the form. */
function rmRefreshReady() {
  const b = document.querySelector('[data-rm="plan"]'), st = $('rmStatus'); if (!b || !st || RM.busy || !RM.S) return;
  try { rmReadForm(); } catch (err) { return; }
  const why = ROMANZO.checkSetup(RM.S);
  if (why) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
  st.className = why ? 'rmNote' : 'rmMuted'; st.textContent = why || 'Pronto: l\'autore prepara il piano (1 chiamata).';
}
window.__romanzo = { rmOpenSetup, rmOpenWork, rmLoad, RM, ROMANZO, archChars: () => ARCH.chars.map((c) => ({ name: c.name, era: archEra(c), novels: (c.novels || []).length, status: c.status })), archOpen };
