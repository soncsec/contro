import Phaser from 'phaser';
import { AIM_MUZZLES } from '../assets/aimMuzzles.generated';
import { animKey } from '../assets/manifest';
import {
  HEALTH,
  MOVEMENT,
  MUZZLE,
  MUZZLE_FLASH_ANCHOR,
  MUZZLE_FLASH_DIAG_ANCHOR,
  PLAYER_BODY,
  PLAYER_CROUCH_BODY,
  PLAYER_FRAME,
  WEAPON,
} from '../config/tuning';
import { marineAnim, stanceFor, type Aim, type MarineAnim } from '../logic/aim';
import { bodyOffsetX, framePointToWorld, spriteYForFeet, type BodyBox } from '../logic/body';
import { horizontalDirection, type ActionFrame } from '../logic/input';
import { initialMovement, stepMovement, type MovementState } from '../logic/movement';
import {
  initialHealth,
  stepHealth,
  takeHit,
  visibleWhileInvulnerable,
  type HealthState,
  type HitResult,
  type StepEvent,
} from '../logic/health';
import { initialWeapon, stepWeapon, type WeaponState } from '../logic/weapon';

const ANIM_SHEETS: Readonly<Record<MarineAnim, string>> = {
  idle: 'marine-idle',
  run: 'marine-run',
  jump: 'marine-jump',
  shoot: 'marine-shoot',
  crouch: 'marine-crouch',
  'crouch-shoot': 'marine-crouch-shoot',
  'aim-diag': 'marine-aim-diag',
  'shoot-diag': 'marine-shoot-diag',
  'run-diag': 'marine-run-diag',
};

/** Barrel tips per animation: measured (tuning.ts) or generated with the derived art. */
const MUZZLES: Readonly<Record<MarineAnim, readonly (readonly [number, number])[]>> = {
  ...MUZZLE,
  'aim-diag': AIM_MUZZLES['marine-aim-diag'] ?? [],
  'shoot-diag': AIM_MUZZLES['marine-shoot-diag'] ?? [],
  'run-diag': AIM_MUZZLES['marine-run-diag'] ?? [],
};

/** Animations whose frames already show the muzzle flash. */
const FLASH_DRAWN_IN: ReadonlySet<MarineAnim> = new Set(['shoot', 'crouch-shoot', 'shoot-diag']);

export interface PlayerSnapshot {
  x: number;
  feetY: number;
  vx: number;
  vy: number;
  onFloor: boolean;
  facing: 'left' | 'right';
  anim: MarineAnim | 'die';
  crouching: boolean;
  aim: Aim;
  hp: number;
  lives: number;
  invulnerable: boolean;
  dead: boolean;
}

/** What happened to the player this frame. */
export interface PlayerUpdate {
  shot: Shot | null;
  /** 'respawn' or 'game-over' once the respawn delay after a death has passed. */
  event: StepEvent;
}

/** Where a shot starts, which way the marine faces, and how he aims. */
export interface Shot {
  x: number;
  y: number;
  direction: -1 | 1;
  aim: Aim;
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
  private anim: MarineAnim | 'die' = 'idle';
  private crouching = false;
  private aim: Aim = 'forward';
  private box: BodyBox = PLAYER_BODY;
  private health: HealthState = initialHealth(HEALTH);

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    this.sprite = scene.physics.add.sprite(
      x,
      spriteYForFeet(feetY, PLAYER_FRAME.height, PLAYER_BODY),
      ANIM_SHEETS.idle,
    );
    this.setBody(PLAYER_BODY);
    this.face('right');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.play(animKey(ANIM_SHEETS.idle));

    this.flash = scene.add.sprite(0, 0, 'muzzle-flash').setVisible(false);
    this.flash.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.flash.setVisible(false));
  }

  /** Moves the marine for this frame: health timers, movement, shooting, animation. */
  update(dtMs: number, input: ActionFrame): PlayerUpdate {
    const step = stepHealth(this.health, dtMs, HEALTH);
    this.health = step.state;
    this.sprite.setVisible(visibleWhileInvulnerable(this.health.invulnerableMs, HEALTH.blinkMs));
    if (this.health.deadMs !== null) {
      this.sprite.body.setVelocityX(0);
      return { shot: null, event: step.event };
    }
    // Right after a hit the knockback plays out and controls are ignored.
    if (this.health.stunMs > 0) return { shot: null, event: step.event };
    return { shot: this.control(dtMs, input), event: step.event };
  }

  /** Takes a hit from something at sourceX: loses health, is knocked away, or dies. */
  hurt(damage: number, sourceX: number): HitResult {
    const r = takeHit(this.health, damage, HEALTH);
    this.health = r.state;
    if (r.result === 'ignored') return r.result;
    this.flash.setVisible(false);
    if (r.result === 'died') {
      this.sprite.body.setVelocity(0, Math.min(this.sprite.body.velocity.y, 0));
      this.anim = 'die';
      this.sprite.play(animKey('marine-die'));
      return r.result;
    }
    const away = this.sprite.body.center.x < sourceX ? -1 : 1;
    this.sprite.body.setVelocity(away * HEALTH.knockbackX, HEALTH.knockbackY);
    return r.result;
  }

  /** Puts the marine back at a respawn point (feet at y), standing and facing right. */
  respawn(x: number, feetY: number): void {
    this.movement = initialMovement();
    this.weapon = initialWeapon();
    this.crouching = false;
    this.aim = 'forward';
    this.setBody(PLAYER_BODY);
    this.face('right');
    this.sprite.body.reset(x, spriteYForFeet(feetY, PLAYER_FRAME.height, PLAYER_BODY));
    this.anim = 'idle';
    this.sprite.play(animKey(ANIM_SHEETS.idle));
  }

  get dead(): boolean {
    return this.health.deadMs !== null;
  }

  /** Movement, stance and shooting from the player's input. Returns the shot fired, if any. */
  private control(dtMs: number, input: ActionFrame): Shot | null {
    const { held, pressed } = input;
    const body = this.sprite.body;
    const stance = stanceFor(held, body.blocked.down);
    const result = stepMovement(
      this.movement,
      {
        direction: horizontalDirection(held),
        jump: held.jump,
        jumpPressed: pressed.jump,
        crouch: stance.crouching,
      },
      { onFloor: body.blocked.down, vy: body.velocity.y },
      dtMs,
      MOVEMENT,
    );
    if (result.state.facing !== this.movement.facing) this.face(result.state.facing);
    this.movement = result.state;
    body.setVelocityX(result.vx);
    if (result.vy !== null) body.setVelocityY(result.vy);

    // Jumping out of a crouch stands the marine up.
    const crouching = stance.crouching && !result.jumped;
    if (crouching !== this.crouching) {
      this.crouching = crouching;
      this.setBody(crouching ? PLAYER_CROUCH_BODY : PLAYER_BODY);
    }
    this.aim = stance.aim;

    const weapon = stepWeapon(this.weapon, held.fire, pressed.fire, dtMs, WEAPON);
    this.weapon = weapon.state;

    // On the take-off frame the body still reports the floor, so use jumped too.
    const onFloor = body.blocked.down && !result.jumped;
    const anim = marineAnim(onFloor, result.vx, held.fire, { crouching, aim: stance.aim });
    if (anim !== this.anim) {
      // The crouch animation is the drop from standing: coming back from crouch-shoot,
      // start on its last frame so the marine stays down.
      const stayDown = anim === 'crouch' && this.anim === 'crouch-shoot';
      this.anim = anim;
      this.sprite.play({
        key: animKey(ANIM_SHEETS[anim]),
        startFrame: stayDown ? MUZZLE.crouch.length - 1 : 0,
      });
    }

    const muzzle = this.muzzle(anim);
    if (this.flash.visible) this.placeFlash(muzzle);
    if (!weapon.fired) return null;
    if (!FLASH_DRAWN_IN.has(anim)) {
      this.flash.setTexture(this.aim === 'diagonal' ? 'muzzle-flash-diag' : 'muzzle-flash');
      this.placeFlash(muzzle);
      this.flash
        .setVisible(true)
        .play(animKey(this.aim === 'diagonal' ? 'muzzle-flash-diag' : 'muzzle-flash'));
    }
    return {
      x: muzzle.x,
      y: muzzle.y,
      direction: this.movement.facing === 'left' ? -1 : 1,
      aim: this.aim,
    };
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
      crouching: this.crouching,
      aim: this.aim,
      hp: this.health.hp,
      lives: this.health.lives,
      invulnerable: this.health.invulnerableMs > 0,
      dead: this.dead,
    };
  }

  /** Barrel tip of the current animation frame, in world pixels. */
  private muzzle(anim: MarineAnim): { x: number; y: number } {
    const frames = MUZZLES[anim];
    const index = Math.max(0, (this.sprite.anims.currentFrame?.index ?? 1) - 1);
    const point = frames[Math.min(index, frames.length - 1)] ?? frames[0] ?? [0, 0];
    return framePointToWorld(this.sprite.x, this.sprite.y, PLAYER_FRAME, point, this.flipped());
  }

  private placeFlash(muzzle: { x: number; y: number }): void {
    const left = this.flipped();
    const anchor = this.aim === 'diagonal' ? MUZZLE_FLASH_DIAG_ANCHOR : MUZZLE_FLASH_ANCHOR;
    this.flash.setFlipX(left);
    // Put the anchor pixel of the flash frame on the barrel tip.
    const w = this.flash.width;
    const ax = left ? w - anchor.x : anchor.x;
    this.flash.setPosition(
      muzzle.x - ax + w / 2,
      muzzle.y - anchor.y + this.flash.height / 2 - 0.5,
    );
  }

  private flipped(): boolean {
    return this.movement.facing === 'left';
  }

  private face(facing: 'left' | 'right'): void {
    const left = facing === 'left';
    this.sprite.setFlipX(left);
    this.placeBody();
  }

  /** Switches between the standing and crouching boxes; the feet stay where they are. */
  private setBody(box: BodyBox): void {
    this.box = box;
    this.sprite.body.setSize(box.width, box.height, false);
    this.placeBody();
  }

  private placeBody(): void {
    this.sprite.body.setOffset(
      bodyOffsetX(PLAYER_FRAME.width, this.box, this.flipped()),
      this.box.offsetY,
    );
  }
}
