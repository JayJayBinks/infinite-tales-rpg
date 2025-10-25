import type { Page, Route } from '@playwright/test';

// Minimal, deterministic JSONs to satisfy our agents' schemas.
const mockTale = {
  game: 'Dungeons & Dragons',
  world_details: 'A concise world: floating isles, rune-forges, sky leviathans.',
  adventure_and_main_event: 'A skybridge shatters, stranding towns across drifting isles.',
  character_simple_description: 'A resourceful sky-scout with a grappling hook.',
  general_image_prompt: 'painterly fantasy Moebius',
  theme: 'Skybound resilience',
  tonality: 'Hopeful, pulpy adventure',
  party_concept: 'Ragtag salvagers repair the skybridge',
  expected_party_size: 4,
};

const mockCustomTale = {
  ...mockTale,
  adventure_and_main_event: 'A custom adventure blurb.',
  party_concept: 'A custom party concept.',
  expected_party_size: 2,
};

const mockCharacter = {
  name: 'Aerin Brightwind',
  class: 'Ranger',
  race: 'Aarakocra',
  gender: 'Non-binary',
  appearance: 'Feathered, wind-goggles, climbing harness',
  alignment: 'Chaotic Good',
  personality: 'Curious, daring, practical',
  background: 'Former courier of the skybridge guild',
  motivation: 'Reunite the isles and prove the guild was sabotaged'
};

const mockParty = [
  mockCharacter,
  { ...mockCharacter, name: 'Korrin Stonebrace', class: 'Artificer', race: 'Dwarf' },
  { ...mockCharacter, name: 'Velia Starweave', class: 'Wizard', race: 'Elf' },
  { ...mockCharacter, name: 'Marlow Drift', class: 'Bard', race: 'Human' },
];

const mockCustomParty = [
  { ...mockCharacter, name: 'Custom Character 1' },
  { ...mockCharacter, name: 'Custom Character 2' },
];

const mockStats = {
  level: 1,
  resources: {
    HP: { max_value: 26, start_value: 26, game_ends_when_zero: true },
    STAMINA: { max_value: 10, start_value: 10, game_ends_when_zero: false },
  },
  attributes: { Strength: 0, Dexterity: 2, Intelligence: 1, Wisdom: 1, Charisma: 0 },
  skills: { Acrobatics: 2, Climbing: 2, Survival: 1 },
  spells_and_abilities: [
    {
      name: 'Standard Attack',
      effect: 'Deal 1d6 damage with a basic strike.',
      resource_cost: { resource_key: undefined, cost: 0 },
      image_prompt: 'sword icon'
    },
    {
      name: 'Grappling Hook Lunge',
      effect: 'Pull to a ledge; if enemy, deal 1d4 damage.',
      resource_cost: { resource_key: 'STAMINA', cost: 2 },
      image_prompt: 'hook icon'
    },
  ],
};

const mockActionResponse = {
  narration: 'Aerin lunges with the grappling hook, dealing 3 damage.',
  resource_updates: {
    STAMINA: -2,
  },
  dice_roll_request: null,
  suggested_actions: [
    'Take cover',
    'Scan the area',
  ],
};

const mockCombatStartResponse = {
  narration: 'A sky sentry descends from above, weapons drawn. Combat begins!',
  resource_updates: {},
  dice_roll_request: null,
  suggested_actions: [
    'Attack with weapon',
    'Use ability',
    'Defend',
  ],
  is_character_in_combat: true,
  currently_present_npcs: ['sky_sentry'],
};

const mockCombatEndResponse = {
  narration: 'The sky sentry falls defeated. You catch your breath as calm returns.',
  resource_updates: {
    HP: -5,
  },
  dice_roll_request: null,
  suggested_actions: [
    'Search the area',
    'Continue onwards',
    'Rest',
  ],
  is_character_in_combat: false,
  currently_present_npcs: [],
};

const mockItemAddResponse = {
  narration: 'You find a healing potion among the debris.',
  inventory_update: [
    { action: 'add_item', item_added: { name: 'Healing Potion', effect: 'Restores 10 HP' } }
  ],
  resource_updates: {},
  dice_roll_request: null,
  suggested_actions: [
    'Continue exploring',
    'Use the potion',
  ],
};

const mockItemUseResponse = {
  narration: 'You drink the healing potion, feeling rejuvenated.',
  inventory_update: [
    { action: 'remove_item', item_removed: 'Healing Potion' }
  ],
  resource_updates: {
    HP: 10,
  },
  dice_roll_request: null,
  suggested_actions: [
    'Continue onwards',
  ],
};

const mockRestResponse = {
  narration: 'You take a short rest, recovering some of your strength.',
  resource_updates: {
    HP: 5,
    STAMINA: 5,
  },
  dice_roll_request: null,
  suggested_actions: [
    'Continue the tale',
  ],
};

const mockCampaign = {
  chapters: [
    {
      chapter_number: 1,
      theme: 'The Shattered Bridge',
      gm_notes: 'Introduce the skybridge collapse. Party must cross via makeshift platforms.',
      key_plot_points: ['skybridge collapse', 'meet guild official'],
      possible_npcs: ['Guild Master Torren', 'Survivor Mila'],
    },
    {
      chapter_number: 2,
      theme: 'Forge of Runes',
      gm_notes: 'Party discovers ancient rune-forge. Must activate it to repair bridge components.',
      key_plot_points: ['find rune-forge', 'decode ancient runes'],
      possible_npcs: ['Runecaster Elara', 'Forge Guardian'],
    },
    {
      chapter_number: 3,
      theme: 'Sky Leviathan Attack',
      gm_notes: 'A sky leviathan threatens the repair efforts. Climactic battle or negotiation.',
      key_plot_points: ['leviathan encounter', 'final bridge repair'],
      possible_npcs: ['Leviathan', 'Bridge Engineer'],
    },
  ],
};

function statsArrayForParty(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...mockStats,
    attributes: { ...mockStats.attributes, Dexterity: i === 2 ? 0 : 2 },
  }));
}

// Identify intent by simple keyword heuristics from messages
function classifyPrompt(text: string): 'tale' | 'party' | 'character' | 'party-stats' | 'character-stats' | 'level-up' | 'npcs' | 'abilities' | 'game-action' | 'game-action-with-events' | 'character-transform-description' | 'character-transform-stats' | 'abilities-learned' | 'game-start' | 'campaign' | 'combat-start' | 'combat-end' | 'item-add' | 'item-use' | 'rest' | 'image-prompt' | 'other' {
  const t = text.toLowerCase();
  
  // Order matters - check most specific patterns first
  
  // Campaign generation
  if (t.includes('campaign agent') || t.includes('generate a campaign')) return 'campaign';
  
  // Image prompt generation
  if (t.includes('image prompt agent') || t.includes('generate an image prompt')) return 'image-prompt';
  
  // Combat states
  if (t.includes('combat begins') || t.includes('enters combat') || t.includes('attack') && t.includes('enemy')) return 'combat-start';
  if (t.includes('combat ends') || t.includes('defeated') || t.includes('enemy falls')) return 'combat-end';
  
  // Item actions
  if (t.includes('find') && (t.includes('item') || t.includes('potion'))) return 'item-add';
  if (t.includes('use') && (t.includes('item') || t.includes('potion'))) return 'item-use';
  
  // Rest actions
  if (t.includes('rest') || t.includes('recover')) return 'rest';
  
  // Event evaluation (happens when evaluating if action triggers transformation/learning)
  if (t.includes('evaluate the events for story progression')) return 'game-action-with-events';
  
  // Character transformation: description (characterAgent with transform)
  if (t.includes('rpg character agent') && t.includes('transform')) return 'character-transform-description';
  
  // Character transformation: stats (characterStatsAgent with adaptive or transform)
  if (t.includes('character stats agent') && (t.includes('adaptive') || t.includes('transform'))) return 'character-transform-stats';
  
  // Regular character/stats operations (check before generic ability check)
  if (t.includes('character stats agent') && t.includes('stats for a party')) return 'party-stats';
  if (t.includes('generate stats for all party')) return 'party-stats';
  if (t.includes('rpg character agent') && (t.includes('party of') || t.includes('party character descriptions'))) return 'party';
  if (t.includes('character stats agent') && t.includes('starting stats for a character')) return 'character-stats';
  if (t.includes('rpg character agent') && t.includes('create the character')) return 'character';
  if (t.includes('randomized story') || t.includes('create a new randomized story') || (t.includes('tale') && !t.includes('party'))) return 'tale';
  if (t.includes('leveled up') || t.includes('level up')) return 'level-up';
  if (t.includes('generate the following npcs') || t.includes('npc stats agent')) return 'npcs';
  if ((t.includes('abilities') || t.includes('spells')) && t.includes('learn')) return 'abilities-learned';
  if (t.includes('ability agent') || (t.includes('suggest specific actions') && t.includes('character can take'))) return 'abilities';
  if (t.includes('game loop agent') || t.includes('begin the story by setting the scene') || t.includes('starting game agent')) return 'game-action';
  if (t.includes('character starts with') || t.includes('currently_present_npcs')) return 'game-start';
  return 'other';
}

// Google Generative Language v1beta endpoints to mock
// - POST https://generativelanguage.googleapis.com/v1beta/models/*:generateContent
// - POST https://generativelanguage.googleapis.com/v1beta/models/*:streamGenerateContent (SSE) -> we return a compact JSON object anyway
// - POST https://generativelanguage.googleapis.com/v1beta/models/*:countTokens

export async function installGeminiApiMocks(page: Page) {
  // Override the Gemini Provider to return mock async generator streams
  await page.addInitScript(() => {
    // Helper to create a proper async generator for streaming responses
    (window as any).__mockGeminiStreamResponse = function(jsonContent: any) {
      const contentString = typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent);
      
      // Create an async generator that mimics Gemini's streaming response
      const stream = {
        async *[Symbol.asyncIterator]() {
          // Yield complete response as a single chunk (simulating fast stream)
          yield {
            text: () => contentString,
            candidates: [{
              content: {
                parts: [{ text: contentString }]
              }
            }]
          };
        }
      };
      
      return { stream };
    };
  });

  // Count tokens returns a tiny deterministic number
  await page.route('https://generativelanguage.googleapis.com/**:countTokens*', async (route: Route) => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalTokens: 42 }) });
  });

  // Non-streaming content
  await page.route('https://generativelanguage.googleapis.com/**:generateContent*', async (route: Route) => {
    const postData = route.request().postDataJSON?.() as any;
    // Gemini shape: { contents: [{role, parts:[{text}]}...], generationConfig, systemInstruction }
    const history = Array.isArray(postData?.contents) ? postData.contents : [];
    const systemInstruction = postData?.systemInstruction?.parts?.[0]?.text ?? '';
    const last = history[history.length - 1];
    const lastText = last?.parts?.[0]?.text ?? '';
    // Combine system instruction and prompt for classification
    const fullContext = systemInstruction + ' ' + lastText;
    const kind = classifyPrompt(fullContext);

    let content: any = {};
    switch (kind) {
      case 'tale':
        if (lastText.includes('custom adventure blurb')) {
          content = mockCustomTale;
        } else {
          content = mockTale;
        }
        break;
      case 'party': {
        // Extract party size from prompt if available
        const sizeMatch = lastText.match(/party of (\d+)/i);
        const requestedSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 4;
        
        // Check if custom party concept is mentioned
        if (lastText.includes('custom party concept')) {
          // Expand mockCustomParty to requested size if needed
          const baseParty = [...mockCustomParty];
          while (baseParty.length < requestedSize) {
            baseParty.push({ ...mockCharacter, name: `Custom Character ${baseParty.length + 1}` });
          }
          content = baseParty.slice(0, requestedSize);
        } else {
          // Return appropriate number of characters from mockParty
          content = mockParty.slice(0, Math.min(requestedSize, mockParty.length));
        }
        break;
      }
      case 'character':
        content = mockCharacter;
        break;
      case 'party-stats': {
        // Extract party size from prompt if available
        const sizeMatch = lastText.match(/(\d+)/);
        const requestedSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 4;
        content = statsArrayForParty(requestedSize);
        break;
      }
      case 'character-stats':
        content = mockStats;
        break;
      case 'level-up':
        content = {
          character_name: mockCharacter.name,
          level_up_explanation: 'Learned from recent perilous climbs.',
          attribute: 'Dexterity',
          formerAbilityName: 'Grappling Hook Lunge',
          ability: { ...mockStats.spells_and_abilities[1], effect: 'Pull farther; deal 1d6.' },
          resources: { HP: 30, STAMINA: 12 }
        };
        break;
      case 'npcs':
        content = {
          sky_sentry: {
            is_party_member: false,
            class: 'Guardian',
            rank_enum_english: 'Average',
            level: 2,
            spells_and_abilities: [mockStats.spells_and_abilities[0], mockStats.spells_and_abilities[1]],
          }
        };
        break;
      case 'abilities':
        content = [mockStats.spells_and_abilities[1]];
        break;
      case 'campaign':
        content = mockCampaign;
        break;
      case 'combat-start':
        content = mockCombatStartResponse;
        break;
      case 'combat-end':
        content = mockCombatEndResponse;
        break;
      case 'item-add':
        content = mockItemAddResponse;
        break;
      case 'item-use':
        content = mockItemUseResponse;
        break;
      case 'rest':
        content = mockRestResponse;
        break;
      case 'image-prompt':
        content = 'A dramatic sky scene with floating isles and ancient bridge ruins, painterly Moebius style';
        break;
      case 'game-action':
      case 'game-start':
        content = mockActionResponse;
        break;
      case 'game-action-with-events':
        // Mock for game action that triggers events (character transformation or abilities learned)
        // This simulates the eventAgent evaluating the action result
        content = {
          reasoning: 'The character has been exposed to ancient dragon magic and begins to transform.',
          character_changed: {
            changed_into: 'Dragon',
            description: 'You feel your body transforming into a mighty dragon with scales and wings.'
          },
          abilities_learned: [
            {
              uniqueTechnicalId: 'learned-fire-breath',
              name: 'Fire Breath',
              effect: 'Breathe fire at enemies dealing 2d6 damage'
            }
          ]
        };
        break;
      case 'character-transform-description':
        // Mock for character transformation STEP 1: characterAgent.generateCharacterDescription()
        // Returns updated character description after transformation
        content = {
          name: 'Aerin Brightwind',
          class: 'Dragon',
          race: 'Dragon',
          gender: 'Non-binary',
          appearance: 'Shimmering scales, powerful wings, fierce draconic features',
          alignment: 'Chaotic Good',
          personality: 'Curious, daring, practical, now with primal instincts',
          background: 'Former sky-scout transformed by ancient dragon magic',
          motivation: 'Master new dragon powers while maintaining their original purpose'
        };
        break;
      case 'character-transform-stats':
        // Mock for character transformation STEP 2: characterStatsAgent.generateCharacterStats()
        // Returns new stats for the transformed character (adaptive overwrite)
        content = {
          level: 2,
          resources: {
            HP: { max_value: 120, start_value: 120, game_ends_when_zero: true },
            MANA: { max_value: 80, start_value: 80, game_ends_when_zero: false },
          },
          attributes: {
            Strength: 6,
            Dexterity: 3,
            Constitution: 5,
            Intelligence: 1,
            Wisdom: 2,
            Charisma: 4,
          },
          skills: {
            Perception: 5,
            Intimidation: 6,
            Athletics: 7,
          },
          spells_and_abilities: [
            {
              name: 'Dragon Breath',
              effect: 'Breathe a cone of fire dealing 3d8 fire damage',
              resource_cost: { resource_key: 'MANA', cost: 10 },
              image_prompt: 'dragon breathing fire'
            },
            {
              name: 'Wing Buffet',
              effect: 'Powerful wing attack knocking back enemies',
              resource_cost: { resource_key: 'MANA', cost: 5 },
              image_prompt: 'dragon wings'
            },
          ],
        };
        break;
      case 'abilities-learned':
        // Mock for learning new abilities with full details (characterStatsAgent expanding abilities)
        content = [
          {
            uniqueTechnicalId: 'ability-gen-1',
            name: 'Dragon Breath',
            effect: 'You exhale a devastating cone of fire, dealing 2d6 fire damage to all enemies in a 15-foot cone. Targets must make a Dexterity saving throw or take full damage.',
            resource_cost: { resource_key: 'MANA', cost: 8 },
          },
          {
            uniqueTechnicalId: 'ability-gen-2',
            name: 'Wing Buffet',
            effect: 'You beat your powerful wings, creating a gust of wind that knocks back nearby enemies 10 feet and forces them prone on a failed Strength save.',
            resource_cost: { resource_key: 'MANA', cost: 4 },
          },
          {
            uniqueTechnicalId: 'ability-gen-3',
            name: 'Tail Sweep',
            effect: 'Swing your massive tail in a wide arc, dealing 1d8 bludgeoning damage to all creatures within 10 feet.',
            resource_cost: { resource_key: 'MANA', cost: 3 },
          },
        ];
        break;
      default:
        content = {};
    }

        console.log(`classified as: ${kind}`, `lastText: ${lastText}`);
        console.log();
    // Emulate Gemini wrapper response shape the provider reads
    const body = {
      candidates: [
        {
          content: {
            parts: [
              { text: typeof content === 'string' ? content : JSON.stringify(content) }
            ]
          }
        }
      ]
    };

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  // Streaming: intercept and inject a mock stream generator
  await page.route('https://generativelanguage.googleapis.com/**:streamGenerateContent*', async (route: Route) => {
    const postData = route.request().postDataJSON?.() as any;
    const history = Array.isArray(postData?.contents) ? postData.contents : [];
    const systemInstruction = postData?.systemInstruction?.parts?.[0]?.text ?? '';
    const last = history[history.length - 1];
    const lastText = last?.parts?.[0]?.text ?? '';
    // Combine system instruction and prompt for classification
    const fullContext = systemInstruction + ' ' + lastText;
    const kind = classifyPrompt(fullContext);
    let content: any = {};

    switch (kind) {
      case 'game-action':
      case 'game-start':
        content = mockActionResponse;
        break;
      case 'tale':
      default:
        content = mockTale;
        break;
    }

    const jsonString = JSON.stringify(content);
    
    // Return script that creates an async generator stream
    // This will be evaluated by the Gemini SDK's stream handler
    const mockStreamScript = `
      (async function*() {
        yield {
          text: () => ${JSON.stringify(jsonString)},
          candidates: [{
            content: {
              parts: [{ text: ${JSON.stringify(jsonString)} }]
            }
          }]
        };
      })()
    `;

    // For streaming endpoints, we need to fulfill with a response that the SDK can parse
    // The Gemini SDK expects chunks in a specific format
    const body = {
      candidates: [
        { content: { parts: [{ text: jsonString }] } }
      ]
    };
    
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  // Mock pollinations.ai image generation
  // Intercept image requests and return a simple 1x1 transparent PNG to avoid external calls
  await page.route('https://image.pollinations.ai/**', async (route: Route) => {
    // Return a minimal 1x1 transparent PNG (base64 encoded)
    const transparentPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: transparentPng,
    });
  });
}