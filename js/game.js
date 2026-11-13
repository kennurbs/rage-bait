(() => {
  'use strict';

  // ---------------------------------------------------------------- constants
  const TILE = 30, COLS = 32, ROWS = 18, VW = COLS * TILE, VH = ROWS * TILE;
  const STEP = 1 / 120;
  const EPS = 1e-4;
  const P = {
    grav: 62, jump: 20.5, speed: 8, accG: 90, accA: 60, fric: 80,
    maxFall: 28, coyote: 0.08, buffer: 0.12, w: 0.8, h: 0.9,
  };
  const C = {
    bg1: '#14142b', bg2: '#221f45', grid: 'rgba(255,255,255,0.035)',
    block: '#d9d6ea', blockTop: '#ffffff', blockEdge: '#9f9ac0',
    spike: '#ffd23f', player: '#ff4f8b', playerDark: '#c2245c', eye: '#14142b',
    portal: '#3ee6d4', danger: '#ff3b5c', text: '#e8e6f0', dim: 'rgba(232,230,240,0.32)',
    pad: '#a77bff', flag: '#5cff8f', saw: '#c9c9d6',
    crate: '#c98b4a', crateDark: '#8a5a2b',
  };
  const LINK = { orange: '#ff9f43', green: '#5cff8f', purple: '#a77bff', red: '#ff3b5c', blue: '#4fb6ff' };
  const FONT = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
  const SKINS = [
    { main: '#ff4f8b', dark: '#c2245c', name: 'PINK' },
    { main: '#4fb6ff', dark: '#1f6fb5', name: 'BLUE' },
  ];
  const STRIKES = 3; // deaths in one level (2-player modes) before you get sent back
  const ROPE = 4.2; // chain length in tiles (special mode)
  const MODES = [
    {
      id: 'single', name: 'SINGLE PLAYER', sub: 'just you vs. the level', players: 1,
      hint: '←/→ or A/D move · SPACE / ↑ / W jump'
    },
    {
      id: 'multi', name: 'MULTIPLAYER', sub: '2 players · one keyboard', players: 2,
      hint: 'P1: A/D move, W jump   ·   P2: ←/→ move, ↑ jump'
    },
    {
      id: 'special', name: 'SPECIAL', sub: '2 players · trust us', players: 2, chained: true,
      label: 'SPECIAL (CHAINED)', hint: 'P1: A/D move, W jump   ·   P2: ←/→ move, ↑ jump'
    },
  ];
  const MODE = Object.fromEntries(MODES.map((m) => [m.id, m]));
  const course = (mode) => LEVELS[mode];
  // single-player keys stay numeric so old saves keep their per-level death counts
  const dkey = (mode, idx) => (mode === 'single' ? String(idx) : `${mode}:${idx}`);

  const DEATH_LINES = [
    'skill issue', 'did you even look?', 'the floor was lava. sort of.', 'classic.',
    'that was on purpose, right?', 'again!', 'we saw that.', 'so close. not really.',
    'have you tried not dying?', 'trust no tile.', 'muscle memory: 0', 'press R to cope',
    'ouch.', 'the level says hi.', 'bold strategy.', 'noted for the highlight reel.',
    'that one was mean, sorry. (not sorry)', 'gravity: 1, you: 0', 'certified rage moment',
  ];
  const TEAM_LINES = [
    'blame your partner.', 'teamwork makes the dream... die.', 'friendship ended.',
    'who was that?', 'that was NOT a team effort.', 'you both lose. together.',
  ];
  // {v} = victim, {o} = the other player
  const BLAME_LINES = [
    '{o}, this is on you.', '{v} is the weak link.', '{o} saw that coming.', '{v} trusted {o}. mistake.',
    'carried by {o}? not today.', '{v} needs a new partner.', '{o} is typing an apology...',
  ];
  const MOCK_LINES = [
    '{l} died {n} times. {w} did the work.', '{w} carried. {l} was luggage.', '{l}: {n} deaths. legendary.',
    '{l} should hold the controller the right way up.', '{w} would like a refund on {l}.',
  ];
  const CHAIN_LINES = ['you dragged them, didn\'t you', 'til death do you part. so, now.', 'dead weight.'];

  // ---------------------------------------------------------------- save data
  const SAVE_KEY = 'ragebait.save.v1';
  const save = (() => {
    const def = { unlocked: 1, deaths: 0, levelDeaths: {}, muted: false };
    let s;
    try { s = Object.assign(def, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); }
    catch (e) { s = def; }
    s.progress = Object.assign({ single: s.unlocked || 1, multi: 1, special: 1 }, s.progress || {});
    s.shame = Object.assign({ multi: [0, 0], special: [0, 0] }, s.shame || {});
    return s;
  })();
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- audio
  let actx = null;
  function audioOn() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    if (actx.state === 'suspended') actx.resume();
  }
  function tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    if (!actx || save.muted) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol = 0.15) {
    if (!actx || save.muted) return;
    const len = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = actx.createBufferSource(), g = actx.createGain();
    s.buffer = buf; g.gain.value = vol; s.connect(g).connect(actx.destination); s.start();
  }
  const sfx = {
    jump: () => tone(440, 0.1, 'square', 0.04, 320),
    die: () => { noise(0.3, 0.18); tone(180, 0.35, 'sawtooth', 0.06, -140); },
    trap: () => tone(110, 0.18, 'triangle', 0.12, -60),
    thud: () => { noise(0.18, 0.2); tone(70, 0.2, 'sine', 0.2, -30); },
    pop: () => tone(1200, 0.06, 'square', 0.04, -700),
    flip: () => tone(260, 0.22, 'sine', 0.09, 520),
    move: () => tone(700, 0.15, 'triangle', 0.05, 500),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'square', 0.05, 0, i * 0.07)),
    reveal: () => tone(880, 0.08, 'triangle', 0.06, 200),
    click: () => tone(600, 0.04, 'square', 0.03),
  };

  // ---------------------------------------------------------------- helpers
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
  const overlap = (a, b) =>
    a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const solid = (b) => b.solid && !b.gone;

  function spikeBox(s) {
    return s.dir === 'up'
      ? { x: s.x + 0.12, y: s.y - 0.48, w: s.w - 0.24, h: 0.48 }
      : { x: s.x + 0.12, y: s.y, w: s.w - 0.24, h: 0.48 };
  }
  function padBox(p) { return p.g < 0 ? { x: p.x, y: p.y - 0.25, w: p.w, h: 0.25 } : { x: p.x, y: p.y, w: p.w, h: 0.25 }; }
  function doorBox(d) { return { x: d.x + 0.2, y: d.y + 0.2, w: d.w - 0.4, h: d.h - 0.3 }; }

  // ---------------------------------------------------------------- input
  // ctl[i] is what player i is holding; pressed[i] holds fresh jump presses.
  const ctl = [{ left: false, right: false, jump: false }, { left: false, right: false, jump: false }];
  const pressed = [new Set(), new Set()];
  const down = new Set();
  const touch = { left: false, right: false, jump: false };
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
  };
  const P2_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp']);
  // in 2-player modes the arrow keys belong to player 2; everything else is player 1
  function owner(code) { return MODE[game.mode].players > 1 && P2_KEYS.has(code) ? 1 : 0; }
  function syncCtl() {
    for (const c of ctl) c.left = c.right = c.jump = false;
    for (const code of down) { const k = KEYMAP[code]; if (k) ctl[owner(code)][k] = true; }
    for (const k in touch) if (touch[k]) ctl[0][k] = true;
  }
  addEventListener('keydown', (e) => {
    audioOn();
    const k = KEYMAP[e.code];
    if (k) {
      if (!down.has(e.code)) { down.add(e.code); if (k === 'jump') pressed[owner(e.code)].add('jump'); }
      syncCtl(); e.preventDefault();
    }
    if (!e.repeat) onKey(e.code);
  });
  addEventListener('keyup', (e) => { down.delete(e.code); syncCtl(); });
  addEventListener('blur', () => { down.clear(); touch.left = touch.right = touch.jump = false; syncCtl(); });

  // touch buttons (always player 1)
  const touchEl = document.getElementById('touch');
  if (matchMedia('(pointer: coarse)').matches) touchEl.hidden = false;
  touchEl.querySelectorAll('button').forEach((btn) => {
    const k = btn.dataset.key;
    const on = (e) => {
      e.preventDefault(); audioOn(); btn.classList.add('on');
      if (k === 'restart') { onKey('KeyR'); return; }
      if (!touch[k] && k === 'jump') pressed[0].add('jump');
      touch[k] = true; syncCtl();
      if (k === 'jump' && game.state !== 'play') onKey('Enter');
    };
    const off = (e) => { e.preventDefault(); btn.classList.remove('on'); if (k !== 'restart') { touch[k] = false; syncCtl(); } };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
  });

  // ---------------------------------------------------------------- particles & fx
  let particles = [];
  function burst(x, y, color, n = 24, speed = 9) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, life: 0.6 + Math.random() * 0.5, t: 0, color, size: 0.12 + Math.random() * 0.18 });
    }
  }
  function updateParticles(dt) {
    for (const p of particles) { p.t += dt; p.vy += 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    particles = particles.filter((p) => p.t < p.life);
  }

  // ---------------------------------------------------------------- level runtime
  function makePlayer(x, floorY, idx) {
    return {
      idx, x, y: floorY - P.h, w: P.w, h: P.h, vx: 0, vy: 0, face: 1,
      grounded: false, ground: null, coy: 0, buf: 0, hang: 0, jumping: false, cut: false, lagged: false,
      jq: [], dead: false, done: false, taut: false, sx: 1, sy: 1,
    };
  }

  class Level {
    constructor(idx, modeId = 'single') {
      this.idx = idx;
      this.mode = MODE[modeId];
      this.def = course(modeId)[idx];
      this.chained = !!this.mode.chained;
      this.blocks = []; this.spikes = []; this.saws = []; this.pads = []; this.flags = [];
      this.doors = []; this.texts = []; this.bubbles = [];
      this.buttons = []; this.gates = []; this.jumpHooks = [];
      this.rope = ROPE; this.snagT = 0; this.view = { mirror: false, flip: false };
      this.triggers = []; this.timers = [];
      this.g = 1; this.invert = false; this.swap = false; this.jumpDelay = 0; this.t = 0;
      this.banner = null; this.won = false; this.over = false; this.shakeT = 0; this.shakeMag = 0;
      this.spawnPt = { x: 2, y: 15 }; this.spawnPt2 = null;
      this.players = [];
      this.cur = null;
      this.def.build(this);
      const s = this.spawnPt;
      for (let i = 0; i < this.mode.players; i++) {
        const sp = i === 1 && this.spawnPt2 ? this.spawnPt2 : { x: s.x + i * 1.3, y: s.y };
        this.players.push(makePlayer(sp.x, sp.y, i));
      }
      this.cur = this.players[0];
    }

    // ---- build API
    spawn(x, floorY) { this.spawnPt = { x, y: floorY }; }
    spawn2(x, floorY) { this.spawnPt2 = { x, y: floorY }; }
    // pressure plate; down while a player or crate rests on it
    button(x, floorY, w = 1.4, o = {}) {
      const b = { kind: 'button', x, y: floorY, w, color: LINK[o.color || 'orange'], down: false, held: 0, latched: false, latch: !!o.latch };
      this.buttons.push(b); return b;
    }
    // block that slides by (dx, dy) while open() is true and back when false
    gate(b, dx, dy, open, o = {}) {
      const g = { b, x0: b.x, y0: b.y, dx, dy, open, speed: o.speed || 8, closeSpeed: o.closeSpeed || o.speed || 8 };
      b.link = o.color ? LINK[o.color] : null;
      this.gates.push(g); return g;
    }
    // o.mimic: looks like a crate; touch it and it grows spikes, then crumbles away
    crate(x, floorY, size = 1, o = {}) { return this.block(x, floorY - size, size, size, { crate: true, mimic: !!o.mimic, armed: 0, spiky: false }); }
    onJump(fn) { this.jumpHooks.push(fn); }
    setRope(n) { if (this.rope !== n) { this.rope = n; if (this.chained) { this.say(n < ROPE ? 'chain shrank!' : 'chain stretched!'); sfx.flip(); } } }
    yank(p, vx, vy) { p.vx = vx; p.vy = vy; p.grounded = false; p.ground = null; p.onP = null; }
    swapPlaces() {
      const [a, b] = this.players;
      if (!a || !b || a.dead || b.dead || a.done || b.done) return;
      for (const k of ['x', 'y', 'vx', 'vy']) { const t = a[k]; a[k] = b[k]; b[k] = t; }
      for (const q of [a, b]) { q.grounded = false; q.ground = null; q.onP = null; burst(q.x + q.w / 2, q.y + q.h / 2, C.pad, 14, 6); }
      this.cur = a; this.say('swap places!'); sfx.flip();
    }
    mirror(on = true) { this.view.mirror = on; if (on) this.say('mirror mode'); sfx.flip(); }
    flipView(on = true) { this.view.flip = on; if (on) this.say('which way is up?'); sfx.flip(); }
    moveBlock(b, x, y, speed = 8) { b.goal = { x, y, speed }; }
    block(x, y, w, h, o = {}) {
      const b = {
        kind: 'block', x, y, w, h, vy: 0, dx: 0, dy: 0, solid: true, hidden: false, crumble: 0,
        pending: false, falling: false, shakeT: 0, land: false, gone: false, flash: 0, sparkle: Math.random() * 3, ...o
      };
      this.blocks.push(b); return b;
    }
    spike(x, y, w, dir = 'up', o = {}) {
      const L = this;
      const s = {
        kind: 'spike', x, y, w, dir, out: o.hidden ? 0 : 1, target: o.hidden ? 0 : 1,
        pop() { if (s.target !== 1) { s.target = 1; sfx.pop(); L.shake(0.08, 0.08); } },
        hide() { s.target = 0; }
      };
      this.spikes.push(s); return s;
    }
    door(x, floorY, o = {}) {
      const d = { kind: 'door', x, y: floorY - 1.6, w: 1.2, h: 1.6, fake: !!o.fake, tween: null, spin: 0 };
      this.doors.push(d); return d;
    }
    saw(cx, cy, r) { const s = { kind: 'saw', x: cx, y: cy, r, vx: 0, vy: 0, rot: 0 }; this.saws.push(s); return s; }
    pad(x, y, w, g) { const p = { kind: 'pad', x, y, w, g }; this.pads.push(p); return p; }
    flag(x, floorY) { const f = { kind: 'flag', x, y: floorY - 2.2, w: 1, h: 2.2, evil: false }; this.flags.push(f); return f; }
    text(x, y, str) { this.texts.push({ x, y, str }); }

    // ---- scripting API
    // Trigger conditions are checked once per active player; L.player / L.px / L.near / L.touch
    // refer to whichever player is being checked, so level scripts work in every mode.
    on(cond, fn, o = {}) { this.triggers.push({ cond, fn, repeat: !!o.repeat, done: false }); }
    wait(sec, fn) { this.timers.push({ at: this.t + sec, fn }); }
    drop(b, delay = 0, o = {}) {
      if (b.pending || b.falling) return;
      b.pending = true; b.shakeT = delay; b.land = !!o.land;
    }
    moveDoor(d, x, floorY, speed = 30) { d.tween = { x, y: floorY - d.h, speed }; sfx.move(); }
    say(str) { this.bubbles.push({ str, t: 0, p: this.cur }); }
    shake(t = 0.2, mag = 0.25) { this.shakeT = Math.max(this.shakeT, t); this.shakeMag = Math.max(this.shakeMag, mag); }
    fakeWin() { this.banner = { text: 'LEVEL COMPLETE', sub: 'well done!', t: 0 }; sfx.win(); }
    get player() { return this.cur; }
    get other() { return this.players.find((p) => p !== this.cur); }
    all(fn) { const was = this.cur, ps = this.active(); let ok = ps.length > 0; for (const p of ps) { this.cur = p; if (!fn(p)) { ok = false; break; } } this.cur = was; return ok; }
    count(fn) { const was = this.cur; let n = 0; for (const p of this.active()) { this.cur = p; if (fn(p)) n++; } this.cur = was; return n; }
    any(fn) { const was = this.cur; let ok = false; for (const p of this.active()) { this.cur = p; if (fn(p)) { ok = true; break; } } this.cur = was; return ok; }
    get px() { return this.cur.x + this.cur.w / 2; }
    get py() { return this.cur.y + this.cur.h / 2; }
    near(o, d) { return Math.hypot(o.x + o.w / 2 - this.px, o.y + o.h / 2 - this.py) < d; }
    touch(o) { return overlap(this.cur, o.kind === 'door' ? doorBox(o) : o); }
    active() { return this.players.filter((p) => !p.dead && !p.done); }

    // ---- simulation
    step(dt) {
      this.t += dt;
      if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeMag = 0; }
      if (this.banner) {
        this.banner.t += dt;
        if (this.banner.life && this.banner.t > this.banner.life) this.banner = null;
      }
      for (const b of this.bubbles) b.t += dt;
      this.bubbles = this.bubbles.filter((b) => b.t < 1.4);

      for (let i = this.timers.length - 1; i >= 0; i--) {
        const tm = this.timers[i];
        if (this.t >= tm.at) { this.timers.splice(i, 1); tm.fn(); }
      }
      const live = () => !this.over && !this.won;
      this.updateButtons(dt);
      if (live()) {
        for (let i = 0; i < this.triggers.length; i++) {
          const tr = this.triggers[i];
          if (tr.done) continue;
          for (const p of this.active()) {
            this.cur = p;
            if (tr.cond()) { tr.fn(); if (!tr.repeat) tr.done = true; break; }
          }
        }
      }
      this.cur = this.active()[0] || this.players[0];

      this.stepWorld(dt);
      if (live()) for (const p of this.active()) this.stepPlayer(p, dt);
      if (live() && this.chained) this.chain();
      if (live()) for (const p of this.active()) { this.checkContacts(p); if (!live()) break; }
    }

    updateButtons(dt) {
      const ps = this.active();
      for (const bt of this.buttons) {
        const zone = { x: bt.x, y: bt.y - 0.4, w: bt.w, h: 0.45 };
        const was = bt.down;
        bt.down = bt.latched || ps.some((p) => overlap(p, zone)) || this.blocks.some((b) => b.crate && !b.gone && overlap(b, zone));
        if (bt.down && bt.latch) bt.latched = true;
        bt.held = bt.down ? bt.held + dt : 0;
        if (bt.down && !was) sfx.click();
      }
    }

    stepWorld(dt) {
      const ps = this.active();
      for (const g of this.gates) {
        const op = !!g.open();
        const tx = g.x0 + (op ? g.dx : 0), ty = g.y0 + (op ? g.dy : 0);
        if (!g.b.goal || g.b.goal.x !== tx || g.b.goal.y !== ty) g.b.goal = { x: tx, y: ty, speed: op ? g.speed : g.closeSpeed };
      }
      for (const b of this.blocks) {
        if (b.gone) continue;
        const ox = b.x, oy = b.y;
        if (b.goal && !b.falling) {
          const gx = b.goal.x - b.x, gy = b.goal.y - b.y, dist = Math.hypot(gx, gy), mv = b.goal.speed * dt;
          if (dist <= mv) { b.x = b.goal.x; b.y = b.goal.y; } else { b.x += (gx / dist) * mv; b.y += (gy / dist) * mv; }
        }
        if (b.crate && !b.falling) {
          b.vy = Math.min(b.vy + P.grav * dt, P.maxFall);
          b.y += b.vy * dt;
          for (const o of this.blocks) {
            if (o === b || !solid(o) || !overlap(b, o)) continue;
            if (b.vy > 0) { if (b.vy > 6) sfx.thud(); b.y = o.y - b.h; } else b.y = o.y + o.h;
            b.vy = 0;
          }
          if (b.y > ROWS + 4) b.gone = true;
        }
        if (b.mimic && !b.gone) {
          const zone = { x: b.x - 0.06, y: b.y - 0.06, w: b.w + 0.12, h: b.h + 0.12 };
          const toucher = ps.find((p) => overlap(p, zone));
          if (!b.armed && toucher) { b.armed = this.t; sfx.trap(); this.cur = toucher; this.say('that is not a crate'); }
          if (b.armed && !b.spiky && this.t - b.armed > 0.25) { b.spiky = true; sfx.pop(); }
          if (b.spiky && toucher) this.kill(toucher, 'mimic');
          if (b.armed && this.t - b.armed > 1.75) { b.gone = true; burst(b.x + b.w / 2, b.y + b.h / 2, C.crate, 20, 6); }
        }
        if (b.flash > 0) b.flash -= dt;
        if (b.crumble && !b.pending && !b.falling && ps.some((p) => p.ground === b)) this.drop(b, b.crumble);
        if (b.pending) {
          b.shakeT -= dt;
          if (b.shakeT <= 0) { b.pending = false; b.falling = true; sfx.trap(); }
        }
        if (b.falling) {
          b.vy = Math.min(b.vy + P.grav * 1.4 * dt, 40);
          b.y += b.vy * dt;
          if (b.land) {
            for (const o of this.blocks) {
              if (o !== b && solid(o) && !o.falling && overlap(b, o)) {
                b.y = o.y - b.h; b.vy = 0; b.falling = false; b.land = false;
                this.shake(0.3, 0.35); sfx.thud();
                burst(b.x + b.w / 2, b.y + b.h, C.block, 18, 6);
              }
            }
          }
          if (b.y > ROWS + 6) b.gone = true;
        }
        b.dx = b.x - ox; b.dy = b.y - oy;
      }

      for (const p of ps) {
        if (this.over) break;
        // carry the player horizontally with whatever (or whoever) they stand on
        if (p.ground && p.ground.dx) p.x += p.ground.dx;
        if (p.onP && !p.onP.dead && !p.onP.done) p.x += p.onP.lastDx || 0;
        // moving solids push (and crush) the player
        for (const b of this.blocks) {
          if (!solid(b) || (!b.dx && !b.dy) || !overlap(p, b)) continue;
          if (Math.abs(b.dy) >= Math.abs(b.dx)) { p.y = b.dy > 0 ? b.y + b.h : b.y - p.h; p.vy = b.vy || 0; }
          else p.x = b.dx > 0 ? b.x + b.w : b.x - p.w;
          for (const o of this.blocks) {
            if (o !== b && solid(o) && overlap(p, o)) { this.kill(p, 'crushed'); break; }
          }
          if (this.over) break;
        }
      }

      for (const s of this.spikes) s.out = approach(s.out, s.target, dt * 14);
      for (const s of this.saws) { s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 12; }
      for (const d of this.doors) {
        d.spin += dt;
        if (d.tween) {
          const tw = d.tween, dx = tw.x - d.x, dy = tw.y - d.y, dist = Math.hypot(dx, dy), mv = tw.speed * dt;
          if (dist <= mv) { d.x = tw.x; d.y = tw.y; d.tween = null; }
          else { d.x += (dx / dist) * mv; d.y += (dy / dist) * mv; }
        }
      }
    }

    stepPlayer(p, dt) {
      const g = this.g, src = this.swap ? 1 - p.idx : p.idx, c = ctl[src], pr = pressed[src];
      const x0 = p.x;
      let dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      if (this.invert) dir = -dir;
      let acc = p.grounded ? P.accG : P.accA;
      if (!dir && p.grounded) acc = P.fric;
      p.vx = approach(p.vx, dir * P.speed, acc * dt);
      if (dir) p.face = dir;

      // jump input (optionally lagged)
      if (pr.has('jump')) {
        pr.delete('jump');
        if (this.jumpDelay > 0) p.jq.push(this.t + this.jumpDelay);
        else { p.buf = P.buffer; p.lagged = false; }
      }
      while (p.jq.length && p.jq[0] <= this.t) { p.jq.shift(); p.buf = 0.04; p.lagged = true; }
      p.buf -= dt;
      p.coy = p.grounded ? P.coyote : p.coy - dt;
      p.hang -= dt;
      if (p.buf > 0 && (p.coy > 0 || p.hang > 0)) {
        p.vy = -P.jump * g; p.buf = 0; p.coy = 0; p.hang = 0; p.grounded = false; p.ground = null;
        p.jumping = !p.lagged; p.cut = false; p.sx = 0.7; p.sy = 1.3; sfx.jump();
        const was = this.cur; this.cur = p;
        for (const fn of this.jumpHooks) fn(p);
        this.cur = was;
      }
      if (p.jumping && !p.cut && !c.jump && p.vy * g < 0) { p.vy *= 0.5; p.cut = true; }

      p.vy = clamp(p.vy + P.grav * g * dt, -P.maxFall, P.maxFall);

      // horizontal
      p.x += p.vx * dt;
      for (const b of this.blocks) {
        if (!solid(b) || !overlap(p, b)) continue;
        if (b.crate && p.vx && this.pushCrate(b, p.vx > 0 ? p.x + p.w - b.x : p.x - (b.x + b.w))) continue;
        this.reveal(b);
        if (p.vx > 0) p.x = b.x - p.w; else if (p.vx < 0) p.x = b.x + b.w;
        p.vx = 0;
      }
      if (p.x < 0) { p.x = 0; p.vx = 0; }
      if (p.x > COLS - p.w) { p.x = COLS - p.w; p.vx = 0; }

      // vertical
      const was = p.grounded;
      p.grounded = false; p.ground = null; p.onP = null;
      const foot0 = g > 0 ? p.y + p.h : p.y;
      p.y += p.vy * dt;
      for (const b of this.blocks) {
        if (!solid(b) || !overlap(p, b)) continue;
        this.reveal(b);
        if (p.vy > 0) p.y = b.y - p.h; else if (p.vy < 0) p.y = b.y + b.h;
        if (p.vy * g > 0) { p.grounded = true; p.ground = b; }
        p.vy = 0;
      }
      // players can stand on each other's heads
      if (p.vy * g >= 0) {
        for (const q of this.active()) {
          if (q === p || !overlap(p, q)) continue;
          const head = g > 0 ? q.y : q.y + q.h;
          if (g > 0 ? foot0 <= head + 0.12 : foot0 >= head - 0.12) {
            p.y = g > 0 ? q.y - p.h : q.y + q.h;
            p.vy = 0; p.grounded = true; p.onP = q;
          }
        }
      }
      p.lastDx = p.x - x0;
      if (p.grounded && !was) { p.sx = 1.25; p.sy = 0.78; p.jumping = false; }
      p.sx = approach(p.sx, 1, dt * 4); p.sy = approach(p.sy, 1, dt * 4);
    }

    // try to shove a crate sideways by amt tiles; returns false if it is blocked
    pushCrate(b, amt) {
      const ox = b.x;
      b.x += amt;
      let ok = b.x >= 0 && b.x + b.w <= COLS;
      if (ok) for (const o of this.blocks) if (o !== b && solid(o) && overlap(b, o)) { ok = false; break; }
      if (!ok) { b.x = ox; return false; }
      b.dx = (b.dx || 0) + amt;
      return true;
    }

    // Special mode: keep the two players within ROPE of each other. Whoever stands on solid
    // ground is the heavier anchor, and a player dangling from an anchored partner may jump.
    chain() {
      const [a, b] = this.players;
      a.taut = b.taut = false;
      if (a.dead || b.dead) return;
      const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
      const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
      this.snagCheck(ax, ay, bx, by);
      if (d <= this.rope || d === 0) return;
      const nx = dx / d, ny = dy / d, ex = d - this.rope;
      let wa = a.grounded ? 0.2 : 1, wb = b.grounded ? 0.2 : 1;
      const sum = wa + wb; wa /= sum; wb /= sum;
      a.x += nx * ex * wa; a.y += ny * ex * wa;
      b.x -= nx * ex * wb; b.y -= ny * ex * wb;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel > 0) { a.vx += nx * rel * wa; a.vy += ny * rel * wa; b.vx -= nx * rel * wb; b.vy -= ny * rel * wb; }
      a.taut = b.taut = true;
      this.unstick(a); this.unstick(b);
      if (!a.grounded && b.grounded) a.hang = P.coyote;
      if (!b.grounded && a.grounded) b.hang = P.coyote;
    }

    // the chain catches on popped spikes and saws: both players get yanked toward each other
    snagCheck(ax, ay, bx, by) {
      if (this.t < this.snagT) return;
      for (let i = 1; i < 10; i++) {
        const x = ax + ((bx - ax) * i) / 10, y = ay + ((by - ay) * i) / 10;
        const pt = { x: x - 0.05, y: y - 0.05, w: 0.1, h: 0.1 };
        const hit = this.spikes.some((s) => s.out > 0.6 && overlap(pt, spikeBox(s))) || this.saws.some((s) => Math.hypot(s.x - x, s.y - y) < s.r);
        if (!hit) continue;
        const [a, b] = this.players, dir = Math.sign(bx - ax) || 1;
        this.yank(a, dir * 7, -9 * this.g); this.yank(b, -dir * 7, -9 * this.g);
        this.snagT = this.t + 1; this.cur = a; this.say('chain snagged!'); sfx.thud(); this.shake(0.15, 0.2);
        burst(x, y, C.saw, 10, 5);
        return;
      }
    }

    unstick(p) {
      for (const b of this.blocks) {
        if (!solid(b) || !overlap(p, b)) continue;
        this.reveal(b);
        const l = p.x + p.w - b.x, r = b.x + b.w - p.x, u = p.y + p.h - b.y, dn = b.y + b.h - p.y;
        const m = Math.min(l, r, u, dn);
        if (m === l) { p.x -= l; p.vx = Math.min(p.vx, 0); }
        else if (m === r) { p.x += r; p.vx = Math.max(p.vx, 0); }
        else if (m === u) { p.y -= u; if (p.vy > 0) p.vy = 0; if (this.g > 0) { p.grounded = true; p.ground = b; } }
        else { p.y += dn; if (p.vy < 0) p.vy = 0; if (this.g < 0) { p.grounded = true; p.ground = b; } }
      }
      p.x = clamp(p.x, 0, COLS - p.w);
    }

    reveal(b) {
      if (!b.hidden) return;
      b.hidden = false; b.flash = 0.4; sfx.reveal();
      burst(b.x + b.w / 2, b.y + b.h / 2, C.portal, 12, 5);
    }

    checkContacts(p) {
      for (const s of this.spikes) if (s.out > 0.6 && overlap(p, spikeBox(s))) return this.kill(p, 'spikes');
      for (const s of this.saws) {
        const cx = clamp(s.x, p.x, p.x + p.w), cy = clamp(s.y, p.y, p.y + p.h);
        if (Math.hypot(s.x - cx, s.y - cy) < s.r * 0.82) return this.kill(p, 'saw');
      }
      if (p.y > ROWS + 1 || p.y < -3) return this.kill(p, 'fell');
      for (const pd of this.pads) {
        if (this.g !== pd.g && overlap(p, padBox(pd))) {
          this.g = pd.g; sfx.flip();
          for (const q of this.players) { q.jumping = false; q.grounded = false; q.ground = null; }
          burst(p.x + p.w / 2, p.y + p.h / 2, C.pad, 14, 6);
        }
      }
      for (const d of this.doors) {
        if (d.fake || d.tween || !overlap(p, doorBox(d))) continue;
        // multiplayer: everyone has to make it in; single and chained: one touch is enough
        if (this.mode.players > 1 && !this.chained) {
          p.done = true; sfx.reveal();
          burst(p.x + p.w / 2, p.y + p.h / 2, SKINS[p.idx].main, 20, 7);
          this.cur = p; this.say('in!');
          if (this.active().length === 0) this.win();
        } else this.win();
        return;
      }
    }

    kill(p = this.active()[0], cause = 'restart') {
      if (this.over || !p) return;
      this.over = true; this.victim = p; this.cause = cause;
      save.deaths++;
      const dk = dkey(this.mode.id, this.idx);
      save.levelDeaths[dk] = (save.levelDeaths[dk] || 0) + 1;
      persist();
      // one dies, everyone restarts
      for (const q of this.players) {
        if (q.done) continue;
        q.dead = true;
        burst(q.x + q.w / 2, q.y + q.h / 2, SKINS[q.idx].main, q === p ? 34 : 18, q === p ? 11 : 7);
      }
      this.shake(0.3, 0.4);
      sfx.die();
      if (this.mode.players === 1) {
        game.message = { text: pick(DEATH_LINES), t: 0 };
        this.wait(0.75, () => game.restart());
        return;
      }
      // 2-player modes: blame, shame stats, strikes
      const v = SKINS[p.idx].name, o = SKINS[1 - p.idx].name;
      save.shame[this.mode.id][p.idx]++; persist();
      game.runDeaths[p.idx]++;
      game.strikes++;
      const r = Math.random();
      const line = r < 0.4 ? pick(BLAME_LINES).replace(/\{v\}/g, v).replace(/\{o\}/g, o)
        : `${v}: ${pick(this.chained && r < 0.7 ? CHAIN_LINES : r < 0.85 ? TEAM_LINES : DEATH_LINES)}`;
      game.message = { text: line, t: 0 };
      if (game.strikes >= STRIKES) this.wait(0.9, () => game.strikeOut());
      else this.wait(0.75, () => game.restart());
    }

    win() {
      this.won = true;
      this.banner = { text: pick(['NICE', 'OKAY FINE', 'LUCKY', 'HMPH']), sub: '', t: 0 };
      if (this.mode.players > 1) {
        const [d0, d1] = game.runDeaths;
        if (d0 !== d1) {
          const li = d0 > d1 ? 0 : 1;
          this.banner.sub = pick(MOCK_LINES).replace(/\{l\}/g, SKINS[li].name).replace(/\{w\}/g, SKINS[1 - li].name).replace(/\{n\}/g, Math.max(d0, d1));
        } else if (d0 > 0) this.banner.sub = `${d0} deaths each. equally bad.`;
        else this.banner.sub = 'first try?? suspicious.';
      }
      sfx.win();
      const p = this.cur;
      burst(p.x + p.w / 2, p.y + p.h / 2, C.portal, 40, 10);
      const prog = save.progress;
      if (this.idx + 2 > prog[this.mode.id]) { prog[this.mode.id] = Math.min(course(this.mode.id).length, this.idx + 2); persist(); }
      this.wait(this.mode.players > 1 ? 1.8 : 1.0, () => game.next());
    }
  }

  // ---------------------------------------------------------------- game state
  const game = {
    state: 'title', // title | mode | select | play | end
    mode: 'single', modeSel: 0,
    level: null, idx: 0, sel: 0, scrollY: 0, targetScrollY: 0, message: null, time: 0, strikes: 0, runDeaths: [0, 0],
    unlocked() { return Math.min(save.progress[this.mode] || 1, course(this.mode).length); },
    clearInput() { pressed[0].clear(); pressed[1].clear(); },
    setMode(id) { this.mode = id; syncCtl(); },
    start(idx, keepMessage = false) {
      this.idx = idx; this.level = new Level(idx, this.mode); this.state = 'play';
      particles = []; this.clearInput(); if (!keepMessage) this.message = null;
      this.strikes = 0; this.runDeaths = [0, 0];
      if (MODE[this.mode].chained) this.level.banner = { text: 'SURPRISE!', sub: "you're chained together. good luck.", t: 0, life: 2.4 };
    },
    restart() { this.level = new Level(this.idx, this.mode); this.clearInput(); },
    // too many deaths in one level: back one level, and that level's unlock is gone
    strikeOut() {
      const back = Math.max(0, this.idx - 1);
      save.progress[this.mode] = back + 1; persist();
      this.start(back, true);
      this.level.banner = {
        text: `${STRIKES} STRIKES`, t: 0, life: 2.6,
        sub: this.idx === 0 && back === 0 ? 'back to level 1. again.' : `back to level ${back + 1}. progress deleted.`,
      };
    },
    next() { if (this.idx + 1 < course(this.mode).length) this.start(this.idx + 1); else { this.state = 'end'; sfx.win(); } },
  };

  function onKey(code) {
    const go = code === 'Enter' || code === 'Space' || code === 'KeyZ';
    if (code === 'KeyM') { save.muted = !save.muted; persist(); return; }
    if (game.state === 'title') {
      if (go) { sfx.click(); game.state = 'mode'; }
    } else if (game.state === 'mode') {
      if (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowDown' || code === 'KeyS') { game.modeSel = Math.min(MODES.length - 1, game.modeSel + 1); sfx.click(); }
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowUp' || code === 'KeyW') { game.modeSel = Math.max(0, game.modeSel - 1); sfx.click(); }
      if (go) { sfx.click(); game.setMode(MODES[game.modeSel].id); game.start(game.unlocked() - 1); }
      if (code === 'KeyL') {
        sfx.click();
        game.setMode(MODES[game.modeSel].id);
        game.state = 'select';
        game.sel = game.unlocked() - 1;
        updateSelectScroll(true);
      }
      if (code === 'Escape') game.state = 'title';
    } else if (game.state === 'select') {
      const n = game.unlocked();
      const prevSel = game.sel;
      if (code === 'ArrowRight' || code === 'KeyD') game.sel = Math.min(n - 1, game.sel + 1);
      if (code === 'ArrowLeft' || code === 'KeyA') game.sel = Math.max(0, game.sel - 1);
      if (code === 'ArrowDown' || code === 'KeyS') game.sel = Math.min(n - 1, game.sel + SEL.cols);
      if (code === 'ArrowUp' || code === 'KeyW') game.sel = Math.max(0, game.sel - SEL.cols);
      if (game.sel !== prevSel) {
        sfx.click();
        updateSelectScroll();
      }
      if (go) { sfx.click(); game.start(game.sel); }
      if (code === 'Escape') game.state = 'mode';
    } else if (game.state === 'play') {
      if (code === 'KeyR' && !game.level.won) game.level.kill();
      if (code === 'Escape') {
        game.state = 'select';
        game.sel = game.idx;
        updateSelectScroll(true);
      }
    } else if (game.state === 'end') {
      if (go || code === 'Escape') game.state = 'mode';
    }
  }

  // clicks / taps on menus & wheel scrolling
  {
    const cv = document.getElementById('game');
    cv.addEventListener('pointerdown', (e) => {
      audioOn();
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * VW, y = ((e.clientY - r.top) / r.height) * VH;
      if (game.state === 'title') onKey('Enter');
      else if (game.state === 'mode') {
        const i = modeHit(x, y);
        if (i >= 0) { game.modeSel = i; onKey('Enter'); }
        else if (y > VH - 70) onKey('KeyL');
        else if (y < 90) onKey('Escape');
      } else if (game.state === 'select') {
        const i = selectHit(x, y);
        if (i >= 0 && i < game.unlocked()) { game.sel = i; updateSelectScroll(); onKey('Enter'); }
        else if (y < 90) onKey('Escape');
      } else if (game.state === 'end') onKey('Enter');
    });

    cv.addEventListener('wheel', (e) => {
      if (game.state === 'select') {
        e.preventDefault();
        const maxScroll = maxSelectScroll();
        game.targetScrollY = clamp(game.targetScrollY + Math.sign(e.deltaY) * 60, 0, maxScroll);
      }
    }, { passive: false });
  }

  // ---------------------------------------------------------------- rendering
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  let scale = 1;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    scale = Math.min(innerWidth / VW, innerHeight / VH) * 0.98;
    cv.style.width = Math.floor(VW * scale) + 'px';
    cv.style.height = Math.floor(VH * scale) + 'px';
    cv.width = Math.floor(VW * scale * dpr);
    cv.height = Math.floor(VH * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  function baseTransform() { const dpr = window.devicePixelRatio || 1; ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0); }

  function drawBg() {
    const gr = ctx.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, C.bg1); gr.addColorStop(1, C.bg2);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * TILE + 0.5, 0); ctx.lineTo(x * TILE + 0.5, VH); }
    for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * TILE + 0.5); ctx.lineTo(VW, y * TILE + 0.5); }
    ctx.stroke();
  }

  function text(str, x, y, size, color = C.text, align = 'center', weight = 'bold') {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawButton(bt) {
    const x = bt.x * TILE, y = bt.y * TILE, w = bt.w * TILE, depth = bt.down ? 3 : 7;
    ctx.fillStyle = C.blockEdge; ctx.fillRect(x - 2, y - 3, w + 4, 3);
    ctx.save(); ctx.shadowColor = bt.color; ctx.shadowBlur = bt.down ? 14 : 6;
    ctx.fillStyle = bt.color; ctx.fillRect(x + 3, y - depth, w - 6, depth - 2); ctx.restore();
  }

  function drawCrate(b) {
    const j = b.armed && !b.spiky ? (Math.random() - 0.5) * 4 : 0;
    const x = b.x * TILE + j, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    if (b.spiky) {
      ctx.fillStyle = C.spike;
      ctx.beginPath();
      const cx = x + w / 2, cy = y + h / 2;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? w * 0.5 : w * 0.85;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.danger; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      return;
    }
    ctx.fillStyle = C.crateDark; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.crate; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.strokeStyle = C.crateDark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + w - 4, y + h - 4); ctx.moveTo(x + w - 4, y + 4); ctx.lineTo(x + 4, y + h - 4); ctx.stroke();
  }

  function drawBlock(b, L) {
    if (b.gone) return;
    if (b.crate) return drawCrate(b);
    let ox = 0, oy = 0;
    if (b.pending) { ox = (Math.random() - 0.5) * 3; oy = (Math.random() - 0.5) * 2; }
    const x = b.x * TILE + ox, y = b.y * TILE + oy, w = b.w * TILE, h = b.h * TILE;
    if (b.hidden) {
      // the faintest shimmer, every few seconds
      const ph = (L.t + b.sparkle) % 3.2;
      if (ph < 0.35) {
        ctx.globalAlpha = 0.5 * Math.sin((ph / 0.35) * Math.PI);
        ctx.fillStyle = C.portal;
        ctx.fillRect(x + w * ((b.sparkle * 7) % 1) - 2, y + h * 0.5 - 2, 4, 4);
        ctx.globalAlpha = 1;
      }
      return;
    }
    ctx.fillStyle = C.blockEdge; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.block; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = C.blockTop; ctx.fillRect(x + 2, y + 2, w - 4, 3);
    if (b.link) {
      ctx.fillStyle = b.link;
      for (let k = 0; k * 12 < h - 8; k++) ctx.fillRect(x + w / 2 - 3, y + 6 + k * 12, 6, 6);
    }
    if (b.flash > 0) { ctx.globalAlpha = b.flash / 0.4; ctx.fillStyle = C.portal; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
  }

  function drawSpike(s) {
    if (s.out <= 0.01) return;
    const hgt = 0.62 * TILE * s.out;
    ctx.fillStyle = C.spike;
    ctx.beginPath();
    for (let i = 0; i < s.w; i++) {
      const x0 = (s.x + i) * TILE, y0 = s.y * TILE;
      if (s.dir === 'up') { ctx.moveTo(x0 + 2, y0); ctx.lineTo(x0 + TILE / 2, y0 - hgt); ctx.lineTo(x0 + TILE - 2, y0); }
      else { ctx.moveTo(x0 + 2, y0); ctx.lineTo(x0 + TILE / 2, y0 + hgt); ctx.lineTo(x0 + TILE - 2, y0); }
    }
    ctx.fill();
  }

  function drawDoor(d, t) {
    const cx = (d.x + d.w / 2) * TILE, cy = (d.y + d.h / 2) * TILE, rx = (d.w / 2) * TILE, ry = (d.h / 2) * TILE;
    ctx.save();
    ctx.shadowColor = C.portal; ctx.shadowBlur = 18;
    ctx.fillStyle = '#0a2e3a';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = C.portal; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 1; i <= 3; i++) {
      const k = 1 - i * 0.24;
      ctx.globalAlpha = 0.25 + 0.2 * i;
      ctx.setLineDash([6, 7]); ctx.lineDashOffset = (t * 30 * (i % 2 ? 1 : -1));
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSaw(s) {
    const cx = s.x * TILE, cy = s.y * TILE, r = s.r * TILE;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.rot);
    ctx.fillStyle = C.saw; ctx.beginPath();
    const teeth = 12;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.78 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.danger; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPad(pd, t) {
    const b = padBox(pd), x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    ctx.save(); ctx.shadowColor = C.pad; ctx.shadowBlur = 12 + Math.sin(t * 5) * 5;
    ctx.fillStyle = C.pad; ctx.fillRect(x, y, w, h); ctx.restore();
    ctx.fillStyle = C.pad; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5);
    const n = Math.round(pd.w * 2);
    for (let i = 0; i < n; i++) {
      const ax = x + (i + 0.5) * (w / n), up = pd.g < 0, ay = up ? y - 8 - ((t * 20) % 10) : y + h + 8 + ((t * 20) % 10);
      ctx.beginPath(); ctx.moveTo(ax - 5, ay + (up ? 5 : -5)); ctx.lineTo(ax, ay); ctx.lineTo(ax + 5, ay + (up ? 5 : -5)); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFlag(f, t) {
    const x = (f.x + 0.45) * TILE, top = f.y * TILE, bot = (f.y + f.h) * TILE;
    ctx.fillStyle = C.blockEdge; ctx.fillRect(x, top, 3, bot - top);
    const col = f.evil ? C.danger : C.flag, wave = Math.sin(t * 6) * 3;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + 3, top); ctx.lineTo(x + 30, top + 8 + wave); ctx.lineTo(x + 3, top + 17); ctx.fill();
  }

  function drawPlayer(p, L) {
    if (p.dead || p.done) return;
    const cx = (p.x + p.w / 2) * TILE, base = L.g > 0 ? (p.y + p.h) * TILE : p.y * TILE;
    const w = p.w * TILE * p.sx, h = p.h * TILE * p.sy;
    ctx.save();
    ctx.translate(cx, base);
    if (L.g < 0) ctx.scale(1, -1);
    const skin = SKINS[p.idx || 0];
    ctx.fillStyle = skin.dark; roundRect(-w / 2, -h, w, h, 5); ctx.fill();
    ctx.fillStyle = skin.main; roundRect(-w / 2 + 1.5, -h + 1.5, w - 3, h - 5, 4); ctx.fill();
    // eyes
    const look = p.face * 2.5, ey = -h * 0.62;
    for (const ex of [-5, 5]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex + look * 0.6, ey, 3.6, 4.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.eye; ctx.beginPath(); ctx.arc(ex + look, ey + (L.invert ? -1 : 0.8), 1.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawChain(L) {
    const [a, b] = L.players;
    if (a.dead || b.dead) return;
    const ax = (a.x + a.w / 2) * TILE, ay = (a.y + a.h / 2) * TILE, bx = (b.x + b.w / 2) * TILE, by = (b.y + b.h / 2) * TILE;
    const d = Math.hypot(bx - ax, by - ay) / TILE, sag = Math.max(0, L.rope - d) * 0.55 * TILE * L.g;
    const mx = (ax + bx) / 2, my = (ay + by) / 2 + sag;
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * ax + 2 * u * t * mx + t * t * bx, y = u * u * ay + 2 * u * t * my + t * t * by;
      ctx.strokeStyle = a.taut ? C.danger : C.saw; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 3.2, 2.2, Math.atan2(by - ay, bx - ax) + (i % 2 ? Math.PI / 2 : 0), 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawBubble(b, L) {
    const p = b.p || L.players[0];
    if (p.dead) return;
    const x = (p.x + p.w / 2) * TILE, y = (L.g > 0 ? p.y - 0.9 : p.y + p.h + 0.9) * TILE - Math.min(b.t, 0.3) * 20 * L.g;
    ctx.globalAlpha = clamp((1.4 - b.t) / 0.3, 0, 1);
    ctx.font = `bold 14px ${FONT}`;
    const w = ctx.measureText(b.str).width + 14;
    ctx.fillStyle = 'rgba(232,230,240,0.95)'; roundRect(x - w / 2, y - 12, w, 24, 6); ctx.fill();
    text(b.str, x, y + 1, 14, C.bg1);
    ctx.globalAlpha = 1;
  }

  function drawLevel(L) {
    const t = L.t;
    ctx.save();
    if (L.shakeT > 0) ctx.translate((Math.random() - 0.5) * L.shakeMag * TILE, (Math.random() - 0.5) * L.shakeMag * TILE);
    if (L.view.mirror) { ctx.translate(VW, 0); ctx.scale(-1, 1); }
    if (L.view.flip) { ctx.translate(0, VH); ctx.scale(1, -1); }
    drawBg();
    for (const tx of L.texts) text(tx.str, tx.x * TILE, tx.y * TILE, 18, C.dim, 'left', 'normal');
    for (const f of L.flags) drawFlag(f, t);
    for (const d of L.doors) drawDoor(d, t);
    for (const s of L.spikes) drawSpike(s);
    for (const b of L.blocks) drawBlock(b, L);
    for (const pd of L.pads) drawPad(pd, t);
    for (const bt of L.buttons) drawButton(bt);
    for (const s of L.saws) drawSaw(s);
    if (L.chained) drawChain(L);
    for (const p of L.players) drawPlayer(p, L);
    for (const p of particles) {
      ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.color;
      ctx.fillRect(p.x * TILE, p.y * TILE, p.size * TILE, p.size * TILE);
    }
    ctx.globalAlpha = 1;
    for (const b of L.bubbles) drawBubble(b, L);
    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(13,12,29,0.55)'; ctx.fillRect(0, 0, VW, 34);
    text(`${String(L.idx + 1).padStart(2, '0')} / ${course(L.mode.id).length}  ${L.def.name.toUpperCase()}`, 14, 18, 15, C.text, 'left');
    const ld = save.levelDeaths[dkey(L.mode.id, L.idx)] || 0;
    text(`deaths here ${ld}   total ${save.deaths}`, VW - 14, 18, 15, C.danger, 'right');
    if (L.mode.players > 1) {
      const sh = save.shame[L.mode.id];
      text(`${L.mode.label || L.mode.name}   strikes ${'✕'.repeat(game.strikes)}${'·'.repeat(Math.max(0, STRIKES - game.strikes))}`, VW / 2, 14, 12, C.portal);
      text(`shame: PINK ${sh[0]} · BLUE ${sh[1]}`, VW / 2, 28, 11, C.text, 'center', 'normal');
    }

    if (L.banner) {
      let k = Math.min(1, L.banner.t * 6);
      if (L.banner.life) k = Math.min(k, clamp((L.banner.life - L.banner.t) / 0.3, 0, 1));
      ctx.fillStyle = `rgba(13,12,29,${0.6 * k})`; ctx.fillRect(0, VH / 2 - 60, VW, 120);
      text(L.banner.text, VW / 2, VH / 2 - 10, 54 * (0.6 + 0.4 * k), C.portal);
      if (L.banner.sub) text(L.banner.sub, VW / 2, VH / 2 + 34, 16, C.text, 'center', 'normal');
    }
    if (game.message) {
      const m = game.message, a = clamp((1.6 - m.t) / 0.3, 0, 1);
      ctx.globalAlpha = a; text(m.text, VW / 2, 80, 26, C.danger); ctx.globalAlpha = 1;
    }
    text(`${L.mode.hint} · R restart · ESC levels · M mute`, VW / 2, VH - 12, 12, 'rgba(20,20,43,0.55)', 'center', 'normal');
  }

  function drawTitle(t) {
    drawBg();
    // a little demo: the hero keeps getting got
    const cycle = t % 3.2, floorY = 10.5 * TILE;
    const gone = cycle > 1.6;
    ctx.fillStyle = C.blockEdge; ctx.fillRect(10 * TILE, floorY, 12 * TILE, 4);
    ctx.fillStyle = C.block; ctx.fillRect(10 * TILE, floorY + 4, 12 * TILE, TILE - 4);
    if (!gone) { ctx.fillStyle = C.block; ctx.fillRect(18 * TILE, floorY, 2 * TILE, TILE); }
    const px = 10.5 + Math.min(cycle, 1.6) * 5, fall = gone ? (cycle - 1.6) ** 2 * 40 : 0;
    if (fall < 8) {
      const fakeL = { g: 1, invert: false };
      drawPlayer({ x: px, y: 10.5 - P.h + fall, w: P.w, h: P.h, sx: 1, sy: 1, face: 1, dead: false }, fakeL);
    }
    ctx.fillStyle = C.bg1; if (gone) ctx.fillRect(18 * TILE, floorY, 2 * TILE, TILE);

    text('MASTER BAITER', VW / 2, 150, 80, C.player);
    text('a platformer that does not like you', VW / 2, 215, 18, C.text, 'center', 'normal');
    const blink = Math.sin(t * 4) > -0.3;
    if (blink) text('press SPACE / tap to play', VW / 2, VH * 0.74, 22, C.portal);
    text(`deaths so far: ${save.deaths}`, VW / 2, VH * 0.82, 16, C.danger);
    text(save.muted ? 'sound off (M)' : 'sound on (M)', VW / 2, VH - 20, 12, C.dim, 'center', 'normal');
  }

  const SEL = { cols: 5, w: 120, h: 86, gapX: 24, gapY: 14, viewTop: 116, viewBottom: 426 };
  function rowStep() { return SEL.h + SEL.gapY; }
  function maxSelectScroll() {
    const totalLevels = course(game.mode).length;
    const totalRows = Math.ceil(totalLevels / SEL.cols);
    const visibleRows = Math.floor((SEL.viewBottom - SEL.viewTop + SEL.gapY) / rowStep());
    const extraRows = Math.max(0, totalRows - visibleRows);
    return extraRows * rowStep();
  }
  function selectRect(i, scroll = 0) {
    const totalW = SEL.cols * SEL.w + (SEL.cols - 1) * SEL.gapX, x0 = (VW - totalW) / 2;
    const row = Math.floor(i / SEL.cols);
    const col = i % SEL.cols;
    return {
      x: x0 + col * (SEL.w + SEL.gapX),
      y: SEL.viewTop + row * rowStep() - scroll,
      w: SEL.w,
      h: SEL.h
    };
  }
  function selectHit(x, y) {
    if (y < SEL.viewTop || y > SEL.viewBottom) return -1;
    for (let i = 0; i < course(game.mode).length; i++) {
      const r = selectRect(i, game.scrollY);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }
  function updateSelectScroll(instantly = false) {
    const sel = game.sel;
    const row = Math.floor(sel / SEL.cols);
    const step = rowStep();
    const visibleRows = Math.floor((SEL.viewBottom - SEL.viewTop + SEL.gapY) / step);
    const maxScroll = maxSelectScroll();

    const curScrollRow = Math.round(game.targetScrollY / step);
    if (row < curScrollRow) {
      game.targetScrollY = row * step;
    } else if (row >= curScrollRow + visibleRows) {
      game.targetScrollY = (row - visibleRows + 1) * step;
    }
    game.targetScrollY = clamp(game.targetScrollY, 0, maxScroll);
    if (instantly) game.scrollY = game.targetScrollY;
  }
  function drawSelect(t) {
    drawBg();
    text('PICK YOUR POISON', VW / 2, 45, 36, C.player);
    text(`${MODE[game.mode].name} · ESC back · ↑/↓/Wheel to scroll`, VW / 2, 82, 13, C.dim, 'center', 'normal');

    // Smooth scroll interpolation
    game.scrollY = approach(game.scrollY, game.targetScrollY, 20);

    // Clip to scroll viewable area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, SEL.viewTop, VW, SEL.viewBottom - SEL.viewTop);
    ctx.clip();

    for (let i = 0; i < course(game.mode).length; i++) {
      const r = selectRect(i, game.scrollY);
      if (r.y + r.h < SEL.viewTop - 5 || r.y > SEL.viewBottom + 5) continue;
      const open = i < game.unlocked(), on = i === game.sel;
      ctx.fillStyle = on ? 'rgba(255,79,139,0.25)' : 'rgba(232,230,240,0.06)';
      roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
      ctx.strokeStyle = on ? C.player : open ? C.blockEdge : 'rgba(232,230,240,0.15)'; ctx.lineWidth = on ? 3 : 1.5; ctx.stroke();
      text(open ? String(i + 1) : '?', r.x + r.w / 2, r.y + 32, 30, open ? C.text : C.dim);
      const d = save.levelDeaths[dkey(game.mode, i)] || 0;
      text(open ? `☠ ${d}` : 'locked', r.x + r.w / 2, r.y + 65, 13, open ? C.danger : C.dim, 'center', 'normal');
    }
    ctx.restore();

    // Scrollbar indicator
    const maxScroll = maxSelectScroll();
    if (maxScroll > 0) {
      const barTrackX = VW - 30;
      const barTrackY = SEL.viewTop;
      const barTrackH = SEL.viewBottom - SEL.viewTop;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(barTrackX, barTrackY, 5, barTrackH, 2.5);
      ctx.fill();

      const totalH = (SEL.viewBottom - SEL.viewTop) + maxScroll;
      const viewRatio = (SEL.viewBottom - SEL.viewTop) / totalH;
      const thumbH = Math.max(32, barTrackH * viewRatio);
      const thumbY = barTrackY + (game.scrollY / maxScroll) * (barTrackH - thumbH);
      ctx.fillStyle = C.portal;
      roundRect(barTrackX, thumbY, 5, thumbH, 2.5);
      ctx.fill();
    }

    // Selected level description footer
    const s = course(game.mode)[game.sel];
    if (s) text(s.name, VW / 2, VH - 50, 22, C.portal);
  }

  const MCARD = { w: 270, h: 260, gap: 30, top: 140 };
  function modeRect(i) {
    const x0 = (VW - (MODES.length * MCARD.w + (MODES.length - 1) * MCARD.gap)) / 2;
    return { x: x0 + i * (MCARD.w + MCARD.gap), y: MCARD.top, w: MCARD.w, h: MCARD.h };
  }
  function modeHit(x, y) {
    for (let i = 0; i < MODES.length; i++) { const r = modeRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i; }
    return -1;
  }
  function drawMode(t) {
    drawBg();
    text('CHOOSE YOUR SUFFERING', VW / 2, 80, 36, C.player);
    const fakeL = { g: 1, invert: false };
    MODES.forEach((m, i) => {
      const r = modeRect(i), on = i === game.modeSel, cx = r.x + r.w / 2;
      ctx.fillStyle = on ? 'rgba(255,79,139,0.22)' : 'rgba(232,230,240,0.06)';
      roundRect(r.x, r.y, r.w, r.h, 14); ctx.fill();
      ctx.strokeStyle = on ? C.player : C.blockEdge; ctx.lineWidth = on ? 3 : 1.5; ctx.stroke();
      // little preview
      const bob = (k) => Math.abs(Math.sin(t * 3 + k)) * 0.5;
      ctx.save(); ctx.translate(cx, r.y + 105); ctx.scale(1.6, 1.6); ctx.translate(-cx, -(r.y + 105));
      const py = (r.y + 105) / TILE;
      if (m.id === 'single') {
        drawPlayer({ idx: 0, x: cx / TILE - 0.4, y: py - P.h - bob(0), w: P.w, h: P.h, sx: 1, sy: 1, face: 1 }, fakeL);
      } else if (m.id === 'multi') {
        drawPlayer({ idx: 0, x: cx / TILE - 1.2, y: py - P.h - bob(0), w: P.w, h: P.h, sx: 1, sy: 1, face: 1 }, fakeL);
        drawPlayer({ idx: 1, x: cx / TILE + 0.4, y: py - P.h - bob(1.5), w: P.w, h: P.h, sx: 1, sy: 1, face: -1 }, fakeL);
      }
      ctx.restore();
      if (m.id === 'special') {
        const wob = Math.sin(t * 5) * 0.12;
        ctx.save(); ctx.translate(cx, r.y + 85); ctx.rotate(wob);
        text('?', 0, 0, 96, C.portal); ctx.restore();
        for (let k = 0; k < 5; k++) {
          const a = t * 1.5 + k * 1.256;
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6 + k);
          ctx.fillStyle = k % 2 ? C.player : C.spike;
          ctx.fillRect(cx + Math.cos(a) * 70 - 2, r.y + 85 + Math.sin(a) * 40 - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }
      text(m.name, cx, r.y + 175, 22, on ? C.text : C.blockEdge);
      text(m.sub, cx, r.y + 205, 14, C.dim, 'center', 'normal');
      const lvl = Math.min(save.progress[m.id] || 1, course(m.id).length);
      text(`level ${lvl} / ${course(m.id).length}`, cx, r.y + 235, 13, C.danger, 'center', 'normal');
    });
    const m = MODES[game.modeSel];
    text(m.hint, VW / 2, MCARD.top + MCARD.h + 45, 15, C.portal, 'center', 'normal');
    if (m.players > 1 && matchMedia('(pointer: coarse)').matches) text('2-player modes need a keyboard', VW / 2, MCARD.top + MCARD.h + 72, 13, C.danger, 'center', 'normal');
    text('←/→ choose · ENTER play · L pick level · ESC back', VW / 2, VH - 30, 14, C.dim, 'center', 'normal');
  }

  function drawEnd(t) {
    drawBg();
    text('YOU WIN.', VW / 2, 170, 80, C.portal);
    const endSub = { single: 'for real this time.', multi: 'together. somehow.', special: 'and you are STILL chained together.' };
    text(endSub[game.mode], VW / 2, 230, 18, C.text, 'center', 'normal');
    text(`total deaths: ${save.deaths}`, VW / 2, 300, 30, C.danger);
    const rank = save.deaths < 25 ? 'suspiciously good' : save.deaths < 60 ? 'respectable suffering' : save.deaths < 120 ? 'certified rager' : 'controller is in the wall';
    text(`rank: ${rank}`, VW / 2, 345, 18, C.text, 'center', 'normal');
    if (Math.sin(t * 4) > -0.3) text('press SPACE', VW / 2, 430, 20, C.player);
  }

  // ---------------------------------------------------------------- main loop
  let last = performance.now(), acc = 0;
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now; game.time += dt;
    if (game.state === 'play') {
      acc += dt;
      while (acc >= STEP) { game.level.step(STEP); acc -= STEP; }
    }
    updateParticles(dt);
    if (game.message) { game.message.t += dt; if (game.message.t > 1.6) game.message = null; }

    baseTransform();
    if (game.state === 'title') drawTitle(game.time);
    else if (game.state === 'mode') drawMode(game.time);
    else if (game.state === 'select') drawSelect(game.time);
    else if (game.state === 'play') drawLevel(game.level);
    else drawEnd(game.time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // deterministic hooks for automated tests (no effect on normal play)
  window.__ragebait = {
    game, keys: ctl[0], pressed: pressed[0], ctl, pressedAll: pressed,
    load(i, mode = 'single') { game.setMode(mode); game.start(i); },
    step(n = 1) { for (let i = 0; i < n; i++) game.level.step(STEP); },
    STEP,
  };
})();
