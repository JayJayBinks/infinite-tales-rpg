import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryStateStore } from './inventoryState.svelte';

describe('InventoryStateStore', () => {
	let store: InventoryStateStore;

	beforeEach(() => {
		store = new InventoryStateStore();
		store.reset();
	});

	describe('Initialization', () => {
		it('should initialize with empty inventory', () => {
			expect(store.items).toEqual({});
			expect(store.itemCount).toBe(0);
		});
	});

	describe('Item count', () => {
		it('should track item count', () => {
			store.updateItem('sword', { name: 'Sword' });
			store.updateItem('shield', { name: 'Shield' });
			expect(store.itemCount).toBe(2);
		});

		it('should return 0 for empty inventory', () => {
			expect(store.itemCount).toBe(0);
		});
	});

	describe('Item existence', () => {
		it('should check if item exists', () => {
			store.updateItem('potion', { name: 'Health Potion' });
			expect(store.hasItem('potion')).toBe(true);
			expect(store.hasItem('sword')).toBe(false);
		});
	});

	describe('Get item', () => {
		it('should get item by ID', () => {
			const item = { name: 'Magic Wand', power: 10 };
			store.updateItem('wand', item);
			expect(store.getItem('wand')).toEqual(item);
		});

		it('should return undefined for non-existent item', () => {
			expect(store.getItem('nonexistent')).toBeUndefined();
		});
	});

	describe('Update item', () => {
		it('should add new item', () => {
			const item = { name: 'Sword', damage: 10 };
			store.updateItem('sword', item);
			expect(store.getItem('sword')).toEqual(item);
		});

		it('should update existing item', () => {
			store.updateItem('sword', { damage: 10 });
			store.updateItem('sword', { damage: 20 });
			expect(store.getItem('sword')).toEqual({ damage: 20 });
		});
	});

	describe('Remove item', () => {
		it('should remove item', () => {
			store.updateItem('sword', { name: 'Sword' });
			store.removeItem('sword');
			expect(store.hasItem('sword')).toBe(false);
			expect(store.itemCount).toBe(0);
		});

		it('should handle removing non-existent item', () => {
			store.removeItem('nonexistent');
			expect(store.itemCount).toBe(0);
		});
	});

	describe('Clear inventory', () => {
		it('should clear all items', () => {
			store.updateItem('sword', { name: 'Sword' });
			store.updateItem('shield', { name: 'Shield' });
			
			store.clear();
			
			expect(store.itemCount).toBe(0);
			expect(store.items).toEqual({});
		});
	});

	describe('Reset', () => {
		it('should reset inventory state', () => {
			store.updateItem('sword', { name: 'Sword' });
			
			store.reset();
			
			expect(store.itemCount).toBe(0);
			expect(store.items).toEqual({});
		});
	});
});
