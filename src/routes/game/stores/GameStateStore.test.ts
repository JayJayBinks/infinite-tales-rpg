import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateStore } from './GameStateStore.svelte';
import type { GameActionState } from '$lib/ai/agents/gameAgent';

describe('GameStateStore', () => {
	let store: GameStateStore;

	beforeEach(() => {
		store = new GameStateStore();
		// Reset state before each test
		store.resetGameState();
	});

	describe('currentGameAction', () => {
		it('should return empty object when no actions exist', () => {
			expect(store.currentGameAction).toEqual({});
		});

		it('should return the last game action', () => {
			const action1: GameActionState = {
				story: 'Story 1',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				is_character_in_combat: false
			};
			const action2: GameActionState = {
				story: 'Story 2',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				is_character_in_combat: false
			};

			store.gameActions.value = [action1, action2];

			expect(store.currentGameAction).toEqual(action2);
		});
	});

	describe('addGameAction', () => {
		it('should add a new action to the array', () => {
			const action: GameActionState = {
				story: 'Test story',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				is_character_in_combat: false
			};

			store.addGameAction(action);

			expect(store.gameActions.value).toHaveLength(1);
			expect(store.gameActions.value[0]).toEqual(action);
		});

		it('should maintain immutability', () => {
			const action1: GameActionState = {
				story: 'Story 1',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				is_character_in_combat: false
			};
			const action2: GameActionState = {
				story: 'Story 2',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				is_character_in_combat: false
			};

			store.addGameAction(action1);
			const firstArray = store.gameActions.value;
			store.addGameAction(action2);
			const secondArray = store.gameActions.value;

			expect(firstArray).not.toBe(secondArray);
			expect(firstArray).toHaveLength(1);
			expect(secondArray).toHaveLength(2);
		});
	});

	describe('updateCurrentGameAction', () => {
		it('should update the last action', () => {
			const action: GameActionState = {
				story: 'Original story',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				is_character_in_combat: false
			};

			store.addGameAction(action);
			store.updateCurrentGameAction({ story: 'Updated story' });

			expect(store.currentGameAction.story).toBe('Updated story');
		});

		it('should not modify other actions', () => {
			const action1: GameActionState = {
				story: 'Story 1',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				is_character_in_combat: false
			};
			const action2: GameActionState = {
				story: 'Story 2',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				is_character_in_combat: false
			};

			store.addGameAction(action1);
			store.addGameAction(action2);
			store.updateCurrentGameAction({ story: 'Updated story' });

			expect(store.gameActions.value[0].story).toBe('Story 1');
			expect(store.gameActions.value[1].story).toBe('Updated story');
		});
	});

	describe('resetGameState', () => {
		it('should reset all game state', () => {
			store.gameActions.value = [
				{
					story: 'Test',
					stats_update: [],
					inventory_update: {},
					currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
					is_character_in_combat: false
				}
			];
			store.additionalStoryInput.value = 'some input';
			store.isGameEnded.value = true;
			store.storyChunk = 'chunk';
			store.showXLastStoryProgressions = 5;

			store.resetGameState();

			expect(store.gameActions.value).toEqual([]);
			// After reset, useLocalStorage returns empty string for strings
			expect(store.additionalStoryInput.value).toBe('');
			expect(store.isGameEnded.value).toBe(false);
			expect(store.storyChunk).toBe('');
			expect(store.showXLastStoryProgressions).toBe(0);
		});
	});

	describe('resetAfterActionProcessed', () => {
		it('should reset ephemeral state only', () => {
			store.gameActions.value = [
				{
					story: 'Test',
					stats_update: [],
					inventory_update: {},
					currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
					is_character_in_combat: false
				}
			];
			store.chosenAction.value = { characterName: 'Test', text: 'Action' };
			store.additionalStoryInput.value = 'input';

			store.resetAfterActionProcessed();

			expect(store.gameActions.value).toHaveLength(1); // Not reset
			// After reset, useLocalStorage returns empty object/string
			expect(store.chosenAction.value).toEqual({});
			expect(store.additionalStoryInput.value).toBe('');
		});
	});
});
