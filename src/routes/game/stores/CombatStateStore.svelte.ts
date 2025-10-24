/**
 * CombatStateStore - Centralized state management for combat-specific state
 * 
 * This store manages:
 * - NPC state
 * - Combat action selections (per member)
 * - Dice roll states
 * - Restraining states
 */

import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
import type { NPCState } from '$lib/ai/agents/characterStatsAgent';
import type { Action } from '$lib/ai/agents/gameAgent';

export class CombatStateStore {
	// NPC state
	readonly npcState = useLocalStorage<NPCState>('npcState', {});

	// Combat action selections (per party member)
	readonly selectedCombatActionsByMember = useLocalStorage<Record<string, Action | null>>(
		'selectedCombatActionsByMemberState',
		{}
	);

	// Restraining state (per party member)
	readonly restrainedExplanationByMember = useLocalStorage<Record<string, string | null>>(
		'restrainedExplanationByMemberState',
		{}
	);

	// Dice roll state
	readonly didAIProcessDiceRollAction = useLocalStorage<boolean>('didAIProcessDiceRollAction');

	// Ephemeral combat state (not persisted)
	selectedCombatActionsDiceAdditions = $state<Record<string, string>>({});
	selectedCombatActionsLocked = $state<Record<string, boolean>>({});
	customDiceRollNotation = $state<string>('');

	/**
	 * Check if any combat actions are selected
	 */
	hasAnySelectedCombatActions(): boolean {
		return Object.values(this.selectedCombatActionsByMember.value).some(
			(action) => action !== null && action !== undefined
		);
	}

	/**
	 * Reset combat selections (after combat turn)
	 */
	resetCombatSelections(): void {
		this.selectedCombatActionsByMember.value = {};
		this.selectedCombatActionsDiceAdditions = {};
		this.selectedCombatActionsLocked = {};
	}

	/**
	 * Reset all combat state (for new game)
	 */
	resetCombatState(): void {
		this.npcState.reset();
		this.selectedCombatActionsByMember.reset();
		this.restrainedExplanationByMember.reset();
		this.didAIProcessDiceRollAction.reset();
		this.resetCombatSelections();
		this.customDiceRollNotation = '';
	}
}
