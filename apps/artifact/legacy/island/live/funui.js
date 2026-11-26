
/* =================== fun layer: gestures, mood faces, names on the map, habit traces, pets, spectacles, bets, album, replay, records, relations =================== */
const FUN = { gest: {}, tags: {}, names: {}, vis: {}, spect: {} }; window._FUN = FUN;
const NOMOVE = ['walk', 'run', 'swim', 'sleep', 'dead', 'think', 'swing', 'sick'];
function funAnim(a, anim) {
  const g = a.gesture; if (!g) return anim; const st = FUN.gest[a.id] || (FUN.gest[a.id] = { n: g.n, until: 0 });
  if (st.n !== g.n) { st.n = g.n; st.until = performance.now() + 5500; }
  return performance.now() < st.until && a.alive && !a.asleep && !NOMOVE.includes(anim) ? g.anim : anim;
}
const _v3 = new THREE.Vector3();
function toScreen(x, y, z) { _v3.set(x, y, z).project(SC.camera); if (_v3.z > 1 || Math.abs(_v3.x) > 1.1 || Math.abs(_v3.y) > 1.1) return null; return [(_v3.x + 1) / 2 * innerWidth, (1 - _v3.y) / 2 * innerHeight]; }
function tagEl(store, key, cls) { let d = store[key]; if (!d) { d = store[key] = document.createElement('div'); d.className = cls; document.body.appendChild(d); } return d; }
function funTags(G) {
  const now = performance.now(); const seen = new Set();
  G.agents.forEach((a) => {
    const d = tagEl(FUN.tags, a.id, 'moodTag'); seen.add(a.id); const P = meshes[a.id];
    if (!a.alive || a.departed || !P || !P.root.visible) { d.style.display = 'none'; return; }
    const st = FUN.gest[a.id]; const gest = a.gesture && st && now < st.until;
    const txt = gest ? `${a.gesture.emoji} ${a.gesture.text}` : a.asleep ? '💤' : ENG.moodEmoji(a);
    if (!txt) { d.style.display = 'none'; return; }
    const s = toScreen(P.root.position.x, P.root.position.y + 2.55, P.root.position.z); if (!s) { d.style.display = 'none'; return; }
    d.style.display = 'block'; d.classList.toggle('big', !!gest); setText(d, txt); d.style.left = `${s[0] + (gest ? 0 : 16)}px`; d.style.top = `${s[1]}px`;
    d.title = a.emotion ? `${a.name}: ${a.emotion}` : a.name;
  });
}
function funNames(G) {
  const W = G.world; const list = W.names || []; const live = new Set();
  list.forEach((n) => {
    const key = n.name; live.add(key); const d = tagEl(FUN.names, key, 'isleName');
    let pos = null;
    if (n.animal) { if (n.animal === 'cane' && SC.dog && SC.dog.visible) pos = [SC.dog.position.x, SC.dog.position.y + 1.1, SC.dog.position.z]; else { const c = W.custom.find((x) => x.animal && x.name.toLowerCase() === n.animal); if (c) pos = [c.loc[0], SC.groundH(c.loc[0], c.loc[1]) + 1.2, c.loc[1]]; } }
    else if (n.obj != null) { const c = W.custom.find((x) => x.id === n.obj); if (c) pos = [c.loc[0], SC.groundH(c.loc[0], c.loc[1]) + 1.2, c.loc[1]]; }
    else if (n.buddy || (n.thing && W.buddy && String(n.what).toLowerCase().includes(W.buddy.what))) { const B = FUN.vis.buddy; if (B) pos = [B.position.x, B.position.y + 0.9, B.position.z]; }
    else if (n.thing) pos = null;
    else if (n.loc) pos = [n.loc[0], SC.groundH(n.loc[0], n.loc[1]) + 2.2, n.loc[1]];
    const s = pos && toScreen(pos[0], pos[1], pos[2]); if (!s) { d.style.display = 'none'; return; }
    const pet = n.animal && W.pets && W.pets[n.animal];
    d.style.display = 'block'; setText(d, `${n.animal ? '🐾' : n.obj != null || n.thing ? '🏷' : '📍'} ${n.name}`); d.title = `${n.what}: nome dato da ${n.by} (giorno ${n.day})${pet ? ` — compagno di ${pet.owner}` : ''}`; d.style.left = `${s[0]}px`; d.style.top = `${s[1]}px`;
  });
  // unnamed pets get a small heart
  Object.entries(W.pets || {}).forEach(([k, p]) => { if (list.some((n) => n.animal === k)) return; const key = 'pet:' + k; live.add(key); const d = tagEl(FUN.names, key, 'isleName pet');
    let pos = null; if (k === 'cane' && SC.dog && SC.dog.visible) pos = SC.dog.position; const s = pos && toScreen(pos.x, pos.y + 1.1, pos.z); if (!s) { d.style.display = 'none'; return; }
    d.style.display = 'block'; setText(d, '❤'); d.title = `compagno di ${p.owner}`; d.style.left = `${s[0]}px`; d.style.top = `${s[1]}px`; });
  Object.keys(FUN.names).forEach((k) => { if (!live.has(k)) { FUN.names[k].remove(); delete FUN.names[k]; } });
}

/* traces of habits: a tally post, little stone towers, a coconut friend with a face */
function funTraces(G) {
  const W = G.world; const V = FUN.vis; const L = LOC.shelter;
  if (W.tally) { const n = Math.min(60, G.day - W.tally.start + 1);
    if (!V.tally) { V.tally = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6), SC.M(0x8a6a44)); post.position.y = 0.8; V.tally.add(post); const x = L[0] - 2.2, z = L[1] - 1.4; V.tally.position.set(x, SC.groundH(x, z), z); SC.scene.add(V.tally); V.notches = []; }
    while (V.notches.length < n) { const k = V.notches.length; const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, k % 5 === 4 ? 0.02 : 0.11, 0.02), new THREE.MeshBasicMaterial({ color: 0x2b1d10 }));
      const col = Math.floor(k / 5), i = k % 5; if (i === 4) { m.rotation.z = 0.9; m.scale.x = 12; m.position.set(0.13, 1.35 - col * 0.15, 0); } else m.position.set(0.13, 1.35 - col * 0.15, -0.06 + i * 0.035); m.rotation.y = 0; V.tally.add(m); V.notches.push(m); } }
  if (W.cairns) { V.cairns = V.cairns || [];
    while (V.cairns.length < W.cairns) { const k = V.cairns.length; const g = new THREE.Group(); const a = k * 2.399; const r = 3.2 + (k % 3) * 0.7; const x = L[0] + Math.cos(a) * r, z = L[1] + Math.sin(a) * r; let y = 0;
      for (let i = 0; i < 3 + (k % 3); i++) { const s = 0.2 - i * 0.03; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), SC.M(i % 2 ? 0x9a948a : 0x7d776d)); y += s * 0.9; m.position.y = y; y += s * 0.6; m.scale.y = 0.6; m.rotation.y = i; g.add(m); }
      g.position.set(x, SC.groundH(x, z), z); SC.scene.add(g); V.cairns.push(g); } }
  if (W.buddy && !V.buddy) { const g = new THREE.Group(); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), SC.M(/pallone|palla/.test(W.buddy.what) ? 0xf2efe6 : /sasso/.test(W.buddy.what) ? 0x8f8a80 : 0x6b4a2b)); ball.position.y = 0.22; g.add(ball);
    const ink = new THREE.MeshBasicMaterial({ color: 0x8a1c10 }); [[-0.07, 0.3], [0.07, 0.3]].forEach(([x, y]) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), ink); e.position.set(x, y, 0.2); g.add(e); });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 4, 10, Math.PI), ink); mouth.position.set(0, 0.2, 0.2); mouth.rotation.z = Math.PI; g.add(mouth);
    const x = L[0] + 1.1, z = L[1] + 1.8; g.position.set(x, SC.groundH(x, z), z); g.rotation.y = -0.6; SC.scene.add(g); V.buddy = g; }
}

/* natural spectacles */
function funSpect(G) {
  const W = G.world; const S = FUN.spect; const now = ENG.T(); const sp = W.spect && W.spect.until > now ? W.spect : null; const t = performance.now() / 1000;
  const fade = sp ? Math.min(1, (now - sp.from) / 0.15, (sp.until - now) / 0.2) : 0;
  // rainbow: a soft arc over the view (the camera rarely sees the horizon)
  if (!S.rainbow) { S.rainbow = document.createElement('div'); S.rainbow.id = 'rainbowFx'; document.body.appendChild(S.rainbow); }
  const rb = sp && sp.kind === 'arcobaleno' ? fade : 0; S.rainbow.style.opacity = rb.toFixed(2);
  // fireflies
  if (!S.flies) { const n = 140; const g = new THREE.BufferGeometry(); const arr = new Float32Array(n * 3); const pl = [ENG.PLACES.foresta, ENG.PLACES.boscaglia, ENG.PLACES.radura].filter(Boolean); S.fly0 = [];
    for (let i = 0; i < n; i++) { const p = pl.length ? pl[i % pl.length].loc : [0, 0]; const x = p[0] + (Math.random() - 0.5) * 16, z = p[1] + (Math.random() - 0.5) * 16; S.fly0.push([x, SC.groundH(x, z) + 0.4 + Math.random() * 1.6, z, Math.random() * 6]); arr.set([x, 0, z], i * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); S.flies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8ff6a, size: 0.22, transparent: true, opacity: 0, depthWrite: false })); S.flies.userData.noFow = true; SC.scene.add(S.flies); }
  const fl = sp && sp.kind === 'lucciole' ? fade : 0; S.flies.visible = fl > 0.01;
  if (S.flies.visible) { const a = S.flies.geometry.attributes.position; S.fly0.forEach((f, i) => { a.setXYZ(i, f[0] + Math.sin(t * 0.7 + f[3]) * 0.6, f[1] + Math.sin(t * 1.3 + f[3] * 2) * 0.25, f[2] + Math.cos(t * 0.6 + f[3]) * 0.6); }); a.needsUpdate = true; S.flies.material.opacity = fl * (0.55 + 0.45 * Math.sin(t * 3)); }
  // shooting stars
  if (!S.star) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)); S.star = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false })); S.star.userData.noFow = true; SC.scene.add(S.star); S.starT = -9; }
  const st = sp && sp.kind === 'stelle'; if (st && t - S.starT > 1.8 + Math.random() * 2) { S.starT = t; S.starA = [-60 + Math.random() * 120, 55 + Math.random() * 20, -80 + Math.random() * 40]; S.starD = [-(10 + Math.random() * 20), -(6 + Math.random() * 8), Math.random() * 8]; }
  const k = (t - S.starT) / 0.7; S.star.visible = !!st && k >= 0 && k <= 1;
  if (S.star.visible) { const p = S.star.geometry.attributes.position; const a0 = S.starA, d0 = S.starD; p.setXYZ(0, a0[0] + d0[0] * k, a0[1] + d0[1] * k, a0[2] + d0[2] * k); p.setXYZ(1, a0[0] + d0[0] * (k + 0.25), a0[1] + d0[1] * (k + 0.25), a0[2] + d0[2] * (k + 0.25)); p.needsUpdate = true; S.star.material.opacity = 1 - k; }
  // whales
  if (!S.whales) { S.whales = new THREE.Group(); const mat = new THREE.MeshPhongMaterial({ color: 0x4f5d6b, flatShading: true }); for (let i = 0; i < 2; i++) { const w = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat); b.scale.set(1.5, 0.6, 3.8); w.add(b); const tail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.9), mat); tail.position.z = -3.4; w.add(tail);
      const sp2 = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 30 }, (_, j) => [(Math.random() - 0.5) * 0.6, 0.6 + (j / 10) % 3, (Math.random() - 0.5) * 0.6 + 1.5]).flat(), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.8 })); w.add(sp2); w.userData.spout = sp2; S.whales.add(w); }
    const R = IslandSim.ISL.R(0.3) * 1.9 + 14; S.whales.position.set(Math.cos(0.3) * R, 0, Math.sin(0.3) * R); S.whales.userData.noFow = true; S.whales.traverse((o) => { o.userData.noFow = true; }); SC.scene.add(S.whales); }
  const wh = sp && sp.kind === 'balene'; S.whales.visible = !!wh;
  if (wh && (!S.whaleAt || t - S.whaleAt > 6)) { S.whaleAt = t; const f = SC.camera.getWorldDirection(_v3); f.y = 0; f.normalize(); const cp = SC.camera.position; let best = null; for (let d = 6; d < 170 && !best; d += 4) for (const side of [0, -0.35, 0.35, -0.7, 0.7]) { const dx = f.x * Math.cos(side) - f.z * Math.sin(side), dz = f.x * Math.sin(side) + f.z * Math.cos(side); const x = cp.x + dx * d, z = cp.z + dz * d; if (SC.groundH(x, z) > -1.5) continue; const sc = toScreen(x, 0, z); if (sc && sc[1] > innerHeight * 0.1 && sc[1] < innerHeight * 0.65 && sc[0] > innerWidth * 0.1 && sc[0] < innerWidth * 0.9) { best = [x, z]; break; } }
    if (best) S.whales.position.set(best[0], 0, best[1]); }
  if (wh) S.whales.children.forEach((w, i) => { const ph = t * 0.5 + i * 2.2; const up = Math.sin(ph); w.position.set(i * 5 + Math.sin(t * 0.05) * 3, -0.3 + up * 0.65, i * 4); w.rotation.x = Math.cos(ph) * 0.25; w.userData.spout.visible = up > 0.6; w.rotation.y = 1.2; });
  // glowing plankton: the shoreline foam turns blue
  if (!S.glow) { const pts = []; for (let i = 0; i < 260; i++) { const a = i / 260 * Math.PI * 2; const r = IslandSim.ISL.R(a) + 0.3 + Math.random() * 1.2; pts.push(Math.cos(a) * r, 0.05, Math.sin(a) * r); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); S.glow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x4fd8ff, size: 0.35, transparent: true, opacity: 0, depthWrite: false })); S.glow.userData.noFow = true; SC.scene.add(S.glow); }
  const gl = sp && sp.kind === 'plancton' ? fade : 0; S.glow.visible = gl > 0.01; if (S.glow.visible) S.glow.material.opacity = gl * (0.5 + 0.4 * Math.sin(t * 2));
}

// speech bubbles of people standing close (a circle, a group) are stacked instead of piling up on each other
function deoverlapBubbles() {
  const now = performance.now(); if (now - (deoverlapBubbles.t || 0) < 150) return; deoverlapBubbles.t = now;
  const bs = [...document.querySelectorAll('.bubble')].filter((b) => b.style.opacity !== '0' && b.textContent);
  if (bs.length < 2) { bs.forEach((b) => { if (b.style.marginTop) b.style.marginTop = ''; }); return; }
  const R = bs.map((b) => { const r = b.getBoundingClientRect(); const m = parseFloat(b.style.marginTop) || 0; return { b, left: r.left, right: r.right, top: r.top - m, bottom: r.bottom - m }; }).sort((p, q) => q.bottom - p.bottom);
  const placed = [];
  R.forEach((it) => { let top = it.top, bot = it.bottom; for (let g = 0, moved = true; moved && g < 8; g++) { moved = false; for (const p of placed) { if (it.left < p.right - 4 && it.right > p.left + 4 && top < p.bottom + 4 && bot > p.top - 4) { const dy = bot - (p.top - 6); top -= dy; bot -= dy; moved = true; } } }
    const shift = Math.round(top - it.top); const want = shift ? `${shift}px` : ''; if (it.b.style.marginTop !== want) it.b.style.marginTop = want; placed.push({ left: it.left, right: it.right, top, bottom: bot }); });
}
function funFrame() { const G = ENG.G; if (!G) return; try { funTags(G); funNames(G); funTraces(G); funSpect(G); if (!window.__noDeo) deoverlapBubbles(); } catch (e) { if (!funFrame.w) { funFrame.w = 1; console.warn('fun frame', e); } } }

/* ---------- a shared modal card ---------- */
function funCard(title, html, wide) {
  let el = $('funCard'); if (!el) { el = document.createElement('div'); el.id = 'funCard'; el.className = 'card'; el.hidden = true; document.body.appendChild(el); el.addEventListener('click', (e) => { if (e.target.dataset.close != null) { el.hidden = true; if (FUN.replayStop) FUN.replayStop(); } }); }
  el.classList.toggle('wide', !!wide); el.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">${title}</h3><button data-close title="Chiudi">✕</button></div><div class="funBody">${html}</div>`; el.hidden = false; return el;
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('funCard') && !$('funCard').hidden) { $('funCard').hidden = true; if (FUN.replayStop) FUN.replayStop(); } });

/* ---------- relations ---------- */
const POS_W = /fiduc|affett|stim|amic|ammir|grat|simpat|mi piace|vicin|protegg|car[oa]\b|rispett|allea|gentil|aiut|sollievo|compagn|affidabil|tenerezz|bene/i;
const NEG_W = /sospett|diffid|risent|rabbi|odi|paura|minacc|irrit|fastid|gelos|disprezz|non mi fido|egoist|pericol|nemic|ladr|bugiard|arrogan|prepoten|ostil|delus|tradit|antipat|insopport/i;
function relScore(t) { t = String(t || ''); const p = (t.match(new RegExp(POS_W.source, 'gi')) || []).length; const n = (t.match(new RegExp(NEG_W.source, 'gi')) || []).length; return p - n * 1.2; }
function showRelations() {
  const G = ENG.G; if (!G) return; const ag = G.agents.filter((a) => !a.departed); if (ag.length < 2) { funCard('❤️ Relazioni', '<p>Sull\'isola c\'è una sola persona: le relazioni nasceranno quando arriverà qualcun altro.</p>'); return; }
  const W = 560, H = 380, cx = W / 2, cy = H / 2 + 6, R = Math.min(150, 60 + ag.length * 18); const P = {}; ag.forEach((a, i) => { const t = -Math.PI / 2 + i / ag.length * Math.PI * 2; P[a.name] = [cx + Math.cos(t) * R, cy + Math.sin(t) * R]; });
  let edges = ''; const rows = [];
  ag.forEach((a) => Object.entries(a.relations || {}).forEach(([b, txt]) => { if (!P[b] || b === a.name) return; const s = relScore(txt); const col = s > 0.5 ? '#2f8f46' : s < -0.5 ? '#b5352a' : '#8a7f6a'; const [x1, y1] = P[a.name], [x2, y2] = P[b]; const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
    edges += `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" stroke="${col}" stroke-width="${1.5 + Math.min(3, Math.abs(s))}" fill="none" marker-end="url(#ar${col.slice(1)})" opacity=".85"><title>${esc(a.name)} → ${esc(b)}: ${esc(txt)}</title></path>`;
    rows.push(`<tr><td><b>${esc(a.name)}</b> → ${esc(b)}</td><td style="color:${col}">${s > 0.5 ? 'positiva' : s < -0.5 ? 'negativa' : 'incerta'}</td><td><i>«${esc(txt)}»</i></td></tr>`); }));
  const marks = ['2f8f46', 'b5352a', '8a7f6a'].map((c) => `<marker id="ar${c}" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#${c}"/></marker>`).join('');
  const nodes = ag.map((a) => { const [x, y] = P[a.name]; const c = '#' + ((a.colors && a.colors.shirt) || 0x888888).toString(16).padStart(6, '0'); return `<g><circle cx="${x}" cy="${y}" r="20" fill="${c}" stroke="#4a3a24" stroke-width="2" opacity="${a.alive ? 1 : 0.35}"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="17">${a.alive ? ENG.moodEmoji(a) || '🙂' : '✝'}</text><text x="${x}" y="${y + 36}" text-anchor="middle" font-size="13" font-weight="700" fill="#3a2e1c">${esc(a.name)}</text></g>`; }).join('');
  funCard('❤️ Relazioni', `<div class="legend">Come ognuno vede gli altri, con le sue parole all'ultima decisione. Freccia verde: positiva; rossa: negativa; grigia: incerta. Passa sopra una freccia per leggere.</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-height:52vh"><defs>${marks}</defs>${edges}${nodes}</svg><div style="max-height:22vh;overflow:auto"><table class="relT">${rows.join('') || '<tr><td>Nessuno ha ancora espresso cosa pensa degli altri.</td></tr>'}</table></div>`, true);
}

/* ---------- bets ---------- */
const BETS = [
  ['mangia', '🍽 mangerà', 1, (a, b) => a.actLog && a.actLog.some((x) => x.t >= b.from && /mangia|cucina/.test(x.type))],
  ['pesca', '🎣 andrà a pescare', 2, (a, b) => a.actLog && a.actLog.some((x) => x.t >= b.from && /pesca/.test(x.type))],
  ['costruisce', '🔨 costruirà o riparerà qualcosa', 2, (a, b) => a.actLog && a.actLog.some((x) => x.t >= b.from && /costruisci|ripara/.test(x.type))],
  ['esplora', '🧭 esplorerà', 2, (a, b) => a.actLog && a.actLog.some((x) => x.t >= b.from && /esplora/.test(x.type))],
  ['fuoco', '🔥 si occuperà del fuoco', 2, (a, b) => a.actLog && a.actLog.some((x) => x.t >= b.from && /fuoco/.test(x.type))],
  ['dorme', '😴 andrà a dormire', 1, (a, b) => a.asleep || (a.actLog && a.actLog.some((x) => x.t >= b.from && x.type === 'dormi'))],
  ['parla', '💬 parlerà con qualcuno', 1, (a, b, G) => G.chronicle.some((c) => c.kind === 'speech' && (c.day - 1) * 24 + c.h >= b.from && c.text.startsWith(`💬 ${a.name}`))],
  ['litiga', '😠 litigherà con qualcuno', 3, (a, b, G) => G.chronicle.some((c) => (c.day - 1) * 24 + c.h >= b.from && c.text.includes(a.name) && /litig|urla contro|accus|spint|colpisc|minacc|rissa|aggred|insult/i.test(c.text))],
  ['nomina', '🏷 darà un nome a qualcosa', 3, (a, b, G) => G.chronicle.some((c) => (c.day - 1) * 24 + c.h >= b.from && c.text.startsWith(`🏷️ ${a.name}`))],
  ['gesto', '🎉 farà un gesto di gioia o di rabbia', 2, (a, b, G) => a.gesture && (a.gesture.day - 1) * 24 + a.gesture.h >= b.from],
];
function showBets() {
  const G = ENG.G; if (!G) return; const al = ENG.alive(); if (!al.length) return; G.bets = G.bets || [];
  const open = G.bets.filter((b) => b.result == null); const done = G.bets.filter((b) => b.result != null).slice(-8).reverse();
  const html = `<div class="legend">Scommetti su cosa farà un personaggio nelle prossime 6 ore dell'isola. Lui non sa nulla: decide da solo. Punteggio: <b>${G.betScore || 0}</b> punti.</div>
  <div class="row" style="gap:8px;margin:8px 0"><b>Chi:</b><select id="betWho">${al.map((a) => `<option value="${a.id}"${a.id === ui.selected ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
  <div class="betGrid">${BETS.map((b, i) => `<button class="fcard bet" data-bet="${i}"><b>${b[1]}</b><span>${b[2]} punt${b[2] > 1 ? 'i' : 'o'}</span></button>`).join('')}</div>
  ${open.length ? `<h4>In corso</h4>${open.map((b) => `<div>⏳ ${esc(b.who)} ${esc(b.label)} — scade giorno ${Math.floor(b.until / 24) + 1}, ${fmtH(b.until % 24)}</div>`).join('')}` : ''}
  ${done.length ? `<h4>Ultime</h4>${done.map((b) => `<div>${b.result ? '✅' : '❌'} ${esc(b.who)} ${esc(b.label)} ${b.result ? `(+${b.pts})` : ''}</div>`).join('')}` : ''}
  <div class="row" style="justify-content:flex-end;margin-top:8px"><button id="betSkip" title="Accelera fino al prossimo fatto interessante">⏭ Salta avanti</button></div>`;
  const el = funCard('🎲 Scommesse', html);
  el.querySelectorAll('[data-bet]').forEach((bt) => { bt.onclick = () => { const b = BETS[+bt.dataset.bet]; const a = G.agents.find((x) => x.id === $('betWho').value); if (!a) return; G.bets.push({ who: a.name, id: a.id, kind: b[0], label: b[1].replace(/^\S+\s/, ''), pts: b[2], from: ENG.T(), until: ENG.T() + 6, result: null }); ENG.save(); showBets(); }; });
  $('betSkip').onclick = () => { $('funCard').hidden = true; if (!G.running) setPlay(true); PACE.start(); };
}
function betsTick() {
  const G = ENG.G; if (!G || !G.bets) return; const now = ENG.T(); let changed = false;
  G.bets.filter((b) => b.result == null).forEach((b) => { const a = G.agents.find((x) => x.id === b.id); const def = BETS.find((x) => x[0] === b.kind); if (!a || !def) { b.result = false; changed = true; return; }
    let ok = false; try { ok = !!def[3](a, b, G); } catch (e) {}
    if (ok) { b.result = true; G.betScore = (G.betScore || 0) + b.pts; changed = true; funToast(`🎲 Scommessa vinta: ${b.who} ${b.label} (+${b.pts})`); }
    else if (now > b.until || !a.alive) { b.result = false; changed = true; funToast(`🎲 Scommessa persa: ${b.who} non ${b.label.replace(/^(\S+)/, '$1')}`); } });
  if (changed) { ENG.save(); if ($('funCard') && !$('funCard').hidden && $('funCard').querySelector('#betWho')) showBets(); }
  const n = G.bets.filter((b) => b.result == null).length; setText($('betBtn'), n ? `🎲 ${n}` : '🎲');
}
function funToast(msg) { const t = $('toast'); if (!t) return; t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 4500); }

/* ---------- album: photos + illustrated diary ---------- */
const svgUrl = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
function showAlbum(tab) {
  const G = ENG.G; if (!G) return; tab = tab || 'foto';
  const ph = photos.filter((p) => p && p.src && (p.game == null || p.game === G.seed));
  const di = (G.diary || []).slice().reverse();
  const body = tab === 'foto'
    ? (ph.length ? `<div class="albumGrid">${ph.map((p) => `<figure data-ph="${photos.indexOf(p)}"><img src="${p.src}" alt=""><figcaption>G${p.day} ${fmtH(p.h)} ${esc(p.label || '')}</figcaption></figure>`).join('')}</div>` : '<p>Le foto si scattano da sole nei momenti salienti e ogni 4 ore di luce.</p>')
    : (di.length ? di.map((d) => `<div class="diaryPage"><div class="dpHead">Giorno ${d.day} — ${esc(d.agent)}</div><div class="dpRow">${d.svg ? `<figure><img src="${svgUrl(d.svg)}" alt="schizzo"><figcaption>${esc(d.caption || '')}</figcaption></figure>` : ''}<p>${esc(d.text)}</p></div></div>`).join('') : '<p>Ogni sera, quando un personaggio va a dormire, scrive due righe e fa uno schizzo.</p>');
  const el = funCard('📸 Album e diario', `<div class="row" style="gap:6px;margin-bottom:8px"><button data-tab="foto" class="${tab === 'foto' ? 'on' : ''}">📸 Foto (${ph.length})</button><button data-tab="diario" class="${tab === 'diario' ? 'on' : ''}">📔 Diario illustrato (${di.length})</button><span style="flex:1"></span><button id="albTl" title="Rivedi le foto in sequenza">▶ Timelapse</button><button id="albPdf">⬇ Scarica album (PDF)</button></div><div style="max-height:62vh;overflow:auto">${body}</div>
  <label style="display:block;margin-top:6px;font-size:12px"><input type="checkbox" id="albArt" ${G.diaryArt === false ? '' : 'checked'}> Schizzi del diario (una piccola chiamata a Claude per personaggio ogni sera)</label>`, true);
  el.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => showAlbum(b.dataset.tab); });
  el.querySelectorAll('[data-ph]').forEach((f) => { f.onclick = () => showPhoto(+f.dataset.ph); });
  $('albTl').onclick = () => timeLapse(); $('albPdf').onclick = () => albumPDF($('albPdf'));
  $('albArt').onchange = () => { G.diaryArt = $('albArt').checked; ENG.save(); };
}
function svgToPng(svg, w, h) { return new Promise((res) => { const img = new Image(); img.onload = () => { try { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h); res(c.toDataURL('image/png')); } catch (e) { res(null); } }; img.onerror = () => res(null); img.src = svgUrl(svg); }); }
async function albumPDF(btn) {
  const G = ENG.G; if (!G) return; const lbl = btn.textContent; btn.disabled = true; btn.textContent = '⏳ Preparo…';
  try {
    const { jsPDF } = await loadJsPDF(); const doc = new jsPDF({ unit: 'mm', format: 'a4' }); const PW = 210, M = 14, TW = PW - 2 * M; let y = M;
    const ensure = (h) => { if (y + h > 285) { doc.addPage(); y = M; } };
    doc.setFont('times', 'bold'); doc.setFontSize(24); doc.text(pdfClean(`Album dell'isola`), PW / 2, 40, { align: 'center' }); doc.setFont('times', 'italic'); doc.setFontSize(13);
    doc.text(pdfClean(`${G.agents.map((a) => a.name).join(', ')} — ${G.day} giorni`), PW / 2, 50, { align: 'center' }); y = 64;
    const ph = photos.filter((p) => p && p.src && (p.game == null || p.game === G.seed)); const cw = (TW - 6) / 2, ch = cw * 9 / 16;
    ph.forEach((p, i) => { const col = i % 2; if (col === 0) ensure(ch + 10); try { doc.addImage(p.src, 'JPEG', M + col * (cw + 6), y, cw, ch); } catch (e) {} doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(doc.splitTextToSize(pdfClean(`Giorno ${p.day} ${fmtH(p.h)} ${p.label || ''}`), cw)[0] || '', M + col * (cw + 6), y + ch + 4); if (col === 1 || i === ph.length - 1) y += ch + 9; });
    const di = G.diary || []; if (di.length) { doc.addPage(); y = M; doc.setFont('times', 'bold'); doc.setFontSize(18); doc.text('Diario illustrato', M, y + 6); y += 14;
      for (const d of di) { const png = d.svg ? await svgToPng(d.svg, 480, 320) : null; const lines = doc.splitTextToSize(pdfClean(d.text), png ? TW - 66 : TW); const hh = Math.max(png ? 46 : 0, lines.length * 5 + 10); ensure(hh + 4);
        doc.setFont('times', 'bold'); doc.setFontSize(11); doc.text(pdfClean(`Giorno ${d.day} — ${d.agent}`), M, y + 4);
        if (png) { try { doc.addImage(png, 'PNG', M, y + 7, 60, 40); } catch (e) {} doc.setFont('times', 'italic'); doc.setFontSize(8); doc.text(pdfClean(d.caption || ''), M, y + 51); }
        doc.setFont('times', 'italic'); doc.setFontSize(11); doc.text(lines, png ? M + 66 : M, y + 11); y += hh + 6; } }
    const res = await saveFile(`album-isola-giorno${G.day}.pdf`, doc.output('blob')); funToast(res === 'saved' ? '📸 Album salvato.' : res === 'declined' ? 'Download annullato.' : '📸 Album pronto.');
  } catch (e) { funToast('Non riesco a creare il PDF dell\'album.'); }
  btn.disabled = false; btn.textContent = lbl;
}

/* ---------- replay on a map ---------- */
function showReplay() {
  const G = ENG.G; if (!G) return; const tr = G.track || []; if (tr.length < 2) { funCard('🎞 Replay', '<p>Il replay si registra un\'ora di gioco alla volta: torna tra qualche ora dell\'isola.</p>'); return; }
  const el = funCard('🎞 Replay della partita', `<canvas id="rpCv" width="640" height="460" style="width:100%;background:#1d4f6e;border-radius:6px"></canvas><div class="row" style="gap:8px;align-items:center;margin-top:6px"><button id="rpPlay">⏸</button><input id="rpPos" type="range" min="0" max="${tr.length - 1}" value="0" style="flex:1"><select id="rpSpd"><option value="4">lento</option><option value="10" selected>normale</option><option value="25">veloce</option></select></div><div id="rpCap" class="legend" style="min-height:2.6em"></div>`, true);
  const cv = $('rpCv'); const ctx = cv.getContext('2d'); const ISL = IslandSim.ISL; let Rmax = 0; for (let i = 0; i < 128; i++) Rmax = Math.max(Rmax, ISL.R(i / 128 * Math.PI * 2)); Rmax += 4;
  const N = 150; const base = document.createElement('canvas'); base.width = base.height = N; { const bx = base.getContext('2d'); const img = bx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i / (N - 1) * 2 - 1) * Rmax, z = (j / (N - 1) * 2 - 1) * Rmax; const h = SC.groundH(x, z); const c = h < -0.8 ? [29, 79, 110] : h < 0 ? [47, 127, 166] : h < 0.2 ? [232, 215, 166] : h < 1.3 ? [127 - 30 * h, 174 - 38 * h, 90 - 23 * h] : [150, 140, 118]; const o = (j * N + i) * 4; img.data.set([c[0], c[1], c[2], 255], o); }
    bx.putImageData(img, 0, 0); }
  const S = Math.min(cv.width, cv.height); const ox = (cv.width - S) / 2; const px = (x, z) => [ox + (x / Rmax * 0.5 + 0.5) * S, (z / Rmax * 0.5 + 0.5) * S];
  const col = (id) => { const a = G.agents.find((x) => x.id === id); return '#' + ((a && a.colors && a.colors.shirt) || 0xffffff).toString(16).padStart(6, '0'); };
  const nm = (id) => { const a = G.agents.find((x) => x.id === id); return a ? a.name : id; };
  const hl = (G.highlights || []); let i = 0, playing = true, acc = 0, last = performance.now(), raf = 0;
  function draw() {
    ctx.fillStyle = '#1d4f6e'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = true; ctx.drawImage(base, ox, 0, S, S);
    (G.world.names || []).forEach((n) => { if (!n.loc) return; const [x, y] = px(n.loc[0], n.loc[1]); ctx.fillStyle = 'rgba(255,248,225,.9)'; ctx.font = 'italic 12px Georgia'; ctx.fillText(n.name, x + 4, y); });
    const fr = tr[i]; const ids = Object.keys(fr.p);
    ids.forEach((id) => { ctx.strokeStyle = col(id); ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.beginPath(); let started = false; for (let k = Math.max(0, i - 36); k <= i; k++) { const q = tr[k].p[id]; if (!q) { started = false; continue; } const [x, y] = px(q[0], q[1]); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); } ctx.stroke(); ctx.globalAlpha = 1;
      const q = fr.p[id]; const [x, y] = px(q[0], q[1]); ctx.fillStyle = col(id); ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.fillText(nm(id), x + 8, y - 6); });
    const night = fr.h >= 20 || fr.h < 6; if (night) { ctx.fillStyle = 'rgba(10,20,50,.35)'; ctx.fillRect(0, 0, cv.width, cv.height); }
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, 8, 170, 30); ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Inter, sans-serif'; ctx.fillText(`Giorno ${fr.d} · ${String(fr.h).padStart(2, '0')}:00 ${night ? '🌙' : '☀️'}`, 16, 29);
    const tNow = (fr.d - 1) * 24 + fr.h; const recent = hl.filter((x) => { const t = (x.day - 1) * 24 + x.h; return t <= tNow + 0.5 && t > tNow - 5; }).slice(-2);
    recent.forEach((x) => { if (x.loc) { const [mx, my] = px(x.loc[0], x.loc[1]); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 11, 0, Math.PI * 2); ctx.stroke(); } });
    $('rpCap').textContent = recent.map((x) => `⭐ ${x.text}`).join('  ·  '); $('rpPos').value = i;
  }
  function loop(n) { if ($('funCard').hidden || !$('rpCv')) return; const dt = (n - last) / 1000; last = n; if (playing) { acc += dt * +$('rpSpd').value; while (acc >= 1) { acc -= 1; if (i < tr.length - 1) i++; else playing = false; } $('rpPlay').textContent = playing ? '⏸' : '▶'; } draw(); raf = requestAnimationFrame(loop); }
  $('rpPlay').onclick = () => { if (i >= tr.length - 1) i = 0; playing = !playing; }; $('rpPos').oninput = () => { i = +$('rpPos').value; };
  FUN.replayStop = () => { cancelAnimationFrame(raf); FUN.replayStop = null; }; draw(); raf = requestAnimationFrame(loop);
}

/* ---------- records ---------- */
const REC_KEY = 'isola-classifica';
function loadRecords() { try { return JSON.parse(localStorage.getItem(REC_KEY) || '[]'); } catch (e) { return []; } }
function runRecord(G) { const ch = typeof challengesHtml === 'function' ? (challengesHtml(G).match(/punteggio: <b>(\d+)/) || [0, 0])[1] : 0; return { seed: G.seed, date: new Date().toLocaleDateString('it-IT'), who: G.agents.filter((a) => !a.departed || a.alive).map((a) => a.name).slice(0, 5).join(', '), days: G.day, age: ENG.AGES[G.age || 0], alive: G.agents.filter((a) => a.alive).length, total: G.agents.length, interventions: (G.interventions || []).length, rescued: !!G.rescued, outcome: String(G.ended || 'in corso').slice(0, 80), score: (+ch || 0) + (G.betScore || 0) + (G.age || 0) * 5 + Math.min(60, G.day), mondo: G.resMode || 'normali', forzata: !!G.forced, gs: ENG.groupStats() }; }
function recordEnd() { const G = ENG.G; if (!G || !G.ended || G._recorded) return; G._recorded = true; const r = loadRecords().filter((x) => x.seed !== G.seed); r.push(runRecord(G)); r.sort((a, b) => b.score - a.score); try { localStorage.setItem(REC_KEY, JSON.stringify(r.slice(0, 30))); } catch (e) {} ENG.save(); }
function showRecords() {
  const G = ENG.G; const rows = loadRecords().slice(); const cur = G && !G.ended ? runRecord(G) : null;
  const MW = { normali: 'realistico', abbondanti: 'abbondanza', scarse: 'scarsità', paradiso: '🌴 paradiso' };
  const tr = (r, i, me) => { const g = r.gs || {}; return `<tr${me ? ' class="me"' : ''}><td>${me ? '▶' : i + 1}</td><td>${esc(r.date)}</td><td>${esc(r.who)}</td><td>${esc(MW[r.mondo] || '—')}${r.forzata ? ' · forzata' : ''}</td><td>${r.days}</td><td>${esc(r.age)}</td><td>${r.alive}/${r.total}</td><td>${g.conflitti != null ? `⚡${g.conflitti} 🫳${g.furti} 🤲${g.aiuti} 🗣${g.cerchi}${g.accesi ? '/🔥' + g.accesi : ''}` : '—'}</td><td>${esc(g.leader || '—')}</td><td>${esc(g.isolato || '—')}</td><td>${g.umore != null ? g.umore : '—'}</td><td>${r.interventions}</td><td>${r.rescued ? '🚢 salvati' : esc(r.outcome)}</td><td><b>${r.score}</b></td></tr>`; };
  funCard('🏆 Classifica delle partite', `<div class="legend">Confronta esperimenti diversi: mondo (realistico, abbondanza, scarsità, paradiso; convivenza forzata), dinamiche del gruppo (⚡ conflitti, 🫳 furti, 🤲 aiuti, 🗣 cerchi e 🔥 quelli accesi), leader, isolato e umore medio. Punteggio: giorni (fino a 60) + 5 per età + sfide + scommesse. Le partite finite restano salvate in questo browser.</div>
  <div style="max-height:60vh;overflow:auto"><table class="recT"><tr><th>#</th><th>Data</th><th>Naufraghi</th><th>Mondo</th><th>Giorni</th><th>Età</th><th>Vivi</th><th title="conflitti, furti, aiuti, cerchi (accesi)">Gruppo</th><th title="chi parla e viene interpellato di più">Leader</th><th title="chi interagisce meno">Isolato</th><th>Umore</th><th>Interventi</th><th>Esito</th><th>Punti</th></tr>${cur ? tr(cur, 0, true) : ''}${rows.map((r, i) => tr(r, i, false)).join('') || '<tr><td colspan="14">Nessuna partita finita finora.</td></tr>'}</table></div>`, true);
}

/* ---------- stop the experiment for good (not a pause) ---------- */
function showStop() {
  const G = ENG.G; if (!G || G.ended) return; const wasRunning = G.running; if (wasRunning) setPlay(false);
  const el = funCard('⏹ Terminare l\'esperimento?', `<p>La simulazione finisce qui, al giorno ${G.day}: non si potrà riprendere. Restano il resoconto, il diario, l'album, il replay e la classifica.</p>
  <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px"><button id="stopFull" title="Claude scrive il capitolo finale e l'analisi dello scenario (alcune chiamate)">🏁 Termina e scrivi il finale</button><button id="stopQuiet" title="Nessun'altra chiamata a Claude">⏹ Termina subito, senza altre chiamate</button><button id="stopNo">Annulla</button></div>`);
  const end = (quiet) => { el.hidden = true; ENG.endGame(`Esperimento terminato dall'osservatore al giorno ${G.day}.`, quiet); };
  $('stopFull').onclick = () => end(false); $('stopQuiet').onclick = () => end(true); $('stopNo').onclick = () => { el.hidden = true; if (wasRunning) setPlay(true); };
}
/* ---------- island-wide resources ---------- */
function islandFill() { const G = ENG.G; if (!G) return; const sel = $('isWhere'); const ks = Object.keys(ENG.PLACES).filter((k) => !['mare'].includes(k)); const key = ks.join(); if (sel._k === key) return; sel._k = key;
  sel.innerHTML = '<option value="">📍 Luogo a caso</option>' + ks.map((k) => `<option value="${k}">${esc(k.replace(/_/g, ' '))}</option>`).join(''); }
function islandRun() {
  const G = ENG.G; if (!G) return; const what = $('isRes').value; const vis = $('isVis').value; const where = $('isWhere').value;
  let done;
  if (['pesce', 'frutta', 'legna_mare'].includes(what)) { done = ENG.applyOps([{ tipo: 'effetto', cosa: what }], 'isola'); }
  else done = ENG.applyOps([{ tipo: 'risorsa', cosa: what, luogo: where, visibile: vis === 'tutti', quante: $('isQty').value }], 'isola');
  setText($('isOut'), done && done.length ? '✓ ' + done.join('; ') : 'Nessun effetto.'); refreshPanel(true);
}
/* ---------- the group's interactions, step by step ---------- */
const SOC_ICON = { gioco: '🎲', incontro: '🤝', parla: '💬', parla_solo: '🗨', opinione: '💭', furto: '🫳', conflitto: '⚡', aiuto: '🤲', evento: '•' };
function showSocial(filter) {
  const G = ENG.G; if (!G) return; filter = filter || 'tutto'; const all = G.social || []; const days = [...new Set(all.map((s) => s.day).concat((G.socialDays || []).map((d) => d.day)))].sort((a, b) => b - a);
  if (filter === 'cerchi') { const el0 = funCard('👥 Interazioni del gruppo', `<div class="row" style="gap:6px;margin:6px 0">${[['tutto', 'Tutto'], ['parole', '💬 Parole'], ['opinioni', '💭 Opinioni'], ['tensioni', '⚡ Tensioni'], ['cerchi', '🗣 Cerchi']].map(([k, l]) => `<button data-sf="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}</div><div style="max-height:66vh;overflow:auto">${circlesHtml(G)}</div>`, true); el0.querySelectorAll('[data-sf]').forEach((b) => { b.onclick = () => showSocial(b.dataset.sf); }); return; }
  const keep = (s) => filter === 'tutto' || (filter === 'parole' ? ['parla', 'parla_solo'].includes(s.kind) : filter === 'tensioni' ? ['furto', 'conflitto'].includes(s.kind) : filter === 'opinioni' ? s.kind === 'opinione' : true);
  const html = days.map((d) => { const an = (G.socialDays || []).find((x) => x.day === d); const ev = all.filter((s) => s.day === d && keep(s));
    return `<div class="socDay"><h4>Giorno ${d}</h4>${an && an.text ? `<div class="socAn">🧠 ${esc(an.text)}</div>` : ''}${ev.map((s) => `<div class="socEv k-${s.kind}"><span class="t">${fmtH(s.h)}</span> ${SOC_ICON[s.kind] || '•'} ${esc(s.text)}</div>`).join('') || '<div class="legend">Niente in questa categoria.</div>'}</div>`; }).join('');
  const el = funCard('👥 Interazioni del gruppo', `<div class="legend">Tutto quello che succede tra i personaggi, passo passo: incontri, parole, opinioni che cambiano, aiuti, tensioni. Ogni mattina un'analisi del giorno prima (una piccola chiamata a Claude).</div>
  <div class="row" style="gap:6px;margin:6px 0">${[['tutto', 'Tutto'], ['parole', '💬 Parole'], ['opinioni', '💭 Opinioni'], ['tensioni', '⚡ Tensioni'], ['cerchi', '🗣 Cerchi']].map(([k, l]) => `<button data-sf="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}<span style="flex:1"></span><button id="socRel">❤️ Relazioni</button><button id="socDl">⬇ Scarica (testo)</button></div>
  <div style="max-height:62vh;overflow:auto">${html || '<p>Ancora nessuna interazione tra persone.</p>'}</div>`, true);
  el.querySelectorAll('[data-sf]').forEach((b) => { b.onclick = () => showSocial(b.dataset.sf); }); $('socRel').onclick = showRelations;
  $('socDl').onclick = () => { const txt = days.slice().reverse().map((d) => { const an = (G.socialDays || []).find((x) => x.day === d); return `GIORNO ${d}\n${an && an.text ? 'Analisi: ' + an.text + '\n' : ''}${all.filter((s) => s.day === d).map((s) => `${fmtH(s.h)} ${s.text}`).join('\n')}`; }).join('\n\n');
    saveFile(`interazioni-isola-giorno${G.day}.txt`, txt); };
}
/* ---------- a new castaway, configured like the initial ones ---------- */
function npFill() { if ($('npTemp').options.length) return; $('npTemp').innerHTML = TEMPERS.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); $('npCarry').innerHTML = carryHtml('np', []); }
function npRun() { const G = ENG.G; if (!G) return; const name = $('npName').value.trim(); if (!name) { setText($('npOut'), 'Scrivi un nome.'); return; }
  const done = ENG.addPerson({ name, sex: $('npSex').value, age: $('npAge').value, persona: withTemper($('npPers').value.trim(), $('npTemp').value), arrival: $('npArr').value, carry: [...document.querySelectorAll('[data-carry="np"]:checked')].map((x) => x.value) });
  if (done && done.length && typeof archAfterAdd === 'function') archAfterAdd(G.agents[G.agents.length - 1], $('npArch') ? $('npArch').value : '');
  setText($('npOut'), done && done.length ? '✓ ' + done.join('; ') : 'Non riuscito.'); $('npName').value = ''; $('npPers').value = ''; document.querySelectorAll('[data-carry="np"]').forEach((x) => { x.checked = false; }); refreshPanel(true); }
/* ---------- the character's sheet: what was set, editable during the game, and how his convictions change ---------- */
function splitTemper(p) { const m = String(p || '').match(/^(.*?)(?:;\s*)?temperamento\s+(\w+)\s*$/i); return m ? [m[1].trim(), m[2].toLowerCase()] : [String(p || ''), '']; }
function renderPersCard(force) {
  const G = ENG.G; const a = G && G.agents.find((x) => x.id === ui.selected); const box = $('persCard'); if (!a) { box.innerHTML = ''; return; }
  if (!force && box._id === a.id && box.contains(document.activeElement)) return; // don't disturb while editing
  const key = a.id + '|' + (a.beliefs || []).length + '|' + (a.habits || []).length + '|' + a.persona + '|' + a.alive + '|' + ENG.carriedOf(a).join() + a.inv.items.join(); if (!force && box._k === key) return; box._k = key; box._id = a.id;
  const [pers, temp] = splitTemper(a.persona); const carry = [...ENG.carriedOf(a).map((k) => ({ axe: 'ascia', knife: 'coltello', rod: 'canna', rope: 'corda' }[k])), ...a.inv.items];
  box.innerHTML = `<b>📋 Scheda di ${esc(a.name)}</b>${a.alive ? '' : ' <i>(morto)</i>'}
  <div class="pcGrid"><b>Sesso, età</b><span>${a.sex === 'f' ? 'donna' : 'uomo'}, ${a.age} anni</span><b>Come è arrivato</b><span>${esc(a.arrival || '—')}</span><b>Ha addosso</b><span>${esc(carry.join(', ') || 'niente')}</span>${a.bio ? `<b>La sua storia</b><span>${esc(String(a.bio).slice(0, 400))}</span>` : ''}${(a.habits || []).length ? `<b>Abitudini</b><span>${esc(a.habits.map((h) => h.text).join('; '))}</span>` : ''}</div>
  <label>Carattere (lui non lo sa: puoi cambiarlo in corsa)</label><textarea id="pcPers" style="min-height:44px">${esc(pers)}</textarea>
  <div class="row" style="gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap"><label style="margin:0">Temperamento</label><select id="pcTemp" style="width:auto">${TEMPERS.map(([v, l]) => `<option value="${v}"${temp === v ? ' selected' : ''}>${l}</option>`).join('')}</select><label style="margin:0;font-weight:400;white-space:nowrap;display:flex;gap:4px;align-items:center"><input type="checkbox" id="pcAmn" style="width:auto"${a.amnesia ? ' checked' : ''}> dimentica ogni notte</label><span style="flex:1"></span><button id="pcSave">💾 Applica</button></div><div id="pcOut" style="font-size:12px;color:var(--ink2)"></div>
  <div style="margin-top:6px"><b>🧭 Convinzioni (cambiano con ciò che vive)</b>${(a.beliefs || []).length ? a.beliefs.slice().reverse().map((b) => `<div class="pcBel"><i>G${b.day} ${fmtH(b.h)}</i> — ${esc(b.text)}</div>`).join('') : '<div class="pcBel"><i>Finora nessun cambiamento di idee.</i></div>'}</div>`;
  $('pcSave').onclick = () => { ENG.editPerson(a.id, { persona: withTemper($('pcPers').value.trim(), $('pcTemp').value), amnesia: $('pcAmn').checked }); setText($('pcOut'), '✓ Applicato: varrà dalla sua prossima decisione.'); box._k = ''; };
}
/* ---------- the circle ---------- */
function circleFill() { const sel = $('ciTopic'); if (sel.options.length) return; sel.innerHTML = ENG.CIRCLE_TOPICS.map((t) => `<option>${esc(t)}</option>`).join(''); }
async function circleRun() { const G = ENG.G; if (!G) return; const topic = $('ciFree').value.trim() || $('ciTopic').value; if (G.circleHaiku == null) G.circleHaiku = true;
  if (!G.running) setPlay(true); setText($('ciOut'), '🗣 Si forma il cerchio…'); $('ciRun').disabled = true;
  $('ciStop').disabled = false; const r = await ENG.startCircle({ topic, lines: $('ciLines').value, by: 'osservatore' }); $('ciRun').disabled = false; $('ciStop').disabled = true; setText($('ciOut'), r === 'fatto' ? '✓ Discussione finita: la trovi in 👥 Interazioni → 🗣 Cerchi.' : r); $('ciFree').value = ''; }
function circlesHtml(G) { return (G.circles || []).slice().reverse().map((c) => `<div class="socDay"><h4>🗣 Giorno ${c.day}, ${fmtH(c.h)} — ${esc(c.topic)} ${c.heat >= 3 ? '🔥' : ''}</h4><div class="legend">${esc(c.names.join(', '))}${c.by === 'serale' ? ' · cerchio serale' : ''}</div>${c.lines.map((l) => `<div class="socEv ${/acces|offes/.test(l.tono) ? 'k-conflitto' : /concil/.test(l.tono) ? 'k-aiuto' : ''}"><b>${esc(l.name)}</b>${l.to && l.to !== 'tutti' ? ' → ' + esc(l.to) : ''}${l.tono ? ` <i>(${esc(l.tono)})</i>` : ''}: ${esc(l.text)}</div>`).join('')}</div>`).join('') || '<p>Nessun cerchio ancora.</p>'; }
/* ---------- live panel of the circle: who says what to whom; the camera frames the circle ---------- */
const CP = { shown: true, n: -1, id: null };
function circlePanelEnsure() {
  if ($('circlePanel')) return; const p = document.createElement('div'); p.id = 'circlePanel';
  p.innerHTML = `<div class="cpHead"><div class="row" style="justify-content:space-between;align-items:center"><b>🗣 Discussione in corso</b><div class="cpBtns"><button id="cpCam" title="Inquadra il cerchio">🎥</button><button id="cpDl" title="Scarica la discussione (testo)">⬇</button><button id="cpStop" title="Sciogli il cerchio">✋</button><button id="cpX" title="Chiudi il pannello (la discussione continua)">✕</button></div></div><div class="cpTopic" id="cpTopic"></div><div class="legend" id="cpWho" style="font-size:11.5px"></div><div class="cpTabs"><button id="cpTabSay" class="on">💬 Parole <span id="cpNSay"></span></button><button id="cpTabAct">🎬 Azioni <span id="cpNAct"></span></button></div></div><div class="cpBody" id="cpBody"></div>`;
  document.body.appendChild(p); const c = document.createElement('button'); c.id = 'circleChip'; c.textContent = '🗣 Discussione'; c.title = 'Riapri il pannello della discussione'; document.body.appendChild(c);
  $('cpX').onclick = () => { CP.shown = false; circlePanelTick(true); }; c.onclick = () => { CP.shown = true; circlePanelTick(true); };
  $('cpCam').onclick = frameCircle; $('cpStop').onclick = () => ENG.stopCircle();
  const cpTab = (t) => { CP.tab = t; $('cpTabSay').classList.toggle('on', t !== 'act'); $('cpTabAct').classList.toggle('on', t === 'act'); circlePanelTick(true); };
  $('cpTabSay').onclick = () => cpTab('say'); $('cpTabAct').onclick = () => cpTab('act');
  $('cpDl').onclick = () => { const G = ENG.G; const C = G.circleNow || (G.circles || [])[G.circles.length - 1]; if (!C) return; saveFile(`discussione-isola-giorno${C.day}.txt`, circleText(C)); };
}
function circleText(C) { return [`Cerchio di discussione — giorno ${C.day}, ${fmtH(C.h)}`, `Tema: ${C.topic}`, `Partecipanti: ${C.names.join(', ')}`, ''].concat(C.lines.map((l) => (l.act || /^\(/.test(l.text)) ? `${fmtH(l.h)}  * ${l.name} ${l.text.replace(/^\(|\)$/g, '')}` : `${fmtH(l.h)}  ${l.name}${l.to && l.to !== 'tutti' ? ' → ' + l.to : ' → tutti'}${l.tono ? ' [' + l.tono + ']' : ''}: ${l.text}`)).join('\n'); }
function frameCircle() { const fc = ENG.PLACES.fuoco.loc; if (ui.follow && $('follow')) $('follow').click(); RTS.flyTo(fc[0], fc[1], 14); }
function circlePanelTick(force) {
  const G = ENG.G; circlePanelEnsure(); const C = G && G.circleNow; const p = $('circlePanel'), chip = $('circleChip');
  if (!C) { p.classList.remove('on'); chip.classList.remove('on'); CP.id = null; return; }
  const id = C.day + ':' + C.h; if (CP.id !== id) { CP.id = id; CP.n = -1; CP.shown = true; frameCircle(); } // a new circle: open the panel and frame it
  p.classList.toggle('on', CP.shown); chip.classList.toggle('on', !CP.shown); if (!CP.shown && !force) return;
  setText($('cpTopic'), `Tema: ${C.topic}${C.forever ? ' · finché non lo sciogli' : C.until ? ' · a tempo' : ''}${C.heat >= 3 ? ' · 🔥 si è scaldata' : ''}`);
  const ring = ENG.alive().filter((a) => a.inCircle).map((a) => a.name + (a.thinking ? ' 💭' : '')); setText($('cpWho'), ring.length ? `Seduti: ${ring.join(', ')}` : 'Si stanno sedendo…');
  if (CP.n === C.lines.length && !force) return; CP.n = C.lines.length; const body = $('cpBody'); const atTop = body.scrollTop < 30;
  const isAct = (l) => l.act || /^\(/.test(l.text); const acts = C.lines.filter(isAct), says = C.lines.filter((l) => !isAct(l)); $('cpNSay').textContent = says.length; $('cpNAct').textContent = acts.length;
  const showAct = CP.tab === 'act';
  body.innerHTML = (showAct ? acts : says).slice().reverse().map((l) => showAct ? `<div class="cpLine sys"><span class="who">${esc(l.name)}</span> ${esc(l.text.replace(/^\(|\)$/g, ''))} <span class="tone">${fmtH(l.h)}</span></div>` : `<div class="cpLine ${/acces|offes|arrabb/.test(l.tono || '') ? 'hot' : ''}"><span class="who">${esc(l.name)}</span> → ${esc(l.to && l.to !== 'tutti' ? l.to : 'tutti')}${l.tono ? ` <span class="tone">(${esc(l.tono)})</span>` : ''}: ${esc(l.text)}</div>`).join('') || `<div class="cpLine sys">${showAct ? 'Nessuna azione per ora.' : 'In attesa che qualcuno parli…'}</div>`;
  if (atTop || force) body.scrollTop = 0; // newest line on top
}
/* ---------- wiring ---------- */
(function funWire() {
  const menu = document.querySelector('#menu .menuBody'); const hr = menu.querySelector('hr');
  const mk = (id, txt, title, fn) => { const b = document.createElement('button'); b.id = id; b.textContent = txt; b.title = title; b.onclick = () => { $('menu').open = false; fn(); }; menu.insertBefore(b, hr); return b; };
  mk('albumBtn', '📸 Album e diario', 'Foto dei momenti salienti e diario illustrato dei personaggi', () => showAlbum());
  mk('socBtn', '👥 Interazioni', 'Resoconto passo passo di ciò che succede tra i personaggi', () => showSocial());
  mk('rpIsleBtn', '📊 Resoconto', 'Indicatori dei personaggi, relazioni, romanzo e cronaca: a schermo e in PDF', () => { if (ENG.G) rpOpen(isleReport(ENG.G), `resoconto-isola-giorno-${ENG.G.day}.pdf`); });
  mk('relBtn', '❤️ Relazioni', 'Come ognuno vede gli altri', showRelations);
  mk('replayBtn', '🎞 Replay', 'Rivedi la partita sulla mappa, ora per ora', showReplay);
  mk('recBtn', '🏆 Classifica', 'Le partite giocate a confronto', showRecords);
  const skip = $('skipBtn'); const bb = document.createElement('button'); bb.id = 'betBtn'; bb.textContent = '🎲'; bb.title = 'Scommetti su cosa farà un personaggio (tasto B)'; skip.parentNode.insertBefore(bb, skip.nextSibling); bb.onclick = showBets;
  addEventListener('keydown', (e) => { if (e.target.closest && e.target.closest('input,textarea,select')) return; if (e.key === 'b' || e.key === 'B') showBets(); });
  npFill(); $('npRun').onclick = npRun;
  $('ciRun').onclick = circleRun; $('ciStop').onclick = () => { if (ENG.stopCircle()) setText($('ciOut'), '✋ Il cerchio si scioglie dopo la battuta in corso…'); }; $('ciTopic').onfocus = circleFill; circleFill();
  $('stopBtn').onclick = showStop; $('isRun').onclick = islandRun; $('isWhere').onfocus = islandFill; islandFill();
  setInterval(() => { try { circlePanelTick(false); } catch (e) {} try { renderPersCard(false); } catch (e) {} betsTick(); recordEnd(); const G = ENG.G; $('stopBtn').disabled = !G || !!G.ended; if (G) { $('ciStop').disabled = !G.circleNow; if (G.circleNow && $('ciRun').disabled === false) $('ciRun').disabled = true; else if (!G.circleNow && $('ciRun').disabled) $('ciRun').disabled = false; } }, 1000);
})();

/* 📖 the novel: chapters are written once per day (and rewritten only if that day changed), then laid out as a book */
const NOVEL = { busy: false };
async function writeNovel(btn, fmt) {
  const G = ENG.G; if (!G) return; if (NOVEL.busy) { toastMsg(NOVEL.status || 'Sto già scrivendo il romanzo…', true); return; } if (!ENG.hasSample()) { toastMsg('Per scrivere il romanzo serve Claude: apri la pagina da claude.ai.'); return; }
  const miss = ENG.novelMissing(); const days = ENG.novelDays(); if (!days.length) { toastMsg('Non è ancora successo niente da raccontare.'); return; }
  if (!miss.length && !NOVEL.ok) { const el = funCard('📖 Il romanzo', `<p>I <b>${days.length} capitoli</b> sono già scritti.</p><div class="row" style="gap:8px;flex-wrap:wrap"><button id="novelDl" class="primary">⬇ Scarica</button><button id="novelRedo" title="Cancella i capitoli scritti e li riscrive tutti (una chiamata per capitolo)">🔄 Riscrivi tutto</button><button data-close>Annulla</button></div>`);
    el.querySelector('#novelDl').onclick = () => { el.hidden = true; NOVEL.ok = true; writeNovel(btn, fmt).finally(() => { NOVEL.ok = false; }); };
    el.querySelector('#novelRedo').onclick = () => { el.hidden = true; G.novel = { chapters: {}, summary: '' }; ENG.save(); writeNovel(btn, fmt); }; return; }
  if (miss.length && !NOVEL.ok) { const el = funCard('📖 Il romanzo', `<p>Il romanzo ha <b>${days.length} capitoli</b>, uno per giorno. Ne devo scrivere <b>${miss.length}</b>${miss.length < days.length ? ' (gli altri sono già pronti)' : ''}: una chiamata a Claude per capitolo, con la stessa mente dei personaggi. I capitoli scritti restano salvati: la prossima volta scrivo solo quelli nuovi.</p><div class="row" style="gap:8px"><button id="novelGo" class="primary">✍ Scrivi e scarica</button><button data-close>Annulla</button></div>`);
    el.querySelector('#novelGo').onclick = () => { el.hidden = true; NOVEL.ok = true; writeNovel(btn, fmt).finally(() => { NOVEL.ok = false; }); }; return; }
  NOVEL.busy = true; const label = btn ? btn.textContent : ''; const set = (t) => { NOVEL.status = `📖 Romanzo: ${t}`; if (btn) btn.textContent = t; toastMsg(NOVEL.status, true); };
  if (btn) btn.disabled = true;
  try {
    for (let i = 0; i < miss.length; i++) { set(`✍ Capitolo ${miss[i]} (${i + 1}/${miss.length})…`); try { await ENG.novelChapter(miss[i]); } catch (e) { if (e && e.code === 'rate_limited') throw e; } }
    set('✍ Titolo…'); const N = await ENG.novelTitle();
    const chs = days.map((d) => ({ d, ...(N.chapters || {})[d] })).filter((c) => c.text);
    if (!chs.length) { toastMsg('Non sono riuscito a scrivere i capitoli: riprova tra poco.'); return; }
    const title = N.title || "L'isola"; 
    const base = `romanzo-${title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'isola'}`;
    await novelBook({ title, epigraph: N.epigraph, cast: G.agents.map((a) => ({ name: a.name, line: `${a.name}, ${a.age} anni${a.persona ? ' — ' + a.persona : ''}` })), chapters: chs, ended: !!G.ended, base, fmt, onStep: set });
  } catch (e) { toastMsg(e && e.code === 'rate_limited' ? 'Claude chiede di rallentare: i capitoli scritti finora sono salvati, riprova tra qualche minuto e continuo da lì.' : 'Non riesco a finire il romanzo ora; i capitoli già scritti restano salvati. Riprova.'); }
  finally { NOVEL.busy = false; if (btn) { btn.disabled = false; btn.textContent = label; } }
}
/**
 * Lays out a novel as a book and saves it: title page, one chapter per page break, contents, page numbers.
 * Shared by every environment. There is no characters page: people are introduced inside the chapters. cast is unused, kept for callers; chapters: [{ title, text }]; fmt 'txt' saves plain text instead of a PDF.
 */
async function novelBook({ title, epigraph, cast, chapters, ended, base, fmt, onStep }) {
  const chs = chapters;
    if (fmt === 'txt') {
      const out = [title.toUpperCase(), epigraph ? `\n«${epigraph}»` : '', ''];
      chs.forEach((c, i) => out.push('', '', `${i + 1}. ${c.title}`, '', c.text.trim()));
      if (!ended) out.push('', '', '(continua…)');
      const r = await saveFile(base + '.txt', out.join('\n')); if (r !== 'error') toastMsg(r === 'declined' ? 'Download annullato: i capitoli restano pronti, ripremi per scaricare.' : `📖 Romanzo salvato: ${chs.length} capitoli.`); return;
    }
    if (onStep) onStep('📖 Impagino…'); const { jsPDF } = await loadJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a5' }); const PW = 148, PH = 210, MX = 18, MT = 20, MB = 20, TW = PW - 2 * MX; let y = MT; const fs = 10.5, lh = fs * 0.45;
    const text = (t, x, yy, o = {}) => { doc.setFont('times', o.style || 'normal'); doc.setFontSize(o.size || fs); doc.setTextColor(...(o.color || [30, 24, 18])); doc.text(pdfClean(t), x, yy, o.align ? { align: o.align } : undefined); };
    // title page
    y = 70; doc.setFont('times', 'bold'); doc.setFontSize(24); doc.splitTextToSize(pdfClean(title), TW).forEach((l) => { text(l, PW / 2, y, { size: 24, style: 'bold', align: 'center' }); y += 10; });
    if (epigraph) { y += 8; doc.setFontSize(10.5); doc.setFont('times', 'italic'); doc.splitTextToSize(pdfClean(`«${epigraph}»`), TW - 16).forEach((l) => { text(l, PW / 2, y, { style: 'italic', align: 'center' }); y += 5.5; }); }
    text('romanzo', PW / 2, PH - 40, { style: 'italic', align: 'center', size: 11, color: [110, 90, 60] });
    // no characters page: a real novel introduces its people inside the story
    // chapters
    const first = doc.getNumberOfPages() + 1; const toc = [];
    chs.forEach((c, i) => {
      doc.addPage(); toc.push([i + 1, c.title, doc.getNumberOfPages()]); y = 48;
      text(String(i + 1), PW / 2, y, { size: 22, style: 'bold', align: 'center', color: [150, 110, 50] }); y += 10;
      doc.setFont('times', 'italic'); doc.setFontSize(13); doc.splitTextToSize(pdfClean(c.title), TW).forEach((l) => { text(l, PW / 2, y, { size: 13, style: 'italic', align: 'center' }); y += 6.5; }); y += 10;
      const paras = String(c.text).replace(/\r/g, '').split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
      const IND = 6; const justify = (l, x0, w) => { const words = l.trim().split(/ +/); const wsum = words.reduce((s, x) => s + doc.getTextWidth(x), 0); const gap = (w - wsum) / Math.max(1, words.length - 1); if (words.length < 4 || gap > 4) { text(l, x0, y); return; } let x = x0; words.forEach((x1) => { text(x1, x, y); x += doc.getTextWidth(x1) + gap; }); };
      paras.forEach((p, k) => { doc.setFont('times', 'normal'); doc.setFontSize(fs); const clean = pdfClean(p); const ind = k ? IND : 0;
        // first line is shorter when indented
        const words = clean.split(/ +/); let first = ''; while (words.length && doc.getTextWidth((first ? first + ' ' : '') + words[0]) <= TW - ind) first = (first ? first + ' ' : '') + words.shift();
        const lines = [first].concat(words.length ? doc.splitTextToSize(words.join(' '), TW) : []);
        lines.forEach((l, j) => { if (y > PH - MB) { doc.addPage(); y = MT; } const x0 = MX + (j === 0 ? ind : 0), w = TW - (j === 0 ? ind : 0); if (j < lines.length - 1) justify(l, x0, w); else text(l, x0, y); y += lh; });
        y += 0.6; });
      if (i === chs.length - 1 && !ended) { y += 6; if (y > PH - MB) { doc.addPage(); y = MT; } text('(continua…)', PW / 2, y, { style: 'italic', align: 'center' }); }
    });
    // contents
    doc.addPage(); y = 40; text('Indice', PW / 2, y, { size: 13, style: 'bold', align: 'center' }); y += 12;
    toc.forEach(([n, t, pg]) => { if (y > PH - MB) { doc.addPage(); y = MT; } doc.setFont('times', 'normal'); doc.setFontSize(10); const tt = doc.splitTextToSize(pdfClean(`${n}. ${t}`), TW - 14)[0]; text(tt, MX, y, { size: 10 }); text(String(pg), PW - MX, y, { size: 10, align: 'right' }); y += 6; });
    const n = doc.getNumberOfPages(); for (let i = first; i <= n; i++) { doc.setPage(i); doc.setFont('times', 'normal'); doc.setFontSize(8.5); doc.setTextColor(130, 110, 80); doc.text(String(i), PW / 2, PH - 10, { align: 'center' }); }
    const r = await saveFile(base + '.pdf', doc.output('blob')); if (r !== 'error') toastMsg(r === 'declined' ? 'Download annullato: i capitoli restano pronti, ripremi per scaricare.' : `📖 Romanzo salvato: ${chs.length} capitoli, ${n} pagine. Lo trovi nella cartella dei download del browser.`);
}
window.novelBook = novelBook;
function toastMsg(s, sticky) { const t = $('toast'); t.textContent = s; t.style.display = 'block'; clearTimeout(t._h); if (!sticky) t._h = setTimeout(() => { t.style.display = 'none'; }, 9000); }
window.writeNovel = writeNovel;
