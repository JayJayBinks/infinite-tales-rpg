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
			expect(partyState.party.members).toEqual([]);
			expect(partyState.activeCharacterId).toBe('');
		});

		it('should track party members', () => {
			partyState.party = {
				members: [
					{ id: 'player_1', character: { ...initialCharacterState, name: 'Hero 1' } },
					{ id: 'player_2', character: { ...initialCharacterState, name: 'Hero 2' } }
				],
				activeCharacterId: 'player_1'
			};

			expect(partyState.party.members).toHaveLength(2);
			expect(partyState.activeCharacterId).toBe('player_1');
		});

		it('should get active member', () => {
			partyState.party = {
				members: [
					{ id: 'player_1', character: { ...initialCharacterState, name: 'Hero 1' } }
				],
				activeCharacterId: 'player_1'
			};

			const activeMember = partyState.getActiveMember();
			expect(activeMember?.character.name).toBe('Hero 1');
		});

		it('should get member by ID', () => {
			partyState.party = {
				members: [
					{ id: 'player_1', character: { ...initialCharacterState, name: 'Hero 1' } },
					{ id: 'player_2', character: { ...initialCharacterState, name: 'Hero 2' } }
				],
				activeCharacterId: 'player_1'
			};

			const member = partyState.getMemberById('player_2');
			expect(member?.character.name).toBe('Hero 2');
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
				character_changed: undefined,
				abilities_learned: { abilities: [] }
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
			partyState.party = {
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

	describe('Immutable update methods', () => {
		beforeEach(() => {
			partyState.party = {
				members: [
					{ id: 'player_1', character: { ...initialCharacterState, name: 'Hero 1' } },
					{ id: 'player_2', character: { ...initialCharacterState, name: 'Hero 2' } }
				],
				activeCharacterId: 'player_1'
			};
			partyState.partyStats = {
				members: [
					{ id: 'player_1', stats: { ...initialCharacterStatsState, level: 1 } },
					{ id: 'player_2', stats: { ...initialCharacterStatsState, level: 1 } }
				]
			};
		});

		it('should update member character immutably', () => {
			const newCharacter = { ...initialCharacterState, name: 'Updated Hero 1', background: 'New background' };
			
			partyState.updateMemberCharacter('player_1', newCharacter);
			
			expect(partyState.party.members[0].character.name).toBe('Updated Hero 1');
			expect(partyState.party.members[0].character.background).toBe('New background');
			expect(partyState.party.members[1].character.name).toBe('Hero 2'); // Other members unchanged
		});

		it('should update member stats immutably', () => {
			const newStats = { ...initialCharacterStatsState, level: 5 };
			
			partyState.updateMemberStats('player_2', newStats);
			
			expect(partyState.partyStats.members[1].stats.level).toBe(5);
			expect(partyState.partyStats.members[0].stats.level).toBe(1); // Other members unchanged
		});

		it('should set active character ID immutably', () => {
			partyState.setActiveCharacterId('player_2');
			
			expect(partyState.activeCharacterId).toBe('player_2');
		});

		it('should add member immutably', () => {
			const newMember = { id: 'player_3', character: { ...initialCharacterState, name: 'Hero 3' } };
			
			partyState.addMember(newMember);
			
			expect(partyState.party.members).toHaveLength(3);
			expect(partyState.party.members[2].character.name).toBe('Hero 3');
		});

		it('should add member stats immutably', () => {
			const newMemberStats = { id: 'player_3', stats: { ...initialCharacterStatsState, level: 3 } };
			
			partyState.addMemberStats(newMemberStats);
			
			expect(partyState.partyStats.members).toHaveLength(3);
			expect(partyState.partyStats.members[2].stats.level).toBe(3);
		});

		it('should remove member immutably', () => {
			partyState.removeMember('player_2');
			
			expect(partyState.party.members).toHaveLength(1);
			expect(partyState.party.members[0].character.name).toBe('Hero 1');
		});

		it('should remove member stats immutably', () => {
			partyState.removeMemberStats('player_1');
			
			expect(partyState.partyStats.members).toHaveLength(1);
			expect(partyState.partyStats.members[0].id).toBe('player_2');
		});

		it('should set member skill progression immutably', () => {
			partyState.setMemberSkillProgression('player_1', 'Swordsmanship', 10);
			partyState.setMemberSkillProgression('player_1', 'Swordsmanship', 5);
			
			const progression = partyState.getMemberSkillsProgression('player_1');
			expect(progression['Swordsmanship']).toBe(15);
		});

		it('should not modify original data when updating', () => {
			const originalParty = { ...partyState.party };
			const originalMemberName = partyState.party.members[0].character.name;
			
			partyState.updateMemberCharacter('player_1', { ...initialCharacterState, name: 'Changed' });
			
			// Reference should be different (immutability)
			expect(partyState.party).not.toBe(originalParty);
			expect(partyState.party.members[0].character.name).not.toBe(originalMemberName);
		});
	});

	describe('resetPartyState', () => {
		it('should reset all party state', () => {
			// Set some values
			partyState.party = {
				members: [{ id: 'player_1', character: initialCharacterState }],
				activeCharacterId: 'player_1'
			};
			partyState.setMemberActions('player_1', [{ text: 'Test' } as Action]);
			partyState.updateMemberSkillProgression('player_1', 'Skill', 5);

			// Reset
			partyState.resetPartyState();

			// Verify reset
			expect(partyState.party.members).toEqual([]);
			expect(partyState.getMemberActions('player_1')).toEqual([]);
			expect(partyState.getMemberSkillsProgression('player_1')).toEqual({});
		});
	});
});
