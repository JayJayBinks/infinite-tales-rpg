import { describe, it, expect, beforeEach } from 'vitest';
import { CombatService } from './CombatService';
import type { Action } from '$lib/ai/agents/gameAgent';
import { partyState } from '$lib/state/stores/partyState.svelte';
import { combatState } from '$lib/state/stores/combatState.svelte';
import { initialCharacterState } from '$lib/ai/agents/characterAgent';
import { initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';
import { createPartyFromCharacters } from '../../routes/game/partyLogic';

describe('CombatService', () => {
	let service: CombatService;

	beforeEach(() => {
		service = new CombatService();
		combatState.resetCombatState();
	});

	describe('Combat state', () => {
		it('should check if in combat', () => {
			const inCombat = service.isInCombat();
			expect(typeof inCombat).toBe('boolean');
		});
	});

	describe('Combat action selection', () => {
		it('should select combat action for character', () => {
			const action: Action = {
				text: 'Attack',
				type: 'combat',
				action_difficulty: 'medium'
			} as Action;

			service.selectCombatAction('char_1', action);
			const selected = service.getSelectedCombatAction('char_1');
			expect(selected).toEqual(action);
		});

		it('should clear combat action', () => {
			const action: Action = { text: 'Attack', type: 'combat' } as Action;
			
			service.selectCombatAction('char_1', action);
			service.selectCombatAction('char_1', null);
			
			const selected = service.getSelectedCombatAction('char_1');
			expect(selected).toBeNull();
		});
	});

	describe('Combat action locking', () => {
		it('should lock combat action', () => {
			service.lockCombatAction('char_1');
			expect(service.isCombatActionLocked('char_1')).toBe(true);
		});

		it('should unlock combat action', () => {
			service.lockCombatAction('char_1');
			service.unlockCombatAction('char_1');
			expect(service.isCombatActionLocked('char_1')).toBe(false);
		});

		it('should not be locked by default', () => {
			expect(service.isCombatActionLocked('char_1')).toBe(false);
		});
	});

	describe('Party combat actions', () => {
		beforeEach(() => {
			// Setup a party
			const characters = [
				{ ...initialCharacterState, name: 'Hero 1' },
				{ ...initialCharacterState, name: 'Hero 2' }
			];
			const stats = [initialCharacterStatsState, initialCharacterStatsState];
			const { party: newParty, partyStats: newStats } = createPartyFromCharacters(characters, stats);
			partyState.party = newParty;
			partyState.partyStats = newStats;
		});

		it('should check if all party members have selected actions', () => {
			const result = service.allPartyMembersHaveSelectedActions();
			expect(typeof result).toBe('boolean');
			expect(result).toBe(false); // No actions selected initially
		});

		it('should check if all party members have locked actions', () => {
			const result = service.allPartyMembersHaveLockedActions();
			expect(typeof result).toBe('boolean');
			expect(result).toBe(false); // No actions locked initially
		});

		it('should get all selected combat actions', () => {
			const action1: Action = { text: 'Attack', type: 'combat' } as Action;
			const action2: Action = { text: 'Defend', type: 'combat' } as Action;

			service.selectCombatAction('player_character_1', action1);
			service.selectCombatAction('player_character_2', action2);

			const allActions = service.getAllSelectedCombatActions();
			expect(allActions.size).toBe(2);
			expect(allActions.get('player_character_1')).toEqual(action1);
			expect(allActions.get('player_character_2')).toEqual(action2);
		});
	});

	describe('Dice roll additions', () => {
		it('should set dice roll addition', () => {
			service.setDiceRollAddition('char_1', '+2 from flanking');
			expect(service.getDiceRollAddition('char_1')).toBe('+2 from flanking');
		});

		it('should clear dice roll addition', () => {
			service.setDiceRollAddition('char_1', '+2');
			service.clearDiceRollAddition('char_1');
			expect(service.getDiceRollAddition('char_1')).toBe('');
		});
	});

	describe('Combat reset', () => {
		it('should reset combat round', () => {
			const action: Action = { text: 'Attack', type: 'combat' } as Action;
			service.selectCombatAction('char_1', action);
			service.lockCombatAction('char_1');

			service.resetCombatRound();

			expect(service.getSelectedCombatAction('char_1')).toBeNull();
			expect(service.isCombatActionLocked('char_1')).toBe(false);
		});

		it('should end combat', () => {
			const action: Action = { text: 'Attack', type: 'combat' } as Action;
			service.selectCombatAction('char_1', action);

			service.endCombat();

			expect(service.getSelectedCombatAction('char_1')).toBeNull();
		});
	});
});
