import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { HIT_FLASH_MS } from '../config/tuning';
import { ENEMIES, type EnemyType } from '../data/enemies';
import { bodyOffsetX, spriteYForFeet } from '../logic/body';
import { applyDamage, initialPatrol, stepPatrol, type PatrolState } from '../logic/enemy';

type EnemySprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

interface EnemyRecord {
  sprite: EnemySprite;
  type: EnemyType;
  originX: number;
  hp: number;
  patrol: PatrolState;
  flashMs: number;
}

export interface EnemySnapshot {
  type: EnemyType;
  x: number;
  feetY: number;
  hp: number;
  alive: boolean;
  facing: 'left' | 'right';
}

/**
 * The level's enemies: placed from the map's spawns, patrolling, taking hits,
 * and dying with an effect. Rules live in src/logic/enemy.ts.
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
    for (const spawn of spawns) {
      const type = spawn.enemy as EnemyType;
      const stats = ENEMIES[type];
      const sprite = this.group.create(
        spawn.x,
        spriteYForFeet(spawn.y, stats.frame.height, stats.body),
        stats.walkSheet,
      ) as EnemySprite;
      sprite.body.setSize(stats.body.width, stats.body.height);
      sprite.play(animKey(stats.walkSheet));
      const record: EnemyRecord = {
        sprite,
        type,
        originX: spawn.x,
        hp: stats.hp,
        patrol: initialPatrol(),
        flashMs: 0,
      };
      this.face(record);
      sprite.setData('record', record);
      this.records.push(record);
    }
  }

  update(dtMs: number): void {
    for (const r of this.records) {
      if (!r.sprite.active) continue;
      const body = r.sprite.body;
      const step = stepPatrol(
        r.patrol,
        body.center.x,
        r.originX,
        { left: body.blocked.left, right: body.blocked.right },
        dtMs,
        ENEMIES[r.type],
      );
      if (step.state.direction !== r.patrol.direction) {
        r.patrol = step.state;
        this.face(r);
      } else {
        r.patrol = step.state;
      }
      body.setVelocityX(step.vx);
      if (step.vx === 0) r.sprite.anims.pause();
      else if (r.sprite.anims.isPaused) r.sprite.anims.resume();

      if (r.flashMs > 0) {
        r.flashMs -= dtMs;
        if (r.flashMs <= 0) r.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      }
    }
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

  snapshot(): EnemySnapshot[] {
    return this.records.map((r) => ({
      type: r.type,
      x: Math.round(r.sprite.body.center.x),
      feetY: Math.round(r.sprite.body.bottom),
      hp: r.hp,
      alive: r.sprite.active,
      facing: r.patrol.direction < 0 ? 'left' : 'right',
    }));
  }

  /** Flips the sprite to face its walking direction and mirrors its body box to match. */
  private face(r: EnemyRecord): void {
    const stats = ENEMIES[r.type];
    const flipped = stats.facesLeftInArt ? r.patrol.direction > 0 : r.patrol.direction < 0;
    r.sprite.setFlipX(flipped);
    r.sprite.body.setOffset(
      bodyOffsetX(stats.frame.width, stats.body, flipped),
      stats.body.offsetY,
    );
  }
}
