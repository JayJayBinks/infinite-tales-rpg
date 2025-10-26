import { describe, it, expect, beforeEach } from 'vitest';
import { CombatState } from './combatState.svelte';
import type { Action } from '$lib/ai/agents/gameAgent';

describe('CombatState', () => {
	let combatState: CombatState;

	beforeEach(() => {
		combatState = new CombatState();
		combatState.resetCombatState();
	});

	describe('Combat action selection', () => {
		it('should initialize with no selected actions', () => {
			const action = combatState.getSelectedAction('player_1');
			expect(action).toBeNull();
		});

		it('should store selected action for a member', () => {
			const mockAction: Action = {
				text: 'Attack with sword',
				action_difficulty: 'medium',
				type: 'combat'
			} as Action;

			combatState.setSelectedAction('player_1', mockAction);

			const retrieved = combatState.getSelectedAction('player_1');
			expect(retrieved).toEqual(mockAction);
		});

		it('should clear selected action', () => {
			const mockAction: Action = {
				text: 'Attack',
				action_difficulty: 'medium',
				type: 'combat'
			} as Action;

			combatState.setSelectedAction('player_1', mockAction);
			combatState.setSelectedAction('player_1', null);

			const retrieved = combatState.getSelectedAction('player_1');
			expect(retrieved).toBeNull();
		});
	});

	describe('Action locking', () => {
		it('should initialize with no locked actions', () => {
			const isLocked = combatState.isActionLocked('player_1');
			expect(isLocked).toBe(false);
		});

		it('should lock action for a member', () => {
			combatState.lockAction('player_1');

			const isLocked = combatState.isActionLocked('player_1');
			expect(isLocked).toBe(true);
		});

		it('should unlock action for a member', () => {
			combatState.lockAction('player_1');
			combatState.unlockAction('player_1');

			const isLocked = combatState.isActionLocked('player_1');
			expect(isLocked).toBe(false);
		});

		it('should track lock state independently per member', () => {
			combatState.lockAction('player_1');

			expect(combatState.isActionLocked('player_1')).toBe(true);
			expect(combatState.isActionLocked('player_2')).toBe(false);
		});
	});

	describe('Dice roll additions', () => {
		it('should initialize with no dice additions', () => {
			const addition = combatState.getDiceAddition('player_1');
			expect(addition).toBe('');
		});

		it('should store dice addition for a member', () => {
			const testAddition = '+2 from flanking';
			combatState.setDiceAddition('player_1', testAddition);

			const retrieved = combatState.getDiceAddition('player_1');
			expect(retrieved).toBe(testAddition);
		});

		it('should clear dice addition for a member', () => {
			combatState.setDiceAddition('player_1', '+2 from flanking');
			combatState.clearDiceAddition('player_1');

			const retrieved = combatState.getDiceAddition('player_1');
			expect(retrieved).toBe('');
		});
	});

	describe('Skills progression', () => {
		it('should initialize with undefined skills progression', () => {
			expect(combatState.skillsProgressionForCurrentAction).toBeUndefined();
		});

		it('should track skills progression for current action', () => {
			combatState.skillsProgressionForCurrentAction = 5;
			expect(combatState.skillsProgressionForCurrentAction).toBe(5);
		});
	});

	describe('Reset operations', () => {
		it('should reset for new round', () => {
			// Set up some state
			const mockAction: Action = {
				text: 'Attack',
				action_difficulty: 'medium',
				type: 'combat'
			} as Action;

			combatState.setSelectedAction('player_1', mockAction);
			combatState.lockAction('player_1');
			combatState.setDiceAddition('player_1', '+2');
			combatState.skillsProgressionForCurrentAction = 5;

			// Reset
			combatState.resetForNewRound();

			// Verify reset
			expect(combatState.getSelectedAction('player_1')).toBeNull();
			expect(combatState.isActionLocked('player_1')).toBe(false);
			expect(combatState.getDiceAddition('player_1')).toBe('');
			expect(combatState.skillsProgressionForCurrentAction).toBeUndefined();
		});

		it('should reset combat state', () => {
			// Set up some state
			combatState.setSelectedAction('player_1', { text: 'Test' } as Action);
			combatState.lockAction('player_1');

			// Reset
			combatState.resetCombatState();

			// Verify reset
			expect(combatState.getSelectedAction('player_1')).toBeNull();
			expect(combatState.isActionLocked('player_1')).toBe(false);
		});
	});

	describe('Multiple members', () => {
		it('should track state independently for multiple members', () => {
			const action1: Action = { text: 'Attack', type: 'combat' } as Action;
			const action2: Action = { text: 'Defend', type: 'combat' } as Action;

			combatState.setSelectedAction('player_1', action1);
			combatState.setSelectedAction('player_2', action2);
			combatState.lockAction('player_1');
			combatState.setDiceAddition('player_1', '+2');
			combatState.setDiceAddition('player_2', '+1');

			// Verify independence
			expect(combatState.getSelectedAction('player_1')).toEqual(action1);
			expect(combatState.getSelectedAction('player_2')).toEqual(action2);
			expect(combatState.isActionLocked('player_1')).toBe(true);
			expect(combatState.isActionLocked('player_2')).toBe(false);
			expect(combatState.getDiceAddition('player_1')).toBe('+2');
			expect(combatState.getDiceAddition('player_2')).toBe('+1');
		});
	});
});
