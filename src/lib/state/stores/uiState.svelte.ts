/**
 * Centralized UI state store
 * Manages UI-only state (modals, loading, errors, etc.)
 */

import { getFromLocalStorage, saveToLocalStorage } from '$lib/state/localStorageUtil';
import type { Action } from '$lib/ai/agents/gameAgent';
import type { ThoughtsState } from '$lib/util.svelte';
import { initialThoughtsState } from '$lib/util.svelte';
import type { EventEvaluation } from '$lib/ai/agents/eventAgent';
import { initialEventEvaluationState } from '$lib/ai/agents/eventAgent';

/**
 * UI state for loading and processing
 */
export class LoadingState {
	isAiGenerating = $state(false);
	private _didAIProcessDiceRollAction = $state<boolean>(
		getFromLocalStorage('didAIProcessDiceRollAction', false)
	);
	didAIProcessAction = $state<boolean>(true);
	aiProcessingComplete = $state<boolean>(false);

	get didAIProcessDiceRollAction() {
		return this._didAIProcessDiceRollAction;
	}

	set didAIProcessDiceRollAction(v: boolean) {
		this._didAIProcessDiceRollAction = v;
		saveToLocalStorage('didAIProcessDiceRollAction', v);
	}

	resetDidAIProcessDiceRollAction() {
		this.didAIProcessDiceRollAction = false;
	}
}

/**
 * UI state for modals and dialogs
 */
export class ModalState {
	// Action-related modals
	showSuggestedActionsDialog = $state(false);
	showImpossibleActionDialog = $state(false);
	customActionImpossibleReason = $state<'not_enough_resource' | 'not_plausible' | undefined>(undefined);
	
	// Event-related modals
	showEventConfirmationDialog = $state(false);
	
	// Level up modal
	private _levelUpDialog = $state<{
		buttonEnabled: boolean;
		dialogOpened: boolean;
		playerName: string;
		partyLevelUpStatus?: Record<string, boolean>;
	}>(
		getFromLocalStorage('levelUpState', {
			buttonEnabled: false,
			dialogOpened: false,
			playerName: ''
		})
	);

	get levelUpDialog() {
		return this._levelUpDialog;
	}

	set levelUpDialog(v) {
		this._levelUpDialog = v;
		saveToLocalStorage('levelUpState', v);
	}

	resetLevelUpDialog() {
		this.levelUpDialog = { buttonEnabled: false, dialogOpened: false, playerName: '' };
	}
	
	// GM question modal
	gmQuestion = $state<string>('');
	
	/**
	 * Open level up dialog
	 */
	openLevelUpDialog(playerName: string) {
		this.levelUpDialog = { ...this.levelUpDialog, dialogOpened: true, playerName };
	}
	
	/**
	 * Close level up dialog
	 */
	closeLevelUpDialog() {
		this.levelUpDialog = { ...this.levelUpDialog, dialogOpened: false };
	}
}

/**
 * UI state for current selections and inputs
 */
export class SelectionState {
	// Current action selections
	private _chosenAction = $state<Action>(getFromLocalStorage('chosenActionState', {} as Action));
	private _characterActions = $state<Action[]>(getFromLocalStorage('characterActionsState', []));
	
	// Custom action input
	customActionReceiver = $state<'Story Command' | 'State Command' | 'Character Action' | 'GM Question' | 'Dice Roll'>('Character Action');
	
	// TTS actions text
	actionsTextForTTS = $state<string>('');
	
	// Event evaluation (single-character compatibility)
	private _eventEvaluation = $state<EventEvaluation>(
		getFromLocalStorage('eventEvaluationState', initialEventEvaluationState)
	);

	get chosenAction() {
		return this._chosenAction;
	}
	set chosenAction(v: Action) {
		this._chosenAction = v;
		saveToLocalStorage('chosenActionState', v);
	}

	get characterActions() {
		return this._characterActions;
	}
	set characterActions(v: Action[]) {
		this._characterActions = v;
		saveToLocalStorage('characterActionsState', v);
	}

	get eventEvaluation() {
		return this._eventEvaluation;
	}
	set eventEvaluation(v: EventEvaluation) {
		this._eventEvaluation = v;
		saveToLocalStorage('eventEvaluationState', v);
	}
	
	/**
	 * Reset action selections
	 */
	resetActions() {
		this.characterActions = [];
		this.actionsTextForTTS = '';
	}
}

/**
 * UI state for story display
 */
export class StoryDisplayState {
	// Number of story progressions to show
	showXLastStoryProgressions = $state<number>(0);
	
	// Thoughts state
	private _thoughts = $state<ThoughtsState>(
		getFromLocalStorage('thoughtsState', initialThoughtsState)
	);

	get thoughts() {
		return this._thoughts;
	}
	set thoughts(v: ThoughtsState) {
		this._thoughts = v;
		saveToLocalStorage('thoughtsState', v);
	}
	
	/**
	 * Update thoughts for a specific area
	 */
	updateThoughts(area: keyof ThoughtsState, content: string) {
		this.thoughts = { ...this.thoughts, [area]: content };
	}
}

/**
 * Master UI state container
 */
export class UIState {
	loading = new LoadingState();
	modals = new ModalState();
	selection = new SelectionState();
	storyDisplay = new StoryDisplayState();
	
	/**
	 * Reset all UI state
	 */
	resetUIState() {
		this.loading.isAiGenerating = false;
		this.loading.resetDidAIProcessDiceRollAction();
		this.loading.didAIProcessAction = true;
		this.loading.aiProcessingComplete = false;
		
		this.modals.showSuggestedActionsDialog = false;
		this.modals.showImpossibleActionDialog = false;
		this.modals.customActionImpossibleReason = undefined;
		this.modals.showEventConfirmationDialog = false;
		this.modals.resetLevelUpDialog();
		this.modals.gmQuestion = '';
		
		this.selection.chosenAction = {} as Action;
		this.selection.characterActions = [];
		this.selection.customActionReceiver = 'Character Action';
		this.selection.actionsTextForTTS = '';
		this.selection.eventEvaluation = initialEventEvaluationState;
		
		this.storyDisplay.showXLastStoryProgressions = 0;
		this.storyDisplay.thoughts = initialThoughtsState;
	}
}

/**
 * Create and export a singleton UI state instance
 */
export const uiState = new UIState();
