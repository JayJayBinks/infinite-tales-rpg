import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';

export const MOCK_CHARACTER_STATS: CharacterStats = {
  level: 1,
  resources: {
    // Start slightly below max so state command HP gains are visible in UI tests
    HP: { max_value: 26, start_value: 20, game_ends_when_zero: true },
    STAMINA: { max_value: 10, start_value: 10, game_ends_when_zero: false },
    MANA: { max_value: 8, start_value: 8, game_ends_when_zero: false },
    XP: { max_value: 100, start_value: 0, game_ends_when_zero: false }
  },
  attributes: {
    Strength: 0,
    Dexterity: 2,
    Constitution: 1,
    Intelligence: 1,
    Wisdom: 1,
    Charisma: 0
  },
  skills: {
    Acrobatics: 2,
    Climbing: 2,
    Survival: 1,
    Perception: 1
  },
  spells_and_abilities: [
    {
      name: 'Standard Attack',
      effect: 'A basic melee or ranged attack dealing 1d6 damage.',
      resource_cost: { resource_key: undefined, cost: 0 },
      image_prompt: 'sword strike icon'
    },
    {
      name: 'Grappling Hook Lunge',
      effect: 'Use your grappling hook to pull yourself to a ledge or pull an enemy close. Deals 1d4 damage to enemies.',
      resource_cost: { resource_key: 'STAMINA', cost: 2 },
      image_prompt: 'grappling hook icon'
    },
    {
      name: 'Precise Shot',
      effect: 'A carefully aimed ranged attack with advantage, dealing 1d8 damage.',
      resource_cost: { resource_key: 'STAMINA', cost: 3 },
      image_prompt: 'arrow targeting icon'
    }
  ]
};

export function generateCharacterStatsResponse(context: { partySize?: number }): CharacterStats | CharacterStats[] {
  const partySize = context.partySize || 1;
  const baseStats = MOCK_CHARACTER_STATS;

  if (partySize === 1) {
    return baseStats;
  }

  // Generate stats array for party
  return Array.from({ length: partySize }, (_, i) => ({
    ...baseStats,
    // Vary attributes slightly for different party members
    attributes: {
      ...baseStats.attributes,
      Dexterity: i === 2 ? 0 : 2,
      Intelligence: i === 2 ? 2 : baseStats.attributes.Intelligence
    }
  }));
}
