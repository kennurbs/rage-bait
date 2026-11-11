# MASTER BAITER

A minimalist troll platformer for the browser, in the spirit of the "rage game" genre.
The goal is always the same: reach the glowing portal. The level does not want you to.

## Play

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

then visit http://localhost:8000.

| Action  | Keys                 |
|---------|----------------------|
| Move    | ← → or A D           |
| Jump    | Space, ↑, W, Z (hold to jump higher) |
| Restart | R                    |
| Levels  | Esc (or L on title)  |
| Mute    | M                    |

On touch devices, on-screen buttons appear automatically. Progress and death counts are saved in `localStorage`.

## Levels and traps

| # | Name | Trap |
|---|------|------|
| 1 | Just Walk Right | floor collapses under you |
| 2 | Mind Your Step | spikes pop up, the portal runs back to the start |
| 3 | Low Ceiling | ceiling crusher (bait it, then climb over) |
| 4 | Up Is Down | gravity pads and ceiling spikes |
| 5 | Commitment Issues | the portal keeps fleeing |
| 6 | Wrong Way | controls invert, then un-invert at the worst moment |
| 7 | Safe Spot | crumbling floor and a fake checkpoint |
| 8 | Behind You | saw blade chase and a last-second pit |
| 9 | Input Lag | jumps are delayed... until they aren't |
| 10 | The End | fake portal, fake "level complete", invisible blocks |

## Project layout

- `index.html`, `style.css`: page shell and touch controls
- `js/game.js`: engine (physics, collision, traps, rendering, audio, menus)
- `js/levels.js`: level scripts; the header comment documents the level API
- `tests/solve.js`: Playwright bot that proves every level is beatable

## Making levels

Levels are small scripts on a 32 x 18 tile grid. Traps are just triggers:

```js
{
  name: 'Example',
  build(L) {
    L.spawn(2, 15);
    L.block(0, 15, 32, 3);                           // floor
    const s = L.spike(14, 15, 2, 'up', { hidden: true });
    L.on(() => L.px > 12, () => s.pop());            // spikes pop when you get close
    const d = L.door(28, 15);
    L.on(() => L.near(d, 3), () => L.moveDoor(d, 3, 15, 40)); // portal flees
  },
}
```

After editing levels, update the matching bot policy in `tests/solve.js` and run `node tests/solve.js`.
