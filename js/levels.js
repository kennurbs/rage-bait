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
 */
window.LEVELS = [
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
