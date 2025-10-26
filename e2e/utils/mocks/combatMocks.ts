import { MOCK_REST_ACTIONS } from './gameActionMocks';
import type { Targets, GameActionState } from '$lib/ai/agents/gameAgent';

export function generateCombatStatsUpdateResponse(context: { isRest?: boolean; userMessage?: string }): GameActionState {
  if (context.isRest) {
    return context.userMessage?.includes('long') ? 
      MOCK_REST_ACTIONS.long.stats_update! :
      MOCK_REST_ACTIONS.short.stats_update!;
  }

  return {
    story: 'You stand at the edge of a floating island, looking out at the broken skybridge fragments drifting in the clouds. The wind carries whispers of distant voices from the separated islands. Your party gathers around, ready to begin this crucial mission.',
    is_character_in_combat: false,
    currently_present_npcs: {
      hostile: [],
      friendly: [{ uniqueTechnicalNameId: 'guild_master_torren', displayName: 'Guild Master Torren' }],
      neutral: []
    } as Targets,
    inventory_update: [],
    stats_update: [
      {
      targetName: 'player_character_1',
      type: 'HP_lost',
      value: { result: 3 },
      explanation: 'Took damage in combat'
    }
    ],
    story_memory_explanation: 'Party arrives at collapse site. LONG_TERM_IMPACT: HIGH'
  }
}
