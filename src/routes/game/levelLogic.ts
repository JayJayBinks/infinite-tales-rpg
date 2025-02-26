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

export function getLevelUpText(
	trait: string,
	characterStats: CharacterStats
): {
	prefix: string;
	traitUpdate: string;
} {
	const traitToLevel = getTraitToLevelUp(trait, characterStats);
	const returnObject = { prefix: '', traitUpdate: '' };
	returnObject.prefix = traitToLevel.type === 'disadvantage' ? 'Disadvantage:' : 'Expertise:';
	returnObject.traitUpdate = trait + ' ' + traitToLevel.oldValue + ' -> ' + traitToLevel.newValue;
	return returnObject;
}

function getTraitToLevelUp(
	trait: string,
	characterStats: CharacterStats
): {
	type: 'disadvantage' | 'expertise';
	key: string;
	oldValue: number;
	newValue: number;
} {
	const disadvantageToIncrease = characterStats.disadvantages[trait];
	if (disadvantageToIncrease) {
		const disadvantagePreviousValue = Number.parseInt(
			(disadvantageToIncrease as unknown as string) || '0'
		);
		return {
			type: 'disadvantage',
			key: trait,
			oldValue: disadvantagePreviousValue,
			newValue: disadvantageToIncrease + 1
		};
	}
	const expertisePreviousValue = Number.parseInt(
		(characterStats.expertise[trait] as unknown as string) || '0'
	);
	return {
		type: 'expertise',
		key: trait,
		oldValue: expertisePreviousValue,
		newValue: expertisePreviousValue + 1
	};
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
		characterStats.resources[resourcesKey] = {
			...currentValue,
			max_value: aiLevelUp.resources[resourcesKey],
			start_value:
				currentValue.start_value === currentValue.max_value
					? aiLevelUp.resources[resourcesKey]
					: currentValue.start_value
		};
	}

	const traitToLevel = getTraitToLevelUp(aiLevelUp.trait, characterStats);
	if (traitToLevel.type === 'disadvantage') {
		characterStats.disadvantages[traitToLevel.key] = traitToLevel.newValue;
	} else {
		characterStats.expertise[traitToLevel.key] = traitToLevel.newValue;
	}
	if (aiLevelUp.formerAbilityName) {
		const index = characterStats.spells_and_abilities.findIndex(
			(a) => a.name === aiLevelUp.formerAbilityName
		);
		if (index > -1) {
			// only splice array when item is found
			characterStats.spells_and_abilities.splice(index, 1);
		}
	}

	characterStats.spells_and_abilities.push(aiLevelUp.ability);
	return characterStats;
}
