/**
 * Flying alien behaviour (M2.5): hover and drift around a spawn point, fire slow aimed shots,
 * and now and then dive at where the marine stands, after a short warning pause.
 * Pure: returns the velocity to apply and any shot to fire.
 */
export interface FlyerTuning {
  /** Drift speed while hovering, and how far either side of the spawn point it drifts. */
  driftSpeed: number;
  patrolRange: number;
  /** Up-and-down bob while hovering. */
  bobAmplitude: number;
  bobPeriodMs: number;
  /** Dives when the marine is below it and within this horizontal distance. */
  diveRangeX: number;
  diveCooldownMs: number;
  /** Stops still for this long before diving (the warning). */
  windupMs: number;
  diveSpeed: number;
  /** Gives up a dive after this long even if it hasn't reached its target. */
  maxDiveMs: number;
  riseSpeed: number;
  /** Fires at the marine when within this distance, at most this often. */
  fireRange: number;
  fireCooldownMs: number;
  shotSpeed: number;
}

export type FlyerMode = 'hover' | 'windup' | 'dive' | 'rise';

export interface FlyerState {
  mode: FlyerMode;
  /** Time spent in the current mode. */
  modeMs: number;
  /** Time used for the hover bob. */
  bobMs: number;
  direction: -1 | 1;
  diveCooldownMs: number;
  fireCooldownMs: number;
  /** Where the current dive is heading. */
  target: { x: number; y: number } | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface FlyerStep {
  state: FlyerState;
  vx: number;
  vy: number;
  /** Velocity of a shot fired this frame, or null. */
  shot: { vx: number; vy: number } | null;
}

/**
 * Start hovering, facing left. `stagger` delays the first shot and dive (e.g. by spawn order)
 * so a group of flyers doesn't act in unison.
 */
export function initialFlyer(t: FlyerTuning, stagger = 0): FlyerState {
  return {
    mode: 'hover',
    modeMs: 0,
    bobMs: 0,
    direction: -1,
    diveCooldownMs: t.diveCooldownMs / 2 + stagger,
    fireCooldownMs: t.fireCooldownMs / 2 + stagger,
    target: null,
  };
}

/** Velocity of `speed` from `from` towards `to` (zero if they are the same point). */
export function towards(from: Point, to: Point, speed: number): { vx: number; vy: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { vx: 0, vy: 0 };
  return { vx: (dx / len) * speed, vy: (dy / len) * speed };
}

/** Vertical speed that pulls `y` towards `targetY`, capped at `max`. */
function follow(y: number, targetY: number, max: number): number {
  const v = (targetY - y) * 6;
  return Math.max(-max, Math.min(max, v));
}

export function stepFlyer(
  s: FlyerState,
  pos: Point,
  anchor: Point,
  player: Point | null,
  dtMs: number,
  t: FlyerTuning,
): FlyerStep {
  const dt = Math.max(0, dtMs);
  const base = { ...s, modeMs: s.modeMs + dt };

  if (s.mode === 'windup') {
    if (base.modeMs < t.windupMs) return { state: base, vx: 0, vy: 0, shot: null };
    return { state: { ...base, mode: 'dive', modeMs: 0 }, vx: 0, vy: 0, shot: null };
  }

  if (s.mode === 'dive') {
    const target = s.target ?? pos;
    const arrived = Math.hypot(target.x - pos.x, target.y - pos.y) <= 4 || pos.y >= target.y;
    if (arrived || base.modeMs >= t.maxDiveMs) {
      return {
        state: { ...base, mode: 'rise', modeMs: 0, target: null },
        vx: 0,
        vy: -t.riseSpeed,
        shot: null,
      };
    }
    const v = towards(pos, target, t.diveSpeed);
    const direction = v.vx < 0 ? -1 : v.vx > 0 ? 1 : s.direction;
    return { state: { ...base, direction }, vx: v.vx, vy: v.vy, shot: null };
  }

  if (s.mode === 'rise') {
    if (pos.y <= anchor.y) {
      return {
        state: { ...base, mode: 'hover', modeMs: 0, diveCooldownMs: t.diveCooldownMs },
        vx: 0,
        vy: 0,
        shot: null,
      };
    }
    return { state: base, vx: 0, vy: -t.riseSpeed, shot: null };
  }

  // Hover: drift back and forth, bob, count down to the next shot and dive.
  const bobMs = s.bobMs + dt;
  let direction = s.direction;
  if (direction > 0 && pos.x >= anchor.x + t.patrolRange) direction = -1;
  if (direction < 0 && pos.x <= anchor.x - t.patrolRange) direction = 1;
  const bobY = anchor.y + Math.sin((bobMs / t.bobPeriodMs) * Math.PI * 2) * t.bobAmplitude;
  let fireCooldownMs = Math.max(0, s.fireCooldownMs - dt);
  const diveCooldownMs = Math.max(0, s.diveCooldownMs - dt);
  const state: FlyerState = { ...base, bobMs, direction, fireCooldownMs, diveCooldownMs };

  if (
    player &&
    diveCooldownMs === 0 &&
    player.y > pos.y &&
    Math.abs(player.x - pos.x) <= t.diveRangeX
  ) {
    return {
      state: {
        ...state,
        mode: 'windup',
        modeMs: 0,
        target: { x: player.x, y: player.y },
        direction: player.x < pos.x ? -1 : 1,
      },
      vx: 0,
      vy: 0,
      shot: null,
    };
  }

  let shot: FlyerStep['shot'] = null;
  if (
    player &&
    fireCooldownMs === 0 &&
    Math.hypot(player.x - pos.x, player.y - pos.y) <= t.fireRange
  ) {
    shot = towards(pos, player, t.shotSpeed);
    fireCooldownMs = t.fireCooldownMs;
  }
  return {
    state: { ...state, fireCooldownMs },
    vx: direction * t.driftSpeed,
    vy: follow(pos.y, bobY, t.riseSpeed),
    shot,
  };
}
