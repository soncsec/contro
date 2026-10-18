import Phaser from 'phaser';
import { BACKGROUND_COLOR, FONT, GAME_HEIGHT, GAME_WIDTH, TITLE } from '../config/tuning';
import { CAMPAIGN } from '../data/campaign';
import { controlsGuide } from '../logic/controls';
import { DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS } from '../logic/input';
import { stepMenu } from '../logic/menu';
import { formatScore } from '../logic/score';
import { FULLSCREEN_KEY } from '../systems/Fullscreen';
import { PlayerInput } from '../systems/PlayerInput';
import { TouchControls } from '../systems/TouchControls';
import { SaveStore } from '../systems/SaveStore';

export const TITLE_OPTIONS = ['START', 'CONTROLS', 'MORE GAMES'] as const;
export type TitleOption = (typeof TITLE_OPTIONS)[number];

const TEXT = { fontFamily: FONT.family, fontSize: FONT.size } as const;
const COLORS = {
  shade: 0x000000,
  panel: 0x101826,
  border: 0x4fe3c1,
  logo: '#ffd166',
  logoShadow: '#7a2a5c',
  tagline: '#4fe3c1',
  option: '#7f8ea3',
  selected: '#e6eef7',
  best: '#ffd166',
  heading: '#ffd166',
  text: '#e6eef7',
  dim: '#7f8ea3',
};
const SHADE_ALPHA = 0.5;
const MENU_TOP = 96;
const LINE = 14;
/** Controls guide: column x positions and row spacing (8 px a character). */
const GUIDE = { x: [12, 100, 224], top: 40, row: 12 } as const;
/** A dark band behind the menu keeps it readable over the scenery. */
const MENU_BAND = { width: 160, alpha: 0.6 } as const;

/**
 * The title screen: the game's name over the drifting corridor, START, a CONTROLS guide built
 * from the real bindings, and MORE GAMES back to the portal. Up/down choose; jump, fire or
 * pause (Start on a gamepad) select.
 */
export class TitleScene extends Phaser.Scene {
  private controls!: PlayerInput;
  private index = 0;
  private shownMs = 0;
  private leaving = false;
  private showingControls = false;
  private back?: Phaser.GameObjects.TileSprite;
  private menu!: Phaser.GameObjects.Container;
  private guide!: Phaser.GameObjects.Container;
  private items: Phaser.GameObjects.Text[] = [];
  private best!: Phaser.GameObjects.Text;
  /** The guide shows the on-screen controls (a touch screen) instead of keys. */
  private touchGuide = false;

  constructor() {
    super('Title');
  }

  init(): void {
    this.index = 0;
    this.shownMs = 0;
    this.leaving = false;
    this.showingControls = false;
    this.items = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);
    this.back = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'corridor-back').setOrigin(0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.shade, SHADE_ALPHA).setOrigin(0);

    this.menu = this.add.container(0, 0, this.buildMenu());
    this.guide = this.add.container(0, 0, this.buildGuide()).setVisible(false);
    this.highlight();

    this.controls = new PlayerInput(this);
    this.cameras.main.fadeIn(TITLE.fadeMs);
  }

  private buildMenu(): Phaser.GameObjects.GameObject[] {
    const cx = GAME_WIDTH / 2;
    const logo = { fontFamily: FONT.family, fontSize: TITLE.logoSize };
    const shadow = this.add
      .text(cx + 2, 38, 'CONTRO', { ...logo, color: COLORS.logoShadow })
      .setOrigin(0.5);
    const name = this.add.text(cx, 36, 'CONTRO', { ...logo, color: COLORS.logo }).setOrigin(0.5);
    const tagline = this.add
      .text(cx, 64, 'SPACE MARINE VS THE HIVE', { ...TEXT, color: COLORS.tagline })
      .setOrigin(0.5);
    const band = this.add.rectangle(
      cx,
      MENU_TOP + LINE,
      MENU_BAND.width,
      LINE * TITLE_OPTIONS.length + 8,
      COLORS.shade,
      MENU_BAND.alpha,
    );
    this.items = TITLE_OPTIONS.map((label, i) =>
      this.add.text(cx, MENU_TOP + i * LINE, label, { ...TEXT }).setOrigin(0.5),
    );
    const best = (this.best = this.add
      .text(cx, GAME_HEIGHT - 14, `HI ${formatScore(SaveStore.load().bestScore)}`, {
        ...TEXT,
        color: COLORS.best,
      })
      .setOrigin(0.5));
    return [shadow, name, tagline, band, ...this.items, best];
  }

  private buildGuide(): Phaser.GameObjects.GameObject[] {
    const panel = this.add
      .rectangle(4, 4, GAME_WIDTH - 8, GAME_HEIGHT - 8, COLORS.panel)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border);
    const heading = this.add
      .text(GAME_WIDTH / 2, 18, 'CONTROLS', { ...TEXT, color: COLORS.heading })
      .setOrigin(0.5);
    const touch = (this.touchGuide = TouchControls.current !== null);
    const header = ['', touch ? 'TOUCH' : 'KEYS', 'PAD'].map((label, c) =>
      this.add.text(GUIDE.x[c] ?? 0, GUIDE.top - 12, label, { ...TEXT, color: COLORS.dim }),
    );
    const rows = controlsGuide(DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS, FULLSCREEN_KEY, touch);
    const cells = rows.flatMap((row, r) =>
      row.map((label, c) =>
        this.add.text(GUIDE.x[c] ?? 0, GUIDE.top + r * GUIDE.row, label, {
          ...TEXT,
          color: c === 0 ? COLORS.heading : COLORS.text,
        }),
      ),
    );
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 18, 'FIRE / JUMP TO GO BACK', {
        ...TEXT,
        color: COLORS.dim,
      })
      .setOrigin(0.5);
    return [panel, heading, ...header, ...cells, hint];
  }

  override update(_time: number, deltaMs: number): void {
    this.shownMs += deltaMs;
    if (this.back) this.back.tilePositionX += (TITLE.scrollSpeed * deltaMs) / 1000;
    const { pressed } = this.controls.frame();
    if (this.leaving || this.shownMs < TITLE.inputDelayMs) return;

    if (this.showingControls) {
      if (pressed.jump || pressed.fire || pressed.pause) this.setControlsVisible(false);
      return;
    }
    const step = stepMenu(this.index, TITLE_OPTIONS.length, pressed);
    if (step.index !== this.index) {
      this.index = step.index;
      this.highlight();
    }
    // Start on a gamepad (pause) also selects, as players expect on a title screen.
    if (step.choose || step.back) this.choose(TITLE_OPTIONS[this.index] ?? 'START');
  }

  private choose(option: TitleOption): void {
    switch (option) {
      case 'START':
        this.leaving = true;
        this.cameras.main.fadeOut(TITLE.fadeMs);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start('Level', { level: CAMPAIGN[0]?.level });
        });
        break;
      case 'CONTROLS':
        this.setControlsVisible(true);
        break;
      case 'MORE GAMES':
        this.leaving = true;
        window.location.assign(new URL(TITLE.portalUrl, window.location.href).href);
        break;
    }
  }

  private setControlsVisible(visible: boolean): void {
    this.showingControls = visible;
    this.menu.setVisible(!visible);
    this.guide.setVisible(visible);
    // Forget the press that opened or closed the guide, so it can't act twice.
    this.controls.clear();
  }

  private highlight(): void {
    this.items.forEach((item, i) => {
      const label = TITLE_OPTIONS[i] ?? '';
      const on = i === this.index;
      item.setText(on ? `> ${label} <` : label).setColor(on ? COLORS.selected : COLORS.option);
    });
  }

  /** Test hook: the highlighted option, whether the guide is open, input is live, best score. */
  snapshot(): {
    option: TitleOption;
    controls: boolean;
    ready: boolean;
    best: string;
    touch: boolean;
  } {
    return {
      option: TITLE_OPTIONS[this.index] ?? 'START',
      controls: this.showingControls,
      ready: !this.leaving && this.shownMs >= TITLE.inputDelayMs,
      best: this.best.text,
      touch: this.touchGuide,
    };
  }
}
