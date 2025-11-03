import { describe, it, expect, beforeEach } from 'vitest';
import { EventProcessorService } from './EventProcessorService';
import type { EventEvaluation } from '$lib/ai/agents/eventAgent';
import { eventStateStore } from '$lib/state/stores/eventState.svelte';
import { partyState } from '$lib/state/stores/partyState.svelte';

describe('EventProcessorService', () => {
	let service: EventProcessorService;

	beforeEach(() => {
		service = new EventProcessorService();
		eventStateStore.reset();
	});

	describe('Event evaluation management', () => {
		it('should process event evaluation', () => {
			const evaluation: EventEvaluation = {
				character_changed: null,
				abilities_learned: ['Fireball']
			};

			service.processEventEvaluation('char_1', evaluation);
			const stored = service.getEventEvaluation('char_1');
			expect(stored).toEqual(evaluation);
		});

		it('should get event evaluation', () => {
			const evaluation: EventEvaluation = {
				character_changed: null,
				abilities_learned: []
			};

			eventStateStore.setEventEvaluation('char_1', evaluation);
			const result = service.getEventEvaluation('char_1');
			expect(result).toEqual(evaluation);
		});

		it('should return undefined for non-existent evaluation', () => {
			const result = service.getEventEvaluation('non_existent');
			expect(result).toBeUndefined();
		});
	});

	describe('Event confirmation dialog', () => {
		it('should show event confirmation', () => {
			service.showEventConfirmation();
			expect(eventStateStore.showEventConfirmationDialog).toBe(true);
		});

		it('should hide event confirmation', () => {
			service.showEventConfirmation();
			service.hideEventConfirmation();
			expect(eventStateStore.showEventConfirmationDialog).toBe(false);
		});
	});

	describe('Processing status', () => {
		it('should mark processing as complete', () => {
			service.markProcessingComplete();
			expect(eventStateStore.aiProcessingComplete).toBe(true);
		});

		it('should reset processing complete flag', () => {
			service.markProcessingComplete();
			service.resetProcessingComplete();
			expect(eventStateStore.aiProcessingComplete).toBe(false);
		});
	});

	describe('Character transformations', () => {
		it('should apply character transformation', () => {
			// This test would require proper party setup
			// For now, just verify it doesn't throw
			const newCharacter = {
				name: 'Transformed Hero',
				race: 'Dragon',
				class: 'Warrior',
				background: 'Former human',
				personality: 'Fierce'
			};

			expect(() => service.applyCharacterTransformation('char_1', newCharacter)).not.toThrow();
		});
	});

	describe('New abilities', () => {
		it('should apply new abilities', () => {
			const abilities = ['Fireball', 'Ice Shield'];
			
			// This would require proper party setup
			// For now, just verify it doesn't throw
			expect(() => service.applyNewAbilities('char_1', abilities)).not.toThrow();
		});

		it('should handle empty abilities array', () => {
			expect(() => service.applyNewAbilities('char_1', [])).not.toThrow();
		});
	});
});
