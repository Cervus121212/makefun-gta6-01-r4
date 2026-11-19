// Selftest: in-page autopilot, 43 checks across driving, missions, combat,
// wanted, save, camera, HUD, radio and performance. Writes one PASS/FAIL line
// per check into #test-results and sets the document title AUTOPILOT-PASS/FAIL.
import { CLOCK_START_MIN, CLOCK_RATE } from './settings.js';

export function createSelftest(G) {
  const results = [];
  let done = false;

  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitGame(sec) {
    const t0 = G.time;
    const start = Date.now();
    while (G.time - t0 < sec) {
      if (Date.now() - start > 60000) throw new Error('waitGame timed out');
      await wait(100);
    }
  }
  function check(name, cond, info = '') {
    results.push({ name, pass: !!cond, info: cond ? '' : String(info) });
    trace('check:' + name);
    return !!cond;
  }
  function nearestGridLine(v) {
    const lines = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
    let best = lines[0], bd = 1e9;
    for (const ln of lines) { const d = Math.abs(v - ln); if (d < bd) { bd = d; best = ln; } }
    return best;
  }
  // compact trace for post-run diagnosis: [t, tag, mission, step, x, z, stars, nearestDist, hp, cash]
  window.__trace = [];
  function trace(tag) {
    const tr = window.__trace;
    tr.push([Math.round(G.time * 10) / 10, tag, G.quests.index, G.quests.step,
      Math.round(G.player.x), Math.round(G.player.z), G.cops.stars,
      Math.round(G.cops.nearestDist), Math.round(G.player.health), G.cash]);
    if (tr.length > 4000) tr.splice(0, 500);
  }
  // Drive the player's car toward (tx, tz); hops 20 m on stuck (recovery).
  // Sharp turns are taken at ~10 m/s (turn radius ~5 m) so U-turns and
  // corners stay on the road instead of arcing 20+ m into building blocks.
  // stopFn, when given, aborts the leg early (e.g. the mission just ended).
  async function driveLeg(tx, tz, timeoutGameSec = 40, stopFn = null) {
    const t0 = G.time;
    let lastD = 1e9, lastProgressT = G.time, iter = 0;
    while (G.time - t0 < timeoutGameSec) {
      if ((iter++ % 5) === 0) trace('leg');
      const dx = tx - G.player.x, dz = tz - G.player.z;
      const d = Math.hypot(dx, dz);
      const spd0 = Math.abs(G.player.speed || 0);
      // break when close, or close-and-slow (a 42 m/s car leaps ~21 m per
      // iteration and would otherwise jump over the 6 m break radius)
      if (d < 6 || (d < 12 && spd0 < 2)) break;
      if (stopFn && stopFn()) break;
      if (d < lastD - 1) { lastD = d; lastProgressT = G.time; }
      if (G.time - lastProgressT > 3) {
        const ux = dx / d, uz = dz / d;
        G.cars.teleportCar(G.player.x + ux * 20, G.player.z + uz * 20);
        lastProgressT = G.time;
        lastD = Math.hypot(tx - G.player.x, tz - G.player.z);
      }
      const want = Math.atan2(dx, dz);
      let dh = want - G.player.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const spd = Math.abs(G.player.speed || 0);
      if (Math.abs(dh) > 1.0) {
        // sharp turn: hold ~10 m/s for a tight radius
        G.input.setKey('KeyW', spd < 10);
        G.input.setKey('KeyS', spd > 14);
      } else {
        // brake early: stopping distance at 30 m/s^2 plus margin, so the car
        // arrives slowly enough to hit the break radius instead of leaping past
        const stopDist = (spd * spd) / 60 + 8;
        G.input.setKey('KeyW', true);
        G.input.setKey('KeyS', d < stopDist);
      }
      G.input.setKey('KeyA', dh < -0.08);
      G.input.setKey('KeyD', dh > 0.08);
      await wait(90);
    }
    G.input.setKey('KeyW', false);
    G.input.setKey('KeyA', false);
    G.input.setKey('KeyD', false);
    G.input.setKey('KeyS', false);
    // let the game loop run a few frames so mission triggers see the arrival
    await waitGame(0.5);
    return Math.hypot(tx - G.player.x, tz - G.player.z) < 9;
  }
  // Drive to (tx, tz) staying on road lines: hop onto the nearest road
  // first (the car may start mid-block, e.g. the van spawn or the marina),
  // then travel Manhattan-style along roads, then a short final approach.
  // Far more reliable than a straight line through building blocks.
  async function driveRoad(tx, tz, stopFn = null) {
    const gx = nearestGridLine(tx), gz = nearestGridLine(tz);
    const x0 = G.player.x, z0 = G.player.z;
    const nx = nearestGridLine(x0), nz = nearestGridLine(z0);
    const legs = Math.abs(nx - x0) <= Math.abs(nz - z0)
      ? [[nx, z0], [nx, gz], [gx, gz], [gx, tz], [tx, tz]]
      : [[x0, nz], [gx, nz], [gx, tz], [tx, tz]];
    for (const [lx, lz] of legs) {
      if (stopFn && stopFn()) break;
      const d = Math.hypot(lx - G.player.x, lz - G.player.z);
      if (d < 6) continue;
      await driveLeg(lx, lz, Math.max(20, d / 8 + 12), stopFn);
    }
    return Math.hypot(tx - G.player.x, tz - G.player.z) < 9;
  }
  async function ensureCar() {
    if (G.player.car) return true;
    const c = G.cars.playerCar;
    G.setPlayer(c.x - 3, c.z);
    G.tryEnterCarAt(G.player.x, G.player.z);
    return !!G.player.car;
  }
  function aimAt(x, z) {
    G.cam.yaw = Math.atan2(x - G.player.x, z - G.player.z);
  }

  async function run() {
    try {
      // clean slate: a stale save from an earlier run must not pollute cash
      localStorage.removeItem('portovela-save-v3');
      G.resetRun();
      G.timeScale = 2;
      const g = window.__game;
      // ---- boot / world ----
      check('renderer-webgl2', !!G.renderer.getContext() && G.renderer.capabilities.isWebGL2, 'no webgl2');
      check('buildings-present', G.town.buildingCount > 50, `count=${G.town.buildingCount}`);
      check('colliders-present', G.town.colliders.length > 50, `count=${G.town.colliders.length}`);
      check('spawn-point', Math.abs(G.player.x + 60) < 1 && Math.abs(G.player.z + 150) < 1, `${G.player.x},${G.player.z}`);
      check('game-contract', ['time', 'cash', 'player', 'missions', 'police', 'combat', 'cam', 'town', 'scene', 'renderer', 'sound', 'traffic', 'pedestrians', 'timeScale', 'sirenActive'].every((k) => k in g), 'missing key');
      // ---- driving ----
      await ensureCar();
      G.input.setKey('KeyW', true);
      await waitGame(2);
      check('drive-accelerates', Math.abs(G.player.speed) > 5, `speed=${G.player.speed}`);
      const h0 = G.player.heading;
      G.input.setKey('KeyD', true);
      await waitGame(1.2);
      G.input.setKey('KeyD', false);
      check('steering-turns', Math.abs(G.player.heading - h0) > 0.15, `dh=${G.player.heading - h0}`);
      G.input.setKey('KeyW', false);
      // collision: drive into a building wall and confirm no penetration
      G.cars.teleportCar(-200, -200, Math.PI / 2);
      G.input.setKey('KeyW', true);
      await waitGame(2.5);
      G.input.setKey('KeyW', false);
      const inside = G.town.colliders.some((c) => G.player.x > c.x0 + 1 && G.player.x < c.x1 - 1 && G.player.z > c.z0 + 1 && G.player.z < c.z1 - 1);
      check('collision-pushout', !inside, 'inside a building');
      // enter / exit
      G.cars.exitCar();
      check('exit-car', !G.player.car && G.player.mesh.visible, 'still in car');
      G.tryEnterCarAt(G.player.x, G.player.z);
      check('enter-car', !!G.player.car, 'could not re-enter');
      // on foot
      G.cars.exitCar();
      const fx0 = G.player.x, fz0 = G.player.z;
      G.cam.yaw = 0;
      G.input.setKey('KeyW', true);
      await waitGame(1.5);
      G.input.setKey('KeyW', false);
      check('walk-moves', Math.hypot(G.player.x - fx0, G.player.z - fz0) > 3, 'did not move');
      await ensureCar();
      // ---- M1 ----
      g.missions.start(0);
      G.setPlayer(-120, 20);
      g.missions.interact();
      check('m1-garage-step', g.missions.step === 2, `step=${g.missions.step}`);
      await ensureCar();
      await driveLeg(-60, -168, 45, () => !g.missions.active);
      check('m1-complete', g.missions.completed.has(0) && G.cash === 500, `cash=${G.cash}`);
      // ---- M2 ----
      g.missions.start(1);
      G.setPlayer(264, 56);
      g.missions.interact();
      check('m2-pickup-step', g.missions.step === 2, `step=${g.missions.step}`);
      await ensureCar();
      await driveLeg(-60, -168, 60, () => !g.missions.active);
      check('m2-complete', g.missions.completed.has(1) && G.cash === 1300, `cash=${G.cash}`);
      // ---- M3 ----
      g.missions.start(2);
      check('m3-starts-3stars', g.police.stars === 3, `stars=${g.police.stars}`);
      await ensureCar();
      G.timeScale = 3;
      // flee on a big road-line circuit: full speed (42) outruns the cruisers
      // (26), so the nearest ground unit falls past 50 m and the heat decays.
      // (Fleeing straight to the map edge pins the car against the boundary
      // and lets the cruisers catch up — that stalls the decay.)
      const circuit = [[-192, -192], [192, -192], [192, 192], [-192, 192]];
      let wp = 0;
      const fleeT0 = G.time;
      let lastD = 1e9, lastProgressT = G.time;
      while (g.police.stars > 0 && G.time - fleeT0 < 120) {
        const [tx, tz] = circuit[wp];
        const dx = tx - G.player.x, dz = tz - G.player.z;
        const d = Math.hypot(dx, dz);
        if (d < 10) { wp = (wp + 1) % circuit.length; await wait(90); continue; }
        if (d < lastD - 1) { lastD = d; lastProgressT = G.time; }
        if (G.time - lastProgressT > 3) {
          G.cars.teleportCar(G.player.x + (dx / d) * 20, G.player.z + (dz / d) * 20);
          lastProgressT = G.time;
          lastD = Math.hypot(tx - G.player.x, tz - G.player.z);
        }
        const want = Math.atan2(dx, dz);
        let dh = want - G.player.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        // tight corners at ~10 m/s so the circuit stays on the road lines
        const spd = Math.abs(G.player.speed || 0);
        if (Math.abs(dh) > 1.0) {
          G.input.setKey('KeyW', spd < 10);
          G.input.setKey('KeyS', spd > 14);
        } else {
          G.input.setKey('KeyW', true);
          G.input.setKey('KeyS', false);
        }
        G.input.setKey('KeyA', dh < -0.08);
        G.input.setKey('KeyD', dh > 0.08);
        await wait(90);
      }
      G.input.setKey('KeyW', false); G.input.setKey('KeyA', false); G.input.setKey('KeyD', false); G.input.setKey('KeyS', false);
      trace('m3-done');
      check('m3-complete', g.missions.completed.has(2) && g.police.stars === 0, `stars=${g.police.stars}`);
      G.timeScale = 2;
      // ---- M4 ----
      g.missions.start(3);
      check('m4-spawns-4', g.combat.enemies.length === 4, `enemies=${g.combat.enemies.length}`);
      G.setPlayer(250, 108);
      let guard = 0;
      while (g.combat.enemies.length > 0 && guard++ < 40) {
        const e = g.combat.enemies[0];
        aimAt(e.x, e.z);
        g.combat.shoot();
        await waitGame(0.4);
      }
      check('m4-all-killed', g.combat.enemies.length === 0, `left=${g.combat.enemies.length}`);
      check('m4-step2', g.missions.step === 2, `step=${g.missions.step}`);
      G.setPlayer(264, 118);
      g.missions.interact();
      check('m4-complete', g.missions.completed.has(3), `cash=${G.cash}`);
      // ---- M5 ----
      g.missions.start(4);
      await ensureCar();
      await driveRoad(60, 224, () => !g.missions.active);
      check('m5-pickup-auto', g.missions.step === 2, `step=${g.missions.step}`);
      await driveRoad(-150, -224, () => !g.missions.active);
      check('m5-complete', g.missions.completed.has(4), `cash=${G.cash}`);
      // ---- M6 ----
      g.missions.start(5);
      const sedan = g.missions.chaseTarget;
      check('m6-sedan-spawned', !!sedan, 'no sedan');
      await ensureCar();
      G.timeScale = 3;
      const ramT0 = G.time;
      while (sedan && sedan.hp > 0 && G.time - ramT0 < 90) {
        const dx = sedan.x - G.player.x, dz = sedan.z - G.player.z;
        const want = Math.atan2(dx, dz);
        let dh = want - G.player.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        G.input.setKey('KeyW', true);
        G.input.setKey('KeyA', dh < -0.08);
        G.input.setKey('KeyD', dh > 0.08);
        if (Math.hypot(dx, dz) > 40) {
          G.cars.teleportCar(sedan.x - Math.sin(sedan.heading) * 12, sedan.z - Math.cos(sedan.heading) * 12);
        }
        await wait(90);
      }
      G.input.setKey('KeyW', false); G.input.setKey('KeyA', false); G.input.setKey('KeyD', false);
      check('m6-complete', g.missions.completed.has(5), `hp=${sedan ? sedan.hp : 'gone'}`);
      G.timeScale = 2;
      // ---- M7 ----
      g.missions.start(6);
      G.setPlayer(-180, 229);
      G.tryEnterCarAt(G.player.x, G.player.z);
      check('m7-van-stolen', !!G.player.car && G.player.car.isVan, 'not in van');
      await waitGame(0.5);
      check('m7-three-stars', g.police.stars === 3, `stars=${g.police.stars}`);
      await driveRoad(-60, -168, () => !g.missions.active);
      check('m7-complete', g.missions.completed.has(6), `cash=${G.cash}`);
      G.police.setStars(0);
      // ---- M8 ----
      g.missions.start(7);
      check('m8-starts-4stars', g.police.stars === 4, `stars=${g.police.stars}`);
      G.player.health = 100; G.player.armour = 50;
      await ensureCar();
      G.timeScale = 4;
      // intercept: drive AT the nearest cruiser — they spawn 60-100 m away
      // and close too slowly alone (they stall on building walls), so a
      // passive wait lets the heat decay twice before the survive even
      // starts, and the survive clock needs 4 stars, so a decayed star
      // freezes it forever. Closing at 42+26 m/s puts a cruiser inside
      // 40 m in ~1 game-sec, under the 4 s decay window.
      const waitT0 = G.time;
      while (g.police.nearestDist > 40 && G.time - waitT0 < 15) {
        let nc = null, nd = 1e9;
        for (const c of g.police.cars) {
          const d = Math.hypot(c.x - G.player.x, c.z - G.player.z);
          if (d < nd) { nd = d; nc = c; }
        }
        if (!nc) break;
        const want = Math.atan2(nc.x - G.player.x, nc.z - G.player.z);
        let dh = want - G.player.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        G.input.setKey('KeyW', true);
        G.input.setKey('KeyA', dh < -0.08);
        G.input.setKey('KeyD', dh > 0.08);
        await wait(90);
      }
      G.input.setKey('KeyW', false); G.input.setKey('KeyA', false); G.input.setKey('KeyD', false);
      // survive: cruise the road rectangle, holding ~25 m from the nearest
      // cruiser — close enough that the heat never decays, far enough to
      // dodge the rams. Throttle follows nearestDist proportionally.
      // If the stars ever hit 0 (death or full decay), restart up to 3 times.
      const circuit8 = [[-192, -192], [192, -192], [192, 192], [-192, 192]];
      let wp8 = 0;
      const survT0 = G.time;
      let lastD8 = 1e9, lastProgressT8 = G.time;
      let restarts = 0;
      while (g.missions.step === 1 && G.time - survT0 < 240) {
        if (!G.player.car) await ensureCar();
        if (g.police.stars < 4 && restarts < 3) {
          restarts++;
          g.missions.start(7);
          G.player.health = 100; G.player.armour = 50;
          await ensureCar();
          wp8 = 0;
          lastD8 = 1e9; lastProgressT8 = G.time;
          continue;
        }
        const [tx8, tz8] = circuit8[wp8];
        const dx8 = tx8 - G.player.x, dz8 = tz8 - G.player.z;
        const d8 = Math.hypot(dx8, dz8);
        if (d8 < 10) { wp8 = (wp8 + 1) % circuit8.length; await wait(90); continue; }
        if (d8 < lastD8 - 1) { lastD8 = d8; lastProgressT8 = G.time; }
        if (G.time - lastProgressT8 > 3) {
          G.cars.teleportCar(G.player.x + (dx8 / d8) * 20, G.player.z + (dz8 / d8) * 20);
          lastProgressT8 = G.time;
          lastD8 = Math.hypot(tx8 - G.player.x, tz8 - G.player.z);
        }
        const want8 = Math.atan2(dx8, dz8);
        let dh8 = want8 - G.player.heading;
        while (dh8 > Math.PI) dh8 -= Math.PI * 2;
        while (dh8 < -Math.PI) dh8 += Math.PI * 2;
        const nd = g.police.nearestDist;
        const spd8 = Math.abs(G.player.speed || 0);
        if (Math.abs(dh8) > 1.0) {
          // tight corner at ~10 m/s
          G.input.setKey('KeyW', spd8 < 10);
          G.input.setKey('KeyS', spd8 > 14);
        } else {
          // hold ~25 m from the nearest cruiser (26 = cruiser top speed)
          const wantSpd = Math.max(8, Math.min(42, 26 + (25 - nd)));
          G.input.setKey('KeyW', spd8 < wantSpd);
          G.input.setKey('KeyS', spd8 > wantSpd + 4);
        }
        G.input.setKey('KeyA', dh8 < -0.08);
        G.input.setKey('KeyD', dh8 > 0.08);
        trace('m8');
        await wait(90);
      }
      G.input.setKey('KeyW', false); G.input.setKey('KeyA', false); G.input.setKey('KeyD', false); G.input.setKey('KeyS', false);
      check('m8-survived', g.missions.step === 2, `step=${g.missions.step}`);
      G.timeScale = 2;
      await driveRoad(60, 224, () => !g.missions.active);
      check('m8-complete', g.missions.completed.has(7), `cash=${G.cash}`);
      check('cash-total-19000', G.cash === 19000, `cash=${G.cash}`);
      // ---- save / load ----
      g.saveGame();
      const saved = JSON.parse(localStorage.getItem('portovela-save-v3') || '{}');
      check('save-roundtrip', saved.cash === 19000, `saved=${saved.cash}`);
      const before = G.cash;
      G.cash = 0;
      g.loadSave();
      check('load-restores', G.cash === before, `cash=${G.cash}`);
      // ---- wanted system ----
      g.police.setStars(3);
      check('heli-at-3stars', !!g.police.heli, 'no heli');
      check('cruiser-count', g.police.cars.length === 5, `cars=${g.police.cars.length}`);
      g.police.setStars(2);
      check('foot-cops-at-2stars', g.police.cops.length === 2, `cops=${g.police.cops.length}`);
      const ha0 = g.police.heli ? g.police.heli.angle : 0;
      g.police.setStars(3);
      await waitGame(2);
      check('heli-orbits', g.police.heli && Math.abs(g.police.heli.angle - ha0) > 0.1, 'heli static');
      g.police.setStars(0);
      check('stars-clear', g.police.stars === 0 && !g.police.heli, 'stars stuck');
      // ---- traffic + pedestrians ----
      check('traffic-14', g.traffic.length === 14, `n=${g.traffic.length}`);
      const t0 = { x: g.traffic[0].x, z: g.traffic[0].z };
      await waitGame(2);
      check('traffic-moves', Math.hypot(g.traffic[0].x - t0.x, g.traffic[0].z - t0.z) > 2, 'static');
      check('pedestrians-12', g.pedestrians.length === 12, `n=${g.pedestrians.length}`);
      // ---- combat ----
      g.combat.spawnEnemies(G.player.x + 10, G.player.z, 1);
      const e0 = g.combat.enemies[0];
      const hp0 = e0.hp;
      aimAt(e0.x, e0.z);
      g.combat.shoot();
      // game-time wait (not real-time): the SMG shot below must land >0.11
      // game-sec after this pistol shot or the fire-rate cooldown swallows
      // it and the ammo never drops — wait(150) was a flake at ~5 fps.
      await waitGame(0.5);
      check('pistol-hits', e0.hp < hp0, `hp=${e0.hp}`);
      g.combat.clearEnemies();
      G.fight.setWeapon(1);
      check('smg-switch', g.combat.weaponIndex === 1 && g.combat.ammo.smg === 120, `ammo=${g.combat.ammo.smg}`);
      g.combat.spawnEnemies(G.player.x + 10, G.player.z, 1);
      aimAt(g.combat.enemies[0].x, g.combat.enemies[0].z);
      g.combat.shoot();
      await wait(150);
      check('smg-ammo-drops', g.combat.ammo.smg === 119, `ammo=${g.combat.ammo.smg}`);
      g.combat.clearEnemies();
      G.fight.setWeapon(0);
      // reset vitals first: earlier missions may have drained the armour
      G.player.armour = 50; G.player.health = 100;
      const arm0 = G.player.armour, hpBefore = G.player.health;
      G.fight.damagePlayer(10);
      check('armour-first', G.player.armour === arm0 - 10 && G.player.health === hpBefore, `arm=${G.player.armour} hp=${G.player.health}`);
      G.player.armour = 50; G.player.health = 100;
      // ---- camera ----
      await ensureCar();
      G.input.setKey('KeyW', true);
      await waitGame(2);
      G.input.setKey('KeyW', false);
      await waitGame(2.5);
      check('camera-settles', G.cam.yawError < 0.055, `err=${G.cam.yawError}`);
      const fovFast = G.cam.fov;
      G.input.setKey('KeyW', true);
      await waitGame(1.5);
      check('fov-kick', G.cam.fov > 62.5, `fov=${G.cam.fov}`);
      G.input.setKey('KeyW', false);
      // on foot: yaw must not auto-ease
      G.cars.exitCar();
      G.cam.yaw = 1.0;
      G.input.setKey('KeyW', true);
      await waitGame(2);
      G.input.setKey('KeyW', false);
      check('camera-no-ease-on-foot', Math.abs(G.cam.yaw - 1.0) < 0.05, `yaw=${G.cam.yaw}`);
      // ---- HUD / radio / siren ----
      G.display.showMsg('AUTOPILOT HUD TEST', 3000);
      check('msg-pill-shows', document.getElementById('msg').classList.contains('show'), 'pill hidden');
      G.display.dialogue('Mara Voss', 'FIXER', 'Test line.', 4000);
      check('dialogue-shows', document.getElementById('dialogue').classList.contains('show'), 'dialogue hidden');
      const mmCtx = document.getElementById('minimap').getContext('2d');
      const px = mmCtx.getImageData(0, 0, 190, 190).data;
      let colored = 0;
      for (let i = 0; i < px.length; i += 400) if (px[i] + px[i + 1] + px[i + 2] > 30) colored++;
      check('minimap-drawn', colored > 50, `colored=${colored}`);
      G.sound.setStation(1);
      await waitGame(0.5);
      check('radio-switches', document.getElementById('radio-line').textContent.includes('LA VOZ'), 'wrong station');
      g.police.setStars(2);
      await waitGame(0.5);
      check('siren-active', g.sirenActive === true, 'siren off');
      g.police.setStars(0);
      const cashTxt = document.getElementById('cash').textContent;
      check('hud-cash', cashTxt === G.cash.toLocaleString('en-US'), `txt=${cashTxt}`);
      const clockA = document.getElementById('clock-line').textContent;
      await waitGame(30);
      const clockB = document.getElementById('clock-line').textContent;
      check('clock-advances', clockA !== clockB, `${clockA} vs ${clockB}`);
      check('rep-king', G.rep >= 1280, `rep=${G.rep}`);
      check('draw-calls', G.renderer.info.render.calls < 900, `calls=${G.renderer.info.render.calls}`);
    } catch (err) {
      results.push({ name: 'autopilot-exception', pass: false, info: String(err && err.message ? err.message : err) });
    } finally {
      G.timeScale = 1;
      ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((k) => G.input.setKey(k, false));
      const passed = results.filter((r) => r.pass).length;
      const el = $('test-results');
      el.innerHTML = results.map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? '' : ' — ' + r.info}`).join('\n');
      window.__autopilotDone = true;
      window.__autopilotResults = results;
      document.title = passed === results.length ? 'AUTOPILOT-PASS' : 'AUTOPILOT-FAIL';
    }
  }

  return { run };
}
