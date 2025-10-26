/**
 * Action Service
 * Handles action processing, validation, and execution
 * Centralizes action-related business logic
 */

import type { Action, GameActionState, InventoryState } from '$lib/ai/agents/gameAgent';
import type { CharacterDescription, Party } from '$lib/ai/agents/characterAgent';
import type { CharacterStats, NPCState } from '$lib/ai/agents/characterStatsAgent';
import type { ResourcesWithCurrentValue } from '$lib/ai/agents/gameAgent';
import type { Story } from '$lib/ai/agents/storyAgent';
import type { SystemInstructionsState, LLMMessage } from '$lib/ai/llm';
import type { ActionAgent } from '$lib/ai/agents/actionAgent';
import type { SummaryAgent } from '$lib/ai/agents/summaryAgent';
import type { RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
import type { PlayerCharactersIdToNamesMap } from '$lib/ai/agents/gameAgent';

export interface ActionGenerationParams {
	currentGameAction: GameActionState;
	historyMessages: LLMMessage[];
	storyState: Story;
	character: CharacterDescription;
	characterStats: CharacterStats;
	inventory: InventoryState;
	systemInstructions: SystemInstructionsState;
	relatedHistory: string[];
	aiIntroducesSkills?: boolean;
	restrainingExplanation?: string | null;
	additionalActionInput?: string;
}

export interface ActionGenerationResult {
	thoughts: string;
	actions: Action[];
}

/**
 * Service for managing actions
 */
export class ActionService {
	/**
	 * Generate actions for a character
	 */
	async generateActions(
		actionAgent: ActionAgent,
		params: ActionGenerationParams
	): Promise<ActionGenerationResult> {
		const {
			currentGameAction,
			historyMessages,
			storyState,
			character,
			characterStats,
			inventory,
			systemInstructions,
			relatedHistory,
			aiIntroducesSkills,
			restrainingExplanation,
			additionalActionInput
		} = params;

		const { thoughts, actions } = await actionAgent.generateActions(
			currentGameAction,
			historyMessages,
			storyState,
			character,
			characterStats,
			inventory,
			systemInstructions.generalSystemInstruction,
			systemInstructions.actionAgentInstruction,
			relatedHistory,
			aiIntroducesSkills,
			restrainingExplanation,
			additionalActionInput
		);

		return { thoughts, actions };
	}

	/**
	 * Generate actions for all party members
	 */
	async generateActionsForAllMembers(
		actionAgent: ActionAgent,
		party: Party,
		partyStats: { members: Array<{ id: string; stats: CharacterStats }> },
		playerCharactersGame: Record<string, ResourcesWithCurrentValue>,
		currentGameAction: GameActionState,
		historyMessages: LLMMessage[],
		storyState: Story,
		inventory: InventoryState,
		systemInstructions: SystemInstructionsState,
		relatedHistory: string[],
		aiIntroducesSkills: boolean | undefined,
		restrainedExplanationByMember: Record<string, string | null>,
		playerCharactersIdToNamesMap: PlayerCharactersIdToNamesMap,
		additionalActionInput: string,
		getActiveRestrainingStateFn: (
			party: Party,
			playerCharactersIdToNamesMap: PlayerCharactersIdToNamesMap,
			characterName: string,
			restrainedExplanationByMember: Record<string, string | null>,
			currentGameAction: GameActionState
		) => string | null | undefined
	): Promise<Map<string, ActionGenerationResult>> {
		const results = new Map<string, ActionGenerationResult>();
		const activeId = party.activeCharacterId;

		// Generate actions for all party members concurrently
		const actionsPromises = party.members.map(async (member) => {
			try {
				const memberStats = partyStats.members.find((m) => m.id === member.id);
				if (!memberStats) return null;

				// Get current resources for this member
				const currentResources = playerCharactersGame[member.id];
				const memberStatsWithCurrentResources = {
					...memberStats.stats,
					resources: Object.fromEntries(
						Object.entries(memberStats.stats.resources).map(([key, resource]) => [
							key,
							{
								...resource,
								current_value:
									currentResources?.[key]?.current_value ??
									resource.start_value ??
									resource.max_value
							}
						])
					)
				};

				const memberRestrainingState = getActiveRestrainingStateFn(
					party,
					playerCharactersIdToNamesMap,
					member.character.name,
					restrainedExplanationByMember,
					currentGameAction
				);

				const { thoughts, actions } = await actionAgent.generateActions(
					currentGameAction,
					historyMessages,
					storyState,
					member.character,
					memberStatsWithCurrentResources,
					inventory,
					systemInstructions.generalSystemInstruction,
					systemInstructions.actionAgentInstruction,
					relatedHistory,
					aiIntroducesSkills,
					memberRestrainingState,
					additionalActionInput
				);

				return { memberId: member.id, actions, thoughts, isActive: member.id === activeId };
			} catch (error) {
				console.warn(`Failed to generate actions for ${member.character.name}:`, error);
				return null;
			}
		});

		const actionResults = await Promise.all(actionsPromises);

		// Process results
		actionResults.forEach((result) => {
			if (result && result.actions) {
				results.set(result.memberId, {
					thoughts: result.thoughts,
					actions: result.actions
				});
			}
		});

		return results;
	}

	/**
	 * Validate if an action can be executed
	 */
	canExecuteAction(
		action: Action,
		characterResources: ResourcesWithCurrentValue
	): { canExecute: boolean; reason?: 'not_enough_resource' | 'not_plausible' } {
		// Check if character has enough resources to perform the action
		if (action.resource_cost) {
			for (const [resourceKey, cost] of Object.entries(action.resource_cost)) {
				const currentResource = characterResources[resourceKey];
				if (!currentResource || currentResource.current_value < cost) {
					return { canExecute: false, reason: 'not_enough_resource' };
				}
			}
		}

		return { canExecute: true };
	}

	/**
	 * Filter actions based on character's current state
	 */
	filterAvailableActions(
		actions: Action[],
		characterResources: ResourcesWithCurrentValue
	): Action[] {
		return actions.filter((action) => {
			const { canExecute } = this.canExecuteAction(action, characterResources);
			return canExecute;
		});
	}
}

/**
 * Create and export a singleton action service instance
 */
export const actionService = new ActionService();
