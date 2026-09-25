/**
 * Alxanthia "Coming soon" reel — stop-motion cut-paper scene.
 *
 * Every flower is built from separate cut-paper pieces (ink line art printed
 * on hand-tinted paper, a white cut margin, a soft shadow). Pieces are placed
 * one by one, then sway; sheets lift and slide off; a paper butterfly visits.
 *
 * Everything is a pure function of time, and time is quantised to 12 fps
 * ("on twos") so movement steps like real stop-motion. renderAt(t) sets every
 * animated attribute from scratch, so the preview and render.js agree, and the
 * final frame equals frame 0 for a seamless loop.
 *
 * Drawings live in a 900×1180 "plate" space placed on a 1080-wide canvas:
 * 1080×1920 (9:16 Reels/Stories) or 1080×1350 (4:5 feed).
 */
(function () {
  const TL = window.TIMELINE;
  const NS = 'http://www.w3.org/2000/svg';

  // Palette: the site's tokens (styles.css :root), aged slightly for paper.
  const C = {
    backing: '#E3D6BB',  // the board the sheets lie on
    plate: '#F7F1E4',    // sheet paper
    edge: '#FCF9F2',     // white cut margin around each piece
    shadow: '#2A1D10',
    ink: '#3B2F24',      // sepia ink (site --text-dark #23201B, warmed)
    gold: '#8B5E2E',     // the logo's own line colour (alxanthia-logo.png)
    goldHi: '#D9B274',   // shimmer highlight (site --dark-accent #C79B5C, lifted)
    ochre: '#8E6127',    // site --accent-ochre
    muted: '#6E6656',    // site --text-muted
    stamp: '#9A4A36',    // vintage stamp-pad red
    rose: '#C4776E',
    coral: '#D27B5B',
    gerbera: '#DE8466',
    lavender: '#8E7FB0',
    sage: '#7F9170',     // leaves: site --accent-green #3F5545, as a wash
    stem: '#8C9A6C',
    sunPetal: '#D9A441',
    sunDisk: '#6B4A2A',
    ribbon: '#B8894A'
  };

  const PW = 900, PH = 1180, W = 1080;
  const LAYOUT = {
    '9x16': { h: 1920, plateY: 300 },
    '4x5': { h: 1350, plateY: 85 }
  };

  /* ---------------------------------------------------------------- utils */
  const V = (x, y) => ({ x, y });
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const prog = (t, a, b) => clamp01((t - a) / (b - a));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeIn = (x) => x * x * x;
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutBack = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const f = (n) => Math.round(n * 10) / 10;
  const norm = (v) => { const l = Math.hypot(v.x, v.y) || 1; return V(v.x / l, v.y / l); };
  const polar = (c, r, deg) => { const a = (deg * Math.PI) / 180; return V(c.x + r * Math.cos(a), c.y + r * Math.sin(a)); };
  const poly = (pts, close) => 'M' + pts.map((p) => f(p.x) + ' ' + f(p.y)).join(' L') + (close ? ' Z' : '');
  const circ = (c, r, ry) => { ry = ry || r; return 'M' + f(c.x - r) + ' ' + f(c.y) + ' a' + r + ' ' + ry + ' 0 1 0 ' + 2 * r + ' 0 a' + r + ' ' + ry + ' 0 1 0 ' + -2 * r + ' 0 Z'; };
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('');
  }
  // Deterministic hash → [0, 1): drives per-frame jitter and per-piece variety.
  function hash(a, b) {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const jit = (step, id, amp) => (hash(step, id) - 0.5) * 2 * amp;

  function qb(a, c, b, t) { const u = 1 - t; return V(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y); }
  function cb(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return V(
      u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    );
  }
  function sampleSpine(fn, n) { const pts = []; for (let i = 0; i <= n; i++) pts.push(fn(i / n)); return pts; }
  function normals(pts) {
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const d = norm(V(b.x - a.x, b.y - a.y));
      return V(-d.y, d.x);
    });
  }
  function offset(pts, ns, wfn, side) {
    return pts.map((p, i) => { const w = wfn(i / (pts.length - 1)) * side; return V(p.x + ns[i].x * w, p.y + ns[i].y * w); });
  }
  function prof(t, m) {
    return t < m ? Math.pow(Math.sin((Math.PI / 2) * (t / m)), 0.85) : Math.pow(Math.cos((Math.PI / 2) * ((t - m) / (1 - m))), 1.1);
  }

  /**
   * A drawing is a list of cut-paper pieces in z-order (= placement order):
   *   { outline, wash, details: [{d, sw}], pivot, kind, fold }
   * kind picks the entrance: stems grow, leaves swing open, petals unfurl,
   * 'pop' pieces hop in.
   */
  function Drawing() { this.pieces = []; }
  Drawing.prototype.piece = function (outline, o) {
    const p = Object.assign({ outline, details: [], kind: 'pop', pivot: V(0, 0), wash: null, fold: 1 }, o);
    this.pieces.push(p);
    return p;
  };
  Drawing.prototype.detail = function (d, sw) { this.pieces[this.pieces.length - 1].details.push({ d, sw: sw || 1 }); };

  /* ------------------------------------------------------ shape builders */
  function leaf(dr, o) {
    const { base, tip } = o;
    const L = Math.hypot(tip.x - base.x, tip.y - base.y);
    const d = norm(V(tip.x - base.x, tip.y - base.y));
    const n = V(-d.y, d.x);
    const mid = V((base.x + tip.x) / 2 + n.x * (o.bend || 0) * L, (base.y + tip.y) / 2 + n.y * (o.bend || 0) * L);
    const N = 140;
    const spine = sampleSpine((t) => qb(base, mid, tip, t), N);
    const ns = normals(spine);
    const wfn = (t) => {
      let w = (o.width || 0.2) * L * prof(t, o.widest || 0.42);
      if (o.teeth && t > 0.08 && t < 0.96) w *= 1 - (o.serr || 0.12) * ((t * o.teeth) % 1);
      if (o.lobes && t > 0.1) w *= 1 - 0.3 * Math.pow(Math.abs(Math.sin(Math.PI * t * o.lobes)), 1.4);
      return w;
    };
    const asym = o.asym || 0;
    const left = offset(spine, ns, (t) => wfn(t) * (1 + asym), 1), right = offset(spine, ns, (t) => wfn(t) * (1 - asym), -1);
    dr.piece(poly(left.concat(right.slice().reverse()), true), {
      wash: o.wash, pivot: base, kind: o.kind || 'leaf', fold: tip.x < base.x ? 1 : -1
    });
    if (o.midrib !== false) dr.detail(poly(spine.slice(4, Math.round(N * 0.9))), 0.7);
    const veins = o.veins == null ? 4 : o.veins;
    for (let k = 0; k < veins; k++) {
      const t0 = 0.18 + (k * 0.62) / Math.max(1, veins);
      for (const side of [1, -1]) {
        const i0 = Math.round(t0 * N), i1 = Math.min(N, Math.round((t0 + 0.13) * N));
        const a = spine[i0];
        const b = V(spine[i1].x + ns[i1].x * wfn(i1 / N) * 0.72 * side, spine[i1].y + ns[i1].y * wfn(i1 / N) * 0.72 * side);
        const c = V(lerp(a.x, b.x, 0.5) + ns[i0].x * wfn(t0) * 0.25 * side, lerp(a.y, b.y, 0.5) + ns[i0].y * wfn(t0) * 0.25 * side);
        dr.detail('M' + f(a.x) + ' ' + f(a.y) + ' Q' + f(c.x) + ' ' + f(c.y) + ' ' + f(b.x) + ' ' + f(b.y), 0.55);
      }
    }
    return { spine, ns, wfn };
  }

  // Tapered stem along a cubic; grows up from `pivot` (defaults to its root).
  function stem(dr, p, w0, w1, washColour, o) {
    o = o || {};
    const spine = sampleSpine((t) => cb(p[0], p[1], p[2], p[3], t), 80);
    const ns = normals(spine);
    const wfn = o.wfn || ((t) => lerp(w0, w1, t));
    const l = offset(spine, ns, wfn, 1), r = offset(spine, ns, wfn, -1);
    dr.piece(poly(l.concat(r.slice().reverse()), true), { wash: washColour, pivot: o.pivot || p[3], kind: o.kind || 'stem', fold: o.fold || 1 });
    return { spine, ns, wfn, at: (t) => spine[Math.round(t * 80)], n: (t) => ns[Math.round(t * 80)] };
  }

  function petal(c, deg, r0, r1, hw, opt) {
    opt = opt || {};
    const b = polar(c, r0, deg), tip = polar(c, r1, deg);
    const d = norm(V(tip.x - b.x, tip.y - b.y)), n = V(-d.y, d.x), L = r1 - r0;
    const P = (along, side) => V(b.x + d.x * along * L + n.x * side * hw, b.y + d.y * along * L + n.y * side * hw);
    const bw = opt.baseW || 0.55, belly = opt.belly || 1.08;
    const bl = P(0, bw), br = P(0, -bw);
    const s = [
      'M' + f(bl.x) + ' ' + f(bl.y),
      'C' + [P(0.35, belly), P(0.72, opt.tipW || 0.55), tip].map((q) => f(q.x) + ' ' + f(q.y)).join(' '),
      'C' + [P(0.72, -(opt.tipW || 0.55)), P(0.35, -belly), br].map((q) => f(q.x) + ' ' + f(q.y)).join(' '),
      'Z'
    ].join(' ');
    const veins = [];
    for (const side of opt.veins || []) {
      const a = P(0.28, side * 0.32), m = P(0.55, side * 0.3), e = P(0.82, side * 0.1);
      veins.push('M' + f(a.x) + ' ' + f(a.y) + ' Q' + f(m.x) + ' ' + f(m.y) + ' ' + f(e.x) + ' ' + f(e.y));
    }
    return { d: s, veins, base: b };
  }

  function strapPetal(c, deg, r0, r1, hw) {
    const b = polar(c, r0, deg), tip = polar(c, r1, deg);
    const d = norm(V(tip.x - b.x, tip.y - b.y)), n = V(-d.y, d.x), L = r1 - r0;
    const P = (along, side) => V(b.x + d.x * along * L + n.x * side * hw, b.y + d.y * along * L + n.y * side * hw);
    const pts = [P(0, 0.5), P(0.3, 0.95), P(0.8, 1), P(0.95, 0.75), P(1, 0.3), P(0.97, 0), P(1, -0.3), P(0.95, -0.75), P(0.8, -1), P(0.3, -0.95), P(0, -0.5)];
    let s = 'M' + f(pts[0].x) + ' ' + f(pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = V(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6), c2 = V(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6);
      s += ' C' + [c1, c2, p2].map((q) => f(q.x) + ' ' + f(q.y)).join(' ');
    }
    const m0 = P(0.15, 0), m1 = P(0.8, 0);
    return { d: s + ' Z', mid: 'M' + f(m0.x) + ' ' + f(m0.y) + ' L' + f(m1.x) + ' ' + f(m1.y), base: b };
  }

  function sparkle(x, y, s) {
    const k = s * 0.14;
    return 'M' + f(x) + ' ' + f(y - s) +
      ' Q' + f(x + k) + ' ' + f(y - k) + ' ' + f(x + s * 0.78) + ' ' + f(y) +
      ' Q' + f(x + k) + ' ' + f(y + k) + ' ' + f(x) + ' ' + f(y + s) +
      ' Q' + f(x - k) + ' ' + f(y + k) + ' ' + f(x - s * 0.78) + ' ' + f(y) +
      ' Q' + f(x - k) + ' ' + f(y - k) + ' ' + f(x) + ' ' + f(y - s) + ' Z';
  }

  // Paper strip with torn ends, centred on 0,0.
  function tornStrip(w, h, seed) {
    const pts = [V(-w / 2, -h / 2), V(w / 2, -h / 2)];
    const teeth = Math.max(4, Math.round(h / 9));
    for (let i = 1; i < teeth; i++) pts.push(V(w / 2 + (hash(seed, i) - 0.5) * 12, -h / 2 + (h * i) / teeth));
    pts.push(V(w / 2, h / 2), V(-w / 2, h / 2));
    for (let i = teeth - 1; i > 0; i--) pts.push(V(-w / 2 + (hash(seed + 7, i) - 0.5) * 12, -h / 2 + (h * i) / teeth));
    return poly(pts, true);
  }

  /* ------------------------------------------------------------ plates */
  function rose() {
    const dr = new Drawing();
    const c = V(450, 350);
    const st = stem(dr, [V(450, 480), V(438, 620), V(470, 790), V(446, 935)], 7, 5, C.stem, { pivot: V(446, 935) });
    for (const [t, side] of [[0.3, 1], [0.5, -1], [0.7, 1], [0.86, -1]]) {
      const p = st.at(t), n = st.n(t), w = st.wfn(t) * side;
      const b0 = V(p.x + n.x * w, p.y + n.y * w - 7), b1 = V(p.x + n.x * w, p.y + n.y * w + 9);
      const tip = V(p.x + n.x * (w + 13 * side), p.y + n.y * (w + 13 * side) - 12);
      dr.detail(poly([b0, tip, b1]), 0.8);
    }
    // Compound leaves: petiole strip + 5 serrated leaflets.
    const compound = (start, end, bend, size) => {
      const mid = V((start.x + end.x) / 2, (start.y + end.y) / 2 + bend);
      const c1 = V(start.x + (2 / 3) * (mid.x - start.x), start.y + (2 / 3) * (mid.y - start.y));
      const c2 = V(end.x + (2 / 3) * (mid.x - end.x), end.y + (2 / 3) * (mid.y - end.y));
      stem(dr, [start, c1, c2, end], 2.6, 1.8, C.stem, { pivot: start, kind: 'leaf', fold: end.x < start.x ? 1 : -1 });
      const dir = norm(V(end.x - mid.x, end.y - mid.y)), n = V(-dir.y, dir.x);
      for (const [t, side, sc] of [[0.4, 1, 0.8], [0.4, -1, 0.8], [0.72, 1, 0.9], [0.72, -1, 0.9]]) {
        const b = qb(start, mid, end, t);
        const tp = V(b.x + (n.x * side * 0.9 + dir.x * 0.6) * size * sc, b.y + (n.y * side * 0.9 + dir.y * 0.6) * size * sc);
        leaf(dr, { base: b, tip: tp, width: 0.3, bend: 0.06 * side, teeth: 9, serr: 0.16, veins: 3, wash: C.sage });
      }
      leaf(dr, { base: end, tip: V(end.x + dir.x * size * 1.1, end.y + dir.y * size * 1.1), width: 0.3, teeth: 10, serr: 0.16, veins: 3, wash: C.sage });
    };
    compound(st.at(0.62), V(270, 700), -30, 78);
    compound(st.at(0.8), V(640, 810), -20, 72);
    // Bud on a side shoot.
    const shoot = stem(dr, [st.at(0.42), V(510, 640), V(585, 600), V(622, 548)], 4.5, 3.5, C.stem, { pivot: st.at(0.42), kind: 'leaf', fold: -1 });
    const bt = shoot.at(1);
    leaf(dr, { base: V(bt.x - 4, bt.y + 4), tip: V(bt.x + 30, bt.y - 78), width: 0.36, widest: 0.38, bend: 0.05, veins: 0, midrib: false, wash: C.rose, kind: 'petal' });
    for (const [dx, dy, bend] of [[-26, -38, 0.2], [30, -30, -0.2], [4, -44, 0]]) {
      leaf(dr, { base: bt, tip: V(bt.x + dx, bt.y + dy), width: 0.12, bend, veins: 0, midrib: false, wash: C.sage });
    }
    // Head: rings of cupped petals seen from above, slightly foreshortened.
    const squash = (p) => V(p.x, c.y + (p.y - c.y) * 0.86);
    const ring = (n, span, rIn, rOut, off, lip) => {
      for (let k = 0; k < n; k++) {
        const a = off + (360 / n) * k;
        const outer = [];
        for (let i = 0; i <= 36; i++) {
          const u = i / 36, th = a - span / 2 + span * u;
          const notch = 0.06 * Math.exp(-Math.pow((u - 0.5) / 0.07, 2));
          outer.push(squash(polar(c, rIn + (rOut - rIn) * (Math.pow(Math.sin(Math.PI * u), 0.45) - notch), th)));
        }
        const inner = [];
        for (let i = 12; i >= 0; i--) inner.push(squash(polar(c, rIn, a - span / 2 + (span * i) / 12)));
        dr.piece(poly(outer.concat(inner), true), { wash: C.rose, pivot: squash(polar(c, rIn, a)), kind: 'petal', fold: k % 2 ? 1 : -1 });
        if (lip) {
          const lipPts = [];
          for (let i = 0; i <= 20; i++) {
            const u = 0.18 + (0.64 * i) / 20, th = a - span / 2 + span * u;
            lipPts.push(squash(polar(c, rIn + (rOut - rIn) * Math.pow(Math.sin(Math.PI * u), 0.45) * 0.84, th)));
          }
          dr.detail(poly(lipPts), 0.6);
        }
      }
    };
    ring(5, 100, 45, 165, -90 + 36, true);
    ring(5, 92, 35, 128, -90, true);
    ring(4, 118, 25, 92, -45, true);
    ring(3, 150, 15, 60, 10, false);
    dr.piece(circ(c, 40, 34), { wash: C.rose, pivot: c, kind: 'pop' });
    const sp = [];
    for (let i = 0; i <= 90; i++) { const u = i / 90; sp.push(squash(polar(c, 36 * (1 - u) + 3, -60 + u * 720))); }
    dr.detail(poly(sp), 0.9);
    return { dr, latin: 'Rosa centifolia', common: 'Mawar · Rose', pl: 'PL. I', head: c, fallColour: C.rose };
  }

  function tulip() {
    const dr = new Drawing();
    const leafVeins = (b, t, bend) => {
      const L = Math.hypot(t.x - b.x, t.y - b.y), d = norm(V(t.x - b.x, t.y - b.y)), n = V(-d.y, d.x);
      for (const o of [-9, 9]) {
        const m = V((b.x + t.x) / 2 + n.x * (bend * L + o), (b.y + t.y) / 2 + n.y * (bend * L + o));
        dr.detail('M' + f(b.x + n.x * o * 0.3) + ' ' + f(b.y) + ' Q' + f(m.x) + ' ' + f(m.y) + ' ' + f(t.x) + ' ' + f(t.y), 0.5);
      }
    };
    stem(dr, [V(450, 455), V(446, 620), V(462, 780), V(452, 930)], 8, 7, C.stem);
    leaf(dr, { base: V(452, 925), tip: V(262, 560), width: 0.16, widest: 0.35, bend: -0.12, veins: 0, wash: C.sage });
    leafVeins(V(452, 905), V(290, 600), -0.12);
    leaf(dr, { base: V(456, 890), tip: V(650, 610), width: 0.15, widest: 0.33, bend: 0.14, veins: 0, wash: C.sage });
    leafVeins(V(456, 870), V(625, 640), 0.14);
    const cup = (base, tip, wl, wr, veins, fold) => {
      const h = base.y - tip.y;
      const d = 'M' + f(base.x) + ' ' + f(base.y) +
        ' C' + f(base.x - wl) + ' ' + f(base.y - h * 0.15) + ' ' + f(tip.x - wl * 0.55) + ' ' + f(tip.y + h * 0.45) + ' ' + f(tip.x) + ' ' + f(tip.y) +
        ' C' + f(tip.x + wr * 0.55) + ' ' + f(tip.y + h * 0.45) + ' ' + f(base.x + wr) + ' ' + f(base.y - h * 0.15) + ' ' + f(base.x) + ' ' + f(base.y) + ' Z';
      dr.piece(d, { wash: C.coral, pivot: base, kind: 'petal', fold });
      for (let k = 0; k < veins; k++) {
        const x = lerp(-0.45, 0.45, veins === 1 ? 0.5 : k / (veins - 1));
        const a = V(base.x + x * (wl + wr) * 0.25, base.y - h * 0.1);
        const e = V(tip.x + x * (wl + wr) * 0.12, tip.y + h * 0.3);
        const m = V((a.x + e.x) / 2 + x * 30, (a.y + e.y) / 2);
        dr.detail('M' + f(a.x) + ' ' + f(a.y) + ' Q' + f(m.x) + ' ' + f(m.y) + ' ' + f(e.x) + ' ' + f(e.y), 0.55);
      }
    };
    cup(V(450, 462), V(452, 200), 92, 92, 0, 1);
    cup(V(438, 468), V(338, 232), 70, 100, 2, 1);
    cup(V(462, 468), V(566, 228), 100, 72, 2, -1);
    cup(V(450, 474), V(458, 236), 112, 104, 4, 1);
    return { dr, latin: 'Tulipa gesneriana', common: 'Tulip', pl: 'PL. II', head: V(450, 330), fallColour: C.coral };
  }

  function gerbera() {
    const dr = new Drawing();
    const c = V(450, 340);
    stem(dr, [V(450, 380), V(462, 560), V(430, 760), V(447, 935)], 5.5, 5, C.stem);
    leaf(dr, { base: V(446, 930), tip: V(236, 745), width: 0.2, bend: -0.1, lobes: 5, veins: 4, wash: C.sage });
    leaf(dr, { base: V(448, 932), tip: V(660, 780), width: 0.2, bend: 0.1, lobes: 5, veins: 4, wash: C.sage });
    for (let k = 0; k < 22; k++) {
      const p = strapPetal(c, -90 + 360 / 44 + (360 / 22) * k, 50, 205, 15);
      dr.piece(p.d, { wash: C.gerbera, pivot: p.base, kind: 'petal', fold: k % 2 ? 1 : -1 });
    }
    for (let k = 0; k < 22; k++) {
      const p = strapPetal(c, -90 + (360 / 22) * k, 50, 182, 15);
      dr.piece(p.d, { wash: C.gerbera, pivot: p.base, kind: 'petal', fold: k % 2 ? -1 : 1 });
      dr.detail(p.mid, 0.5);
    }
    dr.piece(circ(c, 62), { wash: C.ochre, pivot: c, kind: 'pop' });
    dr.detail(circ(c, 40), 0.8);
    let dots = '';
    for (let i = 0; i < 56; i++) {
      const p = polar(c, 44 + (i % 3) * 6, i * 137.5);
      dots += 'M' + f(p.x - 1.6) + ' ' + f(p.y) + ' a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0 ';
    }
    for (let i = 0; i < 40; i++) {
      const p = polar(c, 5 + 30 * Math.sqrt(i / 40), i * 137.5);
      dots += 'M' + f(p.x - 1.2) + ' ' + f(p.y) + ' a1.2 1.2 0 1 0 2.4 0 a1.2 1.2 0 1 0 -2.4 0 ';
    }
    dr.detail(dots, 0.6);
    return { dr, latin: 'Gerbera jamesonii', common: 'Gerbera', pl: 'PL. III', head: c, fallColour: C.gerbera };
  }

  function lavender() {
    const dr = new Drawing();
    const root = V(450, 930);
    for (const [tx, ty, bend] of [[250, 770, -0.1], [660, 790, 0.1], [300, 680, -0.08], [612, 700, 0.08], [360, 640, -0.05], [560, 650, 0.06]]) {
      leaf(dr, { base: root, tip: V(tx, ty), width: 0.045, widest: 0.3, bend, veins: 0, midrib: false, wash: C.sage });
    }
    const stalks = [
      [V(446, 930), V(430, 700), V(380, 420), V(352, 205)],
      [V(450, 930), V(452, 690), V(455, 400), V(450, 165)],
      [V(454, 930), V(470, 700), V(520, 430), V(552, 215)]
    ];
    const florets = [];
    for (const p of stalks) {
      const st = { spine: sampleSpine((t) => cb(p[0], p[1], p[2], p[3], t), 80) };
      stem(dr, p, 4, 2.6, C.stem, { pivot: p[0] });
      st.ns = normals(st.spine);
      st.at = (t) => st.spine[Math.round(t * 80)];
      st.n = (t) => st.ns[Math.round(t * 80)];
      for (let w = 0; w < 9; w++) {
        const t = 0.6 + w * 0.045, sz = lerp(34, 16, w / 8);
        const b = st.at(t), n = st.n(t), nx = st.at(Math.min(1, t + 0.01));
        const tg = norm(V(nx.x - b.x, nx.y - b.y));
        for (const side of [1, -1, 0]) {
          const dir = side === 0 ? tg : norm(V(n.x * side * 0.85 + tg.x * 0.7, n.y * side * 0.85 + tg.y * 0.7));
          const base = side === 0 ? V(b.x + tg.x * 2, b.y + tg.y * 2) : b;
          florets.push({ base, tip: V(b.x + dir.x * sz, b.y + dir.y * sz), w });
        }
      }
    }
    // Florets are placed bottom-up across all three stalks, like building the spikes.
    florets.sort((a, b) => a.w - b.w).forEach((fl) => {
      leaf(dr, { base: fl.base, tip: fl.tip, width: 0.34, widest: 0.55, veins: 0, midrib: false, wash: C.lavender, kind: 'pop' });
    });
    const knot = V(450, 790);
    dr.piece('M444 795 C 432 830, 418 860, 404 880 L 414 874 L 418 886 C 430 862, 444 832, 452 800 Z', { wash: C.ribbon, pivot: knot, kind: 'leaf', fold: 1 });
    dr.piece('M456 795 C 470 830, 486 856, 502 874 L 504 862 L 514 868 C 496 846, 474 822, 462 798 Z', { wash: C.ribbon, pivot: knot, kind: 'leaf', fold: -1 });
    dr.piece('M' + (knot.x - 16) + ' ' + (knot.y - 7) + ' C 420 760, 380 772, 392 800 C 402 818, 432 802, ' + (knot.x - 6) + ' ' + (knot.y + 2) + ' Z', { wash: C.ribbon, pivot: knot, kind: 'pop' });
    dr.piece('M' + (knot.x + 16) + ' ' + (knot.y - 7) + ' C 480 760, 520 772, 508 800 C 498 818, 468 802, ' + (knot.x + 6) + ' ' + (knot.y + 2) + ' Z', { wash: C.ribbon, pivot: knot, kind: 'pop' });
    dr.piece(circ(knot, 12, 10), { wash: C.ribbon, pivot: knot, kind: 'pop' });
    return { dr, latin: 'Lavandula angustifolia', common: 'Lavender', pl: 'PL. IV', head: V(450, 300), fallColour: C.lavender };
  }

  /**
   * The sunflower in the logo's own coordinate space (alxanthia-logo.png is
   * 2156×3105; these coordinates are that image at 720×1036). Redrawn by hand
   * from the PNG; it resolves into the real artwork at the end.
   */
  const LOGO_W = 720, LOGO_H = 1036;
  function sunflower() {
    const dr = new Drawing();
    const c = V(348, 368);
    stem(dr, [V(380, 470), V(412, 640), V(282, 790), V(348, 1032)], 0, 0, C.stem, {
      pivot: V(348, 1032), wfn: (t) => (t < 0.8 ? 10 : 10 * Math.pow((1 - t) / 0.2, 0.7)) + 0.5
    });
    const logoLeaf = (base, tip, bend, width, asym) => {
      const g = leaf(dr, { base, tip, width, widest: 0.4, bend, asym, veins: 0, midrib: false, wash: C.sage });
      for (const [a, b, side] of [[0.12, 0.8, 0.28], [0.3, 0.9, -0.12]]) {
        const pts = [];
        for (let i = Math.round(a * 140); i <= Math.round(b * 140); i++) {
          const w = g.wfn(i / 140) * side;
          pts.push(V(g.spine[i].x + g.ns[i].x * w, g.spine[i].y + g.ns[i].y * w));
        }
        dr.detail(poly(pts), 0.75);
      }
    };
    logoLeaf(V(336, 752), V(6, 776), 0.12, 0.16, 0.55);
    logoLeaf(V(388, 690), V(716, 584), -0.1, 0.15, -0.55);
    logoLeaf(V(352, 905), V(526, 742), -0.08, 0.2, -0.45);
    for (let k = 0; k < 12; k++) {
      const p = petal(c, -90 + 30 * k, 100, 306, 50, { veins: [1, -1], tipW: 0.5, belly: 1.3, baseW: 0.4 });
      dr.piece(p.d, { wash: C.sunPetal, pivot: p.base, kind: 'petal', fold: k % 2 ? 1 : -1 });
      p.veins.forEach((v) => dr.detail(v, 0.7));
    }
    for (let k = 0; k < 12; k++) {
      const p = petal(c, -75 + 30 * k, 100, 248, 50, { veins: [1, 0, -1], tipW: 0.5, belly: 1.3, baseW: 0.4 });
      dr.piece(p.d, { wash: C.sunPetal, pivot: p.base, kind: 'petal', fold: k % 2 ? -1 : 1 });
      p.veins.forEach((v) => dr.detail(v, 0.7));
    }
    dr.piece(circ(c, 118), { wash: C.sunDisk, pivot: c, kind: 'pop' });
    dr.detail(circ(c, 100), 0.9);
    const arc = (r, a0, a1) => { const p0 = polar(c, r, a0), p1 = polar(c, r, a1); return 'M' + f(p0.x) + ' ' + f(p0.y) + ' A' + r + ' ' + r + ' 0 0 1 ' + f(p1.x) + ' ' + f(p1.y); };
    dr.detail(arc(76, 190, 262), 1);
    dr.detail(arc(56, 200, 250), 1);
    dr.detail(arc(74, 15, 75), 1);
    return { dr, latin: 'Helianthus annuus', common: 'Bunga Matahari · Sunflower', pl: 'PL. V', centre: c };
  }

  // Sparkles and dots, measured from alxanthia-logo.png (centre, radius; logo units).
  const SPARKLES = [
    [245.8, 48.1, 50], [46.3, 466.0, 50], [600.6, 166.6, 42], [100.9, 541.7, 31], [634.7, 273.5, 26], [591.8, 541.0, 24],
    [174.5, 116.5, 11], [537.3, 117.9, 11], [61.6, 232.9, 12], [620.5, 479.9, 12], [169.3, 600.8, 12]
  ];
  const LOGO_MARK = 'assets/logo-mark.webp', LOGO_SPARKLES = 'assets/logo-sparkles.webp';

  // Butterfly flight paths (plate coords): [time, x, y, heading°, landed?].
  const FLIGHTS = [
    [[3.45, 1150, 120, -70], [3.85, 800, 250, -80], [4.25, 650, 140, -45], [4.6, 560, 220, -20], [4.85, 530, 268, 12, 1],
      [5.5, 530, 268, 12, 1], [5.8, 650, 120, 40], [6.3, 1180, -440, 50]],
    [[17.7, -170, 260, 70], [18.05, 120, 160, 85], [18.4, 330, 80, 110], [18.65, 520, 240, 160], [18.85, 556, 392, 170, 1],
      [19.65, 556, 392, 170, 1], [19.95, 740, 190, 40], [20.3, 1180, -300, 45]]
  ];

  /* ------------------------------------------------------------- build */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function defs(svg) {
    const d = el('defs', {}, svg);
    d.innerHTML = `
      <filter id="rough" x="-3%" y="-3%" width="106%" height="106%">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7"/>
        <feDisplacementMap in="SourceGraphic" scale="3" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="pshadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>
      <filter id="sheetShadow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>
      <filter id="stampTex" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75" result="holes"/>
        <feComposite in="SourceGraphic" in2="holes" operator="in"/>
      </filter>
      <filter id="flyShadow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow id="flyShadowOp" dx="8" dy="20" stdDeviation="4" flood-color="${C.shadow}" flood-opacity="0.22"/>
      </filter>
      <filter id="sparkShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="3" dy="5" stdDeviation="2.4" flood-color="${C.shadow}" flood-opacity="0.28"/>
      </filter>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5"/>
        <feColorMatrix values="0 0 0 0 0.36  0 0 0 0 0.28  0 0 0 0 0.19  0.9 0 0 0 -0.32"/>
      </filter>
      <filter id="stains" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.0035" numOctaves="4" seed="11"/>
        <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.40  0 0 0 0 0.22  1.6 0 0 0 -0.78"/>
        <feGaussianBlur stdDeviation="2"/>
      </filter>
      <radialGradient id="vignette" cx="50%" cy="46%" r="75%">
        <stop offset="0.55" stop-color="#7a5a32" stop-opacity="0"/>
        <stop offset="1" stop-color="#7a5a32" stop-opacity="0.34"/>
      </radialGradient>
      <linearGradient id="shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="520" y2="260">
        <stop offset="0" stop-color="${C.goldHi}" stop-opacity="0"/>
        <stop offset="0.5" stop-color="${C.goldHi}" stop-opacity="1"/>
        <stop offset="1" stop-color="${C.goldHi}" stop-opacity="0"/>
      </linearGradient>
    `;
    return d;
  }

  // Hand-tinted paper: pale in the middle, pigment pooling toward the cut edge.
  function paperGradient(defsEl, colour) {
    const id = 'pg' + colour.slice(1);
    if (!defsEl.querySelector('#' + id)) {
      const g = el('radialGradient', { id, cx: '45%', cy: '40%', r: '70%' }, defsEl);
      el('stop', { offset: '0', 'stop-color': mix(C.plate, colour, 0.38) }, g);
      el('stop', { offset: '0.7', 'stop-color': mix(C.plate, colour, 0.56) }, g);
      el('stop', { offset: '1', 'stop-color': mix(C.plate, colour, 0.78) }, g);
    }
    return 'url(#' + id + ')';
  }

  // One cut-paper piece: shadow, tinted paper with white cut margin, ink print.
  function addPiece(parent, defsEl, pc, lw, margin) {
    const g = el('g', { display: 'none' }, parent);
    const r = { pc, g };
    if (pc.outline) {
      r.shadow = el('path', { d: pc.outline, fill: C.shadow, stroke: C.shadow, 'stroke-width': margin, 'stroke-linejoin': 'round', opacity: 0.26, filter: 'url(#pshadow)' }, g);
      r.base = el('path', { d: pc.outline, fill: pc.wash ? paperGradient(defsEl, pc.wash) : C.edge, stroke: C.edge, 'stroke-width': margin, 'stroke-linejoin': 'round' }, g);
    }
    r.lines = el('g', { stroke: C.ink, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    if (pc.outline) el('path', { d: pc.outline, 'stroke-width': lw }, r.lines);
    pc.details.forEach((dt) => el('path', { d: dt.d, 'stroke-width': (lw * dt.sw).toFixed(2) }, r.lines));
    return r;
  }

  // Entrance style per kind: start scale, start rotation (× fold), idle sway.
  const ANIM = {
    stem: { s: 0.1, r: -5, sway: 0.5 },
    leaf: { s: 0.3, r: 42, sway: 2.2 },
    petal: { s: 0, r: 18, sway: 1.3 },
    pop: { s: 0, r: 0, sway: 3 }
  };
  const ENTRY = 0.5; // seconds a piece takes to land

  // Spread piece landing times across the assembly window, in placement order.
  function schedule(pieces, a, b, salt) {
    const n = pieces.length;
    pieces.forEach((pc, i) => {
      pc.t0 = a + (b - a - ENTRY) * (n > 1 ? i / (n - 1) : 0) + hash(salt, i) * 0.06;
      pc.phase = hash(salt + 1, i) * Math.PI * 2;
      pc.freq = 0.45 + hash(salt + 2, i) * 0.5;
      pc.id = salt * 1000 + i;
    });
  }

  function placePiece(r, u, step, extra) {
    const pc = r.pc;
    if (u < pc.t0) { r.g.setAttribute('display', 'none'); return; }
    r.g.setAttribute('display', 'inline');
    const A = ANIM[pc.kind];
    const p = clamp01((u - pc.t0) / ENTRY);
    const settled = easeOut(p);
    const s = lerp(A.s, 1, easeOutBack(p));
    const sway = A.sway * Math.sin(2 * Math.PI * pc.freq * u + pc.phase) * settled * (extra ? extra.swayAmt : 1);
    const rot = A.r * pc.fold * (1 - settled) + sway;
    const lift = 1 - settled;
    const jx = jit(step, pc.id * 2, 0.6), jy = jit(step, pc.id * 2 + 1, 0.6);
    const flipX = extra && extra.flipX != null ? extra.flipX : 1;
    r.g.setAttribute('transform',
      'translate(' + f(pc.pivot.x + jx) + ' ' + f(pc.pivot.y + jy - 14 * lift) + ') rotate(' + rot.toFixed(2) + ') scale(' + (s * flipX).toFixed(4) + ' ' + s.toFixed(4) + ') translate(' + f(-pc.pivot.x) + ' ' + f(-pc.pivot.y) + ')');
    if (r.shadow) {
      const k = extra && extra.shadowK != null ? extra.shadowK : 1;
      r.shadow.setAttribute('transform', 'translate(' + f(3 + 12 * lift) + ' ' + f(5 + 16 * lift) + ')');
      r.shadow.setAttribute('opacity', ((0.26 - 0.08 * lift) * k).toFixed(3));
    }
  }

  function text(parent, str, x, y, style) {
    // SVG counts trailing letter-spacing when centring; shift by half to compensate.
    const ls = parseFloat(style['letter-spacing'] || 0);
    const t = el('text', Object.assign({ x: x + ls / 2, y, 'text-anchor': 'middle' }, style), parent);
    t.textContent = str;
    return t;
  }

  const serif = { 'font-family': 'Cormorant Garamond, Georgia, serif', fill: C.ink };

  // A sheet: shadow, paper, plate border, footer, stamp sticker, name tag, pieces.
  function buildSheet(parent, defsEl, spec, idx) {
    const sh = { idx };
    sh.g = el('g', {}, parent);
    sh.shadow = el('rect', { x: 0, y: 0, width: PW, height: PH, fill: C.shadow, opacity: 0.3, filter: 'url(#sheetShadow)' }, sh.g);
    el('rect', { x: 0, y: 0, width: PW, height: PH, fill: C.plate }, sh.g);
    const rule = el('g', { stroke: C.ink, fill: 'none', opacity: 0.72 }, sh.g);
    el('rect', { x: 30, y: 30, width: PW - 60, height: PH - 60, 'stroke-width': 1.8 }, rule);
    el('rect', { x: 39, y: 39, width: PW - 78, height: PH - 78, 'stroke-width': 0.8 }, rule);
    for (const [x, y] of [[30, 30], [PW - 30, 30], [30, PH - 30], [PW - 30, PH - 30]]) {
      el('path', { d: 'M' + x + ' ' + (y - 9) + ' L' + (x + 9) + ' ' + y + ' L' + x + ' ' + (y + 9) + ' L' + (x - 9) + ' ' + y + ' Z', fill: C.plate, 'stroke-width': 1.2 }, rule);
    }
    text(sh.g, 'HERBARIUM  ·  ALXANTHIA  STUDIO', PW / 2, PH - 58, Object.assign({}, serif, { 'font-size': 17, 'letter-spacing': '4', opacity: 0.62, 'font-weight': 500 }));
    sh.content = el('g', { filter: 'url(#rough)' }, sh.g);
    if (spec.dr) {
      sh.pieces = spec.dr.pieces.map((pc) => addPiece(sh.content, defsEl, pc, 2.5, 7));
    }
    // "PL." stamp on a small paper sticker.
    sh.stamp = el('g', { display: 'none' }, sh.g);
    el('ellipse', { cx: 3, cy: 5, rx: 84, ry: 42, fill: C.shadow, opacity: 0.22, filter: 'url(#pshadow)' }, sh.stamp);
    el('ellipse', { cx: 0, cy: 0, rx: 84, ry: 42, fill: C.edge, stroke: '#d9cbb0', 'stroke-width': 1 }, sh.stamp);
    const ink = el('g', { filter: 'url(#stampTex)', opacity: 0.9 }, sh.stamp);
    el('ellipse', { cx: 0, cy: 0, rx: 70, ry: 31, fill: 'none', stroke: C.stamp, 'stroke-width': 2.6 }, ink);
    el('ellipse', { cx: 0, cy: 0, rx: 63, ry: 25, fill: 'none', stroke: C.stamp, 'stroke-width': 1 }, ink);
    text(ink, spec.pl, 0, 10, Object.assign({}, serif, { fill: C.stamp, 'font-size': 29, 'letter-spacing': '5', 'font-weight': 700 }));
    // Name tag: a torn paper strip that flips over.
    sh.tag = el('g', { display: 'none' }, sh.g);
    const strip = tornStrip(560, 104, idx * 13 + 3);
    sh.tagShadow = el('path', { d: strip, fill: C.shadow, opacity: 0.24, filter: 'url(#pshadow)' }, sh.tag);
    sh.tagPaper = el('path', { d: strip, fill: C.edge, stroke: '#d9cbb0', 'stroke-width': 1 }, sh.tag);
    sh.tagText = el('g', {}, sh.tag);
    text(sh.tagText, spec.latin, 0, -4, Object.assign({}, serif, { 'font-size': 44, 'font-style': 'italic' }));
    text(sh.tagText, spec.common.toUpperCase(), 0, 34, Object.assign({}, serif, { 'font-size': 20, 'letter-spacing': '5', fill: C.ochre, 'font-weight': 600 }));
    return sh;
  }

  function build(svg, ratio) {
    const L = LAYOUT[ratio];
    const H = L.h;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.innerHTML = '';
    const defsEl = defs(svg);
    const S = { svg, ratio, H };

    el('rect', { width: W, height: H, fill: C.backing }, svg);
    S.world = el('g', { transform: 'translate(90 ' + L.plateY + ')' }, svg);

    // Sheets are stacked with PL. I on top: build bottom-up (sun first).
    const specs = [rose(), tulip(), gerbera(), lavender()];
    specs.forEach((sp, i) => schedule(sp.dr.pieces, TL.plateStarts[i] + TL.plate.assemble[0], TL.plateStarts[i] + TL.plate.assemble[1], i + 1));
    const sun = sunflower();
    schedule(sun.dr.pieces, TL.sun.start + TL.sun.assemble[0], TL.sun.start + TL.sun.assemble[1], 9);

    // PL. V: the sun sheet also carries the logo lock-up.
    const sunSheet = buildSheet(S.world, defsEl, { pl: sun.pl, latin: sun.latin, common: sun.common }, 4);
    S.sunT = el('g', {}, sunSheet.content);
    sunSheet.content.removeAttribute('filter');
    S.sketch = el('g', { filter: 'url(#rough)' }, S.sunT);
    sunSheet.pieces = sun.dr.pieces.map((pc) => addPiece(S.sketch, defsEl, pc, 4.6, 10));
    S.real = el('g', { opacity: 0 }, S.sunT);
    el('image', { href: LOGO_MARK, width: LOGO_W, height: LOGO_H }, S.real);
    const lm = el('mask', { id: 'logoAlpha', style: 'mask-type:alpha', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: LOGO_W, height: LOGO_H }, defsEl);
    el('image', { href: LOGO_MARK, width: LOGO_W, height: LOGO_H }, lm);
    S.shine = defsEl.querySelector('#shine');
    S.shineRect = el('rect', { x: 0, y: 0, width: LOGO_W, height: LOGO_H, fill: 'url(#shine)', mask: 'url(#logoAlpha)', opacity: 0 }, S.real);
    const sparkLayer = el('g', { filter: 'url(#sparkShadow)' }, S.sunT);
    S.sparks = SPARKLES.map(([x, y, r], i) => {
      const cp = el('clipPath', { id: 'spk' + i }, defsEl);
      el('circle', { cx: 0, cy: 0, r }, cp);
      const g = el('g', { display: 'none' }, sparkLayer);
      const inner = el('g', { 'clip-path': 'url(#spk' + i + ')' }, g);
      el('image', { href: LOGO_SPARKLES, x: -x, y: -y, width: LOGO_W, height: LOGO_H }, inner);
      return { g, x, y };
    });
    S.lockup = buildLockup(sunSheet.g, defsEl);

    const sheets = [sunSheet];
    for (let i = 3; i >= 0; i--) sheets.unshift(buildSheet(S.world, defsEl, specs[i], i));
    S.sheets = sheets; // plate order: I, II, III, IV, V
    // Stacking order: sun at the bottom, PL. I on top.
    [4, 3, 2, 1, 0].forEach((i) => S.world.appendChild(S.sheets[i].g));

    // Loose pieces that tumble when a sheet is pulled away.
    S.fx = el('g', {}, S.world);
    S.falls = [];
    TL.falls.forEach(([pi, t0], k) => {
      const sp = specs[pi];
      const n = pi === 3 ? 5 : 3;
      for (let j = 0; j < n; j++) {
        let d;
        if (pi === 3) d = 'M0 -14 C 9 -10 9 8 0 16 C -9 8 -9 -10 0 -14 Z';
        else if (pi === 2) d = strapPetal(V(0, 0), -90, -60, 60, 13).d;
        else d = 'M0 -24 C 26 -24 32 12 0 28 C -32 12 -26 -24 0 -24 Z';
        const pc = { outline: d, wash: sp.fallColour, details: [], pivot: V(0, 0), kind: 'pop', fold: 1 };
        const r = addPiece(S.fx, defsEl, pc, 2.2, 6);
        r.fall = {
          t0: t0 + j * 0.13, x0: sp.head.x + (hash(k * 10 + j, 1) - 0.5) * 220, y0: sp.head.y + (hash(k * 10 + j, 2) - 0.5) * 120,
          drift: (hash(k * 10 + j, 3) - 0.5) * 300, spin: (hash(k * 10 + j, 4) - 0.5) * 900, ph: hash(k * 10 + j, 5) * 6
        };
        S.falls.push(r);
      }
    });

    // Paper butterfly.
    S.fly = el('g', { display: 'none', filter: 'url(#flyShadow)' }, S.world);
    S.flyShadowOp = defsEl.querySelector('#flyShadowOp');
    const wing = (parent) => {
      const g = el('g', {}, parent);
      const up = 'M0 -4 C -20 -44 -64 -58 -70 -28 C -72 -6 -36 4 0 2 Z';
      const lo = 'M0 2 C -30 6 -52 26 -42 46 C -32 60 -10 38 0 12 Z';
      for (const d of [lo, up]) {
        el('path', { d, fill: paperGradient(defsEl, C.ochre), stroke: C.edge, 'stroke-width': 6, 'stroke-linejoin': 'round' }, g);
        el('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': 2 }, g);
      }
      el('path', { d: circ(V(-46, -26), 10), fill: paperGradient(defsEl, C.rose), stroke: C.ink, 'stroke-width': 1.4 }, g);
      el('path', { d: circ(V(-28, 30), 7), fill: paperGradient(defsEl, C.rose), stroke: C.ink, 'stroke-width': 1.2 }, g);
      el('path', { d: 'M-4 -2 Q -30 -20 -58 -30 M-4 4 Q -26 16 -36 36', fill: 'none', stroke: C.ink, 'stroke-width': 0.9 }, g);
      return g;
    };
    S.wingL = wing(S.fly);
    S.wingR = wing(S.fly);
    el('path', { d: circ(V(0, 4), 5, 26), fill: C.ink, stroke: C.edge, 'stroke-width': 3 }, S.fly);
    el('path', { d: 'M-2 -20 Q -10 -40 -18 -46 M2 -20 Q 10 -40 18 -46', fill: 'none', stroke: C.ink, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, S.fly);

    // Surface: vignette, stains, grain, and a faint lamp flicker.
    el('rect', { width: W, height: H, fill: 'url(#vignette)', style: 'mix-blend-mode:multiply' }, svg);
    el('rect', { width: W, height: H, filter: 'url(#stains)', opacity: 0.16, style: 'mix-blend-mode:multiply' }, svg);
    el('rect', { width: W, height: H, filter: 'url(#grain)', opacity: 0.5, style: 'mix-blend-mode:multiply' }, svg);
    S.flicker = el('rect', { width: W, height: H, fill: '#fff4dc', opacity: 0 }, svg);

    Object.assign(S, { sun, sunSheet });
    return S;
  }

  // Lock-up: cut-out wordmark letters + paper strips. Needs fonts loaded (measures glyphs).
  function buildLockup(parent, defsEl) {
    const K = { letters: [] };
    const g = el('g', {}, parent);
    const word = 'ALXANTHIA', size = 92, ls = 18, baseY = 744;
    const probe = el('text', Object.assign({ x: 0, y: baseY, 'font-size': size, 'font-weight': 500, 'letter-spacing': ls }, serif), g);
    probe.textContent = word;
    const total = probe.getComputedTextLength() - ls;
    const xs = [];
    for (let i = 0; i < word.length; i++) xs.push(probe.getStartPositionOfChar(i).x);
    probe.remove();
    const x0 = PW / 2 - total / 2;
    for (let i = 0; i < word.length; i++) {
      const lg = el('g', { display: 'none' }, g);
      const st = { x: x0 + xs[i], y: baseY, 'font-size': size, 'font-weight': 500, 'font-family': serif['font-family'] };
      const sh = el('text', Object.assign({ fill: C.shadow, opacity: 0.28, filter: 'url(#pshadow)', stroke: C.shadow, 'stroke-width': 8, 'stroke-linejoin': 'round' }, st), lg);
      sh.textContent = word[i];
      const tx = el('text', Object.assign({ fill: C.gold, stroke: C.edge, 'stroke-width': 8, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }, st), lg);
      tx.textContent = word[i];
      K.letters.push({ g: lg, sh, cx: x0 + xs[i] + 30, cy: baseY - 30, rest: (hash(77, i) - 0.5) * 5, from: (hash(78, i) - 0.5) * 40 });
    }
    const strip = (cx, cy, w, h, fill, rest, seed, build) => {
      const sg = el('g', { display: 'none' }, g);
      const d = tornStrip(w, h, seed);
      const sh = el('path', { d, fill: C.shadow, opacity: 0.26, filter: 'url(#pshadow)' }, sg);
      el('path', { d, fill, stroke: fill === C.edge ? '#d9cbb0' : 'none', 'stroke-width': 1 }, sg);
      build(sg);
      return { g: sg, sh, cx, cy, rest };
    };
    K.tagline = strip(PW / 2, 836, 580, 104, C.edge, -1.4, 31, (sg) => {
      text(sg, 'Bunga yang tak pernah layu', 0, -6, Object.assign({}, serif, { 'font-size': 40, 'font-style': 'italic' }));
      text(sg, 'Flowers that never wilt', 0, 32, Object.assign({}, serif, { 'font-size': 29, 'font-style': 'italic', fill: C.muted }));
    });
    K.comingSoon = strip(PW / 2, 962, 740, 64, C.ink, 1.1, 41, (sg) => {
      text(sg, 'SEGERA HADIR  ·  COMING SOON', 0, 11, Object.assign({}, serif, { 'font-size': 31, 'letter-spacing': '6', 'font-weight': 600, fill: C.plate }));
    });
    K.handle = strip(PW / 2, 1040, 250, 50, C.edge, -2, 51, (sg) => {
      text(sg, '@alxanthia', 0, 9, Object.assign({}, serif, { 'font-size': 27, 'letter-spacing': '2', fill: C.ochre, 'font-weight': 600 }));
    });
    return K;
  }

  /* ------------------------------------------------------------ render */
  const SUN_PLATE = { s: 0.72, x: PW / 2 - (LOGO_W / 2) * 0.72, y: 160 };
  const SUN_LOGO = { s: 0.5, x: PW / 2 - (LOGO_W / 2) * 0.5, y: 88 };

  // A hopping paper element: lands at t0 with a bounce and settles at `rest`°.
  function hop(g, sh, t, t0, cx, cy, rest, from, step, id, pivot) {
    if (t < t0) { g.setAttribute('display', 'none'); return; }
    g.setAttribute('display', 'inline');
    const p = clamp01((t - t0) / 0.45);
    const lift = 1 - easeOut(p);
    const rot = rest + (from || 14) * lift + jit(step, id, 0.25);
    const s = lerp(1.25, 1, easeOutBack(p));
    const px = pivot ? pivot.x : 0, py = pivot ? pivot.y : 0;
    g.setAttribute('transform', 'translate(' + f(cx + px + jit(step, id + 1, 0.6)) + ' ' + f(cy + py - 60 * lift + jit(step, id + 2, 0.6)) + ') rotate(' + rot.toFixed(2) + ') scale(' + s.toFixed(3) + ') translate(' + f(-px) + ' ' + f(-py) + ')');
    if (sh) sh.setAttribute('transform', 'translate(' + f(3 + 14 * lift) + ' ' + f(5 + 20 * lift) + ')');
  }

  // Sheet pose: at rest (with stop-motion nudge), lifting off, or sliding back in.
  function sheetPose(sh, t, step) {
    let x = 0, y = 0, rot = 0, lift = 0, visible = true;
    const i = sh.idx;
    if (i < 4) {
      const s0 = TL.plateStarts[i], ex0 = s0 + TL.plate.exit[0], ex1 = s0 + TL.plate.exit[1];
      const prevExit = i === 0 ? -Infinity : TL.plateStarts[i - 1] + TL.plate.exit[0];
      if (i === 0 && t >= TL.cover[0]) {
        const e = easeOut(prog(t, TL.cover[0], TL.cover[1]));
        x = 1300 * (1 - e); y = -110 * (1 - e); rot = 10 * (1 - e); lift = 1 - e;
      } else if (t > ex1 || t < prevExit) {
        visible = i === 0 && t < ex1;
      } else if (t >= ex0) {
        const q = t - ex0;
        lift = clamp01(q / 0.15);
        const sl = easeIn(prog(t, ex0 + 0.12, ex1));
        x = -1300 * sl; y = -8 * lift - 150 * sl; rot = -0.8 * lift - 11 * sl;
      }
    } else {
      // Hidden again once the blank sheet has fully covered it, so the loop seam matches frame 0.
      visible = t >= TL.plateStarts[3] + TL.plate.exit[0] && t < TL.cover[1];
    }
    sh.g.setAttribute('display', visible ? 'inline' : 'none');
    if (!visible) return false;
    x += jit(step, 900 + i * 3, 0.8); y += jit(step, 901 + i * 3, 0.8); rot += jit(step, 902 + i * 3, 0.08);
    sh.g.setAttribute('transform', 'translate(' + f(PW / 2 + x) + ' ' + f(PH / 2 + y) + ') rotate(' + rot.toFixed(3) + ') scale(' + (1 + 0.015 * lift).toFixed(4) + ') translate(' + -PW / 2 + ' ' + -PH / 2 + ')');
    sh.shadow.setAttribute('transform', 'translate(' + f(6 + 22 * lift) + ' ' + f(10 + 30 * lift) + ')');
    sh.shadow.setAttribute('opacity', (0.3 - 0.08 * lift).toFixed(3));
    return true;
  }

  // Stamp sticker thumps down; name tag flips over; both can be lifted away.
  function labels(sh, t, s0, stampT, tagT, gone, step) {
    const st = s0 + stampT;
    if (t < st || t > gone + 0.45) sh.stamp.setAttribute('display', 'none');
    else {
      sh.stamp.setAttribute('display', 'inline');
      const q = t - st, away = isFinite(gone) ? easeIn(prog(t, gone, gone + 0.45)) : 0;
      const s = q < 0.09 ? 1.35 : q < 0.17 ? 0.96 : 1;
      sh.stamp.setAttribute('transform', 'translate(' + f(PW / 2 + jit(step, 71, 0.5) + 60 * away) + ' ' + f(104 + jit(step, 72, 0.5) - 260 * away) + ') rotate(' + (-4 + 20 * away).toFixed(2) + ') scale(' + s + ')');
    }
    const tt = s0 + tagT;
    if (t < tt || t > gone + 0.45) sh.tag.setAttribute('display', 'none');
    else {
      sh.tag.setAttribute('display', 'inline');
      const q = prog(t, tt, tt + 0.45), away = isFinite(gone) ? easeIn(prog(t, gone, gone + 0.45)) : 0;
      const flip = -Math.cos(Math.PI * q); // -1 (blank back) → 1 (printed front)
      sh.tagText.setAttribute('display', flip > 0 ? 'inline' : 'none');
      sh.tagPaper.setAttribute('fill', flip > 0 ? C.edge : '#efe6d4');
      const lift = 1 - easeOut(q);
      sh.tag.setAttribute('transform', 'translate(' + f(PW / 2 + jit(step, 73, 0.5) - 40 * away) + ' ' + f(1046 - 40 * lift + jit(step, 74, 0.5) + 500 * away) + ') rotate(' + (-1.2 - 14 * away).toFixed(2) + ') scale(1 ' + Math.max(0.04, Math.abs(flip)).toFixed(3) + ')');
      sh.tagShadow.setAttribute('transform', 'translate(' + f(3 + 12 * lift) + ' ' + f(5 + 16 * lift) + ')');
    }
  }

  function flightAt(path, t) {
    if (t < path[0][0] || t > path[path.length - 1][0]) return null;
    let i = 0;
    while (i < path.length - 2 && t > path[i + 1][0]) i++;
    const a = path[i], b = path[i + 1];
    const u = (t - a[0]) / (b[0] - a[0]);
    const p0 = path[Math.max(0, i - 1)], p3 = path[Math.min(path.length - 1, i + 2)];
    const cr = (k) => {
      const v0 = p0[k], v1 = a[k], v2 = b[k], v3 = p3[k];
      return 0.5 * (2 * v1 + (-v0 + v2) * u + (2 * v0 - 5 * v1 + 4 * v2 - v3) * u * u + (-v0 + 3 * v1 - 3 * v2 + v3) * u * u * u);
    };
    const landed = a[4] && b[4];
    return { x: landed ? a[1] : cr(1), y: landed ? a[2] : cr(2), h: lerp(a[3], b[3], u), landed };
  }

  function renderAt(S, tIn) {
    const D = TL.duration;
    let t = ((tIn % D) + D) % D;
    const step = Math.floor(t * TL.stepFps + 1e-6);
    t = step / TL.stepFps;

    // Sheets I–IV.
    for (let i = 0; i < 4; i++) {
      const sh = S.sheets[i];
      if (!sheetPose(sh, t, step)) continue;
      const s0 = TL.plateStarts[i];
      // Sheet I sliding back in at the end is blank: treat its time as before the loop.
      const tt = i === 0 && t >= TL.cover[0] ? t - D : t;
      sh.pieces.forEach((r) => placePiece(r, tt, step));
      labels(sh, tt, s0, TL.plate.stamp, TL.plate.tag, Infinity, step);
    }

    // PL. V: the sunflower, then the logo.
    const sun = S.sunSheet, s = TL.sun, u = t - s.start;
    if (sheetPose(sun, t, step)) {
      labels(sun, t, s.start, TL.plate.stamp, s.tag, s.start + s.unlabel[0], step);
      const flipStart = s.start + s.flip[0], flipLen = s.flip[1] - s.flip[0];
      const press = easeInOut(prog(u, s.press[0], s.press[1]));
      const c = S.sun.centre;
      sun.pieces.forEach((r) => {
        // Flip wave from the disc outward: each piece turns over to its gold side.
        const pv = r.pc.pivot, dist = Math.min(1, Math.hypot(pv.x - c.x, pv.y - c.y) / 700);
        const fq = prog(t, flipStart + dist * flipLen * 0.6, flipStart + dist * flipLen * 0.6 + flipLen * 0.4);
        const gold = fq > 0.5;
        if (r.base) r.base.setAttribute('fill', gold ? C.plate : (r.pc.wash ? 'url(#pg' + r.pc.wash.slice(1) + ')' : C.edge));
        r.lines.setAttribute('stroke', gold ? C.gold : C.ink);
        placePiece(r, t, step, { flipX: Math.cos(Math.PI * fq) * (gold ? -1 : 1), shadowK: 1 - press, swayAmt: 1 - press });
      });
      const mv = easeInOut(prog(u, s.move[0], s.move[1]));
      const sc = lerp(SUN_PLATE.s, SUN_LOGO.s, mv);
      S.sunT.setAttribute('transform', 'translate(' + f(lerp(SUN_PLATE.x, SUN_LOGO.x, mv)) + ' ' + f(lerp(SUN_PLATE.y, SUN_LOGO.y, mv)) + ') scale(' + sc.toFixed(4) + ')');
      const x = easeInOut(prog(u, s.crossfade[0], s.crossfade[1]));
      S.sketch.setAttribute('opacity', (1 - x).toFixed(3));
      S.sketch.setAttribute('display', x >= 1 ? 'none' : 'inline');
      S.real.setAttribute('opacity', x.toFixed(3));
      const sh = prog(t, TL.shimmer[0], TL.shimmer[1]);
      const pos = lerp(-400, 1120, easeInOut(sh));
      S.shine.setAttribute('x1', f(pos - 260));
      S.shine.setAttribute('x2', f(pos + 260));
      S.shineRect.setAttribute('opacity', (0.9 * Math.sin(Math.PI * sh)).toFixed(3));
      S.sparks.forEach((sp, i) => {
        const a = TL.sparkles[0] + i * 0.07;
        if (t < a) { sp.g.setAttribute('display', 'none'); return; }
        sp.g.setAttribute('display', 'inline');
        const k = easeOutBack(prog(t, a, a + 0.4));
        const twinkle = 1 + 0.16 * Math.sin((t - a) * 4.2 + i * 1.7) * prog(t, a + 0.4, a + 0.9);
        sp.g.setAttribute('transform', 'translate(' + sp.x + ' ' + sp.y + ') rotate(' + (8 * Math.sin((t - a) * 2 + i)).toFixed(2) + ') scale(' + Math.max(0, k * twinkle).toFixed(4) + ')');
      });
      const K = S.lockup, lk = TL.lockup;
      // Cut-out letters, each hopping in and pivoting about its own centre.
      K.letters.forEach((L, i) => hop(L.g, L.sh, t, lk.letters[0] + i * 0.09, 0, 0, L.rest, L.from, step, 510 + i * 3, V(L.cx, L.cy)));
      hop(K.tagline.g, K.tagline.sh, t, lk.tagline, K.tagline.cx, K.tagline.cy, K.tagline.rest, -16, step, 600);
      hop(K.comingSoon.g, K.comingSoon.sh, t, lk.comingSoon, K.comingSoon.cx, K.comingSoon.cy, K.comingSoon.rest, 18, step, 610);
      hop(K.handle.g, K.handle.sh, t, lk.handle, K.handle.cx, K.handle.cy, K.handle.rest, -20, step, 620);
    }

    // Tumbling loose pieces.
    S.falls.forEach((r) => {
      const F = r.fall, q = (t - F.t0) / 1.9;
      if (q < 0 || q > 1) { r.g.setAttribute('display', 'none'); return; }
      r.g.setAttribute('display', 'inline');
      const x = F.x0 + F.drift * q + 40 * Math.sin(q * 7 + F.ph), y = F.y0 + 1200 * Math.pow(q, 1.5);
      const tilt = Math.cos(q * 9 + F.ph);
      r.g.setAttribute('transform', 'translate(' + f(x) + ' ' + f(y) + ') rotate(' + (F.spin * q).toFixed(1) + ') scale(' + Math.max(0.15, Math.abs(tilt)).toFixed(3) + ' 1)');
      r.shadow.setAttribute('transform', 'translate(10 16)');
    });

    // Butterfly.
    let fly = null;
    for (const path of FLIGHTS) { fly = flightAt(path, t); if (fly) break; }
    S.fly.setAttribute('display', fly ? 'inline' : 'none');
    if (fly) {
      const k = fly.landed ? 0.6 + 0.4 * Math.cos(2 * Math.PI * 0.7 * t) : (step % 2 ? 0.28 : 1);
      S.wingL.setAttribute('transform', 'scale(' + k.toFixed(3) + ' 1)');
      S.wingR.setAttribute('transform', 'scale(' + (-k).toFixed(3) + ' 1)');
      S.fly.setAttribute('transform', 'translate(' + f(fly.x) + ' ' + f(fly.y) + ') rotate(' + fly.h.toFixed(1) + ') scale(0.9)');
      S.flyShadowOp.setAttribute('dy', fly.landed ? 5 : 22);
      S.flyShadowOp.setAttribute('dx', fly.landed ? 3 : 10);
    }

    // Lamp flicker, one value per stop-motion step.
    S.flicker.setAttribute('opacity', (hash(step, 4242) * 0.035).toFixed(3));
  }

  // Resolves once the logo artwork is decoded, so no frame renders without it.
  const assetsReady = Promise.all([LOGO_MARK, LOGO_SPARKLES].map((src) => { const i = new Image(); i.src = src; return i.decode(); }));

  window.AlxScene = { build, renderAt, TL, LAYOUT, assetsReady };
})();
