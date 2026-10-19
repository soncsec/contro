import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { HIT_FLASH_MS } from '../config/tuning';
import { BLIMP, PICKUP, WEAPONS, type PickupWeapon } from '../data/weapons';
import { applyDamage } from '../logic/enemy';
import { podPosition } from '../logic/pickups';

type Body = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
type Img = Phaser.Types.Physics.Arcade.ImageWithDynamicBody;

interface BlimpRecord {
  sprite: Body;
  weapon: PickupWeapon;
  start: { x: number; y: number };
  direction: -1 | 1;
  ms: number;
  hp: number;
  flashMs: number;
}

export interface BlimpSnapshot {
  weapon: PickupWeapon;
  x: number;
  y: number;
  hp: number;
}

export interface PickupSnapshot {
  weapon: PickupWeapon;
  x: number;
  feetY: number;
  onFloor: boolean;
}

/**
 * Weapon blimps and the letters they drop (M4.1). A map's blimp sets off once its point
 * scrolls into view, from that screen edge, and flies across in a slow wave; shot down, it
 * drops its letter, which pops up and falls to the ground for the marine to walk into.
 * Both are pooled (CLAUDE.md). Rules in src/logic/pickups.ts; numbers in src/data/weapons.ts.
 */
export class Blimps {
  readonly blimpGroup: Phaser.Physics.Arcade.Group;
  readonly pickupGroup: Phaser.Physics.Arcade.Group;
  private readonly blimps: BlimpRecord[] = [];
  private readonly waiting: {
    x: number;
    y: number;
    weapon: PickupWeapon;
    from: 'left' | 'right';
  }[];

  constructor(
    private readonly scene: Phaser.Scene,
    placed: readonly { x: number; y: number; weapon: string; from: 'left' | 'right' }[],
    private readonly onDestroyed: (x: number, y: number) => void,
  ) {
    this.blimpGroup = scene.physics.add.group({ allowGravity: false });
    this.pickupGroup = scene.physics.add.group();
    this.waiting = placed.map((b) => ({ ...b, weapon: b.weapon as PickupWeapon }));
  }

  /** Sends a blimp across from one edge of the view now (maps, and the e2e test hook). */
  launch(
    weapon: PickupWeapon,
    y: number,
    from: 'left' | 'right',
    view: { left: number; right: number },
  ): void {
    const direction = from === 'left' ? 1 : -1;
    const x = from === 'left' ? view.left - BLIMP.margin : view.right + BLIMP.margin;
    let r = this.blimps.find((b) => !b.sprite.active);
    if (r) {
      r.sprite.setActive(true).setVisible(true);
      r.sprite.body.enable = true;
      r.sprite.body.reset(x, y);
    } else {
      const sprite = this.blimpGroup.create(x, y, BLIMP.sheet) as Body;
      sprite.body.setSize(BLIMP.body.width, BLIMP.body.height, false);
      sprite.play(animKey(BLIMP.sheet));
      r = { sprite, weapon, start: { x, y }, direction, ms: 0, hp: BLIMP.hp, flashMs: 0 };
      sprite.setData('record', r);
      this.blimps.push(r);
    }
    Object.assign(r, { weapon, start: { x, y }, direction, ms: 0, hp: BLIMP.hp, flashMs: 0 });
    // Flying left uses the mirrored sheet (its number still reads 07); the box mirrors too.
    const flipped = direction < 0;
    const sheet = flipped ? BLIMP.sheetLeft : BLIMP.sheet;
    r.sprite.setTexture(sheet).play(animKey(sheet)).clearTint();
    r.sprite.body.setOffset(
      flipped ? BLIMP.frame.width - BLIMP.body.offsetX - BLIMP.body.width : BLIMP.body.offsetX,
      BLIMP.body.offsetY,
    );
  }

  update(dtMs: number, view: { left: number; right: number }, mapHeight: number): void {
    // Map blimps set off once their point is in view.
    for (let i = this.waiting.length - 1; i >= 0; i--) {
      const b = this.waiting[i];
      if (b && b.x >= view.left && b.x <= view.right) {
        this.launch(b.weapon, b.y, b.from, view);
        this.waiting.splice(i, 1);
      }
    }
    for (const r of this.blimps) {
      if (!r.sprite.active) continue;
      r.ms += dtMs;
      const p = podPosition(r.start, r.direction, r.ms, BLIMP.pod);
      r.sprite.body.reset(p.x, p.y);
      if (r.flashMs > 0) {
        r.flashMs -= dtMs;
        if (r.flashMs <= 0) r.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      }
      const gone =
        r.direction > 0 ? p.x > view.right + BLIMP.margin * 2 : p.x < view.left - BLIMP.margin * 2;
      if (gone) this.hide(r.sprite);
    }
    // A letter that fell into a pit is lost.
    for (const child of this.pickupGroup.getChildren()) {
      const pick = child as Img;
      if (pick.active && pick.body.top > mapHeight) this.hide(pick);
    }
  }

  /** A bullet hit this blimp. Returns true if it was flying and took the hit. */
  damage(sprite: Phaser.GameObjects.GameObject, amount: number): boolean {
    const r = sprite.getData('record') as BlimpRecord | undefined;
    if (!r || !r.sprite.active) return false;
    const result = applyDamage(r.hp, amount);
    r.hp = result.hp;
    if (!result.dead) {
      r.flashMs = HIT_FLASH_MS;
      r.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      return true;
    }
    const { x, y } = r.sprite.body.center;
    this.hide(r.sprite);
    this.onDestroyed(x, y);
    this.drop(r.weapon, x, y);
    return true;
  }

  /** The marine walked into this letter: it's collected. Returns its weapon, or null. */
  collect(sprite: Phaser.GameObjects.GameObject): PickupWeapon | null {
    const pick = sprite as Img;
    if (!pick.active) return null;
    const weapon = pick.getData('weapon') as PickupWeapon;
    this.hide(pick);
    return weapon;
  }

  snapshot(): { blimps: BlimpSnapshot[]; pickups: PickupSnapshot[] } {
    return {
      blimps: this.blimps
        .filter((r) => r.sprite.active)
        .map((r) => ({
          weapon: r.weapon,
          x: Math.round(r.sprite.body.center.x),
          y: Math.round(r.sprite.body.center.y),
          hp: r.hp,
        })),
      pickups: this.pickupGroup.getChildren().flatMap((child) => {
        const p = child as Img;
        if (!p.active) return [];
        return [
          {
            weapon: p.getData('weapon') as PickupWeapon,
            x: Math.round(p.body.center.x),
            feetY: Math.round(p.body.bottom),
            onFloor: p.body.blocked.down,
          },
        ];
      }),
    };
  }

  /** The letter pops up from where the blimp burst, then falls. */
  private drop(weapon: PickupWeapon, x: number, y: number): void {
    const key = WEAPONS[weapon].pickup ?? 'pickup-machine-gun';
    let pick = this.pickupGroup.getChildren().find((c) => !c.active) as Img | undefined;
    if (pick) {
      pick.setTexture(key).setActive(true).setVisible(true);
      pick.body.enable = true;
      pick.body.reset(x, y);
    } else {
      pick = this.scene.physics.add.image(x, y, key);
      this.pickupGroup.add(pick);
      pick.body.setSize(PICKUP.body.width, PICKUP.body.height);
    }
    pick.setData('weapon', weapon);
    pick.body.setVelocity(0, PICKUP.popVy);
  }

  private hide(obj: Body | Img): void {
    obj.body.stop();
    obj.body.enable = false;
    obj.setActive(false).setVisible(false);
  }
}
