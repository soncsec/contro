import Phaser from 'phaser';
import {
  BACKGROUND_COLOR,
  CONTINUE,
  ENDING,
  FONT,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '../config/tuning';
import { CREDITS } from '../data/credits';
import { creditsDone, creditsTop } from '../logic/credits';
import { shownFor } from '../logic/menu';
import { formatScore } from '../logic/score';
import { GameSound } from '../systems/GameSound';
import { PlayerInput } from '../systems/PlayerInput';
import { SaveStore } from '../systems/SaveStore';

export interface EndSceneData {
  score: number;
}

const TEXT = { fontFamily: FONT.family, fontSize: FONT.size } as const;
const COLORS = { title: '#ffd166', text: '#e6eef7', dim: '#7f8ea3', heading: '#22c77f' };
const LINE = 14;
const HINT_BLINK_MS = 500;

type Phase = 'ending' | 'credits';

/**
 * The ending (M5.4), after the last level's card: MISSION COMPLETE with the final and best
 * scores, then the credits roll over the ending theme, then the title screen. A press moves on
 * (from the ending to the credits, from the credits to the title); the ending also moves on by
 * itself after a while, and the credits once they have rolled off the top.
 */
export class EndScene extends Phaser.Scene {
  private score = 0;
  private controls!: PlayerInput;
  private shownMs = 0;
  private leaving = false;
  private phase: Phase = 'ending';
  private phaseMs = 0;
  private ending!: Phaser.GameObjects.Container;
  private credits!: Phaser.GameObjects.Container;

  constructor() {
    super('End');
  }

  init(data: EndSceneData): void {
    this.score = data.score;
    this.shownMs = 0;
    this.leaving = false;
    this.phase = 'ending';
    this.phaseMs = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);
    const cx = GAME_WIDTH / 2;
    const top = 40;
    const best = SaveStore.load().bestScore;
    const hint = this.add
      .text(cx, top + LINE * 7, 'FIRE / JUMP', { ...TEXT, color: COLORS.dim })
      .setOrigin(0.5);
    this.ending = this.add.container(0, 0, [
      this.add
        .text(cx, top, 'MISSION COMPLETE', { ...TEXT, fontSize: FONT.large, color: COLORS.title })
        .setOrigin(0.5),
      this.add
        .text(cx, top + LINE * 2, 'THE HIVE IS SILENT', { ...TEXT, color: COLORS.text })
        .setOrigin(0.5),
      this.add
        .text(cx, top + LINE * 4, `SCORE ${formatScore(this.score)}`, {
          ...TEXT,
          color: COLORS.text,
        })
        .setOrigin(0.5),
      this.add
        .text(cx, top + LINE * 5, `BEST  ${formatScore(Math.max(best, this.score))}`, {
          ...TEXT,
          color: COLORS.dim,
        })
        .setOrigin(0.5),
      hint,
    ]);
    this.time.addEvent({
      delay: HINT_BLINK_MS,
      loop: true,
      callback: () => hint.setVisible(!hint.visible),
    });
    this.credits = this.add.container(0, GAME_HEIGHT).setVisible(false);
    CREDITS.forEach((line, i) => {
      this.credits.add(
        this.add
          .text(cx, i * ENDING.lineHeight, line.text, {
            ...TEXT,
            color: line.heading ? COLORS.heading : COLORS.text,
          })
          .setOrigin(0.5, 0),
      );
    });
    this.controls = new PlayerInput(this);
    // The ending theme (M5.4; owner approved 2026-10-20) under the ending and the credits.
    GameSound.loadMusic(this);
    GameSound.music('music-ending');
    this.cameras.main.fadeIn(CONTINUE.fadeMs);
  }

  override update(_time: number, deltaMs: number): void {
    this.shownMs = shownFor(this.shownMs, deltaMs);
    this.phaseMs += deltaMs;
    const { pressed } = this.controls.frame();
    if (this.leaving) return;
    const press =
      this.shownMs >= CONTINUE.inputDelayMs && (pressed.fire || pressed.jump || pressed.pause);
    if (this.phase === 'ending') {
      if (press || this.phaseMs >= ENDING.holdMs) this.startCredits();
      return;
    }
    const top = creditsTop(this.phaseMs, GAME_HEIGHT, ENDING.scrollSpeed);
    this.credits.setY(Math.round(top));
    if (press || creditsDone(top, CREDITS.length, ENDING.lineHeight)) this.leave();
  }

  private startCredits(): void {
    this.phase = 'credits';
    this.phaseMs = 0;
    this.shownMs = 0;
    this.ending.setVisible(false);
    this.credits.setVisible(true).setY(GAME_HEIGHT);
  }

  private leave(): void {
    this.leaving = true;
    GameSound.play('sfx-select');
    this.cameras.main.fadeOut(CONTINUE.fadeMs);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      GameSound.music(null);
      this.scene.start('Title');
    });
  }

  /** Test hook: the score shown, which part is showing, and whether input is live. */
  snapshot(): { score: number; phase: Phase; ready: boolean } {
    return {
      score: this.score,
      phase: this.phase,
      ready: !this.leaving && this.shownMs >= CONTINUE.inputDelayMs,
    };
  }
}
