import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { WEAPON } from '../config/tuning';
import { bulletOutOfView } from '../logic/weapon';
import type { EnemyShot } from './Enemies';

type Orb = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

/** Most enemy shots on screen at once. */
const MAX_SHOTS = 12;
/** The glowing core of the 16×16 orb sprite. */
const CORE = 6;

/** Enemy shots (slow glowing orbs), reused from a pool. They pass through nothing but walls. */
export class EnemyShots {
  readonly group: Phaser.Physics.Arcade.Group;
  fired = 0;

  constructor(private readonly scene: Phaser.Scene) {
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
    orb.play(animKey('enemy-shot'));
    this.fired++;
    return true;
  }

  /** Removes an orb (it hit the marine or a wall). */
  remove(orb: Orb): void {
    if (!orb.active) return;
    orb.body.stop();
    orb.body.enable = false;
    this.group.killAndHide(orb);
  }

  /** True for a lobbed shell (it bursts bigger where it lands). */
  lobbed(orb: Orb): boolean {
    return orb.getData('lobbed') === true;
  }

  /** Removes orbs that have left the camera view. */
  update(): void {
    const view = this.scene.cameras.main.worldView;
    for (const child of this.group.getChildren()) {
      const orb = child as Orb;
      if (orb.active && bulletOutOfView(orb.x, orb.y, view, WEAPON.offscreenMargin))
        this.remove(orb);
    }
  }

  get active(): number {
    return this.group.countActive(true);
  }
}
