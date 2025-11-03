import { initialCharacterState } from '$lib/ai/agents/characterAgent';
import { initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';

export type PartyMember = {
	id: string;
	character: CharacterDescription;
};

export type Party = {
	members: PartyMember[];
	activeCharacterId: string;
};

export type PartyMemberStats = {
	id: string;
	stats: CharacterStats;
};

export type PartyStats = {
	members: PartyMemberStats[];
};

export type PartyMemberProfile = {
	id: string;
	displayName: string;
	knownNames: string[];
	description: CharacterDescription;
	stats: CharacterStats;
};

export type PartyMembersState = PartyMemberProfile[];

export function createEmptyPartyMemberProfile(id: string): PartyMemberProfile {
	return {
		id,
		displayName: '',
		knownNames: [],
		description: { ...initialCharacterState },
		stats: { ...initialCharacterStatsState }
	};
}

export function updatePartyMemberImmutable(
	members: PartyMembersState,
	memberId: string,
	updates: Partial<PartyMemberProfile>
): PartyMembersState {
	return members.map((member) =>
		member.id === memberId
			? {
				...member,
				...updates
			}
			: member
	);
}
