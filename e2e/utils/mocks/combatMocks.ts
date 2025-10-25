import type { StatsUpdate } from '$lib/ai/agents/combatAgent';
import { MOCK_REST_ACTIONS } from './gameActionMocks';

export function generateCombatStatsUpdateResponse(context: { isRest?: boolean; userMessage?: string }): StatsUpdate[] {
  if (context.isRest) {
    return context.userMessage?.includes('long') ? 
      MOCK_REST_ACTIONS.long.stats_update! :
      MOCK_REST_ACTIONS.short.stats_update!;
  }

  return [
    {
      targetName: 'player_character_1',
      type: 'HP_lost',
      value: { result: 3 },
      explanation: 'Took damage in combat'
    }
  ];
}
