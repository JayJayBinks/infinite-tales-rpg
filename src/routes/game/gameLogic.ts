import {
	SLOW_STORY_PROMPT,
	type Action,
	type GameActionState,
	type InventoryUpdate,
	type PlayerCharactersGameState,
	type ResourcesWithCurrentValue,
	type Targets
} from '$lib/ai/agents/gameAgent';
import type { StatsUpdate } from '$lib/ai/agents/combatAgent';
import type { NPCState, NPCStats, Resources } from '$lib/ai/agents/characterStatsAgent';
import isPlainObject from 'lodash.isplainobject';
import { mapXP } from './levelLogic';

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

export function getAllTargetsAsList(targets: Targets) {
	if (!targets || !targets.hostile) {
		return [];
	}
	return [...targets.hostile, ...targets.neutral, ...targets.friendly];
}

export function getNewNPCs(targets: Targets, npcState: NPCState) {
	return getAllTargetsAsList(targets).filter((newNPC) => !Object.keys(npcState).includes(newNPC));
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

	const listOfDiceRollingActions = ['attempt', 'try', 'seek', 'search', 'investigate'];
	const includesTrying = listOfDiceRollingActions.some((value) => actionText.includes(value));
	if (
		action.type?.toLowerCase() === 'social_manipulation' ||
		action.type?.toLowerCase() === 'spell'
	) {
		return true;
	}
	return (
		difficulty !== ActionDifficulty.medium ||
		('' + action.is_straightforward).includes('false') ||
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
	if (!color) {
		const foundResourceEntry = Object.entries(resources).find((res) => {
			const processedKey = res[0].replaceAll('_', ' ').toUpperCase();
			return processedKey.includes(mappedType.toUpperCase());
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
	playerName: string
): (undefined | RenderedGameUpdate)[] {
	if (statsUpdates) {
		return statsUpdates
			.toSorted((a, b) => (a.targetId < b.targetId ? -1 : 1))
			.map(mapStatsUpdateToGameLogic)
			.map((statsUpdate) => {
				if (
					!statsUpdate.value?.result ||
					isPlainObject(statsUpdate.value.result) ||
					Number.parseInt(statsUpdate.value.result) === 0 ||
					statsUpdate.type === 'null'
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
						.replaceAll('_', ' ')
						.toUpperCase() || '';

				const color = getColorForStatUpdate(mappedType, resources);

				if (statsUpdate.targetId === playerName) {
					responseText = 'You ';
					if (!changeText) {
						//probably unhandled status effect
						changeText = 'are';
					}
					if (mappedType.includes('LEVEL')) {
						resourceText = '';
					} else {
						resourceText =
							'' +
							(getTakeLessDamageForManyHits(
								statsUpdates,
								Number.parseInt(statsUpdate.value.result),
								playerName
							) || resourceText);
					}
				} else {
					responseText = statsUpdate.targetId.replaceAll('_', ' ').replaceAll('id', '') + ' ';
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
	playerName: string
) {
	if (damage <= 2) {
		return damage;
	}
	const allPlayerHits = stats_update
		.filter((update) => update.targetId === playerName)
		.filter((update) => update.type === 'hp_lost');

	return Math.max(1, Math.round(damage / Math.min(3, allPlayerHits?.length || 1)));
}

export function applyGameActionState(
	playerCharactersGameState: PlayerCharactersGameState,
	npcState: NPCState,
	inventoryState,
	state: GameActionState,
	prohibitNPCChange = false
) {
	function getResourceIfPresent(resources: ResourcesWithCurrentValue, key: string) {
		let resource = resources[key];
		if (!resource) {
			resource = resources[key.toUpperCase()];
		}
		return resource;
	}

	for (const statUpdate of state.stats_update.map(mapStatsUpdateToGameLogic) || []) {
		if (playerCharactersGameState[statUpdate.targetId]) {
			if (statUpdate.type.includes('now_level')) {
				playerCharactersGameState[statUpdate.targetId].XP.current_value -=
					Number.parseInt(statUpdate.value.result) || 0;
				continue;
			}
			if (statUpdate.type === 'xp_gained') {
				playerCharactersGameState[statUpdate.targetId].XP.current_value +=
					Number.parseInt(statUpdate.value.result) || 0;
			} else {
				if (statUpdate.type.includes('_gained')) {
					const resource: string = statUpdate.type.replace('_gained', '');
					const res = getResourceIfPresent(
						playerCharactersGameState[statUpdate.targetId],
						resource
					);
					if (!res) continue;
					const gained = Number.parseInt(statUpdate.value.result) || 0;
					if ((res.current_value || 0) + gained <= res.max_value) {
						res.current_value = (res.current_value || 0) + (Number.parseInt(statUpdate.value.result) || 0);
					} else {
						res.current_value = res.max_value;
					}
				}
			}
			if (statUpdate.type.includes('_lost')) {
				const resource: string = statUpdate.type.replace('_lost', '');
				const res = getResourceIfPresent(playerCharactersGameState[statUpdate.targetId], resource);
				if (!res) continue;
				res.current_value -= Number.parseInt(statUpdate.value.result) || 0;
			}
		} else {
			if (!prohibitNPCChange) {
				const npc: NPCStats = npcState[statUpdate.targetId];
				if (npc && npc.resources) {
					switch (statUpdate.type) {
						case 'hp_gained':
							npc.resources.current_hp += Number.parseInt(statUpdate.value.result) || 0;
							break;
						case 'hp_lost':
							npc.resources.current_hp -= Number.parseInt(statUpdate.value.result) || 0;
							break;
						case 'mp_gained':
							npc.resources.current_mp += Number.parseInt(statUpdate.value.result) || 0;
							break;
						case 'mp_lost':
							npc.resources.current_mp -= Number.parseInt(statUpdate.value.result) || 0;
							break;
					}
				}
			}
		}
	}

	for (const inventoryUpdate of state.inventory_update || []) {
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

export function removeDeadNPCs(npcState: NPCState): string[] {
	return Object.keys(npcState)
		.filter((npc) => npcState[npc].resources && npcState[npc].resources.current_hp <= 0)
		.map((deadNPC) => {
			delete npcState[deadNPC];
			return deadNPC;
		});
}

export function applyGameActionStates(
	playerCharactersGameState: PlayerCharactersGameState,
	npcState: NPCState,
	inventoryState,
	states: Array<GameActionState>
) {
	for (const state of states) {
		//TODO because of prohibitNPCChange we can not revert actions anymore, introduce derived aswell?
		applyGameActionState(playerCharactersGameState, npcState, inventoryState, state, true);
	}
}

export function getGameEndedMessage() {
	return 'Your Tale has come to an end...\\nThanks for playing Infinite Tales RPG!\\nYou can start a new Tale in the menu.';
}

export function isEnoughResource(action: Action, resources: ResourcesWithCurrentValue) {
	const cost = parseInt(action.resource_cost?.cost as unknown as string) || 0;
	const resourceKey = Object.keys(resources).find((key) => key.toLowerCase() === action.resource_cost?.resource_key?.toLowerCase());
	return cost === 0 || resources[resourceKey || '']?.current_value >= cost;
}

export function addAdditionsFromActionSideeffects(action: Action, additionalStoryInput: string) {
	if ((action.is_straightforward + '').includes('false')) {
		additionalStoryInput += '\n' + SLOW_STORY_PROMPT;
	}
	const encounterString = '' + action.enemyEncounterExplanation;
	if (encounterString.includes('high') && !encounterString.includes('low')) {
		additionalStoryInput +=
			'\nenemyEncounter: ' +
			action.enemyEncounterExplanation +
			' Players take first turn, wait for their action.';
	}
	if (!additionalStoryInput.includes('sudo')) {
		additionalStoryInput +=
			'\n' + 'Before responding always review the system instructions and apply the given rules.';
	}
	return additionalStoryInput;
}