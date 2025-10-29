/**
 * Character State Store
 * Manages character descriptions and stats for party members
 */

import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';
import { initialCharacterState } from '$lib/ai/agents/characterAgent';
import { initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';

/**
 * Helper to get value from localStorage with fallback
 */
function getFromLocalStorage<T>(key: string, defaultValue: T): T {
	if (typeof window === 'undefined') return defaultValue;
	const stored = localStorage.getItem(key);
	if (stored === null) return defaultValue;
	try {
		return JSON.parse(stored) as T;
	} catch {
		return defaultValue;
	}
}

/**
 * Helper to save value to localStorage
 */
function saveToLocalStorage<T>(key: string, value: T): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Character state store
 * Manages active character state (synced with active party member)
 */
export class CharacterStateStore {
	// Active character description
	private _character = $state<CharacterDescription>(
		getFromLocalStorage('characterState', initialCharacterState)
	);
	
	// Active character stats
	private _characterStats = $state<CharacterStats>(
		getFromLocalStorage('characterStatsState', initialCharacterStatsState)
	);
	
	get character() {
		return this._character;
	}
	
	set character(value: CharacterDescription) {
		this._character = value;
		saveToLocalStorage('characterState', value);
	}
	
	get characterStats() {
		return this._characterStats;
	}
	
	set characterStats(value: CharacterStats) {
		this._characterStats = value;
		saveToLocalStorage('characterStatsState', value);
	}
	
	/**
	 * Get character name
	 */
	get characterName(): string {
		return this._character.name;
	}
	
	/**
	 * Get character level
	 */
	get level(): number {
		return this._characterStats.level;
	}
	
	/**
	 * Get character resources
	 */
	get resources() {
		return this._characterStats.resources;
	}
	
	/**
	 * Get character abilities
	 */
	get abilities() {
		return this._characterStats.spells_and_abilities;
	}
	
	/**
	 * Update character description
	 */
	updateCharacter(character: CharacterDescription) {
		this.character = character;
	}
	
	/**
	 * Update character stats
	 */
	updateStats(stats: CharacterStats) {
		this.characterStats = stats;
	}
	
	/**
	 * Reset character state
	 */
	reset() {
		this.character = initialCharacterState;
		this.characterStats = initialCharacterStatsState;
	}
}

/**
 * Create and export a singleton character state instance
 */
export const characterStateStore = new CharacterStateStore();
