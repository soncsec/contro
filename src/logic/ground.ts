/** What a body is standing on, worked out from the map's collision rectangles. */
import type { CollisionType, Rect } from './levelMap';

/**
 * The type of rectangle a body is standing on: its bottom is on the rectangle's top
 * (within `tolerance` px) and it overlaps it sideways. Solid ground wins if both apply.
 */
export function standingOn(
  body: { left: number; right: number; bottom: number },
  rects: readonly (Rect & { type: CollisionType })[],
  tolerance = 1,
): CollisionType | null {
  let found: CollisionType | null = null;
  for (const r of rects) {
    const onTop = Math.abs(body.bottom - r.y) <= tolerance;
    const overlaps = body.right > r.x && body.left < r.x + r.width;
    if (onTop && overlaps) {
      if (r.type === 'solid') return 'solid';
      found = r.type;
    }
  }
  return found;
}
