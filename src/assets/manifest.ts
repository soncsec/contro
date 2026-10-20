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
  // M5.6: the marine seen from behind in base rooms: standing, two running steps, crouching
  sheet('player', 'marine-back', 'marine-back.png', 22, 38, 4, 8, true),
  // Derived: arms and rifle raised 45° (tools/art/aim.py)
  sheet('player', 'marine-aim-diag', 'marine-aim-diag.png', 75, 48, 4, 6, true),
  sheet('player', 'marine-shoot-diag', 'marine-shoot-diag.png', 75, 48, 2, 12, true),
  sheet('player', 'marine-run-diag', 'marine-run-diag.png', 75, 48, 10, 14, true),
  // Derived: arms and rifle lowered 45° while running (M3.13)
  sheet('player', 'marine-run-down', 'marine-run-down.png', 75, 48, 10, 14, true),

  // Enemies (the walker faces left in the art)
  sheet('enemies', 'alien-walker-idle', 'alien-walker-idle.png', 48, 48, 4, 6, true),
  sheet('enemies', 'alien-walker-walk', 'alien-walker-walk.png', 57, 42, 6, 10, true),
  sheet('enemies', 'alien-flyer', 'alien-flyer.png', 83, 64, 8, 12, true),
  // M4.1: the weapon blimp (drawn by Claude), propellers turning
  sheet('enemies', 'blimp', 'blimp.png', 84, 40, 2, 12, true),
  // The same, flying left (drawn mirrored, so its number still reads the right way round)
  sheet('enemies', 'blimp-left', 'blimp-left.png', 84, 40, 2, 12, true),
  // Level 1 boss (M3.3): the tank's treads roll through 4 frames
  sheet('enemies', 'tank', 'tank.png', 128, 64, 4, 10, true),
  // M4.2: the bipedal walker (faces right in the art), 7 walk frames
  sheet('enemies', 'bipedal-walk', 'bipedal-walk.png', 80, 64, 7, 8, true),
  // M5.1: the spitting snake (Level 3): idle, then rearing back and striking as it spits
  sheet('enemies', 'snake-idle', 'snake-idle.png', 36, 21, 4, 6, true),
  sheet('enemies', 'snake-strike', 'snake-strike.png', 36, 21, 4, 10, false),
  sheet('effects', 'snake-spit', 'snake-spit.png', 7, 5, 2, 12, true),
  // M4.4: the Level 2 boss, the mech, 10 walk frames
  sheet('enemies', 'mech', 'mech.png', 96, 80, 10, 10, true),

  // Effects
  sheet('effects', 'bullet', 'bullet.png', 10, 4, 2, 12, true),
  sheet('effects', 'muzzle-flash', 'muzzle-flash.png', 22, 16, 2, 20, false),
  sheet('effects', 'muzzle-flash-diag', 'muzzle-flash-diag.png', 24, 24, 2, 20, false),
  sheet('effects', 'bullet-diag', 'bullet-diag.png', 10, 10, 2, 12, true),
  sheet('effects', 'enemy-shot', 'enemy-shot.png', 16, 16, 2, 8, true),
  // M4.1: weapon pickups, the letter itself (drawn by Claude)
  image('effects', 'pickup-machine-gun', 'pickup-machine-gun.png', 20, 20),
  image('effects', 'pickup-spread', 'pickup-spread.png', 20, 20),
  // Health: a red cross in the same style (owner chose it 2026-10-19)
  image('effects', 'pickup-health', 'pickup-health.png', 20, 20),
  sheet('effects', 'enemy-death', 'enemy-death.png', 48, 48, 8, 14, false),
  sheet('effects', 'hit', 'hit.png', 31, 32, 3, 14, false),
  sheet('effects', 'ground-explosion', 'ground-explosion.png', 112, 128, 9, 14, false),
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
  // Level 2: cyberpunk props on a 16 px grid (tools/art/props.py)
  image('levels', 'corridor-props', 'corridor/props.png', 192, 96),
  // Level 1 art: industrial skyline (parallax, back to front) and the steelworks tileset
  image('levels', 'industrial-sky', 'industrial/sky.png', 272, 160),
  image('levels', 'industrial-far', 'industrial/far.png', 213, 142),
  image('levels', 'industrial-mid', 'industrial/mid.png', 272, 150),
  image('levels', 'industrial-near', 'industrial/near.png', 272, 104),
  image('levels', 'steelworks-tileset', 'steelworks/tileset.png', 352, 368),
  // Level 1 rust factory rooms (option C, for variety)
  image('levels', 'rust-tileset', 'rust/tileset.png', 288, 368),
  // Level 2, the Neon District (owner chose option A, 2026-10-19): tileset and Synth City skyline
  image('levels', 'neon-tileset', 'neon/tileset.png', 320, 368),
  image('levels', 'neon-sky', 'neon/sky.png', 288, 192),
  image('levels', 'neon-buildings', 'neon/buildings.png', 288, 192),
  image('levels', 'neon-front', 'neon/front.png', 288, 192),
  // Level 3, the alien base (owner chose "into the hive", 2026-10-20): tileset and back wall
  image('levels', 'alien-tileset', 'alien/tileset.png', 320, 368),
  image('levels', 'alien-back', 'alien/back.png', 192, 176),
  image('levels', 'alien-structures', 'alien/structures.png', 416, 176),
  // M5.6: the into-the-screen base room (ADR-C11): the room, its core and electric barrier
  image('levels', 'base-room', 'base/room.png', 320, 176),
  sheet('levels', 'base-core', 'base/core.png', 28, 28, 2, 4, true),
  sheet('levels', 'base-barrier', 'base/barrier.png', 96, 72, 2, 8, true),
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
  /** Only loaded in the e2e build (the training corridor test rooms). */
  testOnly?: boolean;
}

export const LEVELS: readonly LevelAsset[] = [
  {
    key: 'corridor-test',
    path: 'assets/levels/corridor-test.tmj',
    tilesets: { corridor: 'corridor-tileset', catwalk: 'corridor-catwalk' },
    testOnly: true,
  },
  {
    key: 'corridor-test-2',
    path: 'assets/levels/corridor-test-2.tmj',
    tilesets: { corridor: 'corridor-tileset', catwalk: 'corridor-catwalk' },
    testOnly: true,
  },
  {
    key: 'steelworks-1',
    path: 'assets/levels/steelworks-1.tmj',
    tilesets: { steelworks: 'steelworks-tileset' },
  },
  {
    key: 'steelworks-2',
    path: 'assets/levels/steelworks-2.tmj',
    tilesets: { steelworks: 'steelworks-tileset' },
  },
  {
    key: 'steelworks-3',
    path: 'assets/levels/steelworks-3.tmj',
    tilesets: { rust: 'rust-tileset' },
  },
  {
    key: 'steelworks-4',
    path: 'assets/levels/steelworks-4.tmj',
    tilesets: { steelworks: 'steelworks-tileset' },
  },
  {
    key: 'steelworks-5',
    path: 'assets/levels/steelworks-5.tmj',
    tilesets: { rust: 'rust-tileset' },
  },
  {
    key: 'neon-1',
    path: 'assets/levels/neon-1.tmj',
    tilesets: { neon: 'neon-tileset' },
  },
  {
    key: 'neon-2',
    path: 'assets/levels/neon-2.tmj',
    tilesets: {
      corridor: 'corridor-tileset',
      catwalk: 'corridor-catwalk',
      props: 'corridor-props',
    },
  },
  {
    key: 'neon-3',
    path: 'assets/levels/neon-3.tmj',
    tilesets: { neon: 'neon-tileset' },
  },
  {
    key: 'neon-4',
    path: 'assets/levels/neon-4.tmj',
    tilesets: { neon: 'neon-tileset' },
  },
  {
    key: 'neon-5',
    path: 'assets/levels/neon-5.tmj',
    tilesets: {
      corridor: 'corridor-tileset',
      catwalk: 'corridor-catwalk',
      props: 'corridor-props',
    },
  },
  {
    key: 'hive-1',
    path: 'assets/levels/hive-1.tmj',
    tilesets: { alien: 'alien-tileset' },
  },
  {
    key: 'hive-2',
    path: 'assets/levels/hive-2.tmj',
    tilesets: { alien: 'alien-tileset' },
  },
];

/**
 * Sound effects and music (M3.6; ARCHITECTURE.md ADR-C06). Each is an OGG file, plus an M4A
 * copy for iPhone Safari; the browser picks the one it can play. Built from the owner-approved
 * CC0 packs by tools/audio/build_audio.py and credited in CREDITS.md.
 */
export const SOUND_KEYS = [
  'sfx-shot',
  'sfx-enemy-hit',
  'sfx-enemy-die',
  'sfx-hurt',
  'sfx-player-die',
  'sfx-enemy-shot',
  'sfx-cannon',
  'sfx-mortar',
  'sfx-blast',
  'sfx-boss-blast',
  'sfx-extra-life',
  'sfx-blip',
  'sfx-select',
  'music-level-1',
  'music-level-2',
  'music-boss',
] as const;
export type SoundKey = (typeof SOUND_KEYS)[number];
export type MusicKey = Extract<SoundKey, `music-${string}`>;

export interface SoundAsset {
  key: SoundKey;
  /** Paths under public/, OGG first. */
  paths: readonly string[];
  music: boolean;
}

export const SOUNDS: readonly SoundAsset[] = SOUND_KEYS.map((key) => ({
  key,
  paths: [`assets/audio/${key}.ogg`, `assets/audio/${key}.m4a`],
  music: key.startsWith('music-'),
}));
