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

` (backtick) on the title or mode screen opens the **admin panel**: play any level, unlock all, god mode, slow motion (1x / 0.5x / 0.25x), and reset save data. Its settings last for the session only; levels played with unlock-all on don't save progress, and N skips the current level.
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

**Multiplayer**: co-op puzzles with stacked trolls, harder than single player. Both players must enter the portal.

| # | Name | Puzzle and trolls |
|---|------|-------------------|
| 1 | Hold The Door | hold a plate for your partner; the portal moves behind the gate, the screen mirrors, a spike pops |
| 2 | Boost | stand on your partner's head to climb; if you jump up top, the step retracts; controls swap; the portal dodges |
| 3 | Angry Plate | plates hold the crushers up, then reverse; any jump makes the crushers twitch |
| 4 | Two Keys | press two plates at once; holding one alone drops a saw on the slacker; you swap places near the portal |
| 5 | Going Up | call the lift for each other; it slips halfway, and a jump on the shelf rocks it; the screen flips |
| 6 | Two Lanes | one player per lane, holding each other's gates; hidden spikes; the screen flips upside down |
| 7 | Weight Limit | one person on the bridge at a time; the first across gets swapped back to the start, and the bridge tiles drop |
| 8 | Swap Meet | controls swap, unswap, then swap again at the spike |
| 9 | Crate Expectations | one crate is a mimic that grows spikes; the real crate breaks once one of you is inside |
| 10 | Trust Issues | the lift slips; the real portal moves down next to the fake one; mirror mode |

**Special (chained)**: built around the chain. One player reaching the portal takes both through.

| # | Name | Puzzle and trolls |
|---|------|-------------------|
| 1 | Tethered | jump the collapsing pit together; the chain shrinks; two spikes in a row |
| 2 | Haul | the climber drags the other up; jumping up top yanks your partner back down; you swap places and the chain shrinks |
| 3 | Counterweight | a mimic crate, the real crate onto the plate, then run the gate together before it slams |
| 4 | Lift Together | the lift changes its mind halfway; jumping in the lift sends it back down; the chain shrinks |
| 5 | Leash | saw chase where every jump speeds up the saw; the chain stretches, then shrinks |
| 6 | Weight Limit | the bridge holds one person; the other dangles underneath; then the screen flips |
| 7 | Up Is Down (Together) | shared gravity flips, a hole in the ceiling, a short chain, hidden ceiling spikes |
| 8 | Lift Off | the first plate press is a lie (spikes); press again; the pillar hiccups |
| 9 | Crumble Run | the floor crumbles; the chain shrinks to almost nothing; you swap places mid-run |
| 10 | The End (Together) | the portal drops onto a hidden step; the fake portal flips the world |

## Punishment (2-player modes)

- **3 strikes:** three deaths in one level send you back a level and delete that level's unlock.
- **Blame:** every death names the player who died ("BLUE is the weak link.").
- **Shame scoreboard:** a running PINK vs. BLUE death count for each mode, shown on the HUD.
- **Level-end mockery:** whoever died more in a level gets roasted on the "level complete" screen.

## Co-op mechanics

- **Plates and gates**: colored plates open blocks with matching colored dots.
- **Crates**: push them, stand on them, drop them on plates, or drop them on your partner.
- **Stacking**: players can stand on each other's heads.
- **Chain (Special)**: the chain is about 4 tiles long, but levels shrink and stretch it. A player standing on ground anchors a falling partner, a dangling player can jump off the chain, and walking away hauls your partner up a wall. If the chain touches popped spikes or a saw, it snags and yanks you both.
- **Mimic crates**: touch one and it grows spikes, then crumbles away.
- **Rule changes**: the screen can mirror or flip upside down, players can swap places, controls can swap.

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
