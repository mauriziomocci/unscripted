
/* ===== Archivio personaggi: characters live outside any environment and are injected into it =====
   Storage: IndexedDB ('esperimento' / store 'chars'), localStorage fallback. One record per character. */
var ARCH = { chars: [], ready: null, idb: null, filter: 'vivi', q: '', open: false, era: 'presente' };
const SECTIONS = [
  ['identita', 'Identità e aspetto', 'Chi è, lavoro, aspetto fisico, come si veste.'],
  ['storia', 'Storia di vita', 'Infanzia, famiglia, lavoro, eventi che l\'hanno segnato.'],
  ['carattere', 'Carattere', 'Come è fatto: pregi, difetti, reazioni tipiche.'],
  ['valori', 'Valori, convinzioni, fissazioni', 'In cosa crede, di cosa è convinto, cosa non sopporta.'],
  ['paure', 'Paure e punti deboli', 'Cosa lo spaventa, dove è vulnerabile, cosa lo fa crollare.'],
  ['parlata', 'Modo di parlare', 'Lessico, intercalari, dialetto, tic verbali, tono.'],
  ['relazioni_stile', 'Come tratta gli altri', 'Con chi gli dà ragione, con chi gli dà torto, con i deboli, con chi comanda.'],
];
const REL_TYPES = ['fratelli/sorelle', 'genitore/figlio', 'ex partner', 'partner', 'amici', 'colleghi', 'rivali', 'vicini di casa', 'conoscenti', 'si odiano'];
const SYN = { identita: /identit|aspetto|chi [eè]|chi sono|descrizione|look|appearance|identity/i, storia: /storia|biografi|passato|vita|background|history|infanzia/i, carattere: /caratter|personalit|temperament|personality/i,
  valori: /valori|convinzion|credenz|fissazion|ideolog|beliefs|values|opinion/i, paure: /paur|debol|fragil|fears|weak/i, parlata: /parla|linguagg|lessico|dialett|voce|speech|speaking/i,
  relazioni_stile: /tratta|altri|rapporto con gli|come si comporta|others/i, segreti: /segret|nasconde|non dice|secret/i, obiettivi: /obiettiv|scop|vuole|desider|goal/i, rapporti: /rapporti|relazioni|legami|conosce|relationships/i };
const normName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const newId = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

function archOpenDb() { return new Promise((res) => { try { const q = indexedDB.open('esperimento', 1); q.onupgradeneeded = () => { q.result.createObjectStore('chars', { keyPath: 'id' }); }; q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch (e) { res(null); } }); }
ARCH.ready = (async () => {
  ARCH.idb = await archOpenDb();
  if (ARCH.idb) { ARCH.chars = await new Promise((res) => { try { const r = ARCH.idb.transaction('chars').objectStore('chars').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); } catch (e) { res([]); } }); }
  else { try { ARCH.chars = JSON.parse(localStorage.getItem('isola-archivio') || '[]'); } catch (e) { ARCH.chars = []; } }
  return ARCH.chars;
})();
function archPersist(c) {
  if (ARCH.idb) { try { ARCH.idb.transaction('chars', 'readwrite').objectStore('chars').put(JSON.parse(JSON.stringify(c))); return true; } catch (e) { return false; } }
  try { localStorage.setItem('isola-archivio', JSON.stringify(ARCH.chars)); return true; } catch (e) { toastMsg('⚠ Archivio pieno: esporta i personaggi per non perderli.'); return false; }
}
function archDeleteStore(id) { if (ARCH.idb) { try { ARCH.idb.transaction('chars', 'readwrite').objectStore('chars').delete(id); } catch (e) {} } else archPersist(); }
function archBlank(o) { return Object.assign({ schema: 'personaggio/1', id: newId(), version: 1, updated: new Date().toISOString(), name: '', sex: 'm', age: 35, temper: '', short: '', tags: [], sections: {}, secrets: [], goals: [], relations: [], status: 'vivo', life: 1, lives: [], origin: null, sessions: [], versions: [] }, o || {}); }
function archSave(c, why) {
  const old = ARCH.chars.find((x) => x.id === c.id);
  if (old && old !== c) { c.versions = (old.versions || []).concat([{ v: old.version, at: old.updated, why: why || 'modifica', data: Object.assign({}, old, { versions: undefined }) }]).slice(-15); c.version = (old.version || 1) + 1; }
  c.updated = new Date().toISOString();
  const i = ARCH.chars.findIndex((x) => x.id === c.id); if (i >= 0) ARCH.chars[i] = c; else ARCH.chars.push(c);
  archPersist(c); if (ARCH.open) archRender(); return c;
}
const archGet = (id) => ARCH.chars.find((c) => c.id === id);
const archByName = (n) => ARCH.chars.filter((c) => normName(c.name) === normName(n));

/* what the engine needs: the sheet of an archived character, relations resolved to names */
function archSheet(c) {
  if (!c) return null;
  const relations = (c.relations || []).map((r) => { const o = archGet(r.to); return o ? { to: o.name, type: r.type, view: r.view, int: r.int } : null; }).filter(Boolean);
  return { archId: c.id, summary: c.summary || '', sections: c.sections || {}, secrets: (c.secrets || []).filter(Boolean), goals: (c.goals || []).filter(Boolean), relations };
}
function archPersona(c) { const t = c.temper ? `temperamento ${c.temper}` : ''; return [c.short || (c.sections && c.sections.carattere) || '', t].filter(Boolean).join('; ').slice(0, 600); }

/* ---------- files: Markdown / text / JSON character sheets ---------- */
function archParse(text, filename) {
  const name0 = String(filename || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (/\.json$/i.test(filename || '') || /^\s*\{/.test(text)) {
    let j; try { j = JSON.parse(text); } catch (e) { return { error: 'Il file JSON non è valido.' }; }
    if (j && Array.isArray(j.chars)) return { archive: j };
    if (j && j.name) return { char: archBlank(Object.assign({}, j, { id: newId(), versions: [] })) };
    return { error: 'Il JSON non contiene un personaggio (manca "name").' };
  }
  const c = archBlank({ origin: { label: `importato da ${filename || 'file'} · ${today()}` } }); const map = [];
  const lines = String(text).replace(/\r/g, '').split('\n'); let cur = null; let buf = []; const sec = {};
  const flush = () => { if (cur !== null) { const body = buf.join('\n').replace(/^\s*_[^_]+_\s*$/gm, '').trim(); if (body) sec[cur.key] = (sec[cur.key] ? sec[cur.key] + '\n\n' : '') + body; } buf = []; };
  lines.forEach((ln) => {
    const h = ln.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (h && h[1] === '#' && !c.name) { c.name = h[2].replace(/^nome:\s*/i, '').trim(); return; }
    if (h) { flush(); const t = h[2]; const key = Object.keys(SYN).find((k) => SYN[k].test(t)) || 'altro'; cur = { key, title: t }; map.push({ title: t, key }); return; }
    const kv = !cur && ln.match(/^\s*(nome|età|eta|sesso|temperamento|carattere in breve|in breve|epoca|ruolo preferito|ruolo|stile)\s*:\s*(.+)$/i);
    if (kv) { const k = kv[1].toLowerCase(), v = kv[2].trim(); if (k === 'nome') c.name = v; else if (/et/.test(k)) c.age = Math.max(3, Math.min(95, parseInt(v, 10) || c.age)); else if (k === 'sesso') c.sex = /^f|donna/i.test(v) ? 'f' : 'm'; else if (k === 'temperamento') c.temper = v.toLowerCase(); else if (k === 'epoca') c.era = /^futur/i.test(v) ? 'futuro' : /^romanz/i.test(v) ? 'romanzo' : 'presente'; else if (/^ruolo/.test(k)) c.role = archRoleKey(v) || v.slice(0, 40); else if (k === 'stile') c.style = v.slice(0, 80); else c.short = v; return; }
    if (!cur) { if (ln.trim()) { cur = { key: 'storia', title: '(testo senza titolo)' }; map.push(cur); } else return; }
    buf.push(ln);
  });
  flush();
  ['identita', 'storia', 'carattere', 'valori', 'paure', 'parlata', 'relazioni_stile', 'altro'].forEach((k) => { if (sec[k]) c.sections[k] = sec[k].slice(0, 20000); });
  const listOf = (t) => String(t || '').split('\n').map((x) => x.replace(/^\s*[-*\d.)]+\s*/, '').trim()).filter((x) => x.length > 2);
  if (sec.segreti) c.secrets = listOf(sec.segreti).slice(0, 12);
  if (sec.obiettivi) c.goals = listOf(sec.obiettivi).slice(0, 12);
  if (sec.rapporti) c.pendingRelations = listOf(sec.rapporti).map((x) => { const m = x.match(/^([^:]+):\s*([^,]+)(?:,\s*([-+−]?\d))?(?:,\s*["«“]?(.+?)["»”]?)?$/); return m ? { name: m[1].trim(), type: m[2].trim(), int: parseInt(String(m[3] || '0').replace('−', '-'), 10) || 0, view: (m[4] || '').trim() } : null; }).filter(Boolean);
  if (!c.name) c.name = name0 || 'Senza nome';
  if (!c.short) { const src = c.sections.carattere || c.sections.identita || c.sections.storia || ''; c.short = src.split(/(?<=[.!?])\s/)[0].slice(0, 200); }
  if (text.length > 200000) return { error: 'Il file è troppo lungo (oltre 200.000 caratteri).' };
  return { char: c, map, chars: text.length };
}
function archResolvePending(c) { // relations written by name in a file become links when those people exist in the archive
  (c.pendingRelations || []).forEach((r) => { const o = archByName(r.name)[0]; if (!o || o.id === c.id) return; if (!(c.relations || []).some((x) => x.to === o.id)) { c.relations = (c.relations || []).concat([{ to: o.id, type: r.type, int: r.int, view: r.view }]); } });
  c.pendingRelations = (c.pendingRelations || []).filter((r) => !archByName(r.name)[0]);
}
function archTemplate(era) {
  return `# Nome e cognome
Età: 40
Sesso: uomo
Temperamento: ironico
${era === 'futuro' ? 'Epoca: futuro\nRuolo preferito: capitano\nStile: il tipo di ufficiale in poche parole\n' : era === 'romanzo' ? 'Epoca: romanzo\n' : ''}In breve: una riga che lo descrive (è quella che si vede sulla scheda)

## Identità e aspetto
_Chi è, che lavoro fa, com'è fatto, come si veste._

## Storia di vita
_Infanzia, famiglia, lavoro, gli eventi che l'hanno segnato._

## Carattere
_Pregi, difetti, come reagisce di solito._

## Valori, convinzioni, fissazioni
_In cosa crede, di cosa è convinto (anche se sbagliato), cosa non sopporta._

## Paure e punti deboli
_Cosa lo spaventa, dove è vulnerabile._

## Modo di parlare
_Lessico, intercalari, dialetto, tic verbali, tono._

## Come tratta gli altri
_Con chi gli dà ragione, con chi gli dà torto, con chi comanda._

## Segreti
- un segreto per riga (lo sa solo lui)

## Obiettivi
- cosa vuole ottenere, senza dirlo (uno per riga)

## Rapporti
- Nome di un altro personaggio: ex partner, -2, "cosa pensa di lui/lei"
`;
}
function archToMarkdown(c, withSecrets) {
  const L = [`# ${c.name}`, `Età: ${c.age}`, `Sesso: ${c.sex === 'f' ? 'donna' : 'uomo'}`]; if (c.temper) L.push(`Temperamento: ${c.temper}`); if (archEra(c) === 'romanzo') L.push('Epoca: romanzo'); if (archEra(c) === 'futuro') { L.push('Epoca: futuro'); if (c.role) L.push(`Ruolo preferito: ${c.role}`); if (c.style) L.push(`Stile: ${c.style}`); } if (c.short) L.push(`In breve: ${c.short}`);
  SECTIONS.forEach(([k, t]) => { if ((c.sections || {})[k]) L.push('', `## ${t}`, c.sections[k]); });
  if (withSecrets && (c.secrets || []).length) L.push('', '## Segreti', ...c.secrets.map((s) => `- ${s}`));
  if ((c.goals || []).length && withSecrets) L.push('', '## Obiettivi', ...c.goals.map((s) => `- ${s}`));
  const rel = (c.relations || []).map((r) => { const o = archGet(r.to); return o ? `- ${o.name}: ${r.type}, ${r.int || 0}${r.view ? `, "${r.view}"` : ''}` : null; }).filter(Boolean);
  if (rel.length) L.push('', '## Rapporti', ...rel);
  if ((c.sections || {}).altro) L.push('', '## Altro', c.sections.altro);
  return L.join('\n') + '\n';
}

/* ---------- sync with the running island: births, deaths, migration ---------- */
function archFromAgent(a, label) {
  return archBlank({ name: a.name, sex: a.sex === 'f' ? 'f' : 'm', age: a.age || 35, short: String(a.persona || '').slice(0, 300), sections: Object.assign({}, a.bio ? { storia: String(a.bio).slice(0, 4000) } : {}), origin: { env: 'isola', label } });
}
function archSyncGame() {
  const G = ENG.G; if (!G || !ARCH.loaded) return; const date = G.startedAt ? new Date(G.startedAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : 'precedente';
  const key = `isola:${G.seed}:${G.startedAt || ''}`;
  G.agents.forEach((a) => {
    if (!a.archId) { // born on the island (setup without archive, new castaway, god intervention): into the archive right away
      const known = archByName(a.name).find((c) => (c.sessions || []).includes(key));
      const c = known || archSave(archFromAgent(a, `nato sull'isola · partita del ${date}`), 'nascita'); a.archId = c.id; if (!a.sheet) a.sheet = archSheet(c); ENG.save();
    }
    const c = archGet(a.archId); if (!c) return;
    if (!(c.sessions || []).includes(key)) { c.sessions = (c.sessions || []).concat([key]); archSave(c, 'in scena'); }
    if (!a.alive && !a.departed && c.status !== 'deceduto' && !(c.deaths || []).includes(key)) { // death is a fact of the character's story, never a deletion
      c.status = 'deceduto'; c.deaths = (c.deaths || []).concat([key]);
      c.lives = (c.lives || []).concat([{ n: c.life || 1, death: { env: 'isola', label: `morto sull'isola · partita del ${date} · giorno ${a.deathDay || G.day}${a.deathCause ? ' · ' + a.deathCause : ''}`, day: a.deathDay || G.day, cause: a.deathCause || '' } }]);
      archSave(c, 'morte');
    }
  });
}
setInterval(() => { try { archSyncGame(); } catch (e) {} }, 3000);
ARCH.ready.then(() => { ARCH.loaded = true; const p0 = document.querySelector('.archPick[data-i="0"]'); if (p0 && castData[0] && castData[0].archId) p0.dataset.v = castData[0].archId; archSetupSelects(); });

/* ---------- setup: each castaway can come from the archive ---------- */
function archOptions(sel) {
  if (!ARCH || !ARCH.chars) return '<option value="">✎ Nuovo (scritto qui)</option>';
  const live = ARCH.chars.filter((c) => c.status !== 'deceduto' && !c.disabled && archEra(c) === 'presente').sort((a, b) => a.name.localeCompare(b.name));
  const dead = ARCH.chars.filter((c) => c.status === 'deceduto' && !c.disabled && archEra(c) === 'presente').sort((a, b) => a.name.localeCompare(b.name));
  return `<option value="">✎ Nuovo (scritto qui)</option>` + (live.length ? `<optgroup label="Dall'archivio">${live.map((c) => `<option value="${c.id}"${sel === c.id ? ' selected' : ''}>${esc(c.name)} · ${c.age}</option>`).join('')}</optgroup>` : '') + (dead.length ? `<optgroup label="Deceduti: nuova vita, senza ricordi">${dead.map((c) => `<option value="${c.id}"${sel === c.id ? ' selected' : ''}>✝ ${esc(c.name)} · nuova vita #${(c.life || 1) + 1}</option>`).join('')}</optgroup>` : '');
}
function archSetupSelects() {
  document.querySelectorAll('.archPick').forEach((s) => { const v = s.value || s.dataset.v || ''; s.innerHTML = archOptions(v); });
}
function archApplyPick(i, id) {
  const c = archGet(id); castData[i] = castData[i] || {}; castData[i].archId = id || '';
  if (!c) { castSave(); return; }
  if (i === 0) { $('sName').value = c.name; $('sSex').value = c.sex; $('sAge').value = c.age; $('sPersona').value = archPersona(c).replace(/; temperamento .*$/, ''); if ($('sTemper')) $('sTemper').value = TEMPERS.some(([v]) => v === c.temper) ? c.temper : ''; saveForm(); }
  else { Object.assign(castData[i], { name: c.name, sex: c.sex, age: c.age, persona: c.short || '', temper: TEMPERS.some(([v]) => v === c.temper) ? c.temper : '' }); renderCast(); }
  castSave(); castDupCheck();
}
document.addEventListener('change', (e) => { const s = e.target.closest && e.target.closest('.archPick'); if (!s) return; archApplyPick(+s.dataset.i, s.value); });

/* after the game starts: link agents to their archive records (or create them: birth) */
function archLinkCast(cast) { return ARCH.ready.then(() => archLinkCastNow(cast)); }
function archLinkCastNow(cast) {
  const G = ENG.G; if (!G) return; G.startedAt = G.startedAt || Date.now();
  cast.forEach((c, i) => { const a = G.agents[i]; if (!a) return; const rec = c.archId && archGet(c.archId);
    if (rec) { if (rec.status === 'deceduto') { rec.status = 'vivo'; rec.life = (rec.life || 1) + 1; archSave(rec, `nuova vita #${rec.life}`); a.lifeNote = `nuova vita #${rec.life}`; } a.archId = rec.id; a.sheet = archSheet(rec); } });
  archSyncGame(); ENG.save();
}

/* ---------- the archive view ---------- */
function archEnsureView() {
  if ($('archView')) return;
  const v = document.createElement('div'); v.id = 'archView'; v.hidden = true; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Archivio personaggi');
  v.innerHTML = `<div class="avHead"><h2>👥 Archivio personaggi <small id="avCount"></small></h2><div class="seg avEra" role="radiogroup" aria-label="Epoca"><button data-era="presente" class="on" role="radio" aria-checked="true">🏝 Presente</button><button data-era="futuro" role="radio" aria-checked="false">🚀 Futuro</button><button data-era="romanzo" role="radio" aria-checked="false">📖 Romanzo</button></div><span><button id="avHome" title="Vai alla lista degli ambienti">⌂ Ambienti</button> <button id="avClose" class="btn-icon" aria-label="Chiudi l'archivio">✕</button></span></div>
  <div class="avBar"><input id="avQ" type="search" placeholder="Cerca nome o parola…" aria-label="Cerca">
   <div class="seg" role="radiogroup" aria-label="Filtro"><button data-f="vivi" class="on">Vivi</button><button data-f="deceduti">Deceduti</button><button data-f="disattivati">Disattivati</button><button data-f="tutti">Tutti</button></div>
   <button id="avNew" class="primary">＋ Nuovo personaggio</button><label class="btnlike" title="Carica una scheda .md, .txt o .json">⇪ Da file<input id="avFile" type="file" accept=".md,.txt,.json,text/plain,application/json" hidden multiple></label>
   <button id="avPack" hidden title="Aggiunge all'archivio le schede complete già pronte che non hai ancora (vivi, con i rapporti collegati)">📦 Personaggi pronti</button><button id="avTpl" title="Scarica il modello di scheda da compilare">⇩ Modello scheda</button><button id="avExp" title="Esporta tutto l'archivio in un file .json">⇩ Esporta archivio</button></div>
  <div id="avMigrate" class="avNote" hidden></div><div id="avCrew" class="crewPanel" hidden></div>
  <div id="avDrop" class="avDrop">Trascina qui una o più schede (.md, .txt, .json) per aggiungerle all'archivio</div>
  <div id="avGrid" class="avGrid"></div><datalist id="relTypes">${REL_TYPES.map((t) => `<option value="${t}">`).join('')}</datalist>`;
  document.body.appendChild(v);
  $('avClose').onclick = archClose; $('avHome').onclick = () => { archClose(); if (typeof tsLeave === 'function' && window.__talkActive) tsLeave(); homeShow(); }; $('avQ').oninput = (e) => { ARCH.q = e.target.value; archRender(); };
  v.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { ARCH.filter = b.dataset.f; v.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b)); archRender(); }; });
  $('avNew').onclick = () => (ARCH.era === 'futuro' ? archNewForRole('capitano') : archEdit(archBlank(Object.assign(ARCH.era === 'romanzo' ? { era: 'romanzo' } : {}, { origin: { label: `creato nell'archivio · ${today()}` } })), true));
  v.querySelectorAll('[data-era]').forEach((b) => { b.onclick = () => { ARCH.era = b.dataset.era; v.querySelectorAll('[data-era]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); }); archRender(); }; });
  crewWire();
  $('avFile').onchange = (e) => { [...e.target.files].forEach(archImportFile); e.target.value = ''; };
  $('avPack').onclick = () => { if (typeof ARCH_PACK === 'undefined') return; let n = 0; ARCH_PACK.chars.forEach((c) => { if (archGet(c.id) || archByName(c.name).some((x) => x.status !== 'deceduto' && (x.sections || {}).storia)) return; archSave(Object.assign(archBlank(), JSON.parse(JSON.stringify(c))), 'pacchetto'); n++; }); ARCH.chars.forEach((o) => { if ((o.pendingRelations || []).length) { const k = o.pendingRelations.length; archResolvePending(o); if (o.pendingRelations.length !== k) archSave(o, 'rapporti dal pacchetto'); } }); toastMsg(n ? `📦 ${n} personaggi aggiunti all'archivio, vivi e con i rapporti collegati.` : 'Sono già tutti nell\'archivio.'); archRender(); archMigrateOffer(); };
  $('avTpl').onclick = () => saveFile(ARCH.era === 'futuro' ? 'modello-scheda-equipaggio.md' : ARCH.era === 'romanzo' ? 'modello-scheda-romanzo.md' : 'modello-scheda-personaggio.md', archTemplate(ARCH.era));
  $('avExp').onclick = () => saveFile(`archivio-personaggi-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ schema: 'archivio/1', exported: new Date().toISOString(), chars: ARCH.chars.map((c) => Object.assign({}, c, { versions: undefined })) }, null, 1));
  const d = $('avDrop'); d.ondragover = (e) => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
  d.ondrop = (e) => { e.preventDefault(); d.classList.remove('over'); [...(e.dataTransfer.files || [])].forEach(archImportFile); };
  $('avGrid').addEventListener('click', (e) => { const cw = e.target.closest('[data-crew]'); if (cw) { crewToggle(cw.dataset.crew); archRender(); return; } const nr = e.target.closest('[data-newrole]'); if (nr) { archNewForRole(nr.dataset.newrole); return; } const gr = e.target.closest('[data-genrole]'); if (gr) { archGenerate(gr.dataset.genrole); return; } const card = e.target.closest('[data-id]'); if (card) archEdit(archGet(card.dataset.id)); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && ARCH.open && !$('avEditor')) archClose(); });
}
async function archOpen(era) { await ARCH.ready; archEnsureView(); if (era === 'futuro' || era === 'presente' || era === 'romanzo') { ARCH.era = era; document.querySelectorAll('#archView [data-era]').forEach((x) => { x.classList.toggle('on', x.dataset.era === era); x.setAttribute('aria-checked', x.dataset.era === era ? 'true' : 'false'); }); } ARCH.open = true; $('archView').hidden = false; archMigrateOffer(); archRender(); $('avQ').focus(); }
function archClose() { ARCH.open = false; if ($('archView')) $('archView').hidden = true; archSetupSelects(); if (typeof homeRefresh === 'function' && $('homeView') && !$('homeView').hidden) homeRefresh(); if ($('tsSetup') && !$('tsSetup').hidden) tsFillSetup(); }
window.archOpen = archOpen;
function archMigrateOffer() { // the castaways of saved games become characters of the archive, nothing is lost
  const box = $('avMigrate'); const G = ENG.G || (typeof saved !== 'undefined' ? saved : null);
  const cand = G && G.agents ? G.agents.filter((a) => !a.archId && !archByName(a.name).length && !(typeof ARCH_PACK !== 'undefined' && ARCH_PACK.chars.some((c) => normName(c.name) === normName(a.name) && !archGet(c.id)))) : [];
  if (!cand.length) { box.hidden = true; return; }
  box.hidden = false; box.innerHTML = `Nell'ultima partita ci sono ${cand.length} naufraghi che non sono ancora nell'archivio: ${cand.map((a) => esc(a.name)).join(', ')}. <button id="avMig">Aggiungili all'archivio</button>`;
  $('avMig').onclick = () => { const date = G.startedAt ? new Date(G.startedAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : 'precedente';
    cand.forEach((a) => { const c = archFromAgent(a, `dalla partita ${date} dell'isola`); if (!a.alive && !a.departed) { c.status = 'deceduto'; c.lives = [{ n: 1, death: { env: 'isola', label: `morto sull'isola · giorno ${a.deathDay || '?'}${a.deathCause ? ' · ' + a.deathCause : ''}` } }]; } archSave(c, 'importato da partita'); if (ENG.G === G) { a.archId = c.id; a.sheet = archSheet(c); } });
    if (ENG.G === G) ENG.save(); toastMsg(`👥 ${cand.length} personaggi aggiunti all'archivio.`); archMigrateOffer(); archRender(); };
}
function archRender() {
  if (!$('avGrid')) return; if ($('avPack') && typeof ARCH_PACK !== 'undefined') { const miss = ARCH_PACK.chars.filter((c) => !archGet(c.id)); $('avPack').hidden = !miss.length; $('avPack').textContent = `📦 Personaggi pronti (${miss.length} nuov${miss.length === 1 ? 'o' : 'i'})`; $('avPack').title = 'Aggiunge: ' + miss.map((c) => c.name).join(', '); } const q = normName(ARCH.q);
  const dead = ARCH.chars.filter((c) => c.status === 'deceduto').length; const off = ARCH.chars.filter((c) => c.disabled).length; $('avCount').textContent = `(${ARCH.chars.length - dead} vivi · ${dead} deceduti${off ? ` · ${off} disattivati` : ''})`;
  const inF = (c) => ARCH.filter === 'tutti' || (ARCH.filter === 'disattivati' ? !!c.disabled : !c.disabled && (ARCH.filter === 'deceduti') === (c.status === 'deceduto'));
  const list = ARCH.chars.filter((c) => archEra(c) === ARCH.era && inF(c) && (!q || normName(c.name + ' ' + c.short + ' ' + (c.style || '') + ' ' + (c.tags || []).join(' ')).includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  const dups = new Set(ARCH.chars.map((c) => normName(c.name)).filter((n, i, arr) => arr.indexOf(n) !== i));
  const card = (c) => { const death = c.status === 'deceduto' ? (c.lives || []).slice(-1)[0] : null; const nrel = (c.relations || []).length;
    return ` <button class="charCard ${c.status === 'deceduto' ? 'dead' : ''} ${c.disabled ? 'off' : ''}" data-id="${c.id}" aria-label="${esc(c.name)}, apri la scheda"><span class="ccName">${esc(c.name)}${c.status === 'deceduto' ? ' <span class="ccBadge">✝ Deceduto</span>' : ''}${c.disabled ? ' <span class="ccBadge off">⏸ Disattivato</span>' : ''}</span>
      <span class="ccMeta">${c.sex === 'f' ? 'donna' : 'uomo'} · ${c.age}${c.life > 1 ? ` · ↺ vita #${c.life}` : ''}${dups.has(normName(c.name)) ? ' · <span class="warn">⚠ nome doppio</span>' : ''}</span>
      ${c.style ? `<span class="ccStyle">${esc(c.style)}</span>` : ''}<span class="ccShort">${esc(c.short || 'Nessuna descrizione')}</span>
      <span class="ccChips">${c.temper ? `<span class="chip">⚖ ${esc(c.temper)}</span>` : ''}${(c.secrets || []).length ? `<span class="chip">🔒 ${c.secrets.length}</span>` : ''}${(c.goals || []).length ? `<span class="chip">🎯 ${c.goals.length}</span>` : ''}${nrel ? `<span class="chip">🔗 ${nrel}</span>` : ''}${(c.novels || []).length ? `<span class="chip" title="${esc(c.novels.map((x) => x.title).join(', '))}">📖 ${c.novels.length}</span>` : ''}${(c.sessions || []).filter((s) => /^isola/.test(s)).length ? `<span class="chip">🏝 ${c.sessions.filter((s) => /^isola/.test(s)).length}</span>` : ''}${(c.sessions || []).filter((s) => /^talk/.test(s)).length ? `<span class="chip">📺 ${c.sessions.filter((s) => /^talk/.test(s)).length}</span>` : ''}</span>
      ${death ? `<span class="ccDeath">✝ ${esc(death.death.label)}</span>` : c.origin && c.origin.label ? `<span class="ccOrigin">🌱 ${esc(c.origin.label)}</span>` : ''}</button>`; };
  $('avCrew').hidden = ARCH.era !== 'futuro'; if (ARCH.era === 'futuro') crewRender();
  if (ARCH.era === 'futuro' && ARCH.chars.some((c) => archEra(c) === 'futuro')) { $('avGrid').className = 'avRoles'; $('avGrid').innerHTML = archFutRender(list, card); return; }
  $('avGrid').className = 'avGrid'; $('avGrid').innerHTML = list.map(card).join('') ||
    `<div class="avEmpty">${ARCH.era === 'romanzo' ? 'Qui finiscono i personaggi dei romanzi: quelli che crei per una storia e quelli che nascono scrivendo. Puoi anche crearne uno con «＋ Nuovo personaggio»; nei romanzi puoi usare i personaggi di tutte le sezioni.' : ARCH.era === 'futuro' ? 'Non ci sono ancora schede del futuro. Premi «📦 Personaggi pronti» per caricare l\'equipaggio della Venture, oppure crea una scheda con «＋ Nuovo personaggio».' : ARCH.chars.length ? 'Nessuno corrisponde alla ricerca.' : 'L\'archivio è vuoto. Crea il primo personaggio, carica una scheda da file, oppure avvia una partita: chi nasce sull\'isola entra qui da solo.'}</div>`;
}
function archImportFile(f) {
  f.text().then((text) => {
    const r = archParse(text, f.name); if (r.error) { toastMsg(`⚠ ${f.name}: ${r.error}`); return; }
    if (r.archive) { let n = 0, skip = 0; r.archive.chars.forEach((c) => { const ex = archGet(c.id); if (ex && ex.updated >= c.updated) { skip++; return; } archSave(Object.assign(archBlank(), c), 'import archivio'); n++; }); ARCH.chars.forEach((c) => archResolvePending(c)); toastMsg(`👥 Archivio importato: ${n} personaggi${skip ? `, ${skip} già presenti (saltati)` : ''}.`); archRender(); return; }
    const c = r.char; const dup = archByName(c.name).length;
    archResolvePending(c); archEdit(c, true, `Importato da ${f.name}: ${r.map ? r.map.filter((m) => m.key !== 'altro').length + ' sezioni riconosciute' + (r.map.some((m) => m.key === 'altro') ? ', ' + r.map.filter((m) => m.key === 'altro').length + ' finite in «Altro» (conservate, non usate)' : '') : 'scheda JSON'}.${dup ? ' ⚠ C\'è già un personaggio con questo nome: puoi tenerli entrambi, ma in una stessa partita i nomi devono essere diversi.' : ''} Controlla e salva.`);
  }).catch((e) => toastMsg(`⚠ Non riesco a importare ${f.name}: ${e && e.message ? e.message : e}`));
}

/* ---------- the editor ---------- */
function archEdit(c, isNew, note) {
  if (!c) return; const w = JSON.parse(JSON.stringify(c)); w.sections = w.sections || {};
  const others = ARCH.chars.filter((o) => o.id !== w.id).sort((a, b) => a.name.localeCompare(b.name));
  const relRow = (r) => `<div class="relRow"><select class="rTo" aria-label="Con chi">${others.map((o) => `<option value="${o.id}"${r.to === o.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select>
    <input class="rType" list="relTypes" value="${esc(r.type || '')}" placeholder="tipo (es. ex partner)" aria-label="Tipo di rapporto"><select class="rInt" aria-label="Intensità">${[-3, -2, -1, 0, 1, 2, 3].map((n) => `<option value="${n}"${(r.int || 0) === n ? ' selected' : ''}>${n > 0 ? '+' + n : n} ${['ostile', 'freddo', 'teso', 'neutro', 'cordiale', 'affettuoso', 'legatissimi'][n + 3]}</option>`).join('')}</select>
    <input class="rView" value="${esc(r.view || '')}" placeholder="cosa pensa di lui/lei" aria-label="Cosa pensa"><button class="rDel" aria-label="Togli rapporto">✕</button></div>`;
  const ed = document.createElement('div'); ed.id = 'avEditor'; ed.setAttribute('role', 'dialog'); ed.setAttribute('aria-modal', 'true'); ed.setAttribute('aria-label', 'Scheda di ' + (w.name || 'nuovo personaggio'));
  const death = w.status === 'deceduto' ? (w.lives || []).slice(-1)[0] : null;
  ed.innerHTML = `<div class="aeBox"><div class="aeHead"><h3>${isNew ? 'Nuovo personaggio' : esc(w.name)} ${w.version > 1 ? `<small>v${w.version}</small>` : ''}</h3><button class="aeX btn-icon" aria-label="Chiudi senza salvare">✕</button></div>
  ${note ? `<div class="avNote">${esc(note)}</div>` : ''}${death ? `<div class="avNote dead">✝ ${esc(death.death.label)}. Resta nell'archivio; in una nuova partita può tornare solo come «nuova vita», senza ricordi.</div>` : ''}${w.origin && w.origin.label ? `<div class="aeOrigin">🌱 ${esc(w.origin.label)}</div>` : ''}
  <div class="aeGrid"><label>Nome*<input id="aeName" value="${esc(w.name)}" maxlength="40" required></label><label>Sesso<select id="aeSex"><option value="m"${w.sex === 'm' ? ' selected' : ''}>Uomo</option><option value="f"${w.sex === 'f' ? ' selected' : ''}>Donna</option></select></label>
   <label>Età*<input id="aeAge" type="number" min="3" max="999" value="${w.age}"></label><label>Temperamento<select id="aeTemp">${TEMPERS.map(([v, l]) => `<option value="${v}"${w.temper === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
  <div class="aeGrid"><label>Epoca<select id="aeEra"><option value="presente"${archEra(w) === 'presente' ? ' selected' : ''}>🏝 Presente</option><option value="futuro"${archEra(w) === 'futuro' ? ' selected' : ''}>🚀 Futuro</option><option value="romanzo"${archEra(w) === 'romanzo' ? ' selected' : ''}>📖 Romanzo</option></select></label>
   <label class="aeFut">Ruolo preferito<select id="aeRole"><option value="">—</option>${ROLES.map(([k, , l]) => `<option value="${k}"${archRoleKey(w.role) === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
   <label class="aeFut" style="grid-column:span 2">Stile<input id="aeStyle" maxlength="80" value="${esc(w.style || '')}" placeholder="es. il diplomatico intellettuale"></label></div>
  <label class="aeOff" style="flex-direction:row;align-items:center;gap:6px;font-weight:400"><input type="checkbox" id="aeDisabled" ${w.disabled ? 'checked' : ''}> ⏸ Disattivato: resta nell'archivio ma non compare nelle scelte degli ambienti</label>
  <label>In breve (si vede sulla scheda e basta per un personaggio semplice)<textarea id="aeShort" rows="2" maxlength="400">${esc(w.short || '')}</textarea></label>
  <div class="aeFileRow"><label class="btnlike">⇪ Riempi da file<input id="aeFile" type="file" accept=".md,.txt,.json" hidden></label><span class="legend">Le sezioni trovate nel file sostituiscono quelle qui sotto.</span></div>
  ${SECTIONS.map(([k, t, hint]) => `<details class="aeSec" ${w.sections[k] ? 'open' : ''}><summary>${t} <small>${(w.sections[k] || '').length ? (w.sections[k] || '').length + ' caratteri' : 'vuota'}</small></summary><textarea data-k="${k}" rows="4" placeholder="${esc(hint)}">${esc(w.sections[k] || '')}</textarea></details>`).join('')}
  <details class="aeSec" ${(w.secrets || []).length ? 'open' : ''}><summary>🔒 Segreti <small>solo lui li conosce · uno per riga</small></summary><textarea id="aeSecrets" rows="3">${esc((w.secrets || []).join('\n'))}</textarea></details>
  <details class="aeSec" ${(w.goals || []).length ? 'open' : ''}><summary>🎯 Obiettivi nascosti <small>uno per riga</small></summary><textarea id="aeGoals" rows="3">${esc((w.goals || []).join('\n'))}</textarea></details>
  <details class="aeSec" open><summary>🔗 Rapporti di partenza <small>con altri personaggi dell'archivio</small></summary><div id="aeRels">${(w.relations || []).map(relRow).join('')}</div>
   ${others.length ? '<button id="aeAddRel">＋ Aggiungi rapporto</button> <label class="legend"><input type="checkbox" id="aeSym" checked> vale per entrambi (scrive il rapporto anche sull\'altro)</label>' : '<p class="legend">Crea altri personaggi per collegarli.</p>'}${(w.pendingRelations || []).length ? `<p class="legend">Dal file, in attesa che esistano: ${w.pendingRelations.map((r) => esc(r.name) + ' (' + esc(r.type) + ')').join(', ')}</p>` : ''}</details>
  ${w.sections.altro ? `<details class="aeSec"><summary>Altro <small>dal file, conservato ma non usato nei prompt</small></summary><textarea data-k="altro" rows="3">${esc(w.sections.altro)}</textarea></details>` : ''}
  ${(w.versions || []).length ? `<details class="aeSec"><summary>Versioni <small>${w.versions.length}</small></summary>${w.versions.slice().reverse().map((v, i) => `<div class="legend">v${v.v} · ${new Date(v.at).toLocaleString('it-IT')} · ${esc(v.why || '')} <button data-restore="${w.versions.length - 1 - i}">Ripristina</button></div>`).join('')}</details>` : ''}
  <div class="aeErr" id="aeErr" role="alert"></div>
  <div class="aeFoot">${isNew ? '' : '<button id="aeDel" class="danger">Elimina…</button>'}<button id="aeMd" title="Scarica la scheda in .md">⇩ .md</button><span style="flex:1"></span><button class="aeX">Annulla</button><button id="aeSave" class="primary">Salva</button></div></div>`;
  document.body.appendChild(ed); const q = (s) => ed.querySelector(s);
  const close = () => { ed.remove(); };
  const eraVis = () => ed.querySelectorAll('.aeFut').forEach((x) => { x.hidden = q('#aeEra').value !== 'futuro'; }); eraVis(); q('#aeEra').onchange = eraVis;
  ed.querySelectorAll('.aeX').forEach((b) => { b.onclick = close; }); ed.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  if (q('#aeAddRel')) q('#aeAddRel').onclick = () => { q('#aeRels').insertAdjacentHTML('beforeend', relRow({ to: others[0].id, type: '', int: 0 })); };
  q('#aeRels').addEventListener('click', (e) => { if (e.target.classList.contains('rDel')) e.target.closest('.relRow').remove(); });
  q('#aeFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { const r = archParse(t, f.name); if (r.error || !r.char) { q('#aeErr').textContent = r.error || 'File non valido.'; return; } const n = r.char;
    Object.entries(n.sections).forEach(([k, v]) => { const ta = ed.querySelector(`textarea[data-k="${k}"]`); if (ta) { ta.value = v; ta.closest('details').open = true; } });
    if (n.secrets.length) q('#aeSecrets').value = n.secrets.join('\n'); if (n.goals.length) q('#aeGoals').value = n.goals.join('\n'); if (!q('#aeShort').value && n.short) q('#aeShort').value = n.short; if (!q('#aeName').value) q('#aeName').value = n.name; w.pendingRelations = n.pendingRelations; }); };
  q('#aeMd').onclick = () => { collect(); saveFile(`${normName(w.name).replace(/[^a-z0-9]+/g, '-') || 'personaggio'}.md`, archToMarkdown(w, true)); };
  ed.querySelectorAll('[data-restore]').forEach((b) => { b.onclick = () => { const v = w.versions[+b.dataset.restore]; archSave(Object.assign({}, v.data, { id: w.id, versions: w.versions }), `ripristino v${v.v}`); close(); toastMsg(`↺ Ripristinata la versione ${v.v} di ${w.name}.`); }; });
  if (q('#aeDel')) q('#aeDel').onclick = () => { const b = q('#aeDel'); if (b.dataset.sure) { const nrel = ARCH.chars.filter((o) => (o.relations || []).some((r) => r.to === w.id)); nrel.forEach((o) => { o.relations = o.relations.filter((r) => r.to !== w.id); archSave(o, 'rapporto rimosso'); }); ARCH.chars = ARCH.chars.filter((x) => x.id !== w.id); archDeleteStore(w.id); close(); archRender(); toastMsg(`🗑 ${w.name} eliminato dall'archivio. Le partite e le uscite già fatte restano invariate.`); return; }
    b.dataset.sure = '1'; b.textContent = `Sicuro? Si perdono ${(w.versions || []).length + 1} versioni e ${(w.relations || []).length} rapporti. Clicca di nuovo per eliminare`; };
  function collect() {
    w.name = q('#aeName').value.trim().replace(/[<>]/g, ''); w.sex = q('#aeSex').value; w.age = Math.max(3, Math.min(q('#aeEra').value === 'romanzo' ? 999 : 95, parseInt(q('#aeAge').value, 10) || 35)); /* novel characters can be aliens or robots of any age */ w.temper = q('#aeTemp').value; w.short = q('#aeShort').value.trim(); w.disabled = q('#aeDisabled').checked; w.era = q('#aeEra').value; if (w.era === 'futuro') { w.role = q('#aeRole').value; w.style = q('#aeStyle').value.trim().replace(/[<>]/g, ''); } else { delete w.role; delete w.style; }
    ed.querySelectorAll('textarea[data-k]').forEach((t) => { const v = t.value.trim(); if (v) w.sections[t.dataset.k] = v; else delete w.sections[t.dataset.k]; });
    w.secrets = q('#aeSecrets').value.split('\n').map((x) => x.trim()).filter(Boolean); w.goals = q('#aeGoals').value.split('\n').map((x) => x.trim()).filter(Boolean);
    w.relations = [...ed.querySelectorAll('.relRow')].map((r) => ({ to: r.querySelector('.rTo').value, type: r.querySelector('.rType').value.trim() || 'conoscenti', int: +r.querySelector('.rInt').value, view: r.querySelector('.rView').value.trim() })).filter((r) => r.to && r.to !== w.id);
  }
  q('#aeSave').onclick = () => { collect();
    if (!w.name) { q('#aeErr').textContent = 'Il nome è obbligatorio.'; q('#aeName').focus(); return; }
    const sym = q('#aeSym') && q('#aeSym').checked; const before = c.relations || [];
    archSave(w, isNew ? 'creazione' : 'modifica manuale');
    if (sym) w.relations.forEach((r) => { const o = archGet(r.to); if (!o) return; const back = (o.relations || []).find((x) => x.to === w.id); if (!back) { o.relations = (o.relations || []).concat([{ to: w.id, type: r.type, int: r.int, view: '' }]); archSave(o, `rapporto con ${w.name}`); } else if (!before.some((x) => x.to === r.to) && back.type !== r.type) { toastMsg(`⚠ Incoerenza: per ${o.name} il rapporto con ${w.name} è «${back.type}», per ${w.name} è «${r.type}».`); } });
    ARCH.chars.forEach((o) => { if ((o.pendingRelations || []).length) { archResolvePending(o); archSave(o, 'rapporti dal file'); } });
    close(); archRender(); archSetupSelects(); toastMsg(`💾 ${w.name} salvato nell'archivio.`); };
  q('#aeName').focus();
}
window.__ARCH = ARCH;

/* in-game "new castaway": from the archive, new, or from a file; whoever is born here goes into the archive */
function archNpSync() { const s = $('npArch'); if (s) { const v = s.value; s.innerHTML = archOptions(v).replace(/<optgroup label="Deceduti[^"]*">[\s\S]*?<\/optgroup>/, (m) => m); s.value = v; } }
document.addEventListener('change', (e) => {
  if (e.target.id === 'npArch') { const c = archGet(e.target.value); if (!c) return; $('npName').value = c.name; $('npSex').value = c.sex; $('npAge').value = c.age; $('npPers').value = c.short || ''; if ($('npTemp')) $('npTemp').value = TEMPERS.some(([v]) => v === c.temper) ? c.temper : ''; }
  if (e.target.id === 'npFile') { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { const r = archParse(t, f.name); if (r.error || !r.char) { toastMsg('⚠ ' + (r.error || 'File non valido')); return; } const c = r.char; c.origin = { env: 'isola', label: `nato sull'isola · ${today()} (da ${f.name})` }; archResolvePending(c); archSave(c, 'da file'); archNpSync(); $('npArch').value = c.id; $('npArch').dispatchEvent(new Event('change', { bubbles: true })); toastMsg(`👥 ${c.name} caricato da file e salvato nell'archivio: premi «Fai arrivare».`); }); e.target.value = ''; }
});
function archAfterAdd(a, id) { if (!a) return; const G = ENG.G; const c = archGet(id);
  if (c) { if (c.status === 'deceduto') { c.status = 'vivo'; c.life = (c.life || 1) + 1; archSave(c, `nuova vita #${c.life}`); } a.archId = c.id; a.sheet = archSheet(c); }
  else { const date = G && G.startedAt ? new Date(G.startedAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : today(); const n = archSave(archFromAgent(a, `nato sull'isola · partita del ${date}, giorno ${G ? G.day : '?'}`), 'nascita'); a.archId = n.id; a.sheet = archSheet(n); toastMsg(`🌱 ${a.name} è nato sull'isola ed è stato aggiunto all'archivio.`); }
  ENG.save(); if ($('npArch')) $('npArch').value = ''; }
ARCH.ready.then(archNpSync); setInterval(() => { if (ENG.G && $('npArch') && document.activeElement !== $('npArch')) archNpSync(); }, 5000);
window.__archApi = { archParse, archSave, archResolvePending, archBlank };
window.archEdit = archEdit; window.archBlank = archBlank;
window.__packChars = (typeof ARCH_PACK !== 'undefined') ? ARCH_PACK.chars : [];
