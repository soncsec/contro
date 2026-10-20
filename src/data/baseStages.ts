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
  // Level 3's third section: the alien base's core (4 rooms, owner decision 2026-10-20). The
  // first room for now (M5.6a); turrets and the other three rooms come with M5.6c.
  'hive-core': {
    rooms: [
      {
        core: { hp: 20, halfWidth: 40 },
        walkers: {
          firstMs: 1200,
          everyMs: 1600,
          count: 8,
          lanes: [70, 115, 160, 205, 250],
          hp: 1,
        },
      },
    ],
  },
};

/** The scene that plays a section: a base stage, or a side-scrolling map. */
export const sceneFor = (section: string): 'Base' | 'Level' =>
  section in BASE_STAGES ? 'Base' : 'Level';
