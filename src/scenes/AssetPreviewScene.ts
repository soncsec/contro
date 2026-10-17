import Phaser from 'phaser';
import { ASSETS, ASSET_GROUPS, animKey, type Asset, type AssetGroup } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';

const MARGIN = 4;
const LABEL_HEIGHT = 9;
const TOP = MARGIN + LABEL_HEIGHT + 2;
/** Non-looping animations replay after this pause so they can be checked. */
const REPLAY_DELAY_MS = 600;
const TEXT_STYLE = { fontFamily: 'monospace', fontSize: '8px' };
/** Approximate width of one label character at TEXT_STYLE, used to keep labels apart. */
const LABEL_CHAR_WIDTH = 5;

interface Placement {
  asset: Asset;
  x: number;
  y: number;
  scale: number;
}

interface Page {
  group: AssetGroup;
  placements: Placement[];
}

const sizeOf = (a: Asset): { w: number; h: number } =>
  a.kind === 'sheet' ? { w: a.frameWidth, h: a.frameHeight } : { w: a.width, h: a.height };

/**
 * Lays assets out in rows, starting a new page when a group changes or the page is full.
 * An asset bigger than a whole page gets a page of its own, shrunk to fit.
 */
function buildPages(): Page[] {
  const pages: Page[] = [];
  for (const group of ASSET_GROUPS) {
    let page: Page = { group, placements: [] };
    let x = MARGIN;
    let y = TOP;
    let rowHeight = 0;
    for (const asset of ASSETS.filter((a) => a.group === group)) {
      const { w, h } = sizeOf(asset);
      const maxW = GAME_WIDTH - 2 * MARGIN;
      const maxH = GAME_HEIGHT - TOP - LABEL_HEIGHT;
      const scale = Math.min(1, maxW / w, maxH / h);
      const sw = Math.ceil(w * scale);
      const sh = Math.ceil(h * scale);
      const slot = Math.min(maxW, Math.max(sw, asset.key.length * LABEL_CHAR_WIDTH));
      if (x + slot > GAME_WIDTH - MARGIN) {
        x = MARGIN;
        y += rowHeight + LABEL_HEIGHT;
        rowHeight = 0;
      }
      if (y + sh + LABEL_HEIGHT > GAME_HEIGHT && page.placements.length > 0) {
        pages.push(page);
        page = { group, placements: [] };
        x = MARGIN;
        y = TOP;
        rowHeight = 0;
      }
      page.placements.push({ asset, x, y, scale });
      x += slot + MARGIN;
      rowHeight = Math.max(rowHeight, sh);
    }
    pages.push(page);
  }
  return pages;
}

/**
 * Shows every asset in the manifest, animating, a page at a time
 * (open the game with ?scene=preview; Left/Right change the page).
 * Used to check frame sizes and frame order by eye.
 */
export class AssetPreviewScene extends Phaser.Scene {
  private readonly pages = buildPages();
  private page = 0;
  private items: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('AssetPreview');
  }

  get currentGroup(): AssetGroup {
    return this.pages[this.page]?.group ?? ASSET_GROUPS[0];
  }

  get pageCount(): number {
    return this.pages.length;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2a2c3c');
    this.input.keyboard?.on('keydown-RIGHT', () => this.showPage(this.page + 1));
    this.input.keyboard?.on('keydown-LEFT', () => this.showPage(this.page - 1));
    this.showPage(0);
  }

  private showPage(index: number): void {
    const count = this.pages.length;
    this.page = ((index % count) + count) % count;
    for (const item of this.items) item.destroy();
    this.items = [];

    const page = this.pages[this.page];
    if (!page) return;
    this.label(MARGIN, MARGIN, `${page.group}  ${this.page + 1}/${count}  <- ->`, '#ffd166');
    for (const { asset, x, y, scale } of page.placements) {
      const sprite = this.add.sprite(x, y, asset.key).setOrigin(0).setScale(scale);
      if (asset.kind === 'sheet') {
        sprite.play(animKey(asset.key));
        if (!asset.loop) {
          sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () =>
            this.time.delayedCall(REPLAY_DELAY_MS, () => {
              if (sprite.active) sprite.play(animKey(asset.key));
            }),
          );
        }
      }
      this.items.push(sprite);
      this.label(x, y + Math.ceil(sizeOf(asset).h * scale), asset.key, '#c8d6e5');
    }
  }

  private label(x: number, y: number, text: string, color: string): void {
    this.items.push(this.add.text(x, y, text, { ...TEXT_STYLE, color }));
  }
}
