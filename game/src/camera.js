// Camera: chase cam whose yaw IS the view/aim direction (probes set cam.yaw and
// click). F1: yaw eases to the heading only while driving and idle > 1.5 s;
// on foot it never auto-eases, so a staged aim stays intact.
import * as THREE from '../vendor/three.module.min.js';

export function createCamera(G) {
  let yaw = Math.PI / 2; // view direction; also the shoot direction
  let pitch = -0.18;
  let yawError = 0;
  let lastDragT = 10; // start idle so the camera settles immediately
  let fov = 62;
  let shotFrozen = false;
  let shotPose = null;

  const api = {
    get yaw() { return yaw; },
    set yaw(v) { yaw = v; },
    get pitch() { return pitch; },
    set pitch(v) { pitch = v; },
    get yawError() { return yawError; },
    get fov() { return G.camera3.fov; },
    get lastDragT() { return lastDragT; },
    applyPose(pose) {
      shotFrozen = true;
      shotPose = pose;
    },
    releasePose() {
      shotFrozen = false;
      shotPose = null;
    },
    update(dt) {
      const cam3 = G.camera3;
      const p = G.player;
      // mouse drag rotates the view and resets the idle timer
      const m = G.input.mouse;
      if (m.dragging && (m.dx !== 0 || m.dy !== 0)) {
        yaw -= m.dx * 0.005;
        pitch = Math.max(-0.6, Math.min(0.25, pitch - m.dy * 0.003));
        lastDragT = 0;
        m.dx = 0; m.dy = 0;
      }
      if (shotFrozen && shotPose) {
        cam3.position.set(shotPose.pos[0], shotPose.pos[1], shotPose.pos[2]);
        cam3.lookAt(shotPose.look[0], shotPose.look[1], shotPose.look[2]);
        if (cam3.fov !== 55) { cam3.fov = 55; cam3.updateProjectionMatrix(); }
        return;
      }
      lastDragT += dt;
      const driving = !!p.car;
      const speed = Math.abs(p.speed || 0);
      // F1: follow the heading only while driving and idle > 1.5 s
      if (driving && lastDragT > 1.5) {
        let dh = p.heading - yaw;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        yawError = Math.abs(dh);
        const close = Math.abs(dh) < 0.3;
        const ease = close ? 1.4 : 2.2;
        yaw += dh * Math.min(1, ease * dt);
      } else if (driving) {
        let dh = p.heading - yaw;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        yawError = Math.abs(dh);
      } else {
        yawError = 0;
      }
      // chase position: behind the player, distance grows with speed
      const dist = 11 + speed * 0.06;
      const cx = p.x - Math.sin(yaw) * dist;
      const cz = p.z - Math.cos(yaw) * dist;
      const cy = driving ? 4.6 : 3.4;
      cam3.position.set(cx, cy, cz);
      cam3.lookAt(p.x + Math.sin(yaw) * 4, 1.6 + pitch * 8, p.z + Math.cos(yaw) * 4);
      // FOV kick 62 -> 70 with speed
      const wantFov = 62 + Math.min(8, speed * 0.19);
      if (Math.abs(cam3.fov - wantFov) > 0.1) {
        cam3.fov += (wantFov - cam3.fov) * Math.min(1, 3 * dt);
        cam3.updateProjectionMatrix();
      }
      fov = cam3.fov;
    },
  };
  return api;
}
