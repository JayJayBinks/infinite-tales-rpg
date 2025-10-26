/**
 * Character State Store
 * Manages character descriptions and stats for both single character and party members
 */

import { useLocalStorage } from '../useLocalStorage.svelte';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';
import { initialCharacterState } from '$lib/ai/agents/characterAgent';
import { initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';

/**
 * Character state store
 * Manages active character state (synced with active party member if party mode is active)
 */
export class CharacterStateStore {
	// Active character description
	character = useLocalStorage<CharacterDescription>(
		'characterState',
		initialCharacterState
	);
	
	// Active character stats
	characterStats = useLocalStorage<CharacterStats>(
		'characterStatsState',
		initialCharacterStatsState
	);
	
	/**
	 * Get character name
	 */
	get characterName(): string {
		return this.character.value.name;
	}
	
	/**
	 * Get character level
	 */
	get level(): number {
		return this.characterStats.value.level;
	}
	
	/**
	 * Get character resources
	 */
	get resources() {
		return this.characterStats.value.resources;
	}
	
	/**
	 * Get character abilities
	 */
	get abilities() {
		return this.characterStats.value.spells_and_abilities;
	}
	
	/**
	 * Update character description
	 */
	updateCharacter(character: CharacterDescription) {
		this.character.value = character;
	}
	
	/**
	 * Update character stats
	 */
	updateStats(stats: CharacterStats) {
		this.characterStats.value = stats;
	}
	
	/**
	 * Reset character state
	 */
	reset() {
		this.character.reset();
		this.characterStats.reset();
	}
}

/**
 * Create and export a singleton character state instance
 */
export const characterStateStore = new CharacterStateStore();
