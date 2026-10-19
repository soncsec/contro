import Phaser from 'phaser';
import { BACKGROUND_COLOR, CONTINUE, FONT, GAME_WIDTH, HEALTH } from '../config/tuning';
import { continueOptions, useContinue, type ContinueOption } from '../logic/continues';
import { stepMenu } from '../logic/menu';
import { formatScore } from '../logic/score';
import { PlayerInput } from '../systems/PlayerInput';
import type { LevelSceneData } from './LevelScene';

export interface ContinueSceneData {
  /** The section the marine died in: continuing restarts it. */
  level: string;
  /** Continues left in this run, before using one. */
  left: number;
  /** The run's final score, shown on the screen. */
  score: number;
}

const TEXT = { fontFamily: FONT.family, fontSize: FONT.size } as const;
const COLORS = {
  title: '#ff4fd8',
  text: '#e6eef7',
  option: '#7f8ea3',
  selected: '#e6eef7',
  dim: '#7f8ea3',
};
const LINE = 14;
const HINT_BLINK_MS = 500;

/**
 * After game over (M3.4): CONTINUE restarts the section with full lives and the score back to
 * zero, using one continue; QUIT returns to the title. With none left, any press returns to
 * the title. Up/down choose, jump or fire select.
 */
export class ContinueScene extends Phaser.Scene {
  private info!: ContinueSceneData;
  private options: readonly ContinueOption[] = [];
  private controls!: PlayerInput;
  private index = 0;
  private shownMs = 0;
  private leaving = false;
  private items: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Continue');
  }

  init(data: ContinueSceneData): void {
    this.info = data;
    this.options = continueOptions(data.left);
    this.index = 0;
    this.shownMs = 0;
    this.leaving = false;
    this.items = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);
    const cx = GAME_WIDTH / 2;
    const top = 40;
    this.add
      .text(cx, top, 'GAME OVER', { ...TEXT, fontSize: FONT.large, color: COLORS.title })
      .setOrigin(0.5);
    this.add
      .text(cx, top + LINE * 2, `SCORE ${formatScore(this.info.score)}`, {
        ...TEXT,
        color: COLORS.text,
      })
      .setOrigin(0.5);
    if (this.options.length > 0) {
      this.items = this.options.map((label, i) =>
        this.add.text(cx, top + LINE * (4 + i), label, { ...TEXT }).setOrigin(0.5),
      );
      this.add
        .text(cx, top + LINE * 7, `CONTINUES LEFT ${this.info.left}`, {
          ...TEXT,
          color: COLORS.dim,
        })
        .setOrigin(0.5);
      this.highlight();
    } else {
      const hint = this.add
        .text(cx, top + LINE * 5, 'FIRE / JUMP', { ...TEXT, color: COLORS.dim })
        .setOrigin(0.5);
      this.time.addEvent({
        delay: HINT_BLINK_MS,
        loop: true,
        callback: () => hint.setVisible(!hint.visible),
      });
    }
    this.controls = new PlayerInput(this);
    this.cameras.main.fadeIn(CONTINUE.fadeMs);
  }

  override update(_time: number, deltaMs: number): void {
    this.shownMs += deltaMs;
    const { pressed } = this.controls.frame();
    if (this.leaving || this.shownMs < CONTINUE.inputDelayMs) return;
    if (this.options.length === 0) {
      if (pressed.fire || pressed.jump || pressed.pause) this.leave('QUIT');
      return;
    }
    const step = stepMenu(this.index, this.options.length, pressed);
    if (step.index !== this.index) {
      this.index = step.index;
      this.highlight();
    }
    if (step.choose) this.leave(this.options[this.index] ?? 'QUIT');
  }

  /** Test hook: the highlighted option (null with none left), continues left, input live. */
  snapshot(): { option: ContinueOption | null; left: number; ready: boolean } {
    return {
      option: this.options[this.index] ?? null,
      left: this.info.left,
      ready: !this.leaving && this.shownMs >= CONTINUE.inputDelayMs,
    };
  }

  private leave(option: ContinueOption): void {
    this.leaving = true;
    this.cameras.main.fadeOut(CONTINUE.fadeMs);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (option === 'QUIT') {
        this.scene.start('Title');
        return;
      }
      // A fresh start of the same section: full lives and health, the score back to zero.
      const data: LevelSceneData = {
        level: this.info.level,
        run: { score: 0, lives: HEALTH.lives, continues: useContinue(this.info.left) },
      };
      this.scene.start('Level', data);
    });
  }

  private highlight(): void {
    this.items.forEach((item, i) => {
      const label = this.options[i] ?? '';
      const on = i === this.index;
      item.setText(on ? `> ${label} <` : label).setColor(on ? COLORS.selected : COLORS.option);
    });
  }
}
