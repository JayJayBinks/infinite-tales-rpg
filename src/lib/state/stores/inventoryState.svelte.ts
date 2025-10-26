/**
 * Inventory State Store
 * Manages game inventory items
 */

import type { InventoryState } from '$lib/ai/agents/gameAgent';

/**
 * Helper to get value from localStorage with fallback
 */
function getFromLocalStorage<T>(key: string, defaultValue: T): T {
	if (typeof window === 'undefined') return defaultValue;
	const stored = localStorage.getItem(key);
	if (stored === null) return defaultValue;
	try {
		return JSON.parse(stored) as T;
	} catch {
		return defaultValue;
	}
}

/**
 * Helper to save value to localStorage
 */
function saveToLocalStorage<T>(key: string, value: T): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Inventory state store
 * Manages items and inventory state
 */
export class InventoryStateStore {
	// Inventory items
	private _inventory = $state<InventoryState>(getFromLocalStorage('inventoryState', {}));
	
	get inventory() {
		return this._inventory;
	}
	
	set inventory(value: InventoryState) {
		this._inventory = value;
		saveToLocalStorage('inventoryState', value);
	}
	
	/**
	 * Get all items
	 */
	get items() {
		return this._inventory;
	}
	
	/**
	 * Get item count
	 */
	get itemCount(): number {
		return Object.keys(this._inventory).length;
	}
	
	/**
	 * Check if item exists
	 */
	hasItem(itemId: string): boolean {
		return itemId in this._inventory;
	}
	
	/**
	 * Get item
	 */
	getItem(itemId: string) {
		return this._inventory[itemId];
	}
	
	/**
	 * Add or update item
	 */
	updateItem(itemId: string, item: any) {
		this.inventory = {
			...this._inventory,
			[itemId]: item
		};
	}
	
	/**
	 * Remove item
	 */
	removeItem(itemId: string) {
		const { [itemId]: _, ...rest } = this._inventory;
		this.inventory = rest;
	}
	
	/**
	 * Clear all items
	 */
	clear() {
		this.inventory = {};
	}
	
	/**
	 * Reset inventory state
	 */
	reset() {
		this.inventory = {};
	}
}

/**
 * Create and export a singleton inventory state instance
 */
export const inventoryStateStore = new InventoryStateStore();
