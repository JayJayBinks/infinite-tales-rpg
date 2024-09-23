import {getRandomInteger} from "$lib/util.svelte";
import {npcRank} from "$lib/ai/agents/characterStatsAgent";


/*
Logarithmic Modifier Calculation
Rank	Min HP	Max HP
Very Weak	4	7
Weak	11	22
Average	21	42
Strong	33	65
Elite	45	90
Boss	59	117
Legendary	73	146
*/
function calculateMaxResource(i, minRandom, maxRandom) {
    // Using logarithmic growth
    return Math.ceil(Math.log(i + 2) * (i + 1) * getRandomInteger(minRandom, maxRandom));
}

//TODO consider class?
function getMaxHPFromRank(rank: string) {
    let i = npcRank.indexOf(rank);
    if (i === -1) i = 2; // Default to average if rank not found
    return calculateMaxResource(i, 5, 10);
}

//TODO consider class?
function getMaxMPFromRank(rank: string) {
    let i = npcRank.indexOf(rank);
    //Average if not found
    if (i === -1) i = 2;
    return calculateMaxResource(i, 7, 13);
}

export function addResourceValues(npcState: object) {
    Object.keys(npcState).forEach(key => npcState[key] = {
        ...npcState[key],
        resources: {
            current_hp: getMaxHPFromRank(npcState[key].rank),
            current_mp: getMaxMPFromRank(npcState[key].rank)
        }
    })
}
