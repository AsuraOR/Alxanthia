/**
 * Alxanthia "Coming soon" reel — scene.
 *
 * Everything on screen is a pure function of time: renderAt(t) sets every
 * animated attribute from scratch, so the preview scrubber and the frame
 * renderer (render.js) always agree, and frame 0 === the last frame + 1
 * for a seamless loop.
 *
 * Drawings live in a 900×1180 "plate" coordinate space that is placed on
 * a 1080-wide canvas: 1080×1920 (9:16 Reels/Stories) or 1080×1350 (4:5 feed).
 */
(function () {
  const TL = window.TIMELINE;
  const NS = 'http://www.w3.org/2000/svg';

  // Palette — the site's tokens (styles.css :root), aged slightly for paper.
  const C = {
    margin: '#EDE3CF',   // paper outside the plate mark
    plate: '#F7F1E4',    // pressed plate area (flowers' occlusion fills match this)
    ink: '#3B2F24',      // sepia ink (site --text-dark #23201B, warmed)
    gold: '#8B5E2E',     // the logo's own line colour (alxanthia-logo.png)
    goldHi: '#D9B274',   // shimmer highlight (site --dark-accent #C79B5C, lifted)
    ochre: '#8E6127',    // site --accent-ochre
    muted: '#6E6656',    // site --text-muted
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
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutBack = (x) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const f = (n) => Math.round(n * 10) / 10;
  const norm = (v) => { const l = Math.hypot(v.x, v.y) || 1; return V(v.x / l, v.y / l); };
  const polar = (c, r, deg) => { const a = (deg * Math.PI) / 180; return V(c.x + r * Math.cos(a), c.y + r * Math.sin(a)); };
  const poly = (pts, close) => 'M' + pts.map((p) => f(p.x) + ' ' + f(p.y)).join(' L') + (close ? ' Z' : '');
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')';
  }

  // Quadratic / cubic Bézier sampling.
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
  // Leaf/petal width profile: 0 at both ends, widest at m.
  function prof(t, m) {
    return t < m ? Math.pow(Math.sin((Math.PI / 2) * (t / m)), 0.85) : Math.pow(Math.cos((Math.PI / 2) * ((t - m) / (1 - m))), 1.1);
  }

  /**
   * A drawing is a list of items rendered in order (= z-order = draw order):
   *   { d, fill?:true (paper fill, for occlusion), sw?:stroke multiplier, wash?:colour }
   * `wash` items go into the watercolour layer instead of the ink layer.
   */
  function Drawing() { this.items = []; }
  Drawing.prototype.line = function (d, opt) { this.items.push(Object.assign({ d }, opt || {})); return this; };
  Drawing.prototype.wash = function (d, colour, alpha) { this.items.push({ d, wash: colour, alpha: alpha || 0.6 }); return this; };

  /* ------------------------------------------------------ shape builders */
  // Leaf along a quadratic spine. Adds outline (+wash), midrib and veins.
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
    const outline = poly(left.concat(right.slice().reverse()), true);
    dr.line(outline, { fill: true });
    if (o.wash) dr.wash(outline, o.wash, o.washAlpha || 0.55);
    if (o.midrib !== false) dr.line(poly(spine.slice(4, Math.round(N * 0.9))), { sw: 0.7 });
    const veins = o.veins == null ? 4 : o.veins;
    for (let k = 0; k < veins; k++) {
      const t0 = 0.18 + (k * 0.62) / Math.max(1, veins);
      for (const side of [1, -1]) {
        const i0 = Math.round(t0 * N), i1 = Math.min(N, Math.round((t0 + 0.13) * N));
        const a = spine[i0];
        const b = V(spine[i1].x + ns[i1].x * wfn(i1 / N) * 0.72 * side, spine[i1].y + ns[i1].y * wfn(i1 / N) * 0.72 * side);
        const c = V(lerp(a.x, b.x, 0.5) + ns[i0].x * wfn(t0) * 0.25 * side, lerp(a.y, b.y, 0.5) + ns[i0].y * wfn(t0) * 0.25 * side);
        dr.line('M' + f(a.x) + ' ' + f(a.y) + ' Q' + f(c.x) + ' ' + f(c.y) + ' ' + f(b.x) + ' ' + f(b.y), { sw: 0.55 });
      }
    }
    return { spine, ns, wfn };
  }

  // Tapered double-line stem along a cubic.
  function stem(dr, p, w0, w1, washColour) {
    const spine = sampleSpine((t) => cb(p[0], p[1], p[2], p[3], t), 80);
    const ns = normals(spine);
    const wfn = (t) => lerp(w0, w1, t);
    const l = offset(spine, ns, wfn, 1), r = offset(spine, ns, wfn, -1);
    const outline = poly(l.concat(r.slice().reverse()), true);
    dr.line(outline, { fill: true });
    if (washColour) dr.wash(outline, washColour, 0.5);
    return { spine, ns, wfn, at: (t) => spine[Math.round(t * 80)], n: (t) => ns[Math.round(t * 80)] };
  }

  // Pointed petal from a base point outward along `deg`.
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
    return { d: s, veins };
  }

  // Strap petal with a rounded, slightly notched tip (gerbera).
  function strapPetal(c, deg, r0, r1, hw) {
    const b = polar(c, r0, deg), tip = polar(c, r1, deg);
    const d = norm(V(tip.x - b.x, tip.y - b.y)), n = V(-d.y, d.x), L = r1 - r0;
    const P = (along, side) => V(b.x + d.x * along * L + n.x * side * hw, b.y + d.y * along * L + n.y * side * hw);
    const pts = [P(0, 0.5), P(0.3, 0.95), P(0.8, 1), P(0.95, 0.75), P(1, 0.3), P(0.97, 0), P(1, -0.3), P(0.95, -0.75), P(0.8, -1), P(0.3, -0.95), P(0, -0.5)];
    // Smooth through the points with Catmull-Rom → cubic.
    let s = 'M' + f(pts[0].x) + ' ' + f(pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = V(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6), c2 = V(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6);
      s += ' C' + [c1, c2, p2].map((q) => f(q.x) + ' ' + f(q.y)).join(' ');
    }
    const m0 = P(0.15, 0), m1 = P(0.8, 0);
    return { d: s + ' Z', mid: 'M' + f(m0.x) + ' ' + f(m0.y) + ' L' + f(m1.x) + ' ' + f(m1.y) };
  }

  // Four-point sparkle.
  function sparkle(x, y, s) {
    const k = s * 0.14;
    return 'M' + f(x) + ' ' + f(y - s) +
      ' Q' + f(x + k) + ' ' + f(y - k) + ' ' + f(x + s * 0.78) + ' ' + f(y) +
      ' Q' + f(x + k) + ' ' + f(y + k) + ' ' + f(x) + ' ' + f(y + s) +
      ' Q' + f(x - k) + ' ' + f(y + k) + ' ' + f(x - s * 0.78) + ' ' + f(y) +
      ' Q' + f(x - k) + ' ' + f(y - k) + ' ' + f(x) + ' ' + f(y - s) + ' Z';
  }

  /* ------------------------------------------------------------ plates */
  function rose() {
    const dr = new Drawing();
    const c = V(450, 350);
    const st = stem(dr, [V(450, 480), V(438, 620), V(470, 790), V(446, 935)], 7, 5, C.stem);
    // Thorns.
    for (const [t, side] of [[0.3, 1], [0.5, -1], [0.7, 1], [0.86, -1]]) {
      const p = st.at(t), n = st.n(t), w = st.wfn(t) * side;
      const b0 = V(p.x + n.x * w, p.y + n.y * w - 7), b1 = V(p.x + n.x * w, p.y + n.y * w + 9);
      const tip = V(p.x + n.x * (w + 13 * side), p.y + n.y * (w + 13 * side) - 12);
      dr.line(poly([b0, tip, b1]), { sw: 0.8 });
    }
    // Bud on a side shoot.
    const shoot = stem(dr, [st.at(0.42), V(510, 640), V(585, 600), V(622, 548)], 4.5, 3.5, C.stem);
    const bt = shoot.at(1);
    leaf(dr, { base: V(bt.x - 4, bt.y + 4), tip: V(bt.x + 30, bt.y - 78), width: 0.36, widest: 0.38, bend: 0.05, veins: 0, midrib: false, wash: C.rose, washAlpha: 0.7 });
    for (const [dx, dy, bend] of [[-26, -38, 0.2], [30, -30, -0.2], [4, -44, 0]]) {
      leaf(dr, { base: bt, tip: V(bt.x + dx, bt.y + dy), width: 0.12, bend, veins: 0, midrib: false, wash: C.sage });
    }
    // Compound leaves: petiole + 5 serrated leaflets.
    const compound = (start, end, bend, size) => {
      const mid = V((start.x + end.x) / 2, (start.y + end.y) / 2 + bend);
      dr.line('M' + f(start.x) + ' ' + f(start.y) + ' Q' + f(mid.x) + ' ' + f(mid.y) + ' ' + f(end.x) + ' ' + f(end.y), { sw: 1.1 });
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

    // Head: rings of cupped petals seen from above, slightly foreshortened.
    const squash = (p) => V(p.x, c.y + (p.y - c.y) * 0.86);
    const ring = (n, span, rIn, rOut, off, lip) => {
      for (let k = 0; k < n; k++) {
        const a = off + (360 / n) * k;
        const outer = [];
        for (let i = 0; i <= 36; i++) {
          const u = i / 36, th = a - span / 2 + span * u;
          const notch = 0.06 * Math.exp(-Math.pow((u - 0.5) / 0.07, 2));
          const r = rIn + (rOut - rIn) * (Math.pow(Math.sin(Math.PI * u), 0.45) - notch);
          outer.push(squash(polar(c, r, th)));
        }
        const inner = [];
        for (let i = 12; i >= 0; i--) inner.push(squash(polar(c, rIn, a - span / 2 + (span * i) / 12)));
        const d = poly(outer.concat(inner), true);
        dr.line(d, { fill: true });
        dr.wash(d, C.rose, 0.42);
        if (lip) {
          const lipPts = [];
          for (let i = 0; i <= 20; i++) {
            const u = 0.18 + (0.64 * i) / 20, th = a - span / 2 + span * u;
            lipPts.push(squash(polar(c, rIn + (rOut - rIn) * Math.pow(Math.sin(Math.PI * u), 0.45) * 0.84, th)));
          }
          dr.line(poly(lipPts), { sw: 0.6 });
        }
      }
    };
    ring(5, 100, 45, 165, -90 + 36, true);
    ring(5, 92, 35, 128, -90, true);
    ring(4, 118, 25, 92, -45, true);
    ring(3, 150, 15, 60, 10, false);
    const sp = [];
    for (let i = 0; i <= 90; i++) { const u = i / 90; sp.push(squash(polar(c, 38 * (1 - u) + 3, -60 + u * 720))); }
    dr.line(poly(sp), { sw: 0.9 });
    dr.wash('M' + (c.x - 36) + ' ' + c.y + ' a36 31 0 1 0 72 0 a36 31 0 1 0 -72 0 Z', C.rose, 0.35);
    return { dr, centre: c, washR: 560, latin: 'Rosa centifolia', common: 'Mawar · Rose', pl: 'PL. I' };
  }

  function tulip() {
    const dr = new Drawing();
    leaf(dr, { base: V(452, 925), tip: V(262, 560), width: 0.16, widest: 0.35, bend: -0.12, veins: 0, wash: C.sage });
    const st = stem(dr, [V(450, 455), V(446, 620), V(462, 780), V(452, 930)], 8, 7, C.stem);
    leaf(dr, { base: V(456, 890), tip: V(650, 610), width: 0.15, widest: 0.33, bend: 0.14, veins: 0, wash: C.sage });
    // Parallel veins on the strap leaves (monocot) — drawn as long offset curves.
    for (const [b, t, bend] of [[V(452, 905), V(290, 600), -0.12], [V(456, 870), V(625, 640), 0.14]]) {
      const L = Math.hypot(t.x - b.x, t.y - b.y), d = norm(V(t.x - b.x, t.y - b.y)), n = V(-d.y, d.x);
      for (const o of [-9, 9]) {
        const m = V((b.x + t.x) / 2 + n.x * (bend * L + o), (b.y + t.y) / 2 + n.y * (bend * L + o));
        dr.line('M' + f(b.x + n.x * o * 0.3) + ' ' + f(b.y) + ' Q' + f(m.x) + ' ' + f(m.y) + ' ' + f(t.x) + ' ' + f(t.y), { sw: 0.5 });
      }
    }
    const cup = (base, tip, wl, wr, veins) => {
      const h = base.y - tip.y;
      const d = 'M' + f(base.x) + ' ' + f(base.y) +
        ' C' + f(base.x - wl) + ' ' + f(base.y - h * 0.15) + ' ' + f(tip.x - wl * 0.55) + ' ' + f(tip.y + h * 0.45) + ' ' + f(tip.x) + ' ' + f(tip.y) +
        ' C' + f(tip.x + wr * 0.55) + ' ' + f(tip.y + h * 0.45) + ' ' + f(base.x + wr) + ' ' + f(base.y - h * 0.15) + ' ' + f(base.x) + ' ' + f(base.y) + ' Z';
      dr.line(d, { fill: true });
      dr.wash(d, C.coral, 0.5);
      for (let k = 0; k < veins; k++) {
        const x = lerp(-0.45, 0.45, veins === 1 ? 0.5 : k / (veins - 1));
        const a = V(base.x + x * (wl + wr) * 0.25, base.y - h * 0.1);
        const e = V(tip.x + x * (wl + wr) * 0.12, tip.y + h * 0.3);
        const m = V((a.x + e.x) / 2 + x * 30, (a.y + e.y) / 2);
        dr.line('M' + f(a.x) + ' ' + f(a.y) + ' Q' + f(m.x) + ' ' + f(m.y) + ' ' + f(e.x) + ' ' + f(e.y), { sw: 0.55 });
      }
    };
    cup(V(450, 462), V(452, 200), 92, 92, 0);
    cup(V(438, 468), V(338, 232), 70, 100, 2);
    cup(V(462, 468), V(566, 228), 100, 72, 2);
    cup(V(450, 474), V(458, 236), 112, 104, 4);
    return { dr, centre: V(450, 350), washR: 560, latin: 'Tulipa gesneriana', common: 'Tulip', pl: 'PL. II' };
  }

  function gerbera() {
    const dr = new Drawing();
    const c = V(450, 340);
    leaf(dr, { base: V(446, 930), tip: V(236, 745), width: 0.2, bend: -0.1, lobes: 5, veins: 4, wash: C.sage });
    leaf(dr, { base: V(448, 932), tip: V(660, 780), width: 0.2, bend: 0.1, lobes: 5, veins: 4, wash: C.sage });
    stem(dr, [V(450, 380), V(462, 560), V(430, 760), V(447, 935)], 5.5, 5, C.stem);
    for (let k = 0; k < 22; k++) {
      const p = strapPetal(c, -90 + 360 / 44 + (360 / 22) * k, 50, 205, 15);
      dr.line(p.d, { fill: true }); dr.wash(p.d, C.gerbera, 0.5);
    }
    for (let k = 0; k < 22; k++) {
      const p = strapPetal(c, -90 + (360 / 22) * k, 50, 182, 15);
      dr.line(p.d, { fill: true }); dr.wash(p.d, C.gerbera, 0.5); dr.line(p.mid, { sw: 0.5 });
    }
    const circ = (r) => 'M' + (c.x - r) + ' ' + c.y + ' a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0 Z';
    dr.line(circ(62), { fill: true });
    dr.wash(circ(62), C.ochre, 0.55);
    dr.line(circ(40), { sw: 0.8 });
    dr.wash(circ(40), C.sunDisk, 0.6);
    // Stippled florets in the disc.
    let dots = '';
    for (let i = 0; i < 56; i++) {
      const r = 44 + (i % 3) * 6, a = i * 137.5;
      const p = polar(c, r, a);
      dots += 'M' + f(p.x - 1.6) + ' ' + f(p.y) + ' a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0 ';
    }
    for (let i = 0; i < 40; i++) {
      const r = 5 + 30 * Math.sqrt(i / 40), a = i * 137.5;
      const p = polar(c, r, a);
      dots += 'M' + f(p.x - 1.2) + ' ' + f(p.y) + ' a1.2 1.2 0 1 0 2.4 0 a1.2 1.2 0 1 0 -2.4 0 ';
    }
    dr.line(dots, { sw: 0.6 });
    return { dr, centre: c, washR: 560, latin: 'Gerbera jamesonii', common: 'Gerbera', pl: 'PL. III' };
  }

  function lavender() {
    const dr = new Drawing();
    const root = V(450, 930);
    // Narrow basal leaves.
    for (const [tx, ty, bend] of [[300, 680, -0.08], [360, 640, -0.05], [560, 650, 0.06], [612, 700, 0.08], [250, 770, -0.1], [660, 790, 0.1]]) {
      leaf(dr, { base: root, tip: V(tx, ty), width: 0.045, widest: 0.3, bend, veins: 0, midrib: false, wash: C.sage });
    }
    const stalks = [
      [V(446, 930), V(430, 700), V(380, 420), V(352, 205)],
      [V(450, 930), V(452, 690), V(455, 400), V(450, 165)],
      [V(454, 930), V(470, 700), V(520, 430), V(552, 215)]
    ];
    for (const p of stalks) {
      const st = stem(dr, p, 4, 2.6, C.stem);
      // Whorls of florets along the top ~40% of the stalk, shrinking toward the tip.
      for (let w = 0; w < 9; w++) {
        const t = 0.6 + w * 0.045, sz = lerp(34, 16, w / 8);
        const b = st.at(t), n = st.n(t), tg = norm(V(st.at(Math.min(1, t + 0.01)).x - b.x, st.at(Math.min(1, t + 0.01)).y - b.y));
        for (const side of [1, -1, 0]) {
          const dir = side === 0 ? tg : norm(V(n.x * side * 0.85 + tg.x * 0.7, n.y * side * 0.85 + tg.y * 0.7));
          const tip = V(b.x + dir.x * sz, b.y + dir.y * sz);
          const base = side === 0 ? V(b.x + tg.x * 2, b.y + tg.y * 2) : b;
          leaf(dr, { base, tip, width: 0.34, widest: 0.55, veins: 0, midrib: false, wash: C.lavender, washAlpha: 0.72 });
        }
      }
    }
    // Ribbon tying the stalks.
    const knot = V(450, 790);
    dr.line('M' + (knot.x - 16) + ' ' + (knot.y - 7) + ' C 420 760, 380 772, 392 800 C 402 818, 432 802, ' + (knot.x - 6) + ' ' + (knot.y + 2) + ' Z', { fill: true });
    dr.line('M' + (knot.x + 16) + ' ' + (knot.y - 7) + ' C 480 760, 520 772, 508 800 C 498 818, 468 802, ' + (knot.x + 6) + ' ' + (knot.y + 2) + ' Z', { fill: true });
    dr.line('M444 795 C 432 830, 418 860, 404 880 L 414 874 L 418 886 C 430 862, 444 832, 452 800 Z', { fill: true });
    dr.line('M456 795 C 470 830, 486 856, 502 874 L 504 862 L 514 868 C 496 846, 474 822, 462 798 Z', { fill: true });
    const knotD = 'M' + (knot.x - 12) + ' ' + knot.y + ' a12 10 0 1 0 24 0 a12 10 0 1 0 -24 0 Z';
    dr.line(knotD, { fill: true });
    dr.wash('M420 760 C 380 772, 392 830, 450 800 C 508 830, 520 772, 480 760 L 450 790 Z M404 880 L 452 795 L 514 868 L 462 798 Z', C.ribbon, 0.55);
    return { dr, centre: V(450, 420), washR: 540, latin: 'Lavandula angustifolia', common: 'Lavender', pl: 'PL. IV' };
  }

  /**
   * The sunflower in the logo's own coordinate space (alxanthia-logo.png is
   * 2156×3105; these coordinates are that image at 720×1036). Redrawn by hand
   * from the PNG, as there's no vector master.
   */
  const LOGO_W = 720, LOGO_H = 1036;
  function sunflower() {
    const dr = new Drawing();
    const c = V(348, 368);
    // Stem: tapered, from under the head down to a fine point.
    const sp = sampleSpine((t) => cb(V(380, 470), V(412, 640), V(282, 790), V(348, 1032), t), 90);
    const ns = normals(sp);
    const wfn = (t) => (t < 0.8 ? 10 : 10 * Math.pow((1 - t) / 0.2, 0.7)) + 0.5;
    const stemD = poly(offset(sp, ns, wfn, 1).concat(offset(sp, ns, wfn, -1).reverse()), true);
    dr.line(stemD, { fill: true }); dr.wash(stemD, C.stem, 0.5);
    // Leaves, each with two long inner lines like the logo.
    const logoLeaf = (base, tip, bend, width, asym) => {
      const g = leaf(dr, { base, tip, width, widest: 0.4, bend, asym, veins: 0, midrib: false, wash: C.sage });
      for (const [a, b, side] of [[0.12, 0.8, 0.28], [0.3, 0.9, -0.12]]) {
        const pts = [];
        for (let i = Math.round(a * 140); i <= Math.round(b * 140); i++) {
          const t = i / 140, w = g.wfn(t) * side;
          pts.push(V(g.spine[i].x + g.ns[i].x * w, g.spine[i].y + g.ns[i].y * w));
        }
        dr.line(poly(pts), { sw: 0.75 });
      }
    };
    logoLeaf(V(336, 752), V(6, 776), 0.12, 0.16, 0.55);
    logoLeaf(V(388, 690), V(716, 584), -0.1, 0.15, -0.55);
    logoLeaf(V(352, 905), V(526, 742), -0.08, 0.2, -0.45);
    // Petals: back ring (long) then front ring (shorter), both with veins.
    for (let k = 0; k < 12; k++) {
      const p = petal(c, -90 + 30 * k, 100, 306, 50, { veins: [1, -1], tipW: 0.5, belly: 1.3, baseW: 0.4 });
      dr.line(p.d, { fill: true }); dr.wash(p.d, C.sunPetal, 0.55);
      p.veins.forEach((v) => dr.line(v, { sw: 0.7 }));
    }
    for (let k = 0; k < 12; k++) {
      const p = petal(c, -75 + 30 * k, 100, 248, 50, { veins: [1, 0, -1], tipW: 0.5, belly: 1.3, baseW: 0.4 });
      dr.line(p.d, { fill: true }); dr.wash(p.d, C.sunPetal, 0.55);
      p.veins.forEach((v) => dr.line(v, { sw: 0.7 }));
    }
    const circ = (r) => 'M' + (c.x - r) + ' ' + c.y + ' a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0 Z';
    dr.line(circ(118), { fill: true }); dr.wash(circ(118), C.sunDisk, 0.5);
    dr.line(circ(100), { sw: 0.9 });
    const arc = (r, a0, a1) => { const p0 = polar(c, r, a0), p1 = polar(c, r, a1); return 'M' + f(p0.x) + ' ' + f(p0.y) + ' A' + r + ' ' + r + ' 0 0 1 ' + f(p1.x) + ' ' + f(p1.y); };
    dr.line(arc(76, 190, 262), { sw: 1 });
    dr.line(arc(56, 200, 250), { sw: 1 });
    dr.line(arc(74, 15, 75), { sw: 1 });
    return { dr, centre: c, washR: 680, latin: 'Helianthus annuus', common: 'Bunga Matahari · Sunflower', pl: 'PL. V' };
  }

  // Sparkles and dots, measured from alxanthia-logo.png (centre, radius; logo units).
  // Ordered for the pop-in: big stars first, then small stars, then dots.
  const SPARKLES = [
    [245.8, 48.1, 50], [46.3, 466.0, 50], [600.6, 166.6, 42], [100.9, 541.7, 31], [634.7, 273.5, 26], [591.8, 541.0, 24],
    [174.5, 116.5, 11], [537.3, 117.9, 11], [61.6, 232.9, 12], [620.5, 479.9, 12], [169.3, 600.8, 12]
  ];
  const LOGO_MARK = 'assets/logo-mark.webp', LOGO_SPARKLES = 'assets/logo-sparkles.webp';

  /* ------------------------------------------------------------- build */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function defs(svg, H) {
    const d = el('defs', {}, svg);
    d.innerHTML = `
      <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7"/>
        <feDisplacementMap in="SourceGraphic" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="watercolour" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="3" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feGaussianBlur in="d" stdDeviation="1.4" result="b"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="n2"/>
        <feComponentTransfer in="n2" result="pig"><feFuncR type="linear" slope="0.8" intercept="0.35"/><feFuncG type="linear" slope="0.8" intercept="0.35"/><feFuncB type="linear" slope="0.8" intercept="0.35"/><feFuncA type="linear" slope="0.8" intercept="0.35"/></feComponentTransfer>
        <feComposite in="b" in2="pig" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="body"/>
        <feMorphology in="b" operator="erode" radius="2.5" result="er"/>
        <feComposite in="b" in2="er" operator="out" result="edge"/>
        <feGaussianBlur in="edge" stdDeviation="0.8" result="edgeb"/>
        <feMerge><feMergeNode in="body"/><feMergeNode in="edgeb"/></feMerge>
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
      <filter id="fibres" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02 0.09" numOctaves="2" seed="21"/>
        <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0 0.22  1.2 0 0 0 -0.62"/>
      </filter>
      <radialGradient id="vignette" cx="50%" cy="46%" r="75%">
        <stop offset="0.55" stop-color="#7a5a32" stop-opacity="0"/>
        <stop offset="1" stop-color="#7a5a32" stop-opacity="0.34"/>
      </radialGradient>
      <radialGradient id="washMaskGrad">
        <stop offset="0.72" stop-color="#fff"/>
        <stop offset="1" stop-color="#000"/>
      </radialGradient>
      <linearGradient id="sunStroke" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="520" y2="260"></linearGradient>
    `;
    return d;
  }

  function addDrawing(parent, drawing, maskId, lineWidth) {
    const lines = el('g', { filter: 'url(#wobble)', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
    const washOuter = el('g', { mask: 'url(#' + maskId + ')', style: 'mix-blend-mode:multiply' }, parent);
    const wash = el('g', { filter: 'url(#watercolour)' }, washOuter);
    const paths = [];
    for (const it of drawing.items) {
      if (it.wash) {
        el('path', { d: it.d, fill: it.wash, 'fill-opacity': it.alpha, stroke: 'none' }, wash);
        continue;
      }
      const p = el('path', {
        d: it.d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1,
        fill: it.fill ? C.plate : 'none', 'fill-opacity': 0,
        'stroke-width': (lineWidth * (it.sw || 1)).toFixed(2)
      }, lines);
      paths.push({ el: p, fill: !!it.fill, sw: it.sw || 1 });
    }
    return { lines, washOuter, paths };
  }

  function text(parent, str, x, y, style) {
    // SVG counts trailing letter-spacing when centring; shift by half to compensate.
    const ls = parseFloat(style['letter-spacing'] || 0);
    const t = el('text', Object.assign({ x: x + ls / 2, y, 'text-anchor': 'middle' }, style), parent);
    t.textContent = str;
    return t;
  }

  function build(svg, ratio) {
    const L = LAYOUT[ratio];
    const H = L.h;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.innerHTML = '';
    defs(svg, H);
    const S = { svg, ratio, plates: [] };

    // Paper.
    el('rect', { width: W, height: H, fill: C.margin }, svg);
    const plate = el('g', { transform: 'translate(90 ' + L.plateY + ')' }, svg);
    // Plate mark: pressed rectangle with a soft shadow line + highlight.
    el('rect', { x: 2, y: 2, width: PW, height: PH, fill: 'none', stroke: '#c9b894', 'stroke-width': 3, opacity: 0.55 }, plate);
    el('rect', { x: 0, y: 0, width: PW, height: PH, fill: C.plate, stroke: '#d8c9a8', 'stroke-width': 1.2 }, plate);
    el('rect', { x: -1.5, y: -1.5, width: PW + 3, height: PH + 3, fill: 'none', stroke: '#fbf8f0', 'stroke-width': 1, opacity: 0.8 }, plate);
    // Double rule + corner lozenges.
    const rule = el('g', { stroke: C.ink, fill: 'none', opacity: 0.72 }, plate);
    el('rect', { x: 30, y: 30, width: PW - 60, height: PH - 60, 'stroke-width': 1.8 }, rule);
    el('rect', { x: 39, y: 39, width: PW - 78, height: PH - 78, 'stroke-width': 0.8 }, rule);
    for (const [x, y] of [[30, 30], [PW - 30, 30], [30, PH - 30], [PW - 30, PH - 30]]) {
      el('path', { d: 'M' + x + ' ' + (y - 9) + ' L' + (x + 9) + ' ' + y + ' L' + x + ' ' + (y + 9) + ' L' + (x - 9) + ' ' + y + ' Z', fill: C.plate, 'stroke-width': 1.2 }, rule);
    }
    const serif = { 'font-family': 'Cormorant Garamond, Georgia, serif', fill: C.ink };
    text(plate, 'HERBARIUM  ·  ALXANTHIA  STUDIO', PW / 2, PH - 58, Object.assign({}, serif, { 'font-size': 17, 'letter-spacing': '4', opacity: 0.62, 'font-weight': 500 }));

    // The four plates.
    const defsEl = svg.querySelector('defs');
    [rose(), tulip(), gerbera(), lavender()].forEach((spec, i) => {
      const g = el('g', { opacity: 0 }, plate);
      const mask = el('mask', { id: 'wm' + i, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: PW, height: PH }, defsEl);
      const mc = el('circle', { cx: spec.centre.x, cy: spec.centre.y, r: 0, fill: 'url(#washMaskGrad)' }, mask);
      const d = addDrawing(g, spec.dr, 'wm' + i, 2.5);
      d.lines.setAttribute('stroke', C.ink);
      const lab = el('g', { opacity: 0 }, g);
      text(lab, spec.pl, PW / 2, 104, Object.assign({}, serif, { 'font-size': 30, 'letter-spacing': '6', 'font-weight': 600 }));
      text(lab, spec.latin, PW / 2, 1022, Object.assign({}, serif, { 'font-size': 48, 'font-style': 'italic' }));
      text(lab, spec.common.toUpperCase(), PW / 2, 1070, Object.assign({}, serif, { 'font-size': 21, 'letter-spacing': '5', fill: C.ochre, 'font-weight': 600 }));
      S.plates.push({ g, mc, lab, d, spec });
    });

    // PL. V — sunflower → logo.
    const sun = sunflower();
    const sunG = el('g', { opacity: 0 }, plate);
    const sunLab = el('g', { opacity: 0 }, sunG);
    text(sunLab, sun.pl, PW / 2, 104, Object.assign({}, serif, { 'font-size': 30, 'letter-spacing': '6', 'font-weight': 600 }));
    text(sunLab, sun.latin, PW / 2, 1022, Object.assign({}, serif, { 'font-size': 48, 'font-style': 'italic' }));
    text(sunLab, sun.common.toUpperCase(), PW / 2, 1070, Object.assign({}, serif, { 'font-size': 21, 'letter-spacing': '5', fill: C.ochre, 'font-weight': 600 }));
    const sunT = el('g', {}, sunG);
    const sunMask = el('mask', { id: 'wmsun', maskUnits: 'userSpaceOnUse', x: -200, y: -200, width: 1200, height: 1500 }, defsEl);
    const sunMc = el('circle', { cx: sun.centre.x, cy: sun.centre.y + 150, r: 0, fill: 'url(#washMaskGrad)' }, sunMask);
    // Hand-drawn sketch first; it dissolves into the real logo artwork.
    const sketch = el('g', {}, sunT);
    const sunD = addDrawing(sketch, sun.dr, 'wmsun', 1);
    const real = el('g', { opacity: 0 }, sunT);
    el('image', { href: LOGO_MARK, width: LOGO_W, height: LOGO_H }, real);
    // Shimmer: a highlight band clipped to the logo's own alpha.
    const lm = el('mask', { id: 'logoAlpha', style: 'mask-type:alpha', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: LOGO_W, height: LOGO_H }, defsEl);
    el('image', { href: LOGO_MARK, width: LOGO_W, height: LOGO_H }, lm);
    const shine = svg.querySelector('#sunStroke');
    shine.innerHTML = '<stop offset="0" stop-color="' + C.goldHi + '" stop-opacity="0"/><stop offset="0.5" stop-color="' + C.goldHi + '" stop-opacity="1"/><stop offset="1" stop-color="' + C.goldHi + '" stop-opacity="0"/>';
    const shineRect = el('rect', { x: 0, y: 0, width: LOGO_W, height: LOGO_H, fill: 'url(#sunStroke)', mask: 'url(#logoAlpha)', opacity: 0 }, real);
    // Each sparkle is its own clipped copy of the sparkle layer, so it can scale in place.
    const sparks = SPARKLES.map(([x, y, r], i) => {
      const cp = el('clipPath', { id: 'spk' + i }, defsEl);
      el('circle', { cx: 0, cy: 0, r }, cp);
      const g = el('g', { transform: 'translate(' + x + ' ' + y + ') scale(0)' }, sunT);
      const inner = el('g', { 'clip-path': 'url(#spk' + i + ')' }, g);
      el('image', { href: LOGO_SPARKLES, x: -x, y: -y, width: LOGO_W, height: LOGO_H }, inner);
      return { g, x, y };
    });

    // Logo lock-up text.
    const tx = el('g', {}, plate);
    const T = {};
    T.wordmark = text(tx, 'ALXANTHIA', PW / 2, 744, Object.assign({}, serif, { 'font-size': 92, 'font-weight': 500, fill: C.gold }));
    T.taglineId = text(tx, 'Bunga yang tak pernah layu', PW / 2, 824, Object.assign({}, serif, { 'font-size': 40, 'font-style': 'italic' }));
    T.taglineEn = text(tx, 'Flowers that never wilt', PW / 2, 870, Object.assign({}, serif, { 'font-size': 30, 'font-style': 'italic', fill: C.muted }));
    T.ornament = el('g', { stroke: C.gold, fill: 'none', 'stroke-width': 1.4 }, tx);
    el('path', { d: 'M330 922 L430 922 M470 922 L570 922' }, T.ornament);
    el('path', { d: sparkle(450, 922, 12), fill: C.gold, stroke: 'none' }, T.ornament);
    T.comingSoon = text(tx, 'SEGERA HADIR  ·  COMING SOON', PW / 2, 990, Object.assign({}, serif, { 'font-size': 31, 'letter-spacing': '6', 'font-weight': 600 }));
    T.handle = text(tx, '@alxanthia', PW / 2, 1044, Object.assign({}, serif, { 'font-size': 27, 'letter-spacing': '2', fill: C.ochre, 'font-weight': 500 }));
    for (const k in T) T[k].setAttribute('opacity', 0);

    // Surface: vignette, stains, fibres and grain over everything.
    el('rect', { width: W, height: H, fill: 'url(#vignette)', style: 'mix-blend-mode:multiply' }, svg);
    el('rect', { width: W, height: H, filter: 'url(#stains)', opacity: 0.22, style: 'mix-blend-mode:multiply' }, svg);
    el('rect', { width: W, height: H, filter: 'url(#fibres)', opacity: 0.1, style: 'mix-blend-mode:multiply' }, svg);
    el('rect', { width: W, height: H, filter: 'url(#grain)', opacity: 0.5, style: 'mix-blend-mode:multiply' }, svg);

    Object.assign(S, { sun, sunG, sunT, sunLab, sunMc, sunD, sketch, real, shine, shineRect, sparks, T });
    return S;
  }

  /* ------------------------------------------------------------ render */
  // Sunflower placement in plate coords: as a botanical plate, then as the logo.
  const SUN_PLATE = { s: 0.72, x: PW / 2 - (LOGO_W / 2) * 0.72, y: 160 };
  const SUN_LOGO = { s: 0.5, x: PW / 2 - (LOGO_W / 2) * 0.5, y: 88 };

  function drawLines(d, p, lineScale) {
    const N = d.paths.length;
    d.paths.forEach((it, i) => {
      const st = (i / N) * 0.6;
      const e = easeInOut(clamp01((p - st) / 0.4));
      it.el.setAttribute('stroke-dashoffset', (1 - e).toFixed(4));
      if (it.fill) it.el.setAttribute('fill-opacity', clamp01(e * 3).toFixed(3));
      if (lineScale) it.el.setAttribute('stroke-width', (lineScale * it.sw).toFixed(2));
    });
  }

  function renderAt(S, t) {
    t = ((t % TL.duration) + TL.duration) % TL.duration;

    // Plates I–IV.
    S.plates.forEach((P, i) => {
      const u = t - TL.plateStarts[i];
      const visible = u >= 0 && u <= TL.plateOut[1];
      P.g.setAttribute('display', visible ? 'inline' : 'none');
      if (!visible) return;
      drawLines(P.d, u / TL.plateDraw);
      const w = easeOut(prog(u, TL.plateWashIn[0], TL.plateWashIn[1]));
      P.mc.setAttribute('r', (P.spec.washR * w * 1.3).toFixed(1));
      P.lab.setAttribute('opacity', easeOut(prog(u, 0.5, 1.2)).toFixed(3));
      const out = easeInOut(prog(u, TL.plateOut[0], TL.plateOut[1]));
      P.g.setAttribute('opacity', (1 - out).toFixed(3));
      P.g.setAttribute('transform', 'translate(0 ' + (-14 * out).toFixed(2) + ')');
    });

    // PL. V.
    const s = TL.sun, u = t - s.start;
    const sunVisible = u >= 0 && t <= s.fadeOut[1];
    S.sunG.setAttribute('display', sunVisible ? 'inline' : 'none');
    if (sunVisible) {
      const mv = easeInOut(prog(u, s.move[0], s.move[1]));
      const sc = lerp(SUN_PLATE.s, SUN_LOGO.s, mv);
      S.sunT.setAttribute('transform', 'translate(' + lerp(SUN_PLATE.x, SUN_LOGO.x, mv).toFixed(2) + ' ' + lerp(SUN_PLATE.y, SUN_LOGO.y, mv).toFixed(2) + ') scale(' + sc.toFixed(4) + ')');
      // Plate-weight lines (≈3.3px) thicken to the logo's weight (≈8 logo units).
      drawLines(S.sunD, u / s.draw, lerp(3.3 / SUN_PLATE.s, 8, mv));
      const wIn = easeOut(prog(u, s.washIn[0], s.washIn[1]));
      const drain = easeInOut(prog(u, s.drain[0], s.drain[1]));
      S.sunMc.setAttribute('r', (S.sun.washR * wIn * 1.3).toFixed(1));
      S.sunD.washOuter.setAttribute('opacity', (1 - drain).toFixed(3));
      S.sunLab.setAttribute('opacity', (easeOut(prog(u, 0.5, 1.2)) * (1 - easeOut(prog(u, s.drain[0], s.drain[0] + 0.5)))).toFixed(3));
      // Ink turns gold, then the sketch dissolves into the real logo artwork.
      S.sunD.lines.setAttribute('stroke', mix(C.ink, C.gold, drain));
      const x = easeInOut(prog(u, s.crossfade[0], s.crossfade[1]));
      S.sketch.setAttribute('opacity', (1 - x).toFixed(3));
      S.real.setAttribute('opacity', x.toFixed(3));
      // A highlight band sweeps diagonally across the mark.
      const sh = prog(t, s.shimmer[0], s.shimmer[1]);
      const pos = lerp(-0.35, 1.35, easeInOut(sh));
      S.shine.setAttribute('x1', (lerp(-400, 1120, pos) - 260).toFixed(1));
      S.shine.setAttribute('x2', (lerp(-400, 1120, pos) + 260).toFixed(1));
      S.shineRect.setAttribute('opacity', (0.9 * Math.sin(Math.PI * sh)).toFixed(3));
      // Sparkles pop in one by one, then breathe gently.
      S.sparks.forEach((sp, i) => {
        const a = s.sparkles[0] + i * 0.08;
        const k = easeOutBack(prog(t, a, a + 0.5));
        const breathe = 1 + 0.12 * Math.sin((t - a) * 3.2 + i * 1.7) * prog(t, a + 0.5, a + 1);
        sp.g.setAttribute('transform', 'translate(' + sp.x + ' ' + sp.y + ') scale(' + Math.max(0, k * breathe).toFixed(4) + ')');
      });
      const fo = easeInOut(prog(t, s.fadeOut[0], s.fadeOut[1]));
      S.sunG.setAttribute('opacity', (clamp01(u * 10) * (1 - fo)).toFixed(3));
    }

    // Lock-up text: rises and settles; wordmark letter-spacing tightens.
    const fo = easeInOut(prog(t, TL.sun.fadeOut[0], TL.sun.fadeOut[1]));
    for (const k in S.T) {
      const [a, b] = TL.text[k];
      const e = easeOut(prog(t, a, b));
      S.T[k].setAttribute('opacity', (e * (1 - fo)).toFixed(3));
      S.T[k].setAttribute('transform', 'translate(0 ' + ((1 - e) * 16).toFixed(2) + ')');
    }
    const we = easeOut(prog(t, TL.text.wordmark[0], TL.text.wordmark[1] + 0.6));
    const ls = lerp(30, 18, we);
    S.T.wordmark.setAttribute('letter-spacing', ls.toFixed(2));
    S.T.wordmark.setAttribute('x', (PW / 2 + ls / 2).toFixed(2));
  }

  // Resolves once the logo artwork is decoded, so no frame renders without it.
  const assetsReady = Promise.all([LOGO_MARK, LOGO_SPARKLES].map((src) => { const i = new Image(); i.src = src; return i.decode(); }));

  window.AlxScene = { build, renderAt, TL, LAYOUT, assetsReady };
})();
