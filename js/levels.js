/*
 * Level definitions.
 *
 * The world is a 32 x 18 tile grid. Coordinates are in tiles, origin top-left.
 * Each level's build(L) receives the level runtime and uses its helpers:
 *
 *   L.spawn(x, floorY)            player start (standing on floorY)
 *   L.block(x, y, w, h, opts)     solid rectangle. opts: { hidden, crumble }
 *   L.spike(x, y, w, dir, opts)   row of spikes on surface y. dir 'up' | 'down'. opts: { hidden }
 *   L.door(x, floorY, opts)       exit portal. opts: { fake }
 *   L.saw(cx, cy, r)              spinning saw blade (inactive until given vx)
 *   L.pad(x, y, w, gravity)       gravity pad: sets gravity to +1 (down) or -1 (up)
 *   L.flag(x, floorY)             decorative checkpoint flag (100% trustworthy)
 *   L.text(x, y, str)             faint background text
 *
 *   L.on(cond, fn, {repeat})      run fn when cond() becomes true (once by default)
 *   L.wait(sec, fn)               run fn after a delay
 *   L.drop(block, delay, {land})  make a block fall (land: stop on the first solid below)
 *   L.moveDoor(door, x, floorY, speed)
 *   L.say(str)                    speech bubble above the player
 *   L.px / L.py                   player centre; L.near(obj, d); L.touch(obj); L.player
 *                                 (in 2-player modes, conditions are checked for each player
 *                                 and these refer to the player being checked)
 *   L.g, L.invert, L.jumpDelay    gravity sign, inverted controls, jump input lag (s)
 *
 * Co-op helpers (used by the multiplayer and special courses):
 *   L.spawn2(x, floorY)           player 2 start (default: next to player 1)
 *   L.button(x, floorY, w, opts)  pressure plate; .down while a player or crate is on it,
 *                                 .held = seconds held. opts: { color, latch }
 *   L.gate(block, dx, dy, openFn, opts)  slide block by (dx, dy) while openFn() is true.
 *                                 opts: { speed, closeSpeed, color } (color matches a button)
 *   L.crate(x, floorY)            pushable crate; presses buttons, falls, crushes
 *   L.moveBlock(b, x, y, speed)   slide a block to a position
 *   L.swap                        true: each player's keys control the other player
 *   L.all(fn) / L.any(fn) / L.count(fn)  test active players; L.other = the partner
 *   Players can stand on each other's heads.
 */
const SINGLE = [
  {
    name: 'Just Walk Right',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'Get to the portal. Easy.');
      L.block(0, 15, 18, 3);
      const trap = L.block(18, 15, 3, 3);
      L.block(21, 15, 11, 3);
      L.door(28, 15);
      L.on(() => L.px > 17.4, () => L.drop(trap, 0));
    },
  },
  {
    name: 'Mind Your Step',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'No tricks this time. Promise.');
      L.block(0, 15, 32, 3);
      const s1 = L.spike(14, 15, 2, 'up', { hidden: true });
      const s2 = L.spike(5, 15, 1, 'up', { hidden: true });
      const d = L.door(28, 15);
      L.on(() => L.px > 12.2, () => s1.pop());
      L.on(() => L.near(d, 3.2), () => {
        L.moveDoor(d, 2.4, 15, 45);
        L.say('bye!');
        L.on(() => L.px < 8.2, () => s2.pop());
      });
    },
  },
  {
    name: 'Low Ceiling',
    build(L) {
      L.spawn(2, 15);
      L.text(20, 5, 'Watch your head.');
      L.block(0, 15, 32, 3);
      L.block(11, 0, 8, 9);
      const crusher = L.block(11, 9, 8, 3);
      L.on(() => L.px > 10.9, () => L.drop(crusher, 0.12, { land: true }));
      const s = L.spike(24, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 22.2, () => s.pop());
      L.door(28, 15);
    },
  },
  {
    name: 'Up Is Down',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 7, 'Purple pads flip gravity.');
      L.block(0, 0, 32, 3);
      L.block(0, 15, 10, 3);
      L.block(10, 17, 7, 1);
      L.spike(10, 17, 7, 'up');
      L.block(17, 15, 15, 3);
      L.pad(6.5, 15, 2, -1);
      L.pad(21, 3, 2, 1);
      const s = L.spike(13, 3, 2, 'down', { hidden: true });
      L.on(() => L.g < 0 && L.px > 11, () => s.pop());
      L.door(28, 15);
    },
  },
  {
    name: 'Commitment Issues',
    build(L) {
      L.spawn(2, 15);
      L.text(20, 5, 'Almost there!');
      L.block(0, 15, 32, 3);
      L.block(8, 12, 3, 1);
      L.block(13, 9.5, 6, 1);
      const d = L.door(28, 15);
      const spots = [[2.6, 15], [15.4, 9.5]];
      const lines = ['nope', 'not ready'];
      let stage = 0;
      L.on(() => stage < spots.length && !d.tween && L.near(d, 2.7), () => {
        L.moveDoor(d, spots[stage][0], spots[stage][1], 40);
        L.say(lines[stage]);
        stage++;
      }, { repeat: true });
    },
  },
  {
    name: 'Wrong Way',
    build(L) {
      L.spawn(2, 15);
      L.text(4, 7, 'Right is right. Usually.');
      L.block(0, 15, 11, 3);
      L.block(13, 15, 6, 3);
      L.block(21, 15, 11, 3);
      L.on(() => L.px > 5, () => { L.invert = true; L.say('?!'); });
      L.on(() => L.px > 22.5, () => { L.invert = false; L.say('fixed :)'); });
      L.spike(26, 15, 1, 'up');
      L.door(29, 15);
    },
  },
  {
    name: 'Safe Spot',
    build(L) {
      L.spawn(2, 15);
      L.text(9, 7, 'Checkpoints save your progress.');
      L.block(0, 15, 8, 3);
      L.block(8, 15, 1, 3, { crumble: 0.22 });
      L.block(9, 15, 1, 3, { crumble: 0.22 });
      L.block(10, 15, 8, 3);
      const f = L.flag(14, 15);
      const sp = L.spike(10, 15, 8, 'up', { hidden: true });
      L.on(() => L.player.grounded && Math.abs(L.px - 14.5) < 1.3, () => {
        sp.pop();
        f.evil = true;
        L.say('checkpoint saved!');
      });
      for (let x = 18; x < 21; x++) L.block(x, 15, 1, 3, { crumble: 0.22 });
      L.block(21, 15, 11, 3);
      L.door(28, 15);
    },
  },
  {
    name: 'Behind You',
    build(L) {
      L.spawn(2, 15);
      L.text(10, 6, 'Take your time.');
      L.block(0, 15, 9, 3);
      L.block(11, 15, 7, 3);
      L.block(20, 15, 5, 3);
      L.block(26, 15, 1, 3);
      const trap = L.block(27, 15, 2, 3);
      L.block(29, 15, 3, 3);
      const saw = L.saw(-2, 14.2, 0.8);
      L.on(() => L.px > 4, () => { saw.vx = 7; });
      L.on(() => L.px > 26.1, () => L.drop(trap, 0));
      L.door(30, 15);
    },
  },
  {
    name: 'Input Lag',
    build(L) {
      L.jumpDelay = 0.22;
      L.spawn(2, 15);
      L.text(3, 6, 'Is it just me, or is this laggy?');
      L.block(0, 15, 7, 3);
      L.block(10, 15, 4, 3);
      L.block(17, 15, 4, 3);
      L.block(23, 15, 9, 3);
      L.on(() => L.px > 24.5, () => { L.jumpDelay = 0; L.say('lag fixed!'); });
      const s = L.spike(27, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 25.2, () => s.pop());
      L.door(29.6, 15);
    },
  },
  {
    name: 'The End',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'Final level. You made it!');
      L.block(0, 15, 22, 3);
      const trap = L.block(22, 15, 10, 3);
      L.block(17, 6, 8, 1);
      L.door(21.5, 6);
      L.block(9, 12, 2, 1, { hidden: true });
      L.block(13, 9, 2, 1, { hidden: true });
      const fake = L.door(28, 15, { fake: true });
      L.on(() => L.touch(fake), () => {
        L.fakeWin();
        L.wait(1.1, () => { L.drop(trap, 0); L.banner = { text: 'JK', sub: 'that one was fake', t: 0 }; });
      });
    },
  },
];

// ---------------------------------------------------------------- multiplayer course
// Two players, co-op puzzles. Both players must enter the portal.
const MULTI = [
  {
    name: 'Hold The Door',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'One holds the plate. One goes through.');
      L.block(0, 15, 32, 3);
      L.block(19, 0, 2, 3);
      const gate = L.block(19, 3, 2, 12);
      const a = L.button(13, 15, 1.4), b = L.button(25, 15, 1.4);
      L.gate(gate, 0, -6, () => a.down || b.down, { speed: 10, closeSpeed: 30, color: 'orange' });
      const s = L.spike(22, 15, 2, 'up', { hidden: true });
      L.on(() => L.px > 20.6, () => s.pop());
      const d = L.door(29, 15);
      L.on(() => L.near(d, 2.6), () => { L.moveDoor(d, 8, 15, 35); L.say('wrong side lol'); });
    },
  },
  {
    name: 'Boost',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 5, 'Too tall for one. Not for two.');
      L.block(0, 15, 14, 3);
      L.block(14, 11, 12, 7);
      for (let x = 26; x < 28; x++) L.block(x, 11, 1, 7, { crumble: 0.12 });
      L.block(28, 11, 4, 7);
      const step = L.block(-3, 12, 3, 0.6);
      const btn = L.button(18, 11, 1.4, { color: 'green' });
      let until = -1;
      L.on(() => btn.down, () => { until = L.t + 1.5; }, { repeat: true });
      L.gate(step, 13, 0, () => L.t < until, { speed: 14, color: 'green' });
      const s = L.spike(22, 11, 2, 'up', { hidden: true });
      L.on(() => L.py < 11 && L.px > 20.4, () => s.pop());
      L.door(29.4, 11);
    },
  },
  {
    name: 'Angry Plate',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'Plates hold things up. Do not overstay.');
      L.block(0, 15, 32, 3);
      L.block(10, 0, 10, 7);
      const crs = [L.block(10, 10, 5, 5), L.block(15, 10, 5, 5)];
      const s = L.button(5, 15, 1.4, { color: 'red' }), e = L.button(25, 15, 1.4, { color: 'red' });
      crs.forEach((c) => L.gate(c, 0, -3, () => s.down || e.down, { speed: 12, closeSpeed: 25, color: 'red' }));
      const es = L.spike(24.7, 15, 2, 'up', { hidden: true });
      L.on(() => e.held > 2.3, () => { es.pop(); L.say('too long!'); });
      L.door(29, 15);
    },
  },
  {
    name: 'Two Keys',
    build(L) {
      L.spawn(9, 15); L.spawn2(22, 15);
      L.text(9, 5, 'Both plates. Same time.');
      L.block(0, 15, 6, 3);
      L.block(6, 15, 1, 3, { crumble: 0.15 }); L.block(7, 15, 1, 3, { crumble: 0.15 });
      L.block(8, 15, 16, 3);
      L.block(24, 15, 1, 3, { crumble: 0.15 }); L.block(25, 15, 1, 3, { crumble: 0.15 });
      L.block(26, 15, 6, 3);
      const a = L.button(2.5, 15, 1.4, { color: 'purple' }), b = L.button(28, 15, 1.4, { color: 'purple' });
      let open = false;
      const cage = [L.block(13.5, 10.5, 4.5, 0.5), L.block(13.5, 11, 0.5, 4), L.block(17.5, 11, 0.5, 4)];
      cage.forEach((c) => L.gate(c, 0, -7, () => open, { speed: 8, color: 'purple' }));
      const sa = L.spike(1, 15, 4, 'up', { hidden: true }), sb = L.spike(27, 15, 4, 'up', { hidden: true });
      L.on(() => a.down && b.down, () => { open = true; L.say('unlocked. now run.'); L.wait(0.5, () => { sa.pop(); sb.pop(); }); });
      L.door(15.15, 15);
    },
  },
  {
    name: 'Going Up',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 5, 'Blue plates call the lift.');
      L.block(0, 15, 32, 3);
      L.block(16, 6.4, 13, 1);
      L.block(16, 7.4, 1, 7.6);
      const lift = L.block(12, 14.4, 3, 0.6);
      const b1 = L.button(5, 15, 1.4, { color: 'blue' }), b2 = L.button(22, 6.4, 1.4, { color: 'blue' });
      L.gate(lift, 0, -8, () => b1.down || b2.down, { speed: 4, color: 'blue' });
      const s = L.spike(17, 6.4, 2, 'up', { hidden: true });
      L.on(() => L.py < 7 && L.px > 12 && L.px < 15.5, () => s.pop());
      const d = L.door(26, 6.4);
      L.on(() => L.near(d, 2.6), () => { L.moveDoor(d, 23, 15, 30); L.say('down here now'); });
    },
  },
  {
    name: 'Two Lanes',
    build(L) {
      L.spawn(2, 8); L.spawn2(2, 15);
      L.text(4, 3, 'Top lane, bottom lane. Each holds the other\'s door.');
      L.block(0, 15, 32, 3);
      L.block(0, 8, 20, 1);
      L.block(21, 8, 5, 1);
      const g1 = L.block(14, 4, 1, 4);
      const g2 = L.block(20, 8, 1, 7);
      const b1 = L.button(9, 15, 1.4, { color: 'green' });
      const b2 = L.button(17, 8, 1.4, { color: 'purple' });
      L.gate(g1, 0, -4, () => b1.down, { speed: 10, closeSpeed: 20, color: 'green' });
      L.gate(g2, 0, -7, () => b2.down, { speed: 10, closeSpeed: 25, color: 'purple' });
      const up = L.spike(23, 8, 1, 'up', { hidden: true });
      L.on(() => L.py < 8 && L.px > 21.3, () => up.pop());
      const low = L.spike(24, 15, 2, 'up', { hidden: true });
      L.on(() => L.py > 10 && L.px > 22.3, () => low.pop());
      L.door(29, 15);
    },
  },
  {
    name: 'Weight Limit',
    build(L) {
      L.spawn(2, 15);
      L.text(8, 5, 'Bridge capacity: 1 person.');
      L.block(0, 15, 9, 3);
      const bridge = [];
      for (let x = 9; x < 23; x++) bridge.push(L.block(x, 15, 1, 1));
      L.block(23, 15, 9, 3);
      L.block(9, 9, 14, 3);
      L.spike(9, 12, 14, 'down');
      L.on(() => L.count((p) => bridge.includes(p.ground)) >= 2, () => {
        bridge.forEach((b, i) => L.drop(b, i * 0.02));
        L.say('too heavy!');
      });
      const saw = L.saw(-2, 14.2, 0.8);
      L.on(() => L.px > 23.5, () => { saw.vx = 6.5; });
      L.door(29, 15);
    },
  },
  {
    name: 'Swap Meet',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'Your controls are yours. For now.');
      L.block(0, 15, 11, 3);
      L.block(13, 15, 5, 3);
      L.block(20, 15, 4, 3);
      L.block(26, 15, 6, 3);
      L.on(() => L.px > 7, () => { L.swap = true; L.say('swapped!'); });
      L.on(() => L.px > 21.5, () => { L.swap = false; L.say('unswapped!'); });
      const s = L.spike(29, 15, 1, 'up', { hidden: true });
      L.on(() => L.player.grounded && L.px > 26.3, () => s.pop());
      L.door(30.4, 15);
    },
  },
  {
    name: 'Crate Expectations',
    build(L) {
      L.spawn(11, 15);
      L.text(10, 5, 'Something heavy would help.');
      L.block(0, 11, 8, 7);
      L.block(8, 15, 24, 3);
      const crate = L.crate(4, 11);
      const btn = L.button(8.1, 15, 2.4, { color: 'orange' });
      const cage = [L.block(24, 10.5, 4.5, 0.5), L.block(24, 11, 0.5, 4), L.block(28, 11, 0.5, 4)];
      cage.forEach((c) => L.gate(c, 0, -7, () => btn.down, { speed: 3, closeSpeed: 20, color: 'orange' }));
      const s = L.spike(20, 15, 2, 'up', { hidden: true });
      L.on(() => crate.y > 13.5, () => s.pop());
      L.door(25.65, 15);
    },
  },
  {
    name: 'Trust Issues',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 4, 'Last one. Two portals. Choose wisely.');
      L.block(0, 15, 22, 3);
      const trap = L.block(22, 15, 10, 3);
      L.block(19, 6, 13, 1);
      const lift = L.block(14, 14.4, 3, 0.6);
      const b1 = L.button(6, 15, 1.4, { color: 'blue' }), b2 = L.button(24, 6, 1.4, { color: 'blue' });
      L.gate(lift, 0, -8.4, () => b1.down || b2.down, { speed: 4.5, color: 'blue' });
      const s = L.spike(19, 6, 2, 'up', { hidden: true });
      L.on(() => L.py < 7 && L.px < 18, () => s.pop());
      L.door(29, 6);
      const fake = L.door(28, 15, { fake: true });
      L.on(() => L.touch(fake), () => {
        L.fakeWin();
        L.wait(1.1, () => { L.drop(trap, 0); L.banner = { text: 'JK', sub: 'did you really think...', t: 0, life: 1.5 }; });
      });
    },
  },
];

// ---------------------------------------------------------------- special course
// Two players chained together (about 4 tiles of chain). One portal touch takes both.
const SPECIAL = [
  {
    name: 'Tethered',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'Jump together. Land together.');
      L.block(0, 15, 14, 3);
      const trap = L.block(14, 15, 4, 3);
      L.block(18, 15, 14, 3);
      L.on(() => L.px > 14.6, () => L.drop(trap, 0));
      const s = L.spike(23, 15, 2, 'up', { hidden: true });
      L.on(() => L.px > 21.2, () => s.pop());
      L.door(29, 15);
    },
  },
  {
    name: 'Haul',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'One climbs. One gets dragged.');
      L.block(0, 15, 12, 3);
      L.block(12, 11, 20, 7);
      const s = L.spike(20, 11, 2, 'up', { hidden: true });
      L.on(() => L.py < 11 && L.px > 18.4, () => s.pop());
      L.door(29, 11);
    },
  },
  {
    name: 'Counterweight',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'The chain is short. The crate is not chained.');
      L.block(0, 15, 10, 3);
      L.block(10, 17.5, 3, 0.5);
      L.block(13, 15, 19, 3);
      const btn = L.button(10.6, 17.5, 1.6, { color: 'orange' });
      const crate = L.crate(6, 15);
      L.block(21, 0, 1, 3);
      const gate = L.block(21, 3, 1, 12);
      L.gate(gate, 0, -6, () => btn.down, { speed: 8, closeSpeed: 30, color: 'orange' });
      L.on(() => L.px > 22.5, () => L.wait(0.3, () => { crate.gone = true; L.say('the crate broke'); }));
      L.door(29, 15);
    },
  },
  {
    name: 'Lift Together',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 5, 'Room for two. Not on top of each other.');
      L.block(0, 15, 32, 3);
      L.spike(17, 15, 15, 'up');
      L.block(15, 7, 17, 1);
      L.block(11, 3.5, 6, 1);
      L.spike(11, 4.5, 6, 'down');
      const lift = L.block(12, 14.4, 3, 0.6);
      let up = false, waitT = 0;
      L.on(() => Math.abs(lift.y - (up ? 7 : 14.4)) < 1e-6, () => {
        if (!waitT) waitT = L.t + 1.2;
        if (L.t >= waitT) { up = !up; waitT = 0; L.moveBlock(lift, 12, up ? 7 : 14.4, 3); }
      }, { repeat: true });
      const s = L.spike(19, 7, 1, 'up', { hidden: true });
      L.on(() => lift.y < 7.5, () => s.pop());
      L.door(29, 7);
    },
  },
  {
    name: 'Leash',
    build(L) {
      L.spawn(2, 15);
      L.text(6, 5, 'Run. Together.');
      L.block(0, 15, 9, 3);
      L.block(12, 15, 4, 3);
      L.block(19, 15, 4, 3);
      L.block(26, 15, 6, 3);
      const saw = L.saw(-2, 14.2, 0.8);
      L.on(() => L.px > 3.5, () => { saw.vx = 6.5; });
      const s = L.spike(28, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 26.5, () => s.pop());
      L.door(30, 15);
    },
  },
  {
    name: 'Weight Limit',
    build(L) {
      L.spawn(2, 15);
      L.text(19.5, 6, 'Bridge capacity: 1 person.');
      L.block(0, 15, 7, 3);
      const bridge = [];
      for (let x = 8; x < 19; x++) bridge.push(L.block(x, 15, 1, 1));
      L.block(20, 15, 12, 6);
      L.block(9, 0, 9, 12.9);
      L.spike(9, 12.9, 9, 'down');
      L.on(() => L.count((p) => bridge.includes(p.ground)) >= 2, () => {
        bridge.forEach((b, i) => L.drop(b, i * 0.02));
        L.say('too heavy!');
      });
      L.door(29, 15);
    },
  },
  {
    name: 'Up Is Down (Together)',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 8, 'When one flips, you both flip.');
      L.block(0, 0, 14, 3);
      L.block(17, 0, 15, 3);
      L.block(0, 15, 10, 3);
      L.block(10, 17, 9, 1);
      L.spike(10, 17, 9, 'up');
      L.block(19, 15, 13, 3);
      L.pad(6, 15, 2, -1);
      L.pad(23, 3, 2, 1);
      L.door(29, 15);
    },
  },
  {
    name: 'Lift Off',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 5, 'Press it, then hop on. Both of you.');
      L.block(0, 15, 32, 3);
      L.block(18, 6, 14, 1);
      L.block(18, 7, 1, 8);
      L.block(11, 3.5, 7, 1);
      L.spike(11, 4.5, 7, 'down');
      const pillar = L.block(15, 14.4, 3, 0.6);
      const btn = L.button(8, 15, 1.4, { color: 'green', latch: true });
      let goAt = null;
      L.on(() => btn.down, () => { goAt = L.t + 1.4; L.say('hop on!'); });
      L.gate(pillar, 0, -8.4, () => goAt !== null && L.t >= goAt, { speed: 3.5, color: 'green' });
      const s = L.spike(22, 6, 2, 'up', { hidden: true });
      L.on(() => L.py < 7 && L.px > 19.5, () => s.pop());
      L.door(29, 6);
    },
  },
  {
    name: 'Crumble Run',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'The floor only holds you once.');
      L.block(0, 15, 6, 3);
      for (let x = 6; x < 24; x++) L.block(x, 15, 1, 1, { crumble: 0.12 });
      L.block(24, 15, 8, 6);
      const s = L.spike(27, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 25.3, () => s.pop());
      L.door(29.5, 15);
    },
  },
  {
    name: 'The End (Together)',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 5, 'Final level. You both made it!');
      L.block(0, 15, 22, 3);
      const trap = L.block(22, 15, 10, 3);
      L.block(17, 6, 8, 1);
      L.door(21.5, 6);
      L.block(9, 12, 2, 1, { hidden: true });
      L.block(13, 9, 2, 1, { hidden: true });
      const fake = L.door(28, 15, { fake: true });
      L.on(() => L.touch(fake), () => {
        L.fakeWin();
        L.wait(1.1, () => { L.drop(trap, 0); L.banner = { text: 'JK', sub: 'not even together', t: 0, life: 1.5 }; });
      });
    },
  },
];

window.LEVELS = { single: SINGLE, multi: MULTI, special: SPECIAL };
