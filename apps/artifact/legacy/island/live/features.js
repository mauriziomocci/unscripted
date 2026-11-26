/* ===== Story features (inserted inside the engine closure, after env.js) =====
   mysteries, rare events, camp objects that work, letters, proposals, animal trust,
   predictions, episodes, medals, scenarios, earned rescue */

/* ---------- scenarios: ready-made experiments with a research question ---------- */
const SCENARIOS = {
  libero: { label: 'Libero', q: 'Come si comporta una persona comune sola su un\'isola?' },
  gruppo: { label: 'Gruppo di quattro', q: 'In un piccolo gruppo emergono un leader, alleanze e conflitti? La cooperazione regge quando il cibo scarseggia?' },
  coppia: { label: 'Due naufraghi', q: 'La presenza di un altro essere umano protegge la mente o crea nuovi conflitti?' },
  senza_taccuino: { label: 'Senza taccuino', q: 'Senza poter scrivere, come cambiano memoria, rituali e salute mentale?' },
  con_cane: { label: 'Con un cane', q: 'Un animale da compagnia riduce gli effetti dell\'isolamento?' },
  amnesia: { label: 'Amnesia ogni notte', q: 'Senza memoria da un giorno all\'altro, si possono costruire strategie e identità?' },
  senza_cassa: { label: 'Senza attrezzi', q: 'Senza attrezzi, quanto contano ingegno e improvvisazione?' },
};
function initFeatures(setup) {
  const W = G.world; const r = IslandSim.rngFrom((G.seed || 1) * 101 + (ISL.seed || 0));
  G.scenario = SCENARIOS[setup.scenario] ? setup.scenario : 'libero';
  G.medals = {}; G.predictions = []; G.episodes = []; G.letters = []; W.proposals = [];
  // mysteries hidden on this island
  const kinds = ['capanna', 'relitto', 'scatola', 'graffiti', 'tomba'].filter(() => r() < 0.45);
  if (!kinds.length && r() < 0.6) kinds.push(['capanna', 'relitto', 'scatola'][Math.floor(r() * 3)]);
  W.secrets = kinds.map((k, i) => ({ id: i + 1, kind: k, found: false, place: { capanna: 'boscaglia', relitto: 'scogli', scatola: 'spiaggia_ovest', graffiti: RES.cave || 'collina', tomba: 'collina' }[k] }));
  W.secrets.forEach((sc) => { // what is visible from the start
    const at = PLACES[sc.place] ? PLACES[sc.place].loc : LOC.beach; const off = [at[0] + 1.6, at[1] - 1.2];
    if (sc.kind === 'capanna') W.custom.push({ name: 'capanna crollata', desc: 'pali anneriti e foglie marce: qualcuno ci ha vissuto, tanto tempo fa', loc: off, id: G.nextId++, portable: false, secret: sc.id, parts: [{ f: 'cil', d: [0.06, 1.6], p: [-0.8, 0.8, -0.6], r: [0, 0, 12], c: '#5a4630' }, { f: 'cil', d: [0.06, 1.1], p: [0.8, 0.5, -0.6], r: [0, 0, -25], c: '#5a4630' }, { f: 'cil', d: [0.05, 1.9], p: [0, 0.3, 0.2], r: [0, 0, 80], c: '#4a3a28' }, { f: 'box', d: [1.6, 0.08, 1.2], p: [0.1, 0.12, 0], r: [8, 0, 6], c: '#6b6b3a' }] });
    if (sc.kind === 'relitto') W.custom.push({ name: 'relitto di una barca', desc: 'lo scafo rovesciato tra gli scogli, si raggiunge solo con la bassa marea', loc: ISL.shoreAt(Math.atan2(at[1], at[0]), 1.2), id: G.nextId++, portable: false, secret: sc.id, parts: [{ f: 'box', d: [1.2, 0.5, 3.2], p: [0, 0.1, 0], r: [0, 25, 160], c: '#3d4a52' }, { f: 'box', d: [0.15, 0.6, 1.4], p: [0.5, 0.4, 0.4], r: [20, 25, 0], c: '#6b4a2b' }] });
    if (sc.kind === 'tomba') W.custom.push({ name: 'mucchio di pietre con una croce', desc: 'una croce di legno consumata dal sole sopra un cumulo di pietre', loc: off, id: G.nextId++, portable: false, secret: sc.id, parts: [{ f: 'sfera', d: [0.5], p: [0, 0.1, 0], c: '#8f8a80' }, { f: 'box', d: [0.06, 0.8, 0.06], p: [0, 0.6, 0], c: '#7a6a50' }, { f: 'box', d: [0.4, 0.06, 0.06], p: [0, 0.8, 0], c: '#7a6a50' }] });
  });
  // rare events on a calendar
  const D = G.maxDays || 60;
  G.rare = { cyclone: r() < 0.3 ? { day: 6 + Math.floor(r() * Math.max(4, D - 9)), len: 2 + Math.floor(r() * 2) } : null, eclipse: r() < 0.12 ? 3 + Math.floor(r() * Math.max(3, D - 4)) : null, lane: 0.3 + r() * 1.2 };
  // the broken radio and its three missing parts, hidden in different places
  const big = ISL.S > 1; const pick = (a2, b2) => (PLACES[a2] ? a2 : b2);
  W.radio = { found: false, fixed: false, at: pick(big ? 'capanno' : 'scogli', 'scogli'), parts: { batteria: pick(big ? 'spiaggia_est' : 'spiaggia_ovest', 'spiaggia'), antenna: pick(big ? 'falesia' : 'collina', 'collina'), cavo: pick(big ? 'palude' : 'boscaglia', 'boscaglia') }, got: {} };
  G.rare.second = r() < 0.6 ? { day: 4 + Math.floor(r() * 5), done: false } : null;
  G.rare.hostile = r() < 0.3 ? { day: 9 + Math.floor(r() * 6), done: false } : null;
  G.rare.forestFire = big && r() < 0.35 ? { day: 5 + Math.floor(r() * 10), done: false } : null;
  G.age = 0;
  // scenario set-up
  const p0 = G.agents[0];
  const castSet = Array.isArray(setup.cast) && setup.cast.length > 1; // companions already chosen in the setup
  if (G.scenario === 'gruppo' && !castSet) {
    [['Lucia', 'f', 41, 'infermiera, pratica e diffidente, fuma quando è nervosa'], ['Davide', 'm', 29, 'cuoco, chiacchierone, ottimista fino all\'ingenuità'], ['Karim', 'm', 39, 'meccanico ingegnoso, sospettoso con chi non conosce, tende a comandare']].forEach((pr) => applyOps([{ tipo: 'aggiungi_persona', nome: pr[0], sesso: pr[1], eta: pr[2], carattere: pr[3], arrivo: 'svegliato sulla stessa spiaggia, poco lontano' }], 'scenario'));
  }
  if (G.scenario === 'senza_taccuino') { W.notebookPresent = false; p0.hasNotebook = false; }
  if (G.scenario === 'con_cane') { W.dog = true; W.dogTrust = 25; }
  if (G.scenario === 'amnesia') p0.amnesia = true;
  if (G.scenario === 'senza_cassa') { W.axe = false; W.knife = false; W.rod = false; W.rope = false; W.custom = W.custom.filter((c) => !c.inCrate); }
  if (G.scenario === 'coppia' && !castSet) {
    const pr = [['Lucia', 'f', 41, 'infermiera, pratica e diffidente, fuma quando è nervosa'], ['Davide', 'm', 29, 'cuoco, chiacchierone, ottimista fino all\'ingenuità'], ['Sara', 'f', 52, 'ingegnera in pensione, metodica, poco paziente'], ['Tommaso', 'm', 63, 'pescatore, silenzioso, credente']][Math.floor(r() * 4)];
    applyOps([{ tipo: 'aggiungi_persona', nome: pr[0], sesso: pr[1], eta: pr[2], carattere: pr[3], arrivo: 'svegliato sulla stessa spiaggia, poco lontano' }], 'scenario');
  }
}

/* ---------- mysteries: discovered by exploring, interpreted by the character ---------- */
async function revealSecret(a, sc) {
  const W = G.world; sc.found = { day: G.day, by: a.name };
  const at = PLACES[sc.place] ? PLACES[sc.place].loc : a.pos;
  const describe = async (what) => { if (!SAMPLE) return null; try { return await ask('mistero', `Su un'isola deserta tropicale una persona trova: ${what}. Inventa il contenuto in modo realistico e sobrio, coerente con un vecchio naufragio di molti anni fa (non soprannaturale, niente tesori, ambiguo quanto basta da far pensare). Rispondi SOLO con JSON: {"testo":"ciò che legge o vede, 2-6 frasi, con le imperfezioni del caso (parole illeggibili, date sbiadite)","oggetti":["0-2 oggetti trovati, concreti e umili"]}`, 'quick'); } catch (e) { return null; } };
  let text = '', items = [];
  if (sc.kind === 'capanna') { const o = await describe('tra i resti di una capanna crollata, un quaderno gonfio d\'umidità avvolto in tela cerata'); text = (o && o.testo) || 'pagine incollate dall\'umidità; si legge solo «…il quarto mese… nessuna vela…»'; items = (o && o.oggetti) || []; W.custom.push({ name: 'diario di un vecchio naufrago', desc: text.slice(0, 300), use: 'leggerlo, rileggerlo', loc: [at[0] + 1.2, at[1] - 0.8], id: G.nextId++, portable: true, addedAt: T(), parts: [{ f: 'box', d: [0.2, 0.05, 0.27], p: [0, 0.03, 0], c: '#6d4a2f' }] }); }
  if (sc.kind === 'relitto') { const loot = ['cassetta degli attrezzi arrugginita', 'lenza con ami ancora buoni', 'telo cerato', 'razzo di segnalazione'][Math.floor(Math.random() * 4)]; items = [loot]; text = `dentro lo scafo, incastrato sotto una panca: ${loot}`; }
  if (sc.kind === 'scatola') { const o = await describe('una scatola di latta sepolta nella sabbia, chiusa con il fil di ferro'); text = (o && o.testo) || 'dentro: una foto sbiadita di una donna e un biglietto con una data'; items = (o && o.oggetti) || []; }
  if (sc.kind === 'graffiti') { const o = await describe('incisioni sulla roccia: file di tacche e qualche parola'); text = (o && o.testo) || 'centinaia di tacche raggruppate a cinque, e una parola: «ASPETTO»'; }
  if (sc.kind === 'tomba') { text = 'sotto la croce, incise col coltello, due iniziali e un anno di quarant\'anni fa'; a.stats.mente = clamp(a.stats.mente - 5); a.stats.ansia = clamp((a.stats.ansia || 30) + 12); }
  items.slice(0, 2).forEach((it) => W.custom.push({ name: String(it).slice(0, 40), desc: 'trovato: ' + sc.kind, loc: [at[0] + 0.8, at[1] + 0.6], id: G.nextId++, portable: true, addedAt: T(), parts: null }));
  sc.text = text;
  remember(a, `hai scoperto qualcosa: ${text}`); a.morningNotes.push(`non riesci a smettere di pensare a ciò che hai trovato: ${text.slice(0, 120)}`);
  chron(`🔎 ${a.name} scopre ${{ capanna: 'i resti di una capanna e un vecchio diario', relitto: 'qualcosa dentro il relitto', scatola: 'una scatola sepolta', graffiti: 'delle incisioni sulla roccia', tomba: 'una tomba' }[sc.kind]}.`, 'event');
  medal('mistero', `${a.name} ha svelato un mistero dell'isola`);
  emit('onChange'); save();
}
function secretCheck(a, t, p, res, add) {
  const W = G.world; const here = placeOf(a.pos).name; const d = String((p && (p.descrizione || p.cosa || p.oggetto || '')) || '').toLowerCase();
  (W.secrets || []).forEach((sc) => {
    if (sc.found || sc.pending || here !== sc.place) return;
    const looking = t === 'esplora' || t === 'osserva' || (t === 'altro' && /scav|cerc|frug|guard|ispezion|entr/.test(d)) || ((t === 'usa_oggetto' || t === 'raccogli') && /capanna|relitto|croce|pietre|incision/.test(d));
    if (!looking) return;
    if (sc.kind === 'relitto' && !W.pools) { if (Math.random() < 0.5) add.push('il relitto tra gli scogli è sommerso dalla marea: si potrebbe raggiungere solo con l\'acqua bassa'); return; }
    if (sc.kind === 'scatola' && !(t === 'altro' && /scav/.test(d)) && Math.random() > 0.25) return;
    sc.pending = true; revealSecret(a, sc).finally(() => { sc.pending = false; });
  });
}

/* ---------- camp objects that actually work ---------- */
const FN_WORDS = { acqua: /raccoglit|cistern|serbatoi|grondaia|telo.*acqua|acqua.*telo/, essiccare: /essicc|affumic|rastrellier|graticc/, trappola: /trappol|nassa|lacci/, riparo: /tettoia|capanna|riparo|tenda/, giaciglio: /giaciglio|amaca|letto/, segnale: /bandier|segnal|sos|specchi|falò/ };
function objFn(o) { if (o.fn) return o.fn; const n = (o.name + ' ' + (o.desc || '')).toLowerCase(); return Object.keys(FN_WORDS).find((k) => FN_WORDS[k].test(n)) || null; }
function campObjects(fn) { return G.world.custom.filter((c) => !c.animal && objFn(c) === fn); }
function objectsHour(w) {
  if (w.rain > 0.3 && (alive().some((a) => a.inv.items.some((x) => /telo/.test(x))) || G.world.custom.some((c) => /telo/.test(c.name) && !(c.inCrate && G.world.crateOpened === false)))) G.world.tarpWater = Math.min(40, (G.world.tarpWater || 0) + 10 * w.rain);
  campObjects('acqua').forEach((o) => { o.water = Math.min(40, (o.water || 0) + (w.rain > 0.3 ? 10 * w.rain : 0) + (G.h > 4 && G.h < 7 && w.cloud < 0.6 ? 0.6 : 0)); });
}
function objectsDay() {
  campObjects('trappola').forEach((o) => { if (!o.catch && Math.random() < 0.35 * (RES.crabs || 1)) o.catch = Math.random() < 0.6 ? 'granchio' : 'pesce'; });
}

/* ---------- rare events ---------- */
function rareHour(w) {
  const W = G.world; const R0 = G.rare || {}; const night = G.h < 6 || G.h > 19.5;
  // a cyclone on its scheduled day
  if (R0.cyclone && !G.paradise && G.day === R0.cyclone.day && Math.floor(G.h) === 4 && !R0.cyclone.started) { R0.cyclone.started = true; G.wxOverride = { from: T(), to: T() + 24 * R0.cyclone.len, w: Object.assign({}, PRESETS.temporale, { label: 'Ciclone', wind: 1.3, sea: 'agitato', tMax: 24, tMin: 21 }) }; chron('🌀 Arriva un ciclone: cielo nero, vento che urla, mare in tempesta.', 'event'); interruptAll('il cielo si fa nero e il vento comincia a urlare: arriva qualcosa di grosso'); }
  if (R0.cyclone && R0.cyclone.started && W.shelter > 0 && w.storm && Math.random() < 0.12) { W.shelter -= 1; chron('🌀 Il ciclone strappa via parte del riparo.', 'event'); }
  if (R0.eclipse === G.day && G.h >= 11 && G.h < 12 && !W.eclipseSeen) { W.eclipseSeen = true; W.eclipseUntil = T() + 1; chron('🌑 Il sole si oscura in pieno giorno: un\'eclissi.', 'event'); interruptAll('in pieno giorno la luce cala, il sole si sta oscurando'); }
  // a plane very high: it can see a big signal
  if (!night && w.cloud < 0.7 && Math.random() < 0.006 * (R0.lane || 1)) { W.planeAt = T(); chron('✈️ Un aereo passa altissimo sopra l\'isola.', 'event'); alive().forEach((a) => { if (!a.asleep) remember(a, 'hai visto un aereo passare altissimo, una scia bianca nel cielo'); });
    if ((W.sos || 0) >= 1 || W.bonfireUntil > T() || campObjects('segnale').length) { if (Math.random() < 0.3 + 0.1 * campObjects('segnale').length) { W.shipEvents.push({ day: G.day + 1, h: 10 + Math.random() * 5, dur: 2, mode: 'approach' }); W.planeSaw = true; } } }
  if (night && Math.random() < 0.004 * (R0.lane || 1)) { W.lightsAt = T(); chron('💡 Di notte, luci lontane all\'orizzonte.', 'event'); alive().forEach((a) => { if (!a.asleep) { remember(a, 'nel buio hai visto delle luci lontane all\'orizzonte, poi sono sparite'); a.stats.ansia = clamp((a.stats.ansia || 30) + 8); } }); }
  if (!night && Math.random() < 0.0012 && !W.custom.some((c) => /barca alla deriva/.test(c.name))) { const ang = Math.random() * Math.PI * 2; W.custom.push({ name: 'barca alla deriva', desc: 'una piccola barca vuota che le correnti spingono vicino alla costa: tra qualche ora sarà lontana', loc: ISL.shoreAt(ang, 6), id: G.nextId++, portable: false, addedAt: T(), expires: T() + 6, drift: 'barca', parts: [{ f: 'box', d: [0.9, 0.35, 2.6], p: [0, 0.1, 0], c: '#c8c2b0' }, { f: 'box', d: [0.8, 0.05, 0.2], p: [0, 0.3, 0.3], c: '#7a5a3a' }] }); chron('🛶 Una barca vuota va alla deriva vicino alla costa.', 'event'); interruptAll('in mare, vicino alla costa, galleggia una piccola barca vuota'); }
  W.custom = W.custom.filter((c) => !c.expires || c.expires > T() || c.reached);
  // more ships pass where the island is near a shipping lane
  if (!W.shipNow && !night && Math.random() < 0.0025 * (R0.lane || 1)) W.shipEvents.push({ day: G.day, h: G.h + 0.1, dur: 1.6, mode: 'pass' });
  // a passing ship notices the island only if there is something to notice
  if (W.shipNow && !W.rescueTurn && W.shipNow.mode === 'pass') {
    const sunny = w.cloud < 0.4 && !night; const someoneOnShore = alive().some((a) => !a.asleep && /spiaggia|riva|scogli|collina/.test(placeOf(a.pos).name));
    let p = 0;
    if (W.bonfireUntil > T()) p += 0.5; if (W.tower) p += 0.12;
    if (W.fireUntil > T() && (W.wetWood || 0) > 0) p += 0.15; // smoke
    if ((W.sos || 0) >= 1) p += 0.08 * Math.min(3, W.sos);
    p += 0.08 * Math.min(3, campObjects('segnale').length);
    if (sunny && someoneOnShore && alive().some((a) => a.inv.items.some((x) => /specchi/.test(x)))) p += 0.25;
    if (p > 0 && Math.random() < Math.min(0.9, p)) { W.rescueTurn = true; chron('🚢 Dalla nave hanno notato i segnali: vira verso l\'isola!', 'event'); interruptAll('la nave sta cambiando rotta, viene verso l\'isola'); }
  }
}

/* ---------- animal companion ---------- */
function dogHour() {
  const W = G.world; if (!W.dog) return; if (W.dogTrust == null) W.dogTrust = 20;
  const near = alive().some((a) => dist(a.pos, W.dogPos || LOC.beach) < 4 && !a.asleep);
  W.dogTrust = clamp(W.dogTrust + (near ? 0.05 : -0.08));
  alive().forEach((a) => { if (W.dogTrust > 55 && !a.asleep) a.stats.mente = clamp(a.stats.mente + 0.08); });
  if (W.dogTrust >= 80) medal('amico', 'il cane si fida completamente');
}
function dogText() {
  const W = G.world; if (!W.dog) return ''; const t = W.dogTrust == null ? 20 : W.dogTrust;
  return t < 25 ? 'Il cane ti osserva da lontano, diffidente: se ti avvicini si allontana.' : t < 55 ? 'Il cane ti gira intorno a qualche metro, curioso ma prudente.' : t < 80 ? 'Il cane ti segue quasi ovunque e scodinzola quando parli.' : 'Il cane non ti lascia mai: dorme accanto a te e ti guarda negli occhi quando gli parli.';
}

/* ---------- medals (for the observer, they never guide the character) ---------- */
const MEDALS = { fuoco: '🔥 Primo fuoco', settimana: '📅 Una settimana', mese: '🗓️ Un mese', riparo: '🛖 Riparo completo', esploratore: '🧭 Ha esplorato tutta l\'isola', pescatore: '🎣 Pescatore', lettera: '✉️ Prima lettera', mistero: '🔎 Ha svelato un mistero', amico: '🐕 Amico fedele', volto: '⚽ Ha dato un volto al pallone', calma: '🧘 Una settimana senza crisi', costruttore: '🔨 Costruttore', salvato: '🚢 Salvato', senzaattrezzi: '🪨 Sopravvissuto senza attrezzi' };
function medal(key, why) { G.medals = G.medals || {}; if (G.medals[key]) return; G.medals[key] = { day: G.day, h: G.h, why }; chron(`🏅 ${MEDALS[key] || key}${why ? ' — ' + why : ''}`, 'medal'); highlight(`🏅 ${MEDALS[key] || key}`, (G.agents[0] || {}).pos, 'medal'); }
function medalsHour() {
  const W = G.world; const al = alive();
  if (G.firstFire) medal('fuoco'); if (G.day >= 8 && al.length) medal('settimana'); if (G.day >= 31 && al.length) medal('mese');
  if (W.shelter >= 3) medal('riparo'); if (W.ballFace) medal('volto');
  if (al.some((a) => (a.known || []).length >= Object.keys(PLACES).length)) medal('esploratore');
  if (al.some((a) => (a.skill.fish || 0) >= 10)) medal('pescatore');
  if (W.custom.filter((c) => c.madeBy).length >= 3) medal('costruttore');
  if (G.scenario === 'senza_cassa' && G.day >= 8 && al.length) medal('senzaattrezzi');
  al.forEach((a) => { a.calmDays = a.stats.mente > 40 ? (a.calmDays || 0) + 1 / 24 : 0; if (a.calmDays >= 7) medal('calma', a.name); });
}

/* ---------- predictions by the observer, judged at their deadline ---------- */
async function judgePredictions() {
  if (!SAMPLE) return;
  for (const p of (G.predictions || []).filter((x) => x.result == null && G.day > x.byDay)) {
    const facts = G.chronicle.filter((c) => c.day <= p.byDay).slice(-120).map((c) => `G${c.day}: ${c.text}`).join('\n');
    try { const out = await ask('previsione', `Valuta se questa previsione su una simulazione si è avverata entro la fine del giorno ${p.byDay}. Previsione: «${p.text}». Fatti dalla cronaca:\n${facts}\nRispondi SOLO con JSON: {"avverata":true|false,"spiegazione":"1 frase"}`, 'quick');
      p.result = !!(out && out.avverata); p.why = String((out && out.spiegazione) || '').slice(0, 200); chron(`🎯 Previsione ${p.result ? 'AVVERATA' : 'sbagliata'}: «${p.text}»`, 'medal'); } catch (e) {}
  }
  save();
}
function addPrediction(text, byDay) { G.predictions = G.predictions || []; G.predictions.push({ text: String(text).slice(0, 200), byDay: Math.max(G.day, Number(byDay) || G.day), made: G.day, result: null }); save(); }

/* ---------- weekly episodes ---------- */
async function weeklyEpisode(lastDay) {
  if (!SAMPLE || G.economy) return;
  const n = Math.ceil(lastDay / 7); if ((G.episodes || []).some((e) => e.n === n)) return;
  const src = (G.stories || []).filter((s) => s.day > lastDay - 7).map((s) => `Giorno ${s.day} — ${s.title}: ${s.text}`).join('\n\n') || G.chronicle.filter((c) => c.day > lastDay - 7).map((c) => c.text).slice(-80).join('\n');
  try { const out = await ask('episodio', `Sei lo sceneggiatore di una serie su un esperimento sociale: un naufrago su un'isola. Scrivi la puntata ${n} (giorni ${lastDay - 6}-${lastDay}) a partire da questi fatti, senza inventare eventi.\n${src}\nRispondi SOLO con JSON: {"titolo":"titolo della puntata","riassunto":"80-140 parole, al presente, coinvolgente","cliffhanger":"1 frase sospesa su ciò che potrebbe accadere"}`, 'quick');
    if (out && out.riassunto) { G.episodes = G.episodes || []; G.episodes.push({ n, from: lastDay - 6, to: lastDay, title: String(out.titolo || `Puntata ${n}`).slice(0, 80), text: String(out.riassunto).slice(0, 1500), hook: String(out.cliffhanger || '').slice(0, 200) }); chron(`📺 Puntata ${n}: ${out.titolo || ''}`, 'medal'); save(); } } catch (e) {}
}

/* ---------- end-of-experiment analysis for scenarios ---------- */
async function scenarioAnalysis() {
  if (!SAMPLE) return; const sc = SCENARIOS[G.scenario || 'libero'];
  const data = { scenario: sc.label, domanda: sc.q, giorni: G.day, esito: G.ended, persone: G.agents.map((a) => ({ nome: a.name, vivo: a.alive, causa: a.deathCause, progetti: a.projects, relazioni: a.relations })), andamento: G.history, momenti: (G.highlights || []).slice(-30).map((h) => `G${h.day}: ${h.text}`), medaglie: Object.keys(G.medals || {}) };
  try { const out = await ask('analisi', `Sei uno psicologo che analizza un esperimento sociale simulato. Rispondi alla domanda dello scenario usando solo questi dati, con prudenza scientifica (è una sola partita). 150-250 parole.\n${JSON.stringify(data)}\nRispondi SOLO con JSON: {"analisi":"..."}`, 'mind'); if (out && out.analisi) { G.analysis = String(out.analisi).slice(0, 3000); emit('onChange'); save(); } } catch (e) {}
}

/* ---------- hooks used by the engine ---------- */
function featuresAfter(a, t, p, res, add) {
  const W = G.world; const here = placeOf(a.pos).name;
  secretCheck(a, t, p, res, add); radioFind(a, t, add);
  if (PLACES.capanno && !W.hutFound && here === 'capanno' && ['vai', 'esplora', 'osserva', 'raccogli', 'altro', 'usa_oggetto'].includes(t)) {
    W.hutFound = true; const L = PLACES.capanno.loc;
    const loot = [['machete arrugginito', 'una lama lunga e arrugginita, ancora tagliente', 'tagliare rami, liane, aprire il cocco: fa il lavoro di un\'ascia leggera', 'axe', [{ f: 'box', d: [0.05, 0.02, 0.5], p: [0, 0.02, 0.2], c: '#8a8a88' }, { f: 'cil', d: [0.025, 0.18], p: [0, 0.02, -0.12], r: [90, 0, 0], c: '#4a3420' }]],
      ['rotolo di corda vecchia', 'corda di canapa, un po\' sfilacciata', 'legare travi, costruire, pescare', 'rope', [{ f: 'cil', d: [0.14, 0.08], p: [0, 0.04, 0], c: '#b89a68' }]],
      ['barattolo di chiodi', 'un barattolo di latta con chiodi storti e arrugginiti', 'fissare assi e travi: le costruzioni di legno vengono più solide', null, [{ f: 'cil', d: [0.07, 0.14], p: [0, 0.07, 0], c: '#9a9a90' }]]];
    loot.forEach(([name, desc, use, tool, parts], i) => W.custom.push({ name, desc, use, tool: tool || undefined, loc: [L[0] + 0.8 - i * 0.5, L[1] + 0.9], portable: true, completed: true, parts, id: G.nextId++ }));
    chron(`🛖 ${a.name} esplora la vecchia baracca: dentro ci sono degli attrezzi abbandonati.`, 'event'); highlight(`${a.name} trova la baracca di un naufrago precedente`, L, 'discovery');
    add.push('dentro la baracca, tra assi marce e foglie secche, ci sono un machete arrugginito, un rotolo di corda vecchia e un barattolo di chiodi: qualcuno è vissuto qui prima di te');
  }
  // drink from a rain collector
  if (t === 'bevi' && /non c'è acqua/.test(res)) { const o = campObjects('acqua').find((o) => dist(a.pos, o.loc) < 4.5 && (o.water || 0) >= 5); if (o) { o.water -= 10; a.stats.hyd = clamp(a.stats.hyd + 40); add.push(`hai bevuto l'acqua raccolta da ${o.name}`); return 'ok'; } }
  // empty a trap
  if ((t === 'raccogli' || t === 'usa_oggetto') && /trappol|nassa/.test(String(p.cosa || p.oggetto || ''))) { const o = campObjects('trappola').find((o) => dist(a.pos, o.loc) < 4.5); if (o && o.catch) { if (o.catch === 'pesce') a.inv.fish++; else a.inv.crabs++; add.push(`nella trappola c'era un ${o.catch}`); o.catch = null; } }
  // reaching the drifting boat
  if (t === 'altro' && /barca/.test(String(p.descrizione || '')) && /nuot|raggiung|tuff/.test(String(p.descrizione || ''))) { const b = W.custom.find((c) => /barca alla deriva/.test(c.name)); if (b && !b.reached) { if (weatherNow().desc.sea === 'agitato' || Math.random() < 0.3) { a.stats.en = clamp(a.stats.en - 25); add.push('la corrente era troppo forte: sei tornato a riva sfinito'); } else { b.reached = true; b.expires = 0; b.loc = ISL.shoreAt(Math.atan2(a.pos[1], a.pos[0]), -0.6); b.portable = false; b.desc = 'trascinata a riva: una vecchia barca di vetroresina con un remo'; add.push('hai raggiunto la barca e l\'hai trascinata a riva'); chron(`🛶 ${a.name} raggiunge a nuoto la barca alla deriva e la porta a riva.`, 'event'); W.custom.push({ name: 'remo', desc: 'un remo di legno', loc: [b.loc[0] + 0.5, b.loc[1]], id: G.nextId++, portable: true, addedAt: T() }); } } }
  // first aid kit: disinfect and dress wounds (limited uses)
  if ((t === 'usa_oggetto' && /kit|pronto|disinfett|bend|medic/.test(String(p.oggetto || p.cosa || '') + ' ' + String(p.come || ''))) || (t === 'altro' && /disinfett|medic|bend|cur.*ferit/.test(String(p.descrizione || '')))) {
    if (hasGear(a, /kit di pronto/)) { G.firstAidUses = (G.firstAidUses || 0) + 1; if (G.firstAidUses <= 6) { (a.wounds || []).forEach((x) => { x.infected = false; x.sev *= 0.5; }); a.stats.ansia = clamp((a.stats.ansia || 30) - 5); add.push(`hai pulito e fasciato le ferite con il kit (${6 - G.firstAidUses} usi rimasti)`); } else add.push('il kit è finito: niente più disinfettante né garze'); }
  }
  // the flare
  if (t === 'usa_oggetto' && /razzo/.test(String(p.oggetto || p.cosa || ''))) { const i = a.inv.items.findIndex((x) => /razzo/.test(x)); if (i >= 0) { a.inv.items.splice(i, 1); chron(`🎆 ${a.name} spara il razzo di segnalazione.`, 'event'); if (W.shipNow && !W.rescueTurn && Math.random() < 0.85) { W.rescueTurn = true; chron('🚢 Dalla nave hanno visto il razzo: vira verso l\'isola!', 'event'); } else add.push('il razzo sale rosso nel cielo vuoto e si spegne'); } }
  // gifts to the dog build trust
  if (t === 'dai' && /cane/.test(String(p.a || '')) && W.dog) { if (/pesc/.test(p.cosa || '') && a.inv.fish) a.inv.fish--; else if (/granch/.test(p.cosa || '') && a.inv.crabs) a.inv.crabs--; W.dogTrust = clamp((W.dogTrust || 20) + 15); add.push('il cane ha mangiato dalla tua mano'); }
  if (t === 'gioca_pallone' && W.dog) W.dogTrust = clamp((W.dogTrust || 20) + 4);
  if (t === 'parla' && /cane/.test(String(p.a || '')) && W.dog) W.dogTrust = clamp((W.dogTrust || 20) + 2);
  return null;
}

/* ---------- ages of survival (a progression the observer sees; reaching one opens new possibilities) ---------- */
const AGES = ['Naufrago', 'Sopravvissuto', 'Abitante', 'Costruttore', 'Salvezza'];
function ageCheck() {
  const W = G.world; const cur = G.age || 0; let next = cur;
  const s1 = W.fireEverLit && W.ateOnce && (W.shelter || 0) >= 1;
  const s2 = s1 && (W.shelter || 0) >= 3 && W.bed && (W.hearth || W.custom.some((c) => objFn(c) === 'acqua') || hasGearAny(/bottigli|pentolin/)) && G.day >= 3;
  const s3 = s2 && (W.wall || W.hutRepaired) && ((W.builtCount || 0) >= 2 || W.garden || (W.raft || 0) >= 2);
  const s4 = G.rescued || (W.radio && W.radio.fixed);
  if (s4) next = 4; else if (s3) next = Math.max(cur, 3); else if (s2) next = Math.max(cur, 2); else if (s1) next = Math.max(cur, 1);
  if (next > cur) { G.age = next; chron(`🏛 Nuova età: ${AGES[next]}.`, 'event'); highlight(`Età della sopravvivenza: ${AGES[next]}`, null, 'age'); emit('onEvent', { kind: 'age', text: AGES[next] }); }
}
function hasGearAny(re) { return G.agents.some((p2) => p2.alive && typeof hasGear === 'function' && hasGear(p2, re)); }
/* ---------- the radio quest: finding the radio and its parts ---------- */
function radioFind(a, t, add) {
  const W = G.world; const R2 = W.radio; if (!R2) return; const here = placeOf(a.pos).name;
  if (!['vai', 'esplora', 'osserva', 'raccogli', 'altro', 'usa_oggetto', 'scava'].includes(t)) return;
  if (!R2.found && here === R2.at) { R2.found = true; a.inv.items.push('radio da campo rotta'); chron(`📻 ${a.name} trova una vecchia radio da campo.`, 'event'); highlight(`${a.name} trova una radio rotta`, a.pos, 'discovery');
    add.push('tra i rottami trovi una vecchia radio da campo militare, ammaccata: mancano la batteria, l\'antenna e il cavo che la collegava. Se si trovassero, forse...'); }
  const PART = { batteria: ['batteria d\'auto corrosa', 'una vecchia batteria d\'auto mezza sepolta, i poli incrostati: forse ha ancora un po\' di carica'], antenna: ['antenna telescopica', 'un\'antenna telescopica incastrata tra le rocce, un po\' piegata'], cavo: ['matassa di cavo elettrico', 'una matassa di cavo elettrico impigliata tra le canne, ancora integro'] };
  Object.entries(R2.parts).forEach(([k, pl]) => { if (!R2.got[k] && here === pl && Math.random() < (t === 'esplora' || t === 'osserva' ? 0.7 : 0.35)) { R2.got[k] = true; a.inv.items.push(PART[k][0]); chron(`🔩 ${a.name} trova: ${PART[k][0]}.`, 'event'); highlight(`${a.name} trova ${PART[k][0]}`, a.pos, 'discovery'); add.push('trovi ' + PART[k][1]); } });
}
/* ---------- narrative events: a second castaway, a hostile stranger, a forest fire ---------- */
function storyHour(w) {
  const W = G.world; const R0 = G.rare || {}; if (!G.rare) return;
  if (R0.second && !R0.second.done && G.day >= R0.second.day && G.h >= 10) { R0.second.done = true; const pr = [['Elisa', 'f', 33, 'fotografa, curiosa, si scoraggia in fretta ma si riprende'], ['Marco', 'm', 45, 'ex militare, pratico, chiuso, dorme poco']][Math.floor(Math.random() * 2)];
    applyOps([{ tipo: 'aggiungi_persona', nome: pr[0], sesso: pr[1], eta: pr[2], carattere: pr[3], arrivo: 'aggrappato a un rottame, arriva a riva stremato: un altro naufragio' }], 'evento'); highlight(`Un altro naufrago arriva a riva: ${pr[0]}`, LOC.beach, 'event'); }
  if (R0.hostile && !R0.hostile.done && !G.paradise && G.day >= R0.hostile.day && G.h >= 16) { R0.hostile.done = true;
    applyOps([{ tipo: 'aggiungi_persona', nome: 'Viktor', sesso: 'm', eta: 50, carattere: 'egoista e minaccioso, convinto che ognuno debba pensare a sé; ruba cibo e attrezzi quando nessuno guarda, ma ha paura di restare solo', arrivo: 'sbarca da un canotto sgonfio sulla spiaggia, con uno sguardo duro' }], 'evento'); highlight('Sbarca uno sconosciuto dallo sguardo duro', LOC.beach, 'event'); }
  if (R0.forestFire && !R0.forestFire.done && !G.paradise && G.day >= R0.forestFire.day && G.h >= 13 && w.rain < 0.1 && PLACES.foresta) { R0.forestFire.done = true; W.forestWood = Math.max(5, (W.forestWood || 0) - 55); W.forestFruit = 0; W.forestBurnt = G.day;
    chron('🔥 Un incendio divampa nella foresta! Fumo nero sale verso il cielo.', 'event'); highlight('Incendio nella foresta', PLACES.foresta.loc, 'event');
    alive().forEach((a) => { const d = dist(a.pos, PLACES.foresta.loc); if (d < 14) { hurt(a, 12, 'ustioni'); a.injury = 'ustioni e fumo nei polmoni dall\'incendio'; } if (d < 40) interrupt(a, d < 14 ? 'la foresta intorno a te prende fuoco: fiamme e fumo' : 'una colonna di fumo nero sale dalla foresta'); });
    // a fire on a desert island can be seen from far away
    if (!W.shipEvents.some((s) => s.day === G.day + 1)) W.shipEvents.push({ day: G.day + 1, h: 9 + Math.random() * 6, dur: 2, mode: 'pass' }); }
  // the garden grows
  if (W.garden && G.day - W.garden.day >= 4 && Math.floor(G.h) === 7 && W.gardenDay !== G.day) { W.gardenDay = G.day; W.gardenFruit = Math.min(8, (W.gardenFruit || 0) + 2); }
}
function featuresHour(w) { completeObjects(); objectsHour(w); rareHour(w); dogHour(); medalsHour(); storyHour(w); ageCheck(); }
function featuresDay() { objectsDay(); judgePredictions(); if ((G.day - 1) % 7 === 0 && G.day > 1) weeklyEpisode(G.day - 1); }
function featuresPerception(a, L) {
  const W = G.world;
  const dt = dogText(); if (dt) L.push(dt);
  campObjects('acqua').forEach((o) => { if (dist(a.pos, o.loc) < 9 && (o.water || 0) >= 5) L.push(`In ${o.name} c'è dell'acqua raccolta (circa ${Math.round(o.water / 10)} sorsate).`); });
  campObjects('trappola').forEach((o) => { if (o.catch && dist(a.pos, o.loc) < 9) L.push(`Nella ${o.name} qualcosa si muove.`); });
  if (W.planeAt && T() - W.planeAt < 0.6) L.push('Un aereo passa altissimo: si sente appena il rombo.');
  if (W.eclipseUntil > T()) L.push('La luce del giorno cala in modo innaturale: il sole è coperto da un disco nero.');
  (W.proposals || []).filter((pr) => pr.from !== a.name && T() - pr.t < 24).forEach((pr) => L.push(`${pr.from} ha proposto: «${pr.text}»${(pr.answers || {})[a.name] ? ` (hai risposto: ${pr.answers[a.name]})` : ' — non hai ancora risposto'}.`));
  (W.secrets || []).filter((sc) => sc.found && sc.text).forEach((sc) => { if ((a.memory || []).length < 3 || Math.random() < 0.15) L.push(`Ripensi a ciò che hai trovato: ${sc.text.slice(0, 140)}`); });
}
function featuresActionsDoc(a) {
  const L = [];
  if (a.bio && !a.amnesia) L.push(`- {"azione":"scrivi_lettera","a":"una persona cara","testo":"..."} — anche se non potrai mai spedirla`);
  if (G.agents.filter((x) => x.alive).length > 1) L.push('- {"azione":"proponi","proposta":"..."} — una proposta agli altri (regole, turni, divisione dei compiti...)');
  return L.length ? '\n' + L.join('\n') : '';
}
function resolveFeature(a, t, p) {
  if (t === 'scrivi_lettera') { const to = String(p.a || 'qualcuno').slice(0, 40), txt = String(p.testo || '').slice(0, 1500); if (!txt) return 'non sai da dove cominciare'; G.letters = G.letters || []; G.letters.push({ day: G.day, h: G.h, from: a.name, to, text: txt }); a.stats.mente = clamp(a.stats.mente + 2); medal('lettera', `${a.name} scrive a ${to}`); chron(`✉️ ${a.name} scrive una lettera a ${to}.`, 'act'); return `hai scritto una lettera a ${to}`; }
  if (t === 'proponi') { const txt = String(p.proposta || p.testo || '').slice(0, 300); if (!txt) return 'non sai cosa proporre'; G.world.proposals = (G.world.proposals || []).concat([{ from: a.name, text: txt, t: T(), answers: {} }]).slice(-6); chron(`🗣️ ${a.name} propone: «${txt}»`, 'event'); alive().forEach((o) => { if (o !== a) interrupt(o, `${a.name} ha fatto una proposta`); }); return 'hai fatto la tua proposta agli altri'; }
  return null;
}


/* ---------- every object gets a sketch and a purpose (whatever created it) ---------- */
async function completeObjects() {
  if (!SAMPLE || !G) return;
  const todo = G.world.custom.filter((c) => !c.animal && !c.completing && !c.completed && (!c.parts || !c.use)).sort((x, y) => (y.addedAt || 0) - (x.addedAt || 0)).slice(0, 4);
  for (const c of todo) {
    c.completing = true;
    try {
      const out = await ask('oggetto', `Su un'isola deserta tropicale c'è questo oggetto: "${c.name}"${c.desc ? ' (' + c.desc + ')' : ''}. Spiega in modo concreto come lo userebbe un naufrago e a cosa gli serve, e disegnalo in modo abbozzato ma riconoscibile.
Rispondi SOLO con JSON: {"descrizione":"1 frase su com'è fatto","uso":"a cosa serve e come si usa, concreto, 1-2 frasi (anche 'a niente di utile' se è così)","trasportabile":true|false,"forma":[2-10 parti {"f":"box|cil|sfera|cono","d":[l,a,p] per box, [raggio,altezza] cil/cono, [raggio] sfera,"p":[x,y,z],"r":[gradi x,y,z],"c":"#rrggbb"}, misure reali in metri, origine a terra al centro, y in alto]}`, 'quick');
      if (out) {
        if (!c.use && out.uso) c.use = String(out.uso).slice(0, 200);
        if (!c.desc && out.descrizione) c.desc = String(out.descrizione).slice(0, 160);
        if (!c.parts && Array.isArray(out.forma) && out.forma.length) { c.parts = out.forma.slice(0, 12); c.pv = (c.pv || 0) + 1; }
        if (out.trasportabile === false && c.portable == null) c.portable = false;
        emit('onChange');
      }
      c.completed = true;
    } catch (e) { /* retry later */ } finally { c.completing = false; }
  }
}
