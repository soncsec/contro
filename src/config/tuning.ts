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
