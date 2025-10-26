import { describe, it, expect } from 'vitest';
import { ActionService } from './ActionService';
import type { Action } from '$lib/ai/agents/gameAgent';
import type { ResourcesWithCurrentValue } from '$lib/ai/agents/gameAgent';

describe('ActionService', () => {
	const service = new ActionService();

	describe('canExecuteAction', () => {
		it('should allow action with no resource cost', () => {
			const action: Action = {
				text: 'Look around',
				action_difficulty: 'simple',
				type: 'investigation'
			} as Action;

			const resources: ResourcesWithCurrentValue = {
				HP: { current_value: 50, max_value: 100, game_ends_when_zero: true }
			};

			const result = service.canExecuteAction(action, resources);
			expect(result.canExecute).toBe(true);
			expect(result.reason).toBeUndefined();
		});

		it('should allow action when resources are sufficient', () => {
			const action: Action = {
				text: 'Cast fireball',
				action_difficulty: 'difficult',
				type: 'spell',
				resource_cost: { MP: 10 }
			} as Action;

			const resources: ResourcesWithCurrentValue = {
				MP: { current_value: 50, max_value: 100, game_ends_when_zero: false }
			};

			const result = service.canExecuteAction(action, resources);
			expect(result.canExecute).toBe(true);
			expect(result.reason).toBeUndefined();
		});

		it('should deny action when resources are insufficient', () => {
			const action: Action = {
				text: 'Cast meteor',
				action_difficulty: 'very_difficult',
				type: 'spell',
				resource_cost: { MP: 100 }
			} as Action;

			const resources: ResourcesWithCurrentValue = {
				MP: { current_value: 50, max_value: 100, game_ends_when_zero: false }
			};

			const result = service.canExecuteAction(action, resources);
			expect(result.canExecute).toBe(false);
			expect(result.reason).toBe('not_enough_resource');
		});

		it('should deny action when required resource does not exist', () => {
			const action: Action = {
				text: 'Cast spell',
				action_difficulty: 'medium',
				type: 'spell',
				resource_cost: { MP: 10 }
			} as Action;

			const resources: ResourcesWithCurrentValue = {
				HP: { current_value: 50, max_value: 100, game_ends_when_zero: true }
			};

			const result = service.canExecuteAction(action, resources);
			expect(result.canExecute).toBe(false);
			expect(result.reason).toBe('not_enough_resource');
		});

		it('should handle multiple resource costs', () => {
			const action: Action = {
				text: 'Ultimate attack',
				action_difficulty: 'very_difficult',
				type: 'combat',
				resource_cost: { HP: 20, MP: 30, Stamina: 10 }
			} as Action;

			const resources: ResourcesWithCurrentValue = {
				HP: { current_value: 50, max_value: 100, game_ends_when_zero: true },
				MP: { current_value: 40, max_value: 100, game_ends_when_zero: false },
				Stamina: { current_value: 15, max_value: 50, game_ends_when_zero: false }
			};

			const result = service.canExecuteAction(action, resources);
			expect(result.canExecute).toBe(true);
		});

		it('should deny action if any resource is insufficient', () => {
			const action: Action = {
				text: 'Ultimate attack',
				action_difficulty: 'very_difficult',
				type: 'combat',
				resource_cost: { HP: 20, MP: 30, Stamina: 20 }
			} as Action;

			const resources: ResourcesWithCurrentValue = {
				HP: { current_value: 50, max_value: 100, game_ends_when_zero: true },
				MP: { current_value: 40, max_value: 100, game_ends_when_zero: false },
				Stamina: { current_value: 15, max_value: 50, game_ends_when_zero: false }
			};

			const result = service.canExecuteAction(action, resources);
			expect(result.canExecute).toBe(false);
			expect(result.reason).toBe('not_enough_resource');
		});
	});

	describe('filterAvailableActions', () => {
		it('should return all actions when resources are sufficient', () => {
			const actions: Action[] = [
				{ text: 'Attack', type: 'combat', resource_cost: { Stamina: 5 } } as Action,
				{ text: 'Defend', type: 'combat', resource_cost: { Stamina: 3 } } as Action,
				{ text: 'Run', type: 'movement', resource_cost: { Stamina: 2 } } as Action
			];

			const resources: ResourcesWithCurrentValue = {
				Stamina: { current_value: 20, max_value: 50, game_ends_when_zero: false }
			};

			const available = service.filterAvailableActions(actions, resources);
			expect(available).toHaveLength(3);
		});

		it('should filter out actions with insufficient resources', () => {
			const actions: Action[] = [
				{ text: 'Light attack', type: 'combat', resource_cost: { Stamina: 2 } } as Action,
				{ text: 'Heavy attack', type: 'combat', resource_cost: { Stamina: 15 } } as Action,
				{ text: 'Ultimate attack', type: 'combat', resource_cost: { Stamina: 30 } } as Action
			];

			const resources: ResourcesWithCurrentValue = {
				Stamina: { current_value: 10, max_value: 50, game_ends_when_zero: false }
			};

			const available = service.filterAvailableActions(actions, resources);
			expect(available).toHaveLength(1);
			expect(available[0].text).toBe('Light attack');
		});

		it('should return empty array when no actions are available', () => {
			const actions: Action[] = [
				{ text: 'Expensive spell', type: 'spell', resource_cost: { MP: 100 } } as Action,
				{ text: 'Another spell', type: 'spell', resource_cost: { MP: 80 } } as Action
			];

			const resources: ResourcesWithCurrentValue = {
				MP: { current_value: 10, max_value: 100, game_ends_when_zero: false }
			};

			const available = service.filterAvailableActions(actions, resources);
			expect(available).toHaveLength(0);
		});

		it('should include actions with no resource cost', () => {
			const actions: Action[] = [
				{ text: 'Free action', type: 'investigation' } as Action,
				{ text: 'Costly action', type: 'combat', resource_cost: { MP: 50 } } as Action
			];

			const resources: ResourcesWithCurrentValue = {
				MP: { current_value: 10, max_value: 100, game_ends_when_zero: false }
			};

			const available = service.filterAvailableActions(actions, resources);
			expect(available).toHaveLength(1);
			expect(available[0].text).toBe('Free action');
		});
	});
});
