// Quests: the 8-mission story state machine. Steps are 1-based. E prioritises
// the mission interact over entering a car. Rewards total $19,000.
import * as THREE from '../vendor/three.module.min.js';
import { MISSIONS } from './settings.js';

const TOTAL_STEPS = [2, 2, 1, 2, 2, 1, 2, 2];

export function createQuests(G) {
  let index = 0;
  let active = false;
  let step = 1;
  const completed = new Set();
  let sedan = null; // M6 ram target
  let van = null; // M7 steal target
  let timer = 0; // M5 countdown / M8 survive clock
  let missionT = 0;

  function cleanupMissionEntities() {
    G.fight.clearEnemies();
    if (sedan) { G.scene.remove(sedan.mesh); sedan = null; }
    if (van) {
      const i = G.cars.traffic.indexOf(van);
      if (i >= 0) G.cars.traffic.splice(i, 1);
      G.scene.remove(van.mesh);
      van = null;
    }
  }

  function spawnSedan() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.35, metalness: 0.5 }));
    body.position.y = 0.55;
    body.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.15, metalness: 0.6 }));
    cabin.position.set(0, 1.15, -0.2);
    g.add(body, cabin);
    G.scene.add(g);
    const def = MISSIONS[5];
    sedan = {
      mesh: g, hp: def.hp, angle: 0,
      center: def.center, rx: def.rx, rz: def.rz, speed: def.speed,
      x: def.center.x + def.rx, z: def.center.z, heading: 0,
      name: 'GREEN SEDAN', condition: 100,
    };
    g.position.set(sedan.x, 0, sedan.z);
    return sedan;
  }

  function spawnVan() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 5), new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.5, metalness: 0.3 }));
    body.position.y = 1.1;
    body.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x2a3542, roughness: 0.2, metalness: 0.5 }));
    cab.position.set(0, 2.2, 1.6);
    g.add(body, cab);
    G.scene.add(g);
    van = {
      mesh: g, x: -180, z: 232, heading: Math.PI, speed: 0,
      axis: 'x', line: 232, dir: 0, name: 'VAN', condition: 100, isVan: true,
    };
    g.position.set(-180, 0, 232);
    g.rotation.y = Math.PI;
    G.cars.traffic.push(van);
    return van;
  }

  function complete(i) {
    const def = MISSIONS[i];
    G.cash += def.reward;
    completed.add(i);
    active = false;
    cleanupMissionEntities();
    G.display.showMsg(`MISSION COMPLETE — ${def.name} +$${def.reward.toLocaleString('en-US')}`, 5000);
    G.display.dialogue('Mara Voss', 'FIXER', `Clean work, Dante. $${def.reward.toLocaleString('en-US')} is yours. Next job when you're ready.`, 5000);
    G.sound.blip();
    G.saveGame();
    if (i + 1 < MISSIONS.length) index = i + 1;
  }

  function failMission(reason) {
    const def = MISSIONS[index];
    G.display.showMsg(`MISSION FAILED — ${def.name}: ${reason}`, 5000);
    G.display.dialogue('Det. Rook', 'PD', 'Vela remembers, Reyes. Try that again and it ends worse.', 5000);
    active = false;
    cleanupMissionEntities();
    G.police.setStars(0);
  }

  const api = {
    get index() { return index; },
    get active() { return active; },
    get step() { return step; },
    get completed() { return completed; },
    get current() { return active ? MISSIONS[index] : null; },
    get chaseTarget() { return sedan; },
    totalSteps() { return active ? TOTAL_STEPS[index] : 0; },
    start(i) {
      if (i < 0 || i >= MISSIONS.length) return false;
      cleanupMissionEntities();
      index = i; active = true; step = 1; missionT = 0; timer = 0;
      const def = MISSIONS[i];
      if (def.startStars) G.police.setStars(def.startStars);
      if (i === 3) G.fight.spawnEnemies(def.arena.x, def.arena.z, def.guards);
      if (i === 5) spawnSedan();
      if (i === 6) spawnVan();
      G.display.showMsg(`${def.chapter} — ${def.name}: ${def.brief}`, 3500);
      G.display.dialogue('Mara Voss', 'FIXER', def.brief, 5000);
      return true;
    },
    objectivePos() {
      if (!active) return null;
      const def = MISSIONS[index];
      switch (index) {
        case 0: return step === 1 ? def.garage : def.home;
        case 1: return step === 1 ? def.pickup : def.home;
        case 2: return null;
        case 3: return def.arena;
        case 4: return step === 1 ? def.pickup : def.dest;
        case 5: return sedan ? { x: sedan.x, z: sedan.z } : null;
        case 6: return step === 1 ? def.van : def.home;
        case 7: return step === 2 ? def.yacht : null;
        default: return null;
      }
    },
    objectiveText() {
      if (!active) return '';
      const def = MISSIONS[index];
      switch (index) {
        case 0: return step === 1 ? 'Go to the garage — press E at the door' : 'Drive home to the safehouse';
        case 1: return step === 1 ? 'Go to the docks — press E at the package' : 'Bring it home to the safehouse';
        case 2: return `Lose the heat — ${G.police.stars}★ left`;
        case 3: return step === 1 ? `Take out the guards — ${G.fight.enemies.length} left` : 'Grab the cash — press E';
        case 4: return step === 1 ? 'Pick up the courier at the marina' : `Reach the north gate — ${Math.max(0, Math.ceil(timer))}s left`;
        case 5: return sedan ? `Ram the green sedan — HP ${Math.max(0, Math.ceil(sedan.hp))}` : '';
        case 6: return step === 1 ? 'Steal the van on the beach' : 'Get home with three stars on you';
        case 7: return step === 1 ? `Survive at 4★ — ${Math.floor(timer)}/60s` : 'Reach the yacht La Sirena';
        default: return '';
      }
    },
    timerText() {
      if (!active) return '';
      if (index === 4 && step === 2) return `TIME ${Math.max(0, Math.ceil(timer))}s`;
      if (index === 7 && step === 1) return `${Math.floor(timer)}/60s`;
      return '';
    },
    // E key: mission interact beats entering a car.
    interact() {
      if (!active) return G.cars.tryEnterCarAt(G.player.x, G.player.z);
      const def = MISSIONS[index];
      const p = G.player;
      const near = (pt, r = 7) => Math.hypot(p.x - pt.x, p.z - pt.z) < r;
      if (index === 0 && step === 1 && near(def.garage, 8)) {
        step = 2;
        G.display.showMsg('Got the keys. Bring the coupe home.', 3500);
        return 'garage';
      }
      if (index === 1 && step === 1 && near(def.pickup, 7)) {
        step = 2;
        G.display.showMsg('Package secured. Bring it home.', 3500);
        return 'pickup';
      }
      if (index === 3 && step === 2 && near(def.arena, 8)) {
        complete(3);
        return 'cash';
      }
      return G.cars.tryEnterCarAt(p.x, p.z);
    },
    update(dt) {
      if (!active) return;
      const def = MISSIONS[index];
      const p = G.player;
      missionT += dt;
      const near = (pt, r = 8) => Math.hypot(p.x - pt.x, p.z - pt.z) < r;
      switch (index) {
        case 0:
          if (step === 2 && near(def.home, 9)) complete(0);
          break;
        case 1:
          if (step === 2 && near(def.home, 9)) complete(1);
          break;
        case 2:
          if (G.police.stars === 0) complete(2);
          break;
        case 3:
          if (step === 1 && G.fight.enemies.length === 0) {
            step = 2;
            G.display.showMsg('All four down. Grab the cash.', 3500);
          }
          break;
        case 4:
          if (step === 1 && near(def.pickup, 7)) {
            step = 2;
            timer = def.limit;
            G.display.showMsg('Courier in. North gate — 90 seconds!', 3500);
          } else if (step === 2) {
            timer -= dt;
            if (near(def.dest, 9)) complete(4);
            else if (timer <= 0) failMission('the clock ran out');
          }
          break;
        case 5: {
          if (!sedan) break;
          sedan.angle += sedan.speed * dt;
          sedan.x = sedan.center.x + Math.cos(sedan.angle) * sedan.rx;
          sedan.z = sedan.center.z + Math.sin(sedan.angle) * sedan.rz;
          sedan.heading = Math.atan2(-Math.sin(sedan.angle) * sedan.rx, Math.cos(sedan.angle) * sedan.rz);
          sedan.mesh.position.set(sedan.x, 0, sedan.z);
          sedan.mesh.rotation.y = sedan.heading;
          // ramming: player car within 7 m deals 120 dmg/s
          if (p.car) {
            const d = Math.hypot(p.x - sedan.x, p.z - sedan.z);
            if (d < 7) {
              sedan.hp -= 120 * dt;
              if (sedan.hp <= 0) complete(5);
            }
          }
          break;
        }
        case 6:
          if (step === 1 && p.car === van) {
            step = 2;
            G.police.setStars(3);
            G.display.showMsg('Van stolen! Three stars — get home!', 3500);
          } else if (step === 2 && near(def.home, 9)) {
            complete(6);
          }
          break;
        case 7:
          if (step === 1) {
            if (G.police.stars >= 4) timer += dt;
            if (timer >= def.survive) {
              step = 2;
              G.display.showMsg('You survived. Now reach the yacht!', 3500);
            }
          } else if (near(def.yacht, 10)) {
            complete(7);
          }
          break;
        default:
          break;
      }
    },
  };
  return api;
}
