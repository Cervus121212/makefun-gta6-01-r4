# Porto Vela r4 — BUILD LOG

Full rebuild from the design spec, written fresh in one recorded session.
Nothing was copied from any earlier repo: every game file was authored
here, via write/edit, from the design document. The only files not written
here are the two vendored libraries (three.js 0.160.0 from unpkg, and the
kit's own vendor/makefun-game.ts).

## Architecture (14 modules, ~2,600 lines)

- `settings` — all numbers, names, mission defs, radio, callsigns
- `rng` — seeded mulberry32 (deterministic per ?seed=)
- `keys` — keyboard + mouse state, synthetic input path for the autopilot
- `town` — city, beach, docks, sea, sun, billboards, signs, pedestrians, colliders
- `cars` — player car physics + 14 traffic cars on the road grid
- `cops` — wanted stars, cruisers, foot cops, heli, ground-only decay
- `fight` — weapons, enemies, tracers, armour-first damage
- `display` — HUD, mission/police panels, minimap, pill, dialogue
- `quests` — 8-mission state machine, 1-based steps, $19,000 total
- `camera` — chase cam; yaw is the view/aim direction; F1 follow rules
- `poses` — staged framings for the 4 dossier screenshots
- `sound` — WebAudio synth radio (3 stations), siren, shots (guarded)
- `boot` — wiring, loop, daylight slide, save/load, window.__game contract
- `selftest` — in-page autopilot, 43 checks

## Fixes carried from the design (F1–F9)

- F1 camera follows heading only while driving & idle > 1.5 s, ease 2.2/s
  (1.4 close), lastDragT starts at 10, yaw error target ≤ 3°
- F2 #msg is a small pill (14px, top 12%, gold border), short durations
- F3 chase pose: camera ~20 m, cruisers + low heli staged, shot freezes
- F4 big orange sun disc (r36) + halo, golden hour sliding to dusk
- F5 beach props: umbrellas, towels, lifeguard tower, bright walkers
- F6 six facade textures, seven roof colours, two beach-facing billboards
- F7 bright 190px minimap, S/G/Y/! markers, arrow rotated -heading
- F8 docks apron + floodlights, rival red jacket + yellow cap, mission cam ~28 m
- F9 road dashes removed; draw calls measured in the autopilot (< 600)

## Harness

Verified before writing any code: the proven r2 game loads cleanly via the
local CDP driver (window.__game present, 0 console errors, 0 failed
requests). The earlier session's module-script aborts do not reproduce.

## Tests

(Autopilot + probe results appended after the first run.)

- **Run 1 (58 checks): 53/58, 0 console errors, 0 failed requests.**
  Failed: m8-survived (step stuck at 1), m8-complete, cash-total-18000,
  save-roundtrip (all knock-ons of the M8 freeze), smg-ammo-drops
  (ammo 120 — the SMG shot landed inside the pistol's fire-rate
  cooldown). M5-complete PASSED — the driveLeg break-radius fix works.
  Trace diagnosis for M8: stars decayed 4→2 during the passive
  "wait for cruisers" phase (they spawn 60–100 m away and stall on
  building walls, so the heat dropped twice in ~13 game-sec) and the
  survive clock only advances at 4★, so it froze forever.
- **Fixes (surgical, selftest.js only):** M8 wait replaced by an active
  intercept (drive at the nearest cruiser — closes at 42+26 m/s, under
  the 4 s decay window); M8 restarts when stars drop below 4 (was: only
  at 0); pistol→SMG gap changed to a game-time wait of 0.5 s so the
  cooldown always clears. No game-balance file touched.
- **Run 2: 56/58, 0 errors, 0 failed requests.** M8 survived + completed,
  smg-ammo-drops passed. Only failures: cash-total-18000 and
  save-roundtrip — both expected $18,000, but the rewards in settings.js
  sum to $19,000 (500+800+1200+2000+2500+3000+4000+5000). The design
  doc's "$18,000 total" was an arithmetic error, not a game bug.
- **Fixes (5 one-line changes):** the two checks now expect 19000
  (cash-total-19000); the wrong "$18,000" corrected in the settings.js /
  quests.js header comments and here.
- **Run 3: 58/58 AUTOPILOT-PASS, 0 console errors, 0 failed requests,
  fps 7, cash $19,000.** All missions M1–M8 complete (probes M2–M8 ✓).
- **Screenshots (1280×608, 53–94 KiB each, under the 256 KiB cap):**
  1-cover beach sunset (car + sun glow over the sea), 2-chase (car +
  named PD panel + Mara dialogue), 3-mission (car + 4 guards + mission
  panel), 4-title (PORTO VELA title + city). Cover + mission poses were
  re-staged after the first visual check (old cover hid the car and sun
  behind buildings; old mission looked away from the car entirely).
