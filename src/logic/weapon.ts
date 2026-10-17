/**
 * Fire-rate rules. Holding fire shoots every autoIntervalMs; tapping can shoot as often
 * as every tapMinMs, so a fast tapper fires faster than holding, as in Contra.
 */
export interface WeaponTuning {
  autoIntervalMs: number;
  tapMinMs: number;
}

export interface WeaponState {
  /** Time since the last shot. */
  sinceShotMs: number;
  /** Fire was held last frame. */
  held: boolean;
}

export const initialWeapon = (): WeaponState => ({
  sinceShotMs: Number.POSITIVE_INFINITY,
  held: false,
});

export function stepWeapon(
  prev: WeaponState,
  fire: boolean,
  dtMs: number,
  t: WeaponTuning,
): { state: WeaponState; fired: boolean } {
  const since = prev.sinceShotMs + Math.max(dtMs, 0);
  const freshPress = fire && !prev.held;
  const fired = fire && since >= (freshPress ? t.tapMinMs : t.autoIntervalMs);
  return { state: { sinceShotMs: fired ? 0 : since, held: fire }, fired };
}

/** True once a bullet at x is more than `margin` outside the camera view. */
export function bulletOutOfView(
  x: number,
  viewLeft: number,
  viewWidth: number,
  margin: number,
): boolean {
  return x < viewLeft - margin || x > viewLeft + viewWidth + margin;
}
