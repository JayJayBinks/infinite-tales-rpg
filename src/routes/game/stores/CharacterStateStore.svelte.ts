/**
 * CharacterStateStore - Centralized state management for character and party data
 * 
 * This store manages:
 * - Character descriptions (single & party)
 * - Character stats (single & party)
 * - Player character ID mapping
 * - Active character state
 * - Character actions (per member)
 */

import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
import type {
	CharacterDescription,
	Party
} from '$lib/ai/agents/characterAgent';
import type {
	CharacterStats,
	PartyStats
} from '$lib/ai/agents/characterStatsAgent';
import type {
	Action,
	PlayerCharactersIdToNamesMap,
	PlayerCharactersGameState
} from '$lib/ai/agents/gameAgent';
import {
	initialCharacterState,
	initialPartyState
} from '$lib/ai/agents/characterAgent';
import {
	initialCharacterStatsState,
	initialPartyStatsState,
	type SkillsProgression
} from '$lib/ai/agents/characterStatsAgent';
import { getActivePartyMember, getActivePartyMemberStats } from '../partyLogic';

export class CharacterStateStore {
	// Character & Party state
	readonly character = useLocalStorage<CharacterDescription>(
		'characterState',
		initialCharacterState
	);
	readonly characterStats = useLocalStorage<CharacterStats>(
		'characterStatsState',
		initialCharacterStatsState
	);
	readonly party = useLocalStorage<Party>('partyState', initialPartyState);
	readonly partyStats = useLocalStorage<PartyStats>('partyStatsState', initialPartyStatsState);

	// Character ID mapping
	readonly playerCharactersIdToNamesMap = useLocalStorage<PlayerCharactersIdToNamesMap>(
		'playerCharactersIdToNamesMapState',
		{}
	);

	// Actions (per character/member)
	readonly characterActions = useLocalStorage<Action[]>('characterActionsState', []);
	readonly characterActionsByMember = useLocalStorage<Record<string, Action[]>>(
		'characterActionsByMemberState',
		{}
	);

	// Skills progression (per member)
	readonly skillsProgressionByMember = useLocalStorage<Record<string, SkillsProgression>>(
		'skillsProgressionByMemberState',
		{}
	);

	// Ephemeral state (not persisted)
	playerCharactersGameState = $state<PlayerCharactersGameState>({});
	skillsProgressionForCurrentAction = $state<number | undefined>(undefined);

	/**
	 * Sync character state with active party member
	 * This effect should be called in components that use this store
	 */
	syncActiveCharacter(): void {
		$effect(() => {
			if (this.party.value.members.length > 0) {
				const activeMember = getActivePartyMember(this.party.value);
				const activeMemberStats = getActivePartyMemberStats(this.party.value, this.partyStats.value);
				if (activeMember && activeMemberStats) {
					this.character.value = activeMember.character;
					this.characterStats.value = activeMemberStats;
				}
			}
		});
	}

	/**
	 * Get the active character ID (party or single character)
	 */
	getActiveCharacterId(playerCharacterIdFallback: string): string {
		return this.party.value.activeCharacterId || playerCharacterIdFallback;
	}

	/**
	 * Check if in party mode
	 */
	get isPartyMode(): boolean {
		return this.party.value.members.length > 0;
	}

	/**
	 * Reset all character state (for new game)
	 */
	resetCharacterState(): void {
		this.character.reset();
		this.characterStats.reset();
		this.party.reset();
		this.partyStats.reset();
		this.playerCharactersIdToNamesMap.reset();
		this.characterActions.reset();
		this.characterActionsByMember.reset();
		this.skillsProgressionByMember.reset();
		this.playerCharactersGameState = {};
		this.skillsProgressionForCurrentAction = undefined;
	}

	/**
	 * Reset actions after processed
	 */
	resetActionsAfterProcessed(): void {
		this.characterActions.reset();
		this.characterActionsByMember.reset();
	}
}
