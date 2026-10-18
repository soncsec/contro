import { TOUCH } from '../config/tuning';
import { TOUCH_LABELS } from '../logic/controls';
import { TOUCH_BINDINGS, knobOffset, stickDirections, type StickDirection } from '../logic/touch';
import { toggleFullscreen } from './Fullscreen';

type Listener = (code: string, down: boolean) => void;

/** True on phones and tablets: a screen you touch, so the on-screen controls are needed. */
export function isTouchScreen(): boolean {
  return window.matchMedia('(any-pointer: coarse)').matches;
}

const code = (action: keyof typeof TOUCH_BINDINGS): string => TOUCH_BINDINGS[action][0] ?? '';

/**
 * The on-screen controls for touch screens (M3.11; layout approved by the owner 2026-10-18):
 * a fixed stick bottom-left, FIRE and JUMP bottom-right, pause and fullscreen top-left.
 * They are page elements styled by src/style.css (no inline styles or HTML strings, so the
 * portal's CSP holds). Presses go out as virtual key codes (TOUCH_BINDINGS), which each
 * scene's PlayerInput reads like keys.
 */
export class TouchControls {
  /** The controls, once installed on a touch screen; null otherwise. */
  static current: TouchControls | null = null;

  private readonly listeners = new Set<Listener>();
  private readonly held = new Set<string>();

  static install(fullscreenTarget: HTMLElement): TouchControls | null {
    if (TouchControls.current || !isTouchScreen()) return TouchControls.current;
    TouchControls.current = new TouchControls(fullscreenTarget);
    return TouchControls.current;
  }

  private constructor(fullscreenTarget: HTMLElement) {
    const root = el('div', 'touch');
    root.setAttribute('aria-hidden', 'true');
    root.append(
      this.stick(),
      this.button('touch-btn touch-fire', TOUCH_LABELS.fire, code('fire')),
      this.button('touch-btn touch-jump', TOUCH_LABELS.jump, code('jump')),
      this.button('touch-small touch-pause', TOUCH_LABELS.pause, code('pause')),
    );
    if (document.fullscreenEnabled) {
      // Fullscreen must start inside the tap's own event (iPhones have no fullscreen at all).
      const full = el('div', 'touch-small touch-full', TOUCH_LABELS.fullscreen);
      full.addEventListener('click', () => toggleFullscreen(fullscreenTarget));
      root.append(full);
    }
    // A long press must not select text or open a menu.
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.append(root);
    // Nothing stays held if the page is hidden or loses focus mid-press.
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => this.releaseAll());
  }

  /** Calls listener on every press and release; returns a function that stops it. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Codes held right now, so a scene that starts mid-press knows about them. */
  heldCodes(): string[] {
    return [...this.held];
  }

  private set(c: string, down: boolean): void {
    if (down === this.held.has(c)) return;
    if (down) this.held.add(c);
    else this.held.delete(c);
    for (const listener of this.listeners) listener(c, down);
  }

  private releaseAll(): void {
    for (const c of [...this.held]) this.set(c, false);
  }

  private button(className: string, label: string, c: string): HTMLElement {
    const b = el('div', className, label);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(b, e);
      this.set(c, true);
    });
    for (const end of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      b.addEventListener(end, () => this.set(c, false));
    }
    return b;
  }

  private stick(): HTMLElement {
    const ring = el('div', 'touch-stick');
    const knob = el('div', 'touch-knob');
    for (const [arrow, cls] of [
      ['▲', 'up'],
      ['▼', 'down'],
      ['◀', 'left'],
      ['▶', 'right'],
    ] as const) {
      ring.append(el('span', `touch-arrow touch-arrow-${cls}`, arrow));
    }
    ring.append(knob);
    let pointer: number | null = null;
    const directions: StickDirection[] = ['left', 'right', 'up', 'down'];
    const move = (e: PointerEvent): void => {
      const box = ring.getBoundingClientRect();
      const radius = box.width / 2;
      const dx = e.clientX - (box.left + radius);
      const dy = e.clientY - (box.top + radius);
      const pushed = stickDirections(dx, dy, radius, TOUCH.stickDeadzone);
      for (const d of directions) this.set(code(d), pushed.includes(d));
      const k = knobOffset(dx, dy, radius * TOUCH.knobTravel);
      knob.style.transform = `translate(${Math.round(k.x)}px, ${Math.round(k.y)}px)`;
    };
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      for (const d of directions) this.set(code(d), false);
      knob.style.transform = '';
    };
    ring.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pointer = e.pointerId;
      capture(ring, e);
      move(e);
    });
    ring.addEventListener('pointermove', (e) => {
      if (e.pointerId === pointer) move(e);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      ring.addEventListener(ev, end);
    }
    return ring;
  }
}

function el(tag: string, className: string, text = ''): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** Keep getting a thumb's events after it slides off the element (not possible for every event). */
function capture(target: HTMLElement, e: PointerEvent): void {
  try {
    target.setPointerCapture(e.pointerId);
  } catch {
    // The pointer is already gone; its pointerup still arrives.
  }
}
