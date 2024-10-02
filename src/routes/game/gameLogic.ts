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

export function renderStatUpdates(statsUpdate: Array<object>) {
    if (statsUpdate) {
        return statsUpdate.toSorted((a, b) => a.targetId < b.targetId ? -1 : 1)
            .map(statsUpdate => {
                if (statsUpdate.value == 0) {
                    return undefined;
                }
                let responseText, changeText, resourceText;
                let mappedType = statsUpdate.type.replace('_change', '').toUpperCase();
                const color = mappedType.includes('HP') ? 'text-red-500' : mappedType.includes('MP') ? 'text-blue-500' : '';

                if (statsUpdate.targetId.toLowerCase() === 'player_character') {
                    responseText = 'You '
                    if (statsUpdate.value > 0) {
                        changeText = " gain ";
                        resourceText = statsUpdate.value;
                    }
                    if (statsUpdate.value < 0) {
                        changeText = " loose ";
                        resourceText = statsUpdate.value * -1;
                    }
                    if (!changeText) {
                        changeText = ' are '
                    }
                } else {
                    responseText = statsUpdate.targetId.toLowerCase().replaceAll("_", " ").replaceAll("id", "") + " ";
                    if (statsUpdate.value > 0) {
                        changeText = " gains ";
                        resourceText = statsUpdate.value;
                    }
                    if (statsUpdate.value < 0) {
                        changeText = " looses ";
                        resourceText = statsUpdate.value * -1;
                    }
                    if (!changeText) {
                        changeText = ' is '
                    }
                }
                if (statsUpdate.type === 'condition_applied') {
                    resourceText = statsUpdate.conditionId.replace(/_\d+/g, '').replaceAll("_", " ");
                    mappedType = '';
                }
                if (statsUpdate.type === 'condition_removed') {
                    changeText += 'no longer'
                    resourceText = statsUpdate.conditionId.replace(/_\d+/g, '').replaceAll("_", " ");
                    mappedType = '';
                }
                if (!resourceText) {
                    resourceText = statsUpdate.value.replaceAll("_", " ");
                }
                responseText += changeText;
                if (mappedType) resourceText += " " + mappedType;
                return {text: responseText, resourceText, color};
            }).filter(value => !!value);
    }
    return [];
}

export function tickOneRound(derivedGameState: any, npcState: any, prohibitNPCChange = false) {
    Object.keys(derivedGameState.conditions).filter(condId => derivedGameState.conditions[condId].rounds_duration <= 0)
        .forEach(expiredCondId => {
            delete derivedGameState.conditions[expiredCondId];
            console.log('Player is no longer ' + expiredCondId)
        });
    Object.keys(derivedGameState.conditions).forEach(condId => derivedGameState.conditions[condId].rounds_duration -= 1);
    //NPCs already saved, do not tick more than once
    if(!prohibitNPCChange){
        Object.keys(npcState).forEach(npcId => Object.keys(npcState[npcId].conditions)
            .filter(condId => npcState[npcId].conditions[condId].rounds_duration <= 0)
            .forEach(expiredCondId => {
                delete npcState[npcId].conditions[expiredCondId]
                console.log(npcId + ' is no longer ' + expiredCondId)
            }));
        Object.keys(npcState).forEach(npcId => Object.keys(npcState[npcId].conditions)
            .forEach(condId => npcState[npcId].conditions[condId].rounds_duration -= 1));
    }
}

export function applyStatsUpdate(derivedGameState: object, npcState: object, state: object, prohibitNPCChange = false) {
    for (const statUpdate of (state.stats_update || [])) {
        if (statUpdate.targetId.toLowerCase() === 'player_character') {
            switch (statUpdate.type) {
                case 'hp_change':
                    derivedGameState.currentHP += Number.parseInt(statUpdate.value);
                    break;
                case 'mp_change':
                    derivedGameState.currentMP += Number.parseInt(statUpdate.value);
                    break;
                case 'condition_applied':
                    derivedGameState.conditions[statUpdate.conditionId] =
                        {value: statUpdate.value, rounds_duration: statUpdate.rounds_duration};
                    break;
                case 'condition_removed':
                    delete derivedGameState.conditions[statUpdate.conditionId];
                    break;
            }
        } else {
            if (!prohibitNPCChange) {
                const npc = npcState[statUpdate.targetId];
                if (npc) {
                    switch (statUpdate.type) {
                        case 'hp_change':
                            npc.resources.current_hp += Number.parseInt(statUpdate.value);
                            break;
                        case 'mp_change':
                            npc.resources.current_mp += Number.parseInt(statUpdate.value);
                            break;
                        case 'condition_applied':
                            npc.conditions[statUpdate.conditionId] =
                                {value: statUpdate.value, rounds_duration: statUpdate.rounds_duration};
                            break;
                        case 'condition_removed':
                            delete npc.conditions[statUpdate.conditionId];
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
        //TODO because of prohibitNPCChange we can not revert actions anymore, introduce derived aswell?
        applyStatsUpdate(derivedGameState, npcState, state, true);
        tickOneRound(derivedGameState, npcState, true)
    }
}

export function getGameEndedMessage() {
    return "Your tale has come to an end...\\nThanks for playing Infinite Tales RPG!\\nYou can start a new tale in the menu."
}
