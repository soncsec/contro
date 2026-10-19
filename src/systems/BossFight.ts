import Phaser from 'phaser';
import { BOSS_FIGHT, RIFLE_DAMAGE } from '../config/tuning';
import { BOSSES } from '../data/bosses';
import { Boss, type BossSnapshot } from '../entities/Boss';
import type { Bullets } from '../entities/Bullets';
import type { Effects } from '../entities/Effects';
import type { EnemyShots } from '../entities/EnemyShots';
import type { Hud } from '../entities/Hud';
import type { Player } from '../entities/Player';
import type { MusicKey } from '../assets/manifest';
import { arenaLocked } from '../logic/boss';
import { GameSound } from './GameSound';
import type { LevelLayout } from '../logic/levelMap';

/** What the boss fight needs from the level scene. */
export interface BossFightHost {
  scene: Phaser.Scene;
  layout: LevelLayout;
  player: Player;
  bullets: Bullets;
  effects: Effects;
  enemyShots: EnemyShots;
  hud: Hud;
  addScore(points: number): void;
  /** The level is won: leave by the exit. */
  win(): void;
  /** The level's music, back on if the marine dies in the fight (M3.6). */
  levelMusic: MusicKey | null;
}

export type BossFightSnapshot = BossSnapshot & { arenaLocked: boolean; defeated: boolean };

/**
 * A section's boss fight (M3.2): the boss, the wall that closes the arena behind the marine,
 * the camera lock, mortar landing markers, and the level ending once the boss is destroyed.
 * Rules live in src/logic/boss.ts; the boss's numbers in src/data/bosses.ts.
 */
export class BossFight {
  private readonly boss: Boss;
  private readonly wall: Phaser.GameObjects.Zone;
  private readonly markers: Phaser.GameObjects.Rectangle[] = [];
  private locked = false;
  private defeated = false;
  /** Set once the boss's explosion has settled: the level ends as soon as he is alive. */
  private won = false;

  /** The fight for this section, or null if its map has no boss. */
  static create(host: BossFightHost): BossFight | null {
    return host.layout.boss ? new BossFight(host) : null;
  }

  private constructor(private readonly host: BossFightHost) {
    const { scene, layout, bullets, effects, player } = host;
    const spawn = layout.boss as NonNullable<LevelLayout['boss']>;
    const boss = (this.boss = new Boss(scene, spawn, spawn.arena));
    type Bullet = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    scene.physics.add.overlap(boss.sprite, bullets.group, (_boss, bullet) => {
      const tip = bullets.absorb(bullet as Bullet);
      if (!tip) return;
      effects.play('hit', tip.x, tip.y, tip.direction < 0);
      this.damage(RIFLE_DAMAGE);
    });
    scene.physics.add.overlap(player.sprite, boss.sprite, () => {
      if (boss.dangerous) player.hurt(BOSSES[boss.type].contactDamage, boss.sprite.x);
    });
    // Closes behind the marine when the fight starts, so he can't leave the arena.
    const { arena } = spawn;
    const wall = (this.wall = scene.add.zone(arena.x - 8, arena.height / 2, 16, arena.height));
    scene.physics.add.existing(wall, true);
    (wall.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    scene.physics.add.collider(player.sprite, wall);
  }

  /** The exit stays shut until the boss is destroyed. */
  get exitOpen(): boolean {
    return this.defeated;
  }

  /** Hits the boss; destroying it scores its points. */
  damage(amount: number): void {
    if (this.boss.damage(amount).destroyed) this.host.addScore(BOSSES[this.boss.type].points);
  }

  /** One frame. `target` is the middle of the marine (null if he can't be seen). */
  update(deltaMs: number, target: { x: number; y: number } | null): void {
    const { player, enemyShots, effects, hud, layout } = this.host;
    const arena = (layout.boss as NonNullable<LevelLayout['boss']>).arena;
    const p = player.snapshot();
    if (!this.locked && !this.defeated && !p.dead && arenaLocked(p.x, arena)) this.lock();
    const stats = BOSSES[this.boss.type];
    const r = this.boss.update(deltaMs, target);
    for (const shot of r.shots) {
      if (enemyShots.fire(shot)) GameSound.play(shot.gravity ? 'sfx-mortar' : 'sfx-cannon');
    }
    for (const at of r.landings) this.markLanding(at, stats.mortar.flightMs);
    for (const e of r.explosions) {
      GameSound.play('sfx-boss-blast');
      effects.play(stats.explosions.effect, e.x, e.y, false, 6);
    }
    const s = this.boss.snapshot();
    if (this.locked && !this.defeated) hud.boss(stats.name, s.hp / s.maxHp);
    if (r.finished) {
      this.defeated = true;
      hud.boss(null);
      GameSound.music(null);
      this.host.scene.time.delayedCall(BOSS_FIGHT.finishDelayMs, () => (this.won = true));
    }
    // The level ends once the explosion has settled (after a respawn, if a shell got him).
    if (this.won && !player.dead) this.host.win();
  }

  /** The marine respawned: dying in the fight starts it again from the checkpoint before it. */
  onRespawn(): void {
    if (this.locked && !this.defeated) this.unlock();
  }

  snapshot(): BossFightSnapshot {
    return { ...this.boss.snapshot(), arenaLocked: this.locked, defeated: this.defeated };
  }

  /** The fight starts: the camera stays on the arena, its wall closes, the boss rolls in. */
  private lock(): void {
    const { scene, layout } = this.host;
    const arena = (layout.boss as NonNullable<LevelLayout['boss']>).arena;
    this.locked = true;
    scene.cameras.main.setBounds(arena.x, 0, arena.width, layout.heightPx);
    (this.wall.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    this.boss.start();
    GameSound.music('music-boss');
  }

  /** Open the arena and send the boss back to wait. */
  private unlock(): void {
    const { scene, layout, hud } = this.host;
    this.locked = false;
    scene.cameras.main.setBounds(0, 0, layout.widthPx, layout.heightPx);
    (this.wall.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.boss.reset();
    hud.boss(null);
    GameSound.music(this.host.levelMusic);
    for (const m of this.markers) m.setVisible(false);
  }

  /** A blinking mark on the floor where a mortar shell will land. */
  private markLanding(at: { x: number; y: number }, flightMs: number): void {
    const { scene } = this.host;
    let marker = this.markers.find((m) => !m.visible);
    if (!marker) {
      marker = scene.add.rectangle(0, 0, 12, 3, 0xff4f4f).setOrigin(0.5, 1).setDepth(2);
      this.markers.push(marker);
    }
    const m = marker;
    scene.tweens.killTweensOf(m);
    m.setPosition(at.x, at.y).setVisible(true).setAlpha(1);
    const blink = BOSS_FIGHT.markerBlinkMs;
    scene.tweens.add({
      targets: m,
      alpha: 0.2,
      duration: blink,
      yoyo: true,
      repeat: Math.max(0, Math.floor(flightMs / (2 * blink)) - 1),
      onComplete: () => m.setVisible(false),
    });
  }
}
