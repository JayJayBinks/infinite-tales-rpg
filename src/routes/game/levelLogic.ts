import type { StatsUpdate } from '$lib/ai/agents/combatAgent';
import type { AiLevelUp, CharacterStats } from '$lib/ai/agents/characterStatsAgent';

//TODO AI uses LOW too often, so we trick it by just mapping to no XP
export const XP_INCREASING_SCALE = {
	SMALL: 0,
	MEDIUM: 10,
	HIGH: 20
};

//XP needed to reach Level 2
const BASE_XP = 100;

export function getXPNeededForLevel(level: number): number | undefined {
	if (!level) {
		return undefined;
	}
	return BASE_XP + XP_INCREASING_SCALE.HIGH * (level - 1);
}

export function mapXP(statsUpdate: StatsUpdate): StatsUpdate {
	if (statsUpdate.type.toUpperCase().includes('XP')) {
		statsUpdate.value.result = XP_INCREASING_SCALE[statsUpdate.value.result];
	}
	return statsUpdate;
}

export function applyLevelUp(
	aiLevelUp: AiLevelUp | undefined,
	characterStats: CharacterStats
): CharacterStats {
	if (!aiLevelUp) {
		return characterStats;
	}
	characterStats.level += 1;
	for (const resourcesKey in aiLevelUp.resources) {
		const currentValue = characterStats.resources[resourcesKey];
		let new_start_value = 0;
		if (!currentValue?.start_value || currentValue.start_value === currentValue.max_value) {
			new_start_value = aiLevelUp.resources[resourcesKey];
		} else {
			new_start_value = currentValue.start_value;
		}
		characterStats.resources[resourcesKey] = {
			...currentValue,
			max_value: aiLevelUp.resources[resourcesKey],
			start_value: new_start_value
		};
	}

	characterStats.attributes[aiLevelUp.attribute] =
		(characterStats.attributes[aiLevelUp.attribute] || 0) + 1;

	if (aiLevelUp.formerAbilityName) {
		const index = characterStats.spells_and_abilities.findIndex(
			(a) => a.name === aiLevelUp.formerAbilityName
		);
		if (index > -1) {
			// only splice array when ability is found
			characterStats.spells_and_abilities.splice(index, 1);
		}
	}

	characterStats.spells_and_abilities.push(aiLevelUp.ability);
	return characterStats;
}
