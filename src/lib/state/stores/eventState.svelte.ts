/**
 * Event State Store
 * Manages event evaluation and transformations
 */

import type { EventEvaluation } from '$lib/ai/agents/eventAgent';
import { initialEventEvaluationState } from '$lib/ai/agents/eventAgent';
import { getFromLocalStorage, saveToLocalStorage } from '$lib/state/localStorageUtil';

// (helpers centralized in localStorageUtil.ts)

/**
 * Event state store
 * Manages event evaluations for character transformations and new abilities
 */
export class EventStateStore {
	// Current event evaluation (single-character compatibility)
	private _eventEvaluation = $state<EventEvaluation>(
		getFromLocalStorage('eventEvaluationState', initialEventEvaluationState)
	);
	
	// Per-member event evaluations (party mode)
	private _eventEvaluationByMember = $state<Record<string, EventEvaluation>>(
		getFromLocalStorage('eventEvaluationByMemberState', {})
	);
	
	// AI processing complete flag
	aiProcessingComplete = $state<boolean>(false);
	
	// Show event confirmation dialog
	showEventConfirmationDialog = $state<boolean>(false);
	
	get eventEvaluation() {
		return this._eventEvaluation;
	}
	
	set eventEvaluation(value: EventEvaluation) {
		this._eventEvaluation = value;
		saveToLocalStorage('eventEvaluationState', value);
	}
	
	get eventEvaluationByMember() {
		return this._eventEvaluationByMember;
	}
	
	set eventEvaluationByMember(value: Record<string, EventEvaluation>) {
		this._eventEvaluationByMember = value;
		saveToLocalStorage('eventEvaluationByMemberState', value);
	}
	
	/**
	 * Get event evaluation for a member
	 */
	getEventEvaluation(memberId: string): EventEvaluation | undefined {
		return this._eventEvaluationByMember[memberId];
	}
	
	/**
	 * Set event evaluation for a member
	 */
	setEventEvaluation(memberId: string, evaluation: EventEvaluation) {
		this.eventEvaluationByMember = {
			...this._eventEvaluationByMember,
			[memberId]: evaluation
		};
	}
	
	/**
	 * Update active event evaluation (single-character mode)
	 */
	updateEventEvaluation(evaluation: EventEvaluation) {
		this.eventEvaluation = evaluation;
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
		this.eventEvaluation = initialEventEvaluationState;
		this.eventEvaluationByMember = {};
		this.aiProcessingComplete = false;
		this.showEventConfirmationDialog = false;
	}
}

/**
 * Create and export a singleton event state instance
 */
export const eventStateStore = new EventStateStore();
