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
/** Crouched, the marine's top drops to row 23, so his box is 10 px shorter (M2.2). */
export const PLAYER_CROUCH_BODY = { width: 16, height: 25, offsetX: 27, offsetY: 23 } as const;

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
  /**
   * Double jump (M2.8): jumps allowed in mid-air before landing again, and their launch speed.
   * 251² / 1800 = 35 px, about 70% of a ground jump.
   */
  airJumps: 1,
  airJumpSpeed: 251,
} as const;

/**
 * The default rifle (M1.5). One shot per press (owner request, issue #21): holding fire doesn't
 * keep firing. The machine-gun pickup (M4.1) will set autoFire.
 */
export const WEAPON = {
  autoFire: false,
  /** Time between shots while fire is held, for weapons with autoFire. */
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
 * The diagonal-aim sheets' tips are generated with the art (src/assets/aimMuzzles.generated.ts).
 */
export const MUZZLE = {
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
  crouch: [
    [56, 23],
    [57, 29],
    [58, 32],
  ],
  'crouch-shoot': [
    [57, 32],
    [58, 32],
  ],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;

/** Where the barrel tip sits inside the 22×16 muzzle-flash frame. */
export const MUZZLE_FLASH_ANCHOR = { x: 6, y: 7 } as const;
/**
 * The same point in the 24×24 diagonal flash: the 22×16 frame is centred at (1, 4) and turned
 * 45° up about (12, 12), which moves (7, 11) to about (8, 15).
 */
export const MUZZLE_FLASH_DIAG_ANCHOR = { x: 8, y: 15 } as const;

/** Enemies flash white for this long when hit (M1.6). */
export const HIT_FLASH_MS = 70;
/** Damage of one default-rifle bullet. */
export const RIFLE_DAMAGE = 1;

/** Dialogue cards and room transitions (M1.7). */
export const DIALOGUE_CARD = {
  /** Ignore continue presses for this long, so a held key doesn't skip the card. */
  inputDelayMs: 400,
  /** Camera fade between the level and the card. */
  fadeMs: 250,
  /**
   * Longest line (characters) and most lines a card may have, so text fits the box: the
   * text area is 210 px wide and Press Start 2P is 8 px a character.
   */
  maxLineChars: 26,
  maxLines: 3,
} as const;

/**
 * Player health, lives and respawning (M2.1; PROJECT.md: health bar + checkpoints).
 * Tuned with the owner in M2.6.
 */
export const HEALTH = {
  /** Hits per life (the health bar's pips). */
  maxHp: 4,
  /** Lives at the start of a level, including the current one. */
  lives: 3,
  /** After a hit the marine can't be hurt for this long, and blinks. */
  invulnerableMs: 1500,
  /** Blink rate while invulnerable. */
  blinkMs: 80,
  /** A hit knocks the marine back and up a little. */
  knockbackX: 120,
  knockbackY: -160,
  /** Controls are ignored for this long after a hit, so the knockback reads. */
  hitStunMs: 250,
  /** Time between dying and respawning (the die animation plays first). */
  respawnDelayMs: 1200,
  /** "GAME OVER" shows this long before the level restarts. */
  gameOverMs: 2500,
} as const;

/** Catwalks and pits (M2.4). */
export const PLATFORMS = {
  /** After down + jump on a catwalk, the marine passes through catwalks for this long. */
  dropThroughMs: 250,
  /** Below the bottom of the map by this much, the marine has fallen into a pit. */
  fallMargin: 8,
} as const;

/** Scoring (M2.9). Points per enemy are enemy data (src/data/enemies.ts). */
export const SCORING = {
  /** An extra life at each of these scores, as in Contra. */
  extraLifeAt: [20_000, 50_000],
} as const;

/** Lives the Konami code adds (M2.11). */
export const CHEAT_EXTRA_LIVES = 5;

/** Level banner when a section starts (M2.14): shown this long, then fades out. */
export const LEVEL_BANNER = { showMs: 1800, fadeMs: 400 } as const;
/** The double-jump ring under the marine's feet is squashed to this fraction of its height. */
export const AIR_JUMP_RING_SQUASH = 0.4;

/** Text (M3.9): Press Start 2P, the font Star Destroyer and the portal use, at its native size. */
export const FONT = {
  /** CSS font family, with a fallback while it loads or if it fails. */
  family: '"Press Start 2P", monospace',
  /** Native size: one pixel of the font per game pixel. */
  size: '8px',
  /** Twice native, for banners and GAME OVER. */
  large: '16px',
} as const;

/** Title screen (M3.10). */
export const TITLE = {
  /** Ignore presses this long after the screen appears, so a held key can't skip it. */
  inputDelayMs: 300,
  /** Fade into the first level. */
  fadeMs: 250,
  /** Where MORE GAMES goes: the games portal, one folder up from the game. */
  portalUrl: '../',
  /** How fast the corridor drifts behind the title, in px/s. */
  scrollSpeed: 6,
  /** The game's name, at four times the font's native size. */
  logoSize: '32px',
} as const;

/** Boss fights (M3.2). Each boss's own numbers are data in src/data/bosses.ts. */
export const BOSS_FIGHT = {
  /** Seed for the boss's random choices (where mortar shells land, explosion spots). */
  rngSeed: 1803,
  /** After the boss's last explosion, the level ends this much later. */
  finishDelayMs: 1500,
  /** Mortar landing markers blink at this rate. */
  markerBlinkMs: 120,
} as const;

/** Phone touch controls (M3.11). Sizes are in the page's CSS (src/style.css). */
export const TOUCH = {
  /** The stick counts as pushed past this share of its radius. */
  stickDeadzone: 0.3,
  /** The knob follows the thumb up to this share of the stick's radius. */
  knobTravel: 0.55,
} as const;
