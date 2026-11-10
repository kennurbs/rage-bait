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
  };
  const FONT = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

  const DEATH_LINES = [
    'skill issue', 'did you even look?', 'the floor was lava. sort of.', 'classic.',
    'that was on purpose, right?', 'again!', 'we saw that.', 'so close. not really.',
    'have you tried not dying?', 'trust no tile.', 'muscle memory: 0', 'press R to cope',
    'ouch.', 'the level says hi.', 'bold strategy.', 'noted for the highlight reel.',
    'that one was mean, sorry. (not sorry)', 'gravity: 1, you: 0', 'certified rage moment',
  ];

  // ---------------------------------------------------------------- save data
  const SAVE_KEY = 'ragebait.save.v1';
  const save = (() => {
    const def = { unlocked: 1, deaths: 0, levelDeaths: {}, muted: false };
    try { return Object.assign(def, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); }
    catch (e) { return def; }
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
  const keys = { left: false, right: false, jump: false };
  const pressed = new Set();
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
  };
  function press(k) { if (!keys[k]) pressed.add(k); keys[k] = true; }
  function release(k) { keys[k] = false; }
  addEventListener('keydown', (e) => {
    audioOn();
    const k = KEYMAP[e.code];
    if (k) { press(k); e.preventDefault(); }
    if (!e.repeat) onKey(e.code);
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) release(k); });
  addEventListener('blur', () => { keys.left = keys.right = keys.jump = false; });

  // touch buttons
  const touchEl = document.getElementById('touch');
  if (matchMedia('(pointer: coarse)').matches) touchEl.hidden = false;
  touchEl.querySelectorAll('button').forEach((btn) => {
    const k = btn.dataset.key;
    const down = (e) => {
      e.preventDefault(); audioOn(); btn.classList.add('on');
      if (k === 'restart') onKey('KeyR');
      else { press(k); if (k === 'jump' && game.state !== 'play') onKey('Enter'); }
    };
    const up = (e) => { e.preventDefault(); btn.classList.remove('on'); if (k !== 'restart') release(k); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
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
  class Level {
    constructor(idx) {
      this.idx = idx;
      this.def = LEVELS[idx];
      this.blocks = []; this.spikes = []; this.saws = []; this.pads = []; this.flags = [];
      this.doors = []; this.texts = []; this.bubbles = [];
      this.triggers = []; this.timers = []; this.jumpQueue = [];
      this.g = 1; this.invert = false; this.jumpDelay = 0; this.t = 0;
      this.banner = null; this.won = false; this.shakeT = 0; this.shakeMag = 0;
      this.spawnPt = { x: 2, y: 15 };
      this.player = null;
      this.def.build(this);
      const s = this.spawnPt;
      this.player = {
        x: s.x, y: s.y - P.h, w: P.w, h: P.h, vx: 0, vy: 0, face: 1,
        grounded: false, ground: null, coy: 0, buf: 0, jumping: false, cut: false,
        dead: false, sx: 1, sy: 1,
      };
    }

    // ---- build API
    spawn(x, floorY) { this.spawnPt = { x, y: floorY }; }
    block(x, y, w, h, o = {}) {
      const b = { kind: 'block', x, y, w, h, vy: 0, dx: 0, dy: 0, solid: true, hidden: false, crumble: 0,
        pending: false, falling: false, shakeT: 0, land: false, gone: false, flash: 0, sparkle: Math.random() * 3, ...o };
      this.blocks.push(b); return b;
    }
    spike(x, y, w, dir = 'up', o = {}) {
      const L = this;
      const s = { kind: 'spike', x, y, w, dir, out: o.hidden ? 0 : 1, target: o.hidden ? 0 : 1,
        pop() { if (s.target !== 1) { s.target = 1; sfx.pop(); L.shake(0.08, 0.08); } } };
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
    on(cond, fn, o = {}) { this.triggers.push({ cond, fn, repeat: !!o.repeat, done: false }); }
    wait(sec, fn) { this.timers.push({ at: this.t + sec, fn }); }
    drop(b, delay = 0, o = {}) {
      if (b.pending || b.falling) return;
      b.pending = true; b.shakeT = delay; b.land = !!o.land;
    }
    moveDoor(d, x, floorY, speed = 30) { d.tween = { x, y: floorY - d.h, speed }; sfx.move(); }
    say(str) { this.bubbles.push({ str, t: 0 }); }
    shake(t = 0.2, mag = 0.25) { this.shakeT = Math.max(this.shakeT, t); this.shakeMag = Math.max(this.shakeMag, mag); }
    fakeWin() { this.banner = { text: 'LEVEL COMPLETE', sub: 'well done!', t: 0 }; sfx.win(); }
    get px() { return this.player.x + this.player.w / 2; }
    get py() { return this.player.y + this.player.h / 2; }
    near(o, d) { return Math.hypot(o.x + o.w / 2 - this.px, o.y + o.h / 2 - this.py) < d; }
    touch(o) { return overlap(this.player, o.kind === 'door' ? doorBox(o) : o); }

    // ---- simulation
    step(dt) {
      const p = this.player;
      this.t += dt;
      if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeMag = 0; }
      if (this.banner) this.banner.t += dt;
      for (const b of this.bubbles) b.t += dt;
      this.bubbles = this.bubbles.filter((b) => b.t < 1.4);

      for (let i = this.timers.length - 1; i >= 0; i--) {
        const tm = this.timers[i];
        if (this.t >= tm.at) { this.timers.splice(i, 1); tm.fn(); }
      }
      if (!p.dead && !this.won) {
        for (let i = 0; i < this.triggers.length; i++) {
          const tr = this.triggers[i];
          if (tr.done) continue;
          if (tr.cond()) { tr.fn(); if (!tr.repeat) tr.done = true; }
        }
      }

      this.stepWorld(dt);
      if (!p.dead && !this.won) this.stepPlayer(dt);
      if (!p.dead && !this.won) this.checkContacts();
    }

    stepWorld(dt) {
      const p = this.player;
      for (const b of this.blocks) {
        if (b.gone) continue;
        const ox = b.x, oy = b.y;
        if (b.flash > 0) b.flash -= dt;
        if (b.crumble && !b.pending && !b.falling && p.ground === b && !p.dead) this.drop(b, b.crumble);
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

      // carry the player horizontally with whatever they stand on
      if (!p.dead && p.ground && p.ground.dx) p.x += p.ground.dx;

      // moving solids push (and crush) the player
      if (!p.dead) {
        for (const b of this.blocks) {
          if (!solid(b) || (!b.dx && !b.dy) || !overlap(p, b)) continue;
          if (Math.abs(b.dy) >= Math.abs(b.dx)) { p.y = b.dy > 0 ? b.y + b.h : b.y - p.h; p.vy = b.vy || 0; }
          else p.x = b.dx > 0 ? b.x + b.w : b.x - p.w;
          for (const o of this.blocks) {
            if (o !== b && solid(o) && overlap(p, o)) { this.kill('crushed'); break; }
          }
          if (p.dead) break;
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

    stepPlayer(dt) {
      const p = this.player, g = this.g;
      let dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (this.invert) dir = -dir;
      let acc = p.grounded ? P.accG : P.accA;
      if (!dir && p.grounded) acc = P.fric;
      p.vx = approach(p.vx, dir * P.speed, acc * dt);
      if (dir) p.face = dir;

      // jump input (optionally lagged)
      if (pressed.has('jump')) {
        pressed.delete('jump');
        if (this.jumpDelay > 0) this.jumpQueue.push(this.t + this.jumpDelay);
        else { p.buf = P.buffer; p.lagged = false; }
      }
      while (this.jumpQueue.length && this.jumpQueue[0] <= this.t) { this.jumpQueue.shift(); p.buf = 0.04; p.lagged = true; }
      p.buf -= dt;
      p.coy = p.grounded ? P.coyote : p.coy - dt;
      if (p.buf > 0 && p.coy > 0) {
        p.vy = -P.jump * g; p.buf = 0; p.coy = 0; p.grounded = false; p.ground = null;
        p.jumping = !p.lagged; p.cut = false; p.sx = 0.7; p.sy = 1.3; sfx.jump();
      }
      if (p.jumping && !p.cut && !keys.jump && p.vy * g < 0) { p.vy *= 0.5; p.cut = true; }

      p.vy = clamp(p.vy + P.grav * g * dt, -P.maxFall, P.maxFall);

      // horizontal
      p.x += p.vx * dt;
      for (const b of this.blocks) {
        if (!solid(b) || !overlap(p, b)) continue;
        this.reveal(b);
        if (p.vx > 0) p.x = b.x - p.w; else if (p.vx < 0) p.x = b.x + b.w;
        p.vx = 0;
      }
      if (p.x < 0) { p.x = 0; p.vx = 0; }
      if (p.x > COLS - p.w) { p.x = COLS - p.w; p.vx = 0; }

      // vertical
      const was = p.grounded;
      p.grounded = false; p.ground = null;
      p.y += p.vy * dt;
      for (const b of this.blocks) {
        if (!solid(b) || !overlap(p, b)) continue;
        this.reveal(b);
        if (p.vy > 0) p.y = b.y - p.h; else if (p.vy < 0) p.y = b.y + b.h;
        if (p.vy * g > 0) { p.grounded = true; p.ground = b; }
        p.vy = 0;
      }
      if (p.grounded && !was) { p.sx = 1.25; p.sy = 0.78; p.jumping = false; }
      p.sx = approach(p.sx, 1, dt * 4); p.sy = approach(p.sy, 1, dt * 4);
    }

    reveal(b) {
      if (!b.hidden) return;
      b.hidden = false; b.flash = 0.4; sfx.reveal();
      burst(b.x + b.w / 2, b.y + b.h / 2, C.portal, 12, 5);
    }

    checkContacts() {
      const p = this.player;
      for (const s of this.spikes) if (s.out > 0.6 && overlap(p, spikeBox(s))) return this.kill('spikes');
      for (const s of this.saws) {
        const cx = clamp(s.x, p.x, p.x + p.w), cy = clamp(s.y, p.y, p.y + p.h);
        if (Math.hypot(s.x - cx, s.y - cy) < s.r * 0.82) return this.kill('saw');
      }
      if (p.y > ROWS + 1 || p.y < -3) return this.kill('fell');
      for (const pd of this.pads) {
        if (this.g !== pd.g && overlap(p, padBox(pd))) {
          this.g = pd.g; p.jumping = false; p.grounded = false; p.ground = null; sfx.flip();
          burst(p.x + p.w / 2, p.y + p.h / 2, C.pad, 14, 6);
        }
      }
      for (const d of this.doors) {
        if (!d.fake && !d.tween && overlap(p, doorBox(d))) return this.win();
      }
    }

    kill() {
      const p = this.player;
      if (p.dead) return;
      p.dead = true;
      save.deaths++;
      save.levelDeaths[this.idx] = (save.levelDeaths[this.idx] || 0) + 1;
      persist();
      burst(p.x + p.w / 2, p.y + p.h / 2, C.player, 34, 11);
      this.shake(0.3, 0.4);
      sfx.die();
      game.message = { text: pick(DEATH_LINES), t: 0 };
      this.wait(0.75, () => game.restart());
    }

    win() {
      this.won = true;
      this.banner = { text: pick(['NICE', 'OKAY FINE', 'LUCKY', 'HMPH']), sub: '', t: 0 };
      sfx.win();
      burst(this.px, this.py, C.portal, 40, 10);
      if (this.idx + 2 > save.unlocked) { save.unlocked = Math.min(LEVELS.length, this.idx + 2); persist(); }
      this.wait(1.0, () => game.next());
    }
  }

  // ---------------------------------------------------------------- game state
  const game = {
    state: 'title', // title | select | play | end
    level: null, idx: 0, sel: 0, message: null, time: 0,
    start(idx) {
      this.idx = idx; this.level = new Level(idx); this.state = 'play';
      particles = []; pressed.clear(); this.message = null;
    },
    restart() { this.level = new Level(this.idx); pressed.clear(); },
    next() { if (this.idx + 1 < LEVELS.length) this.start(this.idx + 1); else { this.state = 'end'; sfx.win(); } },
  };

  function onKey(code) {
    if (code === 'KeyM') { save.muted = !save.muted; persist(); return; }
    if (game.state === 'title') {
      if (code === 'KeyL') { game.state = 'select'; game.sel = Math.min(save.unlocked, LEVELS.length) - 1; sfx.click(); }
      else if (code === 'Enter' || code === 'Space' || code === 'KeyZ') { sfx.click(); game.start(Math.min(save.unlocked, LEVELS.length) - 1); }
    } else if (game.state === 'select') {
      const n = Math.min(save.unlocked, LEVELS.length);
      if (code === 'ArrowRight' || code === 'KeyD') game.sel = Math.min(n - 1, game.sel + 1);
      if (code === 'ArrowLeft' || code === 'KeyA') game.sel = Math.max(0, game.sel - 1);
      if (code === 'ArrowDown' || code === 'KeyS') game.sel = Math.min(n - 1, game.sel + 5);
      if (code === 'ArrowUp' || code === 'KeyW') game.sel = Math.max(0, game.sel - 5);
      if (code === 'Enter' || code === 'Space' || code === 'KeyZ') { sfx.click(); game.start(game.sel); }
      if (code === 'Escape') game.state = 'title';
    } else if (game.state === 'play') {
      if (code === 'KeyR' && !game.level.won) {
        if (!game.level.player.dead) game.level.kill();
      }
      if (code === 'Escape') { game.state = 'select'; game.sel = game.idx; }
    } else if (game.state === 'end') {
      if (code === 'Enter' || code === 'Space' || code === 'Escape') game.state = 'title';
    }
  }

  // clicks / taps on menus
  {
    const cv = document.getElementById('game');
    cv.addEventListener('pointerdown', (e) => {
      audioOn();
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * VW, y = ((e.clientY - r.top) / r.height) * VH;
      if (game.state === 'title') onKey(y > VH * 0.72 && x > VW * 0.55 ? 'KeyL' : 'Enter');
      else if (game.state === 'select') {
        const i = selectHit(x, y);
        if (i >= 0 && i < save.unlocked) { game.sel = i; onKey('Enter'); }
        else if (y < 90) onKey('Escape');
      } else if (game.state === 'end') onKey('Enter');
    });
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

  function drawBlock(b, L) {
    if (b.gone) return;
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
    if (p.dead) return;
    const cx = (p.x + p.w / 2) * TILE, base = L.g > 0 ? (p.y + p.h) * TILE : p.y * TILE;
    const w = p.w * TILE * p.sx, h = p.h * TILE * p.sy;
    ctx.save();
    ctx.translate(cx, base);
    if (L.g < 0) ctx.scale(1, -1);
    ctx.fillStyle = C.playerDark; roundRect(-w / 2, -h, w, h, 5); ctx.fill();
    ctx.fillStyle = C.player; roundRect(-w / 2 + 1.5, -h + 1.5, w - 3, h - 5, 4); ctx.fill();
    // eyes
    const look = p.face * 2.5, ey = -h * 0.62;
    for (const ex of [-5, 5]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex + look * 0.6, ey, 3.6, 4.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.eye; ctx.beginPath(); ctx.arc(ex + look, ey + (L.invert ? -1 : 0.8), 1.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBubble(b, L) {
    const p = L.player, x = (p.x + p.w / 2) * TILE, y = (L.g > 0 ? p.y - 0.9 : p.y + p.h + 0.9) * TILE - Math.min(b.t, 0.3) * 20 * L.g;
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
    drawBg();
    for (const tx of L.texts) text(tx.str, tx.x * TILE, tx.y * TILE, 18, C.dim, 'left', 'normal');
    for (const f of L.flags) drawFlag(f, t);
    for (const d of L.doors) drawDoor(d, t);
    for (const s of L.spikes) drawSpike(s);
    for (const b of L.blocks) drawBlock(b, L);
    for (const pd of L.pads) drawPad(pd, t);
    for (const s of L.saws) drawSaw(s);
    drawPlayer(L.player, L);
    for (const p of particles) {
      ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.color;
      ctx.fillRect(p.x * TILE, p.y * TILE, p.size * TILE, p.size * TILE);
    }
    ctx.globalAlpha = 1;
    for (const b of L.bubbles) drawBubble(b, L);
    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(13,12,29,0.55)'; ctx.fillRect(0, 0, VW, 34);
    text(`${String(L.idx + 1).padStart(2, '0')} / ${LEVELS.length}  ${L.def.name.toUpperCase()}`, 14, 18, 15, C.text, 'left');
    const ld = save.levelDeaths[L.idx] || 0;
    text(`deaths here ${ld}   total ${save.deaths}`, VW - 14, 18, 15, C.danger, 'right');

    if (L.banner) {
      const k = Math.min(1, L.banner.t * 6);
      ctx.fillStyle = `rgba(13,12,29,${0.6 * k})`; ctx.fillRect(0, VH / 2 - 60, VW, 120);
      text(L.banner.text, VW / 2, VH / 2 - 10, 54 * (0.6 + 0.4 * k), C.portal);
      if (L.banner.sub) text(L.banner.sub, VW / 2, VH / 2 + 34, 16, C.text, 'center', 'normal');
    }
    if (game.message) {
      const m = game.message, a = clamp((1.6 - m.t) / 0.3, 0, 1);
      ctx.globalAlpha = a; text(m.text, VW / 2, 80, 26, C.danger); ctx.globalAlpha = 1;
    }
    text('←/→ move · SPACE jump · R restart · ESC levels · M mute', VW / 2, VH - 12, 12, 'rgba(20,20,43,0.55)', 'center', 'normal');
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

    text('RAGE BAIT', VW / 2, 150, 92, C.player);
    text('a platformer that does not like you', VW / 2, 215, 18, C.text, 'center', 'normal');
    const blink = Math.sin(t * 4) > -0.3;
    if (blink) text('press SPACE / tap to play', VW / 2, VH * 0.74, 22, C.portal);
    text('[L] level select', VW * 0.78, VH * 0.82, 16, C.text);
    text(`deaths so far: ${save.deaths}`, VW * 0.22, VH * 0.82, 16, C.danger);
    text(save.muted ? 'sound off (M)' : 'sound on (M)', VW / 2, VH - 20, 12, C.dim, 'center', 'normal');
  }

  const SEL = { cols: 5, w: 120, h: 92, gap: 26, top: 170 };
  function selectRect(i) {
    const totalW = SEL.cols * SEL.w + (SEL.cols - 1) * SEL.gap, x0 = (VW - totalW) / 2;
    return { x: x0 + (i % SEL.cols) * (SEL.w + SEL.gap), y: SEL.top + Math.floor(i / SEL.cols) * (SEL.h + SEL.gap), w: SEL.w, h: SEL.h };
  }
  function selectHit(x, y) {
    for (let i = 0; i < LEVELS.length; i++) { const r = selectRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i; }
    return -1;
  }
  function drawSelect(t) {
    drawBg();
    text('PICK YOUR POISON', VW / 2, 80, 40, C.player);
    text('ESC back', VW / 2, 120, 14, C.dim, 'center', 'normal');
    for (let i = 0; i < LEVELS.length; i++) {
      const r = selectRect(i), open = i < save.unlocked, on = i === game.sel;
      ctx.fillStyle = on ? 'rgba(255,79,139,0.25)' : 'rgba(232,230,240,0.06)';
      roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
      ctx.strokeStyle = on ? C.player : open ? C.blockEdge : 'rgba(232,230,240,0.15)'; ctx.lineWidth = on ? 3 : 1.5; ctx.stroke();
      text(open ? String(i + 1) : '?', r.x + r.w / 2, r.y + 34, 32, open ? C.text : C.dim);
      const d = save.levelDeaths[i] || 0;
      text(open ? `☠ ${d}` : 'locked', r.x + r.w / 2, r.y + 70, 13, open ? C.danger : C.dim, 'center', 'normal');
    }
    const s = LEVELS[game.sel];
    if (s) text(s.name, VW / 2, VH - 70, 22, C.portal);
  }

  function drawEnd(t) {
    drawBg();
    text('YOU WIN.', VW / 2, 170, 80, C.portal);
    text('for real this time.', VW / 2, 230, 18, C.text, 'center', 'normal');
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
    else if (game.state === 'select') drawSelect(game.time);
    else if (game.state === 'play') drawLevel(game.level);
    else drawEnd(game.time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // deterministic hooks for automated tests (no effect on normal play)
  window.__ragebait = {
    game, keys, pressed,
    load(i) { game.start(i); },
    step(n = 1) { for (let i = 0; i < n; i++) game.level.step(STEP); },
    STEP,
  };
})();
