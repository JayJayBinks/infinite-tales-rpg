/**
 * Centralized party state store
 * Manages party members, active character, and party-specific state
 */

import { useLocalStorage } from '../useLocalStorage.svelte';
import type { Party, CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { PartyStats, CharacterStats, SkillsProgression } from '$lib/ai/agents/characterStatsAgent';
import { initialPartyState } from '$lib/ai/agents/characterAgent';
import { initialPartyStatsState, initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';
import type { Action } from '$lib/ai/agents/gameAgent';
import type { EventEvaluation } from '$lib/ai/agents/eventAgent';

/**
 * Party state store
 * Manages party composition and active character selection
 */
export class PartyState {
	// Party composition
	party = useLocalStorage<Party>('partyState', initialPartyState);
	
	// Party stats
	partyStats = useLocalStorage<PartyStats>('partyStatsState', initialPartyStatsState);
	
	// Per-member cached actions
	characterActionsByMember = useLocalStorage<Record<string, Action[]>>(
		'characterActionsByMemberState',
		{}
	);
	
	// Per-member combat action selections
	selectedCombatActionsByMember = useLocalStorage<Record<string, Action | null>>(
		'selectedCombatActionsByMemberState',
		{}
	);
	
	// Per-member restrained state explanations
	restrainedExplanationByMember = useLocalStorage<Record<string, string | null>>(
		'restrainedExplanationByMemberState',
		{}
	);
	
	// Per-member event evaluations
	eventEvaluationByMember = useLocalStorage<Record<string, EventEvaluation>>(
		'eventEvaluationByMemberState',
		{}
	);
	
	// Per-member skills progression
	skillsProgressionByMember = useLocalStorage<Record<string, SkillsProgression>>(
		'skillsProgressionByMemberState',
		{}
	);
	
	/**
	 * Get the active party member ID
	 */
	get activeCharacterId(): string {
		return this.party.value.activeCharacterId || '';
	}
	
	/**
	 * Get the active party member
	 */
	getActiveMember() {
		return this.party.value.members.find((m) => m.id === this.activeCharacterId);
	}
	
	/**
	 * Get the active party member's stats
	 */
	getActiveMemberStats() {
		return this.partyStats.value.members.find((m) => m.id === this.activeCharacterId)?.stats;
	}
	
	/**
	 * Get party member by ID
	 */
	getMemberById(id: string) {
		return this.party.value.members.find((m) => m.id === id);
	}
	
	/**
	 * Get party member stats by ID
	 */
	getMemberStatsById(id: string) {
		return this.partyStats.value.members.find((m) => m.id === id)?.stats;
	}
	
	/**
	 * Get cached actions for a member
	 */
	getMemberActions(memberId: string): Action[] {
		return this.characterActionsByMember.value[memberId] || [];
	}
	
	/**
	 * Set cached actions for a member
	 */
	setMemberActions(memberId: string, actions: Action[]) {
		this.characterActionsByMember.value = {
			...this.characterActionsByMember.value,
			[memberId]: actions
		};
	}
	
	/**
	 * Get event evaluation for a member
	 */
	getMemberEventEvaluation(memberId: string): EventEvaluation | undefined {
		return this.eventEvaluationByMember.value[memberId];
	}
	
	/**
	 * Set event evaluation for a member
	 */
	setMemberEventEvaluation(memberId: string, evaluation: EventEvaluation) {
		this.eventEvaluationByMember.value = {
			...this.eventEvaluationByMember.value,
			[memberId]: evaluation
		};
	}
	
	/**
	 * Get skills progression for a member
	 */
	getMemberSkillsProgression(memberId: string): SkillsProgression {
		return this.skillsProgressionByMember.value[memberId] || {};
	}
	
	/**
	 * Update skills progression for a member
	 */
	updateMemberSkillProgression(memberId: string, skillName: string, progression: number) {
		if (!this.skillsProgressionByMember.value[memberId]) {
			this.skillsProgressionByMember.value[memberId] = {};
		}
		if (!this.skillsProgressionByMember.value[memberId][skillName]) {
			this.skillsProgressionByMember.value[memberId][skillName] = 0;
		}
		this.skillsProgressionByMember.value[memberId][skillName] += progression;
	}
	
	/**
	 * Check if party mode is active (more than one member)
	 */
	get isPartyMode(): boolean {
		return this.party.value.members.length > 1;
	}
	
	/**
	 * Get all party character names
	 */
	getAllCharacterNames(): string[] {
		return this.party.value.members.map((m) => m.character.name);
	}
	
	/**
	 * Reset party state
	 */
	resetPartyState() {
		this.party.reset();
		this.partyStats.reset();
		this.characterActionsByMember.reset();
		this.selectedCombatActionsByMember.reset();
		this.restrainedExplanationByMember.reset();
		this.eventEvaluationByMember.reset();
		this.skillsProgressionByMember.reset();
	}
}

/**
 * Create and export a singleton party state instance
 */
export const partyState = new PartyState();
