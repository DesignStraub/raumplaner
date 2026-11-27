/* Raumplaner – Regie für Trailer (16:9) und Short (9:16).
   Läuft in stage.html; render.mjs ruft pro Bild window.__frame(i) auf. */
'use strict';
const Q = new URLSearchParams(location.search);
const MODE = Q.get('mode') === 'short' ? 'short' : 'trailer';
const PORT = MODE === 'short';
const FPS = +(Q.get('fps') || 30);
const VW = innerWidth, VH = innerHeight;
document.body.classList.toggle('portrait', PORT);
const $ = s => document.querySelector(s);
const RT = window.__real || { setTimeout, raf: requestAnimationFrame };
const sleep = ms => new Promise(r => RT.setTimeout(r, ms));

/* ---------- Mathe ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sm = u => u * u * (3 - 2 * u);
const eio = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const eout = u => 1 - Math.pow(1 - u, 3);
const eout5 = u => 1 - Math.pow(1 - u, 5);
const eback = u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const V = (a, b, u) => a.map((x, i) => lerp(x, b[i], u));
function cr(p0, p1, p2, p3, u) { const u2 = u * u, u3 = u2 * u; return p1.map((_, i) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3)); }
function spline(pts, u) {
  const n = pts.length; if (n === 1) return pts[0]; if (n === 2) return V(pts[0], pts[1], u);
  const x = clamp(u) * (n - 1), i = Math.min(n - 2, Math.floor(x)), f = x - i;
  return cr(pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(n - 1, i + 2)], f);
}
// Stückweise Spur: [[t, wert], ...] mit weicher Interpolation
function track(keys) {
  return t => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1], [t1, b, e] = keys[i], u = (e || sm)((t - t0) / (t1 - t0 || 1));
      return typeof a === 'number' ? lerp(a, b, u) : V(a, b, u);
    }
    return keys[keys.length - 1][1];
  };
}

/* ---------- Zeitplan ---------- */
const EV = [], DUR = [];
const at = (t, fn) => EV.push({ t, fn });
const during = (a, b, fn) => DUR.push({ a, b, fn });
let evI = 0;

/* ---------- Texte ---------- */
const TX = [];
function text(html, css, cls = '', anim = {}) {
  const el = document.createElement('div'); el.className = 't ' + cls; el.innerHTML = html; Object.assign(el.style, css);
  $('#texts').append(el); const o = { el, ...anim }; TX.push(o); return o;
}
// in/out: Startzeiten; dauer di/do; y: Versatz; blur; sc: Skalierung
function cue(o, tin, tout, { di = 0.8, dout = 0.6, y = 26, blur = 10, sc = 0, track: sp = 0 } = {}) { Object.assign(o, { tin, tout, di, dout, y, blur, sc, sp }); return o; }
function drawTexts(t) {
  for (const o of TX) {
    if (o.tin == null) continue;
    const a = eout(seg(t, o.tin, o.tin + o.di)), b = sm(seg(t, o.tout, o.tout + o.dout)), v = a * (1 - b);
    if (v <= 0.001) { o.el.style.opacity = 0; continue; }
    const y = (1 - a) * o.y - b * o.y * 0.6, s = 1 + (1 - a) * o.sc + b * o.sc * 0.5, bl = (1 - a) * o.blur + b * o.blur;
    o.el.style.opacity = v;
    o.el.style.transform = `${o.el.dataset.base || ''} translateY(${y}px) scale(${s})`;
    o.el.style.filter = bl > 0.05 ? `blur(${bl}px)` : 'none';
    if (o.sp) o.el.style.letterSpacing = `${lerp(o.sp, o.spEnd ?? 0, eout5(seg(t, o.tin, o.tin + o.di * 2.2)))}em`;
    o.onFrame?.(t, v);
  }
}
const HEART_D = (() => { const x = new XMLHttpRequest(); x.open('GET', 'heart-path.txt', false); x.send(); return x.responseText.trim(); })();
const heartSVG = w => `<svg class="heart" viewBox="0 0 194.2 172.6" style="width:${w}px"><path fill="#E0002B" fill-rule="evenodd" d="${HEART_D}"/></svg>`;
const APP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#2997ff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/></svg>`;
function caption(no, title, desc, chips, pos) {
  const html = `<div class="no">${no ? `${no}<i></i>` : ''}</div><div class="ti">${title}</div>${desc ? `<div class="de">${desc}</div>` : ''}${chips ? `<div class="chips">${chips.map(c => `<b>${c}</b>`).join('')}</div>` : ''}`;
  return text(html, pos || (PORT ? { left: '56px', right: '56px', bottom: '230px' } : { left: '120px', bottom: '210px' }), 'cap');
}

/* ---------- Bühne ---------- */
const card = $('#card'), app = $('#app'), papp = $('#papp'), phone = $('#phone');
const AW = PORT ? 540 : 1920, AH = PORT ? 960 : 1080;
Object.assign(card.style, { width: AW + 'px', height: AH + 'px' }); app.width = AW; app.height = AH;
Object.assign(app.style, { width: AW + 'px', height: AH + 'px' });
const W = () => app.contentWindow, R = () => W().__rp, R2 = () => papp.contentWindow.__rp;
const cardT = { s: 1, rx: 0, ry: 0, x: 0, y: 0, rad: 0, op: 0, blur: 0, br: 1 };
function applyCard() {
  const c = cardT, sx = (VW - AW) / 2, sy = (VH - AH) / 2;
  card.style.transform = `translate(${sx + c.x}px,${sy + c.y}px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) scale(${c.s})`;
  card.style.borderRadius = c.rad + 'px'; card.style.opacity = c.op;
  card.classList.toggle('win', c.rad > 0);
  card.style.filter = (c.blur > 0.05 || c.br !== 1) ? `blur(${c.blur}px) brightness(${c.br})` : (c.rad > 0 ? 'none' : 'saturate(1.14) contrast(1.05)');
  app.dataset.paused = c.op > 0.001 ? '0' : '1';
}
const phT = { s: 1, rx: 0, ry: 0, x: 0, y: 0, op: 0 };
function applyPhone() {
  const c = phT, pw = 418, ph = 872;
  phone.style.transform = `translate(${(VW - pw) / 2 + c.x}px,${(VH - ph) / 2 + c.y}px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) scale(${c.s})`;
  phone.style.opacity = c.op; papp.dataset.paused = c.op > 0.001 ? '0' : '1';
}
const setCard = o => Object.assign(cardT, o), setPhone = o => Object.assign(phT, o);

/* Sterne + Körnung (deterministisch) */
(function stars() {
  const c = $('#stars'), d = devicePixelRatio || 1; c.width = VW * d; c.height = VH * d; const x = c.getContext('2d'); x.scale(d, d);
  let s = 1234567; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < Math.round(VW * VH / 2200); i++) { const a = 0.15 + r() * 0.75, z = r() < 0.08 ? 1.7 : 0.5 + r() * 0.8; x.fillStyle = `rgba(235,242,255,${a})`; x.beginPath(); x.arc(r() * VW, r() * VH, z, 0, 6.283); x.fill(); }
  const g = x.createRadialGradient(VW / 2, VH * 0.6, 0, VW / 2, VH * 0.6, Math.max(VW, VH) * 0.55); g.addColorStop(0, 'rgba(224,0,43,.10)'); g.addColorStop(1, 'rgba(224,0,43,0)'); x.fillStyle = g; x.fillRect(0, 0, VW, VH);
})();
const GRAIN = (() => {
  const out = []; let s = 99; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 6; k++) { const c = document.createElement('canvas'); c.width = 480; c.height = 270; const x = c.getContext('2d'), im = x.createImageData(480, 270);
    for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); out.push(c); }
  const g = $('#grain'); g.width = 480; g.height = 270; return { g, x: g.getContext('2d'), out };
})();

/* ---------- App-Steuerung ---------- */
const CLEAN_CSS = `
body.vclean>header,body.vclean aside,body.vclean .floorbar,body.vclean .statusbar,body.vclean .mobilebar,body.vclean .zoombox,body.vclean #cine-title,body.vclean .cine-bar,body.vclean #cine-fade,body.vclean .walk-overlay,body.vclean .crosshair,body.vclean .draftbar,body.vclean #three-host>div{display:none!important}
#toast,#splash,#cine-title,.cine-bar,#cine-fade{display:none!important}
body.booting>header,body.booting>main{animation:none!important;opacity:1!important;transform:none!important}
.view.enter{animation:none!important}`;
async function bootApp(frame, w, h) {
  frame.src = '../index.html?debug';
  for (let i = 0; i < 400; i++) { await sleep(50); try { if (frame.contentWindow.__rp && frame.contentWindow.__vt) break; } catch {} }
  const win = frame.contentWindow, doc = win.document;
  const st = doc.createElement('style'); st.textContent = CLEAN_CSS; doc.head.append(st);
  doc.getElementById('splash')?.remove(); doc.body.classList.remove('booting');
  await new Promise(res => { const sc = doc.createElement('script'); sc.src = '/video/demo-state.js?' + Math.random(); sc.onload = res; doc.head.append(sc); });
  return win;
}
function pump(win, n = 3, dt = 16) { for (let i = 0; i < n; i++) win.__vt.step(dt); }
const clean = (on, win = W()) => win.document.body.classList.toggle('vclean', on);
function loadState(r, opts, then) {
  const win = r === R() ? W() : papp.contentWindow;
  const s = win.buildDemoState(opts || {});
  then?.(s);
  r.state = s;
  return s;
}
function threeReady(r) { r.T3.introDone = true; r.T3.fitted = true; r.T3.controls.maxPolarAngle = Math.PI * 0.99; r.T3.controls.minDistance = 0.1; r.T3.controls.maxDistance = 400; }
function cam(r, p, l, fov) {
  const T3 = r.T3; if (!T3?.camera) return;
  T3.fly = null; T3.fovAnim = null;
  T3.camera.position.set(p[0], p[1], p[2]); T3.controls.target.set(l[0], l[1], l[2]); T3.camera.lookAt(l[0], l[1], l[2]);
  if (fov) r.setFov(fov);
}
// Kamerafahrt über Stützpunkte (Positionen + Blickziele), u 0..1
function camPath(r, P, L, u, fov) { cam(r, spline(P, u), spline(L, u), fov); }
// Kreisbahn um ein Ziel
function orbit(r, c, rad, h, ang, fov) { cam(r, [c[0] + Math.sin(ang) * rad, c[1] + h, c[2] + Math.cos(ang) * rad], c, fov); }
const PK = PORT ? 1.55 : 1; // Hochformat: Kamera weiter weg
const FOVP = f => PORT ? f + 14 : f;
function grade(r) {
  const T3 = r?.T3; if (!T3?.renderer) return;
  if (!r.__sky && T3.skyDay?.image?.getContext) {
    const c = T3.skyDay.image, x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, c.height);
    [[0, '#3b6fb0'], [0.5, '#86b1dd'], [0.86, '#cfe0ee'], [1, '#e6eef3']].forEach(([t, col]) => g.addColorStop(t, col));
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height); T3.skyDay.needsUpdate = true; r.__sky = true;
  }
  if (r.state.world.night) return;
  const inside = T3.walk.active || (!T3.whole && T3.cut != null);
  T3.renderer.toneMappingExposure = inside ? 1.05 : 1.22;
  T3.scene.fog.color.set('#bfd2e4'); T3.scene.fog.near = 70; T3.scene.fog.far = 320;
  T3.lights.hemi.color.set('#d9e7f7'); T3.lights.hemi.intensity = inside ? 0.8 : 0.9;
  const s = T3.sun; s.color.set('#ffe7c7'); s.intensity = 3.3;
  const tg = s.target.position; s.position.set(tg.x + 20, 17, tg.z + 15);
}
const roomOf = (r, fi, name) => r.state.floors[fi].rooms.find(x => x.name === name);
// Möbel einblenden (federnd)
const POPS = [];
function popItem(r, fi, item, t0) { at(t0, () => { r().state.floors[fi].items.push(item(r())); r().build3D(); POPS.push({ r, id: r().state.floors[fi].items.at(-1).id, t0 }); }); }
function drawPops(t) {
  for (const p of POPS) {
    const g = p.r().T3.itemGroups.get(p.id); if (!g) continue;
    const u = seg(t, p.t0, p.t0 + 0.6), s = Math.max(0.001, eback(u));
    g.scale.setScalar(s); g.position.y = (1 - eout(u)) * 0.9;
  }
}
// Zeiger in der App (Maus) bzw. Finger auf dem Handy
const cursor = $('#cursor'), ripple = $('#ripple'), pcur = $('.pcur');
const CUR = { x: -100, y: -100, show: 0, down: 0, clickT: -9 };
function drawCursor(t) {
  const target = PORT ? pcur : cursor;
  if (PORT) { cursor.style.opacity = 0; pcur.style.left = CUR.x + 'px'; pcur.style.top = CUR.y + 'px'; pcur.style.opacity = CUR.show * (0.55 + CUR.down * 0.45); pcur.style.transform = `scale(${1 - CUR.down * 0.18})`; }
  else { cursor.style.transform = `translate(${CUR.x - 4}px,${CUR.y - 3}px) scale(${1 - CUR.down * 0.12})`; cursor.style.opacity = CUR.show; }
  const u = seg(t, CUR.clickT, CUR.clickT + 0.5);
  ripple.style.left = CUR.x + 'px'; ripple.style.top = CUR.y + 'px';
  ripple.style.opacity = !PORT && u > 0 && u < 1 ? (1 - u) * 0.9 : 0; ripple.style.transform = `scale(${0.3 + eout(u) * 1.1})`;
  void target;
}
function ptr(win, type, wx, wy) {
  const cv = win.document.getElementById('plan'), rc = cv.getBoundingClientRect(), [sx, sy] = win.__rp.W2S(wx, wy);
  cv.dispatchEvent(new win.PointerEvent(type, { clientX: rc.left + sx, clientY: rc.top + sy, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true }));
  return [rc.left + sx, rc.top + sy];
}
const planXY = (win, wx, wy) => { const cv = win.document.getElementById('plan'), rc = cv.getBoundingClientRect(), [sx, sy] = win.__rp.W2S(wx, wy); return [rc.left + sx, rc.top + sy]; };
const elXY = (win, sel) => { const e = win.document.querySelector(sel); if (!e) return [0, 0]; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
// Ein Rechteck im Grundriss aufziehen: Zeiger hinfahren, drücken, ziehen, loslassen, benennen
function drawRect(getWin, t0, a, b, name, dur = 1.0) {
  let from = null, down = false, done = false;
  const rel = t0 + dur * 0.9;
  during(t0, rel, t => {
    if (done) return;
    const win = getWin(), u = seg(t, t0, t0 + dur);
    const pa = planXY(win, a[0], a[1]);
    if (u < 0.28) { from = from || [CUR.x, CUR.y]; const k = eio(u / 0.28); CUR.x = lerp(from[0], pa[0], k); CUR.y = lerp(from[1], pa[1], k); CUR.down = 0; return; }
    if (!down) { down = true; ptr(win, 'pointermove', a[0], a[1]); ptr(win, 'pointerdown', a[0], a[1]); CUR.down = 1; }
    const k = eio(clamp((u - 0.28) / 0.6)), wx = lerp(a[0], b[0], k), wy = lerp(a[1], b[1], k);
    const xy = ptr(win, 'pointermove', wx, wy); CUR.x = xy[0]; CUR.y = xy[1];
  });
  at(rel, () => { done = true; const win = getWin(); ptr(win, 'pointermove', b[0], b[1]); ptr(win, 'pointerup', b[0], b[1]); CUR.down = 0;
    const rs = win.__rp.state.floors[0].rooms, last = rs[rs.length - 1]; if (last) last.name = name; if (Q.has('dbg')) console.warn('rect', name, rs.length);
    win.__rp.renderPlanPanels(); win.__rp.requestPlanDraw(); });
}
function moveCursorTo(getXY, t0, t1) { let from = null; during(t0, t1, t => { from = from || [CUR.x, CUR.y]; const [x, y] = getXY(), k = eio(seg(t, t0, t1)); CUR.x = lerp(from[0], x, k); CUR.y = lerp(from[1], y, k); }); }
function click(t, fn) { at(t, () => { CUR.down = 1; CUR.clickT = t; }); at(t + 0.12, () => { CUR.down = 0; fn?.(); }); }

/* ---------- Spuren für Blende, Balken, Blitz ---------- */
let fadeK = [[0, 1]], barK = [[0, 0]], flashK = [[0, 0]], bgK = [[0, 0]];
const BAR = PORT ? 0 : Math.round((VH - VW / 2.39) / 2);

/* ---------- Gemeinsame Bausteine ---------- */
const EG = [
  ['Küche', [7, 0], [12, 3.5]], ['Lounge', [7, 6], [12, 9]], ['Diele', [4, 3.5], [9, 6]], ['Windfang', [9, 3.5], [12, 6]],
  ['Arbeitszimmer', [0, 6], [4, 9]], ['Hauswirtschaft', [4, 6], [7, 9]],
];
const LOUNGE_POPS = [
  r => ({ id: r.uid(), type: 'sofa', name: 'Sofa', x: 9.5, y: 6.5, rot: 0, color: '#6b7787' }),
  r => ({ id: r.uid(), type: 'teppich', name: 'Teppich', x: 9.5, y: 7.5, rot: 0, color: '#e7cf8a', w: 2.4, d: 1.8 }),
  r => ({ id: r.uid(), type: 'couchtisch', name: 'Couchtisch', x: 9.5, y: 7.6, rot: 0, color: '#c8a27a' }),
  r => ({ id: r.uid(), type: 'sessel', name: 'Sessel', x: 11.3, y: 8.1, rot: Math.PI / 2 * 1.4, color: '#a8754f' }),
  r => ({ id: r.uid(), type: 'lampe', name: 'Stehlampe', x: 7.5, y: 8.5, rot: 0, color: '#f3ead8' }),
  r => ({ id: r.uid(), type: 'pflanze', name: 'Pflanze', x: 11.55, y: 6.45, rot: 0, color: '#c8b8a6' }),
];
const stripLounge = s => { const f = s.floors[0]; f.items = f.items.filter(it => !(it.x > 7 && it.y > 6)); };
// Gehweg durchs Haus (Wohnen → Tür → Diele → Treppe → Galerie), nach Weglänge gleichmäßig abgetastet
const WALK = [[1.4, 4.66], [2.9, 4.66], [4.35, 4.66], [4.95, 4.58], [5.6, 4.45], [7.2, 4.45], [8.3, 4.47], [8.55, 4.85], [8.2, 5.4], [7.5, 5.55]];
const WALK_LUT = (() => { const pts = [], len = [0]; for (let i = 0; i <= 600; i++) { pts.push(spline(WALK, i / 600)); if (i) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); } return { pts, len, L: len[600] }; })();
function walkAt(u) { // u = Anteil der Weglänge
  const { pts, len, L } = WALK_LUT, d = clamp(u) * L; let i = 1; while (i < 600 && len[i] < d) i++;
  const f = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
}
function walkScene(rf, t0, t1, from = 0, to = 1) {
  at(t0 - 0.02, () => { const r = rf(); r.state.activeFloor = 'fEG'; r.T3.whole = false; r.T3.sel = null; r.startWalk(); r.T3.walk.__init = false; });
  during(t0 - 0.02, t1, t => {
    const r = rf(), W2 = r.T3.walk, s = seg(t, t0, t1);
    // Startet schon in Bewegung, wird zum Ende hin ruhig
    const u = lerp(from, to, 0.45 * s + 0.55 * Math.sin(s * Math.PI / 2));
    const p = walkAt(u), q = walkAt(Math.min(1, u + 1.3 / WALK_LUT.L));
    let dx = q[0] - p[0], dz = q[1] - p[1];
    if (Math.hypot(dx, dz) < 1e-4) { dx = -Math.sin(W2.yaw); dz = -Math.cos(W2.yaw); }
    let yaw = Math.atan2(-dx, -dz);
    // Oben an der Treppe schon auf den letzten Stufen Richtung Galerie drehen (nie frontal auf die Außenwand)
    const turnTo = (tx, tz, k) => { if (k <= 0) return; const ty = Math.atan2(-(tx - p[0]), -(tz - p[1])); let d = ty - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; yaw += d * k; };
    turnTo(6.0, 6.6, sm(clamp((p[0] - 7.2) / 1.0)) * (1 - sm(seg(u, 0.88, 1))));
    turnTo(5.3, 4.7, sm(seg(u, 0.88, 1)));
    let dy = yaw - (W2.yaw ?? yaw); while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    if (!W2.__init) { W2.__init = true; W2.yaw = yaw; W2.pitch = -0.04; dy = 0; r.T3.camera.position.y = 1.62; W2.vy = 0; W2.ground = true; W2.floor = 0; }
    const climb = p[0] > 5.4 && p[0] < 7.6 && p[1] < 5.0;
    W2.yaw = (W2.yaw ?? yaw) + dy * 0.2; W2.pitch = lerp(W2.pitch || 0, u > 0.86 ? -0.3 : (climb ? 0.1 : -0.04), 0.06);
    r.T3.camera.position.x = p[0]; r.T3.camera.position.z = p[1];
    if (Q.has('dbg') && (t - t0) < 1.0) console.warn('walk', t.toFixed(2), u.toFixed(3), p.map(v => v.toFixed(2)).join(','), r.T3.camera.position.y.toFixed(2), W2.yaw.toFixed(2), W2.pitch.toFixed(2));
    r.setFov(PORT ? 76 : 68);
  });
  at(t1, () => { const r = rf(); if (r.T3.walk.active) r.stopWalk(); });
}

/* =========================================================
   TRAILER 16:9
   ========================================================= */
function trailer() {
  const r = R;
  // ---------- 1. Eröffnung ----------
  fadeK = [[0, 1], [0.9, 0], [5.9, 0], [6.5, 1], [6.6, 1], [7.7, 0], [11.6, 0], [11.95, 1], [12.0, 1], [12.45, 0],
    [21.3, 0], [21.32, 0], [27.85, 0], [27.95, 0.85], [28.0, 0.85], [28.25, 0], [37.35, 0], [37.5, 0.9], [37.75, 0],
    [46.35, 0], [46.5, 0.9], [46.75, 0], [54.3, 0], [54.5, 1], [54.85, 0], [63.2, 0], [63.45, 1], [63.85, 0],
    [70.2, 0], [70.45, 1], [70.85, 0], [78.6, 0], [79.0, 1], [79.9, 0], [85.8, 0], [87.0, 1]];
  barK = [[0, 0], [6.5, 0], [7.6, BAR], [11.95, BAR], [12.0, 0], [21.4, 0], [21.45, BAR], [63.4, BAR], [63.45, 0]];
  flashK = [[0, 0], [21.32, 0], [21.45, 0.95, eout], [21.95, 0]];
  bgK = [[0, 1], [6.5, 1]];
  const heart = text(heartSVG(200), { left: 0, right: 0, top: '330px', textAlign: 'center' }, 'center');
  cue(heart, 0.5, 5.0, { di: 1.4, dout: 0.8, y: 0, blur: 24, sc: 0.35 });
  heart.onFrame = t => { const p = Math.sin(clamp((t - 2.1) / 0.55) * Math.PI) * 0.07; heart.el.querySelector('svg').style.transform = `scale(${1 + p})`; };
  cue(text('OneHumanity Labs', { top: '590px' }, 'center eyebrow', {}), 1.3, 5.0, { di: 1.2, y: 14, blur: 6, track: 0.9 }).spEnd = 0.42;
  cue(text('One Planet, One Humanity', { top: '640px' }, 'center sub'), 2.0, 5.0, { di: 1.0, y: 16 });
  cue(text('präsentiert', { top: '730px', fontSize: '16px', letterSpacing: '.36em', textTransform: 'uppercase', color: 'rgba(245,245,247,.45)' }, 'center'), 2.9, 5.0, { di: 0.9, y: 10 });

  // ---------- 2. Titel über dem fertigen Haus ----------
  at(6.3, () => { loadState(r(), { roof: 'flach' }); r().setMode('3d'); threeReady(r()); r().setWhole(true); clean(true); setCard({ op: 1, s: 1, rad: 0, rx: 0, ry: 0, x: 0, y: 0 }); });
  during(6.3, 12.0, t => orbit(r(), [6, 5.4, 4.5], lerp(28, 22.5, sm(seg(t, 6.3, 12))), lerp(10.5, 5.5, sm(seg(t, 6.3, 12))), lerp(0.2, 0.95, seg(t, 6.3, 12)), 42));
  const ttl = text(`Raum<span>planer</span>`, { top: '215px' }, 'center mega'); cue(ttl, 7.9, 11.1, { di: 1.2, y: 0, blur: 18, sc: 0.06, track: 0.12 }); ttl.spEnd = -0.045;
  cue(text('Zeichnen. Einrichten. Begehen.', { top: '390px' }, 'center sub'), 8.9, 11.1, { di: 1.0 });

  // ---------- 3. Grundriss zeichnen (App als Fenster) ----------
  at(11.96, () => {
    const s = loadState(r(), {}, s => { s.floors = [s.floors[0]]; Object.assign(s.floors[0], { rooms: [], openings: [], items: [] }); });
    clean(false); r().setMode('plan'); W().document.querySelector('[data-tool2d="select"]').click();
    setCard({ s: 0.72, rx: 5, ry: -17, x: 250, y: 10, rad: 18 }); void s;
    CUR.x = 1000; CUR.y = 1180; CUR.show = 1;
  });
  at(12.05, () => { const P = r().P; P.scale = 66; const cv = W().document.getElementById('plan'); P.ox = (cv.clientWidth - 12 * 66) / 2; P.oy = (cv.clientHeight - 9 * 66) / 2 + 10; r().requestPlanDraw(); });
  during(12.0, 21.4, t => { const u = sm(seg(t, 12, 21.4)); setCard({ ry: lerp(-17, -9, u), s: lerp(0.72, 0.75, u), x: lerp(250, 225, u) }); });
  moveCursorTo(() => elXY(W(), '[data-tool2d="rect"]'), 12.5, 13.2); click(13.25, () => W().document.querySelector('[data-tool2d="rect"]').click());
  EG.forEach(([n, a, b], i) => drawRect(W, 13.6 + i * 1.02, a, b, n, 1.0));
  at(19.85, () => { const f = r().state.floors[0]; f.rooms.unshift({ id: r().uid(), name: 'Wohnen & Essen', points: [[0, 0], [7, 0], [7, 3.5], [4, 3.5], [4, 6], [0, 6]], floor: null, wallSpec: null }); r().renderPlanPanels(); r().requestPlanDraw(); });
  moveCursorTo(() => elXY(W(), '#go3d'), 20.1, 20.95); click(21.05);
  const c1 = caption('01', 'Grundriss<br>zeichnen', 'Räume aufziehen, benennen und Ebenen anlegen.', null, { left: '110px', top: '360px', width: '520px' });
  cue(c1, 12.7, 20.9, { di: 1.0 });

  // ---------- 4. 3D entsteht ----------
  at(21.45, () => {
    CUR.show = 0; loadState(r(), { roof: 'flach' }); clean(true); r().setMode('3d'); threeReady(r()); r().setWhole(false); r().T3.cut = 0.05; r().build3D();
    setCard({ s: 1, rx: 0, ry: 0, x: 0, y: 0, rad: 0 });
  });
  during(21.45, 24.4, t => { const u = eio(seg(t, 21.7, 24.3)); r().T3.cut = u >= 0.999 ? null : lerp(0.05, 2.75, u); r().build3D(); });
  during(21.45, 28.0, t => camPath(r(), [[6, 25, 4.6], [3, 18, 13], [-3.5, 11, 16], [-5.5, 8.5, 14.5]], [[6, 0, 4.5], [6, 0.3, 4.5], [6, 0.8, 4.5], [6.3, 1.0, 4.4]], eio(seg(t, 21.45, 28.0)), lerp(40, 46, seg(t, 21.45, 28))));
  cue(caption('02', 'In 3D erleben', 'Ein Klick – und aus dem Grundriss wird eine 3D-Welt.'), 22.9, 27.3);

  // ---------- 5. Einrichten ----------
  at(27.98, () => { loadState(r(), { roof: 'flach' }, stripLounge); r().setWhole(false); r().T3.cut = 1.5; r().build3D(); });
  during(27.98, 34.2, t => camPath(r(), [[2.5, 6.4, 13.5], [6.5, 5.6, 13.2], [10.5, 5.0, 12.4]], [[7.5, 0.4, 5.5], [9.0, 0.4, 6.4], [9.8, 0.3, 7.0]], sm(seg(t, 27.98, 34.2)), 44));
  LOUNGE_POPS.forEach((f, i) => popItem(r, 0, f, 28.7 + i * 0.32));
  const swap = (t, fn) => at(t, () => { fn(roomOf(r(), 0, 'Lounge')); r().build3D(); });
  swap(31.2, x => { x.floor = { tex: 'marmor', color: '#eceae4' }; });
  swap(31.75, x => { x.floor = { tex: 'teppich', color: '#6f7d8c' }; });
  swap(32.3, x => { x.floor = { tex: 'parkett', color: '#9a6438' }; });
  swap(32.85, x => { x.wallSpec = { tex: 'farbe', color: '#cfdccb' }; });
  swap(33.4, x => { x.wallSpec = { tex: 'holz', color: '#b27c4c' }; });
  // Drehen + Größe ändern an der Kücheninsel
  let insel = null;
  at(34.2, () => { insel = r().state.floors[0].items.find(i => i.type === 'kuecheninsel'); r().T3.sel = { kind: 'item', id: insel.id }; r().build3D(); });
  during(34.2, 37.5, t => {
    camPath(r(), [[6.2, 7.8, 6.6], [8.0, 7.3, 6.2]], [[9.4, 0.4, 1.6], [9.7, 0.4, 1.4]], sm(seg(t, 34.2, 37.5)), 44);
    const g = insel && r().T3.itemGroups.get(insel.id); if (!g) return;
    const a = eio(seg(t, 34.9, 35.7)) - eio(seg(t, 36.5, 37.2)); g.rotation.y = -a * Math.PI / 2;
    const k = 1 + 0.35 * (eio(seg(t, 35.8, 36.4)) - eio(seg(t, 36.9, 37.4))); g.scale.set(k, 1, 1);
  });
  cue(caption('03', 'Einrichten', 'Möbel, Türen und Fenster setzen – drehen, skalieren, Böden und Wände frei gestalten.'), 28.5, 37.0);

  // ---------- 6. Ganzes Haus ----------
  at(37.48, () => { loadState(r(), { roof: 'flach' }); r().setWhole(true); });
  during(37.48, 41.6, t => camPath(r(), [[2.0, 2.2, 24], [7, 4.0, 24.5], [15, 8, 22]], [[3.5, 4.6, 8], [5, 4.2, 7], [6, 3.2, 4.5]], sm(seg(t, 37.48, 41.6)), 40));
  at(41.6, () => { loadState(r(), { roof: 'sattel', roofFloor: true, roofTex: 'anthrazit' }); r().setWhole(true); });
  during(41.6, 46.5, t => orbit(r(), [6, 3.6, 4.5], lerp(23, 25, seg(t, 41.6, 46.5)), lerp(4.5, 9, sm(seg(t, 41.6, 46.5))), lerp(1.05, 1.95, seg(t, 41.6, 46.5)), 42));
  cue(caption('04', 'Das ganze Haus', null, ['Stockwerke', 'Treppen', 'Dach', 'Balkon']), 38.1, 46.0);

  // ---------- 7. Garten oder Stadt, Tag oder Nacht ----------
  at(46.48, () => { loadState(r(), { roof: 'flach' }); r().setWhole(true); });
  during(46.48, 49.3, t => orbit(r(), [6, 1.5, 4.5], lerp(33, 30, seg(t, 46.48, 49.3)), lerp(18, 15, seg(t, 46.48, 49.3)), lerp(1.25, 0.8, seg(t, 46.48, 49.3)), 42));
  at(49.3, () => { loadState(r(), { roof: 'flach', env: 'city' }); r().setWhole(true); });
  during(49.3, 51.7, t => camPath(r(), [[25, 9, 17], [23, 10, 4]], [[6, 2.8, 4.5], [6, 2.6, 4.5]], seg(t, 49.3, 51.7), 42));
  at(51.7, () => { loadState(r(), { roof: 'flach', env: 'city', night: true }); r().setWhole(true); });
  during(51.7, 54.5, t => orbit(r(), [6, 2.5, 4.5], lerp(30, 26, seg(t, 51.7, 54.5)), lerp(11, 8, seg(t, 51.7, 54.5)), lerp(-0.55, -0.2, seg(t, 51.7, 54.5)), 40));
  flashK.push([51.62, 0], [51.7, 0.35, eout], [52.0, 0]);
  cue(caption('', 'Garten oder Großstadt.', null), 46.9, 51.2, { dout: 0.4 });
  cue(caption('', 'Tag oder Nacht.', null), 52.1, 54.1, { dout: 0.4 });

  // ---------- 8. Begehen ----------
  at(54.45, () => { loadState(r(), { roof: 'flach' }); r().setWhole(false); r().T3.cut = null; });
  walkScene(r, 54.5, 63.4);
  cue(caption('05', 'Begehen', 'Lauf durch dein Zuhause – über die Treppe bis ins Obergeschoss.'), 55.3, 62.8);

  // ---------- 9. Überall: Rechner, Tablet, Handy ----------
  at(63.45, () => {
    loadState(r(), { roof: 'flach' }); clean(false); r().setWhole(true); r().build3D();
    setCard({ s: 0.6, rx: 4, ry: 16, x: -300, y: 40, rad: 18 }); setPhone({ op: 1, s: 0.95, x: 560, y: 40, ry: -16, rx: 3 });
    loadState(R2(), { roof: 'flach' }); R2().setMode('3d'); threeReady(R2()); R2().setWhole(true); clean(true, papp.contentWindow); papp.contentWindow.document.body.classList.remove('vclean');
  });
  during(63.45, 70.4, t => {
    const u = seg(t, 63.45, 70.4);
    setCard({ ry: lerp(16, 10, sm(u)), x: lerp(-300, -290, u) }); setPhone({ ry: lerp(-16, -9, sm(u)) });
    orbit(r(), [6, 2.4, 4.5], 26, 11, lerp(0.4, 0.9, u), 42); orbit(R2(), [6, 2.6, 4.5], 34, 14, lerp(0.9, 0.4, u), 46);
  });
  at(70.4, () => setPhone({ op: 0 }));
  cue(text('Rechner. Tablet. Handy.', { top: '70px' }, 'center', {}), 64.1, 69.9).el.style.font = '700 64px/1 -apple-system,"SF Pro Display",sans-serif';
  cue(text('<span class="chips" style="justify-content:center;display:flex;gap:14px"><b>Kostenlos</b><b>Ohne Anmeldung</b><b>Direkt im Browser</b></span>', { bottom: '58px' }, 'center'), 65.1, 69.9);

  // ---------- 10. Open Source ----------
  ossScene(70.45, 78.9);

  // ---------- 11. Abspann ----------
  at(78.95, () => { setCard({ op: 1, s: 1.04, rx: 0, ry: 0, x: 0, y: 0, rad: 0, blur: 5, br: 0.42 }); clean(true); loadState(r(), { roof: 'flach', env: 'city', night: true }); r().setWhole(true); });
  during(78.95, 87, t => orbit(r(), [6, 2.4, 4.5], 30, 10, lerp(0.3, 0.75, seg(t, 78.95, 87)), 40));
  endCard(79.5);
  return 87.0;
}

/* ---------- Open-Source-Szene ---------- */
const CODE = [
  ['c', '// Ein neues Möbelstück? Ein paar Zeilen genügen.'],
  ['k', 'const ', 'n', 'FURN', '', ' = {'],
  ['', '  ', 'n', 'sofa', '', ': { name: ', 's', "'Sofa'", '', ', w: ', 'n', '2.2', '', ', d: ', 'n', '0.9', '', ','],
  ['', '    parts: [[', 's', "'b'", '', ', ', 's', "'main'", '', ', 0, 0.2, 0, 2.2, 0.4, 0.9], …] },'],
  ['', '  ', 'n', 'haengematte', '', ': { name: ', 's', "'Hängematte'", '', ', w: ', 'n', '2.6', '', ', … },'],
  ['', '};'],
  [''],
  ['c', '// Fork → Branch → Pull Request. Willkommen!'],
];
function codeHTML(chars) {
  let left = chars, out = '';
  for (const line of CODE) {
    for (let i = 0; i < line.length; i += 2) {
      const cls = line[i], s = line[i + 1] ?? ''; if (left <= 0) break;
      const part = s.slice(0, left); left -= part.length; out += cls ? `<span class="${cls}">${part.replace(/</g, '&lt;')}</span>` : part.replace(/</g, '&lt;');
    }
    if (left <= 0) break; out += '\n'; left--;
  }
  return out + '<span style="color:#58a6ff">▍</span>';
}
const TOTAL_CODE = CODE.reduce((n, l) => n + l.filter((_, i) => i % 2).join('').length + 1, 0);
function ossScene(t0, t1) {
  const oss = $('#oss'), cv = $('#osscv'), code = $('#code'), repo = $('#repo'), d = devicePixelRatio || 1;
  cv.width = VW * d; cv.height = VH * d; const x = cv.getContext('2d'); x.scale(d, d);
  // Zielpunkte: Haus-Silhouette (Dach + Körper + Tür) aus Knoten
  const cx = VW / 2, cy = PORT ? VH * 0.42 : 470, S = PORT ? 0.95 : 1.05;
  const outline = [[-150, 20], [0, -110], [150, 20], [150, 170], [-150, 170], [-150, 20], [150, 20]];
  const door = [[-30, 170], [-30, 90], [30, 90], [30, 170]];
  const tgt = [];
  const along = (pts, n) => { let L = 0; const segs = []; for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push([pts[i], pts[i + 1], l]); L += l; }
    for (let k = 0; k < n; k++) { let s = k / n * L; for (const [a, b, l] of segs) { if (s <= l) { tgt.push([a[0] + (b[0] - a[0]) * s / l, a[1] + (b[1] - a[1]) * s / l]); break; } s -= l; } } };
  along(outline, 120); along(door, 22);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const N = tgt.length + 70;
  const nodes = Array.from({ length: N }, (_, i) => ({ sx: rnd() * VW, sy: rnd() * VH, tx: i < tgt.length ? cx + tgt[i][0] * S : cx + (rnd() - 0.5) * VW * 0.9, ty: i < tgt.length ? cy + tgt[i][1] * S : cy + (rnd() - 0.5) * VH * 0.8, d: rnd() * 0.9, ph: rnd() * 6.28, free: i >= tgt.length, red: rnd() < 0.08 }));
  if (PORT) { Object.assign(code.style, { left: '40px', right: '40px', top: '600px', fontSize: '13px', padding: '20px 22px' }); repo.style.display = 'none'; }
  else { Object.assign(code.style, { left: '110px', top: '700px', width: '780px', fontSize: '17px', padding: '24px 30px' }); Object.assign(repo.style, { right: '110px', top: '730px', width: '600px' }); }
  during(t0 - 0.05, t1 + 0.4, t => {
    const v = seg(t, t0 - 0.05, t0 + 0.3) * (1 - seg(t, t1, t1 + 0.4)); oss.style.opacity = v;
    x.clearRect(0, 0, VW, VH);
    const P = nodes.map(n => { const u = eout5(seg(t, t0 + 0.2 + n.d, t0 + 2.6 + n.d)); const w = n.free ? 10 : 2.5;
      return [lerp(n.sx, n.tx, u) + Math.sin(t * 0.9 + n.ph) * w, lerp(n.sy, n.ty, u) + Math.cos(t * 0.8 + n.ph) * w, n]; });
    x.lineWidth = 1;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], dd = dx * dx + dy * dy; if (dd > 70 * 70) continue;
      x.strokeStyle = `rgba(41,151,255,${(1 - Math.sqrt(dd) / 70) * 0.5})`; x.beginPath(); x.moveTo(P[i][0], P[i][1]); x.lineTo(P[j][0], P[j][1]); x.stroke();
    }
    for (const [px, py, n] of P) { x.fillStyle = n.red ? 'rgba(224,0,43,.95)' : n.free ? 'rgba(200,225,255,.55)' : 'rgba(235,245,255,.95)'; x.beginPath(); x.arc(px, py, n.free ? 2 : 3.2, 0, 6.283); x.fill();
      if (!n.free) { x.fillStyle = 'rgba(41,151,255,.18)'; x.beginPath(); x.arc(px, py, 9, 0, 6.283); x.fill(); } }
    const cu = seg(t, t0 + 1.2, t0 + 5.6); code.innerHTML = codeHTML(Math.round(cu * TOTAL_CODE));
    const ca = eout(seg(t, t0 + 0.8, t0 + 1.8)); code.style.opacity = ca; code.style.transform = `translateY(${(1 - ca) * 40}px)`;
    const ra = eout(seg(t, t0 + 1.8, t0 + 2.8)); repo.style.opacity = ra; repo.style.transform = `translateY(${(1 - ra) * 40}px)`;
  });
  at(t0 - 0.05, () => { setCard({ op: 0 }); setPhone({ op: 0 }); });
  const top = PORT ? '120px' : '70px';
  const h = text('Open Source.', { top }, 'center mega'); h.el.style.fontSize = PORT ? '84px' : '110px'; cue(h, t0 + 2.4, t1 - 0.2, { di: 1.0, blur: 14, sc: 0.05 });
  cue(text('Jeder kann mitbauen.', { top: PORT ? '230px' : '200px' }, 'center sub'), t0 + 3.1, t1 - 0.2);
  if (PORT) cue(text('<span class="pill">MIT-Lizenz · github.com/DesignStraub/raumplaner</span>', { top: '880px', fontSize: '12px' }, 'center'), t0 + 4.3, t1 - 0.2);
}

/* ---------- Abspann ---------- */
function endCard(t0) {
  const y0 = PORT ? 300 : 300;
  const lg = text(`<span class="applogo">${APP_ICON}<span class="mega" style="font-size:${PORT ? 62 : 120}px">Raum<span>planer</span></span></span>`, { top: y0 + 'px' }, 'center'); if (PORT) { lg.el.querySelector('svg').style.width = '70px'; lg.el.querySelector('svg').style.height = '70px'; lg.el.querySelector('.applogo').style.gap = '14px'; } cue(lg, t0, 999, { di: 1.2, blur: 16, sc: 0.06 });
  cue(text(`<span class="url" style="${PORT ? 'font-size:24px' : ''}">designstraub.github.io/raumplaner</span>`, { top: (y0 + (PORT ? 120 : 190)) + 'px' }, 'center'), t0 + 1.0, 999);
  cue(text(`<span class="url gh" style="${PORT ? 'font-size:17px' : ''}">Open Source auf GitHub · DesignStraub/raumplaner</span>`, { top: (y0 + (PORT ? 170 : 250)) + 'px' }, 'center'), t0 + 1.5, 999);
  cue(text(`${heartSVG(PORT ? 54 : 64)}<div class="eyebrow" style="margin-top:16px;font-size:${PORT ? 14 : 16}px">OneHumanity Labs</div><div style="margin-top:8px;color:rgba(245,245,247,.6);font-size:${PORT ? 18 : 20}px">One Planet, One Humanity</div>`, { top: (y0 + (PORT ? 260 : 400)) + 'px' }, 'center'), t0 + 2.0, 999, { di: 1.2 });
}

/* =========================================================
   SHORT 9:16
   ========================================================= */
function short() {
  const r = R;
  fadeK = [[0, 1], [0.45, 0], [3.2, 0], [3.4, 1], [3.5, 1], [3.8, 0], [9.75, 0], [14.4, 0], [14.55, 0.9], [14.75, 0],
    [20.4, 0], [20.55, 0.9], [20.75, 0], [25.9, 0], [26.05, 1], [26.3, 0], [30.85, 0], [31.0, 1], [31.3, 0], [34.1, 0], [34.35, 1], [34.7, 0], [39.2, 0], [40.0, 1]];
  flashK = [[0, 0], [9.62, 0], [9.75, 0.95, eout], [10.2, 0], [24.25, 0], [24.35, 0.4, eout], [24.65, 0]];
  bgK = [[0, 1]];
  // Hook
  at(0, () => { setCard({ op: 1, s: 1, rad: 0 }); clean(true); loadState(r(), { roof: 'flach', env: 'city', night: true }); r().setMode('3d'); threeReady(r()); r().setWhole(true); });
  during(0, 3.45, t => orbit(r(), [6, 2.5, 4.5], lerp(33, 29, sm(seg(t, 0, 3.45))), lerp(14, 10.5, seg(t, 0, 3.45)), lerp(-0.55, -0.25, seg(t, 0, 3.45)), 62));
  const h1 = text('Dein Haus.', { top: '210px' }, 'center mega'); cue(h1, 0.25, 3.0, { di: 0.7, blur: 14, sc: 0.08 });
  const h2 = text('In 3D.', { top: '320px', color: '#2997ff' }, 'center mega'); cue(h2, 0.75, 3.0, { di: 0.7, blur: 14, sc: 0.08 });
  cue(text('Kostenlos · direkt im Browser', { top: '450px' }, 'center sub'), 1.4, 3.0);
  // Grundriss auf dem Handy
  at(3.4, () => {
    setCard({ op: 0 }); setPhone({ op: 1, s: 0.84, y: 92, rx: 0, ry: 0, x: 0 });
    loadState(R2(), {}, s => { s.floors = [s.floors[0]]; Object.assign(s.floors[0], { rooms: [], openings: [], items: [] }); });
    R2().setMode('plan'); papp.contentWindow.document.querySelector('[data-tool2d="rect"]').click(); CUR.show = 1; CUR.x = 200; CUR.y = 900;
  });
  at(3.5, () => { const P = R2().P, cv = papp.contentWindow.document.getElementById('plan'); P.scale = 27; P.ox = (cv.clientWidth - 12 * 27) / 2; P.oy = (cv.clientHeight - 9 * 27) / 2 - 30; R2().requestPlanDraw(); });
  during(3.4, 9.8, t => setPhone({ ry: lerp(-6, 6, seg(t, 3.4, 9.8)), rx: 4 }));
  const P2 = () => papp.contentWindow;
  EG.slice(0, 4).forEach(([n, a, b], i) => drawRect(P2, 4.0 + i * 1.0, a, b, n, 0.95));
  at(8.1, () => { const f = R2().state.floors[0]; f.rooms.unshift({ id: R2().uid(), name: 'Wohnen & Essen', points: [[0, 0], [7, 0], [7, 3.5], [4, 3.5], [4, 6], [0, 6]], floor: null, wallSpec: null });
    f.rooms.push({ id: R2().uid(), name: 'Arbeitszimmer', points: [[0, 6], [4, 6], [4, 9], [0, 9]] }, { id: R2().uid(), name: 'Hauswirtschaft', points: [[4, 6], [7, 6], [7, 9], [4, 9]] });
    R2().state = JSON.parse(JSON.stringify(R2().state)); });
  moveCursorTo(() => elXY(P2(), '#m-go3d'), 8.5, 9.3); click(9.4);
  const c01 = caption('01', 'Grundriss zeichnen', null, null, { left: '40px', right: '40px', top: '26px' }); c01.el.querySelector('.ti').style.fontSize = '44px'; c01.el.querySelector('.ti').style.marginTop = '10px'; cue(c01, 3.7, 9.5);
  // 3D entsteht (Hochformat, randlos)
  at(9.75, () => {
    CUR.show = 0; setPhone({ op: 0 }); setCard({ op: 1, s: 1, rad: 0, rx: 0, ry: 0, x: 0, y: 0 });
    loadState(r(), { roof: 'flach' }); r().setWhole(false); r().T3.cut = 0.05; r().build3D();
  });
  during(9.75, 12.2, t => { const u = eio(seg(t, 9.9, 12.1)); r().T3.cut = u >= 0.999 ? null : lerp(0.05, 2.75, u); r().build3D(); });
  during(9.75, 14.55, t => camPath(r(), [[6, 34, 4.6], [3, 25, 17], [-2, 17, 23]], [[6, 0, 4.5], [6, 0.5, 4.5], [6, 0.8, 4.5]], eio(seg(t, 9.75, 14.55)), lerp(56, 62, seg(t, 9.75, 14.55))));
  cue(caption('02', 'Ein Tipp – alles in 3D'), 10.4, 14.1);
  // Einrichten
  at(14.53, () => { loadState(r(), { roof: 'flach' }, stripLounge); r().setWhole(false); r().T3.cut = 1.5; r().build3D(); });
  during(14.53, 20.55, t => camPath(r(), [[8.0, 9.5, 17.5], [10.5, 8.5, 16.5]], [[9.2, 0.3, 6.6], [9.6, 0.3, 7.0]], sm(seg(t, 14.53, 20.55)), 62));
  LOUNGE_POPS.forEach((f, i) => popItem(r, 0, f, 15.0 + i * 0.3));
  const swap = (t, fn) => at(t, () => { fn(roomOf(r(), 0, 'Lounge')); r().build3D(); });
  swap(17.4, x => { x.floor = { tex: 'marmor', color: '#eceae4' }; });
  swap(17.95, x => { x.floor = { tex: 'teppich', color: '#6f7d8c' }; });
  swap(18.5, x => { x.floor = { tex: 'parkett', color: '#9a6438' }; });
  swap(19.05, x => { x.wallSpec = { tex: 'farbe', color: '#cfdccb' }; });
  swap(19.6, x => { x.wallSpec = { tex: 'holz', color: '#b27c4c' }; });
  cue(caption('03', 'Möbel, Böden, Farben'), 15.0, 20.1);
  // Ganzes Haus, Stadt, Nacht
  at(20.53, () => { loadState(r(), { roof: 'sattel', roofFloor: true }); r().setWhole(true); });
  during(20.53, 22.7, t => camPath(r(), [[2, 1.6, 30], [12, 8, 32]], [[4.5, 5, 7], [6, 3.6, 4.5]], sm(seg(t, 20.53, 22.7)), 60));
  at(22.7, () => { loadState(r(), { roof: 'flach', env: 'city' }); r().setWhole(true); });
  during(22.7, 24.35, t => camPath(r(), [[32, 11, 20], [30, 12, 6]], [[6, 2.8, 4.5], [6, 2.6, 4.5]], seg(t, 22.7, 24.35), 60));
  at(24.35, () => { loadState(r(), { roof: 'flach', env: 'city', night: true }); r().setWhole(true); });
  during(24.35, 26.05, t => orbit(r(), [6, 2.5, 4.5], 30, 12, lerp(-0.45, -0.2, seg(t, 24.35, 26.05)), 60));
  cue(caption('04', 'Das ganze Haus', null, ['Dach', 'Balkon', 'Garten', 'Stadt', 'Nacht']), 20.9, 25.6);
  // Begehen
  at(26.03, () => { loadState(r(), { roof: 'flach' }); r().setWhole(false); r().T3.cut = null; });
  walkScene(r, 26.05, 31.0, 0.3, 1);
  cue(caption('05', 'Einfach durchlaufen'), 26.5, 30.6);
  // Open Source + Abspann
  ossScene(31.0, 34.2);
  at(34.3, () => { setCard({ op: 1, s: 1.04, rad: 0, blur: 4, br: 0.42 }); clean(true); loadState(r(), { roof: 'flach', env: 'city', night: true }); r().setWhole(true); });
  during(34.3, 40, t => orbit(r(), [6, 2.5, 4.5], 30, 11, lerp(0.3, 0.6, seg(t, 34.3, 40)), 60));
  endCard(34.6);
  return 40.0;
}

/* ---------- Ablauf ---------- */
let DURATION = 0, fadeF, barF, flashF, bgF;
async function setup() {
  const jobs = [bootApp(app, AW, AH), bootApp(papp, 390, 844)];
  await Promise.all(jobs);
  for (const f of [app, papp]) { const win = f.contentWindow; pump(win, 4); win.__rp.state = win.buildDemoState({}); win.__rp.setMode('3d'); threeReady(win.__rp); pump(win, 30); }
  DURATION = MODE === 'short' ? short() : trailer();
  EV.sort((a, b) => a.t - b.t);
  fadeF = track(fadeK); barF = track(barK); flashF = track(flashK); bgF = track(bgK);
  setCard({ op: 0 }); applyCard(); applyPhone();
  window.DURATION = DURATION; window.FRAMES = Math.round(DURATION * FPS);
  window.stageReady = true;
}
let lastT = -1;
window.__frame = i => {
  const t = i / FPS;
  while (evI < EV.length && EV[evI].t <= t) { try { EV[evI].fn(); } catch (e) { console.error('Ereignis', EV[evI].t, e); } evI++; }
  for (const d of DUR) if (t >= d.a && t < d.b) { try { d.fn(t); } catch (e) { console.error('Spur', d.a, e); } }
  try { grade(R()); grade(R2()); } catch {}
  drawPops(t); drawTexts(t); drawCursor(t);
  applyCard(); applyPhone();
  $('#fade').style.opacity = fadeF(t); $('#flash').style.opacity = flashF(t);
  const bh = barF(t); $('#bar-t').style.height = bh + 'px'; $('#bar-b').style.height = bh + 'px';
  $('#bg').style.opacity = bgF(t); $('#stars').style.transform = `scale(${1 + t * 0.004})`;
  GRAIN.x.drawImage(GRAIN.out[i % GRAIN.out.length], 0, 0);
  window.__vt.step(1000 / FPS);
  lastT = t;
  return t;
};
setup().catch(e => { console.error(e); window.stageError = String(e && e.stack || e); });
