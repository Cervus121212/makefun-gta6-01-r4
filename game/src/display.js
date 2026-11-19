// Display: all HUD DOM — cash/stars/health, mission panel, police panel, vehicle
// panel, weapon slots, radio, clock, rep, #msg pill, portrait dialogue, minimap.
import { RADIO, MINIMAP_COLORS, CLOCK_START_MIN, CLOCK_RATE, repRank, WEAPONS } from './settings.js';

export function createDisplay(G) {
  const hud = document.getElementById('hud');
  hud.innerHTML = `
    <div id="hud-tl">
      <div id="cash-line">$<span id="cash">0</span> <span id="rep-line">REP ROOKIE 0 pts</span></div>
      <div id="stars-line"></div>
      <div id="bars"><div id="hp-bar"><i></i></div><div id="arm-bar"><i></i></div></div>
      <div id="clock-line">DAY 1 18:53</div>
      <div id="radio-line"></div>
    </div>
    <div id="hud-mission"><div id="m-chapter"></div><div id="m-title"></div>
      <div id="m-timer"></div><div id="m-stage"><i></i></div>
      <div id="m-next"></div><div id="m-obj"></div></div>
    <div id="hud-police"><div class="p-head">PD RESPONSE</div><div id="p-list"></div></div>
    <div id="hud-vehicle"><div id="v-name"></div><div id="v-cond"></div><div id="v-speed"></div></div>
    <div id="hud-weapons"></div>
    <div id="msg"></div>
    <div id="dialogue"><div id="dlg-face"></div><div><div id="dlg-name"></div><div id="dlg-text"></div></div></div>
    <div id="minimap-wrap"><canvas id="minimap" width="190" height="190"></canvas><div id="map-label"></div></div>
    <div id="damage-flash"></div>
    <div id="test-results"></div>`;

  const $ = (id) => document.getElementById(id);
  const mm = $('minimap').getContext('2d');
  let msgTimer = null;
  let dlgTimer = null;
  let mmTimer = 0;
  let policeTimer = 0;

  function fmtClock() {
    const mins = CLOCK_START_MIN + G.time * CLOCK_RATE;
    const hh = Math.floor(mins / 60) % 24;
    const mm2 = Math.floor(mins % 60);
    return `DAY 1 ${String(hh).padStart(2, '0')}:${String(mm2).padStart(2, '0')}`;
  }

  function drawMinimap() {
    const S = 190, W = 576, sc = S / W;
    const X = (x) => (x + 288) * sc, Z = (z) => (z + 288) * sc;
    mm.fillStyle = MINIMAP_COLORS.land; mm.fillRect(0, 0, S, S);
    // sea + sand
    mm.fillStyle = MINIMAP_COLORS.sea; mm.fillRect(0, Z(296), S, S - Z(296));
    mm.fillStyle = MINIMAP_COLORS.sand; mm.fillRect(0, Z(224), S, Z(296) - Z(224));
    // docks
    mm.fillStyle = MINIMAP_COLORS.docks; mm.fillRect(X(224), 0, S - X(224), S);
    // roads
    mm.fillStyle = MINIMAP_COLORS.road;
    [-256, -192, -128, -64, 0, 64, 128, 192, 256].forEach((ln) => {
      mm.fillRect(X(ln) - 2, 0, 4, S);
      mm.fillRect(0, Z(ln) - 2, S, 4);
    });
    // park dots
    mm.fillStyle = MINIMAP_COLORS.park;
    [[-224, -32], [96, -160], [32, 96], [-160, 160]].forEach(([bx, bz]) => {
      mm.fillRect(X(bx) - 5, Z(bz) - 5, 10, 10);
    });
    // markers: S safehouse, G garage, Y yacht
    mm.font = 'bold 13px Arial'; mm.textAlign = 'center'; mm.textBaseline = 'middle';
    const mark = (x, z, ch, color) => {
      mm.fillStyle = color;
      mm.beginPath(); mm.arc(X(x), Z(z), 8, 0, Math.PI * 2); mm.fill();
      mm.fillStyle = '#fff'; mm.fillText(ch, X(x), Z(z) + 0.5);
    };
    mark(-60, -168, 'S', '#2a8a4a');
    mark(-120, 24, 'G', '#8a6a2a');
    mark(60, 232, 'Y', '#2a6a8a');
    // mission target
    const t = G.quests && G.quests.objectivePos ? G.quests.objectivePos() : null;
    if (t) {
      mm.fillStyle = '#e8c84a';
      mm.beginPath(); mm.arc(X(t.x), Z(t.z), 8, 0, Math.PI * 2); mm.fill();
      mm.fillStyle = '#222'; mm.fillText('!', X(t.x), Z(t.z) + 0.5);
    }
    // police dots
    mm.fillStyle = '#e82a2a';
    for (const c of G.police.cars) { mm.beginPath(); mm.arc(X(c.x), Z(c.z), 3, 0, Math.PI * 2); mm.fill(); }
    if (G.police.heli) {
      mm.strokeStyle = '#e82a2a'; mm.lineWidth = 2;
      mm.beginPath(); mm.arc(X(G.police.heli.x), Z(G.police.heli.z), 6, 0, Math.PI * 2); mm.stroke();
    }
    // player arrow: white triangle pointing down, rotated -heading
    const px = X(G.player.x), pz = Z(G.player.z);
    mm.save();
    mm.translate(px, pz);
    mm.rotate(-G.player.heading);
    mm.fillStyle = '#ffffff';
    mm.beginPath(); mm.moveTo(0, 8); mm.lineTo(-6, -6); mm.lineTo(6, -6); mm.closePath(); mm.fill();
    mm.strokeStyle = '#222'; mm.lineWidth = 1; mm.stroke();
    mm.restore();
  }

  const api = {
    showMsg(text, ms = 3000) {
      const el = $('msg');
      el.textContent = text;
      el.classList.add('show');
      if (msgTimer) clearTimeout(msgTimer);
      msgTimer = setTimeout(() => el.classList.remove('show'), ms);
    },
    dialogue(name, role, text, ms = 5000) {
      const d = $('dialogue');
      $('dlg-face').textContent = name.split(' ').map((w) => w[0]).join('').slice(0, 2);
      $('dlg-face').style.background = name === 'Mara Voss' ? '#7a2a4a' : name === 'Det. Rook' ? '#2a4a7a' : '#4a6a2a';
      $('dlg-name').textContent = `${name} — ${role}`;
      $('dlg-text').textContent = text;
      d.classList.add('show');
      if (dlgTimer) clearTimeout(dlgTimer);
      dlgTimer = setTimeout(() => d.classList.remove('show'), ms);
    },
    flashDamage() {
      const f = $('damage-flash');
      f.style.opacity = '0.45';
      setTimeout(() => { f.style.opacity = '0'; }, 180);
    },
    update(dt) {
      const p = G.player;
      $('cash').textContent = G.cash.toLocaleString('en-US');
      $('rep-line').textContent = `REP ${repRank(G.rep)} ${G.rep} pts`;
      // stars
      let starsHtml = '';
      for (let i = 0; i < 5; i++) starsHtml += `<span class="${i < G.police.stars ? 'on' : ''}">★</span>`;
      $('stars-line').innerHTML = starsHtml;
      $('hp-bar').firstElementChild.style.width = `${Math.max(0, p.health)}%`;
      $('arm-bar').firstElementChild.style.width = `${Math.max(0, p.armour)}%`;
      $('clock-line').textContent = fmtClock();
      const st = RADIO[G.sound.station];
      $('radio-line').textContent = `♪ ${st.name} · ${st.dj} — ${st.track}`;
      // mission panel
      const q = G.quests;
      if (q && q.current) {
        $('m-chapter').textContent = `${q.current.chapter} — ${q.current.name}`;
        $('m-title').textContent = q.current.brief;
        $('m-obj').textContent = q.objectiveText() || '';
        $('m-next').textContent = q.current.next ? `NEXT: ${q.current.next}` : '';
        const total = q.totalSteps(), done = Math.max(0, q.step - 1);
        $('m-stage').firstElementChild.style.width = `${Math.min(100, (done / Math.max(1, total)) * 100)}%`;
        $('m-timer').textContent = q.timerText() || '';
      } else {
        $('m-chapter').textContent = 'FREE ROAM';
        $('m-title').textContent = 'Porto Vela is yours. Start a mission from the map.';
        $('m-obj').textContent = '';
        $('m-next').textContent = '';
        $('m-stage').firstElementChild.style.width = '0%';
        $('m-timer').textContent = '';
      }
      // vehicle panel
      if (p.car) {
        $('hud-vehicle').style.display = 'block';
        $('v-name').textContent = p.car.name;
        $('v-cond').textContent = `CONDITION ${Math.round(p.car.condition)}%`;
        $('v-speed').textContent = `${Math.round(Math.abs(p.speed) * 3.6)} KM/H`;
      } else {
        $('hud-vehicle').style.display = 'none';
      }
      // weapon slots
      const w = G.fight;
      $('hud-weapons').innerHTML =
        `<span class="${w.weaponIndex === 0 ? 'sel' : ''}">1 ${WEAPONS[0].name} ∞</span>` +
        `<span class="${w.weaponIndex === 1 ? 'sel' : ''}">2 ${WEAPONS[1].name} ${w.ammo.smg}</span>` +
        `<span class="locked">3 LOCKED</span><span class="locked">4 LOCKED</span>`;
      // police panel (throttled)
      policeTimer -= dt;
      if (policeTimer <= 0) {
        policeTimer = 0.25;
        let html = '';
        const units = [...G.police.cars.map((c) => ({ n: c.callsign, d: Math.hypot(c.x - p.x, c.z - p.z), tag: c.tag })),
          ...G.police.cops.map((c) => ({ n: c.callsign, d: Math.hypot(c.x - p.x, c.z - p.z), tag: 'PURSUIT' }))];
        if (G.police.heli) units.push({ n: G.police.heli.callsign, d: Math.hypot(G.police.heli.x - p.x, G.police.heli.z - p.z), tag: 'SPOTLIGHT ON YOU' });
        for (const u of units.slice(0, 7)) {
          html += `<div>${u.n} <b>${Math.round(u.d)} m</b> <i>${u.tag}</i></div>`;
        }
        $('p-list').innerHTML = html || '<div>All quiet.</div>';
        $('hud-police').style.display = G.police.stars > 0 ? 'block' : 'none';
      }
      // minimap (throttled)
      mmTimer -= dt;
      if (mmTimer <= 0) {
        mmTimer = 0.15;
        drawMinimap();
        $('map-label').textContent = `${G.town.districtAt(p.x, p.z)} — ${G.town.streetAt(p.x, p.z)}`;
      }
    },
  };
  return api;
}
