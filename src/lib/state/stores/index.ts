/**
 * Centralized state stores
 * Export all state management modules
 */

export { gameState, GameState } from './gameState.svelte';
export { partyState, PartyState } from './partyState.svelte';
export { combatState, CombatState } from './combatState.svelte';
export { uiState, UIState } from './uiState.svelte';
export { characterStateStore, CharacterStateStore } from './characterState.svelte';
export { aiStateStore, AIStateStore } from './aiState.svelte';
export { storyStateStore, StoryStateStore } from './storyState.svelte';
export { inventoryStateStore, InventoryStateStore } from './inventoryState.svelte';
export { eventStateStore, EventStateStore } from './eventState.svelte';
export { levelUpStateStore, LevelUpStateStore } from './levelUpState.svelte';

/**
 * Reset all application state
 * Useful for starting a new game or clearing all data
 */
export async function resetAllState() {
	// Import here to avoid circular dependencies
	const { gameState } = await import('./gameState.svelte');
	const { partyState } = await import('./partyState.svelte');
	const { combatState } = await import('./combatState.svelte');
	const { uiState } = await import('./uiState.svelte');
	const { characterStateStore } = await import('./characterState.svelte');
	const { aiStateStore } = await import('./aiState.svelte');
	const { storyStateStore } = await import('./storyState.svelte');
	const { inventoryStateStore } = await import('./inventoryState.svelte');
	const { eventStateStore } = await import('./eventState.svelte');
	const { levelUpStateStore } = await import('./levelUpState.svelte');
	
	gameState.resetGameState();
	partyState.resetPartyState();
	combatState.resetCombatState();
	uiState.resetUIState();
	characterStateStore.reset();
	aiStateStore.reset();
	storyStateStore.reset();
	inventoryStateStore.reset();
	eventStateStore.reset();
	levelUpStateStore.reset();
}
