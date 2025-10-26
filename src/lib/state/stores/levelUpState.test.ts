import { describe, it, expect, beforeEach } from 'vitest';
import { LevelUpStateStore } from './levelUpState.svelte';

describe('LevelUpStateStore', () => {
	let store: LevelUpStateStore;

	beforeEach(() => {
		store = new LevelUpStateStore();
		store.reset();
	});

	describe('Initialization', () => {
		it('should initialize with default values', () => {
			expect(store.isButtonEnabled).toBe(false);
			expect(store.isDialogOpen).toBe(false);
			expect(store.playerName).toBe('');
		});
	});

	describe('Button state', () => {
		it('should enable button', () => {
			store.enableButton();
			expect(store.isButtonEnabled).toBe(true);
		});

		it('should disable button', () => {
			store.enableButton();
			store.disableButton();
			expect(store.isButtonEnabled).toBe(false);
		});
	});

	describe('Dialog state', () => {
		it('should open dialog with player name', () => {
			store.openDialog('Hero');
			expect(store.isDialogOpen).toBe(true);
			expect(store.playerName).toBe('Hero');
		});

		it('should close dialog', () => {
			store.openDialog('Hero');
			store.closeDialog();
			expect(store.isDialogOpen).toBe(false);
		});
	});

	describe('Party level up status', () => {
		it('should set party level up status', () => {
			const status = { player_1: true, player_2: false };
			store.setPartyLevelUpStatus(status);
			expect(store.levelUpState.value.partyLevelUpStatus).toEqual(status);
		});

		it('should get member level up status', () => {
			store.setPartyLevelUpStatus({ player_1: true, player_2: false });
			expect(store.getMemberLevelUpStatus('player_1')).toBe(true);
			expect(store.getMemberLevelUpStatus('player_2')).toBe(false);
		});

		it('should return false for non-existent member', () => {
			expect(store.getMemberLevelUpStatus('player_99')).toBe(false);
		});
	});

	describe('Reset', () => {
		it('should reset all level up state', () => {
			store.enableButton();
			store.openDialog('Hero');
			store.setPartyLevelUpStatus({ player_1: true });

			store.reset();

			expect(store.isButtonEnabled).toBe(false);
			expect(store.isDialogOpen).toBe(false);
			expect(store.playerName).toBe('');
		});
	});
});
