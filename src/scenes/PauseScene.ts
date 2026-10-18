import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { ACTION_CHEATS, CheatMatcher, WORD_CHEATS, type CheatId } from '../logic/cheats';
import { stepMenu } from '../logic/menu';
import { PlayerInput } from '../systems/PlayerInput';
import type { LevelScene } from './LevelScene';

export interface PauseSceneData {
  level: string;
}

export const PAUSE_OPTIONS = ['RESUME', 'RESTART ROOM'] as const;
export type PauseOption = (typeof PAUSE_OPTIONS)[number];

const TEXT = { fontFamily: 'monospace', fontSize: '8px' } as const;
const COLORS = {
  dim: 0x000000,
  panel: 0x101826,
  border: 0x4fe3c1,
  title: '#ffd166',
  option: '#7f8ea3',
  selected: '#e6eef7',
  cheat: '#ff4fd8',
};
const PANEL = { width: 120, height: 78 } as const;
const DIM_ALPHA = 0.6;
const LINE = 14;

/**
 * Pause menu drawn over the paused level. Up/down choose, jump/fire confirm,
 * pause resumes. The level scene stays paused underneath.
 */
export class PauseScene extends Phaser.Scene {
  private level!: string;
  private controls!: PlayerInput;
  private index = 0;
  private items: Phaser.GameObjects.Text[] = [];
  private actionCodes = new CheatMatcher(ACTION_CHEATS);
  private wordCodes = new CheatMatcher(WORD_CHEATS);
  private message!: Phaser.GameObjects.Text;
  private lastCheat: string | null = null;

  constructor() {
    super('Pause');
  }

  init(data: PauseSceneData): void {
    this.level = data.level;
    this.index = 0;
    this.items = [];
    this.actionCodes = new CheatMatcher(ACTION_CHEATS);
    this.wordCodes = new CheatMatcher(WORD_CHEATS);
    this.lastCheat = null;
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.dim, DIM_ALPHA).setOrigin(0);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL.width, PANEL.height, COLORS.panel)
      .setStrokeStyle(1, COLORS.border);
    const top = GAME_HEIGHT / 2 - LINE * 1.5;
    this.add.text(GAME_WIDTH / 2, top, 'PAUSED', { ...TEXT, color: COLORS.title }).setOrigin(0.5);
    PAUSE_OPTIONS.forEach((label, i) => {
      this.items.push(
        this.add.text(GAME_WIDTH / 2, top + LINE * (i + 1.5), label, { ...TEXT }).setOrigin(0.5),
      );
    });
    this.message = this.add
      .text(GAME_WIDTH / 2, top + LINE * 3.6, '', { ...TEXT, color: COLORS.cheat })
      .setOrigin(0.5);

    this.controls = new PlayerInput(this);
    // The pause key that opened the menu is still down: don't let it close the menu at once.
    this.controls.frame();
    // Word cheats are typed letters, read straight from the keyboard.
    const onKey = (e: KeyboardEvent): void => {
      const m = /^Key([A-Z])$/.exec(e.code);
      if (m?.[1] && !e.repeat) this.cheat(this.wordCodes.push(m[1]));
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      window.removeEventListener('keydown', onKey),
    );
    this.render();
  }

  override update(): void {
    const { pressed } = this.controls.frame();
    // Feed the Konami code; while one is under way, fire and jump belong to it, not the menu.
    let codeInput = false;
    for (const action of ['up', 'down', 'left', 'right', 'fire', 'jump'] as const) {
      if (!pressed[action]) continue;
      const id = this.actionCodes.push(action);
      if (id) {
        this.cheat(id);
        codeInput = true;
      } else if (this.actionCodes.progress >= 2) {
        codeInput = true;
      }
    }
    const menuInput = codeInput ? { ...pressed, fire: false, jump: false } : pressed;
    const step = stepMenu(this.index, PAUSE_OPTIONS.length, menuInput);
    if (step.index !== this.index) {
      this.index = step.index;
      this.render();
    }
    if (step.back) this.resume();
    else if (step.choose) this.choose(PAUSE_OPTIONS[this.index] ?? 'RESUME');
  }

  /** Test hook: the highlighted option. */
  get selected(): PauseOption {
    return PAUSE_OPTIONS[this.index] ?? 'RESUME';
  }

  /** Test hook: the last cheat confirmation shown, if any. */
  get cheatMessage(): string | null {
    return this.lastCheat;
  }

  private cheat(id: CheatId | null): void {
    if (!id) return;
    const level = this.scene.get('Level') as LevelScene;
    this.lastCheat = level.applyCheat(id);
    this.message.setText(this.lastCheat);
    // Room skip takes effect straight away: back to the game, which leaves the room.
    if (id === 'skip-room') this.resume();
  }

  private choose(option: PauseOption): void {
    if (option === 'RESUME') return this.resume();
    this.scene.stop();
    // Restart with the score and lives this room was entered with.
    const level = this.scene.get('Level') as LevelScene;
    const run = level.startingRun;
    level.scene.restart({ level: this.level, ...(run ? { run } : {}) });
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume('Level');
  }

  private render(): void {
    this.items.forEach((item, i) => {
      const on = i === this.index;
      item.setText(`${on ? '> ' : '  '}${PAUSE_OPTIONS[i] ?? ''}${on ? ' <' : '  '}`);
      item.setColor(on ? COLORS.selected : COLORS.option);
    });
  }
}
