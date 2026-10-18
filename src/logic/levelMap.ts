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
 */
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
  colliders: (Rect & { type: CollisionType })[];
  playerStart: { x: number; y: number };
  /** Respawn points, in map order. */
  checkpoints: { x: number; y: number }[];
  enemies: { x: number; y: number; enemy: string }[];
  exit: Rect;
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
export function validateLevelMap(raw: unknown, knownEnemies: readonly string[]): string[] {
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
      } else if (o.type === 'checkpoint') {
        if (o.point !== true) problems.push(`${where}: checkpoint must be a point`);
      } else if (o.type !== 'player-start' && o.type !== 'exit') {
        problems.push(`${where}: unknown spawn type ${JSON.stringify(o.type)}`);
      }
    });
  }
  return problems;
}

/**
 * Extracts what the level scene needs from a map that passed validateLevelMap.
 * Throws if the map is invalid, so a broken map fails loudly rather than half-loading.
 */
export function readLevelLayout(raw: unknown, knownEnemies: readonly string[]): LevelLayout {
  const problems = validateLevelMap(raw, knownEnemies);
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
  return {
    widthPx: (map['width'] as number) * TILE_SIZE,
    heightPx: (map['height'] as number) * TILE_SIZE,
    background: typeof background === 'string' ? background : null,
    colliders: collision.map((o) => ({ ...rect(o), type: o.type as CollisionType })),
    playerStart: { x: start.x as number, y: start.y as number },
    checkpoints: spawns
      .filter((o) => o.type === 'checkpoint')
      .map((o) => ({ x: o.x as number, y: o.y as number })),
    enemies: spawns
      .filter((o) => o.type === 'enemy')
      .map((o) => ({ x: o.x as number, y: o.y as number, enemy: property(o, 'enemy') as string })),
    exit: rect(exit),
  };
}
