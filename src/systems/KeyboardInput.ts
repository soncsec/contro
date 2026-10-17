import Phaser from 'phaser';
import {
  KeyLatch,
  boundKeys,
  phaserKeyName,
  type ActionFrame,
  type Bindings,
} from '../logic/input';

/** Feeds Phaser keyboard events into a KeyLatch (all the rules live there, unit tested). */
export class KeyboardInput {
  private readonly latch = new KeyLatch();

  constructor(
    scene: Phaser.Scene,
    private readonly bindings: Bindings,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('keyboard input is not available');
    // Stop arrows and Space from also scrolling the page.
    keyboard.addCapture(boundKeys(bindings).map(phaserKeyName).join(','));
    const down = (e: KeyboardEvent): void => this.latch.keyDown(e.code, e.repeat);
    const up = (e: KeyboardEvent): void => this.latch.keyUp(e.code);
    const clear = (): void => this.latch.clear();
    keyboard.on('keydown', down);
    keyboard.on('keyup', up);
    scene.game.events.on(Phaser.Core.Events.BLUR, clear);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', down);
      keyboard.off('keyup', up);
      scene.game.events.off(Phaser.Core.Events.BLUR, clear);
    });
  }

  /** The actions for this frame. Call once per frame. */
  frame(): ActionFrame {
    return this.latch.frame(this.bindings);
  }
}
