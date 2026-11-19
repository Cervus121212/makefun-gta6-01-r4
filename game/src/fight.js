// Combat: weapons, enemies, tracers, player damage (armour absorbs first).
// Shooting fires straight along cam.yaw — the probe sets cam.yaw then clicks.
import * as THREE from '../vendor/three.module.min.js';
import { WEAPONS, ENEMY_SHOT_DMG } from './settings.js';

export function createFight(G) {
  const scene = G.scene;
  const group = new THREE.Group();
  group.name = 'combat';
  scene.add(group);

  const enemies = [];
  const tracers = [];
  let weaponIndex = 0;
  let lastShotT = -99;
  const ammo = { pistol: Infinity, smg: 120 };

  function buildEnemyMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.15, 8), new THREE.MeshStandardMaterial({ color: 0xc22a2a, roughness: 0.8 }));
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8b090 }));
    head.position.y = 1.78;
    // yellow cap (the rival's mark)
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8c84a, emissive: 0xa88400, emissiveIntensity: 0.7 }),
    );
    cap.position.y = 1.98;
    g.add(body, head, cap);
    return g;
  }

  function spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line, ttl: 0.12 });
  }

  const api = {
    enemies, tracers,
    get ammo() { return ammo; },
    get weaponIndex() { return weaponIndex; },
    weapons: WEAPONS,
    setWeapon(i) {
      weaponIndex = i === 1 ? 1 : 0;
      G.display.showMsg(WEAPONS[weaponIndex].name + (weaponIndex === 1 ? ` — ${ammo.smg} rounds` : ' — unlimited'), 1500);
    },
    spawnEnemies(x, z, n) {
      for (let i = 0; i < n; i++) {
        const mesh = buildEnemyMesh();
        group.add(mesh);
        const ex = x + (G.rng.next() - 0.5) * 14;
        const ez = z + (G.rng.next() - 0.5) * 14;
        enemies.push({
          mesh, x: ex, z: ez, hp: 100,
          shootTimer: 0.8 + G.rng.next() * 0.8, heading: 0,
        });
        mesh.position.set(ex, 0, ez);
      }
      return enemies;
    },
    clearEnemies() {
      for (const e of enemies) group.remove(e.mesh);
      enemies.length = 0;
    },
    shoot() {
      const now = G.time;
      const w = WEAPONS[weaponIndex];
      if (now - lastShotT < w.rate) return false;
      if (w.ammo !== Infinity && ammo[weaponIndex === 0 ? 'pistol' : 'smg'] <= 0) {
        G.display.showMsg('OUT OF AMMO — switch weapon (1/2)', 2000);
        return false;
      }
      lastShotT = now;
      if (weaponIndex === 1) ammo.smg -= 1;
      const p = G.player;
      const yaw = G.cam.yaw;
      const ox = p.x, oz = p.z;
      const oy = p.car ? 1.2 : 1.5;
      // nearest enemy inside a narrow cone around cam.yaw (aim assist ~7 deg)
      let best = null, bestD = w.range, bestAng = 0.13;
      for (const e of enemies) {
        const dx = e.x - ox, dz = e.z - oz;
        const d = Math.hypot(dx, dz);
        if (d > w.range) continue;
        let ang = Math.atan2(dx, dz) - yaw;
        while (ang > Math.PI) ang -= Math.PI * 2;
        while (ang < -Math.PI) ang += Math.PI * 2;
        if (Math.abs(ang) < bestAng && d < bestD) { best = e; bestD = d; bestAng = Math.abs(ang); }
      }
      const tx = ox + Math.sin(yaw) * (best ? bestD : w.range);
      const tz = oz + Math.cos(yaw) * (best ? bestD : w.range);
      spawnTracer({ x: ox, y: oy, z: oz }, { x: tx, y: 1.2, z: tz });
      G.sound.shot();
      if (best) {
        best.hp -= w.dmg;
        // hit flash: enemy briefly brightens
        best.mesh.children[0].material.emissive = new THREE.Color(0x881111);
        best.mesh.children[0].material.emissiveIntensity = 0.9;
        setTimeout(() => {
          best.mesh.children[0].material.emissive = new THREE.Color(0x000000);
          best.mesh.children[0].material.emissiveIntensity = 0;
        }, 90);
        if (best.hp <= 0) {
          group.remove(best.mesh);
          enemies.splice(enemies.indexOf(best), 1);
        }
        return true;
      }
      return false;
    },
    damagePlayer(dmg) {
      const p = G.player;
      let rest = dmg;
      if (p.armour > 0) {
        const absorbed = Math.min(p.armour, rest);
        p.armour -= absorbed;
        rest -= absorbed;
      }
      p.health -= rest;
      if (p.health <= 0) {
        p.health = 0;
        G.display.showMsg('WASTED — you wake up at the safehouse', 4000);
        // respawn at the safehouse, car still enterable where it was
        if (p.car) G.cars.exitCar();
        p.x = -60; p.z = -168; p.heading = Math.PI / 2;
        p.health = 100; p.armour = 50;
        p.mesh.position.set(p.x, 0, p.z);
        G.police.setStars(0);
      }
      G.display.flashDamage();
    },
    update(dt) {
      // tracer fade
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.ttl -= dt;
        t.line.material.opacity = Math.max(0, t.ttl / 0.12) * 0.9;
        if (t.ttl <= 0) {
          scene.remove(t.line);
          t.line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
      // enemies: close in and shoot back
      const p = G.player;
      for (const e of enemies) {
        const dx = p.x - e.x, dz = p.z - e.z;
        const d = Math.hypot(dx, dz);
        e.heading = Math.atan2(dx, dz);
        e.mesh.rotation.y = e.heading;
        if (d > 10) {
          e.x += Math.sin(e.heading) * 3.2 * dt;
          e.z += Math.cos(e.heading) * 3.2 * dt;
          e.mesh.position.set(e.x, 0, e.z);
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 30) {
          e.shootTimer = 1.2;
          spawnTracer({ x: e.x, y: 1.4, z: e.z }, { x: p.x, y: 1.2, z: p.z });
          api.damagePlayer(ENEMY_SHOT_DMG);
        }
      }
    },
  };
  return api;
}
