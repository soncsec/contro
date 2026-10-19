import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { WEAPON } from '../config/tuning';
import { shotVelocity } from '../logic/aim';
import { bulletOutOfView } from '../logic/weapon';
import type { Shot } from './Player';

type Bullet = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

/**
 * The player's bullets, reused from a fixed pool (CLAUDE.md: pooled objects).
 * Bullets pass through walls, floors and catwalks, as in Contra (M3.12, owner request):
 * only enemies stop them. A bullet ends quietly when it leaves the camera view or the level.
 */
export class Bullets {
  readonly group: Phaser.Physics.Arcade.Group;
  /** Shots fired since the level started (for tests). */
  fired = 0;
  firedDiagonal = 0;
  /** Where the most recent shot started (for tests). */
  lastShot: Shot | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.group = scene.physics.add.group({
      defaultKey: 'bullet',
      maxSize: WEAPON.maxBullets,
      allowGravity: false,
    });
    scene.physics.world.on(
      Phaser.Physics.Arcade.Events.WORLD_BOUNDS,
      (body: Phaser.Physics.Arcade.Body) => {
        const bullet = body.gameObject as Bullet;
        if (this.group.contains(bullet)) this.release(bullet);
      },
    );
  }

  /** Fires a bullet if the pool has one free. Returns false if all are in flight. */
  fire(shot: Shot): boolean {
    const bullet = this.group.get(shot.x, shot.y) as Bullet | null;
    if (!bullet) return false;
    const diagonal = shot.aim === 'diagonal';
    const key = diagonal ? 'bullet-diag' : 'bullet';
    bullet
      .setTexture(key)
      .setActive(true)
      .setVisible(true)
      .setFlipX(shot.direction < 0);
    // The sprite's leading edge (or corner, when diagonal) starts at the barrel tip.
    bullet.setPosition(
      shot.x + (shot.direction * bullet.width) / 2,
      diagonal ? shot.y - bullet.height / 2 : shot.y,
    );
    bullet.body.enable = true;
    bullet.body.reset(bullet.x, bullet.y);
    // Diagonal bullets get a small square box around the round in the middle of the sprite.
    if (diagonal) bullet.body.setSize(6, 6, true);
    else bullet.body.setSize(bullet.width, bullet.height, true);
    bullet.body.setCollideWorldBounds(true, 0, 0, true);
    const v = shotVelocity(shot.direction, shot.aim, WEAPON.bulletSpeed);
    bullet.body.setVelocity(v.vx, v.vy);
    bullet.setData('direction', shot.direction);
    bullet.setData('aim', shot.aim);
    bullet.play(animKey(key));
    this.fired++;
    if (diagonal) this.firedDiagonal++;
    this.lastShot = shot;
    return true;
  }

  /**
   * Bullet hit an enemy: recycle it.
   * Returns the bullet's leading edge (where the hit effect goes), or null if it was spent.
   */
  absorb(bullet: Bullet): { x: number; y: number; direction: -1 | 1 } | null {
    if (!bullet.active) return null;
    const direction = bullet.getData('direction') as -1 | 1;
    const tip = { x: bullet.x + (direction * bullet.width) / 2, y: bullet.y, direction };
    this.release(bullet);
    return tip;
  }

  /** Removes bullets that have left the camera view. */
  update(): void {
    const view = this.scene.cameras.main.worldView;
    for (const child of this.group.getChildren()) {
      const bullet = child as Bullet;
      if (bullet.active && bulletOutOfView(bullet.x, bullet.y, view, WEAPON.offscreenMargin)) {
        this.release(bullet);
      }
    }
  }

  get active(): number {
    return this.group.countActive(true);
  }

  private release(bullet: Bullet): void {
    bullet.body.stop();
    bullet.body.enable = false;
    this.group.killAndHide(bullet);
  }
}
