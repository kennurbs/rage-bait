# MASTER BAITER

A minimalist troll platformer for the browser, in the spirit of the "rage game" genre.
The goal is always the same: reach the glowing portal. The level does not want you to.

## Play

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

then visit http://localhost:8000.

## Modes

| Mode | Players | What happens |
|------|---------|--------------|
| Single player | 1 | You vs. the level. |
| Multiplayer | 2, one keyboard | Both players have to reach the portal. If either dies, both restart. |
| Special | 2, one keyboard | Shown as a mystery on the menu. When it starts, the players find out they're chained together: the chain is about 4 tiles long, a player standing on ground anchors a falling partner, and a dangling player can jump off the chain to climb back up. One player reaching the portal takes both through. |

Each mode keeps its own level progress.

## Controls

| Action  | Single player | Player 1 (2-player modes) | Player 2 (2-player modes) |
|---------|---------------|---------------------------|---------------------------|
| Move    | ← → or A D    | A D                       | ← →                       |
| Jump    | Space, ↑, W, Z (hold to jump higher) | W, Space | ↑ |

R restarts, Esc opens level select, M mutes. On the mode screen, L picks a level.
On touch devices, on-screen buttons appear for single player. Progress and death counts are saved in `localStorage`.

## Courses

Each mode has its own 10-level course and keeps its own progress.

**Single player**: classic trolls.

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

**Multiplayer**: co-op puzzles, harder than single player. Both players must enter the portal.

| # | Name | Puzzle |
|---|------|--------|
| 1 | Hold The Door | one holds a plate while the other passes the gate; then the portal moves behind it |
| 2 | Boost | stand on your partner's head to climb a wall, then extend a step for them |
| 3 | Angry Plate | plates hold crushers up, but the far plate spikes you if you stay too long |
| 4 | Two Keys | press two plates at the same moment, then escape before they turn into spikes |
| 5 | Going Up | call the lift for each other; the portal moves once you reach it |
| 6 | Two Lanes | one player per lane, each holding the other's gate open |
| 7 | Weight Limit | the bridge collapses if you're both on it, and a saw follows the second player |
| 8 | Swap Meet | halfway through, each player's keys control the other player |
| 9 | Crate Expectations | boost up a ledge and push a crate onto a plate to open the cage |
| 10 | Trust Issues | lift teamwork, and a fake portal that drops the floor |

**Special (chained)**: built around the chain, also harder than single player. One player reaching the portal takes both through.

| # | Name | Puzzle |
|---|------|--------|
| 1 | Tethered | jump the collapsing pit together, side by side |
| 2 | Haul | boost one player up a cliff, then they drag the other up |
| 3 | Counterweight | the chain is too short to hold the plate, so use the crate, then run the gate together |
| 4 | Lift Together | ride the lift side by side; stacked players hit the ceiling spikes |
| 5 | Leash | saw chase over wide pits while chained |
| 6 | Weight Limit | the bridge holds one person, so the other dangles underneath and gets hauled up |
| 7 | Up Is Down (Together) | when one flips gravity, both flip; watch for the hole in the ceiling |
| 8 | Lift Off | press the plate and both hop on the rising pillar before it leaves |
| 9 | Crumble Run | the floor crumbles under the leader, so run side by side |
| 10 | The End (Together) | fake portal, invisible steps, a shared fall |

## Co-op mechanics

- **Plates and gates**: colored plates open blocks with matching colored dots.
- **Crates**: push them, stand on them, drop them on plates, or drop them on your partner.
- **Stacking**: players can stand on each other's heads.
- **Chain (Special)**: the chain is about 4 tiles long. A player standing on ground anchors a falling partner, a dangling player can jump off the chain, and walking away hauls your partner up a wall.

## Project layout

- `index.html`, `style.css`: page shell and touch controls
- `js/game.js`: engine (physics, collision, traps, rendering, audio, menus)
- `js/levels.js`: level scripts; the header comment documents the level API
- `tests/solve.js`: Playwright bot that proves all 30 levels are beatable (`node tests/solve.js multi 3` runs one level)

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

Levels live in `js/levels.js` as three arrays (`SINGLE`, `MULTI`, `SPECIAL`). After editing a level, update its bot policy in `tests/solve.js` and run `node tests/solve.js`.
