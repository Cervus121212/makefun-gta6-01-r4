// Police: wanted stars, cruiser + foot-cop pursuit, helicopter at 3+ stars.
// Decay counts ONLY cruiser/foot-cop distance (the heli never counts, or the
// heat would never drop while air support watches you).
import * as THREE from '../vendor/three.module.min.js';
import { CALLSIGNS } from './settings.js';

function buildCruiserMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.75, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.35, metalness: 0.5 }),
  );
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.2, metalness: 0.4 }),
  );
  cabin.position.set(0, 1.15, -0.2);
  g.add(body, cabin);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.22, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2244cc, emissive: 0x2244cc, emissiveIntensity: 1.6 }),
  );
  bar.position.set(0, 1.55, -0.2);
  g.add(bar);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 });
  [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  });
  return g;
}

function buildCopMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x1a2a4a }));
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8b090 }));
  head.position.y = 1.75;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x10203a }));
  cap.position.y = 1.95;
  g.add(body, head, cap);
  return g;
}

function buildHeliMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 5), new THREE.MeshStandardMaterial({ color: 0x2a2a32, roughness: 0.4, metalness: 0.5 }));
  body.castShadow = true;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x2a2a32 }));
  tail.position.set(0, 0.2, -4);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x111114 }));
  rotor.position.y = 0.9;
  const spot = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 5, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  spot.position.y = -11;
  spot.name = 'spotcone';
  g.add(body, tail, rotor, spot);
  g.userData.rotor = rotor;
  return g;
}

export function createCops(G) {
  const scene = G.scene;
  const group = new THREE.Group();
  group.name = 'police';
  scene.add(group);

  let stars = 0;
  let heat = 0; // decays 1 per 4 s while the nearest ground unit is > 50 m away
  let heatTimer = 0;
  const cars = [];
  const cops = [];
  let heli = null;
  let nearestDist = 1e9;
  let callsignIdx = 0;

  function spawnCruiser() {
    const mesh = buildCruiserMesh();
    group.add(mesh);
    const p = G.player;
    const ang = Math.atan2(p.x, p.z) + Math.PI + (G.rng.next() - 0.5);
    const d = 60 + G.rng.next() * 40;
    const c = {
      mesh,
      x: Math.max(-280, Math.min(280, p.x + Math.sin(ang) * d)),
      z: Math.max(-280, Math.min(280, p.z + Math.cos(ang) * d)),
      heading: 0, speed: 0, maxSpeed: 26,
      callsign: CALLSIGNS[callsignIdx++ % CALLSIGNS.length] + '-' + (10 + Math.floor(G.rng.next() * 89)),
      tag: 'EN ROUTE', ramCooldown: 0, lightT: 0,
    };
    cars.push(c);
    return c;
  }
  function spawnFootCop() {
    const mesh = buildCopMesh();
    group.add(mesh);
    const p = G.player;
    const ang = G.rng.next() * Math.PI * 2;
    const c = {
      mesh,
      x: p.x + Math.sin(ang) * 25, z: p.z + Math.cos(ang) * 25,
      heading: 0, speed: 5.5,
      callsign: CALLSIGNS[callsignIdx++ % CALLSIGNS.length] + '-' + (10 + Math.floor(G.rng.next() * 89)),
      tag: 'PURSUIT', ramCooldown: 0,
    };
    cops.push(c);
    return c;
  }
  function spawnHeli() {
    if (heli) return heli;
    const mesh = buildHeliMesh();
    group.add(mesh);
    heli = { mesh, angle: 2.2, height: 22, x: 0, z: 0, callsign: 'ALBATROS-AIR' };
    return heli;
  }
  function removeUnit(list, u) {
    group.remove(u.mesh);
    const i = list.indexOf(u);
    if (i >= 0) list.splice(i, 1);
  }

  function setStars(n) {
    stars = Math.max(0, Math.min(5, Math.round(n)));
    heat = stars;
    heatTimer = 0;
    const wantCruisers = stars === 0 ? 0 : Math.min(2 + stars, 7);
    const wantCops = stars >= 2 ? Math.min(stars, 4) : 0;
    while (cars.length < wantCruisers) spawnCruiser();
    while (cars.length > wantCruisers) removeUnit(cars, cars[cars.length - 1]);
    while (cops.length < wantCops) spawnFootCop();
    while (cops.length > wantCops) removeUnit(cops, cops[cops.length - 1]);
    if (stars >= 3) spawnHeli();
    else if (heli) { group.remove(heli.mesh); heli = null; }
  }

  const api = {
    cars, cops,
    get stars() { return stars; },
    get heli() { return heli; },
    get nearestDist() { return nearestDist; },
    setStars,
    update(dt) {
      const p = G.player;
      // --- cruisers chase ---
      nearestDist = 1e9;
      for (const c of cars) {
        const dx = p.x - c.x, dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        nearestDist = Math.min(nearestDist, d);
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
        c.speed = Math.min(c.speed + 14 * dt, c.maxSpeed);
        if (d > 4) {
          c.x += Math.sin(c.heading) * c.speed * dt;
          c.z += Math.cos(c.heading) * c.speed * dt;
        }
        // ram: contact with the player's car hurts the player
        c.ramCooldown -= dt;
        if (d < 4.5 && c.ramCooldown <= 0 && p.car) {
          c.ramCooldown = 1;
          c.tag = 'RAMMING';
          G.fight.damagePlayer(3);
          if (p.car) p.car.condition = Math.max(0, p.car.condition - 3);
        } else if (d < 12) {
          c.tag = 'CUTTING OFF';
        } else {
          c.tag = 'PURSUIT';
        }
        // light bar strobe
        c.lightT += dt * 8;
        c.mesh.children[2].material.emissive.setHex(Math.sin(c.lightT) > 0 ? 0xcc2222 : 0x2244cc);
        const fixed = G.town.collide(c.x, c.z, 1.6);
        c.x = fixed.x; c.z = fixed.z;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
      }
      // --- foot cops chase on foot ---
      for (const c of cops) {
        const dx = p.x - c.x, dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        nearestDist = Math.min(nearestDist, d);
        const wantHeading = Math.atan2(dx, dz);
        c.heading = wantHeading;
        if (d > 1.5) {
          c.x += Math.sin(c.heading) * c.speed * dt;
          c.z += Math.cos(c.heading) * c.speed * dt;
        }
        c.ramCooldown -= dt;
        if (d < 2 && c.ramCooldown <= 0 && !p.car) {
          c.ramCooldown = 1;
          G.fight.damagePlayer(4);
        }
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
      }
      // --- helicopter orbits above the player ---
      if (heli) {
        heli.angle += 0.35 * dt;
        const R = 18;
        heli.x = p.x + Math.sin(heli.angle) * R;
        heli.z = p.z + Math.cos(heli.angle) * R;
        heli.mesh.position.set(heli.x, heli.height, heli.z);
        heli.mesh.rotation.y = Math.atan2(p.x - heli.x, p.z - heli.z);
        heli.mesh.userData.rotor.rotation.y += dt * 22;
        // spotlight tag lives on the panel: heli always watches
      }
      // --- wanted decay (ground units only) ---
      if (stars > 0) {
        if (nearestDist > 50) {
          heatTimer += dt;
          if (heatTimer >= 4) {
            heatTimer = 0;
            heat -= 1;
            if (heat <= 0) setStars(0);
            else {
              stars = heat;
              const wantCruisers = Math.min(2 + stars, 7);
              const wantCops = stars >= 2 ? Math.min(stars, 4) : 0;
              while (cars.length > wantCruisers) removeUnit(cars, cars[cars.length - 1]);
              while (cops.length > wantCops) removeUnit(cops, cops[cops.length - 1]);
              if (stars < 3 && heli) { group.remove(heli.mesh); heli = null; }
            }
          }
        } else {
          heatTimer = 0;
        }
      }
    },
  };
  return api;
}
