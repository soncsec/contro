/**
 * Every image the game loads, with its frame layout (ARCHITECTURE.md ADR-C04).
 * Files are built from legacy/ by tools/art/build_assets.py and credited in CREDITS.md.
 * tests/unit/manifest.test.ts checks these numbers against the real PNG files.
 */
export const ASSET_GROUPS = ['player', 'enemies', 'effects', 'portraits', 'levels'] as const;
export type AssetGroup = (typeof ASSET_GROUPS)[number];

export interface SheetAsset {
  kind: 'sheet';
  key: string;
  group: AssetGroup;
  /** Path under public/, e.g. assets/player/marine-run.png */
  path: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  /** Default animation speed in frames per second. */
  frameRate: number;
  /** Whether the default animation loops. */
  loop: boolean;
}

export interface ImageAsset {
  kind: 'image';
  key: string;
  group: AssetGroup;
  path: string;
  width: number;
  height: number;
}

export type Asset = SheetAsset | ImageAsset;

const sheet = (
  group: AssetGroup,
  key: string,
  file: string,
  frameWidth: number,
  frameHeight: number,
  frames: number,
  frameRate: number,
  loop: boolean,
): SheetAsset => ({
  kind: 'sheet',
  key,
  group,
  path: `assets/${group}/${file}`,
  frameWidth,
  frameHeight,
  frames,
  frameRate,
  loop,
});

const image = (
  group: AssetGroup,
  key: string,
  file: string,
  width: number,
  height: number,
): ImageAsset => ({ kind: 'image', key, group, path: `assets/${group}/${file}`, width, height });

export const ASSETS: readonly Asset[] = [
  // Space marine (75×48 frames; the body sits left of centre, the gun points right)
  sheet('player', 'marine-idle', 'marine-idle.png', 75, 48, 4, 6, true),
  sheet('player', 'marine-run', 'marine-run.png', 75, 48, 10, 14, true),
  sheet('player', 'marine-jump', 'marine-jump.png', 75, 48, 5, 10, false),
  sheet('player', 'marine-shoot', 'marine-shoot.png', 75, 48, 2, 12, true),
  sheet('player', 'marine-crouch', 'marine-crouch.png', 75, 48, 3, 20, false),
  sheet('player', 'marine-crouch-shoot', 'marine-crouch-shoot.png', 75, 48, 2, 12, true),
  sheet('player', 'marine-die', 'marine-die.png', 75, 48, 3, 8, false),
  // Derived: arms and rifle raised 45° (tools/art/aim.py)
  sheet('player', 'marine-aim-diag', 'marine-aim-diag.png', 75, 48, 4, 6, true),
  sheet('player', 'marine-shoot-diag', 'marine-shoot-diag.png', 75, 48, 2, 12, true),
  sheet('player', 'marine-run-diag', 'marine-run-diag.png', 75, 48, 10, 14, true),

  // Enemies (the walker faces left in the art)
  sheet('enemies', 'alien-walker-idle', 'alien-walker-idle.png', 48, 48, 4, 6, true),
  sheet('enemies', 'alien-walker-walk', 'alien-walker-walk.png', 57, 42, 6, 10, true),
  sheet('enemies', 'alien-flyer', 'alien-flyer.png', 83, 64, 8, 12, true),

  // Effects
  sheet('effects', 'bullet', 'bullet.png', 10, 4, 2, 12, true),
  sheet('effects', 'muzzle-flash', 'muzzle-flash.png', 22, 16, 2, 20, false),
  sheet('effects', 'muzzle-flash-diag', 'muzzle-flash-diag.png', 24, 24, 2, 20, false),
  sheet('effects', 'bullet-diag', 'bullet-diag.png', 10, 10, 2, 12, true),
  sheet('effects', 'enemy-shot', 'enemy-shot.png', 16, 16, 2, 8, true),
  sheet('effects', 'wall-impact', 'wall-impact.png', 16, 23, 2, 14, false),
  sheet('effects', 'enemy-death', 'enemy-death.png', 48, 48, 8, 14, false),
  sheet('effects', 'hit', 'hit.png', 31, 32, 3, 14, false),
  // Double jump: an expanding ring, squashed flat under the marine's feet
  sheet('effects', 'air-jump-ring', 'air-jump-ring.png', 52, 48, 6, 24, false),

  // Speaker portraits for dialogue cards (48×48, with background)
  image('portraits', 'portrait-commander', 'commander.png', 48, 48),
  image('portraits', 'portrait-ops', 'ops.png', 48, 48),
  image('portraits', 'portrait-marine', 'marine.png', 48, 48),
  image('portraits', 'portrait-hive', 'hive.png', 48, 48),

  // Level art: cyberpunk corridor
  image('levels', 'corridor-back', 'corridor/back.png', 192, 176),
  image('levels', 'corridor-foreground', 'corridor/foreground.png', 272, 176),
  image('levels', 'corridor-tileset', 'corridor/tileset.png', 512, 608),
  // Drawn by Claude: catwalks and pit edges in the corridor's colours (tools/art/catwalk.py)
  image('levels', 'corridor-catwalk', 'corridor/catwalk.png', 48, 48),
];

/** Key of a sheet's default animation. */
export const animKey = (sheetKey: string): string => `${sheetKey}:anim`;

/** A Tiled level map and the image key of each tileset it embeds. */
export interface LevelAsset {
  key: string;
  /** Path under public/, e.g. assets/levels/corridor-test.tmj */
  path: string;
  /** Tileset name inside the map → image key in ASSETS. */
  tilesets: Readonly<Record<string, string>>;
}

export const LEVELS: readonly LevelAsset[] = [
  {
    key: 'corridor-test',
    path: 'assets/levels/corridor-test.tmj',
    tilesets: { corridor: 'corridor-tileset', catwalk: 'corridor-catwalk' },
  },
  {
    key: 'corridor-test-2',
    path: 'assets/levels/corridor-test-2.tmj',
    tilesets: { corridor: 'corridor-tileset', catwalk: 'corridor-catwalk' },
  },
];
