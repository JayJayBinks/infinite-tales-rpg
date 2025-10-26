import { describe, it, expect, beforeEach } from 'vitest';
import { PartyState } from './partyState.svelte';
import { initialCharacterState } from '$lib/ai/agents/characterAgent';
import { initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';
import type { Action } from '$lib/ai/agents/gameAgent';

describe('PartyState', () => {
	let partyState: PartyState;

	beforeEach(() => {
		partyState = new PartyState();
		partyState.resetPartyState();
	});

	describe('Party composition', () => {
		it('should initialize with empty party', () => {
			expect(partyState.party.value.members).toEqual([]);
			expect(partyState.activeCharacterId).toBe('');
		});

		it('should track party members', () => {
			partyState.party.value = {
				members: [
					{ id: 'player_1', character: { ...initialCharacterState, name: 'Hero 1' } },
					{ id: 'player_2', character: { ...initialCharacterState, name: 'Hero 2' } }
				],
				activeCharacterId: 'player_1'
			};

			expect(partyState.party.value.members).toHaveLength(2);
			expect(partyState.activeCharacterId).toBe('player_1');
		});

		it('should get active member', () => {
			partyState.party.value = {
				members: [
					{ id: 'player_1', character: { ...initialCharacterState, name: 'Hero 1' } }
				],
				activeCharacterId: 'player_1'
			};

			const activeMember = partyState.getActiveMember();
			expect(activeMember?.character.name).toBe('Hero 1');
		});

		it('should get member by ID', () => {
			partyState.party.value = {
				members: [
					{ id: 'player_1', character: { ...initialCharacterState, name: 'Hero 1' } },
					{ id: 'player_2', character: { ...initialCharacterState, name: 'Hero 2' } }
				],
				activeCharacterId: 'player_1'
			};

			const member = partyState.getMemberById('player_2');
			expect(member?.character.name).toBe('Hero 2');
		});

		it('should check if party mode is active', () => {
			expect(partyState.isPartyMode).toBe(false);

			partyState.party.value = {
				members: [
					{ id: 'player_1', character: initialCharacterState },
					{ id: 'player_2', character: initialCharacterState }
				],
				activeCharacterId: 'player_1'
			};

			expect(partyState.isPartyMode).toBe(true);
		});
	});

	describe('Member actions', () => {
		it('should cache actions for members', () => {
			const mockActions: Action[] = [
				{ text: 'Attack', action_difficulty: 'medium', type: 'combat' } as Action
			];

			partyState.setMemberActions('player_1', mockActions);

			const retrieved = partyState.getMemberActions('player_1');
			expect(retrieved).toEqual(mockActions);
		});

		it('should return empty array for member with no cached actions', () => {
			const actions = partyState.getMemberActions('player_1');
			expect(actions).toEqual([]);
		});
	});

	describe('Skills progression', () => {
		it('should track skills progression per member', () => {
			partyState.updateMemberSkillProgression('player_1', 'Swordsmanship', 5);

			const progression = partyState.getMemberSkillsProgression('player_1');
			expect(progression['Swordsmanship']).toBe(5);
		});

		it('should accumulate skills progression', () => {
			partyState.updateMemberSkillProgression('player_1', 'Swordsmanship', 5);
			partyState.updateMemberSkillProgression('player_1', 'Swordsmanship', 3);

			const progression = partyState.getMemberSkillsProgression('player_1');
			expect(progression['Swordsmanship']).toBe(8);
		});

		it('should track different skills for same member', () => {
			partyState.updateMemberSkillProgression('player_1', 'Swordsmanship', 5);
			partyState.updateMemberSkillProgression('player_1', 'Magic', 3);

			const progression = partyState.getMemberSkillsProgression('player_1');
			expect(progression['Swordsmanship']).toBe(5);
			expect(progression['Magic']).toBe(3);
		});
	});

	describe('Event evaluations', () => {
		it('should store event evaluation per member', () => {
			const mockEvaluation = {
				character_changed: null,
				abilities_learned: []
			};

			partyState.setMemberEventEvaluation('player_1', mockEvaluation);

			const retrieved = partyState.getMemberEventEvaluation('player_1');
			expect(retrieved).toEqual(mockEvaluation);
		});

		it('should return undefined for member with no event evaluation', () => {
			const evaluation = partyState.getMemberEventEvaluation('player_1');
			expect(evaluation).toBeUndefined();
		});
	});

	describe('Helper methods', () => {
		beforeEach(() => {
			partyState.party.value = {
				members: [
					{ id: 'player_1', character: { ...initialCharacterState, name: 'Hero 1' } },
					{ id: 'player_2', character: { ...initialCharacterState, name: 'Hero 2' } },
					{ id: 'player_3', character: { ...initialCharacterState, name: 'Hero 3' } }
				],
				activeCharacterId: 'player_1'
			};
		});

		it('should get all character names', () => {
			const names = partyState.getAllCharacterNames();
			expect(names).toEqual(['Hero 1', 'Hero 2', 'Hero 3']);
		});
	});

	describe('resetPartyState', () => {
		it('should reset all party state', () => {
			// Set some values
			partyState.party.value = {
				members: [{ id: 'player_1', character: initialCharacterState }],
				activeCharacterId: 'player_1'
			};
			partyState.setMemberActions('player_1', [{ text: 'Test' } as Action]);
			partyState.updateMemberSkillProgression('player_1', 'Skill', 5);

			// Reset
			partyState.resetPartyState();

			// Verify reset
			expect(partyState.party.value.members).toEqual([]);
			expect(partyState.getMemberActions('player_1')).toEqual([]);
			expect(partyState.getMemberSkillsProgression('player_1')).toEqual({});
		});
	});
});
