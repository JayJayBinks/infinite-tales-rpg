/**
 * Inventory State Store
 * Manages game inventory items
 */

import { useLocalStorage } from '../useLocalStorage.svelte';
import type { InventoryState } from '$lib/ai/agents/gameAgent';

/**
 * Inventory state store
 * Manages items and inventory state
 */
export class InventoryStateStore {
	// Inventory items
	inventory = useLocalStorage<InventoryState>('inventoryState', {});
	
	/**
	 * Get all items
	 */
	get items() {
		return this.inventory.value;
	}
	
	/**
	 * Get item count
	 */
	get itemCount(): number {
		return Object.keys(this.inventory.value).length;
	}
	
	/**
	 * Check if item exists
	 */
	hasItem(itemId: string): boolean {
		return itemId in this.inventory.value;
	}
	
	/**
	 * Get item
	 */
	getItem(itemId: string) {
		return this.inventory.value[itemId];
	}
	
	/**
	 * Add or update item
	 */
	updateItem(itemId: string, item: any) {
		this.inventory.value = {
			...this.inventory.value,
			[itemId]: item
		};
	}
	
	/**
	 * Remove item
	 */
	removeItem(itemId: string) {
		const { [itemId]: _, ...rest } = this.inventory.value;
		this.inventory.value = rest;
	}
	
	/**
	 * Clear all items
	 */
	clear() {
		this.inventory.value = {};
	}
	
	/**
	 * Reset inventory state
	 */
	reset() {
		this.inventory.reset();
	}
}

/**
 * Create and export a singleton inventory state instance
 */
export const inventoryStateStore = new InventoryStateStore();
