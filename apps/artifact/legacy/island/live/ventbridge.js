/* ===== Venture: the 3D bridge and the stage player =====
   The bridge is a scene like the talk show studio: stations in a half circle, the captain's chair in the middle,
   the main screen in front. The stage player shows what the engine produced one piece at a time (bubbles, thoughts,
   captions), at reading speed, so a viewer can follow; the next turn starts only when the stage has caught up.
   Rendering only: it reads VUI.G and its log, never changes the game. */

/** Where each station sits (x, z), whether the person sits, and where they face (a point on the floor). */
const VB_STATIONS = {
  capitano: { pos: [0, 2.6], sit: true, face: [0, -8] }, primo: { pos: [1.9, 2.8], sit: true, face: [0, -8] },
  timoniere: { pos: [-1.4, -0.6], sit: true, face: [-1.4, -8] }, tattico: { pos: [1.4, -0.6], sit: true, face: [1.4, -8] },
  scienza: { pos: [-4.6, 0.8], sit: false, face: [-7, 0.8] }, comunicazioni: { pos: [4.6, 0.8], sit: false, face: [7, 0.8] },
  ingegnere: { pos: [-4.2, 4.0], sit: false, face: [-6.5, 4.4] }, medico: { pos: [4.2, 4.0], sit: false, face: [6.5, 4.4] },
};
/** Uniform colours by department (our own, no franchise colours): command, operations, sciences, communications. */
const VB_UNIFORM = { capitano: 0x7a1f2b, primo: 0x7a1f2b, timoniere: 0x7a1f2b, tattico: 0xa8742a, ingegnere: 0xa8742a, scienza: 0x245e7a, medico: 0x245e7a, comunicazioni: 0x4c3a7a };
/** Reading speed: milliseconds per character of a line, and the minimum time a bubble stays. */
const VB_MS_PER_CHAR = 55, VB_MIN_MS = 2600, VB_ROLL_MS = 1900, VB_THOUGHT_MS = 3200;
const VB = { three: null, raf: 0, queue: [], playing: false, shown: 0, speed: 1, speaking: null, waiters: [], screenDirty: true, flash: 0, screenCut: false, screenPin: false, ff: false, voice: false, tts: null, sound: true, fx: null, shake: 0, hit: null, contactPos: {}, lastRhythm: null };

/* ---------- the scene ---------- */
function vbLook(c) {
  let h = 0; for (const ch of String(c.archId || c.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (arr, k) => arr[(h >>> k) % arr.length]; const f = c.sex === 'f'; const age = +c.age || 40;
  const hair = age >= 60 ? pick([0xd8d8d8, 0xc9c9c9], 3) : age >= 48 ? pick([0x8a8a8a, 0x5a4a3a], 3) : pick([0x2a1a10, 0x4a3020, 0x6a4a2a, 0xb08a4a, 0x1a1a1a, 0x8a3a1a], 3);
  return { skin: pick([0xf1c9a5, 0xe0ac69, 0xc68642, 0x8d5524, 0xf3d6c0, 0xd9a273], 1), hair, longHair: f, beard: !f && (h >>> 7) % 3 === 0, shirt: VB_UNIFORM[c.station] || 0x555a66, pants: 0x1c1f28 };
}
function vbBuild(host) {
  if (VB.three || typeof THREE === 'undefined') return;
  const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(1.5, devicePixelRatio)); host.appendChild(R.domElement);
  const S = new THREE.Scene(); S.background = new THREE.Color(0x05080f); S.fog = new THREE.Fog(0x05080f, 22, 50);
  const C = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
  const mat = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.2, emissive: e || 0x000000 });
  S.add(new THREE.HemisphereLight(0x9fb4d8, 0x10141c, 0.85)); const key = new THREE.DirectionalLight(0xdfe8ff, 0.7); key.position.set(0, 10, 8); S.add(key);
  const alert = new THREE.PointLight(0xff3020, 0, 30); alert.position.set(0, 6, 1); S.add(alert);
  const screenGlow = new THREE.PointLight(0x7cc4ff, 0.8, 18); screenGlow.position.set(0, 3, -3); S.add(screenGlow);
  // floor, raised command ring, back wall in a half circle
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), mat(0x161c28)); floor.rotation.x = -Math.PI / 2; S.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.35, 48), new THREE.MeshBasicMaterial({ color: 0x7cc4ff })); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, 2.7); S.add(ring);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 4.5, 48, 1, true, Math.PI / 2 + 0.25, Math.PI * 2 - 0.5), new THREE.MeshStandardMaterial({ color: 0x1b2436, side: THREE.BackSide, roughness: 0.9 }));
  wall.position.set(0, 2.25, 1); S.add(wall);
  for (let i = 0; i < 14; i++) { const a = Math.PI / 2 + 0.4 + i * ((Math.PI * 2 - 0.8) / 13); const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 0.08), new THREE.MeshBasicMaterial({ color: 0x2f4a72 })); strip.position.set(Math.cos(a) * 7.9, 2.2, 1 + Math.sin(a) * 7.9); S.add(strip); }
  // the main screen: a canvas texture, redrawn when the state changes; placed at z=-4.9, in front of the curved wall
  // (which is at z≈-5.2 behind the screen's edges), so the wall never covers it
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 460; const tex = new THREE.CanvasTexture(cv); const sbox = $('vbScreen'); if (sbox) sbox.appendChild(cv);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.5), new THREE.MeshBasicMaterial({ map: tex })); screen.position.set(0, 3.1, -4.9); S.add(screen);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(10.4, 4.9, 0.2), mat(0x0d121c)); frame.position.set(0, 3.1, -5.05); S.add(frame);
  const people = new THREE.Group(); S.add(people); const P = {};
  /** A desk in front of a station and a chair under a seated person; all rotate with the person (who faces +z by default). */
  function console3d(sit) { const g = new THREE.Group(); const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, sit ? 0.75 : 1.1, 0.5), mat(0x232d40)); desk.position.y = sit ? 0.375 : 0.55; g.add(desk);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.05, 0.5), new THREE.MeshBasicMaterial({ color: 0x3a74b8 })); top.position.set(0, sit ? 0.78 : 1.13, 0); top.rotation.x = 0.35; g.add(top); return g; }
  function chair(big) { const g = new THREE.Group(); const c = big ? 0x3a2a30 : 0x2a3040; const seat = new THREE.Mesh(new THREE.BoxGeometry(big ? 1.25 : 0.95, 0.45, 0.95), mat(c)); seat.position.y = 0.3; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(big ? 1.25 : 0.95, big ? 1.4 : 1.0, 0.18), mat(c)); back.position.set(0, big ? 1.1 : 0.9, -0.45); g.add(back);
    if (big) [-0.6, 0.6].forEach((x) => { const ar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.9), mat(0x4a3238)); ar.position.set(x, 0.62, 0); g.add(ar); }); return g; }
  function setPeople() {
    const G = VUI.G; while (people.children.length) people.remove(people.children[0]); Object.keys(P).forEach((k) => delete P[k]);
    Object.entries(VB_STATIONS).forEach(([st, d]) => {
      const c = G.crew.find((x) => x.station === st && !x.dead); const [x, z] = d.pos; const rot = Math.atan2(d.face[0] - x, d.face[1] - z);
      const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rot; people.add(grp);
      const lounge = st === 'capitano' || st === 'primo';
      if (d.sit) grp.add(chair(st === 'capitano')); if (!lounge) { const k = console3d(d.sit); k.position.z = d.sit ? 0.85 : 0.7; grp.add(k); }
      const who = c || { name: 'supporto ' + st, sex: 'm', age: 30, station: st, archId: 'sup' + st };
      const fig = SC.makePerson(Object.assign(vbLook(who), c ? {} : { shirt: 0x4a505c })); if (fig.root.parent) fig.root.parent.remove(fig.root);
      fig.root.scale.setScalar(1.25); fig.root.position.set(0, d.sit ? 0.29 : 0, d.sit ? -0.08 : 0); grp.add(fig.root); SC.posePerson(fig, d.sit ? 'sit' : 'idle', 0);
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 32), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0 })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03; grp.add(halo);
      P[c ? c.name : 'supporto ' + st] = { grp, fig, halo, sit: d.sit, station: st, support: !c, ph: Math.random() * 10 };
    });
    vbTags();
  }
  // camera shots
  const WIDE = { pos: new THREE.Vector3(0, 5.2, 10.5), look: new THREE.Vector3(0, 1.6, -2.5) };
  const SCREEN = { pos: new THREE.Vector3(0, 2.6, 4.2), look: new THREE.Vector3(0, 2.9, -4.9) };
  let shot = WIDE; const camPos = WIDE.pos.clone(), camLook = WIDE.look.clone();
  function headOf(name) { const o = P[name]; if (!o) return null; const v = new THREE.Vector3(); o.fig.head.getWorldPosition(v); return v; }
  function shotOn(name) { const v = headOf(name); if (!v) return WIDE; const toCenter = new THREE.Vector3(-v.x * 0.35, 0, 6 - v.z).normalize(); return { pos: new THREE.Vector3(v.x + toCenter.x * 4.2, v.y + 0.7, v.z + toCenter.z * 4.2), look: new THREE.Vector3(v.x, v.y - 0.2, v.z) }; }
  function focus(name, kind) { Object.values(P).forEach((o) => { o.halo.material.opacity = 0; }); if (name && P[name]) P[name].halo.material.opacity = 0.9;
    shot = kind === 'screen' ? SCREEN : kind === 'wide' || !name ? WIDE : shotOn(name); VB.screenCut = kind === 'screen'; vbScreenShow(); }
  function resize() { const w = host.clientWidth || 640, h = host.clientHeight || 360; R.setSize(w, h); C.aspect = w / h; C.updateProjectionMatrix(); }
  addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(host); resize();
  let t0 = performance.now(); const tv = new THREE.Vector3();
  function project(name, dy) { const v = headOf(name); if (!v) return null; v.y += dy; v.project(C); if (v.z > 1) return null; return [(v.x * 0.5 + 0.5) * host.clientWidth, (-v.y * 0.5 + 0.5) * host.clientHeight]; }
  // click on a figure (or near it) opens the character panel
  const ray = new THREE.Raycaster(); const mp = new THREE.Vector2();
  R.domElement.addEventListener('click', (e) => { const r = R.domElement.getBoundingClientRect(); mp.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mp, C);
    const hit = ray.intersectObjects(people.children, true)[0]; if (!hit) return; const name = Object.keys(P).find((n) => { let o = hit.object; while (o) { if (o === P[n].grp) return true; o = o.parent; } return false; });
    if (name && !P[name].support && typeof vOpenPerson === 'function') vOpenPerson(name); });
  R.domElement.style.cursor = 'pointer';
  VB.three = { R, S, C, P, setPeople, focus, project, tex, cv, alert, tick(now) {
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now; const k = 1 - Math.pow(0.03, dt); camPos.lerp(shot.pos, k); camLook.lerp(shot.look, k); C.position.copy(camPos); if (VB.shake > 0) { VB.shake = Math.max(0, VB.shake - dt * 1.6); C.position.x += (Math.random() - 0.5) * VB.shake * 0.5; C.position.y += (Math.random() - 0.5) * VB.shake * 0.35; } C.lookAt(camLook);
    if (VB.hit && now > VB.hit.until && !VB.hit.cleared) { VB.hit.cleared = true; vbHud(); }
    if (VB.fx && now < VB.fx.end) VB.screenDirty = true; else if (VB.fx) { VB.fx = null; VB.screenDirty = true; }
    const t = now / 1000; Object.entries(P).forEach(([n, o]) => { const me = VB.speaking === n; SC.posePerson(o.fig, o.sit ? (me ? 'talk' : 'sit') : (me ? 'talkstand' : 'idle'), t + o.ph); });
    const G = VUI.G; const battle = G && G.rhythm === 'battaglia'; alert.intensity = battle ? 0.6 + Math.abs(Math.sin(t * 2.2)) * 0.9 : (G && G.rhythm === 'allerta' ? 0.25 : 0);
    if (VB.flash > 0) { VB.flash -= dt; alert.intensity += 2.5 * Math.max(0, VB.flash); }
    if (VB.screenDirty) { vbDrawScreen(); VB.screenDirty = false; }
    R.render(S, C); vbPlaceOverlays(); } };
  setPeople();
}
function vbTags() {
  const box = $('vbTags'); if (!box || !VB.three) return; box.innerHTML = '';
  Object.entries(VB.three.P).forEach(([n, o]) => { const d = document.createElement('div'); d.className = 'vbTag' + (o.support ? ' sup' : ''); d.dataset.n = n; if (!o.support) { d.dataset.person = n; d.title = 'Intervieni su ' + n; d.setAttribute('role', 'button'); d.tabIndex = 0; d.onclick = () => vOpenPerson(n); } d.innerHTML = o.support ? `${esc(V_STATION_ICON[o.station] || '')} supporto` : `<b>${esc(V_STATION_ICON[o.station] || '')} ${esc(n.split(' ')[0])}</b>`; box.appendChild(d); o.tag = d; });
}
function vbPlaceOverlays() {
  if (!VB.three) return; const T = VB.three;
  Object.entries(T.P).forEach(([n, o]) => { if (!o.tag) return; const p = T.project(n, -1.45); if (!p) { o.tag.hidden = true; return; } o.tag.hidden = false; o.tag.style.left = p[0] + 'px'; o.tag.style.top = p[1] + 'px'; o.tag.classList.toggle('on', VB.speaking === n); });
  const b = $('vbBubble'); if (b && !b.hidden && b.dataset.n) { const p = T.project(b.dataset.n, 0.55); const host = $('vbCanvas'); if (p) { const bw = b.offsetWidth, bh = b.offsetHeight; b.style.left = Math.max(8 + bw / 2, Math.min(host.clientWidth - 8 - bw / 2, p[0])) + 'px'; b.style.top = Math.max(bh + 8, Math.min(host.clientHeight - 80, p[1])) + 'px'; } }
  document.querySelectorAll('#vbMurs .vbMur').forEach((m) => { const p = T.project(m.dataset.n, 0.35); if (!p) { m.hidden = true; return; } m.hidden = false; m.style.left = p[0] + 'px'; m.style.top = p[1] + 'px'; });
}
/** Cut to the main screen as a flat, full-size picture: the 3D screen is too small to read on a narrow stage. */
function vbScreenShow() {
  const on = VB.screenCut || VB.screenPin; const box = $('vbScreen'); if (box) box.hidden = !on;
  const b = $('vbScreenBtn'); if (b) { b.setAttribute('aria-pressed', String(VB.screenPin)); b.classList.toggle('on', VB.screenPin); }
}
/** The main screen: stars, place, contacts seen from the bridge (left/right by position, size by distance), channel, alert. */
function vbDrawScreen() {
  const T = VB.three; const G = VUI.G; if (!T || !G) return; const g = T.cv.getContext('2d'); const W = T.cv.width, H = T.cv.height;
  g.fillStyle = '#02040a'; g.fillRect(0, 0, W, H); let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.8})`; g.fillRect(rnd() * W, rnd() * H, rnd() < 0.1 ? 2 : 1, rnd() < 0.1 ? 2 : 1); }
  const regole = G.bible ? G.bible.luogo.regole : []; if (regole.includes('interferenze')) { for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(140,120,100,${0.2 + rnd() * 0.4})`; g.beginPath(); g.arc(rnd() * W, rnd() * H, 2 + rnd() * 9, 0, 7); g.fill(); } }
  g.font = 'bold 30px Inter, sans-serif'; g.fillStyle = '#7cc4ff'; g.textAlign = 'left'; g.fillText(G.bible ? G.bible.luogo.nome.toUpperCase() : '', 24, 40);
  const rhythm = { crociera: ['CROCIERA', '#5fd39a'], allerta: ['ALLERTA', '#f2c14e'], battaglia: ['ALLARME ROSSO', '#ff7a6b'] }[G.rhythm] || ['', '#fff'];
  g.textAlign = 'right'; g.fillStyle = rhythm[1]; g.fillText(rhythm[0], W - 24, 40); g.textAlign = 'center';
  const r = VENTURE.sensorRange(G); const vis = G.ships.filter((x) => x.alive && VENTURE.dist(x.pos, G.ship.pos) <= r);
  // place contacts left to right by bearing, then push them apart so labels never overlap (minimum gap in canvas pixels)
  const MIN_GAP = 230; const items = vis.map((x) => { const dx = x.pos[0] - G.ship.pos[0], dy = G.ship.pos[1] - x.pos[1]; const d = Math.max(1, VENTURE.dist(x.pos, G.ship.pos));
    return { x, d, px: W / 2 + dx / 10 * (W * 0.42), py: H * 0.5 - Math.max(-6, Math.min(10, dy)) * 5 }; }).sort((p, q) => p.px - q.px);
  items.forEach((it, i) => { if (i && it.px - items[i - 1].px < MIN_GAP) it.px = items[i - 1].px + MIN_GAP; });
  const over = items.length ? items[items.length - 1].px - (W - 130) : 0; if (over > 0) items.forEach((it) => { it.px -= over; });
  items.forEach((it) => { if (it.px < 130) it.px = 130; });
  VB.contactPos = {}; items.forEach(({ x, px, py }) => { VB.contactPos[x.id] = [px, py]; });
  items.forEach(({ x, d, px, py }) => { const size = Math.max(14, 80 / Math.sqrt(d)); const F = G.factions[x.faction] || {};
    const col = !x.known ? '#c4d0e6' : F.posture === 'ostile' ? '#ff7a6b' : F.posture === 'diffidente' ? '#f2c14e' : '#5fd39a';
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py - size * 0.5); g.lineTo(px + size, py); g.lineTo(px, py + size * 0.5); g.lineTo(px - size, py); g.closePath(); x.known && F.posture === 'ostile' ? g.fill() : g.stroke();
    g.font = 'bold 28px Inter, sans-serif'; g.fillText(x.id, px, py - size * 0.5 - 40); g.font = '22px Inter, sans-serif'; g.fillText(x.known ? (F.nome || '') : 'non identificato', px, py - size * 0.5 - 12);
    g.fillStyle = '#c4d0e6'; g.font = '22px Inter, sans-serif'; g.fillText(`${d} caselle`, px, py + size * 0.5 + 28); });
  if (!vis.length) { g.font = '28px Inter, sans-serif'; g.fillStyle = '#8494b2'; g.fillText('Nessun contatto sui sensori', W / 2, H * 0.55); }
  // only the message the stage is playing right now, never one the viewer has not reached yet
  const last = VB.screenMsg; const ch = null;
  if (last) { g.fillStyle = 'rgba(10,18,32,.85)'; g.fillRect(30, H - 140, W - 60, 124); g.strokeStyle = '#e8c27a'; g.lineWidth = 2; g.strokeRect(30, H - 140, W - 60, 124);
    g.fillStyle = '#e8c27a'; g.font = 'bold 24px Inter, sans-serif'; g.textAlign = 'left'; g.fillText(`📡 ${ch ? 'CANALE APERTO · ' + ch.nome : 'IN CHIAMATA · ' + last.from}`, 50, H - 108);
    if (last) { g.fillStyle = '#e8eefb'; g.font = '23px Inter, sans-serif'; const words = `«${last.text}»`.split(' '); let line = '', y = H - 76; words.forEach((w) => { if (g.measureText(line + w).width > W - 110) { if (y < H - 20) g.fillText(line, 50, y); line = ''; y += 29; } line += w + ' '; }); if (y < H - 20) g.fillText(line.trim(), 50, y); else { g.fillText('…', W - 60, H - 24); } } }
  // the Venture's own position on the screen (bottom centre) and the shots of this moment
  const VX = W / 2, VY = H - 18; g.fillStyle = '#7cc4ff'; g.beginPath(); g.moveTo(VX, VY - 16); g.lineTo(VX + 12, VY + 6); g.lineTo(VX - 12, VY + 6); g.closePath(); g.fill();
  const fx = VB.fx; if (fx && VB.contactPos[fx.ship]) { const [cx, cy] = VB.contactPos[fx.ship]; const k = Math.max(0, Math.min(1, (performance.now() - fx.start) / (fx.end - fx.start)));
    const from = fx.dir === 'out' ? [VX, VY - 16] : [cx, cy], to = fx.dir === 'out' ? [cx, cy] : [VX, VY - 16]; const tip = [from[0] + (to[0] - from[0]) * Math.min(1, k * 1.6), from[1] + (to[1] - from[1]) * Math.min(1, k * 1.6)];
    g.strokeStyle = fx.dir === 'out' ? (fx.kind === 'siluro' ? '#ffb347' : '#7cf0ff') : '#ff6b5b'; g.lineWidth = fx.kind === 'siluro' ? 7 : 4; g.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3; g.beginPath(); g.moveTo(from[0], from[1]); g.lineTo(tip[0], tip[1]); g.stroke();
    if (k > 0.6 && fx.ok) { g.fillStyle = fx.dir === 'out' ? '#fff2b0' : '#ff9a8a'; g.beginPath(); g.arc(to[0], to[1], 10 + 30 * (k - 0.6), 0, 7); g.fill(); } g.globalAlpha = 1; }
  T.tex.needsUpdate = true;
}

/* ---------- battle feel: shots on the screen, shield side that takes the hit, shake, sounds ---------- */
/** Starts a shot effect on the main screen: dir 'out' from the Venture to a contact, 'in' from a contact to the Venture. */
function vbShot(ship, dir, kind, ok) { const now = performance.now(); VB.fx = { ship, dir, kind, ok, start: now, end: now + (kind === 'siluro' ? 1300 : 900) }; VB.screenDirty = true; vbSound(dir === 'out' ? (kind === 'siluro' ? 'torpedo' : 'shot') : 'shot'); }
/** Tiny synthesised sounds (no files): shot, torpedo, hit, alarm, ok, bad. Silent if the user turned sound off or the browser forbids it. */
function vbSound(kind) {
  if (!VB.sound || VB.ff) return; try {
    const A = VB.ac || (VB.ac = new (window.AudioContext || window.webkitAudioContext)()); const t = A.currentTime; const g = A.createGain(); g.connect(A.destination);
    const tone = (type, f0, f1, dur, vol, at) => { const o = A.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t + (at || 0)); o.frequency.exponentialRampToValueAtTime(f1, t + (at || 0) + dur); const gg = A.createGain(); gg.gain.setValueAtTime(vol, t + (at || 0)); gg.gain.exponentialRampToValueAtTime(0.001, t + (at || 0) + dur); o.connect(gg); gg.connect(A.destination); o.start(t + (at || 0)); o.stop(t + (at || 0) + dur + 0.02); };
    if (kind === 'shot') tone('sawtooth', 1400, 180, 0.25, 0.06);
    else if (kind === 'torpedo') { tone('square', 220, 60, 0.6, 0.07); tone('sine', 900, 120, 0.5, 0.04); }
    else if (kind === 'hit') { const n = A.createBufferSource(); const b = A.createBuffer(1, A.sampleRate * 0.4, A.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2); n.buffer = b; g.gain.value = 0.18; n.connect(g); n.start(); tone('sine', 90, 40, 0.4, 0.12); }
    else if (kind === 'alarm') { [0, 0.45, 0.9].forEach((at) => { tone('square', 660, 660, 0.2, 0.035, at); tone('square', 520, 520, 0.2, 0.035, at + 0.22); }); }
    else if (kind === 'ok') { tone('sine', 660, 660, 0.12, 0.05); tone('sine', 990, 990, 0.18, 0.05, 0.1); }
    else if (kind === 'bad') tone('triangle', 220, 110, 0.35, 0.06);
  } catch (e) { VB.sound = false; }
}
/** Small diagram of the Venture's four shields in the stage corner; the side just hit flashes. */
function vbHud() {
  const h = $('vbHud'); const G = VUI.G; if (!h || !G) return; const S = G.ship.shields; const col = (v) => (v >= 30 ? '#5fd39a' : v >= 12 ? '#f2c14e' : '#ff7a6b'); const hit = VB.hit && performance.now() < VB.hit.until ? VB.hit.side : '';
  const arc = (side, d) => `<path d="${d}" stroke="${hit === side ? '#ffffff' : col(S[side])}" stroke-width="${hit === side ? 8 : 5}" fill="none" stroke-linecap="round"><title>${side} ${S[side]}/50</title></path>`;
  h.innerHTML = `<svg viewBox="0 0 90 90" width="76" height="76" aria-label="Scudi: prua ${S.prua}, poppa ${S.poppa}, babordo ${S.babordo}, tribordo ${S.tribordo}">${arc('prua', 'M25 18 Q45 4 65 18')}${arc('poppa', 'M25 72 Q45 86 65 72')}${arc('babordo', 'M18 25 Q4 45 18 65')}${arc('tribordo', 'M72 25 Q86 45 72 65')}<path d="M45 26 L58 62 L45 55 L32 62 Z" fill="#7cc4ff"/></svg><span>scafo ${G.ship.hull}</span>`;
  h.classList.toggle('hit', !!hit);
}

/* ---------- voices ---------- */
const VB_VOICES = ['buttery', 'airy', 'glassy', 'rounded'];
/** Says a line aloud with the officer's own voice when voices are on; resolves when done (or at once). */
function vbSay(name, text) {
  if (!VB.voice || !VB.tts || VB.ff || !text) return Promise.resolve(); const G = VUI.G; const i = Math.max(0, G.crew.findIndex((c) => c.name === name));
  return Promise.resolve(VB.tts.speak(text, { voice: VB_VOICES[i % VB_VOICES.length], language: 'it' })).catch(() => {});
}
async function vbVoiceToggle() {
  if (VB.voice) { VB.voice = false; try { VB.tts && await VB.tts.stop(); } catch (e) {} vbBarSync(); return; }
  try { VB.tts = VB.tts || (window.claude && window.claude.use ? await window.claude.use('tts') : null); } catch (e) { VB.tts = null; }
  if (!VB.tts) { toastMsg('Le voci non sono disponibili in questa vista (per esempio Safari o l\'app mobile): restano i fumetti.'); return; }
  VB.voice = true; vbBarSync(); toastMsg('🔊 Voci attive: ogni ufficiale parla con la sua voce.');
}
function vbBarSync() {
  const v = $('vbVoice'), s = $('vbSoundBtn'), f = $('vbFF');
  if (v) { v.textContent = VB.voice ? '🗣' : '🤐'; v.setAttribute('aria-pressed', String(VB.voice)); }
  if (s) { s.textContent = VB.sound ? '🔊' : '🔇'; s.setAttribute('aria-pressed', String(VB.sound)); }
  if (f) { f.classList.toggle('on', VB.ff); f.setAttribute('aria-pressed', String(VB.ff)); }
}
/** Fast forward: quiet entries fly by; the stage stops at the first thing worth seeing. */
function vbFastForward() { VB.ff = !VB.ff; vbBarSync(); if (VB.ff) { toastMsg('⏩ Avanti veloce: mi fermo appena succede qualcosa.'); if (!VUI.running && VUI.G && !VUI.G.ended) vResume(); vbPlay(); } }
/** What stops the fast forward. */
function vbInteresting(l) {
  return ['world', 'msg', 'command', 'cmdask', 'cmdreply', 'refuse', 'away', 'end', 'director', 'answer'].includes(l.kind) || (l.kind === 'roll' && /(su Venture: .*scafo −[1-9])|distrutta|ferito/.test(l.text));
}

/* ---------- the stage player: one thing at a time, at reading speed ---------- */
function vbWait(ms) { return new Promise((r) => setTimeout(r, VB.ff ? Math.min(120, ms / 12) : ms / VB.speed)); }
function vbBubble(name, text, cls, sub) {
  const b = $('vbBubble'); if (!b) return; b.className = cls || ''; b.dataset.n = name || '';
  b.innerHTML = `<span class="bWho">${esc(name || '')}${sub ? ` <small>${esc(sub)}</small>` : ''}</span>${esc(text)}`; b.hidden = !name;
}
function vbCaption(html, cls) { const c = $('vbCaption'); if (!c) return; c.className = cls || ''; c.innerHTML = html; c.hidden = !html; }
function vbMurmur(name, text) { const box = $('vbMurs'); if (!box) return; const d = document.createElement('div'); d.className = 'vbMur'; d.dataset.n = name; d.textContent = '💭 ' + text; box.appendChild(d); setTimeout(() => d.remove(), (VB_THOUGHT_MS + text.length * 20) / VB.speed); }
const vbRead = (text) => Math.max(VB_MIN_MS, String(text || '').length * VB_MS_PER_CHAR);
/** Plays the log entries from VB.shown on; resolves when the stage has caught up with the engine. */
async function vbPlay() {
  if (VB.playing) return; VB.playing = true; const G = VUI.G;
  try {
    while (VB.shown < G.log.length) {
      const l = G.log[VB.shown]; const i = VB.shown; VB.shown++; VUI.stageShown = VB.shown; vRenderLog(); const T = VB.three;
      if (VB.skip) continue;
      if (VB.ff && vbInteresting(l)) { VB.ff = false; vbBarSync(); toastMsg('⏸ Avanti veloce fermo: è successo qualcosa.'); }
      if (l.kind === 'sys' && /battaglia/.test(l.text) && VB.lastRhythm !== 'battaglia') vbSound('alarm');
      if (l.kind === 'sys' && /^— Turno/.test(l.text)) VB.lastRhythm = (l.text.match(/· (\w+)/) || [])[1] || VB.lastRhythm;
      switch (l.kind) {
        case 'sys': if (/^— Turno/.test(l.text)) { VB.screenMsg = null; VB.screenDirty = true; if (T) T.focus(null, 'wide'); vbBubble(null); vbCaption(`<b>${esc(l.text.replace(/—/g, '').trim())}</b>`, 'turn'); await vbWait(1400); } break;
        case 'thought': { // all the thoughts of one listening appear together, over the heads
          const batch = [l]; while (VB.shown < G.log.length && G.log[VB.shown].kind === 'thought') { batch.push(G.log[VB.shown]); VB.shown++; }
          if (T) T.focus(null, 'wide'); vbCaption('💭 <b>Ascolto</b>: cosa pensano senza dirlo (lo vedi solo tu)', 'thought'); batch.forEach((x) => vbMurmur(x.who, x.text)); vRenderLog(); await vbWait(VB_THOUGHT_MS + 600); vbCaption(''); break; }
        case 'line': VB.speaking = l.who; if (T) T.focus(l.who); vbBubble(l.who, l.text, l.interrompe ? 'hot' : '', VENTURE.STATION_LABEL[(G.crew.find((c) => c.name === l.who) || {}).station] + (l.tono ? ' · ' + l.tono : '')); vbCaption(''); await Promise.all([vbWait(vbRead(l.text)), vbSay(l.who, l.text)]); VB.speaking = null; vbBubble(null); break;
        case 'order': VB.speaking = l.who; if (T) T.focus(l.who); vbBubble(l.who, l.text, 'cap', 'capitano · ordina');
          vbCaption(`⭐ <b>Ordini</b>: ${(l.orders || []).map((o) => { const [st, a] = o.split(': '); return `${V_STATION_ICON[st] || ''} ${esc(VENTURE.ACTION_LABELS[a] || a)}`; }).join(' · ') || 'mantenere la posizione'}${l.assetto ? ` · energia: ${esc(l.assetto)}` : ''}`, 'order');
          await Promise.all([vbWait(vbRead(l.text) + 900), vbSay(l.who, l.text)]); VB.speaking = null; vbBubble(null); break;
        case 'object': case 'refuse': VB.speaking = l.who; if (T) T.focus(l.who); vbBubble(l.who, l.text.replace(/^Obietta a verbale:\s*/, ''), 'hot', l.kind === 'object' ? 'obietta' : 'non obbedisce'); await vbWait(vbRead(l.text)); VB.speaking = null; vbBubble(null); break;
        case 'msg': VB.screenMsg = { from: l.who, text: l.text }; if (T) T.focus(null, 'screen'); VB.screenDirty = true; vbBubble(null); vbCaption('', 'msg'); await vbWait(vbRead(l.text) + 600); break;
        case 'roll': { const m = l.text.match(/^(.+?): (.+?) → (\d+)% → (\d+) (.+)$/); VB.screenDirty = true;
          if (m) { const ok = !/mancat|fallit|non creduto|inconcludente/.test(m[5]); const who = m[1]; const fire = m[2].match(/^(cannone|siluro) su (\S+)/);
            if (fire) { if (T) T.focus(null, 'screen'); const mine = !!(T && T.P[who]); vbShot(mine ? fire[2] : who.split(' ')[0], mine ? 'out' : 'in', fire[1], ok); }
            else if (T && T.P[who]) T.focus(who); else if (T) T.focus(null, 'screen'); if (!fire) vbSound(ok ? 'ok' : 'bad');
            vbCaption(`🎲 <b>${esc(who)}</b>: ${esc(m[2])} · serviva ${m[3]} o meno, uscito ${m[4]} → <b class="${ok ? 'vOk' : 'vBad'}">${ok ? '✓ ' : '✗ '}${esc(m[5])}</b>`, ok ? 'ok' : 'bad'); await vbWait(VB_ROLL_MS); }
          else { const hv = l.text.match(/su Venture: .*scudo di (prua|poppa|babordo|tribordo)/); if (hv) { VB.hit = { side: hv[1], until: performance.now() + 1600 }; VB.shake = /scafo −[1-9]/.test(l.text) ? 1 : 0.4; vbSound('hit'); }
            if (/su Venture|Venture:/.test(l.text) && /scafo −[1-9]/.test(l.text)) VB.flash = 1; vbCaption(`${/Venture/.test(l.text) ? '💥' : '•'} ${esc(l.text)}`, /Venture/.test(l.text) ? 'bad' : ''); await vbWait(1500); }
          vRenderShip(); vRenderContacts(); vRenderMap(); vbHud(); break; }
        case 'story': if (T) T.focus(null, 'wide'); vbCaption(`📖 ${esc(l.text)}`, 'story'); await vbWait(vbRead(l.text)); break;
        case 'world': if (T) T.focus(null, 'screen'); VB.screenDirty = true; vbCaption(`🌌 ${esc(l.text)}`, 'world'); await vbWait(vbRead(l.text)); break;
        case 'command': if (T) T.focus(null, 'screen'); vbCaption(`📡 <b>Comando della Flotta</b>: ${esc(l.text)}`, 'cmd'); await vbWait(vbRead(l.text)); break;
        case 'diary': vbCaption(`📓 <b>Diario del capitano</b>: ${esc(l.text.slice(0, 220))}${l.text.length > 220 ? '…' : ''}`, 'story'); await vbWait(Math.min(9000, vbRead(l.text))); break;
        case 'director': if (T) T.focus(null, 'wide'); vbCaption(`🎬 <b>Regia</b>: ${esc(l.text)}`, 'cmd'); await vbWait(vbRead(l.text) + 400); break;
        case 'answer': VB.speaking = l.who; if (T) T.focus(l.who); vbBubble(l.who, l.text, '', 'risponde alla tua domanda'); vbCaption(`❓ Hai chiesto a <b>${esc(l.who)}</b>: «${esc(l.q || '')}»`, 'thought'); await vbWait(vbRead(l.text) + 800); VB.speaking = null; vbBubble(null); vbCaption(''); break;
        case 'cmdask': VB.speaking = l.who; if (T) T.focus(l.who); vbBubble(l.who, l.text, 'cap', 'chiede istruzioni al Comando'); vbCaption(`📡 <b>Il capitano chiama il Comando della Flotta</b>${(l.options || []).length ? ': ' + l.options.map(esc).join(' · ') : ''}`, 'cmd');
          await Promise.all([vbWait(vbRead(l.text) + 600), vbSay(l.who, l.text)]); VB.speaking = null; vbBubble(null); break;
        case 'cmdreply': VB.screenMsg = { from: 'Comando della Flotta', text: l.text }; if (T) T.focus(null, 'screen'); VB.screenDirty = true; vbCaption(`📡 <b>Il Comando risponde</b>${l.player ? ' (sei tu)' : ''}`, 'cmd'); await vbWait(vbRead(l.text) + 800); break;
        case 'rel': vbCaption(`${l.v > 0 ? '🤝' : '💢'} ${esc(l.text)}`, 'thought'); await vbWait(Math.min(3500, vbRead(l.text))); break;
        case 'away': if (T) T.focus(null, 'wide'); vbCaption(`🚀 <b>Squadra di sbarco</b>: ${esc(l.text)}`, l.ok ? 'ok' : 'bad'); await vbWait(vbRead(l.text) + 600); vRenderCrew(); break;
        case 'bet': vbCaption(`🎲 ${esc(l.text)}`, l.won ? 'ok' : 'bad'); vbSound(l.won ? 'ok' : 'bad'); await vbWait(2600); if (typeof vRenderBets === 'function') vRenderBets(); break;
        case 'end': if (T) T.focus(null, 'wide'); vbCaption(`🏁 <b>${esc(l.text)}</b>`, 'turn'); await vbWait(2500); break;
        default: break;
      }
      void i;
    }
  } finally { VB.playing = false; VB.skip = false; vbBubble(null); const w = VB.waiters.splice(0); w.forEach((f) => f()); }
}
/** Resolves when everything already in the log has been shown on the stage. */
function vbIdle() { return new Promise((r) => { if (!VB.playing && VB.shown >= ((VUI.G && VUI.G.log.length) || 0)) r(); else { VB.waiters.push(r); vbPlay(); } }); }
function vbSkip() { VB.skip = true; }
function vbMount(G) {
  const host = $('vbCanvas'); if (!host) return;
  if (VB.three) VB.three.setPeople(); else vbBuild(host);
  VB.shown = G.log.length; VUI.stageShown = G.log.length; VB.screenDirty = true; VB.lastRhythm = G.rhythm; vbHud(); vbBarSync();
  cancelAnimationFrame(VB.raf); const loop = (now) => { if (!window.__ventureActive || !VB.three || $('vPlay').hidden) { VB.raf = 0; return; } VB.three.tick(now); VB.raf = requestAnimationFrame(loop); }; VB.raf = requestAnimationFrame(loop);
}
