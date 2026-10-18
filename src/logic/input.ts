/**
 * Maps pressed keys to game actions (ARCHITECTURE.md ADR-C07). Game code reads actions only.
 * Keys are KeyboardEvent.code values, so the layout works on any keyboard language.
 * Gamepad buttons join this in M2.3.
 */
export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'pause'] as const;
export type Action = (typeof ACTIONS)[number];
export type ActionState = Readonly<Record<Action, boolean>>;
export type Bindings = Readonly<Record<Action, readonly string[]>>;

/** Default keys (owner reviews the layout in the M1/M2 play-tests). */
export const DEFAULT_KEY_BINDINGS: Bindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ', 'KeyK'],
  fire: ['KeyX', 'KeyJ'],
  pause: ['Escape', 'KeyP'],
};

/**
 * Every key the game listens to, so the page doesn't also scroll on arrows or Space.
 * F (fullscreen) is handled outside the action layer: see src/systems/Fullscreen.ts.
 */
export function boundKeys(bindings: Bindings): string[] {
  return [...new Set(ACTIONS.flatMap((a) => bindings[a]))];
}

export function actionsFromKeys(pressed: ReadonlySet<string>, bindings: Bindings): ActionState {
  const state = {} as Record<Action, boolean>;
  for (const action of ACTIONS) state[action] = bindings[action].some((k) => pressed.has(k));
  return state;
}

/** -1 for left, 1 for right, 0 for neither or both. */
export function horizontalDirection(actions: ActionState): -1 | 0 | 1 {
  if (actions.left === actions.right) return 0;
  return actions.left ? -1 : 1;
}

/** Phaser key name for a KeyboardEvent.code (e.g. 'ArrowLeft' → 'LEFT', 'KeyA' → 'A'). */
export function phaserKeyName(code: string): string {
  if (code.startsWith('Arrow')) return code.slice('Arrow'.length).toUpperCase();
  if (code.startsWith('Key')) return code.slice('Key'.length);
  if (code === 'Escape') return 'ESC';
  return code.toUpperCase();
}

/** Held actions plus actions newly pressed since the previous frame. */
export interface ActionFrame {
  held: ActionState;
  pressed: ActionState;
}

/**
 * Tracks key events between frames (by KeyboardEvent.code) and turns them into an ActionFrame.
 * - A key pressed and released between two frames still counts as held for the next frame.
 * - A key released and pressed again between two frames still counts as a new press.
 * - Auto-repeat key events don't count as new presses.
 */
export class KeyLatch {
  private readonly held = new Set<string>();
  private readonly pressedSinceFrame = new Set<string>();

  keyDown(code: string, repeat = false): void {
    this.held.add(code);
    if (!repeat) this.pressedSinceFrame.add(code);
  }

  keyUp(code: string): void {
    this.held.delete(code);
  }

  /** Forget everything (e.g. the window lost focus), so no key stays stuck down. */
  clear(): void {
    this.held.clear();
    this.pressedSinceFrame.clear();
  }

  /** The actions for this frame. Call once per frame. */
  frame(bindings: Bindings): ActionFrame {
    const pressed = actionsFromKeys(this.pressedSinceFrame, bindings);
    const held = actionsFromKeys(new Set([...this.held, ...this.pressedSinceFrame]), bindings);
    this.pressedSinceFrame.clear();
    return { held, pressed };
  }
}

export const NO_ACTIONS: ActionState = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  fire: false,
  pause: false,
};

/** A gamepad's state this frame: which buttons are down and where the sticks are. */
export interface PadState {
  buttons: readonly boolean[];
  axes: readonly number[];
}

export interface PadBindings {
  buttons: Readonly<Record<Action, readonly number[]>>;
  /** The left stick moves and aims past this much tilt (0–1). */
  stickDeadzone: number;
}

/**
 * Standard-mapping gamepad (ADR-C07): A jumps, X or B fires, Start pauses, the d-pad and the
 * left stick move, aim up and crouch. Indexes follow the W3C "standard" gamepad layout.
 */
export const DEFAULT_PAD_BINDINGS: PadBindings = {
  buttons: {
    left: [14],
    right: [15],
    up: [12],
    down: [13],
    jump: [0],
    fire: [2, 1],
    pause: [9],
  },
  stickDeadzone: 0.5,
};

export function actionsFromPad(pad: PadState, bindings: PadBindings): ActionState {
  const state = {} as Record<Action, boolean>;
  for (const action of ACTIONS) {
    state[action] = bindings.buttons[action].some((i) => pad.buttons[i] === true);
  }
  const [x = 0, y = 0] = pad.axes;
  const dz = bindings.stickDeadzone;
  if (x <= -dz) state.left = true;
  if (x >= dz) state.right = true;
  if (y <= -dz) state.up = true;
  if (y >= dz) state.down = true;
  return state;
}

/** Turns per-frame gamepad state into an ActionFrame (a press is held now but not last frame). */
export class PadLatch {
  private previous: ActionState = NO_ACTIONS;
  private ignoreHeld = false;

  frame(pad: PadState | null, bindings: PadBindings): ActionFrame {
    const held = pad ? actionsFromPad(pad, bindings) : NO_ACTIONS;
    // After clear(), buttons already down count as seen: they press again only after release.
    const prev = this.ignoreHeld ? held : this.previous;
    this.ignoreHeld = false;
    const pressed = {} as Record<Action, boolean>;
    for (const action of ACTIONS) pressed[action] = held[action] && !prev[action];
    this.previous = held;
    return { held, pressed };
  }

  /**
   * Start over, e.g. when a scene resumes: a button still held from before (such as the
   * Start press that closed the pause menu) is not a new press.
   */
  clear(): void {
    this.ignoreHeld = true;
  }
}

/** Keyboard and gamepad together: an action is held or pressed if either says so. */
export function mergeFrames(a: ActionFrame, b: ActionFrame): ActionFrame {
  const held = {} as Record<Action, boolean>;
  const pressed = {} as Record<Action, boolean>;
  for (const action of ACTIONS) {
    held[action] = a.held[action] || b.held[action];
    pressed[action] = a.pressed[action] || b.pressed[action];
  }
  return { held, pressed };
}
