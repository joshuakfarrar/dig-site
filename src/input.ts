import type { Controls } from "./guide";
import * as Touch from "./touch";

/**
 * Keyboard, gamepad and touch, read once a frame. The stick (or WASD / arrows) points where to go on
 * screen; Work (Space / Enter / pad A) does the machine's job; Hop (E / pad Y or X) jumps into the
 * machine you're next to; holding R (pad Start) works the corner button. Like Kickstack's Pad, sticks have a radial dead zone.
 * On a touch screen, `touch.ts` puts a stick and the two buttons on screen.
 */
export interface Frame {
  moveX: number; // right +
  moveY: number; // up the screen +
  work: boolean; // held
  workPressed: boolean; // went down this frame
  hopPressed: boolean;
  restartPressed: boolean;
  restart: boolean; // held: the corner button's hold-to-confirm
}

const keys = new Set<string>();
const pressed = new Set<string>();
let using: Controls = "keys";
function use(c: Controls): void {
  if (using === c) return;
  using = c;
  Touch.show(c === "touch");
}
Touch.onTouched(() => use("touch"));
const lastPadButtons: boolean[] = [];

addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  pressed.add(e.code);
  use("keys");
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

const DEAD = 0.2;
function deadZone(x: number, y: number): [number, number] {
  const m = Math.hypot(x, y);
  if (m < DEAD) return [0, 0];
  const s = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return [x * s, y * s];
}

/** Whichever was used last: keys, pad or touch. The prompts show that one's buttons. */
export function controls(): Controls {
  return using;
}

/** Lets the touch buttons show what's possible right now (Work glows, Hop appears). */
export function hints(work: boolean, hop: boolean): void {
  Touch.hints(work, hop);
}

export function read(): Frame {
  const k = (c: string) => keys.has(c);
  const p = (c: string) => pressed.has(c);
  let mx = (k("KeyD") || k("ArrowRight") ? 1 : 0) - (k("KeyA") || k("ArrowLeft") ? 1 : 0);
  let my = (k("KeyW") || k("ArrowUp") ? 1 : 0) - (k("KeyS") || k("ArrowDown") ? 1 : 0);
  if (mx !== 0 && my !== 0) {
    mx *= Math.SQRT1_2;
    my *= Math.SQRT1_2;
  }
  let work = k("Space") || k("Enter");
  let workPressed = p("Space") || p("Enter");
  let hopPressed = p("KeyE");
  let restartPressed = p("KeyR");
  let restart = k("KeyR");

  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad || !pad.connected) continue;
    const btn = (i: number) => i < pad.buttons.length && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);
    const down = (i: number) => btn(i) && !lastPadButtons[i];
    const [sx, sy] = deadZone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const dx = (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0);
    const dy = (btn(12) ? 1 : 0) - (btn(13) ? 1 : 0);
    const any = sx !== 0 || sy !== 0 || dx !== 0 || dy !== 0 || pad.buttons.some((b) => b.pressed);
    if (any) use("pad");
    if (sx !== 0 || sy !== 0) {
      mx = sx;
      my = -sy;
    } else if (dx !== 0 || dy !== 0) {
      const n = Math.hypot(dx, dy);
      mx = dx / n;
      my = dy / n;
    }
    work ||= btn(0);
    workPressed ||= down(0);
    hopPressed ||= down(3) || down(2);
    restartPressed ||= down(9);
    restart ||= btn(9);
    for (let i = 0; i < pad.buttons.length; i++) lastPadButtons[i] = btn(i);
    break; // the first pad plays
  }
  pressed.clear();
  const t = Touch.read();
  if (t.moveX !== 0 || t.moveY !== 0) {
    mx = t.moveX;
    my = t.moveY;
  }
  work ||= t.work;
  workPressed ||= t.workPressed;
  hopPressed ||= t.hopPressed;
  return { moveX: mx, moveY: my, work, workPressed, hopPressed, restartPressed, restart };
}
