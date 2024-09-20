import {stringifyPretty} from "../../lib/util.svelte";

export const difficultyDiceRollModifier = {
    Easy: 4,
    Default: 0
}

export function getRequiredValue(action_difficulty: string | undefined, gameDifficulty: string) {
    let requiredValue = 0;
    const difficulty: ActionDifficulty = ActionDifficulty[action_difficulty?.toLowerCase()];
    switch (difficulty) {
        case ActionDifficulty.simple:
            return 0;
        case ActionDifficulty.medium:
            requiredValue = getRandomInteger(6, 10);
            break;
        case ActionDifficulty.difficult:
            requiredValue = getRandomInteger(11, 15);
            break;
        case ActionDifficulty.very_difficult:
            requiredValue = getRandomInteger(16, 20);
            break;
        default:
            return 0;
    }
    if (gameDifficulty) {
        requiredValue -= difficultyDiceRollModifier[gameDifficulty];
    }
    return requiredValue;
}

export function getKarmaModifier(rollDifferenceHistory: Array<number>, requiredValue) {
    if (!rollDifferenceHistory || rollDifferenceHistory.length < 3) {
        return 0;
    }
    //if the last 3 rolls were negative, give some karma
    if (rollDifferenceHistory.slice(-3).filter(difference => difference < 0).length >= 3) {
        return Math.ceil(requiredValue / 2);
    }
    return 0;
}

export function determineDiceRollResult(required_value, rolledValue, modifier) {
    if (!required_value || !rolledValue) {
        return undefined;
    }
    const evaluatedModifier = isNaN(Number.parseInt(modifier)) ? 0 : Number.parseInt(modifier);
    const evaluatedRolledValue = isNaN(Number.parseInt(rolledValue)) ? 0 : Number.parseInt(rolledValue);
    const evaluatedValue = evaluatedRolledValue + evaluatedModifier;
    if (rolledValue === 1) {
        return 'The action is a critical failure!';
    }
    if (rolledValue === 20) {
        return 'The action is a critical success!';
    }
    const diff = evaluatedValue - required_value;
    if (diff <= -6) {
        return 'The action is a major failure.';
    }
    if (diff <= -3) {
        return 'The action is a regular failure.';
    }
    if (diff <= -1) {
        return 'The action is a partial failure.';
    }
    if (diff >= 6) {
        return 'The action is a major success.';
    }
    if (diff >= 0) {
        return 'The action is a regular success.';
    }
    //Error fallback (e.g. '10 to 14')
    return `Determine the action outcome with a rolled value of ${evaluatedValue} and required value of ${required_value}`
}

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

export function getRandomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTargetStatUpdateText(targetId, npcList) {
    switch (targetId) {
        case 'self':
            return 'You '
        default:
            return npcList[targetId].name + " ";
    }
}

export function renderStatUpdates(statsUpdate: Array<object>, npcList) {
    if (statsUpdate) {
        return statsUpdate.toSorted((a, b) => a.targetId < b.targetId ? -1 : 1)
            .map(statsUpdate => {
                if (statsUpdate.value == 0) {
                    return undefined;
                }
                let responseText;
                if (statsUpdate.targetId.toLowerCase() === 'self') {
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
        if (statUpdate.targetId.toLowerCase() === 'self') {
            switch (statUpdate.type) {
                case 'hp_change':
                    derivedGameState.currentHP += statUpdate.value;
                    break;
                case 'mp_change':
                    derivedGameState.currentMP += statUpdate.value;
                    break;
            }
        } else {
            if (!prohibitNPCChange) {
                const npc = npcState[statUpdate.targetId];
                if (npc) {
                    switch (statUpdate.type) {
                        case 'hp_change':
                            npc.resources.CURRENT_HP += statUpdate.value;
                            break;
                        case 'mp_change':
                            npc.resources.CURRENT_MP += statUpdate.value;
                            break;
                    }
                }
            }
        }
    }
}

export function removeDeadNPCs(npcState) {
    return Object.keys(npcState).filter(npc => npcState[npc].resources.CURRENT_HP < 0)
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
