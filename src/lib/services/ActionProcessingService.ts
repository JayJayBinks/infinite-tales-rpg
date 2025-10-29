/**
 * Action Processing Service
 * Handles action execution, validation, and state updates
 * Coordinates action flow between game logic and AI agents
 */

import type { Action, GameActionState } from '$lib/ai/agents/gameAgent';
import type { ResourcesWithCurrentValue } from '$lib/ai/agents/gameAgent';
import { gameState } from '$lib/state/stores/gameState.svelte';
import { partyState } from '$lib/state/stores/partyState.svelte';
import { combatState } from '$lib/state/stores/combatState.svelte';
import * as gameLogic from '../../routes/game/gameLogic';
import type { GameAgent } from '$lib/ai/agents/gameAgent';
import type { ActionAgent } from '$lib/ai/agents/actionAgent';

export interface ProcessActionParams {
	action: Action;
	characterId: string;
	additionalInput?: string;
	simulation?: string;
}

export interface ActionProcessingResult {
	success: boolean;
	newGameState?: GameActionState;
	error?: string;
}

/**
 * Action processing service
 * Manages action execution and validation flow
 */
export class ActionProcessingService {
	/**
	 * Validate if an action can be executed
	 */
	canExecuteAction(action: Action, characterId: string): {
		canExecute: boolean;
		reason?: string;
	} {
		// Get character resources
		const characterResources = gameState.progression.playerCharactersGame[characterId];
		
		if (!characterResources) {
			return { canExecute: false, reason: 'Character not found' };
		}
		
		// Check resource costs
		if (action.resource_cost && typeof action.resource_cost === 'object') {
			for (const [resourceKey, cost] of Object.entries(action.resource_cost)) {
				const resource = characterResources[resourceKey];
				if (!resource || resource.current_value < cost) {
					return { canExecute: false, reason: 'Insufficient resources' };
				}
			}
		}
		
		return { canExecute: true };
	}
	
	/**
	 * Process an action and update game state
	 */
	async processAction(
		gameAgent: GameAgent,
		params: ProcessActionParams
	): Promise<ActionProcessingResult> {
		const { action, characterId, additionalInput, simulation } = params;
		
		// Validate action
		const validation = this.canExecuteAction(action, characterId);
		if (!validation.canExecute) {
			return {
				success: false,
				error: validation.reason
			};
		}
		
		try {
			// Action processing would happen here via game agent
			// This is a simplified version - actual implementation would call
			// the appropriate game agent methods
			
			return {
				success: true
			};
		} catch (error) {
			console.error('Error processing action:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
	
	/**
	 * Generate actions for a character
	 */
	async generateActions(
		actionAgent: ActionAgent,
		characterId: string
	): Promise<Action[]> {
		// Get party member
		const member = partyState.getMemberById(characterId);
		if (!member) {
			console.warn('Character not found:', characterId);
			return [];
		}
		
		// Get cached actions if available
		const cachedActions = partyState.getMemberActions(characterId);
		if (cachedActions.length > 0) {
			return cachedActions;
		}
		
		// Generate new actions via action agent
		// This would call actionAgent.generateActions() with appropriate params
		// For now, return empty array
		return [];
	}
	
	/**
	 * Cache actions for a character
	 */
	cacheActions(characterId: string, actions: Action[]) {
		partyState.setMemberActions(characterId, actions);
	}
	
	/**
	 * Clear cached actions for a character
	 */
	clearCachedActions(characterId: string) {
		partyState.setMemberActions(characterId, []);
	}
	
	/**
	 * Clear all cached actions
	 */
	clearAllCachedActions() {
		const members = partyState.party.members;
		members.forEach(member => {
			this.clearCachedActions(member.id);
		});
	}
	
	/**
	 * Apply game action state updates
	 */
	applyGameActionState(gameActionState: GameActionState) {
		gameLogic.applyGameActionState(
			gameState.progression.playerCharactersGame,
			gameState.progression.playerCharactersIdToNamesMap,
			gameState.progression.npcs,
			gameState.progression.inventory,
			gameActionState
		);
	}
}

/**
 * Create and export a singleton action processing service
 */
export const actionProcessingService = new ActionProcessingService();
