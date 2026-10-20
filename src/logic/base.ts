/**
 * Into-the-screen base rooms (ADR-C11, M5.6; owner request 2026-10-20). The room is seen in
 * fixed perspective: the marine moves left and right along its near edge, his shots fly into
 * it, walkers come out of the far end at him, and destroying the far wall's core drops the
 * barrier to the next room. Pure, so it is unit tested; BaseScene draws it.
 *
 * Positions: `x` is across the room in near-edge pixels (0–320, the screen's width at the
 * near edge), `z` is depth (0 the near edge, 1 the far wall) and `h` is height above the
 * floor in near-edge pixels. `project` turns them into screen pixels.
 */
import type { Rng } from './rng';

export interface ProjectionTuning {
  /** Screen x of the room's centre line. */
  centerX: number;
  /** Screen y of the floor at the near edge and at the far wall. */
  nearFloorY: number;
  farFloorY: number;
  /** How big things look at the far wall, relative to the near edge. */
  farScale: number;
}

/** How big something at depth z looks: 1 at the near edge, farScale at the far wall. */
export function depthScale(z: number, t: ProjectionTuning): number {
  return 1 / (1 + z * (1 / t.farScale - 1));
}

/** Screen position and scale of a point x across, z deep and h above the floor. */
export function project(
  x: number,
  z: number,
  h: number,
  t: ProjectionTuning,
): { x: number; y: number; scale: number } {
  const s = depthScale(z, t);
  // The floor lines meet at a vanishing point, placed so the far wall's floor is farFloorY.
  const vanishY = (t.farFloorY - t.nearFloorY * t.farScale) / (1 - t.farScale);
  return {
    x: t.centerX + (x - t.centerX) * s,
    y: vanishY + (t.nearFloorY - vanishY) * s - h * s,
    scale: s,
  };
}

export interface MarineTuning {
  speed: number;
  minX: number;
  maxX: number;
  /** Jump launch speed and gravity, in near-edge pixels. */
  jumpSpeed: number;
  gravity: number;
  /** Half his width across the room. */
  halfWidth: number;
}

export interface BaseMarine {
  x: number;
  /** Height above the floor (jumping). */
  h: number;
  vh: number;
  crouching: boolean;
}

export interface BaseInput {
  left: boolean;
  right: boolean;
  down: boolean;
  /** Jump newly pressed this frame. */
  jump: boolean;
}

export const initialMarine = (x: number): BaseMarine => ({ x, h: 0, vh: 0, crouching: false });

/** Moves him along the near edge; jumps from the floor; crouches while down is held. */
export function stepMarine(
  m: BaseMarine,
  input: BaseInput,
  dtMs: number,
  t: MarineTuning,
): BaseMarine {
  const dt = Math.max(0, dtMs) / 1000;
  const onFloor = m.h <= 0;
  const crouching = onFloor && input.down;
  const dir = crouching ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const x = Math.min(t.maxX, Math.max(t.minX, m.x + dir * t.speed * dt));
  let vh = onFloor && input.jump && !crouching ? t.jumpSpeed : m.vh;
  let h = Math.max(0, m.h + vh * dt);
  vh = h > 0 ? vh - t.gravity * dt : 0;
  if (h <= 0) h = 0;
  return { x, h, vh, crouching };
}

export interface ShotTuning {
  /** Depth covered per second. */
  depthSpeed: number;
  /** Height the shots fly at, standing and crouched. */
  height: number;
  crouchHeight: number;
  /** Half the width a shot can hit with. */
  halfWidth: number;
  /** Sideways drift per unit of depth for each step of a spread. */
  spreadDrift: number;
}

export interface BaseShot {
  /** Where it left, across the room, and its sideways drift per unit of depth. */
  x0: number;
  drift: number;
  z: number;
  h: number;
}

/** Where a shot is across the room at depth z. */
export const shotX = (s: BaseShot, z = s.z): number => s.x0 + s.drift * z;

/** The shots one trigger pull fires: `bullets` of them, fanned out like the spread gun. */
export function fireShots(m: BaseMarine, bullets: number, t: ShotTuning): BaseShot[] {
  const h = m.h + (m.crouching ? t.crouchHeight : t.height);
  return Array.from({ length: bullets }, (_, i) => ({
    x0: m.x,
    drift: (i - (bullets - 1) / 2) * t.spreadDrift,
    z: 0,
    h,
  }));
}

/** Something a shot can hit: x across, z deep, half its width. */
export interface Target {
  x: number;
  z: number;
  halfWidth: number;
}

/**
 * Moves a shot deeper. Returns the index of the first target (nearest first) it passed
 * through this frame, or -1, and whether it reached the far wall.
 */
export function stepShot(
  s: BaseShot,
  dtMs: number,
  targets: readonly Target[],
  t: ShotTuning,
): { shot: BaseShot; hit: number; atWall: boolean } {
  const z = s.z + (t.depthSpeed * Math.max(0, dtMs)) / 1000;
  let hit = -1;
  let nearest = Infinity;
  targets.forEach((target, i) => {
    const passes = s.z <= target.z && target.z <= z;
    const across = Math.abs(shotX(s, target.z) - target.x) <= target.halfWidth + t.halfWidth;
    if (passes && across && target.z < nearest) {
      nearest = target.z;
      hit = i;
    }
  });
  return { shot: { ...s, z }, hit, atWall: z >= 1 };
}

export interface WalkerTuning {
  /** Depth covered per second as it runs at him. */
  depthSpeed: number;
  /** Speed across the room, steering towards him. */
  steerSpeed: number;
  halfWidth: number;
  /** Its height: a jump that clears it dodges it. */
  height: number;
}

export interface BaseWalker {
  x: number;
  z: number;
  hp: number;
}

/**
 * Runs it at the marine. `contact` is true on the frame it reaches the near edge where he
 * stands (and he isn't jumping over it); it is `gone` once past the near edge.
 */
export function stepWalker(
  w: BaseWalker,
  m: BaseMarine,
  marineHalfWidth: number,
  dtMs: number,
  t: WalkerTuning,
): { walker: BaseWalker; contact: boolean; gone: boolean } {
  const dt = Math.max(0, dtMs) / 1000;
  const z = w.z - t.depthSpeed * dt;
  const steer = Math.sign(m.x - w.x) * Math.min(Math.abs(m.x - w.x), t.steerSpeed * dt);
  const x = w.x + steer;
  const reached = w.z > 0 && z <= 0;
  const contact = reached && Math.abs(x - m.x) <= t.halfWidth + marineHalfWidth && m.h < t.height;
  return { walker: { ...w, x, z }, contact, gone: z <= 0 };
}

/** One room: its core and the walkers that come out of the far end. */
export interface BaseRoom {
  core: { hp: number; halfWidth: number };
  walkers: {
    /** The first comes out after this long, then one every `everyMs`, `count` in all. */
    firstMs: number;
    everyMs: number;
    count: number;
    /** Where they may come out, across the room (picked with the seeded RNG). */
    lanes: readonly number[];
    hp: number;
  };
}

export interface RoomState {
  coreHp: number;
  /** Walkers sent so far, and time to the next. */
  sent: number;
  nextMs: number;
  /** Time since the core was destroyed (null while it stands). */
  clearedMs: number | null;
}

export const initialRoom = (room: BaseRoom): RoomState => ({
  coreHp: room.core.hp,
  sent: 0,
  nextMs: room.walkers.firstMs,
  clearedMs: null,
});

/** Time passes in the room: returns any walker sent out this frame. */
export function stepRoom(
  r: RoomState,
  room: BaseRoom,
  dtMs: number,
  rng: Rng,
): { room: RoomState; spawn: BaseWalker | null } {
  const dt = Math.max(0, dtMs);
  if (r.clearedMs !== null) return { room: { ...r, clearedMs: r.clearedMs + dt }, spawn: null };
  if (r.sent >= room.walkers.count) return { room: r, spawn: null };
  const nextMs = r.nextMs - dt;
  if (nextMs > 0) return { room: { ...r, nextMs }, spawn: null };
  const spawn = { x: rng.pick(room.walkers.lanes), z: 1, hp: room.walkers.hp };
  return { room: { ...r, sent: r.sent + 1, nextMs: nextMs + room.walkers.everyMs }, spawn };
}

/** A hit on the core. Destroying it starts the room's clearing (the barrier drops). */
export function hitCore(r: RoomState, damage: number): RoomState {
  if (r.clearedMs !== null) return r;
  const coreHp = Math.max(0, r.coreHp - damage);
  return { ...r, coreHp, clearedMs: coreHp === 0 ? 0 : null };
}
