import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import { MOVEMENT, PLAYER_BODY, PLAYER_FRAME } from '../config/tuning';
import { bodyOffsetX, spriteYForFeet } from '../logic/body';
import { horizontalDirection, type ActionState } from '../logic/input';
import {
  initialMovement,
  playerAnim,
  stepMovement,
  type MovementState,
  type PlayerAnim,
} from '../logic/movement';

const ANIM_SHEETS: Readonly<Record<PlayerAnim, string>> = {
  idle: 'marine-idle',
  run: 'marine-run',
  jump: 'marine-jump',
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

/** The space marine: applies the movement rules to an arcade body and picks the animation. */
export class Player {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private movement: MovementState = initialMovement();
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
  }

  update(dtMs: number, actions: ActionState): void {
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

    // On the take-off frame the body still reports the floor, so use jumped too.
    const anim = result.jumped ? 'jump' : playerAnim(body.blocked.down, result.vx);
    if (anim !== this.anim) {
      this.anim = anim;
      this.sprite.play(animKey(ANIM_SHEETS[anim]));
    }
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

  private face(facing: 'left' | 'right'): void {
    const left = facing === 'left';
    this.sprite.setFlipX(left);
    this.sprite.body.setOffset(
      bodyOffsetX(PLAYER_FRAME.width, PLAYER_BODY, left),
      PLAYER_BODY.offsetY,
    );
  }
}
