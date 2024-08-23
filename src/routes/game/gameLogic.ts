export const difficultyDiceRollModifier = {
    Easy: 4,
    Default: 0
}

export function getStartingPrompt() {
    return 'With you as the Game Master, start the ADVENTURE_AND_MAIN_EVENT ' +
        'with introducing the adventure background, characters and circumstances. Then describe the starting scene.' +
        '  At the beginning do not disclose story secrets, which are meant to be discovered by the player later into the story.' +
        ' CHARACTER starts with some random items.'
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

export function determineDiceRollResult(action, rolledValue, modifier) {
    if (!action.dice_roll || !rolledValue) {
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
    const diff = evaluatedValue - action.dice_roll.required_value;
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
    return `Determine the action outcome with a rolled value of ${evaluatedValue} and required value of ${action.dice_roll.required_value}`
}

//TODO implement parsing to enums
export function mustRollDice(action) {
    if (action.text.toLowerCase() === 'continue the tale') {
        return false;
    }
    const difficulty = action.action_difficulty.toLowerCase();
    if (action.type.toLowerCase() === 'social_manipulation') {
        return true;
    }
    return difficulty !== 'none' && difficulty !== 'simple';
}

export function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
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