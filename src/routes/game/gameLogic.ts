import type {
	Action,
	DerivedGameState,
	GameActionState,
	InventoryUpdate,
	Targets
} from '$lib/ai/agents/gameAgent';
import type { StatsUpdate } from '$lib/ai/agents/combatAgent';
import type { NPCState, NPCStats } from '$lib/ai/agents/characterStatsAgent';

export enum ActionDifficulty {
	simple = 'simple',
	medium = 'medium',
	difficult = 'difficult',
	very_difficult = 'very_difficult'
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
	return difficulty !== ActionDifficulty.medium || isInCombat || includesTrying;
}

export const getTargetPromptAddition = function (targets: string[]) {
	return (
		'\n I target ' +
		targets.join(' and ') +
		'\n If this is a friendly action used on an enemy, play out the effect as described, even though the result may be unintended.' +
		'\n Hostile beings stay hostile unless explicitly described otherwise by the actions effect.'
	);
};

export function formatItemId(item_id: string) {
	return item_id.replaceAll('_id', '').replaceAll('_', ' ');
}

export type RenderedGameUpdate = { text: string; resourceText: string; color: string };
export function renderStatUpdates(statsUpdate: Array<StatsUpdate>): Array<RenderedGameUpdate> {
	if (statsUpdate) {
		return statsUpdate
			.toSorted((a, b) => (a.targetId < b.targetId ? -1 : 1))
			.map((statsUpdate) => {
				if (Number.parseInt(statsUpdate.value.result) === 0) {
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
						?.replace('gained', '')
						.replace('lost', '')
						.replaceAll('_', ' ')
						.toUpperCase() || '';
				const color = mappedType.includes('HP')
					? 'text-red-500'
					: mappedType.includes('MP')
						? 'text-blue-500'
						: '';

				if (statsUpdate.targetId.toLowerCase() === 'player_character') {
					responseText = 'You ';
					if (!changeText) {
						//probably unhandled status effect
						changeText = 'are';
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
): Array<RenderedGameUpdate> {
	if (inventoryUpdate) {
		return inventoryUpdate
			.toSorted((a, b) => (a.type < b.type ? -1 : 1))
			.map((inventoryUpdate) => {
				const mappedId = formatItemId(inventoryUpdate.item_id);
				let text = '';
				const color = 'text-yellow-500',
					resourceText = mappedId;
				if (inventoryUpdate.type === 'add_item') {
					text = 'You gain ';
				}
				if (inventoryUpdate.type === 'remove_item') {
					text = 'You loose ';
				}
				return { text, resourceText, color };
			})
			.filter((value) => !!value);
	}
	return [];
}

export function applyGameActionState(
	derivedGameState: DerivedGameState,
	npcState: NPCState,
	inventoryState,
	state: GameActionState,
	prohibitNPCChange = false
) {
	for (const statUpdate of state.stats_update || []) {
		if (statUpdate.targetId.toLowerCase() === 'player_character') {
			switch (statUpdate.type) {
				case 'hp_gained':
					derivedGameState.currentHP += Number.parseInt(statUpdate.value.result);
					break;
				case 'hp_lost':
					derivedGameState.currentHP -= Number.parseInt(statUpdate.value.result);
					break;
				case 'mp_gained':
					derivedGameState.currentMP += Number.parseInt(statUpdate.value.result);
					break;
				case 'mp_lost':
					derivedGameState.currentMP -= Number.parseInt(statUpdate.value.result);
					break;
			}
		} else {
			if (!prohibitNPCChange) {
				const npc: NPCStats = npcState[statUpdate.targetId];
				if (npc && npc.resources) {
					switch (statUpdate.type) {
						case 'hp_gained':
							npc.resources.current_hp += Number.parseInt(statUpdate.value.result);
							break;
						case 'hp_lost':
							npc.resources.current_hp -= Number.parseInt(statUpdate.value.result);
							break;
						case 'mp_gained':
							npc.resources.current_mp += Number.parseInt(statUpdate.value.result);
							break;
						case 'mp_lost':
							npc.resources.current_mp -= Number.parseInt(statUpdate.value.result);
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
	derivedGameState: DerivedGameState,
	npcState: NPCState,
	inventoryState,
	states: Array<GameActionState>
) {
	for (const state of states) {
		//TODO because of prohibitNPCChange we can not revert actions anymore, introduce derived aswell?
		applyGameActionState(derivedGameState, npcState, inventoryState, state, true);
	}
}

export function getGameEndedMessage() {
	return 'Your Tale has come to an end...\\nThanks for playing Infinite Tales RPG!\\nYou can start a new Tale in the menu.';
}
