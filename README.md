# Porto Vela

A 3D open-world crime game in the spirit of GTA 6, built with three.js
(WebGL2) and plain ES modules — no build step, no network at runtime.

You are Dante Reyes, a wheelman back in Porto Vela, a bay city of eight
districts, a beach, a marina and docks that never sleep. Mara Voss, the
fixer, has eight jobs for you. Det. Rook and the Porto Vela PD have other
plans. Finish all eight missions, lose the heat, and become King of Vela.

## Play

```
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080, press Enter, and drive.

| Key | Action |
| --- | ------ |
| W A S D / arrows | Drive / walk |
| Shift | Run (on foot) |
| E | Interact (mission first, then enter car) |
| Mouse click | Shoot (aims along the camera) |
| Mouse drag | Look around |
| R | Next radio station |
| 1 / 2 | Pistol / SMG |

## Missions

1. **First Wheels** ($500) — steal the coupe, bring it home
2. **The Pickup** ($800) — collect the package at the docks
3. **Hot Pursuit** ($1,200) — lose three stars of heat
4. **Dockside Deal** ($2,000) — drop four guards, grab the cash
5. **Getaway Driver** ($2,500) — marina to the north gate in 90 seconds
6. **The Informant** ($3,000) — ram the green sedan until it talks
7. **Beachfront Heist** ($4,000) — steal the van, get home with heat on
8. **King of Vela** ($5,000) — survive 60 seconds at four stars, reach the yacht

## Systems

- Wanted 0–5 stars: cruisers, foot cops and a helicopter at 3+ stars.
  Heat only decays when the nearest ground unit is far away — the heli
  never counts, or you would never lose it.
- Combat: pistol and SMG, tracers, armour that absorbs damage first.
- Three synth radio stations, distance-driven sirens, save to localStorage.
- Rep ranks: ROOKIE → DRIVER → KING OF VELA.
- Day slides from golden hour to dusk over eight minutes.

## Test

`?autopilot=1` runs a 43-check in-page self-test (title becomes
AUTOPILOT-PASS/FAIL, details in `#test-results`). `?shot=cover|chase|
mission|title` stages a dossier screenshot and sets the title SHOT-READY.
`?seed=` fixes the RNG; `?lowfx=1` disables shadows and antialiasing.
