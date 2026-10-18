/**
 * Fire-rate rules. Each press fires once, at most every tapMinMs. A weapon with autoFire
 * (the planned machine gun, M4.1) also keeps firing every autoIntervalMs while fire is held;
 * the basic rifle doesn't (owner request, issue #21).
 */
export interface WeaponTuning {
  /** Keep firing while fire is held. */
  autoFire: boolean;
  autoIntervalMs: number;
  tapMinMs: number;
}

export interface WeaponState {
  /** Time since the last shot. */
  sinceShotMs: number;
}

export const initialWeapon = (): WeaponState => ({
  sinceShotMs: Number.POSITIVE_INFINITY,
});

/**
 * @param fire fire is held this frame
 * @param firePressed fire was newly pressed since the last frame (from the input layer)
 */
export function stepWeapon(
  prev: WeaponState,
  fire: boolean,
  firePressed: boolean,
  dtMs: number,
  t: WeaponTuning,
): { state: WeaponState; fired: boolean } {
  const since = prev.sinceShotMs + Math.max(dtMs, 0);
  const fired = firePressed ? since >= t.tapMinMs : t.autoFire && fire && since >= t.autoIntervalMs;
  return { state: { sinceShotMs: fired ? 0 : since }, fired };
}

/** True once a bullet at (x, y) is more than `margin` outside the camera view. */
export function bulletOutOfView(
  x: number,
  y: number,
  view: { x: number; y: number; width: number; height: number },
  margin: number,
): boolean {
  return (
    x < view.x - margin ||
    x > view.x + view.width + margin ||
    y < view.y - margin ||
    y > view.y + view.height + margin
  );
}
