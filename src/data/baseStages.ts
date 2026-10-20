import type { BaseRoom } from '../logic/base';

/**
 * Into-the-screen base stages (ADR-C11, M5.6; owner request 2026-10-20), by section key.
 * The campaign lists them like map sections; BaseScene plays them. Each has its rooms, played
 * in order: destroy a room's core and the barrier drops to the next.
 * tests/unit/baseStages.test.ts checks them.
 */
export interface BaseStage {
  rooms: readonly BaseRoom[];
}

export const BASE_STAGES: Readonly<Record<string, BaseStage>> = {
  // Level 3's third section: the alien base's core, 4 rooms (owner decision 2026-10-20), each
  // harder than the last. Turrets sit high on the far wall; the last room's core fires back.
  'hive-core': {
    rooms: [
      // 1: no turrets, a stream of walkers: learn to shoot into the room and step aside.
      {
        core: { hp: 20, halfWidth: 40 },
        walkers: { firstMs: 1200, everyMs: 1600, count: 8, lanes: [70, 115, 160, 205, 250], hp: 1 },
      },
      // 2: two turrets high on either side, firing in turn.
      {
        core: { hp: 24, halfWidth: 40 },
        turrets: [
          { x: 70, h: 180, hp: 4, firstMs: 1500, everyMs: 2600, count: 1, spreadPx: 0 },
          { x: 250, h: 180, hp: 4, firstMs: 2800, everyMs: 2600, count: 1, spreadPx: 0 },
        ],
        walkers: { firstMs: 1400, everyMs: 1500, count: 8, lanes: [70, 115, 160, 205, 250], hp: 1 },
      },
      // 3: three turrets, faster walkers from wider lanes.
      {
        core: { hp: 28, halfWidth: 40 },
        turrets: [
          { x: 50, h: 120, hp: 5, firstMs: 1200, everyMs: 2200, count: 1, spreadPx: 0 },
          { x: 270, h: 120, hp: 5, firstMs: 2300, everyMs: 2200, count: 1, spreadPx: 0 },
          { x: 160, h: 210, hp: 5, firstMs: 3000, everyMs: 3000, count: 1, spreadPx: 0 },
        ],
        walkers: {
          firstMs: 1000,
          everyMs: 1300,
          count: 10,
          lanes: [40, 90, 140, 180, 230, 280],
          hp: 1,
        },
      },
      // 4: a bigger core that fights back with a fan of three, guarded by two turrets.
      {
        core: {
          hp: 40,
          halfWidth: 56,
          fire: { x: 160, h: 120, firstMs: 2000, everyMs: 2400, count: 3, spreadPx: 40 },
        },
        turrets: [
          { x: 60, h: 180, hp: 6, firstMs: 1500, everyMs: 2400, count: 1, spreadPx: 0 },
          { x: 260, h: 180, hp: 6, firstMs: 2700, everyMs: 2400, count: 1, spreadPx: 0 },
        ],
        walkers: {
          firstMs: 1000,
          everyMs: 1200,
          count: 10,
          lanes: [40, 90, 140, 180, 230, 280],
          hp: 1,
        },
      },
    ],
  },
};

/** The scene that plays a section: a base stage, or a side-scrolling map. */
export const sceneFor = (section: string): 'Base' | 'Level' =>
  section in BASE_STAGES ? 'Base' : 'Level';
