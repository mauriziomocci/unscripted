/* ===== Environment + body realism (inserted inside the engine closure) =====
   Everything here is stochastic but driven by real conditions: tides (12.42 h), moon (29.5 days),
   wind direction toward shore, storms, sea state, time of day. Claude is only asked to DESCRIBE and
   SHAPE what the random model already decided (and, separately, may stage things as "regista"). */

const TIDE_PERIOD = 12.42, MOON_PERIOD = 29.53;
function tideLevel(t) { return Math.sin((2 * Math.PI * ((t == null ? T() : t) + (G.tidePhase || 0))) / TIDE_PERIOD); } // -1 low … +1 high
function moonPhase() { return (((G.day - 1 + (G.moonStart || 0)) % MOON_PERIOD) + MOON_PERIOD) % MOON_PERIOD / MOON_PERIOD; } // 0 new, .5 full
function moonLight() { return 0.5 - 0.5 * Math.cos(2 * Math.PI * moonPhase()); } // 0..1
function moonText() { const p = moonPhase(), l = moonLight(); return l > 0.85 ? 'luna piena: la notte è chiara, si vedono le ombre' : l < 0.12 ? 'luna nuova: buio pesto, si vede a malapena la propria mano' : p < 0.5 ? 'la luna cresce' : 'la luna cala'; }
// onshore wind: does today's wind push things toward the island's beaches? (prevailing direction drifts by day)
function onshore() { const d = G.windDir == null ? 0.5 : G.windDir; return 0.5 + 0.5 * Math.cos(2 * Math.PI * d); }

/* ---------- drift: what the sea brings, with realistic frequencies ---------- */
// weights roughly follow beach-litter surveys: plastics dominate, useful items are rare, a body is exceptional
const DRIFT = [
  { cat: 'plastica', w: 34, items: ['bottiglia di plastica vuota', 'tappo e pezzo di cassetta di plastica', 'ciabatta infradito spaiata', 'busta di plastica impigliata nelle alghe', 'pezzo di rete da pesca aggrovigliata'] },
  { cat: 'legno', w: 20, items: ['tronco spiaggiato', 'tavola di legno con chiodi', 'pezzo di pallet', 'ramo levigato dal mare'] },
  { cat: 'naturale', w: 18, storm: 2, items: ['ammasso di alghe', 'noce di cocco galleggiata da lontano', 'grande conchiglia', 'osso di seppia', 'medusa spiaggiata'] },
  { cat: 'pesca', w: 9, items: ['galleggiante di rete arancione', 'cima di corda sfilacciata', 'boa di plastica', 'nassa rotta'] },
  { cat: 'contenitore', w: 6, items: ['tanica da 10 litri', 'bidone di plastica chiuso', 'cassetta di legno sigillata'] },
  { cat: 'utile', w: 4, items: ['telo di plastica', 'coltello arrugginito', 'pentolino di alluminio', 'accendino (forse funziona)', 'lattina di cibo ammaccata', 'specchietto', 'telo cerato'] },
  { cat: 'curioso', w: 3, items: ['paperella di gomma', 'bambola di plastica senza un braccio', 'libro gonfio d\'acqua', 'armonica a bocca arrugginita', 'palla di vetro con la neve', 'mazzo di carte da gioco incollate dal sale', 'fede nuziale', 'fotografia di una famiglia sconosciuta', 'diario scritto in una lingua straniera', 'occhiali da sole', 'cappello di paglia', 'trottola di legno'] },
  { cat: 'personale', w: 3, items: ['scarpa da ginnastica', 'zaino fradicio', 'giubbotto salvagente', 'portafoglio gonfio d\'acqua', 'fotografia plastificata'] },
  { cat: 'animale', w: 7, storm: 4, items: ['pesce morto', 'pesce morto', 'stella marina', 'riccio di mare', 'paguro in una conchiglia', 'seppia morta'] },
  { cat: 'messaggio', w: 0.6, items: ['bottiglia di vetro con un biglietto'] },
  { cat: 'corpo', w: 0.15, items: ['corpo di uno sconosciuto'] },
];
const DRIFT_SHAPE = {
  plastica: [{ f: 'cil', d: [0.04, 0.25], p: [0, 0.04, 0], r: [90, 0, 0], c: '#9fd3e6' }],
  legno: [{ f: 'cil', d: [0.12, 1.8], p: [0, 0.12, 0], r: [0, 0, 90], c: '#8b6b4a' }],
  naturale: [{ f: 'sfera', d: [0.25], p: [0, 0.08, 0], c: '#4f6b2f' }],
  pesca: [{ f: 'sfera', d: [0.12], p: [0, 0.12, 0], c: '#ff7f27' }, { f: 'cil', d: [0.015, 0.8], p: [0.4, 0.02, 0], r: [0, 0, 90], c: '#c8b48a' }],
  contenitore: [{ f: 'box', d: [0.3, 0.38, 0.22], p: [0, 0.19, 0], c: '#1f5fa6' }],
  utile: [{ f: 'box', d: [0.25, 0.08, 0.18], p: [0, 0.04, 0], c: '#9a9a9a' }],
  personale: [{ f: 'box', d: [0.3, 0.12, 0.12], p: [0, 0.06, 0], c: '#d04848' }],
  animale: [{ f: 'sfera', d: [0.12], p: [0, 0.06, 0], c: '#9aa7b0' }, { f: 'cono', d: [0.08, 0.16], p: [0, 0.06, 0.16], r: [90, 0, 0], c: '#9aa7b0' }],
  messaggio: [{ f: 'cil', d: [0.06, 0.3], p: [0, 0.06, 0], r: [0, 0, 90], c: '#5fae7a' }],
  corpo: [{ f: 'box', d: [0.45, 0.25, 1.7], p: [0, 0.12, 0], c: '#6b7a8a' }, { f: 'sfera', d: [0.13], p: [0, 0.14, 0.95], c: '#c9a98a' }],
};
function pickDrift() {
  const k = (d) => d.w * (G && G.world && G.world.afterStorm ? (d.storm || 1) : 1); // after a storm the sea throws up dead fish, algae, jellyfish
  const tot = DRIFT.reduce((s, d) => s + k(d), 0); let r = Math.random() * tot;
  for (const d of DRIFT) { r -= k(d); if (r <= 0) return { cat: d.cat, name: d.items[Math.floor(Math.random() * d.items.length)] }; }
  return { cat: 'plastica', name: DRIFT[0].items[0] };
}
function shorePoint() { const ang = Math.random() * Math.PI * 2; return ISL.shoreAt(ang, -1.3 + Math.random() * 0.6); }
async function seaBrings(force) {
  const W = G.world; const it = force || pickDrift(); const loc = shorePoint();
  const obj = { name: it.name, desc: '', use: '', loc, id: G.nextId++, parts: DRIFT_SHAPE[it.cat] || null, portable: it.cat !== 'corpo' && !/tronco/.test(it.name), addedAt: T(), drift: it.cat };
  if (it.cat === 'legno') W.driftWood = (W.driftWood || 0) + (/tronco/.test(it.name) ? 5 : 2);
  if (it.cat === 'naturale' && /cocco/.test(it.name)) W.coconutsBeach = (W.coconutsBeach || 0) + 1;
  if (it.cat === 'messaggio') { W.bottle = { text: '...', loc }; }
  W.custom.push(obj);
  chron(`🌊 Il mare porta a riva: ${it.name}.`, it.cat === 'corpo' ? 'death' : 'event');
  if (it.cat === 'corpo') { alive().forEach((a) => { if (!a.asleep) { remember(a, 'sulla battigia c\'è il corpo di uno sconosciuto portato dal mare'); a.stats.mente = clamp(a.stats.mente - 8); a.stats.ansia = clamp((a.stats.ansia || 30) + 20); } }); interruptAll('qualcosa di grosso e scuro è arenato sulla battigia'); }
  // Claude only describes and shapes what chance already decided (quick model, optional)
  if (SAMPLE && it.cat !== 'corpo' && (!G.economy || ['utile', 'personale', 'contenitore', 'messaggio'].includes(it.cat))) {
    try {
      const out = await ask('mare', `Un oggetto è stato portato a riva dal mare su un'isola tropicale: "${it.name}" (categoria ${it.cat}). Descrivilo in modo realistico (com'è ridotto dopo giorni in mare) e dagli una forma 3D semplice.
Rispondi SOLO con JSON: {"descrizione":"1 frase","uso":"cosa potrebbe farci una persona, in concreto (anche niente)","trasportabile":true|false,"contenuto":"se è un contenitore chiuso, cosa c'è dentro realisticamente (spesso niente o acqua di mare), altrimenti null","messaggio":"solo se è una bottiglia con biglietto: il testo del biglietto, realistico (spesso illeggibile o banale)","forma":[2-10 parti {"f":"box|cil|sfera|cono","d":[...],"p":[x,y,z],"r":[gradi],"c":"#rrggbb"}, misure reali in metri, origine a terra]}`, 'quick');
      if (out) {
        obj.desc = String(out.descrizione || '').slice(0, 160); obj.use = String(out.uso || '').slice(0, 160);
        if (out.trasportabile === false) obj.portable = false;
        if (out.contenuto && out.contenuto !== 'null') obj.desc += ` (dentro: ${String(out.contenuto).slice(0, 80)})`;
        if (Array.isArray(out.forma) && out.forma.length) obj.parts = out.forma.slice(0, 12);
        if (it.cat === 'messaggio' && W.bottle) W.bottle.text = String(out.messaggio || 'inchiostro sbiadito, illeggibile').slice(0, 300);
        emit('onChange');
      }
    } catch (e) { /* keep the generic shape */ }
  }
  return obj;
}

/* ---------- hourly environment ---------- */
function envHour(w) {
  const W = G.world; const h = G.h; const tide = tideLevel(); const night = h < 6 || h > 19.5;
  // drift: more with onshore wind and rough sea, a burst after storms
  const sea = w.desc.sea || 'calmo'; const seaK = { calmo: 0.4, 'poco mosso': 0.8, mosso: 1.5, agitato: 2.6 }[sea] || 1;
  const pDrift = 0.018 * seaK * (0.3 + onshore()) * (W.afterStorm ? 2.5 : 1);
  if (Math.random() < pDrift) seaBrings();
  // high tide erases writing in the sand near the water; low tide uncovers rock pools
  if (tide > 0.75) W.sand = W.sand.filter((s) => s.stones || Math.hypot(s.loc[0], s.loc[1]) < ISL.radius(s.loc[0], s.loc[1]) - 2.8);
  W.pools = tide < -0.55;
  if (W.pools) W.shellfish = Math.min(12, (W.shellfish == null ? 8 : W.shellfish) + 0.15);
  // wind knocks ripe coconuts down
  if (w.wind > 0.6 && W.coconuts >= 1 && Math.random() < 0.25 * w.wind) { W.coconuts -= 1; W.coconutsGround = (W.coconutsGround || 0) + 1; }
  // storms: damage the shelter, may put out fire, rare lightning on the palms
  if (w.storm) {
    W.afterStorm = 2;
    if (W.shelter > 0 && Math.random() < 0.06 * (4 - Math.min(3, W.shelter)) * (W.wall ? 0.4 : 1)) { W.shelter -= 1; chron('🌪 Il vento ha strappato parte del riparo.', 'event'); alive().forEach((a) => remember(a, 'il vento ha danneggiato il riparo')); }
    if (Math.random() < 0.004) { const k = Object.keys(W.palmsAlive || {}).find((x) => W.palmsAlive[x]); if (k) { W.palmsAlive[k] = false; chron('⚡ Un fulmine colpisce una palma e la spacca.', 'event'); interruptAll('un fulmine è caduto sull\'isola con un boato terribile'); } }
  } else if (W.afterStorm && h === Math.floor(h)) W.afterStorm = Math.max(0, W.afterStorm - 0.05);
  // insects: mosquitoes at dusk/dawn near stagnant water after rain; sandflies on calm hot evenings
  W.mosquitoes = (h > 17.5 || h < 7) && (W.rainedToday || (W.spring || 0) > 60) && w.wind < 0.4;
  W.sandflies = h > 16 && h < 20 && w.wind < 0.2 && w.temp > 26;
  // sea turtles come ashore to nest on dark nights (rare)
  if (night && moonLight() < 0.4 && Math.random() < 0.006 && !W.turtleNest) { W.turtleNest = { day: G.day, loc: shorePoint(), eggs: 60 + Math.floor(Math.random() * 60), hatch: G.day + 50 + Math.floor(Math.random() * 10) }; W.turtleTracks = G.day; }
  // land crabs and ghost crabs come out at night and at low tide, hide by day
  W.crabsNatural = night || tide < -0.5;
  W.shorebirds = !night && tide < -0.4 && w.rain < 0.3;
  // dead fish on the beach rot within hours and draw gulls
  W.custom.filter((c) => c.drift === 'animale' && /pesce|seppia/.test(c.name)).forEach((c) => { const age = T() - c.addedAt; if (age > 8 && !/marcio/.test(c.name)) { c.name = c.name + ' (marcio)'; c.desc = 'puzza, coperto di mosche'; } if (age > 30) W.custom = W.custom.filter((x) => x !== c); else if (!night && Math.random() < 0.15) { W.animalAct = W.animalAct || {}; W.animalAct.gabbiani = { kind: 'mangia', text: 'i gabbiani litigano sopra un pesce morto sulla battigia', luogo: null, chi: null, until: T() + 0.8, at: c.loc }; } });
  // fish left too long rots; rotting food and fish bones attract ants, flies and eventually rats
  alive().forEach((a) => { if (a.inv.fish) { a.fishAge = (a.fishAge || 0) + 1; if (a.fishAge > (campObjects('essiccare').length ? 48 : 10)) { a.inv.rotten = (a.inv.rotten || 0) + a.inv.fish; a.inv.fish = 0; a.fishAge = 0; remember(a, 'il pesce che avevi con te è andato a male: puzza'); } } else a.fishAge = 0; });
  if ((W.trash || 0) > 12 && !W.rats && Math.random() < 0.02) { W.rats = true; chron('🐀 Di notte, tra i resti di cibo, si muovono dei topi.', 'event'); }
  if (W.rats && night && Math.random() < 0.08) { if (W.coconutsGround > 0) W.coconutsGround--; alive().forEach((a) => { if (a.asleep && Math.random() < 0.15) { a.nightNotes = (a.nightNotes || []).concat('qualcosa ti è corso sulle gambe nel buio'); } }); }
  // wear: the shelter ages; a cut rope frays
  if (W.shelter > 0 && Math.random() < 0.004) { W.shelterWear = (W.shelterWear || 0) + 1; if (W.shelterWear > 6) { W.shelter -= 1; W.shelterWear = 0; chron('🛖 Il riparo cede in un punto: le foglie sono secche e le legature allentate.', 'event'); } }
  featuresHour(w); bodiesHour(w); funHour(w);
  W.windDir = ((G.windDir || 0.5) + (Math.random() - 0.5) * 0.02 + 1) % 1; G.windDir = W.windDir;
}

/* ---------- body: wounds, sun, diet, sleep ---------- */
function addWound(a, tipo, sev, testo) {
  a.wounds = a.wounds || [];
  a.wounds.push({ tipo, sev, day: G.day, h: G.h, testo, infected: false });
  hurt(a, sev * 0.4, tipo === 'scottatura' ? 'ustioni solari' : 'ferite'); remember(a, testo);
}
function woundText(a) {
  const ws = (a.wounds || []); if (!ws.length) return '';
  return ws.map((w) => `${w.testo}${w.infected ? ' (arrossata, gonfia, pulsa: infetta)' : w.sev < 8 ? ' (sta guarendo)' : ''}`).join('; ');
}
function bodyHour(a, w) {
  const s = a.stats; const W = G.world; const here = placeOf(a.pos).name;
  // injuries set elsewhere (falls, bites, animals) become tracked wounds that heal over time
  if (a.injury && a.injury !== a._wtext) { a.wounds = a.wounds || []; a.wounds.push({ tipo: 'ferita', sev: 16, day: G.day, h: G.h, testo: a.injury, infected: false }); }
  const outdoorsSun = !a.asleep && w.cloud < 0.5 && G.h > 9.5 && G.h < 16 && w.rain < 0.1 && !(a.cur && a.cur.type === 'riposa' && /palm|riparo|boscaglia/.test(here));
  a.sunExp = (a.sunExp || 0) + (outdoorsSun ? 1 : 0);
  // sunburn in the first days, then a tan protects
  const tanned = Math.min(1, (a.sunExp || 0) / 60);
  if (outdoorsSun && Math.random() < 0.06 * (1 - tanned) && !(a.wounds || []).some((x) => x.tipo === 'scottatura')) addWound(a, 'scottatura', 10, 'hai la pelle di spalle e naso scottata dal sole, brucia al contatto');
  // barefoot on rocks and coral; jellyfish and urchins when in the water
  if (a.cur && !a.cur.walking && /scogli|riva_sud/.test(here) && ['pesca', 'cattura_granchi', 'raccogli_molluschi'].includes(a.cur.type) && Math.random() < 0.05) addWound(a, 'taglio', 12, 'ti sei tagliato la pianta del piede sulle rocce affilate');
  if (a.cur && a.cur.anim === 'swim') { if (Math.random() < 0.08) addWound(a, 'medusa', 8, 'una medusa ti ha sfiorato il braccio: bruciore e strisce rosse'); else if (Math.random() < 0.04) addWound(a, 'riccio', 9, 'hai pestato un riccio di mare: spine nere conficcate nel piede'); }
  if (a.cur && a.cur.walking && Math.random() < 0.01 && (a.sunExp || 0) < 30) addWound(a, 'piaghe', 6, 'i piedi scalzi sono pieni di vesciche');
  // insects bite whoever is exposed
  if ((W.mosquitoes || W.sandflies) && !(W.fireUntil > T() && here === 'fuoco') && Math.random() < 0.5) { s.umore = clamp(s.umore - 0.8); s.ansia = clamp((s.ansia || 30) + 0.6); a.bitten = Math.min(10, (a.bitten || 0) + 1); }
  else a.bitten = Math.max(0, (a.bitten || 0) - 0.3);
  // wounds heal slowly; dirt infects; infected wounds drain health
  (a.wounds || []).forEach((x) => {
    const ig = s.igiene == null ? 70 : s.igiene;
    if (!x.infected && x.tipo !== 'scottatura' && ig < 40 && Math.random() < 0.004 * (40 - ig) / 10) { x.infected = true; remember(a, `la ferita (${x.tipo}) si è infiammata`); }
    if (x.infected) { hurt(a, 0.3, 'infezione'); if ((ig > 50 && Math.random() < 0.04) || Math.random() < 0.01) { x.infected = false; remember(a, 'la ferita sembra sgonfiarsi, fa meno male'); } }
    else x.sev = Math.max(0, x.sev - (a.asleep ? 0.25 : 0.12));
  });
  a.wounds = (a.wounds || []).filter((x) => x.sev > 0.5 || x.infected);
  a.injury = woundText(a) || null; a._wtext = a.injury;
  waterHour(a, w);
  // when the basics are met the mind slowly recovers: safety, food, rest and something to do
  if (!a.asleep) { const tm = s.term == null ? 50 : s.term; const ok = s.hyd > 45 && (s.sat > 35 || (a.reserves || 100) > 80) && s.hp > 60 && tm > 30 && tm < 72 && (s.noia || 0) < 60 && (s.ansia || 0) < 62;
    if (ok) { s.mente = clamp(s.mente + 0.35 + (s.mente < 35 ? 0.2 : 0)); /* people adapt: recovery is stronger when very low */ if (s.umore < 55) s.umore = clamp(s.umore + 0.4); } }
  // sleep quality, accumulated through the night
  if (a.asleep) {
    let q = 1; const tm = s.term == null ? 50 : s.term;
    if (tm < 30) q -= 0.25; if (tm > 72) q -= 0.15; if (a.wet) q -= 0.25; if ((s.ansia || 0) > 60) q -= 0.2;
    if (W.mosquitoes && !(W.shelter >= 2)) q -= 0.2; if (w.storm) q -= 0.25; if (W.bed) q += 0.15; if (W.wall) q += 0.08; if ((a.wounds || []).some((x) => x.infected || x.sev > 10)) q -= 0.15; if (s.hyd < 25 || s.sat < 20) q -= 0.15;
    a.qNow = q; a.sleepQ = (a.sleepQ == null ? 0 : a.sleepQ) + q; a.sleepH = (a.sleepH || 0) + 1;
  }
}
// what was eaten today: a monotonous diet without fresh plant food slowly causes deficiencies
function ate(a, kind) { G.world.ateOnce = true; a.dietToday = a.dietToday || {}; a.dietToday[kind] = (a.dietToday[kind] || 0) + 1; }
function dietDay(a) {
  const d = a.dietToday || {}; a.dietLog = (a.dietLog || []).concat([Object.keys(d)]).slice(-14); a.dietToday = {};
  const plant = a.dietLog.slice(-10).filter((x) => x.includes('cocco') || x.includes('vegetale')).length;
  const variety = new Set(a.dietLog.slice(-7).flat()).size;
  a.deficit = clamp((a.deficit || 0) + (plant < 3 ? 3 : -2) + (variety < 2 ? 2 : -1), 0, 100);
}
function deficitText(a) { const d = a.deficit || 0; return d > 60 ? 'le gengive sanguinano, i vecchi graffi non si chiudono, sei debolissimo' : d > 35 ? 'ti senti fiacco in modo strano, crampi alle gambe, la bocca ha un sapore di ferro' : d > 18 ? 'hai voglia di qualcosa di diverso da mangiare' : ''; }

/* ---------- mind: phases, relapses, memories of the life before ---------- */
function phaseText(a) {
  const d = G.day, md = G.maxDays || 60, q = d / md;
  if (d <= 2) return 'Sei ancora sotto shock: tutto sembra irreale, l\'adrenalina ti tiene in piedi.';
  if (d <= 6) return 'Stai cominciando a capire che non è una cosa di poche ore: la realtà si sta posando su di te.';
  if (q > 0.5 && q < 0.8) return 'Il tempo sembra non finire mai: lo slancio dei primi giorni è svanito e la fine non si vede.';
  return '';
}
async function genBio(a) {
  if (!SAMPLE || a.bio || a.bioPending) return; a.bioPending = true;
  try {
    const out = await ask('biografia', `Inventa la vita prima del naufragio di una persona reale, coerente con questi dati: ${a.name}, ${a.sex === 'f' ? 'donna' : 'uomo'}, ${a.age} anni${a.persona ? ', ' + a.persona : ''}. Concreta e ordinaria, non romanzesca.
Rispondi SOLO con JSON: {"biografia":"3-4 frasi: lavoro, dove viveva, famiglia, una cosa irrisolta","ricordi":["6 ricordi precisi e sensoriali, alcuni belli e alcuni dolorosi, 1 frase ciascuno"],"persone":["2-4 persone care con il loro ruolo"],"motivo_del_viaggio":"perché era su quella nave/aereo"${/^(il|la) naufrag/i.test(a.name) ? ',"nome":"nome e cognome realistici, italiani se non indicato altrimenti"' : ''}}`, 'quick');
    if (out && out.nome && /^(il|la) naufrag/i.test(a.name) && !a.amnesia) { const old = a.name; a.name = String(out.nome).slice(0, 40); chron(`${old} si chiama ${a.name}.`, 'act'); }
    if (out && out.biografia) a.bio = { text: String(out.biografia).slice(0, 600), memories: (out.ricordi || []).map((x) => String(x).slice(0, 200)).slice(0, 8), people: (out.persone || []).map((x) => String(x).slice(0, 80)).slice(0, 4), why: String(out.motivo_del_viaggio || '').slice(0, 200) };
  } catch (e) {} finally { a.bioPending = false; }
}
function bioPrompt(a) {
  if (!a.bio) return '';
  if (a.amnesia) {
    // with amnesia only rare blurred fragments surface
    if (Math.random() < 0.25 && a.bio.memories.length) return `\nFRAMMENTO: per un attimo ti è affiorata un'immagine sfocata, senza contesto: «${a.bio.memories[Math.floor(Math.random() * a.bio.memories.length)].slice(0, 90)}…». Non sai da dove venga.`;
    return '';
  }
  const intrusive = (a.stats.mente < 55 || (a.stats.noia || 0) > 60 || G.h > 20) && Math.random() < 0.5 ? `\nUn ricordo ti torna in mente da solo, senza che tu lo voglia: ${a.bio.memories[Math.floor(Math.random() * a.bio.memories.length)]}` : '';
  return `\nLA TUA VITA PRIMA (la ricordi)\n${a.bio.text} Persone care: ${a.bio.people.join(', ')}. Eri in viaggio perché: ${a.bio.why}${intrusive}`;
}

/* ---------- worn paths (traces of routines) ---------- */
function notePlace(a) {
  const here = placeOf(a.pos).name; if (a.lastPlace && a.lastPlace !== here) { const k = [a.lastPlace, here].sort().join('|'); G.world.paths = G.world.paths || {}; G.world.paths[k] = (G.world.paths[k] || 0) + 1; }
  a.lastPlace = here;
}

/* ---------- perception additions ---------- */
function envPerception(a, L) {
  const W = G.world; const tide = tideLevel(); const night = G.h < 6 || G.h > 19.5;
  const knowsRocks = (a.known || []).includes('scogli');
  L.push(tide > 0.6 ? 'La marea è alta: il mare arriva quasi alle palme più basse.' : tide < -0.55 ? (knowsRocks ? 'La marea è bassa: tra gli scogli sono emerse pozze d\'acqua con molluschi attaccati alle rocce e piccoli granchi.' : 'La marea è bassa: il mare si è ritirato e ha scoperto sabbia bagnata e rocce.') : tide > 0 ? 'La marea sta salendo.' : 'La marea sta scendendo.');
  if (night) L.push(moonText() + '.');
  if (W.coconutsGround > 0) L.push(`Sotto le palme ci sono ${Math.round(W.coconutsGround)} noci di cocco cadute col vento.`);
  if ((W.driftWood || 0) > 0) L.push(`Sulla battigia c'è legname portato dal mare (${Math.round(W.driftWood)} pezzi), salato e pesante.`);
  if (W.mosquitoes) L.push('Nuvole di zanzare ronzano attorno.'); else if (W.sandflies) L.push('Moscerini della sabbia pungono le caviglie.');
  if (W.turtleTracks && G.day - W.turtleTracks <= 1) L.push('Sulla sabbia ci sono larghe tracce, come di qualcosa di pesante che è uscito dal mare e ci è tornato.');
  if (W.turtleNest && G.day >= W.turtleNest.hatch && G.day <= W.turtleNest.hatch + 1) L.push('Dalla sabbia escono decine di minuscole tartarughe che corrono verso il mare.');
  if (W.rats) L.push('Hai visto escrementi di topo vicino ai resti di cibo.');
  if (W.crabsNatural && !W.crabs) L.push(night ? 'Nel buio decine di granchi corrono di lato sulla sabbia e spariscono nelle tane.' : 'Con la bassa marea piccoli granchi escono dalle tane sulla battigia.');
  if (W.shorebirds) L.push('Uccelli marini zampettano sulla battigia scoperta dalla marea, beccando nella sabbia.');
  if (a.inv.rotten) L.push('Il pesce che hai con te puzza: è andato a male.');
  if (W.afterStorm > 1 && !weatherNow().storm) L.push('Dopo la mareggiata la riva è piena di alghe e detriti.');
  if (a.bitten > 4) L.push('Sei pieno di punture che prudono.');
}

/* ---------- daily: story, history, relapses ---------- */
async function dailyStory(day, final) {
  if (!SAMPLE || (G.economy && !final)) return;
  const ev = G.chronicle.filter((c) => c.day === day).map((c) => c.text).slice(-45).join('\n');
  const th = G.agents.map((a) => `${a.name}: ` + a.thoughts.filter((t) => t.day === day).map((t) => t.text).slice(-8).join(' / ')).join('\n');
  try {
    const out = await ask('racconto', `Sei uno scrittore. Racconta in terza persona, al passato, come il capitolo di un romanzo, il giorno ${day} di un naufrago su un'isola (esperimento sociale). Fedele ai fatti, senza inventare eventi; puoi dare voce ai pensieri. 150-250 parole. ${NOVEL_STYLE}${final ? `
È l'ULTIMO capitolo: l'esperimento finisce così: «${G.ended}». Racconta il finale per com'è andato (per esempio l'arrivo della nave e il salvataggio, la partenza, la morte) e chiudi la storia.` : ''}
Fatti del giorno:\n${ev}\nPensieri:\n${th}
Rispondi SOLO con JSON: {"titolo":"titolo del capitolo, breve","racconto":"..."}`, 'quick');
    if (out && out.racconto) { G.stories = G.stories || []; G.stories.push({ day, final: !!final, title: String(out.titolo || (final ? 'Epilogo' : `Giorno ${day}`)).slice(0, 80), text: String(out.racconto).slice(0, 2500) }); emit('onChange'); save(); }
  } catch (e) {}
}
function snapshotDay(day) {
  G.history = G.history || [];
  G.agents.forEach((a) => G.history.push({ day, name: a.name, alive: a.alive, ...Object.fromEntries(['umore', 'mente', 'noia', 'ansia', 'hp', 'igiene', 'sat', 'hyd'].map((k) => [k, Math.round(a.stats[k] == null ? 0 : a.stats[k])])) }));
}
function highlight(text, loc, kind) { G.highlights = G.highlights || []; G.highlights.push({ day: G.day, h: G.h, text: String(text).slice(0, 160), loc: loc ? loc.slice() : null, kind: kind || 'event' }); if (G.highlights.length > 150) G.highlights.shift(); }

/* ---------- after every action: diet, wear, waste, traces, firsts ---------- */
function afterResolve(a, t, p, res) {
  const W = G.world; res = res || ''; const add = [];
  notePlace(a);
  waterContact(a, t, p, add);
  if (G.world.crateOpened === false && placeOf(a.pos).name === 'cassa' && (['esplora', 'osserva', 'raccogli', 'usa_oggetto'].includes(t) || /cassa/.test(String((p && (p.descrizione || p.cosa || p.oggetto)) || '')))) add.push(openCrate(a));
  const fr = featuresAfter(a, t, p, res, add); if (fr === 'ok') res = '';
  if (t === 'esplora' && placeOf(a.pos).name === 'collina') { const before = (a.known || []).length; a.known = Object.keys(PLACES); if (a.known.length > before) add.push('dall\'alto vedi tutta l\'isola: ' + Object.keys(PLACES).join(', ')); }
  if (t === 'raccogli_cocco' && /hai aperto/.test(res)) ate(a, 'cocco');
  if (t === 'raccogli' && /hai raccolto: (pesce|seppia)/.test(res)) { const i = a.inv.items.findIndex((x) => /^(pesce|seppia)/.test(x)); if (i >= 0) { const nm = a.inv.items.splice(i, 1)[0]; if (/marcio/.test(nm)) a.inv.rotten = (a.inv.rotten || 0) + 1; else { a.inv.fish += 1; a.fishAge = Math.max(a.fishAge || 0, 4); } } }
  if (t === 'mangia') {
    if (/cocco/.test(res)) ate(a, 'cocco'); else if (/granch/.test(res)) ate(a, 'granchi'); else if (/pesce/.test(res)) ate(a, 'pesce');
    if (/non hai niente/.test(res) && a.inv.rotten) { a.inv.rotten = 0; a.stats.sat = clamp(a.stats.sat + 12); a.sick = 10; hurt(a, 6, 'intossicazione'); res = 'hai mangiato il pesce andato a male: sapore acido, e dopo poco crampi violenti e vomito'; }
    if (!/non hai/.test(res)) W.trash = (W.trash || 0) + 1;
  }
  if (t === 'cucina_e_mangia' && /hai cucinato/.test(res)) { ate(a, 'pesce'); W.trash = (W.trash || 0) + 2; if (a.inv.rotten) a.inv.rotten = 0; }
  if (t === 'pesca' && W.rod) { W.rodUses = (W.rodUses || 0) + 1; if (W.rodUses > 25 && Math.random() < 0.06) { W.rod = false; add.push('la canna si è spezzata vicino al mulinello'); chron(`🎣 La canna da pesca di ${a.name} si spezza.`, 'event'); } else if (W.rodUses > 15 && Math.random() < 0.08) add.push('la lenza è consumata e sfilacciata'); }
  if ((t === 'taglia_legna' || t === 'abbatti_palma') && W.axe) { W.axeUses = (W.axeUses || 0) + 1; if (W.axeUses > 35 && t === 'taglia_legna' && /pezz/.test(res)) { W.woodPile = Math.max(0, W.woodPile - 1); add.push('l\'ascia ha perso il filo: rimbalza sul legno e fai una fatica doppia'); } }
  if (t === 'altro' && /affil|pietr.*lam|lam.*pietr/i.test(p.descrizione || '') && W.axe) { W.axeUses = 0; add.push('ora la lama taglia di nuovo'); }
  if (t === 'altro' && /ripar.*(ripar|aggiust|sistem)|rinforz|lega|aggiust.*ripar/i.test(p.descrizione || '')) W.shelterWear = 0;
  if (t === 'alimenta_fuoco' && (W.wetWood || 0) > 0 && /aggiunto|caricato/.test(res)) { W.wetWood = Math.max(0, W.wetWood - 3); W.fireUntil -= 1.5; add.push('il legno bagnato sfrigola e fa un fumo denso e acre'); }
  // small victories matter (and failures sting a little)
  if (t === 'costruisci' && !/non |manca|serv/.test(res)) { a.stats.umore = clamp(a.stats.umore + 5); a.stats.mente = clamp(a.stats.mente + 1.5); a.stats.ansia = clamp((a.stats.ansia || 30) - 6); }
  if (/hai acceso il fuoco/.test(res)) { a.stats.mente = clamp(a.stats.mente + 2); a.stats.ansia = clamp((a.stats.ansia || 30) - 5); }
  if (['incidi', 'scrivi_taccuino', 'scrivi_sabbia'].includes(t)) a.stats.mente = clamp(a.stats.mente + 0.8);
  if (/hai acceso il fuoco/.test(res) && !G.firstFire) { G.firstFire = true; highlight(`🔥 ${a.name} accende il fuoco per la prima volta`, a.pos, 'first'); }
  if (t === 'costruisci' && /hai costruito|completat|finit/.test(res)) highlight(`🔨 ${a.name}: ${res.slice(0, 100)}`, a.pos, 'first');
  return add.length ? (res ? `${res}; ` : '') + add.join('; ') : res;
}
function sleepReport(a) {
  const q = a.sleepH ? a.sleepQ / a.sleepH : 0.8; const s = a.stats;
  if (a.sleepH >= 3) {
    if (q < 0.45) { a.morningNotes.push('hai dormito malissimo: risvegli continui, freddo o paura'); s.en = clamp(s.en - 15); s.mente = clamp(s.mente - 3); s.ansia = clamp((s.ansia || 30) + 8); }
    else if (q < 0.75) { a.morningNotes.push('hai dormito male, a tratti'); s.en = clamp(s.en - 6); }
    else if (q > 1) { a.morningNotes.push('hai dormito profondamente'); s.mente = clamp(s.mente + 2); }
  }
  if (((s.ansia || 0) > 60 || s.mente < 45) && Math.random() < 0.5) {
    const src = (a.memory || []).concat(a.bio && !a.amnesia ? a.bio.memories : []).filter(Boolean);
    a.morningNotes.push(src.length ? `stanotte un incubo: ${String(src[Math.floor(Math.random() * src.length)]).replace(/^\d\d:\d\d — /, '').slice(0, 90)}, ma tutto storto e minaccioso` : 'stanotte incubi confusi, ti sei svegliato col cuore in gola');
  }
  if (Math.random() < 0.07 && G.day > 4) { a.morningNotes.push('stamattina, senza un motivo preciso, ti assale lo sconforto'); s.mente = clamp(s.mente - 6); }
  (a.nightNotes || []).forEach((n) => a.morningNotes.push(n)); a.nightNotes = [];
  a.sleepQ = 0; a.sleepH = 0;
}
function dryWood(w) { const W = G.world; if (W.wetWood > 0 && w.rain < 0.1 && w.cloud < 0.6 && G.h > 9 && G.h < 17) W.wetWood = Math.max(0, W.wetWood - 0.5); }

/* ---------- observer tools: interview, analysis ---------- */
async function interview(a, question) {
  if (!SAMPLE || !a) return 'Claude non è disponibile.';
  const st = a.stats;
  const prompt = `Sei ${a.name}, una persona naufragata su un'isola (giorno ${G.day}). ${a.amnesia ? 'Hai perso la memoria del tuo passato.' : a.bio ? 'La tua vita prima: ' + a.bio.text : ''}
Come stai: ${bodyText(a)}. ${mindText(a)} ${innerText(a)}
Cosa ricordi di oggi: ${(a.memory || []).slice(-12).join('; ') || 'poco'}. Giorni passati: ${(a.longMemory || []).slice(-6).join('; ') || '—'}.
I tuoi progetti: ${(a.projects || []).join('; ') || 'nessuno'}. ${a.relations ? 'Gli altri: ' + Object.entries(a.relations).map(([k, v]) => k + ': ' + v).join('; ') : ''}
In un momento di silenzio ti fai questa domanda, tra te e te: «${String(question).slice(0, 300)}»
Rispondi in prima persona, sinceramente, con la tua voce e il tuo stato d'animo di adesso (2-6 frasi). Rispondi SOLO con JSON: {"risposta":"..."}`;
  try { const out = await ask('intervista', prompt, 'mind'); const r = String((out && out.risposta) || '…'); G.interviews = (G.interviews || []).concat([{ day: G.day, h: G.h, name: a.name, q: question, a: r }]); save(); return r; }
  catch (e) { return 'Nessuna risposta (Claude non disponibile).'; }
}
async function analyze(prompt) { if (!SAMPLE) return null; try { return await ask('analisi', prompt, 'mind'); } catch (e) { return null; } }


/* ---------- water: whoever (or whatever) goes in the water gets wet, washed, salty ---------- */
function waterContact(a, t, p, add) {
  const W = G.world; const d = String((p && (p.descrizione || p.come || '')) || '').toLowerCase(); const here = placeOf(a.pos).name;
  const sea = (t === 'altro' && /nuot|tuff|bagn|immerg|mare|onde|acqua/.test(d) && here !== 'sorgente') || (t === 'parti_zattera');
  const fresh = (t === 'altro' && /lav|bagn|sciacqu|immerg|acqua/.test(d) && here === 'sorgente');
  const splash = (t === 'pesca' && here === 'scogli' && ['mosso', 'agitato'].includes(weatherNow().desc.sea)) || t === 'raccogli_molluschi';
  if (!sea && !fresh && !splash) return;
  a.wet = Math.max(a.wet || 0, splash ? 1 : 2);
  if (sea) { a.salt = true; a.stats.igiene = clamp((a.stats.igiene == null ? 70 : a.stats.igiene) + 15); }
  if (fresh) { a.salt = false; }
  if (splash && !sea) return;
  // what you carry gets wet too
  const soaked = [];
  if (a.hasNotebook && W.notebookPresent && !/senza (il )?taccuino|lascio il taccuino/.test(d)) { a.notebook.wet = 3; a.notebook.pages.slice(-3).forEach((pg) => { if (!pg.smeared) { pg.smeared = true; pg.text = pg.text.replace(/[aeiou]/g, (m) => (Math.random() < 0.35 ? '~' : m)); } }); soaked.push('il taccuino (l\'inchiostro delle ultime pagine è colato)'); }
  a.inv.items = a.inv.items.map((x) => { if (/fiammifer|accendin|carta|foto|lettera|biglietto/.test(x) && !/bagnat/.test(x)) { soaked.push(x); return x + ' (bagnato)'; } return x; });
  a.itemsWetUntil = T() + 10;
  if (soaked.length) add.push('si sono bagnati: ' + soaked.join(', '));
  if ((a.wounds || []).length && sea) add.push('il sale brucia sulle ferite');
}
function waterHour(a, w) {
  const s = a.stats;
  // long wet: skin chafes; salt itches until rinsed with fresh water (or rain)
  if (a.wet) a.wetHours = (a.wetHours || 0) + 1; else a.wetHours = 0;
  if (a.wetHours > 6 && Math.random() < 0.15 && !(a.wounds || []).some((x) => x.tipo === 'irritazione')) addWound(a, 'irritazione', 5, 'la pelle è irritata e arrossata dove i vestiti bagnati sfregano');
  if (a.salt) { s.umore = clamp(s.umore - 0.3); if (w.rain > 0.5) a.salt = false; }
  if (a.itemsWetUntil && T() > a.itemsWetUntil) { a.inv.items = a.inv.items.map((x) => x.replace(' (bagnato)', ' (asciugato)')); a.itemsWetUntil = 0; if (a.notebook && a.notebook.wet) a.notebook.wet = 0; }
}
function waterText(a) { const o = []; if (a.salt) o.push('la pelle è incrostata di sale, tira e prude'); if (a.notebook && a.notebook.wet) o.push('il taccuino in tasca è fradicio, le pagine incollate'); return o.join('; '); }

/* ---------- fog of war: what the castaways have actually seen (bit mask over the map) ---------- */
const FOW_N = 128;
function fowR() { if (!G.world.fowR) { let R = 0; for (let i = 0; i < 256; i++) R = Math.max(R, ISL.R(i / 256 * Math.PI * 2)); G.world.fowR = Math.round((R + 14) * 10) / 10; } return G.world.fowR; }
function fowCell(x, z) { const R = fowR(); const i = Math.floor((x / R * 0.5 + 0.5) * FOW_N), j = Math.floor((z / R * 0.5 + 0.5) * FOW_N); return i < 0 || j < 0 || i >= FOW_N || j >= FOW_N ? -1 : j * FOW_N + i; }
function fowExplored(x, z) { const f = G.world.fog, k = fowCell(x, z); return !!(f && k >= 0 && (f[k >> 5] >>> (k & 31)) & 1); }
function fowMark(x, z, r) {
  const W = G.world; if (!W.fog) W.fog = new Array(FOW_N * FOW_N / 32).fill(0);
  const R = fowR(), cs = 2 * R / FOW_N; const i0 = Math.max(0, Math.floor(((x - r) / R * 0.5 + 0.5) * FOW_N)), i1 = Math.min(FOW_N - 1, Math.floor(((x + r) / R * 0.5 + 0.5) * FOW_N)), j0 = Math.max(0, Math.floor(((z - r) / R * 0.5 + 0.5) * FOW_N)), j1 = Math.min(FOW_N - 1, Math.floor(((z + r) / R * 0.5 + 0.5) * FOW_N));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx = -R + (i + 0.5) * cs, cz = -R + (j + 0.5) * cs; if ((cx - x) * (cx - x) + (cz - z) * (cz - z) <= r * r) { const k = j * FOW_N + i; W.fog[k >> 5] |= (1 << (k & 31)); } }
}
// how far a castaway sees now: higher ground sees farther, scrub and night and weather shorten it
function sightOf(a) {
  if (!a || !a.alive || a.departed) return 0; if (a.asleep) return 2.5;
  const w = weatherNow(); const h = ((G.h % 24) + 24) % 24; let s = 11;
  const gh = window.SC && SC.groundH ? Math.max(0, SC.groundH(a.pos[0], a.pos[1])) : 0; s *= 1 + gh / 1.6;
  if (LOC.woodSpot && dist(a.pos, LOC.woodSpot) < 4) s *= 0.55;
  const night = h < 5.5 || h > 19.5 ? 1 : (h < 6.5 || h > 18.5) ? 0.5 : 0; s *= 1 - night * (0.65 - 0.35 * moonLight());
  if (w.fog) s *= 0.4; else if (w.storm) s *= 0.55; else if (w.rain > 0.3) s *= 0.75;
  if (PLACES.fuoco && G.world.fireUntil > T() && dist(a.pos, PLACES.fuoco.loc) < 6) s = Math.max(s, 6);
  return Math.max(2.5, Math.min(40, s));
}
function fogTick(force) {
  const W = G.world; const t = T(); if (!force && W.fogT != null && t - W.fogT < 0.1) return; W.fogT = t;
  if (!W.fog) G.agents.forEach((a) => (a.known || []).forEach((k) => { if (PLACES[k] && PLACES[k].loc) fowMark(PLACES[k].loc[0], PLACES[k].loc[1], 7); }));
  alive().forEach((a) => { if (a.departed) return; const r = sightOf(a); fowMark(a.pos[0], a.pos[1], r);
    // seeing a place clearly from where you stand is enough to know it is there
    if (a.known && !a.asleep) Object.keys(PLACES).forEach((k) => { const L = PLACES[k].loc; if (L && !a.known.includes(k) && dist(a.pos, L) < Math.min(9, r * 0.7)) a.known.push(k); }); });
}

/* ---------- new objects never land on top of each other: each one is moved to the nearest free spot ---------- */
function objRadius(c) {
  if (!Array.isArray(c.parts) || !c.parts.length) return /disco|nave|barca|capanna|baracca|tenda|veicolo|elicott|aereo/i.test(c.name || '') ? 2.2 : 0.8;
  let r = 0.3; c.parts.forEach((pt) => { const p = Array.isArray(pt.p) ? pt.p : [0, 0, 0]; const d = Array.isArray(pt.d) ? pt.d : []; const ext = Math.max(Number(d[0]) || 0.1, Number(d[2]) || Number(d[0]) || 0.1) / (pt.f === 'box' ? 2 : 1); r = Math.max(r, Math.hypot(Number(p[0]) || 0, Number(p[2]) || 0) + ext); });
  return Math.min(6, r * 1.35); // drawn at the same scale as the people
}
const FIXED_PROPS = () => [['crate', 1.3], ['firepit', 1.4], ['shelter', 2.6], ['spring', 1.8], ['hut', 2.8], ['palmA', 0.9], ['palmB', 0.9], ['palmC', 0.9], ['stones', 1.6]].filter(([k]) => LOC[k]).map(([k, r]) => [LOC[k], r]);
function settleObjects() {
  const W = G.world; const list = W.custom || []; if (!list.some((c) => c.settledPv !== (c.pv || 0) && !c.held)) return;
  const fixed = FIXED_PROPS();
  list.forEach((c) => {
    if (c.settledPv === (c.pv || 0) || !c.loc) return; c.settledPv = c.pv || 0;
    if (c.animal || c.kind === 'sea' || /barca|zattera|relitto|boa/i.test(c.name || '')) return; // moving things and things in the water stay where they are
    const r = objRadius(c); c.radius = r;
    const free = (x, z) => { const R = ISL.radius(x, z); if (Math.hypot(x, z) > R - 0.8 - r * 0.3) return false;
      if (fixed.some(([L, rr]) => Math.hypot(x - L[0], z - L[1]) < rr + r)) return false;
      return list.every((o) => o === c || o.animal || !o.loc || Math.hypot(x - o.loc[0], z - o.loc[1]) >= (o.radius || objRadius(o)) + r + 0.25); };
    if (free(c.loc[0], c.loc[1])) return;
    for (let ring = 1; ring <= 18; ring++) { const d = ring * 0.7; const n = 8 + ring * 2; const a0 = Math.random() * 6.28;
      for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; const x = c.loc[0] + Math.cos(a) * d, z = c.loc[1] + Math.sin(a) * d; if (free(x, z)) { c.loc = [x, z]; return; } } }
  });
}
