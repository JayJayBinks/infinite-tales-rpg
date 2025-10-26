import { describe, it, expect, beforeEach } from 'vitest';
import { CharacterStateStore } from './characterState.svelte';
import { initialCharacterState } from '$lib/ai/agents/characterAgent';
import { initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';

describe('CharacterStateStore', () => {
	let store: CharacterStateStore;

	beforeEach(() => {
		store = new CharacterStateStore();
		store.reset();
	});

	describe('Initialization', () => {
		it('should initialize with default character state', () => {
			expect(store.character.value).toEqual(initialCharacterState);
			expect(store.characterStats.value).toEqual(initialCharacterStatsState);
		});
	});

	describe('Character properties', () => {
		it('should get character name', () => {
			store.character.value = { ...initialCharacterState, name: 'Test Hero' };
			expect(store.characterName).toBe('Test Hero');
		});

		it('should get character level', () => {
			store.characterStats.value = { ...initialCharacterStatsState, level: 5 };
			expect(store.level).toBe(5);
		});

		it('should get character resources', () => {
			const mockResources = {
				HP: { max_value: 100, start_value: 100, game_ends_when_zero: true }
			};
			store.characterStats.value = { ...initialCharacterStatsState, resources: mockResources };
			expect(store.resources).toEqual(mockResources);
		});

		it('should get character abilities', () => {
			const mockAbilities = [
				{ name: 'Fireball', effect: 'Deals fire damage' }
			];
			store.characterStats.value = { ...initialCharacterStatsState, spells_and_abilities: mockAbilities };
			expect(store.abilities).toEqual(mockAbilities);
		});
	});

	describe('Character updates', () => {
		it('should update character description', () => {
			const newCharacter = { ...initialCharacterState, name: 'Updated Hero' };
			store.updateCharacter(newCharacter);
			expect(store.character.value.name).toBe('Updated Hero');
		});

		it('should update character stats', () => {
			const newStats = { ...initialCharacterStatsState, level: 10 };
			store.updateStats(newStats);
			expect(store.characterStats.value.level).toBe(10);
		});
	});

	describe('Reset', () => {
		it('should reset character state', () => {
			store.character.value = { ...initialCharacterState, name: 'Test' };
			store.characterStats.value = { ...initialCharacterStatsState, level: 5 };

			store.reset();

			expect(store.character.value).toEqual(initialCharacterState);
			expect(store.characterStats.value).toEqual(initialCharacterStatsState);
		});
	});
});
