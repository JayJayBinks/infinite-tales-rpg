import { getRandomInteger } from '$lib/util.svelte';
import { ActionDifficulty } from '../../../../routes/game/gameLogic';

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
			requiredValue = getRandomInteger(8, 13);
			break;
		case ActionDifficulty.difficult:
			requiredValue = getRandomInteger(14, 17);
			break;
		case ActionDifficulty.very_difficult:
			requiredValue = getRandomInteger(17, 20);
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

export type DiceRollResult =
	| 'critical_failure'
	| 'critical_success'
	| 'major_failure'
	| 'regular_failure'
	| 'partial_failure'
	| 'major_success'
	| 'regular_success';

export function determineDiceRollResult(
	required_value: number,
	rolledValue,
	modifier
): DiceRollResult | undefined {
	if (!required_value || !rolledValue) {
		return undefined;
	}
	const evaluatedModifier = isNaN(Number.parseInt(modifier)) ? 0 : Number.parseInt(modifier);
	const evaluatedRolledValue = isNaN(Number.parseInt(rolledValue))
		? 0
		: Number.parseInt(rolledValue);
	const evaluatedValue = evaluatedRolledValue + evaluatedModifier;
	if (evaluatedRolledValue === 1) {
		return 'critical_failure';
	}
	if (evaluatedRolledValue === 20) {
		return 'critical_success';
	}
	const diff = evaluatedValue - required_value;
	if (diff <= -6) {
		return 'major_failure';
	}
	if (diff <= -3) {
		return 'regular_failure';
	}
	if (diff <= -1) {
		return 'partial_failure';
	}
	if (diff >= 6) {
		return 'major_success';
	}
	if (diff >= 0) {
		return 'regular_success';
	}
	return undefined;
}

export const getDiceRollPromptAddition = (result: DiceRollResult | undefined) => {
	if (result === 'critical_failure') {
		return 'The player action is a critical failure!';
	}
	if (result === 'critical_success') {
		return 'The player action is a critical success!';
	}
	if (result === 'major_failure') {
		return 'The player action is a major failure.';
	}
	if (result === 'regular_failure') {
		return 'The player action is a regular failure.';
	}
	if (result === 'partial_failure') {
		return 'The player action is a partial failure.';
	}
	if (result === 'major_success') {
		return 'The player action is a major success.';
	}
	if (result === 'regular_success') {
		return 'The player action is a regular success.';
	}

	return '';
};
