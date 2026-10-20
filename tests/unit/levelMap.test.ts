import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSETS, LEVELS } from '../../src/assets/manifest';
import { BOSS_TYPES } from '../../src/data/bosses';
import { ENEMY_TYPES } from '../../src/data/enemies';
import { PICKUPS } from '../../src/data/weapons';
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

type Layer = {
  name: string;
  type?: string;
  width?: number;
  height?: number;
  objects?: Record<string, unknown>[];
  data?: unknown[] | undefined;
};
const layer = (map: Record<string, unknown>, name: string): Layer =>
  (map['layers'] as Layer[]).find((l) => l.name === name) as Layer;

describe('level maps in public/assets', () => {
  it.each(LEVELS)('$key is valid', (level) => {
    expect(
      validateLevelMap(readJson(`${PUBLIC_DIR}/${level.path}`), ENEMY_TYPES, BOSS_TYPES, PICKUPS),
    ).toEqual([]);
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

  it.each(LEVELS)('$key: each parallax layer is a known image asset', (level) => {
    const layout = readLevelLayout(
      readJson(`${PUBLIC_DIR}/${level.path}`),
      ENEMY_TYPES,
      BOSS_TYPES,
      PICKUPS,
    );
    for (const layer of layout.parallax) {
      expect(ASSETS.find((a) => a.key === layer.key)?.kind).toBe('image');
    }
  });

  it.each(LEVELS)('$key fills the screen height (176 px)', (level) => {
    const layout = readLevelLayout(
      readJson(`${PUBLIC_DIR}/${level.path}`),
      ENEMY_TYPES,
      BOSS_TYPES,
      PICKUPS,
    );
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

  it('checks the tilesets', () => {
    expect(validateLevelMap({ ...sampleMap(), tilesets: [] }, ENEMY_TYPES)).toContain(
      'map must embed at least one tileset',
    );
    const external = sampleMap();
    (external['tilesets'] as Record<string, unknown>[])[0] = {
      firstgid: 1,
      source: 'corridor.tsj',
    };
    expect(validateLevelMap(external, ENEMY_TYPES)).toContain(
      'tileset 1 must be embedded, start at gid 1, use 16×16 tiles, and match its image size',
    );
  });

  it('accepts a second tileset whose gids follow on, and checks tiles against both', () => {
    const map = sampleMap();
    const second = {
      ...(map['tilesets'] as Record<string, unknown>[])[0],
      firstgid: 5,
      name: 'catwalk',
    };
    map['tilesets'] = [...(map['tilesets'] as Record<string, unknown>[]), second];
    (map['layers'] as Layer[]).push({
      name: 'platforms',
      type: 'tilelayer',
      width: 4,
      height: 11,
      data: Array(44).fill(8),
    } as Layer);
    expect(validateLevelMap(map, ENEMY_TYPES)).toEqual([]);
    layer(map, 'platforms').data = Array(44).fill(9);
    expect(validateLevelMap(map, ENEMY_TYPES)).toContain(
      'tile layer "platforms" uses tiles outside the tileset',
    );
  });

  it('rejects a second tileset whose gids overlap the first', () => {
    const map = sampleMap();
    const second = { ...(map['tilesets'] as Record<string, unknown>[])[0], firstgid: 3 };
    map['tilesets'] = [...(map['tilesets'] as Record<string, unknown>[]), second];
    expect(validateLevelMap(map, ENEMY_TYPES)).toContain(
      'tileset 2 must be embedded, start at gid 5, use 16×16 tiles, and match its image size',
    );
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
      parallax: [],
      colliders: [{ type: 'solid', x: 0, y: 160, width: 64, height: 16 }],
      playerStart: { x: 8, y: 160 },
      checkpoints: [{ x: 32, y: 160 }],
      enemies: [{ x: 40, y: 160, enemy: 'alien-walker' }],
      spawners: [],
      blimps: [],
      exit: { x: 48, y: 96, width: 16, height: 64 },
      boss: null,
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

  it('reads image layers as parallax scenery, back to front, with defaults', () => {
    const map = sampleMap();
    map['layers'] = [
      { type: 'imagelayer', name: 'industrial-sky', image: 'x.png', parallaxx: 0 },
      { type: 'imagelayer', name: 'industrial-far', image: 'y.png', offsety: -4, parallaxx: 0.15 },
      { type: 'imagelayer', name: 'near', image: 'z.png' },
      ...(map['layers'] as unknown[]),
    ];
    expect(readLevelLayout(map, ENEMY_TYPES).parallax).toEqual([
      { key: 'industrial-sky', y: 0, factor: 0 },
      { key: 'industrial-far', y: -4, factor: 0.15 },
      { key: 'near', y: 0, factor: 1 },
    ]);
  });
});

describe('image layers', () => {
  const withLayer = (layer: Record<string, unknown>) => {
    const map = sampleMap();
    map['layers'] = [
      { type: 'imagelayer', image: 'a.png', ...layer },
      ...(map['layers'] as unknown[]),
    ];
    return validateLevelMap(map, ENEMY_TYPES);
  };

  it('accepts a named layer with a vertical offset and a parallax factor', () => {
    expect(withLayer({ name: 'sky', offsety: 12, parallaxx: 0.5 })).toEqual([]);
  });

  it('rejects a missing name, a sideways offset, a bad offset, or a factor outside 0–1', () => {
    expect(withLayer({ name: '' })).toEqual(['image layer 1: needs a name']);
    expect(withLayer({ name: 'a', offsetx: 5 })).toEqual(['image layer 1: offsetx must be 0']);
    expect(withLayer({ name: 'a', offsety: 'x' })).toEqual(['image layer 1: bad offsety']);
    expect(withLayer({ name: 'a', parallaxx: 1.5 })).toEqual([
      'image layer 1: parallaxx must be between 0 and 1',
    ]);
  });
});

describe('spawners (M3.14)', () => {
  const spawner = (props: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => {
    const map = sampleMap();
    const all = { enemy: 'alien-walker', count: 3, every: 900, from: 'right', ...props };
    layer(map, 'spawns').objects?.push({
      type: 'spawner',
      point: true,
      x: 32,
      y: 160,
      properties: Object.entries(all).map(([name, value]) => ({ name, value })),
      ...extra,
    });
    return map;
  };

  it('reads a spawner', () => {
    expect(validateLevelMap(spawner(), ENEMY_TYPES)).toEqual([]);
    expect(readLevelLayout(spawner(), ENEMY_TYPES).spawners).toEqual([
      { x: 32, y: 160, enemy: 'alien-walker', count: 3, everyMs: 900, from: 'right' },
    ]);
  });

  it('rejects a bad enemy, count, interval or side, or a rectangle', () => {
    expect(validateLevelMap(spawner({ enemy: 'dragon' }), ENEMY_TYPES)).toEqual([
      'spawn 5: unknown enemy type "dragon"',
    ]);
    expect(validateLevelMap(spawner({ count: 0, every: 1.5 }), ENEMY_TYPES)).toEqual([
      'spawn 5: count must be a whole number',
      'spawn 5: every must be a whole number of ms',
    ]);
    expect(validateLevelMap(spawner({ from: 'up' }), ENEMY_TYPES)).toEqual([
      'spawn 5: from must be "left" or "right"',
    ]);
    expect(
      validateLevelMap(spawner({}, { point: false, width: 16, height: 16 }), ENEMY_TYPES),
    ).toEqual(['spawn 5: spawner must be a point']);
  });
});

describe('blimps (M4.1)', () => {
  const withBlimp = (props: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const map = sampleMap();
    layer(map, 'spawns').objects?.push({
      type: 'blimp',
      point: true,
      x: 32,
      y: 40,
      properties: Object.entries(props).map(([name, value]) => ({ name, value })),
      ...extra,
    });
    return map;
  };

  it('reads a blimp and what it carries', () => {
    const map = withBlimp({ carries: 'spread', from: 'left' });
    expect(validateLevelMap(map, ENEMY_TYPES, BOSS_TYPES, PICKUPS)).toEqual([]);
    expect(readLevelLayout(map, ENEMY_TYPES, BOSS_TYPES, PICKUPS).blimps).toEqual([
      { x: 32, y: 40, carries: 'spread', from: 'left' },
    ]);
  });

  it('rejects an unknown pickup, a bad side, or a rectangle', () => {
    expect(
      validateLevelMap(
        withBlimp({ carries: 'rifle', from: 'right' }),
        ENEMY_TYPES,
        BOSS_TYPES,
        PICKUPS,
      ),
    ).toEqual(['spawn 5: unknown pickup "rifle"']);
    expect(
      validateLevelMap(
        withBlimp({ carries: 'spread', from: 'up' }),
        ENEMY_TYPES,
        BOSS_TYPES,
        PICKUPS,
      ),
    ).toEqual(['spawn 5: from must be "left" or "right"']);
    expect(
      validateLevelMap(
        withBlimp({ carries: 'spread', from: 'left' }, { point: false, width: 8, height: 8 }),
        ENEMY_TYPES,
        BOSS_TYPES,
        PICKUPS,
      ),
    ).toEqual(['spawn 5: blimp must be a point']);
  });
});

describe('boss fights', () => {
  /** The sample map made 20 tiles (one screen) wide, with an arena and a boss on the floor. */
  function bossMap(boss: Record<string, unknown> = {}, arena: Record<string, unknown> = {}) {
    const map = sampleMap();
    map['width'] = 20;
    const bg = layer(map, 'background');
    bg.width = 20;
    bg.data = Array(220).fill(1);
    layer(map, 'spawns').objects?.push(
      {
        type: 'boss',
        point: true,
        x: 280,
        y: 160,
        properties: [{ name: 'boss', value: 'tank' }],
        ...boss,
      },
      { type: 'arena', x: 0, y: 0, width: 320, height: 176, ...arena },
    );
    return map;
  }

  it('reads the boss and its arena', () => {
    expect(validateLevelMap(bossMap(), ENEMY_TYPES, BOSS_TYPES)).toEqual([]);
    expect(readLevelLayout(bossMap(), ENEMY_TYPES, BOSS_TYPES).boss).toEqual({
      x: 280,
      y: 160,
      type: 'tank',
      arena: { x: 0, y: 0, width: 320, height: 176 },
    });
  });

  it('rejects an unknown boss, or one placed as a rectangle', () => {
    expect(validateLevelMap(bossMap(), ENEMY_TYPES)).toEqual(['spawn 5: unknown boss type "tank"']);
    expect(
      validateLevelMap(bossMap({ point: false, width: 8, height: 8 }), ENEMY_TYPES, BOSS_TYPES),
    ).toEqual(['spawn 5: boss must be a point']);
  });

  it('needs an arena one screen wide at the right edge, with the boss inside', () => {
    const v = (arena: Record<string, unknown>, boss: Record<string, unknown> = {}) =>
      validateLevelMap(bossMap(boss, arena), ENEMY_TYPES, BOSS_TYPES);
    expect(v({ width: 300 })).toEqual([
      'arena must be 320 px (one screen) wide',
      "arena must reach the map's right edge",
    ]);
    expect(v({ point: true, width: 0, height: 0 })).toContain('spawn 6: arena must be a rectangle');
    const wider = bossMap();
    wider['width'] = 21;
    const bg = layer(wider, 'background');
    bg.width = 21;
    bg.data = Array(231).fill(1);
    expect(validateLevelMap(wider, ENEMY_TYPES, BOSS_TYPES)).toEqual([
      "arena must reach the map's right edge",
    ]);
    // On a map wider than the arena, a boss left of the arena is outside it.
    const wide = bossMap({ x: 40 }, { x: 80 });
    wide['width'] = 25;
    const wideBg = layer(wide, 'background');
    wideBg.width = 25;
    wideBg.data = Array(275).fill(1);
    expect(validateLevelMap(wide, ENEMY_TYPES, BOSS_TYPES)).toEqual([
      'boss must be inside its arena',
    ]);
  });

  it('a boss needs an arena, and an arena needs a boss', () => {
    const noArena = bossMap();
    const spawns = layer(noArena, 'spawns');
    spawns.objects = (spawns.objects ?? []).filter((o) => o['type'] !== 'arena');
    expect(validateLevelMap(noArena, ENEMY_TYPES, BOSS_TYPES)).toEqual([
      'a boss fight needs exactly one "boss" and one "arena"',
    ]);
  });
});

describe('Level 1 blimps (owner request 2026-10-19)', () => {
  it.each(LEVELS.filter((l) => l.key.startsWith('steelworks-')))(
    '$key has two blimps, one carrying health',
    (level) => {
      const { blimps } = readLevelLayout(
        readJson(`${PUBLIC_DIR}/${level.path}`),
        ENEMY_TYPES,
        BOSS_TYPES,
        PICKUPS,
      );
      expect(blimps).toHaveLength(2);
      expect(blimps.filter((b) => b.carries === 'health')).toHaveLength(1);
    },
  );
});
