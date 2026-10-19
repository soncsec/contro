/**
 * Cheat codes (M2.11), entered while the game is paused.
 *
 * - The Konami code is a sequence of actions, so it works on a keyboard or a gamepad.
 * - The word cheats are typed letters. They use only letters the game doesn't bind
 *   (WASD move, P pauses, X/J fire, Z/K jump, F is fullscreen), so typing one never
 *   moves the menu or closes it.
 */
export type CheatId = 'extra-lives' | 'invincible' | 'invisible' | 'skip-room' | 'next-weapon';

export interface CheatCode {
  id: CheatId;
  /** Action names (up, down, left, right, fire, jump) or single letters. */
  sequence: readonly string[];
}

export const ACTION_CHEATS: readonly CheatCode[] = [
  {
    id: 'extra-lives',
    sequence: ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'fire', 'jump'],
  },
];

export const WORD_CHEATS: readonly CheatCode[] = [
  { id: 'invincible', sequence: ['I', 'R', 'O', 'N'] },
  { id: 'invisible', sequence: ['G', 'H', 'O', 'U', 'L'] },
  { id: 'skip-room', sequence: ['T', 'H', 'R', 'U'] },
  // All weapons (M4.1; word chosen by the owner 2026-10-19): each entry steps to the next one.
  { id: 'next-weapon', sequence: ['G', 'U', 'N', 'N', 'Y'] },
];

/** Letters the game binds to actions or fullscreen; no word cheat may use them. */
export const RESERVED_LETTERS = ['W', 'A', 'S', 'D', 'P', 'X', 'J', 'Z', 'K', 'F'] as const;

/** Watches a stream of tokens and reports when one of its codes has just been completed. */
export class CheatMatcher {
  private recent: string[] = [];
  private readonly longest: number;

  constructor(private readonly codes: readonly CheatCode[]) {
    this.longest = Math.max(0, ...codes.map((c) => c.sequence.length));
  }

  /** Adds a token. Returns the cheat it completes, or null. */
  push(token: string): CheatId | null {
    this.recent.push(token);
    if (this.recent.length > this.longest) this.recent.shift();
    for (const code of this.codes) {
      const n = code.sequence.length;
      if (
        this.recent.length >= n &&
        code.sequence.every((t, i) => this.recent[this.recent.length - n + i] === t)
      ) {
        this.recent = [];
        return code.id;
      }
    }
    return null;
  }

  /**
   * How far into some code the latest tokens are (0 if they start none). While this is 2 or
   * more, the pause menu treats fire and jump as code input rather than choosing an option.
   */
  get progress(): number {
    let best = 0;
    for (const code of this.codes) {
      for (let len = Math.min(code.sequence.length - 1, this.recent.length); len > best; len--) {
        const tail = this.recent.slice(this.recent.length - len);
        if (tail.every((t, i) => t === code.sequence[i])) {
          best = len;
          break;
        }
      }
    }
    return best;
  }

  reset(): void {
    this.recent = [];
  }
}

/** Cheats active in a run. `used` stays true once any cheat has been entered. */
export interface CheatState {
  invincible: boolean;
  invisible: boolean;
  used: boolean;
}

export const NO_CHEATS: CheatState = { invincible: false, invisible: false, used: false };

/** Applies a cheat's lasting effect (lives and room skips are handled by the game). */
export function applyCheat(s: CheatState, id: CheatId): CheatState {
  switch (id) {
    case 'invincible':
      return { ...s, invincible: !s.invincible, used: true };
    case 'invisible':
      return { ...s, invisible: !s.invisible, used: true };
    case 'extra-lives':
    case 'skip-room':
    case 'next-weapon':
      return { ...s, used: true };
  }
}
