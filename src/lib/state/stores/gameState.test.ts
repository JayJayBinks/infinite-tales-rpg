import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './gameState.svelte';
import type { GameActionState } from '$lib/ai/agents/gameAgent';

describe('GameState', () => {
	let gameState: GameState;

	beforeEach(() => {
		gameState = new GameState();
		gameState.resetGameState();
	});

	describe('GameProgressionState', () => {
		it('should initialize with empty game actions', () => {
			expect(gameState.progression.gameActions.value).toEqual([]);
		});

		it('should track current game action', () => {
			const mockAction: GameActionState = {
				story: 'Test story',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] }
			} as GameActionState;

			gameState.progression.gameActions.value = [mockAction];

			expect(gameState.progression.currentGameAction).toEqual(mockAction);
		});

		it('should return empty object when no game actions exist', () => {
			expect(gameState.progression.currentGameAction).toEqual({});
		});

		it('should manage player characters game state', () => {
			const mockGameState = {
				HP: { current_value: 50, max_value: 100, game_ends_when_zero: true }
			};

			gameState.progression.playerCharactersGame['player_1'] = mockGameState;

			const retrieved = gameState.progression.getPlayerCharacterGameState('player_1');
			expect(retrieved).toEqual(mockGameState);
		});

		it('should track game ended state', () => {
			expect(gameState.progression.isGameEnded.value).toBe(false);
			
			gameState.progression.isGameEnded.value = true;
			expect(gameState.progression.isGameEnded.value).toBe(true);
		});
	});

	describe('MemoryState', () => {
		it('should initialize with empty history messages', () => {
			expect(gameState.memory.historyMessages.value).toEqual([]);
		});

		it('should track custom memories', () => {
			const testMemory = 'Remember the dragon\'s weakness';
			gameState.memory.customMemories.value = testMemory;
			
			expect(gameState.memory.customMemories.value).toBe(testMemory);
		});

		it('should track custom GM notes', () => {
			const testNotes = 'The party is heading towards the castle';
			gameState.memory.customGMNotes.value = testNotes;
			
			expect(gameState.memory.customGMNotes.value).toBe(testNotes);
		});

		it('should manage related story history', () => {
			const relatedHistory = {
				relatedDetails: ['Detail 1', 'Detail 2']
			};

			gameState.memory.relatedStoryHistory.value = relatedHistory;
			expect(gameState.memory.relatedStoryHistory.value).toEqual(relatedHistory);
		});
	});

	describe('CampaignState', () => {
		it('should initialize with current chapter 0', () => {
			expect(gameState.campaign.currentChapter.value).toBe(0);
		});

		it('should track campaign progression', () => {
			gameState.campaign.currentChapter.value = 3;
			expect(gameState.campaign.currentChapter.value).toBe(3);
		});
	});

	describe('InputState', () => {
		it('should track additional story input', () => {
			const input = 'Add more tension to the scene';
			gameState.input.additionalStoryInput.value = input;
			
			expect(gameState.input.additionalStoryInput.value).toBe(input);
		});

		it('should track additional action input', () => {
			const input = 'Focus on stealth';
			gameState.input.additionalActionInput.value = input;
			
			expect(gameState.input.additionalActionInput.value).toBe(input);
		});
	});

	describe('resetGameState', () => {
		it('should reset all game state', () => {
			// Set some values
			gameState.progression.gameActions.value = [{} as GameActionState];
			gameState.memory.customMemories.value = 'Some memory';
			gameState.campaign.currentChapter.value = 5;
			gameState.input.additionalStoryInput.value = 'Some input';

			// Reset
			gameState.resetGameState();

			// Verify reset
			expect(gameState.progression.gameActions.value).toEqual([]);
			expect(gameState.memory.customMemories.value).toBe('');
			expect(gameState.campaign.currentChapter.value).toBe(0);
			expect(gameState.input.additionalStoryInput.value).toBe('');
		});
	});
});
