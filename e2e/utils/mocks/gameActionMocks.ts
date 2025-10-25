import type { GameActionState } from '$lib/ai/agents/gameAgent';
import type { NpcID } from '$lib/ai/agents/characterStatsAgent';

type Targets = { hostile: Array<NpcID>; friendly: Array<NpcID>; neutral: Array<NpcID> };

export const MOCK_GAME_ACTIONS = {
  default: {
    story: 'You stand at the edge of a floating island, looking out at the broken skybridge fragments drifting in the clouds. The wind carries whispers of distant voices from the separated islands. Your party gathers around, ready to begin this crucial mission.',
    is_character_in_combat: false,
    currently_present_npcs: {
      hostile: [],
      friendly: [{ uniqueTechnicalNameId: 'guild_master_torren', displayName: 'Guild Master Torren' }],
      neutral: []
    } as Targets,
    inventory_update: [],
    stats_update: [],
    story_memory_explanation: 'Party arrives at collapse site. LONG_TERM_IMPACT: HIGH'
  } as GameActionState,
  
  combat: {
    story: 'A sky sentry descends from above, weapons drawn and eyes glowing with hostile intent. Combat begins!',
    is_character_in_combat: true,
    currently_present_npcs: {
      hostile: [{ uniqueTechnicalNameId: 'sky_sentry_1', displayName: 'Sky Sentry' }],
      friendly: [],
      neutral: []
    } as Targets,
    stats_update: [],
    story_memory_explanation: 'Combat initiated with sky sentry. LONG_TERM_IMPACT: MEDIUM'
  } as GameActionState,
  
  combatEnd: {
    story: 'The sky sentry falls defeated, its construct form deactivating. You catch your breath as calm returns to the area.',
    is_character_in_combat: false,
    currently_present_npcs: {
      hostile: [],
      friendly: [],
      neutral: []
    } as Targets,
    stats_update: [
      { 
        targetName: 'player_character_1', 
        type: 'HP_lost', 
        value: { result: 5 },
        explanation: 'Took damage from sentry attack' 
      }
    ],
    story_memory_explanation: 'Defeated sky sentry. LONG_TERM_IMPACT: MEDIUM'
  } as GameActionState
};

export const MOCK_INVENTORY_ACTIONS = {
  found: {
    story: 'Among the debris, you discover a glowing healing potion tucked in a small alcove.',
    inventory_update: [
      {
        type: 'add_item' as const,
        item_id: 'healing_potion',
        item_added: {
          description: 'A glowing red potion in a crystal vial',
          effect: 'Restores 2d4+2 HP when consumed'
        }
      }
    ],
    story_memory_explanation: 'Found healing potion in debris. LONG_TERM_IMPACT: LOW'
  } as Partial<GameActionState>,
  
  used: {
    story: 'You drink the healing potion, feeling warmth spread through your body as wounds begin to close.',
    inventory_update: [
      {
        type: 'remove_item' as const,
        item_id: 'healing_potion'
      }
    ],
    stats_update: [
      { 
        targetName: 'player_character_1', 
        type: 'HP_gained', 
        value: { result: 8 },
        explanation: 'Healed by potion' 
      }
    ],
    story_memory_explanation: 'Used healing potion. LONG_TERM_IMPACT: LOW'
  } as Partial<GameActionState>
};

export const MOCK_REST_ACTIONS = {
  short: {
    story: 'You take a brief rest, catching your breath and tending to minor wounds. You feel somewhat refreshed.',
    stats_update: [
      { 
        targetName: 'player_character_1', 
        type: 'HP_gained', 
        value: { result: 6 },
        explanation: 'Short rest recovery' 
      },
      { 
        targetName: 'player_character_1', 
        type: 'STAMINA_gained', 
        value: { result: 5 },
        explanation: 'Short rest recovery' 
      }
    ],
    story_memory_explanation: 'Short rest taken. LONG_TERM_IMPACT: LOW'
  } as Partial<GameActionState>,
  
  long: {
    story: 'You make camp and rest for the night. Morning comes with renewed energy and fully recovered resources.',
    stats_update: [
      { 
        targetName: 'player_character_1', 
        type: 'HP_gained', 
        value: { result: 20 },
        explanation: 'Long rest - full recovery' 
      },
      { 
        targetName: 'player_character_1', 
        type: 'STAMINA_gained', 
        value: { result: 10 },
        explanation: 'Long rest - full recovery' 
      },
      { 
        targetName: 'player_character_1', 
        type: 'MANA_gained', 
        value: { result: 8 },
        explanation: 'Long rest - full recovery' 
      }
    ],
    story_memory_explanation: 'Long rest - full recovery. LONG_TERM_IMPACT: LOW'
  } as Partial<GameActionState>
};

const IMAGE_PROMPT = 'A dramatic fantasy scene showing floating sky islands with broken magical bridges, heroes standing at the edge looking determined, painterly Moebius art style with vibrant colors';

export function generateGameActionResponse(context: { isCombat?: boolean; isRest?: boolean; isItem?: boolean }): GameActionState {
  const storyMeta = { game: 'Dungeons & Dragons 5th Edition' };
  
  if (context.isCombat) {
    return { ...MOCK_GAME_ACTIONS.combat, image_prompt: IMAGE_PROMPT, ...storyMeta } as GameActionState;
  }
  if (context.isRest) {
    return {
      ...MOCK_REST_ACTIONS.short,
      image_prompt: IMAGE_PROMPT,
      ...storyMeta
    } as GameActionState;
  }
  if (context.isItem) {
    return {
      ...MOCK_INVENTORY_ACTIONS.found,
      image_prompt: IMAGE_PROMPT,
      ...storyMeta
    } as GameActionState;
  }

  return {
    ...MOCK_GAME_ACTIONS.default,
    image_prompt: IMAGE_PROMPT,
    ...storyMeta
  } as GameActionState;
}
