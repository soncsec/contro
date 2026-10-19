import { RUNNERS } from '../config/tuning';
import type { Enemies } from '../entities/Enemies';
import type { LevelLayout } from '../logic/levelMap';
import { groundAt, initialSpawner, stepSpawner, type SpawnerState } from '../logic/spawner';

/**
 * The map's spawners (M3.14): each sends runners in from the screen's edge once its point
 * scrolls into view. Rules in src/logic/spawner.ts.
 */
export class RunnerSpawners {
  private readonly states: SpawnerState[];

  constructor(
    private readonly layout: LevelLayout,
    private readonly enemies: Enemies,
  ) {
    this.states = layout.spawners.map(() => initialSpawner());
  }

  update(deltaMs: number, view: { left: number; right: number }): void {
    this.layout.spawners.forEach((spawner, i) => {
      const step = stepSpawner(
        this.states[i] ?? initialSpawner(),
        spawner,
        view,
        deltaMs,
        RUNNERS.margin,
        (x) => groundAt(this.layout.colliders, x),
      );
      this.states[i] = step.state;
      if (step.spawn) this.enemies.spawn(step.spawn);
    });
  }
}
