/**
 * Reading and checking Tiled level maps (.tmj) (ARCHITECTURE.md ADR-C01).
 * Plain TypeScript, no Phaser, so maps can be validated in unit tests.
 *
 * Map contract:
 * - orthogonal, finite, 16×16 tiles, one or more embedded tilesets with consecutive gids
 * - tile layer "background", and optionally a "platforms" tile layer (catwalks, pit edges)
 * - object layer "collision": rectangles of type "solid" or "platform"
 * - object layer "spawns": one "player-start" point, one "exit" rectangle,
 *   "enemy" points with an `enemy` string property naming a known enemy type,
 *   and any number of "checkpoint" points (respawn places)
 * - optionally "spawner" points (M3.14): enemies that run in from the edge of the screen once
 *   the point scrolls into view. Properties: `enemy` (a known enemy type), `count` and `every`
 *   (whole numbers: how many, and ms between them), and `from` ("left" or "right")
 * - optionally a boss fight (M3.2): one "boss" point with a `boss` string property naming a
 *   known boss type, and one "arena" rectangle exactly one screen wide, reaching the map's
 *   right edge, with the boss inside it. Each needs the other.
 * - optional image layers (Tiled "imagelayer"), drawn behind everything in map order as
 *   parallax scenery: the layer name is the image's asset key, `offsety` places it, and
 *   `parallaxx` (0–1, default 1) is how fast it scrolls with the camera; repeated sideways
 */
import { GAME_WIDTH } from '../config/tuning';
import type { Spawner } from './spawner';

export const TILE_SIZE = 16;
export const REQUIRED_TILE_LAYERS = ['background'] as const;
export const OPTIONAL_TILE_LAYERS = ['platforms'] as const;
export const COLLISION_TYPES = ['solid', 'platform'] as const;
export type CollisionType = (typeof COLLISION_TYPES)[number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelLayout {
  widthPx: number;
  heightPx: number;
  background: string | null;
  /** Parallax scenery from image layers, back to front. */
  parallax: ParallaxLayer[];
  colliders: (Rect & { type: CollisionType })[];
  playerStart: { x: number; y: number };
  /** Respawn points, in map order. */
  checkpoints: { x: number; y: number }[];
  enemies: { x: number; y: number; enemy: string }[];
  /** Enemies that run in from the screen's edge (M3.14). */
  spawners: Spawner[];
  exit: Rect;
  /** The boss and its arena, if this map ends in a boss fight. */
  boss: { x: number; y: number; type: string; arena: Rect } | null;
}

export interface ParallaxLayer {
  /** Asset key of the image (the image layer's name). */
  key: string;
  /** Top of the image, in map pixels. */
  y: number;
  /** 0 stays put, 1 moves with the map. */
  factor: number;
}

// Minimal shape of the Tiled JSON fields we read. Everything is checked before use.
interface TiledProperty {
  name?: unknown;
  value?: unknown;
}
interface TiledObject {
  type?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  point?: unknown;
  properties?: unknown;
}
interface TiledLayer {
  type?: unknown;
  name?: unknown;
  width?: unknown;
  height?: unknown;
  data?: unknown;
  objects?: unknown;
  offsetx?: unknown;
  offsety?: unknown;
  parallaxx?: unknown;
}
interface TiledTileset {
  firstgid?: unknown;
  tilecount?: unknown;
  tilewidth?: unknown;
  tileheight?: unknown;
  image?: unknown;
  imagewidth?: unknown;
  imageheight?: unknown;
  columns?: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function property(obj: { properties?: unknown }, name: string): unknown {
  if (!Array.isArray(obj.properties)) return undefined;
  const found = (obj.properties as TiledProperty[]).find((p) => isRecord(p) && p.name === name);
  return found?.value;
}

function objectLayer(layers: TiledLayer[], name: string): TiledObject[] | null {
  const layer = layers.find((l) => l.name === name && l.type === 'objectgroup');
  return layer && Array.isArray(layer.objects) ? (layer.objects as TiledObject[]) : null;
}

/** Checks a parsed .tmj map. Returns a list of problems; empty means valid. */
export function validateLevelMap(
  raw: unknown,
  knownEnemies: readonly string[],
  knownBosses: readonly string[] = [],
): string[] {
  const problems: string[] = [];
  if (!isRecord(raw)) return ['map is not a JSON object'];

  if (raw['orientation'] !== 'orthogonal') problems.push('orientation must be orthogonal');
  if (raw['infinite'] !== false) problems.push('map must be finite (not infinite)');
  if (raw['tilewidth'] !== TILE_SIZE || raw['tileheight'] !== TILE_SIZE) {
    problems.push(`tiles must be ${TILE_SIZE}×${TILE_SIZE}`);
  }
  const width = raw['width'];
  const height = raw['height'];
  if (!isPositiveInt(width) || !isPositiveInt(height)) {
    problems.push('width and height must be positive whole numbers of tiles');
    return problems;
  }
  const widthPx = width * TILE_SIZE;
  const heightPx = height * TILE_SIZE;

  // Tilesets: embedded, 16×16, gids running on from one to the next.
  const tilesets = raw['tilesets'];
  let maxGid = 0;
  if (!Array.isArray(tilesets) || tilesets.length === 0) {
    problems.push('map must embed at least one tileset');
  } else {
    let nextGid = 1;
    for (const [i, entry] of tilesets.entries()) {
      const ts = (isRecord(entry) ? entry : {}) as TiledTileset;
      const ok =
        ts.firstgid === nextGid &&
        ts.tilewidth === TILE_SIZE &&
        ts.tileheight === TILE_SIZE &&
        isPositiveInt(ts.tilecount) &&
        isPositiveInt(ts.columns) &&
        typeof ts.image === 'string' &&
        ts.imagewidth === (ts.columns as number) * TILE_SIZE &&
        isPositiveInt(ts.imageheight) &&
        ts.tilecount === (ts.columns as number) * ((ts.imageheight as number) / TILE_SIZE);
      if (!ok) {
        problems.push(
          `tileset ${i + 1} must be embedded, start at gid ${nextGid}, use 16×16 tiles, and match its image size`,
        );
        maxGid = 0;
        break;
      }
      nextGid += ts.tilecount as number;
      maxGid = nextGid - 1;
    }
  }

  // Layers
  const layers = Array.isArray(raw['layers']) ? (raw['layers'] as TiledLayer[]) : [];
  for (const name of [...REQUIRED_TILE_LAYERS, ...OPTIONAL_TILE_LAYERS]) {
    const layer = layers.find((l) => l.name === name && l.type === 'tilelayer');
    if (!layer) {
      if ((REQUIRED_TILE_LAYERS as readonly string[]).includes(name)) {
        problems.push(`missing tile layer "${name}"`);
      }
      continue;
    }
    const data = layer.data;
    if (layer.width !== width || layer.height !== height || !Array.isArray(data)) {
      problems.push(`tile layer "${name}" must be uncompressed and cover the whole map`);
    } else if (data.length !== width * height) {
      problems.push(`tile layer "${name}" has ${data.length} tiles, expected ${width * height}`);
    } else if (maxGid > 0 && data.some((g) => !Number.isInteger(g) || g < 0 || g > maxGid)) {
      problems.push(`tile layer "${name}" uses tiles outside the tileset`);
    }
  }

  layers.forEach((l, i) => {
    if (l.type !== 'imagelayer') return;
    const where = `image layer ${i + 1}`;
    if (typeof l.name !== 'string' || l.name === '') problems.push(`${where}: needs a name`);
    if (l.offsetx !== undefined && l.offsetx !== 0) problems.push(`${where}: offsetx must be 0`);
    if (l.offsety !== undefined && !isNum(l.offsety)) problems.push(`${where}: bad offsety`);
    if (
      l.parallaxx !== undefined &&
      !(isNum(l.parallaxx) && l.parallaxx >= 0 && l.parallaxx <= 1)
    ) {
      problems.push(`${where}: parallaxx must be between 0 and 1`);
    }
  });

  const inside = (o: TiledObject): boolean =>
    isNum(o.x) &&
    isNum(o.y) &&
    o.x >= 0 &&
    o.y >= 0 &&
    o.x + (isNum(o.width) ? o.width : 0) <= widthPx &&
    o.y + (isNum(o.height) ? o.height : 0) <= heightPx;
  const isRect = (o: TiledObject): boolean =>
    o.point !== true && isNum(o.width) && isNum(o.height) && o.width > 0 && o.height > 0;

  const collision = objectLayer(layers, 'collision');
  if (!collision) {
    problems.push('missing object layer "collision"');
  } else {
    if (collision.length === 0) problems.push('collision layer is empty');
    collision.forEach((o, i) => {
      if (!(COLLISION_TYPES as readonly unknown[]).includes(o.type)) {
        problems.push(
          `collision object ${i + 1}: type must be one of ${COLLISION_TYPES.join(', ')}`,
        );
      }
      if (!isRect(o) || !inside(o)) {
        problems.push(`collision object ${i + 1}: must be a rectangle inside the map`);
      }
    });
  }

  const spawns = objectLayer(layers, 'spawns');
  if (!spawns) {
    problems.push('missing object layer "spawns"');
  } else {
    const count = (t: string): number => spawns.filter((o) => o.type === t).length;
    if (count('player-start') !== 1) problems.push('spawns need exactly one "player-start"');
    if (count('exit') !== 1) problems.push('spawns need exactly one "exit"');
    spawns.forEach((o, i) => {
      const where = `spawn ${i + 1}`;
      if (!inside(o)) problems.push(`${where}: must be inside the map`);
      if (o.type === 'player-start' && o.point !== true)
        problems.push(`${where}: player-start must be a point`);
      if (o.type === 'exit' && !isRect(o)) problems.push(`${where}: exit must be a rectangle`);
      if (o.type === 'enemy') {
        if (o.point !== true) problems.push(`${where}: enemy must be a point`);
        const enemy = property(o, 'enemy');
        if (typeof enemy !== 'string' || !knownEnemies.includes(enemy)) {
          problems.push(`${where}: unknown enemy type ${JSON.stringify(enemy)}`);
        }
      } else if (o.type === 'spawner') {
        problems.push(...spawnerProblems(o, where, knownEnemies));
      } else if (o.type === 'checkpoint') {
        if (o.point !== true) problems.push(`${where}: checkpoint must be a point`);
      } else if (o.type === 'boss') {
        if (o.point !== true) problems.push(`${where}: boss must be a point`);
        const boss = property(o, 'boss');
        if (typeof boss !== 'string' || !knownBosses.includes(boss)) {
          problems.push(`${where}: unknown boss type ${JSON.stringify(boss)}`);
        }
      } else if (o.type === 'arena') {
        if (!isRect(o)) problems.push(`${where}: arena must be a rectangle`);
      } else if (o.type !== 'player-start' && o.type !== 'exit') {
        problems.push(`${where}: unknown spawn type ${JSON.stringify(o.type)}`);
      }
    });
    problems.push(...bossProblems(spawns, widthPx));
  }
  return problems;
}

function spawnerProblems(o: TiledObject, where: string, knownEnemies: readonly string[]): string[] {
  const problems: string[] = [];
  if (o.point !== true) problems.push(`${where}: spawner must be a point`);
  const enemy = property(o, 'enemy');
  if (typeof enemy !== 'string' || !knownEnemies.includes(enemy)) {
    problems.push(`${where}: unknown enemy type ${JSON.stringify(enemy)}`);
  }
  if (!isPositiveInt(property(o, 'count'))) problems.push(`${where}: count must be a whole number`);
  if (!isPositiveInt(property(o, 'every')))
    problems.push(`${where}: every must be a whole number of ms`);
  const from = property(o, 'from');
  if (from !== 'left' && from !== 'right')
    problems.push(`${where}: from must be "left" or "right"`);
  return problems;
}

function bossProblems(spawns: TiledObject[], widthPx: number): string[] {
  const bosses = spawns.filter((o) => o.type === 'boss');
  const arenas = spawns.filter((o) => o.type === 'arena');
  if (bosses.length === 0 && arenas.length === 0) return [];
  if (bosses.length !== 1 || arenas.length !== 1) {
    return ['a boss fight needs exactly one "boss" and one "arena"'];
  }
  const [boss, arena] = [bosses[0] as TiledObject, arenas[0] as TiledObject];
  if (!isNum(arena.x) || !isNum(arena.width) || !isNum(boss.x)) return [];
  const problems: string[] = [];
  if (arena.width !== GAME_WIDTH) problems.push(`arena must be ${GAME_WIDTH} px (one screen) wide`);
  if (arena.x + arena.width !== widthPx) problems.push("arena must reach the map's right edge");
  if (boss.x < arena.x || boss.x > arena.x + arena.width) {
    problems.push('boss must be inside its arena');
  }
  return problems;
}

/**
 * Extracts what the level scene needs from a map that passed validateLevelMap.
 * Throws if the map is invalid, so a broken map fails loudly rather than half-loading.
 */
export function readLevelLayout(
  raw: unknown,
  knownEnemies: readonly string[],
  knownBosses: readonly string[] = [],
): LevelLayout {
  const problems = validateLevelMap(raw, knownEnemies, knownBosses);
  if (problems.length > 0) throw new Error(`invalid level map: ${problems.join('; ')}`);
  const map = raw as Record<string, unknown>;
  const layers = map['layers'] as TiledLayer[];
  const collision = objectLayer(layers, 'collision') ?? [];
  const spawns = objectLayer(layers, 'spawns') ?? [];
  const rect = (o: TiledObject): Rect => ({
    x: o.x as number,
    y: o.y as number,
    width: o.width as number,
    height: o.height as number,
  });
  const start = spawns.find((o) => o.type === 'player-start') as TiledObject;
  const exit = spawns.find((o) => o.type === 'exit') as TiledObject;
  const background = property(map, 'background');
  const boss = spawns.find((o) => o.type === 'boss');
  const arena = spawns.find((o) => o.type === 'arena');
  return {
    widthPx: (map['width'] as number) * TILE_SIZE,
    heightPx: (map['height'] as number) * TILE_SIZE,
    background: typeof background === 'string' ? background : null,
    parallax: layers
      .filter((l) => l.type === 'imagelayer')
      .map((l) => ({
        key: l.name as string,
        y: isNum(l.offsety) ? l.offsety : 0,
        factor: isNum(l.parallaxx) ? l.parallaxx : 1,
      })),
    colliders: collision.map((o) => ({ ...rect(o), type: o.type as CollisionType })),
    playerStart: { x: start.x as number, y: start.y as number },
    checkpoints: spawns
      .filter((o) => o.type === 'checkpoint')
      .map((o) => ({ x: o.x as number, y: o.y as number })),
    enemies: spawns
      .filter((o) => o.type === 'enemy')
      .map((o) => ({ x: o.x as number, y: o.y as number, enemy: property(o, 'enemy') as string })),
    spawners: spawns
      .filter((o) => o.type === 'spawner')
      .map((o) => ({
        x: o.x as number,
        y: o.y as number,
        enemy: property(o, 'enemy') as string,
        count: property(o, 'count') as number,
        everyMs: property(o, 'every') as number,
        from: property(o, 'from') as 'left' | 'right',
      })),
    exit: rect(exit),
    boss:
      boss && arena
        ? {
            x: boss.x as number,
            y: boss.y as number,
            type: property(boss, 'boss') as string,
            arena: rect(arena),
          }
        : null,
  };
}
