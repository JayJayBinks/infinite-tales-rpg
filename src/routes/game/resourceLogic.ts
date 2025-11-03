import type { Resources } from '$lib/ai/agents/characterStatsAgent';
import {
	GameAgent,
	type GameActionState,
	type PlayerCharactersGameState
} from '$lib/ai/agents/gameAgent';

export function refillResourcesFully(
	maxResources: Resources,
	playerId: string,
	playerCharacterName: string,
	gameActionsState: GameActionState[],
	playerCharactersGameState: PlayerCharactersGameState
): {
	updatedGameActionsState: GameActionState[];
	updatedPlayerCharactersGameState: PlayerCharactersGameState;
} {
	// Ensure the player has an entry in the game state
	if (!playerCharactersGameState[playerId]) {
		playerCharactersGameState[playerId] = {};
	}
	
	// Get the current state for the given player
	const currentPlayerResources = playerCharactersGameState[playerId];

	// First: compute the update log via GameAgent using the provided values
	const statsUpdate = GameAgent.getRefillResourcesUpdateObject(
		maxResources,
		currentPlayerResources,
		playerCharacterName
	);

	// Copy the game actions state and update the last action's stats_update log
	const updatedGameActionsState = [...gameActionsState];
	const statsUpdateEntries = statsUpdate.stats_update ?? [];
	if (updatedGameActionsState.length > 0 && statsUpdateEntries.length > 0) {
		const lastIndex = updatedGameActionsState.length - 1;
		const lastAction = updatedGameActionsState[lastIndex];
		updatedGameActionsState[lastIndex] = {
			...lastAction,
			stats_update: [...(lastAction?.stats_update ?? []), ...statsUpdateEntries]
		};
	}

	//then set current values to start or max value or if smaller than current value to current value
	const newResources: Partial<Resources> = {};
	for (const key of Object.keys(maxResources)) {
		const resourceDefinition = maxResources[key];
		const existingResource = currentPlayerResources[key];
		const existingValue = existingResource?.current_value ?? resourceDefinition.start_value ?? 0;

		if (key === 'XP') {
			newResources[key] = {
				...resourceDefinition,
				current_value: existingValue
			};
			continue;
		}

		const baseTarget = Math.max(resourceDefinition.max_value || 0, resourceDefinition.start_value || 0);
		const targetValue = Math.max(existingValue, baseTarget);
		newResources[key] = {
			...resourceDefinition,
			current_value: targetValue
		};
	}

	// Then: update the player's resource values to be set to the maximum.
	const updatedPlayerResources = {
		...currentPlayerResources, // preserve existing properties (like XP)
		...newResources
	};

	// Prepare the new playerCharactersGameState with the updated value for playerName.
	const updatedPlayerCharactersGameState = {
		...playerCharactersGameState,
		[playerId]: updatedPlayerResources
	};

	return {
		updatedGameActionsState,
		updatedPlayerCharactersGameState
	};
}

export function initializeMissingResources(
	resources: Resources,
	playerId: string,
	playerCharacterName: string,
	gameActionsState: GameActionState[],
	playerCharactersGameState: PlayerCharactersGameState
) {
	// Ensure the player has an entry in the game state
	if (!playerCharactersGameState[playerId]) {
		playerCharactersGameState[playerId] = {};
	}
	
	// Check for any resources that are missing in the player's state.
	const missingResources: Resources = Object.entries(resources)
		.filter(
			([resourceKey]) =>
				playerCharactersGameState[playerId][resourceKey]?.current_value === undefined
		)
		.reduce((acc, [resourceKey, resource]) => ({ ...acc, [resourceKey]: resource }), {});
	if (Object.keys(missingResources).length > 0) {
		const { updatedGameActionsState, updatedPlayerCharactersGameState } = refillResourcesFully(
			missingResources,
			playerId,
			playerCharacterName,
			gameActionsState,
			playerCharactersGameState
		);
		return { updatedGameActionsState, updatedPlayerCharactersGameState };
	}
	return {
		updatedGameActionsState: gameActionsState,
		updatedPlayerCharactersGameState: playerCharactersGameState
	};
}
