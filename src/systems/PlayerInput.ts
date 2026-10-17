import Phaser from 'phaser';
import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  PadLatch,
  mergeFrames,
  type ActionFrame,
  type PadState,
} from '../logic/input';
import { KeyboardInput } from './KeyboardInput';

/**
 * The player's controls: keyboard and the first connected gamepad, merged (ADR-C07).
 * Game code reads actions only. Browsers report a gamepad after its first button press.
 */
export class PlayerInput {
  private readonly keyboard: KeyboardInput;
  private readonly pad = new PadLatch();

  constructor(private readonly scene: Phaser.Scene) {
    this.keyboard = new KeyboardInput(scene, DEFAULT_KEY_BINDINGS);
  }

  /** The actions for this frame. Call once per frame. */
  frame(): ActionFrame {
    return mergeFrames(this.keyboard.frame(), this.pad.frame(this.readPad(), DEFAULT_PAD_BINDINGS));
  }

  /** Forget held keys and buttons, e.g. when returning from the pause menu. */
  clear(): void {
    this.keyboard.clear();
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
