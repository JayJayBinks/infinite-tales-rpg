/**
 * Centralized state stores
 * Export all state management modules
 */

export { gameState, GameState } from './gameState.svelte';
export { partyState, PartyState } from './partyState.svelte';
export { combatState, CombatState } from './combatState.svelte';
export { uiState, UIState } from './uiState.svelte';

/**
 * Reset all application state
 * Useful for starting a new game or clearing all data
 */
export function resetAllState() {
	// Import here to avoid circular dependencies
	const { gameState } = await import('./gameState.svelte');
	const { partyState } = await import('./partyState.svelte');
	const { combatState } = await import('./combatState.svelte');
	const { uiState } = await import('./uiState.svelte');
	
	gameState.resetGameState();
	partyState.resetPartyState();
	combatState.resetCombatState();
	uiState.resetUIState();
}
