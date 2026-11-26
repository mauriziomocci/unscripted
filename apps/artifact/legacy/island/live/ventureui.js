/* ===== Venture: mission setup and bridge screens =====
   Rendering and input only: every rule lives in venture.js (VENTURE), every call goes through llm.js (LLM).
   Layout and microcopy follow ux-ponte.md (17/11/2026). Model text always enters the DOM through esc() or textContent. */
const V_SAVE = 'venture-game', V_PREFS = 'venture-prefs', V_CUSTOM = 'venture-missions-custom';
/** Typical seconds per turn by rhythm, shown while waiting (spec, section 14). */
const V_TYPICAL = { crociera: [5, 15], allerta: [30, 60], battaglia: [20, 40] };
const V_TYPE = { scontro: ['⚔', 'Scontro'], soccorso: ['🆘', 'Soccorso'], diplomazia: ['🕊', 'Diplomazia'], mistero: ['🔭', 'Mistero'], contatto: ['🤝', 'Contatto'], sopravvivenza: ['⛔', 'Sopravvivenza'] };
const V_RHYTHM = { crociera: ['🛰', 'CROCIERA'], allerta: ['⚠', 'ALLERTA'], battaglia: ['⚔', 'BATTAGLIA'] };
const V_STEPS = [['situazione', 'Situazione'], ['ascolto', 'Ascolto'], ['consiglio', 'Consiglio'], ['ordine', 'Ordine'], ['esecuzione', 'Esecuzione'], ['risoluzione', 'Esito']];
const V_STATION_ICON = { capitano: '⭐', primo: '◆', timoniere: '🧭', tattico: '🛡', scienza: '🔭', ingegnere: '🔧', medico: '⚕', comunicazioni: '📡' };
const VUI = { G: null, running: false, pauseReq: false, phase: '', phaseSince: 0, tick: null, logShown: 0, filter: 'tutto', lastAnnounce: '', prefs: null, sel: null, custom: [] };

function vPrefs() { if (!VUI.prefs) { try { VUI.prefs = Object.assign({ duration: '', mind: 'sonnet', cap: 0, mode: 'continuo', mission: '' }, JSON.parse(localStorage.getItem(V_PREFS) || '{}')); } catch (e) { VUI.prefs = { duration: '', mind: 'sonnet', cap: 0, mode: 'continuo', mission: '' }; } } return VUI.prefs; }
function vSavePrefs() { try { localStorage.setItem(V_PREFS, JSON.stringify(VUI.prefs)); } catch (e) { /* preferences are a convenience */ } }
function vLoadGame() { try { const g = JSON.parse(localStorage.getItem(V_SAVE) || 'null'); return g && g.v === 1 && g.bible ? g : null; } catch (e) { return null; } }
function vSaveGame(G) { try { localStorage.setItem(V_SAVE, JSON.stringify(G)); return true; } catch (e) { return false; } }
function vMissions() {
  try { VUI.custom = JSON.parse(localStorage.getItem(V_CUSTOM) || '[]'); } catch (e) { VUI.custom = []; }
  const ready = (typeof VENTURE_MISSIONS_MD === 'undefined' ? [] : VENTURE_MISSIONS_MD).map(([k, md]) => ({ key: k, md, m: VENTURE.parseMission(md, k), custom: false }));
  return ready.concat(VUI.custom.map((c) => ({ key: c.key, md: c.md, m: VENTURE.parseMission(c.md, c.key), custom: true })));
}
const vRoleSt = (k) => VENTURE.STATIONS[k];
function vCrewState() {
  const cr = crewLoad(); const slots = cr.slots.filter((s) => { const c = archGet(s.id); return c && c.status !== 'deceduto' && !c.disabled; });
  const hasCap = slots.some((s) => s.role === 'capitano'); return { slots, hasCap, n: slots.length };
}

/* ======================= SETUP ======================= */
function vOpenSetup() {
  homeHide && homeHide(); let v = $('vSetup');
  if (!v) { v = document.createElement('div'); v.id = 'vSetup'; v.className = 'vShip vView'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Prepara la missione'); document.body.appendChild(v);
    v.addEventListener('click', vSetupClick); v.addEventListener('change', vSetupChange); v.addEventListener('input', vSetupInput); }
  window.__ventureActive = true; if ($('vPlay')) { VUI.pauseReq = true; $('vPlay').hidden = true; } v.hidden = false; const p = vPrefs(); if (!VUI.sel) VUI.sel = p.mission || 'la-trappola-dei-predoni'; vSetupRender(); const h = v.querySelector('h1'); if (h) h.focus();
}
function vCloseSetup() { if ($('vSetup')) $('vSetup').hidden = true; }
function vSetupRender() {
  const v = $('vSetup'); const p = vPrefs(); const ms = vMissions(); const cs = vCrewState(); const saved = vLoadGame();
  const sel = ms.find((x) => x.key === VUI.sel) || (VUI.sel === 'mondo' ? null : ms[0]); if (sel) VUI.sel = sel.key;
  const m = VUI.sel === 'mondo' ? null : sel && sel.m; const dur = p.duration || (m && m.duration) || 'normale'; const turns = VENTURE.DURATIONS[dur];
  const est = VENTURE.estimate(turns, Math.max(1, cs.n)); const cap = p.capEdited && p.cap ? p.cap : Math.round(est.total * 1.3 / 5) * 5;
  const keyRoles = m ? (VENTURE.KEY_ROLES[m.type] || []) : []; const stationsOn = cs.slots.map((s) => vRoleSt(s.role));
  const missingKey = keyRoles.filter((k) => !stationsOn.includes(k));
  const reason = !cs.hasCap ? '⚠ Manca il capitano: senza di lui nessuno dà ordini.' : cs.n < CREW_MIN ? `⚠ Servono almeno ${CREW_MIN} persone (ora ${cs.n}).` : !VUI.sel ? 'Scegli una missione.' : '';
  const chain = cs.slots.slice().sort((a, b) => ['capitano', 'primo ufficiale', 'ufficiale tattico', 'ufficiale scientifico', 'capo ingegnere', 'timoniere', 'ufficiale alle comunicazioni', 'medico di bordo'].indexOf(a.role) - ['capitano', 'primo ufficiale', 'ufficiale tattico', 'ufficiale scientifico', 'capo ingegnere', 'timoniere', 'ufficiale alle comunicazioni', 'medico di bordo'].indexOf(b.role)).map((s) => archGet(s.id).name);
  const free = ROLES.filter(([k]) => !cs.slots.some((s) => s.role === k));
  const addOpts = free.map(([k, , label]) => { const pool = crewPool(k); return pool.length ? `<optgroup label="${label}">${pool.map((c) => `<option value="${c.id}">${esc(c.name)} · ${esc(c.style || '')}</option>`).join('')}</optgroup>` : ''; }).join('');
  const card = (x) => { const t = V_TYPE[x.m.type] || ['📄', 'Missione']; const su = (x.m.fields["senza via d'uscita"] || '').toLowerCase(); const on = VUI.sel === x.key;
    return `<div class="vmCard${on ? ' on' : ''}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-mission="${esc(x.key)}"><span class="vmType">${t[0]} ${t[1]} · ${x.m.duration}${/^s/.test(su) ? ' · ⛔ senza uscita' : /forse/.test(su) ? ' · ❓ forse senza uscita' : ''}</span><b>${esc(x.m.title)}</b><span class="vmSpunto">${esc((x.m.fields.spunto || '').slice(0, 150))}</span>${x.custom ? `<button class="vmDel" data-delmission="${esc(x.key)}" aria-label="Togli la missione ${esc(x.m.title)}">✕</button>` : ''}</div>`; };
  const pv = m ? `<div class="vsPreview"><h3>Ordine di missione · ${esc(m.title)}</h3>${vBriefingHtml(m)}
    ${m.sections['Verità nascosta'] ? `<details><summary>Verità nascosta scritta nel file (spoiler)</summary><p>${esc(m.sections['Verità nascosta'])}</p></details>` : ''}
    ${m.fields['ospite da un\'altra epoca'] && !/nessuno/i.test(m.fields['ospite da un\'altra epoca']) ? '<p class="vMuted">Ospite da un\'altra epoca: non ancora disponibile, verrà ignorato.</p>' : ''}<button data-act="readmission">📖 Leggi il file completo della missione (anche le note per te)</button></div>`
    : `<div class="vsPreview"><h3>🌌 Lascia decidere al Mondo</h3><p>Nessun file: il Mondo inventa luogo, fazioni e verità.</p><label>Tipo <select id="vsFreeType"><option value="">qualsiasi</option>${Object.entries(V_TYPE).map(([k, [i, l]]) => `<option value="${k}"${p.freeType === k ? ' selected' : ''}>${i} ${l}</option>`).join('')}</select></label></div>`;
  v.innerHTML = `<div class="vsHead"><h1 tabindex="-1">🚀 Prepara la missione</h1><span class="vMuted">Nave stellare Venture · Flotta del Patto</span><span class="vGrow"></span><button data-act="arch">👥 Archivio</button> <button data-act="home">⌂ Ambienti</button></div>
  ${saved && !saved.ended ? `<div class="vsResume">▶ Missione in corso: «${esc(saved.mission.title)}», turno ${saved.turn} di ~${saved.maxTurns}. Si riprende dall'ultimo turno completato. <button class="vPrimary" data-act="resume">▶ Riprendi</button> <button data-act="abandon">Abbandona…</button></div>` : saved && saved.ended ? `<div class="vsResume">Ultima missione: «${esc(saved.mission.title)}», ${esc(saved.ended.text)} <button data-act="lastreport">📜 Rivedi la fine</button></div>` : ''}
  <div class="vsCols"><div class="vsMain">
   <section aria-labelledby="vs1"><h2 id="vs1">1 · Equipaggio <span class="vMuted">${cs.n}/${CREW_MAX} a bordo${cs.hasCap ? ' · ✓ capitano' : ''}</span></h2>
    ${cs.n ? `<ol class="vsCrew">${cs.slots.map((s) => { const c = archGet(s.id); const r = roleOf(s.role); return `<li><span class="crRole">${r[3]} ${r[2]}</span><b>${esc(c.name)}</b><span class="vMuted">${esc(c.style || '')}</span><span><button data-swap="${s.id}" aria-label="Un altro ${esc(r[2].toLowerCase())}">↻</button> <button data-drop="${s.id}" aria-label="Togli ${esc(c.name)}">✕</button></span></li>`; }).join('')}</ol>`
      : '<p>Nessuno a bordo. Scegli almeno un capitano e due ufficiali.</p>'}
    <p class="vMuted">Supporto: ${free.map(([k, , l]) => V_STATION_ICON[vRoleSt(k)] + ' ' + l.toLowerCase()).join(' · ') || 'nessuno'}. Il personale di supporto esegue con meno abilità (−10 al tiro) e non costa chiamate.</p>
    ${missingKey.length ? `<p class="vNote">ⓘ Questa missione premia ${missingKey.map((k) => V_STATION_ICON[k] + ' ' + VENTURE.STATION_LABEL[k]).join(', ')}: ora ${missingKey.length > 1 ? 'sono' : 'è'} al supporto.</p>` : ''}
    ${chain.length ? `<p class="vMuted">Catena di comando: ${chain.map(esc).join(' → ')}</p>` : ''}
    <div class="vsRow">${addOpts && cs.n < CREW_MAX ? `<select id="vsAdd" aria-label="Aggiungi un ufficiale"><option value="">＋ Aggiungi…</option>${addOpts}</select>` : ''}<button data-act="fill">🎲 Completa a caso</button><button data-act="arch">✎ Cambia nell'archivio</button></div></section>
   <section aria-labelledby="vs2"><h2 id="vs2">2 · Missione</h2><div class="vmGrid" role="radiogroup" aria-labelledby="vs2">${ms.map(card).join('')}
    <div class="vmCard vmWorld${VUI.sel === 'mondo' ? ' on' : ''}" role="radio" aria-checked="${VUI.sel === 'mondo'}" tabindex="${VUI.sel === 'mondo' ? 0 : -1}" data-mission="mondo"><b>🌌 Lascia decidere al Mondo</b><span class="vmSpunto">Il Mondo inventa tutto, diverso ogni volta.</span></div>
    <label class="vmCard vmFile"><b>⇪ Carica un file .md</b><span class="vmSpunto">Una missione nel formato missione/1.</span><input id="vsFile" type="file" accept=".md,.txt,text/plain" hidden></label></div>${pv}</section>
  </div><aside class="vsSide" aria-label="Riepilogo"><h2>Riepilogo</h2>
   <p>Equipaggio <b>${cs.n}</b> ${cs.hasCap && cs.n >= CREW_MIN ? '✓' : '⚠'} · Missione <b>${esc(m ? m.title : 'decide il Mondo')}</b></p>
   <h3>3 · Durata</h3><div class="vSeg" role="radiogroup" aria-label="Durata">${Object.entries(VENTURE.DURATIONS).map(([k, n]) => `<button role="radio" aria-checked="${dur === k}" data-dur="${k}" class="${dur === k ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)} · ~${n}</button>`).join('')}</div>${m ? `<p class="vMuted">la missione suggerisce: ${m.duration}</p>` : ''}
   <h3>4 · Mente</h3><label class="vRadio"><input type="radio" name="vsMind" value="sonnet"${p.mind !== 'haiku' ? ' checked' : ''}> Sonnet: più ricca e sfumata</label><label class="vRadio"><input type="radio" name="vsMind" value="haiku"${p.mind === 'haiku' ? ' checked' : ''}> Haiku: più leggera, consuma meno</label><p class="vMuted">Ascolto ed esiti usano sempre la mente leggera.</p>
   <h3>📡 Il Comando della Flotta</h3><label class="vRadio"><input type="radio" name="vsCmd" value="giocatore"${p.command !== 'ia' ? ' checked' : ''}> Sei tu: quando il capitano chiede istruzioni, rispondi tu</label><label class="vRadio"><input type="radio" name="vsCmd" value="ia"${p.command === 'ia' ? ' checked' : ''}> Un'altra IA: il Comando risponde da solo</label><p class="vMuted">Si può cambiare anche durante la missione.</p>
   <label class="vRadio"><input type="checkbox" id="vsCampaign"${p.campaign !== false ? ' checked' : ''}> 📚 Campagna: l'equipaggio ricorda le missioni passate (ferite, medaglie, morti restano nell'archivio)</label>
   <h3>5 · Stima</h3><p>~ ${Math.round(est.main / 5) * 5} chiamate principali<br>~ ${Math.round(est.light / 5) * 5} chiamate leggere<br>~ ${est.minutes[0]}–${est.minutes[1]} minuti</p>
   <label>Tetto chiamate <input id="vsCap" type="number" min="${Math.round(est.total * 0.8)}" step="5" value="${cap}"></label><p class="vMuted">All'80% del tetto la situazione accelera verso un finale. ${VENTURE.REPORT_RESERVE} chiamate principali restano sempre per il report.</p>${cap < est.total ? '<p class="vNote">⚠ Con questo tetto la missione finirà prima della durata scelta.</p>' : ''}
   <details><summary>6 · Scommesse (facoltative)</summary><label>Chi farà più azioni riuscite? <select id="vsBet1"><option value="">—</option>${cs.slots.map((s) => `<option${p.bet1 === archGet(s.id).name ? ' selected' : ''}>${esc(archGet(s.id).name)}</option>`).join('')}</select></label>
    <label>Qualcuno disobbedirà? <select id="vsBet2"><option value="">—</option><option value="si"${p.bet2 === 'si' ? ' selected' : ''}>sì</option><option value="no"${p.bet2 === 'no' ? ' selected' : ''}>no</option></select></label>
    <label>Lo scafo finirà sopra il 50%? <select id="vsBet3"><option value="">—</option><option value="si"${p.bet3 === 'si' ? ' selected' : ''}>sì</option><option value="no"${p.bet3 === 'no' ? ' selected' : ''}>no</option></select></label><p class="vMuted">Si chiudono da sole a fine missione.</p></details>
   <details><summary>Opzioni avanzate</summary><label>Seme casuale (vuoto = nuovo) <input id="vsSeed" inputmode="numeric" value=""></label><label>Modo <select id="vsMode"><option value="continuo"${p.mode !== 'passo' ? ' selected' : ''}>Continuo: i turni si susseguono</option><option value="passo"${p.mode === 'passo' ? ' selected' : ''}>Passo passo: si ferma a ogni turno</option></select></label></details>
   <button class="vPrimary vStart" data-act="start" ${reason ? 'aria-disabled="true"' : ''}>🚀 Parti in missione</button><p id="vsStatus" role="status" class="${reason ? 'vNote' : 'vMuted'}">${reason || 'Pronto. Prima il Mondo scrive la situazione segreta (~20 s).'}</p>
  </aside></div>`;
  VUI.setupState = { reason, dur, cap, m, ms };
}
function vSetupClick(e) {
  const b = e.target.closest('button, [data-mission]'); if (!b) return; const p = vPrefs();
  if (b.dataset.delmission) { e.stopPropagation(); VUI.custom = VUI.custom.filter((c) => c.key !== b.dataset.delmission); try { localStorage.setItem(V_CUSTOM, JSON.stringify(VUI.custom)); } catch (er) { /* ignore */ } if (VUI.sel === b.dataset.delmission) VUI.sel = ''; vSetupRender(); return; }
  if (b.dataset.mission) { VUI.sel = b.dataset.mission; p.mission = VUI.sel; p.duration = ''; vSavePrefs(); vSetupRender(); const f = $('vSetup').querySelector('[data-mission].on'); if (f) f.focus(); return; }
  if (b.dataset.dur) { p.duration = b.dataset.dur; p.capEdited = false; vSavePrefs(); vSetupRender(); return; }
  if (b.dataset.swap) { const cr = crewLoad(); const i = cr.slots.findIndex((s) => s.id === b.dataset.swap); if (i >= 0) { crewReroll(cr, i); crewSave(cr); } vSetupRender(); return; }
  if (b.dataset.drop) { const cr = crewLoad(); cr.slots = cr.slots.filter((s) => s.id !== b.dataset.drop); crewSave(cr); vSetupRender(); return; }
  const a = b.dataset.act;
  if (a === 'home') { vCloseSetup(); window.__ventureActive = false; homeShow(); } else if (a === 'arch') { vCloseSetup(); archOpen('futuro'); }
  else if (a === 'fill') { const cr = crewLoad(); cr.slots.forEach((s) => { s.locked = true; }); const n = crewDraw(cr, Math.max(CREW_MIN, Math.min(5, cr.slots.length + 2))); crewSave(n); vSetupRender(); }
  else if (a === 'resume') { const g = vLoadGame(); if (g) { vCloseSetup(); vPlay(g); } }
  else if (a === 'abandon') { if (b.dataset.sure) { const g = vLoadGame(); if (g) { g.ended = { tipo: 'neutro', id: 'abbandonata', text: 'Missione abbandonata dal regista.' }; vSaveGame(g); } vSetupRender(); } else { b.dataset.sure = '1'; b.textContent = 'Sicuro? Il registro resta, ma non si potrà riprendere. Clicca di nuovo'; } }
  else if (a === 'lastreport') { const g = vLoadGame(); if (g) { vCloseSetup(); vPlay(g); } }
  else if (a === 'readmission') vReadMission();
  else if (a === 'start') { if (VUI.setupState.reason) { $('vsStatus').textContent = VUI.setupState.reason; $('vsStatus').className = 'vNote'; return; } vStart(); }
}
/** Shows the whole mission file: every field and section, director notes included (marked as yours only), the written truth behind a spoiler. */
function vReadMission() {
  const x = vMissions().find((q) => q.key === VUI.sel); if (!x) return;
  const lines = String(x.md || '').replace(/\r/g, '').split('\n'); let sec = ''; const out = [];
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<i>$1</i>');
  let open = '';
  const close = () => { if (open) { out.push(open === 'ul' ? '</ul>' : '</details>'); open = ''; } };
  lines.forEach((ln) => {
    const h1 = ln.match(/^#\s+(.+)/); const h2 = ln.match(/^##\s+(.+)/); const kv = !sec && ln.match(/^([A-Za-zÀ-ú' ]{3,30}):\s*(.+)$/); const li = ln.match(/^\s*[-*]\s+(.+)/);
    if (h1) { out.push(`<h2 class="vmTitle">${esc(h1[1])}</h2>`); return; }
    if (h2) { close(); while (out.length && out[out.length - 1] === '</ul>') break; sec = h2[1].trim();
      if (/verit/i.test(sec)) { out.push(`<details class="vSpoiler"><summary>${esc(sec)} (spoiler: cosa c'è dietro)</summary>`); open = 'details'; }
      else out.push(`<h3>${esc(sec)}${/regista/i.test(sec) ? ' <span class="vMuted">(solo per te, non entrano nei prompt)</span>' : ''}</h3>`); return; }
    if (kv) { out.push(`<p><b>${esc(kv[1])}:</b> ${inline(kv[2])}</p>`); return; }
    if (li) { if (open !== 'ul' && open !== 'details') { out.push('<ul>'); open = 'ul'; } out.push(`<li>${inline(li[1])}</li>`); return; }
    if (!ln.trim()) { if (open === 'ul') close(); return; }
    out.push(`<p>${inline(ln)}</p>`);
  });
  close();
  const d = document.createElement('div'); d.id = 'vMissionRead'; d.className = 'vShip vModal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Missione completa');
  d.innerHTML = `<div class="vCard vReader"><div class="vsHead"><span class="vMuted">📖 Missione completa</span><span class="vGrow"></span><button data-r="md">⇩ Scarica .md</button> <button data-r="close" aria-label="Chiudi">✕</button></div>${out.join('')}
   <p class="vMuted">Tutto quello che non è scritto qui lo decide il Mondo all'avvio, in segreto e diverso a ogni partita.</p><div class="vsRow"><button class="vPrimary" data-r="close">Chiudi</button></div></div>`;
  document.body.appendChild(d); const closeD = () => { d.remove(); const b = $('vSetup') && $('vSetup').querySelector('[data-act="readmission"]'); if (b) b.focus(); };
  d.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (e.target === d) closeD(); if (!b) return; if (b.dataset.r === 'close') closeD(); else saveFile(`${x.key}.md`, x.md); });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeD(); } });
  d.querySelector('[data-r="close"]').focus();
}
function vSetupChange(e) {
  const p = vPrefs(); const t = e.target;
  if (t.id === 'vsAdd' && t.value) { crewToggle(t.value); vSetupRender(); return; }
  if (t.name === 'vsMind') { p.mind = t.value; vSavePrefs(); return; }
  if (t.name === 'vsCmd') { p.command = t.value; vSavePrefs(); return; } if (t.id === 'vsCampaign') { p.campaign = t.checked; vSavePrefs(); return; }
  if (t.id === 'vsCap') { p.cap = Math.max(+t.min || 0, Math.round(+t.value || 0)); p.capEdited = true; vSavePrefs(); vSetupRender(); return; }
  if (/^vsBet\d$/.test(t.id)) { p['bet' + t.id.slice(-1)] = t.value; vSavePrefs(); return; }
  if (t.id === 'vsMode') { p.mode = t.value; vSavePrefs(); return; }
  if (t.id === 'vsFreeType') { p.freeType = t.value; vSavePrefs(); return; }
  if (t.id === 'vsFile') { const f = t.files[0]; t.value = ''; if (!f) return; if (!/\.(md|txt)$/i.test(f.name)) { toastMsg('Questo file non è una missione: serve un file .md o .txt.'); return; } if (f.size > 20000) { toastMsg('File troppo lungo per una missione (massimo 20 kB).'); return; }
    f.text().then((md) => { const key = 'file-' + Date.now().toString(36); VUI.custom.push({ key, md }); try { localStorage.setItem(V_CUSTOM, JSON.stringify(VUI.custom)); } catch (er) { /* kept for this session */ } VUI.sel = key; if (!md.trim()) toastMsg('File vuoto: deciderà tutto il Mondo.'); vSetupRender(); }); }
}
function vSetupInput() { /* reserved for live validation */ }
addEventListener('keydown', (e) => { // arrows move inside the mission radiogroup
  const c = e.target.closest && e.target.closest('#vSetup [data-mission]'); if (!c || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) return; e.preventDefault();
  const all = [...document.querySelectorAll('#vSetup [data-mission]')]; const i = all.indexOf(c);
  const n = e.key === ' ' ? c : all[(i + (/Right|Down/.test(e.key) ? 1 : -1) + all.length) % all.length]; n.click();
});

function vCrewForGame() {
  return vCrewState().slots.map((s) => { const c = archGet(s.id); const sh = archSheet(c); const sec = c.sections || {};
    return { archId: c.id, name: c.name, role: s.role, sex: c.sex, age: c.age, temper: c.temper, style: c.style || '', short: c.short || '', traits: [sec.carattere, sec.parlata].filter(Boolean).join(' ').slice(0, 400), relations: (sh.relations || []).map((r) => ({ to: r.to, type: r.type, int: r.int, view: r.view })), past: vPastOf(c) }; });
}
/** What an officer remembers of past Venture missions (campaign), as one short line for the prompts. */
function vPastOf(c) {
  const v = c.venture; if (!v || !v.missions || vPrefs().campaign === false) return '';
  return `${v.missions} ${v.missions === 1 ? 'missione' : 'missioni'}; ${(v.log || []).slice(-3).map((x) => `«${x.title}» (${x.outcome}${x.note ? ', ' + x.note : ''})`).join('; ')}${(v.medals || []).length ? '; medaglie: ' + v.medals.slice(-4).join(', ') : ''}`;
}
async function vStart() {
  const p = vPrefs(); const st = VUI.setupState;
  const mission = st.m || VENTURE.parseMission(`# Missione libera\n${p.freeType ? 'Tipo: ' + p.freeType : ''}`, 'Missione libera');
  const G = VENTURE.newGame(vCrewForGame(), { mission, duration: st.dur, mind: p.mind, cap: st.cap, seed: +($('vsSeed') || {}).value || 0, command: p.command === 'ia' ? 'ia' : 'giocatore', campaign: p.campaign !== false });
  G.bets = { b1: p.bet1 || '', b2: p.bet2 || '', b3: p.bet3 || '' };
  LLM.reset(); LLM.setMind(G.mind);
  const box = document.createElement('div'); box.id = 'vPrep'; box.className = 'vShip'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Il Mondo prepara la situazione');
  box.innerHTML = '<div class="vCard"><h2>🌌 Il Mondo prepara la situazione</h2><p>Scrive in segreto chi c\'è, cosa vuole e come può finire.</p><div class="vWait"><i></i></div><p id="vPrepT" role="status">0 s · di solito 15–30 s</p><p class="vMuted">Nessuno a bordo, nemmeno tu, la vedrà prima della fine.</p></div>';
  document.body.appendChild(box); const t0 = Date.now(); const h = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); setText($('vPrepT'), `${s} s · di solito 15–30 s${s > 45 ? ' · più lento del solito' : ''}`); }, 1000);
  let ok = false; try { ok = await VENTURE.startMission(G, LLM.ask); } catch (e) { ok = false; }
  clearInterval(h); box.remove();
  if (!ok) { $('vsStatus').textContent = 'Il Mondo non è riuscito a preparare la missione (2 tentativi). Riprova o cambia missione. Se Claude non risponde, apri la pagina da claude.ai.'; $('vsStatus').className = 'vNote'; return; }
  G.callStats = LLM.stats(); vSaveGame(G); vCloseSetup(); vPlay(G);
}

/* ======================= BRIDGE ======================= */
function vEnsurePlay() {
  if ($('vPlay')) return;
  const v = document.createElement('div'); v.id = 'vPlay'; v.className = 'vShip vView'; v.setAttribute('aria-label', 'Il ponte della Venture'); v.hidden = true;
  v.innerHTML = `<a class="vSkip" href="#vLog">Vai al diario</a><a class="vSkip" href="#vDir">Vai alla regia</a>
  <header class="vTop" id="vTop"></header><div class="vTurnBar" id="vTurnBar" aria-live="off"></div>
  <div class="vCols"><section class="vColLog" aria-labelledby="vLogH"><div class="vPanelHead"><h2 id="vLogH">Diario del ponte</h2><select id="vFilter" aria-label="Filtro del diario"><option value="tutto">Tutto</option><option value="parlato">Solo parlato</option><option value="rapporti">Rapporti</option><option value="esiti">Ordini ed esiti</option><option value="pensieri">Pensieri</option><option value="tiri">Tiri</option></select></div>
    <div id="vLog" class="vLog" role="log" aria-live="off" tabindex="0"></div><button id="vNewLines" class="vNewLines" hidden>↓ nuove righe</button></section>
   <section class="vColMid"><div id="vStage" class="vStage"><div id="vbCanvas"></div><div id="vbTags"></div><div id="vbMurs"></div><div id="vbHud" aria-live="off"></div><div id="vbScreen" hidden role="img" aria-label="Grande schermo del ponte"></div><div id="vbBubble" hidden></div><div id="vbCaption" hidden aria-hidden="true"></div><div class="vbBar"><label title="Velocità di lettura">📖 <select id="vbSpeed" aria-label="Velocità di lettura"><option value="0.75">lenta</option><option value="1" selected>normale</option><option value="2">veloce</option><option value="4">molto veloce</option></select></label><button id="vbFF" aria-pressed="false" title="Avanti veloce: i momenti tranquilli scorrono, si ferma appena succede qualcosa">⏩</button><button id="vbBetBtn" title="Scommetti su cosa succederà nei prossimi turni">🎲</button><button id="vbVoice" aria-pressed="false" title="Gli ufficiali parlano ad alta voce" aria-label="Voci">🤐</button><button id="vbSoundBtn" aria-pressed="true" title="Suoni del ponte (colpi, allarmi)">🔊</button><button id="vbDirBtn" title="Intervieni: vai ai comandi della regia" aria-label="Intervieni">🎬</button><button id="vbScreenBtn" aria-pressed="false" title="Mostra il grande schermo a tutta grandezza" aria-label="Schermo">🖥</button><button id="vbSkip" title="Salta avanti: mostra subito tutto quello che è già successo" aria-label="Salta avanti">⏭</button></div></div><div class="vMidScroll"><div id="vDir" class="vCard vDir" tabindex="-1"></div><div id="vBridge" class="vBridge vCard"></div><div id="vOrder" class="vCard"></div><div id="vOutcome" class="vCard"></div></div></section>
   <section class="vColShip"><div id="vShipP" class="vCard"></div><div id="vContacts" class="vCard"></div><div class="vCard"><div class="vPanelHead"><h2>Mappa tattica 20×20</h2></div><canvas id="vMap" width="300" height="300" role="img"></canvas><p class="vMuted vLegend">▲ Venture · ◆ ostile · ◇ diffidente · ● neutrale · ○ amichevole · ? ignoto · cerchi: 5 e 10 caselle</p></div></section></div>
  <footer class="vCrewBar" id="vCrew"></footer><div id="vAnnounce" class="vSr" role="status" aria-live="polite" aria-atomic="true"></div>`;
  document.body.appendChild(v);
  v.addEventListener('click', vPlayClick); v.addEventListener('change', vPlayChange); v.addEventListener('keydown', (e) => { const p = e.target.dataset && e.target.dataset.person; if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); vOpenPerson(p); } });
  $('vbSpeed').onchange = (e) => { VB.speed = +e.target.value || 1; vPrefs().speed = VB.speed; vSavePrefs(); }; $('vbSkip').onclick = () => vbSkip(); $('vbFF').onclick = () => vbFastForward(); $('vbBetBtn').onclick = () => vOpenBets(); $('vbVoice').onclick = () => vbVoiceToggle(); $('vbSoundBtn').onclick = () => { VB.sound = !VB.sound; vPrefs().sound = VB.sound; vSavePrefs(); vbBarSync(); };
  $('vbDirBtn').onclick = () => { const d = $('vDir'); d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); d.focus(); }; $('vbScreenBtn').onclick = () => { VB.screenPin = !VB.screenPin; vbScreenShow(); };
  $('vFilter').onchange = (e) => { VUI.filter = e.target.value; VUI.logShown = 0; $('vLog').innerHTML = ''; vRenderLog(); };
  $('vLog').addEventListener('scroll', () => { const l = $('vLog'); if (l.scrollHeight - l.scrollTop - l.clientHeight < 30) $('vNewLines').hidden = true; });
  $('vNewLines').onclick = () => { const l = $('vLog'); l.scrollTop = l.scrollHeight; $('vNewLines').hidden = true; };
  addEventListener('keydown', (e) => { if (!$('vPlay') || $('vPlay').hidden || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    if (e.key === 'p' || e.key === 'P') vTogglePause(); else if ((e.key === 'n' || e.key === 'N') && !VUI.running) vResume(); });
}
function vPlay(G) {
  window.__ventureActive = true; VUI.G = G; LLM.restore(G.callStats); LLM.setMind(G.mind); vEnsurePlay(); homeHide && homeHide(); vCloseSetup(); $('vPlay').hidden = false; VUI.logShown = 0; $('vLog').innerHTML = '';
  VUI.pauseReq = vPrefs().mode === 'passo' && G.turn > 0; VB.speed = vPrefs().speed || 1; VB.sound = vPrefs().sound !== false; $('vbSpeed').value = String(VB.speed); vbMount(G); vRenderAll();
  clearInterval(VUI.tick); VUI.tick = setInterval(() => { if (VUI.running) vRenderTurnBar(); }, 1000);
  if (G.ended) vShowEnd(); else if (G.turn === 0) { vRenderTurnBar(); vShowBriefing(G); } else if (!VUI.pauseReq) vRun(); else vRenderTurnBar();
}
function vLeave() { VUI.pauseReq = true; window.__ventureActive = false; if ($('vPlay')) $('vPlay').hidden = true; homeShow(); }
/** The captain calls Fleet Command and the player is Command: the stage catches up, then the player answers. */
async function vAskCommand(G, req) {
  if (!G.command || G.command.mode !== 'giocatore') return null; await vbIdle(); VB.ff = false; vbBarSync(); vbSound('alarm');
  return new Promise((resolve) => {
    const d = document.createElement('div'); d.id = 'vCmd'; d.className = 'vShip vModal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-labelledby', 'vCmdH'); const cap = VENTURE.captain(G);
    d.innerHTML = `<div class="vCard"><h2 id="vCmdH" tabindex="-1">📡 Chiamata per il Comando della Flotta</h2><p class="vMuted">Turno ${G.turn} · il capitano ${esc(cap.name)} chiede istruzioni. Tu sei il Comando: la tua risposta arriva al ponte, e il capitano potrà anche disobbedire.</p>
      <p class="vBig">«${esc(req.q)}»</p>${req.options.length ? `<div class="vDirBtns">${req.options.map((o, i) => `<button class="vPrimary" data-opt="${i}">${esc(o)}</button>`).join('')}</div>` : ''}
      <label>Oppure scrivi tu la risposta <textarea id="vCmdText" rows="2" maxlength="400" placeholder="Es. Negativo, capitano: non aprite il fuoco per primi."></textarea></label>
      <div class="vsRow"><button class="vPrimary" data-cmd="send">📡 Trasmetti</button><button data-cmd="ai" title="Lascia rispondere l'IA del Comando, solo per questa volta">🤖 Rispondi tu, IA</button></div></div>`;
    document.body.appendChild(d); d.querySelector('h2').focus();
    const done = (v) => { d.remove(); resolve(v); };
    d.addEventListener('click', (e) => { const o = e.target.closest('[data-opt]'); if (o) { done(req.options[+o.dataset.opt]); return; } const b = e.target.closest('[data-cmd]'); if (!b) return; if (b.dataset.cmd === 'ai') done(null); else { const t = ($('vCmdText').value || '').trim(); if (t) done(t); } });
  });
}
async function vRun() {
  const G = VUI.G; if (VUI.running || !G || G.ended) return; VUI.running = true; VUI.pauseReq = false; vRenderTop();
  while (!G.ended && !VUI.pauseReq) {
    const snap = JSON.stringify(G); const used = () => { const s = LLM.stats(); return s.light + s.main; };
    try {
      await VENTURE.playTurn(G, { ask: LLM.ask, askCommand: vAskCommand, onStep: (g, label) => { VUI.phase = label; VUI.phaseSince = Date.now(); vbPlay(); vRenderTop(); vRenderTurnBar(); vRenderCrew(); },
        budgetLeft: () => (G.cap ? G.cap - VENTURE.REPORT_RESERVE - used() : Infinity) });
    } catch (e) { Object.keys(G).forEach((k) => delete G[k]); Object.assign(G, JSON.parse(snap)); VUI.pauseReq = true; toastMsg('⚠ Il turno non è riuscito: ripristinato l\'ultimo turno completo. Premi ▶ per riprovare.'); break; }
    if (!G.ended && G.cap && used() >= G.cap - VENTURE.REPORT_RESERVE) G.ended = { tipo: 'neutro', id: 'tetto', text: 'Il tetto delle chiamate è stato raggiunto.' };
    VUI.phase = 'in scena'; vRenderTurnBar(); await vbIdle();
    G.callStats = LLM.stats(); if (!vSaveGame(G)) toastMsg(`⚠ Non riesco a salvare il turno ${G.turn}: se ricarichi la pagina, ripartirai dal turno precedente.`);
    VUI.phase = 'fine turno'; vRenderAll(); vAnnounceTurn(G);
    if (vPrefs().mode === 'passo') VUI.pauseReq = true;
  }
  VUI.running = false; vRenderTop(); vRenderTurnBar(); if (G.ended) vShowEnd();
}
function vTogglePause() { if (VUI.running) { VUI.pauseReq = true; vRenderTop(); vRenderTurnBar(); } else vResume(); }
function vResume() { if (VUI.G && !VUI.G.ended && !VUI.running) vRun(); }

/* ---------- rendering ---------- */
function vRenderAll() { vRenderTop(); vRenderTurnBar(); vRenderLog(); vRenderBridge(); vRenderOrder(); vRenderOutcome(); vRenderShip(); vRenderContacts(); vRenderMap(); vRenderCrew(); vRenderDirector(); }
function vRenderTop() {
  const G = VUI.G; if (!G) return; const s = LLM.stats(); const used = s.light + s.main; const cap = G.cap || 0; const r = V_RHYTHM[G.rhythm] || V_RHYTHM.crociera; const pct = cap ? Math.min(100, Math.round(used / cap * 100)) : 0;
  const v = $('vPlay'); v.dataset.rhythm = G.rhythm;
  $('vTop').innerHTML = `<h1 title="${esc(G.mission.title)}">🚀 ${esc(G.mission.title)}</h1><span class="vPill vR-${G.rhythm}">${r[0]} ${r[1]}</span><span>Turno ${G.turn} di ~${G.maxTurns}${G.clockShift ? ' · ⏳ verso il finale' : ''}</span>
   <span title="${s.main} principali, ${s.light} leggere · ${VENTURE.REPORT_RESERVE} riservate al report">Chiamate ${used}${cap ? '/' + cap : ''} <span class="vTicks${pct >= 80 ? ' warn' : ''}" aria-hidden="true">${'▮'.repeat(Math.round(pct / 10))}${'▯'.repeat(10 - Math.round(pct / 10))}</span></span><span class="vGrow"></span>
   ${G.ended ? '<span>🏁 Missione conclusa</span>' : VUI.running ? `<button data-act="pause">${VUI.pauseReq ? '⏸ Pausa a fine turno…' : '⏸ Pausa'}</button>` : `<button class="vPrimary" data-act="resume">${G.turn ? (vPrefs().mode === 'passo' ? 'Turno successivo ▶' : '▶ Riprendi') : '▶ Inizia'}</button>`}
   <select id="vMode" aria-label="Modo"><option value="continuo"${vPrefs().mode !== 'passo' ? ' selected' : ''}>Continuo</option><option value="passo"${vPrefs().mode === 'passo' ? ' selected' : ''}>Passo passo</option></select>
   <button data-act="cmdmode" title="Chi risponde quando il capitano chiama il Comando della Flotta">📡 Comando: ${G.command && G.command.mode === 'ia' ? 'IA' : 'tu'}</button><button data-act="report" title="Equipaggio, relazioni, missione e registro: a schermo e in PDF">📊 Resoconto</button><button data-act="novel" title="Il romanzo della missione, un capitolo ogni ${VENTURE.NOVEL_TURNS} turni: PDF o testo">📖 Romanzo</button>${G.ended ? '<button data-act="end">🏁 Fine</button>' : ''}<button data-act="home" title="Torna agli ambienti: la missione resta salvata">⌂</button>`;
}
function vRenderTurnBar() {
  const G = VUI.G; if (!G) return; const el = $('vTurnBar'); const ph = VUI.phase || ''; const base = ph.split(':')[0];
  if (G.ended) { el.innerHTML = '🏁 Missione conclusa'; return; }
  if (!VUI.running) { el.innerHTML = G.turn ? `⏸ In pausa. Turno ${G.turn} completato.${vPrefs().mode === 'passo' ? ' Premi «Turno successivo ▶» (tasto N).' : ''}` : 'Pronti. Premi ▶ per il primo turno.'; return; }
  const idx = V_STEPS.findIndex(([k]) => k === base); const sec = Math.round((Date.now() - VUI.phaseSince) / 1000); const typ = V_TYPICAL[G.rhythm] || [10, 30];
  const who = ph.includes(':') ? ph.split(':')[1].trim() : ''; const what = { 'in scena': 'il ponte mostra cosa è successo', situazione: 'aggiorno i sensori', ascolto: `${G.crew.filter((c) => !c.dead).length} ufficiali ascoltano e pensano`, consiglio: `${who} sta parlando`, ordine: 'il capitano decide (e gli esterni scelgono le loro mosse)', esecuzione: 'chi non è d\'accordo valuta l\'ordine', risoluzione: 'l\'arbitro tira i dadi', mondo: 'il Mondo fa evolvere la situazione', racconto: 'racconto dell\'esito', diario: 'il capitano scrive il diario' }[base] || ph;
  const cool = LLM.coolUntil() - Date.now();
  el.innerHTML = `<ol class="vSteps">${V_STEPS.map(([k, l], i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${i < idx ? '✓' : i === idx ? '●' : '○'} ${l}</li>`).join('')}${['mondo', 'racconto', 'diario'].includes(base) ? `<li class="now">● ${base[0].toUpperCase() + base.slice(1)}</li>` : ''}</ol>
   <span class="vPhase">${cool > 0 ? `Claude chiede di rallentare: riprendo tra ${Math.ceil(cool / 1000)} s` : `${esc(what)}… ${sec} s`}</span><span class="vMuted">di solito ${typ[0]}–${typ[1]} s a turno in ${G.rhythm}${sec > typ[1] + 15 ? ' · Claude è più lento del solito' : ''}</span>`;
}
const vName = (G, n) => { const c = G.crew.find((x) => x.name === n); return c ? `${V_STATION_ICON[c.station] || ''} ${n}` : n; };
function vLogRow(G, l) {
  const who = l.who ? esc(l.who) : ''; const sr = (t) => `<span class="vSr">${t}</span>`;
  switch (l.kind) {
    case 'sys': return l.hidden ? '' : /^— Turno/.test(l.text) ? `<div class="vSep">${esc(l.text.replace(/·\s*(\w+)/, (m, r) => '· ' + (V_RHYTHM[r] || [''])[0] + ' ' + r))}</div>` : `<div class="vSys">${esc(l.text)}</div>`;
    case 'thought': return `<div class="vThought">${sr('Pensiero di ' + who + ', solo per te:')}💭 <b>${esc(vName(G, l.who))}</b> pensa (solo tu): «${esc(l.text)}»</div>`;
    case 'line': return `<div class="vLine">${sr('Turno ' + l.t + '. ')}<b>${esc(vName(G, l.who))}</b> <span class="vMuted">· ${esc(l.tono || '')}${l.interrompe ? ' · ⚡ interrompe' : ''}</span><br>«${esc(l.text)}»</div>`;
    case 'order': return `<div class="vOrderRow">⭐ <b>${who}</b> ordina: «${esc(l.text)}»${l.orders && l.orders.length ? `<br><span class="vMuted">${l.assetto ? 'Assetto ' + esc(l.assetto) + ' · ' : ''}${l.orders.map((o) => { const [st, a] = o.split(': '); return `${V_STATION_ICON[st] || ''} ${esc(VENTURE.ACTION_LABELS[a] || a)}`; }).join(' · ')}</span>` : ''}</div>`;
    case 'object': return `<div class="vObj">⚑ <b>${who}</b> obietta a verbale: ${esc(l.text.replace(/^Obietta a verbale:\s*/, ''))}</div>`;
    case 'refuse': return `<div class="vRef">✋ <b>${who}</b>: ${esc(l.text)}</div>`;
    case 'msg': return `<div class="vMsg">◆ <b>${who}</b> (canale): «${esc(l.text)}»</div>`;
    case 'roll': return `<div class="vRoll">🎲 ${esc(l.text)}</div>`;
    case 'story': return `<div class="vStory">📖 ${esc(l.text)}</div>`;
    case 'world': return `<div class="vWorld">🌌 ${esc(l.text)}</div>`;
    case 'command': return `<div class="vCmd">📡 <b>${who}</b>: ${esc(l.text)}</div>`;
    case 'director': return `<div class="vCmd">🎬 ${esc(l.text)}</div>`;
    case 'cmdask': return `<div class="vCmd">📡 <b>${who}</b> chiama il Comando: «${esc(l.text)}»${(l.options || []).length ? `<br><span class="vMuted">${l.options.map(esc).join(' · ')}</span>` : ''}</div>`;
    case 'cmdreply': return `<div class="vCmd">📡 <b>Comando della Flotta</b>${l.player ? ' (tu)' : ''}: «${esc(l.text)}»</div>`;
    case 'rel': return `<div class="vRel">${l.v > 0 ? '🤝' : '💢'} ${esc(l.text)}</div>`;
    case 'away': return `<div class="vStory">🚀 <b>Squadra di sbarco</b> (${who}): ${esc(l.text)}</div>`;
    case 'bet': return `<div class="vSys">🎲 ${esc(l.text)}</div>`;
    case 'answer': return `<div class="vAnswer">❓ Hai chiesto a <b>${who}</b>: «${esc(l.q || '')}»<br>💬 «${esc(l.text)}»</div>`;
    case 'diary': return `<details class="vDiary"><summary>📓 Diario del capitano, turno ${l.t}</summary>${esc(l.text)}</details>`;
    case 'end': return `<div class="vEndRow">🏁 ${esc(l.text)}</div>`;
    default: return `<div>${esc(l.text)}</div>`;
  }
}
const V_FILTERS = { tutto: () => true, parlato: (l) => ['line', 'msg', 'command', 'order', 'object', 'refuse', 'cmdask', 'cmdreply', 'answer'].includes(l.kind), rapporti: (l) => l.kind === 'rel', esiti: (l) => ['order', 'roll', 'story', 'end', 'object', 'refuse'].includes(l.kind) || /^— Turno/.test(l.text), pensieri: (l) => l.kind === 'thought', tiri: (l) => l.kind === 'roll' };
function vRenderLog() {
  const G = VUI.G; if (!G || !$('vLog')) return; const box = $('vLog'); const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  if (!G.log.length) { box.innerHTML = '<p class="vMuted">Il diario si riempie appena l\'equipaggio prende posto.</p>'; return; }
  if (VUI.logShown === 0) box.innerHTML = '';
  const upTo = Math.min(G.log.length, VUI.stageShown == null ? G.log.length : VUI.stageShown); const f = V_FILTERS[VUI.filter] || V_FILTERS.tutto; const html = G.log.slice(VUI.logShown, upTo).filter(f).map((l) => vLogRow(G, l)).join(''); VUI.logShown = Math.max(VUI.logShown, upTo);
  if (html) { box.insertAdjacentHTML('beforeend', html); if (atEnd) box.scrollTop = box.scrollHeight; else $('vNewLines').hidden = false; }
}
/** Plain-language briefing of a mission: what is happening, where, what is at stake, what Command wants, what we know. */
function vBriefingHtml(m) {
  const f = m.fields; const su = (f["senza via d'uscita"] || '').toLowerCase(); const t = V_TYPE[m.type] || ['📄', 'Missione'];
  const rules = (m.sections['Da rispettare'] || '').trim().split('\n').filter(Boolean).map((l) => l.replace(/^[-*]\s*/, ''));
  const row = (icon, label, text) => (text ? `<div class="vBrRow"><span class="vBrIcon" aria-hidden="true">${icon}</span><div><b>${label}</b><p>${esc(text)}</p></div></div>` : '');
  return `<div class="vBrief"><p class="vBrKind">${t[0]} Missione di ${esc(t[1].toLowerCase())} · ${esc(m.duration)} (~${VENTURE.DURATIONS[m.duration]} turni)</p>
   ${row('📍', 'Che cosa succede', f.spunto)}${row('🗺', 'Dove', f.luogo)}${row('⚖', 'Cosa c\'è in gioco', f['posta in gioco'])}${row('📡', 'Cosa chiede il Comando della Flotta', f['ordini del comando'])}
   ${rules.length ? `<div class="vBrRow"><span class="vBrIcon" aria-hidden="true">🔎</span><div><b>Cosa sappiamo già</b><ul>${rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div></div>` : ''}
   ${/^s/.test(su) ? row('⛔', 'Attenzione', 'È una prova senza via d\'uscita: non si potrà salvare tutto. Conta come si comporta l\'equipaggio.') : /forse/.test(su) ? row('❓', 'Attenzione', 'Forse non si potrà salvare tutto: lo sa solo il Mondo.') : ''}
   <p class="vMuted">Tutto il resto (chi c'è davvero, cosa vuole, come può finire) lo decide il Mondo in segreto alla partenza: lo scoprirai giocando e, alla fine, nel report.</p></div>`;
}
function vRenderBridge() {
  const G = VUI.G; const m = G.mission; const f = m.fields; const vis = G.ships.filter((s) => s.alive && VENTURE.dist(s.pos, G.ship.pos) <= VENTURE.sensorRange(G));
  $('vBridge').innerHTML = `<h2>La missione in breve</h2><p><b>Che cosa succede:</b> ${esc(f.spunto || 'il Mondo ha preparato una situazione sconosciuta')}</p>${f['ordini del comando'] ? `<p><b>Il Comando chiede:</b> ${esc(f['ordini del comando'])}</p>` : ''}${G.director.command.length ? `<p><b>Nuovo ordine del Comando:</b> ${esc(G.director.command.slice(-1)[0])}</p>` : ''}
   <p><b>Sui sensori:</b> ${vis.length ? vis.map((s) => esc(s.known ? `${s.id} (${(G.factions[s.faction] || {}).nome})` : `${s.id} (non identificato)`)).join(', ') : 'nessun contatto'}</p>${G.known.length ? `<p><b>Cosa abbiamo scoperto:</b> ${G.known.map(esc).join(' · ')}</p>` : ''}
   <details><summary>Come si legge il ponte</summary><p class="vMuted">Sul ponte gli ufficiali pensano (💭, lo vedi solo tu), poi chi vuole parla al capitano (fumetto), il capitano dà gli ordini (⭐), l'arbitro tira i dadi (🎲: riesce se il numero uscito è uguale o più basso di quello che serviva) e poi si racconta cosa è successo (📖). Tu sei il regista: puoi intervenire dalla regia qui sotto.</p></details>`;
}
function vShowBriefing(G) {
  if ($('vBriefing')) return; const d = document.createElement('div'); d.id = 'vBriefing'; d.className = 'vShip vModal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-labelledby', 'vBrH');
  d.innerHTML = `<div class="vCard"><h2 id="vBrH" tabindex="-1">📡 Ordine di missione · ${esc(G.mission.title)}</h2>${vBriefingHtml(G.mission)}
   <p><b>A bordo:</b> ${G.crew.map((c) => `${V_STATION_ICON[c.station] || ''} ${esc(c.name)} (${esc(VENTURE.STATION_LABEL[c.station])})`).join(' · ')}.</p>
   <div class="vsRow"><button class="vPrimary" data-go="1">▶ Si parte</button></div></div>`;
  document.body.appendChild(d); d.querySelector('h2').focus();
  d.addEventListener('click', (e) => { if (e.target.closest('[data-go]')) { d.remove(); vResume(); } });
}
function vRenderOrder() {
  const G = VUI.G; const o = G.log.filter((l) => l.kind === 'order').slice(-1)[0];
  if (!o) { $('vOrder').innerHTML = '<h2>Ordine del capitano</h2><p class="vMuted">Nessun ordine ancora.</p>'; return; }
  const ex = G.log.filter((l) => l.t === o.t && (l.kind === 'object' || l.kind === 'refuse'));
  $('vOrder').innerHTML = `<h2>Ordine del capitano · turno ${o.t}</h2><p class="vBig">⭐ ${esc(o.who)}: «${esc(o.text)}»</p><p class="vMuted">${o.assetto ? 'Assetto ' + esc(o.assetto) : ''}${G.ship.dev ? ` · deviazione: ${esc(G.ship.dev.da)} → ${esc(G.ship.dev.a)} (+20)` : ''}</p>
   <ul class="vOrders">${(o.orders || []).map((s) => { const [st, a] = s.split(': '); const c = G.crew.find((x) => x.station === st && !x.dead && VENTURE.captain(G) !== x); const e = c && ex.find((x) => x.who === c.name);
     return `<li>${V_STATION_ICON[st] || ''} ${esc(c ? c.name : 'supporto')} · ${esc(VENTURE.ACTION_LABELS[a] || a)} <span class="${e ? (e.kind === 'refuse' ? 'vBad' : 'vWarn') : 'vOk'}">${e ? (e.kind === 'refuse' ? (/testa sua/.test(e.text) ? '↯ fa di testa sua' : '✋ si rifiuta') : '⚑ obietta ma esegue') : '✓ esegue'}</span></li>`; }).join('') || '<li>Mantenere la posizione.</li>'}</ul>`;
}
function vRenderOutcome() {
  const G = VUI.G; const t = Math.max(...G.log.filter((l) => l.kind === 'roll').map((l) => l.t), 0);
  if (!t) { $('vOutcome').innerHTML = '<h2>Esito</h2><p class="vMuted">Nessuna azione incerta ancora.</p>'; return; }
  const rolls = G.rolls.filter((r) => r.t === t); let ri = 0; const story = G.log.filter((l) => l.t === t && l.kind === 'story').slice(-1)[0];
  const rows = G.log.filter((l) => l.t === t && l.kind === 'roll').map((l) => {
    const m = l.text.match(/→ (\d+)% → (\d+)/); if (!m) return `<li class="vEff">${esc(l.text)}</li>`; const r = rolls[ri++]; if (!r) return `<li>${esc(l.text)}</li>`;
    const head = esc(l.text.split('→')[0].trim()); const word = r.ok ? '✓ RIUSCITO' : '✗ FALLITO';
    return `<li><b>🎯 ${head}</b> → <span class="${r.ok ? 'vOk' : 'vBad'}">${word}</span><br><span class="vMuted">serviva ${r.p} o meno · uscito ${r.roll}</span>
     <div class="vDice" role="img" aria-label="serviva ${r.p} o meno, uscito ${r.roll}, ${r.ok ? 'riuscito' : 'fallito'}"><i style="width:${r.p}%"></i><b style="left:${r.roll}%">${r.roll}</b></div>
     <details><summary>Perché ${r.p}%?</summary><table class="vCalc"><tr><td>Base</td><td>${r.base}</td></tr>${r.mods.map((x) => { const mm = x.match(/^([+-]?\d+) (.*)$/); return mm ? `<tr><td>${esc(mm[2])}</td><td>${mm[1]}</td></tr>` : ''; }).join('')}<tr><th>Probabilità (tra 5 e 95)</th><th>${r.p}</th></tr></table></details></li>`; });
  $('vOutcome').innerHTML = `<h2>Esito · turno ${t}</h2><ul class="vOut">${rows.join('')}</ul>${story ? `<p class="vStoryP">${esc(story.text)}</p>` : ''}`;
}
function vRenderShip() {
  const G = VUI.G; const sh = G.ship; const e = VENTURE.energy(G); const bar = (v, max, cls) => `<span class="vBar ${cls || ''}" aria-hidden="true"><i style="width:${Math.round(v / max * 100)}%"></i></span>`;
  const sc = (k, l) => `<div class="vSh vSh-${k}"><b>${l}</b> ${sh.shields[k]}/50 ${bar(sh.shields[k], 50)}</div>`; const bad = Object.entries(sh.systems).filter(([, v]) => v !== 'ok');
  const m = G.moraleHist; const dm = m.length > 1 ? m[m.length - 1] - m[m.length - 2] : 0;
  $('vShipP').innerHTML = `<h2>Nave</h2><p class="vBigNum">Scafo ${sh.hull}/100 ${bar(sh.hull, 100, sh.hull < 25 ? 'crit' : sh.hull < 50 ? 'warn' : '')} ${sh.hull < 25 ? '<span class="vBad">⚠ critico</span>' : sh.hull < 50 ? '<span class="vWarn">danneggiato</span>' : ''}</p>
   <div class="vShields" aria-label="Scudi">${sc('prua', 'PRUA')}${sc('babordo', 'BABORDO')}<div class="vShipIcon" aria-hidden="true">▲</div>${sc('tribordo', 'TRIBORDO')}${sc('poppa', 'POPPA')}</div>
   <p>Energia: <b>${esc(sh.preset)}</b>${sh.dev ? ` · deviazione ${esc(sh.dev.da)} → ${esc(sh.dev.a)}` : ''}</p><div class="vEnergy" aria-hidden="true">${[['scudi', 'Sc'], ['armi', 'Ar'], ['motori', 'Mo'], ['sensori', 'Se'], ['vita', 'Vi']].map(([k, a]) => e[k] ? `<span class="vE-${k}" style="flex:${e[k]}">${a} ${e[k]}</span>` : '').join('')}</div>
   <p class="vMuted">Scudi ${e.scudi} · Armi ${e.armi} · Motori ${e.motori} · Sensori ${e.sensori} · Supporto vitale ${e.vita}${e.motori < 50 ? ' · curvatura non disponibile: motori sotto 50' : ''}</p>
   <p>Siluri ${sh.torpedoes}/12 · Navette ${sh.shuttles}/2 · Feriti ${sh.wounded + G.crew.filter((c) => c.injured).length}${G.evacuati ? ` · A bordo dai soccorsi ${G.evacuati}` : ''}</p>
   <p>Morale ${sh.morale} ${bar(sh.morale, 100, sh.morale < 25 ? 'crit' : sh.morale < 50 ? 'warn' : '')} ${dm ? (dm > 0 ? '▲' : '▼') + Math.abs(dm) : ''}</p>
   <p>${bad.length ? bad.map(([k, v]) => `<span class="${v === 'fuori uso' ? 'vBad' : 'vWarn'}">${v === 'fuori uso' ? '✗' : '⚠'} ${esc(k)} ${v}</span>`).join(' · ') + ` · ✓ altri ${9 - bad.length} ok` : '✓ Tutti i sistemi operativi'}</p>`;
}
const V_POSTURE = { ostile: ['◆', 'ostile'], diffidente: ['◇', 'diffidente'], neutrale: ['●', 'neutrale'], amichevole: ['○', 'amichevole'] };
const vBand = (d) => (d <= 2 ? 'ravvicinata' : d <= 5 ? 'corta' : d <= 10 ? 'media' : 'lunga');
function vVisible(G) { const r = VENTURE.sensorRange(G); return G.ships.filter((s) => s.alive && VENTURE.dist(s.pos, G.ship.pos) <= r); }
function vRenderContacts() {
  const G = VUI.G; const vis = vVisible(G); const intf = G.bible && G.bible.luogo.regole.includes('interferenze');
  $('vContacts').innerHTML = `<h2>Sensori e contatti</h2>${intf ? '<p class="vWarn">⚠ Interferenze: letture parziali (−15).</p>' : ''}<ul class="vContactList">${vis.map((s) => { const d = VENTURE.dist(s.pos, G.ship.pos); const F = G.factions[s.faction] || {};
    return s.known ? `<li>${(V_POSTURE[F.posture] || ['?'])[0]} <b>${esc(s.id)}</b> ${esc((V_POSTURE[F.posture] || ['', ''])[1])} · ${esc(F.nome || '')} · ${esc(s.classe)}${s.label ? ' · ' + esc(s.label) : ''} · ${d} caselle, ${vBand(d)}</li>` : `<li>? <b>${esc(s.id)}</b> non identificato · circa ${d} caselle (lettura incerta)</li>`; }).join('') || '<li>Nessun contatto entro la portata dei sensori.</li>'}</ul>`;
}
function vRenderMap() {
  const G = VUI.G; const cv = $('vMap'); if (!cv) return; const ctx = cv.getContext('2d'); const N = VENTURE.GRID; const W = cv.width; const c = W / N; const css = getComputedStyle($('vPlay'));
  const col = (n, d) => (css.getPropertyValue(n) || d).trim();
  ctx.fillStyle = col('--v-panel', '#111c30'); ctx.fillRect(0, 0, W, W);
  for (let i = 0; i <= N; i++) { ctx.strokeStyle = i % 5 === 0 ? col('--v-edge', '#5a7bb0') : col('--v-rule', '#2a3d5e'); ctx.lineWidth = i % 5 === 0 ? 1 : 0.5; ctx.beginPath(); ctx.moveTo(i * c, 0); ctx.lineTo(i * c, W); ctx.moveTo(0, i * c); ctx.lineTo(W, i * c); ctx.stroke(); }
  const P = (p) => [p[0] * c + c / 2, p[1] * c + c / 2]; const [vx, vy] = P(G.ship.pos);
  ctx.setLineDash([3, 3]); ctx.strokeStyle = col('--v-text2', '#a9b8d4'); [5, 10].forEach((r) => { ctx.beginPath(); ctx.arc(vx, vy, r * c, 0, Math.PI * 2); ctx.stroke(); }); ctx.setLineDash([]);
  ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
  vVisible(G).forEach((s) => { const [x, y] = P(s.pos); const F = G.factions[s.faction] || {}; const pst = s.known ? F.posture : '?';
    ctx.fillStyle = pst === 'ostile' ? col('--v-crit', '#ff7a6b') : pst === '?' ? col('--v-text2', '#a9b8d4') : col('--v-ok', '#5fd39a'); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.5; ctx.beginPath();
    if (pst === 'ostile' || pst === 'diffidente') { ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath(); pst === 'ostile' ? ctx.fill() : ctx.stroke(); }
    else if (pst === '?') { ctx.setLineDash([2, 2]); ctx.strokeRect(x - 5, y - 5, 10, 10); ctx.setLineDash([]); ctx.fillText('?', x, y + 3); }
    else { ctx.arc(x, y, 5, 0, Math.PI * 2); pst === 'neutrale' ? ctx.fill() : ctx.stroke(); }
    ctx.fillStyle = col('--v-text', '#e8eefb'); ctx.fillText(s.id, x, y - 9); });
  ctx.fillStyle = col('--v-accent', '#7cc4ff'); ctx.beginPath(); ctx.moveTo(vx, vy - 7); ctx.lineTo(vx + 6, vy + 6); ctx.lineTo(vx - 6, vy + 6); ctx.closePath(); ctx.fill(); ctx.fillText('Venture', vx, vy + 17);
  const vis = vVisible(G); cv.setAttribute('aria-label', `Venture nella casella ${G.ship.pos.join(',')}. ${vis.length ? vis.map((s) => `${s.id} ${s.known ? (G.factions[s.faction] || {}).posture : 'non identificato'} a ${VENTURE.dist(s.pos, G.ship.pos)} caselle`).join('; ') : 'Nessun contatto.'}`);
}
function vRenderCrew() {
  const G = VUI.G; if (!G) return; const cap = VENTURE.captain(G); const speaking = (VUI.phase || '').startsWith('consiglio:') ? VUI.phase.split(':')[1].trim() : '';
  const chips = G.crew.map((c) => { const l = G.lastListen.find((u) => u.nome === c.name); const st = c.dead ? '† morto' : speaking === c.name ? '🎙 parla' : c.injured ? '🩹 ferito (−15)' : cap === c ? 'comanda' : l && l.vuole ? '✋'.repeat(Math.max(1, l.urgenza)) + ' vuole parlare' : '';
    return `<div class="vChip${cap === c ? ' cap' : ''}"${c.dead ? '' : ` data-person="${esc(c.name)}" role="button" tabindex="0" title="Intervieni su ${esc(c.name)}"`}><b>${V_STATION_ICON[c.station] || ''} ${esc(c.name)}</b><span>${esc(VENTURE.STATION_LABEL[c.station])}${st ? ' · ' + st : ''}</span>${l && cap !== c ? `<span class="vMuted" role="meter" aria-valuemin="-2" aria-valuemax="2" aria-valuenow="${l.accordo}" aria-label="accordo con la rotta">accordo ${l.accordo > 0 ? '+' : ''}${l.accordo}${l.accordo < 0 ? ' (contrario)' : ''}</span>` : ''}</div>`; });
  const sup = Object.values(VENTURE.STATIONS).filter((st) => !G.crew.some((c) => c.station === st)).map((st) => `<div class="vChip sup">${V_STATION_ICON[st]} supporto</div>`);
  $('vCrew').innerHTML = chips.concat(sup).join('');
}
function vRenderDirector() {
  const G = VUI.G; if (!G) return; const d = G.director; const ended = !!G.ended; const names = G.crew.filter((c) => !c.dead).map((c) => c.name); const facs = Object.values(G.factions);
  const pending = [].concat(Object.entries(d.whispers).map(([n, t]) => `💭 sussurro a ${esc(n)}`), d.clash ? [`⚡ scontro ${esc(d.clash.join(' / '))}`] : [], d.free.map((t) => `🌌 ${esc(t.slice(0, 50))}`));
  $('vDir').innerHTML = `<h2>🎬 Regia · intervieni</h2>${ended ? '<p class="vMuted">Missione conclusa.</p>' : `<p class="vMuted">Sulla <b>situazione</b>: i pulsanti qui sotto. Su un <b>personaggio</b>: clicca la sua figura sul ponte, il suo nome o la sua scheda in basso (domanda, sussurro, umore, ferita, scontro).</p><div class="vDirBtns"><button data-dir="destiny" title="Una svolta a sorpresa, scelta a caso">🃏 Carta del destino</button>
   <button data-dir="command" title="Il Comando della Flotta parla al capitano">📡 Comando</button><button data-dir="breakdown" title="Un sistema si guasta subito">⚙ Avaria</button><button data-dir="arrival" title="Il Mondo lo rende coerente; usa 1 chiamata principale al prossimo turno">🛸 Arrivo inatteso</button>
   <button data-dir="mind" title="Cambia la postura di una fazione">🔄 Il nemico cambia idea</button><button data-dir="whisper">💭 Sussurro</button><button data-dir="reveal" title="Un dettaglio vero compare sui sensori">🔍 Rivela un frammento</button><button data-dir="clash">⚡ Scontro di carattere</button></div>
   <div id="vDirForm" class="vDirForm" hidden></div>
   <div class="vsRow"><input id="vFree" maxlength="300" placeholder="Scrivi cosa accade (es. un'eruzione solare acceca i sensori)" aria-label="Evento libero per il Mondo"><button data-dir="free">⚡ Fai succedere</button></div>
   ${pending.length ? `<p class="vMuted">In attesa per il prossimo turno: ${pending.join(' · ')}</p>` : ''}`}`;
  VUI.dirData = { names, facs };
}
function vDirForm(kind) {
  const f = $('vDirForm'); const { names, facs } = VUI.dirData; const opt = (a) => a.map((x) => `<option>${esc(x)}</option>`).join('');
  const forms = {
    command: `<label>Il Comando della Flotta parla al capitano <textarea id="vfText" rows="2" maxlength="300"></textarea></label><button data-dirgo="command">📡 Trasmetti</button>`,
    breakdown: `<label>Sistema <select id="vfSys"><option value="">a caso</option>${opt(VENTURE.SYSTEMS)}</select></label><button data-dirgo="breakdown">⚙ Guasta</button>`,
    arrival: `<label>Cosa arriva (facoltativo) <input id="vfText" maxlength="200" placeholder="una nave, un fenomeno… o lascia scegliere al Mondo"></label><button data-dirgo="arrival">🛸 Fai arrivare</button>`,
    mind: `<label>Fazione <select id="vfFac">${facs.map((x) => `<option value="${esc(x.id)}">${esc(x.nome)} (${esc(x.posture)})</option>`).join('')}</select></label><button data-dirgo="mind">🔄 Cambia idea</button>`,
    whisper: `<label>Ufficiale <select id="vfWho">${opt(names)}</select></label><label>Pensiero (lo sentirà come suo) <input id="vfText" maxlength="160"></label><button data-dirgo="whisper">💭 Sussurra</button>`,
    reveal: `<p>Un dettaglio vero della situazione compare nelle letture dei sensori. Lo scoprirai insieme all'equipaggio.</p><button data-dirgo="reveal">🔍 Rivela</button>`,
    clash: `<label>Primo <select id="vfA">${opt(names)}</select></label><label>Secondo <select id="vfB">${opt(names.slice(1).concat(names.slice(0, 1)))}</select></label><button data-dirgo="clash">⚡ Metti in disaccordo</button>`,
  };
  f.hidden = false; f.dataset.kind = kind; f.innerHTML = forms[kind] + ' <button data-dirgo="close">Annulla</button>'; const first = f.querySelector('input, textarea, select, button'); if (first) first.focus();
}
function vDirGo(kind) {
  const G = VUI.G; const D = VENTURE.director; const val = (id) => ($(id) || {}).value || '';
  if (kind === 'close') { $('vDirForm').hidden = true; return; }
  if (kind === 'command') D.command(G, val('vfText'));
  else if (kind === 'breakdown') D.breakdown(G, val('vfSys'));
  else if (kind === 'arrival') { D.arrival(G, val('vfText')); G.log.push({ t: G.turn, kind: 'director', text: 'Arrivo inatteso: il Mondo lo applica al prossimo turno.' }); }
  else if (kind === 'mind') D.changeMind(G, val('vfFac'));
  else if (kind === 'whisper') { if (!val('vfText').trim()) return; D.whisper(G, val('vfWho'), val('vfText')); G.log.push({ t: G.turn, kind: 'director', text: `Hai sussurrato a ${val('vfWho')}: «${val('vfText').slice(0, 160)}»` }); }
  else if (kind === 'reveal') D.reveal(G);
  else if (kind === 'clash') D.clash(G, val('vfA'), val('vfB'));
  else if (kind === 'free') { const t = val('vFree').trim(); if (!t) return; D.free(G, t); G.log.push({ t: G.turn, kind: 'director', text: `Regia: «${t.slice(0, 200)}» · il Mondo lo applica al prossimo turno.` }); }
  vAfterDirector('🎬 Fatto: entra in gioco al prossimo turno.');
}
/** After any intervention: save, refresh, and let the stage show what the director did. */
function vAfterDirector(msg) { const G = VUI.G; vSaveGame(G); vRenderAll(); if (typeof vbPlay === 'function') vbPlay(); if (msg) toastMsg(msg); }

/* ---------- destiny cards: a random twist, like the island's ---------- */
const V_DESTINY = [
  ['⚙', 'Un guasto improvviso', (G, D) => D.breakdown(G, '')],
  ['🛸', 'Qualcuno arriva', (G, D) => { D.arrival(G, ''); G.log.push({ t: G.turn, kind: 'director', text: 'Carta del destino: qualcuno sta arrivando…' }); }],
  ['🔄', 'Il nemico cambia idea', (G, D) => { D.changeMind(G, ''); G.log.push({ t: G.turn, kind: 'director', text: 'Carta del destino: qualcuno là fuori ha cambiato idea.' }); }],
  ['🔍', 'Un dettaglio vero emerge', (G, D) => D.reveal(G)],
  ['🌩', 'Tempesta ionica', (G, D) => { D.free(G, 'Una tempesta ionica investe la zona: sensori disturbati e manovre difficili per qualche turno.'); G.log.push({ t: G.turn, kind: 'director', text: 'Carta del destino: una tempesta ionica si avvicina.' }); }],
  ['📡', 'Il Comando cambia gli ordini', (G, D) => D.command(G, ['Priorità assoluta: nessuna perdita civile, anche a costo della missione.', 'Rientrate appena possibile: la Venture serve altrove.', 'Raccogliete prove: il Consiglio vuole sapere chi c\'è dietro.'][Math.floor(Math.random() * 3)])],
  ['😱', 'Il panico prende qualcuno', (G, D) => { const c = vPick(G.crew.filter((x) => !x.dead && VENTURE.captain(G) !== x)); if (c) D.mood(G, c.name, 'in preda al panico'); }],
  ['⚡', 'Due ufficiali si scontrano', (G, D) => { const a = G.crew.filter((x) => !x.dead).sort(() => Math.random() - 0.5); if (a.length > 1) { D.clash(G, a[0].name, a[1].name); G.log.push({ t: G.turn, kind: 'director', text: `Carta del destino: tra ${a[0].name} e ${a[1].name} sta per scoppiare una lite.` }); } }],
];
function vPick(a) { return a.length ? a[Math.floor(Math.random() * a.length)] : null; }
function vDestiny() { const G = VUI.G; if (!G || G.ended || !G.bible) return; const c = vPick(V_DESTINY); c[2](G, VENTURE.director); vAfterDirector(`🃏 ${c[0]} ${c[1]}`); }

/* ---------- one character: their mind and what the director can do to them ---------- */
const V_MOODS = ['calmo', 'teso', 'spaventato', 'furioso', 'euforico', 'esausto', 'sospettoso', 'ribelle'];
function vOpenPerson(name) {
  const G = VUI.G; const c = G && G.crew.find((x) => x.name === name); if (!c) return; let d = $('vPerson');
  if (!d) { d = document.createElement('div'); d.id = 'vPerson'; d.className = 'vShip vModal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-labelledby', 'vPeH'); document.body.appendChild(d);
    d.addEventListener('click', vPersonClick); d.addEventListener('keydown', (e) => { if (e.key === 'Escape') d.remove(); }); }
  d.dataset.n = name; vRenderPerson(); d.querySelector('h2').focus();
}
function vRenderPerson() {
  const d = $('vPerson'); const G = VUI.G; if (!d || !G) return; const c = G.crew.find((x) => x.name === d.dataset.n); if (!c) { d.remove(); return; }
  const last = (k) => G.log.filter((l) => l.kind === k && l.who === c.name).slice(-1)[0]; const th = last('thought'), li = last('line'), an = G.log.filter((l) => l.kind === 'answer' && l.who === c.name).slice(-3);
  const l = G.lastListen.find((u) => u.nome === c.name); const others = G.crew.filter((x) => x !== c && !x.dead);
  const rel = (c.relations || []).filter((r) => G.crew.some((x) => x.name === r.to)); const busy = VUI.personBusy;
  d.innerHTML = `<div class="vCard vPeCard"><button class="vPeX" data-pe="close" aria-label="Chiudi">✕</button>
   <h2 id="vPeH" tabindex="-1">${V_STATION_ICON[c.station] || ''} ${esc(c.name)} <small>${esc(VENTURE.STATION_LABEL[c.station])}${VENTURE.captain(G) === c ? ' · al comando' : ''}</small></h2>
   <p class="vMuted">${c.age} anni · ${esc(c.temper || '')}${c.style ? ' · ' + esc(c.style) : ''}</p>${c.short ? `<p>${esc(c.short)}</p>` : ''}
   <div class="vPeState">${c.dead ? '† morto' : `${c.injured ? '🩹 ferito (−15 ai tiri)' : '✓ in forze'} · umore: <b>${esc(c.mood || 'il suo solito')}</b>${l ? ` · ${l.vuole ? '✋ vuole parlare' : 'ascolta'} · accordo con la rotta ${l.accordo > 0 ? '+' : ''}${l.accordo}` : ''}`}</div>
   ${th ? `<p class="vThought">💭 Pensa (solo tu): «${esc(th.text)}»</p>` : ''}${li ? `<p>🗨 Ultima battuta: «${esc(li.text)}»</p>` : ''}
   ${rel.length ? `<details><summary>Rapporti a bordo</summary><ul>${rel.map((r) => `<li><b>${esc(r.to)}</b>: ${esc(r.type)}${r.view ? ' · «' + esc(r.view) + '»' : ''}</li>`).join('')}</ul></details>` : ''}
   ${c.dead || G.ended ? '' : `<h3>❓ Fagli una domanda</h3><p class="vMuted">Sente una voce che solo lui o lei sente e risponde sinceramente. Costa 1 chiamata.</p>
   <div class="vsRow"><input id="vPeQ" maxlength="300" placeholder="Es. di chi ti fidi meno, a bordo?" aria-label="Domanda a ${esc(c.name)}"><button data-pe="ask" ${busy ? 'disabled' : ''}>${busy ? '…ci pensa' : 'Chiedi'}</button></div>
   ${an.map((a) => `<p class="vAnswer">❓ «${esc(a.q || '')}»<br>💬 «${esc(a.text)}»</p>`).join('')}
   <h3>💭 Sussurragli un pensiero</h3><p class="vMuted">Lo sentirà come suo, al prossimo turno.</p>
   <div class="vsRow"><input id="vPeW" maxlength="160" placeholder="Es. il cargo mente" aria-label="Pensiero da sussurrare"><button data-pe="whisper">Sussurra</button></div>
   ${G.director.whispers[c.name] ? `<p class="vMuted">In attesa: «${esc(G.director.whispers[c.name])}»</p>` : ''}
   <h3>🎭 Cambia il suo umore</h3><div class="vDirBtns">${V_MOODS.map((m) => `<button data-pe="mood" data-v="${m}" aria-pressed="${c.mood === m}">${m}</button>`).join('')}<button data-pe="mood" data-v="">il suo solito</button></div>
   <h3>Altro</h3><div class="vDirBtns"><button data-pe="injure">${c.injured ? '✚ Curalo' : '🩹 Feriscilo'}</button>
   ${others.length ? `<label>⚡ Mettilo contro <select id="vPeVs">${others.map((x) => `<option>${esc(x.name)}</option>`).join('')}</select></label><button data-pe="clash">Scontro</button>` : ''}</div>`}</div>`;
}
async function vPersonClick(e) {
  const d = $('vPerson'); if (e.target === d) { d.remove(); return; } const b = e.target.closest('[data-pe]'); if (!b) return;
  const G = VUI.G; const D = VENTURE.director; const n = d.dataset.n; const k = b.dataset.pe;
  if (k === 'close') { d.remove(); return; }
  if (k === 'ask') { const q = ($('vPeQ').value || '').trim(); if (!q || VUI.personBusy) return; VUI.personBusy = true; vRenderPerson();
    try { await VENTURE.interview(G, n, q, LLM.ask); } finally { VUI.personBusy = false; } vSaveGame(G); vRenderPerson(); vRenderAll(); if (typeof vbPlay === 'function') vbPlay(); return; }
  if (k === 'whisper') { const t = ($('vPeW').value || '').trim(); if (!t) return; D.whisper(G, n, t); G.log.push({ t: G.turn, kind: 'director', text: `Hai sussurrato a ${n}: «${t.slice(0, 160)}»` }); }
  else if (k === 'mood') D.mood(G, n, b.dataset.v);
  else if (k === 'injure') { const c = G.crew.find((x) => x.name === n); D.injure(G, n, !c.injured); }
  else if (k === 'clash') { const o = $('vPeVs').value; D.clash(G, n, o); G.log.push({ t: G.turn, kind: 'director', text: `Tra ${n} e ${o} sta per scoppiare una lite.` }); }
  vAfterDirector(); vRenderPerson();
}
function vPlayClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.dir) { if (b.dataset.dir === 'free') vDirGo('free'); else if (b.dataset.dir === 'destiny') vDestiny(); else vDirForm(b.dataset.dir); return; }
  const pc = e.target.closest('[data-person]'); if (pc) { vOpenPerson(pc.dataset.person); return; }
  if (b.dataset.dirgo) { vDirGo(b.dataset.dirgo); return; }
  const a = b.dataset.act; if (a === 'pause') vTogglePause(); else if (a === 'resume') vResume(); else if (a === 'home') vLeave(); else if (a === 'end') vShowEnd(); else if (a === 'report') vOpenReport(); else if (a === 'cmdmode') { const G = VUI.G; G.command = G.command || { mode: 'giocatore', lastAsk: -99, asks: 0 }; G.command.mode = G.command.mode === 'ia' ? 'giocatore' : 'ia'; vSaveGame(G); vRenderTop(); toastMsg(G.command.mode === 'ia' ? '📡 Il Comando ora è un\'altra IA.' : '📡 Il Comando ora sei tu: quando il capitano chiama, rispondi tu.'); } else if (a === 'novel') vNovel();
}
function vPlayChange(e) { if (e.target.id === 'vMode') { vPrefs().mode = e.target.value; vSavePrefs(); if (e.target.value === 'passo' && VUI.running) VUI.pauseReq = true; vRenderTop(); } }
function vAnnounce(text) { const a = $('vAnnounce'); if (a && text && text !== VUI.lastAnnounce) { VUI.lastAnnounce = text; a.textContent = text; } }
function vAnnounceTurn(G) {
  const o = G.log.filter((l) => l.t === G.turn && l.kind === 'order').slice(-1)[0]; const rolls = G.rolls.filter((r) => r.t === G.turn);
  vAnnounce(`Turno ${G.turn}, ${G.rhythm}. ${o ? 'Ordine: ' + o.text + '.' : ''} ${rolls.map((r) => `${VENTURE.ACTION_LABELS[r.action] || r.action}: ${r.ok ? 'riuscito' : 'fallito'}`).join('. ')}. Scafo ${G.ship.hull}.${G.ended ? ' Missione conclusa: ' + G.ended.text : ''}`);
}

/* ---------- end of mission and report ---------- */
function vBets(G) {
  const b = G.bets || {}; const out = [];
  if (b.b1) { const cnt = {}; G.rolls.filter((r) => r.ok).forEach((r) => { cnt[r.who] = (cnt[r.who] || 0) + 1; }); const best = Object.entries(cnt).filter(([n]) => G.crew.some((c) => c.name === n)).sort((x, y) => y[1] - x[1])[0]; out.push([`Più azioni riuscite: ${b.b1}`, best && best[0] === b.b1, best ? `${best[0]} (${best[1]})` : 'nessuno']); }
  const dis = G.decisions.some((d) => /RIFIUTA|iniziativa/.test(d)); if (b.b2) out.push([`Qualcuno disobbedirà: ${b.b2}`, (b.b2 === 'si') === dis, dis ? 'sì' : 'no']);
  if (b.b3) out.push([`Scafo sopra il 50%: ${b.b3}`, (b.b3 === 'si') === (G.ship.hull > 50), `scafo ${G.ship.hull}`]);
  return out;
}
function vShowEnd() {
  const G = VUI.G; if (!G || !G.ended || $('vEnd')) return; const e = G.ended; const lab = { vittoria: '✓ VITTORIA', sconfitta: '✗ SCONFITTA', neutro: '◐ ESITO NEUTRO' }[e.tipo] || '◐ FINE';
  const bets = vBets(G); const refuse = G.decisions.filter((d) => /RIFIUTA/.test(d)).length, obj = G.decisions.filter((d) => /obietta/.test(d)).length;
  vRecordMission(G); vCampaignApply(G); const med = VENTURE.medals(G); const live = (G.liveBets || []).filter((b) => b.done);
  const d = document.createElement('div'); d.id = 'vEnd'; d.className = 'vShip vModal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-labelledby', 'vEndH');
  d.innerHTML = `<div class="vCard"><h2 id="vEndH" tabindex="-1">🏁 Missione conclusa · turno ${G.turn}</h2><p class="vBig ${e.tipo === 'vittoria' ? 'vOk' : e.tipo === 'sconfitta' ? 'vBad' : 'vWarn'}">${lab} · «${esc(e.text)}»</p>
   <p>Scafo ${G.ship.hull}/100 · Morale ${G.ship.morale} · Siluri usati ${12 - G.ship.torpedoes} · Feriti ${G.ship.wounded + G.crew.filter((c) => c.injured).length}</p><p>Disobbedienze: ${obj} obiezioni, ${refuse} rifiuti</p>
   ${bets.length ? `<p>Le tue scommesse: ${bets.filter((x) => x[1]).length} su ${bets.length} ✓</p><ul>${bets.map(([q, ok, real]) => `<li>${ok ? '✓' : '✗'} ${esc(q)} · è andata: ${esc(real)}</li>`).join('')}</ul>` : ''}
   <div class="vsRow">${med.length ? `<p><b>🏅 Medaglie</b></p><ul>${med.map((m) => `<li>${m.icon} <b>${esc(m.name)}</b> · ${m.to === 'nave' ? 'alla nave' : esc(m.to)} · ${esc(m.why)}</li>`).join('')}</ul>` : ''}${live.length ? `<p>🎲 Scommesse in partita: ${live.filter((b) => b.won).length} su ${live.length} vinte</p>` : ''}
   <p class="vBig">🏆 Punteggio ${VENTURE.score(G)}</p>
   <div class="vsRow"><button class="vPrimary" data-end="report">📜 ${G.report ? 'Rivedi il report' : 'Scrivi il report'}</button><button data-end="agende">🕵 Indovina le agende segrete</button><button data-end="rank">🏆 Classifica</button><button data-end="rp">📊 Resoconto (PDF)</button><button data-end="novel">📖 Romanzo</button><button data-end="log">⇩ Scarica il registro</button><button data-end="again">🔁 Nuova missione</button><button data-end="home">⌂ Ambienti</button><button data-end="close">Chiudi</button></div><div id="vEndOut"></div></div>`;
  document.body.appendChild(d); d.querySelector('h2').focus(); vAnnounce(`Missione conclusa: ${lab}. ${e.text}`);
  d.addEventListener('click', async (ev) => { const b = ev.target.closest('[data-end]'); if (!b) return; const k = b.dataset.end;
    if (k === 'close') d.remove(); else if (k === 'home') { d.remove(); vLeave(); } else if (k === 'again') { d.remove(); $('vPlay').hidden = true; vOpenSetup(); }
    else if (k === 'rp') vOpenReport(); else if (k === 'rank') vShowRanking(); else if (k === 'agende') vAgendaGame(); else if (k === 'novel') vNovel();
    else if (k === 'log') saveFile(`venture-${G.mission.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-registro.json`, JSON.stringify(G, null, 1));
    else if (k === 'report') { if (!G.report) { b.disabled = true; $('vEndOut').innerHTML = '<p role="status">Scrivo il report (1 chiamata principale)…</p>'; await VENTURE.finalReport(G, LLM.ask); G.callStats = LLM.stats(); vSaveGame(G); b.disabled = false; } vShowReport(); } });
}
function vReportMd(G) {
  const R = G.report || {}; const b = G.bible; const L = [`# ${R.titolo || G.mission.title}`, '', `Missione «${G.mission.title}» · ${G.turn} turni · esito: ${G.ended.text}`, '', '## Rapporto al Comando', R.rapporto || '(non scritto)', '', '## Cosa credevano e cosa c\'era davvero', R.confronto || '', '', '## La verità (bibbia rivelata)', b.verita, ...b.fazioni.map((f) => `- **${f.nome}**: ${f.intenzione}. Segreto: ${f.segreto}.`), `- Senza via d'uscita: ${b.senza_uscita ? 'sì' : 'no'}`,
    '', '## Accertato dall\'equipaggio', ...(G.known.length ? G.known.map((k) => '- ' + k) : ['- quasi nulla']), ...(G.falseKnown.length ? ['', 'Credevano anche (falso):', ...G.falseKnown.map((k) => '- ' + k)] : []),
    '', '## Ritratti', ...(R.ritratti || []).map((r) => `- **${r.nome}**: ${r.testo}`), ...(R.corte ? ['', '## Corte marziale', R.corte] : []), ...(R.encomio ? ['', '## Encomio per l\'originalità', R.encomio] : []),
    '', '## Diario del capitano', ...G.diary.map((d) => `- Turno ${d.t}: ${d.text}`), '', '## Decisioni chiave', ...G.decisions.map((d) => '- ' + d), '', '## Interventi della regia', ...(G.amend.length ? G.amend.map((a) => `- Turno ${a.t}: ${a.text} → ${a.effects}`) : ['- nessuno']), '', `Morale nel tempo: ${G.moraleHist.join(', ')}`];
  return L.join('\n') + '\n';
}
function vShowReport() {
  const G = VUI.G; const md = vReportMd(G); const out = $('vEndOut'); if (!out) return;
  out.innerHTML = `<div class="vReport" tabindex="-1">${md.split('\n').map((l) => /^# /.test(l) ? `<h2>${esc(l.slice(2))}</h2>` : /^## /.test(l) ? `<h3>${esc(l.slice(3))}</h3>` : /^- /.test(l) ? `<p class="vLi">• ${esc(l.slice(2)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>` : l ? `<p>${esc(l)}</p>` : '').join('')}</div><button data-end="md">⇩ Scarica il report (.md)</button>`;
  out.querySelector('[data-end="md"]').onclick = () => saveFile(`venture-${G.mission.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.md`, md);
  out.querySelector('.vReport').focus();
}
/* ---------- live bets ---------- */
function vOpenBets() {
  const G = VUI.G; if (!G || G.ended) { toastMsg('La missione è conclusa.'); return; } VUI.betOffers = VENTURE.betOffers(G);
  const el = vOnTop(funCard('🎲 Scommetti sui prossimi turni', '<div id="vBetsBox"></div>')); vRenderBets(); return el;
}
function vRenderBets() {
  const box = $('vBetsBox'); const G = VUI.G; if (!box || !G) return; const open = G.liveBets.filter((b) => !b.done), done = G.liveBets.filter((b) => b.done);
  const offers = (VUI.betOffers || []).filter((o) => !G.liveBets.some((b) => !b.done && b.q === o.q));
  box.innerHTML = `${offers.length ? `<p>Punta sì o no: si chiude da sola appena succede, o alla scadenza. +20 se indovini, −5 se sbagli.</p>${offers.map((o, i) => `<div class="row" style="gap:6px;align-items:center;margin:4px 0"><span style="flex:1">${esc(o.q)}</span><button data-bet="${i}" data-yes="1">Sì</button><button data-bet="${i}" data-yes="0">No</button></div>`).join('')}` : '<p>Nessuna nuova scommessa adesso.</p>'}
    ${open.length ? `<h4>In corso</h4><ul>${open.map((b) => `<li>${esc(b.q)} · hai detto <b>${b.yes ? 'sì' : 'no'}</b> · scade al turno ${b.until}</li>`).join('')}</ul>` : ''}
    ${done.length ? `<h4>Chiuse</h4><ul>${done.slice(-8).map((b) => `<li>${b.won ? '✓' : '✗'} ${esc(b.q)} · è andata: ${b.happened ? 'sì' : 'no'}</li>`).join('')}</ul>` : ''}`;
  box.querySelectorAll('[data-bet]').forEach((b) => { b.onclick = () => { const o = VUI.betOffers[+b.dataset.bet]; if (VENTURE.placeBet(G, o, b.dataset.yes === '1')) { vSaveGame(G); toastMsg('🎲 Scommessa registrata.'); } vRenderBets(); }; });
}

/* ---------- secret agendas: guess them, then see the truth ---------- */
function vAgendaGame() {
  const G = VUI.G; const crew = G.crew.filter((c) => c.agenda); if (!crew.length) { toastMsg('In questa missione non c\'erano agende segrete.'); return; }
  const opts = crew.map((c) => c.agenda.text).sort(() => Math.random() - 0.5);
  const el = vOnTop(funCard('🕵 Le agende segrete', `<p>Ogni ufficiale aveva un obiettivo segreto. Abbina a ognuno il suo.</p>${crew.map((c, i) => `<label style="display:block;margin:6px 0"><b>${esc(c.name)}</b> <select data-ag="${i}"><option value="">—</option>${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`).join('')}<div class="row" style="margin-top:8px"><button class="primary" id="vAgGo">Rivela</button></div><div id="vAgOut"></div>`));
  el.querySelector('#vAgGo').onclick = () => { let ok = 0; const R = (G.report && G.report.agende) || [];
    const rows = crew.map((c, i) => { const g = el.querySelector(`[data-ag="${i}"]`).value; const hit = g === c.agenda.text; if (hit) ok++; const v = R.find((x) => x.nome === c.name);
      return `<li>${hit ? '✓' : '✗'} <b>${esc(c.name)}</b>: ${esc(c.agenda.text)}${v ? ` · ${v.ok ? '🎯 ci è riuscito' : '✗ non ci è riuscito'}${v.perche ? ': ' + esc(v.perche) : ''}` : ''}</li>`; });
    G.agendaGuess = { ok, of: crew.length }; vSaveGame(G);
    el.querySelector('#vAgOut').innerHTML = `<p><b>${ok} su ${crew.length}</b> indovinate.${G.report ? '' : ' Scrivi il report per sapere chi ci è riuscito.'}</p><ul>${rows.join('')}</ul>`; };
}

/* ---------- ranking and campaign ---------- */
const V_RECORDS = 'venture-records';
function vRecords() { try { return JSON.parse(localStorage.getItem(V_RECORDS) || '[]'); } catch (e) { return []; } }
/** Saves the mission in the ranking once. */
function vRecordMission(G) {
  if (G.recorded) return; G.recorded = true; const r = vRecords();
  r.push({ title: G.mission.title, date: new Date().toISOString(), outcome: G.ended.tipo, text: G.ended.text, turns: G.turn, score: VENTURE.score(G), medals: VENTURE.medals(G).length, captain: (VENTURE.captain(G) || {}).name || '', crew: G.crew.length, command: (G.command || {}).mode || 'giocatore' });
  try { localStorage.setItem(V_RECORDS, JSON.stringify(r.slice(-100))); } catch (e) {} vSaveGame(G);
}
function vShowRanking() {
  const r = vRecords().slice().sort((a, b) => b.score - a.score); const lab = { vittoria: '✓', sconfitta: '✗', neutro: '◐' };
  vOnTop(funCard('🏆 Classifica delle missioni', r.length ? `<table class="relT"><tr><th>#</th><th>Missione</th><th>Esito</th><th>Turni</th><th>Medaglie</th><th>Capitano</th><th>Punti</th></tr>${r.slice(0, 30).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.title)}<br><small>${esc(new Date(x.date).toLocaleDateString('it-IT'))}${x.command === 'ia' ? ' · Comando IA' : ''}</small></td><td>${lab[x.outcome] || '◐'} ${esc(x.text)}</td><td>${x.turns}</td><td>${x.medals}</td><td>${esc(x.captain)}</td><td><b>${x.score}</b></td></tr>`).join('')}</table>` : '<p>Nessuna missione conclusa finora.</p>', true));
}
/** Campaign: what happened in the mission stays in the archive and comes back in the next one. */
function vCampaignApply(G) {
  if (G.campaignDone || G.campaign === false) return; G.campaignDone = true; const med = VENTURE.medals(G); const out = { vittoria: 'vittoria', sconfitta: 'sconfitta', neutro: 'esito incerto' }[G.ended.tipo] || 'fine';
  G.crew.forEach((m) => { const c = archGet(m.archId); if (!c) return; const v = c.venture = c.venture || { missions: 0, log: [], medals: [] };
    const mine = med.filter((x) => x.to === m.name).map((x) => x.icon + ' ' + x.name); const trustCap = VENTURE.captain(G) && m.trust ? m.trust[VENTURE.captain(G).name] : null;
    v.missions++; v.medals = v.medals.concat(mine).slice(-20);
    v.log = v.log.concat([{ title: G.mission.title, outcome: out, turn: G.turn, note: [m.dead ? 'morto in servizio' : m.injured ? 'ferito' : '', mine.join(', '), trustCap != null && trustCap <= -2 ? 'in rotta con il capitano' : ''].filter(Boolean).join(', '), date: new Date().toISOString() }]).slice(-10);
    if (m.dead && c.status !== 'deceduto') { c.status = 'deceduto'; c.deaths = (c.deaths || []).concat(['venture:' + G.seed]); }
    archSave(c, `missione Venture «${G.mission.title}»`); });
  vSaveGame(G);
}

/* ---------- report and novel, like the island ---------- */
function vSlug(t) { return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'venture'; }
function vOnTop(el) { if (el) el.style.zIndex = 90; return el; }
function vOpenReport() { const G = VUI.G; if (!G) return; vOnTop(rpOpen(ventureReport(G), `resoconto-venture-${vSlug(G.mission.title)}-turno-${G.turn}.pdf`)); }
/** Writes the missing chapters (one main call each, plus the title), then lays the book out with the shared novelBook. */
async function vNovel(fmt, go) {
  const G = VUI.G; if (!G) return; if (VUI.novelBusy) { toastMsg('Sto già scrivendo il romanzo…'); return; }
  const blocks = VENTURE.novelBlocks(G); const miss = VENTURE.novelMissing(G);
  if (!G.turn || !blocks.length) { toastMsg('Non è ancora successo niente da raccontare: gioca almeno un turno.'); return; }
  if (!go) {
    const el = vOnTop(funCard('📖 Il romanzo della missione', `<p>Un capitolo ogni ${VENTURE.NOVEL_TURNS} turni: finora <b>${blocks.length}</b>. ${miss.length ? `Ne devo scrivere <b>${miss.length}</b>${miss.length < blocks.length ? ' (gli altri sono già pronti)' : ''}: ${miss.length + 1} chiamate.` : 'Sono già tutti scritti.'}${G.ended ? '' : ' La missione è in corso: il romanzo finirà con «continua…» e potrai riscaricarlo alla fine.'}</p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="primary" data-nv="pdf">📘 ${miss.length ? 'Scrivi e scarica' : 'Scarica'} (PDF)</button><button data-nv="txt">📄 Testo (.txt)</button>${!miss.length ? '<button data-nv="redo">↻ Riscrivi da capo</button>' : ''}</div>`));
    el.querySelectorAll('[data-nv]').forEach((b) => { b.onclick = () => { el.hidden = true; if (b.dataset.nv === 'redo') { G.novel = { chapters: {} }; vSaveGame(G); vNovel('pdf', true); } else vNovel(b.dataset.nv, true); }; }); return;
  }
  VUI.novelBusy = true; const set = (t) => toastMsg('📖 Romanzo: ' + t, true);
  try {
    for (let i = 0; i < miss.length; i++) { set(`✍ Capitolo ${miss[i]} (${i + 1}/${miss.length})…`); await VENTURE.novelChapter(G, miss[i], LLM.ask); vSaveGame(G); }
    set('✍ Titolo…'); const N = await VENTURE.novelTitle(G, LLM.ask); vSaveGame(G);
    const chapters = blocks.map((k) => (N.chapters || {})[k]).filter((c) => c && c.text);
    if (!chapters.length) { toastMsg('Non sono riuscito a scrivere i capitoli: riprova tra poco.'); return; }
    const title = N.title || G.mission.title;
    await novelBook({ title, epigraph: N.epigraph, cast: G.crew.map((c) => ({ name: c.name, line: `${c.name}, ${VENTURE.STATION_LABEL[c.station]}, ${c.age} anni${c.short ? ' — ' + c.short : ''}` })), chapters, ended: !!G.ended, base: 'romanzo-' + vSlug(title), fmt, onStep: set });
  } catch (e) { toastMsg(e && e.code === 'rate_limited' ? 'Claude chiede di rallentare: i capitoli scritti finora sono salvati, riprova tra qualche minuto.' : 'Non riesco a finire il romanzo ora; i capitoli già scritti restano salvati.'); }
  finally { VUI.novelBusy = false; }
}
window.__venture = { vOpenBets, vAgendaGame, vShowRanking, vAskCommand, vOpenReport, vNovel, vOpenSetup, vPlay, VUI, vLoadGame, VENTURE, LLM };
