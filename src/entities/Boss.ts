import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { BOSS_FIGHT, GRAVITY_Y, HIT_FLASH_MS } from '../config/tuning';
import { BOSSES, type BossType } from '../data/bosses';
import { bodyOffsetX, framePointToWorld, spriteYForFeet } from '../logic/body';
import {
  damageBoss,
  hoverBob,
  initialBoss,
  leapArc,
  lobVelocity,
  startBoss,
  stepBoss,
  swoopEnd,
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
  /** Body centre and bottom (feet) y: a hovering boss's feet are above the floor (M5.3). */
  y: number;
  feetY: number;
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
  /**
   * A leap in the air (the mech, M4.4) or a swoop (the demon, M5.3): where from and to
   * (feet), how far into it, how long it takes and how high it rises (negative: a dive).
   */
  private leap: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    ms: number;
    durationMs: number;
    height: number;
    swoop: boolean;
  } | null = null;
  /** Time hovering, for the bob (the demon). */
  private hoverMs = 0;
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

  /** Where its feet rest: on the floor, or above it for a hovering boss (the demon). */
  private get restFeetY(): number {
    return this.feetY - (this.stats.hover?.height ?? 0);
  }

  /** Back to waiting beyond the arena at full health (the marine died during the fight). */
  reset(): void {
    const stats = this.stats;
    this.state = initialBoss(stats.tuning);
    this.rng = createRng(BOSS_FIGHT.rngSeed);
    this.flashMs = 0;
    this.explodeMs = 0;
    this.leap = null;
    this.hoverMs = 0;
    const x = this.arena.x + this.arena.width + stats.startBeyond;
    const y = spriteYForFeet(this.restFeetY, stats.frame.height, stats.body);
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
    // In the air (a leap or a swoop): follow the arc instead of driving. A leap lands with a
    // shockwave both ways; a swoop rises back to hovering.
    if (this.leap) {
      this.leap.ms += dtMs;
      const leap = this.leap;
      const p = leapArc(leap.from, leap.to, leap.ms, leap.durationMs, leap.height);
      if (leap.swoop) {
        // A hovering boss steers onto the arc by speed (its centre and feet), like its hover.
        const dt = Math.max(dtMs, 1) / 1000;
        body.setVelocity((p.x - body.center.x) / dt, (p.y - body.bottom) / dt);
      } else {
        body.setVelocityX(0);
        body.reset(p.x, spriteYForFeet(p.y, stats.frame.height, stats.body));
      }
      if (p.done) {
        this.leap = null;
        if (!leap.swoop) out.shots.push(...this.shockwaves([-1, 1]));
      }
    } else if (stats.hover && (this.state.mode === 'fight' || this.state.mode === 'intro')) {
      // Hovering: bob up and down while it drifts (its x is still driven by the rules). Steer
      // its height by speed, not by placing it: physics moves bodies before this runs, so
      // placing it at the sprite's (older) position would undo this frame's drift.
      this.hoverMs += dtMs;
      const bob = hoverBob(this.hoverMs, stats.hover.bobPx, stats.hover.bobMs);
      const dt = Math.max(dtMs, 1) / 1000;
      body.setVelocityY((this.restFeetY + bob - body.bottom) / dt);
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
      const sheet = s.sheet ? { sheet: s.sheet } : {};
      for (const v of fanVelocities(aimed, s.count, s.spreadDeg)) {
        out.shots.push({ ...m, ...v, ...sheet });
      }
    } else if (attack === 'leap' && stats.leap && target && !this.leap) {
      // Jump onto the marine's spot (kept to its range), the landing marked while in the air.
      const from = { x: this.sprite.body.center.x, y: this.feetY };
      const to = { x: Phaser.Math.Clamp(target.x, range.min, range.max), y: this.feetY };
      const { durationMs, height } = stats.leap;
      this.leap = { from, to, ms: 0, durationMs, height, swoop: false };
      out.landings.push({ ...to, ms: durationMs });
    } else if (attack === 'wave' && stats.shockwave && target) {
      // Acid breathed out, rolling along the floor at the marine (the demon, M5.3).
      out.shots.push(...this.shockwaves([target.x < this.sprite.body.center.x ? -1 : 1]));
    } else if (attack === 'swoop' && stats.swoop && target && !this.leap) {
      // A dive across the arena, lowest over the marine; the spot is marked first (M5.3).
      const y = this.restFeetY;
      const from = { x: this.sprite.body.center.x, y };
      const to = { x: swoopEnd(from.x, target.x, range), y };
      const { durationMs, dip } = stats.swoop;
      this.leap = { from, to, ms: 0, durationMs, height: -dip, swoop: true };
      out.landings.push({ x: (from.x + to.x) / 2, y: this.feetY, ms: durationMs / 2 });
    }
  }

  /** Shots rolling along the floor away from the boss, one each way given. */
  private shockwaves(directions: readonly (-1 | 1)[]): EnemyShot[] {
    const w = this.stats.shockwave;
    if (!w) return [];
    const x = this.sprite.body.center.x;
    const sheet = w.sheet ? { sheet: w.sheet } : {};
    return directions.map((d) => ({
      x: x + d * (this.stats.body.width / 2),
      y: this.feetY - w.height,
      vx: d * w.speed,
      vy: 0,
      ...sheet,
    }));
  }

  snapshot(): BossSnapshot {
    return {
      type: this.type,
      x: Math.round(this.sprite.body.center.x),
      y: Math.round(this.sprite.body.center.y),
      feetY: Math.round(this.sprite.body.bottom),
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
