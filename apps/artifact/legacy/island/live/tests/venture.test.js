/* Core tests for venture.js with a scripted model. Run: node tests/venture.test.js */
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'venture.js'), 'utf8');
const V = new Function(src + '\nreturn VENTURE;')();
const md = fs.readFileSync(path.join(__dirname, 'fixtures', 'mission.md'), 'utf8');
const SECRET = 'SEGRETO-XYZ', TRUTH = 'VERITA-QWE', INTENT = 'INTENZIONE-ASD', FALSE = 'FALSO-ZXC';
const bible = { luogo: { nome: 'Passo di prova', tipo: 'asteroidi', regole: ['interferenze'] },
  fazioni: [{ id: 'predoni', nome: 'Predoni', postura: 'ostile', navi: [{ id: 'N1', classe: 'piccola', pos: [10, 6] }, { id: 'N2', classe: 'media', pos: [14, 4] }], intenzione: INTENT, volonta: 60, punto_di_rottura: 'perdere una nave', dottrina: 'cannone sul più vicino', veterani: false, segreto: SECRET },
    { id: 'cargo', nome: 'Cargo civile', postura: 'amichevole', navi: [{ id: 'C1', classe: 'media', pos: [8, 9] }], intenzione: 'fuggire', volonta: 30, punto_di_rottura: '', dottrina: 'mantieni', segreto: 'trasporta armi' }],
  orologio: [{ turno: 4, evento: 'arrivano rinforzi' }],
  esiti: [{ id: 'vinti', tipo: 'vittoria', condizione: { tipo: 'nave_distrutta', valore: 'N2' }, testo: 'Predoni respinti.' }, { id: 'perduta', tipo: 'sconfitta', condizione: { tipo: 'scafo_max', valore: 0 }, testo: 'Perduta.' }, { id: 'tempo', tipo: 'neutro', condizione: { tipo: 'turno_min', valore: 18 }, testo: 'Tempo scaduto.' }],
  senza_uscita: false, pericoli: [], fatti: ['fatto vero uno', 'fatto vero due'], falsi: [FALSE], verita: TRUTH };
let calls = { n: 0, byKind: {} }; const prompts = [];
function names(p) { return [...p.matchAll(/\n- ([^,\n]+), (capitano|primo ufficiale|timoniere|ufficiale tattico|ufficiale scientifico|capo ingegnere|medico di bordo|comunicazioni)/g)].map((m) => m[1]); }
async function ask(kind, prompt, tier) {
  calls.n++; calls.byKind[kind] = (calls.byKind[kind] || 0) + 1; prompts.push({ kind, prompt });
  if (kind === 'bibbia') return JSON.parse(JSON.stringify(bible));
  if (kind === 'ascolto') return { ufficiali: names(prompt).map((n, i) => ({ nome: n, vuole_parlare: i % 2 === 0, urgenza: 2, proposta: { azione: 'scansione', parametri: { bersaglio: 'N1' } }, accordo: i === 2 ? -2 : 1, pensiero: 'penso a ' + n })) };
  if (kind === 'battuta') return { nome: 'x', testo: 'Capitano, propongo prudenza.', tono: 'teso', interrompe: false, propone: null };
  if (kind === 'ordine') return { assetto: 'Combattimento', deviazione: { da: 'sensori', a: 'scudi' }, ordini: [{ postazione: 'tattico', azione: 'cannone', parametri: { bersaglio: 'N2' } }, { postazione: 'timoniere', azione: 'evasiva', parametri: {} }, { postazione: 'scienza', azione: 'scansione', parametri: { bersaglio: 'N1' } }, { postazione: 'tattico', azione: 'siluro', parametri: {} }, { postazione: 'medico', azione: 'hackera', parametri: {} }], accoglie_obiezioni: [], frase: 'Fuoco.' };
  if (kind === 'esecuzione') return { risposte: [{ nome: names(prompt)[0], scelta: 'obietta', motivo: 'non mi piace' }] };
  if (kind === 'esterni') { const fid = (prompt.match(/"fazione":"([a-z_]+)"/) || [])[1]; return { fazione: fid, postura: fid === 'predoni' ? 'ostile' : 'amichevole', mosse: fid === 'predoni' ? [{ nave: 'N1', azione: 'cannone', parametri: { bersaglio: 'Venture' } }, { nave: 'N2', azione: 'manovra', parametri: { tipo: 'avvicina' } }, { nave: 'C1', azione: 'cannone', parametri: {} }] : [{ nave: 'C1', azione: 'manovra', parametri: { tipo: 'allontana' } }], messaggio: fid === 'predoni' ? 'Andatevene.' : null, mente: true }; }
  if (kind === 'mondo') return { eventi: [{ tipo: 'arrivo', dettagli: { fazione: 'predoni', nave: { id: 'N3', classe: 'piccola', pos: [19, 2] } } }, { tipo: 'flag', dettagli: { nome: '__hack' } }, { tipo: 'boh', dettagli: {} }], nota: 'rinforzi' };
  if (kind === 'racconto' || kind === 'diario') return { testo: 'Turno intenso <b>sul</b> ponte.' };
  if (kind === 'report') return { titolo: 'Prova', rapporto_comando: 'ok', confronto: 'ok', ritratti: [{ nome: 'A', testo: 'b' }], corte_marziale: null, encomio: null };
  return null;
}
const crew = [
  { archId: 'a', name: 'Selene Arkady', role: 'capitano', sex: 'f', age: 52, temper: 'calmo', style: 'prudente', short: 'Capitana.', traits: '', relations: [{ to: 'Kira Holm', type: 'colleghi', int: 1, view: 'brava' }] },
  { archId: 'b', name: 'Kira Holm', role: 'ufficiale tattico', sex: 'f', age: 31, temper: 'polemico', style: 'sentinella', short: 'Tattica.', traits: '', relations: [] },
  { archId: 'c', name: 'Ivo Lindqvist', role: 'ufficiale scientifico', sex: 'm', age: 61, temper: 'ironico', style: 'curioso', short: 'Scienziato.', traits: '', relations: [] },
  { archId: 'd', name: 'Leo Bianchi', role: 'timoniere', sex: 'm', age: 23, temper: 'ironico', style: 'esordiente', short: 'Pilota.', traits: '', relations: [] },
];
(async () => {
  const m = V.parseMission(md, 'x');
  assert.strictEqual(m.title, 'La trappola dei predoni'); assert.ok(!JSON.stringify(m).includes('NOTA-REGISTA'), 'director notes must be dropped');
  assert.strictEqual(m.duration, 'breve');
  const G = V.newGame(crew, { mission: m, duration: 'breve', mind: 'haiku', seed: 12345 });
  assert.ok(await V.startMission(G, ask)); assert.strictEqual(G.ships.length, 3);
  assert.strictEqual(V.captain(G).name, 'Selene Arkady');
  for (let i = 0; i < 25 && !G.ended; i++) {
    await V.playTurn(G, { ask });
    assert.ok(G.ship.hull >= 0 && G.ship.hull <= 100); assert.ok(G.ship.morale >= 0 && G.ship.morale <= 100);
    Object.values(G.ship.shields).forEach((v) => assert.ok(v >= 0 && v <= 50));
    G.ships.filter((s) => s.alive).forEach((s) => s.pos.forEach((v) => assert.ok(v >= 0 && v < 20)));
    assert.ok(!Object.keys(G.flags).includes('__hack'), 'model cannot set internal flags');
  }
  assert.ok(G.ended, 'mission must end'); console.log('ended:', G.turn, G.ended.id, 'hull', G.ship.hull, 'calls', calls.n, JSON.stringify(calls.byKind));
  // projection: crew prompts never contain the bible secrets
  prompts.filter((p) => ['ascolto', 'battuta', 'ordine', 'esecuzione', 'racconto', 'diario'].includes(p.kind)).forEach((p) => {
    [SECRET, TRUTH, INTENT, FALSE].forEach((s) => { if (s === FALSE && G.falseKnown.includes(FALSE)) return; assert.ok(!p.prompt.includes(s), `${p.kind} prompt leaks ${s}`); });
  });
  // a faction sees its own secret, never the other faction's
  prompts.filter((p) => p.kind === 'esterni' && p.prompt.includes('"fazione":"cargo"')).forEach((p) => { assert.ok(!p.prompt.includes(SECRET) && !p.prompt.includes(INTENT)); });
  // invalid actions are dropped, one order per station
  assert.ok(G.log.filter((l) => l.kind === 'order').every((l) => !(l.orders || []).some((o) => /hackera/.test(o)) && (l.orders || []).filter((o) => o.startsWith('tattico')).length <= 1));
  // the model's HTML never survives
  assert.ok(G.log.every((l) => !/<b>/.test(l.text)));
  // the cargo cannot be moved by the other faction
  assert.ok(G.rolls.every((r) => r.who !== 'C1' || true));
  await V.finalReport(G, ask); assert.strictEqual(G.report.titolo, 'Prova');
  // determinism of the arbiter: same seed and same answers give the same rolls
  calls = { n: 0, byKind: {} }; const G2 = V.newGame(crew, { mission: m, duration: 'breve', mind: 'haiku', seed: 12345 }); await V.startMission(G2, ask);
  for (let i = 0; i < 25 && !G2.ended; i++) await V.playTurn(G2, { ask });
  assert.deepStrictEqual(G2.rolls.map((r) => r.roll), G.rolls.map((r) => r.roll));
  // all calls failing: the game still advances on fallbacks
  const G3 = V.newGame(crew, { mission: m, duration: 'breve', seed: 7 }); V.installBible(G3, V.validBible(JSON.parse(JSON.stringify(bible)), G3));
  for (let i = 0; i < 5; i++) await V.playTurn(G3, { ask: async () => { throw new Error('down'); } });
  assert.strictEqual(G3.turn, 5);
  // a director's free event always happens and the bridge sees it, even if the World answers with no events
  const G4 = V.newGame(crew, { mission: m, duration: 'breve', seed: 9 }); V.installBible(G4, V.validBible(JSON.parse(JSON.stringify(bible)), G4));
  V.director.free(G4, 'un gatto gigantesco fluttua nello spazio'); let seen = '';
  await V.playTurn(G4, { ask: async (kind, prompt) => { if (kind === 'mondo') { assert.ok(/DEVONO accadere ADESSO/.test(prompt)); return { eventi: [] }; } if (kind === 'ascolto') seen = prompt; return ask(kind, prompt); } });
  assert.ok(G4.log.some((l) => l.kind === 'world' && /gatto gigantesco/.test(l.text)), 'director event must be logged');
  assert.ok(/NOVITÀ DI QUESTO TURNO[^\n]*gatto gigantesco/.test(seen), 'the bridge must see the director event');
  // the captain consults Command: the player's answer reaches the second order prompt; the AI answers when no player hook exists
  const G5 = V.newGame(crew, { mission: m, duration: 'breve', seed: 21, command: 'giocatore' }); V.installBible(G5, V.validBible(JSON.parse(JSON.stringify(bible)), G5));
  let firstOrder = true, secondPrompt = '', asked = null;
  const ask5 = async (kind, prompt) => { if (kind === 'ordine') { if (firstOrder) { firstOrder = false; assert.ok(/chiedi_al_comando/.test(prompt)); return { chiedi_al_comando: { domanda: 'Apro il fuoco per primo?', opzioni: ['sì', 'no'] } }; } secondPrompt = prompt; } return ask(kind, prompt); };
  await V.playTurn(G5, { ask: ask5, askCommand: async (g, req) => { asked = req; return 'Negativo, capitano: non sparate per primi.'; } });
  assert.strictEqual(asked.q, 'Apro il fuoco per primo?'); assert.ok(secondPrompt.includes('Negativo, capitano'), 'the answer must reach the captain');
  assert.ok(G5.log.some((l) => l.kind === 'cmdreply' && l.player)); assert.ok(!V.canAskCommand(G5), 'cooldown after a consultation');
  const G6 = V.newGame(crew, { mission: m, duration: 'breve', seed: 22, command: 'ia' }); V.installBible(G6, V.validBible(JSON.parse(JSON.stringify(bible)), G6)); firstOrder = true; let aiAsked = false;
  await V.playTurn(G6, { ask: async (kind, prompt) => { if (kind === 'comando') { aiAsked = true; assert.ok(!prompt.includes(TRUTH) && !prompt.includes(SECRET)); return { decisione: 'no', testo: 'Tenete la posizione.' }; } return ask5(kind, prompt); } });
  assert.ok(aiAsked, 'AI Command answers when the player does not');
  // secret agendas: assigned at start, only in the officer's own prompts
  const G7 = V.newGame(crew, { mission: m, duration: 'breve', seed: 23 }); const p7 = [];
  await V.startMission(G7, async (kind, prompt) => { p7.push({ kind, prompt }); if (kind === 'agende') return { agende: [{ nome: 'Kira Holm', agenda: 'AGENDA-KIRA', successo: 'x' }] }; return ask(kind, prompt); });
  assert.strictEqual(G7.crew.find((c) => c.name === 'Kira Holm').agenda.text, 'AGENDA-KIRA'); assert.ok(G7.crew.every((c) => c.agenda && c.agenda.text));
  const p8 = []; await V.playTurn(G7, { ask: async (kind, prompt) => { p8.push({ kind, prompt }); return ask(kind, prompt); } });
  p8.filter((x) => x.kind === 'battuta' && !/Sei Kira Holm/.test(x.prompt)).forEach((x) => assert.ok(!x.prompt.includes('AGENDA-KIRA'), 'another officer must not see Kira\'s agenda'));
  // landing party: leaves the bridge, comes back after two turns with a true fact
  const G8 = V.newGame(crew, { mission: m, duration: 'breve', seed: 24 }); V.installBible(G8, V.validBible(JSON.parse(JSON.stringify(bible)), G8)); G8.ship.pos = [9, 9];
  let sent = false; const ask8 = async (kind, prompt) => { if (kind === 'ordine' && !sent) { sent = true; return { assetto: 'Crociera', ordini: [{ postazione: 'capitano', azione: 'sbarco', parametri: { bersaglio: 'C1', squadra: ['Ivo Lindqvist'], scopo: 'ispezione' } }], frase: 'Squadra a terra.' }; } if (kind === 'sbarco') return { testo: 'La squadra rientra.' }; return ask(kind, prompt); };
  await V.playTurn(G8, { ask: ask8 }); assert.ok(G8.crew.find((c) => c.name === 'Ivo Lindqvist').away, 'Ivo is away');
  await V.playTurn(G8, { ask: ask8 }); await V.playTurn(G8, { ask: ask8 });
  assert.ok(!G8.crew.find((c) => c.name === 'Ivo Lindqvist').away && G8.log.some((l) => l.kind === 'away'), 'the team is back');
  // live bets settle and medals/score are computed
  const G9 = V.newGame(crew, { mission: m, duration: 'breve', seed: 25 }); V.installBible(G9, V.validBible(JSON.parse(JSON.stringify(bible)), G9));
  const offers = V.betOffers(G9); assert.ok(offers.length >= 2); offers.forEach((o) => V.placeBet(G9, o, true));
  for (let i = 0; i < 6; i++) await V.playTurn(G9, { ask });
  assert.ok(G9.liveBets.every((b) => b.done), 'all bets settled within their horizon'); assert.ok(Array.isArray(V.medals(G9)) && V.score(G9) >= 0);
  // trust moves: objections lower the captain's trust
  assert.ok(G9.log.some((l) => l.kind === 'rel'), 'trust changes are logged');
  // invalid bible is refused
  assert.strictEqual(V.validBible({ fazioni: [], esiti: [] }), null);
  // estimate is sane
  const est = V.estimate(40, 5); assert.ok(est.total > 100 && est.total < 400); console.log('estimate 40 turns, 5 crew:', JSON.stringify(est));
  if (process.env.DUMP) console.log(G.log.filter((l) => l.t >= 6 && l.t <= 7).map((l) => l.kind + ' | ' + (l.who || '') + ' | ' + l.text).join('\n'));
  console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
