/* ===== Scene: island, props, creatures. Exposes window.SC ===== */
(function () {
'use strict';
const LOC = IslandSim.LOC; const ISL = IslandSim.ISL;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio)); // fill-rate: 1.5 looks the same on laptops and costs ~40% less
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('scene').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8ecbf0, 60, 160);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
camera.position.set(17 * Math.max(1, ISL.span), 15 * Math.max(1, ISL.span), 23 * Math.max(1, ISL.span));
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 2);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 5; controls.maxDistance = 90;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xe8d6a8, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.0);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 120 });
scene.add(sun); scene.add(sun.target);
const moon = new THREE.DirectionalLight(0x8fa6ff, 0.0); moon.position.set(-30, 40, -20); scene.add(moon);

const M = (color, opts) => new THREE.MeshPhongMaterial(Object.assign({ color, flatShading: true, shininess: 6 }, opts || {}));
const mesh = (geo, mat, cast = true, recv = false) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; };
// Merge the static meshes under `root` that share a look (colour, side) into one mesh each: far fewer draw calls.
// `skip(m)` keeps a mesh separate (things that move or hide on their own).
function bakeMerge(root, skip) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const buckets = new Map(); const done = [];
  root.traverse((m) => { if (!m.isMesh || (skip && skip(m)) || !m.material || Array.isArray(m.material) || m.material.map || m.material.transparent) return;
    const mt = m.material; const key = mt.type + '|' + mt.color.getHex() + '|' + mt.side + '|' + mt.flatShading + '|' + mt.shininess + '|' + m.castShadow;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (!buckets.has(key)) buckets.set(key, { mat: mt, geos: [], cast: m.castShadow, recv: m.receiveShadow }); buckets.get(key).geos.push(g); done.push(m); });
  buckets.forEach((b) => { if (b.geos.length < 2) { b.geos.forEach((g) => g.dispose()); b.keep = true; } });
  done.forEach((m) => { const mt = m.material; const key = mt.type + '|' + mt.color.getHex() + '|' + mt.side + '|' + mt.flatShading + '|' + mt.shininess + '|' + m.castShadow; if (buckets.get(key).keep) return; m.parent.remove(m); m.geometry.dispose(); });
  buckets.forEach((b) => { if (b.keep) return; let n = 0; b.geos.forEach((g) => { n += g.attributes.position.count; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    b.geos.forEach((g) => { pos.set(g.attributes.position.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.computeBoundingSphere();
    const mm = new THREE.Mesh(geo, b.mat); mm.castShadow = b.cast; mm.receiveShadow = b.recv; mm.userData.merged = true; root.add(mm); });
  return root;
}

// terrain of this (random) island: irregular coastline, hill where the layout put it
function groundH(x, z) {
  const R = ISL.radius(x, z); const r = Math.hypot(x, z) / R * 12.6;
  let h = r < 12.6 ? 0.55 * (1 - Math.pow(r / 12.6, 2)) + 0.06 : 0.06 - (r - 12.6) * 0.35 * Math.min(1.5, R / 12.6);
  const hd = Math.hypot(x - LOC.hill[0], z - LOC.hill[1]);
  h += ISL.hillH * Math.exp(-(hd * hd) / (11 * ISL.k * ISL.k));
  if (ISL.S > 1 && r < 12.6) h += biomeH(x, z, r / 12.6);
  return h;
}
// smooth value noise (deterministic per island) for gentle relief and colour patches
const nHash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + ISL.seed * 0.013) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j; const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (nHash(i, j) * (1 - u) + nHash(i + 1, j) * u) * (1 - v) + (nHash(i, j + 1) * (1 - u) + nHash(i + 1, j + 1) * u) * v; }
const segDist = (x, z, A, B) => { const dx = B[0] - A[0], dz = B[1] - A[1]; const t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - A[0] - dx * t, z - A[1] - dz * t); };
const near2 = (x, z, L) => (L ? Math.hypot(x - L[0], z - L[1]) : 1e9);
// relief of the inland biomes on big islands (rf = distance from centre / coast, 0..1)
function biomeH(x, z, rf) {
  let d = 0; const inland = Math.max(0, 1 - Math.pow(rf / 0.82, 4));
  d += inland * (0.35 + 0.5 * vnoise(x / 9, z / 9));                                   // rolling inland ground
  const cl = near2(x, z, LOC.cliff); if (cl < 9) d += 2.6 * Math.pow(1 - cl / 9, 1.4);   // cliff shoulder over the sea
  const pr = near2(x, z, LOC.promontory); if (pr < 6) d += 1.2 * (1 - pr / 6);
  const ma = near2(x, z, LOC.marsh); if (ma < 8) d -= (0.55 + d * 0.8) * Math.pow(1 - ma / 8, 0.7); // marsh: low, waterlogged
  const lg = near2(x, z, LOC.lagoon); if (lg < 7) d -= 1.3 * Math.pow(1 - lg / 7, 0.8);  // lagoon basin open to the sea
  if (LOC.streamMouth) { const sd = segDist(x, z, LOC.spring, LOC.streamMouth); if (sd < 1.6) d -= 0.45 * (1 - sd / 1.6); }
  return d;
}
{
  const GS = Math.ceil(40 * ISL.span * 1.35); const SEG = ISL.S > 1 ? 230 : 140; const g = new THREE.PlaneGeometry(GS, GS, SEG, SEG); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; const cols = [];
  const sand = new THREE.Color(0xeed9a0), wet = new THREE.Color(0xc9b47c), grass = new THREE.Color(0x7cae5a), dark = new THREE.Color(0x5e8f45);
  const grass2 = new THREE.Color(0x6f9e4c), dry = new THREE.Color(0xa7a05e), dirt = new THREE.Color(0x9a7b52), forestF = new THREE.Color(0x3f6b34), marshC = new THREE.Color(0x56603a), rockC = new THREE.Color(0x8d877c), clearC = new THREE.Color(0x93c069), streamC = new THREE.Color(0x4f8fb0);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); const y = groundH(x, z); p.setY(i, y);
    const r = Math.hypot(x, z); let c = sand.clone();
    if (y < 0.15) c = wet.clone();
    if (ISL.S > 1) { // painted ground: grass patches inland, sand on the coast, biome colours
      const rf = r / ISL.radius(x, z); const n1 = vnoise(x / 4, z / 4), n2 = vnoise(x / 13 + 40, z / 13);
      const inl = Math.max(0, Math.min(1, (0.8 - rf) / 0.12 + (n2 - 0.5) * 0.8));
      if (y > 0.15) { const gc = grass.clone().lerp(grass2, n1).lerp(dry, Math.max(0, n2 - 0.62) * 1.6); c.lerp(gc, inl); if (n1 > 0.78 && inl > 0.5) c.lerp(dirt, 0.35); }
      const fo = near2(x, z, LOC.forest); if (fo < 15) c.lerp(forestF, Math.min(1, (1 - fo / 15) * 1.6) * 0.85);
      const cl = near2(x, z, LOC.clearing); if (cl < 7) c.lerp(clearC, (1 - cl / 7) * 0.8);
      const ma = near2(x, z, LOC.marsh); if (ma < 8.5) c.lerp(marshC, Math.min(1, (1 - ma / 8.5) * 1.5));
      const ck = near2(x, z, LOC.cliff); if (ck < 8 && y > 1) c.lerp(rockC, Math.min(1, (1 - ck / 8) * 1.4));
      if (LOC.streamMouth && segDist(x, z, LOC.spring, LOC.streamMouth) < 0.9) c.lerp(streamC, 0.75);
    }
    const hd = Math.hypot(x - LOC.hill[0], z - LOC.hill[1]);
    if (hd < 5.5 * ISL.k && y > 0.9) c.lerp(grass, Math.min(1, (y - 0.9) / 0.6));
    if (Math.hypot(x - LOC.shelter[0] + 1, z - LOC.shelter[1] + 1.8) < 4.5 * ISL.k) c.lerp(grass, ISL.S > 1 ? 0.15 : 0.35);
    if (y > 2.1) c.lerp(dark, 0.4);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
  scene.add(mesh(g, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 4 }), false, true));
}
const SEA_S = Math.max(260, Math.ceil(40 * ISL.span * 1.35 * 1.9)); const seaGeo = new THREE.PlaneGeometry(SEA_S, SEA_S, 110, 110); seaGeo.rotateX(-Math.PI / 2);
const seaBase = Float32Array.from(seaGeo.attributes.position.array);
const seaMat = new THREE.MeshPhongMaterial({ color: 0x2b8cbe, flatShading: true, shininess: 80 });
// waves computed on the GPU (was ~8k vertices updated in JS every frame); calmer inside the reef
{ const damp = new Float32Array(seaGeo.attributes.position.count); for (let i = 0; i < damp.length; i++) { const x = seaBase[i * 3], z = seaBase[i * 3 + 2]; damp[i] = Math.hypot(x, z) < ISL.radius(x, z) + 1.4 ? 0.35 : 1; } seaGeo.setAttribute('aDamp', new THREE.BufferAttribute(damp, 1)); }
const seaU = { uTime: { value: 0 }, uWaves: { value: 0.3 }, uWind: { value: 0.2 }, uTide: { value: 0 } };
seaMat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, seaU);
  sh.vertexShader = 'uniform float uTime, uWaves, uWind, uTide;\nattribute float aDamp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    transformed.y = uTide + aDamp * uWaves * (sin(position.x * 0.35 + uTime * (1.1 + uWind)) + cos(position.z * 0.28 + uTime * 0.9) * 0.8 + sin((position.x + position.z) * 0.9 + uTime * 2.2) * 0.35 * uWind);`); };
const seaMesh = mesh(seaGeo, seaMat, false, true); seaMesh.frustumCulled = false; scene.add(seaMesh);
function updateSea(time, waves, wind, tide) { seaU.uTime.value = time; seaU.uWaves.value = waves; seaU.uWind.value = wind; seaU.uTide.value = tide || 0; }
const at = (loc, dx = 0, dz = 0) => new THREE.Vector3(loc[0] + dx, groundH(loc[0] + dx, loc[1] + dz), loc[1] + dz);

/* palms */
const palms = [];
function makePalm(base, lean) {
  const g = new THREE.Group(); g.position.copy(base);
  const trunkMat = M(0x8b6a43); let y = 0, x = 0; const segs = 7;
  for (let i = 0; i < segs; i++) {
    const s = mesh(new THREE.CylinderGeometry(0.17 - i * 0.012, 0.2 - i * 0.012, 0.62, 7), trunkMat);
    x = Math.pow(i / segs, 2) * lean; s.position.set(x, y + 0.31, 0); s.rotation.z = -lean * 0.12 * (i / segs); g.add(s); y += 0.58;
  }
  const crown = new THREE.Group(); crown.position.set(x + lean * 0.15, y, 0); g.add(crown);
  const leafMat = M(0x3f9b4a, { side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const lp = new THREE.Group(); lp.rotation.y = (i / 7) * Math.PI * 2;
    const leaf = mesh(new THREE.ConeGeometry(0.32, 2.4, 4), leafMat); leaf.scale.z = 0.25; leaf.rotation.z = -Math.PI / 2; leaf.position.x = 1.1;
    const tilt = new THREE.Group(); tilt.rotation.z = -0.45; tilt.add(leaf); lp.add(tilt); crown.add(lp);
  }
  const nuts = [];
  for (let i = 0; i < 6; i++) { const n = mesh(new THREE.SphereGeometry(0.13, 6, 5), M(0x6b4a2b)); n.position.set(Math.cos(i * 1.1) * 0.22, -0.15, Math.sin(i * 1.1) * 0.22); crown.add(n); nuts.push(n); }
  scene.add(g); bakeMerge(g, (m) => nuts.includes(m)); const palm = { g, crown, nuts }; palms.push(palm); return palm;
}
const palmA = makePalm(at(LOC.palmA, 0.8, -0.4), 0.6);
const palmB = makePalm(at(LOC.palmB, -0.7, -0.5), -0.4);
const palmC = makePalm(at(LOC.palmC, 0.6, 0.6), 0.8);
/* this island's extra resources */
const extraPalms = [];
{
  const rr = IslandSim.rngFrom(ISL.seed * 13 + 5); const res = ISL.res;
  for (let i = 0; i < res.extraPalms; i++) { const ang = rr() * Math.PI * 2; const p = ISL.shoreAt(ang, -2.5 - rr() * 3); const n = palms.length; const pm = makePalm(at(p), (rr() - 0.5) * 1.6); palms.splice(n, 1); extraPalms.push(pm); }
  const green = (c) => M(c || 0x4f9a3f, { side: THREE.DoubleSide });
  if (res.banana) for (let i = 0; i < 3; i++) { const g = new THREE.Group(); g.position.copy(at(LOC.banana, (i - 1) * 1.1, (i % 2) * 0.8)); const t = mesh(new THREE.CylinderGeometry(0.11, 0.15, 1.6, 6), M(0x7d9a4a)); t.position.y = 0.8; g.add(t); for (let j = 0; j < 6; j++) { const l = mesh(new THREE.BoxGeometry(1.3, 0.02, 0.38), green(0x5fae4a)); l.position.set(Math.cos(j) * 0.55, 1.65, Math.sin(j) * 0.55); l.rotation.set(0, -j, 0.45); g.add(l); } const f = mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.35, 6), M(0xd8c84a)); f.position.set(0.15, 1.3, 0); g.add(f); scene.add(g); }
  if (res.papaya) for (let i = 0; i < 2; i++) { const g = new THREE.Group(); g.position.copy(at(LOC.papaya, i * 1.3, i * 0.6)); const t = mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.2, 6), M(0x8f8a6a)); t.position.y = 1.1; g.add(t); for (let j = 0; j < 5; j++) { const l = mesh(new THREE.BoxGeometry(0.8, 0.02, 0.5), green(0x4c8f3a)); l.position.set(Math.cos(j * 1.3) * 0.4, 2.25, Math.sin(j * 1.3) * 0.4); l.rotation.set(0, -j * 1.3, 0.4); g.add(l); } for (let j = 0; j < 3; j++) { const f = mesh(new THREE.SphereGeometry(0.1, 6, 5), M(0xe0a030)); f.scale.y = 1.4; f.position.set(Math.cos(j * 2) * 0.12, 1.95, Math.sin(j * 2) * 0.12); g.add(f); } scene.add(g); }
  if (res.bamboo) for (let i = 0; i < 14; i++) { const c = mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4 + rr() * 1.6, 6), M(i % 3 ? 0x8fb35a : 0x6f9a3a)); const ang = i * 2.4, d = 0.3 + (i % 5) * 0.25; c.position.copy(at(LOC.bamboo, Math.cos(ang) * d, Math.sin(ang) * d)); c.position.y += 1.3; c.rotation.z = (rr() - 0.5) * 0.15; scene.add(c); }
  if (res.cave) { const g = new THREE.Group(); g.position.copy(at(LOC.cave)); const big = mesh(new THREE.DodecahedronGeometry(1.7, 0), M(0x7d776d)); big.scale.set(1.5, 0.9, 1); big.position.y = 0.9; g.add(big); const mouth = mesh(new THREE.BoxGeometry(1.1, res.cave === 'grotta' ? 1.2 : 0.7, 0.4), M(0x1d1b19)); mouth.position.set(0, res.cave === 'grotta' ? 0.6 : 0.95, 1.45); g.add(mouth); if (res.cave === 'sporgenza') { const lip = mesh(new THREE.BoxGeometry(2.4, 0.3, 1.4), M(0x8a8478)); lip.position.set(0, 1.5, 1.6); g.add(lip); } g.lookAt(new THREE.Vector3(0, g.position.y, 0)); scene.add(g); }
  if (res.clay) { const c = mesh(new THREE.CircleGeometry(1.3, 9), M(0xa0623a)); c.rotation.x = -Math.PI / 2; c.position.copy(at(LOC.clay)); c.position.y += 0.03; scene.add(c); }
  if (res.nests) for (let i = 0; i < 3; i++) { const n = mesh(new THREE.TorusGeometry(0.16, 0.05, 5, 8), M(0x8a7350)); n.rotation.x = -Math.PI / 2; n.position.copy(at(LOC.nests, i * 0.7 - 0.7, (i % 2) * 0.5)); n.position.y += 0.25; scene.add(n); const e = mesh(new THREE.SphereGeometry(0.06, 6, 5), M(0xf3ead2)); e.position.copy(n.position); e.position.y += 0.04; scene.add(e); }
  if (res.lianas) for (let i = 0; i < 4; i++) { const l = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4), M(0x4a6b2a)); l.position.copy(at(LOC.woodSpot, -1 + i * 0.6, -1.2)); l.position.y += 1.2; l.rotation.z = 0.3 - i * 0.15; scene.add(l); }
}

const rocks = new THREE.Group(); scene.add(rocks);
function rock(pos, s, color) { const r = mesh(new THREE.DodecahedronGeometry(s, 0), M(color || 0x8f8f8f)); r.position.copy(pos); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); r.scale.y = 0.7; rocks.add(r); return r; }
[[0, 0, 0.55], [1.1, -0.5, 0.4], [0.5, 1.0, 0.45], [-0.6, 0.8, 0.35]].forEach(([dx, dz, s]) => rock(at(LOC.stones, dx - 0.9, dz), s, 0x9a9a9a));
[[0.4, -0.9], [-0.2, -1.1]].forEach(([dx, dz]) => rock(at(LOC.stones, dx, dz), 0.18, 0x222222));
[[1.4, 0.2, 1.1], [2.2, -0.8, 1.4], [1.6, 1.4, 0.9], [2.8, 0.9, 1.0]].forEach(([dx, dz, s]) => rock(new THREE.Vector3(LOC.rocksEast[0] + dx, -0.2, LOC.rocksEast[1] + dz), s, 0x6f6a66));
rock(at(LOC.sitSpot, 0, 0.2), 0.35, 0xa29a8c);
const springC = at(LOC.spring, -1.1, -0.2);
const pond = mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 16), new THREE.MeshPhongMaterial({ color: 0x4fb3e8, shininess: 100, flatShading: true }), false, true);
pond.position.copy(springC).add(new THREE.Vector3(0, 0.02, 0)); scene.add(pond);
for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; rock(springC.clone().add(new THREE.Vector3(Math.cos(a) * 1.15, 0.05, Math.sin(a) * 1.15)), 0.22, 0x8a8a8a); }

/* crate & tools */
const crate = new THREE.Group(); crate.position.copy(at(LOC.crate, 0.9, 0.1)); scene.add(crate);
{ const b = mesh(new THREE.BoxGeometry(0.9, 0.55, 0.65), M(0x9c6b3c)); b.position.y = 0.27; crate.add(b); }
function makeAxe() { const g = new THREE.Group(); const h = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), M(0x7a5230)); h.position.y = 0.35; g.add(h); const b = mesh(new THREE.BoxGeometry(0.22, 0.14, 0.04), M(0xb0b6bd)); b.position.set(0.1, 0.64, 0); g.add(b); return g; }
function makeRod() { const g = new THREE.Group(); const r = mesh(new THREE.CylinderGeometry(0.012, 0.025, 2.3, 5), M(0x3b2f2f)); r.position.y = 1.15; g.add(r); const reel = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8), M(0x999999)); reel.rotation.z = Math.PI / 2; reel.position.set(0.05, 0.35, 0); g.add(reel); const tip = new THREE.Object3D(); tip.position.y = 2.3; g.add(tip); g.userData.tip = tip; return g; }
function makeSpear() { const g = new THREE.Group(); const r = mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.8, 5), M(0x8b6a43)); r.position.y = 0.9; g.add(r); const p = mesh(new THREE.ConeGeometry(0.04, 0.2, 4), M(0x5a4a3a)); p.position.y = 1.9; g.add(p); return g; }
const crateAxe = makeAxe(); crateAxe.position.set(0.5, 0, 0.1); crateAxe.rotation.z = 0.25; crate.add(crateAxe);
const crateRod = makeRod(); crateRod.position.set(-0.5, 0, 0); crateRod.rotation.z = -0.35; crate.add(crateRod);
const rope = mesh(new THREE.TorusGeometry(0.14, 0.04, 5, 10), M(0xc7a86a)); rope.rotation.x = Math.PI / 2; rope.position.set(0.15, 0.57, 0); crate.add(rope);
const crateSpear = makeSpear(); crateSpear.position.set(0.2, 0, -0.4); crateSpear.rotation.z = 0.5; crate.add(crateSpear); crateSpear.visible = false;

/* fire */
function makeFire(scale) {
  const g = new THREE.Group();
  const flames = [0xff6a00, 0xffa31a, 0xffe066].map((c, i) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.05, 0.6 - i * 0.12, 6), new THREE.MeshBasicMaterial({ color: c })); f.position.y = 0.3; g.add(f); return f; });
  const light = new THREE.PointLight(0xff8c3a, 0, 9 * scale, 2); light.position.y = 0.7; g.add(light);
  g.scale.setScalar(scale); g.userData = { flames, light }; return g;
}
const fireC = at(LOC.firepit, 0.9, -0.2);
for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; rock(fireC.clone().add(new THREE.Vector3(Math.cos(a) * 0.45, 0.05, Math.sin(a) * 0.45)), 0.12, 0x6d6d6d); }
const pitLogs = new THREE.Group(); pitLogs.position.copy(fireC); scene.add(pitLogs);
for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5), M(0x4a3420)); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.05; l.position.y = 0.06; pitLogs.add(l); }
const campFire = makeFire(1); campFire.position.copy(fireC); scene.add(campFire);
const woodStack = new THREE.Group(); woodStack.position.copy(at(LOC.firepit, -0.6, 0.7)); scene.add(woodStack);
const woodLogs = [];
for (let i = 0; i < 12; i++) { const l = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5), M(0x7a5a36)); l.rotation.z = Math.PI / 2; l.position.set(0, 0.07 + Math.floor(i / 4) * 0.12, (i % 4) * 0.13 - 0.2); woodStack.add(l); woodLogs.push(l); }
const hillPile = new THREE.Group(); hillPile.position.copy(at(LOC.hill, 1.4, 0.4)); scene.add(hillPile);
for (let i = 0; i < 9; i++) { const l = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 5), M(0x6b4a2b)); l.rotation.z = Math.PI / 2 - 0.5; l.rotation.y = (i / 9) * Math.PI * 2; l.position.y = 0.35; hillPile.add(l); }
const bonfire = makeFire(2.6); bonfire.position.copy(hillPile.position); scene.add(bonfire);
const smoke = new THREE.Group(); scene.add(smoke); smoke.position.copy(hillPile.position);
const smokePuffs = [];
for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshPhongMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.55, flatShading: true, shininess: 0 })); smoke.add(s); smokePuffs.push(s); }

/* shelter (3 levels) + bed */
const shelter = new THREE.Group(); shelter.position.copy(at(LOC.shelter, 0, -0.3)); shelter.rotation.y = 0.35; scene.add(shelter);
const shL = [new THREE.Group(), new THREE.Group(), new THREE.Group()]; shL.forEach((g) => shelter.add(g));
const poleMat = M(0x7a5a36);
[[-1, -0.9], [1, -0.9], [-1, 0.9], [1, 0.9]].forEach(([x, z]) => { const p = mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.7, 5), poleMat); p.position.set(x, 0.85, z); shL[0].add(p); });
{ const r = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 5), poleMat); r.rotation.z = Math.PI / 2; r.position.y = 1.7; shL[0].add(r); }
const roofMat = M(0x4f9a3e, { side: THREE.DoubleSide });
[-1, 1].forEach((s) => { const pl = mesh(new THREE.PlaneGeometry(2.4, 1.5), roofMat); pl.position.set(0, 1.25, s * 0.55); pl.rotation.x = s > 0 ? -Math.PI / 2 + 0.62 : Math.PI / 2 - 0.62; shL[1].add(pl); });
[-0.7, 0, 0.7].forEach((x) => { const t = mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 8), M(0xc7a86a)); t.position.set(x, 1.7, 0); shL[2].add(t); });
[-1, 1].forEach((s) => { const pl = mesh(new THREE.PlaneGeometry(2.5, 0.5), M(0x3b7d2f, { side: THREE.DoubleSide })); pl.position.set(0, 1.55, s * 0.3); pl.rotation.x = s > 0 ? -Math.PI / 2 + 0.62 : Math.PI / 2 - 0.62; shL[2].add(pl); });
const bed = new THREE.Group(); shelter.add(bed);
{ const f = mesh(new THREE.BoxGeometry(1.6, 0.12, 1.0), M(0x7a5a36)); f.position.y = 0.25; bed.add(f); const m = mesh(new THREE.BoxGeometry(1.5, 0.08, 0.9), M(0x9cc26b)); m.position.y = 0.34; bed.add(m);
  [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]].forEach(([x, z]) => { const l = mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), M(0x6b4a2b)); l.position.set(x, 0.12, z); bed.add(l); }); }

/* bushes (dry wood) */
const bushes = [];
for (let i = 0; i < 8; i++) { const b = mesh(new THREE.ConeGeometry(0.45 + Math.random() * 0.25, 0.9 + Math.random() * 0.4, 6), M(i % 2 ? 0x8a7a4a : 0x6f8a3a)); const a = i * 0.8; b.position.copy(at(LOC.woodSpot, Math.cos(a) * (1.2 + (i % 3) * 0.5), Math.sin(a) * (1.0 + (i % 2) * 0.6))); b.position.y += 0.4; scene.add(b); bushes.push(b); }
function makeStump(palm) { const s2 = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.35, 7), M(0x7a5a36)); s2.position.copy(palm.g.position).add(new THREE.Vector3(0, 0.17, 0)); scene.add(s2); s2.visible = false; return s2; }
[palmA, palmB, palmC].forEach((p) => { p.stump = makeStump(p); });
/* raft */
const raft = new THREE.Group(); raft.position.copy(at(ISL.shoreAt(Math.atan2(LOC.shoreSouth[1], LOC.shoreSouth[0]), -1))); raft.position.y = 0.08; raft.rotation.y = 0.3; scene.add(raft);
const raftLogs = [];
for (let i = 0; i < 8; i++) { const l = mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.4, 6), M(0x8b6a43)); l.rotation.z = Math.PI / 2; l.position.z = (i - 3.5) * 0.23; raft.add(l); raftLogs.push(l); }
{ const mast = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 5), M(0x6b4a2b)); mast.position.y = 0.9; raft.add(mast); raftLogs.push(mast);
  const sail = mesh(new THREE.PlaneGeometry(1.0, 1.2), M(0xe8dcc0, { side: THREE.DoubleSide })); sail.position.set(0, 1.1, 0.02); raft.add(sail); raftLogs.push(sail); }

/* SOS stones */
const SOS_PAT = { S: ['###', '#..', '###', '..#', '###'], O: ['###', '#.#', '#.#', '#.#', '###'] };
const sosStones = [];
['S', 'O', 'S'].forEach((L, li) => SOS_PAT[L].forEach((row, r) => [...row].forEach((c, ci) => {
  if (c !== '#') return;
  const x = LOC.sos[0] - 1.6 + li * 1.35 + ci * 0.36, z = LOC.sos[1] - 0.9 + r * 0.36;
  const s = mesh(new THREE.DodecahedronGeometry(0.15, 0), M(0x5d5d5d)); s.position.set(x, groundH(x, z) + 0.05, z); s.scale.y = 0.6; scene.add(s); sosStones.push(s);
})));

/* ball */
function ballTexture(face) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f5f5f0'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#d64545'; for (let i = 0; i < 4; i++) x.fillRect(i * 64 + 20, 0, 18, 128);
  if (face) { x.fillStyle = '#222'; x.beginPath(); x.arc(110, 52, 6, 0, 7); x.arc(146, 52, 6, 0, 7); x.fill(); x.lineWidth = 4; x.strokeStyle = '#222'; x.beginPath(); x.arc(128, 66, 18, 0.2, Math.PI - 0.2); x.stroke(); }
  return new THREE.CanvasTexture(c);
}
const ballMatPlain = new THREE.MeshLambertMaterial({ map: ballTexture(false) });
const ballMatFace = new THREE.MeshLambertMaterial({ map: ballTexture(true) });
const ball = mesh(new THREE.SphereGeometry(0.28, 16, 12), ballMatPlain); scene.add(ball);

/* ship */
const ship = new THREE.Group(); scene.add(ship);
{ const hull = mesh(new THREE.BoxGeometry(5, 1.1, 1.6), M(0x5a3b28)); hull.position.y = 0.4; ship.add(hull);
  const cab = mesh(new THREE.BoxGeometry(1.6, 1, 1.2), M(0xeeeeee)); cab.position.set(-1, 1.4, 0); ship.add(cab);
  const mast = mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 5), M(0x333333)); mast.position.set(0.8, 2.6, 0); ship.add(mast);
  const sail = mesh(new THREE.PlaneGeometry(2, 2.4), M(0xfafafa, { side: THREE.DoubleSide })); sail.position.set(0.8, 2.8, 0.05); sail.rotation.y = Math.PI / 2; ship.add(sail);
  const chim = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 6), M(0xc0392b)); chim.position.set(-1.3, 2.2, 0); ship.add(chim); }
ship.visible = false;

bakeMerge(rocks); bakeMerge(pitLogs);
/* big islands: forest, scattered trees, marsh, cliff, lagoon, east beach, promontory, abandoned hut */
const bigX = { trees: null, crowns: null, hutRuin: null, hutFixed: null, treeList: [] };
if (ISL.S > 1) {
  const rr = IslandSim.rngFrom(ISL.seed * 17 + 3); const L0 = Object.entries(LOC).filter(([k]) => !['forest', 'stream', 'streamMouth'].includes(k)).map(([, v]) => v);
  const clear = (x, z, d) => L0.every((q) => Math.hypot(q[0] - x, q[1] - z) > d);
  const pts = [];
  for (let i = 0; i < 170; i++) { const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * 13; const x = LOC.forest[0] + Math.cos(a) * d, z = LOC.forest[1] + Math.sin(a) * d; if (Math.hypot(x, z) < ISL.radius(x, z) * 0.82 && clear(x, z, 3.2) && groundH(x, z) > 0.25) pts.push([x, z, 0.8 + rr() * 0.7, 0]); }
  for (let i = 0; i < 900 && pts.length < 300; i++) { const x = (rr() * 2 - 1) * ISL.span * 30, z = (rr() * 2 - 1) * ISL.span * 30; const rf = Math.hypot(x, z) / ISL.radius(x, z); if (rf > 0.74 || groundH(x, z) < 0.3 || !clear(x, z, 4.5) || vnoise(x / 13 + 40, z / 13) < 0.55) continue; pts.push([x, z, 0.6 + rr() * 0.6, 1]); }
  const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6); trunkG.translate(0, 1.1, 0);
  const crownG = new THREE.DodecahedronGeometry(1.25, 0); crownG.translate(0, 2.9, 0);
  const trunks = new THREE.InstancedMesh(trunkG, M(0x6b4a2b), pts.length), crowns = new THREE.InstancedMesh(crownG, M(0xffffff), pts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
  const greens = [0x3f7d3a, 0x4f8f3f, 0x5f9a45, 0x3a6e35, 0x6f9c3f, 0xa8862e, 0x8f9a3a];
  pts.forEach(([x, z, s2, kind], i) => { pos.set(x, groundH(x, z) - 0.05, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rr() * 6.28); sc.set(s2, s2 * (0.85 + rr() * 0.4), s2); m4.compose(pos, q, sc); trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4);
    col.setHex(greens[Math.floor(rr() * (kind ? greens.length : 5))]); crowns.setColorAt(i, col); bigX.treeList.push({ x, z, s: s2 }); });
  bigX.nForest = pts.filter((q) => q[3] === 0).length; bigX.mats = Float32Array.from(trunks.instanceMatrix.array); bigX.cut = 0;
  trunks.castShadow = crowns.castShadow = true; crowns.receiveShadow = true; scene.add(trunks); scene.add(crowns); bigX.trees = trunks; bigX.crowns = crowns;
  // marsh: pools and reeds
  { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const a = rr() * 6.28, d = rr() * 5; const x = LOC.marsh[0] + Math.cos(a) * d, z = LOC.marsh[1] + Math.sin(a) * d; const pool = mesh(new THREE.CircleGeometry(1 + rr() * 1.4, 10), new THREE.MeshPhongMaterial({ color: 0x4a5a3a, shininess: 60 }), false, true); pool.rotation.x = -Math.PI / 2; pool.position.set(x, Math.max(groundH(x, z), -0.1) + 0.04, z); g.add(pool); }
    for (let i = 0; i < 60; i++) { const a = rr() * 6.28, d = 1 + rr() * 6.5; const x = LOC.marsh[0] + Math.cos(a) * d, z = LOC.marsh[1] + Math.sin(a) * d; const rd = mesh(new THREE.CylinderGeometry(0.02, 0.03, 1 + rr() * 0.8, 4), M(i % 3 ? 0x7a8a3a : 0x9a8f4a)); rd.position.set(x, groundH(x, z) + 0.5, z); rd.rotation.z = (rr() - 0.5) * 0.3; g.add(rd); }
    scene.add(bakeMerge(g)); }
  // cliff and promontory boulders
  { const g = new THREE.Group(); [[LOC.cliff, 14, 0.9], [LOC.promontory, 8, 0.7]].forEach(([L, n, s0]) => { for (let i = 0; i < n; i++) { const a = rr() * 6.28, d = rr() * 5; const x = L[0] + Math.cos(a) * d, z = L[1] + Math.sin(a) * d; const r2 = mesh(new THREE.DodecahedronGeometry(s0 * (0.6 + rr()), 0), M(i % 2 ? 0x7d776d : 0x8f8a80)); r2.position.set(x, groundH(x, z) + 0.2, z); r2.rotation.set(rr() * 3, rr() * 3, 0); r2.scale.y = 0.75; g.add(r2); } }); scene.add(bakeMerge(g)); }
  // lagoon: turquoise shallow water and sand bar; east beach: driftwood
  { const lg = mesh(new THREE.CircleGeometry(5.5, 20), new THREE.MeshPhongMaterial({ color: 0x3fc1c9, transparent: true, opacity: 0.55, shininess: 90 }), false, false); lg.rotation.x = -Math.PI / 2; lg.position.set(LOC.lagoon[0], 0.03, LOC.lagoon[1]); scene.add(lg);
    const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const a = rr() * 6.28, d = rr() * 3.5; const x = LOC.beachEast[0] + Math.cos(a) * d, z = LOC.beachEast[1] + Math.sin(a) * d; const lgw = mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.6 + rr() * 1.4, 6), M(0xb9a27a)); lgw.rotation.z = Math.PI / 2; lgw.rotation.y = rr() * 3; lgw.position.set(x, groundH(x, z) + 0.12, z); g.add(lgw); } scene.add(bakeMerge(g)); }
  // abandoned hut: a ruin until someone repairs it
  { const mk = (fixed) => { const g = new THREE.Group(); const wood = M(fixed ? 0x8a6a42 : 0x6f5a40), dark = M(0x4a3a28);
      [[-1.3, 0, 0.1, 2.6], [1.3, 0, 0.1, 2.6]].forEach(([x, z, w, d]) => { const wl = mesh(new THREE.BoxGeometry(w, 1.6, d), wood); wl.position.set(x, 0.8, z); g.add(wl); });
      const back = mesh(new THREE.BoxGeometry(2.7, 1.6, 0.1), wood); back.position.set(0, 0.8, -1.3); g.add(back);
      const front = mesh(new THREE.BoxGeometry(1.0, 1.6, 0.1), wood); front.position.set(-0.85, 0.8, 1.3); g.add(front);
      const roof = mesh(new THREE.BoxGeometry(3.0, 0.08, 3.1), M(fixed ? 0x6b8a3a : 0x5a5a3a)); roof.position.set(0, fixed ? 1.75 : 1.1, 0); roof.rotation.z = fixed ? 0.12 : 0.5; roof.rotation.x = fixed ? 0 : 0.25; g.add(roof);
      if (!fixed) { const beam = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), dark); beam.position.set(0.4, 0.4, 0.6); beam.rotation.z = 1.2; g.add(beam); }
      g.position.copy(at(LOC.hut)); g.rotation.y = Math.atan2(LOC.hut[0], LOC.hut[1]); scene.add(g); return bakeMerge(g); };
    bigX.hutRuin = mk(false); bigX.hutFixed = mk(true); bigX.hutFixed.visible = false; }
}
/* sky */
const stars = new THREE.Points(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 700 }, () => { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); v.y = Math.abs(v.y) * 0.9 + 0.05; return v.multiplyScalar(180); })),
  new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0, fog: false }));
scene.add(stars);
const clouds = [];
for (let i = 0; i < 16; i++) {
  const c = new THREE.Group();
  for (let j = 0; j < 4; j++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + Math.random() * 1.6, 0), new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, flatShading: true, shininess: 0 })); p.position.set(j * 2.4 - 3.6, Math.random(), Math.random() * 1.5); c.add(p); }
  const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 45;
  c.position.set(Math.cos(a) * r, 26 + Math.random() * 8, Math.sin(a) * r); c.userData.order = Math.random(); scene.add(c); clouds.push(c);
}
const RAIN_N = 4000; const rainGeo = new THREE.BufferGeometry(); const rainPos = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++) { rainPos[i * 3] = (Math.random() - 0.5) * 60; rainPos[i * 3 + 1] = Math.random() * 30; rainPos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaecbe8, size: 0.12, transparent: true, opacity: 0.0 })); scene.add(rain);

/* wildlife */
function makeGull() {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.16, 7, 5), M(0xf4f4f4)); body.scale.set(0.8, 0.7, 1.6); g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.09, 6, 5), M(0xffffff)); head.position.set(0, 0.06, 0.25); g.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.025, 0.12, 4), M(0xf2b632)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.05, 0.36); g.add(beak);
  const wl = new THREE.Group(), wr = new THREE.Group(); g.add(wl, wr); const wm = M(0xd9dde3, { side: THREE.DoubleSide });
  const a = mesh(new THREE.BoxGeometry(0.6, 0.02, 0.2), wm); a.position.x = -0.3; wl.add(a); const b = mesh(new THREE.BoxGeometry(0.6, 0.02, 0.2), wm); b.position.x = 0.3; wr.add(b);
  g.userData = { wl, wr, phase: Math.random() * 6, r: 6 + Math.random() * 6, h: 6 + Math.random() * 4, speed: 0.25 + Math.random() * 0.2 };
  scene.add(g); return g;
}
const gulls = Array.from({ length: 6 }, makeGull);
const pelican = new THREE.Group(); scene.add(pelican);
{ const body = mesh(new THREE.SphereGeometry(0.4, 8, 6), M(0xf1efe8)); body.scale.set(0.9, 0.85, 1.4); body.position.y = 0.45; pelican.add(body);
  const neck = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 6), M(0xf1efe8)); neck.position.set(0, 0.85, 0.35); neck.rotation.x = -0.3; pelican.add(neck);
  const head = mesh(new THREE.SphereGeometry(0.13, 7, 5), M(0xf8f2d8)); head.position.set(0, 1.12, 0.45); pelican.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.07, 0.75, 5), M(0xf0a830)); beak.rotation.x = Math.PI / 2 + 0.35; beak.position.set(0, 0.98, 0.82); pelican.add(beak); }
const pelicanPerch = new THREE.Vector3(LOC.rocksEast[0] + 2.2, 0.85, LOC.rocksEast[1] - 0.8); pelican.position.copy(pelicanPerch);
const dolphins = Array.from({ length: 3 }, () => { const g = new THREE.Group(); const b = mesh(new THREE.SphereGeometry(0.35, 8, 6), M(0x6f8fa8)); b.scale.set(0.7, 0.7, 2.4); g.add(b); const fin = mesh(new THREE.ConeGeometry(0.12, 0.35, 4), M(0x5c7a91)); fin.position.set(0, 0.3, -0.1); g.add(fin); scene.add(g); g.visible = false; return g; });
const dog = new THREE.Group(); scene.add(dog);
{ const b = mesh(new THREE.BoxGeometry(0.3, 0.28, 0.7), M(0xa0703c)); b.position.y = 0.42; dog.add(b);
  const h = mesh(new THREE.BoxGeometry(0.26, 0.26, 0.3), M(0xa0703c)); h.position.set(0, 0.65, 0.42); dog.add(h);
  const sn = mesh(new THREE.BoxGeometry(0.14, 0.12, 0.16), M(0x7a5230)); sn.position.set(0, 0.6, 0.62); dog.add(sn);
  [-0.09, 0.09].forEach((x) => { const e = mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), M(0x5c3d20)); e.position.set(x, 0.82, 0.38); dog.add(e); });
  [[-0.1, -0.25], [0.1, -0.25], [-0.1, 0.25], [0.1, 0.25]].forEach(([x, z]) => { const l = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), M(0x8b5e34)); l.position.set(x, 0.15, z); dog.add(l); });
  const tail = mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.3, 4), M(0xa0703c)); tail.position.set(0, 0.6, -0.42); tail.rotation.x = -0.8; dog.add(tail); dog.userData.tail = tail; }
dog.visible = false;
const crabs = Array.from({ length: 6 }, () => { const g = new THREE.Group(); const b = mesh(new THREE.SphereGeometry(0.12, 6, 4), M(0xd2462d)); b.scale.y = 0.5; g.add(b); [-1, 1].forEach((s) => { const c = mesh(new THREE.SphereGeometry(0.05, 4, 3), M(0xe0583a)); c.position.set(s * 0.13, 0, 0.1); g.add(c); }); scene.add(g); g.visible = false; g.userData.ph = Math.random() * 6; return g; });
const shark = new THREE.Group(); scene.add(shark);
{ const f = mesh(new THREE.ConeGeometry(0.3, 0.8, 3), M(0x4f5b66)); f.scale.z = 0.25; f.position.y = 0.3; shark.add(f); }
shark.visible = false;
const bottle = new THREE.Group(); scene.add(bottle);
{ const b = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 8), new THREE.MeshPhongMaterial({ color: 0x5fae7a, transparent: true, opacity: 0.8, flatShading: true })); b.rotation.z = Math.PI / 2; bottle.add(b); }
bottle.visible = false;

/* label sprites + sand text */
function textTexture(text, opts) {
  opts = opts || {};
  const c = document.createElement('canvas'); c.width = opts.w || 512; c.height = opts.h || 128; const x = c.getContext('2d');
  if (opts.bg) { x.fillStyle = opts.bg; x.fillRect(0, 0, c.width, c.height); }
  x.fillStyle = opts.color || '#3a2a14'; x.font = `${opts.weight || 'bold'} ${opts.size || 40}px ${opts.font || 'sans-serif'}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  words.forEach((w) => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > c.width - 30) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line);
  const lh = (opts.size || 40) * 1.15; const y0 = c.height / 2 - ((lines.length - 1) * lh) / 2;
  lines.slice(0, 4).forEach((l, i) => x.fillText(l, c.width / 2, y0 + i * lh));
  const t = new THREE.CanvasTexture(c); return t;
}
function makeLabel(text) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(text, { bg: 'rgba(255,255,255,0.85)', size: 34, color: '#1d2433', h: 96 }), depthTest: false }));
  sp.scale.set(2.6, 0.5, 1); return sp;
}
function makeSandText(text, loc, stones) {
  const tex = textTexture(text.toUpperCase(), { color: stones ? '#4a4a4a' : '#9b7c45', size: 46, font: 'serif', w: 512, h: 160 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(loc[0], groundH(loc[0], loc[1]) + 0.04, loc[1]); scene.add(m); return m;
}
const ANIMAL_COLORS = { capra: 0xf0ece0, maiale: 0xf2b5b0, cinghiale: 0x5a4636, gatto: 0x8a8a8a, volpe: 0xd2691e, scimmia: 0x7a5230, cavallo: 0x8b5a2b, mucca: 0xf5f5f5, pecora: 0xf3f0e6, coniglio: 0xcfc6b8, lucertola: 0x6b8e23, iguana: 0x5f8f3a, pappagallo: 0x2ecc40, corvo: 0x222222, delfino: 0x6f8fa8, balena: 0x4a5a6a, orca: 0x222222, tartaruga: 0x6b7f3a, medusa: 0xe0a0e0 };
function colorFor(name, dflt) { const n = String(name).toLowerCase(); const k = Object.keys(ANIMAL_COLORS).find((x) => n.includes(x)); return k ? ANIMAL_COLORS[k] : dflt; }
function makeQuad(name) {
  const g = new THREE.Group(); const c = M(colorFor(name, 0xa08060)); const small = /gatt|conigl|lucert|iguan|volpe/i.test(name); const s = small ? 0.6 : 1;
  const b = mesh(new THREE.BoxGeometry(0.34 * s, 0.32 * s, 0.8 * s), c); b.position.y = 0.48 * s; g.add(b);
  const h = mesh(new THREE.BoxGeometry(0.26 * s, 0.26 * s, 0.32 * s), c); h.position.set(0, 0.72 * s, 0.48 * s); g.add(h);
  if (/capr|mucc|cervo/i.test(name)) [-0.08, 0.08].forEach((x) => { const hr = mesh(new THREE.ConeGeometry(0.03, 0.2, 4), M(0x4a4030)); hr.position.set(x, 0.92 * s, 0.42 * s); hr.rotation.x = -0.4; g.add(hr); });
  [[-0.12, -0.28], [0.12, -0.28], [-0.12, 0.28], [0.12, 0.28]].forEach(([x, z]) => { const l = mesh(new THREE.CylinderGeometry(0.045 * s, 0.045 * s, 0.34 * s, 4), c); l.position.set(x * s, 0.17 * s, z * s); g.add(l); });
  g.userData.kind = 'quad'; return g;
}
function makeBirdPerched(name) {
  const g = new THREE.Group(); const c = M(colorFor(name, 0xe8e8e8));
  const b = mesh(new THREE.SphereGeometry(0.18, 7, 5), c); b.scale.set(0.8, 1.1, 1.2); b.position.y = 0.25; g.add(b);
  const h = mesh(new THREE.SphereGeometry(0.1, 6, 5), c); h.position.set(0, 0.48, 0.1); g.add(h);
  const bk = mesh(new THREE.ConeGeometry(0.04, 0.12, 4), M(0xf2b632)); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.46, 0.22); g.add(bk);
  g.userData.kind = 'bird'; return g;
}
function makeSeaCreature(name) {
  const g = new THREE.Group(); const c = M(colorFor(name, 0x6f8fa8)); const big = /balen/i.test(name) ? 3.5 : /orca/i.test(name) ? 2 : 1;
  if (/tartarug/i.test(name)) { const sh = mesh(new THREE.SphereGeometry(0.45, 8, 5), c); sh.scale.set(1, 0.4, 1.2); g.add(sh); const hd = mesh(new THREE.SphereGeometry(0.13, 6, 5), M(0x8a9a5a)); hd.position.z = 0.6; g.add(hd); }
  else { const b = mesh(new THREE.SphereGeometry(0.35, 8, 6), c); b.scale.set(0.7, 0.7, 2.4); g.add(b); const fin = mesh(new THREE.ConeGeometry(0.12, 0.35, 4), c); fin.position.set(0, 0.3, -0.1); fin.rotation.x = -0.4; g.add(fin); const tail = mesh(new THREE.BoxGeometry(0.6, 0.04, 0.2), c); tail.position.z = -0.85; g.add(tail); }
  g.scale.setScalar(big); g.userData.kind = 'sea'; return g;
}
// any object described by Claude as a list of primitive parts
const PERSON_SCALE = 1.35; // people are drawn 1.35× (a 1.8 m person ≈ 2.4 units)
function makeFromParts(parts) {
  const g = new THREE.Group(); const D = Math.PI / 180;
  const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || d));
  parts.forEach((pt) => {
    if (!pt || typeof pt !== 'object') return;
    const d = Array.isArray(pt.d) ? pt.d : []; const f = String(pt.f || 'box');
    let geo;
    if (f === 'cil') geo = new THREE.CylinderGeometry(num(d[0], 0.05, 0.003, 3), num(d[0], 0.05, 0.003, 3), num(d[1], 0.5, 0.002, 6), 8);
    else if (f === 'cono') geo = new THREE.ConeGeometry(num(d[0], 0.1, 0.003, 3), num(d[1], 0.3, 0.002, 6), 8);
    else if (f === 'sfera') geo = new THREE.SphereGeometry(num(d[0], 0.1, 0.003, 3), 10, 8);
    else geo = new THREE.BoxGeometry(num(d[0], 0.2, 0.002, 6), num(d[1], 0.2, 0.002, 6), num(d[2], 0.2, 0.002, 6));
    let col = 0x9c7a4c; if (typeof pt.c === 'string' && /^#?[0-9a-f]{6}$/i.test(pt.c)) col = parseInt(pt.c.replace('#', ''), 16);
    const m = mesh(geo, M(col));
    const pp = Array.isArray(pt.p) ? pt.p : [0, 0, 0]; m.position.set(num(pp[0], 0, -4, 4), num(pp[1], 0, -1, 6), num(pp[2], 0, -4, 4));
    if (Array.isArray(pt.r)) m.rotation.set((Number(pt.r[0]) || 0) * D, (Number(pt.r[1]) || 0) * D, (Number(pt.r[2]) || 0) * D);
    g.add(m);
  });
  return bakeMerge(g);
}
// fallback shapes by name when no parts are given (older saves)
function makeByName(name) {
  const n = String(name).toLowerCase(); const g = new THREE.Group();
  if (/cart[ae]|mazzo/.test(n)) { const d = mesh(new THREE.BoxGeometry(0.07, 0.03, 0.1), M(0xf4f1e8)); d.position.y = 0.015; g.add(d); [[0.12, 0.3], [0.2, -0.5], [0.05, 1.2]].forEach(([x, r]) => { const c = mesh(new THREE.BoxGeometry(0.07, 0.003, 0.1), M(x > 0.1 ? 0xc0392b : 0xf4f1e8)); c.position.set(x, 0.003, 0.05); c.rotation.y = r; g.add(c); }); g.scale.setScalar(2.2); return g; }
  if (/altalen/.test(n)) return makeFromParts([{ f: 'cil', d: [0.06, 2.2], p: [-0.9, 1.1, 0], c: '#6b4a2b' }, { f: 'cil', d: [0.06, 2.2], p: [0.9, 1.1, 0], c: '#6b4a2b' }, { f: 'cil', d: [0.05, 2], p: [0, 2.2, 0], r: [0, 0, 90], c: '#6b4a2b' }, { f: 'cil', d: [0.012, 1.6], p: [-0.25, 1.4, 0], c: '#c8b48a' }, { f: 'cil', d: [0.012, 1.6], p: [0.25, 1.4, 0], c: '#c8b48a' }, { f: 'box', d: [0.6, 0.05, 0.25], p: [0, 0.6, 0], c: '#8b5a2b' }]);
  if (/libr/.test(n)) { const b = mesh(new THREE.BoxGeometry(0.22, 0.05, 0.3), M(0x2e4a7d)); b.position.y = 0.025; g.add(b); return g; }
  if (/chitarr|ukulel/.test(n)) return makeFromParts([{ f: 'box', d: [0.35, 0.08, 0.45], p: [0, 0.04, 0], c: '#a0522d' }, { f: 'box', d: [0.06, 0.03, 0.6], p: [0, 0.06, -0.5], c: '#5a3a1a' }]);
  const b = mesh(new THREE.BoxGeometry(0.45, 0.32, 0.35), M(0x9c7a4c)); b.position.y = 0.16; g.add(b); const r = mesh(new THREE.BoxGeometry(0.47, 0.04, 0.37), M(0x6b4a2b)); r.position.y = 0.3; g.add(r); return g;
}
function makeCustomObject(name, loc, kind, parts) {
  const g = new THREE.Group();
  let body;
  if (Array.isArray(parts) && parts.length) { body = makeFromParts(parts); body.scale.setScalar(PERSON_SCALE); } // Claude's metres, at the same scale as the people
  else if (kind === 'quad') body = makeQuad(name);
  else if (kind === 'bird') body = makeBirdPerched(name);
  else if (kind === 'sea') body = makeSeaCreature(name);
  else if (/torcia|fiaccol/i.test(name)) { body = new THREE.Group(); const st = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 5), M(0x6b4a2b)); st.position.y = 0.45; st.rotation.z = 0.25; body.add(st); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 6), new THREE.MeshBasicMaterial({ color: 0xffa31a })); fl.position.set(-0.11, 0.98, 0); body.add(fl); body.userData.flame = fl; }
  else if (/bottigli/i.test(name)) { body = new THREE.Group(); const b = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 8), M(0x5fae7a)); b.rotation.z = Math.PI / 2; b.position.y = 0.1; body.add(b); }
  else body = makeByName(name);
  g.add(body); g.userData.body = body; g.userData.kind = kind || 'object';
  const lab = makeLabel(name); lab.userData.isLabel = true; g.userData.label = lab; lab.position.y = kind === 'sea' ? 1.6 : Math.max(1.3, new THREE.Box3().setFromObject(body).max.y + 0.5); lab.scale.set(1.8, 0.35, 1); g.add(lab);
  g.position.copy(at(loc)); scene.add(g); return g;
}
function makeGrave(loc) {
  const g = new THREE.Group();
  const mound = mesh(new THREE.SphereGeometry(0.6, 8, 5), M(0xb89c68)); mound.scale.set(1.4, 0.35, 0.8); g.add(mound);
  const v = mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), M(0x6b4a2b)); v.position.set(0, 0.5, -0.5); g.add(v);
  const h = mesh(new THREE.BoxGeometry(0.45, 0.08, 0.08), M(0x6b4a2b)); h.position.set(0, 0.72, -0.5); g.add(h);
  g.position.copy(at(loc)); scene.add(g); return g;
}

/* people */
function makePerson(o) {
  const root = new THREE.Group(); const pose = new THREE.Group(); root.add(pose);
  const skin = M(o.skin || 0xe0ac69), shirt = M(o.shirt || 0x7fb3d5), pants = M(o.pants || 0xc2a878), hairM = M(o.hair || 0x4a3020);
  const hips = new THREE.Group(); hips.position.y = 0.62; pose.add(hips);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.12, 0, 0); legR.position.set(0.12, 0, 0); hips.add(legL, legR);
  [legL, legR].forEach((l) => { const m = mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.62, 6), pants); m.position.y = -0.31; l.add(m); const f = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.2), skin); f.position.set(0, -0.6, 0.04); l.add(f); });
  const torso = new THREE.Group(); hips.add(torso);
  { const b = mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 7), shirt); b.position.y = 0.31; torso.add(b); }
  const head = new THREE.Group(); head.position.y = 0.84; torso.add(head);
  { const h = mesh(new THREE.SphereGeometry(0.19, 10, 8), skin); head.add(h);
    const hair = mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2), hairM); hair.position.y = 0.02; hair.rotation.x = -0.25; head.add(hair);
    if (o.longHair) { const lh = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.35, 8), hairM); lh.position.set(0, -0.1, -0.06); head.add(lh); }
    [-0.07, 0.07].forEach((x) => { const e = mesh(new THREE.SphereGeometry(0.025, 5, 4), M(0x222222), false); e.position.set(x, 0.03, 0.17); head.add(e); }); }
  const beard = mesh(new THREE.ConeGeometry(0.14, 0.2, 7), hairM); beard.rotation.x = Math.PI; beard.position.set(0, -0.12, 0.09); head.add(beard); beard.visible = !!o.beard;
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.27, 0.56, 0); armR.position.set(0.27, 0.56, 0); torso.add(armL, armR);
  [armL, armR].forEach((a) => { const m = mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.56, 6), shirt); m.position.y = -0.28; a.add(m); const hnd = mesh(new THREE.SphereGeometry(0.06, 6, 5), skin); hnd.position.y = -0.58; a.add(hnd); });
  const handR = new THREE.Object3D(); handR.position.y = -0.58; armR.add(handR);
  const axe = makeAxe(); axe.rotation.x = Math.PI / 2; axe.position.set(0, 0, 0.05); axe.scale.setScalar(0.9); handR.add(axe);
  const rod = makeRod(); rod.rotation.x = 1.95; handR.add(rod); // with the fishing arm (-1.0) the rod leans ~50° forward, toward the water
  { const tip = new THREE.Group(); tip.position.y = 2.3; tip.rotation.x = -0.95; rod.add(tip); const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 2.2, 3), new THREE.MeshBasicMaterial({ color: 0xe8e8e8 })); line.position.y = -1.1; tip.add(line); const bob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff5a1f })); bob.position.y = -2.2; tip.add(bob); }
  const spear = makeSpear(); spear.rotation.x = Math.PI / 2 - 0.3; handR.add(spear);
  const book = new THREE.Group(); { const b = mesh(new THREE.BoxGeometry(0.28, 0.02, 0.2), M(0x6d3b1f)); book.add(b); const pg = mesh(new THREE.BoxGeometry(0.26, 0.025, 0.18), M(0xfbf6e6)); pg.position.y = 0.005; book.add(pg); }
  book.position.set(0, 0.42, 0.38); torso.add(book);
  root.scale.setScalar(o.scale || 1.35);
  scene.add(root);
  return { root, pose, hips, torso, head, legL, legR, armL, armR, axe, rod, spear, book, beard, shirtMat: shirt, skinMat: skin };
}
function posePerson(P, anim, ph) {
  const { pose, hips, torso, head, legL, legR, armL, armR } = P;
  pose.rotation.set(0, 0, 0); pose.position.set(0, 0, 0); hips.position.y = 0.62; torso.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
  legL.rotation.set(0, 0, 0); legR.rotation.set(0, 0, 0); armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0);
  P.axe.visible = false; P.rod.visible = false; P.spear.visible = false; P.book.visible = false;
  const sit = () => { hips.position.y = 0.2; legL.rotation.x = -Math.PI / 2; legR.rotation.x = -Math.PI / 2; };
  const kneel = () => { hips.position.y = 0.36; legL.rotation.x = -1.2; legR.rotation.x = 0.4; };
  switch (anim) {
    case 'walk': { const w = Math.sin(ph * 9); legL.rotation.x = w * 0.6; legR.rotation.x = -w * 0.6; armL.rotation.x = -w * 0.5; armR.rotation.x = w * 0.5; pose.position.y = Math.abs(Math.cos(ph * 9)) * 0.04; break; }
    case 'drink': kneel(); torso.rotation.x = 0.9; armL.rotation.x = -1.2; armR.rotation.x = -1.2; head.rotation.x = 0.3 + Math.sin(ph * 3) * 0.1; break;
    case 'dig': kneel(); torso.rotation.x = 0.7; armR.rotation.x = -1.3 + Math.sin(ph * 6) * 0.4; armL.rotation.x = -1.1; break;
    case 'read': sit(); P.book.visible = true; armL.rotation.x = -1.1; armR.rotation.x = -1.1; head.rotation.x = 0.35; break;
    case 'write': sit(); P.book.visible = true; armL.rotation.x = -1.1; armR.rotation.x = -1.2 + Math.sin(ph * 10) * 0.08; armR.rotation.z = 0.25 + Math.sin(ph * 7) * 0.08; head.rotation.x = 0.4; break;
    case 'fish': sit(); P.rod.visible = true; armR.rotation.x = -1.0 + Math.sin(ph * 1.5) * 0.05; armL.rotation.x = -0.9; break;
    case 'spear': P.spear.visible = true; armR.rotation.x = -2.2 + Math.max(0, Math.sin(ph * 4)) * 1.4; torso.rotation.x = 0.3; break;
    case 'chop': P.axe.visible = true; armR.rotation.x = -1.6 - Math.sin(ph * 7) * 1.0; armL.rotation.x = -0.4; torso.rotation.x = 0.1 + Math.max(0, Math.sin(ph * 7)) * 0.15; break;
    case 'reach': legL.rotation.x = 0; pose.position.y = 0.05 + Math.abs(Math.sin(ph * 2)) * 0.05; armL.rotation.x = -2.9; armR.rotation.x = -2.6 + Math.sin(ph * 5) * 0.25; head.rotation.x = -0.5; P.axe.visible = true; break;
    case 'chopLow': P.axe.visible = true; torso.rotation.x = 0.55 + Math.max(0, Math.sin(ph * 6)) * 0.25; armR.rotation.x = -2.4 + (Math.sin(ph * 6) + 1) * 1.1; armL.rotation.x = -1.2 + (Math.sin(ph * 6) + 1) * 0.4; legL.rotation.x = -0.25; legR.rotation.x = 0.25; break;
    case 'build': kneel(); torso.rotation.x = 0.45; armR.rotation.x = -1.8 + Math.abs(Math.sin(ph * 7)) * 0.9; armL.rotation.x = -1.0; P.axe.visible = true; break;
    case 'carve': armR.rotation.x = -1.5 + Math.sin(ph * 9) * 0.12; armR.rotation.z = 0.2; armL.rotation.x = -1.3; torso.rotation.x = 0.1; break;
    case 'swim': pose.rotation.x = -1.35; pose.position.y = 0.15; armL.rotation.x = -2.6 + Math.sin(ph * 5) * 1.6; armR.rotation.x = -2.6 + Math.sin(ph * 5 + Math.PI) * 1.6; legL.rotation.x = Math.sin(ph * 8) * 0.4; legR.rotation.x = -Math.sin(ph * 8) * 0.4; break;
    case 'pray': kneel(); torso.rotation.x = 0.25; armL.rotation.x = -1.4; armR.rotation.x = -1.4; armL.rotation.z = -0.25; armR.rotation.z = 0.25; head.rotation.x = 0.35; break;
    case 'run': { const w = Math.sin(ph * 14); legL.rotation.x = w * 0.9; legR.rotation.x = -w * 0.9; armL.rotation.x = -w * 0.8; armR.rotation.x = w * 0.8; torso.rotation.x = 0.2; pose.position.y = Math.abs(Math.cos(ph * 14)) * 0.08; break; }
    case 'firemake': kneel(); torso.rotation.x = 0.6; armL.rotation.x = -1.2 + Math.sin(ph * 14) * 0.25; armR.rotation.x = -1.2 - Math.sin(ph * 14) * 0.25; break;
    case 'talk': sit(); armR.rotation.x = -0.9 + Math.sin(ph * 4) * 0.3; armL.rotation.x = -0.6; head.rotation.y = Math.sin(ph * 2) * 0.2; break;
    case 'talkstand': armR.rotation.x = -0.7 + Math.sin(ph * 4) * 0.3; armR.rotation.z = 0.3; head.rotation.y = Math.sin(ph * 2) * 0.15; break;
    case 'eat': sit(); armR.rotation.x = -2.3 + Math.abs(Math.sin(ph * 4)) * 0.6; armR.rotation.z = 0.3; break;
    case 'sick': pose.rotation.z = Math.PI / 2; pose.position.y = 0.2; legL.rotation.x = -1.0; legR.rotation.x = -1.1; armL.rotation.x = -1.2; armR.rotation.x = -1.2; break;
    case 'sleep': pose.rotation.x = -Math.PI / 2; pose.position.y = 0.22; pose.position.z = 0.6; torso.rotation.x = Math.sin(ph * 2) * 0.02; break;
    case 'dead': pose.rotation.x = -Math.PI / 2; pose.position.y = 0.2; pose.position.z = 0.6; armL.rotation.z = -0.5; armR.rotation.z = 0.4; break;
    case 'laugh': torso.rotation.x = -0.15 + Math.abs(Math.sin(ph * 12)) * 0.12; head.rotation.x = -0.3; armL.rotation.x = -0.5; armR.rotation.x = -0.5; armL.rotation.z = -0.3; armR.rotation.z = 0.3; pose.position.y = Math.abs(Math.sin(ph * 12)) * 0.03; break;
    case 'scratch': armR.rotation.x = -2.7; armR.rotation.z = 0.5 + Math.sin(ph * 14) * 0.12; head.rotation.z = 0.15; head.rotation.x = 0.1; break;
    case 'jump': { const j = Math.abs(Math.sin(ph * 5)); pose.position.y = j * 0.45; armL.rotation.z = -2.7; armR.rotation.z = 2.7; legL.rotation.x = -j * 0.5; legR.rotation.x = -j * 0.5; break; }
    case 'fists': armL.rotation.x = -2.6 + Math.sin(ph * 9) * 0.3; armR.rotation.x = -2.6 - Math.sin(ph * 9) * 0.3; head.rotation.x = -0.35; torso.rotation.x = -0.1; break;
    case 'slump': sit(); torso.rotation.x = 0.75; head.rotation.x = 0.55; armL.rotation.x = -0.6; armR.rotation.x = -0.6; pose.position.y = Math.sin(ph * 1.2) * 0.01; break;
    case 'shrug': { const k = Math.max(0, Math.sin(ph * 4)); armL.rotation.z = -0.6 - k * 0.5; armR.rotation.z = 0.6 + k * 0.5; armL.rotation.x = -0.9; armR.rotation.x = -0.9; head.rotation.z = k * 0.2; break; }
    case 'clap': { const k = Math.sin(ph * 16); armL.rotation.x = -1.4; armR.rotation.x = -1.4; armL.rotation.z = -0.5 + k * 0.35; armR.rotation.z = 0.5 - k * 0.35; break; }
    case 'wave': armL.rotation.z = -2.6 + Math.sin(ph * 10) * 0.35; armR.rotation.z = 2.6 - Math.sin(ph * 10) * 0.35; break;
    case 'cry': sit(); torso.rotation.x = 0.6; armL.rotation.x = -2.2; armR.rotation.x = -2.2; head.rotation.x = 0.5 + Math.sin(ph * 5) * 0.05; break;
    case 'dance': armL.rotation.z = -1.6 + Math.sin(ph * 6) * 0.8; armR.rotation.z = 1.6 + Math.sin(ph * 6 + 1) * 0.8; pose.rotation.y = Math.sin(ph * 3) * 0.6; pose.position.y = Math.abs(Math.sin(ph * 6)) * 0.12; break;
    case 'play': { const w = Math.sin(ph * 6); legR.rotation.x = Math.max(-1.2, w * 1.0); legL.rotation.x = -w * 0.3; armL.rotation.x = w * 0.4; armR.rotation.x = -w * 0.4; break; }
    case 'swing': { const sw = Math.sin(ph * 2.6); hips.position.y = 0.78; legL.rotation.x = -1.3 + sw * 0.35; legR.rotation.x = -1.3 + sw * 0.35; armL.rotation.x = -2.7; armR.rotation.x = -2.7; pose.position.z = sw * 0.45; pose.position.y = (1 - Math.cos(sw * 0.6)) * 0.4; torso.rotation.x = -sw * 0.25; break; }
    case 'cards': sit(); torso.rotation.x = 0.35; armL.rotation.x = -1.0; armR.rotation.x = -1.0 + Math.max(0, Math.sin(ph * 2.2)) * 0.5; armR.rotation.z = Math.sin(ph * 1.1) * 0.25; head.rotation.x = 0.4; break;
    case 'strum': sit(); armL.rotation.x = -1.1; armL.rotation.z = 0.5; armR.rotation.x = -0.9 + Math.sin(ph * 10) * 0.15; head.rotation.z = Math.sin(ph * 2) * 0.12; break;
    case 'sit': sit(); armL.rotation.x = -0.4; armR.rotation.x = -0.4; head.rotation.y = Math.sin(ph * 0.6) * 0.3; break;
    case 'look': head.rotation.y = Math.sin(ph * 1.2) * 0.7; torso.rotation.y = Math.sin(ph * 1.2) * 0.15; break;
    case 'think': armR.rotation.x = -2.0; armR.rotation.z = 0.5; head.rotation.x = 0.15; break;
    default: torso.rotation.x = Math.sin(ph * 2) * 0.02; head.rotation.y = Math.sin(ph * 0.8) * 0.3;
  }
}

window.SC = {
  THREE, scene, camera, controls, renderer, hemi, sun, moon, groundH, at, LOC, M, mesh,
  updateSea, seaMat, bakeMerge, bigX, extraPalms, palms, palmA, palmB, palmC, springC, crate, crateAxe, crateRod, crateSpear,
  campFire, fireC, woodLogs, hillPile, bonfire, smoke, smokePuffs, shelter, shL, bed, raft, raftLogs, sosStones,
  bushes, pond, ball, ballMatPlain, ballMatFace, ship, stars, clouds, rain, rainGeo, RAIN_N, gulls, pelican, pelicanPerch, dolphins,
  dog, crabs, shark, bottle, makeLabel, makeSandText, makeCustomObject, makeGrave, makePerson, posePerson,
};
})();
