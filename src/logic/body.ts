/**
 * Placing a physics box inside a sprite frame. The art is drawn facing right; when a
 * sprite is flipped to face left, its box must be mirrored inside the frame too.
 */
export interface BodyBox {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/** Horizontal offset of the box inside the frame for the given facing. */
export function bodyOffsetX(frameWidth: number, box: BodyBox, facingLeft: boolean): number {
  return facingLeft ? frameWidth - box.offsetX - box.width : box.offsetX;
}

/** Sprite centre y that puts the bottom of the box (the feet) at feetY. */
export function spriteYForFeet(feetY: number, frameHeight: number, box: BodyBox): number {
  return feetY - (box.offsetY + box.height) + frameHeight / 2;
}

/**
 * World position of a point drawn at pixel (px, py) in a frame facing right,
 * for a sprite centred at (spriteX, spriteY) that may be flipped to face left.
 * Returns the outer edge of that pixel in the facing direction.
 */
export function framePointToWorld(
  spriteX: number,
  spriteY: number,
  frame: { width: number; height: number },
  point: readonly [number, number],
  facingLeft: boolean,
): { x: number; y: number } {
  const left = spriteX - frame.width / 2;
  const [px, py] = point;
  return {
    x: facingLeft ? left + frame.width - 1 - px : left + px + 1,
    y: spriteY - frame.height / 2 + py + 0.5,
  };
}
