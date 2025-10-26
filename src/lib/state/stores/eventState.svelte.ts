/**
 * Event State Store
 * Manages event evaluation and transformations
 */

import { useLocalStorage } from '../useLocalStorage.svelte';
import type { EventEvaluation } from '$lib/ai/agents/eventAgent';
import { initialEventEvaluationState } from '$lib/ai/agents/eventAgent';

/**
 * Event state store
 * Manages event evaluations for character transformations and new abilities
 */
export class EventStateStore {
	// Current event evaluation (single-character compatibility)
	eventEvaluation = useLocalStorage<EventEvaluation>(
		'eventEvaluationState',
		initialEventEvaluationState
	);
	
	// Per-member event evaluations (party mode)
	eventEvaluationByMember = useLocalStorage<Record<string, EventEvaluation>>(
		'eventEvaluationByMemberState',
		{}
	);
	
	// AI processing complete flag
	aiProcessingComplete = $state<boolean>(false);
	
	// Show event confirmation dialog
	showEventConfirmationDialog = $state<boolean>(false);
	
	/**
	 * Get event evaluation for a member
	 */
	getEventEvaluation(memberId: string): EventEvaluation | undefined {
		return this.eventEvaluationByMember.value[memberId];
	}
	
	/**
	 * Set event evaluation for a member
	 */
	setEventEvaluation(memberId: string, evaluation: EventEvaluation) {
		this.eventEvaluationByMember.value = {
			...this.eventEvaluationByMember.value,
			[memberId]: evaluation
		};
	}
	
	/**
	 * Update active event evaluation (single-character mode)
	 */
	updateEventEvaluation(evaluation: EventEvaluation) {
		this.eventEvaluation.value = evaluation;
	}
	
	/**
	 * Mark AI processing as complete
	 */
	markProcessingComplete() {
		this.aiProcessingComplete = true;
	}
	
	/**
	 * Reset processing complete flag
	 */
	resetProcessingComplete() {
		this.aiProcessingComplete = false;
	}
	
	/**
	 * Show event confirmation
	 */
	showConfirmation() {
		this.showEventConfirmationDialog = true;
	}
	
	/**
	 * Hide event confirmation
	 */
	hideConfirmation() {
		this.showEventConfirmationDialog = false;
	}
	
	/**
	 * Reset event state
	 */
	reset() {
		this.eventEvaluation.reset();
		this.eventEvaluationByMember.reset();
		this.aiProcessingComplete = false;
		this.showEventConfirmationDialog = false;
	}
}

/**
 * Create and export a singleton event state instance
 */
export const eventStateStore = new EventStateStore();
