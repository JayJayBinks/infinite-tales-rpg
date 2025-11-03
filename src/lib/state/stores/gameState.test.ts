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

	describe('Immutable update methods', () => {
		it('should add game action immutably', () => {
			const action1: GameActionState = {
				id: '1',
				story: 'Action 1',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				currentPlotPoint: '',
				nextPlotPoint: '',
				image_prompt: '',
				is_character_in_combat: false
			} as GameActionState;

			const action2: GameActionState = { ...action1, id: '2', story: 'Action 2' };

			gameState.progression.addGameAction(action1);
			gameState.progression.addGameAction(action2);

			expect(gameState.progression.gameActions).toHaveLength(2);
			expect(gameState.progression.currentGameAction.story).toBe('Action 2');
		});

		it('should update current game action immutably', () => {
			const action: GameActionState = {
				id: '1',
				story: 'Original story',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				currentPlotPoint: '',
				nextPlotPoint: '',
				image_prompt: '',
				is_character_in_combat: false
			} as GameActionState;

			gameState.progression.addGameAction(action);
			gameState.progression.updateCurrentGameAction({ story: 'Updated story', image_prompt: 'new_image.png' });

			expect(gameState.progression.currentGameAction.story).toBe('Updated story');
			expect(gameState.progression.currentGameAction.image_prompt).toBe('new_image.png');
			expect(gameState.progression.currentGameAction.id).toBe('1'); // Other fields unchanged
		});

		it('should update inventory item immutably', () => {
			gameState.progression.updateInventoryItem('sword', 1);
			gameState.progression.updateInventoryItem('potion', 5);

			expect(gameState.progression.inventory['sword']).toBe(1);
			expect(gameState.progression.inventory['potion']).toBe(5);
		});

		it('should update NPC immutably', () => {
			const npcData = {
				HP: { current_value: 50, max_value: 100, game_ends_when_zero: false }
			};

			gameState.progression.updateNPC('goblin_1', npcData);

			expect(gameState.progression.npcs['goblin_1']).toEqual(npcData);
		});

		it('should set player character game state immutably', () => {
			const characterState = {
				HP: { current_value: 75, max_value: 100, game_ends_when_zero: true }
			};

			gameState.progression.setPlayerCharacterGameState('player_1', characterState);

			const retrieved = gameState.progression.getPlayerCharacterGameState('player_1');
			expect(retrieved).toEqual(characterState);
		});

		it('should not modify original data when updating', () => {
			const action: GameActionState = {
				id: '1',
				story: 'Original',
				stats_update: [],
				inventory_update: {},
				currently_present_npcs: { hostile: [], neutral: [], friendly: [] },
				currentPlotPoint: '',
				nextPlotPoint: '',
				image_prompt: '',
				is_character_in_combat: false
			} as GameActionState;

			gameState.progression.addGameAction(action);
			const originalActions = gameState.progression.gameActions;

			gameState.progression.updateCurrentGameAction({ story: 'Updated' });

			// Reference should be different (immutability)
			expect(gameState.progression.gameActions).not.toBe(originalActions);
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
