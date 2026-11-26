// Virtuelle Zeit: jedes Bild rückt die Uhr um genau 1/fps weiter – egal wie lange das Rendern dauert.
(() => {
  if (window.__vt) return;
  let vt = 0;
  window.__real = { setTimeout: window.setTimeout.bind(window), raf: window.requestAnimationFrame.bind(window) };
  const D0 = Date.parse('2026-06-21T10:00:00Z');
  const raf = new Map(); let rafId = 0;
  const timers = new Map(); let tid = 0;
  performance.now = () => vt;
  Date.now = () => D0 + vt;
  window.requestAnimationFrame = cb => { const id = ++rafId; raf.set(id, cb); return id; };
  window.cancelAnimationFrame = id => { raf.delete(id); };
  window.setTimeout = (fn, ms = 0, ...a) => { const id = ++tid; timers.set(id, { at: vt + Math.max(0, +ms || 0), fn, a }); return id; };
  window.clearTimeout = id => { timers.delete(id); };
  window.setInterval = (fn, ms = 0, ...a) => { const id = ++tid; const iv = Math.max(1, +ms || 1); timers.set(id, { at: vt + iv, fn, a, iv }); return id; };
  window.clearInterval = window.clearTimeout;
  const seen = new WeakMap();
  window.__vt = {
    now: () => vt,
    skip: false,
    step(dt) {
      vt += dt;
      for (let guard = 0; guard < 2000; guard++) {
        let best = null, bid = 0;
        for (const [id, t] of timers) if (t.at <= vt && (!best || t.at < best.at)) { best = t; bid = id; }
        if (!best) break;
        if (best.iv) best.at += best.iv; else timers.delete(bid);
        try { typeof best.fn === 'function' ? best.fn(...best.a) : (0, eval)(best.fn); } catch (e) { console.error(e); }
      }
      for (const a of document.getAnimations()) {
        if (!seen.has(a)) { seen.set(a, vt - dt - (a.currentTime || 0)); try { a.pause(); } catch {} }
        try { a.currentTime = vt - seen.get(a); } catch {}
      }
      const q = [...raf.values()]; raf.clear();
      for (const cb of q) { try { cb(vt); } catch (e) { console.error(e); } }
      for (const f of document.querySelectorAll('iframe')) {
        if (f.dataset.paused === '1') continue;
        try { f.contentWindow.__vt?.step(dt); } catch {}
      }
    },
  };
})();
