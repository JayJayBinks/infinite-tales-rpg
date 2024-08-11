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
export function mustRollDice(action, is_character_in_combat) {
    return action.text.toLowerCase() !== 'continue the story' && (JSON.parse(is_character_in_combat) ||
        (action.action_difficulty.toLowerCase() !== 'none' && action.action_difficulty.toLowerCase() !== 'simple')
        || action.type.toLowerCase() === 'social_manipulation');
}

export function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}
