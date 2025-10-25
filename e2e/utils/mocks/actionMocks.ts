import type { Action } from '$lib/ai/agents/gameAgent';

export const MOCK_ACTIONS: Action[] = [
  {
    characterName: 'Aerin Brightwind',
    text: 'Investigate the area carefully',
    related_attribute: 'Wisdom',
    related_skill: 'Perception',
    action_difficulty: 'MEDIUM',
    is_possible: true,
    plausibility: 'Ranger training makes investigation natural',
    type: 'Investigation',
    narration_details: { reasoning: 'Simple investigation', enum_english: 'LOW' },
    actionSideEffects: 'May attract attention',
    enemyEncounterExplanation: { reasoning: 'Quiet area', enum_english: 'LOW' },
    is_interruptible: { reasoning: 'Can stop at any time', enum_english: 'LOW' },
    dice_roll: {
      modifier: 'none',
      modifier_value: 0,
      modifier_explanation: 'Standard conditions apply'
    }
  },
  {
    characterName: 'Aerin Brightwind',
    text: 'Attempt to repair the bridge segment',
    related_attribute: 'Intelligence',
    related_skill: 'Engineering',
    action_difficulty: 'HARD',
    is_possible: true,
    plausibility: 'Requires technical knowledge',
    type: 'Misc',
    narration_details: { reasoning: 'Complex task requiring steps', enum_english: 'HIGH' },
    actionSideEffects: 'May stabilize structure or cause collapse',
    enemyEncounterExplanation: { reasoning: 'Working in open area', enum_english: 'MEDIUM' },
    is_interruptible: { reasoning: 'Critical task, cannot stop mid-process', enum_english: 'HIGH' },
    dice_roll: {
      modifier: 'malus',
      modifier_value: -2,
      modifier_explanation: 'Lacks proper tools'
    }
  },
  {
    characterName: 'Aerin Brightwind',
    text: 'Talk to Guild Master Torren',
    related_attribute: 'Charisma',
    related_skill: 'Persuasion',
    action_difficulty: 'SIMPLE',
    is_possible: true,
    plausibility: 'Guild Master is present and friendly',
    type: 'Conversation',
    narration_details: { reasoning: 'Brief conversation', enum_english: 'MEDIUM' },
    actionSideEffects: 'May gain information or quest',
    enemyEncounterExplanation: { reasoning: 'Safe location', enum_english: 'LOW' },
    is_interruptible: { reasoning: 'Conversation can be paused', enum_english: 'LOW' },
    dice_roll: {
      modifier: 'none',
      modifier_value: 0,
      modifier_explanation: 'Friendly NPC'
    }
  }
];

export function generateActionResponse(_context: any): Action[] {
  return MOCK_ACTIONS;
}
