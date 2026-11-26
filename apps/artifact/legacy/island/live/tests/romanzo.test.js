/* Core tests for romanzo.js with a scripted model. Run: node tests/romanzo.test.js */
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'style.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '..', 'qualita.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '..', 'romanzo.js'), 'utf8');
const R = new Function(src + '\nreturn ROMANZO;')();
const ENDING = 'FINALE-SEGRETO-XYZ', STAGE = 'TAPPA-SEGRETA', CULPRIT = 'Livia Corsi';
const md = `# La villa nella neve
Genere: giallo
Pagine: 10
Ambientazione: villa isolata, inverno 1936
Tono: ironico ma teso

## Idea
Durante una bufera un ospite viene trovato morto nella biblioteca chiusa a chiave.

## Deve succedere
- la neve blocca la strada

## Personaggi
### Ada Ferri
Ruolo: detective
Sesso: f
Età: 52
Carattere: paziente, ironica
Vuole: capire
Teme: sbagliare

### Livia Corsi
Ruolo: comprimario
Sesso: f
Età: 34
Carattere: brillante, nervosa

### Bruno Sala
Ruolo: comprimario
Sesso: m
Età: 60
Carattere: burbero
`;
let calls = { n: 0, byKind: {} }; const prompts = [];
function names(p) { return [...p.matchAll(/\n- ([^,\n]+), (protagonista|detective|antagonista|comprimario)/g)].map((m) => m[1]); }
async function ask(kind, prompt) {
  calls.n++; calls.byKind[kind] = (calls.byKind[kind] || 0) + 1; prompts.push({ kind, prompt });
  if (kind === 'piano') return { domanda: 'Chi ha ucciso il notaio?', leggi: ['Nessuno può lasciare la villa', 'La biblioteca si chiude solo da dentro'],
    dossier: { vittima: 'il notaio', colpevole: CULPRIT, movente: 'eredità', metodo: 'veleno nel tè', cronologia_vera: 'x', cronologia_apparente: 'y', indizi: [{ testo: 'tazza lavata', capitolo: 1, camuffamento: 'ordine' }, { testo: 'orologio fermo', capitolo: 2, camuffamento: 'guasto' }, { testo: 'lettera bruciata', capitolo: 3, camuffamento: 'camino' }], falsa_soluzione: { sospettato: 'Bruno Sala', indizi_apparenti: ['litigio'] }, detective: 'Ada Ferri' },
    finale: { testo: ENDING }, tappe: [{ id: 't1', fatto: STAGE + ' uno', capitolo: 1 }, { id: 't2', fatto: 'il veleno', capitolo: 2 }, { id: 't3', fatto: 'la confessione', capitolo: 4 }], segreti: [{ nome: CULPRIT, segreto: 'SEGRETO-LIVIA: è la colpevole' }, { nome: 'Bruno Sala', segreto: 'SEGRETO-BRUNO: debiti' }] };
  if (kind === 'scena') return { luogo: 'biblioteca', tempo: 'notte', punto_di_vista: 'Ada Ferri', presenti: ['Ada Ferri', 'Livia Corsi', 'Bruno Sala'], conversazione_centrale: { tra: ['Ada Ferri', 'Bruno Sala'], tema: 'il litigio' }, pressione: 'la neve sale', morti: [{ nome: 'Ada Ferri', causa: 'caduta' }], nuovi: [] };
  if (kind === 'personaggi') return { personaggi: [{ nome: 'Ada Ferri', vuole: 'capire', pensa: 'qualcosa non torna', fa: 'osserva la tazza', battute: ['Chi ha lavato questa tazza?'], mente: '' }, { nome: CULPRIT, vuole: 'non farsi scoprire', pensa: 'calma', fa: 'sorride', battute: ['Io dormivo.'], mente: 'dove era' }] };
  if (kind === 'capitolo') { const n = (prompt.match(/CAPITOLO (\d+)/) || [])[1]; return { titolo: 'Capitolo ' + n, testo: ('La neve cadeva. «Chi ha lavato questa tazza?» chiese Ada. ').repeat(40), riassunto: 'Riassunto ' + n, fatti_nuovi: ['fatto ' + n], promesse_aperte: [{ testo: 'la tazza', tipo: 'indizio', importante: true }], promesse_chiuse: +n >= 2 ? ['p1'] : [], tappa_raggiunta: 't' + n, morti: [], nuovi: [] }; }
  if (kind === 'controllo') return { gravi: [], lievi: ['ripetizione'], avvicinamento: 'si' };
  if (kind === 'lettore') return { colpevole: CULPRIT, sicurezza: 90, perche: 'la tazza', noia: [], confusione: [] };
  if (kind === 'revisione') return { ritocchi: [{ capitolo: 1, da: 'La neve cadeva.', a: 'La neve cadeva, fitta.', perche: 'preparare' }] };
  if (kind === 'romanzo') return { titolo: 'Titolo', epigrafe: 'Una frase.' };
  if (kind === 'stesura') return null;
  return null;
}
(async () => {
  const S = R.parseMd(md); assert.strictEqual(S.genre, 'giallo'); assert.strictEqual(S.characters.length, 3); assert.strictEqual(S.pages, 10);
  assert.strictEqual(R.checkSetup(S), ''); assert.ok(R.parseMd(R.toMd(S)).characters.length === 3, 'md round trip');
  { const L = R.parseMd('# X\nGenere: fantascienza\nStile: libero\n\n## Stile\nFrasi chiare,\nironia asciutta.\n\n## Idea\nUna stazione venduta tre volte.\n'); assert.strictEqual(L.style, 'libero'); assert.strictEqual(L.styleCustom, 'Frasi chiare, ironia asciutta.'); assert.strictEqual(R.parseMd(R.toMd(L)).styleCustom, L.styleCustom, 'free style round trip'); }
  assert.strictEqual(R.chaptersFor(25), 9); assert.strictEqual(R.chaptersFor(10), 4);
  const N = R.newWork(S, { visibility: 'complice', seed: 1 }); assert.strictEqual(N.setup.style, 'christie'); assert.strictEqual(N.setup.grade, 'architettura');
  assert.ok(await R.makePlan(N, ask)); assert.strictEqual(N.plan.dossier.culprit, CULPRIT); assert.strictEqual(N.plan.stages[N.plan.stages.length - 1].final, true);
  // visibility: complice sees the question but not the ending; lettore nothing; visibility only grows
  let V = R.planView(N); assert.ok(V.question && !JSON.stringify(V).includes(ENDING) && !JSON.stringify(V).includes(STAGE));
  assert.ok(!R.setVisibility(N, 'lettore'), 'cannot go back to less visibility');
  // director: the detective is protected; events reach the next scene
  assert.ok(R.director.kill(N, 'Ada Ferri').length > 0, 'detective protected'); R.director.event(N, 'EVENTO-REGIA crolla il lampadario'); R.director.whisper(N, 'Bruno Sala', 'SUSSURRO-BRUNO');
  let guard = 0; while (N.status !== 'ended' && guard++ < 10) await R.writeChapter(N, { ask });
  assert.strictEqual(N.status, 'ended'); assert.ok(N.chapters.length >= 3 && N.chapters.length <= 6, 'length within target + extra');
  // the scripted author tried to kill the detective every chapter: never happened
  assert.ok(N.cast.find((c) => c.name === 'Ada Ferri').alive, 'protected detective never dies');
  const scenes = prompts.filter((p) => p.kind === 'scena'); assert.ok(scenes[0].prompt.includes('EVENTO-REGIA'), 'director event in the next scene'); assert.ok(!scenes[1].prompt.includes('EVENTO-REGIA'), 'event used once');
  const chars = prompts.filter((p) => p.kind === 'personaggi');
  chars.forEach((p) => { assert.ok(!p.prompt.includes(ENDING) && !p.prompt.includes(STAGE) && !p.prompt.includes('Chi ha ucciso il notaio'), 'characters never see plan, ending or stages'); });
  assert.ok(chars[0].prompt.includes('SUSSURRO-BRUNO') && !chars[1].prompt.includes('SUSSURRO-BRUNO'), 'whisper once');
  prompts.filter((p) => p.kind === 'lettore').forEach((p) => assert.ok(!p.prompt.includes(ENDING) && !p.prompt.includes('SEGRETO-LIVIA'), 'honest reader never sees the plan'));
  // the reader guessed early: the next scene strengthens the false trail
  assert.ok(scenes.some((p) => p.prompt.includes('IL LETTORE INDOVINA TROPPO PRESTO')), 'strengthen after an early guess');
  // backward revision applied once as an exact replacement
  assert.ok(N.chapters[0].text.includes('La neve cadeva, fitta.') && N.chapters[0].amended >= 1);
  // promises: opened and closed, by id
  assert.ok(N.promises.some((p) => p.closed));
  // the end reveals everything
  V = R.planView(N); assert.ok(V.full && JSON.stringify(V).includes(ENDING));
  // drop last chapter and rewrite
  const before = N.chapters.length; assert.ok(R.dropLast(N, 'più tensione')); assert.strictEqual(N.chapters.length, before - 1); assert.strictEqual(N.status, 'writing');
  await R.writeChapter(N, { ask }); assert.strictEqual(N.chapters.length, before);
  // a character added late in a mystery is flagged late
  const M = R.newWork(S, { seed: 2 }); await R.makePlan(M, ask); await R.writeChapter(M, { ask }); await R.writeChapter(M, { ask }); R.director.add(M, { name: 'Ultimo Arrivato' }); await R.writeChapter(M, { ask });
  assert.ok(M.cast.find((c) => c.name === 'Ultimo Arrivato').late, 'late entrant flagged');
  // all calls failing: no crash, nothing written
  const F = R.newWork(S, { seed: 3 }); assert.ok(!(await R.makePlan(F, async () => { throw new Error('down'); })));
  F.plan = N.plan; F.status = 'planned'; assert.strictEqual(await R.writeChapter(F, { ask: async () => { throw new Error('down'); } }), null);
  // situation grade chooses the ending at 75%
  const H = R.newWork(Object.assign({}, S, { genre: 'horror', grade: 'situazione' }), { seed: 4 }); let endingAsked = 0;
  const askH = async (k, p) => { if (k === 'finale') { endingAsked++; return { finale: 'FINALE-SCELTO' }; } if (k === 'piano') { const o = await ask(k, p); delete o.dossier; return o; } return ask(k, p); };
  await R.makePlan(H, askH); assert.strictEqual(H.plan.ending.text, ''); guard = 0; while (H.status !== 'ended' && guard++ < 10) await R.writeChapter(H, { ask: askH });
  assert.strictEqual(endingAsked, 1); assert.strictEqual(H.plan.ending.text, 'FINALE-SCELTO');
  // ---------- series ----------
  {
    const SER_END = 'FINALE-DELLA-SERIE-XYZ'; const sp = [];
    const askS = async (k, p, tier) => { sp.push({ k, p }); if (k === 'serie') return { domanda: 'Chi è il venditore?', finale: SER_END, passi: [{ volume: 1, fatto: 'il venditore lascia una firma' }, { volume: 2, fatto: 'la firma ricompare' }, { volume: 3, fatto: 'il venditore davanti al notaio' }] };
      if (k === 'eredita') return { riassunto: 'RIASSUNTO-VOL-1', fatti: ['FATTO-CANONE'], personaggi: [{ nome: 'Ada Ferri', vivo: true, stato: 'STATO-ADA', svelato: ['ha paura del buio'] }, { nome: 'Bruno Sala', vivo: false, stato: 'morto' }], promesse: ['PROMESSA-SERIE'], filo: 'a metà' };
      return ask(k, p, tier); };
    const md2 = md + '\n## Serie\nTitolo: La villa\nTipo: storia in più volumi\nVolumi: 3\nFilo: un venditore misterioso\n';
    const S2 = R.parseMd(md2); assert.deepStrictEqual([S2.series.title, S2.series.kind, S2.series.volumes, S2.series.thread], ['La villa', 'arco', 3, 'un venditore misterioso'], 'series section parsed');
    assert.strictEqual(R.parseMd(R.toMd(S2)).series.kind, 'arco', 'series round trip');
    let Ser = R.newSeries(S2); const V1 = R.newWork(S2, { seed: 10, series: Ser, visibility: 'complice' });
    assert.ok(await R.makePlan(V1, askS)); assert.strictEqual(sp.filter((x) => x.k === 'serie').length, 1, 'series plan once'); assert.ok(V1.series.plan.ending === SER_END);
    assert.ok(sp.find((x) => x.k === 'piano').p.includes('PASSO DI QUESTO VOLUME NELLA SERIE: il venditore lascia una firma'), 'volume plan knows its series step');
    const pv = R.planView(V1); assert.ok(pv.series && pv.series.question && !JSON.stringify(pv).includes(SER_END), 'complice sees the series question, not the series ending');
    let g = 0; while (V1.status !== 'ended' && g++ < 10) await R.writeChapter(V1, { ask: askS });
    sp.filter((x) => x.k === 'personaggi' || x.k === 'lettore').forEach((x) => assert.ok(!x.p.includes(SER_END) && !x.p.includes('venditore lascia'), 'characters and reader never see the series plan'));
    Ser.plan = V1.series.plan; Ser = await R.legacy(Ser, V1, askS); V1.status = 'ended';
    assert.strictEqual(Ser.books.length, 1); assert.ok(Ser.books[0].chapters.length >= 3 && Ser.books[0].summary === 'RIASSUNTO-VOL-1');
    assert.ok(Ser.bible.facts.some((f) => f.includes('FATTO-CANONE')) && Ser.bible.promises[0] === 'PROMESSA-SERIE');
    const nx = R.nextSetup(Ser); assert.ok(nx.seriesId === Ser.id && nx.genre === 'giallo' && !nx.characters.some((c) => c.name === 'Bruno Sala'), 'dead characters do not return');
    assert.ok(nx.characters.find((c) => c.name === 'Ada Ferri').short.includes('STATO-ADA'));
    assert.ok(nx.setting, 'a story in volumes keeps its setting'); assert.strictEqual(R.nextSetup(Object.assign({}, Ser, { kind: 'ciclo' })).setting, '', 'a cycle volume finds its own place');
    nx.idea = 'Un anno dopo, nella stessa villa, un altro ospite scompare durante la neve.';
    const V2 = R.newWork(nx, { seed: 11, series: Ser }); assert.strictEqual(V2.series.n, 2); sp.length = 0;
    assert.ok(await R.makePlan(V2, askS)); assert.ok(!sp.some((x) => x.k === 'serie'), 'no new series plan for volume 2');
    await R.writeChapter(V2, { ask: askS });
    const sc = sp.find((x) => x.k === 'scena').p; assert.ok(sc.includes('FATTO-CANONE') && sc.includes('RIASSUNTO-VOL-1') && sc.includes('la firma ricompare'), 'canon and step reach the scene');
    const chp = sp.find((x) => x.k === 'personaggi').p; assert.ok(!chp.includes(SER_END) && !chp.includes('FATTO-CANONE'), 'characters get only their own memory');
    assert.ok(R.estimate(30, { series: true }).total === R.estimate(30).total + 2);
  }
  // the setting reaches scene, writing and check, and the writer is told to orient the reader
  { const sp2 = []; const S3 = Object.assign({}, S, { setting: 'AMBIENTE-VILLA-1936' }); const O = R.newWork(S3, { seed: 21 }); await R.makePlan(O, ask); await R.writeChapter(O, { ask: async (k, p, t) => { sp2.push({ k, p }); return ask(k, p, t); } });
    ['scena', 'capitolo', 'controllo'].forEach((k) => assert.ok(sp2.find((x) => x.k === k).p.includes('AMBIENTE-VILLA-1936'), 'setting in ' + k)); assert.ok(sp2.find((x) => x.k === 'capitolo').p.includes('ORIENTA IL LETTORE') && sp2.find((x) => x.k === 'capitolo').p.includes('È il primo capitolo'));
    assert.ok(!sp2.find((x) => x.k === 'personaggi').p.includes('ORIENTA')); }
  // orientation pass: rewrites only the first paragraph, keeps the rest, skips chapters already fine
  { const chs = [{ title: 'A', text: 'Lia chiuse la porta.\n\nSecondo paragrafo intatto.', summary: 's1' }, { title: 'B', text: 'Già orientato sulla Luna.\n\nAltro.', summary: 's2' }];
    const res = await R.orientChapters(chs, { title: 'T', setting: 'Luna 2207' }, async (k, p) => (p.includes('PRIMO PARAGRAFO ATTUALE: <<<\nLia chiuse') ? { ok: false, primo_paragrafo: 'Nel Rifugio Est della miniera lunare, alle tre del mattino, Lia chiuse la porta.' } : { ok: true }));
    assert.strictEqual(res.changed, 1); assert.ok(res.chapters[0].text.startsWith('Nel Rifugio Est') && res.chapters[0].text.endsWith('Secondo paragrafo intatto.')); assert.strictEqual(res.chapters[1].text, chs[1].text); assert.ok(!chs[0].oriented, 'input untouched');
    const bad = await R.orientChapters(chs, {}, async () => ({ ok: false, primo_paragrafo: 'x' })); assert.strictEqual(bad.changed, 0, 'too short rewrites are refused'); }
  // the final stage reached early never ends the book mid-air: the next chapter is written as the closing one
  { const sp3 = []; const F2 = R.newWork(S, { seed: 31 }); const askF = async (k, p, t) => { sp3.push({ k, p }); const o = await ask(k, p, t); if (k === 'capitolo' && o) o.tappa_raggiunta = 't3'; return o; };
    await R.makePlan(F2, askF); F2.plan.stages.forEach((s, i) => { if (i < F2.plan.stages.length - 1) s.reached = 1; }); F2.chapters = []; let g3 = 0;
    // write up to 75% (chapter 3 of 4): the final stage is claimed there
    while (F2.status !== 'ended' && g3++ < 8) await R.writeChapter(F2, { ask: askF });
    const writes = sp3.filter((x) => x.k === 'capitolo'); const last = writes[writes.length - 1].p;
    assert.ok(last.includes("È L'ULTIMO CAPITOLO"), 'the book ends with a chapter written as the last one');
    assert.ok(sp3.filter((x) => x.k === 'controllo').pop().p.includes("(6) È L'ULTIMO CAPITOLO"), 'the editor checks the ending');
    assert.ok(F2.log.some((l) => l.text.includes('il prossimo capitolo la chiude')) || writes.length === F2.target, 'closing chapter announced or natural end'); }
  // estimate is sane for 25 pages
  const e = R.estimate(25); assert.ok(e.chapters === 9 && e.total > 30 && e.total < 90); console.log('estimate 25 pages:', JSON.stringify(e));
  console.log('calls', calls.n, JSON.stringify(calls.byKind)); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
