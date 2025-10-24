/**
 * InventoryStateStore - Centralized state management for inventory
 *
 * This store manages:
 * - Inventory items
 * - Item suggestions
 */

import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
import type { InventoryState, Item } from '$lib/ai/agents/gameAgent';

export class InventoryStateStore {
	// Inventory
	readonly inventory = useLocalStorage<InventoryState>('inventoryState', {});

	// Ephemeral state (not persisted)
	itemForSuggestActions = $state<(Item & { item_id: string }) | undefined>(undefined);

	/**
	 * Reset inventory state (for new game)
	 */
	resetInventoryState(): void {
		this.inventory.reset();
		this.itemForSuggestActions = undefined;
	}
}
