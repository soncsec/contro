/**
 * Dialogue cards shown between levels (PROJECT.md: minimal text, owner decision 2026-10-17).
 * The story thread: the hive is taking over human machines, which is why the marine fights a
 * tank and a mech. Drafted by Claude 2026-10-18; Level 1's cards approved by the owner 2026-10-19.
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
  // Before level 1, after START on the title screen (M3.4).
  'level-1-intro': {
    speaker: 'ops',
    lines: ['Hive spores hit the', 'steelworks at 0300.', 'Clear it, marine.'],
  },
  // After the training corridor (e2e build only).
  'training-end': {
    speaker: 'ops',
    lines: ['Training complete.', 'Report to the steelworks.'],
  },
  // After level 1's last section, once the tank is destroyed.
  'level-1-end': {
    speaker: 'commander',
    lines: ['That tank was ours once.', 'The hive is driving our', 'own machines now.'],
  },
} as const satisfies Record<string, DialogueCard>;

export type DialogueId = keyof typeof DIALOGUE;
