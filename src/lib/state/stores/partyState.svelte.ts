/**
 * Centralized party state store
 * Manages party members, active character, and party-specific state
 */

import { getFromLocalStorage, saveToLocalStorage } from '$lib/state/localStorageUtil';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { CharacterStats, SkillsProgression } from '$lib/ai/agents/characterStatsAgent';
import type { Action } from '$lib/ai/agents/gameAgent';
import type { EventEvaluation } from '$lib/ai/agents/eventAgent';
import type { Party, PartyStats } from '$lib/types/party';
// Provide minimal empty initial states for Party and PartyStats
const initialPartyState: Party = {
	members: [],
	activeCharacterId: ''
};

const initialPartyStatsState: PartyStats = {
	members: []
};

/**
 * Party state store
 * Manages party composition and active character selection
 */
export class PartyState {
	private _party = $state<Party>(getFromLocalStorage('partyState', initialPartyState));
	private _partyStats = $state<PartyStats>(
		getFromLocalStorage('partyStatsState', initialPartyStatsState)
	);
	private _characterActionsByMember = $state<Record<string, Action[]>>(
		getFromLocalStorage('characterActionsByMemberState', {})
	);
	private _selectedCombatActionsByMember = $state<Record<string, Action | null>>(
		getFromLocalStorage('selectedCombatActionsByMemberState', {})
	);
	private _restrainedExplanationByMember = $state<Record<string, string | null>>(
		getFromLocalStorage('restrainedExplanationByMemberState', {})
	);
	private _eventEvaluationByMember = $state<Record<string, EventEvaluation>>(
		getFromLocalStorage('eventEvaluationByMemberState', {})
	);
	private _skillsProgressionByMember = $state<Record<string, SkillsProgression>>(
		getFromLocalStorage('skillsProgressionByMemberState', {})
	);

	get party() { return this._party; }
	set party(v: Party) { this._party = v; saveToLocalStorage('partyState', v); }

	// Backwards compatibility for older code using partyState.value
	get value() { return this._party; }
	set value(v: Party) { this.party = v; }

	get partyStats() { return this._partyStats; }
	set partyStats(v: PartyStats) { this._partyStats = v; saveToLocalStorage('partyStatsState', v); }

	get characterActionsByMember() { return this._characterActionsByMember; }
	set characterActionsByMember(v: Record<string, Action[]>) { this._characterActionsByMember = v; saveToLocalStorage('characterActionsByMemberState', v); }

	get selectedCombatActionsByMember() { return this._selectedCombatActionsByMember; }
	set selectedCombatActionsByMember(v: Record<string, Action | null>) { this._selectedCombatActionsByMember = v; saveToLocalStorage('selectedCombatActionsByMemberState', v); }

	get restrainedExplanationByMember() { return this._restrainedExplanationByMember; }
	set restrainedExplanationByMember(v: Record<string, string | null>) { this._restrainedExplanationByMember = v; saveToLocalStorage('restrainedExplanationByMemberState', v); }

	get eventEvaluationByMember() { return this._eventEvaluationByMember; }
	set eventEvaluationByMember(v: Record<string, EventEvaluation>) { this._eventEvaluationByMember = v; saveToLocalStorage('eventEvaluationByMemberState', v); }

	get skillsProgressionByMember() { return this._skillsProgressionByMember; }
	set skillsProgressionByMember(v: Record<string, SkillsProgression>) { this._skillsProgressionByMember = v; saveToLocalStorage('skillsProgressionByMemberState', v); }
	
	/**
	 * Get the active party member ID
	 */
	get activeCharacterId(): string {
		return this.party.activeCharacterId || '';
	}
	
	/**
	 * Get the active party member
	 */
	getActiveMember() {
		return this.party.members.find((m) => m.id === this.activeCharacterId);
	}
	
	/**
	 * Get the active party member's stats
	 */
	getActiveMemberStats() {
		return this.partyStats.members.find((m) => m.id === this.activeCharacterId)?.stats;
	}
	
	/**
	 * Get party member by ID
	 */
	getMemberById(id: string) {
		return this.party.members.find((m) => m.id === id);
	}
	
	/**
	 * Get party member stats by ID
	 */
	getMemberStatsById(id: string) {
		return this.partyStats.members.find((m) => m.id === id)?.stats;
	}
	
	/**
	 * Get cached actions for a member
	 */
	getMemberActions(memberId: string): Action[] {
		return this.characterActionsByMember[memberId] || [];
	}
	
	/**
	 * Set cached actions for a member
	 */
	setMemberActions(memberId: string, actions: Action[]) {
		this.characterActionsByMember = {
			...this.characterActionsByMember,
			[memberId]: actions
		};
	}
	
	/**
	 * Get event evaluation for a member
	 */
	getMemberEventEvaluation(memberId: string): EventEvaluation | undefined {
		return this.eventEvaluationByMember[memberId];
	}
	
	/**
	 * Set event evaluation for a member
	 */
	setMemberEventEvaluation(memberId: string, evaluation: EventEvaluation) {
		this.eventEvaluationByMember = {
			...this.eventEvaluationByMember,
			[memberId]: evaluation
		};
	}
	
	/**
	 * Get skills progression for a member
	 */
	getMemberSkillsProgression(memberId: string): SkillsProgression {
		return this.skillsProgressionByMember[memberId] || {};
	}
	
	/**
	 * Update skills progression for a member
	 */
	updateMemberSkillProgression(memberId: string, skillName: string, progression: number) {
		if (!this.skillsProgressionByMember[memberId]) {
			this.skillsProgressionByMember[memberId] = {};
		}
		if (!this.skillsProgressionByMember[memberId][skillName]) {
			this.skillsProgressionByMember[memberId][skillName] = 0;
		}
		this.skillsProgressionByMember[memberId][skillName] += progression;
	}
	
	/**
	 * Get all party character names
	 */
	getAllCharacterNames(): string[] {
		return this.party.members.map((m) => m.character.name);
	}
	
	/**
	 * Update a specific party member's character description
	 * Uses immutable pattern to ensure setter is triggered
	 */
	updateMemberCharacter(memberId: string, character: CharacterDescription) {
		const memberIndex = this.party.members.findIndex((m) => m.id === memberId);
		if (memberIndex === -1) return;
		
		this.party = {
			...this.party,
			members: this.party.members.map((m, i) =>
				i === memberIndex ? { ...m, character } : m
			)
		};
	}
	
	/**
	 * Update a specific party member's stats
	 * Uses immutable pattern to ensure setter is triggered
	 */
	updateMemberStats(memberId: string, stats: CharacterStats) {
		const memberIndex = this.partyStats.members.findIndex((m) => m.id === memberId);
		if (memberIndex === -1) return;
		
		this.partyStats = {
			...this.partyStats,
			members: this.partyStats.members.map((m, i) =>
				i === memberIndex ? { ...m, stats } : m
			)
		};
	}
	
	/**
	 * Set the active character ID
	 * Uses immutable pattern to ensure setter is triggered
	 */
	setActiveCharacterId(id: string) {
		this.party = { ...this.party, activeCharacterId: id };
	}
	
	/**
	 * Add a new party member
	 * Uses immutable pattern to ensure setter is triggered
	 */
	addMember(member: Party['members'][0]) {
		this.party = {
			...this.party,
			members: [...this.party.members, member]
		};
	}
	
	/**
	 * Add a new party member stats
	 * Uses immutable pattern to ensure setter is triggered
	 */
	addMemberStats(memberStats: PartyStats['members'][0]) {
		this.partyStats = {
			...this.partyStats,
			members: [...this.partyStats.members, memberStats]
		};
	}
	
	/**
	 * Remove a party member by ID
	 * Uses immutable pattern to ensure setter is triggered
	 */
	removeMember(memberId: string) {
		this.party = {
			...this.party,
			members: this.party.members.filter(m => m.id !== memberId)
		};
	}
	
	/**
	 * Remove a party member stats by ID
	 * Uses immutable pattern to ensure setter is triggered
	 */
	removeMemberStats(memberId: string) {
		this.partyStats = {
			...this.partyStats,
			members: this.partyStats.members.filter(m => m.id !== memberId)
		};
	}
	
	/**
	 * Update skills progression for a member (immutable)
	 */
	setMemberSkillProgression(memberId: string, skillName: string, progression: number) {
		const currentProgression = this.skillsProgressionByMember[memberId] || {};
		const currentSkillValue = currentProgression[skillName] || 0;
		
		this.skillsProgressionByMember = {
			...this.skillsProgressionByMember,
			[memberId]: {
				...currentProgression,
				[skillName]: currentSkillValue + progression
			}
		};
	}
	
	/**
	 * Reset party state
	 */
	resetPartyState() {
		this.party = initialPartyState;
		this.partyStats = initialPartyStatsState;
		this.characterActionsByMember = {};
		this.selectedCombatActionsByMember = {};
		this.restrainedExplanationByMember = {};
		this.eventEvaluationByMember = {};
		this.skillsProgressionByMember = {};
	}
}

/**
 * Create and export a singleton party state instance
 */
export const partyState = new PartyState();
