// Cars: the player's car (drive physics, enter/exit) and 14 traffic cars that
// follow the road grid, turn at intersections and respawn on a new road.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, DRIVE, CAR_NAMES, PLAYER_CAR_NAME, PLAYER } from './settings.js';

function buildCarMesh(color, isPlayer) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.15, metalness: 0.6 }),
  );
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  g.add(body, cabin);
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 });
  [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  });
  // headlights + taillights
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.1), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.4 }));
  hl.position.set(0, 0.6, 2.22);
  g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.1), new THREE.MeshStandardMaterial({ color: 0xd81a1a, emissive: 0xaa1010, emissiveIntensity: 1.2 }));
  tl.position.set(0, 0.6, -2.22);
  g.add(tl);
  if (isPlayer) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 4.42), new THREE.MeshStandardMaterial({ color: 0xffd24a, roughness: 0.4 }));
    stripe.position.y = 0.92;
    g.add(stripe);
  }
  return g;
}

export function createCars(G) {
  const rng = G.rng;
  const scene = G.scene;
  const group = new THREE.Group();
  group.name = 'cars';
  scene.add(group);

  const trafficColors = [0xd8d8d8, 0x3a5a8a, 0x8a3a3a, 0xd8c84a, 0x4a8a5a, 0x8a6a3a, 0x5a5a6a];

  function makeTrafficCar(i) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = WORLD.gridLines[rng.int(0, 8)];
    const along = rng.range(-250, 250);
    const mesh = buildCarMesh(trafficColors[i % trafficColors.length], false);
    group.add(mesh);
    return {
      mesh,
      axis, line,
      x: axis === 'x' ? along : line,
      z: axis === 'x' ? line : along,
      heading: axis === 'x' ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      speed: rng.range(8, 14),
      dir: rng.chance(0.5) ? 1 : -1,
      name: CAR_NAMES[i % CAR_NAMES.length],
      condition: rng.int(55, 100),
    };
  }

  const traffic = [];
  for (let i = 0; i < 14; i++) traffic.push(makeTrafficCar(i));

  // The player's car starts parked by the garage.
  const playerCar = {
    mesh: buildCarMesh(0xc22a4a, true),
    x: -120, z: 30, heading: Math.PI / 2, speed: 0,
    name: PLAYER_CAR_NAME, condition: 90, isPlayerCar: true,
  };
  group.add(playerCar.mesh);

  function placeMesh(c) {
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
  }
  traffic.forEach(placeMesh);
  placeMesh(playerCar);

  function nearestCar(x, z, maxD) {
    let best = null, bd = maxD;
    const cands = [playerCar, ...traffic];
    for (const c of cands) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  const api = {
    traffic, playerCar,
    nearestCar,
    tryEnterCarAt(x, z) {
      const c = nearestCar(x, z, 6);
      if (!c) return null;
      G.player.car = c;
      G.player.x = c.x; G.player.z = c.z; G.player.heading = c.heading;
      G.player.mesh.visible = false;
      return c;
    },
    exitCar() {
      if (!G.player.car) return;
      const c = G.player.car;
      G.player.car = null;
      // step out to the left of the car
      G.player.x = c.x - Math.cos(c.heading) * 2.5;
      G.player.z = c.z + Math.sin(c.heading) * 2.5;
      G.player.mesh.visible = true;
      G.player.mesh.position.set(G.player.x, 0, G.player.z);
    },
    teleportCar(x, z, heading) {
      playerCar.x = x; playerCar.z = z;
      if (heading !== undefined) playerCar.heading = heading;
      playerCar.speed = 0;
      if (G.player.car === playerCar) {
        G.player.x = x; G.player.z = z; G.player.heading = playerCar.heading;
      }
      placeMesh(playerCar);
    },
    update(dt) {
      // --- traffic: follow road lines, turn at intersections, respawn fresh ---
      for (const c of traffic) {
        const step = c.speed * c.dir * dt;
        if (c.axis === 'x') c.x += step; else c.z += step;
        // at an intersection, sometimes turn onto the crossing road
        const onLine = WORLD.gridLines.some((ln) => Math.abs((c.axis === 'x' ? c.z : c.x) - ln) < 0.5);
        const atCross = WORLD.gridLines.some((ln) => Math.abs((c.axis === 'x' ? c.x : c.z) - ln) < 2.5);
        if (onLine && atCross && rng.chance(dt * 0.25)) {
          const crossLine = c.axis === 'x' ? c.z : c.x;
          if (c.axis === 'x') {
            c.axis = 'z'; c.line = c.x; c.z = crossLine;
            c.heading = c.dir > 0 ? 0 : Math.PI;
          } else {
            c.axis = 'x'; c.line = c.z; c.x = crossLine;
            c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
        // respawn on a brand-new road when leaving the city (never a mirror)
        if (c.x > 285 || c.x < -285 || c.z > 285 || c.z < -285) {
          const fresh = makeTrafficCar(traffic.indexOf(c));
          c.axis = fresh.axis; c.line = fresh.line;
          c.x = fresh.x; c.z = fresh.z; c.heading = fresh.heading; c.dir = fresh.dir;
          c.speed = fresh.speed;
          group.remove(fresh.mesh);
        }
        placeMesh(c);
      }

      // --- player driving / walking ---
      const p = G.player;
      const input = G.input.axis();
      if (p.car) {
        const c = p.car;
        const fwd = input.f;
        if (fwd > 0) c.speed = Math.min(c.speed + DRIVE.accel * dt, DRIVE.maxSpeed);
        else if (fwd < 0) {
          if (c.speed > 0.5) c.speed = Math.max(c.speed - DRIVE.brake * dt, 0);
          else c.speed = Math.max(c.speed - DRIVE.reverse * dt, -DRIVE.maxReverse);
        } else {
          // drag
          c.speed -= c.speed * DRIVE.drag * dt;
          if (Math.abs(c.speed) < 0.05) c.speed = 0;
        }
        if (Math.abs(c.speed) > 0.1) {
          const turn = input.s * DRIVE.steer * dt * Math.min(1, Math.abs(c.speed) / 10);
          c.heading += c.speed >= 0 ? turn : -turn;
        }
        const nx = c.x + Math.sin(c.heading) * c.speed * dt;
        const nz = c.z + Math.cos(c.heading) * c.speed * dt;
        const fixed = G.town.collide(nx, nz, 1.6);
        // soft push against traffic
        let bx = fixed.x, bz = fixed.z;
        for (const t of traffic) {
          const d = Math.hypot(bx - t.x, bz - t.z);
          if (d < 4 && d > 0.01) {
            const push = (4 - d) * 0.5;
            bx += ((bx - t.x) / d) * push;
            bz += ((bz - t.z) / d) * push;
            c.speed *= 0.6;
          }
        }
        c.x = Math.max(-300, Math.min(300, bx));
        c.z = Math.max(-300, Math.min(300, bz));
        p.x = c.x; p.z = c.z; p.heading = c.heading; p.speed = c.speed;
        placeMesh(c);
        // player mesh rides hidden; keep its position in sync for tracers
        p.mesh.position.set(c.x, 0, c.z);
        p.mesh.rotation.y = c.heading;
      } else {
        // on foot: camera-relative movement, heading = movement direction
        const run = G.input.isDown('ShiftLeft') || G.input.isDown('ShiftRight');
        const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
        const yaw = G.cam.yaw;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const rx = Math.cos(yaw), rz = -Math.sin(yaw);
        let mx = fx * input.f + rx * input.s;
        let mz = fz * input.f + rz * input.s;
        const ml = Math.hypot(mx, mz);
        if (ml > 0.01) {
          mx /= ml; mz /= ml;
          const nx = p.x + mx * speed * dt;
          const nz = p.z + mz * speed * dt;
          const fixed = G.town.collide(nx, nz, 0.6);
          p.x = Math.max(-300, Math.min(300, fixed.x));
          p.z = Math.max(-300, Math.min(300, fixed.z));
          p.heading = Math.atan2(mx, mz);
          p.speed = speed;
        } else {
          p.speed = 0;
        }
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
      }
    },
  };
  return api;
}
