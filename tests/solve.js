// Solvability check: a scripted bot plays every level through the deterministic
// test hook (window.__ragebait). Run: node tests/solve.js  (needs playwright)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => {
    const R = window.__ragebait;
    // policies: (L, k, st) => sets k.left/right, returns true to press jump this step
    const J = (st, name, c) => { if (c && !st[name]) { st[name] = 1; return true; } return false; };
    const pol = [
      // 1
      (L, k, st) => { k.right = 1; return J(st, 'a', L.px > 16.2); },
      // 2: jump spikes going right, door flees, go back left jump spike at 5
      (L, k, st) => {
        if (!st.back) { k.right = 1; k.left = 0; if (L.doors[0].tween) st.back = 1; return J(st, 'a', L.px > 11.2); }
        k.right = 0; k.left = 1; return J(st, 'b', L.px < 17.0 && L.px > 15) || J(st, 'c', L.px < 8.6);
      },
      // 3: bait crusher then climb over
      (L, k, st) => {
        if (!st.baited) { k.right = 1; if (L.px > 10.95) st.baited = 1; return false; }
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
        if (st.go) { k.left = 0; k.right = 1; }
        if (st.go) return J(st, 'a', L.px > 6.6) || J(st, 'b', L.px > 10.0 && L.player.grounded && L.player.y < 12);
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
    const out = [];
    for (let i = 0; i < pol.length; i++) {
      R.load(i);
      const k = R.keys; const st = {}; let res = 'timeout';
      for (let n = 0; n < 120 * 20; n++) {
        const L = R.game.level;
        if (L.player.dead) { res = `DEAD at px=${L.px.toFixed(2)} py=${L.py.toFixed(2)}`; break; }
        if (L.won) { res = `won t=${L.t.toFixed(2)}`; break; }
        k.left = 0; k.right = 0;
        const j = pol[i](L, k, st);
        if (j) { k.jump = true; R.pressed.add('jump'); st.hold = 60; }
        if (st.hold > 0) { st.hold--; k.jump = true; } else k.jump = false;
        L.step(R.STEP);
      }
      const L = R.game.level;
      out.push(`${i + 1} ${L.def.name}: ${res} | px=${L.px.toFixed(2)} py=${L.py.toFixed(2)} g=${L.g}`);
    }
    return out;
  });
  console.log(res.join('\n'));
  console.log('errors:', errs);
  await b.close();
  const failed = res.filter(r => !/: won/.test(r)).length + errs.length;
  process.exit(failed ? 1 : 0);
})();
