export const difficultyDiceRollModifier = {
    Easy: 4,
    Default: 0
}

export function getRequiredValue(action_difficulty: string | undefined, gameDifficulty: string) {
    let requiredValue = 0;
    if(!action_difficulty){
        return requiredValue;
    }
    switch (action_difficulty) {
        case 'simple':
            return 0;
        case 'medium':
            requiredValue = getRandomInteger(2, 9);
            break;
        case 'difficult':
            requiredValue = getRandomInteger(10, 15);
            break;
        case 'very_difficult':
            requiredValue = getRandomInteger(16, 20);
            break;
        default:
            return 0;
    }
    if(gameDifficulty){
        requiredValue -= difficultyDiceRollModifier[gameDifficulty];
    }
    return requiredValue;
}

export function getKarmaModifier(rollDifferenceHistory: Array<number>, requiredValue) {
    if (!rollDifferenceHistory || rollDifferenceHistory.length < 3) {
        return 0;
    }
    //if the last 3 rolls were negative, give some karma
    if(rollDifferenceHistory.slice(-3).filter(difference => difference < 0).length >= 3){
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

//TODO implement parsing to enums
export function mustRollDice(action, isInCombat) {
    if (action.text.toLowerCase() === 'continue the tale') {
        return false;
    }
    const difficulty = action.action_difficulty.toLowerCase();
    if (action.type.toLowerCase() === 'social_manipulation') {
        return true;
    }
    return difficulty !== 'simple' && (difficulty !== 'medium' || isInCombat);
}

export function getRandomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function renderStatUpdates(statsUpdate: object) {
    if (statsUpdate) {
        return statsUpdate.map(statsUpdate => {
            if (statsUpdate.value == 0) {
                return undefined;
            }
            let responseText;
            if (statsUpdate.value > 0) {
                responseText = "You gain " + statsUpdate.value;
            }
            if (statsUpdate.value < 0) {
                responseText = "You loose " + statsUpdate.value * -1;
            }
            responseText += " " + statsUpdate.type.replace('_change', '').toUpperCase();
            return responseText;
        }).filter(value => !!value);
    }
    return [];
}

export function applyGameActionState(derivedGameState: object, state: object) {
    for (const statUpdate of (state.stats_update || [])) {
        switch (statUpdate.type) {
            case 'hp_change':
                derivedGameState.currentHP += statUpdate.value;
                break;
            case 'mp_change':
                derivedGameState.currentMP += statUpdate.value;
                break;
        }
    }
}

export function applyGameActionStates(derivedGameState, states: Array<object>) {
    for (const state of states) {
        applyGameActionState(derivedGameState, state);
    }
}

export function getGameEndedMessage() {
    return "Your tale has come to an end...\\nThanks for playing Infinite Tales RPG!\\nYou can start a new tale in the menu."
}