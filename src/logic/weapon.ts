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
  const fired = (fire || firePressed) && since >= (firePressed ? t.tapMinMs : t.autoIntervalMs);
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
