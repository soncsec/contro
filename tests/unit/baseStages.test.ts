import { describe, expect, it } from 'vitest';
import { ASSETS, LEVELS } from '../../src/assets/manifest';
import { BASE } from '../../src/config/tuning';
import { BASE_STAGES, sceneFor } from '../../src/data/baseStages';
import { STORY_LEVELS } from '../../src/data/campaign';
import { project } from '../../src/logic/base';

describe('base stages (M5.6)', () => {
  const stages = Object.entries(BASE_STAGES);

  it('Level 3 plays the base core between the alien base and the hive', () => {
    const level3 = STORY_LEVELS.find((l) => l.stage === 3);
    expect(level3?.sections).toContain('hive-core');
    expect(level3?.sections.indexOf('hive-core')).toBeGreaterThan(0);
  });

  it('are played by the base scene, and maps by the level scene', () => {
    expect(sceneFor('hive-core')).toBe('Base');
    expect(sceneFor('hive-1')).toBe('Level');
  });

  it("don't share a key with a map", () => {
    const maps = LEVELS.map((l) => l.key);
    for (const [key] of stages) expect(maps).not.toContain(key);
  });

  it.each(stages)('%s: every room has a core and walkers that fit the room', (_key, stage) => {
    expect(stage.rooms.length).toBeGreaterThan(0);
    for (const room of stage.rooms) {
      expect(room.core.hp).toBeGreaterThan(0);
      // The core's width fits on the far wall.
      expect(room.core.halfWidth).toBeGreaterThan(0);
      expect(room.core.halfWidth).toBeLessThan(BASE.projection.centerX);
      expect(room.walkers.count).toBeGreaterThanOrEqual(0);
      expect(room.walkers.everyMs).toBeGreaterThan(0);
      expect(room.walkers.hp).toBeGreaterThan(0);
      expect(room.walkers.lanes.length).toBeGreaterThan(0);
      for (const lane of room.walkers.lanes) {
        expect(lane).toBeGreaterThanOrEqual(BASE.marine.minX);
        expect(lane).toBeLessThanOrEqual(BASE.marine.maxX);
      }
    }
  });

  it('the base core has 4 rooms; turrets fit on the far wall; the last core is bigger and fires back', () => {
    const core = BASE_STAGES['hive-core'];
    expect(core?.rooms).toHaveLength(4); // owner decision 2026-10-20
    for (const room of core?.rooms ?? []) {
      for (const t of room.turrets ?? []) {
        expect(t.hp).toBeGreaterThan(0);
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThanOrEqual(2 * BASE.projection.centerX);
        expect(t.h).toBeGreaterThan(0);
        expect(t.h).toBeLessThan(BASE.roomHeight);
        expect(t.everyMs).toBeGreaterThan(0);
        expect(t.count).toBeGreaterThan(0);
      }
    }
    const rooms = core?.rooms ?? [];
    const last = rooms[rooms.length - 1];
    expect(last?.core.fire).toBeDefined();
    expect(rooms.slice(0, -1).every((r) => r.core.fire === undefined)).toBe(true);
    // Each room is at least as tough as the one before, and the last core is the biggest.
    const hp = rooms.map((r) => r.core.hp);
    expect([...hp].sort((a, b) => a - b)).toEqual(hp);
    expect(last?.core.halfWidth).toBe(Math.max(...rooms.map((r) => r.core.halfWidth)));
  });

  it('the room art matches the projection: the far wall fits the screen', () => {
    const room = ASSETS.find((a) => a.key === 'base-room');
    expect(room).toMatchObject({ width: 320, height: 176 });
    const P = BASE.projection;
    const corner = project(0, 1, BASE.roomHeight, P);
    expect(corner.x).toBeGreaterThan(0);
    expect(corner.y).toBeGreaterThan(0);
    // The core sits on the far wall, inside its top and floor.
    const core = project(P.centerX, 1, BASE.coreHeight, P);
    expect(core.y).toBeGreaterThan(corner.y);
    expect(core.y).toBeLessThan(P.farFloorY);
  });

  it('its art is in the manifest', () => {
    for (const key of ['base-room', 'base-core', 'base-barrier', 'marine-back'])
      expect(ASSETS.some((a) => a.key === key)).toBe(true);
  });
});
