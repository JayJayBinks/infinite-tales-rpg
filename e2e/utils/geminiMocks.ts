import type { Page, Route } from '@playwright/test';

/**
 * Gemini API Mock System for E2E Tests
 * 
 * This module provides a comprehensive mocking system for the Gemini API,
 * intercepting HTTP requests and returning deterministic responses based
 * on the agent type and request context.
 * 
 * Architecture:
 * 1. Request Interception: Intercepts all generativelanguage.googleapis.com requests
 * 2. Agent Detection: Analyzes systemInstruction to identify which agent is calling
 * 3. Response Generation: Returns appropriate mock data based on agent type
 * 4. Format Matching: Ensures responses match Gemini's expected format
 */

// ============================================================================
// TYPE DEFINITIONS (matching actual agent types)
// ============================================================================

type Story = {
  game: string;
  world_details: string;
  adventure_and_main_event: string;
  character_simple_description?: string;
  general_image_prompt?: string;
  theme: string;
  tonality: string;
  party_concept?: string;
  party_description?: string;
  expected_party_size?: number;
  party_count?: string;
};

type CharacterDescription = {
  name: string;
  class: string;
  race: string;
  gender: string;
  appearance: string;
  alignment: string;
  personality: string;
  background: string;
  motivation: string;
};

type CharacterStats = {
  level: number;
  resources: {
    [key: string]: {
      max_value: number;
      start_value: number;
      game_ends_when_zero: boolean;
    };
  };
  attributes: { [key: string]: number };
  skills: { [key: string]: number };
  spells_and_abilities: Array<{
    name: string;
    effect: string;
    resource_cost?: {
      resource_key: string | undefined;
      cost: number;
    };
    image_prompt?: string;
  }>;
};

type CampaignChapter = {
  chapter_number: number;
  theme: string;
  gm_notes: string;
  key_plot_points: string[];
  possible_npcs: string[];
};

type Campaign = {
  chapters: CampaignChapter[];
};

type GameActionState = {
  id?: number;
  currentPlotPoint?: string;
  nextPlotPoint?: string;
  story: string;
  image_prompt?: string;
  inventory_update?: Array<{
    action: string;
    item_added?: { name: string; effect: string };
    item_removed?: string;
  }>;
  stats_update?: Array<any>;
  is_character_in_combat?: boolean;
  currently_present_npcs?: string[];
  suggested_actions?: string[];
  dice_roll_request?: any;
};

type Action = {
  characterName: string;
  text: string;
  related_attribute?: string;
  related_skill?: string;
  action_difficulty?: string;
  is_custom_action?: boolean;
  is_possible?: boolean;
  plausibility?: string;
};

type AiLevelUp = {
  character_name: string;
  level_up_explanation: string;
  attribute: string;
  formerAbilityName?: string;
  ability: any;
  resources: { [key: string]: number };
};

type EventEvaluation = {
  reasoning: string;
  character_changed?: {
    changed_into: string;
    description: string;
  };
  abilities_learned?: Array<{
    uniqueTechnicalId: string;
    name: string;
    effect: string;
  }>;
  restrained_state_explanation?: string | null;
};

// ============================================================================
// MOCK DATA FIXTURES
// ============================================================================

const MOCK_FIXTURES = {
  story: {
    default: {
      game: 'Dungeons & Dragons 5th Edition',
      world_details: 'A vibrant world of floating sky islands connected by magical bridges, where rune-forges craft powerful artifacts and sky leviathans patrol the clouds.',
      adventure_and_main_event: 'The ancient Skybridge Network has mysteriously shattered, stranding communities across different floating islands. The party must investigate the cause and restore connections between the isolated settlements.',
      character_simple_description: 'A resourceful sky-scout with expertise in navigation and survival.',
      general_image_prompt: 'fantasy sky islands, painterly style, Moebius aesthetic',
      theme: 'Skybound resilience and reconnection',
      tonality: 'Hopeful adventure with pulpy action',
      party_concept: 'Ragtag team of salvagers and explorers working to repair the skybridge',
      party_description: 'A diverse group of specialists: scout, artificer, mage, and diplomat',
      expected_party_size: 4,
      party_count: '4'
    },
    custom: {
      game: 'Custom Adventure',
      world_details: 'A mysterious custom world awaits exploration.',
      adventure_and_main_event: 'A custom adventure blurb.',
      theme: 'Custom theme',
      tonality: 'Custom tone',
      party_concept: 'A custom party concept.',
      party_description: 'A custom party concept.',
      expected_party_size: 2,
      party_count: '2'
    }
  },

  characters: [
    {
      name: 'Aerin Brightwind',
      class: 'Ranger',
      race: 'Aarakocra',
      gender: 'Non-binary',
      appearance: 'Feathered with wind-goggles, climbing harness, and weathered leather gear',
      alignment: 'Chaotic Good',
      personality: 'Curious, daring, practical, and fiercely independent',
      background: 'Former courier of the defunct skybridge guild',
      motivation: 'Reunite the scattered islands and uncover who sabotaged the skybridge network'
    },
    {
      name: 'Korrin Stonebrace',
      class: 'Artificer',
      race: 'Mountain Dwarf',
      gender: 'Male',
      appearance: 'Stocky build, intricate brass goggles, tool-covered vest',
      alignment: 'Lawful Good',
      personality: 'Methodical, inventive, stubborn but loyal',
      background: 'Rune-forge apprentice who lost their master in the collapse',
      motivation: 'Rebuild the bridges and honor their master\'s legacy'
    },
    {
      name: 'Velia Starweave',
      class: 'Wizard',
      race: 'High Elf',
      gender: 'Female',
      appearance: 'Elegant robes with constellation patterns, silver hair',
      alignment: 'Neutral Good',
      personality: 'Scholarly, compassionate, sometimes absent-minded',
      background: 'Academy researcher studying ancient bridge magic',
      motivation: 'Understand the magical principles that powered the network'
    },
    {
      name: 'Marlow Drift',
      class: 'Bard',
      race: 'Human',
      gender: 'Male',
      appearance: 'Colorful traveling clothes, lute on back, charming smile',
      alignment: 'Chaotic Neutral',
      personality: 'Charismatic, quick-witted, loves a good story',
      background: 'Wandering performer who witnessed the collapse',
      motivation: 'Document the adventure and become famous for reuniting the islands'
    }
  ],

  stats: {
    level: 1,
    resources: {
      HP: { max_value: 26, start_value: 26, game_ends_when_zero: true },
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
  },

  campaign: {
    chapters: [
      {
        chapter_number: 1,
        theme: 'The Shattered Bridge',
        gm_notes: 'Introduce the collapse. Party discovers first clues about sabotage. Meet local authorities and survivors.',
        key_plot_points: [
          'Witness or arrive after the skybridge collapse',
          'Meet Guild Master Torren who tasks the party',
          'Investigate collapse site for clues',
          'Encounter stranded survivors needing help'
        ],
        possible_npcs: ['Guild Master Torren', 'Survivor Mila', 'Merchant Trader Brom']
      },
      {
        chapter_number: 2,
        theme: 'The Forgotten Rune-Forge',
        gm_notes: 'Party discovers an abandoned rune-forge that could help. Must solve puzzles and face guardians to reactivate it.',
        key_plot_points: [
          'Follow clues to ancient rune-forge location',
          'Decode runic puzzles to enter',
          'Battle or negotiate with forge guardians',
          'Reactivate partial forge functionality'
        ],
        possible_npcs: ['Runecaster Elara', 'Stone Guardian Construct', 'Ghost of Former Forgemaster']
      },
      {
        chapter_number: 3,
        theme: 'Sky Leviathan\'s Domain',
        gm_notes: 'A territorial sky leviathan threatens repair efforts. Climactic encounter that can be resolved through combat or diplomacy.',
        key_plot_points: [
          'Leviathan appears during bridge construction',
          'Discover leviathan is protecting something',
          'Final confrontation or negotiation',
          'Restore key bridge connection'
        ],
        possible_npcs: ['Ancient Sky Leviathan', 'Bridge Engineer Kael', 'Mysterious Saboteur Reveal']
      }
    ]
  },

  gameActions: {
    default: {
      story: 'You stand at the edge of a floating island, looking out at the broken skybridge fragments drifting in the clouds. The wind carries whispers of distant voices from the separated islands. Your party gathers around, ready to begin this crucial mission.',
      suggested_actions: [
        'Examine the broken bridge connection',
        'Talk to Guild Master Torren',
        'Check your equipment and supplies',
        'Look for survivors nearby'
      ],
      is_character_in_combat: false,
      currently_present_npcs: ['Guild Master Torren'],
      inventory_update: [],
      stats_update: []
    },
    combat: {
      story: 'A sky sentry descends from above, weapons drawn and eyes glowing with hostile intent. Combat begins!',
      suggested_actions: [
        'Attack with your weapon',
        'Use an ability or spell',
        'Take defensive stance',
        'Try to reason with the sentry'
      ],
      is_character_in_combat: true,
      currently_present_npcs: ['Sky Sentry'],
      stats_update: []
    },
    combatEnd: {
      story: 'The sky sentry falls defeated, its construct form deactivating. You catch your breath as calm returns to the area.',
      suggested_actions: [
        'Search the defeated sentry',
        'Tend to wounds',
        'Continue exploring',
        'Take a short rest'
      ],
      is_character_in_combat: false,
      currently_present_npcs: [],
      stats_update: [
        { target_id: 'player_character_1', HP: -5, explanation: 'Took damage from sentry attack' }
      ]
    }
  },

  items: {
    found: {
      story: 'Among the debris, you discover a glowing healing potion tucked in a small alcove.',
      inventory_update: [
        {
          action: 'add_item',
          item_added: {
            name: 'Healing Potion',
            effect: 'Restores 2d4+2 HP when consumed'
          }
        }
      ],
      suggested_actions: ['Continue exploring', 'Use the potion now', 'Save it for later']
    },
    used: {
      story: 'You drink the healing potion, feeling warmth spread through your body as wounds begin to close.',
      inventory_update: [
        {
          action: 'remove_item',
          item_removed: 'Healing Potion'
        }
      ],
      stats_update: [
        { target_id: 'player_character_1', HP: 8, explanation: 'Healed by potion' }
      ],
      suggested_actions: ['Continue your journey']
    }
  },

  rest: {
    short: {
      story: 'You take a brief rest, catching your breath and tending to minor wounds. You feel somewhat refreshed.',
      stats_update: [
        { target_id: 'player_character_1', HP: 6, explanation: 'Short rest recovery' },
        { target_id: 'player_character_1', STAMINA: 5, explanation: 'Short rest recovery' }
      ],
      suggested_actions: ['Continue the tale']
    },
    long: {
      story: 'You make camp and rest for the night. Morning comes with renewed energy and fully recovered resources.',
      stats_update: [
        { target_id: 'player_character_1', HP: 20, explanation: 'Long rest - full recovery' },
        { target_id: 'player_character_1', STAMINA: 10, explanation: 'Long rest - full recovery' },
        { target_id: 'player_character_1', MANA: 8, explanation: 'Long rest - full recovery' }
      ],
      suggested_actions: ['Continue the tale']
    }
  },

  levelUp: {
    character_name: 'Aerin Brightwind',
    level_up_explanation: 'Through your recent challenges and narrow escapes, you\'ve grown more agile and learned to better control your stamina.',
    attribute: 'Dexterity',
    ability: {
      name: 'Enhanced Grappling Hook',
      effect: 'Your grappling hook lunge now pulls harder and deals 1d6 damage instead of 1d4.',
      resource_cost: { resource_key: 'STAMINA', cost: 2 }
    },
    resources: { HP: 30, STAMINA: 12, MANA: 8 }
  },

  events: {
    transformation: {
      reasoning: 'The character has been exposed to ancient dragon magic radiating from the rune-forge, triggering a mystical transformation.',
      character_changed: {
        changed_into: 'Half-Dragon',
        description: 'Your body begins to transform, scales appearing on your skin and draconic features emerging.'
      },
      abilities_learned: [
        {
          uniqueTechnicalId: 'dragon-breath-fire',
          name: 'Dragon Breath (Fire)',
          effect: 'Exhale a cone of fire dealing 2d6 fire damage to all enemies in a 15-foot cone.'
        }
      ]
    },
    abilitiesLearned: [
      {
        uniqueTechnicalId: 'ability-wind-dash',
        name: 'Wind Dash',
        effect: 'Dash forward on a gust of wind, moving up to 30 feet instantly. Can pass through enemy spaces.',
        resource_cost: { resource_key: 'STAMINA', cost: 4 }
      },
      {
        uniqueTechnicalId: 'ability-sky-sense',
        name: 'Sky Sense',
        effect: 'Attune to air currents to detect hidden enemies and traps within 60 feet.',
        resource_cost: { resource_key: 'MANA', cost: 2 }
      }
    ]
  },

  imagePrompt: 'A dramatic fantasy scene showing floating sky islands with broken magical bridges, heroes standing at the edge looking determined, painterly Moebius art style with vibrant colors'
};

// ============================================================================
// AGENT DETECTION SYSTEM
// ============================================================================

type AgentType =
  | 'storyAgent'
  | 'characterAgent'
  | 'characterStatsAgent'
  | 'gameAgent'
  | 'actionAgent'
  | 'campaignAgent'
  | 'combatAgent'
  | 'eventAgent'
  | 'imagePromptAgent'
  | 'summaryAgent'
  | 'levelUpAgent'
  | 'npcAgent'
  | 'unknown';

/**
 * Detects which agent is making the request by analyzing system instructions
 * and request content.
 */
function detectAgentType(systemInstruction: string, userMessage: string): AgentType {
  const sys = systemInstruction.toLowerCase();
  const msg = userMessage.toLowerCase();

  // Check system instruction for agent-specific markers
  if (sys.includes('story agent') || sys.includes('create a new randomized story')) {
    return 'storyAgent';
  }
  if (sys.includes('rpg character agent') || sys.includes('character descriptions')) {
    return 'characterAgent';
  }
  if (sys.includes('character stats agent') || sys.includes('generate stats')) {
    return 'characterStatsAgent';
  }
  if (sys.includes('campaign agent') || msg.includes('generate a campaign')) {
    return 'campaignAgent';
  }
  if (sys.includes('combat agent') || sys.includes('stats update agent')) {
    return 'combatAgent';
  }
  if (sys.includes('event agent') || msg.includes('evaluate the events')) {
    return 'eventAgent';
  }
  if (sys.includes('image prompt agent') || msg.includes('generate an image prompt')) {
    return 'imagePromptAgent';
  }
  if (sys.includes('action agent') || msg.includes('suggest specific actions')) {
    return 'actionAgent';
  }
  if (sys.includes('summary agent') || msg.includes('summarize')) {
    return 'summaryAgent';
  }
  if (msg.includes('leveled up') || msg.includes('level up')) {
    return 'levelUpAgent';
  }
  if (msg.includes('generate the following npcs') || sys.includes('npc stats agent')) {
    return 'npcAgent';
  }
  if (sys.includes('game loop agent') || sys.includes('game master agent') || 
      msg.includes('begin the story') || msg.includes('starting game agent')) {
    return 'gameAgent';
  }

  return 'unknown';
}

/**
 * Extracts context from the request to customize responses
 */
function extractRequestContext(userMessage: string, systemInstruction: string) {
  const context: {
    isCustom?: boolean;
    partySize?: number;
    action?: string;
    isCombat?: boolean;
    isRest?: boolean;
    isItem?: boolean;
    chapterNumber?: number;
  } = {};

  const msg = userMessage.toLowerCase();

  // Check for custom tale markers
  if (msg.includes('custom') || msg.includes('custom adventure blurb')) {
    context.isCustom = true;
  }

  // Extract party size
  const partySizeMatch = userMessage.match(/party of (\d+)|(\d+).*party members?/i);
  if (partySizeMatch) {
    context.partySize = parseInt(partySizeMatch[1] || partySizeMatch[2], 10);
  }

  // Detect action contexts
  if (msg.includes('combat') || msg.includes('attack') || msg.includes('enemy')) {
    context.isCombat = true;
  }
  if (msg.includes('rest') || msg.includes('recover')) {
    context.isRest = true;
  }
  if (msg.includes('find') && (msg.includes('item') || msg.includes('potion'))) {
    context.isItem = true;
  }

  // Extract chapter number
  const chapterMatch = userMessage.match(/chapter (\d+)/i);
  if (chapterMatch) {
    context.chapterNumber = parseInt(chapterMatch[1], 10);
  }

  return context;
}

// ============================================================================
// RESPONSE GENERATORS
// ============================================================================

/**
 * Generates response for StoryAgent
 */
function generateStoryResponse(context: any): Story {
  if (context.isCustom) {
    return MOCK_FIXTURES.story.custom;
  }
  const story = { ...MOCK_FIXTURES.story.default };
  if (context.partySize) {
    story.expected_party_size = context.partySize;
    story.party_count = context.partySize.toString();
  }
  return story;
}

/**
 * Generates response for CharacterAgent
 */
function generateCharacterResponse(context: any): CharacterDescription | CharacterDescription[] {
  const partySize = context.partySize || 4;
  
  if (partySize === 1) {
    return MOCK_FIXTURES.characters[0];
  }

  // Return array for party generation
  const characters = [...MOCK_FIXTURES.characters];
  if (context.isCustom) {
    return characters.slice(0, partySize).map((char, i) => ({
      ...char,
      name: `Custom Character ${i + 1}`,
      background: 'A custom background for this character',
      motivation: 'Custom motivation'
    }));
  }

  return characters.slice(0, Math.min(partySize, characters.length));
}

/**
 * Generates response for CharacterStatsAgent
 */
function generateCharacterStatsResponse(context: any): CharacterStats | CharacterStats[] {
  const partySize = context.partySize || 1;
  const baseStats = MOCK_FIXTURES.stats;

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

/**
 * Generates response for CampaignAgent
 */
function generateCampaignResponse(context: any): Campaign | CampaignChapter {
  if (context.chapterNumber) {
    // Single chapter regeneration
    const chapter = MOCK_FIXTURES.campaign.chapters.find(
      c => c.chapter_number === context.chapterNumber
    );
    return chapter || MOCK_FIXTURES.campaign.chapters[0];
  }
  return MOCK_FIXTURES.campaign;
}

/**
 * Generates response for GameAgent
 */
function generateGameActionResponse(context: any): GameActionState {
  if (context.isCombat) {
    return { ...MOCK_FIXTURES.gameActions.combat };
  }
  if (context.isRest) {
    return {
      ...MOCK_FIXTURES.rest.short,
      image_prompt: MOCK_FIXTURES.imagePrompt
    };
  }
  if (context.isItem) {
    return {
      ...MOCK_FIXTURES.items.found,
      image_prompt: MOCK_FIXTURES.imagePrompt
    };
  }

  return {
    ...MOCK_FIXTURES.gameActions.default,
    image_prompt: MOCK_FIXTURES.imagePrompt
  };
}

/**
 * Generates response for ActionAgent
 */
function generateActionResponse(context: any): Action[] {
  return [
    {
      characterName: 'Party Member',
      text: 'Investigate the area carefully',
      related_attribute: 'Wisdom',
      related_skill: 'Perception',
      action_difficulty: 'MEDIUM',
      is_possible: true
    },
    {
      characterName: 'Party Member',
      text: 'Attempt to repair the bridge segment',
      related_attribute: 'Intelligence',
      action_difficulty: 'HARD',
      is_possible: true
    }
  ];
}

/**
 * Generates response for CombatAgent
 */
function generateCombatStatsUpdateResponse(context: any): any {
  if (context.isRest) {
    return context.userMessage?.includes('long') ? 
      MOCK_FIXTURES.rest.long.stats_update :
      MOCK_FIXTURES.rest.short.stats_update;
  }

  return [
    {
      target_id: 'player_character_1',
      HP: -3,
      explanation: 'Took damage in combat'
    }
  ];
}

/**
 * Generates response for EventAgent
 */
function generateEventResponse(context: any): EventEvaluation {
  if (context.userMessage?.includes('transform') || context.userMessage?.includes('dragon')) {
    return MOCK_FIXTURES.events.transformation;
  }

  return {
    reasoning: 'No significant transformative events detected at this time.',
    abilities_learned: []
  };
}

/**
 * Generates response for ImagePromptAgent
 */
function generateImagePromptResponse(context: any): { image_prompt: string } {
  return { image_prompt: MOCK_FIXTURES.imagePrompt };
}

/**
 * Generates response for LevelUp
 */
function generateLevelUpResponse(context: any): AiLevelUp {
  return MOCK_FIXTURES.levelUp;
}

/**
 * Generates response for NPC generation
 */
function generateNPCResponse(context: any): any {
  return {
    sky_sentry: {
      is_party_member: false,
      class: 'Construct Guardian',
      rank_enum_english: 'Average',
      level: 2,
      spells_and_abilities: MOCK_FIXTURES.stats.spells_and_abilities.slice(0, 2)
    },
    guild_master_torren: {
      is_party_member: false,
      class: 'Noble',
      rank_enum_english: 'Friendly',
      level: 5,
      spells_and_abilities: []
    }
  };
}

/**
 * Generates appropriate response based on agent type and context
 */
function generateMockResponse(agentType: AgentType, context: any): any {
  switch (agentType) {
    case 'storyAgent':
      return generateStoryResponse(context);
    case 'characterAgent':
      return generateCharacterResponse(context);
    case 'characterStatsAgent':
      return generateCharacterStatsResponse(context);
    case 'campaignAgent':
      return generateCampaignResponse(context);
    case 'gameAgent':
      return generateGameActionResponse(context);
    case 'actionAgent':
      return generateActionResponse(context);
    case 'combatAgent':
      return generateCombatStatsUpdateResponse(context);
    case 'eventAgent':
      return generateEventResponse(context);
    case 'imagePromptAgent':
      return generateImagePromptResponse(context);
    case 'levelUpAgent':
      return generateLevelUpResponse(context);
    case 'npcAgent':
      return generateNPCResponse(context);
    case 'summaryAgent':
      return { story: 'A summary of recent events in the adventure.' };
    default:
      return { message: 'Mock response for unknown agent type' };
  }
}

// ============================================================================
// MAIN MOCK INSTALLATION
// ============================================================================

/**
 * Installs Gemini API mocks for Playwright tests.
 * Intercepts all requests to generativelanguage.googleapis.com and returns
 * appropriate mock responses based on the agent making the request.
 */
export async function installGeminiApiMocks(page: Page) {
  console.log('[Gemini Mock] Installing API mocks...');

  // Mock countTokens endpoint
  await page.route('**generativelanguage.googleapis.com**:countTokens*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalTokens: 100 })
    });
  });

  // Mock non-streaming generateContent endpoint
  await page.route('**generativelanguage.googleapis.com**:generateContent*', async (route: Route) => {
    try {
      const postData = route.request().postDataJSON();
      const systemInstruction = postData?.systemInstruction?.parts?.[0]?.text || '';
      const contents = postData?.contents || [];
      const lastContent = contents[contents.length - 1];
      const userMessage = lastContent?.parts?.[0]?.text || '';

      const agentType = detectAgentType(systemInstruction, userMessage);
      const context = extractRequestContext(userMessage, systemInstruction);
      context.userMessage = userMessage;
      context.systemInstruction = systemInstruction;

      console.log(`[Gemini Mock] Agent: ${agentType}, Context:`, context);

      const mockData = generateMockResponse(agentType, context);
      const responseBody = {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockData) }],
              role: 'model'
            },
            finishReason: 'STOP',
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150
        }
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseBody)
      });
    } catch (error) {
      console.error('[Gemini Mock] Error in generateContent:', error);
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Mock error' })
      });
    }
  });

  // Mock streaming generateContentStream endpoint
  await page.route('**generativelanguage.googleapis.com**:streamGenerateContent*', async (route: Route) => {
    try {
      const postData = route.request().postDataJSON();
      const systemInstruction = postData?.systemInstruction?.parts?.[0]?.text || '';
      const contents = postData?.contents || [];
      const lastContent = contents[contents.length - 1];
      const userMessage = lastContent?.parts?.[0]?.text || '';

      const agentType = detectAgentType(systemInstruction, userMessage);
      const context = extractRequestContext(userMessage, systemInstruction);
      context.userMessage = userMessage;
      context.systemInstruction = systemInstruction;

      console.log(`[Gemini Mock] Stream Agent: ${agentType}`);

      const mockData = generateMockResponse(agentType, context);
      
      // For streaming, return the same format but in a single chunk
      const responseBody = {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockData) }],
              role: 'model'
            },
            finishReason: 'STOP',
            index: 0
          }
        ]
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseBody)
      });
    } catch (error) {
      console.error('[Gemini Mock] Error in streamGenerateContent:', error);
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Mock stream error' })
      });
    }
  });

  // Mock image generation from pollinations.ai
  await page.route('**image.pollinations.ai/**', async (route: Route) => {
    // Return a minimal 1x1 transparent PNG
    const transparentPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: transparentPng
    });
  });

  console.log('[Gemini Mock] API mocks installed successfully');
}
