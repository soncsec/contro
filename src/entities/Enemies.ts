import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { HIT_FLASH_MS } from '../config/tuning';
import { ENEMIES, type EnemyType } from '../data/enemies';
import { bodyOffsetX, spriteYForFeet } from '../logic/body';
import { applyDamage, initialPatrol, stepPatrol, type PatrolState } from '../logic/enemy';
import {
  initialFlyer,
  stepFlyer,
  type FlyerMode,
  type FlyerState,
  type Point,
} from '../logic/flyer';

type EnemySprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

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
  /** Facing as drawn: -1 left, 1 right. */
  direction: -1 | 1;
  flashMs: number;
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
}

/**
 * The level's enemies: placed from the map's spawns, walking or flying, taking hits,
 * and dying with an effect. Rules live in src/logic/enemy.ts and src/logic/flyer.ts.
 */
export class Enemies {
  readonly group: Phaser.Physics.Arcade.Group;
  private readonly records: EnemyRecord[] = [];

  constructor(
    scene: Phaser.Scene,
    spawns: readonly { x: number; y: number; enemy: string }[],
    private readonly onDeath: (type: EnemyType, x: number, y: number) => void,
  ) {
    this.group = scene.physics.add.group();
    let flyers = 0;
    for (const spawn of spawns) {
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
          flying && stats.flyer ? initialFlyer(stats.flyer, flyers++ * FLYER_STAGGER_MS) : null,
        direction: -1,
        flashMs: 0,
      };
      this.face(record);
      sprite.setData('record', record);
      this.records.push(record);
    }
  }

  /** Moves every enemy for this frame. Returns the shots fired this frame. */
  update(dtMs: number, player: Point | null): EnemyShot[] {
    const shots: EnemyShot[] = [];
    for (const r of this.records) {
      if (!r.sprite.active) continue;
      if (r.flyer) {
        const shot = this.updateFlyer(r, dtMs, player);
        if (shot) shots.push(shot);
      } else {
        this.updateWalker(r, dtMs);
      }
      if (r.flashMs > 0) {
        r.flashMs -= dtMs;
        if (r.flashMs <= 0) r.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
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
