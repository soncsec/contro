import { describe, expect, it } from 'vitest';
import { HEALTH } from '../../src/config/tuning';
import {
  fallDeath,
  initialHealth,
  respawnPoint,
  stepHealth,
  takeHit,
  visibleWhileInvulnerable,
  type HealthState,
} from '../../src/logic/health';

const fresh = (): HealthState => initialHealth(HEALTH); // 4 hp, 3 lives

/** Hits once, then waits out the invulnerability. */
function hitAndRecover(s: HealthState): HealthState {
  const hit = takeHit(s, 1, HEALTH).state;
  return stepHealth(hit, HEALTH.invulnerableMs, HEALTH).state;
}

describe('takeHit', () => {
  it('starts with full health and all lives', () => {
    expect(fresh()).toEqual({ hp: 4, lives: 3, invulnerableMs: 0, stunMs: 0, deadMs: null });
  });

  it('a hit costs health and gives invulnerability and a short stun', () => {
    const r = takeHit(fresh(), 1, HEALTH);
    expect(r.result).toBe('hurt');
    expect(r.state).toMatchObject({ hp: 3, invulnerableMs: 1500, stunMs: 250, deadMs: null });
  });

  it('ignores hits while invulnerable', () => {
    const hurt = takeHit(fresh(), 1, HEALTH).state;
    expect(takeHit(hurt, 1, HEALTH)).toEqual({ state: hurt, result: 'ignored' });
  });

  it('can be hit again once invulnerability runs out', () => {
    const hurt = takeHit(fresh(), 1, HEALTH).state;
    const almost = stepHealth(hurt, 1499, HEALTH).state;
    expect(takeHit(almost, 1, HEALTH).result).toBe('ignored');
    const recovered = stepHealth(almost, 1, HEALTH).state;
    expect(takeHit(recovered, 1, HEALTH).result).toBe('hurt');
  });

  it('dies on the hit that empties the health bar', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = hitAndRecover(s);
    expect(s.hp).toBe(1);
    const r = takeHit(s, 1, HEALTH);
    expect(r.result).toBe('died');
    expect(r.state).toMatchObject({ hp: 0, deadMs: 0, lives: 3 });
  });

  it('ignores hits once dead, and zero or negative damage', () => {
    const dead = takeHit({ ...fresh(), hp: 1 }, 1, HEALTH).state;
    expect(takeHit(dead, 1, HEALTH).result).toBe('ignored');
    expect(takeHit(fresh(), 0, HEALTH).result).toBe('ignored');
  });

  it('big hits never take health below zero', () => {
    expect(takeHit(fresh(), 10, HEALTH).state.hp).toBe(0);
  });
});

describe('stepHealth', () => {
  const dead = (lives: number): HealthState => ({ ...fresh(), hp: 0, lives, deadMs: 0 });

  it('counts down invulnerability and stun, never below zero', () => {
    const hurt = takeHit(fresh(), 1, HEALTH).state;
    expect(stepHealth(hurt, 100, HEALTH).state).toMatchObject({
      invulnerableMs: 1400,
      stunMs: 150,
    });
    expect(stepHealth(hurt, 5000, HEALTH).state).toMatchObject({ invulnerableMs: 0, stunMs: 0 });
    expect(stepHealth(hurt, -10, HEALTH).state).toEqual(hurt);
  });

  it('waits for the respawn delay after dying', () => {
    const r = stepHealth(dead(3), 1199, HEALTH);
    expect(r.event).toBe('none');
    expect(r.state.deadMs).toBe(1199);
  });

  it('respawns with full health, invulnerable, one life fewer', () => {
    const r = stepHealth(dead(3), 1200, HEALTH);
    expect(r.event).toBe('respawn');
    expect(r.state).toEqual({ hp: 4, lives: 2, invulnerableMs: 1500, stunMs: 0, deadMs: null });
  });

  it('is game over when the last life is lost', () => {
    const r = stepHealth(dead(1), 1200, HEALTH);
    expect(r.event).toBe('game-over');
    expect(r.state.lives).toBe(0);
  });

  it('3 lives allow 3 deaths: respawn, respawn, game over', () => {
    let s = fresh();
    const events: string[] = [];
    for (let death = 0; death < 3; death++) {
      s = takeHit({ ...s, hp: 1, invulnerableMs: 0 }, 1, HEALTH).state;
      const r = stepHealth(s, 1200, HEALTH);
      events.push(r.event);
      s = r.state;
    }
    expect(events).toEqual(['respawn', 'respawn', 'game-over']);
  });
});

describe('visibleWhileInvulnerable', () => {
  it('is always visible when not invulnerable', () => {
    expect(visibleWhileInvulnerable(0, 80)).toBe(true);
  });

  it('blinks every 80 ms while invulnerable', () => {
    // 1520 / 80 = 19 (odd: hidden), 1440 / 80 = 18 (even: shown), and so on.
    expect([1520, 1440, 1360, 1280].map((ms) => visibleWhileInvulnerable(ms, 80))).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });
});

describe('respawnPoint', () => {
  const start = { x: 48, y: 160 };
  const a = { x: 560, y: 160 };
  const b = { x: 900, y: 128 };

  it('is the start until a checkpoint is passed', () => {
    expect(respawnPoint(start, [a, b], 500)).toBe(start);
  });

  it('is the furthest checkpoint passed, in any order', () => {
    expect(respawnPoint(start, [a, b], 560)).toBe(a);
    expect(respawnPoint(start, [b, a], 1000)).toBe(b);
  });

  it('works with no checkpoints', () => {
    expect(respawnPoint(start, [], 1000)).toBe(start);
  });
});

describe('fallDeath', () => {
  it('kills at once, even while invulnerable', () => {
    const hurt = takeHit(fresh(), 1, HEALTH).state;
    expect(hurt.invulnerableMs).toBeGreaterThan(0);
    expect(fallDeath(hurt)).toMatchObject({ hp: 0, deadMs: 0, invulnerableMs: 0, lives: 3 });
  });

  it('leaves an already dead marine alone', () => {
    const dead = takeHit({ ...fresh(), hp: 1 }, 1, HEALTH).state;
    expect(fallDeath({ ...dead, deadMs: 500 })).toEqual({ ...dead, deadMs: 500 });
  });

  it('then respawns like any death', () => {
    expect(stepHealth(fallDeath(fresh()), 1200, HEALTH).event).toBe('respawn');
  });
});
