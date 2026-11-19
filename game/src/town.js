// Town: builds the whole 3D city — ground, roads, buildings, beach, docks, sea,
// sun, billboards, signs, floodlights, pedestrians. Also owns building colliders.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, DISTRICTS, STREETS_X, STREETS_Z, SUN, MINIMAP_COLORS } from './settings.js';

const FACADE_BASES = ['#c9b18c', '#8fa3b5', '#b5765a', '#d8cfb8', '#7d8894', '#c2a878'];
const ROOF_COLORS = [0x8a4a3a, 0x5a6a7a, 0x7a5a3a, 0x4a5a4a, 0x9a7a4a, 0x6a4a5a, 0x3a4a5a];

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function facadeTexture(variant) {
  const base = FACADE_BASES[variant % FACADE_BASES.length];
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // subtle vertical grime
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h);
    // window grid, some lit warm
    const cols = 4 + (variant % 3), rows = 8 + (variant % 4);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = 8 + c * ((w - 16) / cols), wy = 10 + r * ((h - 20) / rows);
        const lit = ((r * 7 + c * 3 + variant) % 5) === 0;
        g.fillStyle = lit ? '#ffd98a' : '#2a3542';
        g.fillRect(wx, wy, (w - 16) / cols - 6, (h - 20) / rows - 8);
      }
    }
    // ground floor: darker shopfront band
    g.fillStyle = 'rgba(20,20,28,0.55)';
    g.fillRect(0, h - 26, w, 26);
  });
}

function textTexture(text, sub, bg, fg, w = 512, h = 128) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 56px Arial'; g.fillText(text, w / 2, h / 2 - 16);
    g.font = '28px Arial'; g.fillText(sub, w / 2, h / 2 + 34);
  });
}

export function createTown(G) {
  const rng = G.rng;
  const scene = G.scene;
  const group = new THREE.Group();
  group.name = 'town';
  scene.add(group);

  const colliders = [];
  const buildings = [];
  const pedestrians = [];
  const beachWalkers = [];

  // ---- ground: one big plane, canvas-painted land + roads ----
  const groundTex = canvasTexture(1024, 1024, (g, w, h) => {
    const toPx = (v) => ((v + 288) / 576) * w;
    g.fillStyle = '#565d68'; g.fillRect(0, 0, w, h);
    // parks (a few green blocks)
    g.fillStyle = MINIMAP_COLORS.park;
    [[-224, -32], [96, -160], [32, 96], [-160, 160]].forEach(([bx, bz]) => {
      g.fillRect(toPx(bx - 24), toPx(bz - 24), 48 / 576 * w, 48 / 576 * w);
    });
    // roads: light bands along every grid line
    g.fillStyle = '#7d838d';
    WORLD.gridLines.forEach((ln) => {
      g.fillRect(toPx(ln - 8), 0, 16 / 576 * w, h);
      g.fillRect(0, toPx(ln - 8), w, 16 / 576 * w);
    });
    // docks apron (east)
    g.fillStyle = MINIMAP_COLORS.docks;
    g.fillRect(toPx(224), 0, (288 - 224) / 576 * w, h);
    // sand (south)
    g.fillStyle = MINIMAP_COLORS.sand;
    g.fillRect(0, toPx(224), w, (296 - 224) / 576 * h);
    // sea (far south)
    g.fillStyle = MINIMAP_COLORS.sea;
    g.fillRect(0, toPx(296), w, h - toPx(296));
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(576, 576),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- sea plane (animated shimmer) ----
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x2a7a9e, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(576, 280), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.4, 296 + 140);
  group.add(sea);

  // ---- buildings ----
  const facadeTexs = [0, 1, 2, 3, 4, 5].map(facadeTexture);
  const blockCenters = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) blockCenters.push([-224 + i * 64, -224 + j * 64]);
  let buildingCount = 0;
  for (const [cx, cz] of blockCenters) {
    if (cz >= 224) continue; // beach, no buildings
    if (cx >= 224) continue; // docks, no buildings
    const isPark = ([[-224, -32], [96, -160], [32, 96], [-160, 160]].some(([px, pz]) => px === cx && pz === cz));
    if (isPark) continue;
    const n = rng.chance(0.35) ? 2 : 1;
    for (let b = 0; b < n; b++) {
      const bw = rng.range(18, 34), bd = rng.range(16, 30);
      const bx = cx + (n === 2 ? (b === 0 ? -12 : 12) : 0) + rng.range(-4, 4);
      const bz = cz + rng.range(-4, 4);
      const bh = rng.range(12, 30) + (Math.abs(cx) < 70 && Math.abs(cz) < 70 ? rng.range(0, 18) : 0);
      const tex = facadeTexs[rng.int(0, 5)];
      const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
      const top = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 1 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [side, side, top, top, side, side]);
      mesh.position.set(bx, bh / 2, bz);
      mesh.castShadow = true;
      group.add(mesh);
      buildings.push(mesh);
      colliders.push({ x0: bx - bw / 2, z0: bz - bd / 2, x1: bx + bw / 2, z1: bz + bd / 2 });
      buildingCount++;
      // visible roof slab on ~35% of buildings
      if (rng.chance(0.35)) {
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(bw + 1.5, 1.2, bd + 1.5),
          new THREE.MeshStandardMaterial({ color: ROOF_COLORS[rng.int(0, 6)], roughness: 0.85 }),
        );
        roof.position.set(bx, bh + 0.6, bz);
        group.add(roof);
      }
    }
  }

  // ---- docks: containers + floodlights ----
  const containerColors = [0x8a4a3a, 0x3a6a8a, 0x5a7a3a, 0x9a7a2a];
  for (let i = 0; i < 14; i++) {
    const cw = 12, ch = rng.range(2.6, 5.2), cd = 2.6;
    const cx = rng.range(232, 280), cz = rng.range(-260, 200);
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(cw, ch, cd),
      new THREE.MeshStandardMaterial({ color: containerColors[i % 4], roughness: 0.8 }),
    );
    m.position.set(cx, ch / 2, cz);
    m.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    m.castShadow = true;
    group.add(m);
    colliders.push({ x0: cx - 6, z0: cz - 3, x1: cx + 6, z1: cz + 3 });
  }
  const floodlights = [];
  [[258, 126], [240, -40], [272, 180], [236, 60]].forEach(([fx, fz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 12, 6), new THREE.MeshStandardMaterial({ color: 0x44484e }));
    pole.position.set(fx, 6, fz);
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.6 }),
    );
    lamp.position.set(fx, 12.4, fz);
    group.add(lamp);
    floodlights.push(lamp);
  });

  // ---- beach: umbrellas, towels, lifeguard tower ----
  const umbrellaColors = [0xd84a4a, 0x4a8ad8, 0xe8c84a, 0x4ad88a];
  for (let i = 0; i < 4; i++) {
    const ux = -160 + i * 90 + rng.range(-8, 8), uz = 282 + (i % 2) * 6;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    pole.position.set(ux, 1.5, uz);
    group.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: umbrellaColors[i], roughness: 0.7 }),
    );
    top.position.set(ux, 3.4, uz);
    group.add(top);
  }
  for (let i = 0; i < 6; i++) {
    const towel = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 1.1),
      new THREE.MeshStandardMaterial({ color: [0xe84a7a, 0x4ad8d8, 0xe8a84a, 0x7a4ad8, 0x4ad84a, 0xd84a4a][i], roughness: 1 }),
    );
    towel.position.set(-180 + i * 62 + rng.range(-6, 6), 0.06, 272 + rng.range(-3, 6));
    towel.rotation.y = rng.range(0, Math.PI);
    group.add(towel);
  }
  const tower = new THREE.Group();
  const towerLegs = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), new THREE.MeshStandardMaterial({ color: 0xe8e0d0 }));
  towerLegs.position.y = 2;
  const towerTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 3.6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  towerTop.position.y = 5;
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.4, 4), new THREE.MeshStandardMaterial({ color: 0xd84a4a }));
  towerRoof.position.y = 7;
  towerRoof.rotation.y = Math.PI / 4;
  tower.add(towerLegs, towerTop, towerRoof);
  tower.position.set(-80, 0, 288);
  group.add(tower);
  colliders.push({ x0: -82, z0: 286, x1: -78, z1: 290 });

  // ---- billboards (face the beach, +z) ----
  const bb1 = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 6.5),
    new THREE.MeshBasicMaterial({ map: textTexture('HOTEL MIRAMAR', 'rooms • pool • no questions', '#1a2a4a', '#ffd98a') }),
  );
  bb1.position.set(-120, 14, 210);
  group.add(bb1);
  const bb2 = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 6.5),
    new THREE.MeshBasicMaterial({ map: textTexture('CASINO DEL MAR', 'slots • tables • open 24h', '#4a1a2a', '#ffe9a0') }),
  );
  bb2.position.set(120, 14, 210);
  group.add(bb2);
  // billboard posts
  [[-120, 210], [120, 210]].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 11, 0.8), new THREE.MeshStandardMaterial({ color: 0x555a60 }));
    post.position.set(px, 5.5, pz);
    group.add(post);
    colliders.push({ x0: px - 1, z0: pz - 1, x1: px + 1, z1: pz + 1 });
  });
  // third original billboard
  const bb3 = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 5),
    new THREE.MeshBasicMaterial({ map: textTexture('CERVEZA VELA', 'ice cold since 1962', '#2a4a1a', '#fff2c0') }),
  );
  bb3.position.set(0, 13, -210);
  bb3.rotation.y = Math.PI;
  group.add(bb3);

  // ---- district signs (7) ----
  DISTRICTS.slice(0, 7).forEach((d, i) => {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3),
      new THREE.MeshBasicMaterial({ map: textTexture(d.name.toUpperCase(), d.blurb, '#22262c', '#e8e0c8', 512, 96) }),
    );
    sign.position.set(-200 + (i % 4) * 130, 6, d.z0 + 8);
    group.add(sign);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), new THREE.MeshStandardMaterial({ color: 0x555a60 }));
    post.position.set(-200 + (i % 4) * 130, 3, d.z0 + 8);
    group.add(post);
  });

  // ---- sun disc + halo (billboarded toward camera each frame) ----
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(SUN.discR, 32),
    new THREE.MeshBasicMaterial({ color: SUN.discColor, fog: false }),
  );
  sunDisc.position.set(...SUN.pos);
  group.add(sunDisc);
  const sunHalo = new THREE.Mesh(
    new THREE.CircleGeometry(SUN.haloR, 32),
    new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: SUN.haloOpacity, fog: false }),
  );
  sunHalo.position.set(SUN.pos[0], SUN.pos[1], SUN.pos[2] - 2);
  group.add(sunHalo);

  // ---- yacht La Sirena at the marina ----
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 16), new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.4 }));
  hull.position.y = 1;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2, 9), new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.5 }));
  cabin.position.y = 3;
  yacht.add(hull, cabin);
  yacht.position.set(60, 0.6, 232);
  yacht.rotation.y = 0.3;
  group.add(yacht);

  // ---- pedestrians ----
  function makePed(x, z, bright) {
    const shirt = bright
      ? [0xe84a4a, 0x4ad8d8, 0xe8c84a, 0x7a4ad8, 0x4ad84a][Math.floor(rng.next() * 5)]
      : [0x6a7a8a, 0x8a6a5a, 0x5a6a7a, 0x9a8a6a, 0x4a5a6a][Math.floor(rng.next() * 5)];
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.1, 8), new THREE.MeshStandardMaterial({ color: shirt }));
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8b090 }));
    head.position.y = 1.75;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2a32 }));
    legs.position.y = 0.35;
    g.add(body, head, legs);
    g.position.set(x, 0, z);
    group.add(g);
    return { mesh: g, x, z, heading: rng.range(0, Math.PI * 2), speed: 1.2, tx: x, tz: z, fleeT: 0, bright };
  }
  for (let i = 0; i < 12; i++) {
    const p = makePed(rng.range(-240, 200), rng.range(-240, 200), false);
    pedestrians.push(p);
  }
  for (let i = 0; i < 5; i++) {
    const p = makePed(-160 + i * 70 + rng.range(-8, 8), 292 + rng.range(0, 5), true);
    beachWalkers.push(p);
  }

  // ---- streetlights at a few intersections ----
  for (let i = 0; i < 12; i++) {
    const lx = WORLD.gridLines[rng.int(1, 7)], lz = WORLD.gridLines[rng.int(1, 7)];
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), new THREE.MeshStandardMaterial({ color: 0x3a3e44 }));
    pole.position.set(lx + 9, 3, lz + 9);
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.2 }),
    );
    lamp.position.set(lx + 9, 6.2, lz + 9);
    group.add(lamp);
  }

  function districtAt(x, z) {
    for (const d of DISTRICTS) if (z >= d.z0 && z < d.z1) return d.name;
    return z >= 288 ? 'The Sea' : 'North Gate';
  }
  function nearestLine(v) {
    let best = WORLD.gridLines[0], bd = 1e9;
    for (const ln of WORLD.gridLines) { const d = Math.abs(v - ln); if (d < bd) { bd = d; best = ln; } }
    return best;
  }
  function streetAt(x, z) {
    const xi = WORLD.gridLines.indexOf(nearestLine(x));
    const zi = WORLD.gridLines.indexOf(nearestLine(z));
    return `${STREETS_X[xi] || 'Harbor Ave'} / ${STREETS_Z[zi] || 'Plaza Way'}`;
  }
  // Circle vs building AABBs: push the circle out, return corrected position.
  function collide(x, z, r) {
    for (const c of colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // center inside the box: push out along the smallest penetration axis
          const pl = x - c.x0 + r, pr = c.x1 - x + r, pt = z - c.z0 + r, pb = c.z1 - z + r;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
          else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
        }
      }
    }
    return { x, z };
  }

  let seaT = 0;
  return {
    group, colliders, buildings, buildingCount, pedestrians, beachWalkers,
    sunDisc, sunHalo, sea, floodlights, yacht,
    districtAt, streetAt, collide,
    update(dt) {
      seaT += dt;
      sea.position.y = 0.4 + Math.sin(seaT * 0.7) * 0.15;
      seaMat.opacity = 0.9 + Math.sin(seaT * 0.5) * 0.03;
      // pedestrians: stroll between sidewalk waypoints, flee cars < 6 m
      const carPos = G.player && G.player.car ? { x: G.player.x, z: G.player.z } : null;
      const stepPed = (p) => {
        if (carPos) {
          const dx = p.x - carPos.x, dz = p.z - carPos.z;
          const d = Math.hypot(dx, dz);
          if (d < 6) { p.fleeT = 2; }
        }
        if (p.fleeT > 0) {
          p.fleeT -= dt;
          const dx = p.x - (carPos ? carPos.x : p.x), dz = p.z - (carPos ? carPos.z : p.z);
          const d = Math.hypot(dx, dz) || 1;
          p.x += (dx / d) * 3.5 * dt; p.z += (dz / d) * 3.5 * dt;
          p.heading = Math.atan2(dx, dz);
        } else {
          const dx = p.tx - p.x, dz = p.tz - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 1) {
            p.tx = Math.max(-250, Math.min(210, p.x + (rng.next() - 0.5) * 120));
            p.tz = Math.max(-250, Math.min(210, p.z + (rng.next() - 0.5) * 120));
          } else {
            p.x += (dx / d) * p.speed * dt;
            p.z += (dz / d) * p.speed * dt;
            p.heading = Math.atan2(dx, dz);
          }
        }
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
      };
      pedestrians.forEach(stepPed);
      beachWalkers.forEach((p) => {
        // beach walkers stay near the waterline, slow stroll along x
        p.tx = Math.max(-200, Math.min(200, p.tx));
        stepPed(p);
        p.z = Math.max(290, Math.min(298, p.z));
        p.mesh.position.z = p.z;
      });
    },
  };
}
