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
