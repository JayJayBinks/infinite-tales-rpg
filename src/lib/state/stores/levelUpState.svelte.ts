/**
 * Level Up State Store
 * Manages level up dialog and status
 */

import { useLocalStorage } from '../useLocalStorage.svelte';

export interface LevelUpState {
	buttonEnabled: boolean;
	dialogOpened: boolean;
	playerName: string;
	partyLevelUpStatus?: Record<string, boolean>;
}

/**
 * Level up state store
 * Manages level up UI and status tracking
 */
export class LevelUpStateStore {
	// Level up state
	levelUpState = useLocalStorage<LevelUpState>('levelUpState', {
		buttonEnabled: false,
		dialogOpened: false,
		playerName: ''
	});
	
	/**
	 * Check if level up button is enabled
	 */
	get isButtonEnabled(): boolean {
		return this.levelUpState.value.buttonEnabled;
	}
	
	/**
	 * Check if level up dialog is open
	 */
	get isDialogOpen(): boolean {
		return this.levelUpState.value.dialogOpened;
	}
	
	/**
	 * Get current player name for level up
	 */
	get playerName(): string {
		return this.levelUpState.value.playerName;
	}
	
	/**
	 * Enable level up button
	 */
	enableButton() {
		this.levelUpState.value = {
			...this.levelUpState.value,
			buttonEnabled: true
		};
	}
	
	/**
	 * Disable level up button
	 */
	disableButton() {
		this.levelUpState.value = {
			...this.levelUpState.value,
			buttonEnabled: false
		};
	}
	
	/**
	 * Open level up dialog
	 */
	openDialog(playerName: string) {
		this.levelUpState.value = {
			...this.levelUpState.value,
			dialogOpened: true,
			playerName
		};
	}
	
	/**
	 * Close level up dialog
	 */
	closeDialog() {
		this.levelUpState.value = {
			...this.levelUpState.value,
			dialogOpened: false
		};
	}
	
	/**
	 * Set party level up status
	 */
	setPartyLevelUpStatus(status: Record<string, boolean>) {
		this.levelUpState.value = {
			...this.levelUpState.value,
			partyLevelUpStatus: status
		};
	}
	
	/**
	 * Get level up status for a party member
	 */
	getMemberLevelUpStatus(memberId: string): boolean {
		return this.levelUpState.value.partyLevelUpStatus?.[memberId] || false;
	}
	
	/**
	 * Reset level up state
	 */
	reset() {
		this.levelUpState.reset();
	}
}

/**
 * Create and export a singleton level up state instance
 */
export const levelUpStateStore = new LevelUpStateStore();
