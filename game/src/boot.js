// Boot: wires every module, owns the game loop, the daylight slide, save/load,
// error + fps tracking, query modes (?autopilot/?shot/?seed/?lowfx) and the
// window.__game contract the probes and autopilot rely on.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, PLAYER, SAVE_KEY } from './settings.js';
import { createRng } from './rng.js';
import { createKeys } from './keys.js';
import { createTown } from './town.js';
import { createCars } from './cars.js';
import { createCops } from './cops.js';
import { createFight } from './fight.js';
import { createDisplay } from './display.js';
import { createQuests } from './quests.js';
import { createCamera } from './camera.js';
import { createPoses } from './poses.js';
import { createSound } from './sound.js';
import { createSelftest } from './selftest.js';

export function bootGame() {
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || '20261119', 10);
  const lowfx = params.get('lowfx') === '1';

  // error + failed-request tracking (surfaced as window.__errors/__failedReqs)
  window.__errors = [];
  window.__failedReqs = [];
  window.addEventListener('error', (e) => {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) {
      window.__failedReqs.push(`${e.target.tagName || 'res'} ${e.target.src || e.target.href}`);
    } else if (e.message) {
      window.__errors.push(String(e.message).slice(0, 300));
    }
  }, true);
  window.addEventListener('unhandledrejection', (e) => {
    window.__errors.push('unhandled: ' + String(e.reason && e.reason.message ? e.reason.message : e.reason).slice(0, 300));
  });

  // renderer
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowfx, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !lowfx;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffb36b);
  scene.fog = new THREE.Fog(0xffb36b, 180, 520);
  const camera3 = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera3.position.set(-60, 5, -140);

  // lights: golden hour sliding to dusk over dayLength seconds
  const sunLight = new THREE.DirectionalLight(0xffc46b, 1.6);
  sunLight.position.set(-260, 78, 330);
  sunLight.castShadow = !lowfx;
  if (!lowfx) {
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -320; sunLight.shadow.camera.right = 320;
    sunLight.shadow.camera.top = 320; sunLight.shadow.camera.bottom = -320;
    sunLight.shadow.camera.far = 900;
  }
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a4a5a, 0.85);
  scene.add(hemi);

  // shared game context
  const G = {
    rng: createRng(seed),
    scene, camera3, renderer,
    time: 0, timeScale: 1, state: 'title',
    cash: WORLD.startCash, rep: 0, distanceDriven: 0,
    freeze: false, lowfx,
    input: null, sound: null, town: null, cars: null, cops: null, police: null,
    fight: null, display: null, quests: null, cam: null, poses: null,
    player: null, saveData: null,
  };
  G.input = createKeys();
  G.input.attach(canvas);

  // player avatar (on foot)
  const pMesh = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.15, 8), new THREE.MeshStandardMaterial({ color: 0x2a4a7a, roughness: 0.8 }));
  pBody.position.y = 0.95;
  const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8b090 }));
  pHead.position.y = 1.78;
  pMesh.add(pBody, pHead);
  pMesh.position.set(PLAYER.spawn.x, 0, PLAYER.spawn.z);
  scene.add(pMesh);
  G.player = {
    mesh: pMesh, x: PLAYER.spawn.x, z: PLAYER.spawn.z,
    heading: PLAYER.spawn.heading, health: PLAYER.hp, armour: PLAYER.armour,
    car: null, speed: 0,
  };

  // modules, in dependency order
  G.town = createTown(G);
  G.cars = createCars(G);
  G.cops = createCops(G);
  G.police = G.cops; // modules address the police through G.police
  G.fight = createFight(G);
  G.display = createDisplay(G);
  G.quests = createQuests(G);
  G.cam = createCamera(G);
  G.poses = createPoses(G);
  G.sound = createSound(G);
  const selftest = createSelftest(G);

  // ---- save / load ----
  function saveGame() {
    try {
      G.saveData = { cash: G.cash, completed: [...G.quests.completed], rep: G.rep, savedAt: Date.now() };
      localStorage.setItem(SAVE_KEY, JSON.stringify(G.saveData));
    } catch (e) { /* storage may be unavailable */ }
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      G.cash = data.cash || 0;
      G.rep = data.rep || 0;
      if (Array.isArray(data.completed)) data.completed.forEach((i) => G.quests.completed.add(i));
      G.saveData = data;
      return true;
    } catch (e) { return false; }
  }
  function resetRun() {
    G.cash = 0; G.rep = 0; G.distanceDriven = 0; G.time = 0;
    G.quests.completed.clear();
    G.fight.clearEnemies();
    G.police.setStars(0);
    if (G.player.car) G.cars.exitCar();
    G.player.x = PLAYER.spawn.x; G.player.z = PLAYER.spawn.z;
    G.player.heading = PLAYER.spawn.heading;
    G.player.health = PLAYER.hp; G.player.armour = PLAYER.armour;
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
    G.player.mesh.visible = true;
    G.cars.teleportCar(-120, 30, Math.PI / 2);
    G.cam.yaw = PLAYER.spawn.heading;
    G.state = 'playing';
  }
  function setPlayer(x, z) {
    if (G.player.car) G.cars.exitCar();
    G.player.x = x; G.player.z = z;
    G.player.mesh.position.set(x, 0, z);
  }
  G.setPlayer = setPlayer;
  G.tryEnterCarAt = (x, z) => G.cars.tryEnterCarAt(x, z);
  G.saveGame = saveGame;
  G.loadSave = loadSave;
  G.resetRun = resetRun;
  loadSave();

  // ---- window.__game contract ----
  const game = {
    get time() { return G.time; },
    get cash() { return G.cash; },
    get save() { return G.saveData; },
    get state() { return G.state; },
    set state(v) { G.state = v; },
    player: {
      get health() { return G.player.health; },
      set health(v) { G.player.health = v; },
      get heading() { return G.player.heading; },
      get mesh() { return G.player.mesh; },
      get x() { return G.player.x; },
      get z() { return G.player.z; },
      get car() { return G.player.car; },
    },
    setPlayer(x, z) { setPlayer(x, z); },
    exitCar() { G.cars.exitCar(); },
    tryEnterCarAt(x, z) { return G.cars.tryEnterCarAt(x, z); },
    resetRun,
    saveGame,
    loadSave,
    get display() { return G.display; },
    missions: {
      get index() { return G.quests.index; },
      get active() { return G.quests.active; },
      get step() { return G.quests.step; },
      get completed() { return G.quests.completed; },
      start(i) { return G.quests.start(i); },
      get chaseTarget() { return G.quests.chaseTarget; },
      interact() { return G.quests.interact(); },
    },
    police: {
      get cars() { return G.cops.cars; },
      get cops() { return G.cops.cops; },
      get stars() { return G.cops.stars; },
      setStars(n) { G.cops.setStars(n); },
      get heli() { return G.cops.heli; },
      get nearestDist() { return G.cops.nearestDist; },
    },
    combat: {
      get enemies() { return G.fight.enemies; },
      get tracers() { return G.fight.tracers; },
      get ammo() { return G.fight.ammo; },
      get weaponIndex() { return G.fight.weaponIndex; },
      shoot() { return G.fight.shoot(); },
      spawnEnemies(x, z, n) { return G.fight.spawnEnemies(x, z, n); },
      clearEnemies() { return G.fight.clearEnemies(); },
    },
    cam: {
      get yaw() { return G.cam.yaw; },
      set yaw(v) { G.cam.yaw = v; },
      get pitch() { return G.cam.pitch; },
      set pitch(v) { G.cam.pitch = v; },
      get yawError() { return G.cam.yawError; },
      get fov() { return G.cam.fov; },
    },
    get town() { return G.town; },
    get scene() { return scene; },
    get renderer() { return renderer; },
    get sound() { return G.sound; },
    get traffic() { return G.cars.traffic; },
    get pedestrians() { return G.town.pedestrians; },
    get timeScale() { return G.timeScale; },
    set timeScale(v) { G.timeScale = v; },
    get sirenActive() { return G.sound.sirenActive; },
  };
  window.__game = game;

  // ---- input: E interact, R radio, 1/2 weapons, click to shoot, Enter to start ----
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') G.quests.interact();
    if (e.code === 'KeyR') G.sound.nextStation();
    if (e.code === 'Digit1') G.fight.setWeapon(0);
    if (e.code === 'Digit2') G.fight.setWeapon(1);
    if (e.code === 'Enter' && G.state === 'title') {
      G.state = 'playing';
      const t = document.getElementById('title-screen');
      if (t) t.classList.remove('show');
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 && G.state === 'playing') G.fight.shoot();
  });

  // ---- daylight slide: golden hour -> dusk over dayLength ----
  const dayCol = new THREE.Color(0xffc46b);
  const duskCol = new THREE.Color(0xff5a14);
  const skyDay = new THREE.Color(0xffb36b);
  const skyDusk = new THREE.Color(0x7a4a6a);
  function updateDaylight() {
    const t = Math.min(1, G.time / WORLD.dayLength);
    sunLight.color.copy(dayCol).lerp(duskCol, t);
    sunLight.intensity = 1.6 - t * 0.7;
    hemi.intensity = 0.85 - t * 0.3;
    scene.background.copy(skyDay).lerp(skyDusk, t);
    scene.fog.color.copy(scene.background);
    G.town.sunDisc.material.color.copy(dayCol).lerp(duskCol, t);
  }

  // ---- fps tracking (real elapsed time, not the capped game dt) ----
  let frames = 0, fpsT = 0, lastFpsNow = performance.now();
  window.__fps = 0;

  // ---- main loop ----
  const clock = new THREE.Clock();
  let lastX = G.player.x, lastZ = G.player.z;
  function loop() {
    requestAnimationFrame(loop);
    const rawDt = Math.min(0.08, clock.getDelta());
    const dt = rawDt * G.timeScale;
    if (G.state === 'playing' && !G.freeze) {
      G.time += dt;
      G.town.update(dt);
      G.cars.update(dt);
      G.cops.update(dt);
      G.fight.update(dt);
      G.quests.update(dt);
      G.sound.update(dt);
      updateDaylight();
      // rep + distance tracking
      const moved = Math.hypot(G.player.x - lastX, G.player.z - lastZ);
      G.distanceDriven += moved;
      G.rep = G.quests.completed.size * 160 + Math.floor(G.distanceDriven / 50);
    } else if (G.state === 'title') {
      // gentle orbit behind the title screen
      G.town.update(rawDt * 0.2);
    }
    lastX = G.player.x; lastZ = G.player.z;
    G.cam.update(rawDt);
    G.display.update(rawDt);
    renderer.render(scene, camera3);
    frames++;
    const nowMs = performance.now();
    fpsT += (nowMs - lastFpsNow) / 1000;
    lastFpsNow = nowMs;
    if (fpsT >= 1) {
      window.__fps = Math.round(frames / fpsT);
      frames = 0; fpsT = 0;
    }
  }

  window.addEventListener('resize', () => {
    camera3.aspect = window.innerWidth / window.innerHeight;
    camera3.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  loop();

  // ---- query modes ----
  const shot = params.get('shot');
  const autopilot = params.get('autopilot') === '1';
  if (shot) {
    G.state = 'playing';
    // let one frame render before staging, so meshes exist
    setTimeout(() => {
      G.poses.apply(shot);
      document.title = 'SHOT-READY';
    }, 600);
  } else if (autopilot) {
    G.state = 'playing';
    const t = document.getElementById('title-screen');
    if (t) t.classList.remove('show');
    setTimeout(() => selftest.run(), 800);
  } else {
    const t = document.getElementById('title-screen');
    if (t) t.classList.add('show');
  }
}

// boot immediately: module scripts run after the DOM is parsed.
bootGame();
