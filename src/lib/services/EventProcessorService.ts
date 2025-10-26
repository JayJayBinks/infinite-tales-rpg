/**
 * Event Processor Service
 * Processes game events, character transformations, and new abilities
 * Coordinates event evaluation and state updates
 */

import type { EventEvaluation } from '$lib/ai/agents/eventAgent';
import { eventStateStore } from '$lib/state/stores/eventState.svelte';
import { partyState } from '$lib/state/stores/partyState.svelte';
import { characterStateStore } from '$lib/state/stores/characterState.svelte';
import type { EventAgent } from '$lib/ai/agents/eventAgent';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';

export interface EventProcessingResult {
	hasChanges: boolean;
	transformations: Map<string, CharacterDescription>;
	newAbilities: Map<string, string[]>;
}

/**
 * Event processor service
 * Manages event evaluation and processing
 */
export class EventProcessorService {
	/**
	 * Evaluate events for all party members
	 */
	async evaluatePartyEvents(
		eventAgent: EventAgent,
		storyContext: string[]
	): Promise<Map<string, EventEvaluation>> {
		const evaluations = new Map<string, EventEvaluation>();
		const members = partyState.party.value.members;
		
		// Evaluate events for each party member
		for (const member of members) {
			try {
				// Get member's known abilities
				const memberStats = partyState.getMemberStatsById(member.id);
				const knownAbilities = memberStats?.spells_and_abilities || [];
				
				// Evaluate events via event agent
				// This would call eventAgent.evaluatePartyEvents() or similar
				// For now, use placeholder evaluation
				const evaluation: EventEvaluation = {
					character_changed: null,
					abilities_learned: []
				};
				
				evaluations.set(member.id, evaluation);
				eventStateStore.setEventEvaluation(member.id, evaluation);
			} catch (error) {
				console.error(`Error evaluating events for ${member.character.name}:`, error);
			}
		}
		
		return evaluations;
	}
	
	/**
	 * Process event evaluation for active character
	 */
	processEventEvaluation(characterId: string, evaluation: EventEvaluation) {
		eventStateStore.setEventEvaluation(characterId, evaluation);
		
		// Update active event evaluation for UI compatibility
		if (characterId === partyState.activeCharacterId) {
			eventStateStore.updateEventEvaluation(evaluation);
		}
	}
	
	/**
	 * Apply character transformation
	 */
	applyCharacterTransformation(characterId: string, newCharacter: CharacterDescription) {
		// Update party member's character
		const member = partyState.getMemberById(characterId);
		if (!member) {
			console.warn('Character not found for transformation:', characterId);
			return;
		}
		
		partyState.party.value = {
			...partyState.party.value,
			members: partyState.party.value.members.map(m =>
				m.id === characterId
					? { ...m, character: newCharacter }
					: m
			)
		};
		
		// Update active character if this is the active member
		if (characterId === partyState.activeCharacterId) {
			characterStateStore.updateCharacter(newCharacter);
		}
	}
	
	/**
	 * Apply new abilities to character
	 */
	applyNewAbilities(characterId: string, newAbilities: string[]) {
		if (newAbilities.length === 0) return;
		
		const memberStats = partyState.getMemberStatsById(characterId);
		if (!memberStats) {
			console.warn('Character stats not found:', characterId);
			return;
		}
		
		// Add new abilities to existing ones
		const updatedAbilities = [
			...(memberStats.spells_and_abilities || []),
			...newAbilities.map(name => ({ name, effect: 'New ability' }))
		];
		
		const updatedStats: CharacterStats = {
			...memberStats,
			spells_and_abilities: updatedAbilities
		};
		
		// Update party stats
		partyState.partyStats.value = {
			...partyState.partyStats.value,
			members: partyState.partyStats.value.members.map(m =>
				m.id === characterId
					? { ...m, stats: updatedStats }
					: m
			)
		};
		
		// Update active character stats if this is the active member
		if (characterId === partyState.activeCharacterId) {
			characterStateStore.updateStats(updatedStats);
		}
	}
	
	/**
	 * Process all pending events for party
	 */
	async processAllPendingEvents(
		eventAgent: EventAgent,
		storyContext: string[]
	): Promise<EventProcessingResult> {
		const result: EventProcessingResult = {
			hasChanges: false,
			transformations: new Map(),
			newAbilities: new Map()
		};
		
		// Evaluate events for all party members
		const evaluations = await this.evaluatePartyEvents(eventAgent, storyContext);
		
		// Process each evaluation
		evaluations.forEach((evaluation, characterId) => {
			// Check for character transformation
			if (evaluation.character_changed) {
				result.hasChanges = true;
				result.transformations.set(characterId, evaluation.character_changed);
			}
			
			// Check for new abilities
			if (evaluation.abilities_learned && evaluation.abilities_learned.length > 0) {
				result.hasChanges = true;
				result.newAbilities.set(characterId, evaluation.abilities_learned);
			}
		});
		
		return result;
	}
	
	/**
	 * Show event confirmation dialog
	 */
	showEventConfirmation() {
		eventStateStore.showConfirmation();
	}
	
	/**
	 * Hide event confirmation dialog
	 */
	hideEventConfirmation() {
		eventStateStore.hideConfirmation();
	}
	
	/**
	 * Mark AI processing as complete
	 */
	markProcessingComplete() {
		eventStateStore.markProcessingComplete();
	}
	
	/**
	 * Reset processing complete flag
	 */
	resetProcessingComplete() {
		eventStateStore.resetProcessingComplete();
	}
	
	/**
	 * Get event evaluation for a character
	 */
	getEventEvaluation(characterId: string): EventEvaluation | undefined {
		return eventStateStore.getEventEvaluation(characterId);
	}
}

/**
 * Create and export a singleton event processor service
 */
export const eventProcessorService = new EventProcessorService();
