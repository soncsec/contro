import Phaser from 'phaser';
import {
  DEFAULT_KEY_BINDINGS,
  KeyLatch,
  DEFAULT_PAD_BINDINGS,
  PadLatch,
  mergeFrames,
  type ActionFrame,
  type PadState,
} from '../logic/input';
import { TOUCH_BINDINGS } from '../logic/touch';
import { KeyboardInput } from './KeyboardInput';
import { TouchControls } from './TouchControls';

/**
 * The player's controls: keyboard, the first connected gamepad and, on touch screens, the
 * on-screen controls (M3.11), merged (ADR-C07).
 * Game code reads actions only. Browsers report a gamepad after its first button press.
 */
export class PlayerInput {
  private readonly keyboard: KeyboardInput;
  private readonly pad = new PadLatch();
  private readonly touch = new KeyLatch();

  constructor(private readonly scene: Phaser.Scene) {
    this.keyboard = new KeyboardInput(scene, DEFAULT_KEY_BINDINGS);
    const controls = TouchControls.current;
    if (controls) {
      // Buttons already down when the scene starts count as held, not as new presses.
      for (const c of controls.heldCodes()) this.touch.keyDown(c, true);
      const stop = controls.subscribe((c, down) =>
        down ? this.touch.keyDown(c) : this.touch.keyUp(c),
      );
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    }
  }

  /** The actions for this frame. Call once per frame. */
  frame(): ActionFrame {
    const touch = this.touch.frame(TOUCH_BINDINGS);
    // Holding the on-screen FIRE button auto-fires (M3.4); keys and gamepad don't.
    const fromTouch = touch.held.fire ? { ...touch, autoFire: true } : touch;
    return mergeFrames(
      mergeFrames(this.keyboard.frame(), fromTouch),
      this.pad.frame(this.readPad(), DEFAULT_PAD_BINDINGS),
    );
  }

  /** Forget held keys and buttons, e.g. when returning from the pause menu. */
  clear(): void {
    this.keyboard.clear();
    this.touch.clear();
    // A thumb still on a button stays held, but it is not a new press.
    for (const c of TouchControls.current?.heldCodes() ?? []) this.touch.keyDown(c, true);
    this.pad.clear();
  }

  private readPad(): PadState | null {
    const pad = this.scene.input.gamepad?.getAll().find((p) => p.connected);
    if (!pad) return null;
    return {
      buttons: pad.buttons.map((b) => b.pressed),
      axes: pad.axes.map((a) => a.getValue()),
    };
  }
}
