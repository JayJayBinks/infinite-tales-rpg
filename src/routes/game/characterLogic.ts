import type { CharacterChangedInto } from '$lib/ai/agents/eventAgent';
import { CharacterAgent, type CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { CharacterStats, CharacterStatsAgent } from '$lib/ai/agents/characterStatsAgent';
import type { Story } from '$lib/ai/agents/storyAgent';
import type { Action, PlayerCharactersIdToNamesMap } from '$lib/ai/agents/gameAgent';
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
			true,
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

function hasCaseInsensitiveKey(obj: Record<string, any>, key: string): boolean {
	// Ensure key is a non-empty string before proceeding
	if (!key) return false;
	const lowerKey = key.toLowerCase();
	return Object.keys(obj).some((k) => k.toLowerCase() === lowerKey);
}

interface SkillCheckResult {
	skill: string | undefined;
	isAttribute: boolean;
	isExistingSkill: boolean;
}

/**
 * Helper function to validate the skill from an action and check its status.
 */
function checkSkillStatus(stats: CharacterStats, action: Action): SkillCheckResult {
	const skill = action.related_skill;

	// Initial validation
	if (!skill || skill.toLowerCase() === 'n/a' || skill.toLowerCase() === 'none') {
		return { skill: undefined, isAttribute: false, isExistingSkill: false };
	}

	// Check status
	const isAttribute = hasCaseInsensitiveKey(stats.attributes, skill);
	// Only check skills if it's not an attribute (optimization - avoids check if already determined not applicable)
	// Or always check if isNewSkill needs it regardless. Let's always check for simplicity for now.
	const isExistingSkill = hasCaseInsensitiveKey(stats.skills, skill);

	return { skill, isAttribute, isExistingSkill };
}

/**
 * Determines if the action's related skill is a new skill (not existing, not an attribute).
 * Logs and returns the skill name if it's new.
 */
export function isNewSkill(stats: CharacterStats, action: Action): string | undefined {
	const { skill, isAttribute, isExistingSkill } = checkSkillStatus(stats, action);

	// A skill is new if it's valid, not an existing skill, and not an attribute.
	if (skill && !isExistingSkill && !isAttribute) {
		console.log('Adding skill', skill);
		return skill;
	}

	return undefined;
}

/**
 * Returns the action's related skill if it's valid and *not* an attribute.
 */
export function getSkillIfApplicable(stats: CharacterStats, action: Action): string | undefined {
	const { skill, isAttribute } = checkSkillStatus(stats, action);

	// A skill is applicable if it's valid and not an attribute.
	if (skill && !isAttribute) {
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

export function getSkillProgressionForDifficulty(
	actionDifficulty: ActionDifficulty | undefined
): number {
	if (!actionDifficulty) return 0;
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

export function getCharacterTechnicalId(
	playerCharactersIdToNamesMapState: PlayerCharactersIdToNamesMap,
	characterName: string
): string | undefined {
	const characterId = Object.keys(playerCharactersIdToNamesMapState).find((key) =>
		playerCharactersIdToNamesMapState[key].includes(characterName)
	);
	return characterId;
}

export function getCharacterKnownNames(
	playerCharactersIdToNamesMapState: PlayerCharactersIdToNamesMap,
	characterName: string
): string[] {
	const characterId = Object.keys(playerCharactersIdToNamesMapState).find((key) =>
		playerCharactersIdToNamesMapState[key].includes(characterName)
	);
	return characterId ? playerCharactersIdToNamesMapState[characterId] : [];
}

export function getCharacterTechnicalIdOrThrow(
	playerCharactersIdToNamesMapState: PlayerCharactersIdToNamesMap,
	characterName: string
): string {
	const characterId = getCharacterTechnicalId(playerCharactersIdToNamesMapState, characterName);
	if (!characterId) {
		throw new Error('Character not found ' + characterName);
	}
	return characterId;
}

export function getFreeCharacterTechnicalId(
	playerCharactersIdToNamesMapState: PlayerCharactersIdToNamesMap
): string {
	let id = 1;
	let freeId = `player_character_${id}`;
	while (playerCharactersIdToNamesMapState[freeId]) {
		id++;
		freeId = `player_character_${id}`;
	}
	return freeId;
}

export function addCharacterToPlayerCharactersIdToNamesMap(
	playerCharactersIdToNamesMapState: PlayerCharactersIdToNamesMap,
	characterId: string,
	characterName: string
) {
	if (!playerCharactersIdToNamesMapState[characterId]) {
		playerCharactersIdToNamesMapState[characterId] = [];
	}
	if (!playerCharactersIdToNamesMapState[characterId].includes(characterName)) {
		playerCharactersIdToNamesMapState[characterId].push(characterName);
	}
}
