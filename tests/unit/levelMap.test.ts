import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSETS, LEVELS } from '../../src/assets/manifest';
import { ENEMY_TYPES } from '../../src/data/enemies';
import { readLevelLayout, validateLevelMap } from '../../src/logic/levelMap';

const PUBLIC_DIR = `${process.cwd()}/public`;
const readJson = (path: string): unknown =>
  JSON.parse(new TextDecoder().decode(readFileSync(path))) as unknown;

/** A small valid map: 4×11 tiles, one solid floor, a start, an enemy and an exit. */
function sampleMap(): Record<string, unknown> {
  return {
    orientation: 'orthogonal',
    infinite: false,
    width: 4,
    height: 11,
    tilewidth: 16,
    tileheight: 16,
    properties: [{ name: 'background', type: 'string', value: 'corridor-back' }],
    tilesets: [
      {
        firstgid: 1,
        name: 'corridor',
        image: 'corridor/tileset.png',
        imagewidth: 32,
        imageheight: 32,
        tilewidth: 16,
        tileheight: 16,
        tilecount: 4,
        columns: 2,
      },
    ],
    layers: [
      { type: 'tilelayer', name: 'background', width: 4, height: 11, data: Array(44).fill(1) },
      {
        type: 'objectgroup',
        name: 'collision',
        objects: [{ type: 'solid', x: 0, y: 160, width: 64, height: 16 }],
      },
      {
        type: 'objectgroup',
        name: 'spawns',
        objects: [
          { type: 'player-start', point: true, x: 8, y: 160 },
          {
            type: 'enemy',
            point: true,
            x: 40,
            y: 160,
            properties: [{ name: 'enemy', value: 'alien-walker' }],
          },
          { type: 'checkpoint', point: true, x: 32, y: 160 },
          { type: 'exit', x: 48, y: 96, width: 16, height: 64 },
        ],
      },
    ],
  };
}

type Layer = { name: string; objects?: Record<string, unknown>[]; data?: unknown[] | undefined };
const layer = (map: Record<string, unknown>, name: string): Layer =>
  (map['layers'] as Layer[]).find((l) => l.name === name) as Layer;

describe('level maps in public/assets', () => {
  it.each(LEVELS)('$key is valid', (level) => {
    expect(validateLevelMap(readJson(`${PUBLIC_DIR}/${level.path}`), ENEMY_TYPES)).toEqual([]);
  });

  it.each(LEVELS)('$key: each tileset is an image asset at the same file', (level) => {
    const map = readJson(`${PUBLIC_DIR}/${level.path}`) as {
      tilesets: { name: string; image: string }[];
    };
    const folder = level.path.slice(0, level.path.lastIndexOf('/') + 1);
    for (const ts of map.tilesets) {
      const key = level.tilesets[ts.name];
      const asset = ASSETS.find((a) => a.key === key);
      expect(asset?.kind).toBe('image');
      expect(asset?.path).toBe(`${folder}${ts.image}`);
    }
  });

  it.each(LEVELS)('$key fills the screen height (176 px)', (level) => {
    const layout = readLevelLayout(readJson(`${PUBLIC_DIR}/${level.path}`), ENEMY_TYPES);
    expect(layout.heightPx).toBe(176);
  });
});

describe('validateLevelMap', () => {
  it('accepts a valid map', () => {
    expect(validateLevelMap(sampleMap(), ENEMY_TYPES)).toEqual([]);
  });

  it('rejects things that are not maps', () => {
    expect(validateLevelMap(null, ENEMY_TYPES)).toEqual(['map is not a JSON object']);
    expect(validateLevelMap([], ENEMY_TYPES)).toEqual(['map is not a JSON object']);
  });

  it('checks the map header', () => {
    const map = { ...sampleMap(), orientation: 'isometric', infinite: true, tilewidth: 32 };
    expect(validateLevelMap(map, ENEMY_TYPES)).toEqual([
      'orientation must be orthogonal',
      'map must be finite (not infinite)',
      'tiles must be 16×16',
    ]);
    expect(validateLevelMap({ ...sampleMap(), width: 0 }, ENEMY_TYPES)).toEqual([
      'width and height must be positive whole numbers of tiles',
    ]);
  });

  it('checks the tileset', () => {
    const msg =
      'tileset must be embedded, start at gid 1, use 16×16 tiles, and match its image size';
    expect(validateLevelMap({ ...sampleMap(), tilesets: [] }, ENEMY_TYPES)).toContain(
      'map must embed exactly one tileset',
    );
    const map = sampleMap();
    (map['tilesets'] as Record<string, unknown>[])[0] = { firstgid: 1, source: 'corridor.tsj' };
    expect(validateLevelMap(map, ENEMY_TYPES)).toContain(msg);
  });

  it('checks the background tile layer', () => {
    const missing = sampleMap();
    missing['layers'] = (missing['layers'] as Layer[]).filter((l) => l.name !== 'background');
    expect(validateLevelMap(missing, ENEMY_TYPES)).toContain('missing tile layer "background"');

    const short = sampleMap();
    layer(short, 'background').data = [1, 1];
    expect(validateLevelMap(short, ENEMY_TYPES)).toContain(
      'tile layer "background" has 2 tiles, expected 44',
    );

    const outside = sampleMap();
    layer(outside, 'background').data = Array(44).fill(5);
    expect(validateLevelMap(outside, ENEMY_TYPES)).toContain(
      'tile layer "background" uses tiles outside the tileset',
    );

    const compressed = sampleMap();
    layer(compressed, 'background').data = undefined;
    expect(validateLevelMap(compressed, ENEMY_TYPES)).toContain(
      'tile layer "background" must be uncompressed and cover the whole map',
    );
  });

  it('checks collision objects', () => {
    const noLayer = sampleMap();
    noLayer['layers'] = (noLayer['layers'] as Layer[]).filter((l) => l.name !== 'collision');
    expect(validateLevelMap(noLayer, ENEMY_TYPES)).toContain('missing object layer "collision"');

    const empty = sampleMap();
    layer(empty, 'collision').objects = [];
    expect(validateLevelMap(empty, ENEMY_TYPES)).toContain('collision layer is empty');

    const bad = sampleMap();
    layer(bad, 'collision').objects = [
      { type: 'lava', x: 0, y: 160, width: 64, height: 16 },
      { type: 'solid', x: 0, y: 170, width: 64, height: 16 },
      { type: 'platform', point: true, x: 10, y: 10 },
    ];
    expect(validateLevelMap(bad, ENEMY_TYPES)).toEqual([
      'collision object 1: type must be one of solid, platform',
      'collision object 2: must be a rectangle inside the map',
      'collision object 3: must be a rectangle inside the map',
    ]);
  });

  it('checks spawns', () => {
    const noLayer = sampleMap();
    noLayer['layers'] = (noLayer['layers'] as Layer[]).filter((l) => l.name !== 'spawns');
    expect(validateLevelMap(noLayer, ENEMY_TYPES)).toContain('missing object layer "spawns"');

    const bad = sampleMap();
    layer(bad, 'spawns').objects = [
      { type: 'player-start', x: 8, y: 160, width: 16, height: 16 },
      { type: 'player-start', point: true, x: 900, y: 160 },
      { type: 'enemy', x: 40, y: 100, width: 10, height: 10 },
      {
        type: 'enemy',
        point: true,
        x: 40,
        y: 160,
        properties: [{ name: 'enemy', value: 'dragon' }],
      },
      { type: 'exit', point: true, x: 48, y: 96 },
      { type: 'coin', point: true, x: 1, y: 1 },
      { type: 'checkpoint', x: 20, y: 100, width: 8, height: 8 },
    ];
    expect(validateLevelMap(bad, ENEMY_TYPES)).toEqual([
      'spawns need exactly one "player-start"',
      'spawn 1: player-start must be a point',
      'spawn 2: must be inside the map',
      'spawn 3: enemy must be a point',
      'spawn 3: unknown enemy type undefined',
      'spawn 4: unknown enemy type "dragon"',
      'spawn 5: exit must be a rectangle',
      'spawn 6: unknown spawn type "coin"',
      'spawn 7: checkpoint must be a point',
    ]);

    const noExit = sampleMap();
    layer(noExit, 'spawns').objects = [{ type: 'player-start', point: true, x: 8, y: 160 }];
    expect(validateLevelMap(noExit, ENEMY_TYPES)).toEqual(['spawns need exactly one "exit"']);
  });
});

describe('readLevelLayout', () => {
  it('extracts what the level scene needs', () => {
    expect(readLevelLayout(sampleMap(), ENEMY_TYPES)).toEqual({
      widthPx: 64,
      heightPx: 176,
      background: 'corridor-back',
      colliders: [{ type: 'solid', x: 0, y: 160, width: 64, height: 16 }],
      playerStart: { x: 8, y: 160 },
      checkpoints: [{ x: 32, y: 160 }],
      enemies: [{ x: 40, y: 160, enemy: 'alien-walker' }],
      exit: { x: 48, y: 96, width: 16, height: 64 },
    });
  });

  it('has no background when the property is missing', () => {
    const map = sampleMap();
    delete map['properties'];
    expect(readLevelLayout(map, ENEMY_TYPES).background).toBeNull();
  });

  it('throws on an invalid map', () => {
    expect(() => readLevelLayout({}, ENEMY_TYPES)).toThrow(/invalid level map/);
  });
});
