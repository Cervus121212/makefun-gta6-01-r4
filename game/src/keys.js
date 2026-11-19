// Keyboard + mouse state. Synthetic input (for the autopilot) goes through the
// same setKey() path as real events, so tests exercise the real input code.
export function createKeys() {
  const down = new Set();
  const mouse = { x: 0, y: 0, down: false, dragging: false, dx: 0, dy: 0, clicked: false };
  let attached = false;

  const api = {
    down,
    mouse,
    isDown: (code) => down.has(code),
    setKey: (code, on) => { if (on) down.add(code); else down.delete(code); },
    // Forward/strafe axis from WASD + arrows. Returns { f: -1..1, s: -1..1 }.
    axis() {
      let f = 0, s = 0;
      if (down.has('KeyW') || down.has('ArrowUp')) f += 1;
      if (down.has('KeyS') || down.has('ArrowDown')) f -= 1;
      if (down.has('KeyA') || down.has('ArrowLeft')) s -= 1;
      if (down.has('KeyD') || down.has('ArrowRight')) s += 1;
      return { f, s };
    },
    press(code) { // one-frame synthetic press (keydown + keyup on next tick)
      down.add(code);
      setTimeout(() => down.delete(code), 50);
    },
    attach(canvas) {
      if (attached) return;
      attached = true;
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        down.add(e.code);
      });
      window.addEventListener('keyup', (e) => down.delete(e.code));
      window.addEventListener('blur', () => down.clear());
      canvas.addEventListener('mousedown', (e) => { mouse.down = true; mouse.clicked = true; mouse.x = e.clientX; mouse.y = e.clientY; });
      window.addEventListener('mouseup', () => { mouse.down = false; mouse.dragging = false; });
      window.addEventListener('mousemove', (e) => {
        if (mouse.down) {
          mouse.dragging = true;
          mouse.dx += e.movementX || 0;
          mouse.dy += e.movementY || 0;
        }
        mouse.x = e.clientX; mouse.y = e.clientY;
      });
    },
  };
  return api;
}
