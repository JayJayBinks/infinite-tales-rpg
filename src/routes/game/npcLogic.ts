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

// derive relation of a given npc id from Targets (no persistence on npcState)
export function deriveRelationForNpc(
	npcs: Targets,
	npcUniqueId: string
): 'hostile' | 'neutral' | 'friendly' | undefined {
	if (npcs.hostile.some((n) => n.uniqueTechnicalNameId === npcUniqueId)) return 'hostile';
	if (npcs.neutral.some((n) => n.uniqueTechnicalNameId === npcUniqueId)) return 'neutral';
	if (npcs.friendly.some((n) => n.uniqueTechnicalNameId === npcUniqueId)) return 'friendly';
	return undefined;
}
