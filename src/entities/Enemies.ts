import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { HIT_FLASH_MS, RUNNERS } from '../config/tuning';
import { ENEMIES, type EnemyType } from '../data/enemies';
import { bodyOffsetX, spriteYForFeet } from '../logic/body';
import { applyDamage, initialPatrol, stepPatrol, type PatrolState } from '../logic/enemy';
import { initialBiped, stepBiped, type BipedState } from '../logic/biped';
import { initialSnake, stepSnake, type SnakeState } from '../logic/snake';
import { runnerGone, stepRunner, type SpawnOrder } from '../logic/spawner';
import {
  initialFlyer,
  stepFlyer,
  type FlyerMode,
  type FlyerState,
  type Point,
} from '../logic/flyer';

type EnemySprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

/**
 * Puts a body where its sprite and (possibly mirrored) box are, straight away. Arcade only
 * applies a new offset on its next step (and body.reset() ignores the offset), so until then
 * the body, and the position tests read, would lag by the offset. Its previous positions move
 * with it, or that next step would shift the sprite by the difference.
 */
function syncBody(body: Phaser.Physics.Arcade.Body): void {
  body.updateFromGameObject();
  body.prev.copy(body.position);
  body.prevFrame.copy(body.position);
}

/** Flyers in a room start their shooting and diving this far apart, so they don't act together. */
const FLYER_STAGGER_MS = 700;

interface EnemyRecord {
  sprite: EnemySprite;
  type: EnemyType;
  /** Spawn point: feet for walkers, body centre (the hover point) for flyers. */
  origin: Point;
  hp: number;
  patrol: PatrolState;
  flyer: FlyerState | null;
  /** Bipedal walkers only (M4.2). */
  biped: BipedState | null;
  /** Spitting snakes only (M5.1). */
  snake: SnakeState | null;
  /** Facing as drawn: -1 left, 1 right. */
  direction: -1 | 1;
  flashMs: number;
  /** Sent in from the screen's edge by a spawner (M3.14); reused once dead or gone. */
  runner: boolean;
}

export interface EnemySnapshot {
  type: EnemyType;
  x: number;
  y: number;
  feetY: number;
  hp: number;
  alive: boolean;
  facing: 'left' | 'right';
  /** Flyers only: hover, windup, dive or rise. */
  mode: FlyerMode | null;
}

/** A shot an enemy fired this frame. */
export interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Lobbed shells fall (the tank's mortar); others fly straight. */
  gravity?: boolean;
  /** A lobbed shell bursts once it comes down to this height (its marked landing point). */
  burstAtY?: number;
  /** Its own sprite sheet (the snake's glob, M5.1), drawn facing right; default the orb. */
  sheet?: string;
}

/**
 * The level's enemies: placed from the map's spawns, walking or flying, taking hits,
 * and dying with an effect. Rules live in src/logic/enemy.ts and src/logic/flyer.ts.
 */
export class Enemies {
  readonly group: Phaser.Physics.Arcade.Group;
  private readonly records: EnemyRecord[] = [];

  /** Enemies alive right now. */
  get alive(): number {
    return this.records.filter((r) => r.sprite.active).length;
  }

  /** Runners sent in so far (for tests). */
  runnersSpawned = 0;
  /** Flyers placed so far: each starts its attacks a little later than the last. */
  private flyers = 0;

  constructor(
    scene: Phaser.Scene,
    spawns: readonly { x: number; y: number; enemy: string }[],
    private readonly onDeath: (type: EnemyType, x: number, y: number) => void,
  ) {
    this.group = scene.physics.add.group();
    for (const spawn of spawns) this.place(spawn);
  }

  /** Places an enemy as a map does: walkers stand on the point, flyers hover on it. */
  place(spawn: { x: number; y: number; enemy: string }): void {
    const type = spawn.enemy as EnemyType;
    const stats = ENEMIES[type];
    const flying = stats.movement === 'flyer' && stats.flyer !== undefined;
    // Walkers stand with their feet on the spawn point; flyers hover with their body centred on it.
    const y = flying
      ? spawn.y - (stats.body.offsetY + stats.body.height / 2) + stats.frame.height / 2
      : spriteYForFeet(spawn.y, stats.frame.height, stats.body);
    const sprite = this.group.create(spawn.x, y, stats.walkSheet) as EnemySprite;
    sprite.body.setSize(stats.body.width, stats.body.height);
    if (flying) sprite.body.setAllowGravity(false);
    sprite.play(animKey(stats.walkSheet));
    const record: EnemyRecord = {
      sprite,
      type,
      origin: { x: spawn.x, y: spawn.y },
      hp: stats.hp,
      patrol: initialPatrol(),
      flyer:
        flying && stats.flyer ? initialFlyer(stats.flyer, this.flyers++ * FLYER_STAGGER_MS) : null,
      biped: stats.biped ? initialBiped() : null,
      snake: stats.snake ? initialSnake() : null,
      direction: -1,
      flashMs: 0,
      runner: false,
    };
    this.face(record);
    syncBody(sprite.body);
    this.paint(record);
    sprite.setData('record', record);
    this.records.push(record);
  }

  /**
   * Sends an enemy in from the screen's edge (M3.14), reusing a runner of the same type that
   * died or ran off (CLAUDE.md: pooled objects).
   */
  spawn(order: SpawnOrder): void {
    const type = order.enemy as EnemyType;
    const stats = ENEMIES[type];
    const y = spriteYForFeet(order.y, stats.frame.height, stats.body);
    let r = this.records.find((rec) => rec.runner && rec.type === type && !rec.sprite.active);
    if (r) {
      r.sprite.setActive(true).setVisible(true);
      r.sprite.body.enable = true;
      r.sprite.body.reset(order.x, y);
    } else {
      const sprite = this.group.create(order.x, y, stats.walkSheet) as EnemySprite;
      sprite.body.setSize(stats.body.width, stats.body.height);
      r = {
        sprite,
        type,
        origin: { x: order.x, y: order.y },
        hp: stats.hp,
        patrol: initialPatrol(),
        flyer: null,
        biped: null,
        snake: null,
        direction: order.direction,
        flashMs: 0,
        runner: true,
      };
      sprite.setData('record', r);
      this.records.push(r);
    }
    r.hp = stats.hp;
    r.flashMs = 0;
    r.direction = order.direction;
    r.sprite.play(animKey(stats.walkSheet));
    this.face(r);
    syncBody(r.sprite.body);
    this.paint(r);
    this.runnersSpawned++;
  }

  /**
   * Moves every enemy for this frame. Returns the shots fired this frame. `view` is the camera's
   * span, and `mapHeight` the map's: runners far outside the view or down a pit are removed.
   */
  update(
    dtMs: number,
    player: Point | null,
    view: { left: number; right: number },
    mapHeight: number,
  ): EnemyShot[] {
    const shots: EnemyShot[] = [];
    for (const r of this.records) {
      if (!r.sprite.active) continue;
      if (r.runner) {
        this.updateRunner(r, view, mapHeight);
      } else if (r.flyer) {
        const shot = this.updateFlyer(r, dtMs, player);
        if (shot) shots.push(shot);
      } else if (r.biped) {
        const shot = this.updateBiped(r, dtMs, player);
        if (shot) shots.push(shot);
      } else if (r.snake) {
        const shot = this.updateSnake(r, dtMs, player);
        if (shot) shots.push(shot);
      } else {
        this.updateWalker(r, dtMs);
      }
      if (r.flashMs > 0) {
        r.flashMs -= dtMs;
        if (r.flashMs <= 0) this.paint(r);
      }
    }
    return shots;
  }

  /** A bullet hit this enemy sprite. Returns true if it was alive and took the hit. */
  damage(sprite: Phaser.GameObjects.GameObject, amount: number): boolean {
    const r = sprite.getData('record') as EnemyRecord | undefined;
    if (!r || !r.sprite.active) return false;
    const result = applyDamage(r.hp, amount);
    r.hp = result.hp;
    if (result.dead) {
      const { x, y } = r.sprite.body.center;
      r.sprite.body.stop();
      r.sprite.body.enable = false;
      r.sprite.setActive(false).setVisible(false);
      this.onDeath(r.type, x, y);
      return true;
    }
    r.flashMs = HIT_FLASH_MS;
    r.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    return true;
  }

  /** True for an enemy that stands on walkways (one that walks); flyers pass through them. */
  standsOnPlatforms(sprite: Phaser.GameObjects.GameObject): boolean {
    const r = sprite.getData('record') as EnemyRecord | undefined;
    return r !== undefined && r.flyer === null;
  }

  /** Damage this enemy sprite does on touch, or 0 if it is dead or not an enemy. */
  contactDamage(sprite: Phaser.GameObjects.GameObject): number {
    const r = sprite.getData('record') as EnemyRecord | undefined;
    return r && r.sprite.active ? ENEMIES[r.type].contactDamage : 0;
  }

  snapshot(): EnemySnapshot[] {
    return this.records.map((r) => ({
      type: r.type,
      x: Math.round(r.sprite.body.center.x),
      y: Math.round(r.sprite.body.center.y),
      feetY: Math.round(r.sprite.body.bottom),
      hp: r.hp,
      alive: r.sprite.active,
      facing: r.direction < 0 ? 'left' : 'right',
      mode: r.flyer?.mode ?? null,
    }));
  }

  private updateWalker(r: EnemyRecord, dtMs: number): void {
    const body = r.sprite.body;
    const step = stepPatrol(
      r.patrol,
      body.center.x,
      r.origin.x,
      { left: body.blocked.left, right: body.blocked.right },
      dtMs,
      ENEMIES[r.type],
    );
    r.patrol = step.state;
    this.setDirection(r, step.state.direction);
    body.setVelocityX(step.vx);
    if (step.vx === 0) r.sprite.anims.pause();
    else if (r.sprite.anims.isPaused) r.sprite.anims.resume();
  }

  private updateRunner(
    r: EnemyRecord,
    view: { left: number; right: number },
    mapHeight: number,
  ): void {
    const body = r.sprite.body;
    if (runnerGone(body.center.x, body.bottom, view, RUNNERS.farPx, mapHeight)) {
      // Ran off or fell: gone quietly, ready to be sent in again.
      body.stop();
      body.enable = false;
      r.sprite.setActive(false).setVisible(false);
      return;
    }
    this.setDirection(
      r,
      stepRunner(r.direction, { left: body.blocked.left, right: body.blocked.right }),
    );
    body.setVelocityX(r.direction * ENEMIES[r.type].speed);
  }

  /** The enemy's own colouring (a variant's tint), and its walk speed; clears a hit flash. */
  private paint(r: EnemyRecord): void {
    const stats = ENEMIES[r.type];
    r.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    if (stats.tint !== undefined) r.sprite.setTint(stats.tint);
    r.sprite.anims.timeScale = stats.animTimeScale ?? 1;
  }

  /** Walks at the marine, stops to aim, fires its cannon from the barrel (M4.2). */
  private updateBiped(r: EnemyRecord, dtMs: number, player: Point | null): EnemyShot | null {
    const tuning = ENEMIES[r.type].biped;
    if (!r.biped || !tuning) return null;
    const body = r.sprite.body;
    const step = stepBiped(
      r.biped,
      body.center.x,
      player?.x ?? null,
      { left: body.blocked.left, right: body.blocked.right },
      dtMs,
      tuning,
    );
    r.biped = step.state;
    this.setDirection(r, step.state.direction);
    body.setVelocityX(step.vx);
    // Standing still (idle or aiming), the legs stop on the first frame.
    if (step.vx === 0) r.sprite.anims.pause(r.sprite.anims.currentAnim?.frames[0]);
    else if (r.sprite.anims.isPaused) r.sprite.anims.resume();
    if (!step.fire) return null;
    const stats = ENEMIES[r.type];
    const [mx, my] = tuning.muzzle;
    const flipped = r.direction < 0;
    const left = r.sprite.x - stats.frame.width / 2;
    const top = r.sprite.y - stats.frame.height / 2;
    const x = left + (flipped ? stats.frame.width - mx : mx);
    return { x, y: top + my, vx: r.direction * tuning.shotSpeed, vy: 0 };
  }

  /** Sits still, rears back and strikes as it spits a glob at the marine (M5.1). */
  private updateSnake(r: EnemyRecord, dtMs: number, player: Point | null): EnemyShot | null {
    const stats = ENEMIES[r.type];
    const tuning = stats.snake;
    if (!r.snake || !tuning) return null;
    const before = r.snake.mode;
    const step = stepSnake(r.snake, this.framePoint(r, tuning.mouth), player, dtMs, tuning);
    r.snake = step.state;
    this.setDirection(r, step.state.direction);
    r.sprite.body.setVelocityX(0);
    const mode = step.state.mode;
    // Rearing back plays the strike once (its last frame lands as it spits); otherwise idle.
    if (mode === 'windup' && before !== 'windup') r.sprite.play(animKey(tuning.strikeSheet));
    else if (mode !== 'windup' && before === 'windup') r.sprite.play(animKey(stats.walkSheet));
    if (!step.spit) return null;
    const mouth = this.framePoint(r, tuning.mouth);
    return { ...mouth, vx: step.spit.vx, vy: step.spit.vy, sheet: tuning.spitSheet };
  }

  /** World position of a point drawn at [x, y] in the frame facing right, as it faces now. */
  private framePoint(r: EnemyRecord, [px, py]: readonly [number, number]): Point {
    const stats = ENEMIES[r.type];
    const flipped = stats.facesLeftInArt ? r.direction > 0 : r.direction < 0;
    const left = r.sprite.x - stats.frame.width / 2;
    const top = r.sprite.y - stats.frame.height / 2;
    return { x: left + (flipped ? stats.frame.width - px : px), y: top + py };
  }

  private updateFlyer(r: EnemyRecord, dtMs: number, player: Point | null): EnemyShot | null {
    const tuning = ENEMIES[r.type].flyer;
    if (!r.flyer || !tuning) return null;
    const body = r.sprite.body;
    const pos = { x: body.center.x, y: body.center.y };
    const step = stepFlyer(r.flyer, pos, r.origin, player, dtMs, tuning);
    const wasWindup = r.flyer.mode === 'windup';
    r.flyer = step.state;
    this.setDirection(r, step.state.direction);
    body.setVelocity(step.vx, step.vy);
    // Warning before a dive: the wings stop (the animation freezes).
    if (step.state.mode === 'windup' && !wasWindup) r.sprite.anims.pause();
    else if (step.state.mode !== 'windup' && r.sprite.anims.isPaused) r.sprite.anims.resume();
    return step.shot ? { x: pos.x, y: pos.y, vx: step.shot.vx, vy: step.shot.vy } : null;
  }

  private setDirection(r: EnemyRecord, direction: -1 | 1): void {
    if (direction === r.direction) return;
    r.direction = direction;
    this.face(r);
  }

  /** Flips the sprite to face its direction and mirrors its body box to match. */
  private face(r: EnemyRecord): void {
    const stats = ENEMIES[r.type];
    const flipped = stats.facesLeftInArt ? r.direction > 0 : r.direction < 0;
    r.sprite.setFlipX(flipped);
    r.sprite.body.setOffset(
      bodyOffsetX(stats.frame.width, stats.body, flipped),
      stats.body.offsetY,
    );
  }
}
