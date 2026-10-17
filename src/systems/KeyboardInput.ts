import Phaser from 'phaser';
import {
  actionsFromKeys,
  boundKeys,
  phaserKeyName,
  type ActionState,
  type Bindings,
} from '../logic/input';

/**
 * Tracks which keys are held (by KeyboardEvent.code) and turns them into actions.
 * Held keys are forgotten when the window loses focus, so nothing stays stuck down.
 */
export class KeyboardInput {
  private readonly pressed = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    private readonly bindings: Bindings,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('keyboard input is not available');
    // Stop arrows and Space from also scrolling the page.
    keyboard.addCapture(boundKeys(bindings).map(phaserKeyName).join(','));
    const down = (e: KeyboardEvent): void => void this.pressed.add(e.code);
    const up = (e: KeyboardEvent): void => void this.pressed.delete(e.code);
    const clear = (): void => this.pressed.clear();
    keyboard.on('keydown', down);
    keyboard.on('keyup', up);
    scene.game.events.on(Phaser.Core.Events.BLUR, clear);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', down);
      keyboard.off('keyup', up);
      scene.game.events.off(Phaser.Core.Events.BLUR, clear);
    });
  }

  actions(): ActionState {
    return actionsFromKeys(this.pressed, this.bindings);
  }
}
