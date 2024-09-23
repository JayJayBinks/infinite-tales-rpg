import {stringifyPretty} from "../../lib/util.svelte";



export const getTargetText = function (targets) {
    return "\n I target " + targets.join(' and ')
        + "\n If this is a friendly action used on an enemy, play out the effect as described, even though the result may be unintended."
        + "\n Hostile beings stay hostile unless explicitly described otherwise by the actions effect.";
}

export enum ActionDifficulty {
    simple = 'simple',
    medium = 'medium',
    difficult = 'difficult',
    very_difficult = 'very_difficult'
}

//TODO implement parsing to enums directly from json
export function mustRollDice(action, isInCombat) {
    const difficulty: ActionDifficulty = ActionDifficulty[action.action_difficulty?.toLowerCase()];
    if (!difficulty || difficulty === ActionDifficulty.simple) {
        return false;
    }

    const actionText = action.text.toLowerCase();
    if (actionText === 'continue the tale') {
        return false;
    }

    const listOfDiceRollingActions = ['attempt', 'try', 'seek', 'search', 'investigate']
    let includesTrying = listOfDiceRollingActions.some(value => actionText.includes(value));
    if (action.type.toLowerCase() === 'social_manipulation' || action.type.toLowerCase() === 'spell') {
        return true;
    }
    return difficulty !== ActionDifficulty.medium || isInCombat || includesTrying;
}

export function renderStatUpdates(statsUpdate: Array<object>, npcList) {
    if (statsUpdate) {
        return statsUpdate.toSorted((a, b) => a.targetId < b.targetId ? -1 : 1)
            .map(statsUpdate => {
                if (statsUpdate.value == 0) {
                    return undefined;
                }
                let responseText;
                if (statsUpdate.targetId.toLowerCase() === 'player_character') {
                    responseText = 'You '
                    if (statsUpdate.value > 0) {
                        responseText += " gain " + statsUpdate.value;
                    }
                    if (statsUpdate.value < 0) {
                        responseText += " loose " + statsUpdate.value * -1;
                    }
                } else {
                    responseText = statsUpdate.targetId + " ";
                    if (statsUpdate.value > 0) {
                        responseText += " gains " + statsUpdate.value;
                    }
                    if (statsUpdate.value < 0) {
                        responseText += " looses " + statsUpdate.value * -1;
                    }
                }
                responseText += " " + statsUpdate.type.replace('_change', '').toUpperCase();
                return responseText;
            }).filter(value => !!value);
    }
    return [];
}

export function applyGameActionState(derivedGameState: object, npcState: object, state: object, prohibitNPCChange = false) {
    for (const statUpdate of (state.stats_update || [])) {
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
                const npc = npcState[statUpdate.targetId];
                if (npc) {
                    switch (statUpdate.type) {
                        case 'hp_change':
                            npc.resources.current_hp += statUpdate.value;
                            break;
                        case 'mp_change':
                            npc.resources.current_mp += statUpdate.value;
                            break;
                    }
                }
            }
        }
    }
}

export function removeDeadNPCs(npcState) {
    return Object.keys(npcState).filter(npc => npcState[npc].resources.current_hp <= 0)
        .map(deadNPC => {
            delete npcState[deadNPC];
            return deadNPC;
        });
}


export function applyGameActionStates(derivedGameState, npcState, states: Array<object>) {
    for (const state of states) {
        applyGameActionState(derivedGameState, npcState, state, true);
    }
}

export function getGameEndedMessage() {
    return "Your tale has come to an end...\\nThanks for playing Infinite Tales RPG!\\nYou can start a new tale in the menu."
}
