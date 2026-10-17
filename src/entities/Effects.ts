import Phaser from 'phaser';
import { animKey } from '../assets/manifest';

/** One-shot animated effects (impacts, deaths) reused from a pool per effect sheet. */
export class Effects {
  private readonly pools = new Map<string, Phaser.GameObjects.Group>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Plays `key`'s default animation once at (x, y); returns false if the pool is full. */
  play(key: string, x: number, y: number, flipX = false, poolSize = 8): boolean {
    let pool = this.pools.get(key);
    if (!pool) {
      pool = this.scene.add.group({ defaultKey: key, maxSize: poolSize });
      this.pools.set(key, pool);
    }
    const sprite = pool.get(x, y) as Phaser.GameObjects.Sprite | null;
    if (!sprite) return false;
    sprite.setActive(true).setVisible(true).setFlipX(flipX).setDepth(1);
    sprite.play(animKey(key));
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => pool.killAndHide(sprite));
    return true;
  }
}
