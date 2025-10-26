import type { AiLevelUp } from '$lib/ai/agents/characterStatsAgent';

export const MOCK_LEVEL_UP: AiLevelUp = {
  character_name: 'Aerin Brightwind',
  level_up_explanation: 'Through your recent challenges and narrow escapes, you\'ve grown more agile and learned to better control your stamina.',
  attribute: 'Dexterity',
  ability: {
    name: 'Enhanced Grappling Hook',
    effect: 'Your grappling hook lunge now pulls harder and deals 1d6 damage instead of 1d4.',
    resource_cost: { resource_key: 'STAMINA', cost: 2 },
    image_prompt: 'enhanced grappling hook icon'
  },
  resources: { HP: 30, STAMINA: 12, MANA: 8 }
};

export function generateLevelUpResponse(_context: any): AiLevelUp {
  return MOCK_LEVEL_UP;
}
