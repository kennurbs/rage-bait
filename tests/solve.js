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
    const out = [];
    for (const mode of ['single', 'multi', 'special']) {
      for (let i = 0; i < pol.length; i++) {
        R.load(i, mode);
        let res = 'timeout';
        const L0 = R.game.level;
        const sts = L0.players.map(() => ({}));
        for (let n = 0; n < 120 * 25; n++) {
          const L = R.game.level;
          if (L.over) { const d = L.players.find(p => p.dead); res = `DEAD (P${d.idx + 1}) at x=${(d.x + .4).toFixed(2)} y=${(d.y + .45).toFixed(2)}`; break; }
          if (L.won) { res = `won t=${L.t.toFixed(2)}`; break; }
          L.players.forEach((p, k) => {
            const c = R.ctl[k], st = sts[k];
            c.left = false; c.right = false;
            if (p.done) { c.jump = false; return; }
            L.cur = p;
            const j = pol[i](L, c, st);
            c.left = !!c.left; c.right = !!c.right;
            if (j) { c.jump = true; R.pressedAll[k].add('jump'); st.hold = 60; }
            if (st.hold > 0) { st.hold--; c.jump = true; } else c.jump = false;
          });
          L.step(R.STEP);
        }
        if (res === 'timeout') res += ' ' + R.game.level.players.map(p => `P${p.idx + 1}(${(p.x + .4).toFixed(1)},${(p.y + .45).toFixed(1)}${p.done ? ' in' : ''})`).join(' ');
        out.push(`[${mode}] ${i + 1} ${L0.def.name}: ${res}`);
      }
    }
    return out;
  });
  console.log(res.join('\n'));
  console.log('errors:', errs);
  await b.close();
  const failed = res.filter(r => !/: won/.test(r)).length + errs.length;
  process.exit(failed ? 1 : 0);
})();
