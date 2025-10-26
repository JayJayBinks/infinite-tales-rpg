import { describe, it, expect, beforeEach } from 'vitest';
import { EventStateStore } from './eventState.svelte';
import { initialEventEvaluationState } from '$lib/ai/agents/eventAgent';

describe('EventStateStore', () => {
	let store: EventStateStore;

	beforeEach(() => {
		store = new EventStateStore();
		store.reset();
	});

	describe('Initialization', () => {
		it('should initialize with default event evaluation', () => {
			expect(store.eventEvaluation.value).toEqual(initialEventEvaluationState);
			expect(store.eventEvaluationByMember.value).toEqual({});
			expect(store.aiProcessingComplete).toBe(false);
			expect(store.showEventConfirmationDialog).toBe(false);
		});
	});

	describe('Event evaluation management', () => {
		it('should get event evaluation for member', () => {
			const evaluation = { character_changed: null, abilities_learned: [] };
			store.setEventEvaluation('player_1', evaluation);
			expect(store.getEventEvaluation('player_1')).toEqual(evaluation);
		});

		it('should return undefined for non-existent member', () => {
			expect(store.getEventEvaluation('player_99')).toBeUndefined();
		});

		it('should set event evaluation for member', () => {
			const evaluation = { character_changed: null, abilities_learned: ['Fireball'] };
			store.setEventEvaluation('player_1', evaluation);
			expect(store.eventEvaluationByMember.value['player_1']).toEqual(evaluation);
		});

		it('should update active event evaluation', () => {
			const evaluation = { character_changed: null, abilities_learned: ['Ice Shield'] };
			store.updateEventEvaluation(evaluation);
			expect(store.eventEvaluation.value).toEqual(evaluation);
		});
	});

	describe('AI processing status', () => {
		it('should mark processing as complete', () => {
			store.markProcessingComplete();
			expect(store.aiProcessingComplete).toBe(true);
		});

		it('should reset processing complete flag', () => {
			store.markProcessingComplete();
			store.resetProcessingComplete();
			expect(store.aiProcessingComplete).toBe(false);
		});
	});

	describe('Event confirmation dialog', () => {
		it('should show confirmation dialog', () => {
			store.showConfirmation();
			expect(store.showEventConfirmationDialog).toBe(true);
		});

		it('should hide confirmation dialog', () => {
			store.showConfirmation();
			store.hideConfirmation();
			expect(store.showEventConfirmationDialog).toBe(false);
		});
	});

	describe('Reset', () => {
		it('should reset all event state', () => {
			store.setEventEvaluation('player_1', { character_changed: null, abilities_learned: [] });
			store.markProcessingComplete();
			store.showConfirmation();

			store.reset();

			expect(store.eventEvaluation.value).toEqual(initialEventEvaluationState);
			expect(store.eventEvaluationByMember.value).toEqual({});
			expect(store.aiProcessingComplete).toBe(false);
			expect(store.showEventConfirmationDialog).toBe(false);
		});
	});
});
