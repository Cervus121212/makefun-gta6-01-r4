// Sound: WebAudio synth — three radio stations (kick + bass every 500 ms),
// distance-driven police siren, shots, blips. Everything is guarded: in a
// headless/autopilot run with no audio device, every call is a safe no-op.
import { RADIO } from './settings.js';

export function createSound(G) {
  let ctx = null;
  let master = null;
  let radioGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let station = 0;
  let nextBeatT = 0;
  let beatCount = 0;
  let sirenActive = false;

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.12;
      radioGain.connect(master);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function beat() {
    if (!ctx) return;
    const st = RADIO[station];
    const t0 = ctx.currentTime;
    // kick
    const kick = ctx.createOscillator();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(120, t0);
    kick.frequency.exponentialRampToValueAtTime(40, t0 + 0.18);
    const kg = ctx.createGain();
    kg.gain.setValueAtTime(0.9, t0);
    kg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
    kick.connect(kg); kg.connect(radioGain);
    kick.start(t0); kick.stop(t0 + 0.25);
    // bass note: walks a little minor line
    const scale = [55, 65.4, 49, 58.3, 55, 73.4, 49, 65.4];
    const freq = scale[beatCount % scale.length];
    const bass = ctx.createOscillator();
    bass.type = st.wave;
    bass.frequency.value = freq;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.25, t0);
    bg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
    bass.connect(bg); bg.connect(radioGain);
    bass.start(t0); bass.stop(t0 + 0.5);
    beatCount++;
  }

  const api = {
    get station() { return station; },
    get sirenActive() { return sirenActive; },
    setStation(i) {
      station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
      ensureCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      G.display.showMsg(`♪ ${RADIO[station].name} · ${RADIO[station].dj}`, 2000);
    },
    nextStation() { api.setStation(station + 1); },
    shot() {
      if (!ensureCtx()) return;
      try {
        const t0 = ctx.currentTime;
        const len = ctx.sampleRate * 0.08;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        src.connect(g); g.connect(master);
        src.start(t0);
      } catch (e) { /* audio is best-effort */ }
    },
    blip() {
      if (!ensureCtx()) return;
      try {
        const t0 = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(660, t0);
        o.frequency.setValueAtTime(880, t0 + 0.09);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + 0.22);
      } catch (e) { /* audio is best-effort */ }
    },
    update(dt) {
      // radio beat scheduler (500 ms)
      if (G.state === 'playing' && G.time >= nextBeatT) {
        nextBeatT = G.time + 0.5;
        if (ensureCtx()) beat();
      }
      // siren: two-tone wail, volume from the nearest police distance
      if (ctx && sirenOsc) {
        const d = G.police.nearestDist;
        const want = G.police.stars > 0 && d < 120 ? Math.max(0, 1 - d / 120) * 0.14 : 0;
        sirenActive = want > 0.01;
        sirenGain.gain.value += (want - sirenGain.gain.value) * Math.min(1, 4 * dt);
        sirenOsc.frequency.value = 650 + Math.sin(G.time * 2.4) * 180;
      } else {
        sirenActive = G.police.stars > 0;
      }
    },
  };
  return api;
}
