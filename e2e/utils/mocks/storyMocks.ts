import type { Story } from '$lib/ai/agents/storyAgent';

export const MOCK_STORY_FIXTURES = {
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
  } as Story,
  
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
  } as Story
};

export function generateStoryResponse(context: { isCustom?: boolean; partySize?: number }): Story {
  if (context.isCustom) {
    return MOCK_STORY_FIXTURES.custom;
  }
  const story = { ...MOCK_STORY_FIXTURES.default };
  if (context.partySize) {
    story.expected_party_size = context.partySize;
    story.party_count = context.partySize.toString();
  }
  return story;
}
