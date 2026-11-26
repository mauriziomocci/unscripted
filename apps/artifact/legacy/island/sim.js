/* Island survival simulation — pure logic, no DOM. */
(function (root) {
  'use strict';

  function rngFrom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const LOC = {
    beach: [0, 10.2], crate: [2.6, 9.4], ball: [-2.4, 10.6], spring: [-8, -3],
    palmA: [5, 2], palmB: [-3.2, 3.6], palmC: [6.5, -5], stones: [-7, 5.5],
    rocksEast: [11.2, 1], shoreSouth: [1.5, 12], hill: [0, -7.5], shelter: [-1, 4.8],
    firepit: [0.8, 7.2], sos: [-5.5, 10.8], sitSpot: [4.5, 11.3], woodSpot: [6.2, -3.8],
    // optional features (used only if this island has them)
    cave: [-3.2, -9.6], banana: [-6.2, 1.2], papaya: [3.4, -1.6], bamboo: [8.6, -6.6], clay: [-9.4, 1.6], nests: [12.6, -1.4],
  };

  /* ---------- random island: size, coastline, hill, resources (same seed = same island) ---------- */
  const ISL = (function () {
    if (!root.ISLAND_RANDOM) return { seed: 0, k: 1, rot: 0, elong: 1, span: 1, R: () => 12.6, hillH: 2.5, res: { extraPalms: 0, bushes: 1, cave: null, banana: false, papaya: false, bamboo: false, lianas: true, flint: true, clay: false, nests: false, springCap: 100, crate: { axe: true, knife: true, rod: true, rope: true }, fishRich: 1, crabs: 1 }, shoreAt(ang, off) { const rr = 12.6 + (off || 0); return [Math.cos(ang) * rr, Math.sin(ang) * rr]; } };
    let seed = 0; try { seed = Number(root.localStorage && root.localStorage.getItem('isola-island-seed')) || 0; } catch (e) {}
    if (!seed) { seed = 1 + Math.floor(Math.random() * 1e6); try { root.localStorage.setItem('isola-island-seed', String(seed)); } catch (e) {} }
    const r = rngFrom(seed * 7 + 1);
    let size = 'big'; try { size = (root.localStorage && root.localStorage.getItem('isola-island-size')) || 'big'; } catch (e) {}
    const S = size === 'normal' ? 1 : 2.2;            // "big" islands: ~2.2× wider, with inland biomes to explore
    const k0 = 0.7 + r() * 1.1; const k = k0 * S;     // overall size (0.7–1.8 × the base island, × S)
    const rot = r() * Math.PI * 2;                   // layout orientation
    const elong = 1 + r() * r() * 1.4, elAng = r() * Math.PI; // stretched islands (up to ~2.4:1)
    const ea = Math.sqrt(elong), eb = 1 / Math.sqrt(elong);
    const harm = [[2, r() * 0.14, r() * 6.28], [3, 0.03 + r() * 0.13, r() * 6.28], [4, r() * 0.08, r() * 6.28], [5, 0.02 + r() * 0.07, r() * 6.28], [7, r() * 0.04, r() * 6.28]];
    const ell = (ang) => { const c = Math.cos(ang - elAng), s2 = Math.sin(ang - elAng); return 1 / Math.sqrt((c / ea) * (c / ea) + (s2 / eb) * (s2 / eb)); };
    const R = (ang) => 12.6 * k * ell(ang) * Math.max(0.55, 1 + harm.reduce((s, h) => s + h[1] * Math.sin(h[0] * ang + h[2]), 0)); // coastline radius by angle
    const pick = (p) => r() < p;
    const res = {
      extraPalms: Math.floor(r() * 5),                 // palms beyond the three named ones
      bushes: 0.6 + r() * 0.9,                          // dry wood abundance factor
      cave: pick(0.3) ? 'grotta' : pick(0.45) ? 'sporgenza' : null,
      banana: pick(0.5), papaya: pick(0.35), bamboo: pick(0.4), lianas: pick(0.7), flint: pick(0.5), clay: pick(0.4), nests: pick(0.5),
      springCap: (r(), Math.round(35 + r() * 105)), // every island has fresh water; how much varies (35 = meagre trickle … 140 = generous)
      crate: { axe: pick(0.8), knife: pick(0.7), rod: pick(0.65), rope: pick(0.7), tarp: pick(0.3), pot: pick(0.3), lighter: pick(0.15), matches: pick(0.2), bottle: pick(0.45), firstaid: pick(0.2) },
      fishRich: 0.6 + r() * 0.8, crabs: 0.5 + r() * 1.0,
    };
    return { seed, size, S, k, k0, rot, R, elong, span: k * Math.max(ea, 1.15), hillH: 1.6 + r() * 1.8, res, shoreAt(ang, off) { const rr = R(ang) + (off || 0); return [Math.cos(ang) * rr, Math.sin(ang) * rr]; } };
  })();
  // warp the base layout onto this island: rotate, then stretch each point to the local coastline
  Object.keys(LOC).forEach((key) => {
    const p = LOC[key]; const ang0 = Math.atan2(p[1], p[0]); const rr = Math.hypot(p[0], p[1]); const ang = ang0 + ISL.rot;
    const nr = rr * ISL.R(ang) / 12.6; p[0] = Math.cos(ang) * nr; p[1] = Math.sin(ang) * nr;
  });
  ISL.radius = (x, z) => ISL.R(Math.atan2(z, x));
  // big islands: inland and coastal biomes placed with the island's own random sequence, away from the base places
  ISL.biomes = [];
  if (ISL.S > 1) {
    const rb = rngFrom(ISL.seed * 31 + 7); const taken = Object.values(LOC).map((p) => p.slice());
    const free = (x, z, d) => taken.every((q) => Math.hypot(q[0] - x, q[1] - z) > d);
    const put = (key, rMin, rMax, d) => { for (let t = 0; t < 400; t++) { const a = rb() * Math.PI * 2; const f = rMin + rb() * (rMax - rMin); const R = ISL.R(a); const x = Math.cos(a) * R * f, z = Math.sin(a) * R * f; if (free(x, z, d) || t > 380) { LOC[key] = [x, z]; taken.push([x, z]); ISL.biomes.push(key); return; } } };
    put('forest', 0.3, 0.6, 14); put('clearing', 0.25, 0.55, 12); put('marsh', 0.62, 0.8, 11); put('cliff', 0.84, 0.9, 12);
    put('lagoon', 0.86, 0.92, 12); put('beachEast', 0.86, 0.92, 14); put('promontory', 0.9, 0.95, 12); put('hut', 0.4, 0.7, 10);
    // the stream runs from the spring to the nearest coast
    const sp = LOC.spring; const a = Math.atan2(sp[1], sp[0]); LOC.streamMouth = ISL.shoreAt(a, -0.5); LOC.stream = [(sp[0] + LOC.streamMouth[0]) / 2, (sp[1] + LOC.streamMouth[1]) / 2]; ISL.biomes.push('stream');
  }
  ISL.compass = (p) => { const a = Math.atan2(p[1], p[0]); const d = ['est', 'sud-est', 'sud', 'sud-ovest', 'ovest', 'nord-ovest', 'nord', 'nord-est']; return d[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; };

  const FACTS = {
    water: { label: 'Sorgente', text: "Acqua dolce: sorgente a ovest, oltre le rocce. È potabile." },
    coconut: { label: 'Noci di cocco', text: "Le palme hanno noci di cocco. Si aprono con l'ascia." },
    fishing: { label: 'Pesca', text: "La canna della cassa funziona: i pesci abboccano." },
    spot: { label: 'Scogli a est', text: "Punto migliore per pescare: gli scogli a est." },
    bait: { label: 'Esche', text: "Esche: vermi sotto le pietre grigie a ovest." },
    rawbad: { label: 'No pesce crudo', text: "Il pesce crudo fa venire mal di pancia." },
    fire: { label: 'Fuoco', text: "Fuoco: battere le pietre nere sopra foglie secche di palma." },
    island: { label: 'Isola esplorata', text: "Dalla collina si vede tutta l'isola: è piccola e non c'è nessuno." },
    shelter: { label: 'Riparo', text: "Ho un riparo vicino alla palma. Dormo lì, gli attrezzi sono lì." },
    ball: { label: 'Tondo', text: "Il pallone si chiama Tondo. Gli ho disegnato una faccia. È mio amico." },
    tally: { label: 'Tacche', text: "Ogni mattina incido una tacca sulla palma del riparo: contano i giorni." },
    ship: { label: 'Nave', text: "È passata una nave lontano. Non mi ha visto: serve un segnale!" },
    sos: { label: 'Segnale SOS', text: "SOS di pietre in spiaggia + legna sulla collina: se vedo una nave, ACCENDERE." },
    storm: { label: 'Tempeste', text: "Le tempeste arrivano da ovest: rinforzare il tetto del riparo." },
    charcoal: { label: 'Carbone', text: "La penna è finita: il carbone del fuoco scrive." },
    heat: { label: 'Ore calde', text: "Nelle giornate torride, dalle 12 alle 15 stare all'ombra e bere di più." },
    rainwater: { label: 'Acqua piovana', text: "Quando piove, i gusci di cocco vuoti raccolgono acqua da bere." },
    roughsea: { label: 'Mare mosso', text: "Col mare mosso agli scogli è pericoloso: pescare dalla riva sud." },
    coping: { label: 'Momenti bui', text: "Quando mi sento a pezzi: parlare con Tondo, guardare il mare, poi fare UNA cosa utile. Passa." },
    gulls: { label: 'Gabbiani ladri', text: "I gabbiani rubano il pesce appena pescato: coprirlo subito con foglie di palma." },
    pelican: { label: 'Pellicano', text: "Un pellicano agli scogli spaventa i pesci: pescare presto, prima delle 9:30." },
    coldnight: { label: 'Notti fredde', text: "Le notti ventose sono fredde: tenere il fuoco acceso tutta la notte." },
  };

  const WX_TYPES = {
    sereno:   { label: 'Sereno', wind: 0.2, sea: 'calmo', tMax: 30, tMin: 24, cloud: 0.1, line: 'Cielo limpido e mare calmo. Bella giornata.' },
    caldo:    { label: 'Caldo torrido', wind: 0.08, sea: 'calmo', tMax: 35, tMin: 27, cloud: 0, line: 'Fa già caldissimo e il mare è piatto come l\'olio.' },
    nuvoloso: { label: 'Nuvoloso', wind: 0.35, sea: 'poco mosso', tMax: 27, tMin: 22, cloud: 0.65, line: 'Cielo coperto, aria più fresca.' },
    pioggia:  { label: 'Pioggia', wind: 0.45, sea: 'poco mosso', tMax: 26, tMin: 22, cloud: 0.8, line: 'Nuvole grigie e pesanti: oggi pioverà.' },
    ventoso:  { label: 'Vento forte', wind: 0.8, sea: 'mosso', tMax: 27, tMin: 20, cloud: 0.4, line: 'Tira un vento forte e il mare è mosso.' },
    temporale:{ label: 'Temporale', wind: 1.0, sea: 'agitato', tMax: 25, tMin: 19, cloud: 0.9, line: 'Cielo cupo a ovest, aria pesante e mare agitato.' },
  };

  function genWeather(days, wr) {
    const fixed = { 8: 'sereno', 12: 'ventoso', 13: 'temporale', 20: 'sereno' };
    const table = [['sereno', 0.34], ['caldo', 0.2], ['nuvoloso', 0.14], ['pioggia', 0.18], ['ventoso', 0.14]];
    const out = [];
    let prev = 'sereno';
    for (let d = 1; d <= days; d++) {
      let kind = fixed[d];
      if (!kind) {
        if (d === 1) kind = 'sereno';
        else if (wr() < 0.3) kind = prev === 'temporale' ? 'nuvoloso' : prev;
        else {
          let r = wr();
          for (const [k, w] of table) { r -= w; if (r <= 0) { kind = k; break; } }
          kind = kind || 'sereno';
        }
      }
      prev = kind;
      const b = WX_TYPES[kind];
      const jitter = Math.round((wr() - 0.5) * 2);
      const w = { kind, label: b.label, wind: b.wind, sea: b.sea, cloud: b.cloud, line: b.line,
        tMax: b.tMax + jitter, tMin: b.tMin + Math.round((wr() - 0.5) * 2), rain: null };
      if (kind === 'pioggia') { const s0 = wr() < 0.5 ? 10 + wr() * 1.5 : 14 + wr() * 1.5; w.rain = [s0, s0 + 2.2 + wr()]; }
      if (kind === 'temporale') w.rain = [12.9, 16.5];
      if (kind === 'nuvoloso' && wr() < 0.35) { const s0 = 15 + wr() * 2; w.rain = [s0, s0 + 0.8]; }
      out.push(w);
    }
    return out;
  }
  function tempAt(w, h) {
    const hh = ((h % 24) + 24) % 24;
    const k = Math.max(0, Math.cos(((hh - 14) / 24) * Math.PI * 2)) ; // peak 14:00
    return w.tMin + (w.tMax - w.tMin) * Math.pow(k, 1.3);
  }
  const SEA_WAVES = { calmo: 0.06, 'poco mosso': 0.14, mosso: 0.3, agitato: 0.5 };
  function weatherAt(w, h) {
    let rain = 0;
    if (w.rain) {
      const [a, b] = w.rain;
      if (h >= a - 0.3 && h <= b + 0.3) rain = Math.min(1, Math.min(h - (a - 0.3), b + 0.3 - h) / 0.4);
      rain *= w.kind === 'temporale' ? 1 : w.kind === 'pioggia' ? 0.7 : 0.4;
    }
    const cloud = Math.min(1, w.cloud + rain * 0.6);
    return { rain, wind: w.wind + rain * 0.2, waves: SEA_WAVES[w.sea] + rain * 0.08, cloud, temp: tempAt(w, h), storm: w.kind === 'temporale' && rain > 0.2 };
  }

  const clamp = (v) => Math.max(0, Math.min(100, v));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function simulate(opts) {
    opts = opts || {};
    const seed = opts.seed == null ? 11 : opts.seed;
    const DAYS = opts.days || 20;
    const rng = rngFrom(seed);
    const chance = (p) => rng() < p;
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];

    const W = {
      shelter: 0, tally: 0, ballFace: false, firepit: false, sos: 0, woodHill: 0,
      ink: 100, writer: 'penna', fireSkill: 0, fishSkill: 0, waterTested: false,
      coconuts: 10, rescued: false, wood: 0, ballHome: 'ball',
    };
    const S = { sat: 66, hyd: 58, en: 70, mor: 52, hp: 100, mind: 58 };
    let minMind = 58;
    const NB = { pages: [], rules: null, written: new Set() };
    const days = [];
    let pos = LOC.beach.slice();
    const WX = genWeather(DAYS, rngFrom(seed * 31 + 7));

    for (let d = 1; d <= DAYS; d++) {
      const wx = WX[d - 1];
      const raining = (h) => !!(wx.rain && h >= wx.rain[0] && h < wx.rain[1]);
      const hot = () => tempAt(wx, t) >= 32;
      const tl = [];
      const mem = new Set();
      const learnedToday = [];
      const events = [];
      const diaryNotes = [];
      const done = {};
      const worldEvents = [];
      let t = 6;
      let carrying = false;
      const sleepPos = () => (W.shelter >= 1 ? LOC.shelter : LOC.beach);
      const gearPos = () => (W.shelter >= 1 ? LOC.shelter : LOC.crate);
      const ballPos = () => (W.ballHome === 'shelter' && W.shelter >= 1 ? [LOC.shelter[0] + 1.3, LOC.shelter[1] + 0.6] : LOC.ball);

      const snap = () => ({
        S: Object.assign({}, S),
        W: { shelter: W.shelter, tally: W.tally, ballFace: W.ballFace, firepit: W.firepit, sos: W.sos,
          woodHill: W.woodHill, ink: W.ink, writer: W.writer, coconuts: W.coconuts, ballHome: W.ballHome, rescued: W.rescued },
        mem: Array.from(mem),
      });

      function tick(h, work) {
        S.sat = clamp(S.sat - 3.0 * h);
        const temp = tempAt(wx, t + h / 2);
        const heat = temp >= 32 ? 1.45 : temp >= 29 ? 1.12 : temp <= 24 ? 0.85 : 1;
        S.hyd = clamp(S.hyd - (raining(t) ? 2.6 : 4.6 * heat) * h);
        S.en = clamp(S.en - 3.0 * h * work * (temp >= 32 && work > 0.8 ? 1.3 : 1));
        S.mor = clamp(S.mor - (0.7 + 0.08 * d) * h);
        S.mind = clamp(S.mind - (0.2 + 0.05 * d) * h + (S.mor > 70 ? 0.2 * h : S.mor < 35 ? -0.3 * h : 0) + (S.hp < 50 ? -0.4 * h : 0));
        if (S.sat < 15 || S.hyd < 15) S.hp = clamp(S.hp - 4 * h);
        else S.hp = clamp(S.hp + 1.2 * h);
      }

      function seg(type, dur, o) {
        const s = { type, t0: t, t1: t + dur, from: pos.slice(), to: (o.to || pos).slice(),
          anim: o.anim || 'idle', label: o.label || '', thought: o.thought || null, s0: snap(), extra: o.extra || null };
        if (!o.noTick) tick(dur, o.work == null ? 1 : o.work);
        t += dur;
        pos = s.to.slice();
        if (o.fx) o.fx(s);
        s.s1 = snap();
        tl.push(s);
        return s;
      }
      function go(target, label, thought) {
        const to = typeof target === 'string' ? LOC[target] : target;
        const dd = dist(pos, to);
        if (dd < 0.4) return;
        seg('walk', Math.max(0.1, dd * 0.045), { to, anim: 'walk', label: label || 'Cammina', thought, work: 1.2 });
      }
      function act(dur, anim, label, thought, fx, work, extra) {
        return seg('act', dur, { anim, label, thought, fx, work, extra });
      }
      function learn(k) {
        if (!mem.has(k)) { mem.add(k); learnedToday.push(k); S.mor = clamp(S.mor + 2); mind(1); }
      }
      const ev = (txt) => events.push(txt);
      const mind = (v) => { if (v > 0 && S.mind > 72) v *= 0.35; S.mind = clamp(S.mind + v); };
      const mindStart = S.mind;
      const birdy = () => (wx.kind === 'sereno' || wx.kind === 'caldo' || wx.kind === 'nuvoloso') && !raining(t);
      const note = (txt) => diaryNotes.push(txt);
      const fetchGear = () => {
        if (carrying) return;
        go(gearPos(), 'Va a prendere gli attrezzi');
        act(0.1, 'pick', 'Prende gli attrezzi', null, () => { carrying = true; });
      };

      /* ---------------- MORNING ---------------- */
      act(0.25, 'wake', 'Si sveglia', d === 1
        ? 'Dove sono? ...non ricordo niente. Né chi sono, né come sono arrivato qui.'
        : pick(['Dove sono? ...non ricordo nulla.', 'Che posto è questo? La testa è vuota...', 'Mi sveglio. Non so dove sono.']));

      mind(NB.pages.length ? -3 : (d === 1 ? -4 : -9));
      let believedDay = 1;
      let readMin = 0;
      let planRules = false;
      if (NB.pages.length === 0) {
        act(0.2, 'read', 'Trova il taccuino', d === 1
          ? 'In tasca ho un taccuino vuoto e una penna. Ci scriverò tutto quello che scopro.'
          : 'Il taccuino è vuoto... non ho mai scritto niente?');
        ev(d === 1 ? 'Si sveglia sulla spiaggia senza alcun ricordo; in tasca trova un taccuino vuoto e una penna.'
          : 'Si sveglia senza ricordi e il taccuino è vuoto: riparte da zero.');
      } else {
        const diaries = NB.pages.filter((p) => p.kind === 'diary');
        let lines = [];
        if (NB.rules) {
          lines = NB.rules.lines.concat(diaries.length ? diaries[diaries.length - 1].lines : []);
        } else {
          diaries.forEach((p) => { lines = lines.concat(p.lines); });
        }
        const dur = 0.2 + 0.035 * lines.length;
        readMin = Math.round(dur * 60);
        const facts = lines.filter((l) => l.fact).map((l) => l.fact);
        const last = diaries[diaries.length - 1];
        believedDay = last ? last.label + 1 : 1;
        let th;
        if (NB.rules) th = `Leggo la pagina REGOLE e l'ultima pagina. "Giorno ${believedDay - 1}"... ok, ora so cosa fare.`;
        else th = `Un taccuino scritto con la mia calligrafia... ${diaries.length} pagine. Leggo tutto.`;
        act(dur, 'read', 'Legge il taccuino', th, () => { facts.forEach((f) => mem.add(f)); mind(NB.rules ? 6 : 4); });
        if (!NB.rules && dur > 0.85) {
          planRules = true;
          act(0.1, 'think', 'Riflette', `Ci ho messo ${readMin} minuti a leggere tutto! Stasera scrivo una pagina di REGOLE essenziali.`);
          ev(`Leggere il taccuino gli richiede ormai ${readMin} minuti: decide di scrivere una pagina di regole riassuntive.`);
        } else {
          ev(`Legge il taccuino (${readMin} min) e recupera ${new Set(facts).size} conoscenze.`);
        }
        if (mem.has('tally')) believedDay = W.tally + 1;
      }

      // Physical traces the notebook may not explain.
      if (W.shelter >= 1 && !mem.has('shelter')) {
        act(0.15, 'look', 'Osserva il riparo', 'Sono sotto un riparo di foglie... chi l\'ha costruito? Io? Deve essere mio.', () => learn('shelter'));
        ev('Si accorge di aver dormito in un riparo di cui il taccuino non parla: ne deduce di averlo costruito lui.');
      }
      if (W.tally > 0 && !mem.has('tally')) {
        act(0.2, 'look', 'Conta le tacche', `Ci sono ${W.tally} tacche incise sulla palma... sono i giorni? Allora oggi è il ${W.tally + 1}°.`, () => { learn('tally'); });
        believedDay = W.tally + 1;
        ev(`Nota ${W.tally} tacche sulla palma e capisce che contano i giorni.`);
      }
      if (W.ballFace && !mem.has('ball')) {
        act(0.15, 'look', 'Guarda il pallone', 'Il pallone ha una faccia disegnata e una scritta: TONDO. Ciao, Tondo.', () => learn('ball'));
        ev('Ritrova il pallone con la faccia disegnata e il nome TONDO: lo riconosce come compagno anche senza ricordarlo.');
      }
      if (W.sos >= 1 && !mem.has('sos')) {
        act(0.1, 'look', 'Vede le pietre', 'Sulla spiaggia qualcuno ha scritto SOS con le pietre... sono stato io?', () => learn('sos'));
      }
      if (W.wokeCold) {
        act(0.2, 'sick', 'Trema dal freddo', 'Brr... sono congelato. Stanotte ha fatto freddo e il fuoco si è spento.', () => { learn('coldnight'); mind(-4); });
        ev('Si sveglia intirizzito dopo una notte fredda e ventosa.');
        note('Notte gelida.');
        W.wokeCold = false;
      }
      if (W.windDamage) {
        act(0.2, 'look', 'Guarda il tetto', 'Il vento di stanotte ha strappato parte del tetto.', () => { S.mor = clamp(S.mor - 4); });
        ev('Il vento notturno ha danneggiato il tetto del riparo.');
        W.windDamage = false;
      }
      act(0.12, 'look', 'Guarda il cielo', wx.line);
      if (birdy() && chance(0.22)) {
        act(0.12, 'look', 'Gabbiani che strillano', 'Questi gabbiani strillano dall\'alba... che mal di testa.', () => { S.mor = clamp(S.mor - 2); mind(-1); }, 1, { gullsLoud: true });
      }
      ev(`Meteo: ${wx.label.toLowerCase()}, mare ${wx.sea}, ${wx.tMin}–${wx.tMax} °C.`);
      if (d === 1) {
        go(LOC.crate, 'Esplora la spiaggia');
        act(0.4, 'look', 'Ispeziona la cassa', "Una cassa: un'ascia, un coltello, una corda... e una canna da pesca completa.");
        go(LOC.ball, 'Cammina');
        act(0.3, 'play', 'Calcia il pallone', 'Un pallone. Chissà da dove arriva.', () => { S.mor = clamp(S.mor + 3); }, 1, { ballPlay: true });
        ev("Ispeziona una cassa con ascia, coltello, corda e una canna da pesca; trova un pallone e gli dà un calcio.");
      }
      if (mem.has('tally')) {
        go(LOC.palmB, 'Va alla palma');
        act(0.12, 'carve', 'Incide una tacca', `Tacca numero ${W.tally + 1}.`, () => { W.tally += 1; });
      }

      /* ---------------- ACTIONS ---------------- */
      function drink() {
        if (mem.has('water')) {
          go('spring', 'Va alla sorgente', 'Ho sete. La sorgente è a ovest.');
          act(0.3, 'drink', 'Beve', null, () => { S.hyd = 100; });
          return;
        }
        const th = W.waterTested ? 'Ho sete... ci sarà acqua dolce da qualche parte.' : "Ho la gola secca. Devo trovare dell'acqua.";
        const places = ['hill', 'stones', 'palmC', 'rocksEast', 'palmB'].filter(() => chance(0.5)).slice(0, 2);
        go(places.length ? places[0] : 'stones', 'Cerca acqua', th);
        if (places[1]) { act(0.2, 'look', 'Si guarda intorno', 'Niente acqua qui.'); go(places[1], 'Cerca acqua'); }
        if (pos === LOC.stones || places.includes('stones')) maybeBait(0.25);
        go('spring', 'Cerca acqua');
        if (!W.waterTested) {
          act(0.4, 'look', 'Esita', "Una sorgente! Sarà potabile? ...Annuso, assaggio un sorso. È dolce!", () => { W.waterTested = true; });
          ev("Assetato, cerca acqua e trova la sorgente a ovest; esita, poi l'assaggia: è potabile.");
        } else {
          ev("Assetato, cerca di nuovo l'acqua (non ricordava dov'era) e ritrova la sorgente.");
        }
        act(0.3, 'drink', 'Beve', null, () => { S.hyd = 100; learn('water'); });
        note("Ho trovato l'acqua.");
      }

      function maybeBait(p) {
        if (mem.has('bait')) return;
        if (chance(p)) {
          act(0.2, 'dig', 'Solleva una pietra', 'Sotto le pietre grigie ci sono dei vermi... esca perfetta per la canna!', () => learn('bait'));
          ev('Sollevando una pietra scopre dei vermi: esca per pescare.');
        }
      }

      function coconut() {
        fetchGear();
        const palm = chance(0.6) ? 'palmA' : 'palmC';
        go(palm, 'Va alla palma', 'Fame. Una noce di cocco.');
        if (W.coconuts < 1) {
          act(0.3, 'look', 'Cerca noci', 'Non ci sono più noci di cocco mature...', () => { S.mor = clamp(S.mor - 4); });
          ev('Le palme sono quasi senza noci mature.');
          return false;
        }
        act(0.7, 'chop', "Apre una noce con l'ascia", null, () => {
          W.coconuts -= 1; S.sat = clamp(S.sat + 24); S.hyd = clamp(S.hyd + 8); learn('coconut');
        }, 1.3);
        if (W.coconuts < 4 && !done.lowcoco) {
          done.lowcoco = true;
          act(0.1, 'think', 'Riflette', 'Restano poche noci sulle palme. Dovrò pescare.');
        }
        return true;
      }

      function tryFire(reason) {
        done.fire = (done.fire || 0) + 1;
        go('stones', 'Prende pietre nere', reason || 'Mi serve un fuoco.');
        go('firepit', 'Va al focolare');
        const ash = W.firepit && !mem.has('fire');
        const p = (0.22 + W.fireSkill * 0.14 + (ash ? 0.15 : 0)) * (1 - 0.45 * wx.wind) * (raining(t) ? 0.1 : 1);
        const ok = chance(p);
        act(1.0, 'firemake', 'Prova ad accendere il fuoco',
          ash ? 'Qui ci sono delle ceneri... qualcuno ci è già riuscito. Provo anch\'io.' : 'Batto le pietre nere sopra foglie secche...',
          () => { W.fireSkill += 1; }, 1.4, { sparks: true });
        if (ok) {
          act(0.3, 'cheer', 'Fuoco!', 'FUOCO! Ce l\'ho fatta!', () => { learn('fire'); W.firepit = true; S.mor = clamp(S.mor + 12); }, 1, { fire: true });
          ev(W.fireSkill > 1 && ash ? 'Trova delle ceneri e, con mani ormai esperte, riaccende il fuoco.' : `Dopo vari tentativi accende il fuoco (tentativo n. ${W.fireSkill}).`);
          note('Ho acceso il fuoco!');
        } else {
          act(0.1, 'think', 'Delusione', wx.wind > 0.6 ? 'Il vento spegne ogni scintilla!' : 'Solo scintille. Le foglie sono umide.', () => { S.mor = clamp(S.mor - 4); });
          ev('Prova ad accendere il fuoco battendo le pietre, ma fallisce.');
        }
        return ok;
      }

      function fish() {
        done.fish = true;
        fetchGear();
        if (mem.has('bait')) {
          go('stones', 'Raccoglie esche');
          act(0.25, 'dig', 'Raccoglie vermi', null);
        } else if (chance(0.35)) {
          go('stones', 'Passa dalle pietre');
          maybeBait(0.5);
        }
        let useSpot = mem.has('spot');
        if (wx.sea === 'agitato') {
          act(0.2, 'look', 'Guarda il mare', 'Mare agitato: oggi niente pesca, è troppo pericoloso.', () => learn('roughsea'));
          if (mem.has('coconut')) coconut();
          return;
        }
        if (useSpot && wx.sea === 'mosso') {
          if (mem.has('roughsea')) {
            useSpot = false;
            act(0.1, 'think', 'Riflette', 'Mare mosso: pesco dalla riva sud, come dice il taccuino.');
          } else {
            go('rocksEast', 'Va agli scogli');
            act(0.3, 'look', 'Onde sugli scogli', 'Le onde si schiantano sugli scogli! Rischio di cadere. Meglio la riva sud.', () => { learn('roughsea'); S.mor = clamp(S.mor - 3); });
            ev('Va agli scogli ma il mare mosso li rende pericolosi: ripiega sulla riva sud.');
            useSpot = false;
          }
        }
        go(useSpot ? 'rocksEast' : 'shoreSouth', 'Va a pescare',
          useSpot ? 'Agli scogli a est, come dice il taccuino.' : 'Provo a pescare dalla riva.');
        const bait = mem.has('bait');
        const seaMod = { calmo: 0.05, 'poco mosso': 0, mosso: -0.07, agitato: -0.2 }[wx.sea];
        const p = Math.max(0.05, 0.16 + (useSpot ? 0.2 : 0) + (bait ? 0.24 : 0) + Math.min(10, W.fishSkill) * 0.018 + seaMod - (raining(t) ? 0.05 : 0));
        let caught = 0;
        for (let i = 0; i < 4; i++) if (chance(p)) caught++;
        const pelicanHit = useSpot && birdy() && !(mem.has('pelican') && t < 9.5) && chance(0.4);
        if (pelicanHit) caught = Math.max(0, caught - 1 - (chance(0.5) ? 1 : 0));
        act(1.6, 'fish', 'Pesca', bait ? 'Esca sull\'amo, lancio...' : 'Lancio la lenza...', () => { W.fishSkill += 1; }, 0.8, { caught, pelican: pelicanHit });
        if (pelicanHit) {
          act(0.25, 'wave', 'Scaccia il pellicano', mem.has('pelican') ? 'Ancora quel pellicano! Dovevo venire prima...' : 'Un pellicano si tuffa proprio dove pesco e spaventa tutti i pesci! Sciò!',
            () => { learn('pelican'); S.mor = clamp(S.mor - 3); mind(-1.5); }, 1.4, { pelican: true });
          ev('Un pellicano si tuffa ripetutamente vicino agli scogli e gli spaventa i pesci.');
        }
        if (caught === 0) {
          act(0.1, 'think', 'Delusione', 'Niente. Neanche un pesce.', () => { S.mor = clamp(S.mor - 5); mind(-2); });
          ev(`Pesca ${useSpot ? 'dagli scogli' : 'dalla riva'} per un'ora e mezza senza prendere nulla.`);
          if (!useSpot && !mem.has('spot') && chance(0.45)) {
            go('rocksEast', 'Esplora la costa est');
            act(0.3, 'look', 'Osserva il mare', 'Qui agli scogli l\'acqua è limpida e piena di pesci!', () => learn('spot'));
            ev("Esplorando la costa scopre che dagli scogli a est l'acqua è piena di pesci.");
          }
          return;
        }
        learn('fishing');
        if (useSpot === false && caught >= 2 && chance(0.2)) learn('spot');
        if (mem.has('gulls')) {
          act(0.12, 'place', 'Copre il pesce con le foglie', 'Copro subito il pesce: i gabbiani sono ladri.');
        } else if (birdy() && chance(0.35)) {
          act(0.3, 'wave', 'Insegue un gabbiano', 'Ehi! Un gabbiano mi ha rubato un pesce! LADRO!', () => {
            caught -= 1; learn('gulls'); S.mor = clamp(S.mor - 4); mind(-2);
          }, 1.6, { gull: true });
          ev('Un gabbiano gli ruba un pesce appena pescato: lo insegue invano per la spiaggia.');
          note('Un gabbiano mi ha rubato un pesce!');
          if (caught <= 0) return;
        }
        ev(`Pesca ${caught} pesc${caught === 1 ? 'e' : 'i'}${useSpot ? ' dagli scogli a est' : ''}${bait ? ' usando i vermi come esca' : ''}.`);
        note(`Preso ${caught} pesc${caught === 1 ? 'e' : 'i'}.`);
        // Eat
        if (mem.has('fire') && raining(t)) {
          go(W.shelter >= 1 ? 'shelter' : 'palmB', 'Si ripara col pesce');
          act(Math.min(1.5, Math.max(0.3, wx.rain[1] - t)), 'sit', 'Aspetta che smetta', 'Con questa pioggia il fuoco non si accende. Aspetto.', null, 0.3);
        }
        if (mem.has('fire')) {
          go('firepit', 'Torna al fuoco');
          act(0.35, 'firemake', 'Accende il fuoco', null, null, 1, { fire: true, sparks: true });
          act(0.5, 'cook', 'Cuoce il pesce', 'Pesce alla brace. Profumo meraviglioso.', () => {
            S.sat = clamp(S.sat + 32 * caught); S.mor = clamp(S.mor + 5);
          }, 0.5, { fire: true });
        } else if (mem.has('rawbad') && W.fireSkill < 5 && !done.fire) {
          const ok = tryFire('Il taccuino dice che il pesce crudo fa male. Provo a fare il fuoco.');
          if (ok) {
            act(0.5, 'cook', 'Cuoce il pesce', 'Finalmente pesce cotto!', () => { S.sat = clamp(S.sat + 32 * caught); S.mor = clamp(S.mor + 6); }, 0.5, { fire: true });
          } else {
            act(0.3, 'eat', 'Mangia pesce crudo', 'Pazienza, lo mangio crudo...', () => { S.sat = clamp(S.sat + 18 * caught); });
            if (chance(0.4)) sick();
          }
        } else {
          act(0.3, 'eat', 'Mangia pesce crudo', 'Lo mangio crudo, ho troppa fame.', () => { S.sat = clamp(S.sat + 18 * caught); });
          if (chance(mem.has('rawbad') ? 0.4 : 0.6)) sick();
        }
      }

      function sick() {
        act(1.2, 'sick', 'Mal di pancia', 'Ahi... la pancia. Il pesce crudo mi ha fatto male.', () => {
          S.en = clamp(S.en - 15); S.mor = clamp(S.mor - 8); S.hp = clamp(S.hp - 8); mind(-4); learn('rawbad');
        }, 0.3);
        ev('Il pesce crudo gli provoca un forte mal di pancia.');
        note('Mal di pancia per il pesce crudo.');
      }

      function explore() {
        done.explore = true;
        go('hill', 'Esplora', "Salgo sulla collina per capire dove sono.");
        act(0.5, 'look', 'Osserva dalla collina', "Mare in ogni direzione. L'isola è piccola... e sono solo.", () => {
          learn('island'); S.mor = clamp(S.mor - 6);
        });
        ev("Sale sulla collina: l'isola è piccola, deserta, circondata dal mare.");
        go('palmC', 'Esplora');
        if (!mem.has('coconut') && chance(0.8)) {
          act(0.2, 'look', 'Osserva la palma', 'Noci di cocco sulle palme. Cibo!', () => learn('coconut'));
        }
        go('rocksEast', 'Esplora');
        if (!mem.has('spot') && chance(0.5)) {
          act(0.25, 'look', 'Osserva il mare', 'Dagli scogli si vedono tanti pesci.', () => learn('spot'));
        }
        go('shoreSouth', 'Esplora');
        go('stones', 'Esplora');
        maybeBait(0.3);
        if (!mem.has('water')) {
          go('spring', 'Esplora');
          act(0.3, 'drink', 'Trova la sorgente', W.waterTested ? 'Acqua dolce!' : 'Una sorgente! ...è dolce, si può bere.', () => {
            S.hyd = 100; learn('water'); W.waterTested = true;
          });
        }
      }

      function buildShelter() {
        done.shelter = true;
        fetchGear();
        go('palmB', 'Va al cantiere', W.shelter === 0 ? 'Mi serve un posto riparato per dormire.' : 'Continuo il riparo.');
        const lvl = W.shelter;
        const labels = ['Taglia pali e monta la struttura', 'Copre il tetto di foglie di palma', 'Rinforza il tetto con la corda'];
        act(2.0, 'chop', labels[Math.min(lvl, 2)], null, () => {
          W.shelter = Math.min(3, W.shelter + 1); learn('shelter'); S.mor = clamp(S.mor + 5); mind(3);
          if (W.shelter >= 1) W.ballHome = W.ballFace ? 'shelter' : W.ballHome;
        }, 1.7, { building: true });
        const msgs = ['Inizia a costruire un riparo vicino alla palma: pali e struttura.',
          'Copre il riparo con un tetto di foglie di palma.',
          'Rinforza il tetto del riparo legandolo con la corda.'];
        ev(msgs[Math.min(lvl, 2)]);
        note(['Iniziato il riparo.', 'Riparo con tetto!', 'Tetto rinforzato.'][Math.min(lvl, 2)]);
      }

      function play() {
        done.play = (done.play || 0) + 1;
        go(ballPos(), 'Va dal pallone');
        const named = mem.has('ball');
        act(0.7, 'play', named ? 'Gioca con Tondo' : 'Palleggia', named ? 'Dai Tondo, un altro passaggio!' : 'Palleggio un po\'. Mi distrae.', () => {
          S.mor = clamp(S.mor + (named ? 9 : 6)); mind(named ? 3 : 1.5);
        }, 1.1, { ballPlay: true });
        if (!named && S.mor < 50 && chance(0.6)) {
          act(0.4, 'talk', 'Parla al pallone', "Mi sento così solo... Ti chiamerò Tondo. Ecco, ti disegno una faccia.", () => {
            learn('ball'); W.ballFace = true; S.mor = clamp(S.mor + 10); mind(6);
            if (W.writer === 'penna') W.ink = Math.max(0, W.ink - 2);
            W.ballHome = W.shelter >= 1 ? 'shelter' : 'ball';
          });
          ev('Nella solitudine parla al pallone: lo chiama Tondo e gli disegna una faccia con la penna.');
          note('Il pallone ora si chiama Tondo.');
        } else {
          ev(named ? 'Gioca e chiacchiera con Tondo.' : 'Palleggia con il pallone per distrarsi.');
        }
      }

      function rainShelter() {
        done.rain = true;
        if (W.shelter >= 1) go('shelter', 'Corre al riparo', 'Inizia a piovere!');
        else go('palmB', 'Si ripara sotto la palma', 'Piove! Non ho un riparo...');
        const shells = mem.has('coconut') || W.coconuts < 10;
        if (mem.has('rainwater')) act(0.2, 'place', 'Mette fuori i gusci', 'Metto fuori i gusci di cocco: acqua da bere gratis.');
        const dur = Math.max(0.3, Math.min(wx.rain[1] - t, 3));
        act(dur, 'sit', W.shelter >= 1 ? 'Aspetta che smetta di piovere' : 'Sotto la pioggia',
          W.shelter >= 1 ? 'Il rumore della pioggia sulle foglie del tetto...' : 'Sono fradicio.',
          () => { if (W.shelter < 1) { S.mor = clamp(S.mor - 6); S.en = clamp(S.en - 5); } else S.mor = clamp(S.mor + 1); }, 0.3);
        if (mem.has('rainwater')) {
          act(0.2, 'drink', 'Beve acqua piovana', null, () => { S.hyd = 100; });
          ev('Piove: aspetta al riparo e beve l\'acqua raccolta nei gusci di cocco, come annotato.');
        } else if (shells && chance(0.55)) {
          act(0.3, 'drink', 'Beve acqua piovana', 'I gusci di cocco vuoti si sono riempiti di pioggia! Acqua senza andare alla sorgente.', () => { S.hyd = 100; learn('rainwater'); });
          ev('Durante la pioggia scopre che i gusci di cocco vuoti raccolgono acqua da bere.');
          note('La pioggia riempie i gusci di cocco.');
        } else {
          ev(W.shelter >= 1 ? 'Piove: aspetta nel riparo che smetta.' : 'Piove e, senza riparo, si bagna fino alle ossa.');
        }
      }
      function shade() {
        done.shade = true;
        const knows = mem.has('heat');
        go(W.shelter >= 1 ? 'shelter' : 'palmB', 'Cerca ombra',
          knows ? "Ore calde: all'ombra, come dice il taccuino." : 'Che caldo! Non riesco a fare niente sotto questo sole.');
        act(knows ? 1.5 : 2.0, 'sit', "Riposa all'ombra", null, () => { learn('heat'); S.en = clamp(S.en + 8); }, 0);
        ev(knows ? "Nelle ore più calde resta all'ombra, come prevede la sua regola." : "Il caldo torrido lo sfianca: si rifugia all'ombra nelle ore centrali.");
        if (!knows) note("Troppo caldo a mezzogiorno.");
      }

      function cope() {
        done.cope = true;
        if (mem.has('coping')) {
          go(ballPos(), 'Va da Tondo', 'Mi sento a pezzi. Il taccuino dice cosa fare: parlo con Tondo, guardo il mare, poi una cosa utile.');
          act(0.6, 'talk', 'Si sfoga con Tondo', 'Sai Tondo, oggi è dura. Ma è già passata altre volte.', () => { mind(9); S.mor = clamp(S.mor + 8); });
          go('sitSpot', 'Va sulla riva');
          act(0.6, 'sit', 'Respira guardando il mare', 'Respiro. Le onde vanno e vengono.', () => { mind(5); }, 0.3);
          ev('Si sente a pezzi, ma applica la sua regola per i momenti bui: si sfoga con Tondo e respira guardando il mare.');
          return;
        }
        go('sitSpot', 'Si siede sulla riva', pick(['Che senso ha tutto questo? Ogni mattina ricomincio da zero.', 'Nessuno sa che sono qui...', 'Non ho voglia di fare niente.']));
        act(1.3, 'sit', 'Fissa il mare, apatico', 'Fisso il mare. Non riesco a muovermi.', () => { mind(-1); S.en = clamp(S.en + 3); }, 0.2);
        if (mem.has('ball') || W.ballFace || chance(0.4)) {
          go(ballPos(), 'Va dal pallone');
          act(0.5, 'talk', 'Parla al pallone', mem.has('ball') ? 'Tondo... almeno ci sei tu.' : 'Parlo con un pallone. Bene.', () => { mind(mem.has('ball') ? 6 : 3); S.mor = clamp(S.mor + 4); });
        }
        go('shoreSouth', 'Cammina sulla riva');
        act(0.4, 'dig', 'Raccoglie conchiglie', 'Faccio almeno una cosa piccola. Raccolgo conchiglie per Tondo.', () => { mind(4); }, 0.6);
        ev('Attraversa un momento di apatia: resta a lungo seduto a fissare il mare, poi si sforza di fare una piccola cosa.');
        note('Giornata buia. Non avevo voglia di niente.');
      }

      function buildSOS() {
        done.sos = true;
        go('sos', 'Va in spiaggia', 'La nave non mi ha visto. Devo farmi vedere dal mare.');
        act(1.8, 'place', 'Compone SOS con le pietre', null, () => { W.sos = 1; S.mor = clamp(S.mor + 6); mind(5); }, 1.6, { building: true });
        ev('Compone una grande scritta SOS con le pietre sulla spiaggia.');
        note('Scritto SOS con le pietre.');
      }
      function buildWoodHill() {
        done.wood = true;
        fetchGear();
        go('woodSpot', 'Raccoglie legna');
        act(1.0, 'chop', 'Taglia legna', null, null, 1.6);
        go('hill', 'Porta la legna sulla collina');
        act(0.8, 'place', 'Prepara la catasta', 'Se passa un\'altra nave, la accendo.', () => { W.woodHill = 1; learn('sos'); S.mor = clamp(S.mor + 6); mind(5); }, 1.4, { building: true });
        ev('Prepara una catasta di legna sulla collina, pronta da accendere come segnale.');
        note('Catasta pronta sulla collina.');
      }

      function leisure() {
        const opts = [];
        opts.push(['sit', 2]);
        opts.push(['walk', 1]);
        if (mem.has('ball')) opts.push(['ball', 2]);
        if (mem.has('ship')) opts.push(['watch', 3]);
        if (mem.has('fishing') && t < 16 && S.sat < 80) opts.push(['fish', 2]);
        if (!mem.has('fishing') && !done.fish && t < 17.5) opts.push(['fish', 4]);
        const tot = opts.reduce((a, o) => a + o[1], 0);
        let r = rng() * tot; let choice = opts[0][0];
        for (const o of opts) { r -= o[1]; if (r <= 0) { choice = o[0]; break; } }
        if (choice === 'fish') return fish();
        if (choice === 'sit') {
          go('sitSpot', 'Va sulla riva');
          const dolphins = (wx.sea === 'calmo') && chance(S.mind < 50 ? 0.5 : 0.2);
          act(0.9, 'sit', dolphins ? 'Guarda i delfini' : 'Guarda il mare', dolphins ? 'Delfini! Saltano tra le onde... per un attimo mi sento meno solo.' : pick(['Il mare è immenso. Chissà chi sono.', 'Le onde vanno e vengono.', 'Qualcuno mi starà cercando?']),
            () => { S.mor = clamp(S.mor + (dolphins ? 8 : 2)); mind(dolphins ? 7 : 0.5); }, 0.4, dolphins ? { dolphins: true } : null);
          if (dolphins) ev('Vede un branco di delfini saltare vicino alla riva: un momento di sollievo.');
        } else if (choice === 'walk') {
          go(pick(['shoreSouth', 'rocksEast', 'sos', 'palmC']), 'Passeggia');
          act(0.4, 'look', 'Si guarda intorno', null, null, 0.6);
        } else if (choice === 'ball') {
          play();
        } else if (choice === 'watch') {
          go('hill', 'Sale sulla collina', 'Controllo l\'orizzonte. Magari passa una nave.');
          act(0.8, 'look', 'Scruta l\'orizzonte', 'Niente. Solo mare.', () => { S.mor = clamp(S.mor - 1); }, 0.5);
        }
      }

      /* ---------------- SCHEDULED WORLD EVENTS ---------------- */
      const sched = [];
      if (d === 8) sched.push({ at: 15.2, kind: 'ship1' });
      if (d === 13) sched.push({ at: 13.2, kind: 'storm' });
      if (d === DAYS) sched.push({ at: 17.4, kind: 'ship2' });

      function handleEvent(e) {
        e.done = true;
        if (e.kind === 'ship1') {
          const t0 = t;
          act(0.6, 'wave', 'Si sbraccia', 'Una NAVE! Ehi! EHI! Sono qui!!', null, 1.5);
          act(0.3, 'sit', 'Delusione', 'Se ne va... non mi hanno visto.', () => { learn('ship'); S.mor = clamp(S.mor - 10); mind(-18); });
          worldEvents.push({ kind: 'ship', t0: t0 - 0.4, t1: t0 + 1.6, path: 'pass' });
          ev('Una nave passa lontano: si sbraccia e grida, ma non viene visto. Capisce che gli serve un segnale.');
          note('Passata una nave! Non mi ha visto.');
        } else if (e.kind === 'storm') {
          worldEvents.push({ kind: 'storm', t0: e.at - 0.3, t1: e.at + 3.2 });
          if (W.shelter >= 1) {
            go('shelter', 'Corre al riparo', 'Arriva una tempesta da ovest!');
            const before = W.shelter;
            act(2.6, 'sit', 'Si ripara dalla tempesta', 'Il vento scuote il tetto... reggi!', () => {
              if (W.shelter < 3) W.shelter = Math.max(1, W.shelter - 1);
              learn('storm'); S.mor = clamp(S.mor - (before < 3 ? 8 : 3)); mind(before < 3 ? -6 : -3);
            }, 0.3);
            ev(before < 3 ? 'Arriva una tempesta: si rifugia nel riparo, ma il vento gli strappa parte del tetto.'
              : 'Arriva una tempesta: il tetto rinforzato regge e lui resta all\'asciutto.');
          } else {
            go('palmB', 'Corre sotto la palma', 'Tempesta! Non ho un riparo!');
            act(2.6, 'sick', 'Sotto la pioggia', 'Fradicio e infreddolito...', () => { S.en = clamp(S.en - 15); S.mor = clamp(S.mor - 14); mind(-9); learn('storm'); }, 0.3);
            ev('Arriva una tempesta e, senza riparo, la passa fradicio sotto una palma.');
          }
          note('Tempesta da ovest.');
        } else if (e.kind === 'ship2') {
          const t0 = t;
          const ready = W.sos >= 1 && W.woodHill >= 1;
          const knows = mem.has('sos') || mem.has('ship');
          act(0.3, 'wave', 'Vede una nave', 'Una nave all\'orizzonte!', null, 1.5);
          if (ready && knows) {
            go('hill', 'Corre sulla collina', 'La catasta! Il taccuino dice di accenderla!');
            const canFire = mem.has('fire') || W.fireSkill >= 3;
            if (canFire) {
              act(0.5, 'firemake', 'Accende il falò di segnale', null, null, 1.5, { bonfire: true, sparks: true });
              act(1.4, 'wave', 'Si sbraccia accanto al falò', 'Il fumo sale alto... la nave sta virando! Viene verso di me!',
                () => { W.rescued = true; S.mor = 100; mind(40); }, 1.2, { bonfire: true });
              worldEvents.push({ kind: 'ship', t0: t0 - 0.3, t1: t + 3, path: 'approach', turnAt: t - 1.0 });
              ev('Una nave compare all\'orizzonte: corre sulla collina, accende la catasta preparata e il fumo la fa virare verso l\'isola.');
              note('UNA NAVE STA ARRIVANDO!');
            } else {
              act(1.2, 'firemake', 'Non riesce ad accendere', 'Non riesco ad accendere... maledizione!', null, 1.5, { sparks: true });
              worldEvents.push({ kind: 'ship', t0: t0 - 0.3, t1: t + 0.5, path: 'pass' });
              ev('Una nave compare: corre alla catasta ma non riesce ad accenderla in tempo.');
            }
          } else {
            act(1.0, 'wave', 'Si sbraccia', 'Ehi!! Qui!! ...niente, non mi vedono.', () => { S.mor = clamp(S.mor - 10); mind(-14); });
            worldEvents.push({ kind: 'ship', t0: t0 - 0.3, t1: t0 + 1.6, path: 'pass' });
            ev('Una nave passa al largo: senza segnale pronto, si sbraccia invano.');
          }
        }
      }

      /* ---------------- DAY LOOP ---------------- */
      let guard = 0;
      while (t < 19.6 && guard++ < 60) {
        const e = sched.find((x) => !x.done && t >= x.at);
        if (e) { handleEvent(e); continue; }
        if (W.rescued) { act(Math.max(0.3, 19.7 - t), 'wave', 'Aspetta la nave', 'Sto tornando a casa... chiunque io sia.', null, 0.5, { bonfire: true }); break; }
        if (wx.rain && raining(t) && !done.rain && d !== 13) { rainShelter(); continue; }
        if (S.hyd < (hot() && mem.has('heat') ? 65 : 50)) { drink(); continue; }
        if (tempAt(wx, t) >= 32 && t >= (mem.has('heat') ? 11.8 : 12.6) && t < 15 && !done.shade) { shade(); continue; }
        if (S.sat < 52) {
          const canFish = t < 17.3 && S.en > 22 && (mem.has('fishing') || W.coconuts < 3 || (mem.has('coconut') === false && d > 1));
          if (canFish) { fish(); continue; }
          if (mem.has('coconut')) { if (coconut()) continue; fish(); continue; }
          go('palmA', 'Cerca cibo', 'Ho fame... cosa si mangia qui?');
          act(0.3, 'look', 'Osserva la palma', 'Noci di cocco! Con l\'ascia posso aprirle.', () => learn('coconut'));
          coconut();
          continue;
        }
        if (S.en < 22) {
          go(sleepPos(), 'Va a riposare');
          act(1.0, 'sleep', 'Sonnellino', 'Sono esausto...', () => { S.en = clamp(S.en + 22); }, 0);
          continue;
        }
        if (S.mind < (mem.has('coping') ? 48 : 38) && !done.cope && t < 18.5) { cope(); continue; }
        if (!mem.has('island') && !done.explore) { explore(); continue; }
        if (mem.has('pelican') && mem.has('fishing') && mem.has('spot') && !done.fish && t < 8.6 && wx.sea !== 'mosso' && wx.sea !== 'agitato') { fish(); continue; }
        if (S.mind < 30 && chance(0.5) && t < 17) {
          act(0.8, 'sit', 'Esita, senza energie', 'Dovrei fare qualcosa... ma a cosa serve?', null, 0.3);
          continue;
        }
        if (mem.has('rawbad') && !mem.has('fire') && (done.fire || 0) < 2 && t < 18 && !raining(t)) { tryFire('Il pesce crudo fa male: devo imparare a fare il fuoco.'); continue; }
        if (mem.has('ship') && W.sos < 1 && !done.sos && t < 17.5) { buildSOS(); continue; }
        if (mem.has('ship') && W.woodHill < 1 && !done.wood && t < 17) { buildWoodHill(); continue; }
        if (!mem.has('fire') && !done.fire && d >= 2 && t < 17.5 && !raining(t)) { tryFire(); continue; }
        if (W.shelter < 3 && !done.shelter && d >= 2 && t < 17 && S.en > 35) {
          if (W.shelter < 2 || mem.has('storm') || chance(0.5)) { buildShelter(); continue; }
        }
        if (S.mor < 58 && !done.play) { play(); continue; }
        if (mem.has('fishing') && !done.fish && t < 11 && S.sat < 85) { fish(); continue; }
        leisure();
      }
      // any pending event that slipped (e.g. ship2 late)
      sched.filter((x) => !x.done).forEach(handleEvent);

      /* ---------------- EVENING ---------------- */
      let firedEvening = false;
      let nightFire = false;
      const coldNight = wx.tMin <= 21 || wx.wind >= 0.7;
      if (mem.has('fire') && !W.rescued && !raining(t)) {
        go('firepit', 'Torna al campo');
        act(0.4, 'firemake', 'Accende il fuoco serale', null, () => { S.mor = clamp(S.mor + 3); firedEvening = true; }, 1, { fire: true, sparks: true });
        if (coldNight && mem.has('coldnight')) {
          go('palmC', 'Raccoglie legna extra', 'Stanotte farà freddo: serve legna per tenere il fuoco acceso fino all\'alba.');
          act(0.5, 'chop', 'Raccoglie legna', null, null, 1.3);
          go('firepit', 'Torna al fuoco');
          act(0.2, 'place', 'Alimenta il fuoco', null, () => { nightFire = true; }, 1, { fire: true, nightFire: true });
          ev('Prevedendo una notte fredda, raccoglie legna extra e tiene il fuoco acceso fino all\'alba.');
        }
      } else if (!W.rescued) {
        go(LOC.firepit, 'Torna al campo');
      }

      // ---- WRITE ----
      const writtenToday = [];
      const forgotten = [];
      const pW = (S.en > 40 ? 0.97 : S.en > 20 ? 0.78 : 0.5) * (S.mind < 30 ? 0.7 : S.mind < 42 ? 0.85 : 1);
      if (minMind < 34 && S.mind > 44 && !mem.has('coping') && !NB.written.has('coping')) {
        act(0.2, 'think', 'Riflette', 'Qualche giorno fa stavo a pezzi... oggi va meglio. Mi scrivo cosa mi ha aiutato.', () => learn('coping'));
        ev('Uscito da un periodo buio, si scrive una regola su cosa lo aiuta nei momenti difficili.');
      }
      let page = null;
      const lineCost = () => (W.writer === 'penna' ? 1 : 0);
      const toWrite = learnedToday.filter((k) => !NB.written.has(k));

      if (W.ink <= 0 && W.writer === 'penna') {
        if (mem.has('fire') || W.firepit) {
          act(0.4, 'dig', 'Prende un tizzone', 'La penna non scrive più... e se usassi il carbone del fuoco?', null, 1, { fire: true });
          W.writer = 'carbone';
          learn('charcoal'); mind(4);
          if (!NB.written.has('charcoal')) toWrite.push('charcoal');
          ev("La penna è esaurita: prova a scrivere con un pezzo di carbone del fuoco, e funziona.");
        }
      }

      const canWrite = W.writer === 'carbone' || W.ink > 0;
      if (!canWrite) {
        act(0.3, 'write', 'Prova a scrivere', 'La penna è finita. Non posso scrivere nulla... domani non saprò niente di oggi.', () => { S.mor = clamp(S.mor - 6); mind(-10); });
        ev('La penna è finita e non sa come scrivere: tutto ciò che ha scoperto oggi andrà perso.');
        toWrite.forEach((k) => forgotten.push(k));
      } else {
        const lowInk = W.writer === 'penna' && W.ink < 30;
        if (lowInk && !mem.has('tally') && W.tally === 0) {
          go('palmB', 'Va alla palma');
          act(0.3, 'carve', 'Incide tacche', `La penna sta finendo. Se smetto di scrivere perderò il conto dei giorni: incido ${believedDay} tacche sulla palma.`, () => {
            W.tally = believedDay; learn('tally');
          });
          toWrite.push('tally');
          ev(`Accorgendosi che l'inchiostro sta finendo, incide ${believedDay} tacche sulla palma per non perdere il conto dei giorni.`);
        }
        go(sleepPos(), 'Si siede per scrivere');
        page = { kind: 'diary', day: d, label: believedDay, lines: [], writer: W.writer };
        NB.pages.push(page);
        const perLine = W.writer === 'carbone' ? 0.09 : 0.05;
        const write = (text, fact, target, cost) => {
          if (W.writer === 'penna') {
            if (W.ink <= 0) return false;
            W.ink = Math.max(0, W.ink - cost * lineCost());
          }
          (target || page).lines.push({ text, fact: fact || null, d, writer: W.writer });
          if (fact) { NB.written.add(fact); writtenToday.push(fact); }
          return true;
        };
        const lines0 = [];
        lines0.push(['__header', null]);
        if (planRules) {
          // rules page compiled from all current knowledge
          const rules = { kind: 'rules', day: d, label: 'REGOLE', lines: [], writer: W.writer };
          NB.pages.push(rules);
          NB.rules = rules;
          const all = Array.from(new Set(Array.from(mem).concat(toWrite)));
          const order = Object.keys(FACTS).filter((k) => all.includes(k));
          let n = 0;
          order.forEach((k) => {
            if (!mem.has(k)) return;
            if (write('• ' + FACTS[k].text, k, rules, 2)) n++;
            else if (!forgotten.includes(k)) forgotten.push(k);
          });
          ev(`Scrive la pagina REGOLE con ${n} punti essenziali.`);
        }
        const target = NB.rules || null;
        let wroteHeader = false;
        const writeHeader = () => {
          if (wroteHeader) return; wroteHeader = true;
          write(`Giorno ${believedDay}`, null, page, 1);
        };
        writeHeader();
        toWrite.forEach((k) => {
          if (NB.written.has(k)) return;
          if (chance(pW)) {
            const ok = write((target ? '• ' : '') + FACTS[k].text, k, target || page, target ? 2 : 3);
            if (!ok) forgotten.push(k);
          } else forgotten.push(k);
        });
        const moodLine = S.mind >= 75 ? 'Mi sento bene, quasi in pace.' : S.mind >= 55 ? null : S.mind >= 40 ? 'Mi sento solo.' : S.mind >= 25 ? 'Giornata pesante. Mi manca qualcuno, ma non so chi.' : 'Non so quanto resisterò così.';
        if (moodLine) diaryNotes.unshift(moodLine);
        const nDiary = lowInk ? 1 : 2;
        const uniq = Array.from(new Set(diaryNotes));
        if (uniq.length === 0) uniq.push(pick(['Giornata tranquilla.', 'Niente di nuovo.', 'Ho guardato il mare.']));
        uniq.slice(0, nDiary).forEach((n) => write(n, null, page, 2));
        if (W.writer === 'penna' && W.ink <= 0) {
          ev('Scrivendo, la penna si esaurisce del tutto.');
        }
        const nLines = page.lines.length + (planRules && NB.rules ? NB.rules.lines.length : 0) + (target && !planRules ? writtenToday.length : 0);
        act(Math.max(0.25, nLines * perLine), 'write', 'Scrive sul taccuino',
          planRules ? 'Pagina REGOLE: solo ciò che serve davvero.' : (lowInk ? 'Poco inchiostro: solo l\'essenziale.' : 'Annoto tutto quello che ho scoperto oggi.'), null, 0.4, { notebook: true });
        if (forgotten.length) ev(`Stanco, dimentica di annotare: ${forgotten.map((k) => FACTS[k].label.toLowerCase()).join(', ')}. Domani non lo saprà.`);
      }

      if (mem.has('ball') && !W.rescued) {
        act(0.25, 'talk', 'Parla con Tondo', pick(['Buonanotte, Tondo.', 'Sai, Tondo, domani non ricorderò niente. Ma tu ci sarai.', 'Tondo, secondo te chi ero prima?']), () => { S.mor = clamp(S.mor + 4); mind(1.5); });
      }

      const mstate = (v) => (v >= 75 ? 'serena' : v >= 55 ? 'stabile' : v >= 40 ? 'provata' : v >= 25 ? 'fragile' : 'in crisi');
      if (mstate(S.mind) !== mstate(mindStart) && Math.abs(S.mind - mindStart) >= 6) ev(`Salute mentale: da "${mstate(mindStart)}" a "${mstate(S.mind)}".`);
      // Sleep
      const statsEndAwake = Object.assign({}, S);
      const memEnd = Array.from(mem);
      if (d < DAYS || !W.rescued) {
        go(sleepPos(), 'Va a dormire');
        const sh = W.shelter;
        const cold = coldNight && !nightFire;
        minMind = Math.min(minMind, S.mind);
        seg('sleep', 30 - t, {
          anim: 'sleep', label: cold ? 'Dorme (notte fredda)' : 'Dorme', thought: null, work: 0, noTick: true,
          extra: { nightFire, cold },
          fx: () => {
            S.en = sh >= 2 ? 100 : sh === 1 ? 90 : 80;
            if (cold) { S.en -= sh >= 2 ? 10 : 20; S.mor = clamp(S.mor - 4); }
            S.mind = clamp(S.mind + (sh >= 2 ? 1.5 : -1) + (nightFire ? 1 : 0));
            S.sat = clamp(S.sat - 9); S.hyd = clamp(S.hyd - 12);
            S.mor = clamp(S.mor + (sh >= 2 ? 4 : -2));
            if (cold) W.wokeCold = true;
            if (wx.wind >= 0.75 && W.shelter === 2 && chance(0.45)) { W.shelter = 1; W.windDamage = true; }
          },
        });
      } else {
        seg('act', 30 - t, { anim: 'wave', label: 'Aspetta i soccorsi', work: 0, noTick: true, extra: { bonfire: true } });
      }
      // undo tick side-effects during sleep beyond fx (tick ran before fx; fx sets en)
      days.push({
        day: d, timeline: tl, events, believedDay, readMin,
        learned: learnedToday.slice(), written: writtenToday.slice(), forgotten: forgotten.slice(),
        memEnd, stats: statsEndAwake, ink: W.ink, writer: W.writer, shelter: W.shelter, tally: W.tally,
        worldEvents, pageIndex: NB.pages.length, rescued: W.rescued, weather: wx,
      });
    }

    // Notebook snapshot (final). Lines carry day d, renderer reveals by day/time.
    const notebook = NB.pages.map((p) => ({ kind: p.kind, day: p.day, label: p.label, lines: p.lines.slice() }));
    // annotate writing time of each line (=the write segment of that day)
    days.forEach((dy) => {
      const ws = dy.timeline.find((s) => s.anim === 'write');
      dy.writeAt = ws ? ws.t0 : 30;
    });
    return { days, notebook, LOC, FACTS };
  }

  const api = { simulate, LOC, FACTS, weatherAt, tempAt, genWeather, rngFrom, WX_TYPES, ISL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IslandSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
