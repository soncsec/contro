import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { WEAPON } from '../config/tuning';
import { shellLanded } from '../logic/boss';
import { bulletOutOfView } from '../logic/weapon';
import type { EnemyShot } from './Enemies';

type Orb = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

/** Most enemy shots on screen at once. */
const MAX_SHOTS = 12;
/** The glowing core of the 16×16 orb sprite. */
const CORE = 6;

/**
 * Enemy shots (slow glowing orbs), reused from a pool. Like the marine's bullets they pass
 * through walls, floors and catwalks (M3.12, as in Contra) and end when they leave the view.
 * A lobbed shell instead bursts when it comes down to its marked landing point.
 */
export class EnemyShots {
  readonly group: Phaser.Physics.Arcade.Group;
  fired = 0;
  /** Lobbed shells that have burst on landing since the level started (for tests). */
  landed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onLand: (x: number, y: number) => void,
  ) {
    this.group = scene.physics.add.group({
      defaultKey: 'enemy-shot',
      maxSize: MAX_SHOTS,
      allowGravity: false,
    });
  }

  fire(shot: EnemyShot): boolean {
    const orb = this.group.get(shot.x, shot.y) as Orb | null;
    if (!orb) return false;
    orb.setActive(true).setVisible(true);
    orb.body.enable = true;
    orb.body.reset(shot.x, shot.y);
    orb.body.setSize(CORE, CORE, true);
    orb.body.setAllowGravity(shot.gravity === true);
    orb.body.setVelocity(shot.vx, shot.vy);
    orb.setData('lobbed', shot.gravity === true);
    orb.setData('burstAtY', shot.burstAtY ?? null);
    orb.play(animKey('enemy-shot'));
    this.fired++;
    return true;
  }

  /** Removes an orb (it hit the marine, landed, or left the view). */
  remove(orb: Orb): void {
    if (!orb.active) return;
    orb.body.stop();
    orb.body.enable = false;
    this.group.killAndHide(orb);
  }

  /** Bursts shells that have reached their landing point; removes orbs that left the view. */
  update(): void {
    const view = this.scene.cameras.main.worldView;
    for (const child of this.group.getChildren()) {
      const orb = child as Orb;
      if (!orb.active) continue;
      const landY = orb.getData('burstAtY') as number | null;
      if (landY !== null && shellLanded(orb.y, orb.body.velocity.y, landY)) {
        this.landed++;
        this.onLand(orb.x, landY);
        this.remove(orb);
      } else if (bulletOutOfView(orb.x, orb.y, view, WEAPON.offscreenMargin)) {
        this.remove(orb);
      }
    }
  }

  get active(): number {
    return this.group.countActive(true);
  }
}
