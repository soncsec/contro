/**
 * Dialogue cards shown between rooms and levels (PROJECT.md: minimal text, owner decision
 * 2026-10-17). Names and lines are placeholders for the owner to edit.
 * tests/unit/dialogue.test.ts checks every card fits on screen.
 */
export interface Speaker {
  name: string;
  /** Image asset key of the 48×48 portrait. */
  portrait: string;
}

export const SPEAKERS = {
  commander: { name: 'COMMANDER VALE', portrait: 'portrait-commander' },
  ops: { name: 'OPS', portrait: 'portrait-ops' },
  marine: { name: 'MARINE', portrait: 'portrait-marine' },
  hive: { name: 'THE HIVE', portrait: 'portrait-hive' },
} as const satisfies Record<string, Speaker>;

export type SpeakerId = keyof typeof SPEAKERS;

export interface DialogueCard {
  speaker: SpeakerId;
  /** One or two short lines. */
  lines: readonly string[];
}

export const DIALOGUE = {
  'room-1-exit': {
    speaker: 'ops',
    lines: ['Corridor A is clear.', 'More hostiles past the next door.'],
  },
  'room-2-exit': {
    speaker: 'hive',
    lines: ['Every step brings you', 'deeper into us, marine.'],
  },
} as const satisfies Record<string, DialogueCard>;

export type DialogueId = keyof typeof DIALOGUE;
