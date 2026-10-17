/**
 * Every gameplay and display number lives here (CLAUDE.md: no magic numbers in scenes).
 */

/** Internal resolution in art pixels (ARCHITECTURE.md ADR-C05; confirmed in M1.2). */
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 176;

/** Page and canvas background. */
export const BACKGROUND_COLOR = '#07060d';

/** World gravity in px/s² (tuned with the owner in M2.6). */
export const GRAVITY_Y = 900;

/**
 * The marine's physics box inside its 75×48 frame, measured from the art:
 * the torso spans x 27–43 and the feet touch row 47 in every animation.
 */
export const PLAYER_FRAME = { width: 75, height: 48 } as const;
export const PLAYER_BODY = { width: 16, height: 34, offsetX: 27, offsetY: 14 } as const;

/** How fast the far background scrolls compared with the level (0 = fixed, 1 = with the level). */
export const PARALLAX_BACK_FACTOR = 0.25;

/**
 * Player movement (M1.4; tuned with the owner in M2.6).
 * Running has no acceleration, like Contra: full speed at once, stop at once.
 * Jump apex = JUMP_SPEED² / (2 × GRAVITY_Y) = 300² / 1800 = 50 px, about one marine tall.
 */
export const MOVEMENT = {
  runSpeed: 90,
  jumpSpeed: 300,
  /** A jump still works this long after running off a ledge. */
  coyoteMs: 90,
  /** A jump pressed this long before landing still happens on landing. */
  jumpBufferMs: 110,
  /** Releasing jump while rising multiplies upward speed by this (short hops). */
  jumpCutFactor: 0.5,
  /** Longest frame step used by the movement rules, so a stall can't cause a huge jump. */
  maxStepMs: 50,
} as const;

/** The default rifle (M1.5). Tap to fire faster than holding, like Contra. */
export const WEAPON = {
  /** Time between shots while fire is held. */
  autoIntervalMs: 160,
  /** Shortest time between shots when fire is tapped. */
  tapMinMs: 90,
  bulletSpeed: 300,
  /** Most bullets on screen at once (the pool size). */
  maxBullets: 8,
  /** Bullets are removed once this far outside the camera view. */
  offscreenMargin: 16,
} as const;

/**
 * Barrel tip in each frame of each marine animation, as [x, y] inside the 75×48 frame
 * (facing right), measured from the art. Bullets and the muzzle flash start here.
 */
export const MUZZLE: Readonly<
  Record<'idle' | 'run' | 'jump' | 'shoot', readonly (readonly [number, number])[]>
> = {
  idle: [
    [56, 23],
    [55, 24],
    [54, 25],
    [55, 24],
  ],
  run: [
    [58, 29],
    [57, 30],
    [56, 28],
    [55, 28],
    [55, 27],
    [54, 28],
    [56, 31],
    [57, 30],
    [57, 30],
    [58, 29],
  ],
  jump: [
    [56, 23],
    [55, 21],
    [55, 25],
    [54, 31],
    [56, 36],
  ],
  shoot: [
    [54, 23],
    [55, 23],
  ],
};

/** Where the barrel tip sits inside the 22×16 muzzle-flash frame. */
export const MUZZLE_FLASH_ANCHOR = { x: 6, y: 7 } as const;

/** Enemies flash white for this long when hit (M1.6). */
export const HIT_FLASH_MS = 70;
/** Damage of one default-rifle bullet. */
export const RIFLE_DAMAGE = 1;
