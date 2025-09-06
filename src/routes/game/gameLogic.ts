import {
	type Action,
	type GameActionState,
	type InventoryState,
	type InventoryUpdate,
	type PlayerCharactersGameState,
	type PlayerCharactersIdToNamesMap,
	type RandomEventsHandling,
	type ResourcesWithCurrentValue,
	SLOW_STORY_PROMPT,
	type Targets
} from '$lib/ai/agents/gameAgent';
import type { StatsUpdate } from '$lib/ai/agents/combatAgent';
import type { NpcID, NPCState, NPCStats } from '$lib/ai/agents/characterStatsAgent';
import isPlainObject from 'lodash.isplainobject';
import { mapXP } from './levelLogic';
import { getNPCTechnicalID } from '$lib/util.svelte';
import { getCharacterTechnicalId } from './characterLogic';
import { InterruptProbability } from '$lib/ai/agents/actionAgent';
import type { DiceRollResult } from '$lib/components/interaction_modals/dice/diceRollLogic';

export enum ActionDifficulty {
	simple = 'simple',
	medium = 'medium',
	difficult = 'difficult',
	very_difficult = 'very_difficult'
}

export function getEmptyCriticalResourceKeys(resources: ResourcesWithCurrentValue): string[] {
	return Object.entries(resources)
		.filter((entry) => entry[1].game_ends_when_zero && entry[1].current_value <= 0)
		.map((entry) => entry[0]);
}

export function getAllTargetsAsList(targets: Targets): Array<string> {
	if (!targets || !targets.hostile) {
		return [];
	}
	return [
		...targets.hostile.map(getNPCTechnicalID),
		...targets.neutral.map(getNPCTechnicalID),
		...targets.friendly.map(getNPCTechnicalID)
	];
}

export function getAllNpcsIds(targets: Targets): Array<NpcID> {
	if (!targets || !targets.hostile) {
		return [];
	}
	return [...targets.hostile, ...targets.neutral, ...targets.friendly];
}

export function getNewNPCs(targets: Targets, npcState: NPCState) {
	return getAllNpcsIds(targets).filter(
		(newNPC) => !Object.keys(npcState).includes(newNPC.uniqueTechnicalNameId)
	);
}

//TODO implement parsing to enums directly from json
export function mustRollDice(action: Action, isInCombat?: boolean) {
	const difficulty: ActionDifficulty =
		ActionDifficulty[action.action_difficulty?.toLowerCase() || ''];
	if (!difficulty || difficulty === ActionDifficulty.simple) {
		return false;
	}

	const actionText = action.text.toLowerCase();
	if (actionText === 'continue the tale') {
		return false;
	}

	//TODO this only works for english but can stay for now
	const listOfDiceRollingActions = ['attempt', 'try', 'seek', 'search', 'investigate'];
	const includesTrying = listOfDiceRollingActions.some((value) => actionText.includes(value));
	if (
		action.type?.toLowerCase() === 'social_manipulation' ||
		action.type?.toLowerCase() === 'spell' ||
		action.type?.toLowerCase() === 'investigation'
	) {
		return true;
	}
	return (
		difficulty !== ActionDifficulty.medium ||
		('' + action.narration_details).includes('HIGH') ||
		isInCombat ||
		includesTrying
	);
}

export const getTargetPromptAddition = function (targets: string[]) {
	return '\n I target ' + targets.join(' and ');
};

export function formatItemId(item_id: string) {
	return item_id.replaceAll('_id', '').replaceAll('_', ' ');
}

export type RenderedGameUpdate = { text: string; resourceText: string; color: string };

export function mapStatsUpdateToGameLogic(statsUpdate: StatsUpdate): StatsUpdate {
	if (statsUpdate.type.toUpperCase().includes('XP')) {
		mapXP(statsUpdate);
	}
	return statsUpdate;
}

function getColorForStatUpdate(mappedType: string, resources: ResourcesWithCurrentValue) {
	let color = '';
	if (mappedType.includes('XP')) color = 'text-green-500';
	if (mappedType.includes('HP')) color = 'text-red-500';
	if (mappedType.includes('MP')) color = 'text-blue-500';
	if (mappedType.includes('LEVEL')) color = 'text-green-500';
	if (mappedType.includes('SKILL')) color = 'text-green-500';
	if (!color) {
		const foundResourceEntry = Object.entries(resources).find((res) => {
			const processedKey = res[0]?.replaceAll('_', ' ').toUpperCase();
			return processedKey?.includes(mappedType.toUpperCase());
		});

		const foundResourceValue = foundResourceEntry ? foundResourceEntry[1] : undefined;
		if (foundResourceValue) {
			color = foundResourceValue.game_ends_when_zero ? 'text-red-500' : 'text-blue-500';
		}
	}
	return color;
}

export function renderStatUpdates(
	statsUpdates: Array<StatsUpdate>,
	resources: ResourcesWithCurrentValue,
	playerNames: Array<string>
): (undefined | RenderedGameUpdate)[] {
	if (statsUpdates) {
		return statsUpdates
			.toSorted((a, b) => (a.targetName < b.targetName ? -1 : 1))
			.map(mapStatsUpdateToGameLogic)
			.map((statsUpdate) => {
				if (
					!statsUpdate.value?.result ||
					isPlainObject(statsUpdate.value.result) ||
					Number.parseInt(statsUpdate.value.result) <= 0 ||
					statsUpdate.type === 'null' ||
					statsUpdate.type === 'none'
				) {
					return undefined;
				}
				let responseText: string;
				let resourceText = ('' + statsUpdate.value.result).replaceAll('_', ' ');
				let changeText = statsUpdate.type?.includes('_gained')
					? 'gain'
					: statsUpdate.type?.includes('_lost')
						? 'loose'
						: undefined;

				const mappedType =
					statsUpdate.type
						?.replace('_gained', '')
						.replace('_lost', '')
						.replace('_increased', '')
						.replaceAll('_', ' ')
						.toUpperCase() || '';

				const color = getColorForStatUpdate(mappedType, resources);

				if (playerNames.includes(statsUpdate.targetName)) {
					responseText = 'You ';
					if (!changeText) {
						//probably unhandled status effect
						changeText = 'are';
					}
					if (mappedType.includes('LEVEL')) {
						resourceText = '';
					}
					if (!mappedType.includes('XP')) {
						resourceText =
							'' +
							(getTakeLessDamageForManyHits(
								statsUpdates,
								Number.parseInt(statsUpdate.value.result),
								playerNames
							) || resourceText);
					}
				} else {
					responseText =
						statsUpdate.targetName?.replaceAll('_', ' ').replaceAll('id', '') + ' ' || '';
					if (!changeText) {
						//probably unhandled status effect
						changeText = 'is';
					} else {
						//third person
						changeText += 's';
					}
				}
				responseText += changeText;
				resourceText += ' ' + mappedType;
				return { text: responseText, resourceText, color };
			})
			.filter((value) => !!value);
	}
	return [];
}

export function renderInventoryUpdate(
	inventoryUpdate: Array<InventoryUpdate>
): Array<undefined | RenderedGameUpdate> {
	if (inventoryUpdate) {
		return inventoryUpdate
			.toSorted((a, b) => (a.type < b.type ? -1 : 1))
			.map((inventoryUpdate) => {
				const mappedId = formatItemId(inventoryUpdate.item_id);
				let text = '',
					resourceText = mappedId;
				const color = 'text-yellow-500';
				if (inventoryUpdate.type === 'add_item') {
					text = 'You gain ';
				}
				if (inventoryUpdate.type === 'remove_item') {
					text = 'You loose ';
				}
				if (!text) {
					text = 'Unidentified item update:';
					resourceText = JSON.stringify(inventoryUpdate);
				}
				return { text, resourceText, color };
			})
			.filter((value) => !!value);
	}
	return [];
}

//TODO too difficult if too many hits
function getTakeLessDamageForManyHits(
	stats_update: Array<StatsUpdate>,
	damage: number,
	playerNames: Array<string>
) {
	if (damage <= 2) {
		return damage;
	}
	const allPlayerHits = stats_update
		.filter((update) => playerNames.includes(update.targetName))
		.filter((update) => update.type === 'hp_lost');

	return Math.max(1, Math.round(damage / Math.min(3, allPlayerHits?.length || 1)));
}

export function applyGameActionState(
	playerCharactersGameState: PlayerCharactersGameState,
	playerCharactersIdToNamesMapState: PlayerCharactersIdToNamesMap,
	npcState: NPCState,
	inventoryState: InventoryState,
	state: GameActionState,
	prohibitNPCChange = false
) {
	function getResourceIfPresent(resources: ResourcesWithCurrentValue, key: string) {
		let resource = resources[key];
		if (!resource) {
			resource = resources[key.toUpperCase()];
			if (!resource) {
				resource = resources[key.charAt(0).toUpperCase() + key.substring(1).toLowerCase()];
			}
		}
		return resource;
	}

	for (const statUpdate of state?.stats_update?.map(mapStatsUpdateToGameLogic) || []) {
		const characterId =
			getCharacterTechnicalId(playerCharactersIdToNamesMapState, statUpdate.targetName) || '';
		if (playerCharactersGameState[characterId]) {
			const updateResourceValue = Number.parseInt(statUpdate.value.result) || 0;
			if (statUpdate.type.includes('now_level')) {
				playerCharactersGameState[characterId].XP.current_value -= updateResourceValue;
				continue;
			}
			if (statUpdate.type === 'xp_gained') {
				playerCharactersGameState[characterId].XP.current_value += updateResourceValue;
			} else {
				if (statUpdate.type.includes('_gained')) {
					const resource: string = statUpdate.type.replace('_gained', '');
					const res = getResourceIfPresent(playerCharactersGameState[characterId], resource);
					if (!res) continue;
					let gained = updateResourceValue;
					gained = gained > 0 ? gained : 0;
					if ((res.current_value || 0) + gained <= res.max_value) {
						res.current_value = (res.current_value || 0) + gained;
					} else {
						res.current_value = res.max_value;
					}
				}
			}
			if (statUpdate.type.includes('_lost')) {
				const resource: string = statUpdate.type.replace('_lost', '');
				const res = getResourceIfPresent(playerCharactersGameState[characterId], resource);
				if (!res) continue;
				let lost = updateResourceValue;
				lost = lost > 0 ? lost : 0;
				res.current_value -= lost;
			}
		} else {
			if (!prohibitNPCChange) {
				let npc: NPCStats | undefined = Object.values(npcState).find((npc) =>
					npc.known_names?.includes(statUpdate.targetName)
				);
				if (!npc) {
					npc = npcState[statUpdate.targetName];
				}
				if (npc && npc.resources) {
					const result = Number.parseInt(statUpdate.value.result);
					switch (statUpdate.type) {
						case 'hp_gained':
							npc.resources.current_hp += result > 0 ? result : 0;
							break;
						case 'hp_lost':
							npc.resources.current_hp -= result > 0 ? result : 0;
							break;
						case 'mp_gained':
							npc.resources.current_mp += result > 0 ? result : 0;
							break;
						case 'mp_lost':
							npc.resources.current_mp -= result > 0 ? result : 0;
							break;
					}
				}
			}
		}
	}

	applyInventoryUpdate(inventoryState, state);
}

export function applyInventoryUpdate(inventoryState: InventoryState, state: GameActionState) {
	for (const inventoryUpdate of state?.inventory_update || []) {
		if (inventoryUpdate.type === 'remove_item') {
			delete inventoryState[inventoryUpdate.item_id];
		}
		if (inventoryUpdate.type === 'add_item') {
			if (inventoryUpdate.item_added) {
				inventoryState[inventoryUpdate.item_id] = inventoryUpdate.item_added;
			} else {
				console.error('item_added with no item', JSON.stringify(inventoryUpdate));
			}
		}
	}
}

export function applyGameActionStates(
	playerCharactersGameState: PlayerCharactersGameState,
	playerCharactersIdToNamesMapState: PlayerCharactersIdToNamesMap,
	npcState: NPCState,
	inventoryState,
	states: Array<GameActionState>
) {
	for (const state of states) {
		//TODO because of prohibitNPCChange we can not revert actions anymore, introduce derived aswell?
		applyGameActionState(
			playerCharactersGameState,
			playerCharactersIdToNamesMapState,
			npcState,
			inventoryState,
			state,
			true
		);
	}
}

export function getGameEndedMessage() {
	return 'Your Tale has come to an end...\\nThanks for playing Infinite Tales RPG!\\nYou can start a new Tale in the menu.';
}

export function isEnoughResource(
	action: Action,
	resources: ResourcesWithCurrentValue,
	inventory: InventoryState
): boolean {
	const cost = parseInt(action.resource_cost?.cost as unknown as string) || 0;
	if (cost === 0) {
		return true;
	}
	const resourceKey = Object.keys(resources).find(
		(key) => key.toLowerCase() === action.resource_cost?.resource_key?.toLowerCase()
	);
	let inventoryKey: string | undefined = undefined;
	if (!resourceKey) {
		inventoryKey = Object.keys(inventory).find(
			(key) => key.toLowerCase() === action.resource_cost?.resource_key?.toLowerCase()
		);
		return !!inventoryKey;
	}
	return resources[resourceKey || '']?.current_value >= cost;
}

export function addAdditionsFromActionSideeffects(
	action: Action,
	additionalStoryInput: string,
	randomEventsHandling: RandomEventsHandling,
	is_character_in_combat: boolean,
	diceRollResult: DiceRollResult
) {
	const is_travel = action.type?.toLowerCase().includes('travel');
	const narration_details = JSON.stringify(action.narration_details) || '';
	if (is_travel || narration_details.includes('HIGH') || narration_details.includes('MEDIUM')) {
		additionalStoryInput += '\n' + SLOW_STORY_PROMPT;
	}
	const encounterString = JSON.stringify(action.enemyEncounterExplanation) || '';
	if (!is_character_in_combat && encounterString.includes('HIGH') && !encounterString.includes('LOW')) {
		additionalStoryInput += '\nenemyEncounter: ' + encounterString;
	}

	if (randomEventsHandling !== 'none' && diceRollResult !== 'critical_success') {
		const is_interruptible = JSON.stringify(action.is_interruptible) || '';
		const probabilityEnum = getProbabilityEnum(is_interruptible);
		const directly_interrupted =
			probabilityEnum === InterruptProbability.ALWAYS || InterruptProbability.HIGH;
		const travel_interrupted = is_travel && probabilityEnum === InterruptProbability.MEDIUM;

		if (randomEventsHandling === 'ai_decides') {
			if (directly_interrupted || travel_interrupted) {
				additionalStoryInput += `\naction is possibly interrupted: ${is_interruptible} probability.`;
			}
		}
		if (randomEventsHandling === 'probability') {
			//combat is already long enough, dont interrupt often
			const modifier = is_character_in_combat ? 0.5 : 1;
			const randomEventCreated = isRandomEventCreated(probabilityEnum, modifier);
			console.log('randomEventCreated', randomEventCreated);
			if (randomEventCreated) {
				additionalStoryInput += `\naction definitely must be interrupted: ${action.is_interruptible?.reasoning}`;
			}
		}
	}
	return additionalStoryInput;
}

function getProbabilityEnum(probability: string) {
	if (probability.includes('ALWAYS')) {
		return InterruptProbability.ALWAYS;
	}
	if (probability.includes('LOW')) {
		return InterruptProbability.LOW;
	}
	if (probability.includes('MEDIUM')) {
		return InterruptProbability.MEDIUM;
	}
	if (probability.includes('HIGH')) {
		return InterruptProbability.HIGH;
	}
	return InterruptProbability.NEVER;
}

export function isRandomEventCreated(probEnum: InterruptProbability, modifier = 1) {
	const randomEventValue = Math.random();
	console.log('randomEventValue', randomEventValue, probEnum, 'modifier', modifier);
	switch (probEnum) {
		case InterruptProbability.NEVER:
			return false;
		case InterruptProbability.LOW:
			return randomEventValue < 0.05 * modifier;
		case InterruptProbability.MEDIUM:
			return randomEventValue < 0.2 * modifier;
		case InterruptProbability.HIGH:
			return randomEventValue < 0.35 * modifier;
		case InterruptProbability.ALWAYS:
			return true;
		default:
			return false;
	}
}

export const utilityPlayerActions = [
	{
		label: 'Short Rest',
		value: 'short-rest'
	},
	{
		label: 'Long Rest',
		value: 'long-rest'
	}
];

// Build or merge into the game actions array depending on gameStateUpdateOnly.
export const mergeUpdatedGameActions = (
	newState: GameActionState,
	existingActions: GameActionState[],
	gameStateUpdateOnly: boolean
): GameActionState[] => {
	const updatedGameActions: GameActionState[] = [...existingActions];

	// If we should append new action as a separate action
	if (!gameStateUpdateOnly) {
		const newAction: GameActionState = { ...newState, id: updatedGameActions.length };
		updatedGameActions.push(newAction);
		return updatedGameActions;
	}

	// Merge into last action when doing a game-state-only update
	if (updatedGameActions.length === 0) {
		updatedGameActions.push({ ...newState, id: 0 });
		return updatedGameActions;
	}

	const lastIndex = updatedGameActions.length - 1;
	const lastAction = updatedGameActions[lastIndex];

	const mergedAction: GameActionState = {
		...lastAction,
		stats_update: [...(lastAction.stats_update ?? []), ...(newState.stats_update ?? [])],
		inventory_update: [...(lastAction.inventory_update ?? []), ...(newState.inventory_update ?? [])]
	};

	updatedGameActions[lastIndex] = mergedAction;
	return updatedGameActions;
};
