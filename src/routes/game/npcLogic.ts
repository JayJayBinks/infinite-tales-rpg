import type { NPCState } from '$lib/ai/agents/characterStatsAgent';
import type { Targets } from '$lib/ai/agents/gameAgent';
import { getAllNpcsIds } from './gameLogic';

export function removeDeadNPCs(npcState: NPCState): string[] {
	return Object.keys(npcState)
		.filter((npc) => npcState[npc].resources && npcState[npc].resources.current_hp <= 0)
		.map((deadNPC) => {
			delete npcState[deadNPC];
			return deadNPC;
		});
}

export function addNPCNamesToState(npcs: Targets, npcState: NPCState) {
	getAllNpcsIds(npcs).forEach((npcId) => {
		const npc = npcState[npcId.uniqueTechnicalNameId];
		if (!npc) return;
		if (!npc.known_names) {
			npc.known_names = [];
		}
		if (!npc.known_names.includes(npcId.displayName)) {
			npc.known_names.push(npcId.displayName);
		}
	});
}
