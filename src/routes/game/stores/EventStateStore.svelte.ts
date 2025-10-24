/**
 * EventStateStore - Centralized state management for character events
 * 
 * This store manages:
 * - Event evaluations (transformations, abilities learned)
 * - Per-member event evaluations
 */

import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
import type { EventEvaluation } from '$lib/ai/agents/eventAgent';
import { initialEventEvaluationState } from '$lib/ai/agents/eventAgent';

export class EventStateStore {
	// Event evaluations
	readonly eventEvaluation = useLocalStorage<EventEvaluation>(
		'eventEvaluationState',
		initialEventEvaluationState
	);

	// Per-party-member event evaluations
	readonly eventEvaluationByMember = useLocalStorage<Record<string, EventEvaluation>>(
		'eventEvaluationByMemberState',
		{}
	);

	/**
	 * Reset event state (for new game)
	 */
	resetEventState(): void {
		this.eventEvaluation.reset();
		this.eventEvaluationByMember.reset();
	}
}
