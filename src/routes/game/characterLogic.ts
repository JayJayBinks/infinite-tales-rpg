import type { CharacterChangedInto } from '$lib/ai/agents/eventAgent';
import { CharacterAgent, type CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { CharacterStats, CharacterStatsAgent } from '$lib/ai/agents/characterStatsAgent';
import type { Story } from '$lib/ai/agents/storyAgent';

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
