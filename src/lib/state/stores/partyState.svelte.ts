/**
 * Centralized party state store
 * Manages party members, active character, and party-specific state
 */

import { getFromLocalStorage, saveToLocalStorage } from '$lib/state/localStorageUtil';
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
	 * Check if party mode is active (more than one member)
	 */
	get isPartyMode(): boolean {
		return this.party.members.length > 1;
	}
	
	/**
	 * Get all party character names
	 */
	getAllCharacterNames(): string[] {
		return this.party.members.map((m) => m.character.name);
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
