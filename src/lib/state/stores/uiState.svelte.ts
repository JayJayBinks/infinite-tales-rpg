/**
 * Centralized UI state store
 * Manages UI-only state (modals, loading, errors, etc.)
 */

import { useLocalStorage } from '../useLocalStorage.svelte';
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
	didAIProcessDiceRollAction = useLocalStorage<boolean>('didAIProcessDiceRollAction', false);
	didAIProcessAction = $state<boolean>(true);
	aiProcessingComplete = $state<boolean>(false);
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
	levelUpDialog = useLocalStorage<{
		buttonEnabled: boolean;
		dialogOpened: boolean;
		playerName: string;
		partyLevelUpStatus?: Record<string, boolean>;
	}>('levelUpState', {
		buttonEnabled: false,
		dialogOpened: false,
		playerName: ''
	});
	
	// GM question modal
	gmQuestion = $state<string>('');
	
	/**
	 * Open level up dialog
	 */
	openLevelUpDialog(playerName: string) {
		this.levelUpDialog.value = {
			...this.levelUpDialog.value,
			dialogOpened: true,
			playerName
		};
	}
	
	/**
	 * Close level up dialog
	 */
	closeLevelUpDialog() {
		this.levelUpDialog.value = {
			...this.levelUpDialog.value,
			dialogOpened: false
		};
	}
}

/**
 * UI state for current selections and inputs
 */
export class SelectionState {
	// Current action selections
	chosenAction = useLocalStorage<Action>('chosenActionState', {} as Action);
	characterActions = useLocalStorage<Action[]>('characterActionsState', []);
	
	// Custom action input
	customActionReceiver = $state<'Story Command' | 'State Command' | 'Character Action' | 'GM Question' | 'Dice Roll'>('Character Action');
	
	// TTS actions text
	actionsTextForTTS = $state<string>('');
	
	// Event evaluation (single-character compatibility)
	eventEvaluation = useLocalStorage<EventEvaluation>('eventEvaluationState', initialEventEvaluationState);
	
	/**
	 * Reset action selections
	 */
	resetActions() {
		this.characterActions.reset();
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
	thoughts = useLocalStorage<ThoughtsState>('thoughtsState', initialThoughtsState);
	
	/**
	 * Update thoughts for a specific area
	 */
	updateThoughts(area: keyof ThoughtsState, content: string) {
		this.thoughts.value = {
			...this.thoughts.value,
			[area]: content
		};
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
		this.loading.didAIProcessDiceRollAction.reset();
		this.loading.didAIProcessAction = true;
		this.loading.aiProcessingComplete = false;
		
		this.modals.showSuggestedActionsDialog = false;
		this.modals.showImpossibleActionDialog = false;
		this.modals.customActionImpossibleReason = undefined;
		this.modals.showEventConfirmationDialog = false;
		this.modals.levelUpDialog.reset();
		this.modals.gmQuestion = '';
		
		this.selection.chosenAction.reset();
		this.selection.characterActions.reset();
		this.selection.customActionReceiver = 'Character Action';
		this.selection.actionsTextForTTS = '';
		this.selection.eventEvaluation.reset();
		
		this.storyDisplay.showXLastStoryProgressions = 0;
		this.storyDisplay.thoughts.reset();
	}
}

/**
 * Create and export a singleton UI state instance
 */
export const uiState = new UIState();
