// Solvability check: a scripted bot plays every level of every course through the
// deterministic test hook (window.__ragebait). Run: node tests/solve.js  (needs playwright)
// Optional filter: node tests/solve.js multi 3   (course, 1-based level)
const { chromium } = require('playwright');
const [onlyCourse, onlyLevel] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);
  const res = await page.evaluate(([onlyCourse, onlyLevel]) => {
    const R = window.__ragebait;
    // ---- single-player policies: (L, k, st) => sets k.left/right, returns true to press jump
    const J = (st, name, c) => { if (c && !st[name]) { st[name] = 1; return true; } return false; };
    const SINGLE = [
      // 1
      (L, k, st) => { k.right = 1; return J(st, 'a', L.px > 16.2); },
      // 2: jump spikes going right, door flees, go back left jump spike at 5
      (L, k, st) => {
        if (!st.back) { k.right = 1; k.left = 0; if (L.doors[0].tween) st.back = 1; return J(st, 'a', L.px > 11.2); }
        k.right = 0; k.left = 1; return J(st, 'b', L.px < 17.0 && L.px > 15) || J(st, 'c', L.px < 8.6);
      },
      // 3: bait crusher then climb over
      (L, k, st) => {
        if (!st.baited) { if (L.blocks[2].pending || L.blocks[2].falling) { st.baited = 1; return false; } k.right = 1; if (L.px > 10.95) st.baited = 1; return false; }
        if (!st.landed) { k.right = 0; k.left = 1; if (L.blocks[2].y >= 11.99 && !L.blocks[2].falling) { st.landed = 1; } return false; }
        k.left = 0; k.right = 1; return J(st, 'a', L.px > 9.6) || J(st, 'b', L.px > 21.3);
      },
      // 4
      (L, k, st) => {
        if (L.g > 0 && !st.f) { k.right = 1; return false; }
        st.f = 1;
        if (!st.land) { k.right = 0; k.left = 0; if (L.player.grounded) st.land = 1; return false; }
        k.right = 1; return J(st, 'a', L.px > 11.3);
      },
      // 5
      (L, k, st) => {
        const d = L.doors[0];
        if (!st.s) { k.right = 1; k.left = 0; if (d.tween) st.s = 1; return false; }
        if (st.s === 1) { k.right = 0; k.left = 1; if (d.tween && d.tween.y < 9) st.s = 2; return false; }
        // go climb: walk to x~6.5 then jump onto step, then platform
        if (L.px < 6.2) st.go = 1;
        if (!st.go) k.left = 1;
        if (st.go) { k.left = 0; k.right = 1; }
        if (st.go && L.px > 16) { k.right = 0; k.left = 1; }
        if (st.go) return L.player.grounded && ((L.py > 13 && L.px > 6.6 && L.px < 8) || (L.py < 12.5 && L.px > 10));
        return false;
      },
      // 6 inverted
      (L, k, st) => {
        if (L.invert) { k.left = 1; k.right = 0; } else { k.right = 1; k.left = 0; }
        if (st.passed && !L.invert) { k.right = 1; k.left = 0; }
        if (L.px > 22.6) st.passed = 1;
        return J(st, 'a', L.px > 9.6) || J(st, 'b', L.px > 17.6) || J(st, 'c', L.px > 24.6);
      },
      // 7
      (L, k, st) => { k.right = 1; return J(st, 'a', L.px > 7.4) || J(st, 'b', L.px > 12.0 && L.player.grounded) || J(st, 'c', L.px > 17.4 && L.player.grounded); },
      // 8
      (L, k, st) => { k.right = 1; return J(st, 'a', L.px > 8.4) || J(st, 'b', L.px > 17.4) || J(st, 'c', L.px > 24.3); },
      // 9 lag: press 0.22s (~1.76 tiles) early
      (L, k, st) => { if (L.px > 31) st.back = 1; k.right = !st.back; k.left = !!st.back; return J(st, 'a', L.px > 5.2) || J(st, 'b', L.px > 12.1 && L.player.grounded) || J(st, 'c', L.px > 18.0 && L.player.grounded) || J(st, 'd', L.px > 25.5 && L.player.grounded); },
      // 10: bump hidden blocks then climb
      (L, k, st) => {
        const p = L.player;
        if (!st.s) { k.right = 1; if (L.px > 9.6) { k.right = 0; st.s = 1; } return false; }
        if (st.s === 1) { k.right = 0; if (Math.abs(p.vx) < 0.1 && p.grounded) { st.s = 2; return true; } return false; }
        if (st.s === 2) { if (!L.blocks[3].hidden && p.grounded) { st.s = 3; } return false; }
        if (st.s === 3) { k.left = 1; if (L.px < 6) { k.left = 0; st.s = 4; } return false; }
        if (st.s === 4) { k.right = L.px < 9.6; if (p.grounded && p.y < 12) st.s = 5; return J(st, 'a', L.px > 6.5 && p.grounded); }
        if (st.s === 5) { k.right = L.px < 13.6; if (p.grounded && p.y < 9) st.s = 6; return J(st, 'b', p.grounded && L.px > 10.2); }
        if (st.s === 6) { k.right = 1; return J(st, 'c', p.grounded && L.px > 14.2); }
        return false;
      },
    ];

    // ---- two-player policies: (L, A, B, st). A = player 1, B = player 2.
    // Each actor: x, y (centre), g (grounded), p (raw player), go(dir), to(x) -> arrived, jump().
    const near = (a, x, t = 0.25) => Math.abs(a.x - x) < t;
    const MULTI = [
      // 1 Hold The Door
      (L, A, B, st) => {
        const gateOpen = L.blocks[2].y < -2.5, d = L.doors[0];
        if (!st.ph) { A.to(13.7); B.to(18.2); if (L.buttons[0].down && gateOpen && near(B, 18.2)) st.ph = 1; return; }
        if (st.ph === 1) { B.go(1); if (B.x > 21.0) B.jumpOnce('s'); if (B.x > 25.4 && B.g) st.ph = 2; A.to(13.7); return; }
        if (st.ph === 2) { B.to(25.7); A.go(1); if (A.x > 21.0) A.jumpOnce('s'); if (d.tween || d.x < 20) st.ph = 3; return; }
        if (st.ph === 3) { B.to(25.7); A.go(-1); if (A.x < 25.2) A.jumpOnce('back'); if (A.x < 14.2 && A.g) st.ph = 4; return; }
        if (st.ph === 4) { if (B.p.done) { A.go(-1); if (A.x < 13.4) A.jumpOnce('sp2'); } else A.to(13.7); B.go(-1); if (B.x < 25.2) B.jumpOnce('back'); if (B.x < 12.9 && B.g) B.jumpOnce('sp2'); return; }
      },
      // 2 Boost
      (L, A, B, st) => {
        const btn = L.buttons[0], step = L.blocks[4];
        if (!st.ph) { A.to(13.3); if (near(A, 13.3) && A.g) { B.go(1); if (B.x > 10.6) B.jumpOnce('head'); if (B.p.onP) st.ph = 1; } else B.to(10.6); return; }
        if (st.ph === 1) { B.go(1); B.jumpOnce('up'); if (B.y < 11 && B.g) st.ph = 2; return; }
        if (st.ph === 2) { B.to(18.7); if (btn.down && step.x > 9.9) { A.to(5); if (near(A, 5)) st.ph = 3; } return; }
        if (st.ph === 3) { B.to(18.7); if (A.g && A.y > 13.5) { A.go(1); if (A.x > 7.0) A.jumpOnce('step'); } else if (!A.g && A.y > 11.6) A.right(A.x < 11.5); else if (A.g) { A.go(1); A.jumpOnce('plat'); } else A.go(1); if (A.y < 11 && A.g && A.x > 14.5) st.ph = 4; return; }
        if (st.ph === 4) { const d = L.doors[0]; for (const P of [A, B]) { if (d.x < 25 && P.x > 25.5) { P.go(-1); if (P.g) P.jumpOnce('back'); } else { P.go(1); if (P.x > 20.6 && P.g) P.jumpOnce('sp'); if (P.x > 25.6 && P.g) P.jumpOnce('cr'); } } return; }
      },
      // 3 Angry Plate
      (L, A, B, st) => {
        const s = L.buttons[0], e = L.buttons[1], open = L.blocks[2].y < 7.05;
        if (!st.ph) { A.to(5.7); B.to(9.3); if (s.down && open) st.ph = 1; return; }
        if (st.ph === 1) { A.to(5.7); B.go(1); if (B.x > 21) st.ph = 2; return; }
        if (st.ph === 2) { B.to(23.5); if (!st.off) { if (A.to(9.3)) st.off = 1; return; } if (open) st.ph = 3; return; }
        if (st.ph === 3) { B.to(23.5); A.go(1); if (A.x > 21) st.ph = 4; return; }
        if (st.ph === 4) { A.go(1); B.go(1); return; }
      },
      // 4 Two Keys
      (L, A, B, st) => {
        const a = L.buttons[0], b = L.buttons[1], cageOpen = L.blocks[L.blocks.length - 1].y < 5;
        if (!st.ph) {
          A.go(-1); if (A.x < 8.6) A.jumpOnce('c'); if (A.x < 3.4 && A.g) A.go(0);
          B.go(1); if (B.x > 23.4) B.jumpOnce('c'); if (B.x > 28.5 && B.g) B.go(0);
          if (a.down && b.down) st.ph = 1; return;
        }
        if (st.ph === 1) { A.go(1); A.jumpOnce('out'); B.go(-1); B.jumpOnce('out'); if (A.x > 9 && B.x < 23) st.ph = 2; return; }
        if (st.ph === 2) { if (cageOpen) { A.to(15.75); B.to(15.75); } else { A.to(11); B.to(20); } return; }
      },
      // 5 Going Up
      (L, A, B, st) => {
        const lift = L.blocks[3], d = L.doors[0];
        const ride = (P, nm) => { if (P.g && P.y > 14) { if (P.x < 11.1) P.go(1); else { P.go(1); P.jumpOnce(nm); } } else if (!P.g && P.x > 12.8) P.go(0); else if (!P.g) P.go(1); };
        if (!st.ph) { ride(B, 'on'); if (B.g && Math.abs(B.p.y + B.p.h - lift.y) < 0.05) st.ph = 1; return; }
        if (st.ph === 1) { A.to(5.7); if (lift.y < 6.5 && B.to(14.6)) B.jumpOnce('sp'); if (st.j || B.p.vy < 0) { st.j = 1; B.go(1); } if (B.x > 20 && B.g) st.ph = 2; return; }
        if (st.ph === 2) { B.to(25); if (lift.y <= 14.3 && !st.r) A.to(9); if (lift.y > 14.3 || st.r) { st.r = 1; ride(A, 'on'); if (A.g && A.y < 14.3 && Math.abs(A.p.y + A.p.h - lift.y) < 0.05) st.ph = 3; } return; }
        if (st.ph === 3) { B.to(22.7); if (lift.y < 6.5 && !st.k && A.to(14.6)) A.jumpOnce('sp'); if (st.k || A.p.vy < 0) { st.k = 1; A.go(1); } if (A.x > 20 && A.g) st.ph = 4; return; }
        if (st.ph === 4) { for (const P of [A, B]) { if (!d.tween && d.y < 10) P.to(26.5); else if (P.y < 10) P.go(1); else P.to(23.6, 0.3); } return; }
      },
      // 6 Two Lanes
      (L, A, B, st) => {
        const g1open = L.blocks[3].y < 0.05, g2open = L.blocks[4].y < 1.05;
        if (!st.ph) { B.to(9.7); if (g1open) { A.to(17.7); if (near(A, 17.7) && g2open) st.ph = 1; } else A.to(12.5); return; }
        if (st.ph === 1) { A.to(17.7); B.go(1); if (B.x > 11.7 && B.g) B.jumpOnce('mid'); if (B.x > 22.4) B.jumpOnce('sp'); return void (B.p.done && (st.ph = 2)); }
        if (st.ph === 2) { if (!st.off) { if (A.to(15.5)) st.off = 1; return; } if (L.blocks[4].y > 7.95) { A.go(1); if (A.x > 15.9) A.jumpOnce('hop'); if (A.x > 21.5 && A.g) A.jumpOnce('sp'); } return; }
      },
      // 7 Weight Limit
      (L, A, B, st) => {
        if (!st.ph) { A.to(7.5); B.go(1); if (L.saws[0].vx > 0) st.ph = 1; return; }
        A.go(1); B.go(1); for (const P of [A, B]) if (P.g && P.x > 14.2 && P.x < 15) P.jumpOnce('hop', 6);
      },
      // 8 Swap Meet
      (L, A, B, st) => {
        for (const P of [A, B]) { P.go(1); for (const [x, n] of [[10.3, 'a'], [17.3, 'b'], [22.5, 'c']]) if (P.x > x && P.g) P.jumpOnce(n); if (P.x > 26.4 && P.g && L.spikes[1].target === 1) P.jumpOnce('d'); }
      },
      // 9 Crate Expectations
      (L, A, B, st) => {
        const crate = L.blocks.find((b) => b.crate && !b.mimic), mim = L.blocks.find((b) => b.mimic), btn = L.buttons[0], cageOpen = L.blocks[L.blocks.length - 1].y < 5;
        if (!st.ph) { A.to(8.45); if (near(A, 8.45) && A.g) { B.go(-1); if (B.x < 10.6) B.jumpOnce('head'); if (B.p.onP) st.ph = 1; } else B.to(10.6); return; }
        if (st.ph === 1) { B.go(-1); B.jumpOnce('up'); if (B.y < 11 && B.g) st.ph = 2; return; }
        if (st.ph === 2) { A.to(13); if (!mim.gone) { if (!mim.armed) { if (B.to(7.6)) st.tap = 1; if (st.tap) B.go(-1); } else B.to(7.7); return; } if (!st.back) { if (B.g && B.x < crate.x + 2.2 && B.x > crate.x) B.jumpOnce('over'); B.to(1.5); if (near(B, 1.5) && B.y > 10) st.back = 1; } else if (crate.y < 11.5) B.go(1); else B.to(6.5); if (crate.y > 13.5 && btn.down) st.ph = 3; return; }
        if (st.ph === 3) { if (B.x < 17) { A.to(17.5); if (B.g && B.x > crate.x - 1.3 && B.x < crate.x) B.jumpOnce('crate'); B.go(1); return; } for (const P of [A, B]) { if (P.g && P.x > crate.x - 1.3 && P.x < crate.x) P.jumpOnce('crate'); if (P.y > 13.5 && P.x > 18.3 && P.x < 19.5 && P.g) P.jumpOnce('sp'); if (cageOpen || P.x < 19) P.to(26.25); else P.to(23); } return; }
      },
      // 10 Trust Issues
      (L, A, B, st) => {
        const lift = L.blocks[3];
        const ride = (P, nm) => { if (P.g && P.y > 14) { if (P.x < 13.1) P.go(1); else { P.go(1); P.jumpOnce(nm); } } else if (!P.g && P.x > 14.8) P.go(0); else if (!P.g) P.go(1); };
        if (!st.ph) { ride(B, 'on'); if (B.g && Math.abs(B.p.y + B.p.h - lift.y) < 0.05) st.ph = 1; return; }
        if (st.ph === 1) { A.to(6.7); if (lift.y < 6.1 && !st.j && B.to(16.6)) B.jumpOnce('sp'); if (st.j || B.p.vy < 0) { st.j = 1; B.go(1); } if (B.x > 21 && B.g && B.y < 7) st.ph = 2; return; }
        if (st.ph === 2) { B.to(26.5); if (lift.y <= 14.3 && !st.r) A.to(10); if (lift.y > 14.3 || st.r) { st.r = 1; ride(A, 'on'); if (A.g && A.y < 14.3 && Math.abs(A.p.y + A.p.h - lift.y) < 0.05) st.ph = 3; } return; }
        if (st.ph === 3) { B.to(24.7); if (lift.y < 6.1 && !st.k && A.to(16.6)) A.jumpOnce('sp'); if (st.k || A.p.vy < 0) { st.k = 1; A.go(1); } if (A.x > 21 && A.g && A.y < 7) st.ph = 4; return; }
        if (st.ph === 4) { const d = L.doors[0]; for (const P of [A, B]) { if (d.y > 10 || d.tween) { if (P.y < 7) { P.go(-1); if (P.g && P.x < 22.6) P.jumpOnce('back'); } else P.to(25.6); } else P.to(29.6); } }
      },
    ];

    // move both together, side by side
    const pair = (A, B, fn) => { fn(A); fn(B); };
    const SPECIAL = [
      // 1 Tethered
      (L, A, B, st) => {
        if (!st.ph) { A.to(9); B.to(9); if (near(A, 9) && near(B, 9)) st.ph = 1; return; }
        pair(A, B, (P) => { P.go(1); if (P.x > 13.4) P.jumpOnce('pit'); });
        // past the pit: line up one tile apart, then both jump together, twice
        if (A.x > 18.3 && !st.al) { const a = A.to(18.6), b = B.to(19.6); if (a && b && A.g && B.g && A.p.ground && B.p.ground) st.al = 1; return; }
        if (st.al) { if (B.x > 21.2 && A.g && B.g) { A.jumpOnce('sp'); B.jumpOnce('sp'); } if (B.x > 25.4 && A.g && B.g) { A.jumpOnce('sp2'); B.jumpOnce('sp2'); } if (B.x > 30.5 && B.g) { A.go(-1); B.go(-1); } }
      },
      // 2 Haul
      (L, A, B, st) => {
        if (!st.ph) { A.to(11.3); if (near(A, 11.3) && A.g) { B.go(1); if (B.x > 9.6) B.jumpOnce('head'); if (B.p.onP) st.ph = 1; } else B.to(9.6); return; }
        if (st.ph === 1) { B.go(1); B.jumpOnce('up'); if (B.y < 11 && B.g) st.ph = 2; return; }
        if (st.ph === 2) { B.go(1); if (B.x > 18.2 && B.y < 15) B.jumpOnce('gap2', 8); if (A.x > 19.6) A.go(1); if (A.p.hang > 0 && !A.g && !(L.t < st.cool)) { A.jump(); st.cool = L.t + 0.5; } if (A.y < 11 && A.g) st.ph = 3; return; }
        if (st.ph === 3) { if (!st.al) { B.to(16); A.to(16); if (near(A, 16) && near(B, 16)) st.al = 1; return; } pair(A, B, (P) => { P.go(1); if (P.x > 18.6) P.jumpOnce('sp'); }); }
      },
      // 3 Counterweight
      (L, A, B, st) => {
        const btn = L.buttons[0], open = L.blocks.find((b) => b.link && b.x === 21).y < -2.9;
        const crate = L.blocks.find((b) => b.crate && !b.mimic), mim = L.blocks.find((b) => b.mimic);
        if (!mim.gone) { A.to(1.4); if (!mim.armed) { if (B.to(3.4)) st.tap = 1; if (st.tap) B.go(1); } else B.to(2.6); return; }
        if (!st.ph) { A.to(4); if (crate.x < 10.05) B.go(1); else B.to(8.5); if (btn.down) st.ph = 1; return; }
        if (st.ph === 1) { A.to(8.5); B.to(8.5); if (near(A, 8.5) && near(B, 8.5) && open) st.ph = 2; return; }
        pair(A, B, (P) => { P.go(1); if (P.x > 9.4) P.jumpOnce('pit'); if (P.x > 24.4 && P.g) P.jumpOnce('sp'); });
      },
      // 4 Lift Together
      (L, A, B, st) => {
        const lift = L.blocks.find((b) => b.x === 12 && b.h === 0.6);
        if (!st.ph) { A.to(10.8); B.to(10.8); if (near(A, 10.8) && near(B, 10.8) && lift.y > 14.39) st.ph = 1; return; }
        if (st.ph === 1) { pair(A, B, (P) => { if (P.x < 13) { P.go(1); P.jumpOnce('on'); } else P.go(0); }); if (lift.y < 7.01) st.ph = 2; return; }
        pair(A, B, (P) => { P.go(1); if (P.x > 17.7 && P.g) P.jumpOnce('sp'); });
      },
      // 5 Leash
      (L, A, B, st) => {
        if (!st.al) { A.to(3.2); B.to(3.2); if (near(A, 3.2) && near(B, 3.2)) st.al = 1; return; }
        pair(A, B, (P) => P.go(P.x > 30.9 ? -1 : 1));
        const lead = Math.max(A.x, B.x);
        for (const [x, n] of [[8.3, 'a'], [15.3, 'b'], [21.3, 'c'], [26.7, 'd']]) if (lead > x && A.g && B.g) { A.jumpOnce(n); B.jumpOnce(n); }
      },
      // 6 Weight Limit
      (L, A, B, st) => {
        if (!st.ph) { B.to(10.5); if (B.x > 6.3 && B.x < 7) B.jumpOnce('gap', 6); A.to(5.5); if (near(B, 10.5) && B.g) st.ph = 1; return; }
        if (st.ph === 1) { B.to(10.5); if (A.y < 15.2) A.go(1); if (A.y > 16) st.ph = 2; return; }
        if (st.ph === 2) { B.go(1); if (B.x > 18.2 && B.y < 15) B.jumpOnce('gap2', 8); if (A.x > 19.6) A.go(1); if (A.p.hang > 0 && A.x > 18.5 && !(L.t < st.cool)) { A.jump(); st.cool = L.t + 0.5; } if (A.g && A.y < 15 && A.x > 20) st.ph = 3; return; }
        pair(A, B, (P) => P.go(1));
      },
      // 7 Up Is Down (Together)
      (L, A, B, st) => {
        if (st.al === 2) { A.go(1); B.go(1); return; }
        if (L.g < 0 && A.x > 17 && B.x > 17 && !st.al) { const a = A.to(17.6), b = B.to(18.6); if (a && b && A.p.ground && B.p.ground) { st.al = 2; A.jumpOnce('sp'); B.jumpOnce('sp'); } return; }
        pair(A, B, (P) => { P.go(1); if (L.g < 0 && P.g && P.x > 13.3) P.jumpOnce('hole'); });
      },
      // 8 Lift Off
      (L, A, B, st) => {
        const pillar = L.blocks.find((b) => b.x === 15 && b.h === 0.6);
        const lie = L.spikes.find((x) => x.y === 14.4);
        if (!st.ph) { A.to(8.7); B.to(8.7); if (lie.target === 1) st.ph = 0.5; return; }
        if (st.ph === 0.5) { A.to(6); B.to(6); if (lie.target === 0 && lie.out < 0.05 && near(A, 6, 0.4) && near(B, 6, 0.4)) st.ph = 0.7; return; }
        if (st.ph === 0.7) { A.to(8.7); B.to(8.7); if (L.buttons[0].down && near(A, 8.7, 0.5) && near(B, 8.7, 0.5)) st.ph = 1; return; }
        if (st.ph === 1) { pair(A, B, (P) => { if (P.x < 15.6) { P.go(1); if (P.x > 13.6) P.jumpOnce('on'); } else P.go(0); }); if (pillar.y < 6.01) st.ph = 2; return; }
        pair(A, B, (P) => { P.go(1); if (P.x > 19.8 && P.g) P.jumpOnce('sp'); });
      },
      // 9 Crumble Run
      (L, A, B, st) => {
        if (!st.ph) { A.to(4); B.to(4); if (near(A, 4) && near(B, 4)) st.ph = 1; return; }
        pair(A, B, (P) => { P.go(1); if (P.x > 16.4) P.jumpOnce('m'); if (P.x > 25.5) P.jumpOnce('sp'); });
      },
      // 10 The End (Together): reveal the hidden steps, then climb them side by side
      (L, A, B, st) => {
        const h1 = L.blocks.find((b) => b.x === 9 && b.y === 12);
        if (!st.ph) { A.to(10); B.to(10); if (near(A, 10, 0.3) && near(B, 10, 0.3) && A.g && B.g) { A.jumpOnce('bump'); st.ph = 1; } return; }
        if (st.ph === 1) { if (!h1.hidden && A.g && B.g) st.ph = 2; return; }
        if (st.ph === 2) { A.to(6); B.to(6); if (near(A, 6, 0.3) && near(B, 6, 0.3)) st.ph = 3; return; }
        pair(A, B, (P) => {
          if (P.y > 13) { P.right(P.x < 9.6); if (P.x > 6.5) P.jumpOnce('s1'); }
          else if (P.y > 10) { P.right(P.x < 13.6); if (P.g && P.x > 10.2) P.jumpOnce('s2'); }
          else if (P.y > 7) { P.go(1); if (P.g && P.y < 9 && P.x > 14.2) P.jumpOnce('s3'); }
          else P.go(L.doors[0].x < 20 ? -1 : 1);
        });
      },
    ];

    const out = [];
    const runSingle = (i) => {
      R.load(i, 'single');
      const k = R.keys; const st = {};
      for (let n = 0; n < 120 * 25; n++) {
        const L = R.game.level;
        if (L.over) return `DEAD at px=${L.px.toFixed(2)} py=${L.py.toFixed(2)}`;
        if (L.won) return `won t=${L.t.toFixed(2)}`;
        k.left = 0; k.right = 0;
        const j = SINGLE[i](L, k, st);
        k.left = !!k.left; k.right = !!k.right;
        if (j) { k.jump = true; R.pressed.add('jump'); st.hold = 60; }
        if (st.hold > 0) { st.hold--; k.jump = true; } else k.jump = false;
        L.step(R.STEP);
      }
      return 'timeout';
    };
    const runDuo = (mode, i, pol) => {
      R.load(i, mode);
      const st = {}, hold = [0, 0], once = [{}, {}];
      const L0 = R.game.level;
      const actors = L0.players.map((p, k) => {
        const kb = () => (R.game.level.swap ? 1 - k : k);
        const a = {
          p, get x() { return p.x + p.w / 2; }, get y() { return p.y + p.h / 2; }, get g() { return p.grounded; },
          set(l, r) { const c = R.ctl[kb()]; c.left = l; c.right = r; },
          go(d) { a.set(d < 0, d > 0); },
          right(on) { a.set(false, !!on); },
          to(x, tol = 0.15) { const dx = x - a.x; if (Math.abs(dx) < tol) { a.go(0); return true; } a.go(Math.sign(dx)); return false; },
          jump(h = 60) { R.pressedAll[kb()].add('jump'); hold[kb()] = h; },
          jumpOnce(n, h) { if (!once[k][n]) { once[k][n] = 1; a.jump(h); } },
        };
        return a;
      });
      for (let n = 0; n < 120 * 30; n++) {
        const L = R.game.level;
        if (L.over) { const d = L.victim; return `DEAD (P${d.idx + 1}, ${L.cause}) at x=${(d.x + 0.4).toFixed(2)} y=${(d.y + 0.45).toFixed(2)} ph=${st.ph}`; }
        if (L.won) return `won t=${L.t.toFixed(2)}`;
        for (const c of R.ctl) { c.left = false; c.right = false; }
        pol(L, actors[0], actors[1], st);
        for (let k = 0; k < 2; k++) { R.ctl[k].jump = hold[k] > 0; if (hold[k] > 0) hold[k]--; }
        L.step(R.STEP);
      }
      const L = R.game.level;
      return `timeout ph=${st.ph} ` + L.players.map((p) => `P${p.idx + 1}(${(p.x + 0.4).toFixed(1)},${(p.y + 0.45).toFixed(1)}${p.done ? ' in' : ''})`).join(' ');
    };
    const want = (c, i) => (!onlyCourse || onlyCourse === c) && (!onlyLevel || +onlyLevel === i + 1);
    const names = (m) => window.LEVELS[m];
    SINGLE.forEach((_, i) => want('single', i) && out.push(`[single] ${i + 1} ${names('single')[i].name}: ${runSingle(i)}`));
    MULTI.forEach((pol, i) => want('multi', i) && out.push(`[multi] ${i + 1} ${names('multi')[i].name}: ${runDuo('multi', i, pol)}`));
    SPECIAL.forEach((pol, i) => want('special', i) && out.push(`[special] ${i + 1} ${names('special')[i].name}: ${runDuo('special', i, pol)}`));
    return out;
  }, [onlyCourse, onlyLevel]);
  console.log(res.join('\n'));
  console.log('errors:', errs);
  await b.close();
  const failed = res.filter((r) => !/: won/.test(r)).length + errs.length;
  process.exit(failed ? 1 : 0);
})();
