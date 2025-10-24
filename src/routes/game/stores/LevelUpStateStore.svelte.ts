/**
 * LevelUpStateStore - Centralized state management for level-up state
 * 
 * This store manages:
 * - Level-up button state
 * - Level-up dialog state
 * - Party-wide level-up status
 */

import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

export class LevelUpStateStore {
	readonly levelUpState = useLocalStorage<{
		buttonEnabled: boolean;
		dialogOpened: boolean;
		playerName: string;
		partyLevelUpStatus?: Record<string, boolean>;
	}>('levelUpState', {
		buttonEnabled: false,
		dialogOpened: false,
		playerName: ''
	});

	/**
	 * Enable/disable level-up button
	 */
	setButtonEnabled(enabled: boolean): void {
		this.levelUpState.value = {
			...this.levelUpState.value,
			buttonEnabled: enabled
		};
	}

	/**
	 * Set party member level-up status
	 */
	setMemberLevelUpStatus(memberId: string, canLevelUp: boolean): void {
		if (!this.levelUpState.value.partyLevelUpStatus) {
			this.levelUpState.value.partyLevelUpStatus = {};
		}
		this.levelUpState.value.partyLevelUpStatus[memberId] = canLevelUp;
	}

	/**
	 * Check if any party member can level up
	 */
	anyMemberCanLevelUp(): boolean {
		return Object.values(this.levelUpState.value.partyLevelUpStatus || {}).some(
			(status) => status
		);
	}

	/**
	 * Reset level-up state (for new game)
	 */
	resetLevelUpState(): void {
		this.levelUpState.reset();
	}
}
