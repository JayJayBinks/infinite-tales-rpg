/**
 * Level Up State Store
 * Manages level up dialog and status
 */

export interface LevelUpState {
	buttonEnabled: boolean;
	dialogOpened: boolean;
	playerName: string;
	partyLevelUpStatus?: Record<string, boolean>;
}

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
 * Level up state store
 * Manages level up UI and status tracking
 */
export class LevelUpStateStore {
	// Level up state
	private _levelUpState = $state<LevelUpState>(
		getFromLocalStorage('levelUpState', {
			buttonEnabled: false,
			dialogOpened: false,
			playerName: ''
		})
	);
	
	get levelUpState() {
		return this._levelUpState;
	}
	
	set levelUpState(value: LevelUpState) {
		this._levelUpState = value;
		saveToLocalStorage('levelUpState', value);
	}
	
	/**
	 * Check if level up button is enabled
	 */
	get isButtonEnabled(): boolean {
		return this._levelUpState.buttonEnabled;
	}
	
	/**
	 * Check if level up dialog is open
	 */
	get isDialogOpen(): boolean {
		return this._levelUpState.dialogOpened;
	}
	
	/**
	 * Get current player name for level up
	 */
	get playerName(): string {
		return this._levelUpState.playerName;
	}
	
	/**
	 * Enable level up button
	 */
	enableButton() {
		this.levelUpState = {
			...this._levelUpState,
			buttonEnabled: true
		};
	}
	
	/**
	 * Disable level up button
	 */
	disableButton() {
		this.levelUpState = {
			...this._levelUpState,
			buttonEnabled: false
		};
	}
	
	/**
	 * Open level up dialog
	 */
	openDialog(playerName: string) {
		this.levelUpState = {
			...this._levelUpState,
			dialogOpened: true,
			playerName
		};
	}
	
	/**
	 * Close level up dialog
	 */
	closeDialog() {
		this.levelUpState = {
			...this._levelUpState,
			dialogOpened: false
		};
	}
	
	/**
	 * Set party level up status
	 */
	setPartyLevelUpStatus(status: Record<string, boolean>) {
		this.levelUpState = {
			...this._levelUpState,
			partyLevelUpStatus: status
		};
	}
	
	/**
	 * Get level up status for a party member
	 */
	getMemberLevelUpStatus(memberId: string): boolean {
		return this._levelUpState.partyLevelUpStatus?.[memberId] || false;
	}
	
	/**
	 * Reset level up state
	 */
	reset() {
		this.levelUpState = {
			buttonEnabled: false,
			dialogOpened: false,
			playerName: ''
		};
	}
}

/**
 * Create and export a singleton level up state instance
 */
export const levelUpStateStore = new LevelUpStateStore();
