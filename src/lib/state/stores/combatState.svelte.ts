/**
 * Centralized combat state store
 * Manages combat-related state and selections
 */

import type { Action } from '$lib/ai/agents/gameAgent';

/**
 * Combat state store
 * Manages combat action selections and dice roll states
 */
export class CombatState {
	// Selected combat actions per member (before locking)
	selectedCombatActions = $state<Record<string, Action | null>>({});
	
	// Locked combat actions per member (after dice roll)
	selectedCombatActionsLocked = $state<Record<string, boolean>>({});
	
	// Dice roll prompt additions per selected combat action
	selectedCombatActionsDiceAdditions = $state<Record<string, string>>({});
	
	// Skills progression for current action
	skillsProgressionForCurrentAction = $state<number | undefined>(undefined);
	
	/**
	 * Get selected combat action for a member
	 */
	getSelectedAction(memberId: string): Action | null {
		return this.selectedCombatActions[memberId] || null;
	}
	
	/**
	 * Set selected combat action for a member
	 */
	setSelectedAction(memberId: string, action: Action | null) {
		this.selectedCombatActions[memberId] = action;
	}
	
	/**
	 * Check if combat action is locked for a member
	 */
	isActionLocked(memberId: string): boolean {
		return this.selectedCombatActionsLocked[memberId] || false;
	}
	
	/**
	 * Lock combat action for a member
	 */
	lockAction(memberId: string) {
		this.selectedCombatActionsLocked[memberId] = true;
	}
	
	/**
	 * Unlock combat action for a member
	 */
	unlockAction(memberId: string) {
		this.selectedCombatActionsLocked[memberId] = false;
	}
	
	/**
	 * Get dice roll prompt addition for a member
	 */
	getDiceAddition(memberId: string): string {
		return this.selectedCombatActionsDiceAdditions[memberId] || '';
	}
	
	/**
	 * Set dice roll prompt addition for a member
	 */
	setDiceAddition(memberId: string, addition: string) {
		this.selectedCombatActionsDiceAdditions[memberId] = addition;
	}
	
	/**
	 * Clear dice roll prompt addition for a member
	 */
	clearDiceAddition(memberId: string) {
		delete this.selectedCombatActionsDiceAdditions[memberId];
	}
	
	/**
	 * Reset combat state for a new round
	 */
	resetForNewRound() {
		this.selectedCombatActions = {};
		this.selectedCombatActionsLocked = {};
		this.selectedCombatActionsDiceAdditions = {};
		this.skillsProgressionForCurrentAction = undefined;
	}
	
	/**
	 * Reset all combat state
	 */
	resetCombatState() {
		this.resetForNewRound();
	}
}

/**
 * Create and export a singleton combat state instance
 */
export const combatState = new CombatState();
