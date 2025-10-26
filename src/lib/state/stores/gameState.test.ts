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
			expect(gameState.progression.gameActions).toEqual([]);
		});

		it('should track current game action', () => {
			const mockAction: GameActionState = {
				id: '1',
				story: 'Test story',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				currentPlotPoint: '',
				nextPlotPoint: '',
				image_prompt: '',
				is_character_in_combat: false
			} as GameActionState;

			gameState.progression.gameActions = [mockAction];

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
			expect(gameState.progression.isGameEnded).toBe(false);
			
			gameState.progression.isGameEnded = true;
			expect(gameState.progression.isGameEnded).toBe(true);
		});
	});

	describe('MemoryState', () => {
		it('should initialize with empty history messages', () => {
			expect(gameState.memory.historyMessages).toEqual([]);
		});

		it('should track custom memories', () => {
			const testMemory = 'Remember the dragon\'s weakness';
			gameState.memory.customMemories = testMemory;
			
			expect(gameState.memory.customMemories).toBe(testMemory);
		});

		it('should track custom GM notes', () => {
			const testNotes = 'The party is heading towards the castle';
			gameState.memory.customGMNotes = testNotes;
			
			expect(gameState.memory.customGMNotes).toBe(testNotes);
		});

		it('should manage related story history', () => {
			const relatedHistory = {
				relatedDetails: [
					{ storyReference: 'Detail 1', relevanceScore: 0.9 },
					{ storyReference: 'Detail 2', relevanceScore: 0.8 }
				]
			};

			gameState.memory.relatedStoryHistory = relatedHistory;
			expect(gameState.memory.relatedStoryHistory).toEqual(relatedHistory);
		});
	});

	describe('CampaignState', () => {
		it('should initialize with current chapter 0', () => {
			expect(gameState.campaign.currentChapter).toBe(0);
		});

		it('should track campaign progression', () => {
			gameState.campaign.currentChapter = 3;
			expect(gameState.campaign.currentChapter).toBe(3);
		});
	});

	describe('InputState', () => {
		it('should track additional story input', () => {
			const input = 'Add more tension to the scene';
			gameState.input.additionalStoryInput = input;
			
			expect(gameState.input.additionalStoryInput).toBe(input);
		});

		it('should track additional action input', () => {
			const input = 'Focus on stealth';
			gameState.input.additionalActionInput = input;
			
			expect(gameState.input.additionalActionInput).toBe(input);
		});
	});

	describe('resetGameState', () => {
		it('should reset all game state', () => {
			// Set some values
			gameState.progression.gameActions = [{} as GameActionState];
			gameState.memory.customMemories = 'Some memory';
			gameState.campaign.currentChapter = 5;
			gameState.input.additionalStoryInput = 'Some input';

			// Reset
			gameState.resetGameState();

			// Verify reset
			expect(gameState.progression.gameActions).toEqual([]);
			expect(gameState.memory.customMemories).toBe('');
			expect(gameState.campaign.currentChapter).toBe(0);
			expect(gameState.input.additionalStoryInput).toBe('');
		});
	});
});
