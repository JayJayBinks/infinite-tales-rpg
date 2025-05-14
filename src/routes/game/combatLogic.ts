import { getRandomInteger } from '$lib/util.svelte';
import { npcRank, type NPCState, type NPCStats } from '$lib/ai/agents/characterStatsAgent';

/**
 *  | Rank         | Level 1  | Level 5  | Level 10 | Level 20 |
 * | :----------- | :------: | :------: | :------: | :------: |
 * | 'Very Weak'  |  [2, 4]  |  [9, 10] | [17, 19] | [34, 36] |
 * | 'Weak'       |  [4, 8]  | [16, 21] | [32, 37] | [64, 69] |
 * | 'Average'    |  [6, 14] | [26, 35] | [52, 60] | [104, 112]|
 * | 'Strong'     |  [8, 21] | [38, 51] | [75, 88] | [149, 162]|
 * | 'Boss'       | [10, 28] | [50, 68] | [100, 118]| [200, 218]|
 * | 'Legendary'  | [13, 37] | [64, 87] | [127, 151]| [254, 277]|
 * | *Unknown*    |  [6, 14] | [26, 35] | [52, 60] | [104, 112]|
 */
function calculateMaxResource(i: number, level: number, is_party_member?: boolean) {
	// Using logarithmic growth
	//TODO boss fight too difficult, limit HP
	let adapted = i;
	if (!is_party_member && i > 3) {
		adapted = 3;
	}
	if (is_party_member && i < 4) {
		adapted = 4;
	}
	const maxResource = Math.ceil(
		Math.log(adapted + 2) * (adapted + 1) * getRandomInteger(level, level + 2)
	);
	return maxResource;
}

//TODO consider class?
//TODO different modificator for level as it doesnt scale
function getMaxHPFromRank(npc: NPCStats): number {
	let i = npcRank.indexOf(npc.rank_enum_english);
	// Default to average if rank not found
	if (i === -1) i = 2;
	return calculateMaxResource(i, npc.level, npc.is_party_member);
}

//TODO consider class?
//TODO different modificator for level as it doesnt scale
function getMaxMPFromRank(npc: NPCStats): number {
	let i = npcRank.indexOf(npc.rank_enum_english);
	//Average if not found
	if (i === -1) i = 2;
	return calculateMaxResource(i, npc.level + 2, npc.is_party_member);
}

export function addResourceValues(npcState: NPCState) {
	Object.keys(npcState).forEach(
		(key) =>
			(npcState[key] = {
				...npcState[key],
				resources: {
					current_hp: getMaxHPFromRank(npcState[key]),
					current_mp: getMaxMPFromRank(npcState[key])
				}
			})
	);
}
