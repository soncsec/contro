import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { ACTION_CHEATS, CheatMatcher, WORD_CHEATS, type CheatId } from '../logic/cheats';
import { DEFAULT_KEY_BINDINGS } from '../logic/input';
import { stepMenu } from '../logic/menu';
import { cycleVolume, stepVolume, volumeName } from '../logic/volume';
import { toggleFullscreen } from '../systems/Fullscreen';
import { GameSound } from '../systems/GameSound';
import { PlayerInput } from '../systems/PlayerInput';
import type { RunState } from './LevelScene';

export interface PauseSceneData {
  level: string;
  /** The scene paused underneath: a side-scrolling level, or a base stage (M5.6). */
  scene?: 'Level' | 'Base';
}

/** What the pause menu needs from the scene it paused. */
interface PausedPlay extends Phaser.Scene {
  applyCheat(id: CheatId): string;
  readonly startingRun: RunState | null;
}

/** M6.2 (owner 2026-10-21): music and effects volume, and fullscreen without the F key. */
export const PAUSE_OPTIONS = ['RESUME', 'RESTART ROOM', 'MUSIC', 'EFFECTS', 'FULLSCREEN'] as const;
export type PauseOption = (typeof PAUSE_OPTIONS)[number];

const TEXT = { fontFamily: FONT.family, fontSize: FONT.size } as const;
const COLORS = {
  dim: 0x000000,
  panel: 0x101826,
  border: 0x4fe3c1,
  title: '#ffd166',
  option: '#7f8ea3',
  selected: '#e6eef7',
  cheat: '#ff4fd8',
};
const PANEL = { width: 160, height: 124 } as const;
const DIM_ALPHA = 0.6;
const LINE = 14;

/**
 * Pause menu drawn over the paused level. Up/down choose, jump/fire confirm,
 * pause resumes. The level scene stays paused underneath.
 */
export class PauseScene extends Phaser.Scene {
  private level!: string;
  private under: 'Level' | 'Base' = 'Level';
  private controls!: PlayerInput;
  private index = 0;
  private items: Phaser.GameObjects.Text[] = [];
  private actionCodes = new CheatMatcher(ACTION_CHEATS);
  private wordCodes = new CheatMatcher(WORD_CHEATS);
  private message!: Phaser.GameObjects.Text;
  private lastCheat: string | null = null;
  /** FULLSCREEN was chosen with a key, already toggled inside the browser's key event. */
  private fullscreenByKey = false;

  constructor() {
    super('Pause');
  }

  init(data: PauseSceneData): void {
    this.level = data.level;
    this.under = data.scene ?? 'Level';
    this.index = 0;
    this.items = [];
    this.actionCodes = new CheatMatcher(ACTION_CHEATS);
    this.wordCodes = new CheatMatcher(WORD_CHEATS);
    this.lastCheat = null;
    this.fullscreenByKey = false;
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.dim, DIM_ALPHA).setOrigin(0);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, PANEL.width, PANEL.height, COLORS.panel)
      .setStrokeStyle(1, COLORS.border);
    const top = GAME_HEIGHT / 2 - LINE * 3.2;
    this.add.text(GAME_WIDTH / 2, top, 'PAUSED', { ...TEXT, color: COLORS.title }).setOrigin(0.5);
    PAUSE_OPTIONS.forEach((label, i) => {
      this.items.push(
        this.add.text(GAME_WIDTH / 2, top + LINE * (i + 1.5), label, { ...TEXT }).setOrigin(0.5),
      );
    });
    this.message = this.add
      .text(GAME_WIDTH / 2, top + LINE * 6.8, '', { ...TEXT, color: COLORS.cheat })
      .setOrigin(0.5);

    this.controls = new PlayerInput(this);
    // The pause key that opened the menu is still down: don't let it close the menu at once.
    this.controls.frame();
    // Word cheats are typed letters, read straight from the keyboard.
    const choose = [...DEFAULT_KEY_BINDINGS.fire, ...DEFAULT_KEY_BINDINGS.jump];
    const onKey = (e: KeyboardEvent): void => {
      const m = /^Key([A-Z])$/.exec(e.code);
      if (m?.[1] && !e.repeat) this.cheat(this.wordCodes.push(m[1]));
      // Browsers allow fullscreen only inside a real key event, so FULLSCREEN chosen with a
      // key toggles here; the menu's own update then skips it.
      if (this.selected === 'FULLSCREEN' && choose.includes(e.code) && !e.repeat) {
        const container = document.getElementById('game');
        if (container) toggleFullscreen(container);
        this.fullscreenByKey = true;
      }
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
      GameSound.play('sfx-blip');
      this.render();
    }
    // Left and right turn a volume down or up (not while a code with left and right is typed).
    const turn = pressed.left ? -1 : pressed.right ? 1 : 0;
    if (turn !== 0 && !codeInput && this.actionCodes.progress === 0) this.turnVolume(turn);
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
    const play = this.scene.get(this.under) as PausedPlay;
    this.lastCheat = play.applyCheat(id);
    this.message.setText(this.lastCheat);
    // Room skip takes effect straight away: back to the game, which leaves the room.
    if (id === 'skip-room') this.resume();
  }

  private choose(option: PauseOption): void {
    if (option === 'RESUME') return this.resume();
    if (option === 'MUSIC') {
      GameSound.setMusicLevel(cycleVolume(GameSound.musicLevel));
      GameSound.play('sfx-select');
      this.render();
      return;
    }
    if (option === 'EFFECTS') {
      GameSound.setSfxLevel(cycleVolume(GameSound.sfxLevel));
      GameSound.play('sfx-select');
      this.render();
      return;
    }
    if (option === 'FULLSCREEN') {
      // Chosen with a key: already toggled in the key event. A gamepad button arrives here
      // instead; the browser may refuse fullscreen then, and the game simply stays windowed.
      if (!this.fullscreenByKey) {
        const container = document.getElementById('game');
        if (container) toggleFullscreen(container);
      }
      this.fullscreenByKey = false;
      return;
    }
    this.scene.stop();
    // Restart with the score and lives this room was entered with.
    const play = this.scene.get(this.under) as PausedPlay;
    const run = play.startingRun;
    play.scene.restart({ level: this.level, ...(run ? { run } : {}) });
  }

  /** One step down or up on the highlighted volume row, remembered (M6.2). */
  private turnVolume(delta: -1 | 1): void {
    const option = this.selected;
    if (option === 'MUSIC') GameSound.setMusicLevel(stepVolume(GameSound.musicLevel, delta));
    else if (option === 'EFFECTS') GameSound.setSfxLevel(stepVolume(GameSound.sfxLevel, delta));
    else return;
    GameSound.play('sfx-blip');
    this.render();
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(this.under);
  }

  private render(): void {
    this.items.forEach((item, i) => {
      const on = i === this.index;
      const option = PAUSE_OPTIONS[i] ?? '';
      const label =
        option === 'MUSIC'
          ? `MUSIC ${volumeName(GameSound.musicLevel)}`
          : option === 'EFFECTS'
            ? `EFFECTS ${volumeName(GameSound.sfxLevel)}`
            : option;
      item.setText(`${on ? '> ' : '  '}${label}${on ? ' <' : '  '}`);
      item.setColor(on ? COLORS.selected : COLORS.option);
    });
  }
}
