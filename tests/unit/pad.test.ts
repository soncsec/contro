import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAD_BINDINGS,
  NO_ACTIONS,
  PadLatch,
  actionsFromPad,
  mergeFrames,
  type PadState,
} from '../../src/logic/input';
import { stepMenu } from '../../src/logic/menu';

const pad = (pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): PadState => ({
  buttons: Array.from({ length: 17 }, (_, i) => pressed.includes(i)),
  axes,
});
const act = (p: PadState) => actionsFromPad(p, DEFAULT_PAD_BINDINGS);

describe('actionsFromPad (standard mapping)', () => {
  it('does nothing at rest', () => {
    expect(act(pad())).toEqual(NO_ACTIONS);
  });

  it('A jumps, X or B fires, Start pauses', () => {
    expect(act(pad([0])).jump).toBe(true);
    expect(act(pad([2])).fire).toBe(true);
    expect(act(pad([1])).fire).toBe(true);
    expect(act(pad([9])).pause).toBe(true);
  });

  it('the d-pad moves, aims up and crouches', () => {
    expect(act(pad([14]))).toMatchObject({ left: true, right: false });
    expect(act(pad([15]))).toMatchObject({ right: true, left: false });
    expect(act(pad([12])).up).toBe(true);
    expect(act(pad([13])).down).toBe(true);
  });

  it('the left stick does the same past the dead zone', () => {
    expect(act(pad([], [-0.9, 0]))).toMatchObject({ left: true, right: false });
    expect(act(pad([], [0.6, -0.7]))).toMatchObject({ right: true, up: true });
    expect(act(pad([], [0, 0.5])).down).toBe(true);
    // Inside the dead zone: nothing.
    expect(act(pad([], [0.49, -0.3]))).toEqual(NO_ACTIONS);
  });

  it('copes with a pad that reports no axes', () => {
    expect(act({ buttons: [true], axes: [] }).jump).toBe(true);
  });
});

describe('PadLatch', () => {
  it('reports a press on the first frame only, then just held', () => {
    const latch = new PadLatch();
    expect(latch.frame(pad([0]), DEFAULT_PAD_BINDINGS)).toMatchObject({
      held: { jump: true },
      pressed: { jump: true },
    });
    expect(latch.frame(pad([0]), DEFAULT_PAD_BINDINGS)).toMatchObject({
      held: { jump: true },
      pressed: { jump: false },
    });
    expect(latch.frame(pad(), DEFAULT_PAD_BINDINGS).held.jump).toBe(false);
    expect(latch.frame(pad([0]), DEFAULT_PAD_BINDINGS).pressed.jump).toBe(true);
  });

  it('treats no pad as nothing pressed', () => {
    expect(new PadLatch().frame(null, DEFAULT_PAD_BINDINGS)).toEqual({
      held: NO_ACTIONS,
      pressed: NO_ACTIONS,
    });
  });

  it('after clear, a button still held is not a new press until released', () => {
    const latch = new PadLatch();
    latch.frame(pad([9]), DEFAULT_PAD_BINDINGS);
    latch.clear();
    expect(latch.frame(pad([9]), DEFAULT_PAD_BINDINGS)).toMatchObject({
      held: { pause: true },
      pressed: { pause: false },
    });
    latch.frame(pad(), DEFAULT_PAD_BINDINGS);
    expect(latch.frame(pad([9]), DEFAULT_PAD_BINDINGS).pressed.pause).toBe(true);
  });

  it('after clear, a button pressed afterwards is still a press', () => {
    const latch = new PadLatch();
    latch.frame(pad(), DEFAULT_PAD_BINDINGS);
    latch.clear();
    expect(latch.frame(pad(), DEFAULT_PAD_BINDINGS).pressed.pause).toBe(false);
    expect(latch.frame(pad([9]), DEFAULT_PAD_BINDINGS).pressed.pause).toBe(true);
  });
});

describe('mergeFrames', () => {
  it('combines keyboard and gamepad', () => {
    const kb = { held: { ...NO_ACTIONS, left: true }, pressed: { ...NO_ACTIONS, fire: true } };
    const gp = { held: { ...NO_ACTIONS, jump: true }, pressed: { ...NO_ACTIONS, jump: true } };
    const m = mergeFrames(kb, gp);
    expect(m.held).toEqual({ ...NO_ACTIONS, left: true, jump: true });
    expect(m.pressed).toEqual({ ...NO_ACTIONS, fire: true, jump: true });
  });
});

describe('stepMenu', () => {
  const press = (p: Partial<typeof NO_ACTIONS>) => ({ ...NO_ACTIONS, ...p });

  it('moves up and down, wrapping around', () => {
    expect(stepMenu(0, 2, press({ down: true })).index).toBe(1);
    expect(stepMenu(1, 2, press({ down: true })).index).toBe(0);
    expect(stepMenu(0, 2, press({ up: true })).index).toBe(1);
    expect(stepMenu(1, 2, press({})).index).toBe(1);
  });

  it('chooses with jump or fire, goes back with pause', () => {
    expect(stepMenu(1, 2, press({ jump: true }))).toEqual({ index: 1, choose: true, back: false });
    expect(stepMenu(0, 2, press({ fire: true })).choose).toBe(true);
    expect(stepMenu(0, 2, press({ pause: true }))).toEqual({ index: 0, choose: false, back: true });
  });

  it('handles an empty menu', () => {
    expect(stepMenu(3, 0, press({ down: true }))).toEqual({ index: 0, choose: false, back: false });
  });
});
