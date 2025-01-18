import { getRandomInteger } from '$lib/util.svelte';
import { npcRank, type NPCState } from '$lib/ai/agents/characterStatsAgent';

/*
Logarithmic Modifier Calculation
Rank	Min HP	Max HP
Very Weak	4	7
Weak	11	22
Average	21	42
Strong	33	65
Boss	45	90
Legendary	59	117
*/
function calculateMaxResource(i: number, minRandom: number, maxRandom: number) {
	// Using logarithmic growth
	//TODO boss fight too difficult, limit HP
	if (i > 2) {
		i = 2;
	}
	return Math.ceil(Math.log(i + 2) * (i + 1) * getRandomInteger(minRandom, maxRandom));
}

//TODO consider class?
//TODO different modificator for level as it doesnt scale
function getMaxHPFromRank(rank: string, level: number) {
	let i = npcRank.indexOf(rank);
	if (i === -1) i = 2; // Default to average if rank not found
	return calculateMaxResource(i, 5, 8) + level;
}

//TODO consider class?
//TODO different modificator for level as it doesnt scale
function getMaxMPFromRank(rank: string, level: number): number {
	let i = npcRank.indexOf(rank);
	//Average if not found
	if (i === -1) i = 2;
	return calculateMaxResource(i, 7, 13) + level;
}

export function addResourceValues(npcState: NPCState) {
	Object.keys(npcState).forEach(
		(key) =>
			(npcState[key] = {
				...npcState[key],
				resources: {
					current_hp: getMaxHPFromRank(npcState[key].rank, npcState[key].level),
					current_mp: getMaxMPFromRank(npcState[key].rank, npcState[key].level)
				}
			})
	);
}
