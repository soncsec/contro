import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { BOSS_FIGHT, GRAVITY_Y, HIT_FLASH_MS } from '../config/tuning';
import { BOSSES, type BossType } from '../data/bosses';
import { bodyOffsetX, framePointToWorld, spriteYForFeet } from '../logic/body';
import {
  damageBoss,
  initialBoss,
  leapArc,
  lobVelocity,
  startBoss,
  stepBoss,
  type BossMode,
  type BossState,
} from '../logic/boss';
import type { Rect } from '../logic/levelMap';
import { createRng, type Rng } from '../logic/rng';
import { fanVelocities } from '../logic/pickups';
import type { EnemyShot } from './Enemies';

type BossSprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

export interface BossSnapshot {
  type: BossType;
  x: number;
  hp: number;
  maxHp: number;
  mode: BossMode;
  phase: number;
}

/** What the boss did this frame. */
export interface BossUpdate {
  shots: EnemyShot[];
  /** Where each mortar shell (or leap) started this frame will land, and how soon. */
  landings: { x: number; y: number; ms: number }[];
  /** Big explosions to show (while it blows up). */
  explosions: { x: number; y: number }[];
  /** True in the frame its last explosion ends. */
  finished: boolean;
}

/**
 * A level's boss (M3.2): waits beyond the arena, rolls in when the fight starts, drives and
 * attacks by phase, and blows up. The rules are in src/logic/boss.ts; the numbers in
 * src/data/bosses.ts. It always faces the marine, who comes from the left.
 */
export class Boss {
  readonly sprite: BossSprite;
  readonly type: BossType;
  private state: BossState;
  private flashMs = 0;
  private explodeMs = 0;
  /** A leap in the air (the mech, M4.4): where from and to (feet), and how far into it. */
  private leap: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    ms: number;
  } | null = null;
  private rng: Rng;
  private readonly feetY: number;

  constructor(
    scene: Phaser.Scene,
    spawn: { y: number; type: string },
    private readonly arena: Rect,
  ) {
    this.type = spawn.type as BossType;
    const stats = BOSSES[this.type];
    this.feetY = spawn.y;
    this.state = initialBoss(stats.tuning);
    this.rng = createRng(BOSS_FIGHT.rngSeed);
    this.sprite = scene.physics.add.sprite(0, 0, stats.sheet) as BossSprite;
    this.sprite.body.setAllowGravity(false).setImmovable(true);
    this.sprite.body.setSize(stats.body.width, stats.body.height);
    const facingLeft = !stats.facesLeftInArt;
    this.sprite.setFlipX(facingLeft);
    this.sprite.body.setOffset(
      bodyOffsetX(stats.frame.width, stats.body, facingLeft),
      stats.body.offsetY,
    );
    this.sprite.play(animKey(stats.sheet));
    this.reset();
  }

  private get stats() {
    return BOSSES[this.type];
  }

  /** Back to waiting beyond the arena at full health (the marine died during the fight). */
  reset(): void {
    const stats = this.stats;
    this.state = initialBoss(stats.tuning);
    this.rng = createRng(BOSS_FIGHT.rngSeed);
    this.flashMs = 0;
    this.explodeMs = 0;
    this.leap = null;
    const x = this.arena.x + this.arena.width + stats.startBeyond;
    const y = spriteYForFeet(this.feetY, stats.frame.height, stats.body);
    this.sprite.setActive(true).setVisible(true).clearTint();
    this.sprite.body.enable = true;
    this.sprite.body.reset(x, y);
    this.sprite.anims.pause();
  }

  /** The marine entered the arena: roll in. */
  start(): void {
    this.state = startBoss(this.state);
    this.sprite.anims.resume();
  }

  get mode(): BossMode {
    return this.state.mode;
  }

  /** It can hurt the marine by touch while rolling in and fighting. */
  get dangerous(): boolean {
    return this.state.mode === 'intro' || this.state.mode === 'fight';
  }

  /** A bullet hit it. Returns whether the hit counted and whether that destroyed it. */
  damage(amount: number): { hit: boolean; destroyed: boolean } {
    const r = damageBoss(this.state, amount, this.stats.tuning);
    this.state = r.state;
    if (r.destroyed) {
      this.sprite.body.stop();
      this.sprite.anims.pause();
    }
    if (r.hit) {
      this.flashMs = HIT_FLASH_MS;
      this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    }
    return { hit: r.hit, destroyed: r.destroyed };
  }

  /** One frame. `target` is the middle of the marine (null if it can't see him). */
  update(dtMs: number, target: { x: number; y: number } | null): BossUpdate {
    const stats = this.stats;
    const body = this.sprite.body;
    const range = { min: this.arena.x + stats.drive.min, max: this.arena.x + stats.drive.max };
    const step = stepBoss(this.state, body.center.x, range, dtMs, stats.tuning);
    this.state = step.state;
    body.setVelocityX(step.vx);
    const out: BossUpdate = { shots: [], landings: [], explosions: [], finished: step.finished };
    // In the air (a leap): follow the arc instead of driving; a shockwave both ways on landing.
    if (this.leap && stats.leap) {
      this.leap.ms += dtMs;
      const p = leapArc(
        this.leap.from,
        this.leap.to,
        this.leap.ms,
        stats.leap.durationMs,
        stats.leap.height,
      );
      body.setVelocityX(0);
      body.reset(p.x, spriteYForFeet(p.y, stats.frame.height, stats.body));
      if (p.done) {
        this.leap = null;
        out.shots.push(...this.shockwaves([-1, 1]));
      }
    }
    const phase = stats.tuning.phases[this.state.phase];
    if (step.turned && phase?.shockwaveOnTurn && target && !this.leap) {
      out.shots.push(...this.shockwaves([target.x < body.center.x ? -1 : 1]));
    }
    for (const attack of step.attacks) this.attack(attack, target, range, out);
    if (this.flashMs > 0) {
      this.flashMs -= dtMs;
      if (this.flashMs <= 0) this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
    if (this.state.mode === 'dying') {
      this.explodeMs -= dtMs;
      if (this.explodeMs <= 0) {
        this.explodeMs += stats.explosions.everyMs;
        out.explosions.push({
          x: body.x + this.rng.range(0, body.width),
          y: body.y + this.rng.range(0, body.height),
        });
      }
    }
    if (step.finished) {
      body.enable = false;
      this.sprite.setActive(false).setVisible(false);
      out.explosions.push({ x: body.center.x, y: body.center.y });
    }
    return out;
  }

  private attack(
    attack: string,
    target: { x: number; y: number } | null,
    range: { min: number; max: number },
    out: BossUpdate,
  ): void {
    const stats = this.stats;
    if (attack === 'cannon' && stats.cannon) {
      const m = this.framePoint(stats.muzzle);
      out.shots.push({ x: m.x, y: m.y, vx: -stats.cannon.shotSpeed, vy: 0 });
    } else if (attack === 'mortar' && stats.mortar && target) {
      // A lobbed shell, landing near the marine (kept inside the arena).
      const from = this.framePoint(stats.hatch);
      const spread = stats.mortar.spread;
      const x = Phaser.Math.Clamp(
        target.x + this.rng.range(-spread, spread),
        this.arena.x + 8,
        this.arena.x + this.arena.width - 8,
      );
      const to = { x, y: this.feetY };
      const v = lobVelocity(from, to, stats.mortar.flightMs, GRAVITY_Y);
      out.shots.push({ ...from, ...v, gravity: true, burstAtY: to.y });
      out.landings.push({ ...to, ms: stats.mortar.flightMs });
    } else if (attack === 'spread' && stats.spreadShot && target) {
      // Shots from the chest light, aimed at the marine and fanned out (M4.4).
      const m = this.framePoint(stats.muzzle);
      const dx = target.x - m.x;
      const dy = target.y - m.y;
      const len = Math.hypot(dx, dy) || 1;
      const s = stats.spreadShot;
      const aimed = { vx: (dx / len) * s.shotSpeed, vy: (dy / len) * s.shotSpeed };
      for (const v of fanVelocities(aimed, s.count, s.spreadDeg)) out.shots.push({ ...m, ...v });
    } else if (attack === 'leap' && stats.leap && target && !this.leap) {
      // Jump onto the marine's spot (kept to its range), the landing marked while in the air.
      const from = { x: this.sprite.body.center.x, y: this.feetY };
      const to = { x: Phaser.Math.Clamp(target.x, range.min, range.max), y: this.feetY };
      this.leap = { from, to, ms: 0 };
      out.landings.push({ ...to, ms: stats.leap.durationMs });
    }
  }

  /** Shots rolling along the floor away from the boss, one each way given. */
  private shockwaves(directions: readonly (-1 | 1)[]): EnemyShot[] {
    const w = this.stats.shockwave;
    if (!w) return [];
    const x = this.sprite.body.center.x;
    return directions.map((d) => ({
      x: x + d * (this.stats.body.width / 2),
      y: this.feetY - w.height,
      vx: d * w.speed,
      vy: 0,
    }));
  }

  snapshot(): BossSnapshot {
    return {
      type: this.type,
      x: Math.round(this.sprite.body.center.x),
      hp: this.state.hp,
      maxHp: this.stats.tuning.hp,
      mode: this.state.mode,
      phase: this.state.phase,
    };
  }

  private framePoint(point: readonly [number, number]): { x: number; y: number } {
    const facingLeft = !this.stats.facesLeftInArt;
    return framePointToWorld(this.sprite.x, this.sprite.y, this.stats.frame, point, facingLeft);
  }
}
