// Baut das Vorzeige-Haus für Trailer und Short (läuft in der App-Seite, braucht ?debug)
window.buildDemoState = function (opts = {}) {
  const R = window.__rp, uid = R.uid;
  const room = (name, pts, floor, wall) => ({ id: uid(), name, points: pts, floor: floor || null, wallSpec: wall || null });
  const P = (tex, color) => ({ tex, color });
  const eg = [
    room('Wohnen & Essen', [[0, 0], [7, 0], [7, 3.5], [4, 3.5], [4, 6], [0, 6]], P('parkett', '#9a6438')),
    room('Küche', [[7, 0], [12, 0], [12, 3.5], [7, 3.5]], P('fliesen', '#d9d5cd')),
    room('Diele', [[4, 3.5], [9, 3.5], [9, 6], [4, 6]], P('marmor', '#eceae4')),
    room('Windfang', [[9, 3.5], [12, 3.5], [12, 6], [9, 6]], P('marmor', '#eceae4')),
    room('Arbeitszimmer', [[0, 6], [4, 6], [4, 9], [0, 9]], P('laminat', '#cfae84')),
    room('Hauswirtschaft', [[4, 6], [7, 6], [7, 9], [4, 9]], P('beton', '#9d9d98')),
    room('Lounge', [[7, 6], [12, 6], [12, 9], [7, 9]], P('parkett', '#9a6438')),
  ];
  const og = [
    room('Schlafzimmer', [[0, 0], [5, 0], [5, 4.5], [0, 4.5]], P('parkett', '#9a6438')),
    room('Ankleide', [[5, 0], [7, 0], [7, 3.5], [5, 3.5]], P('laminat', '#cfae84')),
    room('Bad', [[7, 0], [12, 0], [12, 3.5], [7, 3.5]], P('marmor', '#eceae4'), P('fliesen', '#e9eff1')),
    room('Galerie', [[5, 3.5], [9, 3.5], [9, 6], [5, 6], [5, 4.5]], P('parkett', '#9a6438')),
    room('Kinderzimmer', [[0, 4.5], [5, 4.5], [5, 9], [0, 9]], P('laminat', '#cfae84'), P('farbe', '#dbe9fb')),
    room('Spielzimmer', [[9, 3.5], [12, 3.5], [12, 9], [9, 9]], P('teppich', '#b07a6a')),
    room('Studio', [[5, 6], [9, 6], [9, 9], [5, 9]], P('parkett', '#9a6438')),
  ];
  // Fenster an Außenwänden, Türen zwischen Räumen
  function openings(rooms, H, extra = []) {
    const walls = R.computeWalls(rooms), out = [], pairs = new Set(), used = new Set();
    const mk = (type, w, pos, width, height, sill, name, face) => {
      const nx = -w.u[1], ny = w.u[0];
      out.push({ id: uid(), type, name, x: +(w.a[0] + w.u[0] * pos).toFixed(3), y: +(w.a[1] + w.u[1] * pos).toFixed(3), dir: [...w.u], width, height, sill,
        face: face || [nx, ny], hingeVec: [-w.u[0], -w.u[1]], open: type === 'door' && name !== 'Haustür' });
    };
    const pairKey = w => [w.L, w.R].sort().join('|');
    for (const w of walls) if (extra.some(e => e(w, mk))) { used.add(w); if (w.L && w.R) pairs.add(pairKey(w)); }
    for (const w of walls) {
      if (used.has(w)) continue;
      if (!w.L || !w.R) {
        if (w.len < 1.8) continue;
        const n = w.len > 4.6 ? 2 : 1;
        for (let k = 0; k < n; k++) mk('window', w, w.len * (k + 1) / (n + 1), n === 2 ? 1.4 : 1.2, Math.min(1.35, H - 1.05), 0.9, 'Fenster');
      } else {
        const key = pairKey(w);
        if (pairs.has(key) || w.len < 1.3) continue;
        pairs.add(key); mk('door', w, Math.min(w.len - 0.7, Math.max(0.7, w.len / 2)), 0.9, 2.1, 0, 'Tür');
      }
    }
    return out;
  }
  // Haustür: Diele hat keine Außenwand → Haustür in die Wohnen-Südwand; Terrassentür groß
  const egOpen = openings(eg, 2.75, [
    (w, mk) => { if (w.a[1] === 9 && w.b[1] === 9 && w.a[0] === 7 && w.b[0] === 12) { mk('window', w, 1.4, 2.2, 2.3, 0.1, 'Panoramafenster'); mk('window', w, 3.7, 2.2, 2.3, 0.1, 'Panoramafenster'); return true; } },
    (w, mk) => { if (w.a[0] === 12 && w.b[0] === 12 && w.a[1] === 3.5) { mk('door', w, 1.25, 1.0, 2.2, 0, 'Haustür'); return true; } },
    (w, mk) => { if (w.a[0] === 4 && w.b[0] === 4 && w.a[1] === 3.5 && w.b[1] === 6) { mk('door', w, 1.15, 0.9, 2.1, 0, 'Tür'); return true; } },
  ]);
  const ogOpen = openings(og, 2.6, [
    (w, mk) => { if (w.a[1] === 9 && w.b[1] === 9 && w.a[0] === 0 && w.b[0] === 5) { mk('door', w, 2.5, 1.0, 2.1, 0, 'Balkontür'); mk('window', w, 0.95, 1.0, 1.3, 0.8, 'Fenster'); mk('window', w, 4.05, 1.0, 1.3, 0.8, 'Fenster'); return true; } },
  ]);
  const I = (type, x, y, rot = 0, color, ex = {}) => ({ id: uid(), type, name: R.FURN[type].name, x, y, rot, color: color || R.FURN[type].color, ...ex });
  const D = Math.PI / 2;
  const egItems = [
    I('ecksofa', 2.0, 4.6, Math.PI, '#8d8a84'), I('teppich', 2.0, 3.0, 0, '#b65b4a', { w: 2.6, d: 1.8 }), I('couchtisch', 2.0, 3.1, 0),
    I('tv', 2.0, 0.25, 0, '#2f3135'), I('lampe', 0.45, 5.5), I('pflanze', 3.6, 5.5), I('sessel', 3.5, 2.0, D * 0.6, '#a8754f'),
    I('esstisch', 5.5, 1.6, D, '#a57a50'), I('stuhl', 5.0, 1.15, -D), I('stuhl', 5.0, 2.05, -D), I('stuhl', 6.0, 1.15, D), I('stuhl', 6.0, 2.05, D), I('pflanze', 6.6, 3.0),
    I('kueche', 9.5, 0.33, 0), I('kuecheninsel', 9.5, 2.0, 0, '#2f3b45'), I('kuehlschrank', 11.6, 0.35, 0), I('barhocker', 9.0, 2.75), I('barhocker', 10.0, 2.75),
    I('treppe', 7.0, 4.45, D, '#b08a63'), I('pflanze', 4.4, 5.6), I('garderobe', 10.5, 3.72, 0), I('pflanze', 9.4, 5.6),
    I('schreibtisch', 2.0, 8.6, Math.PI, '#e9e6e0'), I('buerostuhl', 2.0, 7.9), I('regal', 0.2, 7.2, -D), I('pflanze', 3.5, 6.5),
    I('waschmaschine', 6.6, 8.6, Math.PI), I('regal', 4.2, 7.5, -D, '#efece6'),
    I('sofa', 9.5, 6.5, 0, '#6b7787'), I('couchtisch', 9.5, 7.6, 0), I('sessel', 11.4, 8.2, D * 1.4, '#a8754f'), I('teppich', 9.5, 7.5, 0, '#e7cf8a', { w: 2.4, d: 1.8 }), I('lampe', 7.5, 8.5),
  ];
  const ogItems = [
    I('bett', 2.5, 3.3, Math.PI, '#8a6a4a'), I('nachttisch', 1.35, 4.2, Math.PI), I('nachttisch', 3.65, 4.2, Math.PI), I('teppich', 2.5, 2.0, 0, '#c9b49a', { w: 2.4, d: 1.4 }), I('sessel', 4.3, 0.9, -D * 0.5, '#6b7787'),
    I('schrank', 6.0, 0.3, 0, '#efece6', { w: 1.6 }), I('kommode', 6.75, 2.2, D),
    I('badewanne', 11.1, 0.45, 0), I('dusche', 7.5, 0.5), I('waschbecken', 9.2, 0.25, 0), I('waschbecken', 9.9, 0.25, 0), I('wc', 11.65, 2.8, D), I('pflanze', 8.3, 3.1),
    I('regal', 6.2, 5.8, Math.PI), I('lampe', 8.6, 3.85),
    I('kinderbett', 0.5, 6.0, 0, '#f1ede6'), I('schreibtisch', 3.6, 4.85, 0, '#e9e6e0'), I('buerostuhl', 3.6, 5.5), I('teppich', 2.2, 6.8, 0, '#7d9cc4', { w: 1.8, d: 1.4 }), I('regal', 4.8, 7.0, D, '#efece6'),
    I('sofa', 10.5, 8.5, Math.PI, '#b07a6a'), I('teppich', 10.5, 6.8, 0, '#e7cf8a', { w: 2.0, d: 2.0 }), I('regal', 11.8, 5.0, D),
    I('schreibtisch', 7.0, 8.6, Math.PI, '#5b4636', { w: 1.8 }), I('buerostuhl', 7.0, 7.9), I('pflanze', 5.4, 8.5), I('sideboard', 8.75, 7.2, D, '#2f3135', { w: 1.4 }),
  ];
  const s = {
    version: 2, name: 'Haus am Hang', wallThickness: 0.2,
    defaults: { wall: { tex: 'putz', color: '#f1ece3' }, floor: { tex: 'parkett', color: '#9a6438' } },
    floors: [
      { id: 'fEG', name: 'Erdgeschoss', wallHeight: 2.75, rooms: eg, openings: egOpen, items: egItems, sides: [], wallNames: [], exterior: { tex: 'putz', color: '#f2efe8' }, roof: false, cellar: false, lines: [], balconies: [] },
      { id: 'fOG', name: 'Obergeschoss', wallHeight: 2.6, rooms: og, openings: ogOpen, items: ogItems, sides: [], wallNames: [], exterior: { tex: 'holz', color: '#9c6b43' }, roof: !!opts.roofFloor, cellar: false, lines: [],
        balconies: [{ id: uid(), x: 2.5, y: 9.85, w: 4.2, d: 1.5, rot: 0, rail: 'glas', boden: 'holz' }] },
    ],
    activeFloor: opts.floor || 'fEG',
    world: { env: opts.env || 'garden', garden: 9, plot: null, hedge: true, night: !!opts.night, facade: { tex: 'putz', color: '#f2efe8' },
      roof: { type: opts.roof || 'flach', pitch: 30, knee: 1.0, turn: false, spec: { tex: opts.roofTex || 'anthrazit', color: '#3c3f44' } } },
    garden: [],
  };
  return s;
};
