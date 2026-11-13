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
    // Hop runner for the long single-player levels. H is a list of hops; each one walks to `prep` (or
    // just stops, with stop: 1, on narrow footholds), waits for ok(L), runs in direction d (0 = jump in
    // place), then at `at` (a number, or a function of L) either jumps (holding jump for `hold` steps, default a full jump) or, with
    // walk: 1, moves on to the next hop. In the air it steers toward `to`, once above `upTo` (ladders).
    // o.pause(L): while grounded and true, stand still and wait.
    const hopper = (H, o = {}) => (L, k, st) => {
      const p = L.player; st.i = st.i || 0; const h = H[st.i];
      if (!h) return false;
      const press = (d) => { if ((d > 0) !== L.invert) k.right = 1; else k.left = 1; };
      const next = () => { st.i++; st.ready = 0; st.air = 0; };
      if (st.air) {
        if (p.grounded && L.t > st.air) next();
        else if (h.to !== undefined && (h.upTo === undefined || L.py < h.upTo) && (h.to - L.px) * h.d > 0.3) press(h.d);
        return false;
      }
      if (o.pause && p.grounded && o.pause(L)) return false;
      if ((h.prep !== undefined || h.stop) && !st.ready) {
        if (!h.stop && Math.abs(L.px - h.prep) > 0.12) press(Math.sign(h.prep - L.px));
        else if (Math.abs(p.vx) < 0.3 && (!h.ok || h.ok(L))) st.ready = 1;
        return false;
      }
      if (h.d) press(h.d);
      const at = typeof h.at === 'function' ? h.at(L) : h.at;
      if ((!h.d || (L.px - at) * h.d >= 0) && p.grounded) {
        if (h.walk) { next(); return false; }
        st.air = L.t + 0.05; return h.hold || true;
      }
      return false;
    };
    const crusherSafe = (L, o) => { const ph = (L.t + o) % 1.8; return ph > 1.18 && ph < 1.28; };
    // Red Light: your colour is up, with at least `min` seconds left on it
    const rlGo = (min) => (L) => L.light === L.go && L.lightEnds - L.t > min;
    // Deja Vu: the pit saw is on its way down and low enough to jump over
    const pitSafe = (L) => Math.sin(L.t * 2.4) > 0.17 && Math.cos(L.t * 2.4) > 0;
    const dejaEven = hopper([
      { d: 1, at: 6.7, to: 11.6 },                                          // floor spike at 9
      { d: 1, prep: 13.6, ok: pitSafe, at: 13.8, to: 18.8 },                // pit
      { d: 1, at: 25.2, to: 28 },                                           // step (take off before its edge)
      { d: 1, prep: 27.4, at: 27.4, to: 31.1 },                             // platform: the high portal is real
    ]);
    const dejaOdd = hopper([
      { d: 1, prep: 13.6, ok: pitSafe, at: 13.8, to: 18.6 },                // pit (no jumping near 9: roof trap)
      { d: 1, at: 19.7, to: 25.0 },                                         // floor spike at 22
      { d: 1, at: 30.8, walk: 1 },                                          // the low portal is real
    ]);
    // The Undoing, room by room. room B's laser in the 5x zone is off for (t % 1.6) in [0.8, 1.6)
    const undoing = {
      A: hopper([
        { d: 1, prep: 4.5, ok: rlGo(1.0), at: 4.8, to: 10.0 },             // onto the first fake strip
        { d: 1, stop: 1, ok: rlGo(1.0), at: 10.5, to: 14.6 },              // second fake strip
        { d: 1, stop: 1, ok: rlGo(1.0), at: 15.5, to: 21 },                // island
        { d: 1, prep: 25.2, ok: rlGo(1.0), at: 27, walk: 1 },              // walk off into the pit
      ], { pause: (L) => L.light !== L.go }),
      B: hopper([
        { d: 1, stop: 1, ok: (L) => L.py > 14, at: 0, walk: 1 },           // fall all the way in to floor 0 first
        { d: 1, at: 9.0, to: 13, hold: 4 },                                // tap under the spike ceiling
        { d: 1, prep: 13.4, ok: (L) => { const c = L.t % 1.6; return c > 0.8 && c < 1.15; }, at: 23.0, walk: 1 }, // 5x through the laser
        { d: 1, at: 23.4, to: 27.5 },                                      // teleport tile
        { d: -1, prep: 29.8, at: 29.8, hold: 130, upTo: 9.2, to: 27 },     // ladder up to floor 1
        { d: -1, at: 22.3, to: 18.8 },                                     // teleport tile
        { d: -1, at: 14.3, to: 10.8 },                                     // hole
        { d: -1, prep: 4.7, at: 4.7, hold: 260 },                          // ladder out through the ceiling
      ]),
      C: hopper([
        { d: 1, prep: 1.5, ok: (L) => L.blocks[0].y <= 9.001, at: 2.3, to: 6.4 }, // top of the rise: running jump over the saw into the near portal
      ]),
    };
    // seconds left in a laser's off window (-1 while it is on)
    const off = (l, L) => { const c = (L.t + l.phase) % (l.on + l.off); return c < l.on ? -1 : l.on + l.off - c; };
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
      // 11 Groundwork: run fast over crumble, jump gaps, avoid saw
      (L, k, st) => {
        k.right = 1;
        return J(st, 'a', L.px > 7.2 && L.player.grounded) || J(st, 'b', L.px > 13.5 && L.player.grounded) ||
               J(st, 'c', L.px > 20.8 && L.player.grounded) || J(st, 'd', L.px > 24.5 && L.player.grounded);
      },
      // 12 Gravity Well: use pads, avoid hidden spikes
      (L, k, st) => {
        k.right = 1;
        return J(st, 'a', L.px > 5.5 && L.player.grounded && L.g > 0) ||
               J(st, 'b', L.px > 10 && L.player.grounded) ||
               J(st, 'c', L.px > 13.5 && L.player.grounded && L.g > 0) ||
               J(st, 'd', L.px > 25, 'skip');
      },
      // 13 Saw Alley: run, avoid saws
      (L, k, st) => { k.right = 1; return J(st, 'a', L.px > 28.5 && L.player.grounded); },
      // 14 Flip Flop: use pads, lag-adjusted jumps (press early)
      (L, k, st) => {
        k.right = 1;
        return J(st, 'a', L.px > 3.4 && L.player.grounded && L.g > 0) ||
               J(st, 'b', L.px > 10.5 && L.player.grounded) ||
               J(st, 'c', L.px > 18.5 && L.player.grounded && L.g > 0) ||
               J(st, 'd', L.px > 25.4 && L.player.grounded);
      },
      // 15 Mirror Maze: ignore mirror/invert, navigate to actual door coords
      (L, k, st) => {
        // the real second door is placed at x=2, so after mirror is off, go right to door at x≈29
        if (L.invert) { k.left = 1; k.right = 0; } else { k.right = 1; k.left = 0; }
        return J(st, 'a', L.px > 10 && L.player.grounded) || J(st, 'b', L.px > 25 && L.player.grounded);
      },
      // 16 Thin Ice: run fast, jump at halfway for crusher dodge, then jump final saw
      (L, k, st) => {
        k.right = 1;
        return J(st, 'a', L.px > 14.5 && L.player.grounded) || J(st, 'b', L.px > 27.5 && L.player.grounded);
      },
      // 17 The Betrayal: avoid evil flag, jump over spike2, then climb hidden platforms
      (L, k, st) => {
        const p = L.player;
        // phase 0: run right; jump at x=3.5 to clear s1 (x=5–8), jump at x=21 to clear s2 (x=22–26)
        if (!st.s) {
          k.right = 1;
          if (L.px > 24.5 && p.grounded) { st.s = 1; return false; }
          return J(st, 'a', L.px > 3.5 && p.grounded) || J(st, 'b', L.px > 21 && p.grounded);
        }
        // phase 1: arrived past spike zone on floor (~x=26). Walk back left to x≈22, jump to y=13.5 platform
        if (!st.s2) {
          k.right = 0; k.left = 0;
          if (p.grounded && p.y > 14) {
            if (L.px > 22.5) { k.left = 1; return false; }   // walk back toward x=22
            return J(st, 'c', L.px > 21.5 && p.grounded);    // jump to y=13.5 block (x=21–23)
          }
          if (p.y < 14) st.s2 = 1;   // landed on elevated platform
          return false;
        }
        // phase 2: on y=13.5 platform, walk right and jump to y=12 platform (x=25–27)
        if (!st.s3) {
          k.right = 1;
          if (J(st, 'd', L.px > 22.5 && p.grounded && p.y < 14)) return true;
          if (p.grounded && p.y < 13) st.s3 = 1;
          return false;
        }
        // phase 3: on y=12 platform, walk right into real door at x=25
        k.right = 1; return false;
      },
      // 18 Crusher Gauntlet: dash through each corridor, stay away from landing zones
      (L, k, st) => {
        k.right = 1;
        return J(st, 'a', L.px > 5.6 && L.player.grounded) || J(st, 'b', L.px > 10.5 && L.player.grounded) ||
               J(st, 'c', L.px > 16.5 && L.player.grounded) || J(st, 'd', L.px > 22.5 && L.player.grounded);
      },
      // 19 Chaos Engine: navigate with shifting controls
      (L, k, st) => {
        if (L.invert) { k.left = 1; k.right = 0; } else { k.right = 1; k.left = 0; }
        return J(st, 'a', L.px > 8.6 && L.player.grounded) || J(st, 'b', L.px > 16.6 && L.player.grounded) ||
               J(st, 'c', L.px > 24.6 && L.player.grounded);
      },
      // 20 The Reckoning: gravity, crumble, invert, crusher, lag, then single door moves up
      // Door starts at (28,15), moves to (29.5,9.5) when approached.
      // Staircase: floor(y=15) → y=13 (x=26–28.5) → y=11 (x=28.5–31) → y=9.5 (x=29–32) → door(29.5,9.5)
      (L, k, st) => {
        const p = L.player;
        if (L.invert) { k.left = 1; k.right = 0; } else { k.right = 1; k.left = 0; }
        // phase 0: gravity flip zone (pads at x=4–6 and x=8–10), then crumble+invert stretch
        if (!st.s) {
          if (J(st, 'a', L.px > 3.5 && p.grounded && L.g > 0)) return true;  // jump before gravity pad
          if (J(st, 'b', L.px > 7.5 && p.grounded)) return true;              // jump to restore gravity
          if (p.grounded && L.px > 10 && L.px < 18) st.s = 1;
          return false;
        }
        // phase 1: past the crusher island (x=18–22). Walk right to trigger door move.
        if (!st.s2 && p.grounded && L.px > 22) st.s2 = 1;
        if (!st.s2) return false;
        // phase 2: walk right until door moves (triggered at ~x=26), then climb step 1
        if (!st.s3) {
          if (J(st, 'c', L.px > 26.5 && p.grounded && p.y > 14)) return true;
          if (p.grounded && p.y < 13.5) st.s3 = 1;
          return false;
        }
        // phase 3: on y=13 platform, jump to y=11 platform (x=28.5–31)
        if (!st.s4) {
          if (J(st, 'd', L.px > 27.5 && p.grounded && p.y < 13.5)) return true;
          if (p.grounded && p.y < 11.5) st.s4 = 1;
          return false;
        }
        // phase 4: on y=11 platform, jump to solid block at y=9.5 (x=29–32) then walk into door
        if (!st.s5) {
          if (J(st, 'e', L.px > 29 && p.grounded && p.y < 11.5)) return true;
          if (p.grounded && p.y < 10) st.s5 = 1;
          return false;
        }
        // phase 5: on top block, walk right into door at x=29.5 (wait for tween to finish)
        k.right = 1; return false;
      },
      // 21 Leap of Faith: jump the first hole into the middle one, land in the bonus room, walk to its portal
      (L, k, st) => { k.right = 1; return J(st, 'a', L.player.grounded && L.px > 2.9); },
      // 22 Gotta Go Fast: wait out each laser, tap-hop spikes at 5x, zigzag up three floors, outrun the corridor spikes
      (L, k, st) => {
        const p = L.player, las = L.lasers, g = p.grounded;
        st.ph = st.ph || 0;
        if (st.ph === 0) { if (off(las[0], L) > 0.5) st.ph = 1; return false; }
        if (st.ph === 1) { k.right = L.px < 19; if (L.px > 18.5 && g) st.ph = 2; return J(st, 'a', L.px > 9.3) ? 8 : false; }
        if (st.ph === 2) { if (off(las[1], L) > 0.4) st.ph = 3; return false; }
        // run to the step, hop on, hop up-left onto floor 2
        if (st.ph === 3) { k.right = 1; if (g && L.py < 13.5) st.ph = 4; return J(st, 'b', g && L.px > 26.8); }
        if (st.ph === 4) { k.right = L.px < 30.5; if (L.px > 30.3) st.ph = 5; return false; }
        if (st.ph === 5) { k.left = L.px > 26.8 || g; k.right = !g && L.px < 26; if (g && L.py < 11) st.ph = 6; return J(st, 'c', g && L.px < 29.4); }
        // floor 2: onto platform 1, wait for the laser, platform 2, down to the floor
        if (st.ph === 6) { k.left = L.px > 25.6; if (L.px < 25.7 && Math.abs(p.vx) < 0.5) st.ph = 7; return false; }
        if (st.ph === 7) { k.left = L.px > 21.9; if (g && L.py < 9.5) st.ph = 8; return J(st, 'd', g); }
        if (st.ph === 8) { k.right = L.px < 21.7; if (off(las[2], L) > 0.6 && Math.abs(p.vx) < 0.5) st.ph = 9; return false; }
        if (st.ph === 9) { k.left = L.px > 17.2; if (g && L.px < 18) st.ph = 10; return J(st, 'e', g && L.px < 21.4); }
        if (st.ph === 10) { k.left = 1; if (g && L.py > 10) st.ph = 11; return J(st, 'f', g && L.px < 17.4); }
        if (st.ph === 11) { k.right = L.px < 12.6; if (Math.abs(p.vx) < 0.5 && off(las[3], L) > 0.45) st.ph = 12; return false; }
        // 5x dash left: hop the spike, through the laser, then climb the step and up to floor 3
        if (st.ph === 12) { k.left = 1; if (g && L.px < 4.5) st.ph = 13; return J(st, 'g', L.px < 11.3) ? 8 : false; }
        if (st.ph === 13) { k.right = L.px < 3.9; if (L.px > 3.8 && Math.abs(p.vx) < 0.5) st.ph = 14; return false; }
        if (st.ph === 14) { k.left = L.px > 2; if (g && L.py < 8) st.ph = 15; return J(st, 'h', g); }
        if (st.ph === 15) { k.right = 1; return J(st, 'i', g) || J(st, 'j', g && L.py < 5 && L.px > 28.3); }
        return false;
      },
      // 23 Floor Is Lava
      hopper([
        { d: 1, at: 4.6, to: 10.0 },                   // onto the first fake spikes
        { d: 1, stop: 1, at: 10.5, to: 14.6 },         // second fake spikes
        { d: 1, stop: 1, at: 15.5, to: 21 },           // island
        { d: 1, at: 25.3, to: 29.5 },                  // step up
        { d: -1, prep: 31, at: 29.2, to: 25 },         // tier 2
        { d: -1, prep: 23.7, ok: (L) => crusherSafe(L, 0), at: 19.2, walk: 1 },   // under crusher A
        { d: -1, prep: 19.2, ok: (L) => crusherSafe(L, 0.43), at: 15.9, walk: 1 }, // under crusher B
        { d: -1, stop: 1, at: 15.0, to: 12.6 },        // bait: jump long (saw 1 lunges far), steer back short
        { d: -1, stop: 1, ok: (L) => L.saws[0].vx === 0, at: 12.0, to: 9.4 }, // over stalled saw 1; baits saw 2
        { d: -1, at: 8.1, to: 3.6 },                   // over stalled saw 2
        { d: -1, prep: 3.4, at: 3.4, to: 1.0 },        // step up
        { d: 1, prep: 0.6, at: 1.6, to: 5.2 },         // tier 3
        { d: 1, prep: 5.2, at: 5.8, to: 9.5 },         // fake spikes
        { d: 1, stop: 1, at: 9.7, to: 14.6 },          // over the double fake onto fake spikes
        { d: 1, stop: 1, at: 15.3, to: 18.5 },
        { d: 1, at: 21.3, to: 25.2 },                  // jump the last strip; controls invert mid-air
        { d: 1, at: 26.6, walk: 1 },
      ]),
      // 24 Short Hop: tap-hop the floor spikes, full-jump into the fake ceiling spikes over the gap,
      // climb the ladder tiny, then floor -> pad up -> tap the roof spike -> pad down (hug the wall) ->
      // pad up -> ceiling-walk right, hopping two spikes, into the hanging portal
      (L, k, st) => {
        const p = L.player, g = p.grounded;
        if (!st.ph) {
          k.right = 1;
          if (J(st, 'a', g && L.px > 9.0)) return 4;
          if (J(st, 'b', g && L.px > 13.0)) return 4;
          if (J(st, 'c', g && L.px > 16.9)) return 12;
          if (st.c && g && L.px > 20.0) st.ph = 1;
          return false;
        }
        if (st.ph === 1) { if (g && Math.abs(p.vx) < 0.05) { st.ph = 2; return true; } return false; }
        if (st.ph === 2) { if (L.ladders.length && g) { st.ph = 3; return 400; } return false; }
        if (st.ph === 3) { if (L.py < 10.6) k.left = 1; if (g && L.py < 10.6 && L.px < 19.5) st.ph = 4; return false; }
        if (st.ph === 4) { if (L.g > 0) k.left = 1; else if (g) st.ph = 5; return false; }
        if (st.ph === 5) { k.left = 1; if (L.g > 0) st.ph = 6; return J(st, 'd', g && L.px < 12.9) ? 4 : false; }
        if (st.ph === 6) { k.left = 1; if (L.g < 0 && L.py < 6) st.ph = 7; return false; }
        k.right = 1; return J(st, 'e', g && L.px > 10.6) || J(st, 'f', g && L.px > 16.6);
      },
      // 25 Nothing Here (backwards): walk, jump only the real strip, then walk back to where the portal went
      (L, k, st) => {
        if (st.back || L.doors[0].tween || L.doors[0].x < 20) { st.back = 1; k.left = 1; return false; }
        k.right = 1; return J(st, 'a', L.player.grounded && L.px > 24.9);
      },
      // 26 Red Light: freeze whenever your colour isn't up; only start a jump with enough light left
      hopper([
        { d: 1, prep: 5.3, ok: rlGo(1.0), at: 5.6, to: 9.6 },               // pit
        { d: 1, stop: 1, ok: rlGo(1.0), at: 10.6, to: 13.2 },               // spike
        { d: 1, stop: 1, ok: rlGo(1.0), at: 13.8, to: 16.6 },               // pit
        { d: 1, stop: 1, ok: rlGo(1.4), at: (L) => L.saws[0].x - 2.0, to: 30 }, // over the frozen saw
        { d: 1, prep: 23.4, ok: rlGo(1.0), at: 23.8, to: 26 },              // step
        { d: 1, stop: 1, ok: rlGo(1.0), at: 26.5, to: 29.5 },               // platform
        { d: -1, prep: 29.2, ok: rlGo(1.0), at: 28.8, to: 25.5 },           // tier 2: the rules flip
        { d: -1, stop: 1, ok: rlGo(1.0), at: 23.0, to: 19.5 },              // spike
        { d: -1, stop: 1, ok: rlGo(1.35), at: 17.6, to: 12.8 },             // pit, onto the crumbling bridge
        { d: -1, at: 8.6, walk: 1 },                                        // across it in the same light
        { d: -1, stop: 1, ok: rlGo(1.0), at: 4.5, to: 1.8 },                // up to the portal
      ], { pause: (L) => L.light !== L.go }),
      // 27 Elevator Pitch: jump off the first two rides at the right moment, never off the last one
      hopper([
        { d: 1, at: 8.4, walk: 1 },                                         // onto lift 1, right edge
        { d: 1, stop: 1, ok: (L) => L.blocks[1].y <= 8.501, at: 0, to: 12.4 }, // off while it hesitates
        { d: 1, stop: 1, at: 12.6, to: 15.2 },                              // over the ledge spike
        { d: 1, at: 17.6, walk: 1 },                                        // onto the shuttle
        { d: 1, stop: 1, ok: (L) => L.blocks[3].x >= 20, at: 0, to: 27 },  // off before it turns back
        { d: 1, at: 30.6, walk: 1 },                                        // onto lift 2, and stay on it:
      ]),                                                                   // through the fake ceiling and the bonus room
      // 28 Deja Vu: the layout depends on the death count; cross the pit while its saw is low
      (L, k, st) => (L.deaths % 2 ? dejaOdd : dejaEven)(L, k, st),
      // 29 Lights Out: the maze route (floor 0 right, 1 left, 2 right, 3 left), hopping walls, holes and teleport tiles
      hopper([
        { d: 1, at: 7.6, to: 11 },                                          // wall
        { d: 1, at: 17.0, to: 20.5 },                                       // teleport tile
        { d: -1, prep: 28.75, at: 28.75, hold: 130, upTo: 10.3, to: 26 },   // ladder up to floor 1
        { d: -1, at: 25.6, to: 22.6 },                                      // wall
        { d: -1, at: 22.3, to: 19.2 },                                      // teleport tile
        { d: -1, at: 14.3, to: 11.0 },                                      // hole
        { d: 1, prep: 3.75, at: 3.75, hold: 130, upTo: 6.3, to: 6 },        // ladder up to floor 2
        { d: 1, at: 7.6, to: 10.8 },                                        // wall
        { d: 1, at: 13.2, to: 16.4 },                                       // hole
        { d: 1, at: 18.8, to: 21.6 },                                       // teleport tile
        { d: -1, prep: 28.25, at: 28.25, hold: 130, upTo: 2.3, to: 26 },    // ladder up to floor 3
        { d: -1, at: 22.6, to: 19.6 },                                      // wall
        { d: -1, at: 18.2, to: 15.0 },                                      // teleport tile
        { d: -1, at: 12.4, to: 9.2 },                                       // hole
        { d: -1, at: 2.6, walk: 1 },                                        // portal
      ]),
      // 30 The Undoing: one hop list per room
      (L, k, st) => { const r = L.room; st[r] = st[r] || {}; return undoing[r](L, k, st[r]); },
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
      // 11 Hot Potato: A stands on button, B sprints through gate
      (L, A, B, st) => {
        const gate = L.blocks[1], btn = L.buttons[0];
        if (!st.ph) { A.to(7.7); if (btn.down && gate.y < 9) st.ph = 1; return; }
        if (st.ph === 1) { A.to(7.7); B.go(1); if (B.x > 18.4) B.jumpOnce('sp'); if (B.p.done) st.ph = 2; return; }
        if (st.ph === 2) { A.go(1); if (A.x > 18.4) A.jumpOnce('sp'); return; }
      },
      // 12 Switcheroo: A presses right btn, B presses left btn, both pass through opposite gates
      (L, A, B, st) => {
        const gateL = L.blocks[0], gateR = L.blocks[1], btnL = L.buttons[0], btnR = L.buttons[1];
        if (!st.ph) {
          A.to(8.7); B.to(22.7);
          if (btnL.down && btnR.down) st.ph = 1;
          return;
        }
        if (st.ph === 1) { A.go(-1); B.go(1); if (A.x < 2.5) A.jumpOnce('in'); if (B.x > 29) B.jumpOnce('in'); return; }
      },
      // 13 Chain Reaction: A on b1, B on b2, then both rush b3
      (L, A, B, st) => {
        const b1 = L.buttons[0], b2 = L.buttons[1], b3 = L.buttons[2];
        if (!st.ph) { A.to(5.7); B.to(5.7); if (b1.down) st.ph = 1; return; }
        if (st.ph === 1) { A.to(5.7); B.to(16.7); if (b2.down) st.ph = 2; return; }
        if (st.ph === 2) { A.go(1); B.go(1); return; }
      },
      // 14 Gravity Split: gate opens when anyone passes x=14; both go right, jump hidden spike early
      // Spike pops when leader passes x=24; fatal at x≈24.3 — must jump at x=23.5
      (L, A, B, st) => {
        for (const P of [A, B]) { P.go(1); if (P.x > 23.5 && P.g) P.jumpOnce('sp'); }
      },
      // 15 Detonator: quick tap each button, sprint
      (L, A, B, st) => {
        const b1 = L.buttons[0], b2 = L.buttons[1];
        if (!st.ph) { A.to(7.7); if (b1.down && b1.held < 1) st.ph = 1; return; }
        if (st.ph === 1) { A.go(1); B.to(16.7); if (b2.down && b2.held < 1) st.ph = 2; return; }
        if (st.ph === 2) { A.go(1); B.go(1); return; }
      },
      // 16 The See-Saw: A on left plat btn, B on right, both advance
      (L, A, B, st) => {
        const btnL = L.buttons[0], btnR = L.buttons[1];
        if (!st.ph) { A.to(10.7); B.to(20.7); if (btnL.down && btnR.down) st.ph = 1; return; }
        if (st.ph === 1) { for (const P of [A, B]) P.to(16.15); return; }
      },
      // 17 Mimic City: use real crates, avoid mimics
      (L, A, B, st) => {
        const realCrate = L.blocks.find(b => b.crate && !b.mimic && b.x === 5);
        const crate2 = L.blocks.find(b => b.crate && !b.mimic && b.x === 18);
        const btn = L.buttons[0], btn2 = L.buttons[1];
        if (!st.ph) { A.to(8.45); if (near(A, 8.45) && A.g) { B.go(-1); if (B.x < 10.6) B.jumpOnce('head'); if (B.p.onP) st.ph = 1; } else B.to(10.6); return; }
        if (st.ph === 1) { B.go(-1); B.jumpOnce('up'); if (B.y < 11 && B.g) st.ph = 2; return; }
        if (st.ph === 2) { A.to(13); if (realCrate && realCrate.y > 13.5) { if (btn.down) st.ph = 3; } else { if (B.g && B.x < (realCrate ? realCrate.x + 2 : 7) && B.x > 1) B.go(1); } return; }
        if (st.ph === 3) { for (const P of [A, B]) { P.go(1); if (P.x > 20 && crate2 && P.g && P.x < crate2.x + 2) P.jumpOnce('cr'); if (btn2.down) P.to(27.7); } return; }
      },
      // 18 Rope-a-Dope: both go right, jump gaps; ignore swap (positions are correct)
      (L, A, B, st) => {
        for (const P of [A, B]) {
          P.go(1);
          for (const [x, n] of [[8.5, 'a'], [16.5, 'b'], [24.5, 'c']]) if (P.x > x && P.g) P.jumpOnce(n);
        }
      },
      // 19 The Big Push: use real crate to open gate
      (L, A, B, st) => {
        const realCrate = L.blocks.find(b => b.crate && !b.mimic && b.x === 4);
        const btn = L.buttons[0];
        if (!st.ph) { A.to(8.45); if (near(A, 8.45) && A.g) { B.go(-1); if (B.x < 10.6) B.jumpOnce('head'); if (B.p.onP) st.ph = 1; } else B.to(10.6); return; }
        if (st.ph === 1) { B.go(-1); B.jumpOnce('up'); if (B.y < 11 && B.g) st.ph = 2; return; }
        if (st.ph === 2) { A.to(13); if (realCrate && realCrate.y > 13.5 && btn.down) st.ph = 3; else if (realCrate && B.g && B.x < realCrate.x + 2 && B.x > 1) B.go(1); return; }
        if (st.ph === 3) { for (const P of [A, B]) { P.go(1); if (P.x > 20 && P.g) P.jumpOnce('sp'); P.to(28.7); } return; }
      },
      // 20 No Way Out: lift to upper platform, go to real door
      (L, A, B, st) => {
        const lift = L.blocks.find(b => b.h === 0.6);
        const ride = (P, nm) => { if (P.g && P.y > 14) { if (P.x < 13.1) P.go(1); else { P.go(1); P.jumpOnce(nm); } } else if (!P.g && P.x > 14.8) P.go(0); else if (!P.g) P.go(1); };
        if (!st.ph) { ride(B, 'on'); if (lift && B.g && Math.abs(B.p.y + B.p.h - lift.y) < 0.1) st.ph = 1; return; }
        if (st.ph === 1) { A.to(5.7); if (lift && lift.y < 6.5 && !st.j && B.to(15.6)) B.jumpOnce('sp'); if (st.j || B.p.vy < 0) { st.j = 1; B.go(1); } if (B.x > 19 && B.g && B.y < 7) st.ph = 2; return; }
        if (st.ph === 2) { B.to(20.5); if (lift && lift.y <= 14.3 && !st.r) A.to(9); if (!lift || lift.y > 14.3 || st.r) { st.r = 1; ride(A, 'on'); if (A.g && A.y < 14.3) st.ph = 3; } return; }
        if (st.ph === 3) { B.to(20.5); if (lift && lift.y < 6.5 && !st.k && A.to(15.6)) A.jumpOnce('sp'); if (st.k || A.p.vy < 0) { st.k = 1; A.go(1); } if (A.x > 19 && A.g && A.y < 7) st.ph = 4; return; }
        if (st.ph === 4) { for (const P of [A, B]) P.to(20.5); }
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
      // 11 Short Leash: run together, jump pits
      (L, A, B, st) => {
        pair(A, B, (P) => {
          P.go(1);
          if (P.x > 8.2 && P.g) P.jumpOnce('p1');
          if (P.x > 16.2 && P.g) P.jumpOnce('p2');
          if (P.x > 24.2 && P.g) P.jumpOnce('p3');
        });
      },
      // 12 Tandem Vault: leap ledges together
      (L, A, B, st) => {
        pair(A, B, (P) => {
          P.go(1);
          if (P.x > 8.5 && P.g) P.jumpOnce('l1');
          if (P.x > 14.5 && P.g) P.jumpOnce('l2');
          if (P.x > 20.5 && P.g) P.jumpOnce('l3');
        });
      },
      // 13 Inverse Tether: pads flip gravity
      (L, A, B, st) => {
        pair(A, B, (P) => {
          P.go(1);
          if (P.x > 12.3 && P.g) P.jumpOnce('sp');
          if (P.x > 24.3 && P.g) P.jumpOnce('sp2');
        });
      },
      // 14 Guillotine Run: dodge crushers
      (L, A, B, st) => {
        pair(A, B, (P) => {
          P.go(1);
          if (P.x > 10.3 && P.g) P.jumpOnce('sp1');
          if (P.x > 18.3 && P.g) P.jumpOnce('sp2');
        });
      },
      // 15 Slipknot: handle swaps while jumping pits
      (L, A, B, st) => {
        pair(A, B, (P) => {
          P.go(1);
          if (P.x > 7.5 && P.g) P.jumpOnce('p1');
          if (P.x > 15.5 && P.g) P.jumpOnce('p2');
          if (P.x > 23.5 && P.g) P.jumpOnce('p3');
        });
      },
      // 16 Fragile Unity: sprint across crumble
      (L, A, B, st) => {
        pair(A, B, (P) => {
          P.go(1);
          if (P.x > 16.2 && P.g) P.jumpOnce('m');
          if (P.x > 26.2 && P.g) P.jumpOnce('sp');
        });
      },
      // 17 Twin Hazards: time jumps over saws and spikes
      (L, A, B, st) => {
        pair(A, B, (P) => {
          P.go(1);
          if (P.x > 13.2 && P.g) P.jumpOnce('s1');
          if (P.x > 22.2 && P.g) P.jumpOnce('s2');
        });
      },
      // 18 The Chasm Swing: cross the pit
      (L, A, B, st) => {
        pair(A, B, (P) => {
          P.go(1);
          if (P.x > 6.8 && P.g) P.jumpOnce('swing');
          if (P.x > 24.2 && P.g) P.jumpOnce('sp');
        });
      },
      // 19 Chaos Bond: navigate mirror and spikes
      (L, A, B, st) => {
        pair(A, B, (P) => {
          P.go(1);
          if (P.x > 10.2 && P.g) P.jumpOnce('s1');
          if (P.x > 19.2 && P.g) P.jumpOnce('s2');
          if (P.x > 25.2 && P.g) P.jumpOnce('s3');
        });
      },
      // 20 Eternal Bond: combo obstacles to upper ledge, then climb hidden platforms to real door
      (L, A, B, st) => {
        if (!st.ph) {
          pair(A, B, (P) => {
            P.go(1);
            if (P.x > 12.2 && P.g) P.jumpOnce('p1');   // leap over crusher zone (x=14–18)
          });
          if (A.g && B.g && A.x > 23 && B.x > 23) st.ph = 1;
          return;
        }
        // arrived past x=23 on the floor (y≈15). Walk back to x≈22 (above hidden block at y=13)
        if (st.ph === 1) {
          pair(A, B, (P) => {
            const tgt = P.y < 14 ? 25.5 : 22;    // if already elevated, go toward upper block
            P.to(tgt);
            if (near(P, 22, 0.6) && P.g && P.y > 13) P.jumpOnce('up1');  // jump to hidden block at y=13
          });
          if (A.g && B.g && A.y < 14 && B.y < 14) st.ph = 2;
          return;
        }
        // on y=13 platform (x=21–23). Must jump BEFORE walking off edge at x=23.
        // From y=13 block, jump apex reaches y≈9.2 (centre), easily clears y=11 target block.
        // From floor (y=15) the apex is only y≈11.6 — insufficient to land on y=11. Must jump from platform.
        if (st.ph === 2) {
          pair(A, B, (P) => {
            P.go(1);
            if (P.x > 22 && P.g && P.y < 14) P.jumpOnce('up2');  // jump while still on y=13 block
          });
          if (A.g && B.g && A.y < 12 && B.y < 12) st.ph = 3;
          return;
        }
        // on y=11 platform (x=25–27). Walk right into real door at x=25, y≈9.4
        pair(A, B, (P) => P.go(1));
      },
    ];

    const out = [];
    const runSingle = (i) => {
      R.load(i, 'single');
      const k = R.keys; const st = {};
      for (let n = 0; n < 120 * 40; n++) {
        const L = R.game.level;
        if (L.over) return `DEAD at px=${L.px.toFixed(2)} py=${L.py.toFixed(2)}`;
        if (L.won) return `won t=${L.t.toFixed(2)}`;
        k.left = 0; k.right = 0;
        const j = SINGLE[i](L, k, st);
        k.left = !!k.left; k.right = !!k.right;
        // a policy returns true for a full jump, or a step count for a short tap
        if (j) { k.jump = true; R.pressed.add('jump'); st.hold = j === true ? 60 : j; }
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
    // levels that change with the death count: also prove their odd-death layout
    for (const i of [27, 29]) {
      if (!want('single', i)) continue;
      R.save.levelDeaths[String(i)] = 1;
      out.push(`[single] ${i + 1} ${names('single')[i].name} (after a death): ${runSingle(i)}`);
      delete R.save.levelDeaths[String(i)];
    }
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
