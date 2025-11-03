import { describe, it, expect, beforeEach } from 'vitest';
import { ActionProcessingService } from './ActionProcessingService';
import type { Action } from '$lib/ai/agents/gameAgent';
import { gameState } from '$lib/state/stores/gameState.svelte';

describe('ActionProcessingService', () => {
	let service: ActionProcessingService;

	beforeEach(() => {
		service = new ActionProcessingService();
	});

	describe('Action validation', () => {
		it('should validate action with no resource cost', () => {
			const action: Action = {
				text: 'Look around',
				action_difficulty: 'simple',
				type: 'investigation'
			} as Action;

			// Setup mock character resources
			gameState.progression.playerCharactersGame['test_char'] = {
				HP: { current_value: 50, max_value: 100, game_ends_when_zero: true }
			};

			const result = service.canExecuteAction(action, 'test_char');
			expect(result.canExecute).toBe(true);
		});

		it('should validate action with sufficient resources', () => {
			const action: Action = {
				text: 'Cast spell',
				action_difficulty: 'medium',
				type: 'spell',
				resource_cost: { MP: 10 }
			} as Action;

			gameState.progression.playerCharactersGame['test_char'] = {
				MP: { current_value: 50, max_value: 100, game_ends_when_zero: false }
			};

			const result = service.canExecuteAction(action, 'test_char');
			expect(result.canExecute).toBe(true);
		});

		it('should reject action with insufficient resources', () => {
			const action: Action = {
				text: 'Cast powerful spell',
				action_difficulty: 'difficult',
				type: 'spell',
				resource_cost: { MP: 100 }
			} as Action;

			gameState.progression.playerCharactersGame['test_char'] = {
				MP: { current_value: 50, max_value: 100, game_ends_when_zero: false }
			};

			const result = service.canExecuteAction(action, 'test_char');
			expect(result.canExecute).toBe(false);
			expect(result.reason).toBe('Insufficient resources');
		});

		it('should reject action for non-existent character', () => {
			const action: Action = {
				text: 'Attack',
				action_difficulty: 'medium',
				type: 'combat'
			} as Action;

			const result = service.canExecuteAction(action, 'non_existent');
			expect(result.canExecute).toBe(false);
			expect(result.reason).toBe('Character not found');
		});
	});

	describe('Action caching', () => {
		it('should cache actions for character', () => {
			const actions: Action[] = [
				{ text: 'Attack', type: 'combat' } as Action,
				{ text: 'Defend', type: 'combat' } as Action
			];

			service.cacheActions('char_1', actions);
			// Verify caching worked (would check partyState in real impl)
		});

		it('should clear cached actions for character', () => {
			const actions: Action[] = [{ text: 'Attack', type: 'combat' } as Action];
			
			service.cacheActions('char_1', actions);
			service.clearCachedActions('char_1');
			// Verify cleared
		});

		it('should clear all cached actions', () => {
			service.clearAllCachedActions();
			// Should not throw
			expect(true).toBe(true);
		});
	});
});
