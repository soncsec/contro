import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  KeyLatch,
  DEFAULT_KEY_BINDINGS,
  actionsFromKeys,
  boundKeys,
  horizontalDirection,
  phaserKeyName,
} from '../../src/logic/input';

const actions = (...keys: string[]) => actionsFromKeys(new Set(keys), DEFAULT_KEY_BINDINGS);

describe('actionsFromKeys', () => {
  it('maps nothing pressed to no actions', () => {
    expect(Object.values(actions()).every((v) => !v)).toBe(true);
  });

  it('maps arrows and WASD to the same actions', () => {
    expect(actions('ArrowLeft').left).toBe(true);
    expect(actions('KeyA').left).toBe(true);
    expect(actions('ArrowRight').right).toBe(true);
    expect(actions('KeyD').right).toBe(true);
    expect(actions('ArrowUp').up).toBe(true);
    expect(actions('KeyS').down).toBe(true);
  });

  it('maps jump, fire and pause keys', () => {
    for (const k of ['Space', 'KeyZ', 'KeyK']) expect(actions(k).jump).toBe(true);
    for (const k of ['KeyX', 'KeyJ']) expect(actions(k).fire).toBe(true);
    for (const k of ['Escape', 'KeyP']) expect(actions(k).pause).toBe(true);
  });

  it('ignores keys that are not bound', () => {
    expect(Object.values(actions('KeyQ', 'Enter')).every((v) => !v)).toBe(true);
  });

  it('gives every action at least one key, with no key doing two things', () => {
    const all = ACTIONS.flatMap((a) => DEFAULT_KEY_BINDINGS[a]);
    for (const a of ACTIONS) expect(DEFAULT_KEY_BINDINGS[a].length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
    expect(boundKeys(DEFAULT_KEY_BINDINGS).sort()).toEqual([...all].sort());
  });
});

describe('horizontalDirection', () => {
  it('is -1, 1, or 0 when neither or both are held', () => {
    expect(horizontalDirection(actions('ArrowLeft'))).toBe(-1);
    expect(horizontalDirection(actions('ArrowRight'))).toBe(1);
    expect(horizontalDirection(actions())).toBe(0);
    expect(horizontalDirection(actions('ArrowLeft', 'KeyD'))).toBe(0);
  });
});

describe('phaserKeyName', () => {
  it('converts KeyboardEvent codes to Phaser key names', () => {
    expect(phaserKeyName('ArrowLeft')).toBe('LEFT');
    expect(phaserKeyName('KeyA')).toBe('A');
    expect(phaserKeyName('Space')).toBe('SPACE');
    expect(phaserKeyName('Escape')).toBe('ESC');
  });
});

describe('KeyLatch', () => {
  const frame = (latch: KeyLatch) => latch.frame(DEFAULT_KEY_BINDINGS);

  it('reports a key as held and newly pressed on its first frame, then just held', () => {
    const latch = new KeyLatch();
    latch.keyDown('Space');
    expect(frame(latch)).toMatchObject({ held: { jump: true }, pressed: { jump: true } });
    expect(frame(latch)).toMatchObject({ held: { jump: true }, pressed: { jump: false } });
    latch.keyUp('Space');
    expect(frame(latch)).toMatchObject({ held: { jump: false }, pressed: { jump: false } });
  });

  it('keeps a tap that was released before the frame ran', () => {
    const latch = new KeyLatch();
    latch.keyDown('KeyX');
    latch.keyUp('KeyX');
    expect(frame(latch)).toMatchObject({ held: { fire: true }, pressed: { fire: true } });
    expect(frame(latch)).toMatchObject({ held: { fire: false }, pressed: { fire: false } });
  });

  it('reports a release and re-press between frames as a new press', () => {
    const latch = new KeyLatch();
    latch.keyDown('Space');
    frame(latch);
    latch.keyUp('Space');
    latch.keyDown('Space');
    expect(frame(latch)).toMatchObject({ held: { jump: true }, pressed: { jump: true } });
  });

  it('does not count auto-repeat as a new press', () => {
    const latch = new KeyLatch();
    latch.keyDown('KeyX');
    frame(latch);
    latch.keyDown('KeyX', true);
    expect(frame(latch)).toMatchObject({ held: { fire: true }, pressed: { fire: false } });
  });

  it('forgets everything when cleared', () => {
    const latch = new KeyLatch();
    latch.keyDown('ArrowLeft');
    latch.clear();
    expect(frame(latch)).toMatchObject({ held: { left: false }, pressed: { left: false } });
  });
});
