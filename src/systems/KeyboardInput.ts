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
 * A key pressed and released between two frames still counts for the next frame,
 * so very quick taps are never lost. Held keys are forgotten when the window loses
 * focus, so nothing stays stuck down.
 */
export class KeyboardInput {
  private readonly held = new Set<string>();
  /** Keys pressed since the last actions() call, even if already released. */
  private readonly tapped = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    private readonly bindings: Bindings,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('keyboard input is not available');
    // Stop arrows and Space from also scrolling the page.
    keyboard.addCapture(boundKeys(bindings).map(phaserKeyName).join(','));
    const down = (e: KeyboardEvent): void => {
      this.held.add(e.code);
      this.tapped.add(e.code);
    };
    const up = (e: KeyboardEvent): void => void this.held.delete(e.code);
    const clear = (): void => {
      this.held.clear();
      this.tapped.clear();
    };
    keyboard.on('keydown', down);
    keyboard.on('keyup', up);
    scene.game.events.on(Phaser.Core.Events.BLUR, clear);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', down);
      keyboard.off('keyup', up);
      scene.game.events.off(Phaser.Core.Events.BLUR, clear);
    });
  }

  /** Actions for this frame. Call once per frame. */
  actions(): ActionState {
    const keys = new Set([...this.held, ...this.tapped]);
    this.tapped.clear();
    return actionsFromKeys(keys, this.bindings);
  }
}
