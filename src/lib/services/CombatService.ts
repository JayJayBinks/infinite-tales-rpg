/**
 * Combat Service
 * Manages combat flow, action selection, and combat resolution
 * Coordinates combat state and combat logic execution
 */

import type { Action } from '$lib/ai/agents/gameAgent';
import { combatState } from '$lib/state/stores/combatState.svelte';
import { partyState } from '$lib/state/stores/partyState.svelte';
import type { CombatAgent } from '$lib/ai/agents/combatAgent';
import type { GameActionState } from '$lib/ai/agents/gameAgent';

/**
 * Combat service
 * Manages combat flow and state
 */
export class CombatService {
	/**
	 * Check if currently in combat
	 */
	isInCombat(): boolean {
		// Check if the current game action state indicates combat
		// This would typically check gameState.progression.currentGameAction.is_character_in_combat
		return false; // Placeholder
	}
	
	/**
	 * Select a combat action for a character
	 */
	selectCombatAction(characterId: string, action: Action | null) {
		combatState.setSelectedAction(characterId, action);
	}
	
	/**
	 * Get selected combat action for a character
	 */
	getSelectedCombatAction(characterId: string): Action | null {
		return combatState.getSelectedAction(characterId);
	}
	
	/**
	 * Lock combat action for a character (after dice roll)
	 */
	lockCombatAction(characterId: string) {
		combatState.lockAction(characterId);
	}
	
	/**
	 * Unlock combat action for a character
	 */
	unlockCombatAction(characterId: string) {
		combatState.unlockAction(characterId);
	}
	
	/**
	 * Check if combat action is locked for a character
	 */
	isCombatActionLocked(characterId: string): boolean {
		return combatState.isActionLocked(characterId);
	}
	
	/**
	 * Check if all party members have selected combat actions
	 */
	allPartyMembersHaveSelectedActions(): boolean {
		const members = partyState.party.value.members;
		return members.every(member => {
			const action = combatState.getSelectedAction(member.id);
			return action !== null;
		});
	}
	
	/**
	 * Check if all party members have locked combat actions
	 */
	allPartyMembersHaveLockedActions(): boolean {
		const members = partyState.party.value.members;
		return members.every(member => combatState.isActionLocked(member.id));
	}
	
	/**
	 * Get all selected combat actions for the party
	 */
	getAllSelectedCombatActions(): Map<string, Action> {
		const actions = new Map<string, Action>();
		const members = partyState.party.value.members;
		
		members.forEach(member => {
			const action = combatState.getSelectedAction(member.id);
			if (action) {
				actions.set(member.id, action);
			}
		});
		
		return actions;
	}
	
	/**
	 * Process combat round
	 */
	async processCombatRound(
		combatAgent: CombatAgent,
		gameActionState: GameActionState
	): Promise<GameActionState | undefined> {
		// Check if all actions are selected and locked
		if (!this.allPartyMembersHaveLockedActions()) {
			console.warn('Not all party members have locked actions');
			return undefined;
		}
		
		// Get all selected actions
		const selectedActions = this.getAllSelectedCombatActions();
		
		// Process combat via combat agent
		// This would call combatAgent methods to resolve combat
		// For now, return undefined as placeholder
		
		return undefined;
	}
	
	/**
	 * Reset combat state for new round
	 */
	resetCombatRound() {
		combatState.resetForNewRound();
	}
	
	/**
	 * End combat
	 */
	endCombat() {
		combatState.resetCombatState();
	}
	
	/**
	 * Set dice roll addition for combat action
	 */
	setDiceRollAddition(characterId: string, addition: string) {
		combatState.setDiceAddition(characterId, addition);
	}
	
	/**
	 * Get dice roll addition for combat action
	 */
	getDiceRollAddition(characterId: string): string {
		return combatState.getDiceAddition(characterId);
	}
	
	/**
	 * Clear dice roll addition for combat action
	 */
	clearDiceRollAddition(characterId: string) {
		combatState.clearDiceAddition(characterId);
	}
	
	/**
	 * Get active character's combat action (for UI)
	 */
	getActiveCombatAction(): Action | null {
		const activeId = partyState.activeCharacterId;
		return this.getSelectedCombatAction(activeId);
	}
	
	/**
	 * Check if active character's combat action is locked
	 */
	isActiveCombatActionLocked(): boolean {
		const activeId = partyState.activeCharacterId;
		return this.isCombatActionLocked(activeId);
	}
}

/**
 * Create and export a singleton combat service
 */
export const combatService = new CombatService();
