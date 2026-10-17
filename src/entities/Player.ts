import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import {
  MOVEMENT,
  MUZZLE,
  MUZZLE_FLASH_ANCHOR,
  PLAYER_BODY,
  PLAYER_FRAME,
  WEAPON,
} from '../config/tuning';
import { bodyOffsetX, framePointToWorld, spriteYForFeet } from '../logic/body';
import { horizontalDirection, type ActionState } from '../logic/input';
import {
  initialMovement,
  playerAnim,
  stepMovement,
  type MovementState,
  type PlayerAnim,
} from '../logic/movement';
import { initialWeapon, stepWeapon, type WeaponState } from '../logic/weapon';

const ANIM_SHEETS: Readonly<Record<PlayerAnim, string>> = {
  idle: 'marine-idle',
  run: 'marine-run',
  jump: 'marine-jump',
  shoot: 'marine-shoot',
};

export interface PlayerSnapshot {
  x: number;
  feetY: number;
  vx: number;
  vy: number;
  onFloor: boolean;
  facing: 'left' | 'right';
  anim: PlayerAnim;
}

/** Where a shot starts and which way it goes. */
export interface Shot {
  x: number;
  y: number;
  direction: -1 | 1;
}

/**
 * The space marine: applies the movement and weapon rules to an arcade body,
 * picks the animation, and shows a muzzle flash when firing on the move.
 */
export class Player {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private readonly flash: Phaser.GameObjects.Sprite;
  private movement: MovementState = initialMovement();
  private weapon: WeaponState = initialWeapon();
  private anim: PlayerAnim = 'idle';

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    this.sprite = scene.physics.add.sprite(
      x,
      spriteYForFeet(feetY, PLAYER_FRAME.height, PLAYER_BODY),
      ANIM_SHEETS.idle,
    );
    this.sprite.body.setSize(PLAYER_BODY.width, PLAYER_BODY.height);
    this.face('right');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.play(animKey(ANIM_SHEETS.idle));

    this.flash = scene.add.sprite(0, 0, 'muzzle-flash').setVisible(false);
    this.flash.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.flash.setVisible(false));
  }

  /** Moves the marine for this frame. Returns the shot fired this frame, if any. */
  update(dtMs: number, actions: ActionState): Shot | null {
    const body = this.sprite.body;
    const result = stepMovement(
      this.movement,
      { direction: horizontalDirection(actions), jump: actions.jump },
      { onFloor: body.blocked.down, vy: body.velocity.y },
      dtMs,
      MOVEMENT,
    );
    if (result.state.facing !== this.movement.facing) this.face(result.state.facing);
    this.movement = result.state;
    body.setVelocityX(result.vx);
    if (result.vy !== null) body.setVelocityY(result.vy);

    const weapon = stepWeapon(this.weapon, actions.fire, dtMs, WEAPON);
    this.weapon = weapon.state;

    // On the take-off frame the body still reports the floor, so use jumped too.
    const onFloor = body.blocked.down && !result.jumped;
    const anim = playerAnim(onFloor, result.vx, actions.fire);
    if (anim !== this.anim) {
      this.anim = anim;
      this.sprite.play(animKey(ANIM_SHEETS[anim]));
    }

    const muzzle = this.muzzle();
    if (this.flash.visible) this.placeFlash(muzzle);
    if (!weapon.fired) return null;
    // The shoot pose has its flash drawn in; on the move, show the separate flash.
    if (anim !== 'shoot') {
      this.placeFlash(muzzle);
      this.flash.setVisible(true).play(animKey('muzzle-flash'));
    }
    return { x: muzzle.x, y: muzzle.y, direction: this.movement.facing === 'left' ? -1 : 1 };
  }

  /** Test hook: move to x without changing height. */
  teleport(x: number): void {
    this.sprite.body.reset(x, this.sprite.y);
  }

  snapshot(): PlayerSnapshot {
    const body = this.sprite.body;
    return {
      x: Math.round(body.center.x),
      feetY: Math.round(body.bottom),
      vx: Math.round(body.velocity.x),
      vy: Math.round(body.velocity.y),
      onFloor: body.blocked.down,
      facing: this.movement.facing,
      anim: this.anim,
    };
  }

  /** Barrel tip of the current animation frame, in world pixels. */
  private muzzle(): { x: number; y: number } {
    const frames = MUZZLE[this.anim];
    const index = Math.max(0, (this.sprite.anims.currentFrame?.index ?? 1) - 1);
    const point = frames[Math.min(index, frames.length - 1)] ?? frames[0] ?? [0, 0];
    return framePointToWorld(this.sprite.x, this.sprite.y, PLAYER_FRAME, point, this.flipped());
  }

  private placeFlash(muzzle: { x: number; y: number }): void {
    const left = this.flipped();
    this.flash.setFlipX(left);
    // Put the anchor pixel of the flash frame on the barrel tip.
    const w = this.flash.width;
    const ax = left ? w - MUZZLE_FLASH_ANCHOR.x : MUZZLE_FLASH_ANCHOR.x;
    this.flash.setPosition(
      muzzle.x - ax + w / 2,
      muzzle.y - MUZZLE_FLASH_ANCHOR.y + this.flash.height / 2 - 0.5,
    );
  }

  private flipped(): boolean {
    return this.movement.facing === 'left';
  }

  private face(facing: 'left' | 'right'): void {
    const left = facing === 'left';
    this.sprite.setFlipX(left);
    this.sprite.body.setOffset(
      bodyOffsetX(PLAYER_FRAME.width, PLAYER_BODY, left),
      PLAYER_BODY.offsetY,
    );
  }
}
