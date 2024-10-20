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
				if (statsUpdate.value == 0) {
					return undefined;
				}
				let responseText, changeText, resourceText;
				const mappedType = statsUpdate.type?.replace('_change', '').toUpperCase() || '';
				const color = mappedType.includes('HP')
					? 'text-red-500'
					: mappedType.includes('MP')
						? 'text-blue-500'
						: '';

				if (statsUpdate.targetId.toLowerCase() === 'player_character') {
					responseText = 'You ';
					if (statsUpdate.value > 0) {
						changeText = ' gain ';
						resourceText = statsUpdate.value;
					}
					if (statsUpdate.value < 0) {
						changeText = ' loose ';
						resourceText = statsUpdate.value * -1;
					}
					if (!changeText) {
						changeText = ' are ';
					}
				} else {
					responseText = statsUpdate.targetId.replaceAll('_', ' ').replaceAll('id', '') + ' ';
					if (statsUpdate.value > 0) {
						changeText = ' gains ';
						resourceText = statsUpdate.value;
					}
					if (statsUpdate.value < 0) {
						changeText = ' looses ';
						resourceText = statsUpdate.value * -1;
					}
					if (!changeText) {
						changeText = ' is ';
					}
				}
				if (!resourceText) {
					resourceText = statsUpdate.value?.replaceAll('_', ' ');
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
				case 'hp_change':
					derivedGameState.currentHP += Number.parseInt(statUpdate.value);
					break;
				case 'mp_change':
					derivedGameState.currentMP += Number.parseInt(statUpdate.value);
					break;
			}
		} else {
			if (!prohibitNPCChange) {
				const npc: NPCStats = npcState[statUpdate.targetId];
				if (npc) {
					switch (statUpdate.type) {
						case 'hp_change':
							if (npc.resources) {
								npc.resources.current_hp += Number.parseInt(statUpdate.value);
							}
							break;
						case 'mp_change':
							if (npc.resources) {
								npc.resources.current_mp += Number.parseInt(statUpdate.value);
							}
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
				//TODO for some reason we cannot directly change only if we pass real state instead value proxy
				inventoryState[inventoryUpdate.item_id] =  inventoryUpdate.item_added;
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
