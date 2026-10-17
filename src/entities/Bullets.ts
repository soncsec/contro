import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { WEAPON } from '../config/tuning';
import { bulletOutOfView } from '../logic/weapon';
import type { Shot } from './Player';

type Bullet = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

/**
 * The player's bullets, reused from a fixed pool (CLAUDE.md: pooled objects).
 * A bullet ends when it hits level collision or a level edge (with an impact
 * effect) or quietly when it leaves the camera view.
 */
export class Bullets {
  readonly group: Phaser.Physics.Arcade.Group;
  /** Shots fired and impacts made since the level started (for tests). */
  fired = 0;
  impacts = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onImpact: (x: number, y: number, direction: -1 | 1) => void,
  ) {
    this.group = scene.physics.add.group({
      defaultKey: 'bullet',
      maxSize: WEAPON.maxBullets,
      allowGravity: false,
    });
    scene.physics.world.on(
      Phaser.Physics.Arcade.Events.WORLD_BOUNDS,
      (body: Phaser.Physics.Arcade.Body) => {
        const bullet = body.gameObject as Bullet;
        if (this.group.contains(bullet)) this.hit(bullet);
      },
    );
  }

  /** Fires a bullet if the pool has one free. Returns false if all are in flight. */
  fire(shot: Shot): boolean {
    const bullet = this.group.get(shot.x, shot.y) as Bullet | null;
    if (!bullet) return false;
    bullet
      .setActive(true)
      .setVisible(true)
      .setFlipX(shot.direction < 0);
    // The sprite's leading edge starts at the barrel tip.
    bullet.setX(shot.x + (shot.direction * bullet.width) / 2);
    bullet.body.enable = true;
    bullet.body.reset(bullet.x, bullet.y);
    bullet.body.setSize(bullet.width, bullet.height);
    bullet.body.setCollideWorldBounds(true, 0, 0, true);
    bullet.body.setVelocity(shot.direction * WEAPON.bulletSpeed, 0);
    bullet.setData('direction', shot.direction);
    bullet.play(animKey('bullet'));
    this.fired++;
    return true;
  }

  /** Bullet hit level collision or an edge: show an impact and recycle it. */
  hit(bullet: Bullet): void {
    if (!bullet.active) return;
    const direction = bullet.getData('direction') as -1 | 1;
    this.impacts++;
    this.onImpact(bullet.x + (direction * bullet.width) / 2, bullet.y, direction);
    this.release(bullet);
  }

  /**
   * Bullet hit an enemy: recycle it with no wall impact.
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
      if (bullet.active && bulletOutOfView(bullet.x, view.x, view.width, WEAPON.offscreenMargin)) {
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
