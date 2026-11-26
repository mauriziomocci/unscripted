/* ===== Archive by era and role: the future crew of the starship Venture =====
   Characters carry an era ('presente' default, 'futuro') and, in the future, a preferred role and a style.
   This module adds: the ready-made crew pack, the role grouping of the Future tab, creation and AI generation
   of a sheet for a given role, and the random crew draw used later by the mission setup. */

/** Stations of the bridge: [key, group label, singular label, icon]. Order = display order. */
const ROLES = [
  ['capitano', 'Capitani', 'Capitano', '⭐'],
  ['primo ufficiale', 'Primi ufficiali', 'Primo ufficiale', '◆'],
  ['timoniere', 'Timonieri', 'Timoniere', '🧭'],
  ['ufficiale tattico', 'Tattici', 'Ufficiale tattico', '🛡'],
  ['ufficiale scientifico', 'Scienza', 'Ufficiale scientifico', '🔭'],
  ['capo ingegnere', 'Ingegneri', 'Capo ingegnere', '🔧'],
  ['medico di bordo', 'Medici', 'Medico di bordo', '⚕'],
  ['ufficiale alle comunicazioni', 'Comunicazioni', 'Ufficiale alle comunicazioni', '📡'],
];
/** Crew size limits, captain included: below 3 there is no bridge dynamic, above 7 the cost per turn grows too much. */
const CREW_MIN = 3, CREW_MAX = 7;
const CREW_KEY = 'venture-crew';

/** Normalises a free-text role ("Prima ufficiale", "pilota") to one of the ROLES keys, or '' if unknown. */
function archRoleKey(v) {
  const s = normName(v); if (!s) return '';
  const map = [[/capitan/, 'capitano'], [/^(primo|prima)|vice|comandante in seconda/, 'primo ufficiale'], [/timon|pilot/, 'timoniere'], [/tattic|sicurezz/, 'ufficiale tattico'],
    [/scien/, 'ufficiale scientifico'], [/ingegn|macchin/, 'capo ingegnere'], [/medic|dottor|infermer/, 'medico di bordo'], [/comunicaz|lingu|segnal/, 'ufficiale alle comunicazioni']];
  const m = map.find(([r]) => r.test(s)); return m ? m[1] : '';
}
/** Archive sections: present (island, talk show), future (Venture) and the novel; any other value reads as present. */
const archEra = (c) => (c && (c.era === 'futuro' || c.era === 'romanzo') ? c.era : 'presente');
const roleOf = (k) => ROLES.find((r) => r[0] === k);

/* ---------- ready-made crew: parsed once from the embedded Markdown, offered through the existing pack button ---------- */
const ARCH_PACK_FUT = (typeof FUT_PACK_MD === 'undefined' ? [] : FUT_PACK_MD).map(([id, md]) => {
  const r = archParse(md, id + '.md'); const c = r.char; if (!c) return null;
  c.id = id; c.updated = '2026-11-16T12:00:00.000Z'; c.origin = { env: 'venture', label: 'equipaggio della Venture · schede pronte' };
  return c;
}).filter(Boolean);
if (typeof ARCH_PACK !== 'undefined') ARCH_PACK.chars.push(...ARCH_PACK_FUT);
/** The ready-made crew is loaded once by itself, so the Future tab and the Venture are never empty on first use.
    A flag remembers it: if the user later deletes the sheets, they are not forced back in. */
const FUT_AUTO_KEY = 'venture-pack-auto';
function archFutAutoLoad() {
  let done = false; try { done = localStorage.getItem(FUT_AUTO_KEY) === '1'; } catch (e) { /* no storage: load every time it is empty */ }
  if (done || !ARCH_PACK_FUT.length || ARCH.chars.some((c) => archEra(c) === 'futuro')) return 0;
  let n = 0; ARCH_PACK_FUT.forEach((c) => { if (archGet(c.id)) return; archSave(Object.assign(archBlank(), JSON.parse(JSON.stringify(c))), 'equipaggio pronto'); n++; });
  ARCH.chars.forEach((o) => { if ((o.pendingRelations || []).length) { const k = o.pendingRelations.length; archResolvePending(o); if (o.pendingRelations.length !== k) archSave(o, 'rapporti dal pacchetto'); } });
  try { localStorage.setItem(FUT_AUTO_KEY, '1'); } catch (e) { /* see above */ }
  return n;
}
ARCH.ready.then(() => { const n = archFutAutoLoad(); if (n && typeof homeRefresh === 'function' && $('homeView') && !$('homeView').hidden) homeRefresh(); if (n && ARCH.open) archRender(); });

/* ---------- Future tab: one group per role, each with «+ Nuovo» and «✨ Genera» ---------- */
function archFutRender(list, cardHtml) {
  const groups = ROLES.map(([k, label, , icon]) => {
    const items = list.filter((c) => archRoleKey(c.role) === k);
    return `<section class="avRole" data-role="${k}"><div class="avRoleHead"><h3>${icon} ${label} <small>${items.length}</small></h3>
      <span><button data-newrole="${k}" title="Nuova scheda di questo ruolo, da scrivere a mano">＋ Nuovo</button> <button data-genrole="${k}" title="Claude scrive una scheda completa per questo ruolo, che rivedi prima di salvare">✨ Genera</button></span></div>
      <div class="avGrid">${items.map((c) => crewCardHtml(c, cardHtml)).join('') || '<div class="avEmpty">Nessuna scheda per questo ruolo.</div>'}</div></section>`;
  });
  const loose = list.filter((c) => !archRoleKey(c.role));
  if (loose.length) groups.push(`<section class="avRole"><div class="avRoleHead"><h3>❔ Senza ruolo <small>${loose.length}</small></h3></div><div class="avGrid">${loose.map(cardHtml).join('')}</div></section>`);
  return groups.join('');
}
function archNewForRole(k) {
  archEdit(archBlank({ era: 'futuro', role: k, origin: { env: 'venture', label: `creato nell'archivio · ${today()}` } }), true);
}

/* ---------- AI generation of a sheet for a role: the result is parsed like a file and reviewed before saving ---------- */
const GEN_TONES = [['serio', 'Serio'], ['comico', 'Comico (equipaggio di disadattati)']];
function archGenPrompt(o) {
  const r = roleOf(o.role); const names = ARCH.chars.filter((c) => archEra(c) === 'futuro' && c.status !== 'deceduto').map((c) => `${c.name} (${archRoleKey(c.role) || 'senza ruolo'})`);
  return `SCHEDA DI EQUIPAGGIO DA GENERARE. Scrivi la scheda di un personaggio originale per un gioco di fantascienza: l'equipaggio della nave stellare Venture, della Flotta del Patto, in un futuro lontano con curvatura, teletrasporto, navette e infermerie avanzate.
RUOLO: ${r ? r[2].toLowerCase() : o.role}
STILE: ${o.style || 'scegli tu un tipo di ufficiale diverso da quelli già presenti'}
${o.trait ? `TRATTO DA INCLUDERE: ${o.trait}\n` : ''}SESSO: ${o.sex === 'f' ? 'donna' : o.sex === 'm' ? 'uomo' : 'scegli tu'}
TONO: ${o.tone === 'comico' ? 'comico: un disadattato simpatico, ma competente quando serve' : 'serio e drammatico'}
PERSONAGGI GIÀ A BORDO (non duplicarli; puoi citarne al massimo 3 nella sezione Rapporti): ${names.join(', ') || 'nessuno'}
REGOLE:
- Personaggio originale: niente nomi, frasi celebri, specie, navi, organizzazioni o biografie riconoscibili di serie o film esistenti. Luoghi inventati ammessi: Kestra (colonia dei logici), Haldor (colonia di tradizione guerriera), o altri inventati da te.
- Niente persone reali.
- Scrivi in italiano, frasi chiare.
- La scheda deve seguire ESATTAMENTE questo formato Markdown:
# Nome Cognome
Età: <numero>
Sesso: uomo | donna
Temperamento: calmo | conciliante | timido | ironico | permaloso | polemico | irascibile | dominante
Epoca: futuro
Ruolo preferito: ${r ? r[2].toLowerCase() : o.role}
Stile: <tre-sei parole>
In breve: <una frase>

## Identità e aspetto
## Storia di vita
## Carattere
## Valori, convinzioni, fissazioni
(4 punti elenco)
## Paure e punti deboli
## Modo di parlare
## Come tratta gli altri
## Segreti
(2 punti elenco)
## Obiettivi
(2 punti elenco)
## Rapporti
- Nome di un personaggio già a bordo: colleghi | amici | rivali | conoscenti, intensità da -3 a 3, "cosa pensa di lui o di lei"

Rispondi SOLO con JSON: {"scheda": "<tutta la scheda in Markdown>"}`;
}
async function archGenCall(prompt) {
  const s = window.claude && window.claude.use ? await window.claude.use('sample') : null;
  if (!s) throw new Error('Claude non disponibile: apri la pagina da claude.ai.');
  const opts = { model: 'claude-sonnet-5-5', modelTier: 'default', effort: 'low', cache: false };
  for (let attempt = 0; ; attempt++) {
    try { return await s.json(prompt, opts); }
    catch (e) { if (e && e.code === 'rate_limited' && attempt < 3) { await new Promise((r) => setTimeout(r, 15000 * 2 ** attempt)); continue; } throw e; }
  }
}
/** Validates the model output as untrusted data: a string sheet, bounded length, parsed by the same parser as files. */
function archGenParse(out, role) {
  const md = out && typeof out.scheda === 'string' ? out.scheda : '';
  if (md.length < 200 || md.length > 20000) return { error: 'La scheda generata non è valida, riprova.' };
  const r = archParse(md, 'generata.md'); if (r.error || !r.char || !r.char.name || r.char.name === 'generata') return { error: 'La scheda generata non ha un nome, riprova.' };
  const c = r.char; c.era = 'futuro'; c.role = role; c.name = c.name.replace(/[<>]/g, '').slice(0, 40);
  c.origin = { env: 'venture', label: `generato con Claude · ${today()}` }; return { char: c };
}
function archGenerate(role) {
  if ($('avGen')) return;
  const styles = [...new Set(ARCH.chars.filter((c) => archRoleKey(c.role) === role && c.style).map((c) => c.style))];
  const d = document.createElement('div'); d.id = 'avGen'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Genera una scheda');
  d.innerHTML = `<div class="aeBox"><div class="aeHead"><h3>✨ Genera una scheda</h3><button class="aeX btn-icon" aria-label="Chiudi">✕</button></div>
   <p class="legend">Claude scrive una scheda completa nel formato dell'archivio. La rivedi e la salvi tu. Costa una chiamata.</p>
   <div class="aeGrid"><label>Ruolo<select id="gRole">${ROLES.map(([k, , s]) => `<option value="${k}"${k === role ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
    <label>Sesso<select id="gSex"><option value="">A caso</option><option value="m">Uomo</option><option value="f">Donna</option></select></label>
    <label>Tono<select id="gTone">${GEN_TONES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label></div>
   <label>Stile (il tipo di ufficiale)<input id="gStyle" maxlength="80" placeholder="es. il veterano disilluso" list="gStyles"></label><datalist id="gStyles">${styles.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
   <p class="legend">${styles.length ? 'Già presenti per questo ruolo: ' + styles.map(esc).join(' · ') : ''}</p>
   <label>Un tratto da includere (facoltativo)<input id="gTrait" maxlength="160" placeholder="es. colleziona orologi antichi e odia il teletrasporto"></label>
   <div class="aeErr" id="gErr" role="alert"></div>
   <div class="aeFoot"><span id="gWait" class="legend" aria-live="polite"></span><span style="flex:1"></span><button class="aeX">Annulla</button><button id="gGo" class="primary">✨ Genera</button></div></div>`;
  document.body.appendChild(d); const q = (s) => d.querySelector(s); const close = () => d.remove();
  d.querySelectorAll('.aeX').forEach((b) => { b.onclick = close; }); d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  q('#gStyle').focus();
  q('#gGo').onclick = async () => {
    const o = { role: q('#gRole').value, sex: q('#gSex').value, tone: q('#gTone').value, style: q('#gStyle').value.trim(), trait: q('#gTrait').value.trim() };
    q('#gGo').disabled = true; q('#gErr').textContent = ''; q('#gWait').textContent = '✍ Claude sta scrivendo la scheda…';
    try {
      const r = archGenParse(await archGenCall(archGenPrompt(o)), o.role);
      if (r.error) { q('#gErr').textContent = r.error; return; }
      close(); archResolvePending(r.char); archEdit(r.char, true, 'Scheda generata da Claude: controlla, correggi e salva.');
    } catch (e) { q('#gErr').textContent = '⚠ ' + (e && e.message ? e.message : 'Errore nella chiamata a Claude.'); }
    finally { if (q('#gGo')) { q('#gGo').disabled = false; q('#gWait').textContent = ''; } }
  };
}

/* ---------- picking the crew by hand: one toggle under each card of the Future tab ---------- */
function crewCardHtml(c, cardHtml) {
  const on = crewLoad().slots.some((s) => s.id === c.id); const usable = c.status !== 'deceduto' && !c.disabled && archRoleKey(c.role);
  return `<div class="ccWrap">${cardHtml(c)}${usable ? `<button class="ccCrew${on ? ' on' : ''}" data-crew="${c.id}" aria-pressed="${on ? 'true' : 'false'}">${on ? '✓ A bordo · togli' : '＋ A bordo'}</button>` : ''}</div>`;
}
/** Adds or removes a character; one person per role (a new pick replaces the old one), at most CREW_MAX. Hand picks are locked. */
function crewToggle(id) {
  const c = archGet(id); const k = c && archRoleKey(c.role); if (!k) return;
  const cr = crewLoad(); const i = cr.slots.findIndex((s) => s.id === id);
  if (i >= 0) { cr.slots.splice(i, 1); crewSave(cr); toastMsg(`${c.name} scende dalla Venture.`); return; }
  const j = cr.slots.findIndex((s) => s.role === k);
  if (j >= 0) { const old = archGet(cr.slots[j].id); cr.slots[j] = { role: k, id, locked: true }; crewSave(cr); toastMsg(`🚀 ${c.name} prende il posto di ${old ? old.name : 'chi c\'era'} come ${roleOf(k)[2].toLowerCase()}.`); return; }
  if (cr.slots.length >= CREW_MAX) { toastMsg(`L'equipaggio è al completo (${CREW_MAX} persone): togli qualcuno prima.`); return; }
  cr.slots.push({ role: k, id, locked: true }); cr.slots.sort((a, b) => ROLES.findIndex((r) => r[0] === a.role) - ROLES.findIndex((r) => r[0] === b.role));
  crewSave(cr); toastMsg(`🚀 ${c.name} sale a bordo come ${roleOf(k)[2].toLowerCase()}.`);
}

/* ---------- random crew: a captain plus 2-6 officers, one per role, with locks; saved for the mission setup ---------- */
function crewLoad() { try { const j = JSON.parse(localStorage.getItem(CREW_KEY) || 'null'); return j && Array.isArray(j.slots) ? j : { slots: [], size: 0 }; } catch (e) { return { slots: [], size: 0 }; } }
function crewSave(cr) { try { localStorage.setItem(CREW_KEY, JSON.stringify(cr)); } catch (e) { /* storage full: the crew is only a convenience, the game still works */ } }
const crewPool = (k) => ARCH.chars.filter((c) => archEra(c) === 'futuro' && c.status !== 'deceduto' && !c.disabled && archRoleKey(c.role) === k);
const pickOne = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
/**
 * Draws a crew keeping the locked slots. size = total people (CREW_MIN..CREW_MAX) or 0 for a random size.
 * Pure apart from reading ARCH.chars; rnd is injectable for tests.
 */
function crewDraw(prev, size, rnd = Math.random) {
  const valid = (s) => { const c = archGet(s.id); return c && c.status !== 'deceduto' && !c.disabled && archRoleKey(c.role) === s.role; };
  const keep = (prev.slots || []).filter((s) => s.locked && valid(s));
  const used = new Set(keep.map((s) => s.role)); const taken = new Set(keep.map((s) => s.id));
  const avail = ROLES.map(([k]) => k).filter((k) => crewPool(k).some((c) => !taken.has(c.id)));
  const want = size ? Math.max(CREW_MIN, Math.min(CREW_MAX, size)) : CREW_MIN + Math.floor(rnd() * (CREW_MAX - CREW_MIN + 1));
  const slots = keep.slice();
  const add = (k) => { const c = pickOne(crewPool(k).filter((x) => !taken.has(x.id)), rnd); if (c) { slots.push({ role: k, id: c.id, locked: false }); used.add(k); taken.add(c.id); } };
  if (!used.has('capitano') && avail.includes('capitano')) add('capitano');
  const others = avail.filter((k) => !used.has(k));
  while (slots.length < want && others.length) { const k = others.splice(Math.floor(rnd() * others.length), 1)[0]; add(k); }
  slots.sort((a, b) => ROLES.findIndex((r) => r[0] === a.role) - ROLES.findIndex((r) => r[0] === b.role));
  return { slots, size: size || 0 };
}
function crewReroll(cr, i, rnd = Math.random) {
  const s = cr.slots[i]; if (!s) return cr; const taken = new Set(cr.slots.map((x) => x.id));
  const c = pickOne(crewPool(s.role).filter((x) => !taken.has(x.id)), rnd); if (c) s.id = c.id; return cr;
}
function crewRender() {
  const box = $('avCrew'); if (!box) return; const cr = crewLoad(); const n = cr.slots.length;
  const missingCaptain = n && !cr.slots.some((s) => s.role === 'capitano');
  box.innerHTML = `<div class="crewHead"><b>🚀 Equipaggio della Venture</b> <span class="legend">${n}/${CREW_MAX} a bordo · capitano obbligatorio, da ${CREW_MIN} a ${CREW_MAX} persone, una per ruolo</span></div>
   <p class="legend crewHow">Scegli tu: premi <b>«＋ A bordo»</b> sotto le schede qui sotto. Oppure estrai a caso: chi hai scelto o bloccato con 🔒 resta, gli altri posti si riempiono.${n && n < CREW_MIN ? ` <b>Servono almeno ${CREW_MIN} persone.</b>` : ''}</p>
   <div class="crewBar"><label>Persone <select id="crSize"><option value="0"${!cr.size ? ' selected' : ''}>a caso</option>${[3, 4, 5, 6, 7].map((k) => `<option value="${k}"${cr.size === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
    ${n >= CREW_MIN && cr.slots.some((s) => s.role === 'capitano') ? '<button id="crGo" class="primary">🚀 Prepara la missione</button>' : ''}<button id="crDraw" class="primary">${n ? '🎲 Completa o rimescola a caso' : '🎲 Equipaggio a caso'}</button>${n ? '<button id="crClear">Svuota</button>' : ''}</div>
   ${n ? `<ol class="crewList">${cr.slots.map((s, i) => { const c = archGet(s.id); const r = roleOf(s.role); if (!c || !r) return ''; return `<li class="${s.locked ? 'locked' : ''}"><span class="crRole">${r[3]} ${r[2]}</span><button class="linklike" data-open="${c.id}">${esc(c.name)}</button><span class="crStyle">${esc(c.style || '')}</span>
      <span class="crAct"><button data-drop="${i}" title="Togli dall'equipaggio">✕</button><button data-lock="${i}" aria-pressed="${s.locked ? 'true' : 'false'}" title="${s.locked ? 'Bloccato: resta se rimescoli' : 'Blocca: resta se rimescoli'}">${s.locked ? '🔒' : '🔓'}</button><button data-swap="${i}" title="Un altro ${esc(r[2].toLowerCase())}">↻</button></span></li>`; }).join('')}</ol>
     <p class="legend">${missingCaptain ? '⚠ Manca il capitano. ' : ''}Postazioni al personale di supporto: ${ROLES.filter(([k]) => !cr.slots.some((s) => s.role === k)).map(([, , s]) => s.toLowerCase()).join(', ') || 'nessuna'}. L'equipaggio resta salvato per la preparazione della missione.</p>` : ''}`;
}
function crewWire() {
  const box = $('avCrew'); if (!box || box.dataset.wired) return; box.dataset.wired = '1';
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; let cr = crewLoad();
    if (b.id === 'crGo') { archClose(); vOpenSetup(); return; }
    if (b.id === 'crDraw') { const size = +$('crSize').value; cr = crewDraw(cr, size); if (!cr.slots.length) toastMsg('Nessuna scheda del futuro: aggiungi le schede pronte o creane una.'); }
    else if (b.id === 'crClear') cr = { slots: [], size: cr.size };
    else if (b.dataset.lock) cr.slots[+b.dataset.lock].locked = !cr.slots[+b.dataset.lock].locked;
    else if (b.dataset.swap) cr = crewReroll(cr, +b.dataset.swap);
    else if (b.dataset.drop) cr.slots.splice(+b.dataset.drop, 1);
    else if (b.dataset.open) { archEdit(archGet(b.dataset.open)); return; }
    else return;
    crewSave(cr); archRender();
  });
  box.addEventListener('change', (e) => { if (e.target.id === 'crSize') { const cr = crewLoad(); cr.size = +e.target.value; crewSave(cr); } });
}
window.__archFut = { crewToggle, crewLoad, archRoleKey, crewDraw, crewReroll, archGenParse, ROLES, ARCH_PACK_FUT, ARCH, archParse, archToMarkdown, archOptions, archEdit, archBlank, get packLen() { return typeof ARCH_PACK === 'undefined' ? 0 : ARCH_PACK.chars.length; } };
