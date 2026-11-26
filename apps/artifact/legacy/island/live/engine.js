/* ===== Engine: physical world + Claude-driven minds. Exposes window.ENG ===== */
(function () {
'use strict';
const LOC = IslandSim.LOC; const ISL = IslandSim.ISL; const RES = ISL.res;
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const fmtH = (h) => { const hh = Math.floor(h % 24), mm = Math.floor((h % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
const MODEL = { model: 'claude-sonnet-5-5', modelTier: 'default', effort: 'low', cache: false };
const SONNET_QUICK = { model: 'claude-sonnet-5-5', modelTier: 'quick', cache: false };
const HAIKU = { model: 'claude-haiku-5-5', modelTier: 'quick', cache: false };
// every call to Claude goes through here: counted by kind, mind model chosen at setup, accessory calls on the light model
// at most a few calls to Claude at once; when the platform says "rate_limited" (too many requests close together, not the account limit) wait and retry with a growing pause
const MAX_INFLIGHT = 2; let inflight = 0; const waiters = []; let coolUntil = 0, coolStep = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function takeSlot() { while (inflight >= MAX_INFLIGHT) await new Promise((r) => waiters.push(r)); inflight++; }
function freeSlot() { inflight = Math.max(0, inflight - 1); const w = waiters.shift(); if (w) w(); }
async function askOnce(kind, prompt, tier) {
  const opts = tier === 'mind' ? (G.mindModel === 'haiku' ? HAIKU : MODEL) : (G.lightModel === false ? SONNET_QUICK : HAIKU);
  try { return await SAMPLE.json(prompt, opts); }
  catch (e) { // if this account can't use the light model, fall back to Sonnet once and remember it
    const c = String((e && (e.code || e.message)) || ''); if (opts === HAIKU && /model|not.?allowed|invalid|unsupported|unavailable/i.test(c)) { if (tier !== 'mind') G.lightModel = false; return await SAMPLE.json(prompt, tier === 'mind' ? MODEL : SONNET_QUICK); }
    throw e;
  }
}
async function ask(kind, prompt, tier) {
  G.stats.calls++; G.callsByKind = G.callsByKind || {}; G.callsByKind[kind] = (G.callsByKind[kind] || 0) + 1;
  for (let attempt = 0; ; attempt++) {
    while (Date.now() < coolUntil) await sleep(Math.min(1000, coolUntil - Date.now()));
    await takeSlot();
    try { const r = await askOnce(kind, prompt, tier); coolStep = 0; if (coolUntil) { coolUntil = 0; emit('onChange'); } return r; }
    catch (e) {
      if (e && e.code === 'rate_limited' && attempt < 5) { coolStep = Math.min(coolStep + 1, 5); const wait = 15000 * 2 ** (coolStep - 1); coolUntil = Math.max(coolUntil, Date.now() + wait); G.stats.rateWaits = (G.stats.rateWaits || 0) + 1; emit('onChange'); continue; }
      throw e;
    } finally { freeSlot(); }
  }
}

const PLACES = {
  spiaggia: { loc: LOC.beach, desc: 'la spiaggia sud, dove il mare ti ha portato' },
  cassa: { loc: LOC.crate, desc: 'una cassa di legno sulla spiaggia' },
  sorgente: { loc: LOC.spring, desc: 'uno specchio d\'acqua tra le rocce, a ovest' },
  palme: { loc: LOC.palmA, desc: 'una palma alta a est del centro' },
  palma_riparo: { loc: LOC.palmB, desc: 'una palma al centro dell\'isola' },
  palma_nord: { loc: LOC.palmC, desc: 'una palma a nord-est, verso la collina' },
  collina: { loc: LOC.hill, desc: 'una collina erbosa a nord, il punto più alto' },
  scogli: { loc: LOC.rocksEast, desc: 'grandi scogli scuri sulla costa est' },
  riva_sud: { loc: LOC.shoreSouth, desc: 'la battigia a sud' },
  pietre: { loc: LOC.stones, desc: 'un gruppo di pietre grigie e alcune pietre nere, a ovest' },
  riparo: { loc: LOC.shelter, desc: 'uno spiazzo riparato vicino alla palma centrale' },
  fuoco: { loc: LOC.firepit, desc: 'un cerchio di pietre per il fuoco vicino alla spiaggia' },
  boscaglia: { loc: LOC.woodSpot, desc: 'arbusti e legni secchi a nord-est' },
  riva: { loc: LOC.sitSpot, desc: 'una roccia piatta sulla riva, da cui guardare il mare' },
  spiaggia_ovest: { loc: LOC.sos, desc: 'una spiaggia ampia e piatta' },
};
// this island's directions and extra places
Object.values(PLACES).forEach((p) => { p.desc = p.desc.replace(/,? ?\b(a|verso la|sulla costa|verso) (nord|sud|est|ovest|nord-est|sud-ovest|nord-ovest|sud-est)\b/g, '').replace(/ (sud|nord|est|ovest)\b/g, '') + ` (a ${ISL.compass(p.loc)})`; });
if (RES.cave) PLACES[RES.cave] = { loc: LOC.cave, desc: (RES.cave === 'grotta' ? 'una grotta bassa nel fianco della collina: dentro è asciutto e buio' : 'una sporgenza di roccia sul fianco della collina: sotto, la pioggia non arriva') + ` (a ${ISL.compass(LOC.cave)})` };
if (RES.banana) PLACES.banani = { loc: LOC.banana, desc: `alcune piante di banano selvatico (a ${ISL.compass(LOC.banana)})` };
if (RES.papaya) PLACES.papaie = { loc: LOC.papaya, desc: `due alberi di papaya (a ${ISL.compass(LOC.papaya)})` };
if (RES.bamboo) PLACES.bambu = { loc: LOC.bamboo, desc: `un boschetto di bambù (a ${ISL.compass(LOC.bamboo)})` };
if (RES.clay) PLACES.argilla = { loc: LOC.clay, desc: `una zona di terra rossa argillosa, appiccicosa quando è bagnata (a ${ISL.compass(LOC.clay)})` };
if (RES.nests) PLACES.nidi = { loc: LOC.nests, desc: `rocce sulla costa dove nidificano uccelli marini (a ${ISL.compass(LOC.nests)})` };
if (RES.springCap > 0 && RES.springCap < 60) PLACES.sorgente.desc = `una piccola sorgente: l'acqua gocciola lenta tra le rocce in una pozza poco profonda (a ${ISL.compass(LOC.spring)})`;
if (RES.springCap === 0) PLACES.sorgente.desc = `una conca nella roccia: niente sorgente, si riempie solo quando piove (a ${ISL.compass(LOC.spring)})`;
if (ISL.S > 1) {
  const C = (L) => ISL.compass(L);
  PLACES.foresta = { loc: LOC.forest, desc: `una foresta fitta di alberi alti, ombrosa e umida: legna, liane, frutti selvatici (a ${C(LOC.forest)})` };
  PLACES.radura = { loc: LOC.clearing, desc: `una radura erbosa nell'interno, riparata dal vento (a ${C(LOC.clearing)})` };
  PLACES.palude = { loc: LOC.marsh, desc: `una palude di acqua ferma e canne, piena di zanzare: l'acqua non è da bere (a ${C(LOC.marsh)})` };
  PLACES.falesia = { loc: LOC.cliff, desc: `una falesia di roccia a picco sul mare, con nidi di uccelli e pietre (a ${C(LOC.cliff)})` };
  PLACES.laguna = { loc: LOC.lagoon, desc: `una laguna di acqua bassa e turchese: pesci e molluschi facili da prendere (a ${C(LOC.lagoon)})` };
  PLACES.spiaggia_est = { loc: LOC.beachEast, desc: `una seconda spiaggia dove il mare accumula legni e rifiuti (a ${C(LOC.beachEast)})` };
  PLACES.promontorio = { loc: LOC.promontory, desc: `una punta rocciosa sul mare aperto: da qui si vede lontano e si è visti dalle navi (a ${C(LOC.promontory)})` };
  PLACES.capanno = { loc: LOC.hut, desc: `una vecchia baracca di legno semicrollata: qualcuno ci ha vissuto prima (a ${C(LOC.hut)})` };
  PLACES.ruscello = { loc: LOC.stream, desc: `un ruscello di acqua dolce che scende dalla sorgente fino al mare (a ${C(LOC.stream)})` };
}
if (RES.lianas) PLACES.boscaglia.desc += '; tra gli arbusti pendono liane robuste';
if (RES.flint) PLACES.pietre.desc += '; tra le pietre ci sono schegge di selce affilate';
// natural or built cover at a place: 0 none … 3 fully dry
function coverAt(name) { const W = G.world; const built = PLACES[name] && W.custom.some((c) => !c.animal && objFn(c) === 'riparo' && dist(c.loc, PLACES[name].loc) < 4) ? 2 : 0; if (name === 'riparo') return Math.max(built, W.shelter || 0); if (built) return built; if (name === 'capanno') return W.hutRepaired ? 3 : 1; if (name === 'foresta') return 1; if (name === 'grotta') return 3; if (name === 'sporgenza') return 2; if (name === 'boscaglia' || name === 'bambu') return 0.5; return 0; }
const STOP = new Set(['della', 'dello', 'delle', 'degli', 'nella', 'sulla', 'con', 'per', 'una', 'uno', 'gli', 'dei', 'del']);
const words = (q) => String(q || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
// fuzzy match of a free-text reference ("le carte", "l'altalena") against custom objects; any shared word (or word stem) counts
function findCustom(q, list) {
  const qs = words(q); if (!qs.length) return null;
  let best = null, bs = 0;
  (list || G.world.custom).filter((c) => !c.animal).forEach((c) => {
    const ns = words(c.name + ' ' + (c.desc || '')); let sc = 0;
    qs.forEach((w) => ns.forEach((n) => { if (n === w) sc += 2; else if (n.slice(0, 5) === w.slice(0, 5) && w.length >= 4) sc += 1; }));
    if (sc > bs) { bs = sc; best = c; }
  });
  return best;
}
const placeOf = (pos) => { let best = 'spiaggia', bd = 1e9; for (const [k, p] of Object.entries(PLACES)) { const d = dist(pos, p.loc); if (d < bd) { bd = d; best = k; } } return { name: best, d: bd }; };

const PSY_KB = `Sfondo psicologico (letteratura su sopravvivenza e isolamento). Usalo per essere credibile, NON come copione: sono tendenze, ogni persona reagisce a modo suo.
- Dopo un disastro (Leach): shock e confusione iniziali, molti restano inerti o agiscono a caso; poi si riorganizzano. Routine, piccoli obiettivi e senso di controllo proteggono.
- Resa psicologica, "give-up-itis" (Leach 2018): ritiro sociale, apatia, perdita della spinta ad agire, trascuratezza di cibo e acqua. Si interrompe con un'azione concreta che ridà controllo o con qualcuno che sprona, provoca o accudisce.
- Isolamento prolungato (basi antartiche): l'umore tende a crollare dopo la metà del periodo; insonnia, irritabilità, ripetitività, "ibernazione psicologica".
- Isolamento sociale e sensoriale (Grassian; esperimenti anni '50): ipersensibilità ai rumori, illusioni, allucinazioni visive e uditive, pensieri ossessivi, memoria e concentrazione fragili, impulsività, sospetto.
- Solitudine e antropomorfismo (Epley 2008): si danno nome, volontà e carattere a oggetti e animali; ci si parla, ci si litiga, si fanno pace.
- Rituali sotto incertezza (Lang 2015; Brooks 2016): gesti ripetitivi e rigidi — contare, allineare pietre, sequenze di palleggi, percorsi fissi — danno senso di controllo e calmano l'ansia, a volte diventando giochi strani o ossessivi.
- "Terzo uomo" (Geiger): in condizioni estreme si può percepire una presenza invisibile accanto, spesso confortante.
- Lutto in isolamento (Ada Blackjack, 1923): chi resta può non riuscire a seppellire il compagno, coprirne o proteggerne il corpo e allontanarsi; scrive il diario in modo asciutto; teme più la solitudine che la morte.
- Anche nei giorni buoni: gioia per piccole cose, umorismo, canto, curiosità, progetti inutili ma belli.`;

/* ---------- state ---------- */
let G = null;
let SAMPLE = null;
const listeners = { onEvent: [], onChange: [] };
const emit = (k, x) => listeners[k].forEach((f) => { try { f(x); } catch (e) { console.error(e); } });

const KIT_ALL = ['axe', 'knife', 'rod', 'rope', 'tarp', 'pot', 'lighter', 'matches', 'bottle', 'firstaid', 'mirror', 'handline'];
// tools a person has on them (older saves: one list for the first castaway)
function carriedOf(a) { const W = G.world; if (W.carriedMap) return W.carriedMap[a.id] || []; return a.id === (W.carriedBy || 'p0') ? (W.carried || []) : []; }
function newGame(setup) {
  const seed = setup.seed || (1 + Math.floor(Math.random() * 999));
  const WX = IslandSim.genWeather(60, IslandSim.rngFrom(seed * 31 + 7));
  const maxDays = setup.days == null ? 20 : Number(setup.days);
  const envR = IslandSim.rngFrom(seed * 17 + 3);
  G = {
    v: 1, islandSeed: ISL.seed, islandSize: ISL.size || 'normal', mindModel: setup.mind === 'haiku' ? 'haiku' : 'sonnet', economy: !!setup.eco, seed, maxDays, day: 1, h: 6, WX, wxOverride: null, tidePhase: envR() * 12.42, moonStart: Math.floor(envR() * 29.5), windDir: envR(), stories: [], history: [], highlights: [], running: false, ended: null,
    world: {
      shelter: 0, bed: false, spear: false, sos: 0, pile: 0, raft: 0, woodPile: 0, coconuts: 12 + RES.extraPalms * 3, palmsAlive: { palme: true, palma_riparo: true, palma_nord: true }, extraPalms: RES.extraPalms, brush: Math.round(24 * RES.bushes), fishStock: Math.min(1, RES.fishRich), crabStock: Math.round(10 * RES.crabs), spring: RES.springCap === 0 ? 0 : RES.springCap, springCap: RES.springCap,
      stone: 0, fiber: 0, stoneLeft: ISL.S > 1 ? 160 : 70, fiberLeft: ISL.S > 1 ? 30 : 18, hearth: false, wall: false, forestWood: ISL.S > 1 ? 90 : 0, hutRepaired: false, hutFound: false, crateOpened: false, fruit: (RES.banana ? 8 : 0) + (RES.papaya ? 5 : 0), eggs: RES.nests ? 6 : 0, rope: !!RES.crate.rope,
      rod: !!RES.crate.rod, axe: !!RES.crate.axe, knife: !!RES.crate.knife, ball: true, ballFace: false, notebookPresent: true,
      fireUntil: -1, fireEverLit: false, bonfireUntil: -1, rainedToday: false,
      sand: [], carvings: [], bodies: [], dog: false, crabs: false, shark: false, bottle: null, custom: [], freeEvents: [],
      shipEvents: [{ day: 8, h: 15.2, dur: 1.8, mode: 'pass' }].concat(maxDays ? [{ day: maxDays, h: 17.4, dur: 2.2, mode: 'pass' }] : []), shipNow: null, rescueTurn: false,
    },
    agents: [], chronicle: [], interventions: [], log: [], nextId: 1, stats: { calls: 0, fails: 0 },
  };
  const p0 = makeAgent({
    id: 'p0', name: setup.name || 'Il naufrago', sex: setup.sex || 'm', kind: 'adulto', age: setup.age || 35,
    amnesia: setup.amnesia === true, persona: setup.persona || '', colors: { shirt: 0x7fb3d5, pants: 0xc2a878, hair: 0x4a3020, beard: true },
    pos: [LOC.beach[0] - 0.5, LOC.beach[1] + 0.8], arrival: 'naufragato sulla spiaggia, senza memoria',
  });
  p0.hasNotebook = true;
  p0.notebook = { pages: setup.amnesia === true && setup.note !== false ? [{ day: 0, text: 'OGNI NOTTE DIMENTICHERAI TUTTO. SCRIVI QUI CIÒ CHE CONTA.', tool: 'penna' }] : [], ink: 100 };
  p0.stats = { sat: 55, hyd: 38, en: 30, hp: 82, umore: 30, mente: 62, term: 42, noia: 0, ansia: 72, igiene: 40 };
  if (ISL.S > 1) { // native fauna of the big island (shapes given, so no extra calls to draw them)
    const goat = [{ f: 'box', d: [0.32, 0.36, 0.75], p: [0, 0.6, 0], c: '#d8cfb8' }, { f: 'cil', d: [0.04, 0.42], p: [-0.11, 0.21, 0.27], c: '#bfb59c' }, { f: 'cil', d: [0.04, 0.42], p: [0.11, 0.21, 0.27], c: '#bfb59c' }, { f: 'cil', d: [0.04, 0.42], p: [-0.11, 0.21, -0.27], c: '#bfb59c' }, { f: 'cil', d: [0.04, 0.42], p: [0.11, 0.21, -0.27], c: '#bfb59c' }, { f: 'box', d: [0.2, 0.24, 0.3], p: [0, 0.88, 0.45], c: '#d8cfb8' }, { f: 'cono', d: [0.035, 0.2], p: [-0.06, 1.08, 0.42], r: [-25, 0, 0], c: '#5a5040' }, { f: 'cono', d: [0.035, 0.2], p: [0.06, 1.08, 0.42], r: [-25, 0, 0], c: '#5a5040' }];
    const boar = [{ f: 'box', d: [0.42, 0.42, 0.85], p: [0, 0.5, 0], c: '#4a3a2c' }, { f: 'cil', d: [0.05, 0.32], p: [-0.14, 0.16, 0.3], c: '#3a2c20' }, { f: 'cil', d: [0.05, 0.32], p: [0.14, 0.16, 0.3], c: '#3a2c20' }, { f: 'cil', d: [0.05, 0.32], p: [-0.14, 0.16, -0.3], c: '#3a2c20' }, { f: 'cil', d: [0.05, 0.32], p: [0.14, 0.16, -0.3], c: '#3a2c20' }, { f: 'box', d: [0.3, 0.3, 0.35], p: [0, 0.52, 0.55], c: '#4a3a2c' }, { f: 'cono', d: [0.03, 0.14], p: [0.1, 0.42, 0.74], r: [-70, 0, 0], c: '#f0e6d0' }, { f: 'cono', d: [0.03, 0.14], p: [-0.1, 0.42, 0.74], r: [-70, 0, 0], c: '#f0e6d0' }];
    const herd = (name, desc, parts, L, n) => { for (let i = 0; i < n; i++) G.world.custom.push({ name, desc, loc: [L[0] + (Math.random() - 0.5) * 4, L[1] + (Math.random() - 0.5) * 4], animal: true, kind: 'quad', parts, phase: Math.random() * 6, completed: true, id: G.nextId++ }); };
    herd('capra selvatica', 'capre selvatiche, diffidenti: scappano se ti avvicini di corsa; si possono addomesticare con pazienza e cibo (latte)', goat, LOC.clearing, 3);
    herd('cinghiale', 'un cinghiale scuro e massiccio: carne abbondante, ma se messo alle strette carica', boar, LOC.forest, 1);
  }
  p0.aware = 0; p0.wokeAt = 6; p0.injury = p0._wtext = 'hai graffi e lividi su braccia e gambe, una botta sul fianco'; p0.wounds = [{ tipo: 'escoriazioni', sev: 9, day: 1, h: 6, testo: 'hai graffi e lividi su braccia e gambe, una botta sul fianco', infected: false }];
  G.agents.push(p0);
  // what else this island's crate holds
  // equipment: random from the island, or chosen in the setup (in the crate, or already on the person)
  const CR = { mirror: ['specchietto', 'uno specchietto da borsetta, crepato in un angolo', 'riflettere il sole per farsi vedere da lontano'], handline: ['lenza e ami', 'un rocchetto di lenza con una decina di ami', 'pescare anche senza canna'], tarp: ['telo di plastica', 'un telo di plastica azzurro, 2 metri per 3, impermeabile', 'coprire, riparare dalla pioggia, raccogliere acqua'], pot: ['pentolino di alluminio', 'ammaccato ma senza buchi', 'bollire acqua, cucinare'], lighter: ['accendino', 'un accendino di plastica, mezzo pieno', 'accendere il fuoco'], matches: ['scatola di fiammiferi', 'una ventina di fiammiferi', 'accendere il fuoco, finché sono asciutti'], bottle: ['bottiglia di plastica vuota', 'da un litro e mezzo, con il tappo', 'tenere acqua'], firstaid: ['kit di pronto soccorso', 'garze, cerotti, un disinfettante, delle pinzette', 'curare ferite'] };
  // the cast: person 1 plus the companions chosen in the setup, each with what they carry on them
  const custom = !!(setup.kit && setup.kit.mode === 'custom');
  const legacyOn = custom && setup.kit.where === 'addosso' && !Array.isArray(setup.cast);
  const cast = Array.isArray(setup.cast) && setup.cast.length ? setup.cast.slice(0, 8) : [{ carry: legacyOn ? (setup.kit.items || []) : [] }];
  if (custom) { const sel = new Set(legacyOn ? [] : (setup.kit.items || [])); KIT_ALL.forEach((k) => { RES.crate[k] = sel.has(k); }); }
  const anyCarry = (k) => custom && cast.some((c) => (c.carry || []).includes(k));
  G.world.axe = !!RES.crate.axe || anyCarry('axe'); G.world.knife = !!RES.crate.knife || anyCarry('knife'); G.world.rod = !!RES.crate.rod || anyCarry('rod'); G.world.rope = !!RES.crate.rope || anyCarry('rope');
  G.world.carriedMap = {};
  const giveCarry = (ag, keys) => { if (!custom) return; const tools = keys.filter((k) => ['axe', 'knife', 'rod', 'rope'].includes(k)); if (tools.length) G.world.carriedMap[ag.id] = tools; keys.forEach((k) => { if (CR[k]) ag.inv.items.push(CR[k][0]); }); };
  giveCarry(p0, cast[0].carry || []);
  cast.slice(1).forEach((c, i) => { applyOps([{ tipo: 'aggiungi_persona', nome: c.name || `Naufrago ${i + 2}`, sesso: c.sex === 'f' ? 'f' : 'm', eta: Number(c.age) || 30, carattere: c.persona || '', arrivo: 'svegliato sulla stessa spiaggia, poco lontano' }], 'scenario'); giveCarry(G.agents[G.agents.length - 1], c.carry || []); });
  Object.entries(CR).forEach(([k, v]) => { if (RES.crate[k]) G.world.custom.push({ name: v[0], desc: v[1], use: v[2], loc: [LOC.crate[0] + (Math.random() - 0.5), LOC.crate[1] + (Math.random() - 0.5)], id: G.nextId++, portable: true, inCrate: true }); });
  initFeatures(setup); initWorldMode(setup);
  chron(`Giorno 1, 06:00 — ${p0.name} si risveglia sulla spiaggia.`);
  emit('onChange');
  return G;
}

function makeAgent(o) {
  return Object.assign({
    alive: true, asleep: false, thinking: false, plan: [], cur: null, heading: Math.PI, interruptReason: null,
    memory: [], longMemory: [], readText: '', readToday: false, thoughts: [], said: null, emotion: '', lastHallucination: null,
    inv: { fish: 0, coconut: 0, crabs: 0, worms: 0, items: [] }, skill: { fire: 0, fish: 0 }, sick: 0,
    stats: { sat: 55, hyd: 50, en: 55, hp: 85, umore: 45, mente: 60, term: 50, noia: 15, ansia: 35, igiene: 60 }, lastDecisionT: -9, nameKnownBy: {}, daysAlone: 0,
    hasNotebook: false, notebook: { pages: [], ink: 0 }, morningNotes: [], departed: null, deathCause: null,
  }, o);
}
const T = () => (G.day - 1) * 24 + G.h;
function ensureRes() { const W = G.world; if (!W.palmsAlive) W.palmsAlive = { palme: true, palma_riparo: true, palma_nord: true }; if (W.brush == null) W.brush = 24; if (W.fishStock == null) W.fishStock = 1; if (W.crabStock == null) W.crabStock = 10; if (W.spring == null) W.spring = 100; if (W.stone == null) { W.stone = 0; W.fiber = 0; W.stoneLeft = 70; W.fiberLeft = 18; } G.agents.forEach((a) => { if (a.stats.term == null) a.stats.term = 50; }); }
const alivePalms = () => Object.values(G.world.palmsAlive).filter(Boolean).length;
const alive = () => G.agents.filter((a) => a.alive && !a.departed);
const byName = (n) => { if (!n) return null; const s = String(n).toLowerCase(); return G.agents.find((a) => a.name.toLowerCase() === s) || G.agents.find((a) => s.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(s)); };
function chron(text, kind) { G.chronicle.push({ day: G.day, h: G.h, text, kind: kind || 'event' }); if (typeof socialScan === 'function') socialScan(text, kind); if (['event', 'death', 'end'].includes(kind || 'event') && typeof highlight === 'function') highlight(text, (G.agents.find((a) => text.includes(a.name)) || G.agents[0] || {}).pos, kind); emit('onEvent', { text, kind }); }
function remember(a, text) { a.memory.push(`${fmtH(G.h)} — ${text}`); if (a.memory.length > 60) a.memory.shift(); }

/* ---------- weather ---------- */
const PRESETS = {
  temporale: { kind: 'temporale', label: 'Temporale', wind: 1, sea: 'agitato', cloud: 0.95, tMax: 25, tMin: 19, rain: true },
  pioggia: { kind: 'pioggia', label: 'Pioggia', wind: 0.45, sea: 'poco mosso', cloud: 0.85, tMax: 26, tMin: 22, rain: true },
  caldo: { kind: 'caldo', label: 'Ondata di caldo', wind: 0.05, sea: 'calmo', cloud: 0, tMax: 38, tMin: 29, rain: false },
  bonaccia: { kind: 'sereno', label: 'Bonaccia', wind: 0.03, sea: 'calmo', cloud: 0, tMax: 30, tMin: 24, rain: false },
  vento: { kind: 'ventoso', label: 'Vento forte', wind: 0.85, sea: 'mosso', cloud: 0.4, tMax: 26, tMin: 20, rain: false },
  freddo: { kind: 'ventoso', label: 'Freddo insolito', wind: 0.7, sea: 'mosso', cloud: 0.5, tMax: 21, tMin: 14, rain: false },
  nebbia: { kind: 'nuvoloso', label: 'Nebbia', wind: 0.1, sea: 'calmo', cloud: 1, tMax: 24, tMin: 20, rain: false, fog: true },
};
const SEA_ORDER = ['calmo', 'poco mosso', 'mosso', 'agitato'];
const KIND_RANK = { temporale: 4, pioggia: 3, pioviggine: 2, ventoso: 1, nuvoloso: 1, sereno: 0 };
function mergeWeather(a, b) {
  const m = Object.assign({}, a);
  m.rain = !!(a.rain || b.rain);
  m.kind = (KIND_RANK[b.kind] || 0) > (KIND_RANK[a.kind] || 0) ? b.kind : a.kind;
  m.wind = Math.max(a.wind, b.wind); m.cloud = Math.max(a.cloud, b.cloud);
  m.sea = SEA_ORDER[Math.max(SEA_ORDER.indexOf(a.sea), SEA_ORDER.indexOf(b.sea))] || a.sea;
  const bt = b.tempSet || /freddo|caldo/i.test(b.label || ''); if (bt) { m.tMax = b.tMax; m.tMin = b.tMin; m.tempSet = true; }
  m.fog = !!(a.fog || b.fog); m.label = [a.label, b.label].filter(Boolean).join(' + ');
  return m;
}
function weatherNow() {
  const base = G.WX[(G.day - 1) % G.WX.length];
  const o = G.wxOverride;
  if (o && T() >= o.from && T() < o.to) {
    const p = o.w; const w = Object.assign({}, base, p, { rain: p.rain ? [G.h - 1, G.h + 50] : null });
    const r = IslandSim.weatherAt(w, G.h); r.desc = w; r.fog = !!p.fog; return r; // an explicit intervention wins even in paradise
  }
  const r = IslandSim.weatherAt(base, G.h); r.desc = base; r.fog = false; return G.paradise ? paradiseWx(r) : r;
}
function weatherText(w) {
  const parts = [];
  if (w.rain > 0.5) parts.push(w.storm ? 'tempesta: pioggia violenta, tuoni e raffiche' : 'piove forte'); else if (w.rain > 0.1) parts.push('pioviggina');
  else if (w.desc.cloud > 0.6) parts.push('cielo coperto'); else parts.push('cielo sereno');
  if (w.fog) parts.push('nebbia fitta, si vede poco');
  parts.push(w.temp >= 33 ? `caldo opprimente (${Math.round(w.temp)}°C)` : w.temp >= 29 ? `caldo (${Math.round(w.temp)}°C)` : w.temp <= 21 ? `fa freddo (${Math.round(w.temp)}°C)` : `temperatura gradevole (${Math.round(w.temp)}°C)`);
  parts.push(w.wind > 0.8 ? 'vento violento' : w.wind > 0.55 ? 'vento forte' : w.wind > 0.3 ? 'brezza' : 'aria ferma');
  parts.push(`mare ${w.desc.sea}`);
  return parts.join(', ');
}

/* ---------- sensations & mind ---------- */
function bodyText(a) {
  const s = a.stats, out = [];
  out.push(s.hyd < 15 ? 'una sete terribile, la bocca è secca e la testa gira' : s.hyd < 40 ? 'molta sete' : s.hyd < 65 ? 'un po\' di sete' : 'non hai sete');
  out.push(s.sat < 15 ? 'una fame che fa male, ti senti svuotato' : s.sat < 40 ? 'molta fame' : s.sat < 65 ? 'un po\' di fame' : 'sei sazio');
  out.push(s.en < 15 ? 'sei sfinito, ti reggi a stento' : s.en < 40 ? 'sei stanco' : s.en < 70 ? 'un po\' affaticato' : 'ti senti riposato');
  { const st = sleepText(a); if (st) out.push(st); }
  if (s.hp < 30) out.push('ti senti molto debole e malato'); else if (s.hp < 60) out.push('non stai bene fisicamente');
  if (a.sick > 0) out.push('hai crampi e mal di pancia');
  const tm = s.term == null ? 50 : s.term;
  if (tm > 86) out.push('sei accaldatissimo, la testa pulsa, rischi un colpo di calore'); else if (tm > 72) out.push('hai molto caldo e sudi'); else if (tm < 14) out.push('stai congelando, tremi senza controllo'); else if (tm < 28) out.push('hai freddo');
  if (a.wet) out.push('sei bagnato fradicio');
  const rv = a.reserves == null ? 100 : a.reserves;
  if (rv < 25) out.push('sei pelle e ossa, ti gira la testa appena ti alzi'); else if (rv < 50) out.push('sei molto dimagrito, le costole si vedono e le forze calano'); else if (rv < 75) out.push('ti senti dimagrito');
  const dft = deficitText(a); if (dft) out.push(dft);
  if (s.hyd < 30) out.push('le labbra sono spaccate');
  if ((a.bitten || 0) > 4) out.push('la pelle è piena di punture che prudono');
  const wt = waterText(a); if (wt) out.push(wt);
  const ig = s.igiene == null ? 80 : s.igiene;
  if (ig < 15) out.push('sei sudicio: incrostato di sale, sudore e sabbia, la pelle prude e brucia, senti il tuo odore e le mosche ti ronzano attorno');
  else if (ig < 35) out.push('ti senti sporco e appiccicoso, la pelle prude');
  else if (ig < 55) out.push('non ti senti pulito');
  if (a.injury) out.push(a.injury + (a.infected ? ' (la ferita è arrossata, calda e pulsa)' : ''));
  return out.join('; ');
}
// doing something different (or absorbing) relieves boredom; repeating the same thing doesn't
function noveltyRelief(a, t, p) {
  const s = a.stats; if (s.noia == null) s.noia = 20;
  a.recentActs = a.recentActs || []; const key = t + ':' + String((p && (p.cosa || p.oggetto || p.descrizione || p.luogo)) || '').slice(0, 20);
  const repeated = a.recentActs.filter((k) => k === key).length;
  const absorbing = ['usa_oggetto', 'gioca_pallone', 'parla', 'esplora', 'costruisci', 'altro', 'scrivi_taccuino', 'incidi', 'scrivi_sabbia', 'pesca'].includes(t);
  s.noia = clamp(s.noia - (repeated >= 2 ? 0 : repeated ? 4 : 10) - (absorbing && repeated < 2 ? 6 : 0) + (repeated >= 3 ? 4 : 0));
  a.recentActs.push(key); if (a.recentActs.length > 8) a.recentActs.shift();
}
function innerText(a) {
  const s = a.stats; const n = s.noia == null ? 20 : s.noia, x = s.ansia == null ? 25 : s.ansia; const L = [];
  if (n > 85) L.push('Una noia opprimente: le ore non passano, ti senti svuotato, ogni cosa che fai ti sembra uguale alla precedente.');
  else if (n > 65) L.push('Ti annoi molto: il tempo si trascina e la monotonia ti pesa.');
  else if (n > 45) L.push('Un po\' di noia: hai voglia di qualcosa di diverso.');
  if (x > 75) L.push('Sei in ansia forte: cuore che batte, pensieri che corrono, non riesci a stare fermo.');
  else if (x > 55) L.push('Sei nervoso e inquieto, teso.');
  else if (x > 40) L.push('Una leggera inquietudine di fondo.');
  return L.join(' ');
}
// awareness grows in stages: confusion -> 'I'm a castaway' -> 'it's an island, and I'm alone' -> acceptance
function updateAware(a) {
  const t = T() - (a.wokeAt != null ? a.wokeAt : 6); const nk = (a.known || []).length; const old = a.aware || 0; let lv = old;
  if (lv < 1 && t > 1.5) lv = 1;
  if (lv < 2 && (nk >= 6 || (a.known || []).includes('collina') || t > 30)) lv = 2;
  if (lv < 3 && G.day >= 4) lv = 3;
  if (lv !== old) { a.aware = lv; if (lv === 2) { remember(a, 'ora ne sei certo: è un\'isola, e non c\'è nessun altro'); a.stats.ansia = clamp((a.stats.ansia || 40) + 10); a.stats.umore = clamp(a.stats.umore - 6); } }
}
function awareText(a) {
  const lv = a.aware || 0;
  if (lv === 0) return 'Ti sei appena risvegliato sulla sabbia, con il mare che ti lambisce i piedi. Non sai bene dove sei né quanto tempo è passato: nella testa solo frammenti confusi (la nave che si inclina, l\'acqua nera, il freddo, aggrapparti a qualcosa). Ti gira la testa, hai il sapore del sale in gola. Nei primi momenti nessuno ragiona con ordine: incredulità, paura, pensare che qualcuno stia già venendo a cercarti.';
  if (lv === 1) return 'Sei naufragato. Non sai ancora dove sei di preciso, né se ci siano altri sopravvissuti o qualcuno nei dintorni. Dentro di te pensi ancora che i soccorsi arriveranno presto.';
  if (lv === 2) return 'Sei naufragato su un\'isola: ormai l\'hai capito, e da quello che hai visto non c\'è nessun altro. Nessuno sa che sei qui.';
  return 'Sei naufragato su un\'isola e sono passati giorni: stai cominciando, a fatica, a farci i conti.';
}
function mindText(a) {
  const m = a.stats.mente;
  if (m >= 72) return 'Interiormente ti senti relativamente saldo.';
  if (m >= 55) return 'Hai alti e bassi; la solitudine e l\'incertezza si fanno sentire a tratti.';
  if (m >= 40) return 'Sei logorato: fatichi a concentrarti, rimugini, ti irriti facilmente, tendi a ripetere gesti e pensieri.';
  if (m >= 22) return 'La tua mente vacilla: confusione, pensieri ossessivi, poca voglia di agire alternata a impulsi improvvisi. Potresti comportarti in modi strani, ripetitivi o imprevedibili.';
  return 'Sei al limite: apatia profonda o agitazione, percezioni distorte, fatichi a distinguere ciò che è reale. Comportamenti bizzarri e imprevedibili sono possibili.';
}
const HALLUCINATIONS = [
  'ti è sembrato di sentire qualcuno chiamarti dalla collina',
  'per un attimo hai visto una figura immobile vicino agli scogli; ora non c\'è più',
  'senti una presenza accanto a te, appena dietro la spalla destra, calma e silenziosa',
  'ti sembra che il pallone ti abbia guardato',
  'hai sentito passi sulla sabbia dietro di te',
  'all\'orizzonte ti è parso di vedere una vela, poi è svanita',
  'senti una musica lontana, come una radio, che va e viene',
  'le pietre sembrano disposte in un ordine che qualcuno ha scelto',
];
function maybeHallucinate(a) {
  const m = a.stats.mente; const sleepDebt = (a.stats.en < 25 ? 0.15 : 0) + ((a.sleepDebt || 0) > 18 ? 0.15 : 0);
  const p = (m < 38 ? (38 - m) / 38 * 0.55 : 0) + sleepDebt + (a.stats.hyd < 15 ? 0.15 : 0);
  if (Math.random() < p) { const hal = HALLUCINATIONS[Math.floor(Math.random() * HALLUCINATIONS.length)]; a.lastHallucination = { day: G.day, h: G.h, text: hal }; chron(`👁 ${a.name} percepisce qualcosa che non c'è: ${hal}.`, 'hallucination'); return hal; }
  return null;
}

/* ---------- perception ---------- */
function knowsName(listener, other) {
  if (listener === other) return true;
  const txt = (listener.memory.join(' ') + ' ' + listener.readText + ' ' + listener.longMemory.join(' ')).toLowerCase();
  return txt.includes(other.name.toLowerCase());
}
function descrOf(viewer, a) {
  if (knowsName(viewer, a)) return a.name;
  const k = a.kind === 'bambino' ? (a.sex === 'f' ? 'una bambina' : 'un bambino') : a.kind === 'anziano' ? (a.sex === 'f' ? 'una donna anziana' : 'un uomo anziano') : (a.sex === 'f' ? 'una donna' : 'un uomo');
  return a.id === 'p0' && a.colors.beard ? 'un uomo con la barba' : k;
}
function actionWords(a) {
  if (!a.alive) return 'immobile, senza vita';
  if (a.asleep) return 'dorme';
  if (a.thinking) return 'è fermo, pensieroso';
  if (!a.cur) return 'è fermo';
  const t = a.cur.type; const W = { raccogli_pietre: 'raccoglie pietre', raccogli_fibre: 'raccoglie fibre', pesca: 'pesca', taglia_legna: 'taglia legna', costruisci: 'costruisce qualcosa', scrivi_taccuino: 'scrive su un taccuino', leggi_taccuino: 'legge un taccuino', accendi_fuoco: 'cerca di accendere un fuoco', gioca_pallone: 'gioca con un pallone', riposa: 'riposa', parla: 'parla', altro: a.cur.p.descrizione || 'fa qualcosa', bevi: 'beve', mangia: 'mangia', seppellisci: 'scava una fossa', veglia: 'veglia un corpo', segnale: 'si sbraccia', vai: 'cammina', esplora: 'esplora' };
  return (a.cur.walking ? 'cammina verso ' + (a.cur.placeName || '') : (W[t] || t));
}
function perceive(a) {
  const W = G.world; const w = weatherNow(); const here = placeOf(a.pos);
  const L = [];
  const near = (loc, r = 6) => dist(a.pos, loc) < r;
  L.push(`Sei vicino a: ${here.name.replace('_', ' ')} (${PLACES[here.name].desc}).`);
  a.known = a.known || Object.keys(PLACES).filter((k) => dist(a.pos, PLACES[k].loc) < 5); if (!a.known.includes(here.name)) a.known.push(here.name);
  updateAware(a);
  const unknown = Object.keys(PLACES).filter((k) => !a.known.includes(k));
  if ((a.aware || 0) < 2) L.push(`Intorno a te: ${a.known.map((k) => PLACES[k].desc.replace(/ \(a [a-z-]+\)$/, '')).join('; ')}. Oltre, non sai ancora cosa ci sia: vegetazione, rocce, forse un'altura.`);
  else L.push(`L'isola è ${ISL.k > 2.4 ? 'grande: per attraversarla a piedi servono ore, l\'interno è coperto di vegetazione e ci sono zone diverse da esplorare' : ISL.k < 0.95 ? 'piccola: la percorri a piedi in pochi minuti' : ISL.k < 1.25 ? 'di media grandezza: per girarla tutta a piedi serve un po\'' : 'più grande di quanto sembrava: girarla a piedi richiede tempo'}. Luoghi che conosci: ${a.known.map((k) => k + ' (' + PLACES[k].desc + ')').join('; ')}.${unknown.length ? ' Il resto dell\'isola non l\'hai ancora esplorato.' : ''}`);
  const crateItems = []; if (W.axe) crateItems.push('un\'ascia'); if (W.knife) crateItems.push('un coltello'); if (W.rope !== false) crateItems.push('una corda'); W.custom.filter((c) => c.inCrate).forEach((c) => crateItems.push(c.name)); if (W.rod) crateItems.push('una canna da pesca completa'); if (W.spear) crateItems.push('una lancia di legno');
  if (W.crateOpened) L.push(`${W.shelter >= 1 ? 'Nel riparo' : 'Nella cassa sulla spiaggia'} ci sono: ${crateItems.join(', ') || 'nulla'}.`);
  else if (a.known.includes('cassa')) L.push('Sulla spiaggia c\'è una cassa di legno arenata, chiusa: non sai cosa contenga.');
  const pa = W.palmsAlive || {}; const felled = Object.keys(pa).filter((k) => !pa[k]);
  const knowsAny = (...ks) => ks.some((k) => (a.known || []).includes(k));
  if (knowsAny('palme', 'palma_riparo', 'palma_nord')) L.push(alivePalms() ? `Sulle ${alivePalms()} palme rimaste ci sono circa ${Math.round(W.coconuts)} noci di cocco mature.` : 'Tutte le palme sono state abbattute: niente più noci di cocco né ombra.');
  if (felled.length) L.push(`Ceppi di palme abbattute: ${felled.map((k) => k.replace('_', ' ')).join(', ')}.`);
  if (knowsAny('boscaglia')) L.push(W.brush >= 14 ? 'Nella boscaglia c\'è parecchia legna secca.' : W.brush >= 5 ? 'Nella boscaglia la legna secca comincia a scarseggiare.' : W.brush >= 1 ? 'Nella boscaglia resta pochissima legna secca.' : 'La boscaglia è spoglia: non c\'è più legna secca (ricresce lentamente).');
  if (W.spring < 15) L.push('La sorgente è quasi secca: resta un fondo d\'acqua torbida.'); else if (W.spring < 45) L.push('Il livello della sorgente si è abbassato.');
  if (W.fishStock < 0.45 && near(LOC.rocksEast, 10)) L.push('Vicino a riva si vedono molti meno pesci di prima.');
  if (W.ball) L.push(W.ballFace ? 'C\'è un pallone su cui qualcuno ha disegnato una faccia.' : 'C\'è un pallone da spiaggia.');
  if (W.shelter > 0) L.push(['', 'Vicino alla palma centrale c\'è una struttura di pali (riparo incompleto).', 'C\'è un riparo con un tetto di foglie.', 'C\'è un riparo solido con il tetto legato e rinforzato.'][W.shelter] + (W.bed ? ' Dentro c\'è un giaciglio rialzato.' : ''));
  const fireOn = W.fireUntil > T();
  if (W.fireEternal) L.push('Il fuoco del campo arde da solo giorno e notte: non si spegne mai e non ha bisogno di legna.'); const ef = (W.custom || []).filter((c) => c.supply && c.supply.kind === 'fuoco' && (c.knownBy || []).includes(a.name)); if (ef.length) L.push(`Fuochi perenni che non si spengono mai: ${ef.map((c) => placeOf(c.loc).name.replace(/_/g, ' ')).join(', ')}.`);
  if (!W.fireEternal) L.push(fireOn ? 'Il fuoco nel cerchio di pietre è acceso.' : W.fireEverLit ? 'Nel cerchio di pietre ci sono ceneri spente.' : 'Il cerchio di pietre per il fuoco è vuoto.');
  if (W.woodPile > 0) L.push(`Vicino al fuoco c'è una scorta di legna (${W.woodPile} pezzi).`);
  if ((W.stone || 0) > 0 || (W.fiber || 0) > 0) L.push(`Al campo hai messo da parte ${[(W.stone || 0) ? W.stone + ' pietre' : '', (W.fiber || 0) ? W.fiber + ' fasci di fibre per legare' : ''].filter(Boolean).join(' e ')}.`);
  if (W.hearth) L.push('Attorno al fuoco c\'è il focolare di pietre che hai costruito.'); if (W.wall) L.push('Il riparo ha un muretto di pietre sul lato del vento.');
  if (W.sos) L.push('Sulla spiaggia sud-ovest c\'è una grande scritta SOS fatta di pietre.');
  if (W.pile) L.push('Sulla collina c\'è una catasta di legna pronta per un falò.' + (W.bonfireUntil > T() ? ' Ora sta bruciando, il fumo sale alto.' : ''));
  if (W.raft > 0) L.push(W.raft >= 4 ? 'Sulla riva sud c\'è una zattera finita, pronta a prendere il mare.' : `Sulla riva sud c'è una zattera in costruzione (${W.raft}/4).`);
  W.sand.forEach((s) => { if (near(s.loc, 7)) L.push(`Sulla sabbia lì vicino c'è scritto${s.stones ? ' con le pietre' : ''}: "${s.text}"`); else L.push(`In lontananza, sulla sabbia vicino a ${placeOf(s.loc).name}, si vedono delle scritte.`); });
  W.carvings.forEach((c) => { if (near(c.loc, 5)) L.push(`Su un tronco qui vicino c'è inciso: "${c.text}"`); });
  W.bodies.forEach((b) => {
    if (b.gone === 'sea') return;
    if (b.gone === 'fire') { if (near(b.loc, 8)) L.push(`Qui ci sono ceneri e ossa annerite di una pira (${b.name}).`); return; }
    if (b.buried) { L.push(near(b.loc, 8) ? `C'è una tomba${b.marker ? ' con ' + b.marker : ''} (${b.name}).` : 'Da qualche parte sull\'isola c\'è una tomba.'); return; }
    const who = knowsName(a, { name: b.name }) ? b.name : b.descr;
    if (b.gone === 'decomposto') { if (near(b.loc, 6)) L.push(`Qui, tra la sabbia e l'erba, restano poche ossa sbiancate (${who}).`); return; }
    const dd = bodyDecay(b);
    const stage = dd < 1 ? '' : dd < 3 ? ' Il corpo si è gonfiato e manda un odore dolciastro; le mosche ronzano.' : dd < 6 ? ' L\'odore è insopportabile, nugoli di mosche e granchi intorno; la pelle si è scurita.' : ' Ne resta poco: pelle secca e annerita sulle ossa.';
    L.push(`${near(b.loc, 8) ? 'Qui vicino' : 'Vicino a ' + placeOf(b.loc).name} c'è il corpo senza vita di ${who}${b.covered ? ', coperto' : ''}.${near(b.loc, 12) ? stage : ''}`);
  });
  G.agents.filter((o) => o !== a && o.alive && !o.departed).forEach((o) => {
    L.push(`${descrOf(a, o)} è ${dist(a.pos, o.pos) < 4 ? 'accanto a te' : 'vicino a ' + placeOf(o.pos).name.replace('_', ' ')} e ${actionWords(o)}.`);
  });
  const da = W.animalAct && W.animalAct.cane && W.animalAct.cane.until > T() ? W.animalAct.cane : null;
  if (W.dog && da) L.push(`Il cane ${da.kind === 'nuota' ? 'si è tuffato in mare e nuota vicino alla riva' : da.text}.`);
  else if (W.dog) L.push(W.dogPlayUntil > T() ? 'Il cane sta giocando da solo con il pallone, lo spinge col muso e abbaia.' : 'Un cane randagio gironzola vicino a te' + (a.dogName ? ` (lo chiami ${a.dogName})` : '') + '; scodinzola quando lo guardi.');
  Object.entries(W.animalAct || {}).forEach(([k, v]) => { if (k !== 'cane' && v && v.until > T() && v.kind !== 'vaga') L.push(`${k[0].toUpperCase() + k.slice(1)}: ${v.text}.`); });
  if (W.dogHurt && W.dog) L.push('Il cane zoppica, è ferito.');
  if (W.dog && W.dogWetUntil > T()) L.push('Il cane è appena uscito dall\'acqua: è fradicio, si scrolla schizzando tutto intorno e puzza di cane bagnato.');
  if (W.crabs) L.push('Sulla riva sud corrono dei granchi.');
  if (W.shark && (near(LOC.rocksEast, 8) || near(LOC.shoreSouth, 5))) L.push('Una pinna grigia gira in cerchio vicino agli scogli.');
  if (W.bottle) L.push(near(W.bottle.loc, 8) ? 'Sulla battigia c\'è una bottiglia chiusa, con dentro qualcosa.' : 'Qualcosa luccica sulla battigia.');
  const seen = new Set();
  W.custom.forEach((c) => { const key = c.name + c.kind; if (seen.has(key)) return; if (!c.animal && c.kind !== 'sea' && !near(c.loc, 9) && !(a.known || []).includes(placeOf(c.loc).name)) return; if (c.inCrate && W.crateOpened === false) return; seen.add(key); const cnt = W.custom.filter((x) => x.name === c.name).length;
    if (c.kind === 'sea') L.push(`Nel mare vicino alla riva nuota${cnt > 1 ? 'no' : ''}: ${c.name}${cnt > 1 ? ' (' + cnt + ')' : ''}${c.desc ? ' — ' + c.desc : ''}.`);
    else if (c.animal) L.push(`${near(c.loc, 8) ? 'Qui vicino' : 'Vicino a ' + placeOf(c.loc).name} c'è: ${c.name}${cnt > 1 ? ' (' + cnt + ')' : ''}${c.desc ? ' — ' + c.desc : ''}.`);
    else L.push(`${near(c.loc, 8) ? 'Qui vicino (' + placeOf(c.loc).name + ')' : 'Vicino a ' + placeOf(c.loc).name} c'è un oggetto${c.addedAt != null && T() - c.addedAt < 24 ? ' che prima non c\'era' : ''}: ${c.name}${cnt > 1 ? ' (' + cnt + ')' : ''}${c.desc ? ' — ' + c.desc : ''}${c.use ? ' — si usa così: ' + c.use : ''}${c.portable === false ? ' (troppo grande da portare: si usa sul posto)' : ''}.`); });
  W.freeEvents.filter((e) => T() - e.t < 6).forEach((e) => L.push(`Sta succedendo: ${e.text}`));
  if (W.shipNow) L.push(W.rescueTurn ? 'LA NAVE STA VIRANDO VERSO L\'ISOLA!' : 'UNA NAVE all\'orizzonte, a nord!');
  const birds = w.rain < 0.3 && G.h > 6.5 && G.h < 19.5; if (birds) L.push('Gabbiani in volo; un pellicano sugli scogli.');
  // food you can actually see from where you are (and, when hungry, food you remember having seen)
  { const nm = here.name; const day = G.h % 24 > 6.3 && G.h % 24 < 19; const shore = /spiaggia|riva|scogli|laguna|promontorio/.test(nm);
    if (shore && day && (W.fishStock == null ? 1 : W.fishStock) > 0.4 && w.waves < 0.6) L.push(nm === 'laguna' ? 'Nell\'acqua bassa e chiara della laguna nuotano pesci, ben visibili.' : 'Nell\'acqua vicino a riva ogni tanto guizza un pesce.');
    if (W.pools && /scogli|laguna/.test(nm)) L.push('Con la bassa marea gli scogli sono scoperti: ci sono molluschi attaccati alla roccia e piccoli granchi nelle pozze.');
    if ((W.coconutsGround || 0) >= 1 && /palm/.test(nm)) L.push(`Sotto le palme ci sono ${Math.floor(W.coconutsGround)} noci di cocco cadute.`);
    if (nm === 'foresta' && (W.forestFruit == null ? 8 : W.forestFruit) >= 1) L.push('Tra i rami pendono frutti selvatici che non conosci.');
    if (/banani|papaie/.test(nm) && (W.fruit || 0) >= 1) L.push('Sugli alberi ci sono frutti maturi.');
    if (a.stats.sat < 40) { const k = a.known || []; const mem = [];
      if (k.some((x) => /palm/.test(x)) && (W.coconuts >= 1 || (W.coconutsGround || 0) >= 1)) mem.push('le noci di cocco sulle palme');
      if (k.includes('scogli') || k.includes('riva_sud') || k.includes('laguna')) mem.push('i pesci che hai visto vicino a riva');
      if (k.includes('scogli') || k.includes('laguna')) mem.push('i molluschi sugli scogli con la bassa marea');
      if (k.includes('foresta')) mem.push('i frutti selvatici della foresta'); if (k.some((x) => /banani|papaie/.test(x))) mem.push('gli alberi da frutto');
      if (k.includes('nidi') || k.includes('falesia')) mem.push('le uova nei nidi');
      if (mem.length) L.push(`La fame ti fa pensare al cibo che hai visto sull'isola: ${mem.join(', ')}.`); else L.push('La fame ti spinge a guardarti intorno: non hai ancora visto niente di sicuro da mangiare.'); } }
  envPerception(a, L); featuresPerception(a, L);
  return { here, lines: L, w };
}

/* ---------- prompt ---------- */
function dynamicActions() { const W = G.world; let s = '';
  if (W.radio && W.radio.found) s += W.radio.fixed ? '\n- {"azione":"usa_radio"} — chiamare aiuto con la radio (la batteria dura poco)' : '\n- {"azione":"ripara_radio"} — servono batteria, antenna e cavo; ci vogliono ore e può non riuscire al primo tentativo';
  if ((G.age || 0) >= 2 && !W.garden) s += '\n- {"azione":"costruisci","cosa":"orto"} — 2 legna e 2 fibre, accanto al riparo: dopo qualche giorno dà da mangiare';
  if (W.garden && (W.gardenFruit || 0) >= 1) s += '\n- {"azione":"raccogli_frutti","luogo":"riparo"} — nell\'orto c\'è qualcosa di maturo';
  if ((G.age || 0) >= 3 && !W.tower) s += '\n- {"azione":"costruisci","cosa":"torre","luogo":"collina|promontorio|falesia"} — 10 legna e 4 fibre: si vede lontano e la vedono le navi';
  return s; }

const ACTIONS_DOC = `Azioni possibili (verranno eseguite in ordine; spostarsi a piedi è automatico):
- {"azione":"vai","luogo":L}  /  {"azione":"esplora","luogo":L oppure "verso nord|sud|est|ovest|l'interno"} — esplorando scopri luoghi che non conosci
- {"azione":"bevi"} — alla sorgente, o acqua piovana se piove
- {"azione":"raccogli_cocco"} — staccarne o raccoglierne una e aprirla: facile con ascia o coltello, molto faticoso senza (spaccandola su una pietra)
- {"azione":"pesca","luogo":"scogli"|"riva_sud"|"laguna"} — con la canna, la lenza o la lancia è più facile; a mani nude nelle pozze o nell'acqua bassa si prova, ma si prende poco; circa 1,5 ore
- {"azione":"cerca_esche"} / {"azione":"cattura_granchi"}
- {"azione":"accendi_fuoco"} — difficile: pietre nere e foglie secche, non con pioggia o vento forte
- {"azione":"alimenta_fuoco"} — consuma legna; tiene il fuoco acceso a lungo (anche la notte)
- {"azione":"cucina_e_mangia"} — serve fuoco acceso e pesce / {"azione":"mangia","cosa":"pesce_crudo"|"cocco"|"granchi"}
- {"azione":"taglia_legna","luogo":"boscaglia"|"foresta"} — legna secca (nella boscaglia serve l'ascia; nella foresta, se la conosci, ce n'è molta e anche a mano raccogli rami); è limitata e ricresce lentamente
- {"azione":"abbatti_palma","quale":"palme"|"palma_riparo"|"palma_nord"} — molta legna (8 pezzi) ma la palma non darà più cocco né ombra
- {"azione":"costruisci","cosa":"riparo"|"giaciglio"|"lancia"|"sos"|"catasta"|"zattera"|"focolare"|"muretto"} — usa legna (riparo 3 per livello, giaciglio 2, lancia 1, catasta 4, zattera 3 per sessione, 4 sessioni) e pietre (focolare 6, muretto 8 più 2 di legna) — oppure qualsiasi altra cosa ti venga in mente (descrivila in "cosa"): l'esito dipenderà da materiali e abilità
- {"azione":"leggi_taccuino"} / {"azione":"scrivi_taccuino","testo":"...con parole tue...","strumento":"penna"|"carbone"}
- {"azione":"scrivi_sabbia","testo":"...","con_pietre":true|false} / {"azione":"incidi","testo":"..."}
- {"azione":"parla","a":nome o "pallone" o "cane" o "me stesso","testo":"..."}
- {"azione":"crea","cosa":"qualcosa che ti va di fare con le tue mani (un'amaca, una scacchiera, un flauto, una scultura, un'altalena, un tavolo…)","come":"come lo fai","ore":n} (servono un po' di legna, fibre o pietre)
- {"azione":"gioca","gioco":"a cosa (carte, una gara, un gioco inventato, raccontarsi storie…)","con":"nome, tutti o da solo","ore":n} / {"azione":"proponi","a":"nome o tutti","attivita":"cosa proponi di fare insieme"}
- {"azione":"gioca_pallone","modo":"come vuoi tu"} / {"azione":"riposa","ore":n} / {"azione":"osserva","cosa":"..."}
- Se c'è un corpo, puoi decidere liberamente cosa farne: {"azione":"seppellisci","chi":nome} / {"azione":"copri_corpo","chi":nome} / {"azione":"getta_in_mare","chi":nome} / {"azione":"brucia_corpo","chi":nome} (servono fuoco e molta legna) / {"azione":"sposta_corpo","chi":nome,"luogo":L} / {"azione":"veglia","chi":nome} — oppure lasciarlo dov'è, o altro.
- {"azione":"segnale"} — sbracciarti; sulla collina con la catasta e del fuoco: falò di segnale
- {"azione":"raccogli","cosa":"..."} — prendi un oggetto piccolo e tienilo con te / {"azione":"apri_cassa"} — se c'è una cassa chiusa
${PLACES.capanno ? '- {"azione":"ripara_capanno"} — alla vecchia baracca: servono 6 di legna e fibre o corda; poi ripara come un riparo completo\n' : ''}- {"azione":"raccogli_pietre"} — sassi da portare al campo (tra le pietre, sugli scogli, sulla collina): servono per focolare, muretto, SOS
- {"azione":"raccogli_fibre"} — liane o foglie di palma da intrecciare: servono per legare (come una corda)
- {"azione":"raccogli_molluschi"} — solo con la bassa marea, tra gli scogli${RES.banana || RES.papaya || PLACES.foresta ? '\n- {"azione":"raccogli_frutti"} — dove ci sono alberi da frutto' : ''}${RES.nests ? '\n- {"azione":"raccogli_uova"} — ai nidi' : ''}
- {"azione":"interagisci_animale","animale":"quale","come":"cosa fai, con parole tue"} — con un animale che c'è sull'isola
- con altre persone: {"azione":"dai","a":nome,"cosa":"..."} / {"azione":"prendi_di_nascosto","a":nome,"cosa":"..."} / {"azione":"parti_zattera"} — rischioso
- {"azione":"usa_oggetto","oggetto":"nome dell'oggetto (che hai con te o che c'è lì)","come":"cosa ci fai, con parole tue","ore":n} — per QUALSIASI oggetto: carte, altalena, libro, strumento...
- {"azione":"dormi"} — chiude la tua giornata
- {"azione":"altro","descrizione":"qualsiasi altra cosa, descritta con parole tue","ore":n}
Non sei limitato a questo elenco: puoi fare qualunque cosa farebbe una persona reale; se non rientra nelle voci sopra usa "altro" descrivendola bene.`;

function buildPrompt(a) {
  const P = perceive(a);
  const hal = maybeHallucinate(a);
  const identity = a.id === 'p0'
    ? `${awareText(a)} ${a.amnesia ? 'Soffri di una forma di amnesia: ogni notte, dormendo, perdi tutti i ricordi della giornata. Non ricordi il tuo nome né la tua vita prima dell\'isola, a meno che non sia scritto da qualche parte o qualcuno te lo dica.' : `Sei una persona comune: ti chiami ${a.name}, ricordi chi sei e la tua vita prima del naufragio (famiglia, lavoro, casa: inventali in modo coerente e mantienili)${G.day > 1 ? ' e ricordi i giorni passati sull\'isola' : ''}.`} Sei ${a.sex === 'f' ? 'una donna' : 'un uomo'} di circa ${a.age} anni.${a.persona ? ' Carattere (tu non lo sai, ma è così che sei): ' + a.persona : ''}${sheetText(a)}`
    : `Sei ${a.name}, ${a.sex === 'f' ? 'donna' : 'uomo'}, ${a.kind}, circa ${a.age} anni. ${a.persona || ''} Come sei arrivato/a qui: ${a.arrival}. ${awareText(a)} ${a.amnesia ? 'Ogni notte perdi tutti i ricordi della giornata.' : 'Hai memoria normale.'}${sheetText(a)}`;
  const nb = a.hasNotebook && G.world.notebookPresent
    ? (a.readToday ? `Oggi hai letto il taccuino che hai in tasca. Contenuto:\n"""\n${a.readText.length > 9000 ? a.readText.slice(0, 1500) + '\n[...pagine centrali sfogliate velocemente...]\n' + a.readText.slice(-7000) : a.readText}\n"""\nInchiostro della penna: ${a.notebook.ink > 60 ? 'abbondante' : a.notebook.ink > 25 ? 'a metà' : a.notebook.ink > 0 ? 'quasi finito' : 'finito'}.`
      : `In tasca hai un taccuino con ${a.notebook.pages.length} pagine scritte${a.notebook.pages.length ? '' : ' (vuoto)'} e una penna. Oggi non l'hai ancora letto.`)
    : (a.id === 'p0' && !G.world.notebookPresent ? 'Il taccuino che sentivi di avere... non c\'è.' : 'Non hai un taccuino.');
  const longMem = a.longMemory.length ? `Ricordi dei giorni passati:\n- ${a.longMemory.slice(-8).join('\n- ')}` : '';
  const inv = []; carriedOf(a).forEach((k) => inv.push({ axe: 'un\'ascia alla cintura', knife: 'un coltello in tasca', rod: 'una canna da pesca smontabile', rope: 'una corda arrotolata' }[k])); if (a.bottleWater > 0) inv.push(`acqua nella bottiglia (${a.bottleWater} sorsate)`); if (a.inv.fish) inv.push(`${a.inv.fish} pesci`); if (a.inv.coconut) inv.push(`${a.inv.coconut} noci di cocco`); if (a.inv.crabs) inv.push(`${a.inv.crabs} granchi`); if (a.inv.worms) inv.push('dei vermi da esca'); a.inv.items.forEach((x) => inv.push(x));
  const timeWord = G.h < 7 ? 'è l\'alba' : G.h < 11 ? 'è mattina' : G.h < 14 ? 'è mezzogiorno passato' : G.h < 17.5 ? 'è pomeriggio' : G.h < 19.5 ? 'il sole sta calando' : G.h < 21 ? 'è sera' : 'è notte';
  return `Stai interpretando una persona reale in un esperimento sociale sul comportamento umano in isolamento. Comportati come farebbe davvero un essere umano: emozioni, paure, stanchezza, speranze, abitudini, errori, irrazionalità, momenti di sconforto e di gioia. Non sei un assistente e non conosci nulla oltre a ciò che è scritto qui.
Ma un essere umano vero ha anche l'istinto di sopravvivere e la testa per ragionare: si accorge da solo dei problemi a partire da ciò che sente e vede, si chiede cosa potrebbe fare, si inventa soluzioni sue con quello che trova, fa progetti, impara dai fallimenti e prova in modo diverso. Nessuno ti suggerisce cosa fare: le idee devono venire da te.
Quando qualcosa ti fa stare male — fame, sete, caldo, freddo, stanchezza, dolore, sporcizia, noia, nervosismo, ansia, solitudine, paura per il futuro — come ogni persona cerchi di fare qualcosa per stare meglio, a modo tuo: a volte in modo sensato, a volte impulsivo o inutile, a volte rimandi o ti blocchi. Le emozioni influenzano QUANTO bene ragiona: quando sta bene è intraprendente, quando è sfinito o depresso rimanda, sbaglia, si blocca o fa scelte impulsive. Non seguire un copione: ragiona con la tua testa su questa situazione concreta. Rappresenta la sofferenza psicologica in modo realistico ma senza autolesionismo.

${PSY_KB}

CHI SEI
${identity}${bioPrompt(a)}

ADESSO
${timeWord} (dal sole, circa le ${fmtH(G.h)}). Meteo: ${weatherText(P.w)}.
Corpo: ${bodyText(a)}.
Mente: ${phaseText(a)} ${mindText(a)}${innerText(a) ? ' ' + innerText(a) : ''}${hal ? `\nPercezione: ${hal}.` : ''}
${a.morningNotes.length ? 'Al risveglio: ' + a.morningNotes.join('; ') + '.' : ''}

COSA VEDI
${P.lines.join('\n')}

COSA PORTI CON TE
${inv.join(', ') || 'niente'}
${usableObjects(a)}
TAQUINO
${nb}
${longMem}

${G.agents.length > 1 ? 'GLI ALTRI (come li vedi tu)\n' + G.agents.filter((o) => o !== a).map((o) => `- ${o.name}${o.alive ? '' : ' (morto)'}: ${(a.relations || {})[o.name] || 'non hai ancora un\'idea precisa'}`).join('\n') + '\nLe scorte comuni sono di tutti: legna vicino al fuoco ' + G.world.woodPile + ' pezzi. Cosa porta ciascuno con sé è suo.\n\n' : ''}I TUOI PROGETTI (li hai decisi tu; aggiornali, completali o abbandonali)
${(a.projects || []).length ? a.projects.map((x) => '- ' + x).join('\n') : '(nessuno ancora)'}

COSA RICORDI DI OGGI
${a.memory.length ? a.memory.slice(-30).join('\n') : '(nulla: ti sei appena svegliato)'}

${ACTIONS_DOC}${dynamicActions()}${featuresActionsDoc(a)}

Decidi cosa fai nelle prossime 1-3 ore. Rispondi SOLO con un oggetto JSON:
{"ragionamento":"in prima persona, pratico: quali problemi vedo adesso e nei prossimi giorni, quali idee mi vengono per risolverli con ciò che ho, cosa provo prima e perché (può essere confuso o sbagliato, come per una persona vera)","progetti":["i tuoi progetti in corso, se ne hai, al massimo 5, brevi, con parole tue"],"risposta_proposta":null oppure la tua risposta a una proposta ricevuta (accetti, rifiuti, rilanci, con parole tue),"relazioni":{"nome di ogni altra persona sull'isola":"come la vedi adesso, con parole tue (fiducia, affetto, sospetto, risentimento...)"} oppure null se sei solo,"pensiero":"monologo interiore in prima persona, 1-3 frasi","dice":null oppure {"a":"nome o pallone o cane o nessuno","testo":"..."},"azioni":[{"azione":"..."}],"umore":0-100,"emozione":"una o due parole","gesto":null oppure un gesto spontaneo che ti viene adesso (ride, piange, si gratta la testa, balla, salta di gioia, alza i pugni, sospira, scrolla le spalle, applaude, saluta),"nomina":null oppure {"cosa":"un posto, un animale o un oggetto dell'isola","nome":"il nome che gli dai"} solo se ti viene spontaneo dargli un nome,"abitudine":null oppure, solo se ti accorgi di aver preso un'abitudine o un piccolo rituale tuo, descrivila in poche parole,"convinzioni":null oppure, solo se un fatto o una discussione ti ha fatto cambiare, rafforzare o mettere in dubbio un'idea, scrivi in una frase cosa pensi adesso,"riassunto_giornata":null}
Da 1 a 4 azioni. "umore" è come ti senti adesso (0 disperazione, 100 felicità). Se scegli "dormi", in "riassunto_giornata" scrivi in 1-2 frasi cosa ricordi di oggi.`.replace('TAQUINO', 'TACCUINO');
}

/* ---------- decisions ---------- */
let failures = 0;
async function decide(a) {
  if (a.thinking || !SAMPLE) return;
  // instinct before thought: someone parched or starving who knows where water or food is goes there first, without waiting for a decision
  if (!a.asleep && !a.inCircle) { const s = a.stats; const T0 = T();
    if (s.hyd < 25 && (nearSupply(a, 'acqua') || G.world.drankSpring || G.world.spring > 0) && (a.reflexT || -9) < T0 - 1) { a.reflexT = T0; a.plan = [{ azione: 'bevi', ragionamento: 'istinto: sete' }]; chron(`💧 ${a.name} ha la gola secca e va d'istinto a bere.`, 'act'); remember(a, 'la sete ti ha spinto a bere senza pensarci'); emit('onChange'); return; }
    if (s.sat < 15 && nearSupply(a, 'cibo') && (a.reflexT || -9) < T0 - 1) { a.reflexT = T0; a.plan = [{ azione: 'raccogli_frutti', ragionamento: 'istinto: fame' }]; chron(`🍊 ${a.name} è affamato e va d'istinto a mangiare.`, 'act'); remember(a, 'la fame ti ha spinto a mangiare senza pensarci'); emit('onChange'); return; } }
  a.thinking = true; a.thinkSince = G.h + (G.day - 1) * 24; emit('onChange');
  if (!a.bio && !a.bioTried) { a.bioTried = true; await genBio(a); }
  let prompt = buildPrompt(a) + funPrompt(a);
  if (a.whisper) { prompt += `\n\nUn pensiero ti attraversa all'improvviso la mente, come un'intuizione tua: «${a.whisper.text}». Valutalo come faresti con qualsiasi idea che ti viene: puoi seguirlo, rimandarlo o lasciarlo perdere, secondo il tuo carattere e la tua situazione. Nel "ragionamento" di' con parole tue cosa pensi di questa idea.`; a.whisperUsed = a.whisper; a.whisper = null; }
  a.morningNotes = [];
  try {
    const out = await ask('mente', prompt, 'mind');
    failures = 0;
    applyDecision(a, out || {});
    if (a.whisperUsed) { a.whisperUsed.answer = String((out && out.ragionamento) || '').slice(0, 400); a.whisperLast = a.whisperUsed; a.whisperUsed = null; }
    G.log.push({ day: G.day, h: G.h, agent: a.name, out });
  } catch (e) {
    failures++; G.stats.fails++;
    console.warn('sample failed', e);
    const code = e && e.code;
    if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled') { G.running = false; emit('onEvent', { kind: 'fatal', text: 'Claude non è disponibile per questa pagina (permesso negato o non attivo).' }); }
    else if (code === 'rate_limited') { G.running = false; coolUntil = 0; emit('onEvent', { kind: 'fatal', text: 'Claude continua a chiedere di rallentare (troppe richieste ravvicinate dalla pagina; ho già riprovato più volte con attese crescenti): esperimento in pausa. Riprendi tra qualche minuto con ▶; con molti personaggi aiuta la mente Haiku o il 🧠 su ⏸.' }); }
    else if (failures >= 3) { G.running = false; emit('onEvent', { kind: 'fatal', text: 'Claude non risponde correttamente (3 errori di fila): esperimento in pausa. Riprova con ▶.' }); failures = 0; }
    a.plan = [{ azione: 'riposa', ore: 0.4 }];
    if (a.whisperUsed && !a.whisper) a.whisper = a.whisperUsed; a.whisperUsed = null; // failed call: the idea is not lost
  } finally { a.thinking = false; if (a.whisper && a.alive && !a.asleep) { a.plan = []; a.cur = null; } /* idea arrived while thinking: think again right away */ a.lastDecisionT = T(); emit('onChange'); }
}
function applyDecision(a, out) {
  if (!a.alive || a.departed) return;
  const th = String(out.pensiero || '').slice(0, 400);
  if (out.risposta_proposta) { const pr = (G.world.proposals || []).filter((x) => x.from !== a.name).slice(-1)[0]; if (pr && !(pr.answers || {})[a.name]) { pr.answers = pr.answers || {}; pr.answers[a.name] = String(out.risposta_proposta).slice(0, 200); chron(`🗣️ ${a.name} risponde a ${pr.from}: «${pr.answers[a.name]}»`, 'event'); } }
  if (out.relazioni && typeof out.relazioni === 'object' && typeof socialRel === 'function') socialRel(a, out.relazioni);
  if (out.relazioni && typeof out.relazioni === 'object') { a.relations = a.relations || {}; Object.entries(out.relazioni).slice(0, 8).forEach(([k, v]) => { if (byName(k)) a.relations[byName(k).name] = String(v).slice(0, 140); }); }
  if (Array.isArray(out.progetti)) a.projects = out.progetti.map((x) => String(x).slice(0, 140)).filter(Boolean).slice(0, 5);
  if (out.ragionamento) a.reasoning = String(out.ragionamento).slice(0, 700);
  a.emotion = String(out.emozione || '').slice(0, 40);
  const u = Number(out.umore); if (Number.isFinite(u)) { a.stats.umore = clamp(u); a.stats.mente = clamp(a.stats.mente + (a.stats.umore - a.stats.mente) * 0.12); }
  a.thoughts.push({ day: G.day, h: G.h, text: th, reasoning: out.ragionamento ? String(out.ragionamento).slice(0, 700) : null, emotion: a.emotion, umore: a.stats.umore, hallucination: a.lastHallucination && a.lastHallucination.day === G.day && Math.abs(a.lastHallucination.h - G.h) < 0.01 ? a.lastHallucination.text : null });
  if (a.thoughts.length > 200) a.thoughts.shift();
  a.bubble = { kind: 'thought', text: th, until: performance.now() + 9000 };
  if (th) remember(a, `pensi: "${th.slice(0, 120)}"`);
  if (out.dice && out.dice.testo) speak(a, out.dice.a, String(out.dice.testo).slice(0, 300));
  if (out.riassunto_giornata) a.daySummary = String(out.riassunto_giornata).slice(0, 300);
  const acts = Array.isArray(out.azioni) ? out.azioni.slice(0, 4) : [];
  a.plan = acts.filter((x) => x && typeof x === 'object' && x.azione);
  if (!a.plan.length) a.plan = [{ azione: 'riposa', ore: 0.4 }];
  const desc = a.plan.map((x) => x.azione + (x.luogo ? ' ' + x.luogo : x.cosa ? ' ' + x.cosa : '')).join(', ');
  chron(`${a.name}: «${th}» → ${desc}`, 'mind');
  funApply(a, out);
}
// who a line is addressed to, as the viewer should read it: a person, a named animal or thing, or himself
function speechTarget(a, to) { const t = String(to || '').trim(); if (!t || /^(nessuno|null|sé|se stesso|me stesso|tra sé)$/i.test(t)) return 'tra sé'; const p = byName(t); if (p) return p.name;
  const ak = typeof animalKeyOf === 'function' ? animalKeyOf(t) : null; const n = (G.world.names || []).find((x) => t.toLowerCase().includes(x.name.toLowerCase()) || t.toLowerCase().includes(String(x.what).toLowerCase()) || (ak && x.animal === ak)); if (n) return n.animal ? `${n.name} (${n.animal})` : n.name; if (ak) return `il ${ak}`; return t.slice(0, 30); }
function speak(a, to, text) {
  a.said = text; a.bubble = { kind: 'speech', text, to: speechTarget(a, to), until: performance.now() + 9000 };
  const target = byName(to);
  remember(a, `hai detto${to && to !== 'nessuno' ? ' a ' + to : ''}: "${text}"`);
  if (to && /pallone|tondo/i.test(to) && G.world.ball) G.world.ballTalks = (G.world.ballTalks || 0) + 1;
  chron(`💬 ${a.name}${to && to !== 'nessuno' ? ' → ' + to : ''}: "${text}"`, 'speech');
  alive().forEach((o) => {
    if (o === a || o.asleep) return;
    const d = dist(o.pos, a.pos);
    if (d < 8 || (o === target && d < 14)) {
      remember(o, `${descrOf(o, a)} ${o === target ? 'ti dice' : 'dice'}: "${text}"`);
      if ((o === target || d < 4) && T() - (o.lastSpokenToT || -9) > 0.3) { o.lastSpokenToT = T(); interrupt(o, 'qualcuno ti ha parlato'); }
    }
  });
}
function interrupt(a, reason) {
  if (!a.alive || a.asleep || a.departed) return;
  if (a.cur && a.cur.type === 'dormi') return;
  a.plan = []; a.cur = null; a.interruptReason = reason; remember(a, `(ti interrompi: ${reason})`);
}
// two people with the same name on the island would be confusing: a newcomer whose name is taken gets another one
const SPARE_NAMES = { m: ['Luca', 'Samir', 'Piero', 'Andrea', 'Omar', 'Bruno', 'Giulio', 'Enzo', 'Paolo', 'Teo'], f: ['Marta', 'Giulia', 'Irene', 'Anna', 'Leila', 'Silvia', 'Chiara', 'Noemi', 'Ines', 'Vera'] };
function uniqueName(name, sex) { const used = new Set(G.agents.map((x) => x.name.toLowerCase())); const want = String(name || '').trim();
  if (want && !used.has(want.toLowerCase())) return want; const free = SPARE_NAMES[sex].find((n) => !used.has(n.toLowerCase()));
  if (free) return free; let i = 2; while (used.has(`${want || SPARE_NAMES[sex][0]} ${i}`.toLowerCase())) i++; return `${want || SPARE_NAMES[sex][0]} ${i}`; }
function whisper(id, text) { const a = G.agents.find((x) => x.id === id); if (!a || !a.alive || !text) return false; a.whisper = { text: String(text).slice(0, 240), t: T() }; a.whisperLast = null;
  G.interventions.push({ day: G.day, h: G.h, text: `💭 voce interiore a ${a.name}: «${a.whisper.text}»`, done: ['pensiero suggerito (decide lui)'] }); chron(`💭 (voce interiore) a ${a.name}: «${a.whisper.text}»`, 'god');
  if (a.asleep) return true; interrupt(a, 'ti viene in mente un\'idea'); return true; }
function interruptAll(reason) { alive().forEach((a) => interrupt(a, reason)); }

/* ---------- actions ---------- */
const DUR = { crea: 2, gioca: 1, proponi: 0.1, ripara_radio: 4, usa_radio: 1.5, ripara_capanno: 3, raccogli_pietre: 1, raccogli_fibre: 1, abbatti_palma: 2.5, getta_in_mare: 0.8, brucia_corpo: 2.0, sposta_corpo: 0.6, esplora: 0.6, bevi: 0.25, raccogli_cocco: 0.6, pesca: 1.5, cerca_esche: 0.3, cattura_granchi: 0.8, accendi_fuoco: 1.0, alimenta_fuoco: 0.25, cucina_e_mangia: 0.6, mangia: 0.25, taglia_legna: 1.0, scrivi_sabbia: 0.3, incidi: 0.5, parla: 0.12, gioca_pallone: 0.6, osserva: 0.4, seppellisci: 1.5, copri_corpo: 0.5, veglia: 1.0, segnale: 0.4, raccogli: 0.2, parti_zattera: 0.4, raccogli_molluschi: 0.8, apri_cassa: 0.3, raccogli_frutti: 0.4, raccogli_uova: 0.5, scrivi_lettera: 0.5, proponi: 0.15, dai: 0.1, prendi_di_nascosto: 0.2 };
const BUILD = { orto: { wood: 2, fiber: 2, dur: 2.5, at: 'riparo', age: 2 }, torre: { wood: 10, fiber: 4, dur: 5, at: null, age: 3 }, focolare: { wood: 0, stone: 6, dur: 1.5, at: 'fuoco' }, muretto: { wood: 2, stone: 8, dur: 3, at: 'riparo' }, riparo: { wood: 3, dur: 2, at: 'riparo' }, giaciglio: { wood: 2, dur: 1, at: 'riparo' }, lancia: { wood: 1, dur: 0.8, at: null }, sos: { wood: 0, dur: 1.5, at: 'spiaggia_ovest' }, catasta: { wood: 4, dur: 1, at: 'collina' }, zattera: { wood: 3, dur: 2, at: 'riva_sud' } };
const ACT_LABEL = { crea: '🛠 crea qualcosa', gioca: '🎲 gioca', proponi: '🙋 propone qualcosa', vai: '🚶 cammina', esplora: '🧭 esplora', bevi: '💧 beve', raccogli_cocco: '🥥 stacca e apre una noce di cocco con l\'ascia', pesca: '🎣 pesca', cerca_esche: '🪱 cerca vermi sotto le pietre', cattura_granchi: '🦀 cattura granchi', accendi_fuoco: '🔥 prova ad accendere il fuoco', alimenta_fuoco: '🪵 alimenta il fuoco', cucina_e_mangia: '🍖 cucina e mangia', mangia: '🍽 mangia', taglia_legna: '🪓 taglia legna', costruisci: '🔨 costruisce', leggi_taccuino: '📖 legge il taccuino', scrivi_taccuino: '✍️ scrive nel taccuino', scrivi_sabbia: '✍️ scrive sulla sabbia', incidi: '🔪 incide un tronco', parla: '💬 parla', gioca_pallone: '⚽ gioca con il pallone', riposa: '😮‍💨 riposa', osserva: '👀 osserva', seppellisci: '⚰️ seppellisce', copri_corpo: '🍃 copre il corpo', veglia: '🕯 veglia', getta_in_mare: '🌊 porta il corpo in mare', brucia_corpo: '🔥 brucia il corpo', sposta_corpo: '↪️ trascina il corpo', segnale: '🙌 fa segnali', raccogli: '✋ raccoglie', usa_oggetto: '🧩 usa un oggetto', parti_zattera: '🛶 parte sulla zattera', dormi: '😴 dorme', altro: '…' };
function doingText(a) {
  if (!a.alive) return '✝ morto' + (a.deathCause ? ' (' + a.deathCause + ')' : '');
  if (a.departed) return '🛶 non è sull\'isola';
  if (a.asleep) return '😴 dorme';
  if (a.directing) return '🎬 vediamo come va…';
  if (a.thinking) return '🧠 sta pensando';
  if (!a.cur) return '… fermo';
  const c = a.cur; let t = c.type === 'altro' ? '✨ ' + String(c.p.descrizione || 'fa qualcosa').slice(0, 60) : c.type === 'usa_oggetto' ? '🧩 ' + String(c.p.come || 'usa') .slice(0, 50) + ' — ' + String(c.p.oggetto || c.p.cosa || '').slice(0, 30) : c.type === 'costruisci' && !BUILD[c.p.cosa] ? '🔨 costruisce ' + String(c.p.cosa || '').slice(0, 50) : (ACT_LABEL[c.type] || c.type);
  if (c.type === 'costruisci' && c.p.cosa) t += ' ' + ({ riparo: 'il riparo', giaciglio: 'un giaciglio', lancia: 'una lancia', sos: 'un SOS di pietre', catasta: 'la catasta per il falò', zattera: 'la zattera' }[c.p.cosa] || c.p.cosa);
  if (c.type === 'parla' && c.p.a) t += ' a ' + c.p.a;
  if (c.walking) t = `🚶 va verso ${String(c.placeName || '').replace('_', ' ')} → ${t}`;
  return t;
}
const ANIM = { crea: 'build', gioca: 'dance', proponi: 'wave', ripara_radio: 'build', usa_radio: 'sit', ripara_capanno: 'build', raccogli_pietre: 'dig', raccogli_fibre: 'reach', vai: 'walk', esplora: 'look', bevi: 'drink', raccogli_cocco: 'reach', pesca: 'fish', cerca_esche: 'dig', cattura_granchi: 'dig', accendi_fuoco: 'firemake', alimenta_fuoco: 'dig', cucina_e_mangia: 'eat', mangia: 'eat', taglia_legna: 'chopLow', abbatti_palma: 'chop', costruisci: 'build', leggi_taccuino: 'read', scrivi_taccuino: 'write', scrivi_sabbia: 'dig', incidi: 'carve', parla: 'talkstand', gioca_pallone: 'play', riposa: 'sit', osserva: 'look', seppellisci: 'dig', copri_corpo: 'dig', veglia: 'cry', getta_in_mare: 'dig', brucia_corpo: 'firemake', sposta_corpo: 'walk', segnale: 'wave', raccogli: 'dig', raccogli_molluschi: 'dig', apri_cassa: 'dig', raccogli_frutti: 'reach', raccogli_uova: 'reach', scrivi_lettera: 'write', proponi: 'talkstand', dai: 'talkstand', prendi_di_nascosto: 'reach', usa_oggetto: 'sit', parti_zattera: 'wave', dormi: 'sleep', altro: 'sit' };

function targetFor(a, x) {
  const t = x.azione; const L = (n) => PLACES[n] ? PLACES[n].loc : null;
  if (t === 'esplora' && !PLACES[x.luogo]) { // explore toward the unknown: nearest unknown place, or in the stated direction
    const unk = Object.keys(PLACES).filter((k) => !(a.known || []).includes(k)); const dirw = String(x.luogo || '').toLowerCase();
    const pool = unk.filter((k) => !/nord|sud|est|ovest/.test(dirw) || ISL.compass(PLACES[k].loc).includes(dirw.match(/nord|sud|est|ovest/)[0]));
    const list = (pool.length ? pool : unk).sort((p1, p2) => dist(a.pos, PLACES[p1].loc) - dist(a.pos, PLACES[p2].loc));
    if (list.length) { x.luogo = list[0]; return L(list[0]); }
  }
  if (t === 'vai' || t === 'esplora') return L(x.luogo) || null;
  if (t === 'bevi') { const sw = nearSupply(a, 'acqua'); if (sw && (!PLACES.sorgente || sw.d <= dist(a.pos, PLACES.sorgente.loc) + 4)) return sw.c.loc.slice(); if (weatherNow().rain > 0.3) return null; if (PLACES.ruscello && x.luogo !== 'sorgente' && (x.luogo === 'ruscello' || ((a.known || []).includes('ruscello') && dist(a.pos, PLACES.ruscello.loc) < dist(a.pos, PLACES.sorgente.loc)))) return L('ruscello'); return L('sorgente'); }
  if (t === 'raccogli_frutti') { const sf = nearSupply(a, 'cibo'); if (sf && !x.luogo) return sf.c.loc.slice(); }
  if (t === 'raccogli_frutti') { if (G.world.garden && (G.world.gardenFruit || 0) >= 1 && (x.luogo === 'riparo' || /orto/.test(String(x.cosa || '')))) return L('riparo'); const opts = ['banani', 'papaie', 'foresta'].filter((k) => PLACES[k] && (x.luogo === k || (a.known || []).includes(k))); if (!opts.length) return null; return L(opts.includes(x.luogo) ? x.luogo : opts.sort((p, q) => dist(a.pos, PLACES[p].loc) - dist(a.pos, PLACES[q].loc))[0]); }
  if (t === 'raccogli_cocco') { const pa = G.world.palmsAlive || {}; const k = ['palme', 'palma_nord', 'palma_riparo'].find((n) => pa[n]); return L(k || 'palme'); }
  if (t === 'pesca' && !G.world.rod && !G.world.spear) { const r = G.world.custom.find((c) => c.tool === 'rod' || c.tool === 'spear'); if (r) return r.loc.slice(); }
  if (t === 'pesca') { if (x.luogo === 'scogli') return L('scogli'); const rs = PLACES.riva_sud.loc; return ISL.shoreAt(Math.atan2(rs[1], rs[0]), -1.7); } // on dry sand even at high tide
  if (t === 'cerca_esche') return L('pietre');
  if (t === 'raccogli_pietre') return L(x.luogo && /scogli|collina/.test(x.luogo) ? x.luogo : 'pietre');
  if (t === 'raccogli_fibre') return L(x.luogo && PLACES[x.luogo] ? x.luogo : RES.lianas ? 'boscaglia' : 'palme');
  if (t === 'cattura_granchi') return L('riva_sud');
  if (['accendi_fuoco', 'alimenta_fuoco', 'cucina_e_mangia'].includes(t)) return L('fuoco');
  if (t === 'taglia_legna') return L(x.luogo === 'foresta' && PLACES.foresta ? 'foresta' : 'boscaglia');
  if (t === 'ripara_capanno') return L('capanno');
  if (t === 'abbatti_palma') return L(PLACES[x.quale] && /palm/.test(x.quale) ? x.quale : 'palme');
  if (t === 'costruisci') { if (x.cosa === 'torre') return L(x.luogo && /promontorio|collina|falesia/.test(x.luogo) ? x.luogo : PLACES.promontorio ? 'promontorio' : 'collina'); const b = BUILD[x.cosa]; return b && b.at ? L(b.at) : null; }
  if (t === 'ripara_radio' || t === 'usa_radio') return L('riparo');
  if (t === 'gioca_pallone') return G.world.ballFace && G.world.shelter ? [LOC.shelter[0] + 1.3, LOC.shelter[1] + 0.6] : LOC.ball;
  if (t === 'incidi') return L('palma_riparo');
  if (['seppellisci', 'copri_corpo', 'veglia', 'getta_in_mare', 'brucia_corpo', 'sposta_corpo'].includes(t)) { const b = G.world.bodies.find((b) => !b.buried && !b.gone && (!x.chi || b.name.toLowerCase().includes(String(x.chi).toLowerCase()))) || G.world.bodies.find((b) => !b.buried && !b.gone); return b ? [b.loc[0] + 0.8, b.loc[1] + 0.4] : null; }
  if (t === 'apri_cassa') return L('cassa');
  if (t === 'raccogli' && /bottigl/i.test(x.cosa || '') && G.world.bottle) return G.world.bottle.loc;
  if (t === 'raccogli') { const c = findCustom(x.cosa || x.oggetto); return c ? c.loc : null; }
  if (t === 'usa_oggetto') { const q = x.oggetto || x.cosa; if (a.inv.items.some((i) => findCustom(q, [{ name: i }]))) return null; const c = findCustom(q); return c ? c.loc : null; }
  if (t === 'parla') { const o = byName(x.a); return o && o !== a && dist(a.pos, o.pos) > 3 ? [o.pos[0] + 1, o.pos[1] + 0.5] : null; }
  if (t === 'parti_zattera') return L('riva_sud');
  if (t === 'segnale' && G.world.pile && /collina|falò|catasta/i.test(JSON.stringify(x))) return L('collina');
  if (t === 'dormi') return G.world.shelter >= 1 ? LOC.shelter : null;
  return null;
}
function startNext(a) {
  const x = a.plan.shift(); if (!x) return;
  const t = String(x.azione || '').toLowerCase().trim();
  x.azione = t;
  let dur = DUR[t] != null ? DUR[t] : 0.5;
  if (t === 'riposa') dur = clamp(Number(x.ore) || 1, 0.2, 3);
  if (t === 'altro') dur = clamp(Number(x.ore) || 0.6, 0.1, 3);
  if (t === 'usa_oggetto') dur = clamp(Number(x.ore) || 0.8, 0.2, 3);
  if (t === 'crea') dur = clamp(Number(x.ore) || 2, 0.5, 6); if (t === 'gioca') dur = clamp(Number(x.ore) || 1, 0.3, 4);
  if (t === 'costruisci') dur = (BUILD[x.cosa] || { dur: 1 }).dur;
  if (t === 'scrivi_taccuino') dur = Math.max(0.2, String(x.testo || '').length / 400) * (x.strumento === 'carbone' ? 1.6 : 1);
  if (t === 'leggi_taccuino') dur = Math.max(0.15, a.notebook.pages.reduce((s, p) => s + p.text.length, 0) / 4000);
  if (t === 'vai') dur = 0.01;
  if (t === 'dormi') dur = 0.01;
  let to = a.inCircle && a.circleSeat ? a.circleSeat.slice() : forcedClamp(a, targetFor(a, x));
  let anim = ANIM[t] || 'sit';
  if (t === 'altro') {
    const d = String(x.descrizione || '').toLowerCase();
    if (/nuot|tuff|bagn|immerg|mare/.test(d)) { const ang = Math.atan2(a.pos[1], a.pos[0]); to = ISL.shoreAt(ang, 1.3); anim = 'swim'; }
    else if (/ball|danz/.test(d)) anim = 'dance';
    else if (/piang|singhiozz|dispera/.test(d)) anim = 'cry';
    else if (/preg|inginocch|medit/.test(d)) anim = 'pray';
    else if (/cant|urla|grida|parla/.test(d)) anim = 'talkstand';
    else if (/scav|buca|sabbia|pietr|conta|allinea|disegn/.test(d)) anim = 'dig';
    else if (/dorm|sdrai|stend/.test(d)) anim = 'sleep';
    else if (/corr/.test(d)) { anim = 'run'; const p2 = Object.values(PLACES)[Math.floor(Math.random() * Object.keys(PLACES).length)].loc; to = p2.slice(); }
    else if (/salt|esult|festeggi/.test(d)) anim = 'wave';
    else if (/nascond/.test(d)) { anim = 'sit'; to = PLACES.boscaglia.loc.slice(); }
    const pl = Object.keys(PLACES).find((k) => d.includes(k.replace('_', ' '))); if (pl && anim !== 'swim') to = PLACES[pl].loc.slice();
    const obj = findCustom(d); if (obj && anim !== 'swim') { to = obj.loc.slice(); x.oggetto = x.oggetto || obj.name; anim = objAnim(d + ' ' + obj.name + ' ' + (obj.use || ''), anim); }
  }
  if (t === 'usa_oggetto') { const q = x.oggetto || x.cosa; const obj = findCustom(q); anim = objAnim(`${x.come || ''} ${q || ''} ${obj ? obj.name + ' ' + (obj.use || '') : ''}`, 'sit'); }
  const walk = to && dist(a.pos, to) > 0.5;
  if (x.forced) chron(`⚡ ${a.name} esegue: ${x.descrizione || t}`, 'god');
  a.cur = { type: t, p: x, dur, el: 0, walking: !!walk, from: a.pos.slice(), to: walk ? to.slice() : a.pos.slice(), walkDur: walk ? dist(a.pos, to) * 0.045 * (ISL.S > 1 ? 0.6 : 1) : 0, placeName: walk ? placeOf(to).name : '', anim, forced: !!x.forced };
}
function stepAgent(a, dh) {
  if (!a.alive || a.departed || a.asleep) return;
  if (a.thinking) return;
  if (!a.cur) { if (a.plan.length) startNext(a); else if (a.inCircle) { a.plan = [{ azione: 'riposa', ore: 0.5 }]; startNext(a); } else decide(a); return; }
  const c = a.cur;
  c.el += dh;
  if (c.walking) {
    const k = Math.min(1, c.el / Math.max(0.01, c.walkDur));
    a.pos = [c.from[0] + (c.to[0] - c.from[0]) * k, c.from[1] + (c.to[1] - c.from[1]) * k];
    a.heading = Math.atan2(c.to[0] - c.from[0], c.to[1] - c.from[1]);
    if (k >= 1) { c.walking = false; c.el = 0; }
    return;
  }
  if (c.el >= c.dur) {
    let res = resolve(a, c.type, c.p); a.cur = null;
    res = afterResolve(a, c.type, c.p, res);
    if (needsDirector(c.type, c.p) && SAMPLE) { direct(a, c.type, c.p, res); return; }
    noveltyRelief(a, c.type, c.p); funActionDone(a, c);
    if (res) { remember(a, res); a.lastResult = res; } emit('onChange');
  }
}

/* ---------- director: Claude decides the outcome of anything the rules don't cover ---------- */
const KNOWN_ACTIONS = new Set(Object.keys(DUR).concat(['vai', 'costruisci', 'leggi_taccuino', 'scrivi_taccuino', 'riposa', 'dormi', 'usa_oggetto', 'altro']));
function needsDirector(t, p) {
  if (t === 'altro' || t === 'usa_oggetto' || t === 'interagisci_animale') return true;
  if (t === 'costruisci' && !BUILD[p.cosa]) return true;
  return !KNOWN_ACTIONS.has(t);
}
// gesture for using an arbitrary object, from the words describing the use
function usableObjects(a) {
  const u = a.usedObjs || {};
  const list = G.world.custom.filter((c) => !c.animal && (dist(a.pos, c.loc) < 9 || (a.known || []).includes(placeOf(c.loc).name)) && !(c.inCrate && G.world.crateOpened === false)).map((c) => `- ${c.name} (vicino a ${placeOf(c.loc).name})${c.use ? ': ' + c.use : ''}${u[c.name] ? ` — l'hai già usato ${u[c.name]} volte` : ' — non l\'hai ancora provato'}`)
    .concat(a.inv.items.map((i) => `- ${i} (ce l'hai con te)${u[i] ? ` — usato ${u[i]} volte` : ' — non l\'hai ancora provato'}`));
  return list.length ? `
OGGETTI SULL'ISOLA CHE POTRESTI USARE (con {"azione":"usa_oggetto","oggetto":...,"come":...}; usarli o ignorarli è una tua scelta, come farebbe una persona vera)
${list.join('\n')}
` : '';
}
function objAnim(txt, def) {
  const d = String(txt).toLowerCase();
  if (/dondol|altalen|amaca/.test(d)) return 'swing';
  if (/carte|solitari|dadi|scacchi|dama|puzzle|tavol/.test(d)) return 'cards';
  if (/legg|libr|rivist|giornal|lettera/.test(d)) return 'read';
  if (/suon|chitarr|ukulel|flaut|armonic|tamburo|strument/.test(d)) return 'strum';
  if (/disegn|dipin|scriv|intagli|scolp/.test(d)) return 'write';
  if (/ball|danz/.test(d)) return 'dance';
  if (/gioc|lanc|palla|frisbee|aquilon/.test(d)) return 'play';
  if (/sdrai|dorm|stend|riposa/.test(d)) return 'sleep';
  if (/pesc/.test(d)) return 'fish';
  if (/mangi|bev/.test(d)) return 'eat';
  return def;
}
const clampD = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
async function direct(a, t, p, baseRes) {
  const W = G.world; a.thinking = true; a.thinkSince = G.h + (G.day - 1) * 24; a.directing = true; emit('onChange');
  const P = perceive(a);
  const st = a.stats;
  const prompt = `Sei il "regista" realistico di una simulazione di sopravvivenza su un'isola tropicale deserta. Un personaggio ha appena fatto, per sua scelta, un'azione che le regole del codice non prevedono: decidi tu, con realismo fisico e psicologico, cosa succede DAVVERO. Decidi SOLO l'esito di ciò che ha scelto: non suggerirgli cosa fare dopo, non dargli idee né consigli.
Personaggio: ${a.name}, ${a.age} anni. Stato (0-100): sazietà ${Math.round(st.sat)}, idratazione ${Math.round(st.hyd)}, energia ${Math.round(st.en)}, salute ${Math.round(st.hp)}, umore ${Math.round(st.umore)}, mente ${Math.round(st.mente)}, igiene ${Math.round(st.igiene == null ? 80 : st.igiene)}, noia ${Math.round(st.noia || 0)}, ansia ${Math.round(st.ansia || 0)}.
Ha con sé: ${a.inv.items.join(', ') || 'niente di particolare'}${W.axe ? '; sull\'isola c\'è un\'ascia' : ''}${W.knife ? ', un coltello' : ''}. Legna pronta: ${W.woodPile} pezzi.
Ora: giorno ${G.day}, ore ${fmtH(G.h)}. Cosa percepisce:
${P.lines.join('\n')}
Azione: ${JSON.stringify(Object.assign({ azione: t }, p))}
Esito provvisorio del codice: ${baseRes || 'nessuno'}

Regole: niente magia; con materiali e attrezzi presenti si possono costruire cose semplici (servono legna, liane, pietre: se mancano, fallisce o riesce male); le azioni possono fallire; effetti piccoli e proporzionati; usare oggetti per svago (carte, altalena, libro…) tira su l'umore e dà struttura alla giornata, ma da soli dopo un po' annoia.
Se l'azione produce un oggetto nuovo nel mondo, descrivilo in "crea" con una "forma": 2–14 solidi semplici, misure reali in metri, origine a terra al centro, y in alto. Parte: {"f":"box|cil|sfera|cono","d":[l,a,p] per box, [raggio,altezza] cil/cono, [raggio] sfera,"p":[x,y,z],"r":[gradi x,y,z],"c":"#rrggbb"}.
Rispondi SOLO con JSON:
{"esito":"cosa succede, 1-2 frasi in seconda persona rivolte al personaggio, solo fatti e sensazioni, senza suggerimenti","cronaca":"1 frase in terza persona per l'osservatore","effetti":{"umore":-15..15,"mente":-10..10,"en":-25..10,"hp":-30..10,"sat":-10..30,"hyd":-10..30,"igiene":-30..50,"noia":-40..20,"ansia":-30..30},"legna_usata":0,"crea":[{"nome":"...","descrizione":"...","uso":"come si usa e cosa dà a chi lo usa","funzione":"acqua (raccoglie pioggia/rugiada) | essiccare (conserva il cibo) | trappola (cattura da sola) | riparo (ripara dalla pioggia) | giaciglio | segnale (visibile dal mare o dal cielo) | nessuna","trasportabile":true|false,"forma":[...]}],"rimuovi":["nome oggetto distrutto/consumato"],"animale":null oppure {"nome":"animale coinvolto","esito":"si avvicina|si lascia toccare|addomesticato|fugge|ferito|catturato|ucciso|attacca","carne":0-5 porzioni se è stato ucciso o catturato per mangiarlo},"prende":["oggetto che ora porta con sé"],"lascia":["oggetto che non ha più"]}`;
  try {
    const out = (await ask('regista', prompt, 'quick')) || {};
    const e = out.effetti || {};
    const lim = { umore: [-15, 15], mente: [-10, 10], en: [-25, 10], hp: [-30, 10], sat: [-10, 30], hyd: [-10, 30], igiene: [-30, 50], noia: [-40, 20], ansia: [-30, 30] };
    Object.entries(lim).forEach(([k, [lo, hi]]) => { if (e[k] != null && st[k] != null) st[k] = clamp(st[k] + clampD(e[k], lo, hi)); });
    W.woodPile = Math.max(0, W.woodPile - Math.max(0, Math.round(Number(out.legna_usata) || 0)));
    (Array.isArray(out.crea) ? out.crea.slice(0, 3) : []).forEach((o) => { if (!o || !o.nome) return;
      W.builtCount = (W.builtCount || 0) + 1; W.custom.push({ fn: ['acqua', 'essiccare', 'trappola', 'riparo', 'giaciglio', 'segnale'].includes(o.funzione) ? o.funzione : undefined, name: String(o.nome).slice(0, 40), desc: String(o.descrizione || '').slice(0, 160), use: String(o.uso || '').slice(0, 160), loc: [a.pos[0] + (Math.random() - 0.5) * 1.2, a.pos[1] + (Math.random() - 0.5) * 1.2], id: G.nextId++, parts: Array.isArray(o.forma) ? o.forma.slice(0, 16) : null, portable: o.trasportabile !== false, addedAt: T(), madeBy: a.name }); });
    if (out.animale && out.animale.nome) { // what happened to the animal
      const an = String(out.animale.nome).toLowerCase(); const es = String(out.animale.esito || ''); const W2 = G.world;
      const c = W2.custom.find((x) => x.animal && (x.name.toLowerCase().includes(an) || an.includes(x.name.toLowerCase())));
      if (/cane/.test(an) && W2.dog) { if (/addomestic|toccare|avvicin/.test(es)) W2.dogTrust = clamp((W2.dogTrust || 20) + (/addomestic/.test(es) ? 25 : 8)); if (/fugge|attacca/.test(es)) W2.dogTrust = clamp((W2.dogTrust || 20) - 10); }
      else if (c) {
        if (/addomestic/.test(es)) { c.tame = a.name; chron(`🐾 ${a.name} addomestica: ${c.name}.`, 'event'); }
        if (/ucciso|catturato/.test(es)) { W2.custom = W2.custom.filter((x) => x !== c); const n = Math.max(0, Math.min(5, Math.round(Number(out.animale.carne) || 0))); for (let i = 0; i < n; i++) a.inv.items.push(`carne di ${c.name}`); chron(`🍖 ${a.name}: ${c.name} ${/ucciso/.test(es) ? 'ucciso' : 'catturato'}.`, 'event'); }
        if (/fugge/.test(es)) { W2.animalAct = W2.animalAct || {}; W2.animalAct[c.name.toLowerCase()] = { kind: 'scappa', text: 'fugge spaventato', luogo: 'collina', chi: null, until: T() + 2 }; }
      }
    }
    (Array.isArray(out.rimuovi) ? out.rimuovi : []).forEach((n) => { const c = findCustom(n); if (c) W.custom = W.custom.filter((x) => x !== c); const i = a.inv.items.findIndex((x) => findCustom(n, [{ name: x }])); if (i >= 0) a.inv.items.splice(i, 1); });
    (Array.isArray(out.prende) ? out.prende : []).forEach((n) => { const c = findCustom(n, W.custom.filter((c) => dist(a.pos, c.loc) < 4)); if (c && c.portable !== false) { W.custom = W.custom.filter((x) => x !== c); a.inv.items.push(c.name); } });
    (Array.isArray(out.lascia) ? out.lascia : []).forEach((n) => { const i = a.inv.items.findIndex((x) => findCustom(n, [{ name: x }])); if (i >= 0) { const nm = a.inv.items.splice(i, 1)[0]; const o = (a.inv.objs || {})[nm] || { name: nm }; W.custom.push(Object.assign({}, o, { id: G.nextId++, loc: [a.pos[0] + 0.6, a.pos[1] + 0.4] })); } });
    const esito = String(out.esito || baseRes || '').slice(0, 300);
    if (out.cronaca) chron(`🎬 ${String(out.cronaca).slice(0, 220)}`, 'act');
    if (esito) { remember(a, esito); a.lastResult = esito; }
    G.log.push({ day: G.day, h: G.h, agent: a.name, director: { azione: t, p, out } });
  } catch (err) {
    console.warn('director failed', err); if (baseRes) { remember(a, baseRes); a.lastResult = baseRes; }
  } finally { a.thinking = false; a.directing = false; emit('onChange'); save(); }
}

/* ---------- animal director: Claude decides what the animals do, including interactions ---------- */
function animalRoster() {
  const W = G.world; const w = weatherNow(); const day = G.h > 6.3 && G.h < 19.8; const R = [];
  if (W.dog) R.push({ key: 'cane', desc: 'un cane randagio' + (W.dogHurt ? ' (ferito)' : '') });
  if (day && w.rain < 0.3 && !w.storm) { R.push({ key: 'gabbiani', desc: 'uno stormo di 6 gabbiani' }); R.push({ key: 'pellicano', desc: 'un pellicano sugli scogli' }); }
  if (W.crabs) R.push({ key: 'granchi', desc: 'granchi sulla riva sud' });
  if (W.shark) R.push({ key: 'squalo', desc: 'uno squalo vicino agli scogli' });
  const seen = new Set(); W.custom.filter((c) => c.animal).forEach((c) => { const k = c.name.toLowerCase(); if (seen.has(k)) return; seen.add(k); R.push({ key: k, desc: `${c.name} (${W.custom.filter((x) => x.animal && x.name === c.name).length}, vicino a ${placeOf(c.loc).name})${c.desc ? ' — ' + c.desc : ''}` }); });
  return R;
}
const ANIMAL_KINDS = ['vaga', 'va', 'segue', 'attacca', 'fugge', 'mangia', 'dorme', 'gioca', 'nuota', 'abbaia', 'scava', 'osserva'];
let animalBusy = false;
async function directAnimals(reason) {
  if (!SAMPLE || animalBusy || !G) return null;
  const roster = animalRoster(); if (!roster.length) return null;
  animalBusy = true; const W = G.world; G.lastAnimalDirector = T();
  const people = alive().map((a) => `${a.name} (${placeOf(a.pos).name}${a.asleep ? ', dorme' : a.cur ? ', ' + doingText(a) : ''})`).join('; ');
  const prompt = `Sei il "regista" realistico degli animali in una simulazione di un'isola tropicale deserta. Decidi cosa fanno gli animali nelle prossime ore, come si comporterebbero davvero (etologia: territorialità, fame, paura, curiosità, branco), incluse le interazioni tra loro e con le persone.
Ora: giorno ${G.day}, ore ${fmtH(G.h)}. Meteo: ${weatherText(weatherNow())}.
Animali presenti: ${roster.map((r) => `[${r.key}] ${r.desc}`).join('; ')}.
Persone: ${people || 'nessuna'}. Luoghi: ${Object.keys(PLACES).join(', ')}.
Cibo in giro: ${W.fishOut ? 'pesce lasciato' : 'niente di lasciato'}; ${(W.bodies || []).filter((b) => !b.buried && !b.gone).length ? 'c\'è un corpo non sepolto' : 'nessun corpo esposto'}.
Motivo della regia: ${reason}
Rispondi SOLO con JSON:
{"azioni":[{"animale":"chiave esatta tra quadre","comportamento":"${ANIMAL_KINDS.join('|')}","bersaglio":"nome di persona, chiave di un animale o luogo (se serve)","ore":0.2-6,"descrizione":"breve, cosa si vede"}],
"conseguenze":[{"chi":"nome persona o chiave animale","esito":"illeso|spaventato|ferito|morto|scappa","danno":0-60,"descrizione":"..."}],
"cronaca":"1-2 frasi in terza persona su cosa si vede"}
Sii realistico: i gabbiani possono infastidire o beccare un cane ma raramente ucciderlo; un cane spaventato scappa o si difende; non inventare animali che non ci sono.`;
  try {
    const out = (await ask('animali', prompt, 'quick')) || {};
    W.animalAct = W.animalAct || {};
    const keys = new Set(roster.map((r) => r.key));
    (Array.isArray(out.azioni) ? out.azioni : []).slice(0, 10).forEach((x) => {
      let k = String(x.animale || '').toLowerCase(); if (!keys.has(k)) k = [...keys].find((kk) => k.includes(kk) || kk.includes(k)) || null; if (!k) return;
      let kind = String(x.comportamento || 'vaga').toLowerCase(); if (!ANIMAL_KINDS.includes(kind)) kind = /attacc|becc|mord/.test(kind) ? 'attacca' : /scapp|fugg/.test(kind) ? 'fugge' : 'vaga';
      const tgt = String(x.bersaglio || '');
      W.animalAct[k] = { kind: kind === 'fugge' ? 'scappa' : kind, text: String(x.descrizione || kind).slice(0, 160), luogo: PLACES[tgt] ? tgt : null, chi: PLACES[tgt] ? null : tgt || null, until: T() + clamp(Number(x.ore) || 1, 0.2, 6) };
      if (k === 'cane' && kind === 'gioca') W.dogPlayUntil = T() + clamp(Number(x.ore) || 0.6, 0.1, 6);
    });
    (Array.isArray(out.conseguenze) ? out.conseguenze : []).slice(0, 6).forEach((c) => {
      const who = String(c.chi || ''); const es = String(c.esito || ''); const dmg = clamp(Number(c.danno) || 0, 0, 60);
      const person = byName(who);
      if (person) { person.stats.hp = clamp(person.stats.hp - dmg); if (dmg > 0) person.injury = String(c.descrizione || 'ferito da un animale').slice(0, 120); person.stats.umore = clamp(person.stats.umore - (es === 'spaventato' ? 6 : dmg / 3)); remember(person, String(c.descrizione || es)); if (person.stats.hp <= 0) die(person, String(c.descrizione || 'ucciso da un animale')); return; }
      const k = who.toLowerCase();
      if (/cane/.test(k) && W.dog) {
        if (es === 'morto') { W.dog = false; W.animalAct.cane = null; const dp = W.dogPos || LOC.beach; W.custom.push({ name: 'corpo del cane', desc: String(c.descrizione || '').slice(0, 120), loc: [dp[0], dp[1]], id: G.nextId++, portable: true, addedAt: T(), parts: [{ f: 'box', d: [0.3, 0.22, 0.7], p: [0, 0.11, 0], r: [0, 0, 80], c: '#8a5a2b' }, { f: 'box', d: [0.22, 0.2, 0.28], p: [0.05, 0.1, 0.45], r: [0, 0, 80], c: '#8a5a2b' }, { f: 'cil', d: [0.04, 0.35], p: [0.2, 0.06, 0.15], r: [0, 0, 90], c: '#7a4a1b' }] }); chron('🐕 Il cane è morto.', 'death'); }
        else if (es === 'ferito') W.dogHurt = true;
      } else if (es === 'morto') {
        const c2 = W.custom.find((x) => x.animal && x.name.toLowerCase() === k);
        if (c2) { W.custom = W.custom.filter((x) => x !== c2); W.custom.push({ name: `carcassa di ${c2.name}`, desc: '', loc: c2.loc.slice(), id: G.nextId++, portable: true, addedAt: T(), parts: c2.parts ? c2.parts.map((p) => Object.assign({}, p, { r: [0, 0, 85] })) : null }); }
      }
    });
    const cr = String(out.cronaca || '').slice(0, 300);
    if (cr) { chron(`🐾 ${cr}`, 'event'); W.freeEvents.push({ t: T(), text: cr }); alive().forEach((a) => { if (!a.asleep) remember(a, `vedi: ${cr}`); }); if (reason !== 'routine') interruptAll(cr); }
    G.log.push({ day: G.day, h: G.h, agent: 'regista animali', out });
    emit('onChange'); save();
    return out;
  } catch (e) { console.warn('animal director failed', e); return null; }
  finally { animalBusy = false; }
}

/* resolve: physical outcomes only */
// tools still shut in the crate can't be used until someone opens it
function resolve(a, t, p) {
  const W = G.world; if (W.crateOpened !== false) return resolveRaw(a, t, p);
  const keep = { axe: W.axe, knife: W.knife, rod: W.rod }; const carried = carriedOf(a); W.axe = carried.includes('axe') && keep.axe; W.knife = carried.includes('knife') && keep.knife; W.rod = carried.includes('rod') && keep.rod;
  try { return resolveRaw(a, t, p); } finally { if (!W.crateOpened) Object.assign(W, keep); else ['axe', 'knife', 'rod'].forEach((k) => { if (keep[k]) W[k] = true; }); }
}
function resolveRaw(a, t, p) {
  const W = G.world; const w = weatherNow(); const here = placeOf(a.pos).name; const R = Math.random;
  const rainNow = w.rain > 0.3; const birdy = w.rain < 0.3 && !w.storm;
  switch (t) {
    case 'vai': return `sei arrivato a ${here.replace('_', ' ')}`;
    case 'esplora': return `hai esplorato ${here.replace('_', ' ')}: ${PLACES[here].desc}${here === 'collina' ? '; da qui vedi tutta l\'isola e il mare in ogni direzione, nessuna terra in vista' : ''}${here === 'sorgente' ? '; l\'acqua sembra limpida' : ''}`;
    case 'bevi': {
      { const sp = supplyHere(a, 'acqua'); if (sp) return useSupply(a, sp); }
      const atW = here === 'sorgente' || here === 'ruscello'; if (here === 'ruscello' && !rainNow && a.bottleWater <= 0) { if (hasGear(a, /bottigli/)) a.bottleWater = 3; a.stats.hyd = clamp(a.stats.hyd + 45); W.drankSpring = true; return `hai bevuto l'acqua fresca del ruscello${hasGear(a, /bottigli/) ? ' e riempito la bottiglia' : ''}`; }
      if (rainNow) { a.stats.hyd = 100; if (hasGear(a, /bottigli/)) a.bottleWater = 3; return `hai bevuto acqua piovana${hasGear(a, /bottigli/) ? ' e riempito la bottiglia' : ''}`; }
      if (here !== 'sorgente' && a.bottleWater > 0) { a.bottleWater--; a.stats.hyd = clamp(a.stats.hyd + 30); return `hai bevuto dalla bottiglia (ne restano ${a.bottleWater} sorsate)`; }
      if (here !== 'sorgente' && (W.tarpWater || 0) >= 5 && hasGear(a, /telo/)) { W.tarpWater -= 10; a.stats.hyd = clamp(a.stats.hyd + 35); return 'hai bevuto l\'acqua piovana raccolta nel telo'; }
      if (here === 'sorgente' && hasGear(a, /bottigli/)) a.bottleWater = 3;
      if (here === 'sorgente' && W.spring < 15 && hasGear(a, /pentolin/) && W.fireUntil > T()) { W.drankSpring = true; a.stats.hyd = clamp(a.stats.hyd + 55); W.spring = Math.max(0, W.spring - 3); return 'hai fatto bollire l\'acqua torbida nel pentolino: ora si può bere senza rischi'; }
      if (here === 'sorgente') { W.drankSpring = true; if (W.spring < 15) { a.stats.hyd = clamp(a.stats.hyd + 55); W.spring = Math.max(0, W.spring - 3); if (R() < 0.35) { a.sick = 5; return 'la sorgente è quasi secca: hai bevuto acqua torbida e poco dopo ti senti lo stomaco sottosopra'; } return 'la sorgente è quasi secca: hai bevuto un po\' d\'acqua torbida'; } a.stats.hyd = 100; W.spring = Math.max(0, W.spring - 2); return 'hai bevuto alla sorgente: l\'acqua è dolce e fresca'; }
      return 'qui non c\'è acqua da bere'; }
    case 'raccogli_cocco':
      if (!alivePalms()) return 'non ci sono più palme: sono state tutte abbattute';
      if (W.coconuts < 1 && (W.coconutsGround || 0) < 1) return 'non ci sono noci mature: bisogna aspettare che maturino';
      { const tool = W.axe || W.knife || a.inv.items.some((i) => /selce|machete/.test(i)); const fromGround = W.coconuts < 1;
        if (!tool) { a.stats.en = clamp(a.stats.en - 5); if (R() < 0.35) { if (!fromGround) W.coconuts -= 1; else W.coconutsGround -= 1; ate(a, 'cocco'); a.stats.sat = clamp(a.stats.sat + 14); a.stats.hyd = clamp(a.stats.hyd + 2); return 'hai sbattuto la noce contro una pietra finché si è crepata: il latte è colato via, ma la polpa l\'hai grattata con le dita'; }
          if (R() < 0.35) return 'hai provato a spaccare la noce su una pietra per molto tempo: il guscio fibroso non cede, hai le mani graffiate'; }
        if (fromGround) W.coconutsGround -= 1; else W.coconuts -= 1; ate(a, 'cocco'); a.stats.sat = clamp(a.stats.sat + 22); a.stats.hyd = clamp(a.stats.hyd + 8);
        return tool ? 'hai aperto una noce di cocco: hai bevuto il latte e mangiato la polpa' : 'dopo molti colpi contro una pietra la noce si è spaccata: hai bevuto il latte e mangiato la polpa'; }
    case 'cerca_esche': a.inv.worms = 4; return 'sotto le pietre grigie hai trovato dei vermi';
    case 'pesca': {
      if (!W.rod && !W.spear) { const r = W.custom.find((c) => (c.tool === 'rod' || c.tool === 'spear') && dist(a.pos, c.loc) < 4); if (r) { W.custom = W.custom.filter((x) => x !== r); W[r.tool] = true; remember(a, `hai raccolto ${r.name}`); } }
      const handline = !W.rod && !W.spear && hasGear(a, /lenza/);
      if (!W.rod && !W.spear && !handline) { // bare hands: in pools and shallow water, rarely successful
        a.stats.en = clamp(a.stats.en - 4); const pBare = 0.08 + (here === 'laguna' ? 0.14 : here === 'scogli' && W.pools ? 0.1 : 0) + Math.min(10, a.skill.fish) * 0.01;
        a.skill.fish = (a.skill.fish || 0) + 0.3;
        if (Math.random() < pBare * (W.fishStock == null ? 1 : W.fishStock)) { a.inv.fish += 1; W.fishStock = Math.max(0.15, (W.fishStock || 1) - 0.03); return 'a mani nude, dopo molti tentativi nell\'acqua bassa, sei riuscito a bloccare un pesce contro le rocce'; }
        return 'hai provato a prendere i pesci a mani nude nell\'acqua bassa: ti sfuggono ogni volta'; }
      const spot = here === 'scogli' || here === 'laguna';
      if (w.desc.sea === 'agitato') return 'il mare è troppo agitato: le onde ti hanno quasi trascinato via, niente pesce';
      let pr = (W.fishStock == null ? 1 : W.fishStock) * 0.0 + 0.16 + (spot ? 0.2 : 0) + (a.inv.worms ? 0.22 : 0) + Math.min(10, a.skill.fish) * 0.02 + (w.desc.sea === 'calmo' ? 0.05 : w.desc.sea === 'mosso' ? -0.08 : 0) - (rainNow ? 0.05 : 0);
      if (!W.rod) pr *= handline ? 0.8 : 0.7;
      pr *= 0.35 + 0.65 * (W.fishStock == null ? 1 : W.fishStock);
      let n = 0; for (let i = 0; i < 4; i++) if (R() < pr) n++;
      const notes = [];
      if (spot && w.desc.sea === 'mosso' && R() < 0.35) { a.stats.hp = clamp(a.stats.hp - 12); a.injury = 'hai un ginocchio sbucciato e dolorante'; notes.push('sei scivolato sugli scogli bagnati e ti sei ferito al ginocchio'); }
      if (spot && W.shark && R() < 0.2) { a.stats.hp = clamp(a.stats.hp - 25); a.injury = 'hai un taglio profondo al polpaccio'; notes.push('uno squalo è passato vicinissimo e ti ha ferito il polpaccio'); n = Math.max(0, n - 1); }
      if (spot && birdy && G.h > 9.5 && R() < 0.35) { n = Math.max(0, n - 1); notes.push('un pellicano si tuffava di continuo e spaventava i pesci'); }
      a.skill.fish++; if (a.inv.worms) a.inv.worms = Math.max(0, a.inv.worms - 2);
      if (n > 0 && birdy && !W.dog && R() < 0.3) { n--; notes.push('un gabbiano ti ha rubato un pesce appena pescato'); }
      a.inv.fish += n; W.fishStock = Math.max(0.15, (W.fishStock || 1) - 0.035 * n);
      return `${n ? `hai pescato ${n} pesc${n === 1 ? 'e' : 'i'}` : 'non hai preso niente'}${notes.length ? '; ' + notes.join('; ') : ''}`;
    }
    case 'cattura_granchi': if (!W.crabs && !W.crabsNatural) return 'di giorno, con l\'alta marea, i granchi stanno nascosti nelle tane'; { if ((W.crabStock || 0) < 1) return 'i granchi si sono fatti rari, non ne trovi'; const n = Math.min(W.crabStock, 1 + Math.floor(R() * 3)); W.crabStock -= n; a.inv.crabs += n; return `hai catturato ${n} granchi${R() < 0.4 ? ', uno ti ha pizzicato un dito' : ''}`; }
    case 'accendi_fuoco': {
      if (W.fireUntil > T()) return 'il fuoco era già acceso';
      if (rainNow) return 'con questa pioggia è impossibile: tutto è bagnato';
      const lighter = a.inv.items.find((x) => /accendin|fiammifer/.test(x) && !/bagnato|vuot|finit/.test(x)) || (W.custom.find((c) => /accendin|fiammifer/.test(c.name) && !(c.inCrate && W.crateOpened === false) && dist(a.pos, c.loc) < 4) || {}).name; const lkey = /fiammifer/.test(lighter || '') ? 'matchUses' : 'lighterUses'; if (lighter && (G[lkey] = (G[lkey] || 0) + 1) <= (lkey === 'matchUses' ? 20 : 30) && w.wind < 0.8) { W.fireUntil = T() + 2.5; W.fireEverLit = true; a.stats.umore = clamp(a.stats.umore + 8); return `con ${lighter} hai acceso il fuoco al primo colpo`; }
      const pr = (0.22 + a.skill.fire * 0.14 + (W.fireEverLit ? 0.1 : 0)) * (1 - 0.45 * w.wind);
      a.skill.fire++;
      if (R() < pr) { W.fireUntil = T() + 2.5; W.fireEverLit = true; a.stats.umore = clamp(a.stats.umore + 8); return 'battendo le pietre nere sopra foglie secche hai acceso il fuoco!'; }
      return w.wind > 0.6 ? 'il vento spegneva ogni scintilla: niente fuoco' : 'solo scintille, il fuoco non prende';
    }
    case 'alimenta_fuoco':
      if (W.fireUntil <= T()) return 'il fuoco è spento: non c\'è niente da alimentare';
      if (W.woodPile < 1) return 'non c\'è legna da aggiungere';
      W.woodPile -= Math.min(W.woodPile, 3); W.fireUntil = Math.max(W.fireUntil, T()) + (G.h > 18 ? 12 : 4) * (W.hearth ? 1.5 : 1); return G.h > 18 ? 'hai caricato il fuoco: dovrebbe durare tutta la notte' : 'hai aggiunto legna al fuoco';
    case 'cucina_e_mangia':
      if (W.fireUntil <= T() && !supplyHere(a, 'fuoco')) return 'il fuoco è spento, non puoi cucinare';
      { const mi = a.inv.items.findIndex((x) => /^carne/.test(x)); if (!a.inv.fish && !a.inv.crabs && mi >= 0) { const n = a.inv.items.filter((x) => /^carne/.test(x)).length; a.inv.items = a.inv.items.filter((x) => !/^carne/.test(x)); a.stats.sat = clamp(a.stats.sat + 35 * n); a.stats.umore = clamp(a.stats.umore + 6); ate(a, 'carne'); return 'hai arrostito la carne sul fuoco: il profumo, il grasso che sfrigola, finalmente un pasto vero'; } }
      if (!a.inv.fish && !a.inv.crabs) return 'non hai niente da cucinare';
      { const n = a.inv.fish + a.inv.crabs * 0.5; a.stats.sat = clamp(a.stats.sat + 30 * n); a.inv.fish = 0; a.inv.crabs = 0; a.stats.umore = clamp(a.stats.umore + 4); return 'hai cucinato e mangiato: cibo caldo, finalmente'; }
    case 'mangia': {
      const c = String(p.cosa || '');
      if (/cocco/.test(c)) { if (a.inv.coconut) { a.inv.coconut--; a.stats.sat = clamp(a.stats.sat + 22); return 'hai mangiato una noce di cocco'; } return 'non hai noci di cocco con te'; }
      const meat = a.inv.items.findIndex((x) => /^carne/.test(x)); if ((/carne|animal/.test(c) || (!a.inv.fish && !a.inv.crabs && !/cocco/.test(c))) && meat >= 0) { a.inv.items.splice(meat, 1); a.stats.sat = clamp(a.stats.sat + 30); ate(a, 'carne'); if (R() < 0.4) { a.sick = 6; return 'hai mangiato la carne cruda: poco dopo crampi e nausea'; } return 'hai mangiato la carne cruda, dura e dal sapore forte'; }
      if (/granch/.test(c)) { if (a.inv.crabs) { a.stats.sat = clamp(a.stats.sat + 9 * a.inv.crabs); a.inv.crabs = 0; return 'hai mangiato i granchi crudi'; } return 'non hai granchi'; }
      if (a.inv.fish) { const n = a.inv.fish; a.stats.sat = clamp(a.stats.sat + 18 * n); a.inv.fish = 0; if (R() < 0.55) { a.sick = 6; a.stats.hp = clamp(a.stats.hp - 6); return 'hai mangiato il pesce crudo; poco dopo ti vengono crampi allo stomaco'; } return 'hai mangiato il pesce crudo'; }
      return 'non hai niente da mangiare';
    }
    case 'taglia_legna': {
      if (here === 'foresta') { if ((W.forestWood || 0) < 1) return 'nella foresta hai già raccolto tutta la legna secca vicina'; const n = Math.min(W.forestWood, W.axe ? 4 : 2); W.forestWood -= n; W.woodPile += n; a.stats.en = clamp(a.stats.en - 4); return `hai ${W.axe ? 'tagliato rami e un tronco caduto' : 'raccolto rami secchi'} nella foresta e portato ${n} pezzi di legna al campo`; }
 if (W.brush < 1) return 'la boscaglia è spoglia: non c\'è più legna secca da tagliare'; const n = Math.min(W.brush, W.axe ? 3 : 1); W.brush -= n; W.woodPile += n; return `hai ${W.axe ? 'tagliato' : 'raccolto a mano'} e portato legna (${n} pezz${n === 1 ? 'o' : 'i'}) vicino al fuoco${W.brush < 5 ? '; nella boscaglia ne resta poca' : ''}`; }
    case 'abbatti_palma': { const k = PLACES[p.quale] && /palm/.test(p.quale) ? p.quale : placeOf(a.pos).name; if (!W.palmsAlive[k]) return 'questa palma è già stata abbattuta'; if (!W.axe) return 'senza ascia è impossibile abbattere una palma'; const share = alivePalms() ? W.coconuts / alivePalms() : 0; W.palmsAlive[k] = false; W.coconuts = Math.max(0, W.coconuts - share) + Math.floor(share / 2); a.inv.coconut += Math.floor(share / 2); W.woodPile += 8; a.stats.en = clamp(a.stats.en - 10); chron(`🪓 ${a.name} abbatte una palma (${k.replace('_', ' ')}).`, 'event'); return `hai abbattuto la palma: 8 pezzi di legna e ${Math.floor(share / 2)} noci cadute; non darà più cocco né ombra`; }
    case 'costruisci': {
      const c = p.cosa; let b = BUILD[c]; if (!b) return `provi a costruire: ${String(c || 'qualcosa').slice(0, 60)}`;
      let tie = (W.rope && (W.crateOpened !== false || carriedOf(a).includes('rope'))) || (RES.lianas && (a.known || []).includes('boscaglia'));
      let usedFiber = false; if (!tie && (W.fiber || 0) >= 2 && ['riparo', 'zattera', 'catasta', 'muretto'].includes(c)) { tie = true; usedFiber = true; }
      if (tie && ['riparo', 'zattera', 'catasta'].includes(c)) b = Object.assign({}, b, { wood: Math.max(1, b.wood - 1) });
      if (b.wood > W.woodPile) return `non c'è abbastanza legna (servono ${b.wood} pezzi, ce ne sono ${W.woodPile})`;
      if (b.age && (G.age || 0) < b.age) return 'non hai ancora né i mezzi né l\'organizzazione per un lavoro così: prima pensa alle cose essenziali';
      if ((b.fiber || 0) > (W.fiber || 0)) return `servono ${b.fiber} fasci di fibre per legare (ne hai ${W.fiber || 0})`;
      if ((b.stone || 0) > (W.stone || 0)) return `non ci sono abbastanza pietre al campo (servono ${b.stone}, ce ne sono ${W.stone || 0}): vanno raccolte prima`;
      if (c === 'focolare' && W.hearth) return 'il focolare di pietre c\'è già';
      if (c === 'muretto' && (W.wall || W.shelter < 1)) return W.wall ? 'il muretto c\'è già' : 'serve prima almeno la struttura del riparo';
      W.woodPile -= b.wood; W.stone = (W.stone || 0) - (b.stone || 0); W.fiber = (W.fiber || 0) - (b.fiber || 0); if (usedFiber) W.fiber -= 2;
      if (c === 'orto') { if (W.garden) return 'l\'orto c\'è già'; W.garden = { day: G.day }; return 'hai dissodato un piccolo orto accanto al riparo e ci hai piantato semi e germogli raccolti in giro: tra qualche giorno darà qualcosa'; }
      if (c === 'torre') { if (!/promontorio|collina|falesia/.test(placeOf(a.pos).name)) { W.woodPile += b.wood; W.fiber += b.fiber || 0; return 'una torre di avvistamento va costruita in alto, sulla collina, sulla falesia o sul promontorio'; } W.tower = { loc: a.pos.slice() }; return 'hai alzato una torre di avvistamento di pali legati: da lassù si vede lontano e la si vede dal mare'; }
      if (c === 'focolare') { W.hearth = true; return 'hai costruito un focolare di pietre attorno al fuoco: ripara la brace dal vento e dalla pioggia, il fuoco dura di più'; }
      if (c === 'muretto') { W.wall = true; return 'hai alzato un muretto di pietre a secco sul lato del vento del riparo: dentro si sta più caldi e il vento non lo strappa'; }
      if (c === 'riparo') { if (W.shelter >= 3) return 'il riparo è già completo'; W.shelter++; return ['', 'hai piantato i pali: la struttura del riparo c\'è', 'hai coperto il riparo con foglie di palma', 'hai legato e rinforzato il tetto del riparo'][W.shelter]; }
      if (c === 'giaciglio') { if (W.shelter < 1) { W.woodPile += b.wood; return 'serve prima almeno la struttura del riparo'; } W.bed = true; return 'hai costruito un giaciglio rialzato dentro il riparo'; }
      if (c === 'lancia') { if (!W.knife && !a.inv.items.some((i) => /selce/.test(i))) { W.woodPile += b.wood; return 'senza coltello non riesci ad appuntire il legno'; } W.spear = true; return 'hai intagliato una lancia da pesca'; }
      if (c === 'sos') { W.sos = 1; return 'hai composto un grande SOS con le pietre sulla spiaggia'; }
      if (c === 'catasta') { W.pile = 1; return 'hai preparato una catasta di legna sulla collina, pronta per un falò'; }
      if (c === 'zattera') { if (W.raft >= 4) return 'la zattera è già finita'; W.raft++; return W.raft >= 4 ? 'hai finito la zattera: tronchi legati, un albero e una vela di stracci' : `hai lavorato alla zattera (${W.raft}/4)`; }
      return 'fatto';
    }
    case 'leggi_taccuino':
      if (!a.hasNotebook || !G.world.notebookPresent) return 'non hai nessun taccuino';
      a.readToday = true; a.readText = a.notebook.pages.map((pg, i) => `— pagina ${i + 1}${pg.tool === 'carbone' ? ' (scritta a carbone)' : ''} —\n${pg.text}`).join('\n') || '(vuoto)';
      return a.notebook.pages.length ? 'hai letto il taccuino (il contenuto ora lo conosci)' : 'il taccuino è vuoto';
    case 'scrivi_taccuino': {
      if (!a.hasNotebook || !G.world.notebookPresent) return 'non hai un taccuino su cui scrivere';
      const txt = String(p.testo || '').slice(0, 1500); if (!txt) return 'non hai scritto niente';
      const charcoal = p.strumento === 'carbone';
      if (charcoal) { if (!W.fireEverLit) return 'non hai carbone: non è mai stato acceso un fuoco'; }
      else { const cost = txt.length / 25; if (a.notebook.ink <= 0) return 'la penna non scrive più: l\'inchiostro è finito'; if (cost > a.notebook.ink) { const keep = Math.floor(a.notebook.ink * 25); a.notebook.pages.push({ day: G.day, text: txt.slice(0, keep) + '…', tool: 'penna' }); a.notebook.ink = 0; chron(`📓 ${a.name} scrive nel taccuino (l'inchiostro finisce a metà frase).`, 'notebook'); return 'mentre scrivevi l\'inchiostro è finito a metà frase'; } a.notebook.ink -= cost; }
      a.notebook.pages.push({ day: G.day, text: txt, tool: charcoal ? 'carbone' : 'penna' });
      chron(`📓 ${a.name} scrive nel taccuino: "${txt.slice(0, 160)}${txt.length > 160 ? '…' : ''}"`, 'notebook');
      return 'hai scritto sul taccuino';
    }
    case 'scrivi_sabbia': { const txt = String(p.testo || '').slice(0, 60); if (!txt) return 'hai tracciato segni senza senso'; W.sand.push({ text: txt, loc: [a.pos[0] + 0.6, a.pos[1] + 0.6], stones: !!p.con_pietre, day: G.day, id: G.nextId++ }); chron(`✍️ ${a.name} scrive sulla sabbia${p.con_pietre ? ' con le pietre' : ''}: "${txt}"`, 'event'); return `hai scritto sulla sabbia${p.con_pietre ? ' con le pietre' : ''}: "${txt}"`; }
    case 'incidi': { if (!W.knife && !W.axe) return 'non hai niente per incidere'; const txt = String(p.testo || '').slice(0, 40); W.carvings.push({ text: txt, loc: LOC.palmB.slice() }); chron(`🪵 ${a.name} incide su un tronco: "${txt}"`, 'event'); return `hai inciso sul tronco: "${txt}"`; }
    case 'parla': { const txt = String(p.testo || '').slice(0, 300); if (txt) { speak(a, p.a, txt); if (/cane/i.test(p.a || '') && W.dog) a.stats.umore = clamp(a.stats.umore + 3); } return null; }
    case 'crea': return funCreate(a, p);
    case 'gioca': return funPlay(a, p);
    case 'proponi': return funPropose(a, p);
    case 'gioca_pallone': if (!W.ball) return 'il pallone non c\'è più'; a.stats.umore = clamp(a.stats.umore + (W.dog ? 9 : 5)); if (W.dog) { a.stats.mente = clamp(a.stats.mente + 2); } if (/faccia|disegn/i.test(JSON.stringify(p))) W.ballFace = true; return `hai giocato con il pallone${p.modo ? ' (' + String(p.modo).slice(0, 60) + ')' : ''}${W.dog ? '; il cane lo rincorreva abbaiando e te lo riportava' : ''}`;
    case 'riposa': a.stats.en = clamp(a.stats.en + 8 * (Number(p.ore) || 1)); return 'hai riposato un po\'';
    case 'osserva': return observe(a, p);
    case 'seppellisci': { const b = W.bodies.find((b) => !b.buried && !b.gone && dist(b.loc, a.pos) < 3); if (!b) return 'non c\'è nessun corpo qui'; b.buried = true; b.marker = W.knife || W.woodPile ? 'una croce di legno' : 'un cumulo di pietre'; chron(`⚰️ ${a.name} seppellisce ${b.name}.`, 'death'); a.stats.umore = clamp(a.stats.umore - 5); return `hai seppellito ${b.name}`; }
    case 'copri_corpo': { const b = W.bodies.find((b) => !b.buried && !b.gone && dist(b.loc, a.pos) < 3); if (!b) return 'non c\'è nessun corpo qui'; b.covered = true; chron(`${a.name} copre il corpo di ${b.name} con foglie e pietre.`, 'death'); return `hai coperto il corpo di ${b.name}`; }
    case 'veglia': return 'sei rimasto accanto a lui/lei in silenzio';
    case 'getta_in_mare': { const b = W.bodies.find((b) => !b.buried && !b.gone && dist(b.loc, a.pos) < 3); if (!b) return 'non c\'è nessun corpo qui'; b.gone = 'sea'; b.goneDay = G.day; chron(`🌊 ${a.name} trascina il corpo di ${b.name} in mare.`, 'death'); a.stats.mente = clamp(a.stats.mente - 4); return `hai trascinato il corpo di ${b.name} fino all'acqua e l'hai lasciato andare; la corrente lo porta via`; }
    case 'brucia_corpo': { const b = W.bodies.find((b) => !b.buried && !b.gone && dist(b.loc, a.pos) < 3); if (!b) return 'non c\'è nessun corpo qui'; if (W.woodPile < 6) return `per una pira serve molta legna (almeno 6 pezzi, ce ne sono ${W.woodPile})`; if (rainNow) return 'con la pioggia la pira non prende'; if (W.fireUntil <= T() && Math.random() > 0.25 + a.skill.fire * 0.12) return 'non riesci ad accendere la pira'; W.woodPile -= 6; b.gone = 'fire'; b.pyre = { loc: b.loc.slice(), day: G.day }; chron(`🔥 ${a.name} brucia il corpo di ${b.name} su una pira.`, 'death'); a.stats.mente = clamp(a.stats.mente - 5); return `hai costruito una pira e bruciato il corpo di ${b.name}; il fumo sale nero`; }
    case 'sposta_corpo': { const b = W.bodies.find((b) => !b.buried && !b.gone && dist(b.loc, a.pos) < 3); if (!b) return 'non c\'è nessun corpo qui'; const to = (PLACES[p.luogo] || PLACES.riva).loc; b.loc = [to[0] + 0.8, to[1] - 0.6]; a.pos = [to[0], to[1]]; chron(`${a.name} trascina il corpo di ${b.name} fino a ${p.luogo || 'riva'}.`, 'death'); return `hai trascinato il corpo di ${b.name} fino a ${p.luogo || 'riva'}: è stato faticoso`; }
    case 'segnale': {
      if (here === 'collina' && W.pile && W.bonfireUntil <= T()) {
        const canLight = W.fireUntil > T() || R() < 0.25 + a.skill.fire * 0.12;
        if (canLight && !rainNow) { W.bonfireUntil = T() + 3; chron(`🔥 ${a.name} accende il falò di segnale sulla collina!`, 'event'); if (W.shipNow) { W.rescueTurn = true; chron('🚢 La nave vede il fumo e vira verso l\'isola!', 'event'); interruptAll('la nave sta virando verso l\'isola'); } return 'hai acceso il grande falò sulla collina: il fumo sale alto'; }
        return 'non riesci ad accendere la catasta';
      }
      if (W.shipNow && W.sos && R() < 0.15) { W.rescueTurn = true; chron('🚢 Dalla nave hanno visto qualcuno sbracciarsi e l\'SOS: vira verso l\'isola!', 'event'); return 'ti sei sbracciato: la nave sembra cambiare rotta!'; }
      return W.shipNow ? 'ti sei sbracciato e hai urlato verso la nave' : 'ti sei sbracciato verso il mare vuoto';
    }
    case 'scrivi_lettera': case 'proponi': return resolveFeature(a, t, p);
    case 'raccogli_frutti': {
      { const sp = supplyHere(a, 'cibo'); if (sp) return useSupply(a, sp); }
      if (here === 'riparo' && W.garden && (W.gardenFruit || 0) >= 1) { const n = Math.min(Math.floor(W.gardenFruit), 3); W.gardenFruit -= n; a.stats.sat = clamp(a.stats.sat + 8 * n); ate(a, 'vegetale'); a.stats.umore = clamp(a.stats.umore + 4); return `hai raccolto ${n} ortaggi e germogli dal tuo orto: una piccola soddisfazione`; }
      if (here === 'foresta') { if ((W.forestFruit == null ? 8 : W.forestFruit) < 1) return 'i frutti selvatici maturi sono finiti: ci sono solo quelli acerbi'; const n = Math.min(Math.floor(W.forestFruit == null ? 8 : W.forestFruit), 2 + Math.floor(R() * 2)); W.forestFruit = (W.forestFruit == null ? 8 : W.forestFruit) - n; a.stats.sat = clamp(a.stats.sat + 7 * n); a.stats.hyd = clamp(a.stats.hyd + 2 * n); ate(a, 'vegetale'); if (R() < 0.1) { a.sick = 4; return `hai mangiato ${n} frutti selvatici sconosciuti: uno era amaro, poco dopo hai la nausea`; } return `hai mangiato ${n} frutti selvatici della foresta, aspri ma sostanziosi`; }
      if (!/banani|papaie/.test(here)) return 'qui non ci sono alberi da frutto';
      if ((W.fruit || 0) < 1) return 'la frutta matura è finita: ci sono solo frutti verdi';
      const n = Math.min(Math.floor(W.fruit), 2 + Math.floor(R() * 3)); W.fruit -= n; a.stats.sat = clamp(a.stats.sat + 8 * n); a.stats.hyd = clamp(a.stats.hyd + 3 * n); ate(a, 'vegetale'); a.stats.umore = clamp(a.stats.umore + 3);
      return `hai raccolto e mangiato ${n} ${here === 'banani' ? 'banane selvatiche, piccole e piene di semi' : 'pezzi di papaya matura, dolcissima'}`;
    }
    case 'ripara_capanno': {
      if (here !== 'capanno') return 'la baracca non è qui';
      if (W.hutRepaired) return 'la baracca è già stata rimessa in sesto';
      const rope = (W.fiber || 0) >= 2 || (W.rope && W.crateOpened !== false);
      if (W.woodPile < 6) return `per rimettere in piedi il tetto servono 6 pezzi di legna al campo (ce ne sono ${W.woodPile})`;
      if (!rope) return 'servono fibre o una corda per legare le travi (raccogli_fibre)';
      W.woodPile -= 6; if ((W.fiber || 0) >= 2) W.fiber -= 2; W.hutRepaired = true; a.stats.en = clamp(a.stats.en - 12);
      chron(`🔨 ${a.name} rimette in piedi la vecchia baracca.`, 'event'); highlight(`${a.name} ripara la baracca abbandonata`, PLACES.capanno.loc, 'build');
      return 'hai rialzato il tetto e legato le travi: la baracca ora ripara davvero da pioggia e vento';
    }
    case 'ripara_radio': {
      const R2 = W.radio; if (!R2 || !R2.found) return 'non hai nessuna radio';
      const has = (re) => G.agents.some((p2) => p2.alive && p2.inv.items.some((i) => re.test(i)));
      const miss = [!has(/batteria/) && 'una batteria', !has(/antenna/) && 'un\'antenna', !has(/cavo/) && 'del cavo elettrico'].filter(Boolean);
      if (R2.fixed) return 'la radio è già riparata';
      if (miss.length) return `per far funzionare la radio mancano ancora: ${miss.join(', ')}`;
      R2.tries = (R2.tries || 0) + 1; a.stats.en = clamp(a.stats.en - 6);
      if (R() < 0.45 + 0.15 * R2.tries) { R2.fixed = true; R2.charge = 5; chron(`📻 ${a.name} riesce a riparare la radio: gracchia, ma si accende!`, 'event'); highlight(`${a.name} ripara la radio`, a.pos, 'build'); return 'hai collegato batteria, cavo e antenna: dopo molti tentativi la radio gracchia e la lucina si accende. Funziona, almeno un po\''; }
      return 'hai smontato e rimontato la radio per ore: ancora niente, forse un contatto. Si può riprovare';
    }
    case 'usa_radio': {
      const R2 = W.radio; if (!R2 || !R2.fixed) return 'non hai una radio funzionante';
      if ((R2.charge || 0) < 1) return 'la batteria è scarica: la radio non dà più segni di vita';
      R2.charge -= 1; a.stats.umore = clamp(a.stats.umore + 3);
      if (R() < 0.3 + (W.tower ? 0.1 : 0) && !W.shipEvents.some((s) => s.mode === 'approach')) { W.shipEvents.push({ day: G.day + 1, h: 10 + R() * 5, dur: 3, mode: 'approach' }); chron(`📻 Qualcuno risponde alla radio di ${a.name}!`, 'event'); highlight(`Una voce risponde alla radio: arriveranno`, a.pos, 'event'); a.stats.mente = clamp(a.stats.mente + 15); return 'tra i fruscii, una voce! Hai ripetuto la tua posizione più volte: hanno capito. Dicono che domani manderanno qualcuno'; }
      return `hai chiamato a lungo tra i fruscii: nessuna risposta${R2.charge < 2 ? '. La batteria è quasi a terra' : ''}`;
    }
    case 'raccogli_pietre': {
      if (!/pietre|scogli|collina|grotta|sporgenza|falesia|promontorio/.test(here)) return 'qui non ci sono pietre adatte: ci sono tra le pietre a ovest, sugli scogli e sulla collina';
      if ((W.stoneLeft || 0) < 1) return 'le pietre adatte da portare via sono finite qui intorno';
      const n = Math.min(Math.floor(W.stoneLeft), 3 + Math.floor(R() * 3)); W.stoneLeft -= n; W.stone = (W.stone || 0) + n; a.stats.en = clamp(a.stats.en - 5);
      let extra = ''; if (RES.flint && here === 'pietre' && R() < 0.3 && !a.inv.items.some((i) => /selce/.test(i))) { a.inv.items.push('scheggia di selce'); extra = '; tra i sassi hai trovato una scheggia di selce affilata, taglia come un coltello'; }
      return `hai portato ${n} pietre al campo (ora ce ne sono ${W.stone})${extra}`;
    }
    case 'raccogli_fibre': {
      const palm = /palm/.test(here) && W.palmsAlive && W.palmsAlive[here] !== false; const lian = (here === 'boscaglia' && RES.lianas) || here === 'foresta';
      if (!palm && !lian) return 'qui non ci sono fibre utili: liane nella boscaglia o foglie di palma sotto le palme';
      if ((W.fiberLeft || 0) < 1) return 'hai già strappato tutte le fibre buone: ricresceranno';
      const cut = W.knife || a.inv.items.some((i) => /selce/.test(i)); const n = Math.min(Math.floor(W.fiberLeft), cut ? 3 : 2); W.fiberLeft -= n; W.fiber = (W.fiber || 0) + n;
      return `hai ${cut ? 'tagliato' : 'strappato a mano'} ${lian ? 'liane' : 'foglie di palma'} e ricavato ${n} fasci di fibre per legare (ora ${W.fiber})`;
    }
    case 'raccogli_uova': {
      if (here !== 'nidi' && here !== 'falesia') return 'qui non ci sono nidi';
      if ((W.eggs || 0) < 1) return 'nei nidi non ci sono uova adesso';
      const n = Math.min(Math.floor(W.eggs), 1 + Math.floor(R() * 3)); W.eggs -= n; a.stats.sat = clamp(a.stats.sat + 9 * n); ate(a, 'uova');
      if (R() < 0.35) { a.injury = 'hai beccate sanguinanti sulle mani e sulla testa'; return `hai preso ${n} uova, ma gli uccelli ti hanno attaccato in picchiata`; }
      return `hai preso ${n} uova dai nidi e le hai bevute crude`;
    }
    case 'raccogli_molluschi': {
      if (!W.pools && here !== 'laguna') return 'la marea è alta: le pozze tra gli scogli sono sommerse';
      if ((W.shellfish == null ? 8 : W.shellfish) < 1) return 'le pozze sono già state ripulite: bisogna aspettare';
      const n = Math.min(W.shellfish == null ? 8 : W.shellfish, 2 + Math.floor(R() * 4)); W.shellfish = (W.shellfish == null ? 8 : W.shellfish) - n;
      a.stats.sat = clamp(a.stats.sat + 5 * n); ate(a, 'molluschi');
      if (R() < 0.08) { a.sick = 5; return `hai staccato ${n} molluschi dalle rocce e li hai mangiati crudi; poco dopo lo stomaco si ribella`; }
      return `hai staccato ${n} molluschi dalle rocce e li hai mangiati crudi, sapore di mare`;
    }
    case 'dai': { const o = byName(p.a); if (!o || o === a || dist(a.pos, o.pos) > 4) return 'non c\'è nessuno a cui dare qualcosa qui'; const c = String(p.cosa || '');
      if (/pesc/.test(c) && a.inv.fish) { o.inv.fish += a.inv.fish; a.inv.fish = 0; } else if (/cocco/.test(c) && a.inv.coconut) { o.inv.coconut++; a.inv.coconut--; } else { const i = a.inv.items.findIndex((x) => findCustom(c, [{ name: x }])); if (i < 0) return 'non hai quello che volevi dare'; o.inv.items.push(a.inv.items.splice(i, 1)[0]); }
      remember(o, `${a.name} ti ha dato ${c}`); chron(`🤝 ${a.name} dà ${c} a ${o.name}.`, 'act'); return `hai dato ${c} a ${o.name}`; }
    case 'prendi_di_nascosto': { const o = byName(p.a); if (!o || o === a) return 'non c\'è nessuno'; const c = String(p.cosa || '');
      let took = null; if (/pesc/.test(c) && o.inv.fish) { o.inv.fish--; a.inv.fish++; took = 'un pesce'; } else if (/cocco/.test(c) && o.inv.coconut) { o.inv.coconut--; a.inv.coconut++; took = 'una noce di cocco'; } else { const i = o.inv.items.findIndex((x) => findCustom(c, [{ name: x }])); if (i >= 0) took = a.inv.items.push(o.inv.items.splice(i, 1)[0]) && c; }
      if (!took) return 'non trovi quello che cercavi';
      const seen = !o.asleep && dist(a.pos, o.pos) < 6 && R() < 0.5; if (seen) { remember(o, `hai visto ${a.name} prenderti di nascosto ${took}`); o.relations = o.relations || {}; o.relations[a.name] = 'mi ha rubato qualcosa'; chron(`👀 ${o.name} vede ${a.name} prendergli ${took}.`, 'event'); }
      else remember(o, `ti manca ${took}: qualcuno l'ha preso?`);
      return `hai preso di nascosto ${took} a ${o.name}${seen ? ', ma ti ha visto' : ''}`; }
    case 'apri_cassa': return openCrate(a);
    case 'raccogli': {
      if (/legn|tronc|ramo/i.test(p.cosa || '') && (W.driftWood || 0) >= 1 && /spiaggia|riva/.test(here)) { const n = Math.min(4, Math.floor(W.driftWood)); W.driftWood -= n; W.woodPile += n; W.wetWood = (W.wetWood || 0) + n; return `hai raccolto ${n} pezzi di legname portato dal mare: bagnato e salato, brucerà male finché non si asciuga`; }
      if (/cocco/i.test(p.cosa || '') && (W.coconutsGround || 0) >= 1) { const n = Math.min(3, Math.floor(W.coconutsGround)); W.coconutsGround -= n; a.inv.coconut += n; return `hai raccolto ${n} noci di cocco cadute`; }
      if (W.bottle && /bottigl/i.test(p.cosa || '') && dist(a.pos, W.bottle.loc) < 3) { const msg = W.bottle.text; W.bottle = null; chron(`🍾 ${a.name} apre la bottiglia e legge il messaggio.`, 'event'); return `hai aperto la bottiglia: dentro c'è un foglio con scritto "${msg}"`; }
      const nearby = W.custom.filter((c) => !c.animal && dist(a.pos, c.loc) < 3.5);
      const c = findCustom(p.cosa || p.oggetto, nearby) || nearby[0];
      if (c && c.portable === false) return `${c.name} è troppo grande per portarlo via: puoi usarlo qui (usa_oggetto)`;
      if (c && c.tool) { W.custom = W.custom.filter((x) => x !== c); W[c.tool] = true; chron(`✋ ${a.name} raccoglie ${c.name}.`, 'act'); return `hai raccolto ${c.name}: ora ce l'hai`; }
      if (c) { W.custom = W.custom.filter((x) => x !== c); a.inv.items.push(c.name); (a.inv.objs = a.inv.objs || {})[c.name] = c; chron(`✋ ${a.name} raccoglie: ${c.name}.`, 'act'); return `hai raccolto: ${c.name}`; }
      return 'non c\'è niente da raccogliere qui';
    }
    case 'usa_oggetto': {
      const q = p.oggetto || p.cosa; const inInv = a.inv.items.find((i) => findCustom(q, [{ name: i }]));
      const c = inInv ? null : findCustom(q, W.custom.filter((c) => !c.animal && dist(a.pos, c.loc) < 4));
      const name = inInv || (c && c.name); if (!name) return `qui non c'è "${String(q || '').slice(0, 40)}"`;
      if (c && c.supply) return useSupply(a, c);
      const how = String(p.come || p.modo || p.descrizione || '').slice(0, 120); const h = clamp(Number(p.ore) || 0.8, 0.2, 3);
      a.stats.umore = clamp(a.stats.umore + 3 + h * 3); if (a.stats.mente < 65) a.stats.mente = clamp(a.stats.mente + 1 + h); a.stats.en = clamp(a.stats.en - h);
      a.usedObjs = a.usedObjs || {}; a.usedObjs[name] = (a.usedObjs[name] || 0) + 1;
      chron(`🧩 ${a.name} usa ${name}${how ? ': ' + how : ''}.`, 'act');
      return `hai usato ${name}${how ? ' (' + how + ')' : ''} per circa ${Math.round(h * 60)} minuti`;
    }
    case 'parti_zattera': return departRaft(a);
    case 'dormi': { const hh = ((G.h % 24) + 24) % 24; a.asleep = true; a.nightSleep = hh >= 18.5 || hh < 6; a.sleptH = a.sleptH || 0; a.cur = null; a.plan = []; if (!a.nightSleep) { chron(`💤 ${a.name} si concede un sonnellino.`, 'sleep'); return null; } } chron(`😴 ${a.name} va a dormire${a.daySummary ? ' — «' + a.daySummary + '»' : ''}.`, 'sleep'); return null;
    case 'altro': { const d = String(p.descrizione || 'qualcosa').slice(0, 200);
      if (/lav|bagn|sciacqu|pulisc|stroffin|nuot|tuff|igien/i.test(d)) { const fresh = placeOf(a.pos).name === 'sorgente'; a.stats.igiene = clamp((a.stats.igiene == null ? 80 : a.stats.igiene) + (fresh ? 45 : 30)); if (fresh) W.spring = Math.max(0, (W.spring == null ? 100 : W.spring) - 4); }
      if (/nuot|tuff|bagn/i.test(d)) { a.stats.en = clamp(a.stats.en - 4); a.stats.umore = clamp(a.stats.umore + 4); const ang = Math.atan2(a.pos[1], a.pos[0]); a.pos = ISL.shoreAt(ang, -0.4); if (W.shark && Math.random() < 0.25) { a.stats.hp = clamp(a.stats.hp - 25); a.injury = 'hai un morso di squalo alla gamba'; chron(`🦈 ${a.name} viene morso da uno squalo mentre nuota!`, 'death'); return 'nuotando, uno squalo ti ha morso la gamba: sei riuscito a tornare a riva'; } } if (/faccia/i.test(d) && /pallone/i.test(d)) W.ballFace = true; if (/cane/i.test(d) && /nome|chiam/i.test(d)) a.dogName = (d.match(/(?:chiam\w*|nome)\s+["“']?([A-Z][a-zà-ù]+)/) || [])[1] || a.dogName; chron(`${a.name}: ${d}`, 'act'); return `hai fatto: ${d}`; }
    default: return `provi a fare: ${t}${p.descrizione ? ' — ' + String(p.descrizione).slice(0, 120) : ''}`;
  }
}
function observe(a, p) {
  const W = G.world; const w = weatherNow(); const out = [];
  if (W.shipNow) out.push('una nave a nord, all\'orizzonte!');
  if (w.desc.sea === 'calmo' && Math.random() < 0.3) { out.push('un branco di delfini salta vicino alla riva'); a.stats.umore = clamp(a.stats.umore + 6); a.sawDolphins = G.h; }
  if (w.rain < 0.3 && G.h > 7 && G.h < 19) out.push('gabbiani che volteggiano; il pellicano sugli scogli');
  if (W.shark) out.push('una pinna grigia vicino agli scogli');
  if (!out.length) out.push('solo mare, cielo e il rumore delle onde');
  return `hai osservato ${p.cosa ? String(p.cosa).slice(0, 40) : 'intorno'}: ${out.join('; ')}`;
}
function departRaft(a) {
  const W = G.world; if (W.raft < 4) return 'la zattera non è finita';
  const w = weatherNow(); const r = Math.random();
  a.departed = { day: G.day, h: G.h }; W.raft = 0;
  chron(`🛶 ${a.name} prende il mare sulla zattera.`, 'event');
  alive().forEach((o) => remember(o, `${descrOf(o, a)} è partito sulla zattera verso il mare aperto`));
  let outcome;
  if (w.storm || w.desc.sea === 'agitato') outcome = r < 0.7 ? 'lost' : 'back';
  else outcome = r < 0.35 ? 'rescued' : r < 0.7 ? 'back' : 'lost';
  a.raftOutcome = outcome;
  if (outcome === 'rescued') { W.shipEvents.push({ day: G.day + 2, h: 11, dur: 3, mode: 'approach' }); G.pendingRaftNews = { name: a.name, outcome }; }
  if (outcome === 'back') { G.raftReturn = { id: a.id, day: G.day + 1 }; }
  if (outcome === 'lost') { a.alive = false; a.deathCause = 'disperso in mare'; }
  emit('onChange');
  return null;
}

/* ---------- death ---------- */
// health damage with its cause, so the cause of death is what really did the most harm
function hurt(a, amt, cause) { if (amt <= 0) return; a.stats.hp = clamp(a.stats.hp - amt); a.dmg = a.dmg || {}; a.dmg[cause] = (a.dmg[cause] || 0) + amt; }
function die(a, cause) {
  if (!a.alive) return;
  a.alive = false; a.deathCause = cause; a.deathDay = G.day; a.deathH = G.h; a.deathStats = Object.assign({}, a.stats); a.cur = null; a.plan = []; a.asleep = false;
  G.world.bodies.push({ name: a.name, descr: descrOf({ memory: [], readText: '', longMemory: [] }, a), loc: a.pos.slice(), day: G.day, t: T(), buried: false, covered: false, id: a.id });
  chron(`✝ ${a.name} muore (${cause}).`, 'death');
  alive().forEach((o) => { if (!o.asleep) { remember(o, `${descrOf(o, a)} si è accasciato e non si muove più: è morto`); interrupt(o, 'qualcuno è morto'); } else o.morningNotes.push(`trovi ${descrOf(o, a)} immobile: è morto durante la notte`); o.stats.mente = clamp(o.stats.mente - 15); });
  emit('onChange');
}

/* ---------- time ---------- */
function thinkMode() { return (G && G.thinkTime) || (alive().length > 2 ? 'lento' : 'pausa'); }
function stepTime(dtReal, speed) {
  if (!G || !G.running || G.ended) return;
  if (alive().length === 0) { endGame('Nessuno è rimasto in vita sull\'isola.'); return; }
  if (alive().some((a) => a.thinking)) { // while someone is thinking: time stops, slows down to 1×, or keeps flowing (the thinker stands still)
    const m = thinkMode(); if (m === 'pausa') return; if (m === 'lento') speed = Math.min(speed, 1);
    // nobody may starve or die of thirst just because Claude is slow: while the platform asks to slow down, or when someone has been waiting for an answer for more than half a game hour, time stops
    if (coolUntil > Date.now()) return;
    const now = G.h + (G.day - 1) * 24; if (alive().some((a) => a.thinking && now - (a.thinkSince == null ? now : a.thinkSince) > 0.5)) return;
  }
  ensureRes();
  const allAsleep = alive().every((a) => a.asleep);
  let dh = Math.min(0.2, dtReal * speed / (allAsleep ? 3.333 : 10));
  if (dh <= 0) return;
  const prevH = G.h; G.h += dh;
  const w = weatherNow();
  fogTick(); settleObjects(); encounters();
  // sudden changes make people stop and reconsider (they are not interrupted while asleep unless soaked)
  if (w.rain > 0.3 && !G.wasRaining) { G.wasRaining = true; alive().forEach((a) => { if (!a.asleep) interrupt(a, w.storm ? 'scoppia un temporale: pioggia violenta e raffiche' : 'comincia a piovere forte'); }); } else if (w.rain < 0.1) G.wasRaining = false;
  alive().forEach((a) => { const s = a.stats; const tm = s.term == null ? 50 : s.term;
    if (tm < 30 && !a.coldNote) { a.coldNote = true; const was = a.asleep; if (was && tm < 26) { a.asleep = false; chron(`🥶 ${a.name} si sveglia tremando dal freddo.`, 'act'); } interrupt(a, was ? 'ti svegli tremando dal freddo, nel buio' : 'senti molto freddo'); } else if (tm > 40) a.coldNote = false;
    if (tm > 75 && !a.hotNote && !a.asleep) { a.hotNote = true; interrupt(a, 'il caldo è soffocante'); } else if (tm < 65) a.hotNote = false;
    if (s.hyd < 25 && !a.thirstNote && !a.asleep) { a.thirstNote = true; interrupt(a, 'hai una sete fortissima'); } else if (s.hyd > 50) a.thirstNote = false;
    if (s.sat < 15 && !a.hungerNote && !a.asleep) { a.hungerNote = true; interrupt(a, 'lo stomaco brontola, hai fame'); } else if (s.sat > 40) a.hungerNote = false; });
  if (w.rain > 0.3) { G.world.rainedToday = true; if (G.world.fireUntil > T() && !(G.world.shelter >= 3 && Math.random() < 0.5) && !(G.world.hearth && Math.random() < 0.6)) G.world.fireUntil = T(); if (G.world.bonfireUntil > T()) G.world.bonfireUntil = T(); }
  // ships
  const se = G.world.shipEvents.find((s) => s.day === G.day && G.h >= s.h && G.h < s.h + s.dur);
  if (se && !G.world.shipNow) { G.world.shipNow = se; if (se.mode === 'approach') G.world.rescueTurn = true; chron(se.mode === 'approach' ? '🚢 Una nave si avvicina all\'isola!' : '🚢 Una nave compare all\'orizzonte.', 'event'); interruptAll('è comparsa una nave all\'orizzonte'); }
  if (!se && G.world.shipNow) { const was = G.world.shipNow; G.world.shipNow = null; if (G.world.rescueTurn) { endGame('La nave ha raggiunto l\'isola: i sopravvissuti sono salvi.'); return; } chron('La nave è scomparsa all\'orizzonte.', 'event'); alive().forEach((a) => { remember(a, 'la nave è sparita all\'orizzonte senza vederti'); a.stats.mente = clamp(a.stats.mente - 10); }); }
  // agents
  alive().forEach((a) => {
    const s = a.stats; const heat = w.temp >= 32 ? 1.45 : w.temp >= 29 ? 1.12 : w.temp <= 22 ? 0.85 : 1;
    const work = a.cur && !a.cur.walking ? ({ taglia_legna: 1.7, costruisci: 1.7, accendi_fuoco: 1.4, pesca: 0.8, riposa: 0, dormi: 0, leggi_taccuino: 0.4, scrivi_taccuino: 0.4, altro: 0.6 }[a.cur.type] ?? 1) : 1.2;
    sleepTick(a, dh, w); if (!a.alive) return;
    if (a.asleep) { s.sat = clamp(s.sat - 1 * dh); s.hyd = clamp(s.hyd - 1.3 * dh); }
    else {
      s.sat = clamp(s.sat - 3 * dh); s.hyd = clamp(s.hyd - (w.rain > 0.3 ? 2.6 : 4.6 * heat) * dh); s.en = clamp(s.en - (a.cur && a.cur.type === 'riposa' ? -6 : 2.4 * work) * dh);
      const others = alive().filter((o) => o !== a && !o.asleep).length;
      // boredom: grows with monotony and idleness, faster when alone; restlessness (anxiety) from concrete stressors
      if (s.noia == null) s.noia = 20; if (s.ansia == null) s.ansia = 25;
      const idle = !a.cur || ['riposa', 'osserva'].includes(a.cur.type);
      s.noia = clamp(s.noia + (idle ? 6 : 2.5) * (others ? 0.6 : 1) * dh);
      const stress = (w.storm ? 25 : w.rain > 0.5 ? 8 : 0) + (G.h > 20 || G.h < 5 ? 8 : 0) + (s.hp < 50 ? 18 : 0) + (s.sat < 30 ? 12 : 0) + (s.hyd < 30 ? 15 : 0) + ((s.term || 50) > 72 || (s.term || 50) < 28 ? 12 : 0) + (a.sick > 0 ? 10 : 0) + (a.injury ? 10 : 0) + (100 - s.mente) * 0.15 + (others ? 0 : 6) + (G.world.shark && a.cur && /nuot|tuff/.test(JSON.stringify(a.cur.p || {})) ? 25 : 0);
      s.ansia = clamp(s.ansia + (stress - s.ansia) * Math.min(1, 0.35 * dh));
      if (s.noia > 75) s.umore = clamp(s.umore - 1.2 * dh);
      // hygiene: sweat, heat, work, salt, fish, bodies; rain rinses a little
      if (s.igiene == null) s.igiene = 80;
      const dirty = 0.55 + (w.temp >= 29 ? 0.35 : 0) + (work > 1.3 ? 0.5 : 0) + 0.4 * (a.cur && ['pesca', 'cattura_granchi', 'cucina_e_mangia', 'seppellisci', 'sposta_corpo', 'getta_in_mare', 'cerca_esche'].includes(a.cur.type) ? 1.5 : 0);
      s.igiene = clamp(s.igiene - dirty * dh + (w.rain > 0.5 && !(G.world.shelter >= 2 && placeOf(a.pos).name === 'riparo') ? 2 * dh : 0));
      if (s.igiene < 30) s.umore = clamp(s.umore - 0.6 * dh);
      if (s.igiene < 15 && Math.random() < 0.004 * dh) { a.sick = Math.max(a.sick || 0, 6); remember(a, 'ti senti male: forse qualcosa che hai toccato o mangiato con le mani sporche'); }
      s.mente = clamp(s.mente - (others ? 0.06 : Math.min(0.45, 0.16 + 0.015 * G.day)) * dh - (s.sat < 20 || s.hyd < 20 ? 0.4 * dh : 0) - (a.sick > 0 ? 0.2 * dh : 0) + (G.world.dog ? 0.1 * dh : 0));
    }
    {
      const W2 = G.world; const hereN = placeOf(a.pos).name; const dayTime = G.h % 24 > 7 && G.h % 24 < 18;
      const cov = Math.max(coverAt(hereN), hasGear(a, /telo/) ? 2 : 0); const still = a.asleep || (a.cur && !a.cur.walking); const wetNow = w.rain > 0.3 && !(cov >= 2 && still) && !(cov > 0 && cov < 2 && still && Math.random() < 0.5);
      if (wetNow) a.wet = 2; else if (a.wet) a.wet = Math.max(0, a.wet - dh * (w.temp > 28 ? 1.5 : 0.7));
      const shade = (W2.palmsAlive && W2.palmsAlive[hereN] && dist(a.pos, PLACES[hereN].loc) < 3) || coverAt(hereN) >= 2;
      const fireNear = (W2.fireUntil > T() && dist(a.pos, PLACES.fuoco.loc) < 4.5) || (W2.custom || []).some((c) => c.supply && c.supply.kind === 'fuoco' && dist(a.pos, c.loc) < 4.5);
      let target = 50 + (w.temp - 27) * 3.2 + (dayTime && w.cloud < 0.6 && !shade ? 9 : 0) - (a.wet ? 12 : 0) - w.wind * 6 + (fireNear ? 16 : 0);
      const work = a.cur && !a.cur.walking ? ({ taglia_legna: 1, abbatti_palma: 1, costruisci: 1 }[a.cur.type] || 0) : 0;
      target += work * 6;
      if (a.asleep) target += 6 + (coverAt(hereN) >= 2 ? 10 : coverAt(hereN) > 0 ? 5 : 0) + (hereN === 'riparo' && W2.bed ? 6 : 0);
      if (a.cur && a.cur.type === 'altro' && /nuot|tuff|bagn/.test(String(a.cur.p.descrizione || ''))) target -= 15;
      a.stats.term = clamp(a.stats.term + (target - a.stats.term) * Math.min(1, dh * 0.9));
      const tm = a.stats.term;
      if (tm > 80) { s.hyd = clamp(s.hyd - 3 * dh); s.en = clamp(s.en - 2 * dh); hurt(a, (tm - 80) / 8 * dh, 'colpo di calore'); }
      if (tm < 24) { s.en = clamp(s.en - 2.5 * dh); hurt(a, (24 - tm) / 7 * dh, 'ipotermia'); s.mente = clamp(s.mente - 0.2 * dh); }
    }
    if (a.sick > 0) { a.sick -= dh; s.en = clamp(s.en - 2 * dh); hurt(a, 1 * dh, 'malattia'); }
    // physiology: "sat" is the stomach (empties in about a day); body reserves last weeks (water allowing)
    if (a.reserves == null) a.reserves = 100;
    if (s.sat < 15) a.reserves = Math.max(0, a.reserves - 0.11 * dh); else if (s.sat > 55) a.reserves = Math.min(100, a.reserves + 0.25 * dh);
    if (a.reserves < 60) s.en = Math.min(s.en, 30 + a.reserves);           // weakness as reserves fall
    if (a.reserves < 12) hurt(a, (12 - a.reserves) / 6 * dh, 'inedia');   // real starvation only after weeks
    if (s.hyd < 8) hurt(a, 3 * dh, 'disidratazione');                     // ~2-3 days without water in the heat
    if (s.hyd >= 8 && a.reserves >= 12 && s.hp < 100 && a.sick <= 0 && !(a.wounds || []).some((x) => x.infected)) s.hp = clamp(s.hp + 0.8 * dh);
    if (s.hp <= 0) { const d = a.dmg || {}; const top = Object.keys(d).sort((x, y) => d[y] - d[x]); die(a, top.length ? top.slice(0, 2).filter((k, i) => i === 0 || d[k] > d[top[0]] * 0.35).join(' e ') : 'ferite e malattia'); return; }
    { const hh = ((G.h % 24) + 24) % 24; if (!a.asleep && !a.thinking && !a.cur && (hh >= 1 && hh < 5) && (a.sleepDebt || 0) > 12 && Math.random() < 0.8 * dh) { remember(a, 'crolli dal sonno'); a.asleep = true; a.nightSleep = true; a.sleptH = a.sleptH || 0; a.plan = []; chron(`😴 ${a.name} crolla dal sonno.`, 'sleep'); } }
    stepAgent(a, dh);
  });
  if (G.h >= 30) newDay();
  if (Math.floor(prevH) !== Math.floor(G.h) && G.h > 7 && G.h < 19 && T() - (G.lastAnimalDirector || -99) >= (G.economy ? 8 : 4) && (G.world.dog || G.world.shark || G.world.custom.some((c) => c.animal))) directAnimals('routine');
  if (Math.floor(prevH) !== Math.floor(G.h)) { envHour(w); dryWood(w); alive().forEach((a) => bodyHour(a, w)); }
  if (Math.floor(prevH) !== Math.floor(G.h)) { if (G.world.dog && G.world.ball && G.h > 7 && G.h < 20 && Math.random() < 0.18) G.world.dogPlayUntil = T() + 0.4; save(); emit('onChange'); }
}

/* ---------- sleep: hours slept, sleep debt, natural waking, naps ---------- */
// the per-person "new day": memory turns over after a night (or a sleepless night)
function dayRollover(a) {
  a.stats.noia = clamp((a.stats.noia == null ? 20 : a.stats.noia) - 25); a.recentActs = [];
  if (a.amnesia) { if ((a.nightSleptH || 0) >= 2) { a.memory = []; a.readText = ''; a.readToday = false; a.dogName = null; a.lastResult = null; } }
  else { if (a.daySummary) a.longMemory.push(`giorno ${G.day - 1}: ${a.daySummary}`); a.memory = []; }
  a.daySummary = null; a.nightSleptH = 0; a.rolledDay = G.day;
}
function wakeUp(a, why) {
  const s = a.stats; const h = ((G.h % 24) + 24) % 24; const slept = a.sleptH || 0; const nap = !a.nightSleep;
  a.asleep = false; a.cur = null; a.plan = [];
  if (nap) { a.morningNotes.push(slept > 2.2 ? 'ti risvegli dal sonnellino intontito, con la testa pesante' : 'ti svegli dal sonnellino un po\' riposato'); a.sleptH = 0; chron(`🌤 ${a.name} si sveglia dal sonnellino.`, 'sleep'); interrupt(a, why || 'ti sei svegliato'); return; }
  sleepReport(a);
  if (a.coldNight) { s.en = clamp(s.en - 12); a.morningNotes.push('ti svegli intirizzito, la notte è stata fredda'); s.mente = clamp(s.mente - 3); }
  if (s.mente < 35 && Math.random() < 0.5) { s.en = clamp(s.en - 10); a.morningNotes.push('hai dormito malissimo, pensieri e incubi'); }
  if (a.sick > 0) s.en = clamp(s.en - 8);
  if (slept < 5) a.morningNotes.push(`hai dormito poco, forse ${Math.max(1, Math.round(slept))} ore`); else if (slept > 9.5) a.morningNotes.push('hai dormito a lungo, il sole è già alto');
  a.nightSleptH = slept; a.sleptH = 0; a.nightSleep = false; a.coldNight = false;
  if (a.pendingRollover) { a.pendingRollover = false; dayRollover(a); a.nightSleptH = slept; }
  chron(`🌅 ${a.name} si sveglia${why ? ' — ' + why : ''}.`, 'sleep');
}
function sleepTick(a, dh, w) {
  const s = a.stats; const h = ((G.h % 24) + 24) % 24; if (a.sleepDebt == null) a.sleepDebt = 0;
  if (a.asleep) {
    const q = a.qNow == null ? 0.85 : a.qNow; const cov = coverAt(placeOf(a.pos).name) >= 2 ? 1.15 : 1;
    s.en = clamp(s.en + 11.5 * (0.45 + 0.55 * Math.max(0, q)) * cov * dh); a.sleptH = (a.sleptH || 0) + dh; a.sleepDebt = Math.max(0, a.sleepDebt - dh * (0.6 + 0.6 * q));
    if (a.nightSleep && a.sleptH >= 2) a.pendingRollover = true; // a real night's sleep turns the page on yesterday
    const need = Math.max(6, Math.min(10, 7 + a.sleepDebt * 0.25)); const slept = a.sleptH;
    if (!a.nightSleep) { const target = a.sleepDebt > 8 ? Math.min(8, 2 + a.sleepDebt * 0.35) : (s.en > 70 ? 1 : 1.8); if (slept >= target || (w.storm && Math.random() < 0.3 * dh)) wakeUp(a, w.storm ? 'il temporale ti ha svegliato' : null); return; }
    const day = h >= 5.3 && h < 18;
    if (day && h >= 10.5 + Math.min(2, a.sleepDebt * 0.1)) { wakeUp(a, 'il sole è alto e fa caldo'); return; }
    if (day && slept >= need && Math.random() < 1.2 * dh) { wakeUp(a, 'la luce dell\'alba'); return; }
    if (h >= 4 && h < 6 && slept >= 4.5 && (s.ansia || 0) > 78 && Math.random() < 0.5 * dh) { wakeUp(a, 'l\'ansia ti ha svegliato prima dell\'alba'); return; }
    if (w.storm && coverAt(placeOf(a.pos).name) < 2 && slept >= 1 && Math.random() < 0.4 * dh) { a.nightNotes = a.nightNotes || []; a.nightNotes.push('il temporale ti ha tenuto sveglio a lungo'); s.en = clamp(s.en - 2); }
    return;
  }
  a.sleepDebt = Math.min(40, a.sleepDebt + dh * 0.45);
  if (a.sleepDebt > 14) { s.mente = clamp(s.mente - 0.25 * dh); s.umore = clamp(s.umore - 0.3 * dh); s.ansia = clamp((s.ansia || 30) + 0.3 * dh); }
  if (a.sleepDebt > 6) s.en = Math.min(s.en, 100 - (a.sleepDebt - 6) * 2.6);
  // after a very long time awake, sleep comes by itself (wherever you are) when you stop
  if (a.sleepDebt > 22 && !a.cur && !a.thinking && Math.random() < 0.6 * dh) { a.asleep = true; a.nightSleep = h >= 19 || h < 6; a.sleptH = 0; a.plan = []; chron(`😪 ${a.name} crolla addormentato dove si trova.`, 'sleep'); remember(a, 'il sonno ti ha vinto e ti sei addormentato senza volerlo'); }
}
function sleepText(a) {
  const d = a.sleepDebt || 0; const h = ((G.h % 24) + 24) % 24;
  if (d > 22) return 'non dormi da troppo: le palpebre crollano, perdi il filo dei pensieri';
  if (d > 14) return 'sei esausto per la mancanza di sonno, fai fatica a concentrarti';
  if (d > 9 || (d > 6 && (h > 21 || h < 5))) return 'hai molto sonno, ti si chiudono gli occhi';
  if (d > 6 && h > 19) return 'comincia a venirti sonno';
  return null;
}
// days of decomposition of an unburied body (faster in the heat, slower if covered)
function bodyDecay(b) { const t0 = b.t != null ? b.t : (b.day - 1) * 24 + 12; return Math.max(0, (T() - t0) / 24) * (b.covered ? 0.7 : 1) * (b.heat || 1); }
function bodiesHour(w) { (G.world.bodies || []).forEach((b) => { if (b.buried || b.gone) return; b.heat = 0.95 * (b.heat || 1) + 0.05 * (w.temp >= 30 ? 1.25 : w.temp <= 23 ? 0.8 : 1);
  if (bodyDecay(b) >= 9) { b.gone = 'decomposto'; chron(`🦴 Del corpo di ${b.name} restano solo poche ossa, sparse tra la sabbia e l'erba.`, 'event'); } }); }
function newDay() {
  const W = G.world; const prevW = G.WX[(G.day - 1) % G.WX.length];
  const wasCold = prevW.tMin <= 21 || prevW.wind >= 0.7 || (G.wxOverride && /freddo|vento|temporale/.test(G.wxOverride.w.label || ''));
  const fireAllNight = W.fireUntil >= T() - 0.1;
  G.day += 1; G.h = 6; if (G.wxOverride && T() >= G.wxOverride.to) G.wxOverride = null;
  const maxD = G.maxDays == null ? 20 : G.maxDays;
  if (maxD && G.day > maxD) { endGame(`Sono passati ${maxD} giorni: fine dell'esperimento.`); return; }
  if (!maxD && G.day % 11 === 8 && !G.world.shipEvents.some((x) => x.day === G.day)) G.world.shipEvents.push({ day: G.day, h: 9 + Math.random() * 8, dur: 1.8, mode: 'pass' });
  // sand erosion
  W.sand = W.sand.filter((s) => s.stones || !(W.rainedToday || Math.hypot(s.loc[0], s.loc[1]) > ISL.radius(s.loc[0], s.loc[1]) - 2.1 && Math.random() < 0.6 || Math.random() < 0.25));
  ensureRes();
  const nP = alivePalms() + (W.extraPalms || 0); W.coconuts = Math.min(5 * nP, W.coconuts + 0.45 * nP);
  W.brush = Math.min(24, W.brush + 1.2); W.fishStock = Math.min(1, W.fishStock + 0.07); W.crabStock = Math.min(10, W.crabStock + 1);
  W.spring = Math.max(0, Math.min(W.springCap === 0 ? 30 : (W.springCap || 100), W.spring + (W.rainedToday ? 40 : W.springCap === 0 ? -10 : prevW.tMax >= 32 ? -14 : -5)));
  W.fiberLeft = Math.min(ISL.S > 1 ? 30 : 18, (W.fiberLeft || 0) + (ISL.S > 1 ? 3 : 2)); if (ISL.S > 1) { W.forestFruit = Math.min(10, (W.forestFruit == null ? 8 : W.forestFruit) + 1.5); W.forestWood = Math.min(90, (W.forestWood || 0) + 2); W.eggs = Math.min(8, (W.eggs || 0) + 0.8); }
  W.fruit = Math.min((RES.banana ? 10 : 0) + (RES.papaya ? 6 : 0), (W.fruit || 0) + (RES.banana ? 0.7 : 0) + (RES.papaya ? 0.4 : 0)); W.eggs = RES.nests ? Math.min(8, (W.eggs || 0) + 0.5) : 0;
  W.rainedToday = false; W.freeEvents = W.freeEvents.filter((e) => T() - e.t < 6);
  if (G.raftReturn && G.raftReturn.day === G.day) { const a = G.agents.find((x) => x.id === G.raftReturn.id); if (a) { a.departed = null; a.pos = LOC.shoreSouth.slice(); a.stats.en = 20; a.stats.hyd = 25; a.morningNotes.push('le correnti ti hanno riportato sull\'isola, la zattera è distrutta; sei esausto'); chron(`🌊 ${a.name} viene riportato a riva dalle correnti, stremato.`, 'event'); } G.raftReturn = null; }
  alive().forEach((a) => { dietDay(a); });
  snapshotDay(G.day - 1); dailyStory(G.day - 1); featuresDay();
  // the day turns at dawn, but nobody is woken by the clock: sleepers wake on their own (see sleepTick);
  // whoever stayed up all night just carries on, tired
  alive().forEach((a) => {
    a.coldNight = wasCold && !fireAllNight;
    if (!a.asleep && a.rolledDay !== G.day - 1) { if ((a.nightSleptH || 0) < 2) { a.morningNotes.push('hai passato la notte in bianco: gli occhi bruciano'); } dayRollover(a); }
  });
  W.bodies.forEach((b) => { if (b.gone === 'sea' && G.day - b.goneDay === 1 && Math.random() < 0.3) { b.gone = null; b.loc = [LOC.shoreSouth[0] + 2.5, LOC.shoreSouth[1] + 0.2]; b.returned = true; chron(`🌊 Il mare riporta a riva il corpo di ${b.name}.`, 'death'); alive().forEach((a) => a.morningNotes.push('sulla battigia sud il mare ha riportato un corpo')); } });
  W.bodies.forEach((b) => { if (!b.buried && !b.gone && G.day - b.day >= 2) alive().forEach((a) => { if (dist(a.pos, b.loc) < 10) a.stats.mente = clamp(a.stats.mente - 2); }); });
  chron(`— Giorno ${G.day} — ${weatherNow().desc.label}`, 'day');
  emit('onChange'); save();
}
// a piece of gear is usable if you carry it or it lies within reach
function hasGear(a, re) { return a.inv.items.some((x) => re.test(x) && !/bagnato|vuot|rott/.test(x)) || G.world.custom.some((c) => !c.animal && re.test(c.name) && !(c.inCrate && G.world.crateOpened === false) && dist(a.pos, c.loc) < 4); }
function openCrate(a) {
  const W = G.world; if (W.crateOpened) return 'la cassa è già aperta';
  if (dist(a.pos, PLACES.cassa.loc) > 4) return 'la cassa non è qui';
  W.crateOpened = true; const items = []; if (W.axe) items.push('un\'ascia'); if (W.knife) items.push('un coltello'); if (W.rope !== false) items.push('una corda'); if (W.rod) items.push('una canna da pesca'); W.custom.filter((c) => c.inCrate).forEach((c) => items.push(c.name));
  chron(`📦 ${a.name} apre la cassa${items.length ? ': ' + items.join(', ') : ', ma è vuota'}.`, 'event');
  return items.length ? `hai forzato il coperchio della cassa: dentro ci sono ${items.join(', ')}` : 'hai forzato la cassa: è vuota, solo acqua di mare e sabbia';
}
function endGame(text, quiet) { if (/salv/i.test(text)) medal('salvato'); if (!quiet) setTimeout(scenarioAnalysis, 0); G.ended = text; G.running = false; G.endedAt = { day: G.day, h: G.h }; if (/salv/i.test(text)) G.rescued = true; alive().forEach((a) => { a.cur = null; a.plan = []; a.thinking = false; a.asleep = false; }); chron(`🏁 ${text}`, 'end'); emit('onChange'); save(); if (!quiet) setTimeout(() => dailyStory(G.day, true), 0); }

/* ---------- god mode ---------- */
function classifyAnimal(an) { an = String(an || '').toLowerCase(); return /delfin|balen|orca|tartarug|razza|foca|lontra|manta|medus|pesc/.test(an) ? 'sea' : /pappagall|uccell|corvo|aquila|gabbian|colomb|gallin|anatr|pinguin|pellican/.test(an) ? 'bird' : /serpent|ragn|insett|formic|zanzar|granch/.test(an) ? 'object' : 'quad'; }
const PALETTE = [0xe06666, 0x93c47d, 0xf6b26b, 0x8e7cc3, 0x76a5af, 0xffd966, 0xc27ba0];
function applyOps(ops, source) {
  const W = G.world; const done = [];
  (ops || []).forEach((op) => {
    const t = op.tipo || op.op || op.operazione; if (!t) return;
    try {
      if (t === 'meteo') {
        const key = String(op.meteo || op.preset || op.tipo_meteo || op.valore || '').toLowerCase();
        const pr = Object.assign({}, PRESETS[key] || PRESETS[Object.keys(PRESETS).find((k) => key.includes(k))] || (op.pioggia != null || op.vento != null || op.temperatura != null ? PRESETS.bonaccia : PRESETS.temporale));
        // free parameters override the preset
        if (op.pioggia != null) { const r = clampD(op.pioggia, 0, 1); pr.rain = r > 0.05; pr.kind = r > 0.75 ? 'temporale' : r > 0.4 ? 'pioggia' : r > 0.05 ? 'pioviggine' : pr.kind; pr.cloud = Math.max(pr.cloud, r); }
        if (op.vento != null) pr.wind = clampD(op.vento, 0, 1);
        if (op.temperatura != null) { const tc = clampD(op.temperatura, 5, 45); pr.tMax = tc + 3; pr.tMin = tc - 3; pr.tempSet = true; }
        if (op.mare && SEA_ORDER.includes(op.mare)) pr.sea = op.mare;
        if (op.nebbia) pr.fog = true;
        const ore = clamp(Number(op.ore) || 3, 0.5, 24 * 30);
        const cur = G.wxOverride && T() < G.wxOverride.to && T() - G.wxOverride.from < 0.05 ? G.wxOverride : null; // several weather ops in the same request combine
        const w = cur ? mergeWeather(cur.w, pr) : pr;
        G.wxOverride = { from: T(), to: T() + Math.max(ore, cur ? cur.to - T() : 0), w };
        done.push(`meteo: ${w.label} per ${Math.round(G.wxOverride.to - T())} ore${G.wxOverride.to - T() >= 48 ? ' (' + Math.round((G.wxOverride.to - T()) / 24) + ' giorni)' : ''}`);
        interruptAll(`il tempo cambia: ${String(w.label).toLowerCase()}`);
      }
      else if (t === 'aggiungi_persona') {
        const sex = /f/i.test(op.sesso || '') ? 'f' : 'm'; const kind = op.categoria || op.tipo_persona || (Number(op.eta) < 14 ? 'bambino' : Number(op.eta) > 65 ? 'anziano' : 'adulto');
        const id = 'a' + G.nextId++;
        const ag = makeAgent({ id, name: uniqueName(op.nome, sex), sex, kind, age: Number(op.eta) || (kind === 'bambino' ? 9 : kind === 'anziano' ? 72 : 38), amnesia: /dimentic|amnes/i.test(op.memoria || ''), persona: op.carattere || '', arrival: op.arrivo || 'trascinato dalle onde sulla riva, aggrappato a un relitto',
          colors: { shirt: PALETTE[G.agents.length % PALETTE.length], pants: 0x6f6a5a, hair: kind === 'anziano' ? 0xd0d0d0 : sex === 'f' ? 0x2e1d10 : 0x3b2a1a, longHair: sex === 'f', beard: sex === 'm' && kind !== 'bambino' && Math.random() < 0.4, scale: kind === 'bambino' ? 0.9 : 1.35 },
          pos: [LOC.shoreSouth[0] + (Math.random() - 0.5) * 3, LOC.shoreSouth[1] + 0.3] });
        ag.stats = { sat: 45, hyd: 35, en: 40, hp: 80, umore: 30, mente: 55, term: 40 };
        ag.memory = [`${fmtH(G.h)} — ${ag.arrival}`];
        G.agents.push(ag); done.push(`arriva ${ag.name} (${kind}, ${ag.age} anni)`);
        alive().forEach((o) => { if (o !== ag && !o.asleep) { remember(o, `${descrOf(o, ag)} è appena arrivato/a sulla riva sud, dal mare`); interrupt(o, 'è arrivata una persona'); } });
      }
      else if (t === 'uccidi') { const a = byName(op.nome); if (a && a.alive) { die(a, op.causa || 'un malore improvviso'); done.push(`${a.name} muore`); } }
      else if (t === 'rimuovi_persona') { const a = byName(op.nome); if (a && a.alive) { a.alive = false; a.departed = { day: G.day, h: G.h, vanished: true }; chron(`${a.name} scompare nel nulla.`, 'event'); alive().forEach((o) => { remember(o, `${descrOf(o, a)} è scomparso/a: non c'è più`); interrupt(o, 'qualcuno è scomparso'); }); done.push(`${a.name} sparisce`); } }
      else if (t === 'risorsa') { const r = addResource(op); if (r) done.push(r); }
      else if (t === 'effetto') { // small concrete effects used by the fate cards
        const k = String(op.cosa || ''); const p0 = alive()[0];
        if (k === 'pesce') { W.fishStock = 1; W.shellfish = 12; done.push('un grande banco di pesci vicino a riva'); interruptAll('in mare, vicino a riva, l\'acqua ribolle di pesci'); }
        else if (k === 'legna_mare') { W.driftWood = (W.driftWood || 0) + 8; done.push('legname portato dal mare'); interruptAll('il mare ha portato a riva tavole e tronchi'); }
        else if (k === 'frutta') { W.fruit = (W.fruit || 0) + 8; W.forestFruit = (W.forestFruit || 0) + 6; W.coconutsGround = (W.coconutsGround || 0) + 4; done.push('frutta matura dappertutto'); }
        else if (k === 'malattia' && p0) { p0.sick = Math.max(p0.sick || 0, 8); p0.stats.hp = clamp(p0.stats.hp - 8); done.push(`${p0.name} si ammala`); interrupt(p0, 'ti senti la febbre e i brividi'); }
        else if (k === 'bottiglia') { W.bottle = { loc: ISL.shoreAt(Math.random() * 6.28, -0.6), text: op.testo || 'Un foglio ingiallito: «Chi trova questo messaggio sappia che sull\'isola a ovest siamo vivi. Aspettiamo una nave a ogni luna piena.»' }; done.push('una bottiglia sulla battigia'); }
      }
      else if (t === 'aggiungi_animale' || t === 'rimuovi_animale') {
        const on = t === 'aggiungi_animale'; const an = String(op.animale || '').toLowerCase();
        if (/cane/.test(an)) W.dog = on; else if (/granch/.test(an)) W.crabs = on; else if (/squal/.test(an)) W.shark = on;
        else if (on) {
          const mv = String(op.movimento || '').toLowerCase();
          const kind = /vol/.test(mv) ? 'bird' : /nuot/.test(mv) ? 'sea' : /cammin|corr|strisc|salt/.test(mv) ? 'quad' : classifyAnimal(an);
          const parts = Array.isArray(op.forma) ? op.forma.slice(0, 16) : null;
          const base = (PLACES[op.luogo] || (kind === 'bird' ? PLACES.palme : PLACES.spiaggia)).loc;
          const n = Math.max(1, Math.min(6, Number(op.quanti) || (/delfin/.test(an) ? 3 : 1)));
          for (let i = 0; i < n; i++) W.custom.push({ name: op.animale, desc: op.descrizione || '', loc: [base[0] + (Math.random() - 0.5) * 2, base[1] + (Math.random() - 0.5) * 2], animal: true, kind, parts, phase: Math.random() * 6, id: G.nextId++ });
        }
        else W.custom = W.custom.filter((c) => !c.name.toLowerCase().includes(an));
        done.push(`${on ? 'aggiunto' : 'rimosso'}: ${op.animale}`); interruptAll(on ? `è comparso un animale: ${op.animale}` : `un animale non c'è più`);
      }
      else if (t === 'aggiungi_oggetto' || t === 'rimuovi_oggetto') {
        const on = t === 'aggiungi_oggetto'; const n = String(op.nome || op.oggetto || '').toLowerCase();
        const map = { canna: 'rod', ascia: 'axe', coltello: 'knife', pallone: 'ball', taccuino: 'notebookPresent', lancia: 'spear' };
        const k = Object.keys(map).find((x) => n.includes(x));
        const TOOLS = { rod: ['canna da pesca', [{ f: 'cil', d: [0.015, 2.2], p: [0, 0.05, 0], r: [0, 0, 86], c: '#8b6a43' }, { f: 'cil', d: [0.06, 0.06], p: [-0.7, 0.08, 0.05], r: [90, 0, 0], c: '#333333' }]], axe: ['ascia', [{ f: 'cil', d: [0.03, 0.7], p: [0, 0.04, 0], r: [0, 0, 88], c: '#7a5a36' }, { f: 'box', d: [0.06, 0.16, 0.2], p: [0.33, 0.06, 0], c: '#8a8f96' }]], knife: ['coltello', [{ f: 'box', d: [0.25, 0.02, 0.04], p: [0, 0.02, 0], c: '#9aa0a6' }, { f: 'box', d: [0.12, 0.03, 0.05], p: [-0.18, 0.02, 0], c: '#3a2a1a' }]], spear: ['lancia', [{ f: 'cil', d: [0.025, 2], p: [0, 0.04, 0], r: [0, 0, 88], c: '#8b6a43' }]] };
        if (k && on && TOOLS[map[k]]) { // a real object where it was asked to appear: the character has to see it and pick it up
          const tool = map[k]; const place = PLACES[op.luogo] ? op.luogo : null; const who = alive()[0];
          const loc = place ? PLACES[place].loc.map((v) => v + (Math.random() - 0.5) * 1.2) : who ? [who.pos[0] + 1.2, who.pos[1] + 0.6] : LOC.crate.slice();
          W.custom.push({ name: TOOLS[tool][0], desc: op.descrizione || 'nuova, in buono stato', use: tool === 'rod' ? 'pescare' : tool === 'axe' ? 'tagliare, aprire le noci di cocco' : tool === 'knife' ? 'tagliare, pulire il pesce, incidere' : 'pescare in acqua bassa, difendersi', loc, id: G.nextId++, portable: true, tool, addedAt: T(), parts: TOOLS[tool][1] });
          if (tool === 'rod') W.rodUses = 0; if (tool === 'axe') W.axeUses = 0;
          interruptAll(`noti qualcosa per terra ${place ? 'vicino a ' + place : 'poco lontano da te'}: ${TOOLS[tool][0]}`);
        } else if (k) { W[map[k]] = on; if (!on) W.custom = W.custom.filter((c) => c.tool !== map[k]); }
        else if (/fuoco/.test(n)) { if (!on) W.fireUntil = T(); else { W.fireUntil = T() + 3; W.fireEverLit = true; } }
        else if (/ripar/.test(n) && !on) W.shelter = 0;
        else if (/legna/.test(n)) W.woodPile = on ? W.woodPile + (Number(op.quantita) || 6) : 0;
        else if (/cocco/.test(n)) W.coconuts = on ? W.coconuts + 10 : 0;
        else if (on) {
          const place = PLACES[op.luogo] ? op.luogo : 'spiaggia';
          const parts = Array.isArray(op.forma) ? op.forma.slice(0, 16) : null;
          W.custom.push({ name: op.nome, desc: op.descrizione || '', use: String(op.uso || '').slice(0, 160), loc: PLACES[place].loc.map((v) => v + (Math.random() - 0.5) * 1.5), id: G.nextId++, parts, portable: op.trasportabile !== false, addedAt: T() });
          interruptAll(`noti un oggetto che prima non c'era, vicino a ${place}: ${op.nome}`);
        }
        else W.custom = W.custom.filter((c) => !c.name.toLowerCase().includes(n));
        done.push(`${on ? 'aggiunto' : 'tolto'}: ${op.nome}`);
      }
      else if (t === 'risorse') {
        const r = String(op.risorsa || '').toLowerCase(); const az = String(op.azione || '').toLowerCase(); const empty = /esaur|svuot|secc|finisc|togli/.test(az);
        if (/legn|boscagl/.test(r)) W.brush = empty ? 0 : 24;
        if (/cocc/.test(r)) W.coconuts = empty ? 0 : 5 * alivePalms();
        if (/pesc/.test(r)) W.fishStock = empty ? 0.15 : 1;
        if (/acqu|sorgent/.test(r)) W.spring = empty ? 5 : 100;
        if (/granch/.test(r)) W.crabStock = empty ? 0 : 10;
        if (/palm/.test(r) && !empty) W.palmsAlive = { palme: true, palma_riparo: true, palma_nord: true };
        done.push(`risorse: ${op.risorsa} ${empty ? 'esaurite' : 'ripristinate'}`);
      }
      else if (t === 'memoria') {
        const who = /^tutt/i.test(String(op.nome || '')) || !op.nome ? alive() : [byName(op.nome)].filter((x) => x && x.alive);
        const st = String(op.stato || '').toLowerCase();
        who.forEach((a) => {
          if (/perd|colpo|amnes|cancell|dimentic.*ora|subito/.test(st)) { a.memory = []; a.longMemory = []; a.readText = ''; a.readToday = false; a.amnesia = /ogni notte|notte|sempre/.test(st) || op.ogni_notte === true || a.amnesia; a.stats.mente = clamp(a.stats.mente - 12); a.morningNotes.push(op.causa ? `${op.causa}; non ricordi più nulla, nemmeno chi sei` : 'improvvisamente non ricordi più nulla, nemmeno chi sei'); remember(a, 'la tua mente si svuota: non ricordi più nulla di prima'); interrupt(a, 'hai perso la memoria'); chron(`🤕 ${a.name} perde la memoria${op.causa ? ' (' + op.causa + ')' : ''}.`, 'god'); }
          else if (/ogni notte|dimentica/.test(st)) { a.amnesia = true; chron(`🧠 ${a.name} da ora dimentica tutto ogni notte.`, 'god'); }
          else if (/normal|ritrov|recuper|guarisc/.test(st)) { a.amnesia = false; if (/ritrov|recuper/.test(st)) { remember(a, 'all\'improvviso i ricordi tornano: sai chi sei'); interrupt(a, 'hai ritrovato la memoria'); } chron(`🧠 ${a.name} ha di nuovo una memoria normale.`, 'god'); }
        });
        done.push(`memoria di ${who.map((a) => a.name).join(', ')}: ${op.stato}`);
      }
      else if (t === 'ordina_azione') {
        const who = /^tutt/i.test(String(op.nome || '')) || !op.nome ? alive() : [byName(op.nome)].filter((x) => x && x.alive && !x.departed);
        let act = op.azione; if (typeof act === 'string') act = { azione: 'altro', descrizione: act, ore: Number(op.ore) || 1 }; if (!act || !act.azione) act = { azione: 'altro', descrizione: op.descrizione || 'qualcosa', ore: Number(op.ore) || 1 };
        who.forEach((a) => {
          if (a.asleep) { a.asleep = false; remember(a, 'ti svegli di soprassalto'); }
          a.cur = null; a.plan = [Object.assign({}, act, { forced: true })];
          const desc = act.descrizione || act.azione + (act.luogo ? ' ' + act.luogo : act.cosa ? ' ' + act.cosa : '');
          remember(a, `un impulso improvviso e irresistibile ti ha spinto a: ${desc}`);
          a.bubble = { kind: 'thought', text: '⚡ ' + desc, until: performance.now() + 6000 };
        });
        done.push(`${who.map((a) => a.name).join(', ') || 'nessuno'}: ${act.descrizione || act.azione}`);
      }
      else if (t === 'azione_animale') {
        const an = String(op.animale || 'cane').toLowerCase(); const az = String(op.azione || '').toLowerCase();
        const kind = /tuff|nuot|mare|acqua/.test(az) ? 'nuota' : /scapp|fugg|corr/.test(az) ? 'scappa' : /dorm|riposa|sdrai/.test(az) ? 'dorme' : /abbai|ulul|ringh/.test(az) ? 'abbaia' : /scav/.test(az) ? 'scava' : /gioc|pallon|palla/.test(az) ? 'gioca' : /segu/.test(az) ? 'segue' : /vai|va |andare|torna/.test(az) || op.luogo ? 'va' : 'altro';
        W.animalAct = W.animalAct || {};
        const key = /cane/.test(an) ? 'cane' : an;
        if (key === 'cane' && !W.dog) W.dog = true;
        W.animalAct[key] = { kind, text: op.azione || kind, luogo: op.luogo || null, chi: op.chi || null, until: T() + clamp(Number(op.ore) || 0.6, 0.1, 12) };
        if (key !== 'cane' && op.luogo && PLACES[op.luogo]) W.custom.filter((c) => c.name.toLowerCase().includes(key)).forEach((c) => { c.loc = PLACES[op.luogo].loc.map((v) => v + (Math.random() - 0.5) * 2); });
        if (key === 'cane' && kind === 'gioca') W.dogPlayUntil = T() + clamp(Number(op.ore) || 0.6, 0.1, 12);
        alive().forEach((a) => { if (!a.asleep) remember(a, `vedi che ${key === 'cane' ? 'il cane' : an} ${op.azione || kind}`); });
        interruptAll(`${key === 'cane' ? 'il cane' : an} ${op.azione || kind}`);
        done.push(`${key}: ${op.azione || kind}`);
      }
      else if (t === 'messaggio_in_bottiglia') { W.bottle = { text: String(op.testo || '...').slice(0, 300), loc: [LOC.shoreSouth[0] - 2, LOC.shoreSouth[1] + 0.4] }; done.push('una bottiglia arriva a riva'); }
      else if (t === 'nave') { W.shipEvents.push({ day: G.day, h: G.h + 0.05, dur: Number(op.ore) || 1.8, mode: /avvicin|salv|approd/i.test(op.comportamento || '') ? 'approach' : 'pass' }); done.push('una nave in arrivo'); }
      else if (t === 'regia_animali') { const d = String(op.descrizione || '').slice(0, 300); directAnimals(`richiesta dell'osservatore: ${d}`); done.push(`animali: ${d}`); }
      else if (t === 'evento_libero') { if (/cane|gabbian|pellican|granch|squal|delfin|animal|uccell/i.test(String(op.descrizione || '')) || G.world.custom.some((c) => c.animal && String(op.descrizione || '').toLowerCase().includes(c.name.toLowerCase()))) directAnimals(`evento: ${op.descrizione}`); W.freeEvents.push({ t: T(), text: String(op.descrizione || '').slice(0, 300) }); alive().forEach((a) => { if (!a.asleep) remember(a, `succede qualcosa: ${op.descrizione}`); }); interruptAll('sta succedendo qualcosa'); done.push(`evento: ${op.descrizione}`); }
      else if (t === 'cambia_stato') { const a = byName(op.nome); if (a) { ['sat', 'hyd', 'en', 'hp', 'mente'].forEach((k) => { if (op[k] != null) a.stats[k] = clamp(Number(op[k])); }); done.push(`stato di ${a.name} modificato`); } }
    } catch (e) { console.error(e); }
  });
  if (done.length && source !== 'scenario' && source !== 'evento') { G.interventions.push({ day: G.day, h: G.h, text: source, done }); chron(`⚡ Intervento divino: ${done.join('; ')}`, 'god'); }
  else if (done.length && source === 'evento') chron(`🌊 ${done.join('; ')}`, 'event');
  emit('onChange'); save();
  setTimeout(completeObjects, 0);
  return done;
}
async function godText(text) {
  if (!SAMPLE) throw { code: 'unavailable' };
  const people = G.agents.map((a) => `${a.name} (${a.alive ? 'vivo' : 'morto'}${a.departed ? ', non sull\'isola' : ''})`).join(', ');
  const prompt = `Sei l'interprete del "god mode" di una simulazione di un'isola deserta. Traduci la richiesta dell'utente in operazioni sul mondo.
Persone: ${people}. Luoghi: ${Object.keys(PLACES).join(', ')}.
Operazioni disponibili (usa solo queste, anche più di una):
{"tipo":"meteo","meteo":"temporale|pioggia|caldo|bonaccia|vento|freddo|nebbia","ore":n (se l'osservatore non indica una durata, 2-4 ore; giorni interi solo se li chiede: 7 giorni = 168),"pioggia":0-1 opzionale,"vento":0-1 opzionale,"temperatura":°C opzionale,"mare":"calmo|poco mosso|mosso|agitato" opzionale}
  ← più operazioni meteo nella stessa richiesta si SOMMANO (es. temporale + freddo = pioggia, vento e freddo insieme); al termine il meteo torna da solo al suo andamento naturale
{"tipo":"aggiungi_persona","nome":"...","sesso":"m|f","eta":n,"categoria":"adulto|bambino|anziano","memoria":"normale|dimentica ogni notte","carattere":"breve descrizione, professione, storia","arrivo":"come arriva"}
{"tipo":"uccidi","nome":"...","causa":"..."}  {"tipo":"rimuovi_persona","nome":"..."}
{"tipo":"aggiungi_animale","animale":"cane|granchi|squalo|delfino|capra|pappagallo|qualsiasi altro animale","quanti":n,"descrizione":"...","luogo":"...","movimento":"cammina|vola|nuota|striscia","forma":[parti]}
  ← per ogni animale diverso da cane/granchi/squalo DEVI dare "forma" (stesse regole degli oggetti: 3–14 solidi, misure reali in metri, origine a terra, y in alto, la TESTA verso +z) così si riconosce: es. capra = corpo box, 4 zampe cil, testa box, corna coni.
{"tipo":"regia_animali","descrizione":"cosa succede tra gli animali o tra animali e persone, anche complesso (es. i gabbiani attaccano il cane; il cane insegue i granchi; lo squalo si avvicina a chi nuota)"}  ← usala per interazioni e comportamenti che non sono una singola azione semplice: deciderà il regista  {"tipo":"rimuovi_animale","animale":"..."}
{"tipo":"aggiungi_oggetto","nome":"canna|ascia|coltello|pallone|taccuino|lancia|fuoco|legna|cocco|qualsiasi altro oggetto","descrizione":"...","luogo":"...","trasportabile":true|false,"uso":"come lo userebbe una persona e cosa le dà (es. ci si siede e ci si dondola; svago, calma)","forma":[parti]}
  ← per ogni oggetto NON tra canna/ascia/coltello/pallone/taccuino/lancia/fuoco/legna/cocco DEVI dare "forma": 2–14 solidi semplici che lo disegnano in modo riconoscibile, misure reali in metri, origine a terra al centro dell'oggetto, y verso l'alto.
  Ogni parte: {"f":"box|cil|sfera|cono","d":[larghezza,altezza,profondità] per box, [raggio,altezza] per cil/cono, [raggio] per sfera,"p":[x,y,z] centro della parte,"r":[gradi x,y,z] opzionale,"c":"#rrggbb"}
  Es. altalena: 2 pali cil [0.06,2.2] a x=±0.9 y=1.1, traversa cil [0.05,2] r [0,0,90] y=2.2, 2 corde cil [0.01,1.6] a x=±0.25 y=1.4, seggiolino box [0.6,0.05,0.25] y=0.6 — trasportabile false.
  Es. mazzo di carte: box [0.07,0.03,0.1] bianco + un paio di carte box [0.07,0.002,0.1] ruotate sparse accanto — trasportabile true.  {"tipo":"rimuovi_oggetto","nome":"..."}
{"tipo":"risorse","risorsa":"legna|cocco|pesci|acqua|granchi|palme","azione":"esaurisci|ripristina"}
{"tipo":"memoria","nome":"nome o tutti","stato":"perde la memoria ora | dimentica ogni notte | normale | ritrova la memoria","causa":"es. colpo alla testa"}
{"tipo":"ordina_azione","nome":"nome della persona oppure tutti","azione":{"azione":"una delle azioni del catalogo (vai, pesca, costruisci, parla, gioca_pallone, usa_oggetto con "oggetto" e "come", seppellisci, dormi...) oppure altro","luogo":"...","cosa":"...","descrizione":"per 'altro': cosa fa, es. nuota in mare, balla, piange, prega, corre","ore":n}}  ← usala SEMPRE quando la richiesta dice cosa deve FARE una persona
{"tipo":"azione_animale","animale":"cane|nome dell'animale","azione":"cosa fa (es. si tuffa in mare, scappa sulla collina, dorme, abbaia, scava, gioca col pallone, segue Marta)","luogo":"...","chi":"nome se segue qualcuno","ore":n}  ← usala SEMPRE quando la richiesta dice cosa deve FARE un animale
{"tipo":"risorsa","cosa":"sorgente|cisterna|frutteto|viveri|fuoco","quante":n,"luogo":"... (fuoco = il fuoco del campo diventa perenne)","visibile":true (la notano subito tutti) | false (da scoprire)}  ← per nuove fonti di acqua o cibo stabili sull'isola
{"tipo":"messaggio_in_bottiglia","testo":"..."}  {"tipo":"nave","comportamento":"passa|si avvicina"}
{"tipo":"evento_libero","descrizione":"qualsiasi altro evento che i personaggi percepiscono"}
{"tipo":"cambia_stato","nome":"...","sat":0-100,"hyd":0-100,"en":0-100,"hp":0-100,"mente":0-100}
Richiesta: """${String(text).slice(0, 800)}"""
Se l'animale non c'è ancora, aggiungilo prima con aggiungi_animale. Usa evento_libero solo per ciò che nessun'altra operazione può fare.
Rispondi SOLO JSON: {"operazioni":[...],"risposta":"breve conferma in italiano di cosa farai"}`;
  const out = await ask('god mode', prompt, 'quick');
  const done = applyOps(out.operazioni || [], text);
  return { reply: out.risposta || '', done };
}

/* ---------- persistence ---------- */
const KEY = 'isola-esperimento-v1';
// the saved game must never fail silently: if the browser's storage is full, save a slimmer copy (old decision logs and long reasonings dropped), then make room by dropping the photos
let saveWarned = false;
function slimCopy(level) {
  const c = JSON.parse(JSON.stringify(G)); const keep = level > 1 ? 60 : 250;
  c.log = (c.log || []).slice(-keep); c.agents.forEach((a) => { (a.thoughts || []).forEach((t, i, arr) => { if (i < arr.length - (level > 1 ? 10 : 40)) t.reasoning = null; }); if (level > 1) { a.memory = (a.memory || []).slice(-60); } });
  if (level > 1) { c.history = (c.history || []).slice(-400); (c.circles || []).forEach((C) => { C.lines = C.lines.slice(-80); }); }
  return JSON.stringify(c);
}
function save() {
  if (!G || discarded) return;
  if (G.log && G.log.length > 600) G.log.splice(0, G.log.length - 400);
  const tries = [() => JSON.stringify(G), () => slimCopy(1), () => slimCopy(2), () => { try { localStorage.removeItem('isola-foto'); } catch (e) {} return slimCopy(2); }];
  for (let i = 0; i < tries.length; i++) { try { localStorage.setItem(KEY, tries[i]()); G.saveError = i > 0 ? i : 0; if (!i) saveWarned = false; return; } catch (e) { /* storage full: try smaller */ } }
  G.saveError = 9; if (!saveWarned) { saveWarned = true; emit('onEvent', { kind: 'fatal', text: '⚠ Non riesco più a salvare la partita: lo spazio del browser è pieno. Scarica la cronaca e il romanzo per non perdere niente.' }); }
}
function loadSaved() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function restore(obj) { G = obj; G.running = false; ensureRes(); if (G.world.crateOpened == null) G.world.crateOpened = true; G.agents.forEach((a) => { if (a.aware == null) a.aware = 3; }); (G.world.custom || []).forEach((c) => { if (c.animal && !c.kind) c.kind = classifyAnimal(c.name); if (c.kind && c.phase == null) c.phase = Math.random() * 6; }); G.circleNow = null; G.agents.forEach((a) => { a.thinking = false; a.inCircle = false; a.circleSeat = null; if (a.asleep && a.nightSleep == null) a.nightSleep = true; }); emit('onChange'); return G; }
function clearSaved() { try { localStorage.removeItem(KEY); } catch (e) {} }
// throw the current game away for good (nothing can save it again on the way out)
function discard() { discarded = true; G = null; clearSaved(); }
let discarded = false;

/*__ENV__*/

window.ENG = {
  get G() { return G; }, newGame, stepTime, weatherNow, applyOps, godText, PLACES, PRESETS, fmtH, T, alive, byName, listeners,
  setSample(s) { SAMPLE = s; }, discard, directAnimals, addPrediction, SCENARIOS, MEDALS, tideLevel, moonLight, seaBrings, interview, analyze, pickDrift, classifyAnimal, doingText, hasSample: () => !!SAMPLE, save, loadSaved, restore, clearSaved, decide, buildPrompt, endGame, whisper, carriedOf, bodyDecay, moodEmoji, nameOfPlace, nameOfAnimal, SPECT, startCircle, stopCircle, groupStats, addPerson, thinkMode, novelDays, novelMissing, novelChapter, novelTitle, rateWait: () => (coolUntil > Date.now() ? coolUntil : 0), endWeather() { const o = G.wxOverride; if (!o || T() >= o.to) return false; G.wxOverride = null; chron(`🌤 Il tempo torna quello naturale (era: ${String(o.w.label || 'meteo forzato').toLowerCase()}).`, 'god'); interruptAll('il tempo cambia: torna come prima'); save(); emit('onChange'); return true; }, editPerson, CIRCLE_TOPICS, _fun: { funCreate, funPlay, funPropose, speak, fixNames, funName, funSketch, funActionDone, startSpect, cleanSvg }, AGES: ['Naufrago', 'Sopravvissuto', 'Abitante', 'Costruttore', 'Salvezza'], fogTick, sightOf, fowExplored, FOW_N, fowR: () => (G ? fowR() : 1),
};
})();
