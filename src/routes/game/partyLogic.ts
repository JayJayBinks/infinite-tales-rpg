import type { Party, PartyMember, CharacterDescription } from '$lib/ai/agents/characterAgent';
import type {
	CharacterStats,
	PartyStats,
	PartyMemberStats,
	SkillsProgression
} from '$lib/ai/agents/characterStatsAgent';
import type { PlayerCharactersIdToNamesMap } from '$lib/ai/agents/gameAgent';

export function createPartyFromCharacters(
	characters: CharacterDescription[],
	stats: CharacterStats[]
): { party: Party; partyStats: PartyStats } {
	const party: Party = {
		members: [],
		activeCharacterId: ''
	};

	const partyStats: PartyStats = {
		members: []
	};

	for (let i = 0; i < characters.length; i++) {
		const id = `player_character_${i + 1}`;

		party.members.push({
			id,
			character: characters[i]
		});

		partyStats.members.push({
			id,
			stats: stats[i]
		});

		if (i === 0) {
			party.activeCharacterId = id;
		}
	}

	return { party, partyStats };
}

export function getActivePartyMember(party: Party): PartyMember | undefined {
	return party.members.find((m) => m.id === party.activeCharacterId);
}

export function getActivePartyMemberStats(
	party: Party,
	partyStats: PartyStats
): CharacterStats | undefined {
	const memberStats = partyStats.members.find((m) => m.id === party.activeCharacterId);
	return memberStats?.stats;
}

export function getPartyMemberById(party: Party, id: string): PartyMember | undefined {
	return party.members.find((m) => m.id === id);
}

export function getPartyMemberStatsByCharacterName(
	party: Party,
	partyStats: PartyStats,
	characterName: string
): CharacterStats | undefined {
	const member = party.members.find((m) => m.character.name === characterName);
	if (!member) return undefined;

	const memberStats = partyStats.members.find((m) => m.id === member.id);
	return memberStats?.stats;
}

export function switchActiveCharacter(party: Party, characterId: string): void {
	const member = party.members.find((m) => m.id === characterId);
	if (member) {
		party.activeCharacterId = characterId;
	}
}

export function getAllPartyCharacterNames(party: Party): string[] {
	return party.members.map((m) => m.character.name);
}

export function updatePlayerCharactersIdToNamesMapForParty(
	party: Party,
	playerCharactersIdToNamesMapState: PlayerCharactersIdToNamesMap
): void {
	for (const member of party.members) {
		if (!playerCharactersIdToNamesMapState[member.id]) {
			playerCharactersIdToNamesMapState[member.id] = [];
		}
		if (!playerCharactersIdToNamesMapState[member.id].includes(member.character.name)) {
			playerCharactersIdToNamesMapState[member.id].push(member.character.name);
		}
	}
}

export function getPartyMemberSkillsProgression(
	memberId: string,
	skillsProgressionByMember: Record<string, SkillsProgression>
): SkillsProgression {
	return skillsProgressionByMember[memberId] || {};
}

export function updatePartyMemberSkillProgression(
	memberId: string,
	skillName: string,
	progression: number,
	skillsProgressionByMember: Record<string, SkillsProgression>
): void {
	if (!skillsProgressionByMember[memberId]) {
		skillsProgressionByMember[memberId] = {};
	}
	if (!skillsProgressionByMember[memberId][skillName]) {
		skillsProgressionByMember[memberId][skillName] = 0;
	}
	skillsProgressionByMember[memberId][skillName] += progression;
}

export function getPartyMemberByCharacterName(
	party: Party,
	characterName: string
): PartyMember | undefined {
	return party.members.find((m) => m.character.name === characterName);
}

export function updatePartyMemberCharacter(
	party: Party,
	memberId: string,
	character: CharacterDescription
): void {
	const member = party.members.find((m) => m.id === memberId);
	if (member) {
		member.character = character;
	}
}

export function updatePartyMemberStats(
	partyStats: PartyStats,
	memberId: string,
	stats: CharacterStats
): void {
	const memberStats = partyStats.members.find((m) => m.id === memberId);
	if (memberStats) {
		memberStats.stats = stats;
	}
}
