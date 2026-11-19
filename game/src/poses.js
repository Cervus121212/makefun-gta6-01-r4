// Poses: staged framings for the four dossier screenshots. Shot mode freezes
// the police and the player's car so the frame stays exactly as staged.
export function createPoses(G) {
  function freezePolice(on) {
    G.freeze = on;
  }
  function stageChase() {
    // F3: player car centre-frame ~66 px, cruisers staged around it, heli low.
    G.cars.teleportCar(2, 66, Math.PI);
    G.player.car = G.cars.playerCar;
    G.player.mesh.visible = false;
    G.player.x = 2; G.player.z = 66; G.player.heading = Math.PI;
    const spots = [[8, 50], [16, 54], [-14, 78]];
    G.police.setStars(3);
    G.police.cars.forEach((c, i) => {
      const s = spots[i % spots.length];
      c.x = s[0]; c.z = s[1];
      c.heading = Math.PI;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    });
    if (G.police.heli) {
      G.police.heli.x = 27.5; G.police.heli.z = 44;
      G.police.heli.height = 22; G.police.heli.angle = 2.2;
      G.police.heli.mesh.position.set(27.5, 22, 44);
    }
    freezePolice(true);
    G.cam.applyPose({ pos: [-19, 4.5, 58], look: [2, 3, 66] });
    G.display.dialogue('Mara Voss', 'FIXER', 'Three stars, Dante — and the whole bay is watching. Make it look good.', 6000);
    G.display.showMsg('CH 5 — Getaway Driver', 3500);
  }
  function stageMission() {
    // F8: docks deal at (264,120), camera ~28 m out, dialogue docked bottom-left.
    G.cars.teleportCar(250, 100, Math.PI / 2);
    G.player.car = G.cars.playerCar;
    G.player.mesh.visible = false;
    G.player.x = 250; G.player.z = 100; G.player.heading = Math.PI / 2;
    G.fight.spawnEnemies(264, 120, 4);
    G.quests.start(3);
    // Camera behind the player car so the car reads in frame with the guards
    // (the old pose looked away from the car entirely).
    G.cam.applyPose({ pos: [236, 8, 88], look: [264, 2, 120] });
    const dlg = document.getElementById('dialogue');
    if (dlg) dlg.classList.add('shot-mission');
    G.display.dialogue('Mara Voss', 'FIXER', 'Four of my men guard the cash. Drop them — clean, no witnesses.', 6000);
    G.display.showMsg('CH 4 — Dockside Deal', 3500);
  }
  function stageCover() {
    // Beach golden-hour shot: car on the sand, sun low over the sea to the
    // south-west, city behind. Camera stays over the open beach (no
    // buildings to block it) and looks south-west so the sun disc is in
    // frame — the old high city camera hid both the car and the sun.
    G.cars.teleportCar(-60, 255, Math.PI * 0.8);
    G.player.car = G.cars.playerCar;
    G.player.mesh.visible = false;
    G.player.x = -60; G.player.z = 255; G.player.heading = Math.PI * 0.8;
    G.police.setStars(0);
    G.cam.applyPose({ pos: [-35, 7, 238], look: [-130, 12, 300] });
    G.display.showMsg('PORTO VELA — welcome to the bay', 4000);
  }
  function stageTitle() {
    // Title screen framing: player car on the strip, sun low, city behind.
    G.cars.teleportCar(0, 60, Math.PI);
    G.player.car = G.cars.playerCar;
    G.player.mesh.visible = false;
    G.player.x = 0; G.player.z = 60; G.player.heading = Math.PI;
    G.police.setStars(0);
    G.cam.applyPose({ pos: [-14, 6, 40], look: [0, 2, 60] });
    const title = document.getElementById('title-screen');
    if (title) title.classList.add('show');
    G.display.showMsg('PORTO VELA', 5000);
  }
  const api = {
    apply(name) {
      G.cam.releasePose();
      freezePolice(false);
      const dlg = document.getElementById('dialogue');
      if (dlg) dlg.classList.remove('shot-mission');
      const title = document.getElementById('title-screen');
      if (title) title.classList.remove('show');
      if (name === 'chase') stageChase();
      else if (name === 'mission') stageMission();
      else if (name === 'cover') stageCover();
      else if (name === 'title') stageTitle();
    },
  };
  return api;
}
