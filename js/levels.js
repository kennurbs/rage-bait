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
 *   L.crate(x, floorY, 1, { mimic: true })  touch it and it grows spikes, then crumbles away
 *   L.onJump(fn(p))               run fn whenever a player jumps (partner sabotage)
 *   L.setRope(n)                  change the chain length (special course)
 *   L.yank(p, vx, vy)             throw a player
 *   L.swapPlaces()                teleport the two players into each other's spots
 *   L.mirror() / L.flipView()     mirror the screen left-right / flip it upside down
 *   spike.hide()                  retract a popped spike
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
  // ---------------------------------------------------------------- levels 11-20 (single-player, harder)
  {
    name: 'Groundwork',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'The floor is not your friend.');
      // solid start
      L.block(0, 15, 6, 3);
      // three crumble sections that all trigger together when first is stepped on
      const c1 = [], c2 = [], c3 = [];
      for (let x = 6; x < 12; x++) c1.push(L.block(x, 15, 1, 1, { crumble: 0.18 }));
      L.block(12, 15, 3, 3);
      for (let x = 15; x < 20; x++) c2.push(L.block(x, 15, 1, 1, { crumble: 0.14 }));
      L.block(20, 15, 2, 3);
      for (let x = 22; x < 27; x++) c3.push(L.block(x, 15, 1, 1, { crumble: 0.1 }));
      L.block(27, 15, 5, 3);
      // hidden spikes after each safe island
      const s1 = L.spike(13, 15, 2, 'up', { hidden: true });
      const s2 = L.spike(20, 15, 1, 'up', { hidden: true });
      const s3 = L.spike(29, 15, 1, 'up', { hidden: true });
      L.on(() => L.player.grounded && [...c1].some(b => b.pending || b.falling), () => s1.pop());
      L.on(() => L.player.grounded && [...c2].some(b => b.pending || b.falling), () => s2.pop());
      L.on(() => L.px > 25.5, () => s3.pop());
      // a saw chases once player reaches mid-point
      const saw = L.saw(-2, 14.2, 0.8);
      L.on(() => L.px > 12, () => { saw.vx = 7.5; });
      L.door(30, 15);
    },
  },
  {
    name: 'Gravity Well',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 7, 'Up, down, repeat. Good luck.');
      L.block(0, 15, 8, 3);
      L.pad(5, 15, 2, -1);        // flip up
      L.block(0, 0, 10, 3);       // ceiling becomes floor
      L.pad(7, 3, 2, 1);          // flip back down
      L.block(10, 15, 6, 3);
      L.pad(13, 15, 2, -1);       // flip up again
      L.block(10, 0, 8, 3);
      L.pad(16, 3, 2, 1);         // flip down
      L.block(18, 15, 14, 3);
      // hidden spikes after each pad zone
      const s1 = L.spike(9, 3, 2, 'down', { hidden: true });
      const s2 = L.spike(17, 3, 2, 'down', { hidden: true });
      L.on(() => L.g < 0 && L.px > 7.4, () => s1.pop());
      L.on(() => L.g < 0 && L.px > 15.4, () => s2.pop());
      // door runs away once player gets close
      const d = L.door(28, 15);
      let fled = false;
      L.on(() => !fled && L.near(d, 3), () => { fled = true; L.moveDoor(d, 22, 15, 35); L.say('nope'); });
    },
  },
  {
    name: 'Saw Alley',
    build(L) {
      L.spawn(2, 15);
      L.text(4, 6, 'Timing is everything. Speed is not.');
      L.block(0, 15, 32, 3);
      // three saws at different heights, moving across a corridor
      const s1 = L.saw(10, 14.2, 0.7);
      const s2 = L.saw(18, 13.5, 0.7);
      const s3 = L.saw(26, 14.2, 0.7);
      L.on(() => L.px > 6, () => { s1.vx = 5; });
      L.on(() => L.px > 14, () => { s2.vx = -5; });
      L.on(() => L.px > 22, () => { s3.vx = 5; });
      // invisible walls that reveal as narrow corridors
      L.block(9, 9, 1, 4, { hidden: true });
      L.block(17, 9, 1, 4, { hidden: true });
      L.block(25, 9, 1, 4, { hidden: true });
      const sp = L.spike(29, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 27.5, () => sp.pop());
      L.door(30, 15);
    },
  },
  {
    name: 'Flip Flop',
    build(L) {
      L.jumpDelay = 0.18;
      L.spawn(2, 15);
      L.text(3, 6, 'Lag AND gravity. You\'re welcome.');
      L.block(0, 15, 6, 3);
      L.block(0, 0, 6, 3);
      L.pad(3, 15, 2, -1);
      L.block(8, 0, 6, 3);
      L.block(8, 13, 6, 5);
      L.spike(8, 13, 6, 'down');
      L.pad(11, 3, 2, 1);
      L.block(16, 15, 6, 3);
      L.block(16, 0, 6, 3);
      L.pad(19, 15, 2, -1);
      L.block(24, 0, 8, 3);
      L.pad(26, 3, 2, 1);
      L.block(28, 15, 4, 3);
      L.on(() => L.px > 29, () => { L.jumpDelay = 0; L.say('lag gone. too late.'); });
      const sp = L.spike(29, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 27.4, () => sp.pop());
      L.door(30, 15);
    },
  },
  {
    name: 'Mirror Maze',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'Left is right. Then it isn\'t.');
      L.block(0, 15, 10, 3);
      L.block(12, 15, 8, 3);
      L.block(22, 15, 10, 3);
      L.on(() => L.px > 6, () => { L.mirror(); L.say('backwards!'); });
      const s1 = L.spike(13, 15, 2, 'up', { hidden: true });
      L.on(() => L.px > 11.5, () => s1.pop());
      L.on(() => L.px > 18, () => { L.mirror(false); L.say('normal again'); });
      L.on(() => L.px > 22, () => { L.invert = true; L.say('and inverted'); });
      const s2 = L.spike(26, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 24.5, () => s2.pop());
      L.on(() => L.px > 27, () => { L.invert = false; });
      // door sprints away once reached
      const d = L.door(29, 15);
      L.on(() => L.near(d, 2.5), () => { L.moveDoor(d, 2, 15, 50); L.say('see ya!'); L.mirror(); });
      L.on(() => L.near(d, 2) && d.x < 5, () => { L.say('gotcha'); });
    },
  },
  {
    name: 'Thin Ice',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'Keep moving. Ice won\'t hold forever.');
      L.block(0, 15, 4, 3);
      // crumble bridge with fair reaction time and safe resting island
      for (let x = 4; x < 14; x++) L.block(x, 15, 1, 1, { crumble: 0.16 });
      L.block(14, 15, 2, 3); // safe island
      for (let x = 16; x < 26; x++) L.block(x, 15, 1, 1, { crumble: 0.16 });
      L.block(26, 15, 6, 3);
      // spikes below the bridge
      L.block(4, 17, 22, 1);
      L.spike(4, 17, 22, 'up');
      // crusher with warning telegraph before dropping
      const crusher = L.block(9, 0, 4, 7);
      L.on(() => L.px > 8, () => L.drop(crusher, 0.4, { land: true }));
      // gentle saw from behind instead of a surprise head-on saw
      const saw = L.saw(-2, 14.2, 0.75);
      L.on(() => L.px > 15, () => { saw.vx = 5; });
      const sp = L.spike(29, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 27.5, () => sp.pop());
      L.door(30, 15);
    },
  },
  {
    name: 'The Betrayal',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'The flag saves you. Trust the flag.');
      L.block(0, 15, 32, 3);
      // a "checkpoint" flag that is EVIL
      const f = L.flag(16, 15);
      // big gap that opens up
      const bridge = L.block(10, 15, 12, 3);
      L.on(() => L.player.grounded && Math.abs(L.px - 16.5) < 1.3, () => {
        f.evil = true;
        L.say('checkpoint saved!');
        L.wait(0.3, () => L.drop(bridge, 0));
      });
      // spikes hidden everywhere
      const s1 = L.spike(5, 15, 3, 'up', { hidden: true });
      const s2 = L.spike(22, 15, 4, 'up', { hidden: true });
      L.on(() => L.px > 3.5, () => s1.pop());
      L.on(() => L.px > 20.5, () => s2.pop());
      // door is a fake, real one is behind a hidden block
      const fake = L.door(28, 15, { fake: true });
      L.block(21, 13.5, 2, 1, { hidden: true });
      L.block(25, 12, 2, 1, { hidden: true });
      L.door(25, 12);
      L.on(() => L.touch(fake), () => {
        L.fakeWin();
        L.wait(1.2, () => { L.banner = { text: 'JK', sub: 'jump to the hidden platform', t: 0, life: 1.8 }; });
      });
    },
  },
  {
    name: 'Crusher Gauntlet',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'Watch the shadows. Time your dash.');
      L.block(0, 15, 32, 3);
      // three crushers with distinct telegraph delays instead of near-instant drop
      const c1 = L.block(8, 0, 3, 7);
      const c2 = L.block(15, 0, 3, 7);
      const c3 = L.block(22, 0, 3, 7);
      L.on(() => L.px > 6.5, () => L.drop(c1, 0.45, { land: true }));
      L.on(() => L.px > 13.5, () => L.drop(c2, 0.45, { land: true }));
      L.on(() => L.px > 20.5, () => L.drop(c3, 0.45, { land: true }));
      // hidden pop spike between the second and third crusher
      const s = L.spike(18.5, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 17, () => s.pop());
      // slow, steady saw from behind to keep pacing active without rushing
      const saw = L.saw(-2, 14.2, 0.75);
      L.on(() => L.px > 10, () => { saw.vx = 4.5; });
      L.door(29, 15);
    },
  },
  {
    name: 'Chaos Engine',
    build(L) {
      L.jumpDelay = 0.14;
      L.spawn(2, 15);
      L.text(3, 5, 'Lag. Invert. Mirror. All of it.');
      L.block(0, 15, 8, 3);
      L.block(10, 15, 6, 3);
      L.block(18, 15, 6, 3);
      L.block(26, 15, 6, 3);
      // controls randomly scramble
      L.on(() => L.px > 5, () => { L.invert = true; L.say('inverted!'); });
      L.on(() => L.px > 10, () => { L.mirror(); L.say('and mirrored'); });
      L.on(() => L.px > 16, () => { L.invert = false; L.say('less inverted'); });
      L.on(() => L.px > 22, () => { L.mirror(false); L.invert = true; L.say('still inverted lol'); });
      L.on(() => L.px > 28, () => { L.invert = false; L.jumpDelay = 0; L.say('you\'re free'); });
      const s1 = L.spike(10, 15, 1, 'up', { hidden: true });
      const s2 = L.spike(18, 15, 1, 'up', { hidden: true });
      const s3 = L.spike(26, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 8.6, () => s1.pop());
      L.on(() => L.px > 16.6, () => s2.pop());
      L.on(() => L.px > 24.6, () => s3.pop());
      const saw = L.saw(-2, 14.2, 0.9);
      L.on(() => L.px > 7, () => { saw.vx = 9; });
      L.door(30, 15);
    },
  },
  {
    name: 'The Reckoning',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 5, 'Everything. All at once. Final level.');
      L.block(0, 15, 6, 3);
      // gravity flip zone
      L.block(0, 0, 8, 3);
      L.pad(4, 15, 2, -1);
      L.block(6, 0, 4, 3);
      L.pad(8, 3, 2, 1);
      // crumble section (slightly more forgiving: 0.1 -> 0.14)
      for (let x = 10; x < 18; x++) L.block(x, 15, 1, 1, { crumble: 0.14 });
      L.block(18, 15, 4, 3);
      // inverted controls only on the crumble stretch, cleared before the crusher
      L.on(() => L.px > 12, () => { L.invert = true; L.say('and inverted'); });
      L.on(() => L.px > 17, () => { L.invert = false; L.say('you\'re welcome'); });
      // crusher: narrower, telegraphed, single trigger, sits over the island
      const crush = L.block(19, 0, 3, 7);
      let slamAt = -1, slamUntil = -1;
      L.on(() => L.px > 17.5, () => { slamAt = L.t + 0.7; slamUntil = slamAt + 0.6; });
      L.gate(crush, 0, 8, () => L.t >= slamAt && L.t < slamUntil, { speed: 30, closeSpeed: 6 });
      // lag for the final stretch
      L.block(22, 15, 10, 3);
      L.on(() => L.px > 22, () => { L.jumpDelay = 0.2; L.say('lag!'); });
      // dual saws (saw sandwich)
      const saw1 = L.saw(-2, 14.2, 0.75);
      const saw2 = L.saw(34, 14.2, 0.75);
      L.on(() => L.px > 8, () => { saw1.vx = 7; });
      L.on(() => L.px > 20, () => { saw2.vx = -7; });
      // fake door, then the real one on a climbable hidden staircase
      const fake = L.door(28, 15, { fake: true });
      L.block(22.5, 13.5, 3, 1, { hidden: true });
      L.block(25, 11.5, 3.5, 1, { hidden: true });
      L.block(28, 9.5, 4, 1);
      L.door(29.5, 9.5);
      L.on(() => L.touch(fake), () => {
        L.fakeWin();
        L.wait(1.1, () => { L.banner = { text: 'JK', sub: 'check above you', t: 0, life: 2 }; });
      });
      L.on(() => L.px > 25, () => { L.jumpDelay = 0; });
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
      const s2 = L.spike(10.5, 15, 1, 'up', { hidden: true });
      L.on(() => L.near(d, 2.6), () => {
        L.moveDoor(d, 8, 15, 35); L.say('wrong side lol');
        L.wait(0.6, () => L.mirror());
        L.on(() => L.px < 12.5, () => s2.pop());
      });
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
      // whoever is up top must not jump while the step is out
      L.onJump((p) => { if (p.y < 11 && L.t < until) { until = -1; L.say('you shook it loose'); } });
      L.on(() => L.all((p) => p.y < 11), () => { L.swap = true; L.say('swapped!'); L.wait(2.5, () => { L.swap = false; }); });
      const s = L.spike(22, 11, 2, 'up', { hidden: true });
      L.on(() => L.py < 11 && L.px > 20.4, () => s.pop());
      const d = L.door(29.4, 11);
      L.on(() => L.near(d, 2.4), () => { L.moveDoor(d, 24.2, 11, 30); L.say('missed me'); });
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
      let reversed = false, bumpUntil = -1;
      const open = () => L.t >= bumpUntil && (reversed ? !s.down && !e.down : s.down || e.down);
      crs.forEach((c) => L.gate(c, 0, -3, open, { speed: 12, closeSpeed: 25, color: 'red' }));
      L.on(() => L.px > 21, () => L.wait(0.4, () => { reversed = true; L.say('plates reversed'); }));
      // jumping anywhere makes the crushers twitch
      L.onJump(() => { bumpUntil = L.t + 0.15; });
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
      // one plate alone for too long: a saw drops on the slacker
      L.on(() => !open && (a.held > 1 || b.held > 1) && !(a.down && b.down), () => {
        const slacker = L.players.find((p) => !(a.down && Math.abs(p.x + 0.4 - 3.2) < 1) && !(b.down && Math.abs(p.x + 0.4 - 28.7) < 1));
        if (slacker) { const sw = L.saw(slacker.x + 0.4, -1, 0.8); sw.vy = 16; L.say('too slow'); }
      });
      L.on(() => open && Math.abs(L.px - 15.75) < 3.2, () => L.swapPlaces());
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
      let hic = -1;
      L.gate(lift, 0, -8, () => L.t >= hic && (b1.down || b2.down), { speed: 4, color: 'blue' });
      L.on(() => lift.y < 10, () => { hic = L.t + 0.8; L.say('oops'); });
      // jumping on the shelf while your partner rides makes the lift slip
      L.onJump((p) => { if (p.y < 7.5 && L.players.some((q) => q !== p && q.ground === lift)) { hic = L.t + 0.5; L.say('you rocked the lift'); } });
      const s = L.spike(17, 6.4, 2, 'up', { hidden: true });
      L.on(() => L.py < 7 && L.px > 12 && L.px < 15.5, () => s.pop());
      const d = L.door(26, 6.4);
      L.on(() => L.near(d, 2.6), () => {
        L.moveDoor(d, 23, 15, 30); L.say('down here now');
        L.flipView(); L.wait(3, () => L.flipView(false));
      });
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
      const mid = L.spike(13, 15, 1, 'up', { hidden: true });
      L.on(() => L.py > 10 && L.px > 11.6, () => mid.pop());
      L.on(() => b2.down, () => L.flipView());
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
      for (let x = 9; x < 23; x++) bridge.push(L.block(x, 15, 1, 1, x === 15 || x === 16 ? { crumble: 0.35 } : {}));
      L.block(23, 15, 9, 3);
      L.block(9, 9, 14, 3);
      L.spike(9, 12, 14, 'down');
      L.on(() => L.count((p) => bridge.includes(p.ground)) >= 2, () => {
        bridge.forEach((b, i) => L.drop(b, i * 0.02));
        L.say('too heavy!');
      });
      const saw = L.saw(-2, 14.2, 0.8);
      // the first one across gets sent back to the start
      L.on(() => L.px > 23.5, () => { L.swapPlaces(); saw.vx = 6.5; });
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
      const s0 = L.spike(13, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 11, () => s0.pop());
      L.on(() => L.px > 21.5, () => { L.swap = false; L.say('unswapped!'); });
      const s = L.spike(29, 15, 1, 'up', { hidden: true });
      L.on(() => L.player.grounded && L.px > 26.3, () => { s.pop(); L.swap = true; L.say('jk, swapped'); });
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
      const crate = L.crate(3, 11);
      L.crate(6, 11, 1, { mimic: true });
      const btn = L.button(8.1, 15, 2.4, { color: 'orange' });
      const cage = [L.block(24, 10.5, 4.5, 0.5), L.block(24, 11, 0.5, 4), L.block(28, 11, 0.5, 4)];
      cage.forEach((c) => L.gate(c, 0, -7, () => btn.down, { speed: 3, closeSpeed: 20, color: 'orange' }));
      const s = L.spike(20, 15, 2, 'up', { hidden: true });
      L.on(() => crate.y > 13.5, () => s.pop());
      // the moment one of you is in, the crate gives up
      L.on(() => L.players.some((p) => p.done), () => L.wait(0.4, () => { crate.gone = true; L.say('crate broke'); }));
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
      let hic = -1;
      L.gate(lift, 0, -8.4, () => L.t >= hic && (b1.down || b2.down), { speed: 4.5, color: 'blue' });
      L.on(() => lift.y < 10, () => { hic = L.t + 0.8; L.say('oops'); });
      const s = L.spike(19, 6, 2, 'up', { hidden: true });
      L.on(() => L.py < 7 && L.px < 18, () => s.pop());
      const d = L.door(29, 6);
      L.on(() => L.near(d, 2.6), () => { L.moveDoor(d, 25, 15, 30); L.say('catch me down there'); L.mirror(); });
      const fake = L.door(28, 15, { fake: true });
      L.on(() => L.touch(fake), () => {
        L.fakeWin();
        L.wait(1.1, () => { L.drop(trap, 0); L.banner = { text: 'JK', sub: 'did you really think...', t: 0, life: 1.5 }; });
      });
    },
  },
  // ---------------------------------------------------------------- levels 11-20 (multiplayer, harder)
  {
    name: 'Hot Potato',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 6, 'The plate is on a timer. Move fast.');
      L.block(0, 15, 32, 3);
      // A button that holds the gate open with generous time for partner
      const btn = L.button(7, 15, 1.4, { color: 'red' });
      const b2 = L.button(24, 15, 1.4, { color: 'red' });
      // gate that opens while either button is pressed
      L.block(16, 0, 2, 3);
      const gate = L.block(16, 3, 2, 12);
      L.gate(gate, 0, -6, () => btn.down || b2.down, { speed: 12, closeSpeed: 25, color: 'red' });
      // spikes on each side
      const sl = L.spike(4, 15, 2, 'up', { hidden: true });
      const sr = L.spike(20, 15, 2, 'up', { hidden: true });
      L.on(() => btn.down, () => sl.pop());
      L.on(() => L.px > 18.5, () => sr.pop());
      L.door(29, 15);
    },
  },
  {
    name: 'Switcheroo',
    build(L) {
      L.spawn(4, 15); L.spawn2(26, 15);
      L.text(4, 5, 'Your partner holds YOUR door.');
      L.block(0, 15, 8, 3);
      L.block(0, 0, 2, 3); L.block(2, 0, 2, 12);
      const gateL = L.block(2, 12, 2, 3);
      L.block(8, 15, 16, 3);
      L.block(30, 0, 2, 3); L.block(28, 0, 2, 12);
      const gateR = L.block(28, 12, 2, 3);
      L.block(24, 15, 8, 3);
      const btnL = L.button(22, 15, 1.4, { color: 'green' });   // near right player opens left gate
      const btnR = L.button(8, 15, 1.4, { color: 'purple' });  // near left player opens right gate
      L.gate(gateL, 0, -3, () => btnL.down, { speed: 10, closeSpeed: 30, color: 'green' });
      L.gate(gateR, 0, -3, () => btnR.down, { speed: 10, closeSpeed: 30, color: 'purple' });
      // spikes pop mid-bridge when players swap sides
      const smid = L.spike(14, 15, 3, 'up', { hidden: true });
      L.on(() => L.any(p => p.x + 0.4 > 13 && p.x + 0.4 < 17), () => smid.pop());
      L.on(() => L.swap, () => { L.say('controls flipped!'); });
      L.on(() => L.all(p => p.x + 0.4 > 10 && p.x + 0.4 < 22), () => { L.swap = true; });
      L.on(() => L.all(p => p.x + 0.4 < 4 || p.x + 0.4 > 28), () => { L.swap = false; });
      L.door(0, 15);   // left door
      L.door(29, 15);  // right door
    },
  },
  {
    name: 'Chain Reaction',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 5, 'Three buttons. Sequential. No repeats.');
      L.block(0, 15, 32, 3);
      let stage = 0;
      const b1 = L.button(5, 15, 1.4, { color: 'green' });
      const b2 = L.button(16, 15, 1.4, { color: 'purple' });
      const b3 = L.button(27, 15, 1.4, { color: 'orange' });
      // pressing wrong order: saw punishes
      const saw1 = L.saw(10, 14.2, 0.75);
      const saw2 = L.saw(21, 14.2, 0.75);
      L.on(() => stage === 0 && b1.down, () => { stage = 1; L.say('1 of 3'); });
      L.on(() => stage === 1 && b2.down, () => { stage = 2; L.say('2 of 3'); });
      L.on(() => stage === 2 && b3.down, () => { stage = 3; L.say('unlocked!'); });
      // out of order triggers saws
      L.on(() => stage === 0 && (b2.down || b3.down), () => { saw1.vx = 8; saw2.vx = 8; L.say('wrong order!'); }, { repeat: true });
      L.on(() => stage === 1 && b3.down, () => { saw2.vx = 8; L.say('skip!'); }, { repeat: true });
      // gate only opens after all 3
      L.block(21, 0, 2, 4);
      const finalGate = L.block(21, 4, 2, 11);
      L.gate(finalGate, 0, -11, () => stage >= 3, { speed: 6, color: 'orange' });
      const sp = L.spike(29, 15, 2, 'up', { hidden: true });
      L.on(() => stage >= 3 && L.px > 27, () => sp.pop());
      L.door(29, 15);
    },
  },
  {
    name: 'Gravity Split',
    build(L) {
      L.spawn(2, 15); L.spawn2(2, 15);
      L.text(3, 8, 'The gate closes fast. Run together or run last.');
      L.block(0, 15, 32, 3);
      // platforms for each lane
      L.block(10, 15, 8, 1); L.block(20, 15, 8, 1);
      // gate: full-height wall that slides up when first player crosses x=14.
      // Closes slowly — the second player must rush through before it shuts.
      const gate = L.block(16, 0, 2, 15);
      L.gate(gate, 0, -15, () => L.any(p => p.x + p.w / 2 > 14), { speed: 12, closeSpeed: 5, color: 'purple' });
      const sp = L.spike(26, 15, 2, 'up', { hidden: true });
      L.on(() => L.py > 10 && L.px > 24, () => sp.pop());
      L.door(29, 15);
    },
  },
  {
    name: 'Detonator',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 5, 'Hold it too long and it blows.');
      L.block(0, 15, 32, 3);
      // three buttons that explode (spawn saws) if held more than 1.5 s
      const b1 = L.button(7, 15, 1.4, { color: 'red' });
      const b2 = L.button(16, 15, 1.4, { color: 'red' });
      const b3 = L.button(25, 15, 1.4, { color: 'red' });
      // gates require short taps
      L.block(11, 0, 2, 4);
      const g1 = L.block(11, 4, 2, 11);
      L.block(20, 0, 2, 4);
      const g2 = L.block(20, 4, 2, 11);
      L.gate(g1, 0, -5, () => b1.down, { speed: 12, closeSpeed: 10, color: 'red' });
      L.gate(g2, 0, -5, () => b2.down, { speed: 12, closeSpeed: 10, color: 'red' });
      // overheld: a saw spawns
      let saw1 = false, saw2 = false, saw3 = false;
      L.on(() => !saw1 && b1.held > 2.0, () => { saw1 = true; const s = L.saw(7, -1, 0.7); s.vy = 12; L.say('held too long!'); });
      L.on(() => !saw2 && b2.held > 2.0, () => { saw2 = true; const s = L.saw(16, -1, 0.7); s.vy = 12; L.say('release!'); });
      L.on(() => !saw3 && b3.held > 2.0, () => { saw3 = true; const s = L.saw(25, -1, 0.7); s.vy = 12; L.say('oops'); });
      const sp = L.spike(29, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 27.5, () => sp.pop());
      L.door(30, 15);
    },
  },
  {
    name: 'The See-Saw',
    build(L) {
      L.spawn(4, 15); L.spawn2(26, 15);
      L.text(3, 5, 'One up, one down. Neither stays.');
      L.block(0, 15, 8, 3); L.block(24, 15, 8, 3);
      // central platform that tilts: left side holds one, right holds the other
      const platL = L.block(8, 13, 7, 2);
      const platR = L.block(17, 13, 7, 2);
      const btnL = L.button(10, 13, 1.4, { color: 'orange' });
      const btnR = L.button(20, 13, 1.4, { color: 'green' });
      // when left is pressed, right plate drops; vice versa
      L.gate(platR, 0, 2, () => btnL.down && !btnR.down, { speed: 8, closeSpeed: 12, color: 'orange' });
      L.gate(platL, 0, 2, () => btnR.down && !btnL.down, { speed: 8, closeSpeed: 12, color: 'green' });
      L.block(14, 0, 4, 3); // top arch
      const archGate = L.block(14, 3, 4, 12);
      L.gate(archGate, 0, -12, () => btnL.down && btnR.down, { speed: 6, color: 'purple' });
      const sp1 = L.spike(13, 13, 2, 'up', { hidden: true });
      const sp2 = L.spike(17, 13, 2, 'up', { hidden: true });
      L.on(() => L.any(p => p.x + 0.4 > 12 && p.x + 0.4 < 14), () => sp1.pop());
      L.on(() => L.any(p => p.x + 0.4 > 17 && p.x + 0.4 < 19), () => sp2.pop());
      L.door(16, 15);
    },
  },
  {
    name: 'Mimic City',
    build(L) {
      L.spawn(11, 15);
      L.text(10, 5, 'Some crates are friends. Some are not.');
      L.block(0, 11, 8, 7); L.block(8, 15, 24, 3);
      // four crates; two mimic, two real
      L.crate(2, 11, 1, { mimic: true });
      const crate1 = L.crate(5, 11);
      L.crate(14, 15, 1, { mimic: true });
      const crate2 = L.crate(18, 15);
      const btn = L.button(8.1, 15, 2.4, { color: 'orange' });
      const btn2 = L.button(22, 15, 2.4, { color: 'purple' });
      const cage = [L.block(26, 10, 4.5, 0.5), L.block(26, 10.5, 0.5, 4.5), L.block(30, 10.5, 0.5, 4.5)];
      cage.forEach(c => L.gate(c, 0, -7, () => btn.down && btn2.down, { speed: 3, closeSpeed: 20, color: 'orange' }));
      const sp = L.spike(21, 15, 2, 'up', { hidden: true });
      L.on(() => crate1.y > 13.5, () => sp.pop());
      L.on(() => crate2.y > 13.5, () => { L.say('second button!'); });
      L.door(27.65, 15);
    },
  },
  {
    name: 'Rope-a-Dope',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 5, 'Controls trade hands. Again. And again.');
      L.block(0, 15, 8, 3);
      L.block(10, 15, 6, 3);
      L.block(18, 15, 6, 3);
      L.block(26, 15, 6, 3);
      // controls swap every few seconds
      let swapTimer = 0;
      L.on(() => { swapTimer += 1 / 120; if (swapTimer > 2.8 && L.px > 5) { swapTimer = 0; L.swap = !L.swap; L.say(L.swap ? 'swapped!' : 'back!'); } return false; }, () => { }, { repeat: true });
      const s1 = L.spike(10, 15, 1, 'up', { hidden: true });
      const s2 = L.spike(18, 15, 1, 'up', { hidden: true });
      const s3 = L.spike(26, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 8.6, () => s1.pop());
      L.on(() => L.px > 16.6, () => s2.pop());
      L.on(() => L.px > 24.6, () => s3.pop());
      const saw = L.saw(-2, 14.2, 0.85);
      L.on(() => L.px > 6, () => { saw.vx = 7; });
      L.door(30, 15);
    },
  },
  {
    name: 'The Big Push',
    build(L) {
      L.spawn(2, 15);
      L.text(3, 5, 'Crates everywhere. Only one matters.');
      L.block(0, 11, 6, 7); L.block(6, 15, 26, 3);
      // two crates: one mimic, one real, and room to manoeuvre
      L.crate(1, 11, 1, { mimic: true });
      const realCrate = L.crate(4, 11);
      const btn = L.button(24, 15, 2.4, { color: 'orange' });
      const cage = [L.block(27, 10, 4.5, 0.5), L.block(27, 10.5, 0.5, 4.5), L.block(31, 10.5, 0.5, 4.5)];
      cage.forEach(c => L.gate(c, 0, -7, () => btn.down, { speed: 3, closeSpeed: 20, color: 'orange' }));
      L.on(() => L.players.some(p => p.done), () => L.wait(0.4, () => { realCrate.gone = true; L.say('crate broke'); }));
      const sp = L.spike(21, 15, 2, 'up', { hidden: true });
      L.on(() => realCrate.y > 13.5, () => sp.pop());
      L.door(28.65, 15);
    },
  },
  {
    name: 'No Way Out',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 4, 'Two doors. One real. One isn\'t. Neither is obvious.');
      L.block(0, 15, 24, 3);
      const trap = L.block(24, 15, 8, 3);
      L.block(17, 6, 15, 1);
      // lift needs cooperative button presses
      const lift = L.block(14, 14.4, 3, 0.6);
      const b1 = L.button(5, 15, 1.4, { color: 'blue' });
      const b2 = L.button(26, 6, 1.4, { color: 'blue' });
      let hic = -1;
      L.gate(lift, 0, -8.4, () => L.t >= hic && (b1.down || b2.down), { speed: 4, color: 'blue' });
      L.on(() => lift.y < 10, () => { hic = L.t + 1; L.say('careful'); });
      // spikes at top platform after reaching it
      const st = L.spike(17, 6, 3, 'up', { hidden: true });
      L.on(() => L.py < 7 && L.px < 20, () => st.pop());
      // fake door visible, real door hidden
      const fake = L.door(28, 15, { fake: true });
      L.block(19, 6, 2, 1, { hidden: true });
      L.door(19, 6);
      L.on(() => L.touch(fake), () => {
        L.fakeWin();
        L.wait(1.2, () => { L.drop(trap, 0); L.mirror(); L.banner = { text: 'JK', sub: 'platform above has the real door', t: 0, life: 2 }; });
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
      L.on(() => L.all((p) => p.x > 18.2 && p.grounded), () => L.setRope(2.6));
      const s = L.spike(23, 15, 2, 'up', { hidden: true });
      L.on(() => L.px > 21.2, () => s.pop());
      const s2 = L.spike(27, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 25.5, () => s2.pop());
      L.door(29, 15);
    },
  },
  {
    name: 'Haul',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'One climbs. One gets dragged.');
      L.block(0, 15, 12, 3);
      L.block(12, 11, 12, 7);
      for (let x = 24; x < 26; x++) L.block(x, 11, 1, 7, { crumble: 0.12 });
      L.block(26, 11, 6, 7);
      // the climber jumping yanks whoever is still down there
      L.onJump((p) => { const o = L.players.find((q) => q !== p); if (p.y < 11 && o.y > 11.5) { L.yank(o, 0, 12); L.say('ow'); } });
      L.on(() => L.all((p) => p.y < 11 && p.grounded), () => { L.swapPlaces(); L.setRope(3); });
      const s = L.spike(20, 11, 2, 'up', { hidden: true });
      L.on(() => L.py < 11 && L.px > 18.4, () => s.pop());
      L.door(29, 11);
    },
  },
  {
    name: 'Counterweight',
    build(L) {
      L.spawn(1, 15);
      L.text(2, 6, 'The chain is short. The crate is not chained.');
      L.block(0, 15, 10, 3);
      L.block(10, 17.5, 3, 0.5);
      L.block(13, 15, 19, 3);
      const btn = L.button(10.6, 17.5, 1.6, { color: 'orange' });
      L.crate(4, 15, 1, { mimic: true });
      const crate = L.crate(7, 15);
      L.block(21, 0, 1, 3);
      const gate = L.block(21, 3, 1, 12);
      L.gate(gate, 0, -6, () => btn.down, { speed: 8, closeSpeed: 30, color: 'orange' });
      L.on(() => L.px > 22.5, () => L.wait(0.3, () => { crate.gone = true; L.say('the crate broke'); }));
      const s = L.spike(26, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 24.2, () => s.pop());
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
      let up = false, waitT = 0, hiccup = false;
      const target = () => (up ? 7 : 14.4);
      L.on(() => Math.abs(lift.y - target()) < 1e-6, () => {
        if (!waitT) waitT = L.t + 1.2;
        if (L.t >= waitT) { up = !up; waitT = 0; L.moveBlock(lift, 12, target(), 3); }
      }, { repeat: true });
      // halfway up, the lift changes its mind once
      L.on(() => up && lift.y < 10.5 && !hiccup, () => {
        hiccup = true; L.moveBlock(lift, 12, 12.5, 6); L.say('oops');
        L.wait(0.7, () => L.moveBlock(lift, 12, target(), 3));
      });
      // no jumping in the elevator
      L.onJump((p) => { if (p.ground === lift && up) { L.moveBlock(lift, 12, 14.4, 12); up = false; waitT = 0; L.say('NO JUMPING'); } });
      L.on(() => lift.y < 7.5, () => L.setRope(2.2));
      const s = L.spike(19, 7, 1, 'up', { hidden: true });
      L.on(() => lift.y < 7.5, () => s.pop());
      L.door(29, 7);
    },
  },
  {
    name: 'Leash',
    build(L) {
      L.spawn(2, 15);
      L.text(6, 5, 'Run. Together. Every jump feeds the saw.');
      L.block(0, 15, 9, 3);
      L.block(12, 15, 4, 3);
      L.block(19, 15, 4, 3);
      L.block(26, 15, 6, 3);
      const saw = L.saw(-2, 14.2, 0.8);
      L.on(() => L.px > 3.5, () => { saw.vx = 6.5; });
      L.onJump(() => { if (saw.vx) saw.vx = Math.min(7.6, saw.vx + 0.15); });
      L.on(() => L.px > 12.5, () => L.setRope(6));
      L.on(() => L.px > 19.5, () => L.setRope(2.4));
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
      const s = L.spike(25, 15, 2, 'up', { hidden: true });
      L.on(() => L.all((p) => p.x > 20 && p.y < 15 && p.grounded), () => {
        L.flipView();
        L.on(() => L.px > 23.3, () => s.pop());
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
      L.on(() => L.px > 9, () => L.setRope(2.5));
      const s = L.spike(20, 3, 1, 'down', { hidden: true });
      L.on(() => L.g < 0 && L.px > 18.4, () => s.pop());
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
      const btn = L.button(8, 15, 1.4, { color: 'green' });
      const lie = L.spike(15, 14.4, 3, 'up', { hidden: true });
      // the first press is a lie: spikes on the pillar. Press again for real.
      let presses = 0, goAt = null, hic = -1, was = false;
      L.on(() => { const fire = btn.down && !was; was = btn.down; return fire; }, () => {
        presses++;
        if (presses === 1) { lie.pop(); L.say('psych'); L.wait(1.5, () => lie.hide()); }
        else if (goAt === null) { goAt = L.t + 1.4; L.say('hop on!'); }
      }, { repeat: true });
      L.on(() => pillar.y < 10, () => { hic = L.t + 0.6; L.say('almost'); });
      L.gate(pillar, 0, -8.4, () => goAt !== null && L.t >= goAt && L.t >= hic, { speed: 3.5, color: 'green' });
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
      L.on(() => L.px > 8, () => L.setRope(1.6));
      L.on(() => L.px > 14, () => L.swapPlaces());
      const m = L.spike(18, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 16.2, () => m.pop());
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
      const d = L.door(21.5, 6);
      L.block(9, 12, 2, 1, { hidden: true });
      L.block(13, 9, 2, 1, { hidden: true });
      L.on(() => L.near(d, 2.2), () => { L.moveDoor(d, 13.4, 9, 25); L.say('nope'); });
    },
  },
  // ---------------------------------------------------------------- levels 11-20 (special/chained, harder)
  {
    name: 'Short Leash',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'Rope shrinks as you move. Don\'t straggle.');
      L.block(0, 15, 8, 3);
      L.block(10, 15, 6, 3);
      L.block(18, 15, 6, 3);
      L.block(26, 15, 6, 3);
      L.on(() => L.px > 8, () => L.setRope(3.2));
      L.on(() => L.px > 16, () => L.setRope(2.2));
      L.on(() => L.px > 24, () => L.setRope(1.6));
      const s1 = L.spike(10, 15, 1, 'up', { hidden: true });
      const s2 = L.spike(18, 15, 1, 'up', { hidden: true });
      const s3 = L.spike(26, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 8.5, () => s1.pop());
      L.on(() => L.px > 16.5, () => s2.pop());
      L.on(() => L.px > 24.5, () => s3.pop());
      L.door(30, 15);
    },
  },
  {
    name: 'Tandem Vault',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'One stands below, one launches up.');
      L.block(0, 15, 10, 3);
      L.block(10, 11, 4, 7);
      L.block(16, 7, 4, 11);
      L.block(22, 15, 10, 3);
      // whenever climber jumps, yanks lower partner
      L.onJump((p) => {
        const o = L.players.find((q) => q !== p);
        if (p.y < o.y - 3) { L.yank(o, 0, -11 * L.g); L.say('pull!'); }
      });
      const s1 = L.spike(10, 11, 1, 'up', { hidden: true });
      const s2 = L.spike(16, 7, 1, 'up', { hidden: true });
      L.on(() => L.py < 11 && L.px > 8.5, () => s1.pop());
      L.on(() => L.py < 7 && L.px > 14.5, () => s2.pop());
      const saw = L.saw(-2, 14.2, 0.8);
      L.on(() => L.px > 5, () => { saw.vx = 6; });
      L.door(29, 15);
    },
  },
  {
    name: 'Inverse Tether',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'Flipping gravity pulls both to opposite fates.');
      L.block(0, 0, 12, 3);
      L.block(0, 15, 12, 3);
      L.pad(6, 15, 2, -1);
      L.block(14, 0, 8, 3);
      L.block(14, 15, 8, 3);
      L.pad(17, 3, 2, 1);
      L.block(24, 0, 8, 3);
      L.block(24, 15, 8, 3);
      L.on(() => L.px > 12, () => L.setRope(2.4));
      const s1 = L.spike(14, 3, 3, 'down', { hidden: true });
      const s2 = L.spike(14, 15, 3, 'up', { hidden: true });
      L.on(() => L.px > 12.5, () => { s1.pop(); s2.pop(); });
      const s3 = L.spike(26, 15, 2, 'up', { hidden: true });
      L.on(() => L.px > 24.5, () => s3.pop());
      L.door(29, 15);
    },
  },
  {
    name: 'Guillotine Run',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'Heavy crushers overhead. One slow step crushes both.');
      L.block(0, 15, 32, 3);
      const c1 = L.block(9, 0, 3, 8);
      const c2 = L.block(17, 0, 3, 8);
      const c3 = L.block(25, 0, 3, 8);
      L.on(() => L.px > 7, () => L.drop(c1, 0.12, { land: true }));
      L.on(() => L.px > 15, () => L.drop(c2, 0.12, { land: true }));
      L.on(() => L.px > 23, () => L.drop(c3, 0.12, { land: true }));
      const s1 = L.spike(12, 15, 1, 'up', { hidden: true });
      const s2 = L.spike(20, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 10.5, () => s1.pop());
      L.on(() => L.px > 18.5, () => s2.pop());
      L.door(29.5, 15);
    },
  },
  {
    name: 'Slipknot',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'Controls swap mid-air. Don\'t yank each other into the pit.');
      L.block(0, 15, 8, 3);
      L.block(11, 15, 5, 3);
      L.block(19, 15, 5, 3);
      L.block(26, 15, 6, 3);
      L.on(() => L.px > 7, () => { L.swap = true; L.say('controls swapped!'); });
      L.on(() => L.px > 18, () => { L.swap = false; L.say('swapped back!'); });
      L.on(() => L.px > 25, () => { L.swap = true; L.say('swapped again!'); });
      const s1 = L.spike(11, 15, 1, 'up', { hidden: true });
      const s2 = L.spike(19, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 9.5, () => s1.pop());
      L.on(() => L.px > 17.5, () => s2.pop());
      const saw = L.saw(-2, 14.2, 0.8);
      L.on(() => L.px > 5, () => { saw.vx = 7; });
      L.door(30, 15);
    },
  },
  {
    name: 'Fragile Unity',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 6, 'Crumbling floor and a tightening chain.');
      L.block(0, 15, 5, 3);
      for (let x = 5; x < 25; x++) L.block(x, 15, 1, 1, { crumble: 0.1 });
      L.block(25, 15, 7, 3);
      L.on(() => L.px > 8, () => L.setRope(2.0));
      L.on(() => L.px > 15, () => { L.swapPlaces(); L.say('swapped!'); });
      const s = L.spike(18, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 16.5, () => s.pop());
      const s2 = L.spike(28, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 26.5, () => s2.pop());
      L.door(30, 15);
    },
  },
  {
    name: 'Twin Hazards',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 5, 'Saws coming from both sides. Jump in rhythm.');
      L.block(0, 15, 32, 3);
      const sawL = L.saw(-2, 14.2, 0.8);
      const sawR = L.saw(34, 14.2, 0.8);
      L.on(() => L.px > 5, () => { sawL.vx = 6.5; });
      L.on(() => L.px > 12, () => { sawR.vx = -6.5; });
      // rope tightens when dodging
      L.on(() => L.px > 14, () => L.setRope(2.2));
      const s1 = L.spike(15, 15, 2, 'up', { hidden: true });
      const s2 = L.spike(24, 15, 2, 'up', { hidden: true });
      L.on(() => L.px > 13.5, () => s1.pop());
      L.on(() => L.px > 22.5, () => s2.pop());
      L.door(29, 15);
    },
  },
  {
    name: 'The Chasm Swing',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 5, 'Anchor on the ledge. Swing partner across the pit.');
      L.block(0, 15, 8, 3);
      L.block(8, 17, 8, 1);
      L.spike(8, 17, 8, 'up');
      L.block(16, 15, 16, 3);
      // overhead anchor block
      L.block(11, 9, 3, 1);
      L.on(() => L.px > 7, () => L.setRope(5.5));
      L.on(() => L.all((p) => p.x > 16.5 && p.grounded), () => L.setRope(2.5));
      const s = L.spike(26, 15, 2, 'up', { hidden: true });
      L.on(() => L.px > 24.5, () => s.pop());
      L.door(29, 15);
    },
  },
  {
    name: 'Chaos Bond',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 5, 'Mirrored view, lag, and chained. Total harmony.');
      L.jumpDelay = 0.16;
      L.block(0, 15, 9, 3);
      L.block(12, 15, 6, 3);
      L.block(21, 15, 11, 3);
      L.on(() => L.px > 6, () => { L.mirror(); L.say('mirrored!'); });
      L.on(() => L.px > 14, () => { L.mirror(false); L.say('back!'); });
      L.on(() => L.px > 23, () => { L.jumpDelay = 0; L.say('lag cleared!'); });
      const s1 = L.spike(12, 15, 1, 'up', { hidden: true });
      const s2 = L.spike(21, 15, 1, 'up', { hidden: true });
      const s3 = L.spike(27, 15, 1, 'up', { hidden: true });
      L.on(() => L.px > 10.5, () => s1.pop());
      L.on(() => L.px > 19.5, () => s2.pop());
      L.on(() => L.px > 25.5, () => s3.pop());
      L.door(30, 15);
    },
  },
  {
    name: 'Eternal Bond',
    build(L) {
      L.spawn(2, 15);
      L.text(2, 5, 'The ultimate chained test. Every trap combined.');
      L.block(0, 15, 6, 3);
      // crumble section with shortening rope
      for (let x = 6; x < 14; x++) L.block(x, 15, 1, 1, { crumble: 0.1 });
      L.block(14, 15, 4, 3);
      // overhead crusher
      const c = L.block(14, 0, 4, 8);
      L.on(() => L.px > 12, () => L.drop(c, 0.08, { land: true }));
      // gravity pad section
      L.block(18, 15, 6, 3);
      L.block(18, 0, 6, 3);
      L.pad(19, 15, 2, -1);
      L.pad(21, 3, 2, 1);
      L.block(24, 15, 8, 3);
      // saw chase
      const saw = L.saw(-2, 14.2, 0.85);
      L.on(() => L.px > 5, () => { saw.vx = 7.5; });
      L.on(() => L.px > 10, () => L.setRope(2.0));
      // fake door and real door trick
      const fake = L.door(28, 15, { fake: true });
      L.block(21, 13, 2, 1, { hidden: true });
      L.block(25, 11, 2, 1, { hidden: true });
      L.door(25, 11);
      L.on(() => L.touch(fake), () => {
        L.fakeWin();
        L.wait(1.1, () => {
          L.flipView();
          L.banner = { text: 'JK', sub: 'exit is above on the ledge', t: 0, life: 2 };
        });
      });
    },
  },
];

window.LEVELS = { single: SINGLE, multi: MULTI, special: SPECIAL };