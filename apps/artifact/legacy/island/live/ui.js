/* ===== UI + render loop ===== */
(function () {
'use strict';
const { THREE } = SC; const LOC = SC.LOC;
const $ = (id) => document.getElementById(id);
// files go to the viewer through the artifact's downloads capability (the frame cannot download by itself); a plain link outside claude.ai
let _dl; async function saveFile(filename, data) {
  try { if (_dl === undefined) _dl = (window.claude && window.claude.use) ? await window.claude.use('downloads') : null; } catch (e) { _dl = null; }
  if (_dl) { try { await _dl.save({ filename, data }); return 'saved'; } catch (e) { const code = (e && e.code) || 'unavailable'; if (code === 'declined') return 'declined';
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const msg = code === 'extension_not_enabled' || code === 'rejected_extension' ? `⚠ Qui non si possono salvare file .${ext}: questa vista permette solo alcuni formati (il testo .txt sì). Prova ad aprire l'isola dall'app Claude o da claude.ai nel browser normale.`
      : code === 'rate_limited' ? '⚠ C\'è già una richiesta di salvataggio aperta: confermala, oppure aspetta qualche secondo e riprova.'
      : code === 'too_large' ? '⚠ Il file è troppo grande per essere salvato qui.' : `⚠ Il salvataggio non è riuscito (${code}). Riprova tra poco.`;
    setTimeout(() => { const t = $('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 12000); }, 60); console.warn('download failed', code, e && e.message); return 'error'; } }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); return 'link'; } catch (e) { return 'error'; } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const fmtH = ENG.fmtH;
const ui = { speed: 1, follow: false, selected: 'p0', tab: 'mind', godOpen: false, labels: false };

/* ---------- Claude availability ---------- */
let sampleReady = false;
(async () => {
  try {
    if (!window.claude || !window.claude.use) { $('claudeStatus').textContent = 'Claude non disponibile qui: apri la pagina da claude.ai.'; return; }
    const s = await window.claude.use('sample');
    if (!s) { $('claudeStatus').textContent = 'Claude non disponibile in questa vista: apri la pagina da claude.ai.'; return; }
    ENG.setSample(s); sampleReady = true; setTimeout(autoResume, 0); $('claudeStatus').textContent = 'Claude Sonnet pronto (usa il tuo abbonamento).'; $('startBtn').disabled = false; if ($('resumeBtn')) $('resumeBtn').disabled = false;
  } catch (e) { $('claudeStatus').textContent = 'Claude non disponibile.'; }
})();

/* ---------- setup ---------- */
const FORM_KEY = 'isola-setup-v1';
const KIT_KEYS = ['axe', 'knife', 'rod', 'handline', 'rope', 'tarp', 'pot', 'bottle', 'lighter', 'matches', 'firstaid', 'mirror'];
const FORM_FIELDS = ['sRes', 'sForced', 'sCircle', 'sCircleModel', 'sTemper', 'sCount', 'sKit', 'sKitWhere', ...KIT_KEYS.map((k) => 'kit_' + k), 'sScenario', 'sMind', 'sIsland', 'sSize', 'sEco', 'sName', 'sSex', 'sAge', 'sPersona', 'sAmnesia', 'sNote', 'sDaysN', 'sForever', 'sSeed'];
function saveForm() {
  const f = {}; FORM_FIELDS.forEach((id) => { const el = $(id); if (el) f[id] = el.type === 'checkbox' ? el.checked : el.value; });
  try { localStorage.setItem(FORM_KEY, JSON.stringify(f)); } catch (e) {}
}
function loadForm() {
  let f = null; try { f = JSON.parse(localStorage.getItem(FORM_KEY) || 'null'); } catch (e) {}
  if (!f) return;
  FORM_FIELDS.forEach((id) => { const el = $(id); if (!el || !(id in f)) return; if (el.type === 'checkbox') el.checked = !!f[id]; else el.value = f[id]; });
  $('sDaysN').disabled = $('sForever').checked;
}
// ---- the cast: how many castaways, and for each one name, sex, age, character and what they carry ----
const KIT_INFO = { axe: '🪓 Ascia', knife: '🔪 Coltello', rod: '🎣 Canna', handline: '🪝 Lenza e ami', rope: '🪢 Corda', tarp: '⛺ Telo', pot: '🍲 Pentolino', bottle: '🧴 Bottiglia', lighter: '🔥 Accendino', matches: '🔥 Fiammiferi', firstaid: '🩹 Pronto soccorso', mirror: '🪞 Specchietto' };
const CAST_KEY = 'isola-cast-v1';
const TEMPERS = [['', 'Non specificato'], ['calmo', 'Calmo'], ['conciliante', 'Conciliante'], ['timido', 'Timido'], ['ironico', 'Ironico'], ['permaloso', 'Permaloso'], ['polemico', 'Polemico'], ['irascibile', 'Irascibile'], ['dominante', 'Dominante']];
const withTemper = (p, t) => (t ? `${p ? p + '; ' : ''}temperamento ${t}` : p);
const CAST_PRESETS = [['Lucia', 'f', 41, 'infermiera, pratica e diffidente, fuma quando è nervosa'], ['Davide', 'm', 29, 'cuoco, chiacchierone, ottimista fino all\'ingenuità'], ['Karim', 'm', 39, 'meccanico ingegnoso, sospettoso con chi non conosce, tende a comandare'], ['Sara', 'f', 52, 'ingegnera in pensione, metodica, poco paziente'], ['Tommaso', 'm', 63, 'pescatore, silenzioso, credente'], ['Elena', 'f', 24, 'studentessa, sportiva, impulsiva e generosa'], ['Marco', 'm', 46, 'agente immobiliare, egocentrico, bravo a convincere'], ['Aisha', 'f', 35, 'medico, calma, riservata, osserva prima di parlare']];
let castData = []; try { castData = JSON.parse(localStorage.getItem(CAST_KEY) || '[]'); } catch (e) { castData = []; }
function carryHtml(idx, sel) { return `<div class="cbT">🎒 Cosa ha addosso (lo sa di avere, subito usabile)</div><div class="cbG">${KIT_KEYS.map((k) => `<label><input type="checkbox" data-carry="${idx}" value="${k}"${(sel || []).includes(k) ? ' checked' : ''}> ${KIT_INFO[k]}</label>`).join('')}</div>`; }
function castSave() { try { localStorage.setItem(CAST_KEY, JSON.stringify(castData)); } catch (e) {} }
function castCollect() { // read the cards back into castData (index 0 = the first castaway, whose fields are the classic ones)
  castData[0] = Object.assign(castData[0] || {}, { carry: [...document.querySelectorAll('[data-carry="0"]:checked')].map((x) => x.value) }); { const p0 = document.querySelector('.archPick[data-i="0"]'); if (p0 && ARCH && ARCH.loaded) castData[0].archId = p0.value || ''; }
  document.querySelectorAll('.castCard').forEach((c) => { const i = +c.dataset.i; castData[i] = { name: c.querySelector('.cName').value.trim(), sex: c.querySelector('.cSex').value, age: Number(c.querySelector('.cAge').value) || 30, persona: c.querySelector('.cPers').value.trim(), temper: c.querySelector('.cTemp').value, carry: [...c.querySelectorAll(`[data-carry="${i}"]:checked`)].map((x) => x.value), archId: ARCH && ARCH.loaded ? ((c.querySelector('.archPick') || {}).value || '') : ((castData[i] || {}).archId || '') }; });
  castSave(); castDupCheck(); }
function castDupCheck() { const names = [$('sName').value.trim().toLowerCase(), ...[...document.querySelectorAll('.castCard .cName')].map((x) => x.value.trim().toLowerCase())];
  document.querySelectorAll('.castCard .cName').forEach((x, i) => { const n = x.value.trim().toLowerCase(); x.classList.toggle('dup', !!n && names.indexOf(n) !== i + 1); x.title = x.classList.contains('dup') ? 'Nome già usato: verrà cambiato' : ''; }); }
function renderCast() {
  const n = Math.max(1, Math.min(8, Number($('sCount').value) || 1)); const custom = $('sKit').value === 'custom';
  $('castTitle1').style.display = n > 1 ? 'block' : 'none';
  $('carry0').innerHTML = custom ? carryHtml(0, (castData[0] || {}).carry) : '';
  let html = '';
  for (let i = 1; i < n; i++) { const pr = CAST_PRESETS[(i - 1) % CAST_PRESETS.length]; const c = castData[i] || (castData[i] = { name: pr[0], sex: pr[1], age: pr[2], persona: pr[3], carry: [] });
    html += `<div class="castCard" data-i="${i}"><div class="castTitle">Naufrago ${i + 1} <select class="archPick" data-i="${i}" data-v="${c.archId || ''}" aria-label="Personaggio dall'archivio">${typeof archOptions === 'function' ? archOptions(c.archId || '') : ''}</select></div><div class="inline"><div><label>Nome</label><input class="cName" type="text" value="${esc(c.name)}"></div><div><label>Sesso</label><select class="cSex"><option value="m"${c.sex === 'm' ? ' selected' : ''}>Uomo</option><option value="f"${c.sex === 'f' ? ' selected' : ''}>Donna</option></select></div><div><label>Età</label><input class="cAge" type="number" min="5" max="95" value="${c.age}"></div></div>
      <label>Carattere (facoltativo, lui non lo sa)</label><textarea class="cPers" placeholder="Es.: generoso ma permaloso, ex militare, ha paura del buio…">${esc(c.persona || '')}</textarea><label>Temperamento</label><select class="cTemp">${TEMPERS.map(([v, l]) => `<option value="${v}"${(c.temper || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>${custom ? `<div class="carryBox">${carryHtml(i, c.carry)}</div>` : ''}</div>`; }
  $('castBox').innerHTML = html; castSave(); castDupCheck();
}
function castList() { castCollect(); const n = Math.max(1, Math.min(8, Number($('sCount').value) || 1)); const out = [{ name: $('sName').value.trim() || 'Il naufrago', sex: $('sSex').value, age: Number($('sAge').value) || 35, persona: withTemper($('sPersona').value.trim(), $('sTemper').value), carry: (castData[0] || {}).carry || [], archId: (castData[0] || {}).archId || '' }];
  for (let i = 1; i < n; i++) { const c = castData[i]; out.push(Object.assign({}, c, { persona: withTemper(c.persona, c.temper) })); } return out; }
$('castBox').addEventListener('input', castCollect); $('castBox').addEventListener('change', castCollect); $('carry0').addEventListener('change', castCollect); $('sName').addEventListener('input', castDupCheck);
$('sCount').addEventListener('change', () => { const n = +$('sCount').value; const sc = $('sScenario');
  if (n === 1 && ['gruppo', 'coppia'].includes(sc.value)) sc.value = 'libero'; else if (n === 2 && ['libero', 'gruppo'].includes(sc.value)) sc.value = 'coppia'; else if (n > 2 && ['libero', 'coppia'].includes(sc.value)) sc.value = 'gruppo';
  renderCast(); saveForm(); });
$('sScenario').addEventListener('change', () => { const sc = $('sScenario').value; const n = +$('sCount').value;
  if (sc === 'gruppo' && n < 3) $('sCount').value = '4'; else if (sc === 'coppia') $('sCount').value = '2'; renderCast(); saveForm(); });
function kitToggle() { $('kitBox').style.display = $('sKit').value === 'custom' ? 'block' : 'none'; if ($('castBox')) renderCast(); }
loadForm(); if ($('sKitWhere').value === 'addosso' && !(castData[0] && castData[0].carry)) { castData[0] = { carry: KIT_KEYS.filter((k) => $('kit_' + k).checked) }; KIT_KEYS.forEach((k) => { $('kit_' + k).checked = false; }); $('sKitWhere').value = 'cassa'; } kitToggle(); $('sKit').addEventListener('change', kitToggle);
FORM_FIELDS.forEach((id) => { const el = $(id); if (el) { el.addEventListener('input', saveForm); el.addEventListener('change', saveForm); } });
// save the game the moment the page is hidden or closed (the host may unload the frame)
document.addEventListener('visibilitychange', () => { if (document.hidden) ENG.save(); });
window.addEventListener('pagehide', () => ENG.save());
const saved = ENG.loadSaved();
{ // why there is nothing to resume: tell the observer instead of silently showing a fresh form
  let used = 0, keys = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); keys.push(k); used += (localStorage.getItem(k) || '').length; } } catch (e) {}
  const note = document.createElement('div'); note.className = 'legend'; note.style.margin = '6px 0';
  if (!saved) note.textContent = `Nessuna partita salvata in questo browser (spazio usato: ${Math.round(used / 1024)} KB${keys.length ? ', ' + keys.length + ' voci' : ''}). Le partite restano nel browser in cui le hai giocate.`;
  else if (saved.ended) { const alive = (saved.agents || []).some((a) => a.alive && !a.departed);
    note.innerHTML = `L'ultima partita salvata è finita (giorno ${saved.day}: ${String(saved.ended).replace(/[<>&]/g, '')}).` + (alive ? ` <button id="reopenBtn" title="Riapre la partita da dove si era fermata, come se non fosse mai stata terminata">↩ Riapri e continua</button>` : '') + ` <button id="reviewBtn" title="Apre la partita finita così com'è: cronaca, romanzo, album, diario e grafici">👁 Rivedi (cronaca, romanzo…)</button>`;
    setTimeout(() => { const v = $('reviewBtn'); if (v) v.onclick = () => { if (!ensureIsland(saved)) return; ENG.restore(saved); go(); }; }, 0);
    setTimeout(() => { const b = $('reopenBtn'); if (b) b.onclick = () => { if (!sampleReady) { b.textContent = 'Attendo Claude…'; return; } saved.ended = null; saved.endedAt = null; saved._recorded = false; (saved.chronicle || []).push({ day: saved.day, h: saved.h, text: '↩ L\'osservatore riapre l\'esperimento: si riprende da qui.', kind: 'god' }); if (!ensureIsland(saved)) return; ENG.restore(saved); go(); }; }, 0); }
  if (note.textContent && $('resumeBox')) $('resumeBox').after(note);
}
if (saved && !saved.ended) { $('resumeBox').style.display = 'block'; $('resumeInfo').textContent = `Giorno ${saved.day}, ${fmtH(saved.h)} — ${saved.agents.filter((a) => a.alive).length} in vita`; }
$('startBtn').onclick = () => {
  saveForm();
  const wantSize = $('sSize').value || 'big';
  if (wantSize !== IslandSim.ISL.size && !sessionStorage.getItem('isola-fresh')) { // island size is decided when the page loads
    try { localStorage.setItem('isola-island-size', wantSize); if ($('sIsland').value === 'new') localStorage.setItem('isola-island-seed', String(1 + Math.floor(Math.random() * 1e6))); sessionStorage.setItem('isola-fresh', '1'); sessionStorage.setItem('isola-autostart', '1'); } catch (e) {}
    location.reload(); return;
  }
  if ($('sIsland').value === 'new' && !sessionStorage.getItem('isola-fresh')) { // build a fresh random island, then start automatically after reload
    try { localStorage.setItem('isola-island-seed', String(1 + Math.floor(Math.random() * 1e6))); sessionStorage.setItem('isola-fresh', '1'); sessionStorage.setItem('isola-autostart', '1'); } catch (e) {}
    location.reload(); return;
  }
  try { sessionStorage.removeItem('isola-fresh'); } catch (e) {}
  const setup = { days: $('sForever').checked ? 0 : Math.max(1, Math.min(3650, Number($('sDaysN').value) || 20)), name: $('sName').value.trim() || 'Il naufrago', sex: $('sSex').value, age: Number($('sAge').value) || 35, persona: withTemper($('sPersona').value.trim(), $('sTemper').value), amnesia: $('sAmnesia').checked || $('sScenario').value === 'amnesia', scenario: $('sScenario').value, cast: castList(), res: $('sRes').value, forced: $('sForced').value === 'forzata', circle: $('sCircle').value === 'sera', circleHaiku: $('sCircleModel').value !== 'mind', kit: { mode: $('sKit').value, where: 'cassa', items: KIT_KEYS.filter((k) => $('kit_' + k).checked) }, mind: $('sMind').value, eco: $('sEco').checked, note: $('sNote').checked, seed: Number($('sSeed').value) || undefined };
  ENG.clearSaved(); ENG.newGame(setup); try { archLinkCast(setup.cast || castList()); } catch (e) { console.warn('archivio', e); } go();
};
function ensureIsland(g) { if (g && g.islandSeed && (g.islandSeed !== IslandSim.ISL.seed || (g.islandSize || 'normal') !== IslandSim.ISL.size)) { try { localStorage.setItem('isola-island-seed', String(g.islandSeed)); localStorage.setItem('isola-island-size', g.islandSize || 'normal'); sessionStorage.setItem('isola-autoresume', '1'); } catch (e) {} location.reload(); return false; } return true; }
$('resumeBtn').onclick = () => { if (!ensureIsland(saved)) return; ENG.restore(saved); go(); };
// automatic resume: if the page was reloaded while a game was running, continue without asking
function autoResume() {
  let auto = null; try { auto = sessionStorage.getItem('isola-autostart'); sessionStorage.removeItem('isola-autostart'); } catch (e) {}
  if (auto) { $('startBtn').click(); return; }
  let ar = null; try { ar = sessionStorage.getItem('isola-autoresume'); sessionStorage.removeItem('isola-autoresume'); } catch (e) {}
  if (ar && saved && !saved.ended && !ENG.G) { if (!ensureIsland(saved)) return; ENG.restore(saved); go(); return; }
  if (!saved || saved.ended || ENG.G || !saved.running) return;
  if (!ensureIsland(saved)) return;
  ENG.restore(saved); go();
  const t = $('toast'); t.textContent = '↻ Ripreso automaticamente dal salvataggio (la pagina era stata ricaricata).'; t.style.display = 'block'; setTimeout(() => { t.style.display = 'none'; }, 6000);
}
function go() {
  $('setup').style.display = 'none'; document.body.classList.remove('inSetup'); if (typeof homeHide === 'function') homeHide(); window.__talkActive = false;
  ENG.fogTick(true); RTS.intro();
  ENG.G.running = true; setPlay(true);
  const p0 = ENG.G.agents.find((a) => a.alive && !a.asleep && !a.thinking && !a.cur && !a.plan.length);
  if (p0) ENG.decide(p0); // first call inside the click: consent prompt
  refreshPanel(true);
}

/* ---------- controls ---------- */
function setPlay(on) { if (!ENG.G) return; ENG.G.running = on && !ENG.G.ended; $('play').textContent = ENG.G.running ? '⏸ Pausa' : '▶ Avvia'; }
$('play').onclick = () => setPlay(!ENG.G.running);
document.querySelectorAll('[data-speed]').forEach((b) => b.onclick = () => { ui.speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); });
$('follow').onclick = () => setFollow(!ui.follow);
// labels on the map: names given by the characters, plus object/animal labels; one switch in the top bar (and in the menu)
ui.names = (() => { try { return localStorage.getItem('isola-names') !== '0'; } catch (e) { return true; } })();
function setNames(v) { ui.names = v; try { localStorage.setItem('isola-names', v ? '1' : '0'); } catch (e) {} document.body.classList.toggle('noNames', !v); $('namesBtn').classList.toggle('on', v); $('namesBtn').title = v ? 'Nascondi le etichette dei nomi sulla mappa (tasto L)' : 'Mostra le etichette dei nomi sulla mappa (tasto L)'; }
$('labelsBtn').onclick = () => { ui.labels = !ui.labels; $('labelsBtn').classList.toggle('on', ui.labels); };
$('namesBtn').onclick = () => setNames(!ui.names); setNames(ui.names);
const THINK_MODES = { pausa: ['🧠⏸', 'Mentre qualcuno pensa il tempo si ferma (tutti aspettano). Clic: rallenta a 1×'], lento: ['🧠🐢', 'Mentre qualcuno pensa il tempo scorre a 1× (chi pensa resta fermo, gli altri vanno avanti). Clic: scorre a velocità piena'], scorre: ['🧠▶', 'Mentre qualcuno pensa il tempo scorre alla velocità scelta (chi pensa resta fermo, gli altri vanno avanti). Clic: si ferma'] };
function thinkBtnSync() { const b = $('thinkBtn'); if (!b) return; const m = ENG.G ? ENG.thinkMode() : 'pausa'; const [t, ti] = THINK_MODES[m]; if (b.textContent !== t) b.textContent = t; b.title = ti; }
$('thinkBtn').onclick = () => { const G = ENG.G; if (!G) return; const order = ['pausa', 'lento', 'scorre']; G.thinkTime = order[(order.indexOf(ENG.thinkMode()) + 1) % 3]; thinkBtnSync(); { const t = $('toast'); t.textContent = THINK_MODES[G.thinkTime][1].split('. Clic')[0] + '.'; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 4000); } ENG.save(); };
addEventListener('keydown', (e) => { if (e.target.closest && e.target.closest('input,textarea,select')) return; if (e.key === 'l' || e.key === 'L') setNames(!ui.names); });
$('godBtn').onclick = () => openTab('isle', true);
let newConfirm = 0;
$('newBtn').onclick = () => { if (Date.now() - newConfirm < 3000) { ENG.discard(); location.reload(); } else { newConfirm = Date.now(); $('newBtn').textContent = 'Sicuro? Clicca ancora per cancellare'; setTimeout(() => { $('newBtn').textContent = '⟲ Nuova partita…'; }, 3000); } };
$('copyLog').onclick = async () => {
  const G = ENG.G; if (!G) return;
  const data = { seed: G.seed, day: G.day, ended: G.ended, interventions: G.interventions, chronicle: G.chronicle, agents: G.agents.map((a) => ({ name: a.name, alive: a.alive, deathCause: a.deathCause, notebook: a.notebook, thoughts: a.thoughts, longMemory: a.longMemory })), decisions: G.log };
  try { await navigator.clipboard.writeText(JSON.stringify(data, null, 1)); $('copyLog').textContent = '✓ Copiato'; } catch (e) { $('copyLog').textContent = 'Copia non riuscita'; }
  setTimeout(() => { $('copyLog').textContent = '💾 Copia registro'; }, 2000);
};
document.querySelectorAll('#tabs button').forEach((b) => b.onclick = () => openTab(b.dataset.tab));

/* ---------- god mode ---------- */
const QUICK = [
  ['⛈ Temporale', [{ tipo: 'meteo', meteo: 'temporale', ore: 3 }], 'Temporale per 3 ore: pioggia violenta, raffiche, mare agitato'], ['🌧 Pioggia', [{ tipo: 'meteo', meteo: 'pioggia', ore: 2.5 }], 'Pioggia per 2 ore e mezza'],
  ['🥵 Caldo', [{ tipo: 'meteo', meteo: 'caldo', ore: 8 }], 'Ondata di caldo per 8 ore (fino a 38 °C): più sete e fatica'], ['🌊 Bonaccia', [{ tipo: 'meteo', meteo: 'bonaccia', ore: 8 }], 'Mare calmo e cielo sereno per 8 ore'],
  ['💨 Vento', [{ tipo: 'meteo', meteo: 'vento', ore: 6 }], 'Vento forte e mare mosso per 6 ore: fuoco difficile, scogli pericolosi'], ['🥶 Freddo', [{ tipo: 'meteo', meteo: 'freddo', ore: 14 }], 'Freddo insolito per 14 ore: notte gelida'], ['🌫 Nebbia', [{ tipo: 'meteo', meteo: 'nebbia', ore: 4 }], 'Nebbia fitta per 4 ore: si vede poco'],
  ['🐕 Cane', [{ tipo: 'aggiungi_animale', animale: 'cane' }], 'Arriva un cane randagio che segue i naufraghi'], ['🦀 Granchi', [{ tipo: 'aggiungi_animale', animale: 'granchi' }], 'Compaiono granchi sulla riva sud: nuovo cibo'], ['🦈 Squalo', [{ tipo: 'aggiungi_animale', animale: 'squalo' }], 'Uno squalo gira attorno agli scogli: pescare lì diventa pericoloso'], ['🐬 Delfini', [{ tipo: 'aggiungi_animale', animale: 'delfino', quanti: 3 }], 'Un branco di delfini nuota attorno all\'isola'],
  ['🎣 Togli canna', [{ tipo: 'rimuovi_oggetto', nome: 'canna' }], 'Fa sparire la canna da pesca'], ['📓 Togli taccuino', [{ tipo: 'rimuovi_oggetto', nome: 'taccuino' }], 'Fa sparire il taccuino: niente più memoria scritta'], ['⚽ Togli pallone', [{ tipo: 'rimuovi_oggetto', nome: 'pallone' }], 'Fa sparire il pallone'],
  ['🤕 Colpo alla testa', [{ tipo: 'memoria', nome: 'tutti', stato: 'perde la memoria ora e dimentica ogni notte', causa: 'un colpo alla testa' }], 'Tutti i personaggi perdono la memoria e da ora dimenticano tutto ogni notte'],
  ['🧠 Memoria normale', [{ tipo: 'memoria', nome: 'tutti', stato: 'normale' }], 'Tutti tornano ad avere una memoria normale (non recuperano ciò che hanno già dimenticato)'],
  ['🚢 Nave che passa', [{ tipo: 'nave', comportamento: 'passa' }], 'Una nave passa all\'orizzonte: si fermerà solo se vede un falò di segnale'],
];
$('quick').innerHTML = QUICK.map((q, i) => `<button data-q="${i}" title="${q[2]}">${q[0]}</button>`).join('');
$('quick').onclick = (e) => { const b = e.target.closest('button'); if (!b || !ENG.G) return; const q = QUICK[+b.dataset.q]; const done = ENG.applyOps(q[1], q[0]); $('godOut').textContent = done.length ? '✓ ' + done.join('; ') : 'Nessun effetto.'; refreshPanel(true); };
$('godRun').onclick = async () => {
  const txt = $('godText').value.trim(); if (!txt || !ENG.G) return;
  $('godRun').disabled = true; $('godOut').textContent = 'Interpreto la richiesta…';
  try { const r = await ENG.godText(txt); $('godOut').textContent = (r.reply ? r.reply + ' ' : '') + (r.done.length ? '✓ ' + r.done.join('; ') : '(nessuna operazione applicata)'); $('godText').value = ''; }
  catch (e) { $('godOut').textContent = 'Non riuscito: ' + (e && e.code === 'rate_limited' ? 'troppe richieste ravvicinate a Claude, riprova tra poco' : 'riprova o riformula'); }
  $('godRun').disabled = false; refreshPanel(true);
};

/* ---------- events ---------- */
ENG.listeners.onEvent.push((ev) => { if (ev.kind === 'fatal') { $('toast').textContent = ev.text; $('toast').style.display = 'block'; setPlay(false); setTimeout(() => { $('toast').style.display = 'none'; }, 9000); } panelDirty = true; });
ENG.listeners.onChange.push(() => { panelDirty = true; });


/* ---------- small DOM helpers: write only when the value changed (keeps selection, scroll and open <details>) ---------- */
function setText(el, v) { if (el && el._v !== v) { el._v = v; el.textContent = v; } }
function setHTML(el, h, preserve) {
  if (!el || el._h === h) return; el._h = h;
  if (!preserve) { el.innerHTML = h; return; }
  const open = new Set([...el.querySelectorAll('details[open] > summary')].map((s) => s.textContent)); const top = el.parentElement ? el.parentElement.scrollTop : 0;
  el.innerHTML = h;
  if (open.size) el.querySelectorAll('details > summary').forEach((s) => { if (open.has(s.textContent)) s.parentElement.open = true; });
  if (el.parentElement) el.parentElement.scrollTop = top;
}

/* ---------- layout: drawer, tabs, unit bar size, minimap, bubbles ---------- */
const LAYOUT_KEY = 'isola-layout-v2';
const LAYOUT_DEF = { cards: true, view: 'persp', drawer: false, tab: 'mind', unit: 'full', map: true, bubbles: true, edge: false, help: false, fog: 'soft' };
const layout = (() => { try { return Object.assign({}, LAYOUT_DEF, JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}')); } catch (e) { return Object.assign({}, LAYOUT_DEF); } })();
ui.tab = layout.tab;
function applyLayout() {
  const b = document.body.classList;
  b.toggle('drawerOpen', layout.drawer); b.toggle('tabMind', ui.tab === 'mind'); b.toggle('tabGod', ui.tab === 'god'); b.toggle('tabIsle', ui.tab === 'isle');
  b.toggle('ubCompact', layout.unit === 'compact'); b.toggle('ubMin', layout.unit === 'min'); b.toggle('mapHidden', !layout.map);
  document.querySelectorAll('#tabs button').forEach((x) => { const on = x.dataset.tab === ui.tab; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
  $('drawerBtn').classList.toggle('on', layout.drawer); $('godBtn').classList.toggle('on', layout.drawer && ui.tab === 'isle');
  $('mbSize').textContent = { full: '▾', compact: '▾▾', min: '▴' }[layout.unit]; $('mbSize').setAttribute('aria-expanded', String(layout.unit !== 'min'));
  $('bubblesBtn').classList.toggle('on', layout.bubbles); $('edgeBtn').classList.toggle('on', layout.edge);
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch (e) {}
}
function openTab(tab, forceOpen) {
  if (layout.drawer && ui.tab === tab && !forceOpen) layout.drawer = false; else { ui.tab = layout.tab = tab; layout.drawer = true; }
  applyLayout(); refreshPanel(true);

}
function toggleDrawer(v) { layout.drawer = v == null ? !layout.drawer : v; applyLayout(); refreshPanel(true); }
$('drawerBtn').onclick = () => toggleDrawer(); $('drawerHandle').onclick = () => toggleDrawer(true); $('drawerClose').onclick = () => toggleDrawer(false);
$('mbSize').onclick = () => { layout.unit = { full: 'compact', compact: 'min', min: 'full' }[layout.unit]; applyLayout(); };
$('mapToggle').onclick = () => { layout.map = !layout.map; applyLayout(); };
$('bubblesBtn').onclick = () => { layout.bubbles = !layout.bubbles; applyLayout(); };
$('edgeBtn').onclick = () => { layout.edge = !layout.edge; applyLayout(); };
$('helpBtn').onclick = () => { $('helpCard').hidden = false; $('menu').open = false; };
$('helpClose').onclick = () => { $('helpCard').hidden = true; layout.help = true; applyLayout(); };
$('mbRsn').onclick = () => $('mbRsn').classList.toggle('open');
$('toast').onclick = () => { $('toast').style.display = 'none'; };
document.addEventListener('click', (e) => { if ($('menu').open && !e.target.closest('#menu')) $('menu').open = false; });
function setFollow(on) { ui.follow = on; $('follow').classList.toggle('on', on); $('follow').setAttribute('aria-pressed', String(on)); if (on && director) { director = false; $('directorBtn').classList.remove('on'); $('directorBtn').setAttribute('aria-pressed', 'false'); } }
function selectAgent(id, center) { ui.selected = id; mbKey = ''; refreshPanel(true); if (center) RTS.centerOn(id); }
$('centerBtn').onclick = () => RTS.centerOn(ui.selected);
$('offBadge').onclick = () => RTS.centerOn(ui.selected);
applyLayout();

/* ---------- RTS camera: fixed tilt, pan / zoom-to-cursor / rotate, clamped to the island ---------- */
const RTS = (() => {
  const ISL = IslandSim.ISL; const persp = SC.camera; let cam = persp; const dom = SC.renderer.domElement;
  // classic view: orthographic, fixed 2:1 dimetric tilt, 45° steps (like the old strategy games)
  const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 2000); let classic = false;
  const ISO_PITCH = Math.asin(Math.tan(Math.PI / 6)); // 35.26°
  addEventListener('resize', () => { if (classic) sizeOrtho(); });
  function sizeOrtho() { const hh = st.dist * 0.45, ar = innerWidth / innerHeight; ortho.left = -hh * ar; ortho.right = hh * ar; ortho.top = hh; ortho.bottom = -hh; ortho.updateProjectionMatrix(); }
  function setClassic(on) { classic = on; cam = on ? ortho : persp; SC.camera = cam; if (on) { st.tYaw = Math.round((st.tYaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4; } }
  SC.controls.enabled = false;
  const maxDist = 20 + 30 * Math.max(0.8, ISL.span), minDist = 3.5;
  const st = { focus: new THREE.Vector3(0, 0.5, 2), tFocus: new THREE.Vector3(0, 0.5, 2), yaw: 0.64, tYaw: 0.64, dist: maxDist * 0.7, tDist: maxDist * 0.7, spd: 8, pausedUntil: 0 };
  const coast = (x, z) => ISL.R(Math.atan2(z, x));
  const clampXZ = (v) => { const r = Math.hypot(v.x, v.z); const lim = coast(v.x, v.z) + 6; if (r > lim) { v.x *= lim / r; v.z *= lim / r; } return v; };
  const pitchFor = (d) => (classic ? ISO_PITCH : 0.62 + 0.4 * Math.max(0, Math.min(1, (d - minDist) / (maxDist - minDist))));
  const ray = new THREE.Raycaster(); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function ground(ndcX, ndcY) { ray.setFromCamera({ x: ndcX, y: ndcY }, cam); plane.constant = -st.focus.y; const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null; }
  const ndc = (e) => { const r = dom.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]; };
  const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  function pan(dx, dz) { // dx, dz in screen-aligned world units
    const s = Math.sin(st.yaw), c = Math.cos(st.yaw);
    st.tFocus.x += dx * c + dz * s; st.tFocus.z += -dx * s + dz * c; clampXZ(st.tFocus); if (ui.follow) setFollow(false);
  }
  function zoom(f, at) { const nd = Math.max(minDist, Math.min(maxDist, st.tDist * f)); if (at) { const k = 1 - nd / st.tDist; st.tFocus.x += (at.x - st.tFocus.x) * k; st.tFocus.z += (at.z - st.tFocus.z) * k; clampXZ(st.tFocus); } st.tDist = nd; }
  function agentPos(id) { const P = meshes[id]; return P && P.root.visible ? P.root.position : null; }
  function pick(e) { // nearest visible character on screen within 45 px
    const G = ENG.G; if (!G) return null; const r = dom.getBoundingClientRect(); let best = null, bd = 45;
    G.agents.forEach((a) => { const p = agentPos(a.id); if (!p) return; const v = p.clone().add(new THREE.Vector3(0, 1.2, 0)).project(cam); if (v.z > 1) return; const x = (v.x * 0.5 + 0.5) * r.width + r.left, y = (-v.y * 0.5 + 0.5) * r.height + r.top; const d = Math.hypot(x - e.clientX, y - e.clientY); if (d < bd) { bd = d; best = a.id; } });
    return best;
  }
  // pointer input: left/one finger = pan, right/middle = rotate, two fingers = pinch zoom + pan, click = select, double click = center
  const ptrs = new Map(); let drag = null;
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('pointerdown', (e) => { dom.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = { b: e.button, x0: e.clientX, y0: e.clientY, moved: false, pinch: ptrs.size === 2 ? null : undefined }; });
  dom.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true;
    const p = ptrs.get(e.pointerId); if (!p || !drag) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) drag.moved = true; if (!drag.moved) return;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (drag.pinch) zoom(drag.pinch / d); drag.pinch = d; pan(-dx * st.dist * 0.0009, -dy * st.dist * 0.0012); return; }
    if (drag.b === 2 || drag.b === 1 || e.altKey) { if (classic) { drag.rot = (drag.rot || 0) + dx; if (Math.abs(drag.rot) > 80) { st.tYaw -= Math.sign(drag.rot) * Math.PI / 2; drag.rot = 0; } return; } st.tYaw -= dx * 0.006; return; }
    pan(-dx * st.dist * 0.0018, -dy * st.dist * 0.0024);
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (drag && !drag.moved && e.button === 0 && ptrs.size === 0) { const id = pick(e); if (id) { selectAgent(id, false); CC.show(id); } else { const [nx, ny] = ndc(e); const gp = ground(nx, ny); const k = gp && nearestPlace(gp.x, gp.z); if (k) CC.showPlace(k); else CC.hide(); } } if (!ptrs.size) drag = null; };
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  dom.addEventListener('pointerleave', () => { mouse.in = false; });
  dom.addEventListener('dblclick', (e) => { const id = pick(e) || ui.selected; selectAgent(id, true); });
  let wheelAcc = 0; dom.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = ndc(e); if (classic) { wheelAcc += e.deltaY; if (Math.abs(wheelAcc) < 60) return; zoom(wheelAcc > 0 ? 1.3 : 1 / 1.3, ground(x, y)); wheelAcc = 0; return; } zoom(Math.exp(e.deltaY * 0.0011), ground(x, y)); }, { passive: false });
  // keyboard
  const keys = new Set();
  const typing = (e) => { const t = e.target; return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
  addEventListener('keydown', (e) => {
    if (typing(e) || document.body.classList.contains('inSetup') || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); return; }
    if (k === 'q') st.tYaw += classic ? Math.PI / 2 : Math.PI / 4; else if (k === 'e') st.tYaw -= classic ? Math.PI / 2 : Math.PI / 4;
    else if (k === 'f' || k === ' ') { e.preventDefault(); centerOn(ui.selected); }
    else if (k === 'home') overview();
    else if (k === '+' || k === '=') zoom(0.8); else if (k === '-') zoom(1.25);
    else if (k === 'm') $('mapToggle').click();
    else if (k === 'n') $('fogBtn').click();
    else if (k === 'v') $('viewBtn').click();
    else if (k === 'k') $('skipBtn').click();
    else if (k === 'p') $('play').click();
    else if (k === 'escape') { if (CC.open) CC.hide(); else if (!$('helpCard').hidden) $('helpClose').click(); else toggleDrawer(false); }
    else if (k === 'tab' && document.activeElement === document.body) { e.preventDefault(); toggleDrawer(); }
    else if (/^[1-8]$/.test(k)) { const b = document.querySelectorAll('#tabs button')[+k - 1]; if (b) openTab(b.dataset.tab, true); }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  const mouse = { x: 0, y: 0, in: false };
  function overview() { st.tFocus.set(0, st.focus.y, 0); st.tDist = maxDist * 0.75; st.spd = 2.5; }
  function flyTo(x, z, d) { st.tFocus.x = x; st.tFocus.z = z; clampXZ(st.tFocus); if (d) st.tDist = Math.max(minDist, Math.min(maxDist, d)); st.spd = 3; }
  function centerOn(id) { const p = agentPos(id); if (p) flyTo(p.x, p.z, Math.min(st.tDist, 12)); }
  function aim(x, z, d, yaw) { st.tFocus.x = x; st.tFocus.z = z; clampXZ(st.tFocus); if (d != null) st.tDist = Math.max(minDist, Math.min(maxDist, d)); if (yaw != null) st.tYaw = st.yaw + angDiff(st.yaw, yaw); }
  function intro() { const a = sel(); const p = a && a.pos; st.focus.set(0, 0.5, 0); st.tFocus.set(0, 0.5, 0); st.dist = st.tDist = maxDist * 0.8; st.spd = 2;
    if (p) setTimeout(() => { flyTo(p[0], p[1], 13); setFollow(true); }, 1800); }
  function inView(p) { const v = p.clone().project(cam); return v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9; }
  function update(dt) {
    // keyboard + edge scroll pan
    let kx = 0, kz = 0; if (keys.has('a') || keys.has('arrowleft')) kx--; if (keys.has('d') || keys.has('arrowright')) kx++; if (keys.has('w') || keys.has('arrowup')) kz--; if (keys.has('s') || keys.has('arrowdown')) kz++;
    if (layout.edge && mouse.in && document.hasFocus()) { const m = 14; if (mouse.x < m) kx--; if (mouse.x > innerWidth - m) kx++; if (mouse.y < m) kz--; if (mouse.y > innerHeight - m) kz++; }
    if (kx || kz) pan(kx * dt * st.dist * 0.9, kz * dt * st.dist * 0.9);
    const k = 1 - Math.exp(-dt * st.spd);
    st.focus.x += (st.tFocus.x - st.focus.x) * k; st.focus.z += (st.tFocus.z - st.focus.z) * k;
    st.dist += (st.tDist - st.dist) * k; st.yaw += (st.tYaw - st.yaw) * Math.min(1, k * 1.2);
    if (Math.hypot(st.tFocus.x - st.focus.x, st.tFocus.z - st.focus.z) < 0.3 && Math.abs(st.tDist - st.dist) < 0.3) st.spd = 8;
    const gy = Math.max(0, SC.groundH(st.focus.x, st.focus.z)) + 0.5; st.focus.y += (gy - st.focus.y) * Math.min(1, dt * 4);
    const pt = pitchFor(st.dist);
    const back = classic ? st.dist + 160 : st.dist; // the orthographic camera sits far back; its zoom is the frustum size
    cam.position.set(st.focus.x + Math.sin(st.yaw) * Math.cos(pt) * back, st.focus.y + Math.sin(pt) * back, st.focus.z + Math.cos(st.yaw) * Math.cos(pt) * back);
    if (!classic) { const gmin = Math.max(0, SC.groundH(cam.position.x, cam.position.z)) + 1.2; if (cam.position.y < gmin) cam.position.y = gmin; }
    cam.lookAt(st.focus); if (classic) sizeOrtho();
    if (SC.scene.fog) { if (classic) { SC.scene.fog.near = back + st.dist * 2; SC.scene.fog.far = back + st.dist * 6; } else { SC.scene.fog.near = Math.max(40, st.dist * 1.4); SC.scene.fog.far = Math.max(140, st.dist * 4); } }
  }
  function nearestPlace(x, z) { let best = null, bd = 3.2; Object.entries(ENG.PLACES).forEach(([k, p]) => { if (!p.loc) return; const d = Math.hypot(p.loc[0] - x, p.loc[1] - z); if (d < bd) { bd = d; best = k; } }); return best; }
  // world point seen at the 4 screen corners (for the minimap viewport)
  function corners() { return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => { const p = ground(x, y); if (p) return p; const d = new THREE.Vector3(); ray.setFromCamera({ x, y }, cam); return st.focus.clone().add(ray.ray.direction.setY(0).normalize().multiplyScalar(maxDist)); }); }
  return { setClassic, get classic() { return classic; }, get focus() { return st.focus; }, get dist() { return st.dist; }, get yaw() { return st.yaw; }, maxDist, update, aim, flyTo, centerOn, overview, intro, inView, corners, coast,
    followPaused: () => performance.now() < st.pausedUntil, islandCenter: () => ({ x: 0, z: 0 }) };
})();
window.RTS = RTS;
function setView(v) { layout.view = v; RTS.setClassic(v === 'classic'); $('viewBtn').textContent = v === 'classic' ? '🧭 Vista: classica' : '🧭 Vista: prospettiva'; applyLayout(); }
$('viewBtn').onclick = () => setView(layout.view === 'classic' ? 'persp' : 'classic');
setView(layout.view || 'persp');

/* ---------- minimap: 2D canvas drawn from island data ---------- */
const MMK = Math.SQRT1_2; // the island fits the diamond
const mmAngle = () => -Math.PI / 2 - Math.atan2(-Math.cos(RTS.yaw), -Math.sin(RTS.yaw));
let mmFogCanvas = null;
function MM_fog() {
  if (typeof FOW === 'undefined' || FOW.mode === 'off') return null; const N = FOW.N;
  if (!mmFogCanvas) { mmFogCanvas = document.createElement('canvas'); mmFogCanvas.width = mmFogCanvas.height = N; }
  const c = mmFogCanvas.getContext('2d'); const img = c.createImageData(N, N); const on = FOW.mode === 'on';
  for (let k = 0; k < N * N; k++) { const e = FOW.data[k * 4] / 255, v = FOW.data[k * 4 + 1] / 255; img.data[k * 4] = 13; img.data[k * 4 + 1] = 20; img.data[k * 4 + 2] = 32; img.data[k * 4 + 3] = Math.round((1 - e) * (on ? 235 : 150) + e * (1 - v) * (on ? 110 : 55)); }
  c.putImageData(img, 0, 0); return mmFogCanvas;
}
const MM = (() => {
  const cv = $('minimap'); const ctx = cv.getContext('2d'); const ISL = IslandSim.ISL;
  let Rmax = 0; for (let i = 0; i < 256; i++) Rmax = Math.max(Rmax, ISL.R(i / 256 * Math.PI * 2)); Rmax += 5;
  const N = 110; const base = document.createElement('canvas'); base.width = base.height = N;
  { const bx = base.getContext('2d'); const img = bx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i / (N - 1) * 2 - 1) * Rmax, z = (j / (N - 1) * 2 - 1) * Rmax; const h = SC.groundH(x, z); let c;
      if (h < -0.8) c = [29, 79, 110]; else if (h < 0) c = [47, 127, 166]; else if (h < 0.2) c = [232, 215, 166]; else if (h < 1.3) { const t = Math.min(1, h / 1.3); c = [127 - 40 * t, 174 - 50 * t, 90 - 30 * t]; } else c = [150, 140, 118];
      const o = (j * N + i) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; }
    bx.putImageData(img, 0, 0); }
  const sizeCanvas = () => { const d = Math.min(2, devicePixelRatio || 1); const w = cv.clientWidth || 208; if (cv.width !== Math.round(w * d)) { cv.width = cv.height = Math.round(w * d); } };
  const toPx = (x, z) => [(x / Rmax * 0.5 + 0.5) * cv.width, (z / Rmax * 0.5 + 0.5) * cv.height];
  const toWorld = (px, py) => [(px / cv.width * 2 - 1) * Rmax, (py / cv.height * 2 - 1) * Rmax];
  function draw() {
    const G = ENG.G; if (!G || !layout.map) return; sizeCanvas(); const W = G.world; const s = cv.width / 208;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    // diamond minimap: the island turns with the view, so "up" on the map is where the camera looks
    const th = mmAngle(); const c0 = cv.width / 2; ctx.setTransform(Math.cos(th) * MMK, Math.sin(th) * MMK, -Math.sin(th) * MMK, Math.cos(th) * MMK, c0 - (Math.cos(th) * c0 - Math.sin(th) * c0) * MMK, c0 - (Math.sin(th) * c0 + Math.cos(th) * c0) * MMK);
    ctx.imageSmoothingEnabled = true; ctx.fillStyle = '#123a52'; ctx.fillRect(-cv.width, -cv.height, cv.width * 3, cv.height * 3); ctx.drawImage(base, 0, 0, cv.width, cv.height);
    const fogC = MM_fog(); if (fogC) ctx.drawImage(fogC, ...toPx(-ENG.fowR(), -ENG.fowR()), cv.width * ENG.fowR() / Rmax, cv.height * ENG.fowR() / Rmax);
    const seen = (x, z) => FOW.mode !== 'on' || FOW.at(x, z)[0] === 1; const now2 = (x, z) => FOW.mode === 'off' || FOW.at(x, z)[1] === 1;
    const a = sel(); const known = new Set((a && a.known) || []);
    Object.entries(ENG.PLACES).forEach(([k, p]) => { if (!p.loc || !seen(p.loc[0], p.loc[1])) return; const [x, y] = toPx(p.loc[0], p.loc[1]); ctx.fillStyle = known.has(k) ? 'rgba(43,33,22,.85)' : 'rgba(43,33,22,.25)'; ctx.fillRect(x - 1.5 * s, y - 1.5 * s, 3 * s, 3 * s); });
    if (W.fireUntil > ENG.T() && ENG.PLACES.fuoco) { const [x, y] = toPx(ENG.PLACES.fuoco.loc[0], ENG.PLACES.fuoco.loc[1]); ctx.fillStyle = '#ff8a1e'; ctx.beginPath(); ctx.arc(x, y, (3 + Math.sin(performance.now() / 200)) * s, 0, 7); ctx.fill(); }
    (W.custom || []).forEach((c) => { if (!c.loc || !seen(c.loc[0], c.loc[1]) || (c.animal && !now2(c.loc[0], c.loc[1]))) return; const [x, y] = toPx(c.loc[0], c.loc[1]); ctx.fillStyle = c.animal ? '#f6f1e3' : '#7a4f22'; if (c.animal) { ctx.beginPath(); ctx.arc(x, y, 2 * s, 0, 7); ctx.fill(); } else ctx.fillRect(x - 2 * s, y - 2 * s, 4 * s, 4 * s); });
    if (SC.dog.visible && now2(SC.dog.position.x, SC.dog.position.z)) { const [x, y] = toPx(SC.dog.position.x, SC.dog.position.z); ctx.fillStyle = '#f6f1e3'; ctx.beginPath(); ctx.arc(x, y, 2.2 * s, 0, 7); ctx.fill(); }
    G.agents.forEach((p) => { const P = meshes[p.id]; if (!P || !P.root.visible) return; const [x, y] = toPx(P.root.position.x, P.root.position.z); ctx.fillStyle = '#' + new THREE.Color((p.colors && p.colors.shirt) || 0xc0392b).getHexString(); ctx.strokeStyle = p.id === ui.selected ? '#fff' : '#2b2116'; ctx.lineWidth = (p.id === ui.selected ? 2.5 : 1.2) * s; ctx.beginPath(); ctx.arc(x, y, 4 * s, 0, 7); ctx.fill(); ctx.stroke(); });
    const cs = RTS.corners().map((p) => toPx(p.x, p.z)); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); cs.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const nx = c0 + Math.sin(th) * c0 * 0.62, ny = c0 - Math.cos(th) * c0 * 0.62; ctx.fillStyle = '#f3ead3'; ctx.font = `bold ${12 * s}px Georgia`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', nx, ny); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = '#c9a86a'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(c0, 2 * s); ctx.lineTo(cv.width - 2 * s, c0); ctx.lineTo(c0, cv.height - 2 * s); ctx.lineTo(2 * s, c0); ctx.closePath(); ctx.stroke();
  }
  let dragging = false;
  const go = (e) => { const r = cv.getBoundingClientRect(); const c0 = cv.width / 2; const px = (e.clientX - r.left) / r.width * cv.width - c0, py = (e.clientY - r.top) / r.height * cv.height - c0; const th = mmAngle();
    const ux = (Math.cos(th) * px + Math.sin(th) * py) / MMK + c0, uy = (-Math.sin(th) * px + Math.cos(th) * py) / MMK + c0; const [x, z] = toWorld(ux, uy); setFollow(false); RTS.flyTo(x, z); };
  cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); go(e); });
  cv.addEventListener('pointermove', (e) => { if (dragging) go(e); });
  cv.addEventListener('pointerup', () => { dragging = false; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false });
  return { draw };
})();
let mmLast = 0;
function minimapTick() { const n = performance.now(); if (n - mmLast > 250) { mmLast = n; MM.draw(); } }

/* ---------- fog of war on screen: unexplored = shroud, explored but out of sight = dimmed ---------- */
const FOW = (() => {
  const N = ENG.FOW_N; const data = new Uint8Array(N * N * 4); for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const U = { uFowTex: { value: tex }, uFowR: { value: 30 }, uFowMin: { value: 0.28 }, uFowSeen: { value: 0.62 }, uFowOn: { value: 1 }, uFowColor: { value: new THREE.Color(0x0d1420) } };
  const MODES = { soft: [0.28, 0.62, '🌫 Nebbia: attenuata'], on: [0, 0.5, '🌫 Nebbia: come lui'], off: [1, 1, '🌫 Nebbia: spenta'] };
  function patch(mat) {
    if (mat._fow || mat.isPointsMaterial || mat.isSpriteMaterial || mat.isShaderMaterial || mat.isLineBasicMaterial) return; mat._fow = true;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec2 vFowW;\n' + sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n#ifdef USE_INSTANCING\n vFowW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xz;\n#else\n vFowW = (modelMatrix * vec4(position, 1.0)).xz;\n#endif');
      sh.fragmentShader = 'varying vec2 vFowW;\nuniform sampler2D uFowTex; uniform float uFowR, uFowMin, uFowSeen, uFowOn; uniform vec3 uFowColor;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `#include <fog_fragment>
  if (uFowOn > 0.5) { vec2 fuv = vFowW / (2.0 * uFowR) + 0.5; vec2 f = (fuv.x < 0.0 || fuv.y < 0.0 || fuv.x > 1.0 || fuv.y > 1.0) ? vec2(0.0) : texture2D(uFowTex, fuv).rg;
    float vis = mix(uFowMin, mix(uFowSeen, 1.0, f.g), f.r); gl_FragColor.rgb = mix(uFowColor, gl_FragColor.rgb, vis); }`); };
    const key = 'fow1|' + (prev ? prev.toString() : ''); mat.customProgramCacheKey = () => key; mat.needsUpdate = true;
  }
  const skipObj = (o) => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.noFow) return true; return false; };
  [SC.stars, SC.rain, SC.ship, ...SC.clouds].forEach((o) => { if (o) o.userData.noFow = true; });
  function sweep() { SC.scene.traverse((o) => { if ((o.isMesh) && o.material && !o.material._fow && !skipObj(o)) (Array.isArray(o.material) ? o.material : [o.material]).forEach(patch); }); }
  const vis = new Uint8Array(N * N), exp = new Uint8Array(N * N);
  function update() {
    const G = ENG.G; if (!G) return; const R = ENG.fowR(); U.uFowR.value = R; const f = G.world.fog;
    vis.fill(0); const cs = 2 * R / N;
    G.agents.forEach((a) => { const r = ENG.sightOf(a); if (!r) return; const P = meshes[a.id]; const x = P ? P.root.position.x : a.pos[0], z = P ? P.root.position.z : a.pos[1];
      const i0 = Math.max(0, Math.floor(((x - r) / R * 0.5 + 0.5) * N)), i1 = Math.min(N - 1, Math.floor(((x + r) / R * 0.5 + 0.5) * N)), j0 = Math.max(0, Math.floor(((z - r) / R * 0.5 + 0.5) * N)), j1 = Math.min(N - 1, Math.floor(((z + r) / R * 0.5 + 0.5) * N));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx = -R + (i + 0.5) * cs - x, cz = -R + (j + 0.5) * cs - z; if (cx * cx + cz * cz <= r * r) vis[j * N + i] = 1; } });
    for (let k = 0; k < N * N; k++) { exp[k] = f ? (f[k >> 5] >>> (k & 31)) & 1 : 0; }
    // soft edges: a small blur of both channels (the texture is then filtered linearly by the GPU)
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let se = 0, sv = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; const kk = jj * N + ii; const w = di || dj ? 1 : 2; se += exp[kk] * w; sv += vis[kk] * w; n += w; } const k = j * N + i; data[k * 4] = Math.round(se / n * 255); data[k * 4 + 1] = Math.round(sv / n * 255); }
    tex.needsUpdate = true;
  }
  function setMode(m) { layout.fog = m; const v = MODES[m]; U.uFowMin.value = v[0]; U.uFowSeen.value = v[1]; U.uFowOn.value = m === 'off' ? 0 : 1; $('fogBtn').textContent = v[2]; applyLayout(); }
  $('fogBtn').onclick = () => setMode({ soft: 'on', on: 'off', off: 'soft' }[layout.fog] || 'soft');
  setMode(layout.fog || 'soft');
  let last = 0, lastSweep = 0;
  function tick() { const n = performance.now(); if (n - lastSweep > 1000) { lastSweep = n; sweep(); } if (n - last > 250) { last = n; update(); } }
  // explored(0/1) and visible(0/1) at a world point, for the minimap
  const at = (x, z) => { const R = U.uFowR.value; const i = Math.floor((x / R * 0.5 + 0.5) * N), j = Math.floor((z / R * 0.5 + 0.5) * N); if (i < 0 || j < 0 || i >= N || j >= N) return [0, 0]; const k = j * N + i; return [exp[k], vis[k]]; };
  return { tick, at, data, N, get mode() { return layout.fog || 'soft'; } };
})();

/* ---------- character card: click a castaway to see their condition, anchored above them ---------- */
const CC = (() => {
  const el = $('charCard'); let id = null, last = 0;
  const BARS = [['hyd', 'Idratazione', '#3d85c6'], ['sat', 'Sazietà', '#e69138'], ['en', 'Energia', '#6aa84f'], ['hp', 'Salute fisica', '#cc4125'], ['mente', 'Salute mentale', '#8e7cc3'], ['umore', 'Umore', '#c27ba0'], ['ansia', 'Ansia', '#e0a800', true], ['noia', 'Noia', '#b4a7d6', true], ['igiene', 'Igiene', '#76a5af'], ['term', 'Temperatura', '#93c47d']];
  function render() {
    const G = ENG.G; const a = G && G.agents.find((x) => x.id === id); if (!a) { hide(); return; }
    const S = a.alive ? a.stats : (a.deathStats || a.stats); const W = G.world;
    const TST = (v) => (v > 86 ? 'colpo di calore' : v > 72 ? 'accaldato' : v < 14 ? 'ipotermia' : v < 28 ? 'freddo' : 'bene');
    const rows = BARS.map(([k, l, c, inv]) => { const v = Math.round(S[k] == null ? (k === 'term' ? 50 : 0) : S[k]); const bad = inv ? v > 70 : k === 'term' ? (v > 72 || v < 28) : v < 25; const warn = inv ? v > 50 : k === 'term' ? false : v < 45;
      return `<div class="cc-row"><span>${l}</span><div class="cc-bar"><i style="width:${v}%;background:${bad ? '#b5452e' : warn ? '#d4932a' : c}"></i></div><span class="cc-v" style="${bad ? 'color:#b5452e' : ''}">${k === 'term' ? TST(v) : v}</span></div>`; }).join('');
    const wounds = (a.wounds || []).map((w) => `${esc(w.testo || w.tipo)}${w.infected ? ' (infetta)' : ''}`);
    const carry = [...ENG.carriedOf(a).map((k) => ({ axe: 'ascia', knife: 'coltello', rod: 'canna', rope: 'corda' }[k])), a.inv.fish ? a.inv.fish + ' pesci' : '', a.inv.coconut ? a.inv.coconut + ' cocchi' : '', a.inv.crabs ? a.inv.crabs + ' granchi' : '', a.bottleWater ? `bottiglia (${a.bottleWater} sorsate)` : '', ...a.inv.items].filter(Boolean);
    const state = !a.alive ? `✝ morto${a.deathCause ? ': ' + esc(a.deathCause) : ''}` : a.thinking ? '🧠 sta pensando' : a.asleep ? '😴 dorme' : esc(ENG.doingText(a));
    el.innerHTML = `<button class="cc-x" aria-label="Chiudi">✕</button><h3>${esc(a.name)}</h3><div class="cc-sub">${a.age ? a.age + ' anni · ' : ''}${state}${a.emotion && a.alive ? ' · ' + esc(a.emotion) : ''}</div>${rows}
      <div class="cc-note">${wounds.length ? '🩹 ' + wounds.join('; ') + '<br>' : ''}${a.sick > 0 ? '🤢 sta male<br>' : ''}🎒 ${carry.map(esc).join(', ') || 'non porta niente'}${a.hasNotebook ? ' · taccuino' : ''}</div>
      <div class="row" style="margin-top:8px;gap:6px;justify-content:flex-end"><button data-cc="center">⌖ Centra</button><button data-cc="mind">🧠 Pensieri e progetti</button></div>`;
  }
  function place() {
    if (el.hidden || (!id && !placeKey)) return; let P = id ? meshes[id] : null; if (id && (!P || !P.root.visible)) return;
    if (!P) { const L = ENG.PLACES[placeKey].loc; P = { root: { position: new THREE.Vector3(L[0], SC.groundH(L[0], L[1]), L[1]) } }; }
    const v = P.root.position.clone().add(new THREE.Vector3(0, 2.9, 0)).project(SC.camera); if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; const w = el.offsetWidth, h = el.offsetHeight;
    const ub = $('unitBar').getBoundingClientRect(); const floor = (ub.top > innerHeight * 0.4 ? ub.top : innerHeight) - 8;
    let left, top, side = '';
    if (y - h - 14 >= 62) { left = x - w / 2; top = y - h - 14; } // above the head
    else { const yc = (-(P.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)).project(SC.camera).y) * 0.5 + 0.5) * innerHeight; top = yc - h / 2; side = x + 40 + w < innerWidth - 8 ? 'right' : 'left'; left = side === 'right' ? x + 40 : x - 40 - w; }
    el.dataset.side = side; el.style.left = Math.max(8, Math.min(innerWidth - w - 8, left)) + 'px'; el.style.top = Math.max(60, Math.min(floor - h, top)) + 'px';
  }
  let placeKey = null;
  function placeInfo(k) {
    const G = ENG.G, W = G.world, P = ENG.PLACES[k]; const res = []; const T0 = ENG.T();
    const alivePalms = Object.values(W.palmsAlive || {}).filter(Boolean).length || 1;
    if (/palm/.test(k)) { const alive = !W.palmsAlive || W.palmsAlive[k] !== false; res.push(alive ? `🥥 noci di cocco sulle palme: circa ${Math.round((W.coconuts || 0) / alivePalms)} (ricrescono piano)` : '🪵 palma abbattuta: resta il ceppo'); if ((W.coconutsGround || 0) >= 1 && k === 'palme') res.push(`🥥 cadute a terra: ${Math.floor(W.coconutsGround)}`); if (alive) res.push('🧵 foglie da intrecciare (fibre)'); }
    if (k === 'boscaglia') { res.push(`🪵 legna secca: circa ${Math.round(W.brush || 0)} pezzi (ricresce lentamente; più veloce con l'ascia)`); if (IslandSim.ISL.res.lianas) res.push(`🧵 liane: circa ${Math.round(W.fiberLeft || 0)} fasci disponibili, ricrescono`); }
    if (k === 'pietre') { res.push(`🪨 pietre da portare via: circa ${Math.round(W.stoneLeft == null ? 70 : W.stoneLeft)} (non ricrescono)`); if (IslandSim.ISL.res.flint) res.push('🔪 selce: schegge affilate che tagliano come un coltello'); res.push('🪱 sotto i sassi: esche'); }
    if (k === 'scogli') { res.push(`🐟 pesci vicino a riva: ${Math.round((W.fishStock == null ? 1 : W.fishStock) * 100)}% del normale`); res.push('🦪 molluschi: solo con la bassa marea'); res.push('🪨 pietre'); }
    if (k === 'sorgente') res.push(`💧 acqua dolce: portata ${Math.round(W.spring == null ? 100 : W.spring)}% (massimo ${W.springCap || 100}); torbida, meglio bollirla`);
    if (k === 'banani' || k === 'papaie') res.push(`🍌 frutti maturi: circa ${Math.round(W.fruit || 0)} (ricrescono ogni giorno)`);
    if (k === 'nidi') res.push(`🥚 uova nei nidi: circa ${Math.round(W.eggs || 0)} · gli uccelli difendono i nidi`);
    if (k === 'riva_sud') res.push(`🦀 granchi: circa ${Math.round(W.crabStock || 0)} (escono di notte e con la bassa marea) · buon punto di pesca`);
    if (k === 'fuoco') { res.push(W.fireEternal ? '🔥 fuoco perenne: non si spegne mai' : W.fireUntil > T0 ? `🔥 fuoco acceso: ancora circa ${Math.ceil(W.fireUntil - T0)} ore` : '🔥 fuoco spento'); res.push(`🪵 legna pronta: ${W.woodPile || 0}`); if (W.hearth) res.push('🪨 focolare di pietre: il fuoco dura di più e resiste meglio alla pioggia'); }
    if (k === 'riparo') { res.push(`🛖 riparo: ${['non ancora costruito', 'struttura di pali', 'coperto di foglie', 'completo'][W.shelter || 0]}${W.bed ? ' · giaciglio' : ''}${W.wall ? ' · muretto di pietre' : ''}`); }
    if (k === 'cassa') res.push(W.crateOpened === false ? '📦 cassa chiusa: nessuno sa cosa contenga' : '📦 cassa aperta');
    if (k === 'collina') { res.push('👁 da quassù si vede tutta l\'isola'); if (W.pile) res.push('🪵 catasta per il falò di segnale pronta'); res.push('🪨 pietre'); }
    const objs = (W.custom || []).filter((c) => c.loc && Math.hypot(c.loc[0] - P.loc[0], c.loc[1] - P.loc[1]) < 4).map((c) => (c.animal ? '🐾 ' : '🧰 ') + c.name);
    const who = G.agents.filter((a) => (a.known || []).includes(k)).map((a) => a.name);
    return { res, objs, who };
  }
  function renderPlace() {
    const G = ENG.G; const P = G && ENG.PLACES[placeKey]; if (!P) { hide(); return; } const info = placeInfo(placeKey);
    el.innerHTML = `<button class="cc-x" aria-label="Chiudi">✕</button><h3>${esc(placeKey.replace(/_/g, ' '))}</h3><div class="cc-sub">${esc(P.desc)}</div>
      <div class="cc-note">${info.res.map(esc).join('<br>') || 'Nessuna risorsa particolare.'}${info.objs.length ? '<br>' + info.objs.map(esc).join('<br>') : ''}</div>
      <div class="cc-note">${info.who.length ? '🧭 Lo conosce: ' + info.who.map(esc).join(', ') : '❔ Nessuno lo ha ancora scoperto'}</div>`;
  }
  function showPlace(k) { if (FOW.mode === 'on') { const L = ENG.PLACES[k].loc; if (!FOW.at(L[0], L[1])[0]) { hide(); return; } } id = null; placeKey = k; el.hidden = false; renderPlace(); place(); last = performance.now(); }
  function show(aid) { placeKey = null; id = aid; el.hidden = false; render(); place(); last = performance.now(); }
  function hide() { el.hidden = true; id = null; placeKey = null; }
  el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.classList.contains('cc-x')) hide(); else if (b.dataset.cc === 'center') RTS.centerOn(id); else if (b.dataset.cc === 'mind') { openTab('mind', true); hide(); } });
  function tick() { if (el.hidden) return; const n = performance.now(); if (n - last > 700) { last = n; if (placeKey) renderPlace(); else render(); } place(); }
  return { show, showPlace, hide, tick, get open() { return !el.hidden; } };
})();

/* ---------- see-through canopy: crowns between the camera and a castaway are lifted away (like strategy games) ---------- */
const OCC = (() => {
  let last = 0; const hiddenNow = new Set(); const st = { dirty: true };
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function tick() {
    const G = ENG.G; if (!G) return; const n = performance.now(); if (n - last < 150 && !st.dirty) return; last = n;
    const cam = SC.camera; const people = G.agents.filter((a) => a.alive && meshes[a.id] && meshes[a.id].root.visible).map((a) => meshes[a.id].root.position);
    const occluding = (x, z, r) => people.some((p) => { const cx = cam.position.x - p.x, cz = cam.position.z - p.z; const L = Math.hypot(cx, cz) || 1; const ux = cx / L, uz = cz / L; const dx = x - p.x, dz = z - p.z; const along = dx * ux + dz * uz, perp = Math.abs(dx * uz - dz * ux); return along > -1.6 && along < 7 && perp < r; });
    const B = SC.bigX;
    const inFront = (x, z) => people.some((p) => { const cx = cam.position.x - p.x, cz = cam.position.z - p.z; const L = Math.hypot(cx, cz) || 1; const dx = x - p.x, dz = z - p.z; const along = (dx * cx + dz * cz) / L, perp = Math.abs(dx * cz - dz * cx) / L; return along > 0.3 && along < 4 && perp < 0.9; });
    if (B && B.crowns) { const want = new Set(), trunkOff = new Set(); B.treeList.forEach((t, i) => { if (occluding(t.x, t.z, 1.6 + 1.3 * t.s)) want.add(i); if (inFront(t.x, t.z)) { trunkOff.add(i); want.add(i); } });
      let changed = st.dirty; if (!changed) { if (want.size !== hiddenNow.size) changed = true; else for (const i of want) if (!hiddenNow.has(i)) { changed = true; break; } }
      if (changed) { for (let i = 0; i < B.treeList.length; i++) { const cutDown = i < B.nForest && i < (B.cut || 0); m4.fromArray(B.mats, i * 16); B.trees.setMatrixAt(i, cutDown || trunkOff.has(i) ? zero : m4); B.crowns.setMatrixAt(i, cutDown || want.has(i) ? zero : m4); }
        B.trees.instanceMatrix.needsUpdate = B.crowns.instanceMatrix.needsUpdate = true; hiddenNow.clear(); want.forEach((i) => hiddenNow.add(i)); } }
    [...SC.palms, ...(SC.extraPalms || [])].forEach((pm) => { const p = pm.g.position; pm.crown.visible = !occluding(p.x, p.z, 2.6); });
    st.dirty = false;
  }
  return { tick, set dirty(v) { st.dirty = v; } };
})();

/* ---------- jumping fish where fishing is good (more where the stock is rich, at dawn and dusk) ---------- */
const FISH = (() => {
  const pool = []; const mat = new THREE.MeshPhongMaterial({ color: 0xc9d6de, flatShading: true, shininess: 90 });
  for (let i = 0; i < 4; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 5), mat); b.rotation.z = Math.PI / 2; g.add(b); const t = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 3), mat); t.rotation.z = -Math.PI / 2; t.position.x = -0.32; g.add(t);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.25, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.userData.noFow = true;
    g.scale.setScalar(1.6); g.visible = false; SC.scene.add(g); SC.scene.add(ring); pool.push({ g, ring, t: -1, x: 0, z: 0, dir: 0 }); }
  function spots(G) { const P = ENG.PLACES, W = G.world, ISL = IslandSim.ISL; const stock = W.fishStock == null ? 1 : W.fishStock; const out = [];
    const off = (L, k) => { const a = Math.atan2(L[1], L[0]); return ISL.shoreAt(a + (Math.random() - 0.5) * 0.25, 1.5 + Math.random() * 3.5); };
    if (P.scogli) out.push({ w: stock * 1.0, at: () => off(P.scogli.loc) });
    if (P.riva_sud) out.push({ w: stock * 0.6, at: () => off(P.riva_sud.loc) });
    if (P.laguna) out.push({ w: Math.max(0.5, stock) * 1.3, at: () => { const L = P.laguna.loc; return [L[0] + (Math.random() - 0.5) * 5, L[1] + (Math.random() - 0.5) * 5]; } });
    return out; }
  let acc = 0;
  function tick(dt) {
    const G = ENG.G; if (!G) return; const h = ((G.h % 24) + 24) % 24; const light = h > 5.5 && h < 19.5; const golden = (h > 5.5 && h < 8.5) || (h > 16.5 && h < 19.5);
    acc += dt; if (acc > 0.5 && light) { acc = 0; const sp = spots(G); sp.forEach((s) => { if (Math.random() < 0.12 * s.w * (golden ? 2 : 1) * Math.min(4, ui.speed)) { const f = pool.find((q) => q.t < 0); if (!f) return; const [x, z] = s.at(); f.x = x; f.z = z; f.dir = Math.random() * 6.28; f.t = 0; f.g.visible = true; } }); }
    pool.forEach((f) => { if (f.t < 0) return; f.t += dt / 0.9; const k = f.t; if (k >= 1.6) { f.t = -1; f.g.visible = false; f.ring.material.opacity = 0; return; }
      if (k < 1) { const y = Math.sin(k * Math.PI) * 0.9 - 0.15; f.g.position.set(f.x + Math.cos(f.dir) * (k - 0.5) * 1.4, y, f.z + Math.sin(f.dir) * (k - 0.5) * 1.4); f.g.rotation.set(0, -f.dir, Math.cos(k * Math.PI) * 0.9); }
      else f.g.visible = false;
      const rk = k < 1 ? k * 0.3 : (k - 1) / 0.6; f.ring.position.set(f.x + Math.cos(f.dir) * 0.7, 0.05, f.z + Math.sin(f.dir) * 0.7); f.ring.scale.setScalar(1 + rk * 4); f.ring.material.opacity = k > 0.9 ? Math.max(0, 0.7 * (1 - rk)) : 0; });
  }
  return { tick };
})();

/* ---------- selection: ring on the ground, health bar over the head, portrait in the unit bar ---------- */
const SEL = (() => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.userData.noFow = true; ring.renderOrder = 2; SC.scene.add(ring);
  const bar = document.createElement('div'); bar.className = 'hpbar'; bar.innerHTML = '<i></i>'; document.body.appendChild(bar);
  const rt = new THREE.WebGLRenderTarget(128, 128); const pc = new THREE.PerspectiveCamera(28, 1, 0.05, 60); const px = new Uint8Array(128 * 128 * 4);
  const pcv = $('portrait'), pctx = pcv.getContext('2d'); const img = pctx.createImageData(128, 128); let lastP = 0, lastId = null;
  function portrait(a, P) {
    const sc = ((a.colors && a.colors.scale) || 1.35) / 1.35; const head = P.root.position.clone().add(new THREE.Vector3(0, 2.15 * sc, 0)); const h = P.heading || 0;
    pc.position.copy(head).add(new THREE.Vector3(Math.sin(h) * 1.5, 0.12, Math.cos(h) * 1.5)); pc.lookAt(head.x, head.y - 0.12, head.z);
    const r = SC.renderer; const ring0 = ring.visible; ring.visible = false; r.setRenderTarget(rt); r.render(SC.scene, pc); r.readRenderTargetPixels(rt, 0, 0, 128, 128, px); r.setRenderTarget(null); ring.visible = ring0;
    for (let y = 0; y < 128; y++) img.data.set(px.subarray((127 - y) * 512, (128 - y) * 512), y * 512); pctx.putImageData(img, 0, 0);
  }
  function tick() {
    const G = ENG.G; const a = G && sel(); const P = a && meshes[a.id];
    const ok = P && P.root.visible && a.alive && !document.body.classList.contains('inSetup');
    ring.visible = !!ok; bar.style.display = ok ? 'block' : 'none'; if (!ok) return;
    const p = P.root.position; ring.position.set(p.x, SC.groundH(p.x, p.z) + 0.06, p.z); ring.material.opacity = 0.65 + Math.sin(performance.now() / 300) * 0.2;
    const sc = ((a.colors && a.colors.scale) || 1.35) / 1.35; const v = p.clone().add(new THREE.Vector3(0, 2.45 * sc, 0)).project(SC.camera);
    bar.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; bar.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    const hp = Math.round(a.stats.hp || 0); const f = bar.firstElementChild; f.style.width = hp + '%'; f.style.background = hp < 30 ? '#b5452e' : hp < 55 ? '#d4932a' : '#5f8f4a';
    const n = performance.now(); if (n - lastP > (lastId === a.id ? 3000 : 200)) { lastP = n; lastId = a.id; try { portrait(a, P); } catch (e) {} }
  }
  return { tick };
})();

/* ---------- unit bar: current thought (big), state, five key needs ---------- */
let mbKey = '', mbSayKey = '', offCheck = 0;
function updateUnitBar(G) {
  const a = sel(); if (!a) return;
  const t = a.thoughts[a.thoughts.length - 1];
  const key = a.id + '|' + a.thoughts.length + '|' + a.alive;
  $('thinkBadge').hidden = !(a.alive && a.thinking); $('mbText').setAttribute('aria-busy', String(!!a.thinking));
  $('mbText').style.opacity = a.thinking ? 0.55 : 1;
  if (key !== mbKey) {
    mbKey = key; setText($('mbWho'), a.name);
    const el = $('mbText');
    el.innerHTML = t ? (t.hallucination ? `<div class="hal">👁 percezione non reale: ${esc(t.hallucination)}</div>` : '') + esc(t.text) : '<span style="font-family:Inter;font-size:14px;color:#4f4433">Ancora nessun pensiero.</span>';
    el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh');
    setText($('mbRsn'), t && t.reasoning ? '🔧 ' + t.reasoning : '');
  }
  setText($('mbMeta'), G.ended ? '🏁 ' + G.ended : !a.alive ? '✝ morto' : t ? `G${t.day} ${fmtH(t.h)}${t.emotion ? ' · ' + t.emotion : ''} · umore ${Math.round(t.umore)}` : '');
  const say = a.alive && a.bubble && a.bubble.kind === 'speech' && a.bubble.until > performance.now() ? a.bubble.text : '';
  if (say !== mbSayKey) { mbSayKey = say; setText($('mbSay'), say ? `💬 ${a.bubble.to ? '→ ' + a.bubble.to + ' ' : ''}«${say}»` : ''); }
  const now = performance.now(); if (now - offCheck > 500) { offCheck = now; const P = meshes[a.id]; $('offBadge').hidden = !(P && P.root.visible && a.alive && !RTS.inView(P.root.position.clone().add(new THREE.Vector3(0, 1, 0)))); }
}
const CRIT = [['hyd', '💧', 'Idratazione'], ['sat', '🍖', 'Sazietà'], ['en', '⚡', 'Energia'], ['hp', '❤️', 'Salute fisica'], ['mente', '🧠', 'Salute mentale']];
function updateCrit(a) {
  const box = $('crit'); const S = a.alive ? a.stats : (a.deathStats || a.stats);
  if (!box.children.length) { box.innerHTML = CRIT.map(([k, ic, l]) => `<div class="meter" role="meter" aria-label="${l}" aria-valuemin="0" aria-valuemax="100" title="${l} — clic per tutti i parametri" data-k="${k}"><div class="ic">${ic}</div><div class="v"></div><div class="mb"><i></i></div></div>`).join(''); box.onclick = () => openTab('mind', true); }
  [...box.children].forEach((m) => { const v = Math.round(S[m.dataset.k] == null ? 0 : S[m.dataset.k]); m.setAttribute('aria-valuenow', v); m.classList.toggle('crit', v < 25); m.classList.toggle('warn', v >= 25 && v < 45); m.children[1].textContent = v; const i = m.children[2].firstElementChild; i.style.width = v + '%'; i.style.background = v < 25 ? '#b5452e' : v < 45 ? '#d4932a' : '#5f8f4a'; });
}
/* ---------- resource bar: what the camp has (observer only) ---------- */
let resLast = 0; const resPrev = {};
function updateResBar(G) {
  const n = performance.now(); if (n - resLast < 800) return; resLast = n; const W = G.world; const al = G.agents.filter((x) => x.alive);
  const sum = (f) => al.reduce((s, x) => s + (f(x) || 0), 0);
  const food = sum((x) => x.inv.fish + x.inv.coconut + x.inv.crabs + x.inv.items.filter((i) => /^carne/.test(i)).length);
  const water = sum((x) => x.bottleWater) + Math.floor((W.tarpWater || 0) / 10);
  const tools = [W.axe && 'ascia', W.knife && 'coltello', W.rod && 'canna', W.spear && 'lancia', W.rope && 'corda'].filter(Boolean);
  const fireH = Math.max(0, W.fireUntil - ENG.T());
  const items = [
    ['wood', '🪵', W.woodPile || 0, `Legna pronta: ${W.woodPile || 0} pezzi · serve per fuoco, riparo, giaciglio, catasta di segnalazione, zattera${W.brush != null ? ` · nella boscaglia ne restano circa ${W.brush}` : ''}`],
    ['stone', '🪨', W.stone || 0, `Pietre al campo: ${W.stone || 0} · servono per focolare (6), muretto del riparo (8), SOS${W.hearth ? ' · focolare costruito' : ''}${W.wall ? ' · muretto costruito' : ''}`],
    ['fiber', '🧵', W.fiber || 0, `Fibre per legare: ${W.fiber || 0} fasci (liane, foglie di palma) · fanno da corda: si risparmia legna per riparo, catasta, zattera · da raccogliere ne restano circa ${Math.round(W.fiberLeft || 0)}, ricrescono`],
    ['food', '🍖', food, `Cibo portato dai naufraghi: ${food} porzioni (pesci, cocchi, granchi, carne) · sulle palme circa ${Math.round(W.coconuts || 0)} noci di cocco`],
    ['water', '💧', water, `Acqua di scorta: ${water} sorsate (bottiglia e telo) · la sorgente è al ${Math.round(W.spring == null ? 100 : W.spring)}%`],
    W.fireEternal ? ['fire', '🔥', '∞', 'Fuoco del campo perenne: arde da solo e non si spegne mai'] : ['fire', '🔥', fireH > 0 ? Math.ceil(fireH) + 'h' : '—', fireH > 0 ? `Fuoco acceso: dura ancora circa ${Math.ceil(fireH)} ore · scalda, cuoce, tiene lontani gli animali, si vede dal mare` : 'Fuoco spento'],
    ['tools', '🛠', tools.length, `Attrezzi: ${tools.join(', ') || 'nessuno'}${W.crateOpened === false ? ' (cassa ancora chiusa)' : ''}`],
    ['shelter', '🏠', ['—', '1/3', '2/3', '3/3'][W.shelter || 0], `Riparo: ${['assente', 'struttura di pali', 'coperto di foglie', 'completo'][W.shelter || 0]}${W.bed ? ' · con giaciglio' : ''}`],
    ['sos', '🆘', W.sos ? Math.round(W.sos) : '—', W.sos ? `Scritta SOS sulla spiaggia (grandezza ${Math.round(W.sos)}) · più è grande, più è visibile da navi e aerei` : 'Nessun segnale SOS'],
  ];
  const box = $('resBar');
  if (!box.children.length) box.innerHTML = items.map(([k, ic]) => `<button class="res" data-r="${k}"><span aria-hidden="true">${ic}</span><span class="n"></span></button>`).join('');
  items.forEach(([k, ic, v, tip]) => { const b = box.querySelector(`[data-r="${k}"]`); const n2 = b.querySelector('.n'); const sv = String(v); if (n2.textContent !== sv) { const pv = resPrev[k]; if (pv != null && typeof v === 'number' && typeof pv === 'number') { b.classList.remove('up', 'down'); void b.offsetWidth; b.classList.add(v > pv ? 'up' : 'down'); } resPrev[k] = v; n2.textContent = sv; } b.title = tip; b.setAttribute('aria-label', tip); b.classList.toggle('zero', v === 0 || v === '—'); });
}
{ $('resBar').onclick = (e) => { const b = e.target.closest('.res'); if (!b) return; const t = $('toast'); t.textContent = b.title; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 5000); }; }
if (!layout.help) setTimeout(() => { if (!document.body.classList.contains('inSetup')) { $('helpCard').hidden = false; } }, 4000);

/* ---------- PDF export: analysis + full story + notebook, letters, moments, photos ---------- */
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = JSPDF_URL; s.onload = () => (window.jspdf ? res(window.jspdf) : rej(new Error('jspdf'))); s.onerror = rej; document.head.appendChild(s); });
}
// standard PDF fonts cover Latin text only: drop emoji and symbols they can't draw
const pdfClean = (t) => String(t == null ? '' : t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—‘’“”…€]/g, '').replace(/ {2,}/g, ' ').trim();
async function exportPDF(btn) {
  const G = ENG.G; if (!G) return; const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Preparo il PDF…'; }
  try {
    const { jsPDF } = await loadJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' }); const PW = 210, PH = 297, M = 18, TW = PW - 2 * M; let y = M;
    const ensure = (h) => { if (y + h > PH - M) { doc.addPage(); y = M; } };
    const para = (t, o = {}) => { const size = o.size || 10.5; doc.setFont(o.font || 'times', o.style || 'normal'); doc.setFontSize(size); doc.setTextColor(...(o.color || [43, 33, 22]));
      const lines = doc.splitTextToSize(pdfClean(t), TW - (o.indent || 0)); const lh = size * 0.42;
      lines.forEach((l) => { ensure(lh); doc.text(l, M + (o.indent || 0), y); y += lh; }); y += o.after == null ? 2 : o.after; };
    const h1 = (t) => { ensure(18); y += 4; para(t, { size: 17, style: 'bold', after: 1 }); doc.setDrawColor(192, 138, 46); doc.setLineWidth(0.6); doc.line(M, y, PW - M, y); y += 5; };
    const h2 = (t) => { ensure(12); y += 2; para(t, { size: 12.5, style: 'bold', after: 1 }); };
    const small = (t) => para(t, { size: 9, font: 'helvetica', color: [79, 68, 51] });
    const sc = (ENG.SCENARIOS && ENG.SCENARIOS[G.scenario || 'libero']) || {};
    const days = G.endedAt ? G.endedAt.day : G.day;
    // cover
    y = 60; para("Esperimento sociale: l'isola", { size: 26, style: 'bold', after: 4 });
    para(G.ended ? 'Esito: ' + G.ended : `In corso — giorno ${G.day}, ore ${fmtH(G.h)}`, { size: 13, style: 'italic', after: 8 });
    small(`Scenario: ${sc.label || 'libero'}${sc.q ? ' — ' + sc.q : ''}`);
    small(`Durata: ${days} ${days === 1 ? 'giorno' : 'giorni'} · isola n. ${IslandSim.ISL.seed || '—'} · meteo n. ${G.seed} · mente: ${G.mindModel || 'Claude'} · esportato il ${new Date().toLocaleString('it-IT')}`);
    y += 4; h2('Le persone');
    G.agents.forEach((a) => para(`${a.name}${a.age ? ', ' + a.age + ' anni' : ''} — ${a.alive ? (a.departed ? 'partito' : 'vivo') : 'morto il giorno ' + (a.deathDay || '?') + ' (' + (a.deathCause || 'causa sconosciuta') + ')'}${a.persona ? '. Carattere: ' + a.persona : ''}`, { size: 10.5 }));
    const md = Object.keys(G.medals || {}); if (md.length) { h2('Medaglie'); para(md.map((k) => pdfClean(ENG.MEDALS[k])).join(' · ')); }
    // analysis
    if (G.analysis) { doc.addPage(); y = M; h1("Analisi dell'esperimento"); if (sc.q) para(sc.q, { style: 'italic' }); para(G.analysis, { size: 11 }); }
    (G.episodes || []).forEach((e, i) => { if (!i) { doc.addPage(); y = M; h1('Le puntate'); } h2(`Puntata ${e.n} — ${e.title} (giorni ${e.from}–${e.to})`); para(e.text); if (e.hook) para(e.hook, { style: 'italic' }); });
    // story
    doc.addPage(); y = M; h1('Il racconto');
    const st = (G.stories || []).slice().sort((a, b) => a.day - b.day || (a.final ? 1 : 0) - (b.final ? 1 : 0));
    if (!st.length) para('Nessun capitolo scritto (modalità economica o partita troppo breve).', { style: 'italic' });
    st.forEach((s) => { h2(`${s.final ? 'Epilogo' : 'Giorno ' + s.day} — ${s.title}`); String(s.text).split(/\n+/).forEach((p) => para(p, { size: 11, after: 2.5 })); y += 2; });
    // moments
    const hl = G.highlights || []; if (hl.length) { doc.addPage(); y = M; h1('Momenti salienti'); hl.forEach((h) => para(/^Giorno \d/.test(h.text) ? h.text : `Giorno ${h.day}, ${fmtH(h.h)} — ${h.text}`, { size: 10, after: 1.2 })); }
    // notebooks and letters
    G.agents.filter((a) => a.notebook && a.notebook.pages && a.notebook.pages.length).forEach((a) => { doc.addPage(); y = M; h1(`Il taccuino di ${a.name}`); a.notebook.pages.forEach((p, i) => { h2(`Pagina ${i + 1}${p.day ? ' (giorno ' + p.day + ')' : ''}`); para(p.text, { size: 11, style: 'italic' }); }); });
    if ((G.letters || []).length) { doc.addPage(); y = M; h1('Lettere mai spedite'); G.letters.forEach((l) => { h2(`${l.from} a ${l.to} (giorno ${l.day})`); para(l.text, { size: 11, style: 'italic' }); }); }
    // group dynamics
    if ((G.socialDays || []).some((d) => d.text)) { doc.addPage(); y = M; h1('Le dinamiche del gruppo'); G.socialDays.filter((d) => d.text).forEach((d) => { h2(`Giorno ${d.day}`); para(d.text, { size: 11 }); }); }
    // illustrated diary (text; the sketches are in the album)
    if ((G.diary || []).length) { doc.addPage(); y = M; h1('Il diario della sera'); G.diary.forEach((d) => { h2(`Giorno ${d.day} — ${d.agent}`); para(d.text, { size: 11, style: 'italic' }); }); }
    // photos
    const ph = photos.filter((p) => p && p.src && (p.game == null || p.game === G.seed)).slice(-12);
    if (ph.length) { doc.addPage(); y = M; h1('Fotografie'); const cw = (TW - 6) / 2, ch = cw * 9 / 16;
      ph.forEach((p, i) => { const col = i % 2; if (col === 0) ensure(ch + 10); try { doc.addImage(p.src, 'JPEG', M + col * (cw + 6), y, cw, ch); } catch (e) {} doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(79, 68, 51); doc.text(doc.splitTextToSize(pdfClean(p.label || `Giorno ${p.day || ''}`), cw)[0] || '', M + col * (cw + 6), y + ch + 4); if (col === 1 || i === ph.length - 1) y += ch + 9; }); }
    // page numbers
    const n = doc.getNumberOfPages(); for (let i = 2; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140, 120, 90); doc.text(`Esperimento sociale: l'isola — ${i}/${n}`, PW / 2, PH - 8, { align: 'center' }); }
    const name = `isola-${(G.agents[0] && G.agents[0].name || 'naufrago').replace(/[^\w]+/g, '-').toLowerCase()}-giorno${days}.pdf`;
    const res = await saveFile(name, doc.output('blob')); const t = $('toast'); t.textContent = res === 'saved' ? `📄 PDF salvato (${n} pagine).` : res === 'declined' ? 'Download annullato.' : res === 'error' ? '' : `📄 PDF pronto (${n} pagine).`; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 6000);
    window._lastPdf = { pages: n, name };
  } catch (e) { const t = $('toast'); t.textContent = 'Non riesco a creare il PDF (libreria non raggiungibile). Riprova più tardi.'; t.style.display = 'block'; setTimeout(() => { t.style.display = 'none'; }, 6000); }
  if (btn) { btn.disabled = false; btn.textContent = label; }
}
$('pdfBtn').onclick = () => { $('menu').open = false; exportPDF($('pdfBtn')); };

/* ---------- inner voice: a suggestion the castaway feels as his own idea (he may ignore it) ---------- */
$('whisperRun').onclick = () => { const a = sel(); const t = $('whisperText').value.trim(); if (!a || !t || !ENG.G) return; if (!a.alive) { $('whisperOut').textContent = `${a.name} è morto.`; return; }
  ENG.whisper(a.id, t); $('whisperText').value = ''; refreshPanel(true); whisperStatus(); };
// live status of the last inner voice: waiting → being considered → what he thought of it
function whisperStatus() { const a = sel(); const out = $('whisperOut'); if (!a || !ENG.G) return; let txt = '';
  if (a.whisper) txt = !ENG.G.running ? `⏸ La simulazione è in pausa: ${a.name} ci penserà quando premi ▶.` : a.asleep ? `💤 ${a.name} dorme: troverà l'idea al risveglio.` : `💭 L'idea è arrivata a ${a.name}: la sta per considerare…`;
  else if (a.whisperUsed) txt = `🤔 ${a.name} sta valutando l'idea…`;
  else if (a.whisperLast) txt = `💭 «${a.whisperLast.text}» — ${a.name} ci ha pensato: ${a.whisperLast.answer || '(nessun commento)'}`;
  if (out.textContent !== txt) out.textContent = txt; }
// who the inner voice and the questions go to: always visible, follows the selection
function syncTarget() { const G = ENG.G; if (!G) return; const sel2 = $('targetSel'); const opts = G.agents.filter((a) => a.alive && !a.departed).map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
  if (sel2._o !== opts) { sel2._o = opts; sel2.innerHTML = opts; } if (sel2.value !== ui.selected && [...sel2.options].some((o) => o.value === ui.selected)) sel2.value = ui.selected;
  const a = sel(); setText($('whoW'), a ? `— a ${a.name}` : '');
  if (syncTarget.last !== ui.selected) { syncTarget.last = ui.selected; $('whisperOut').textContent = ''; $('askOut').textContent = ''; $('askText').placeholder = `🎤 Fai una domanda a ${a ? a.name : 'lui'} (es. cosa ti manca di più?)`; $('whisperText').placeholder = `Un'idea che viene in mente a ${a ? a.name : 'lui'}…`; } }
$('targetSel').onchange = () => selectAgent($('targetSel').value, false);
$('whisperBtn').onclick = () => { openTab('god', true); setTimeout(() => $('whisperText').focus(), 80); };
$('whisperText').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('whisperRun').click(); });

/* ---------- fate cards: every morning three cards, you may play one (or none) ---------- */
const FATE = (() => {
  const DECK = [
    ['⛈', 'Tempesta in arrivo', 'Cinque ore di vento e pioggia violenta', [{ tipo: 'meteo', meteo: 'temporale', ore: 5 }]],
    ['📦', 'Cassa dal mare', 'Le onde portano una cassa sigillata', [{ tipo: 'aggiungi_oggetto', nome: 'cassa galleggiante sigillata', descrizione: 'una cassa di legno sigillata con la pece, portata dalle onde: chissà cosa contiene', luogo: 'spiaggia', trasportabile: false }]],
    ['🧍', 'Uno sconosciuto', 'Qualcuno arriva su una zattera di fortuna', null],
    ['🐟', 'Banco di pesci', 'Il mare vicino a riva si riempie di pesci', [{ tipo: 'effetto', cosa: 'pesce' }]],
    ['🤒', 'Febbre', 'Brividi e febbre per qualche ora', [{ tipo: 'effetto', cosa: 'malattia' }]],
    ['🚢', 'Una nave lontana', 'Passa all\'orizzonte: si fermerà solo se vede un segnale', [{ tipo: 'nave', comportamento: 'passa' }]],
    ['🥵', 'Caldo torrido', 'Dieci ore di sole spietato', [{ tipo: 'meteo', meteo: 'caldo', ore: 10 }]],
    ['🥶', 'Notte gelida', 'Freddo insolito per dodici ore', [{ tipo: 'meteo', meteo: 'freddo', ore: 12 }]],
    ['🐕', 'Un cane randagio', 'Un cane arriva dalla boscaglia', [{ tipo: 'aggiungi_animale', animale: 'cane' }]],
    ['🍾', 'Messaggio in bottiglia', 'Un foglio arrotolato luccica sulla battigia', [{ tipo: 'effetto', cosa: 'bottiglia' }]],
    ['🪵', 'Legname dal naufragio', 'Tavole e tronchi portati a riva', [{ tipo: 'effetto', cosa: 'legna_mare' }]],
    ['🍌', 'Stagione dei frutti', 'Frutta matura e noci cadute ovunque', [{ tipo: 'effetto', cosa: 'frutta' }]],
  ];
  const STRANGERS = [['Ivo', 'm', 47, 'pescatore taciturno e diffidente, conosce il mare'], ['Nadia', 'f', 34, 'medico, energica, abituata a comandare'], ['Tommaso', 'm', 23, 'studente impulsivo, ottimista, poco pratico'], ['Rosa', 'f', 61, 'ex maestra, calma, molto religiosa'], ['Samir', 'm', 39, 'meccanico, ingegnoso, sospettoso con chi non conosce']];
  let shownDay = 0;
  function draw() { const pool = DECK.slice(); const out = []; while (out.length < 3) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); return out; }
  function show() {
    const G = ENG.G; const cards = draw(); const el = $('cardsCard');
    el.innerHTML = `<h3>🃏 Carte del destino — giorno ${G.day}</h3><div class="legend">Puoi giocarne una sola, oppure lasciare che la giornata faccia il suo corso. Il naufrago non sa nulla delle carte.</div><div class="fcards">${cards.map((c, i) => `<button class="fcard" data-i="${i}"><div class="ic">${c[0]}</div><b>${c[1]}</b><span>${c[2]}</span></button>`).join('')}</div><div class="row" style="justify-content:flex-end"><button id="cardsPass">Nessuna, oggi lascio fare al caso</button></div>`;
    el.hidden = false; el._cards = cards;
  }
  $('cardsCard').addEventListener('click', (e) => { const el = $('cardsCard'); if (e.target.id === 'cardsPass') { el.hidden = true; return; } const b = e.target.closest('.fcard'); if (!b) return; const c = el._cards[+b.dataset.i];
    let ops = c[3]; if (!ops) { const used = new Set(ENG.G.agents.map((x) => x.name)); const free = STRANGERS.filter((x) => !used.has(x[0])); const s2 = (free.length ? free : STRANGERS)[Math.floor(Math.random() * (free.length || STRANGERS.length))]; ops = [{ tipo: 'aggiungi_persona', nome: s2[0], sesso: s2[1], eta: s2[2], carattere: s2[3], arrivo: 'arriva stremato su una zattera di fortuna alla spiaggia' }]; }
    const done = ENG.applyOps(ops, '🃏 ' + c[1]); el.hidden = true; const t = $('toast'); t.textContent = `🃏 ${c[1]}: ${done.join('; ') || 'fatto'}`; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 6000); refreshPanel(true); });
  $('cardsBtn').onclick = () => { layout.cards = !layout.cards; $('cardsBtn').classList.toggle('on', layout.cards); applyLayout(); };
  $('cardsBtn').classList.toggle('on', layout.cards);
  setInterval(() => { const G = ENG.G; if (!G || !G.running || G.ended || !layout.cards || document.body.classList.contains('inSetup')) return; const h = G.h % 24;
    if (G.day > 1 && G.day !== shownDay && h >= 6.5 && h < 10) { shownDay = G.day; if (!$('cardsCard').hidden) return; show(); } }, 1000);
  return { show };
})();

/* ---------- ages of survival and observer challenges ---------- */
const AGE_HINT = ['Fuoco acceso almeno una volta, aver mangiato, un riparo iniziato', 'Riparo completo con giaciglio, un modo per tenere acqua o un focolare, dal terzo giorno', 'Muretto o baracca riparata, e almeno due costruzioni (o un orto, o metà zattera)', 'Radio riparata o salvataggio', 'Ce l\'ha fatta'];
function ageTick(G) { const a = G.age || 0; setText($('ageBadge'), `🏛 ${ENG.AGES[a]}`); $('ageBadge').title = `Età della sopravvivenza: ${ENG.AGES[a]} (${a + 1}/5). Prossima: ${a < 4 ? ENG.AGES[a + 1] + ' — ' + AGE_HINT[a] : '—'}`; }
$('ageBadge').onclick = () => { const t = $('toast'); t.textContent = $('ageBadge').title; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 7000); };
ENG.listeners.onEvent.push((ev) => { if (ev.kind === 'age') { const t = $('toast'); t.textContent = `🏛 Nuova età raggiunta: ${ev.text}!`; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 8000); } });
const CHALLENGES = [
  ['Mano leggera', 'Arrivare al giorno 15 con al massimo 3 interventi tuoi', (G) => G.day >= 15 && G.interventions.length <= 3, 30],
  ['Costruttore', 'Raggiungere l\'età del Costruttore', (G) => (G.age || 0) >= 3, 20],
  ['Fuori in 20', 'Farli salvare entro il giorno 20', (G) => G.rescued && (G.endedAt ? G.endedAt.day : G.day) <= 20, 40],
  ['Radioamatore', 'Far riparare la radio', (G) => G.world.radio && G.world.radio.fixed, 25],
  ['Nessuno indietro', 'Tutti vivi al giorno 30', (G) => G.day >= 30 && G.agents.every((a) => a.alive || a.departed), 35],
  ['Fortuna o destino', 'Giocare almeno 5 carte del destino', (G) => G.interventions.filter((i) => /🃏/.test(i.text)).length >= 5, 10],
  ['Sussurratore', 'Una voce interiore seguita entro un\'ora (lo giudichi tu dalla cronaca)', null, 0],
];
function challengesHtml(G) { let pts = 0; const rows = CHALLENGES.map(([n, d, ok, p2]) => { const done = ok ? !!ok(G) : false; if (done) pts += p2; return `<div class="ev">${done ? '✅' : '⬜'} <b>${n}</b> — ${d}${p2 ? ` <span class="tt">(${p2} punti)</span>` : ''}</div>`; }).join('');
  return `<div class="legend" style="margin-top:8px"><b>🎯 Sfide per te</b> — punteggio: <b>${pts}</b></div>${rows}`; }
/* ---------- pace: skip to the next interesting moment, quicker dull stretches ---------- */
const PACE = (() => {
  const st = { on: false, t0: 0, hl: 0, ch: 0 };
  const interesting = (c) => ['event', 'death', 'end', 'god', 'hallucination'].includes(c.kind) || /si sveglia|arriva|nave|aereo|trova|scopre/i.test(c.text);
  function start() { const G = ENG.G; if (!G) return; st.on = true; st.t0 = ENG.T(); st.hl = (G.highlights || []).length; st.ch = G.chronicle.length; $('skipBtn').classList.add('on'); if (!G.running) setPlay(true); }
  function stop() { st.on = false; $('skipBtn').classList.remove('on'); }
  function speed() { const G = ENG.G; if (!G) return ui.speed; if (st.on) return Math.max(ui.speed, 1) * 14;
    // dull stretches (everyone asleep, resting or on a long walk) run a little faster by themselves
    const al = G.agents.filter((a) => a.alive && !a.departed); const dull = al.length && al.every((a) => a.asleep || (a.cur && (a.cur.type === 'riposa' || (a.cur.walking && a.cur.walkDur - a.cur.el > 0.4))));
    return ui.speed * (dull ? 2 : 1); }
  function check() { const G = ENG.G; if (!st.on || !G) return; if (G.ended || ENG.T() - st.t0 > 10 || (G.highlights || []).length > st.hl || G.chronicle.slice(st.ch).some(interesting)) stop(); }
  $('skipBtn').onclick = () => (st.on ? stop() : start());
  return { speed, check, start, stop, get on() { return st.on; } };
})();

/* ---------- TV mode: automatic direction + a narrator reading thoughts and key moments ---------- */
const TV = (() => {
  let on = false, lastTh = '', lastHl = 0; const synth = window.speechSynthesis; let voice = null;
  const pickVoice = () => { try { const vs = synth.getVoices(); voice = vs.find((v) => /it[-_]IT/i.test(v.lang)) || vs.find((v) => /^it/i.test(v.lang)) || null; } catch (e) {} };
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  function say(text) { if (!synth || !text) return; try { const u2 = new SpeechSynthesisUtterance(String(text).slice(0, 400)); u2.lang = 'it-IT'; if (voice) u2.voice = voice; u2.rate = 0.98; synth.speak(u2); } catch (e) {} }
  function set(v) { on = v; $('tvBtn').classList.toggle('on', on); $('tvBtn').setAttribute('aria-pressed', String(on));
    if (on) { if (!director) $('directorBtn').click(); toggleDrawer(false); const G = ENG.G; lastHl = G ? (G.highlights || []).length : 0; const a = G && sel(); const t = a && a.thoughts[a.thoughts.length - 1]; lastTh = t ? t.text : ''; say('Modalità televisione.'); }
    else { if (director) $('directorBtn').click(); try { synth && synth.cancel(); } catch (e) {} } }
  function tick() { if (!on) return; const G = ENG.G; if (!G) return;
    const hl = G.highlights || []; if (hl.length > lastHl) { const h = hl[hl.length - 1]; lastHl = hl.length; say(h.text); return; }
    const a = sel(); const t = a && a.thoughts[a.thoughts.length - 1]; if (t && t.text !== lastTh && !(synth && synth.speaking)) { lastTh = t.text; say(`${a.name} pensa: ${t.text}`); } }
  $('tvBtn').onclick = () => set(!on);
  setInterval(tick, 700);
  return { get on() { return on; } };
})();

/* ---------- "while you were away": a short recap when you come back ---------- */
(() => {
  let awayT = null, awayHl = 0, awayAt = 0;
  document.addEventListener('visibilitychange', () => { const G = ENG.G; if (!G) return;
    if (document.hidden) { awayT = ENG.T(); awayHl = (G.highlights || []).length; awayAt = Date.now(); return; }
    if (awayT == null || ENG.T() - awayT < 2 || Date.now() - awayAt < 60000) return;
    const hl = (G.highlights || []).slice(awayHl); const hours = Math.round(ENG.T() - awayT);
    const lines = G.agents.map((a) => `<b>${esc(a.name)}</b>: ${a.alive ? esc(ENG.doingText(a)) + ` · sete ${Math.round(100 - a.stats.hyd)}% · fame ${Math.round(100 - a.stats.sat)}% · mente ${Math.round(a.stats.mente)}` : '✝ ' + esc(a.deathCause || 'morto')}`).join('<br>');
    const el = $('awayCard'); el.innerHTML = `<h3>Mentre eri via</h3><div class="legend">Sono passate circa ${hours} ore sull'isola.</div>${hl.length ? '<div>' + hl.slice(-10).map((h) => `• <span class="tt">G${h.day} ${fmtH(h.h)}</span> ${esc(h.text)}`).join('<br>') + '</div>' : '<div>Nessun momento saliente: giornate tranquille.</div>'}<div class="cc-note" style="margin-top:8px">${lines}</div><div class="row" style="justify-content:flex-end;margin-top:8px"><button id="awayOk">Continua</button></div>`;
    el.hidden = false; $('awayOk').onclick = () => { el.hidden = true; };
  });
})();

/* ---------- panel ---------- */
let panelDirty = true, lastPanel = 0;
const MSTATE = (v) => (v >= 75 ? 'serena' : v >= 55 ? 'stabile' : v >= 40 ? 'provata' : v >= 25 ? 'fragile' : 'in crisi');
function sel() { const G = ENG.G; return G && (G.agents.find((a) => a.id === ui.selected) || G.agents[0]); }
function refreshPanel(force) {
  const G = ENG.G; if (!G) return;
  if (!force && (!panelDirty || performance.now() - lastPanel < 700)) return;
  panelDirty = false; lastPanel = performance.now();
  setHTML($('chips'), G.agents.map((a) => `<button role="tab" aria-selected="${a.id === ui.selected}" class="chip2 ${a.id === ui.selected ? 'on' : ''} ${!a.alive ? 'dead' : ''}" data-id="${a.id}">${a.alive ? (a.departed ? '🛶' : a.thinking ? '🧠' : a.asleep ? '😴' : '🙂') : '✝'} ${esc(a.name)}</button>`).join(''));
  const a = sel(); if (!a) return;
  updateCrit(a, G);
  if (!layout.drawer) return;
  const S = a.alive ? a.stats : (a.deathStats || a.stats);
  const bars = [['sat', 'Sazietà', '#e69138'], ['hyd', 'Idratazione', '#3d85c6'], ['en', 'Energia', '#6aa84f'], ['hp', 'Salute fisica', '#cc4125'], ['term', 'Temperatura corporea', '#e06666'], ['umore', 'Umore', '#c27ba0'], ['mente', 'Salute mentale', '#8e7cc3'], ['igiene', 'Igiene', '#76a5af'], ['noia', 'Noia', '#b4a7d6'], ['ansia', 'Ansia / nervosismo', '#f1c232']];
  const TSTATE = (v) => (v > 86 ? '🥵 colpo di calore' : v > 72 ? '🥵 accaldato' : v < 14 ? '🥶 ipotermia' : v < 28 ? '🥶 freddo' : '🙂 confortevole');
  const deadCard = a.alive ? '' : `<div class="deadcard">✝ <b>${esc(a.name)} è morto</b><br>Giorno ${a.deathDay || '?'}${a.deathH != null ? ', ore ' + fmtH(a.deathH) : ''} — causa: <b>${esc(a.deathCause || 'sconosciuta')}</b>${a.dmg ? `<div class="dmg">Cosa ha danneggiato la sua salute: ${Object.entries(a.dmg).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => esc(k) + ' ' + Math.round(v)).join(' · ')}</div>` : ''}<div class="dmg">Valori al momento della morte:</div></div>`;
  $('statsBody').classList.toggle('isdead', !a.alive);
  setHTML($('statsBody'), deadCard + bars.map(([k, l, c]) => `<div class="stat"><div class="row"><span>${l}</span><span>${k === 'term' ? TSTATE(S[k] == null ? 50 : S[k]) : Math.round(S[k] == null ? 0 : S[k])}${k === 'mente' ? ' · ' + MSTATE(S[k]) : ''}</span></div><div class="bar"><i style="width:${S[k] == null ? 50 : S[k]}%;background:${k === 'term' ? (S[k] > 72 ? '#e06666' : S[k] < 28 ? '#6fa8dc' : '#93c47d') : c}"></i></div></div>`).join('')
    + `<div class="emo">Sta facendo: <b>${esc(ENG.doingText(a))}</b></div><div class="emo">${a.alive ? (a.emotion ? 'Emozione: <b>' + esc(a.emotion) + '</b>' : '') : 'Morto: ' + esc(a.deathCause || '')}${a.sick > 0 ? ' · 🤢 malato' : ''}${a.injury ? ' · 🩹 ferito' : ''}</div>`);
  const realBody = $('tabBody'); const body = { set innerHTML(h) { setHTML(realBody, h, true); }, get dataset() { return realBody.dataset; } };
  if (ui.tab === 'mind') {
    const th = a.thoughts.slice().reverse().slice(0, 60);
    body.innerHTML = `<div class="legend">Flusso di coscienza di <b>${esc(a.name)}</b> (deciso da Claude). ${a.amnesia ? 'Ogni notte dimentica tutto.' : 'Memoria normale.'}</div>`
      + (a.relations && Object.keys(a.relations).length ? `<div class="rel"><b>👥 Come vede gli altri</b><br>${Object.entries(a.relations).map(([k, v]) => '• ' + esc(k) + ': ' + esc(v)).join('<br>')}</div>` : '')
      + (a.bio && !a.amnesia ? `<details><summary>📷 La sua vita prima</summary><div class="mem">${esc(a.bio.text)}<br><i>${a.bio.memories.map(esc).join('<br>')}</i></div></details>` : '')
      + ((a.projects || []).length ? `<div class="proj"><b>🧭 Progetti</b><br>${a.projects.map((x) => '• ' + esc(x)).join('<br>')}</div>` : '')
      + (a.memory.length ? `<details><summary>Cosa ricorda oggi (${a.memory.length})</summary><div class="mem">${a.memory.map(esc).join('<br>')}</div></details>` : '')
      + th.map((t) => `<div class="th"><div class="tt">G${t.day} ${fmtH(t.h)} · ${esc(t.emotion || '')} · umore ${Math.round(t.umore)}</div>${t.hallucination ? `<div class="hal">👁 percezione non reale: ${esc(t.hallucination)}</div>` : ''}<div>${esc(t.text)}</div>${t.reasoning ? `<div class="rsn">🔧 ${esc(t.reasoning)}</div>` : ''}</div>`).join('') || '<div class="legend">Ancora nessun pensiero.</div>';
  } else if (ui.tab === 'nb') {
    const owner = a.hasNotebook ? a : G.agents.find((x) => x.hasNotebook);
    const letters = (G.letters || []).slice().reverse().map((l) => `<div class="page letter"><h4>✉️ ${esc(l.from)} a ${esc(l.to)} <small>(giorno ${l.day}, ${fmtH(l.h)})</small></h4>${esc(l.text).replace(/\n/g, '<br>')}</div>`).join('');
    if (!owner) { body.innerHTML = (letters ? '<div class="legend">Lettere mai spedite</div>' + letters : '') + '<div class="legend">Nessun taccuino.</div>'; return; }
    body.innerHTML = (letters ? '<div class="legend"><b>Lettere mai spedite</b></div>' + letters + '<hr>' : '') + `<div class="legend">Taccuino di ${esc(owner.name)} · inchiostro ${Math.round(owner.notebook.ink)}%${G.world.notebookPresent ? '' : ' · <b>il taccuino è sparito</b>'}</div>`
      + owner.notebook.pages.map((p, i) => `<div class="page ${p.tool === 'carbone' ? 'charcoal' : ''}"><h4>Pagina ${i + 1}${p.day ? ` <small>(scritta il giorno ${p.day})</small>` : ''}</h4>${esc(p.text).replace(/\n/g, '<br>')}</div>`).reverse().join('');
  } else if (ui.tab === 'inv') {
    const W = G.world; const T0 = ENG.T();
    const tools = [W.axe && 'ascia', W.knife && 'coltello', W.rod && 'canna da pesca', W.spear && 'lancia', W.rope !== false && W.rope && 'corda'].filter(Boolean);
    const people = G.agents.map((p) => { const S2 = p.stats; const carry = [...ENG.carriedOf(p).map((k) => ({ axe: 'ascia', knife: 'coltello', rod: 'canna', rope: 'corda' }[k])), ...p.inv.items, p.inv.fish ? p.inv.fish + ' pesci' : '', p.inv.coconut ? p.inv.coconut + ' noci di cocco' : '', p.inv.crabs ? p.inv.crabs + ' granchi' : '', p.bottleWater > 0 ? 'acqua in bottiglia (' + p.bottleWater + ')' : ''].filter(Boolean);
      return `<div class="ev"><b>${p.alive ? '🙂' : '✝'} ${esc(p.name)}</b> — ${p.alive ? esc(ENG.doingText(p)) : esc(p.deathCause || 'morto')}<br>🎒 ${carry.map(esc).join(', ') || 'niente'}${p.alive ? `<br><small>salute ${Math.round(S2.hp)} · sete ${Math.round(100 - S2.hyd)} · fame ${Math.round(100 - S2.sat)} · mente ${Math.round(S2.mente)}${p.injury ? ' · 🩹 ' + esc(p.injury) : ''}</small>` : ''}${p.relations && Object.keys(p.relations).length ? '<br><small>👥 ' + Object.entries(p.relations).map(([k, v]) => esc(k) + ': ' + esc(v)).join('; ') + '</small>' : ''}</div>`; }).join('');
    const camp = [`riparo ${['assente', 'struttura di pali', 'coperto di foglie', 'completo'][W.shelter || 0]}`, W.bed ? 'giaciglio' : '', W.woodPile ? `legna ${W.woodPile}` : '', W.fireUntil > T0 ? '🔥 fuoco acceso' : '', W.sos ? `SOS di pietre (${W.sos})` : '', W.pile ? 'catasta per il falò' : '', W.raft ? `zattera ${W.raft}/4` : '', W.tarpWater >= 5 ? `acqua nel telo (${Math.round(W.tarpWater / 10)})` : ''].filter(Boolean);
    const objs = W.custom.filter((c) => !c.animal);
    const animals = [W.dog && { n: '🐕 cane', d: `fiducia ${Math.round(W.dogTrust == null ? 20 : W.dogTrust)}/100${W.dogHurt ? ', ferito' : ''}`, a: (W.animalAct || {}).cane }, W.crabs || W.crabsNatural ? { n: '🦀 granchi', d: W.crabsNatural ? 'escono di notte e con la bassa marea' : 'sulla riva' } : null, W.shark && { n: '🦈 squalo', d: 'vicino agli scogli', a: (W.animalAct || {}).squalo }, { n: '🕊️ gabbiani e pellicano', d: 'di giorno, col bel tempo', a: (W.animalAct || {}).gabbiani }, W.rats && { n: '🐀 topi', d: 'di notte, vicino ai resti di cibo' },
      ...Object.values(objs.length >= 0 ? W.custom.filter((c) => c.animal).reduce((m, c) => { const k = c.name; m[k] = m[k] || { n: '🐾 ' + c.name, d: (c.desc || '') + (c.tame ? ` · addomesticato da ${c.tame}` : ''), cnt: 0, a: (W.animalAct || {})[c.name.toLowerCase()] }; m[k].cnt++; return m; }, {}) : {})].filter(Boolean);
    body.innerHTML = `<div class="legend"><b>👤 Persone</b></div>${people}
      <div class="legend" style="margin-top:8px"><b>🏕️ Campo</b> — attrezzi: ${tools.join(', ') || 'nessuno'}${W.crateOpened === false ? ' (la cassa è ancora chiusa)' : ''}</div><div class="ev">${camp.join(' · ')}</div>
      <div class="legend" style="margin-top:8px"><b>🧰 Oggetti sull'isola</b> (${objs.length})</div>${objs.map((c) => `<div class="ev">${esc(c.name)}${c.inCrate && W.crateOpened === false ? ' <small>(nella cassa chiusa)</small>' : ''}${c.use ? ' — <small>' + esc(c.use) + '</small>' : c.completing ? ' — <small>Claude lo sta descrivendo…</small>' : ''}</div>`).join('') || '<div class="legend">nessuno</div>'}
      <div class="legend" style="margin-top:8px"><b>🐾 Animali</b></div>${animals.map((x) => `<div class="ev">${x.n}${x.cnt > 1 ? ' ×' + x.cnt : ''} — <small>${esc(x.d || '')}${x.a && x.a.until > T0 ? ' · ora: ' + esc(x.a.text) : ''}</small></div>`).join('')}`;
  } else if (ui.tab === 'story') {
    const st = (G.stories || []).slice().reverse();
    const eps = (G.episodes || []).slice().reverse().map((e) => `<div class="story episode"><h4>📺 Puntata ${e.n} — ${esc(e.title)} <small>(giorni ${e.from}–${e.to})</small></h4><p>${esc(e.text)}</p><p><i>${esc(e.hook)}</i></p></div>`).join('');
    body.innerHTML = `<div class="row" style="margin-bottom:8px"><span class="legend" style="margin:0">Analisi, puntate e capitoli scritti da Claude.</span><button id="pdfStory" title="Analisi, racconto completo, taccuino, lettere, momenti e foto in un PDF">📄 Scarica PDF</button><button onclick="writeNovel(this)" title="Tutto l'esperimento riscritto come un romanzo: un capitolo per giorno, fedele ai fatti, impaginato come un libro (PDF). Scrive solo i capitoli che mancano.">📖 Romanzo (PDF)</button><button onclick="writeNovel(this,'txt')" title="Lo stesso romanzo in testo semplice">📖 testo</button></div>` + (G.analysis ? `<div class="story episode"><h4>🧪 Analisi dell'esperimento — ${esc((ENG.SCENARIOS[G.scenario] || {}).label || '')}</h4><p><i>${esc((ENG.SCENARIOS[G.scenario] || {}).q || '')}</i></p><p>${esc(G.analysis)}</p></div>` : '') + eps + `<div class="legend">Ogni mattina Claude racconta il giorno appena passato, come il capitolo di un romanzo.</div>` + (st.map((x) => `<div class="story"><h4>Giorno ${x.day} — ${esc(x.title)}</h4><p>${esc(x.text)}</p></div>`).join('') || '<div class="legend">Il primo capitolo arriverà all\'alba del giorno 2.</div>');
  } else if (ui.tab === 'moments') {
    const hl = (G.highlights || []).slice().reverse();
    const md = Object.entries(G.medals || {}); const all = Object.keys(ENG.MEDALS);
    const medals = `<div class="medals">${all.map((k) => { const m = (G.medals || {})[k]; return `<span class="medal ${m ? 'on' : ''}" title="${m ? 'giorno ' + m.day + (m.why ? ' — ' + esc(m.why) : '') : 'non ancora'}">${ENG.MEDALS[k]}</span>`; }).join('')}</div>`;
    const ph = photos.length ? `<div class="row" style="gap:6px;margin:6px 0"><b>📸 Foto (${photos.length})</b><button id="tlBtn" title="Rivedi la partita come una sequenza di foto">▶ Time-lapse</button></div><div class="gallery">${photos.slice().reverse().slice(0, 24).map((p, i) => `<figure><img src="${p.src}" data-ph="${photos.length - 1 - i}"><figcaption>G${p.day} ${fmtH(p.h)} ${esc(p.label || '')}</figcaption></figure>`).join('')}</div>` : '';
    body.innerHTML = challengesHtml(G) + `<div class="legend" style="margin-top:10px"><b>🏅 Medaglie</b> (${md.length}/${all.length}) — solo per chi osserva: il personaggio non le conosce.</div>${medals}${ph}<div class="legend">Momenti salienti. Clicca per inquadrare il luogo.</div>` + (hl.map((x, i) => `<div class="mom" data-mi="${hl.length - 1 - i}"><span class="tt">G${x.day} ${fmtH(x.h)}</span> ${esc(x.text)}</div>`).join('') || '<div class="legend">Ancora nessuno.</div>');
  } else if (ui.tab === 'charts') {
    if (body.dataset.k === 'charts' + (G.history || []).length + ui.selected + archiveCount()) { drawChart(a); return; }
    body.dataset.k = 'charts' + (G.history || []).length + ui.selected + archiveCount();
    body.innerHTML = `<div class="legend">Andamento giorno per giorno di <b>${esc(a.name)}</b> (oggi compreso).</div><canvas id="chart" width="520" height="230" style="width:100%"></canvas>
      <div class="row" style="gap:6px;margin:8px 0"><button id="archBtn" title="Salva un riassunto di questa partita per confrontarla con altre">📚 Archivia partita</button><button id="cmpBtn" title="Claude confronta le partite archiviate come uno studio">🧪 Analisi comparata</button></div>
      <div id="archList"></div><div id="cmpOut" class="story"></div>`;
    drawChart(a); renderArchive();
    return;
  } else if (ui.tab === 'log') {
    body.innerHTML = `<div class="row" style="gap:6px;margin-bottom:6px;align-items:center"><button onclick="downloadChronicle()" title="Tutta la cronaca dall'inizio a questo momento (o fino alla fine, se l'esperimento è finito)">⬇ Scarica la cronaca completa</button><button id="pdfStory" title="Tutto in un PDF: analisi, racconto, momenti, taccuini, dinamiche del gruppo, foto">📄 PDF</button><button onclick="writeNovel(this)" title="La cronaca riscritta come un romanzo, un capitolo per giorno (PDF)">📖 Romanzo</button><span class="legend">${G.chronicle.length} eventi${G.ended ? ' · esperimento finito' : ''}</span></div>` + G.chronicle.slice().reverse().slice(0, 250).map((c) => `<div class="ev ${c.kind}"><span class="tt">G${c.day} ${fmtH(c.h)}</span> ${esc(c.text)}</div>`).join('');
  } else {
    body.innerHTML = (G.interventions.slice().reverse().map((i) => `<div class="ev god"><span class="tt">G${i.day} ${fmtH(i.h)}</span> <b>${esc(i.text)}</b><br>${esc(i.done.join('; '))}</div>`).join('') || '<div class="legend">Nessun intervento finora.</div>')
      + `<div class="legend" style="margin-top:12px"><b>Consumo dell'abbonamento</b><br>Chiamate a Claude: ${G.stats.calls} (circa ${(G.stats.calls / Math.max(1, G.day - 1 + G.h / 24)).toFixed(1)} per giorno di gioco) · errori: ${G.stats.fails}<br>${Object.entries(G.callsByKind || {}).sort((x, y) => y[1] - x[1]).map(([k, v]) => esc(k) + ': ' + v).join(' · ')}<br>Mente: ${G.mindModel === 'haiku' ? 'Haiku' : 'Sonnet'} · chiamate accessorie: ${G.lightModel === false ? 'Sonnet rapido' : 'Haiku'}${G.economy ? ' · modalità economica' : ''} · isola n. ${G.islandSeed || '—'}</div>`;
  }
}
$('tabBody').addEventListener('click', async (e) => {
  const m = e.target.closest('[data-mi]'); if (m) { const x = (ENG.G.highlights || [])[+m.dataset.mi]; if (x && x.loc) { setFollow(false); RTS.flyTo(x.loc[0], x.loc[1], 8); } return; }
  if (e.target.id === 'tlBtn') { timeLapse(); return; }
  const pimg = e.target.closest('[data-ph]'); if (pimg) { showPhoto(+pimg.dataset.ph); return; }
  if (e.target.id === 'pdfStory') { exportPDF(e.target); return; }
  if (e.target.id === 'archBtn') { archiveRun(); $('tabBody').dataset.k = ''; refreshPanel(true); return; }
  if (e.target.id === 'cmpBtn') { const runs = loadArchive(); if (runs.length < 1) { $('cmpOut').textContent = 'Archivia almeno una partita (anche quella in corso).'; return; } $('cmpOut').textContent = 'Claude sta confrontando le partite…';
    const out = await ENG.analyze(`Sei uno psicologo che analizza un esperimento sociale: naufraghi simulati su un'isola. Confronta queste partite (dati giornalieri e fatti salienti) e scrivi un'analisi da studio: andamento psicologico, strategie di sopravvivenza, differenze legate al carattere e alle condizioni, momenti di svolta, conclusioni prudenti. 250-400 parole.\n${JSON.stringify(runs.map((r) => ({ data: r.date, personaggi: r.people, giorni: r.days, esito: r.ended, giornaliero: r.history, momenti: r.highlights })))}\nRispondi SOLO con JSON: {"analisi":"..."}`);
    $('cmpOut').textContent = (out && out.analisi) || 'Analisi non disponibile.'; return; }
  const del = e.target.closest('[data-del]'); if (del) { const r = loadArchive(); r.splice(+del.dataset.del, 1); try { localStorage.setItem(ARCH_KEY, JSON.stringify(r)); } catch (er) {} $('tabBody').dataset.k = ''; refreshPanel(true); }
});
/* ---------- charts & archive ---------- */
const ARCH_KEY = 'isola-archivio-v1';
function loadArchive() { try { return JSON.parse(localStorage.getItem(ARCH_KEY) || '[]'); } catch (e) { return []; } }
function archiveCount() { return loadArchive().length; }
function archiveRun() {
  const G = ENG.G; const r = loadArchive();
  r.push({ date: new Date().toISOString().slice(0, 16).replace('T', ' '), seed: G.seed, days: G.day, ended: G.ended || 'in corso', people: G.agents.map((a) => ({ name: a.name, carattere: a.persona || '', vivo: a.alive, causa: a.deathCause || null })), history: (G.history || []).concat(G.agents.map((a) => ({ day: G.day, name: a.name, umore: Math.round(a.stats.umore), mente: Math.round(a.stats.mente), noia: Math.round(a.stats.noia || 0), ansia: Math.round(a.stats.ansia || 0), hp: Math.round(a.stats.hp) }))), highlights: (G.highlights || []).slice(-25).map((h) => `G${h.day}: ${h.text}`) });
  try { localStorage.setItem(ARCH_KEY, JSON.stringify(r.slice(-12))); } catch (e) {}
}
function renderArchive() {
  const el = $('archList'); if (!el) return; const r = loadArchive();
  el.innerHTML = r.length ? '<b>Partite archiviate</b>' + r.map((x, i) => `<div class="ev"><span class="tt">${esc(x.date)}</span> ${x.people.map((p) => esc(p.name) + (p.vivo ? '' : ' ✝')).join(', ')} · ${x.days} giorni · ${esc(String(x.ended))} <button data-del="${i}" title="Elimina dall'archivio" style="font-size:11px">✕</button></div>`).join('') : '<div class="legend">Nessuna partita archiviata.</div>';
}
function drawChart(a) {
  const cv = $('chart'); if (!cv) return; const G = ENG.G; const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height;
  const rows = (G.history || []).filter((h) => h.name === a.name).concat([{ day: G.day, umore: a.stats.umore, mente: a.stats.mente, noia: a.stats.noia || 0, ansia: a.stats.ansia || 0, hp: a.stats.hp }]);
  ctx.clearRect(0, 0, W, H); ctx.font = '11px Inter, sans-serif';
  const L = 28, R = 8, T = 10, B = 22; const n = Math.max(2, rows.length);
  ctx.strokeStyle = '#e3e7ef'; for (let v = 0; v <= 100; v += 25) { const y = T + (H - T - B) * (1 - v / 100); ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke(); ctx.fillStyle = '#8a93a5'; ctx.fillText(v, 4, y + 4); }
  const X = (i) => L + (W - L - R) * (i / (n - 1));
  (G.highlights || []).forEach((h) => { const i = rows.findIndex((r) => r.day === h.day); if (i < 0) return; ctx.fillStyle = 'rgba(224,122,47,.25)'; ctx.fillRect(X(i) - 1, T, 2, H - T - B); });
  const series = [['umore', '#c27ba0'], ['mente', '#8e7cc3'], ['noia', '#b4a7d6'], ['ansia', '#e0a800'], ['hp', '#cc4125']];
  series.forEach(([k, c]) => { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); rows.forEach((r, i) => { const y = T + (H - T - B) * (1 - (r[k] || 0) / 100); i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y); }); ctx.stroke(); });
  ctx.fillStyle = '#5b6475'; rows.forEach((r, i) => { if (n < 16 || i % Math.ceil(n / 12) === 0) ctx.fillText('G' + r.day, X(i) - 8, H - 6); });
  let lx = L; series.forEach(([k, c]) => { ctx.fillStyle = c; ctx.fillRect(lx, 0, 10, 4); ctx.fillStyle = '#5b6475'; ctx.fillText(k === 'hp' ? 'salute' : k, lx + 13, 6); lx += 70; });
}

/* ---------- predictions ---------- */
$('predRun').onclick = () => { const t = $('predText').value.trim(); if (!t || !ENG.G) return; ENG.addPrediction(t, Number($('predDay').value) || ENG.G.day + 3); $('predText').value = ''; renderPreds(); };
function renderPreds() { const G = ENG.G; if (!G) return; const ps = G.predictions || []; const ok = ps.filter((p) => p.result === true).length, done = ps.filter((p) => p.result != null).length;
  $('predList').innerHTML = (done ? `<b>Hai indovinato ${ok} su ${done}</b><br>` : '') + ps.slice().reverse().slice(0, 6).map((p) => `${p.result == null ? '⏳' : p.result ? '✅' : '❌'} «${esc(p.text)}» entro il giorno ${p.byDay}${p.why ? ' — <i>' + esc(p.why) + '</i>' : ''}`).join('<br>'); }
setInterval(renderPreds, 3000);

/* ---------- photos & time-lapse ---------- */
let photos = []; try { photos = JSON.parse(localStorage.getItem('isola-foto') || '[]'); } catch (e) {}
let lastHl = 0, lastPhotoT = -99;
// the whole chronicle, from the first minute to now (or to the end), as a text file
async function downloadChronicle() {
  const G = ENG.G; if (!G) return; let day = 0; const lines = [`ESPERIMENTO SOCIALE: L'ISOLA — cronaca completa`, `Naufraghi: ${G.agents.map((a) => `${a.name} (${a.age} anni${a.persona ? ', ' + a.persona : ''})`).join('; ')}`, `Mondo: ${G.resMode || 'normali'}${G.forced ? ', convivenza forzata' : ''} · scenario: ${G.scenario || 'libero'}`, G.ended ? `Esito: ${G.ended}` : `Situazione al giorno ${G.day}, ${fmtH(G.h)} (esperimento in corso)`, ''];
  G.chronicle.forEach((c) => { if (c.day !== day) { day = c.day; lines.push('', `===== GIORNO ${day} =====`); } lines.push(`${fmtH(c.h)}  ${c.text}`); });
  const res = await saveFile(`cronaca-isola-${G.ended ? 'completa' : 'giorno' + G.day}.txt`, lines.join('\n'));
  const t = $('toast'); t.textContent = res === 'saved' ? '📜 Cronaca salvata.' : res === 'declined' ? 'Download annullato.' : '📜 Cronaca pronta.'; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 5000);
}
window.downloadChronicle = downloadChronicle;
function snap(label) {
  const G = ENG.G; if (!G) return; const nowR = performance.now(); if (nowR - (snap.t || 0) < (G.circleNow ? 30000 : 4000)) return; snap.t = nowR; // at most one photo every 4 s: during fast scenes it was rendering and saving constantly
  try { SC.renderer.render(SC.scene, SC.camera); const c = document.createElement('canvas'); c.width = 320; c.height = 180; const src = SC.renderer.domElement; const sw = src.width, sh = src.height, ar = 16 / 9; let w2 = sw, h2 = sw / ar; if (h2 > sh) { h2 = sh; w2 = sh * ar; }
    c.getContext('2d').drawImage(src, (sw - w2) / 2, (sh - h2) / 2, w2, h2, 0, 0, 320, 180); photos.push({ src: c.toDataURL('image/jpeg', 0.55), day: G.day, h: G.h, label: String(label || '').slice(0, 60), game: G.seed });
    if (photos.length > 60) photos = photos.filter((p, i) => p.label || i % 2 === 0).slice(-60); if (nowR - (snap.saved || 0) > 30000) { snap.saved = nowR; localStorage.setItem('isola-foto', JSON.stringify(photos.slice(-40))); } } catch (e) {}
}
function photoTick() {
  const G = ENG.G; if (!G || G.ended) return; const hl = G.highlights || [];
  if (photos.length && photos[photos.length - 1].game !== G.seed) photos = photos.filter((p) => p.game === G.seed);
  if (hl.length > lastHl) { const x = hl[hl.length - 1]; lastHl = hl.length; setTimeout(() => snap(x.text), 400); return; }
  const t = (G.day - 1) * 24 + G.h; if (t - lastPhotoT >= 4 && G.h > 6.5 && G.h < 19) { lastPhotoT = t; snap(''); }
}
setInterval(photoTick, 1500);
function showPhoto(i) { const p = photos[i]; if (!p) return; const d = document.createElement('div'); d.className = 'photoView'; d.innerHTML = `<img src="${p.src}"><div>Giorno ${p.day}, ${fmtH(p.h)} — ${esc(p.label || '')}</div>`; d.onclick = () => d.remove(); document.body.appendChild(d); }
function timeLapse() { if (!photos.length) return; const d = document.createElement('div'); d.className = 'photoView'; document.body.appendChild(d); let i = 0; const tm = setInterval(() => { const p = photos[i++]; if (!p) { clearInterval(tm); setTimeout(() => d.remove(), 1200); return; } d.innerHTML = `<img src="${p.src}"><div>Giorno ${p.day}, ${fmtH(p.h)} ${esc(p.label || '')}</div>`; }, 450); d.onclick = () => { clearInterval(tm); d.remove(); }; }

/* ---------- rare events in the sky and at sea ---------- */
let plane = null, horizonLights = null;
function rareVisuals(G) {
  const W = G.world; const T0 = ENG.T();
  if (!plane) { plane = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 6), new THREE.MeshBasicMaterial({ color: 0xdddddd })); b.rotation.z = Math.PI / 2; plane.add(b); const wg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 5), new THREE.MeshBasicMaterial({ color: 0xcccccc })); plane.add(wg); SC.scene.add(plane); }
  const pk = W.planeAt != null ? (T0 - W.planeAt) / 0.6 : 2; plane.visible = pk >= 0 && pk <= 1; if (plane.visible) plane.position.set(-120 + pk * 240, 55, -30 + pk * 20);
  if (!horizonLights) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([60, 1.5, -70, 62, 1.7, -70, 58, 1.4, -70], 3)); horizonLights = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff1a8, size: 0.9 })); SC.scene.add(horizonLights); }
  horizonLights.visible = W.lightsAt != null && T0 - W.lightsAt < 0.8;
  if (W.eclipseUntil > T0) { SC.sun.intensity *= 0.15; SC.hemi.intensity *= 0.35; }
}

/* ---------- interview ---------- */
$('askRun').onclick = async () => { const a = sel(); const q = $('askText').value.trim(); if (!a || !q) return; if (!a.alive) { $('askOut').textContent = `${a.name} è morto.`; return; } $('askRun').disabled = true; $('askOut').textContent = `${a.name} ci pensa…`; const r = await ENG.interview(a, q); $('askOut').textContent = `«${r}» — ${a.name}`; $('askRun').disabled = false; };

/* ---------- director camera ---------- */
let director = false, dirShot = null, dirUntil = 0;
$('directorBtn').onclick = () => { director = !director; $('directorBtn').classList.toggle('on', director); $('directorBtn').setAttribute('aria-pressed', String(director)); if (director) setFollow(false); };
function directorCam(dt) {
  if (!director || !ENG.G) return; const G = ENG.G; const now = performance.now(); const w = ENG.weatherNow();
  if (now > dirUntil) {
    const alive = ENG.alive(); const strong = alive.find((a) => a.alive && ((a.stats.ansia || 0) > 70 || a.stats.mente < 30 || (a.cur && ['seppellisci', 'veglia', 'costruisci', 'parla'].includes(a.cur.type))));
    const recent = (G.highlights || []).slice(-1)[0]; const fresh = recent && (G.day - 1) * 24 + G.h - ((recent.day - 1) * 24 + recent.h) < 0.6;
    if (w.storm) dirShot = { kind: 'wide' }; else if (fresh && recent.loc) dirShot = { kind: 'spot', loc: recent.loc }; else if (strong) dirShot = { kind: 'close', id: strong.id }; else { const any = alive[Math.floor(Math.random() * alive.length)]; dirShot = any ? { kind: Math.random() < 0.6 ? 'medium' : 'orbit', id: any.id } : { kind: 'wide' }; }
    dirUntil = now + 7000 + Math.random() * 6000;
  }
  const tgtA = dirShot && dirShot.id ? G.agents.find((a) => a.id === dirShot.id) : null; const P = tgtA ? meshes[tgtA.id] : null;
  if (dirShot.kind === 'wide' || !P && !dirShot.loc) { const c = RTS.islandCenter(); RTS.aim(c.x, c.z, RTS.maxDist * 0.8, rt * 0.05, dt * 0.8); }
  else if (dirShot.kind === 'spot') RTS.aim(dirShot.loc[0], dirShot.loc[1], 8, null, dt * 1.2);
  else { const d = dirShot.kind === 'close' ? 4 : dirShot.kind === 'medium' ? 8 : 11; const ang = dirShot.kind === 'orbit' ? rt * 0.15 : P.heading + 0.6; RTS.aim(P.root.position.x, P.root.position.z, d, ang, dt * 1.2); }
}

/* ---------- procedural ambient audio (no files) ---------- */
let AU = null;
$('audioBtn').onclick = () => {
  if (!AU) { try { const C = new (window.AudioContext || window.webkitAudioContext)(); const noise = C.createBuffer(1, C.sampleRate * 2, C.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const chan = (type, f, q) => { const src = C.createBufferSource(); src.buffer = noise; src.loop = true; const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = C.createGain(); g.gain.value = 0; src.connect(fl).connect(g).connect(C.destination); src.start(); return { g, fl }; };
    AU = { C, waves: chan('lowpass', 500, 0.7), wind: chan('bandpass', 900, 0.6), rain: chan('highpass', 2500, 0.3), fire: chan('bandpass', 3000, 4), on: true, lastGull: 0 }; } catch (e) { return; } }
  else { AU.on = !AU.on; if (AU.on) AU.C.resume(); else AU.C.suspend(); }
  $('audioBtn').textContent = AU.on ? '🔊 Audio' : '🔇 Audio'; $('audioBtn').classList.toggle('on', AU.on);
};
function chirp(f0, f1, dur, vol) { const o = AU.C.createOscillator(), g = AU.C.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(f0, AU.C.currentTime); o.frequency.exponentialRampToValueAtTime(f1, AU.C.currentTime + dur); g.gain.setValueAtTime(vol, AU.C.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AU.C.currentTime + dur); o.connect(g).connect(AU.C.destination); o.start(); o.stop(AU.C.currentTime + dur); }
function audioTick(w, rt2) {
  if (!AU || !AU.on || !ENG.G) return; const t = AU.C.currentTime; const G = ENG.G;
  AU.waves.g.gain.setTargetAtTime(0.05 + w.waves * 0.25 * (0.7 + 0.3 * Math.sin(rt2 * 0.6)), t, 0.4);
  AU.wind.g.gain.setTargetAtTime(Math.min(0.3, w.wind * 0.18), t, 0.6); AU.wind.fl.frequency.setTargetAtTime(600 + w.wind * 900 + Math.sin(rt2 * 0.3) * 200, t, 0.8);
  AU.rain.g.gain.setTargetAtTime(Math.min(0.35, w.rain * 0.3), t, 0.5);
  AU.fire.g.gain.setTargetAtTime(G.world.fireUntil > ENG.T() ? 0.03 + Math.random() * 0.05 : 0, t, 0.05);
  const day = G.h > 6.5 && G.h < 19.5; if (day && w.rain < 0.3 && performance.now() - AU.lastGull > 4000 && Math.random() < 0.01) { AU.lastGull = performance.now(); chirp(1800, 900, 0.35, 0.05); setTimeout(() => chirp(1700, 1000, 0.3, 0.04), 380); }
  if (barkEl && performance.now() < barkUntil && Math.random() < 0.05) chirp(420, 220, 0.12, 0.08);
}

$('chips').onclick = (e) => { const b = e.target.closest('[data-id]'); if (!b) return; selectAgent(b.dataset.id, true); CC.show(b.dataset.id); };

/* ---------- 3D sync ---------- */
const meshes = {}; const sandMeshes = {}; const customMeshes = {}; const graveMeshes = {}; const pyreMeshes = {};
const bubbles = {};
function personMesh(a) {
  if (!meshes[a.id]) { const c = a.colors || {}; meshes[a.id] = SC.makePerson({ shirt: c.shirt, pants: c.pants, hair: c.hair, longHair: c.longHair, beard: c.beard, scale: c.scale || 1.35, skin: c.skin }); meshes[a.id].heading = a.heading || Math.PI; }
  return meshes[a.id];
}
function bubbleFor(a) {
  if (!bubbles[a.id]) { const d = document.createElement('div'); d.className = 'bubble'; document.body.appendChild(d); bubbles[a.id] = d; }
  return bubbles[a.id];
}
const SKY = [[0, 0x0b1430], [5.2, 0x0b1430], [6.2, 0xf4a46a], [7.5, 0x8ecbf0], [17.5, 0x8ecbf0], [19.2, 0xf08a5d], [20.5, 0x1a2148], [24, 0x0b1430]];
function skyColor(h) { const hh = h % 24; for (let i = 0; i < SKY.length - 1; i++) if (hh >= SKY[i][0] && hh <= SKY[i + 1][0]) { const k = (hh - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]); return new THREE.Color(SKY[i][1]).lerp(new THREE.Color(SKY[i + 1][1]), k); } return new THREE.Color(0x0b1430); }

const clock = new THREE.Clock(); let rt = 0;
/* engine clock: runs in a Worker timer so the island keeps living when the tab/panel is hidden */
let lastTick = performance.now();
function engineTick() {
  const now = performance.now(); let dtr = Math.min(10, (now - lastTick) / 1000); lastTick = now;
  if (!ENG.G) return;
  const sp = PACE.speed(); while (dtr > 0) { const d = Math.min(0.1, dtr); ENG.stepTime(d, sp); dtr -= d; } PACE.check();
}
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},100)'], { type: 'text/javascript' })));
  wk.onmessage = engineTick;
} catch (e) { setInterval(engineTick, 100); }
let barkEl = null, barkUntil = 0;
// where an animal's behaviour points: a person, another animal or a place
function actTarget(act) {
  if (!act) return null;
  const who = act.chi ? ENG.byName(act.chi) : null; if (who) return [who.pos[0], who.pos[1]];
  const k = String(act.chi || '').toLowerCase();
  if (k) {
    if (/cane/.test(k) && SC.dog.visible) return [SC.dog.position.x, SC.dog.position.z];
    if (/squal/.test(k) && SC.shark.visible) return [SC.shark.position.x, SC.shark.position.z];
    if (/granch/.test(k)) return LOC.shoreSouth;
    const c = ENG.G.world.custom.find((c) => c.animal && c.name.toLowerCase().includes(k)); if (c && customMeshes[c.id]) return [customMeshes[c.id].position.x, customMeshes[c.id].position.z];
    if (ENG.PLACES[k]) return ENG.PLACES[k].loc;
  }
  if (act.luogo && ENG.PLACES[act.luogo]) return ENG.PLACES[act.luogo].loc;
  return null;
}
const liveAct = (k) => { const W = ENG.G.world; const v = W.animalAct && W.animalAct[k]; return v && v.until > ENG.T() ? v : null; };
function dogBark(dp) { if (!barkEl) { barkEl = document.createElement('div'); barkEl.className = 'bubble speech'; document.body.appendChild(barkEl); } barkEl.textContent = 'Bau! Bau!'; barkUntil = performance.now() + 1200; barkEl._p = dp.clone(); }
function updateBark() { if (!barkEl) return; const on = performance.now() < barkUntil && SC.dog.visible; barkEl.style.opacity = on ? 1 : 0; if (on) { const p = SC.dog.position.clone().add(new THREE.Vector3(0, 1.3, 0)).project(SC.camera); barkEl.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; barkEl.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`; } }
function frame() {
  if (window.__talkActive || window.__ventureActive) { clock.getDelta(); requestAnimationFrame(frame); return; } // the studio is on: one live scene at a time
  const dt = Math.min(0.1, clock.getDelta()); rt += dt;
  const G = ENG.G;
  if (G) { syncWorld(G, dt); updateBark(); }
  RTS.update(dt); FOW.tick(); CC.tick(); SEL.tick(); OCC.tick(); FISH.tick(dt); funFrame(); SC.renderer.render(SC.scene, SC.camera); minimapTick();
  if (G) { hud(G); refreshPanel(false); }
  requestAnimationFrame(frame);
}
function syncWorld(G, dt) {
  const W = G.world; const Tn = ENG.T(); const h = G.h; const w = ENG.weatherNow();
  // props
  SC.shL.forEach((g, i) => { g.visible = W.shelter > i; });
  SC.bed.visible = W.bed;
  SC.raftLogs.forEach((l, i) => { l.visible = W.raft > 0 && i < Math.ceil((W.raft / 4) * SC.raftLogs.length); });
  SC.sosStones.forEach((s) => { s.visible = !!W.sos; });
  SC.hillPile.visible = !!W.pile;
  const fireOn = W.fireUntil > Tn; const bonOn = W.bonfireUntil > Tn;
  [[SC.campFire, fireOn], [SC.bonfire, bonOn]].forEach(([f, on]) => { f.visible = on; f.userData.flames.forEach((m, i) => { m.scale.set(1 + Math.sin(rt * 13 + i) * 0.12, 1 + Math.sin(rt * 17 + i * 2) * 0.25, 1); m.rotation.y = rt * (i + 1); }); f.userData.light.intensity = on ? 1.6 + Math.sin(rt * 20) * 0.3 : 0; });
  SC.smoke.visible = bonOn; SC.smokePuffs.forEach((p, i) => { const tt = (rt * 0.5 + i / SC.smokePuffs.length) % 1; p.position.set(Math.sin(i * 3 + rt) * 0.6 + tt * 4 * w.wind, 1 + tt * 14, Math.cos(i * 2) * 0.6); p.scale.setScalar(0.6 + tt * 2.2); p.material.opacity = 0.6 * (1 - tt); });
  SC.woodLogs.forEach((l, i) => { l.visible = i < W.woodPile; });
  const using = (t, anims) => ENG.alive().some((a) => a.cur && !a.cur.walking && (a.cur.type === t || anims.includes(a.cur.anim)));
  SC.crateAxe.visible = W.axe && !using('taglia_legna', ['chop', 'chopLow', 'reach']); SC.crateRod.visible = W.rod && !using('pesca', ['fish']); SC.crateSpear.visible = W.spear && !using('pesca', ['spear']);
  SC.ball.visible = W.ball; SC.ball.material = W.ballFace ? SC.ballMatFace : SC.ballMatPlain;
  const PA = W.palmsAlive || { palme: true, palma_riparo: true, palma_nord: true };
  const pmap = [[SC.palmA, 'palme'], [SC.palmB, 'palma_riparo'], [SC.palmC, 'palma_nord']]; const nAlive = pmap.filter(([, k]) => PA[k]).length;
  pmap.forEach(([p, k]) => { const alive = PA[k] !== false; p.g.visible = alive; if (p.stump) p.stump.visible = !alive; const per = nAlive ? Math.round(W.coconuts / nAlive) : 0; p.nuts.forEach((n, i) => { n.visible = alive && i < per; }); });
  const br = W.brush == null ? 24 : W.brush; SC.bushes.forEach((b, i) => { b.visible = i < Math.ceil(br / 3); });
  const lvl = W.spring == null ? 100 : W.spring; SC.pond.scale.set(0.35 + 0.65 * lvl / 100, 1, 0.35 + 0.65 * lvl / 100); SC.pond.material.color.setHex(lvl < 15 ? 0x8a7a50 : 0x4fb3e8);
  // ball position (play)
  const player = ENG.alive().find((a) => a.cur && a.cur.type === 'gioca_pallone' && !a.cur.walking);
  if (player) { const a2 = rt * 3.2; SC.ball.position.set(player.pos[0] + Math.sin(a2) * 1, SC.groundH(player.pos[0], player.pos[1]) + 0.28 + Math.abs(Math.sin(rt * 6.4)) * 0.7, player.pos[1] + Math.cos(a2) * 1); }
  else { const bp = W.ballFace && W.shelter ? [LOC.shelter[0] + 1.3, LOC.shelter[1] + 0.6] : LOC.ball; SC.ball.position.set(bp[0], SC.groundH(bp[0], bp[1]) + 0.28, bp[1]); }
  // sand
  const ids = new Set(W.sand.map((s) => s.id));
  W.sand.forEach((s) => { if (!sandMeshes[s.id]) sandMeshes[s.id] = SC.makeSandText(s.text, s.loc, s.stones); });
  Object.keys(sandMeshes).forEach((k) => { if (!ids.has(+k)) { SC.scene.remove(sandMeshes[k]); delete sandMeshes[k]; } });
  const cids = new Set(W.custom.map((c) => c.id));
  W.custom.forEach((c, idx) => {
    if (customMeshes[c.id] && customMeshes[c.id].userData.pv !== (c.pv || 0)) { SC.scene.remove(customMeshes[c.id]); delete customMeshes[c.id]; } // redraw when Claude sketches it
    if (!customMeshes[c.id]) { customMeshes[c.id] = SC.makeCustomObject(c.name, c.loc, c.kind, c.parts); customMeshes[c.id].userData.pv = c.pv || 0; }
    const m = customMeshes[c.id]; const ph = (c.phase || 0) + rt;
    if (m.userData.label) m.userData.label.visible = ui.labels || (!c.animal && c.addedAt != null && (ENG.G.day - 1) * 24 + ENG.G.h - c.addedAt < 6);
    if (m.userData.body && m.userData.body.userData.flame) m.userData.body.userData.flame.scale.y = 1 + Math.sin(rt * 15) * 0.25;
    if (!c.animal && c.kind !== 'sea' && (m.userData.lx !== c.loc[0] || m.userData.lz !== c.loc[1])) { if (m.userData.lx != null) { const dy = m.position.y - SC.groundH(m.userData.lx, m.userData.lz); m.position.set(c.loc[0], SC.groundH(c.loc[0], c.loc[1]) + dy, c.loc[1]); } m.userData.lx = c.loc[0]; m.userData.lz = c.loc[1]; } // moved to a free spot
    const ca = c.animal ? liveAct(c.name.toLowerCase()) : null; const ct = ca && ca.kind !== 'vaga' ? actTarget(ca) : null;
    if (ca && ca.kind === 'scappa') { const away = ct || ENG.PLACES.collina.loc; c.loc = [c.loc[0] + (away[0] - c.loc[0]) * Math.min(1, dt * 0.4), c.loc[1] + (away[1] - c.loc[1]) * Math.min(1, dt * 0.4)]; }
    else if (c.tame && !ct && c.kind !== 'sea') { const own = G.agents.find((x) => x.name === c.tame && x.alive) || ENG.alive()[0]; if (own) { const tx = own.pos[0] + Math.cos(idx * 2.1) * 1.3, tz = own.pos[1] + Math.sin(idx * 2.1) * 1.3; const dx = tx - c.loc[0], dz = tz - c.loc[1], d = Math.hypot(dx, dz); if (d > 0.4) { const st = Math.min(d - 0.4, 2.5 * dt * Math.max(1, ui.speed / 3)); c.loc = [c.loc[0] + dx / d * st, c.loc[1] + dz / d * st]; } } }
    else if (ct && c.kind !== 'sea') { // move toward the target; attack = tight circling with lunges
      const dx = ct[0] - c.loc[0], dz = ct[1] - c.loc[1], d = Math.hypot(dx, dz); const stop = ca.kind === 'attacca' ? 0.6 : ca.kind === 'osserva' ? 3 : 1;
      if (d > stop) { const st = Math.min(d - stop, (ca.kind === 'attacca' ? 4 : 2) * dt * Math.max(1, ui.speed / 3)); c.loc = [c.loc[0] + dx / d * st, c.loc[1] + dz / d * st]; }
      if (ca.kind === 'attacca' || ca.kind === 'mangia' || ca.kind === 'segue') { const a9 = ph * 2.5; const rr = ca.kind === 'attacca' ? 0.5 + Math.abs(Math.sin(ph * 4)) * 0.4 : 0.3; const x = c.loc[0] + Math.cos(a9) * rr, z = c.loc[1] + Math.sin(a9) * rr;
        m.position.set(x, SC.groundH(x, z) + (c.kind === 'bird' ? (ca.kind === 'attacca' ? 0.4 + Math.abs(Math.sin(ph * 3)) * 1.5 : 0.1) : 0), z); m.rotation.y = Math.atan2(ct[0] - x, ct[1] - z); return; }
    }
    if (c.kind === 'sea') { const ang = ph * 0.12 + (c.phase || 0); const r = IslandSim.ISL.R(ang) + 2.4 + Math.sin(ph * 0.3) * 1.5; const jump = Math.max(0, Math.sin(ph * 1.6)); m.position.set(Math.cos(ang) * r, -0.3 + jump * 0.9, Math.sin(ang) * r); m.rotation.y = -ang; m.userData.body.rotation.x = -Math.cos(ph * 1.6) * 0.5 * (jump > 0 ? 1 : 0); }
    else if (c.kind === 'quad') { let x = c.loc[0] + Math.sin(ph * 0.25) * 1.5, z = c.loc[1] + Math.cos(ph * 0.2) * 1.2; const rr = Math.hypot(x, z); const lim = IslandSim.ISL.radius(x, z) - 1.1; if (rr > lim) { x *= lim / rr; z *= lim / rr; } m.position.set(x, SC.groundH(x, z), z); m.rotation.y = Math.atan2(Math.cos(ph * 0.25) * 0.25 * 1.5, -Math.sin(ph * 0.2) * 0.2 * 1.2); }
    else if (c.kind === 'bird') { const fly = Math.sin(ph * 0.15) > 0.3; if (fly) { const ang = ph * 0.4; m.position.set(c.loc[0] + Math.cos(ang) * 4, 5 + Math.sin(ph) * 0.5, c.loc[1] + Math.sin(ang) * 4); m.rotation.y = -ang; } else { m.position.set(c.loc[0], SC.groundH(c.loc[0], c.loc[1]), c.loc[1]); } }
  });
  Object.keys(customMeshes).forEach((k) => { if (!cids.has(+k)) { SC.scene.remove(customMeshes[k]); delete customMeshes[k]; } });
  W.bodies.forEach((b) => { if (b.buried && !graveMeshes[b.id]) graveMeshes[b.id] = SC.makeGrave(b.loc); if (b.gone === 'fire' && !pyreMeshes[b.id]) { const g = SC.makeGrave(b.loc); g.children.forEach((c) => { if (c.material) c.material = SC.M(0x333333); }); g.children.slice(1).forEach((c) => { c.visible = false; }); pyreMeshes[b.id] = g; } });
  // animals
  SC.dog.visible = W.dog;
  if (W.dog) {
    const dp = SC.dog.position; const Tn2 = ENG.T();
    const playerD = ENG.alive().find((a) => a.cur && a.cur.type === 'gioca_pallone' && !a.cur.walking);
    const sleeper = ENG.alive().every((a) => a.asleep) ? ENG.alive()[0] : null;
    let tx, tz, speed = 2, run = false;
    const act = W.animalAct && W.animalAct.cane && W.animalAct.cane.until > Tn2 ? W.animalAct.cane : null;
    let swim = false, dig = false, lie = false;
    if (act && act.kind === 'nuota') { const ang = Math.atan2(dp.z, dp.x) || Math.atan2(LOC.shoreSouth[1], LOC.shoreSouth[0]); const a7 = ang + Math.sin(rt * 0.3) * 0.25; const R7 = IslandSim.ISL.R(a7) + 2; tx = Math.cos(a7) * R7; tz = Math.sin(a7) * R7; speed = 3; swim = Math.hypot(dp.x, dp.z) > IslandSim.ISL.radius(dp.x, dp.z) + 0.2; }
    else if (act && act.kind === 'scappa') { const L2 = ENG.PLACES[act.luogo] ? ENG.PLACES[act.luogo].loc : LOC.hill; tx = L2[0] + 1.5; tz = L2[1] + 1; speed = 4; run = true; }
    else if (act && act.kind === 'va') { const L2 = (ENG.PLACES[act.luogo] || ENG.PLACES.spiaggia).loc; tx = L2[0] + 0.8; tz = L2[1] + 0.8; speed = 2.5; }
    else if (act && act.kind === 'segue') { const who = ENG.byName(act.chi) || ENG.alive()[0]; if (who) { tx = who.pos[0] - 0.8; tz = who.pos[1] + 0.6; } }
    else if (act && act.kind === 'dorme') { lie = true; tx = dp.x; tz = dp.z; }
    else if (act && (act.kind === 'attacca' || act.kind === 'mangia' || act.kind === 'osserva') && actTarget(act)) { const tg = actTarget(act); const ang7 = rt * 3; const rr7 = act.kind === 'attacca' ? 0.7 : act.kind === 'mangia' ? 0.4 : 2.2; tx = tg[0] + Math.cos(ang7) * rr7; tz = tg[1] + Math.sin(ang7) * rr7; speed = act.kind === 'attacca' ? 5 : 2; run = act.kind === 'attacca'; dig = act.kind === 'mangia'; if (act.kind === 'attacca' && Math.sin(rt * 4) > 0.9) dogBark(dp); }
    else if (act && act.kind === 'scava') { dig = true; tx = dp.x; tz = dp.z; }
    else if (act && act.kind === 'abbaia') { tx = dp.x; tz = dp.z; if (Math.sin(rt * 3) > 0.9) dogBark(dp); }
    else if (playerD || W.dogPlayUntil > Tn2) { tx = SC.ball.position.x - 0.5; tz = SC.ball.position.z - 0.4; speed = 5; run = true; }
    else if (sleeper) { tx = sleeper.pos[0] + 0.9; tz = sleeper.pos[1] + 0.9; }
    else { const owner = ENG.alive().find((a) => a.id === ui.selected && !a.asleep) || ENG.alive().find((a) => !a.asleep) || ENG.alive()[0]; const trust = W.dogTrust == null ? 20 : W.dogTrust; const keep = trust < 25 ? 7 : trust < 55 ? 3.5 : 1.1; if (owner) { const ang = rt * 0.1 + 1; tx = owner.pos[0] + Math.cos(ang) * keep; tz = owner.pos[1] + Math.sin(ang) * keep; } }
    if (W.dogHurt) speed *= 0.5;
    W.dogPos = [dp.x, dp.z];
    // under attack by gulls: the dog ducks, spins and barks
    const gullAct = liveAct('gabbiani'); if (gullAct && gullAct.kind === 'attacca' && /cane/i.test(gullAct.chi || '')) { tx = dp.x + Math.sin(rt * 2.3) * 1.5; tz = dp.z + Math.cos(rt * 1.7) * 1.5; speed = 4; run = true; if (Math.sin(rt * 5) > 0.8) dogBark(dp); }
    // the dog stays on land unless it chose to swim
    if (tx != null && !(act && act.kind === 'nuota')) { const lim = IslandSim.ISL.radius(tx, tz) - 0.9; const rr = Math.hypot(tx, tz); if (rr > lim) { tx *= lim / rr; tz *= lim / rr; } }
    if (tx != null) { const dx = tx - dp.x, dz = tz - dp.z; const d = Math.hypot(dx, dz); if (d > 0.05) { const step = Math.min(d, speed * 1.4 * dt * Math.max(1, ui.speed / 3)); dp.x += dx / d * step; dp.z += dz / d * step; SC.dog.rotation.y = Math.atan2(dx, dz); } dp.y = Math.max(SC.groundH(dp.x, dp.z), -0.38) + (run ? Math.abs(Math.sin(rt * 14)) * 0.08 : 0); }
    SC.dog.rotation.x = 0; SC.dog.rotation.z = 0;
    if (swim) W.dogWetUntil = ENG.T() + 1.5; else if (W.dogWetUntil > ENG.T() && Math.sin(rt * 0.8) > 0.97) { SC.dog.rotation.z = Math.sin(rt * 60) * 0.35; }
    if (swim) { dp.y = Math.max(SC.groundH(dp.x, dp.z), -0.38) + Math.sin(rt * 3) * 0.05; SC.dog.rotation.x = -0.15; if (Math.sin(rt * 0.7) > 0.98) dogBark(dp); }
    if (dig) { SC.dog.rotation.x = 0.35 + Math.sin(rt * 18) * 0.08; }
    if (lie) { dp.y = SC.groundH(dp.x, dp.z) - 0.15; SC.dog.userData.tail.rotation.z = 0; }
    if (lie) {} else if (sleeper) { SC.dog.rotation.z = 0; SC.dog.position.y = SC.groundH(dp.x, dp.z) - 0.15; SC.dog.userData.tail.rotation.z = 0; }
    else SC.dog.userData.tail.rotation.z = Math.sin(rt * (run ? 22 : 12)) * 0.6;
    if (!playerD && W.dogPlayUntil > Tn2) { const a6 = rt * 2.5; SC.ball.position.set(dp.x + Math.sin(a6) * 0.7, SC.groundH(dp.x, dp.z) + 0.28 + Math.abs(Math.sin(rt * 5)) * 0.25, dp.z + Math.cos(a6) * 0.7); }
    const birdNear = SC.gulls.some((g) => g.visible && g.position.distanceTo(dp) < 7);
    if ((run && Math.sin(rt * 1.3) > 0.97) || (birdNear && Math.sin(rt * 0.9) > 0.985)) { dogBark(dp); }
  }
  SC.crabs.forEach((c, i) => { c.visible = W.crabs || W.crabsNatural; if (c.visible) { const x = LOC.shoreSouth[0] - 3 + i * 1.1 + Math.sin(rt * 0.8 + c.userData.ph) * 0.8; const z = LOC.shoreSouth[1] - 0.2 + Math.cos(rt * 0.6 + i) * 0.3; c.position.set(x, SC.groundH(x, z) + 0.05, z); } });
  const shAct = liveAct('squalo'); const shT = shAct && shAct.kind === 'attacca' ? actTarget(shAct) : null;
  SC.shark.visible = W.shark; if (W.shark && shT) { const ang = Math.atan2(shT[1], shT[0]) + Math.sin(rt * 0.8) * 0.3; const r3 = Math.max(IslandSim.ISL.R(ang) + 0.2, Math.hypot(shT[0], shT[1]) + 0.6); const x3 = Math.cos(ang) * r3, z3 = Math.sin(ang) * r3; SC.shark.rotation.y = Math.atan2(x3 - SC.shark.position.x, z3 - SC.shark.position.z); SC.shark.position.set(x3, 0, z3); }
  else if (W.shark) { const base = Math.atan2(LOC.rocksEast[1], LOC.rocksEast[0]); const a3 = base + Math.sin(rt * 0.25) * 0.7; const r3 = IslandSim.ISL.R(a3) + 3.4 + Math.sin(rt * 0.6) * 0.8; const x3 = Math.cos(a3) * r3, z3 = Math.sin(a3) * r3; SC.shark.rotation.y = Math.atan2(x3 - SC.shark.position.x, z3 - SC.shark.position.z) - Math.PI / 2; SC.shark.position.set(x3, 0, z3); }
  SC.bottle.visible = !!W.bottle; if (W.bottle) SC.bottle.position.set(W.bottle.loc[0], 0.08 + Math.sin(rt * 2) * 0.04, W.bottle.loc[1]);
  // ship
  // the rescue ship comes to anchor off this island's north shore (and stays there once the experiment ends)
  const anchor = IslandSim.ISL.shoreAt(-Math.PI / 2, 9);
  SC.ship.visible = !!W.shipNow || !!G.rescued;
  if (G.rescued && !W.shipNow) { SC.ship.position.set(anchor[0], 0, anchor[1]); SC.ship.rotation.y = -Math.PI / 3; }
  if (W.shipNow) { const s = W.shipNow; const k = clamp((h - s.h) / s.dur, 0, 1); if (W.rescueTurn) { SC.ship.position.set(-10 + (anchor[0] + 10) * k, 0, -58 + (anchor[1] + 58) * k); SC.ship.rotation.y = -Math.PI / 3; } else { SC.ship.position.set(-75 + k * 150, 0, -58); SC.ship.rotation.y = 0; } }
  // wildlife
  const birdW = w.rain < 0.3 && !w.storm; const day = h >= 6.3 && h <= 19.8;
  const gAct = liveAct('gabbiani'); const gTgt = gAct && ['attacca', 'mangia', 'segue', 'osserva', 'va'].includes(gAct.kind) ? (gAct.at || actTarget(gAct)) : null;
  SC.gulls.forEach((g, i) => {
    const u = g.userData; g.visible = (birdW && day) || !!gTgt;
    if (gTgt) { // dive-bomb / circle / peck around the target
      const a9 = rt * (gAct.kind === 'attacca' ? 2.2 : 0.9) + i * (Math.PI * 2 / SC.gulls.length);
      const dive = gAct.kind === 'attacca' ? Math.max(0, Math.sin(rt * 2.5 + i * 1.3)) : gAct.kind === 'mangia' ? 1 : 0;
      const rr = gAct.kind === 'attacca' ? 1.3 - dive * 0.9 : gAct.kind === 'mangia' ? 0.8 : 3;
      const gx = gTgt[0] + Math.cos(a9) * rr, gz = gTgt[1] + Math.sin(a9) * rr; const gy = Math.max(SC.groundH(gx, gz), 0.02);
      g.position.set(gx, gy + (gAct.kind === 'mangia' ? 0.2 : 3.2 - dive * 2.8), gz); g.rotation.y = -a9; g.rotation.x = dive * 0.7;
      const f = Math.sin(rt * 14 + u.phase) * 0.7; u.wl.rotation.z = gAct.kind === 'mangia' ? 0.9 : f; u.wr.rotation.z = gAct.kind === 'mangia' ? -0.9 : -f;
      return;
    }
    if (gAct && gAct.kind === 'scappa') { const a4 = rt * u.speed + u.phase; g.position.set(Math.cos(a4) * 40, 12, Math.sin(a4) * 40); return; }
    const cyc = ((rt + u.phase * 7) % 46) / 46; const ground = i % 2 === 0 && cyc > 0.5;
    const spot = u.spot || (u.spot = (() => { const a8 = 1.2 + i * 0.35; return IslandSim.ISL.shoreAt(a8, -0.5); })());
    const dogNear = SC.dog.visible && Math.hypot(SC.dog.position.x - spot[0], SC.dog.position.z - spot[1]) < 3.5;
    if (ground && !dogNear) {
      const t8 = (cyc - 0.5) / 0.5; const wx2 = spot[0] + Math.sin(t8 * 6 + i) * 0.8, wz2 = spot[1] + Math.cos(t8 * 5 + i) * 0.5;
      const gy = Math.max(SC.groundH(wx2, wz2), 0.02);
      if (t8 < 0.08 || t8 > 0.92) { const k8 = t8 < 0.08 ? t8 / 0.08 : (1 - t8) / 0.08; g.position.set(wx2, gy + 0.18 + (1 - k8) * 4, wz2); const f = Math.sin(rt * 9 + u.phase) * 0.6; u.wl.rotation.z = f; u.wr.rotation.z = -f; }
      else { g.position.set(wx2, gy + 0.18 + Math.abs(Math.sin(rt * 6 + i)) * 0.02, wz2); u.wl.rotation.z = 0.9; u.wr.rotation.z = -0.9; g.rotation.x = Math.max(0, Math.sin(rt * 4 + i)) * 0.6; g.rotation.y = Math.sin(rt * 0.5 + i) * 2; }
      return;
    }
    g.rotation.x = 0;
    const f = Math.sin(rt * 9 + u.phase) * 0.6; u.wl.rotation.z = f; u.wr.rotation.z = -f; const a4 = rt * u.speed + u.phase; g.position.set(Math.cos(a4) * u.r, u.h + Math.sin(rt + i) * 0.5, Math.sin(a4) * u.r + 2); g.rotation.y = -a4;
  });
  SC.pelican.visible = birdW && day;
  const dolph = ENG.alive().some((a) => a.sawDolphins && Math.abs(a.sawDolphins - h) < 0.6);
  SC.dolphins.forEach((d, i) => { d.visible = dolph; if (dolph) { const ph = (rt * 0.6 + i * 0.33) % 1; d.position.set(LOC.sitSpot[0] - 6 + ph * 12, -0.4 + Math.sin(ph * Math.PI * 2) * 1.1, LOC.sitSpot[1] + 6 + i * 1.2); d.rotation.set(-Math.cos(ph * Math.PI * 2) * 0.8, Math.PI / 2, 0); } });
  // people
  G.agents.forEach((a) => {
    const P = personMesh(a); const bub = bubbleFor(a);
    const body = G.world.bodies.find((b) => b.id === a.id);
    if ((a.departed && !body) || (body && (body.buried || body.gone))) { P.root.visible = false; bub.style.opacity = 0; return; }
    if (body) { // decomposition: the body darkens, sags and sinks, then only a few bones remain (see bones below)
      const k = Math.min(1, ENG.bodyDecay(body) / 9); if (P._dk == null) { P._skin0 = P.skinMat.color.clone(); P._shirt0 = P.shirtMat.color.clone(); }
      if (Math.abs((P._dk || 0) - k) > 0.01) { P._dk = k; P.skinMat.color.copy(P._skin0).lerp(new THREE.Color(0x4a3a2a), Math.min(1, k * 1.2)); P.shirtMat.color.copy(P._shirt0).lerp(new THREE.Color(0x3a3a30), k * 0.7); P.root.scale.set(1, Math.max(0.3, 1 - k * 0.7), 1); }
      flies(a.id, k > 0.08 && k < 0.92 ? P.root.position : null);
    }
    P.root.visible = true;
    const pos = body ? body.loc : a.pos;
    P.root.position.set(pos[0], Math.max(SC.groundH(pos[0], pos[1]), -0.45), pos[1]);
    let anim = 'idle';
    if (!a.alive) anim = 'dead';
    else if (a.asleep) anim = 'sleep';
    else if (a.thinking) anim = 'think';
    else if (G.ended) { anim = G.rescued ? 'wave' : 'idle'; if (G.rescued) { const tgt = IslandSim.ISL.shoreAt(-Math.PI / 2 + (G.agents.indexOf(a) - 0.5) * 0.08, -0.8); const dx = tgt[0] - a.pos[0], dz = tgt[1] - a.pos[1], d = Math.hypot(dx, dz); if (d > 0.3) { const st = Math.min(d, dt * 2.5); a.pos = [a.pos[0] + dx / d * st, a.pos[1] + dz / d * st]; anim = 'walk'; P.heading = Math.atan2(dx, dz); } else P.heading = Math.PI; } showEnd(G); }
    else if (a.cur) anim = a.cur.walking ? (a.cur.anim === 'run' ? 'run' : 'walk') : (a.cur.type === 'pesca' && !G.world.rod && G.world.spear ? 'spear' : a.cur.anim);
    if (anim === 'walk' && a.cur && !G.ended) P.heading = Math.atan2(a.cur.to[0] - a.cur.from[0], a.cur.to[1] - a.cur.from[1]);
    else if (anim === 'fish' || anim === 'sit') { const r = Math.hypot(pos[0], pos[1]) || 1; const tgt = Math.atan2(pos[0] / r, pos[1] / r); let d = tgt - P.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); P.heading += d * Math.min(1, dt * 4); }
    if (anim === 'swing') P.heading = 0;
    if (a.inCircle && anim !== 'walk') { const fc = ENG.PLACES.fuoco.loc; const tgt = Math.atan2(fc[0] - pos[0], fc[1] - pos[1]); let d = tgt - P.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); P.heading += d * Math.min(1, dt * 5); if (anim === 'idle' || anim === 'look') anim = 'sit'; }
    // don't stand inside objects: sit or lie under a shelter, step to the side of anything else
    if (a.alive && !['walk', 'run', 'swim', 'swing', 'dead'].includes(anim)) {
      const STAND = ['idle', 'think', 'talkstand', 'look', 'read', 'write', 'eat', 'cards', 'strum', 'pray', 'cry', 'wave', 'talk', 'drink', 'sit', 'sleep'];
      for (const c of G.world.custom) {
        if (c.animal) continue; const m = customMeshes[c.id]; if (!m) continue;
        const dx = pos[0] - m.position.x, dz = pos[1] - m.position.z; const d = Math.hypot(dx, dz); if (d > 1.6) continue;
        const box = m.userData.box || (m.userData.box = (() => { const lab = m.userData.label; const vis = lab && lab.visible; if (lab) lab.visible = false; m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m.userData.body || m); if (lab) lab.visible = vis; return b; })());
        const top = box.max.y - m.position.y, half = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
        if (d > half + 0.2 || top < 0.35) continue;
        const shelterLike = /ripar|tettoi|telo|capann|tenda|copert|amaca/i.test(c.name + ' ' + (c.use || '')) || c.fn === 'riparo' || c.fn === 'giaciglio';
        if (shelterLike && top > 0.6 && STAND.includes(anim)) { anim = (a.asleep || top < 1.8) ? 'sleep' : 'sit'; /* a sitting person is ~1.7 units tall */ }
        else if (!shelterLike && top > 0.35) { const k = (half + 0.45) / Math.max(0.01, d); const ox = d < 0.05 ? -m.position.x : dx, oz = d < 0.05 ? -m.position.z : dz; const L2 = Math.hypot(ox, oz) || 1; P.root.position.x = m.position.x + ox / L2 * (half + 0.45); P.root.position.z = m.position.z + oz / L2 * (half + 0.45); P.root.position.y = SC.groundH(P.root.position.x, P.root.position.z); P.heading = Math.atan2(m.position.x - P.root.position.x, m.position.z - P.root.position.z); }
        break;
      }
    }
    P.root.rotation.y = P.heading;
    anim = funAnim(a, anim);
    SC.posePerson(P, anim, rt * Math.min(3, Math.max(1, ui.speed / 6)));
    P.beard.visible = !!(a.colors && a.colors.beard); if (P.beard.visible) P.beard.scale.set(1 + G.day * 0.03, 0.4 + G.day * 0.09, 1 + G.day * 0.03);
    if (!a.alive) P.skinMat.color.setHex(0xb7a58a);
    // bubble
    const now = performance.now();
    let text = '', cls = '';
    const foe = a.alive && !a.asleep && a.relations && Object.entries(a.relations).find(([k, v]) => /risent|rabbia|odio|sospett|non mi fido|disprezz|furios/i.test(v) && (() => { const o = G.agents.find((x) => x.name === k && x.alive); return o && Math.hypot(o.pos[0] - a.pos[0], o.pos[1] - a.pos[1]) < 4; })());
    if (a.alive && a.thinking) { text = '…'; cls = 'thinking'; }
    else if (foe && !(a.bubble && a.bubble.until > performance.now())) { text = '😠'; cls = 'thought'; }
    else if (a.alive && a.bubble && a.bubble.until > now && !a.asleep) { const bt = String(a.bubble.text); text = (a.bubble.kind === 'speech' ? `💬 ${a.name}${a.bubble.to ? ' → ' + a.bubble.to : ''}: ` : `💭 ${a.name}: `) + bt; cls = a.bubble.kind; }
    if (!layout.bubbles && cls !== 'thinking') text = '';
    bub.className = 'bubble ' + cls; bub.style.opacity = text ? 1 : 0;
    if (text) { if (bub.textContent !== text) bub.textContent = text; const p = P.root.position.clone().add(new THREE.Vector3(0, 2.7 * ((a.colors && a.colors.scale) || 1.35) / 1.35, 0)).project(SC.camera); bub.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; bub.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`; }
  });
  // sky
  const hh = h % 24; const sunAng = ((hh - 6) / 14) * Math.PI; const day01 = hh >= 6 && hh <= 20 ? Math.max(0, Math.sin(sunAng)) : 0;
  { const f = RTS.focus; SC.sun.position.set(f.x + Math.cos(sunAng) * 40, Math.max(2, Math.sin(sunAng) * 45), f.z - 12); SC.sun.target.position.set(f.x, 0, f.z); SC.sun.target.updateMatrixWorld(); const ext = Math.max(16, Math.min(45, RTS.dist * 0.9)); const sc = SC.sun.shadow.camera; if (Math.abs(sc.right - ext) > 1) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); } }
  const dim = 1 - w.cloud * 0.55 - (w.storm ? 0.2 : 0);
  SC.sun.intensity = day01 * 0.78 * dim; SC.hemi.intensity = 0.2 + day01 * 0.36 * (0.7 + 0.3 * dim); SC.moon.intensity = day01 > 0.05 ? 0 : 0.25;
  let sky = skyColor(h); sky.lerp(new THREE.Color(day01 > 0.1 ? 0x8b95a1 : 0x151b26), w.cloud * 0.65); if (w.storm) sky.lerp(new THREE.Color(0x3a414c), 0.6); if (w.fog) sky.lerp(new THREE.Color(0xc9d1d8), 0.7);
  SC.scene.background = sky; SC.scene.fog.color.copy(sky); SC.scene.fog.near = w.fog ? 6 : 60 - w.rain * 35; SC.scene.fog.far = w.fog ? 40 : 160 - w.rain * 90;
  SC.stars.material.opacity = Math.max(0, 1 - day01 * 5) * (1 - w.cloud);
  SC.clouds.forEach((c) => { c.visible = c.userData.order < 0.1 + w.cloud * 0.9 && c.position.distanceTo(SC.camera.position) > 22 && SC.camera.position.y < c.position.y - 2; c.position.x += dt * (0.4 + w.wind * 3) * 0.3; if (c.position.x > 70) c.position.x = -70; const g = w.storm ? 0.35 : 1 - w.cloud * 0.5 - w.rain * 0.3; c.children.forEach((p) => p.material.color.setScalar(Math.max(0.2, g * (0.3 + day01 * 0.7)))); });
  SC.rain.material.opacity = w.rain * 0.8;
  if (w.rain > 0.01) { const a5 = SC.rainGeo.attributes.position.array; for (let i = 0; i < SC.RAIN_N; i++) { if (i / SC.RAIN_N > w.rain) { a5[i * 3 + 1] = -5; continue; } a5[i * 3 + 1] -= dt * 22; a5[i * 3] += dt * w.wind * 6; if (a5[i * 3 + 1] < 0) { a5[i * 3 + 1] = 25 + Math.random() * 5; a5[i * 3] = (Math.random() - 0.5) * 60 - w.wind * 4; } } SC.rainGeo.attributes.position.needsUpdate = true; }
  if (w.storm && Math.sin(rt * 1.7) > 0.995) { SC.scene.background = new THREE.Color(0xe8eefc); SC.hemi.intensity = 1.4; }
  SC.palms.forEach((p, i) => { p.crown.rotation.z = Math.sin(rt * (1 + w.wind * 2) + i) * (0.03 + w.wind * 0.18) - w.wind * 0.12; });
  directorCam(dt); audioTick(w, rt); worldExtras(G, w); campExtras(G); rareVisuals(G);
  SC.updateSea(rt, w.waves, w.wind, ENG.tideLevel() * 0.22); SC.seaMat.color.setHex(w.storm ? 0x2f5f78 : w.cloud > 0.5 ? 0x3a7ea3 : 0x2b8cbe); if (day01 < 0.1) SC.seaMat.color.multiplyScalar(0.45);
  // camera
  if (ui.follow && !RTS.followPaused()) { const a = sel(); const P = a && meshes[a.id]; if (P) RTS.aim(P.root.position.x, P.root.position.z, null, null, dt * 3); }
}
/* ---------- camp materials in 3D: stones and fibre set aside, stone hearth, stone wall ---------- */
const campX = { stones: [], fibers: [], hearth: null, wall: null };
function campExtras(G) {
  const W = G.world; const F = LOC.firepit; const g = SC.groundH;
  const nS = Math.min(14, W.stone || 0);
  while (campX.stones.length < nS) { const k = campX.stones.length; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13 + (k % 3) * 0.03, 0), SC.M(k % 4 ? 0x9a948a : 0x7d776d)); const x = F[0] - 1.6 + (k % 4) * 0.28, z = F[1] + 1.1 + Math.floor(k / 4) * 0.26; m.position.set(x, g(x, z) + 0.1, z); m.rotation.set(k, k * 2, 0); m.castShadow = true; SC.scene.add(m); campX.stones.push(m); }
  campX.stones.forEach((m, i) => { m.visible = i < nS; });
  const nF = Math.min(6, Math.ceil((W.fiber || 0) / 2));
  while (campX.fibers.length < nF) { const k = campX.fibers.length; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 6), SC.M(k % 2 ? 0x7a8a3a : 0x8f7a45)); const x = F[0] + 1.4, z = F[1] + 1.0 + k * 0.22; m.rotation.z = Math.PI / 2; m.position.set(x, g(x, z) + 0.1, z); m.castShadow = true; SC.scene.add(m); campX.fibers.push(m); }
  campX.fibers.forEach((m, i) => { m.visible = i < nF; });
  if (W.hearth && !campX.hearth) { const grp = new THREE.Group(); const fc = SC.campFire.position; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const s = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.2), SC.M(i % 2 ? 0x8f8a80 : 0x77716a)); s.position.set(fc.x + Math.cos(a) * 0.78, fc.y + 0.12, fc.z + Math.sin(a) * 0.78); s.rotation.y = -a; s.castShadow = true; grp.add(s); } SC.scene.add(grp); campX.hearth = SC.bakeMerge(grp); }
  if (campX.hearth) campX.hearth.visible = !!W.hearth;
  if (W.wall && !campX.wall) { const grp = new THREE.Group(); const sh = SC.shelter; grp.position.copy(sh.position); grp.rotation.y = sh.rotation.y; for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.3), SC.M((i + r) % 3 ? 0x8f8a80 : 0x6f6a64)); s.position.set(-1.45 + i * 0.36 + (r % 2) * 0.18, 0.11 + r * 0.22, -1.25); s.castShadow = true; grp.add(s); } SC.scene.add(grp); campX.wall = SC.bakeMerge(grp); }
  if (campX.wall) campX.wall.visible = !!W.wall;
  if (SC.bigX.trees && W.forestWood != null) { // the forest thins out as it is cut
    const B = SC.bigX; const cut = Math.floor(Math.max(0, 1 - W.forestWood / 90) * B.nForest * 0.45);
    if (cut !== B.cut) { B.cut = cut; OCC.dirty = true; } }
  resMarkers(G);
  if (W.garden && !campX.garden) { const grp = new THREE.Group(); const L = LOC.shelter; const x0 = L[0] + 2.4, z0 = L[1] + 1.6; const soil = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.4), SC.M(0x6b4a2b)); soil.position.set(x0, SC.groundH(x0, z0) + 0.03, z0); grp.add(soil); for (let i = 0; i < 12; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), SC.M(i % 3 ? 0x5f9a45 : 0x7cae5a)); sp.position.set(x0 - 0.9 + (i % 4) * 0.6, SC.groundH(x0, z0) + 0.2, z0 - 0.45 + Math.floor(i / 4) * 0.45); grp.add(sp); } SC.scene.add(grp); campX.garden = SC.bakeMerge(grp); }
  if (W.tower && W.tower.loc && !campX.tower) { const grp = new THREE.Group(); const [x, z] = W.tower.loc; const y0 = SC.groundH(x, z); const wood = SC.M(0x7a5a36); [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([dx, dz]) => { const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 5), wood); p2.position.set(x + dx, y0 + 2.1, z + dz); grp.add(p2); }); const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.7), SC.M(0x8a6a42)); deck.position.set(x, y0 + 4.0, z); grp.add(deck); const flag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), SC.M(0xc0392b)); flag.position.set(x + 0.3, y0 + 4.9, z); grp.add(flag); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4), wood); pole.position.set(x, y0 + 4.6, z); grp.add(pole); SC.scene.add(grp); campX.tower = SC.bakeMerge(grp); }
  if (SC.bigX.hutRuin) { SC.bigX.hutRuin.visible = !W.hutRepaired; SC.bigX.hutFixed.visible = !!W.hutRepaired; }
}
/* ---------- resources you can see run out: loose stones, vines, fruit, eggs, shellfish, driftwood ---------- */
const resX = {};
function resMarkers(G) {
  const W = G.world, P = ENG.PLACES, R = IslandSim.ISL.res, gh = SC.groundH;
  const set = (key, place, n, max, make, spread) => {
    if (!place || !P[place]) return; const L = P[place].loc; let arr = resX[key];
    if (!arr) { arr = resX[key] = []; const rr = IslandSim.rngFrom(key.length * 97 + IslandSim.ISL.seed); for (let i = 0; i < max; i++) { const m = make(i); const a = rr() * 6.28, d = 0.6 + rr() * spread; const x = L[0] + Math.cos(a) * d, z = L[1] + Math.sin(a) * d; m.position.x = x; m.position.z = z; m.position.y += gh(x, z); m.castShadow = true; SC.scene.add(m); arr.push(m); } }
    const k = Math.max(0, Math.min(max, Math.round(n))); arr.forEach((m, i) => { m.visible = i < k; });
  };
  const stoneLeft = W.stoneLeft == null ? 70 : W.stoneLeft;
  set('stones', 'pietre', stoneLeft / (IslandSim.ISL.S > 1 ? 160 : 70) * 12, 12, (i) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (i % 3) * 0.05, 0), SC.M(i % 3 ? 0x9a948a : 0x6f6a64)); m.position.y = 0.1; m.rotation.set(i, i * 2, 0); return m; }, 2.4);
  if (P.falesia) set('stonesC', 'falesia', stoneLeft / 160 * 10, 10, (i) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + (i % 3) * 0.05, 0), SC.M(0x8f8a80)); m.position.y = 0.12; return m; }, 3);
  const fib = W.fiberLeft == null ? 18 : W.fiberLeft, fibMax = IslandSim.ISL.S > 1 ? 30 : 18;
  const vine = (i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2 + (i % 3) * 0.4, 4), SC.M(0x4a6b2a)); m.position.y = 1.2; m.rotation.z = (i % 2 ? 0.25 : -0.2); return m; };
  if (R.lianas) set('vines', 'boscaglia', fib / fibMax * 8, 8, vine, 2.5);
  if (P.foresta) set('vinesF', 'foresta', fib / fibMax * 10, 10, vine, 6);
  if (P.banani) set('bananas', 'banani', Math.min(10, W.fruit || 0), 10, (i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), SC.M(0xe8c53a)); m.scale.set(0.7, 1.6, 0.7); m.position.y = 1.4 + (i % 3) * 0.12; return m; }, 1.4);
  if (P.papaie) set('papayas', 'papaie', Math.min(6, (W.fruit || 0) / 2), 6, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), SC.M(0xe8913a)); m.scale.y = 1.4; m.position.y = 1.9; return m; }, 1.2);
  const egg = () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), SC.M(0xf3ead2)); m.scale.y = 1.3; m.position.y = 0.3; return m; };
  if (P.nidi) set('eggs', 'nidi', Math.min(6, W.eggs || 0), 6, egg, 1.2);
  if (P.falesia) set('eggsC', 'falesia', Math.min(6, W.eggs || 0), 6, egg, 2.5);
  set('shells', 'scogli', Math.min(10, W.shellfish == null ? 8 : W.shellfish), 10, () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.08, 6), SC.M(0x2f2a3a)); m.position.y = 0.05; return m; }, 2.5);
  if (P.laguna) set('shellsL', 'laguna', Math.min(8, W.shellfish == null ? 8 : W.shellfish), 8, () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.08, 6), SC.M(0xd9c7a8)); m.position.y = 0.05; return m; }, 3);
  set('drift', P.spiaggia_est ? 'spiaggia_est' : 'spiaggia', Math.min(6, (W.driftWood || 0) / 2), 6, (i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.2 + (i % 3) * 0.4, 6), SC.M(0xb9a27a)); m.rotation.z = Math.PI / 2; m.rotation.y = i * 1.3; m.position.y = 0.1; return m; }, 3);
}
/* ---------- flies over an unburied body ---------- */
const FLY = {};
function flies(id, pos) {
  let f = FLY[id]; if (!pos) { if (f) f.visible = false; return; }
  if (!f) { f = new THREE.Group(); for (let i = 0; i < 9; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 3), new THREE.MeshBasicMaterial({ color: 0x111111 })); d.userData.ph = Math.random() * 6.28; f.add(d); } SC.scene.add(f); FLY[id] = f; }
  f.visible = true; f.position.set(pos.x, SC.groundH(pos.x, pos.z) + 0.5, pos.z); const t = performance.now() / 1000;
  f.children.forEach((d, i) => { const ph = d.userData.ph; d.position.set(Math.cos(t * (2 + i * 0.3) + ph) * (0.4 + (i % 3) * 0.2), Math.sin(t * 5 + ph) * 0.15 + (i % 2) * 0.2, Math.sin(t * (2.4 + i * 0.2) + ph) * 0.5); });
}

/* ---------- world extras: moon light, fallen coconuts, worn paths, rats, insects, tan ---------- */
const extra = { coco: [], paths: {}, rats: [], bugs: null };
function worldExtras(G, w) {
  const W = G.world; const night = G.h < 6 || G.h > 19.5;
  if (night) SC.moon.intensity = 0.06 + 0.4 * ENG.moonLight();
  const nC = Math.min(8, Math.floor(W.coconutsGround || 0));
  while (extra.coco.length < nC) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), new THREE.MeshPhongMaterial({ color: 0x6b4a2b, flatShading: true })); const p = ENG.PLACES.palme.loc; const k = extra.coco.length; m.position.set(p[0] + Math.cos(k * 2.1) * (0.6 + k * 0.12), 0, p[1] + Math.sin(k * 2.1) * (0.6 + k * 0.12)); m.position.y = SC.groundH(m.position.x, m.position.z) + 0.1; SC.scene.add(m); extra.coco.push(m); }
  extra.coco.forEach((m, i) => { m.visible = i < nC; });
  Object.entries(W.paths || {}).forEach(([k, n]) => {
    if (n < 4) return; const [a, b] = k.split('|'); const A = ENG.PLACES[a], B = ENG.PLACES[b]; if (!A || !B) return;
    let m = extra.paths[k]; if (!m) { const dx = B.loc[0] - A.loc[0], dz = B.loc[1] - A.loc[1], len = Math.hypot(dx, dz); const segs = Math.max(2, Math.round(len / 1.2)); const g = new THREE.Group();
      for (let i = 0; i <= segs; i++) { const x = A.loc[0] + dx * i / segs, z = A.loc[1] + dz * i / segs; const s = new THREE.Mesh(new THREE.CircleGeometry(0.5, 7), new THREE.MeshBasicMaterial({ color: 0x9c8455, transparent: true, opacity: 0 })); s.rotation.x = -Math.PI / 2; s.position.set(x, SC.groundH(x, z) + 0.02, z); g.add(s); }
      SC.scene.add(g); m = extra.paths[k] = g; }
    m.children.forEach((s) => { s.material.opacity = Math.min(0.45, (n - 3) * 0.04); });
  });
  if (W.rats && !extra.rats.length) for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.2), new THREE.MeshPhongMaterial({ color: 0x3a3330 })); SC.scene.add(r); extra.rats.push(r); }
  extra.rats.forEach((r, i) => { r.visible = night; const f = ENG.PLACES.fuoco.loc; const a = rt * 0.9 + i * 2; r.position.set(f[0] + Math.cos(a) * (1.5 + i * 0.4), SC.groundH(f[0], f[1]) + 0.04, f[1] + Math.sin(a * 1.3) * (1.2 + i * 0.3)); r.rotation.y = -a; });
  if (!extra.bugs) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Array(60 * 3).fill(0), 3)); extra.bugs = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x111111, size: 0.05 })); SC.scene.add(extra.bugs); }
  const bugsOn = W.mosquitoes || W.sandflies; extra.bugs.visible = !!bugsOn;
  if (bugsOn) { const a = ENG.alive()[0]; if (a) { const p = extra.bugs.geometry.attributes.position; for (let i = 0; i < 60; i++) p.setXYZ(i, a.pos[0] + Math.sin(rt * 3 + i) * 0.6 + Math.sin(i * 7.1) * 0.3, SC.groundH(a.pos[0], a.pos[1]) + 1 + Math.cos(rt * 2.3 + i * 1.7) * 0.6, a.pos[1] + Math.cos(rt * 2.7 + i * 3.3) * 0.6); p.needsUpdate = true; } }
  G.agents.forEach((a) => { const P = meshes[a.id]; if (!P || !a.alive) return; const tan = Math.min(1, (a.sunExp || 0) / 80); const burn = (a.wounds || []).some((x) => x.tipo === 'scottatura'); const base = new THREE.Color((a.colors && a.colors.skin) || 0xe0ac69); base.lerp(new THREE.Color(0x8d5524), tan * 0.55); if (burn) base.lerp(new THREE.Color(0xd9534f), 0.35); P.skinMat.color.copy(base); });
}
const WX_ICON = { sereno: '☀️', caldo: '🥵', nuvoloso: '☁️', pioggia: '🌧️', ventoso: '💨', temporale: '⛈️' };
/* ---------- end of the experiment ---------- */
let endShown = false;
function showEnd(G) {
  if (endShown || !G.ended) return; endShown = true;
  const surv = G.agents.filter((a) => a.alive && !a.departed), dead = G.agents.filter((a) => !a.alive);
  const el = document.createElement('div'); el.id = 'endCard'; el.className = 'card';
  el.innerHTML = `<h2 style="margin:0 0 6px">${G.rescued ? '🚢 Salvati!' : surv.length ? '🏁 Esperimento concluso' : '✝ Nessun sopravvissuto'}</h2>
    <div>${esc(G.ended)}</div>
    <div style="margin:8px 0">Durata: <b>${(G.endedAt ? G.endedAt.day : G.day)} ${(G.endedAt ? G.endedAt.day : G.day) === 1 ? 'giorno' : 'giorni'}</b> · Sopravvissuti: <b>${surv.map((a) => esc(a.name)).join(', ') || 'nessuno'}</b>${dead.length ? `<br>Morti: ${dead.map((a) => `${esc(a.name)} (giorno ${a.deathDay || '?'}, ${esc(a.deathCause || '')})`).join('; ')}` : ''}</div>
    ${G.scenario && G.scenario !== 'libero' ? `<div class="legend">Scenario: <b>${esc(ENG.SCENARIOS[G.scenario].label)}</b> — ${esc(ENG.SCENARIOS[G.scenario].q)}<br>L'analisi di Claude comparirà nella scheda 📖.</div>` : ''}
    <div class="legend">Medaglie: ${Object.keys(G.medals || {}).map((k) => ENG.MEDALS[k]).join(' ') || '—'}</div>
    <div class="legend">Chiamate a Claude: ${G.stats.calls} · capitoli del racconto: ${(G.stories || []).length} · momenti salienti: ${(G.highlights || []).length}</div>
    <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button id="endStory">📖 Leggi il racconto</button><button id="endPdf" title="Analisi e racconto completo">📄 Scarica PDF</button><button id="endArch">📚 Archivia per il confronto</button><button id="endNew">⟲ Nuova partita</button><button id="endClose">✕ Chiudi</button></div>`;
  document.body.appendChild(el);
  $('endStory').onclick = () => { openTab('story', true); el.remove(); };
  $('endPdf').onclick = () => exportPDF($('endPdf'));
  $('endArch').onclick = () => { archiveRun(); $('endArch').textContent = '✓ Archiviata'; $('endArch').disabled = true; };
  $('endNew').onclick = () => { ENG.discard(); location.reload(); };
  $('endClose').onclick = () => el.remove();
}
function hud(G) {
  const w = ENG.weatherNow();
  const maxD = G.maxDays == null ? 20 : G.maxDays;
  setHTML($('dayBig'), `Giorno ${maxD ? Math.min(G.day, maxD) : G.day} <small>/ ${maxD || '∞'}</small>`);
  updateUnitBar(G); ageTick(G); syncTarget(); whisperStatus();
  const sa = sel(); setText($('doing'), sa ? '▸ ' + ENG.doingText(sa) : '');
  updateResBar(G);
  setText($('clock'), fmtH(G.h));
  $('dayBar').firstElementChild.style.width = `${clamp((G.h - 6) / 24 * 100)}%`;
  setText($('wxIcon'), w.rain > 0.3 ? (w.storm ? '⛈️' : '🌧️') : w.fog ? '🌫️' : (G.h % 24 < 6 || G.h % 24 > 20) ? '🌙' : (WX_ICON[w.desc.kind] || '☀️'));
  const ovr = G.wxOverride && ENG.T() < G.wxOverride.to; setText($('wxName'), w.desc.label);
  { const b = $('wxStop'); if (b) { b.style.display = ovr ? '' : 'none'; if (ovr) { const left = G.wxOverride.to - ENG.T(); const txt = `⚡ ${left >= 48 ? Math.round(left / 24) + 'g' : Math.ceil(left) + 'h'} ✖`; if (b.textContent !== txt) b.textContent = txt; b.title = `Meteo forzato: ${G.wxOverride.w.label || ''}, ancora ${Math.ceil(left)} ore di gioco. Clic per farlo finire subito.`; } if (!b.onclick) b.onclick = () => ENG.endWeather(); } }
  setText($('wxTemp'), `${Math.round(w.temp)} °C`);
  setText($('wxSea'), `Mare ${w.desc.sea} · ${w.wind < 0.25 ? 'vento debole' : w.wind < 0.55 ? 'brezza' : w.wind < 0.85 ? 'vento forte' : 'raffiche'}`);
  thinkBtnSync();
  const rw = ENG.rateWait(); if (rw) setText($('thinking'), `⏳ Claude chiede di rallentare: riprendo da solo tra ${Math.ceil((rw - Date.now()) / 1000)} s`);
  const thinking = G.agents.filter((a) => a.thinking).map((a) => a.name);
  if (!rw) setText($('thinking'), G.ended ? '🏁 ' + G.ended : thinking.length ? `🧠 ${thinking.join(', ')} ${thinking.length > 1 ? 'stanno' : 'sta'} pensando… (${{ pausa: 'il tempo si ferma', lento: 'il tempo rallenta', scorre: 'gli altri vanno avanti' }[ENG.thinkMode()]})` : G.running ? '' : 'In pausa');
  if (G.ended && !$('endShown').value) { $('endShown').value = '1'; $('toast').textContent = '🏁 ' + G.ended; $('toast').style.display = 'block'; setPlay(false); }
}
requestAnimationFrame(frame);
})();
