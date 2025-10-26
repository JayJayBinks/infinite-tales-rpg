import type { EventEvaluation } from '$lib/ai/agents/eventAgent';

export const MOCK_EVENT_FIXTURES = {
  transformation: {
    party_events: [{ 
            character_id: 'player_character_1',
      character_name: 'Aria Windrunner',
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
    ],
    restrained_state_explanation: null
  }
  ] as EventEvaluation[]
},
  
  abilitiesLearned: {
     party_events: [{ 
      character_id: 'player_character_1',
      character_name: 'Aria Windrunner',
    reasoning: 'Through intense training and exploration, the character has mastered new aerial techniques.',
    abilities_learned: [
      {
        uniqueTechnicalId: 'ability-wind-dash',
        name: 'Wind Dash',
        effect: 'Dash forward on a gust of wind, moving up to 30 feet instantly. Can pass through enemy spaces.'
      },
      {
        uniqueTechnicalId: 'ability-sky-sense',
        name: 'Sky Sense',
        effect: 'Attune to air currents to detect hidden enemies and traps within 60 feet.'
      }
    ],
    restrained_state_explanation: null
  }] as EventEvaluation[]
},

  restrained: {
    party_events: [{
            character_id: 'player_character_1',
      character_name: 'Aria Windrunner',
      reasoning: 'Becomes restrained.',
      abilities_learned: [],
      transformed_state: null,
      restrained_state_explanation: 'Restrained by magic bonds that limit movement and actions.'
    }] as EventEvaluation[],
  },  
  noEvents: {
     party_events: [{
            character_id: 'player_character_1',
      character_name: 'Aria Windrunner',
      reasoning: 'No significant transformative events detected at this time.',
      abilities_learned: [],
      restrained_state_explanation: null
    }] as EventEvaluation[],
  }
}

export function generateEventResponse(context: { userMessage?: string }): EventEvaluation {
  console.log('Generating event response for context:', context);
  if (context.userMessage?.includes('transform') || context.userMessage?.includes('dragon')) {
    return MOCK_EVENT_FIXTURES.transformation;
  }

  if (context.userMessage?.includes('learn') || context.userMessage?.includes('ability')) {
    return MOCK_EVENT_FIXTURES.abilitiesLearned;
  }

  console.log('Checking for restrained keywords in user message:', context.userMessage?.includes('chains coil around your limbs'));
  if (context.userMessage?.includes('become restrained') || context.userMessage?.includes('chains coil around your limbs')) {
    return MOCK_EVENT_FIXTURES.restrained;
  }

  //TODO noEvents
  return MOCK_EVENT_FIXTURES.restrained;
}
