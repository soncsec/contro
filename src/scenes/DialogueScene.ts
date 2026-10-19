import Phaser from 'phaser';
import { shownFor } from '../logic/menu';
import { BACKGROUND_COLOR, DIALOGUE_CARD, FONT, GAME_WIDTH } from '../config/tuning';
import { DIALOGUE, SPEAKERS, type DialogueId } from '../data/dialogue';
import { GameSound } from '../systems/GameSound';
import { PlayerInput } from '../systems/PlayerInput';
import type { RunState } from './LevelScene';

export interface DialogueSceneData {
  card: DialogueId;
  /** Cards still to show after this one (M3.4: a level's end card, then the next intro). */
  more?: readonly DialogueId[];
  /** Level to start after the last card, or null at the end of the campaign (end screen). */
  nextLevel: string | null;
  /** Score and lives to carry into it. */
  run?: RunState;
}

const PORTRAIT = 48;
const BOX = { x: 16, y: 48, width: GAME_WIDTH - 32, height: 72 } as const;
const COLORS = {
  box: 0x101826,
  border: 0x4fe3c1,
  name: '#ffd166',
  text: '#e6eef7',
  hint: '#7f8ea3',
};
const TEXT = { fontFamily: FONT.family, fontSize: FONT.size } as const;
const HINT_BLINK_MS = 500;

/**
 * A between-rooms card: the speaker's portrait, name and one or two lines.
 * Jump or fire continues to the next level.
 */
export class DialogueScene extends Phaser.Scene {
  private card!: DialogueId;
  private more: readonly DialogueId[] = [];
  private nextLevel: string | null = null;
  private run: RunState | undefined;
  private controls!: PlayerInput;
  private shownMs = 0;
  private leaving = false;

  constructor() {
    super('Dialogue');
  }

  init(data: DialogueSceneData): void {
    this.card = data.card;
    this.more = data.more ?? [];
    this.nextLevel = data.nextLevel;
    this.run = data.run;
    this.shownMs = 0;
    this.leaving = false;
  }

  create(): void {
    const card = DIALOGUE[this.card];
    const speaker = SPEAKERS[card.speaker];
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);

    this.add
      .rectangle(BOX.x, BOX.y, BOX.width, BOX.height, COLORS.box)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border);
    const px = BOX.x + 12;
    const py = BOX.y + (BOX.height - PORTRAIT) / 2;
    this.add
      .rectangle(px - 1, py - 1, PORTRAIT + 2, PORTRAIT + 2)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border);
    this.add.image(px, py, speaker.portrait).setOrigin(0);

    const tx = px + PORTRAIT + 12;
    this.add.text(tx, py + 2, speaker.name, { ...TEXT, color: COLORS.name });
    card.lines.forEach((line, i) => {
      this.add.text(tx, py + 18 + i * 12, line, { ...TEXT, color: COLORS.text });
    });
    const hint = this.add
      .text(BOX.x + BOX.width - 6, BOX.y + BOX.height + 8, 'FIRE / JUMP >', {
        ...TEXT,
        color: COLORS.hint,
      })
      .setOrigin(1, 0);
    this.time.addEvent({
      delay: HINT_BLINK_MS,
      loop: true,
      callback: () => hint.setVisible(!hint.visible),
    });

    this.controls = new PlayerInput(this);
    this.cameras.main.fadeIn(DIALOGUE_CARD.fadeMs);
  }

  override update(_time: number, deltaMs: number): void {
    this.shownMs = shownFor(this.shownMs, deltaMs);
    const { pressed } = this.controls.frame();
    if (this.leaving || this.shownMs < DIALOGUE_CARD.inputDelayMs) return;
    if (pressed.fire || pressed.jump) this.continue();
  }

  /** Test hook: the card on screen and where continuing leads. */
  snapshot(): {
    card: DialogueId;
    more: readonly DialogueId[];
    nextLevel: string | null;
    ready: boolean;
  } {
    return {
      card: this.card,
      more: this.more,
      nextLevel: this.nextLevel,
      ready: this.shownMs >= DIALOGUE_CARD.inputDelayMs,
    };
  }

  private continue(): void {
    this.leaving = true;
    GameSound.play('sfx-select');
    this.cameras.main.fadeOut(DIALOGUE_CARD.fadeMs);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const run = this.run ? { run: this.run } : {};
      const [card, ...more] = this.more;
      if (card) {
        const next: DialogueSceneData = { card, more, nextLevel: this.nextLevel, ...run };
        this.scene.restart(next);
      } else if (this.nextLevel) {
        this.scene.start('Level', { level: this.nextLevel, ...run });
      } else {
        this.scene.start('End', { score: this.run?.score ?? 0 });
      }
    });
  }
}
