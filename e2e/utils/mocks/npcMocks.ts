import type { NPCState } from '$lib/ai/agents/characterStatsAgent';

export const MOCK_NPC_STATS: NPCState = {
  sky_sentry_1: {
    is_party_member: false,
    class: 'Construct Guardian',
    rank_enum_english: 'Average',
    level: 2,
    spells_and_abilities: [
      {
        name: 'Standard Attack',
        effect: 'A basic melee attack dealing 1d6 damage.',
        resource_cost: { resource_key: undefined, cost: 0 },
        image_prompt: 'sword strike icon'
      },
      {
        name: 'Shocking Grasp',
        effect: 'Electric touch attack dealing 1d8 lightning damage.',
        resource_cost: { resource_key: undefined, cost: 0 },
        image_prompt: 'lightning hand icon'
      }
    ]
  },
  guild_master_torren: {
    is_party_member: false,
    class: 'Noble',
    rank_enum_english: 'Weak',
    level: 5,
    spells_and_abilities: [
      {
        name: 'Standard Attack',
        effect: 'A basic melee attack dealing 1d4 damage.',
        resource_cost: { resource_key: undefined, cost: 0 },
        image_prompt: 'dagger icon'
      }
    ]
  }
};

export function generateNPCResponse(_context: any): NPCState {
  return MOCK_NPC_STATS;
}
