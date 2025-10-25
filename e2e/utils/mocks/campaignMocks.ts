import type { Campaign, CampaignChapter } from '$lib/ai/agents/campaignAgent';

export const MOCK_CAMPAIGN: Campaign = {
  game: 'Dungeons & Dragons 5th Edition',
  campaign_title: 'The Skybridge Chronicles',
  campaign_description: 'An epic adventure to restore the magical skybridge network and reunite scattered communities across floating islands.',
  world_details: 'A vibrant world of floating sky islands connected by magical bridges, where rune-forges craft powerful artifacts and sky leviathans patrol the clouds.',
  general_image_prompt: 'fantasy sky islands, painterly Moebius style',
  theme: 'Skybound resilience and reconnection',
  tonality: 'Hopeful adventure with pulpy action',
  chapters: [
    {
      chapterId: 1,
      title: 'The Shattered Bridge',
      description: 'Introduce the collapse. Party discovers first clues about sabotage. Meet local authorities and survivors.',
      objective: 'Investigate the skybridge collapse and gather initial clues',
      plot_points: [
        {
          plotId: 1,
          location: 'Collapse Site',
          description: 'Witness or arrive after the skybridge collapse',
          objective: 'Survey the damage and gather evidence',
          important_NPCs: ['Guild Master Torren', 'Survivor Mila'],
          game_master_notes: ['Initial investigation requires Perception checks']
        },
        {
          plotId: 2,
          location: 'Guild Hall',
          description: 'Meet Guild Master Torren who tasks the party',
          objective: 'Receive official mission and resources',
          important_NPCs: ['Guild Master Torren'],
          game_master_notes: ['Torren provides starting equipment and information']
        },
        {
          plotId: 3,
          location: 'Survivor Camp',
          description: 'Encounter stranded survivors needing help',
          objective: 'Aid survivors and gather testimonies',
          important_NPCs: ['Survivor Mila', 'Merchant Trader Brom'],
          game_master_notes: ['Helping survivors builds reputation']
        }
      ]
    },
    {
      chapterId: 2,
      title: 'The Forgotten Rune-Forge',
      description: 'Party discovers an abandoned rune-forge that could help. Must solve puzzles and face guardians to reactivate it.',
      objective: 'Reactivate the ancient rune-forge',
      plot_points: [
        {
          plotId: 1,
          location: 'Ancient Rune-Forge',
          description: 'Follow clues to ancient rune-forge location',
          objective: 'Find and enter the rune-forge',
          important_NPCs: ['Runecaster Elara'],
          game_master_notes: ['Runic puzzles require Intelligence checks or magical knowledge']
        },
        {
          plotId: 2,
          location: 'Forge Core',
          description: 'Battle or negotiate with forge guardians',
          objective: 'Overcome the guardians',
          important_NPCs: ['Stone Guardian Construct'],
          game_master_notes: ['Combat or puzzle solving required; guardians vulnerable to fire']
        },
        {
          plotId: 3,
          location: 'Power Chamber',
          description: 'Reactivate partial forge functionality',
          objective: 'Restore forge power',
          important_NPCs: ['Ghost of Former Forgemaster'],
          game_master_notes: ['Requires specific sequence to avoid overload']
        }
      ]
    },
    {
      chapterId: 3,
      title: 'Sky Leviathan\'s Domain',
      description: 'A territorial sky leviathan threatens repair efforts. Climactic encounter that can be resolved through combat or diplomacy.',
      objective: 'Deal with the sky leviathan threat',
      plot_points: [
        {
          plotId: 1,
          location: 'Bridge Construction Site',
          description: 'Leviathan appears during bridge construction',
          objective: 'Survive initial encounter',
          important_NPCs: ['Ancient Sky Leviathan', 'Bridge Engineer Kael'],
          game_master_notes: ['Leviathan is protecting something; can be reasoned with']
        },
        {
          plotId: 2,
          location: 'Leviathan Nest',
          description: 'Discover leviathan is protecting something',
          objective: 'Uncover the truth',
          important_NPCs: ['Ancient Sky Leviathan'],
          game_master_notes: ['Discovery may change party approach']
        },
        {
          plotId: 3,
          location: 'Final Confrontation',
          description: 'Final confrontation or negotiation; restore key bridge connection',
          objective: 'Resolve the conflict and complete bridge',
          important_NPCs: ['Ancient Sky Leviathan', 'Mysterious Saboteur'],
          game_master_notes: ['Multiple resolution paths available; reveals true antagonist']
        }
      ]
    }
  ]
};

export function generateCampaignResponse(context: { chapterNumber?: number }): Campaign | CampaignChapter {
  if (context.chapterNumber) {
    // Single chapter regeneration
    const chapter = MOCK_CAMPAIGN.chapters.find(
      c => c.chapterId === context.chapterNumber
    );
    return chapter || MOCK_CAMPAIGN.chapters[0];
  }
  return MOCK_CAMPAIGN;
}
