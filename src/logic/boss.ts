/**
 * Boss rules (M3.2): rolling in, phases by remaining health, driving back and forth,
 * attacks on timers, taking damage and blowing up. Pure functions, unit tested; the Boss
 * entity applies them to a sprite. Bosses themselves are data (src/data/bosses.ts).
 */

export type BossMode = 'waiting' | 'intro' | 'fight' | 'dying' | 'dead';
export type AttackKind = 'cannon' | 'mortar';

export interface AttackTuning {
  kind: AttackKind;
  /** Time between attacks of this kind. */
  cooldownMs: number;
  /** Time before the first one, once the phase starts. */
  firstDelayMs: number;
}

export interface BossPhaseTuning {
  /** The phase starts once health falls to this share of full health (the first is 1). */
  fromHpShare: number;
  /** Driving speed in px/s. */
  driveSpeed: number;
  attacks: readonly AttackTuning[];
}

export interface BossTuning {
  hp: number;
  /** Speed rolling into the arena, px/s. */
  introSpeed: number;
  /** In order, the first starting at full health. */
  phases: readonly BossPhaseTuning[];
  /** How long it takes to blow up, before the level ends. */
  dyingMs: number;
}

export interface BossState {
  mode: BossMode;
  hp: number;
  phase: number;
  /** Driving direction: -1 left, 1 right. */
  direction: -1 | 1;
  /** Time until each attack of the current phase, by kind. */
  timers: Partial<Record<AttackKind, number>>;
  /** Time left blowing up. */
  dyingMs: number;
}

export interface BossStep {
  state: BossState;
  /** Horizontal speed to apply. */
  vx: number;
  /** Attacks to make this frame. */
  attacks: AttackKind[];
  /** True in the frame the explosion ends. */
  finished: boolean;
}

/** Where the boss may drive: its body centre stays between these x positions. */
export interface DriveRange {
  min: number;
  max: number;
}

export function initialBoss(t: BossTuning): BossState {
  return { mode: 'waiting', hp: t.hp, phase: 0, direction: -1, timers: {}, dyingMs: 0 };
}

/** The phase for this much health: the last whose threshold the health has fallen to. */
export function phaseFor(hp: number, t: BossTuning): number {
  const share = hp / t.hp;
  let phase = 0;
  t.phases.forEach((p, i) => {
    if (share <= p.fromHpShare) phase = i;
  });
  return phase;
}

/** The arena is entered: the boss starts rolling in. */
export function startBoss(state: BossState): BossState {
  return state.mode === 'waiting' ? { ...state, mode: 'intro' } : state;
}

const firstTimers = (phase: BossPhaseTuning): BossState['timers'] =>
  Object.fromEntries(phase.attacks.map((a) => [a.kind, a.firstDelayMs]));

/** One frame. `x` is the body centre. */
export function stepBoss(
  prev: BossState,
  x: number,
  range: DriveRange,
  dtMs: number,
  t: BossTuning,
): BossStep {
  const none = { vx: 0, attacks: [] as AttackKind[], finished: false };
  switch (prev.mode) {
    case 'waiting':
    case 'dead':
      return { state: prev, ...none };
    case 'dying': {
      const dyingMs = prev.dyingMs - dtMs;
      if (dyingMs > 0) return { state: { ...prev, dyingMs }, ...none };
      return { state: { ...prev, mode: 'dead', dyingMs: 0 }, ...none, finished: true };
    }
    case 'intro': {
      const phase = t.phases[0];
      if (x > range.max || !phase) return { state: prev, ...none, vx: -t.introSpeed };
      const state: BossState = { ...prev, mode: 'fight', phase: 0, timers: firstTimers(phase) };
      return { state, ...none };
    }
    case 'fight':
      return fight(prev, x, range, dtMs, t);
  }
}

function fight(
  prev: BossState,
  x: number,
  range: DriveRange,
  dtMs: number,
  t: BossTuning,
): BossStep {
  const phaseIndex = phaseFor(prev.hp, t);
  const phase = t.phases[phaseIndex];
  if (!phase) return { state: prev, vx: 0, attacks: [], finished: false };
  // A new phase starts its own attack timers.
  const timers = phaseIndex === prev.phase ? { ...prev.timers } : firstTimers(phase);
  let direction = prev.direction;
  if (x <= range.min) direction = 1;
  else if (x >= range.max) direction = -1;
  const attacks: AttackKind[] = [];
  for (const a of phase.attacks) {
    const left = (timers[a.kind] ?? a.firstDelayMs) - dtMs;
    if (left <= 0) {
      attacks.push(a.kind);
      timers[a.kind] = left + a.cooldownMs;
    } else {
      timers[a.kind] = left;
    }
  }
  return {
    state: { ...prev, phase: phaseIndex, direction, timers },
    vx: direction * phase.driveSpeed,
    attacks,
    finished: false,
  };
}

/**
 * A hit. The boss only takes damage while fighting (not while it rolls in or blows up).
 * Returns the new state, whether the hit counted, and whether it destroyed the boss.
 */
export function damageBoss(
  prev: BossState,
  amount: number,
  t: BossTuning,
): { state: BossState; hit: boolean; destroyed: boolean } {
  if (prev.mode !== 'fight' || amount <= 0) return { state: prev, hit: false, destroyed: false };
  const hp = Math.max(0, prev.hp - amount);
  if (hp > 0) return { state: { ...prev, hp }, hit: true, destroyed: false };
  return {
    state: { ...prev, hp: 0, mode: 'dying', dyingMs: t.dyingMs, timers: {} },
    hit: true,
    destroyed: true,
  };
}

/**
 * True once a lobbed shell has come down to its landing height (M3.12: shots pass through
 * terrain, so a shell bursts where it was aimed rather than where it hits a floor).
 */
export function shellLanded(y: number, vy: number, landY: number): boolean {
  return vy >= 0 && y >= landY;
}

/**
 * Launch velocity for a lobbed shell to fly from `from` to `to` in `flightMs`, under
 * `gravity` (px/s², y down).
 */
export function lobVelocity(
  from: { x: number; y: number },
  to: { x: number; y: number },
  flightMs: number,
  gravity: number,
): { vx: number; vy: number } {
  const s = flightMs / 1000;
  return { vx: (to.x - from.x) / s, vy: (to.y - from.y - 0.5 * gravity * s * s) / s };
}

/** The arena locks once the marine's centre reaches its middle (the camera is then on it). */
export function arenaLocked(playerX: number, arena: { x: number; width: number }): boolean {
  return playerX >= arena.x + arena.width / 2;
}
