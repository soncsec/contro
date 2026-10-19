import Phaser from 'phaser';
import { BACKGROUND_COLOR, CONTINUE, FONT, GAME_WIDTH } from '../config/tuning';
import { formatScore } from '../logic/score';
import { GameSound } from '../systems/GameSound';
import { PlayerInput } from '../systems/PlayerInput';

export interface EndSceneData {
  score: number;
}

const TEXT = { fontFamily: FONT.family, fontSize: FONT.size } as const;
const COLORS = { title: '#ffd166', text: '#e6eef7', dim: '#7f8ea3' };
const LINE = 14;
const HINT_BLINK_MS = 500;

/**
 * After the last level built so far (M3.4): TO BE CONTINUED, thanks and the final score, then
 * the title screen. The ending and credits (M5.4) replace it once all three levels exist.
 */
export class EndScene extends Phaser.Scene {
  private score = 0;
  private controls!: PlayerInput;
  private shownMs = 0;
  private leaving = false;

  constructor() {
    super('End');
  }

  init(data: EndSceneData): void {
    this.score = data.score;
    this.shownMs = 0;
    this.leaving = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);
    const cx = GAME_WIDTH / 2;
    const top = 44;
    this.add
      .text(cx, top, 'TO BE CONTINUED', { ...TEXT, fontSize: FONT.large, color: COLORS.title })
      .setOrigin(0.5);
    this.add
      .text(cx, top + LINE * 2, 'THANKS FOR PLAYING', { ...TEXT, color: COLORS.text })
      .setOrigin(0.5);
    this.add
      .text(cx, top + LINE * 4, `SCORE ${formatScore(this.score)}`, { ...TEXT, color: COLORS.text })
      .setOrigin(0.5);
    const hint = this.add
      .text(cx, top + LINE * 6, 'FIRE / JUMP', { ...TEXT, color: COLORS.dim })
      .setOrigin(0.5);
    this.time.addEvent({
      delay: HINT_BLINK_MS,
      loop: true,
      callback: () => hint.setVisible(!hint.visible),
    });
    this.controls = new PlayerInput(this);
    this.cameras.main.fadeIn(CONTINUE.fadeMs);
  }

  override update(_time: number, deltaMs: number): void {
    this.shownMs += deltaMs;
    const { pressed } = this.controls.frame();
    if (this.leaving || this.shownMs < CONTINUE.inputDelayMs) return;
    if (!(pressed.fire || pressed.jump || pressed.pause)) return;
    this.leaving = true;
    GameSound.play('sfx-select');
    this.cameras.main.fadeOut(CONTINUE.fadeMs);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Title');
    });
  }

  /** Test hook: the score shown and whether input is live. */
  snapshot(): { score: number; ready: boolean } {
    return { score: this.score, ready: !this.leaving && this.shownMs >= CONTINUE.inputDelayMs };
  }
}
