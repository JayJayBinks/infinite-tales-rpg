import type { Resources } from '$lib/ai/agents/characterStatsAgent';
import {
	GameAgent,
	type GameActionState,
	type PlayerCharactersGameState
} from '$lib/ai/agents/gameAgent';

export function refillResourcesFully(
	maxResources: Resources,
	playerName: string,
	gameActionsState: GameActionState[],
	playerCharactersGameState: PlayerCharactersGameState
): {
	updatedGameActionsState: GameActionState[];
	updatedPlayerCharactersGameState: PlayerCharactersGameState;
} {
	// Get the current state for the given player
	const currentPlayerResources = playerCharactersGameState[playerName];

	// First: compute the update log via GameAgent using the provided values
	const statsUpdate = GameAgent.getRefillResourcesUpdateObject(
		maxResources,
		currentPlayerResources,
		playerName
	);

	// Copy the game actions state and update the last action's stats_update log
	const updatedGameActionsState = [...gameActionsState];
	const lastIndex = updatedGameActionsState.length - 1;
	updatedGameActionsState[lastIndex] = {
		...updatedGameActionsState[lastIndex],
		stats_update: [...updatedGameActionsState[lastIndex].stats_update, ...statsUpdate.stats_update]
	};

	//then set current values to start or max value or if smaller than current value to current value
	const newResources = {};
	for (const key in maxResources) {
		const refillValue = GameAgent.getRefillValue(maxResources[key]);
		const currentValue = playerCharactersGameState[playerName][key]?.current_value || 0;
		newResources[key] = {
			...maxResources[key],
			current_value: refillValue >= currentValue ? refillValue : currentValue
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
		[playerName]: updatedPlayerResources
	};

	return {
		updatedGameActionsState,
		updatedPlayerCharactersGameState
	};
}

export function initializeMissingResources(
	resources: Resources,
	playerName: string,
	gameActionsState: GameActionState[],
	playerCharactersGameState: PlayerCharactersGameState
) {
	// Check for any resources that are missing in the player's state.
	const missingResources: Resources = Object.entries(resources)
		.filter(
			([resourceKey]) =>
				playerCharactersGameState[playerName][resourceKey]?.current_value === undefined
		)
		.reduce((acc, [resourceKey, resource]) => ({ ...acc, [resourceKey]: resource }), {});
	if (Object.keys(missingResources).length > 0) {
		const { updatedGameActionsState, updatedPlayerCharactersGameState } = refillResourcesFully(
			missingResources,
			playerName,
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
