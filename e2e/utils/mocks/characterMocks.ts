import type { CharacterDescription } from '$lib/ai/agents/characterAgent';

export const MOCK_CHARACTER_FIXTURES: CharacterDescription[] = [
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
];

export function generateCharacterResponse(context: { partySize?: number; isCustom?: boolean }): CharacterDescription | CharacterDescription[] {
  const partySize = context.partySize || 4;
  
  if (partySize === 1) {
    return MOCK_CHARACTER_FIXTURES[0];
  }

  const characters = [...MOCK_CHARACTER_FIXTURES];
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
