/* ---------- fun: names, gestures, habits, illustrated diary, pets, spectacles, replay track ---------- */
// everything here only reacts to what the characters freely decide; nothing scripts their behaviour
const GESTURES = [
  [/rid|ridacch|sghignazz/, 'ride', '😄', 'laugh'], [/piang|lacrim|singhiozz/, 'piange', '😢', 'cry'], [/gratt|perpless|dubbi/, 'si gratta la testa', '🤔', 'scratch'],
  [/ball|danz/, 'balla', '💃', 'dance'], [/salt|esult/, 'salta di gioia', '🎉', 'jump'], [/pugn|rabbi|urla|impreca/, 'alza i pugni', '😠', 'fists'],
  [/sospir|sconsol|abbatt|dispera/, 'sospira', '😮‍💨', 'slump'], [/spall/, 'scrolla le spalle', '🤷', 'shrug'], [/applaud|batte le mani/, 'applaude', '👏', 'clap'], [/salut|sbracci/, 'saluta', '👋', 'wave'],
];
function funGesture(a, g) {
  const s = String(g || '').toLowerCase(); if (!s || s === 'null') return;
  const m = GESTURES.find((x) => x[0].test(s)); if (!m) return;
  a.gesture = { text: m[1], emoji: m[2], anim: m[3], n: (a.gesture ? a.gesture.n : 0) + 1, day: G.day, h: G.h };
}
const MOODS = [[/felic|gioi|content|allegr|euforic/, '😊'], [/speran|fiduc|ottimis/, '🙂'], [/sollievo|sollev/, '😌'], [/calm|seren|pace/, '😌'], [/curios|stupor|meravigl/, '🧐'], [/orgogli|soddisf|fier/, '😤'],
  [/trist|malincon|nostalg/, '😔'], [/sol[oa]\b|abbandon|isolat/, '🥺'], [/paur|terror|spavent/, '😨'], [/ansi|preoccup|agit|inquiet/, '😟'], [/rabbi|furi|irrit|frustr/, '😠'], [/dispera|sconfort|vuot/, '😩'], [/stanc|esaust|sfinit|sonno/, '😴'], [/confus|smarr/, '😵‍💫'], [/fame/, '🤤'], [/sete/, '🥵']];
function moodEmoji(a) { const e = String(a.emotion || '').toLowerCase(); const m = MOODS.find((x) => x[0].test(e)); return m ? m[1] : ''; }

/* names the characters give to places, animals and things */
function animalKeyOf(text) {
  const t = String(text || '').toLowerCase(); if (!t) return null; const W = G.world;
  if (W.dog && /cane|cagnol|randagio/.test(t)) return 'cane';
  const c = W.custom.find((x) => x.animal && (t.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(t)));
  if (c) return c.name.toLowerCase();
  if (/gabbian/.test(t)) return 'gabbiani'; if (/pellican/.test(t)) return 'pellicano'; if (/granch/.test(t) && W.crabs) return 'granchi'; if (/squal/.test(t) && W.shark) return 'squalo';
  return null;
}
function funName(a, n) {
  if (!n || typeof n !== 'object') return; const W = G.world;
  const name = String(n.nome || '').trim().replace(/^["«']|["»']$/g, '').slice(0, 40); const what = String(n.cosa || '').trim().slice(0, 60); if (name.length < 2 || !what) return;
  W.names = W.names || []; if (W.names.some((x) => x.name.toLowerCase() === name.toLowerCase())) return;
  const lc = what.toLowerCase(); const e = { name, what, by: a.name, day: G.day, place: null, animal: null, obj: null, loc: null };
  e.animal = animalKeyOf(lc);
  if (!e.animal) { const o = W.custom.find((x) => !x.animal && x.name && (lc.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(lc))); if (o) { e.obj = o.id; e.loc = o.loc.slice(); } }
  const placeish = /spiaggi|baia|cala|scogl|collin|altur|promontor|falesi|laguna|palud|forest|bosc|radur|sorgent|ruscell|riva|costa|punta|grotta|insenatur|isola|posto|luogo|campo|accampament|riparo|capanno|baracca|qui\b|zona|sentiero|valle|stagno|pozza/.test(lc);
  if (!e.animal && !e.obj && !placeish) { // a thing that isn't on the map (a coconut friend, a tool, the sea...): remembered, not pinned to a place
    e.thing = true; if (G.world.buddy && lc.includes(G.world.buddy.what)) e.buddy = true;
  }
  if (!e.animal && !e.obj && !e.thing) {
    const pk = Object.keys(PLACES).find((k) => lc.includes(k.replace(/_/g, ' ')) || lc === k) || (/\b(qui|questo posto|questo luogo|dove sono)\b/.test(lc) ? placeOf(a.pos).name : null)
      || Object.keys(PLACES).find((k) => PLACES[k].desc && lc.split(/\s+/).filter((w) => w.length > 4).some((w) => PLACES[k].desc.toLowerCase().includes(w))) || placeOf(a.pos).name;
    e.place = pk; e.loc = PLACES[pk].loc.slice();
  }
  W.names = W.names.filter((x) => !((e.place && x.place === e.place) || (e.animal && x.animal === e.animal) || (e.obj && x.obj === e.obj) || (e.thing && x.thing && x.what.toLowerCase() === lc)));
  W.names.push(e); if (W.names.length > 30) W.names.shift();
  chron(`🏷️ ${a.name} chiama ${what} «${name}».`, 'event');
  alive().forEach((o) => { if (o !== a && !o.asleep && dist(o.pos, a.pos) < 8) remember(o, `${a.name} chiama ${what} «${name}»`); });
}
function fixNames() { const W = G.world; (W.names || []).forEach((n) => { if (n.place && !/spiaggi|baia|cala|scogl|collin|altur|promontor|falesi|laguna|palud|forest|bosc|radur|sorgent|ruscell|riva|costa|punta|grotta|insenatur|isola|posto|luogo|campo|accampament|riparo|capanno|baracca|qui\b|zona|sentiero|valle|stagno|pozza/.test(String(n.what).toLowerCase()) && !Object.keys(PLACES).some((k) => String(n.what).toLowerCase().includes(k.replace(/_/g, ' ')))) { n.place = null; n.loc = null; n.thing = true; } }); }
function nameOfPlace(k) { const n = (G.world.names || []).find((x) => x.place === k); return n ? n.name : null; }
function nameOfAnimal(k) { const n = (G.world.names || []).find((x) => x.animal === k); return n ? n.name : null; }

/* habits and small rituals: the character notices them himself; some leave visible traces */
function funHabit(a, h) {
  const s = String(h || '').trim(); if (s.length < 4 || /^null$/i.test(s)) return; a.habits = a.habits || [];
  const key = s.toLowerCase().slice(0, 18); if (a.habits.some((x) => x.text.toLowerCase().slice(0, 18) === key)) return;
  a.habits.push({ text: s.slice(0, 120), day: G.day }); if (a.habits.length > 6) a.habits.shift();
  chron(`🔁 ${a.name} si accorge di un'abitudine: ${s.slice(0, 120)}`, 'event');
  const W = G.world; const l = s.toLowerCase();
  if (/tacc|segn.*giorn|cont.*giorn|incid.*giorn|calendario/.test(l) && !W.tally) W.tally = { by: a.name, start: G.day };
  if (/(sass|pietr|ciottol|conchigl)/.test(l) && /(torr|pil|impil|scult|cumul|ometto|cerchi|spiral|disegn|allin)/.test(l)) W.cairns = Math.max(W.cairns || 0, 1);
  if (/(parl|confid|racconta).*(cocco|pallone|sasso|conchigl|bambol|palla|ramo)|faccia.*(cocco|sasso|palla)|amico immaginario/.test(l) && !W.buddy) W.buddy = { by: a.name, what: (l.match(/cocco|pallone|sasso|conchiglia|bambola|palla|ramo/) || ['cocco'])[0] };
}

/* illustrated diary: at night, a short page and a clumsy pencil sketch (light model, optional) */
const SVG_TAGS = new Set(['svg', 'g', 'path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'rect', 'text']);
function cleanSvg(s) {
  s = String(s || '').trim(); if (!/^<svg[\s>]/i.test(s) || s.length > 7000) return null;
  if (/<script|<style|\bon[a-z]+\s*=|href|javascript:|url\(|<!|<\?|&#/i.test(s)) return null;
  const tags = s.match(/<\/?\s*([a-zA-Z]+)/g) || []; if (tags.some((t) => !SVG_TAGS.has(t.replace(/[<\/\s]/g, '').toLowerCase()))) return null;
  if (!/xmlns=/.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return s;
}
async function funSketch(a, text) {
  if (G.diaryArt === false) return; G.diary = G.diary || [];
  if (G.diary.some((d) => d.day === G.day && d.agent === a.name)) return;
  const entry = { day: G.day, agent: a.name, text: String(text).slice(0, 300), svg: null, caption: '' }; G.diary.push(entry); if (G.diary.length > 150) G.diary.shift();
  if (!SAMPLE || G.economy) return;
  try {
    const out = await ask('schizzo', `Sei ${a.name}, naufrago su un'isola deserta. Stasera nel tuo taccuino hai scritto: «${entry.text}». Accanto fai un piccolo schizzo a matita, semplice e un po' goffo, come lo farebbe una persona qualunque con un pezzo di carbone: una sola scena o un oggetto di oggi.
Rispondi SOLO con JSON: {"didascalia":"2-6 parole scritte a mano sotto il disegno","svg":"<svg viewBox='0 0 240 160'>…</svg>"}
Nello svg usa solo path, line, polyline, polygon, circle, ellipse, rect; stroke scuro (#2b2b2b o #555), stroke-width 1-3, fill="none" (al massimo qualche tratteggio grigio chiaro), al massimo 30 elementi, niente testo, niente colori vivaci.`, 'quick');
    entry.svg = cleanSvg(out && out.svg); entry.caption = String((out && out.didascalia) || '').slice(0, 60); save(); emit('onChange');
  } catch (e) {}
}

/* pets: gentle, repeated contact with an animal can turn it into a companion */
function funActionDone(a, c) {
  a.actLog = a.actLog || []; a.actLog.push({ t: T(), type: c.type, p: c.p && (c.p.animale || c.p.cosa || c.p.luogo || '') }); if (a.actLog.length > 60) a.actLog.shift();
  if (c.type !== 'interagisci_animale') return;
  const how = `${(c.p && c.p.come) || ''}`.toLowerCase(); const key = animalKeyOf((c.p && c.p.animale) || how); if (!key || ['squalo', 'gabbiani', 'granchi'].includes(key)) return;
  if (/caccia|uccid|colpi|ammazz|scanna|catturarl[oa] per mangiar|cucinarl|lancia(re)? (una )?pietr|spavent|scaccia/.test(how)) { const W = G.world; if (W.bonds && W.bonds[key]) W.bonds[key][a.name] = 0; return; }
  if (!/accarezz|nutr|da(?:'|à)? da mangiare|offr|gioc|chiam|avvicin|coccol|parl|lanci.*(bastone|palla|legnet)|addomestic|fischi|calm|tranquillizz|lascia.*(cibo|pesce|avanz)|condivid|tende la mano/.test(how)) return;
  const W = G.world; W.bonds = W.bonds || {}; W.bonds[key] = W.bonds[key] || {};
  W.bonds[key][a.name] = (W.bonds[key][a.name] || 0) + (/nutr|mangiar|cibo|pesce|avanz|offr|condivid/.test(how) ? 2 : 1);
  W.pets = W.pets || {};
  if (W.bonds[key][a.name] >= 3 && !W.pets[key]) {
    W.pets[key] = { owner: a.name, since: G.day };
    const lbl = nameOfAnimal(key) ? `${key} «${nameOfAnimal(key)}»` : `il ${key}`;
    chron(`🐾 ${lbl[0].toUpperCase() + lbl.slice(1)} si è affezionato a ${a.name}: da ora lo segue.`, 'event');
    a.stats.umore = clamp(a.stats.umore + 8); a.stats.mente = clamp(a.stats.mente + 5);
    remember(a, `${lbl} ormai ti segue e si lascia avvicinare: si è affezionato a te`);
  } else if (!W.pets[key]) remember(a, `${key === 'cane' ? 'il cane' : key} sembra un po' meno diffidente con te`);
}
function petsHour() {
  const W = G.world; if (!W.pets) return;
  Object.entries(W.pets).forEach(([k, p]) => {
    const exists = k === 'cane' ? W.dog : W.custom.some((c) => c.animal && c.name.toLowerCase() === k);
    if (!exists) { chron(`🐾 ${p.owner} ha perso il suo compagno: ${nameOfAnimal(k) || k}.`, 'event'); const o = byName(p.owner); if (o && o.alive) { o.stats.umore = clamp(o.stats.umore - 12); remember(o, `${nameOfAnimal(k) || k} non c'è più`); } delete W.pets[k]; return; }
    const o = byName(p.owner); W.animalAct = W.animalAct || {};
    if (!o || !o.alive || o.departed) { if (!p.mourned) { p.mourned = true; chron(`🐾 ${nameOfAnimal(k) || 'Il ' + k} resta accanto al posto di ${p.owner} e non se ne va.`, 'event'); } W.animalAct[k] = { kind: 'osserva', text: 'aspetta il suo padrone', luogo: null, chi: null, until: T() + 1.2 }; return; }
    const cur = W.animalAct[k]; if (cur && ['attacca', 'scappa'].includes(cur.kind) && cur.until > T()) return;
    W.animalAct[k] = { kind: o.asleep ? 'dorme' : 'segue', text: o.asleep ? `dorme accanto a ${o.name}` : `segue ${o.name}`, luogo: null, chi: o.name, until: T() + 1.2 };
    if (!o.asleep) { o.stats.mente = clamp(o.stats.mente + 0.25); o.stats.umore = clamp(o.stats.umore + 0.3); }
  });
}

/* rare natural spectacles the characters may notice */
const SPECT = {
  arcobaleno: ['🌈', 'dopo la pioggia, un arcobaleno enorme si apre sul mare', 1.2],
  balene: ['🐋', 'al largo affiorano delle balene: si vedono gli spruzzi e una coda che si alza', 1.0],
  stelle: ['🌠', 'il cielo è pieno di stelle cadenti', 1.5],
  lucciole: ['✨', 'tra gli alberi si accendono centinaia di lucciole', 3.0],
  plancton: ['💙', 'le onde sulla riva si illuminano di azzurro: il mare brilla a ogni passo', 2.0],
};
function startSpect(kind) {
  const W = G.world; const s = SPECT[kind]; W.spect = { kind, from: T(), until: T() + s[2] };
  chron(`${s[0]} ${s[1][0].toUpperCase() + s[1].slice(1)}.`, 'event');
  alive().forEach((a) => { if (a.asleep) return; remember(a, `vedi: ${s[1]}`); a.stats.umore = clamp(a.stats.umore + 4); a.stats.mente = clamp(a.stats.mente + 2); });
}
function spectHour(w) {
  const W = G.world; const h = G.h % 24; const clear = w.rain < 0.05 && !w.storm && (w.cloud == null || w.cloud < 0.5);
  if (W.spect && W.spect.until > T()) { G.prevRain = w.rain; return; }
  if (h > 7.5 && h < 17.5 && (G.prevRain || 0) > 0.3 && w.rain < 0.1 && Math.random() < 0.6) startSpect('arcobaleno');
  else if (h > 7 && h < 18 && !w.storm && Math.random() < 0.02) startSpect('balene');
  else if ((h > 21 || h < 4) && clear && moonLight() < 0.4 && Math.random() < 0.03) startSpect('stelle');
  else if (Math.floor(h) === 20 && w.rain < 0.1 && Math.random() < 0.3) startSpect('lucciole');
  else if ((h > 21 || h < 3) && w.waves < 0.5 && Math.random() < 0.015) startSpect('plancton');
  G.prevRain = w.rain;
}

/* encounters: on a small island people keep running into each other; each meeting is a moment to decide how to behave */
function encounters() {
  suppliesTick(); circleJoinTick();
  const al = alive().filter((a) => !a.departed); if (al.length < 2) return; G.meet = G.meet || {};
  for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) {
    const a = al[i], b = al[j]; const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id; const m = G.meet[k] || (G.meet[k] = { near: false, t: -99 });
    const d = dist(a.pos, b.pos); const nowNear = d < 5;
    if (nowNear && !m.near && T() - m.t > (G.forced ? 1.5 : 4) && !a.asleep && !b.asleep && !a.thinking && !b.thinking) {
      m.t = T(); socialPush('incontro', `${a.name} e ${b.name} si incrociano (${a.name} ${actionWords(a)}, ${b.name} ${actionWords(b)})`, [a.name, b.name]);
      [[a, b], [b, a]].forEach(([x, y]) => { if (x.cur && ['parla', 'dormi'].includes(x.cur.type)) return; interrupt(x, `incroci ${descrOf(x, y)}, che ${actionWords(y)}`); });
    }
    m.near = d < 7 ? (m.near || nowNear) : false;
  }
}
/* island-wide interventions: new food and water sources, seen by everyone at once or left to be discovered */
const SUPPLY = {
  sorgente: { name: 'sorgente perenne', desc: 'acqua limpida e fresca che sgorga tra le rocce in una vasca naturale: non si secca mai', use: 'bere e riempire la bottiglia: l\'acqua non finisce mai', kind: 'acqua', amount: 999, perenne: true, emoji: '💧',
    parts: [{ f: 'cil', d: [0.9, 0.25], p: [0, 0.12, 0], c: '#8f8a80' }, { f: 'cil', d: [0.75, 0.04], p: [0, 0.24, 0], c: '#4fb3e8' }, { f: 'sfera', d: [0.35], p: [-0.6, 0.35, -0.5], c: '#7d776d' }, { f: 'sfera', d: [0.28], p: [0.7, 0.3, -0.3], c: '#9a948a' }, { f: 'cil', d: [0.05, 0.5], p: [-0.45, 0.45, -0.35], r: [0, 0, 40], c: '#8fd0f5' }] },
  cisterna: { name: 'cisterna di acqua piovana', desc: 'un vecchio bidone di metallo pieno di acqua piovana, con un coperchio: si riempie ogni volta che piove', use: 'bere e riempire la bottiglia; si riempie con la pioggia', kind: 'acqua', amount: 40, regen: 0, rain: true, emoji: '🛢',
    parts: [{ f: 'cil', d: [0.35, 0.9], p: [0, 0.45, 0], c: '#6a7a80' }, { f: 'cil', d: [0.37, 0.04], p: [0, 0.91, 0], c: '#55656a' }, { f: 'cil', d: [0.37, 0.03], p: [0, 0.3, 0], c: '#4a585c' }] },
  frutteto: { name: 'albero carico di frutti', desc: 'un albero basso e largo carico di frutti gialli e arancioni, profumati e maturi', use: 'raccogliere e mangiare i frutti: ne maturano di nuovi ogni giorno', kind: 'cibo', amount: 14, regen: 3, max: 14, emoji: '🍊',
    parts: [{ f: 'cil', d: [0.12, 1.4], p: [0, 0.7, 0], c: '#6b4a2b' }, { f: 'sfera', d: [1.0], p: [0, 1.8, 0], c: '#3f8a3a' }, { f: 'sfera', d: [0.7], p: [0.6, 1.5, 0.2], c: '#4a9a42' }, { f: 'sfera', d: [0.1], p: [0.5, 1.4, 0.7], c: '#f39c12' }, { f: 'sfera', d: [0.1], p: [-0.6, 1.5, 0.5], c: '#f1c40f' }, { f: 'sfera', d: [0.1], p: [0.2, 1.2, -0.8], c: '#e67e22' }, { f: 'sfera', d: [0.1], p: [-0.3, 2.2, 0.6], c: '#f39c12' }] },
  fuoco: { name: 'fuoco perenne', desc: 'un fuoco che arde da solo tra le pietre, giorno e notte, senza bisogno di legna e senza spegnersi con la pioggia', use: 'scaldarsi, asciugarsi, cucinare il cibo che hai, fare luce: non si spegne mai', kind: 'fuoco', amount: 999, perenne: true, emoji: '🔥',
    parts: [{ f: 'cil', d: [0.75, 0.18], p: [0, 0.09, 0], c: '#7d776d' }, { f: 'cil', d: [0.55, 0.05], p: [0, 0.16, 0], c: '#2b2420' }, { f: 'cono', d: [0.32, 0.9], p: [0, 0.6, 0], c: '#ff8a1e' }, { f: 'cono', d: [0.2, 0.7], p: [0.15, 0.5, 0.08], c: '#ffc23a' }, { f: 'cono', d: [0.18, 0.6], p: [-0.14, 0.45, -0.06], c: '#ff5a1a' }] },
  viveri: { name: 'cassa di viveri', desc: 'una cassa di legno con scritte sbiadite: dentro scatolette di carne e fagioli, gallette, sacchetti sigillati', use: 'aprirla e mangiare: le provviste finiscono', kind: 'cibo', amount: 30, emoji: '📦',
    parts: [{ f: 'box', d: [0.9, 0.55, 0.6], p: [0, 0.28, 0], c: '#a07a4a' }, { f: 'box', d: [0.92, 0.04, 0.62], p: [0, 0.57, 0], c: '#7d5c34' }, { f: 'box', d: [0.92, 0.06, 0.04], p: [0, 0.3, 0.31], c: '#5a4228' }] },
};
function addResource(op) {
  const W = G.world; const def = SUPPLY[String(op.cosa || '').toLowerCase()]; if (!def) return null;
  const n = Math.max(1, Math.min(6, Number(op.quante) || 1)); if (n > 1) { const out = []; for (let i = 0; i < n; i++) out.push(addResource(Object.assign({}, op, { quante: 1, luogo: op.luogo || '' }))); return out.filter(Boolean).join('; '); }
  if (def.kind === 'fuoco' && op.luogo === 'fuoco') { W.fireEternal = true; W.fireUntil = Math.max(W.fireUntil, T() + 3); W.fireEverLit = true; const all0 = op.visibile !== false; if (all0) alive().forEach((a) => remember(a, 'il fuoco del campo arde da solo e non si spegne più, nemmeno senza legna')); chron('🔥 Il fuoco del campo ora arde da solo e non si spegne mai.', 'god'); return 'il fuoco del campo diventa perenne'; }
  let place = PLACES[op.luogo] ? op.luogo : null; if (!place) { const ks = Object.keys(PLACES).filter((k) => !['mare', 'scogli'].includes(k)); place = ks[Math.floor(Math.random() * ks.length)]; }
  const L = PLACES[place].loc; const loc = [L[0] + (Math.random() - 0.5) * 3, L[1] + (Math.random() - 0.5) * 3];
  const all = op.visibile !== false && op.visibile !== 'scoprire';
  const c = { name: def.name, desc: def.desc, use: def.use, loc, id: G.nextId++, portable: false, parts: def.parts, completed: true, supply: { kind: def.kind, left: def.amount, perenne: !!def.perenne, regen: def.regen || 0, max: def.max || def.amount, rain: !!def.rain }, knownBy: [] };
  W.custom.push(c);
  const where = place.replace(/_/g, ' ');
  if (all) alive().forEach((a) => { c.knownBy.push(a.name); a.known = a.known || []; if (!a.known.includes(place)) a.known.push(place); remember(a, `a ${where} hai notato ${def.name}: ${def.desc}`); interrupt(a, `ti accorgi che a ${where} c'è ${def.name}`); });
  chron(`${def.emoji} Sull'isola, a ${where}, ora c'è ${def.name}${all ? ': lo notano tutti.' : ': nessuno lo sa ancora.'}`, 'god');
  return `${def.name} a ${where} (${all ? 'visto da tutti' : 'da scoprire'})`;
}
function nearSupply(a, kind) { let best = null; (G.world.custom || []).forEach((c) => { if (!c.supply || c.supply.kind !== kind || !(c.knownBy || []).includes(a.name)) return; if (!c.supply.perenne && c.supply.left < 1) return; const d = dist(a.pos, c.loc); if (!best || d < best.d) best = { c, d }; }); return best; }
function supplyHere(a, kind) { const s = nearSupply(a, kind); return s && s.d < 3 ? s.c : null; }
function useSupply(a, c) {
  const s = c.supply; if (!s.perenne && s.left < 1) return `${c.name}: non è rimasto niente`;
  if (s.kind === 'fuoco') { a.stats.term = Math.max(a.stats.term == null ? 50 : a.stats.term, 55); a.stats.umore = clamp(a.stats.umore + 3); let cooked = '';
    if (a.inv.fish > 0) { const n = a.inv.fish; a.inv.fish = 0; a.stats.sat = clamp(a.stats.sat + 18 * n); a.ateOnce = true; cooked = ` e hai cotto e mangiato ${n} pesc${n > 1 ? 'i' : 'e'}`; }
    chron(`🔥 ${a.name} si scalda al ${c.name}${cooked}.`, 'act'); return `ti sei scaldato al ${c.name}${cooked}`; }
  if (s.kind === 'acqua') { a.stats.hyd = 100; if (hasGear(a, /bottigli/)) a.bottleWater = 3; if (!s.perenne) s.left -= 1; chron(`💧 ${a.name} beve da ${c.name}.`, 'act'); return `hai bevuto a sazietà da ${c.name}${hasGear(a, /bottigli/) ? ' e hai riempito la bottiglia' : ''}`; }
  const n = Math.min(s.perenne ? 3 : s.left, 3); if (!s.perenne) s.left -= n; a.stats.sat = clamp(a.stats.sat + 14 * n); a.stats.umore = clamp(a.stats.umore + 4); a.ateOnce = true;
  chron(`🍽 ${a.name} mangia da ${c.name}${s.perenne ? '' : ` (ne restano ${Math.floor(s.left)})`}.`, 'act'); return `hai mangiato da ${c.name}: ti senti sazio${s.perenne ? '' : `; ne restano ${Math.floor(s.left)} porzioni`}`;
}
function suppliesTick() { // discovery on the way, and daily regrowth
  const res = G.world.custom.filter((c) => c.supply); if (!res.length) return;
  alive().forEach((a) => { if (a.asleep) return; res.forEach((c) => { if ((c.knownBy || []).includes(a.name) || dist(a.pos, c.loc) > 6) return; c.knownBy = (c.knownBy || []).concat(a.name); remember(a, `hai trovato ${c.name}: ${c.desc}`); chron(`🔍 ${a.name} scopre ${c.name}.`, 'event'); interrupt(a, `trovi ${c.name}`); }); });
}
function suppliesHour(w) {
  G.world.custom.filter((c) => c.supply).forEach((c) => { const s = c.supply; if (s.rain && w.rain > 0.3) s.left = Math.min(s.max, s.left + 4); if (s.regen && Math.floor(G.h % 24) === 6) s.left = Math.min(s.max, s.left + s.regen); });
}
/* world mode chosen at the start: realistic / abundant (water and food never run out) / scarce; free or forced cohabitation */
function initWorldMode(setup) {
  const W = G.world; G.resMode = ['abbondanti', 'scarse', 'paradiso'].includes(setup.res) ? setup.res : 'normali'; G.forced = !!setup.forced; G.eveningCircle = !!setup.circle; G.circleHaiku = setup.circleHaiku !== false;
  if (G.resMode === 'paradiso') { // a perfect island: endless food and water, mild weather, no danger, a hut already standing
    G.paradise = true; W.fireEternal = true; W.fireEverLit = true; W.fireUntil = 9999; W.shelter = 3; W.bed = true; W.shark = false; W.custom = W.custom.filter((c) => !(c.animal && /cinghial/.test(c.name)));
  }
  if (G.resMode === 'abbondanti' || G.resMode === 'paradiso') {
    const near = (L, dx, dz) => [L[0] + dx, L[1] + dz];
    [['sorgente', near(LOC.shelter, 3.5, -2.5)], ['frutteto', near(LOC.shelter, -3.5, 2.5)], ['frutteto', near(LOC.beach, 4, -3)]].forEach(([k, loc]) => {
      const d = SUPPLY[k]; W.custom.push({ name: k === 'frutteto' ? 'albero carico di frutti' : d.name, desc: d.desc, use: k === 'frutteto' ? 'raccogliere e mangiare: i frutti non finiscono mai' : d.use, loc, id: G.nextId++, portable: false, parts: d.parts, completed: true, supply: { kind: d.kind, left: 999, perenne: true, regen: 0, max: 999 }, knownBy: G.agents.map((a) => a.name) });
    });
    W.fishStock = 1; W.coconuts += 20; W.fruit = (W.fruit || 0) + 10;
  }
  if (G.resMode === 'scarse') { W.coconuts = Math.ceil(W.coconuts * 0.35); W.fishStock = Math.min(W.fishStock, 0.3); W.fruit = 0; W.forestFruit = 0; W.brush = Math.ceil(W.brush * 0.5); W.shellfish = Math.min(W.shellfish || 0, 3); if (W.forestWood) W.forestWood = Math.ceil(W.forestWood * 0.5); }
}
function paradiseWx(r) { r.rain = 0; r.storm = false; r.fog = false; r.temp = Math.max(24, Math.min(28, r.temp)); r.wind = Math.min(r.wind, 0.35); r.waves = Math.min(r.waves == null ? 0.3 : r.waves, 0.35); r.desc = Object.assign({}, r.desc, { sea: 'calmo', cloud: Math.min(r.desc.cloud || 0, 0.3) }); return r; }
function worldModeHour() { const W = G.world; if (W.fireEternal) { W.fireUntil = Math.max(W.fireUntil, T() + 3); } if (G.resMode === 'abbondanti' || G.resMode === 'paradiso') { W.fishStock = 1; W.coconuts = Math.max(W.coconuts, 20); W.fruit = Math.max(W.fruit || 0, 8); W.shellfish = Math.max(W.shellfish || 0, 8); if (W.forestWood != null) W.forestWood = Math.max(W.forestWood, 40); }
  if (G.resMode === 'scarse') { W.fishStock = Math.min(W.fishStock, 0.35); W.fruit = Math.min(W.fruit || 0, 2); } }
// forced cohabitation: nobody can get further than a few steps from the rest of the group
function forcedClamp(a, to) {
  if (!G.forced || !to) return to; const others = alive().filter((o) => o !== a && !o.departed); if (!others.length) return to;
  const cx = others.reduce((s, o) => s + o.pos[0], 0) / others.length, cz = others.reduce((s, o) => s + o.pos[1], 0) / others.length; const R = 9;
  const dx = to[0] - cx, dz = to[1] - cz; const d = Math.hypot(dx, dz); if (d <= R) return to; return [cx + dx / d * R, cz + dz / d * R];
}
/* the group's story, step by step: every exchange between people, and a short daily reading of the group dynamics */
function socialPush(kind, text, who) { G.social = G.social || []; G.social.push({ day: G.day, h: G.h, kind, text: String(text).slice(0, 300), who: who || [] }); if (G.social.length > 3000) G.social.splice(0, G.social.length - 3000); }
function socialScan(text, kind) {
  if (G.agents.length < 2 || ['mind', 'sleep', 'god'].includes(kind)) return; const names = G.agents.filter((a) => text.includes(a.name)).map((a) => a.name);
  if (kind === 'speech') { const m = text.match(/^💬 (.+?) → (.+?):/); if (m && byName(m[2])) socialPush('parla', text.replace(/^💬 /, ''), [m[1], byName(m[2]).name]); else if (m && /^tutti$/i.test(m[2]) && alive().length > 1) socialPush('parla', text.replace(/^💬 /, ''), [m[1]]); return; } // talking to oneself, an animal or a thing is not an exchange between people
  if (names.length >= 2) socialPush(/rub|ruba|sottra/i.test(text) ? 'furto' : /^🎲|^🏅|propone/.test(text) ? 'gioco' : /litig|colpisc|aggred|spint|minacc|rissa|insult/i.test(text) ? 'conflitto' : /dà|regala|offre|condivid|aiut|cura|medica|insieme/i.test(text) ? 'aiuto' : 'evento', text, names);
}
function socialRel(a, rel) {
  G.relSnap = G.relSnap || {}; Object.entries(rel).slice(0, 8).forEach(([k, v]) => { const o = byName(k); if (!o || o === a || !v) return; const key = a.id + '>' + o.id; const t = String(v).slice(0, 200);
    if (G.relSnap[key] !== t) { const first = G.relSnap[key] == null; G.relSnap[key] = t; socialPush('opinione', `${a.name} ${first ? 'su' : 'cambia idea su'} ${o.name}: «${t}»`, [a.name, o.name]); } });
}
async function socialDay() {
  if (G.agents.filter((a) => !a.departed).length < 2 || !SAMPLE || G.economy) return; G.socialDays = G.socialDays || []; const day = G.day - 1; if (day < 1 || G.socialDays.some((d) => d.day === day)) return;
  const ev = (G.social || []).filter((s) => s.day === day).slice(-60); if (!ev.length) return; const entry = { day, text: '' }; G.socialDays.push(entry);
  const prev = G.socialDays.filter((d) => d.day < day && d.text).slice(-1)[0];
  try {
    const out = await ask('gruppo', `Sei uno psicologo sociale che osserva un gruppo di naufraghi su un'isola (${G.agents.map((a) => `${a.name}${a.alive ? '' : ' (morto)'}`).join(', ')}). Ecco tutto ciò che è successo tra loro nel giorno ${day}, in ordine:
${ev.map((s) => `- ${fmtH(s.h)} ${s.text}`).join('\n')}
${prev ? `Il giorno prima avevi scritto: «${prev.text}»` : ''}
Scrivi in italiano 4-6 frasi chiare e concrete: chi ha preso l'iniziativa o comanda, alleanze e simpatie, tensioni e conflitti, chi resta isolato, cosa è cambiato rispetto a prima. Solo ciò che risulta dai fatti, niente invenzioni. Rispondi SOLO con JSON: {"analisi":"..."}`, 'quick');
    entry.text = String((out && out.analisi) || '').slice(0, 1200); save(); emit('onChange');
  } catch (e) {}
}
/* the circle: people sit around the fire and talk about life, beliefs, opinions; it gets heated or not according to who they are */
const CIRCLE_TOPICS = ['la vita di ognuno prima del naufragio', 'in cosa credete: Dio, il destino, la scienza', 'politica: come dovrebbe funzionare una società giusta', 'cosa conta davvero nella vita', 'famiglia, amori, chi vi aspetta a casa', 'cosa farete se vi salvano', 'chi dovrebbe decidere sull\'isola, e come', 'la morte, e cosa c\'è dopo', 'soldi, lavoro e successo', 'il bene e il male: cosa è giusto fare quando nessuno guarda'];
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
async function startCircle(opt) {
  if (G.circleNow) return 'c\'è già un cerchio in corso'; const people = alive().filter((a) => !a.departed && !a.asleep); if (people.length < 2) return 'servono almeno due persone sveglie';
  const topic = String(opt.topic || CIRCLE_TOPICS[(G.circles || []).length % CIRCLE_TOPICS.length]).slice(0, 200); const forever = opt.lines === 'sempre'; const hours = /^h\d/.test(String(opt.lines)) ? Number(String(opt.lines).slice(1)) : 0; const maxLines = forever || hours ? 100000 : Math.max(4, Math.min(500, Number(opt.lines) || 14));
  const C = G.circleNow = { topic, names: people.map((a) => a.name), lines: [], heat: 0, open: true, day: G.day, h: G.h, by: opt.by || 'osservatore', t0: T(), until: hours ? T() + hours : null, forever, stop: false };
  // a seat for each one around the fire, spaced so that bodies and speech bubbles don't overlap
  const fc = PLACES.fuoco.loc; const R = Math.max(2.4, people.length * 0.75);
  people.forEach((a, i) => { const ang = i / people.length * Math.PI * 2 + 0.4; let s = [fc[0] + Math.cos(ang) * R, fc[1] + Math.sin(ang) * R]; if (ISL.radius && Math.hypot(s[0], s[1]) > ISL.radius(s[0], s[1]) - 0.8) s = [fc[0] + Math.cos(ang + Math.PI) * R * 0.8, fc[1] + Math.sin(ang + Math.PI) * R * 0.8]; a.circleSeat = s; });
  people.forEach((a) => { a.inCircle = true; a.plan = [{ azione: 'vai', luogo: 'fuoco' }, { azione: 'riposa', ore: 0.5 }]; a.cur = null; remember(a, `vi siete seduti in cerchio attorno al fuoco: si parla di ${topic}`); });
  chron(`🗣 Attorno al fuoco si forma un cerchio: ${C.names.join(', ')}. Si parla di ${topic}.`, 'event');
  // wait for them to sit down (or a short while)
  // wait (in game time) until everyone has reached their seat; nobody speaks while still walking
  const tg = T();
  while (!G.ended && !C.stop && T() - tg < 2 && alive().some((a) => a.inCircle && !a.asleep && a.circleSeat && dist(a.pos, a.circleSeat) > 1.5)) await sleepMs(400);
  for (let i = 0; i < maxLines && !G.ended && !C.stop && !(C.until && T() >= C.until); i++) {
    while (!G.running && !G.ended) await sleepMs(400);
    circleNeeds(C); const seated = (a) => !a.circleSeat || dist(a.pos, a.circleSeat) < 2; const ring = alive().filter((a) => a.inCircle && !a.asleep && seated(a));
    if (ring.length < 2) { if (C.forever || C.until) { await sleepMs(1500); if (alive().filter((a) => a.inCircle && !a.asleep).length < 2 && !alive().some((a) => !a.inCircle && !a.asleep && !a.departed)) break; continue; } break; }
    const last = C.lines[C.lines.length - 1]; let sp = last && last.to && ring.find((a) => a.name === last.to && a.name !== last.name) && Math.random() < 0.75 ? ring.find((a) => a.name === last.to) : null;
    if (!sp) { const lastSpoke = (a) => { for (let j = C.lines.length - 1; j >= 0; j--) if (C.lines[j].name === a.name) return j; return -1; }; sp = ring.filter((a) => !last || a.name !== last.name).sort((a, b) => lastSpoke(a) - lastSpoke(b) + (Math.random() - 0.5) * 2)[0]; }
    await circleTurn(sp, ring, C); await sleepMs(1800);
  }
  const ring = alive().filter((a) => a.inCircle);
  C.open = false;
  chron(`🗣 Il cerchio si scioglie${C.stop ? ' (sciolto dall\'osservatore)' : ''}${C.heat >= 4 ? ' in un clima teso' : C.heat >= 2 ? ' dopo qualche momento acceso' : ''}.`, 'event');
  ring.forEach((a) => { a.inCircle = false; a.circleSeat = null; a.plan = []; a.cur = null; remember(a, `il cerchio attorno al fuoco è finito (si parlava di ${topic})`); });
  G.circles = G.circles || []; G.circles.push({ day: C.day, h: C.h, topic, names: C.names, lines: C.lines, heat: C.heat, by: C.by }); if (G.circles.length > 60) G.circles.shift();
  G.circleNow = null; save(); emit('onChange'); return 'fatto';
}
async function circleTurn(a, ring, C) {
  const others = ring.filter((o) => o !== a);
  const prompt = `Sei ${a.name}, ${a.age} anni, naufrago su un'isola. ${a.persona ? 'Il tuo carattere (non citarlo mai, comportati così): ' + a.persona + '.' : ''}${sheetText(a)} ${a.bio ? 'La tua storia: ' + String(a.bio).slice(0, 500) : ''}
Ora siete seduti in cerchio attorno al fuoco: ${ring.map((o) => o.name).join(', ')}. Si parla di: ${C.topic}.
Cosa pensi degli altri: ${others.map((o) => `${o.name}: ${(a.relations || {})[o.name] || 'non hai ancora un\'idea precisa'}`).join('; ')}.
Come stai: umore ${Math.round(a.stats.umore)}/100, stanchezza ${Math.round(100 - a.stats.en)}/100, fame ${Math.round(100 - a.stats.sat)}/100, sete ${Math.round(100 - a.stats.hyd)}/100${a.emotion ? ', ti senti ' + a.emotion : ''}.
${C.lines.length ? 'Quello che è stato detto finora:\n' + C.lines.slice(-14).map((l) => `${l.name}${l.to && l.to !== 'tutti' ? ' (a ' + l.to + ')' : ''}${l.tono ? ' [' + l.tono + ']' : ''}: ${l.text}`).join('\n') : 'Nessuno ha ancora parlato: puoi rompere il ghiaccio.'}
Rispondi come farebbe davvero questa persona, con le sue convinzioni (anche discutibili, anche sbagliate) e il suo modo di parlare: puoi essere d'accordo, contraddire, scaldarti, offenderti, fare una battuta, raccontare qualcosa di tuo, cambiare argomento, restare in silenzio o alzarti e andartene. Niente prediche, niente buonismo forzato: le persone reali non sono sempre gentili né sempre d'accordo. Al massimo 3 frasi parlate, in italiano colloquiale.
Rispondi SOLO con JSON: {"dice":"le tue parole, oppure vuoto se taci","a":"tutti oppure il nome di chi ti rivolgi","tono":"calmo|ironico|appassionato|acceso|offeso|conciliante|triste|annoiato","gesto":null oppure un gesto,"se_ne_va":false,"pensa":"cosa pensi davvero e non dici","convinzioni":null oppure, se questa discussione ti ha fatto cambiare o rafforzare un'idea, cosa pensi adesso in una frase,"relazioni":{"nome":"cosa pensi ora di lui/lei"}}`;
  let out = null; a.thinking = true; a.thinkSince = G.h + (G.day - 1) * 24; emit('onChange');
  try { out = await ask('cerchio', prompt, G.circleHaiku ? 'quick' : 'mind'); } catch (e) { out = null; } finally { a.thinking = false; }
  if (!out) return;
  const text = String(out.dice || '').trim().slice(0, 400); const to = String(out.a || 'tutti').trim(); const tono = String(out.tono || '').toLowerCase().slice(0, 20);
  if (out.pensa) { a.thought = String(out.pensa).slice(0, 300); a.bubble = { kind: 'thought', text: a.thought, until: performance.now() + 6000 }; }
  if (text) { speak(a, byName(to) ? byName(to).name : 'tutti', text); C.lines.push({ name: a.name, to: byName(to) ? byName(to).name : 'tutti', text, tono, h: G.h }); }
  else { chron(`🤐 ${a.name} resta in silenzio.`, 'act'); C.lines.push({ name: a.name, to: 'tutti', text: '(resta in silenzio)', tono, h: G.h }); }
  if (/acces|offes|arrabb|furios/.test(tono)) { C.heat++; if (C.heat === 3) chron('🔥 La discussione attorno al fuoco si scalda.', 'event'); a.stats.umore = clamp(a.stats.umore - 2); }
  if (/concil|calm|ironic/.test(tono) && C.heat > 0) C.heat -= 0.5;
  if (out.gesto) { funGesture(a, out.gesto); C.lines.push({ name: a.name, to: 'tutti', text: `(${String(out.gesto).slice(0, 80)})`, tono: '', h: G.h, act: true }); } funBelief(a, out.convinzioni);
  if (out.relazioni && typeof out.relazioni === 'object') { socialRel(a, out.relazioni); a.relations = a.relations || {}; Object.entries(out.relazioni).slice(0, 8).forEach(([k, v]) => { const o = byName(k); if (o && o !== a && v) a.relations[o.name] = String(v).slice(0, 200); }); }
  if (out.se_ne_va === true || out.se_ne_va === 'true') { a.inCircle = false; a.circleSeat = null; a.circleLeftT = T(); a.plan = []; a.cur = null; chron(`🚶 ${a.name} si alza e se ne va dal cerchio.`, 'event'); C.lines.push({ name: a.name, to: 'tutti', text: '(si alza e se ne va)', tono: 'via', h: G.h }); ring.forEach((o) => { if (o !== a) remember(o, `${a.name} si è alzato e se n'è andato dal cerchio`); }); }
  save(); emit('onChange');
}
// people in a long circle still get hungry, thirsty and tired: they get up to take care of it, and may come back; newcomers can sit down
function circleNeeds(C) {
  alive().forEach((a) => { if (!a.inCircle) return; const s = a.stats; const need = s.hyd < 25 ? 'bere' : s.sat < 20 ? 'mangiare qualcosa' : s.en < 12 ? 'riposare' : null;
    if (need) { a.inCircle = false; a.circleSeat = null; a.plan = []; a.cur = null; chron(`🚶 ${a.name} si alza dal cerchio per ${need}.`, 'act'); C.lines.push({ name: a.name, to: 'tutti', text: `(si alza per ${need})`, tono: 'via', h: G.h }); remember(a, `ti sei alzato dal cerchio per ${need}; puoi tornarci quando vuoi`); } });
}
function circleJoinTick() {
  const C = G.circleNow; if (!C || !C.open) return; circleNeeds(C); const fc = PLACES.fuoco.loc;
  alive().forEach((a) => { if (a.inCircle || a.asleep || a.departed || a.thinking || dist(a.pos, fc) > 4 || (a.circleLeftT && T() - a.circleLeftT < 1)) return;
    const n = alive().filter((o) => o.inCircle).length + 1; const R = Math.max(2.4, n * 0.75); const ang = Math.random() * Math.PI * 2; a.circleSeat = [fc[0] + Math.cos(ang) * R, fc[1] + Math.sin(ang) * R];
    a.inCircle = true; a.plan = [{ azione: 'riposa', ore: 0.5 }]; a.cur = null; if (!C.names.includes(a.name)) C.names.push(a.name);
    chron(`🗣 ${a.name} si siede nel cerchio.`, 'act'); C.lines.push({ name: a.name, to: 'tutti', text: '(si siede nel cerchio)', tono: '', h: G.h }); remember(a, `ti sei seduto nel cerchio: si parla di ${C.topic}`); });
}
function stopCircle() { if (G.circleNow) { G.circleNow.stop = true; return true; } return false; }
function circleHour() { if (!G.eveningCircle || G.circleNow || G.ended) return; const h = Math.floor(G.h % 24); if (h !== 20) return; if (alive().filter((a) => !a.departed && !a.asleep).length < 2) return; if ((G.circles || []).some((c) => c.day === G.day)) return; startCircle({ by: 'serale' }); }

/* a numeric picture of the group, comparable between experiments */
function groupStats() {
  const s = G.social || []; const cnt = (k) => s.filter((x) => k.includes(x.kind)).length; const names = G.agents.map((a) => a.name);
  const talk = {}; names.forEach((n) => { talk[n] = { said: 0, got: 0, links: new Set() }; });
  s.forEach((x) => { if (x.kind === 'parla' && x.who.length >= 2) { const [p, q] = x.who; if (talk[p]) { talk[p].said++; talk[p].links.add(q); } if (talk[q]) { talk[q].got++; talk[q].links.add(p); } } else if (x.who && x.who.length >= 2) x.who.forEach((p) => x.who.forEach((q) => { if (p !== q && talk[p]) talk[p].links.add(q); })); });
  (G.circles || []).forEach((c) => c.lines.forEach((l) => { if (talk[l.name] && !/silenzio|se ne va/.test(l.text)) talk[l.name].said++; if (l.to && talk[l.to]) talk[l.to].got++; }));
  const score = (n) => talk[n].said + talk[n].got * 1.5; const ranked = names.filter((n) => talk[n]).sort((p, q) => score(q) - score(p));
  const al = G.agents.filter((a) => a.alive && !a.departed);
  return { conflitti: cnt(['conflitto']), furti: cnt(['furto']), aiuti: cnt(['aiuto']), incontri: cnt(['incontro']), cerchi: (G.circles || []).length, accesi: (G.circles || []).filter((c) => c.heat >= 3).length,
    leader: names.length > 1 && ranked.length ? ranked[0] : '—', isolato: names.length > 2 && ranked.length ? ranked[ranked.length - 1] : '—', umore: al.length ? Math.round(al.reduce((t, a) => t + a.stats.umore, 0) / al.length) : 0 };
}
/* fighting boredom: making things one likes, playing, proposing activities to the others */
function funCreate(a, p) {
  const W = G.world; const what = String(p.cosa || '').trim().slice(0, 60); if (!what) return 'non hai deciso cosa fare';
  const used = []; if ((W.woodPile || 0) >= 2) { W.woodPile -= 2; used.push('legna'); } else if ((W.forestWood || 0) > 2 && !used.length) { W.forestWood -= 2; used.push('legna dalla foresta'); }
  if ((W.fiber || 0) >= 1) { W.fiber -= 1; used.push('fibre'); } if (/pietr|sass|scult|sasso/.test(what) && (W.stone || 0) >= 2) { W.stone -= 2; used.push('pietre'); }
  if (!used.length && !(W.brush > 2) && !G.paradise && G.resMode !== 'abbondanti') return `per fare ${what} ti servono materiali: un po' di legna, fibre o pietre`;
  const how = String(p.come || '').slice(0, 160);
  const loc = [a.pos[0] + 0.8, a.pos[1] + 0.6];
  W.custom.push({ name: what, desc: `fatto a mano da ${a.name}${how ? ': ' + how : ''}`, loc, id: G.nextId++, portable: !/amaca|tavol|altalen|capann|panca|scult|totem|torre|recinto/.test(what), madeBy: a.name, addedAt: T() });
  a.stats.noia = clamp((a.stats.noia || 0) - 30); a.stats.umore = clamp(a.stats.umore + 8); a.stats.mente = clamp(a.stats.mente + 3);
  setTimeout(completeObjects, 0);
  chron(`🛠 ${a.name} ha fatto ${what}${used.length ? ' (con ' + used.join(', ') + ')' : ''}.`, 'event');
  return `hai finito ${what}: è lì accanto a te`;
}
function funPlay(a, p) {
  const game = String(p.gioco || 'un gioco').slice(0, 80); const con = String(p.con || 'da solo'); const mates = /tutti/i.test(con) ? alive().filter((o) => o !== a && !o.asleep && dist(o.pos, a.pos) < 8) : [byName(con)].filter((o) => o && o !== a && o.alive && dist(o.pos, a.pos) < 8);
  const fun = mates.length ? 14 : 7; a.stats.noia = clamp((a.stats.noia || 0) - (mates.length ? 35 : 20)); a.stats.umore = clamp(a.stats.umore + fun);
  mates.forEach((o) => { o.stats.noia = clamp((o.stats.noia || 0) - 15); remember(o, `${a.name} ha giocato con te: ${game}`); });
  chron(mates.length ? `🎲 ${a.name} gioca con ${mates.map((o) => o.name).join(' e ')}: ${game}.` : `🎲 ${a.name} gioca da solo: ${game}.`, 'act');
  if (mates.length && /carte|gara|sfida|scommess/.test(game) && Math.random() < 0.3) { const w = [a, ...mates][Math.floor(Math.random() * (mates.length + 1))]; chron(`🏅 Vince ${w.name}.`, 'act'); [a, ...mates].forEach((o) => remember(o, `nel gioco (${game}) ha vinto ${w.name}`)); }
  return mates.length ? `hai giocato con ${mates.map((o) => o.name).join(' e ')}` : (/tutti|[A-Z]/.test(con) && con !== 'da solo' ? 'non c\'era nessuno vicino con cui giocare: hai giocato da solo' : 'hai giocato da solo');
}
function funPropose(a, p) {
  const what = String(p.attivita || p.cosa || '').slice(0, 160); if (!what) return 'non hai proposto niente';
  const to = String(p.a || 'tutti'); const targets = /tutti/i.test(to) ? alive().filter((o) => o !== a && !o.departed) : [byName(to)].filter((o) => o && o !== a && o.alive);
  const near = targets.filter((o) => !o.asleep && dist(o.pos, a.pos) < 14); if (!near.length) return 'nessuno ti ha sentito';
  a.bubble = { kind: 'speech', text: what, to: near.length > 1 ? 'tutti' : near[0].name, until: performance.now() + 9000 };
  chron(`🙋 ${a.name} propone a ${near.map((o) => o.name).join(', ')}: ${what}`, 'act');
  near.forEach((o) => { remember(o, `${a.name} ti propone: ${what}`); interrupt(o, `${a.name} ti propone: ${what}`); });
  return `hai proposto a ${near.map((o) => o.name).join(', ')}: ${what}`;
}
/* a new castaway added during the game, configured like the ones at the start */
const CARRY_NAMES = { axe: 'un\'ascia', knife: 'un coltello', rod: 'una canna da pesca', rope: 'una corda', tarp: 'telo di plastica', pot: 'pentolino di alluminio', lighter: 'accendino', matches: 'scatola di fiammiferi', bottle: 'bottiglia di plastica vuota', firstaid: 'kit di pronto soccorso', mirror: 'specchietto', handline: 'lenza e ami' };
function addPerson(spec) {
  const W = G.world; const before = G.agents.length;
  const done = applyOps([{ tipo: 'aggiungi_persona', nome: spec.name, sesso: spec.sex === 'f' ? 'f' : 'm', eta: Number(spec.age) || 30, carattere: spec.persona || '', arrivo: spec.arrival || 'arriva a riva aggrappato a un rottame' }], 'osservatore');
  if (G.agents.length === before) return done; const ag = G.agents[G.agents.length - 1];
  const keys = spec.carry || []; if (keys.length) { if (!W.carriedMap) W.carriedMap = { [W.carriedBy || 'p0']: W.carried || [] };
    const tools = keys.filter((k) => ['axe', 'knife', 'rod', 'rope'].includes(k)); if (tools.length) { W.carriedMap[ag.id] = tools; tools.forEach((k) => { W[k] = true; }); }
    keys.filter((k) => !['axe', 'knife', 'rod', 'rope'].includes(k)).forEach((k) => ag.inv.items.push(CARRY_NAMES[k] || k)); }
  return done;
}
/* replay: one sample per game hour */
function trackHour() {
  G.track = G.track || []; const p = {};
  G.agents.forEach((a) => { if (a.alive && !a.departed) p[a.id] = [Math.round(a.pos[0] * 10) / 10, Math.round(a.pos[1] * 10) / 10]; });
  G.track.push({ d: G.day, h: Math.round(G.h % 24), p }); if (G.track.length > 2400) G.track.splice(0, G.track.length - 2400);
}
function funHour(w) {
  try { circleHour(); if (Math.floor(G.h % 24) === 7) socialDay(); fixNames(); worldModeHour(); suppliesHour(w); petsHour(); spectHour(w); trackHour(); const W = G.world; if (W.cairns && W.cairns < 12 && Math.floor(G.h % 24) === 12 && Math.random() < 0.5) W.cairns++; } catch (e) { console.warn('fun', e); }
}

/* what these add to the character's prompt: only facts he would know */
function funPrompt(a) {
  const W = G.world; const out = [];
  const others = alive().filter((o) => o !== a && !o.departed);
  if (G.forced && others.length) out.push(`Non riesci ad allontanarti dagli altri: dove vai tu ci sono anche loro, a pochi passi, giorno e notte. Non c'è modo di isolarsi.`);
  if (G.resMode === 'abbondanti' || G.resMode === 'paradiso') out.push(`Su quest'isola acqua e cibo non mancano mai: la sorgente vicino al riparo non si secca e gli alberi da frutto non si svuotano.`);
  { const w = nearSupply(a, 'acqua'), f = nearSupply(a, 'cibo'), fi = nearSupply(a, 'fuoco') || (W.fireEternal ? { c: { loc: PLACES.fuoco.loc } } : null);
    if (w || f || fi) out.push(`IMPORTANTE, sulle risorse: ${[w ? `l'acqua non è un problema (sorgente perenne a ${placeOf(w.c.loc).name.replace(/_/g, ' ')}: per bere usa "bevi" e ci vai da solo)` : '', f ? `il cibo non è un problema (${f.c.name} a ${placeOf(f.c.loc).name.replace(/_/g, ' ')}: "raccogli_frutti")` : '', fi ? `il fuoco non è un problema (${W.fireEternal ? 'il fuoco del campo' : 'un fuoco perenne'} arde sempre: non serve accenderlo né alimentarlo)` : ''].filter(Boolean).join('; ')}. Lo sai bene: ${w && f && fi ? 'sopravvivere non ti preoccupa più, puoi pensare ad altro' : 'su questo puoi stare tranquillo'}. Quando hai sete o fame ci vai e basta, senza farne un problema.`); }
  if (G.paradise) out.push(`L'isola è un piccolo paradiso: il clima è sempre mite, non ci sono pericoli e il riparo è già pronto. Non c'è niente di urgente da fare.`);
  if (G.circleNow && !a.inCircle && G.circleNow.open) out.push(`Attorno al fuoco ${G.circleNow.names.join(', ')} sono seduti in cerchio e parlano di: ${G.circleNow.topic}. Puoi unirti (vai al fuoco) o restartene per conto tuo.`);
  if (others.length) out.push(`Siete in ${others.length + 1} su quest'isola e vi incrociate spesso. Come ti comporti con ciascuno (cercarlo o evitarlo, parlargli, collaborare o fare da solo, fidarti o no, scontrarti) dipende da te, dal tuo carattere, dal tuo stato e da come ti hanno trattato finora.`);
  const names = (W.names || []).slice(-12); if (names.length) out.push(`Nomi dati sull'isola: ${names.map((n) => `«${n.name}» = ${n.what} (${n.by === a.name ? 'l\'hai chiamato tu' : 'nome dato da ' + n.by})`).join('; ')}. Usali se ti viene naturale.`);
  const sup = W.custom.filter((c) => c.supply && (c.knownBy || []).includes(a.name));
  if (sup.length) out.push(`Risorse che conosci: ${sup.map((c) => `${c.name} (${placeOf(c.loc).name.replace(/_/g, ' ')}; ${c.supply.perenne ? 'non finisce mai' : Math.floor(c.supply.left) + ' porzioni rimaste'}) — per usarla: usa_oggetto con "oggetto":"${c.name}"`).join('; ')}.`);
  if ((a.beliefs || []).length) out.push(`Le tue convinzioni di adesso, nate da ciò che hai vissuto qui: ${a.beliefs.slice(-5).map((b) => b.text).join(' | ')}.`);
  if ((a.habits || []).length) out.push(`Le tue abitudini: ${a.habits.map((h) => h.text).join('; ')}.`);
  const pet = Object.entries(W.pets || {}).find(([, p]) => p.owner === a.name); if (pet) out.push(`${nameOfAnimal(pet[0]) ? `${pet[0]} «${nameOfAnimal(pet[0])}»` : 'Il ' + pet[0]} ti segue ovunque: si è affezionato a te.`);
  return out.length ? '\n\n' + out.join('\n') : '';
}
// beliefs change with what happens: the character notices it himself
function funBelief(a, b) { const s = String(b || '').trim(); if (s.length < 6 || /^null$/i.test(s)) return; a.beliefs = a.beliefs || []; if (a.beliefs.length && a.beliefs[a.beliefs.length - 1].text === s) return;
  a.beliefs.push({ day: G.day, h: G.h, text: s.slice(0, 220) }); if (a.beliefs.length > 30) a.beliefs.shift(); chron(`🧭 ${a.name} cambia idea: ${s.slice(0, 220)}`, 'event'); if (typeof socialPush === 'function') socialPush('opinione', `${a.name} ora pensa: «${s.slice(0, 200)}»`, [a.name]); }
// the observer edits a character's settings during the game (he doesn't know: it is his nature that changes)
function editPerson(id, ch) { const a = G.agents.find((x) => x.id === id); if (!a) return false; const was = a.persona || '';
  if (ch.persona != null) a.persona = String(ch.persona).slice(0, 600); if (ch.amnesia != null) a.amnesia = !!ch.amnesia;
  if (a.persona !== was) { G.interventions.push({ day: G.day, h: G.h, text: `👤 carattere di ${a.name}: «${a.persona}»`, done: ['carattere modificato'] }); chron(`👤 (osservatore) il carattere di ${a.name} ora è: ${a.persona || 'non specificato'}`, 'god'); }
  save(); emit('onChange'); return true; }
function funApply(a, out) {
  funBelief(a, out.convinzioni);
  if (a.inCircle) { a.plan = [{ azione: 'vai', luogo: 'fuoco' }, { azione: 'riposa', ore: 0.5 }]; a.cur = null; }
  funGesture(a, out.gesto); funName(a, out.nomina); funHabit(a, out.abitudine);
  if (out.riassunto_giornata) funSketch(a, String(out.riassunto_giornata));
}

/* the novel: the whole experiment rewritten as a novel, one chapter per day, faithful to what happened */
function novelDays() { const last = G.endedAt ? G.endedAt.day : G.day; return Array.from({ length: last }, (_, i) => i + 1).filter((d) => G.chronicle.some((c) => c.day === d)); }
function novelNeeds(d) { const N = G.novel || {}; const ch = (N.chapters || {})[d]; const n = G.chronicle.filter((c) => c.day === d).length; return !ch || ch.n !== n || (!!G.ended && d === novelDays().slice(-1)[0] && !ch.final); }
function novelMissing() { return novelDays().filter(novelNeeds); }
async function novelChapter(d) {
  G.novel = G.novel || { chapters: {}, summary: '' }; const N = G.novel; const days = novelDays(); const isLast = d === days[days.length - 1]; const ended = !!G.ended && isLast;
  const ev = G.chronicle.filter((c) => c.day === d); const evTxt = (ev.length > 160 ? ev.filter((c, i) => c.kind !== 'act' || i % 2 === 0).slice(-160) : ev).map((c) => `${fmtH(c.h)} ${c.text}`).join('\n');
  const th = G.agents.map((a) => { const t = (a.thoughts || []).filter((x) => x.day === d).slice(-10).map((x) => `${fmtH(x.h)} ${x.text}`); return t.length ? `${a.name}:\n  ${t.join('\n  ')}` : ''; }).filter(Boolean).join('\n');
  const circ = (G.circles || []).filter((C) => C.day === d).map((C) => `Cerchio attorno al fuoco (tema: ${C.topic}):\n` + C.lines.filter((l) => !l.act && !/^\(/.test(l.text)).slice(0, 50).map((l) => `  ${l.name}${l.to && l.to !== 'tutti' ? ' a ' + l.to : ''}${l.tono ? ' [' + l.tono + ']' : ''}: «${l.text}»`).join('\n')).join('\n');
  const diary = (G.diary || []).filter((x) => x.day === d).map((x) => `${x.agent}: ${x.text}`).join('\n');
  const prev = N.chapters[d - 1]; const cast = G.agents.filter((a) => !G.chronicle.length || (G.chronicle.find((c) => c.text.includes(a.name)) || { day: 1 }).day <= d).map((a) => `- ${a.name}, ${a.sex === 'f' ? 'donna' : 'uomo'}, ${a.age} anni${a.persona ? '; carattere: ' + a.persona : ''}`).join('\n');
  const prompt = `Sei un romanziere italiano. Stai scrivendo un romanzo tratto da un esperimento reale: persone naufragate su un'isola deserta. Ogni capitolo è un giorno. Scrivi ora il CAPITOLO ${d}${isLast && !G.ended ? ' (la giornata è ancora in corso: fermati all\'ultimo fatto, con un finale sospeso)' : ''}.
Regole:
- Fedele ai fatti: non inventare eventi, incontri, morti, oggetti o salvataggi che non sono nei fatti. Puoi inventare dettagli sensoriali, gesti minimi e la vita interiore, coerenti con i pensieri registrati.
- Le battute che i personaggi hanno detto davvero (nei fatti o nel cerchio) usale come dialoghi, tra caporali «», anche accorciate; non inventarne di nuove importanti.
- Terza persona, passato remoto, più punti di vista se ci sono più persone. Ritmo da romanzo: scene, dialoghi, pause; niente elenchi, niente orari scritti come in un registro, niente riassunto da cronaca.
- ${NOVEL_STYLE}
- 800-1200 parole, divise in paragrafi (separa i paragrafi con una riga vuota).
- Non nominare l'esperimento, i giocatori, Claude o il fatto che sia una simulazione: dentro il romanzo è tutto vero.
- I personaggi si chiamano ESATTAMENTE come nell'elenco qui sotto, anche quando il nome sembra un soprannome (per esempio «Terrapiattista»): è il loro nome nel romanzo. Non dare loro nomi propri inventati, non rinominare nessuno e non aggiungere personaggi che non sono nell'elenco o nei fatti.
Personaggi:\n${cast}
${N.summary ? `La storia finora, in breve:\n${N.summary}\n` : ''}${prev ? `Il capitolo precedente («${prev.title}») finiva così:\n…${String(prev.text).slice(-700)}\n` : 'È il primo capitolo: apri il romanzo.\n'}${ended ? `È L'ULTIMO capitolo: la storia finisce così: «${G.ended}». Racconta il finale per com'è andato e chiudi il romanzo.\n` : ''}
Fatti del giorno ${d}, in ordine:\n${evTxt || '(nessun fatto notevole)'}
${th ? `Pensieri registrati:\n${th}\n` : ''}${circ ? `\n${circ}\n` : ''}${diary ? `Diari della sera:\n${diary}\n` : ''}
Rispondi SOLO con JSON: {"titolo":"titolo del capitolo, evocativo e breve","testo":"il capitolo","riassunto":"la storia finora in 4-6 frasi, aggiornata con questo capitolo"}`;
  let out = await ask('romanzo', prompt, 'mind');
  if (!out || !out.testo) throw new Error('capitolo vuoto');
  // fidelity check: proper names in the middle of a sentence that belong to nobody on the island (cast, places, named animals and things, words in the facts) mean the novelist invented someone: rewrite once
  const known = (G.agents.map((x) => x.name).join(' ') + ' ' + evTxt + ' ' + th + ' ' + circ + ' ' + diary + ' ' + Object.values(G.world.names || {}).map((n) => (n && n.name) || n).join(' ')).toLowerCase();
  const odd = [...new Set((String(out.testo).match(/[a-zàèéìòù,;:»] ([A-ZÀÈÉÌÒÙ][a-zàèéìòù]{2,})/g) || []).map((m) => m.slice(2)))].filter((w) => !known.includes(w.toLowerCase()) && !/^(Dio|Signore|Madonna|Cristo|Gesù|Terra|Luna|Sole|Natale|Pasqua|Stato|Nasa|Europa|Italia|America|Internet)$/.test(w));
  if (odd.length) { try { const again = await ask('romanzo', prompt + `

ATTENZIONE: in una prima stesura avevi usato nomi che non esistono in questa storia (${odd.slice(0, 8).join(', ')}). Riscrivi il capitolo usando SOLO i nomi dei personaggi elencati e gli eventi dei fatti.`, 'mind'); if (again && again.testo) out = again; } catch (e) {} }
  N.chapters[d] = { title: String(out.titolo || `Giorno ${d}`).slice(0, 90), text: String(out.testo).slice(0, 12000), n: ev.length, final: ended };
  if (out.riassunto && d === Math.max(...Object.keys(N.chapters).map(Number))) N.summary = String(out.riassunto).slice(0, 1500);
  save(); return N.chapters[d];
}
async function novelTitle() {
  const N = G.novel || {}; if (N.title && N.titleFinal === !!G.ended) return N;
  try { const out = await ask('romanzo', `Ecco i titoli dei capitoli di un romanzo su alcune persone naufragate su un'isola deserta, e il riassunto della storia.\nCapitoli: ${Object.entries(N.chapters || {}).sort((a, b) => a[0] - b[0]).map(([d, c]) => c.title).join(' / ')}\nRiassunto: ${N.summary || ''}${G.ended ? `\nFinale: ${G.ended}` : ''}\nI personaggi si chiamano: ${G.agents.map((a) => a.name).join(', ')} (non usare altri nomi). Proponi un titolo per il romanzo (breve, letterario, non banale) e un'epigrafe inventata da te di una riga (non citare autori reali).\nRispondi SOLO con JSON: {"titolo":"...","epigrafe":"..."}`, 'quick');
    if (out && out.titolo) { N.title = String(out.titolo).slice(0, 80); N.epigraph = String(out.epigrafe || '').slice(0, 200); N.titleFinal = !!G.ended; save(); } } catch (e) {}
  return N;
}

/* character sheet from the archive: who this person is, in their own terms; secrets and goals only in their own prompt */
function sheetText(a) {
  const s = a.sheet; if (!s) return '';
  const cut = (t, n) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };
  const sec = s.sections || {}; const parts = [];
  const label = { identita: 'Chi sei e che aspetto hai', storia: 'La tua storia', carattere: 'Il tuo carattere', valori: 'Valori, convinzioni, fissazioni', paure: 'Paure e punti deboli', parlata: 'Come parli', relazioni_stile: 'Come tratti gli altri' };
  const budget = { identita: 350, storia: 700, carattere: 500, valori: 500, paure: 350, parlata: 350, relazioni_stile: 350 };
  if (s.summary) parts.push(cut(s.summary, 900));
  Object.keys(label).forEach((k) => { if (sec[k]) parts.push(`${label[k]}: ${cut(sec[k], s.summary ? Math.round(budget[k] * 0.6) : budget[k])}`); });
  if ((s.secrets || []).length) parts.push(`Segreti che custodisci (nessuno li conosce; puoi tenerli, difenderli o, se decidi tu, rivelarli): ${s.secrets.map((x) => cut(x, 240)).join(' | ')}`);
  if ((s.goals || []).length) parts.push(`Cosa vuoi ottenere, senza dirlo: ${s.goals.map((x) => cut(x, 200)).join(' | ')}`);
  const here = new Set(G.agents.filter((o) => o !== a && o.alive).map((o) => o.name));
  const rel = (s.relations || []).filter((r) => here.has(r.to));
  if (rel.length) parts.push(`Persone che conoscevi già prima del naufragio: ${rel.map((r) => `${r.to} (${r.type}${r.view ? ': ' + cut(r.view, 160) : ''})`).join('; ')}.`);
  return parts.length ? `\nLA TUA SCHEDA (è così che sei; resta coerente con questo, anche nel modo di parlare):\n${parts.join('\n')}\n` : '';
}
