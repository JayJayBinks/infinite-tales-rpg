import type { CharacterChangedInto } from '$lib/ai/agents/eventAgent';
import { CharacterAgent, type CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { CharacterStats, CharacterStatsAgent } from '$lib/ai/agents/characterStatsAgent';
import type { Story } from '$lib/ai/agents/storyAgent';
import type { Action } from '$lib/ai/agents/gameAgent';
import type { DiceRollResult } from '$lib/components/interaction_modals/diceRollLogic';
import { ActionDifficulty } from './gameLogic';

export async function applyCharacterChange(
	gameEvent: CharacterChangedInto,
	story: Story,
	oldDescription: CharacterDescription,
	oldStats: CharacterStats,
	characterAgent: CharacterAgent,
	characterStatsAgent: CharacterStatsAgent
): Promise<{
	transformedCharacter?: CharacterDescription;
	transformedCharacterStats?: CharacterStats;
}> {
	const changeIntoString = gameEvent.changed_into + '; ' + gameEvent.description;
	const transformedCharacter = await characterAgent.generateCharacterDescription(
		story,
		oldDescription,
		changeIntoString
	);
	let transformedCharacterStats: CharacterStats | undefined = undefined;
	if (transformedCharacter) {
		transformedCharacterStats = await characterStatsAgent.generateCharacterStats(
			story,
			transformedCharacter,
			oldStats,
			changeIntoString
		);
		if (transformedCharacterStats) {
			//ensure abilities from old array do not have same name as from new; if yes remove from old array
			const oldAbilitiesToKeep = oldStats.spells_and_abilities.filter(
				(a1) => !transformedCharacterStats!.spells_and_abilities.some((a2) => a2.name === a1.name)
			);
			//old resource might not exist anymore, tell player to remap manually
			oldAbilitiesToKeep
				.filter(
					(a) =>
						transformedCharacterStats!.resources[a.resource_cost?.resource_key || ''] === undefined
				)
				.forEach((a) => (a.resource_cost.resource_key = undefined));

			const newAbilities = [
				...transformedCharacterStats!.spells_and_abilities,
				...oldAbilitiesToKeep
			];
			transformedCharacterStats = {
				...oldStats,
				...transformedCharacterStats,
				spells_and_abilities: newAbilities
			};
		}
	}
	return { transformedCharacter, transformedCharacterStats };
}

export function getSkillIfApplicable(stats: CharacterStats, action: Action): string | undefined {
	const skill = action.related_skill;
	if (!skill || skill === 'N/A') return undefined;
	const existingSkill = Object.keys(stats.skills).some(
		(s) => s.toLowerCase() === skill.toLowerCase()
	);
	const isAttribute = Object.keys(stats.attributes).some(
		(a) => a.toLowerCase() === skill.toLowerCase()
	);
	if (!existingSkill && !isAttribute) {
		console.log('Adding skill', skill);
		return skill;
	}
	return undefined;
}

//number of succesfull actions required to raise skill by one
const requiredSkillProgression = {
	0: 10,
	1: 20,
	2: 30,
	3: 40,
	4: 50,
	5: 60,
	7: 80,
	8: 90,
	9: 100,
	10: undefined
};

export function getRequiredSkillProgression(
	skill: string,
	stats: CharacterStats
): number | undefined {
	const currentSkill = stats.skills[skill] || 0;
	const lookUp = currentSkill < 0 ? currentSkill * -1 : currentSkill;
	return requiredSkillProgression[lookUp] || undefined;
}

export function getSkillProgressionForDiceRoll(diceRollResult: DiceRollResult): number {
	switch (diceRollResult) {
		case 'critical_failure':
			return -1;
		case 'critical_success':
			return 3;
		case 'major_failure':
			return 0;
		case 'regular_failure':
			return 0;
		case 'partial_failure':
			return 0;
		case 'major_success':
			return 2;
		case 'regular_success':
			return 1;
	}
	return 0;
}

export function getSkillProgressionForDifficulty(actionDifficulty: ActionDifficulty): number {
	switch (actionDifficulty) {
		case ActionDifficulty.medium:
			return 1;
		case ActionDifficulty.difficult:
			return 2;
		case ActionDifficulty.very_difficult:
			return 3;
	}
	return 0;
}
