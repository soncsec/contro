import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSETS, ASSET_GROUPS } from '../../src/assets/manifest';

const PUBLIC_DIR = `${process.cwd()}/public`;

/** Width and height from a PNG file's header. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('asset manifest', () => {
  it('has unique keys', () => {
    const keys = ASSETS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has at least one asset in every group, so no preview page is empty', () => {
    for (const group of ASSET_GROUPS) {
      expect(ASSETS.some((a) => a.group === group)).toBe(true);
    }
  });

  it('lists every file in public/assets exactly once', () => {
    const onDisk = readdirSync(`${PUBLIC_DIR}/assets`, { recursive: true })
      .filter((f) => f.endsWith('.png'))
      .map((f) => `assets/${f}`)
      .sort();
    const listed = ASSETS.map((a) => a.path).sort();
    expect(listed).toEqual(onDisk);
  });

  it.each(ASSETS.filter((a) => a.kind === 'sheet'))(
    'sheet $key: image size equals frames × frame size',
    (a) => {
      expect(pngSize(`${PUBLIC_DIR}/${a.path}`)).toEqual({
        width: a.frames * a.frameWidth,
        height: a.frameHeight,
      });
      expect(a.frames).toBeGreaterThan(0);
      expect(a.frameRate).toBeGreaterThanOrEqual(0);
    },
  );

  it.each(ASSETS.filter((a) => a.kind === 'image'))('image $key: size matches', (a) => {
    expect(pngSize(`${PUBLIC_DIR}/${a.path}`)).toEqual({ width: a.width, height: a.height });
  });
});
