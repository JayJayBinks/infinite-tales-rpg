import { getRandomInteger } from '$lib/util.svelte';
import { ActionDifficulty } from '../../../routes/game/gameLogic';

export const difficultyDiceRollModifier = {
	Easy: 4,
	Default: 0
};

export function getRequiredValue(
	action_difficulty: string | undefined,
	gameDifficulty: string
): number {
	let requiredValue = 0;
	const difficulty: ActionDifficulty =
		ActionDifficulty[action_difficulty?.toLowerCase() || 'medium'];
	switch (difficulty) {
		case ActionDifficulty.simple:
			return 0;
		case ActionDifficulty.medium:
			requiredValue = getRandomInteger(7, 11);
			break;
		case ActionDifficulty.difficult:
			requiredValue = getRandomInteger(12, 15);
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

export function getKarmaModifier(
	rollDifferenceHistory: Array<number>,
	requiredValue: number
): number {
	if (!rollDifferenceHistory || rollDifferenceHistory.length < 3) {
		return 0;
	}
	//if the last 3 rolls were negative, give some karma
	if (rollDifferenceHistory.slice(-3).filter((difference) => difference < 0).length >= 3) {
		return Math.ceil(requiredValue / 2);
	}
	return 0;
}

export function determineDiceRollResult(
	required_value: number,
	rolledValue,
	modifier
): string | undefined {
	if (!required_value || !rolledValue) {
		return undefined;
	}
	const evaluatedModifier = isNaN(Number.parseInt(modifier)) ? 0 : Number.parseInt(modifier);
	const evaluatedRolledValue = isNaN(Number.parseInt(rolledValue))
		? 0
		: Number.parseInt(rolledValue);
	const evaluatedValue = evaluatedRolledValue + evaluatedModifier;
	if (evaluatedRolledValue === 1) {
		return 'The action is a critical failure!';
	}
	if (evaluatedRolledValue === 20) {
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
	return `Determine the action outcome with a rolled value of ${evaluatedValue} and required value of ${required_value}`;
}
