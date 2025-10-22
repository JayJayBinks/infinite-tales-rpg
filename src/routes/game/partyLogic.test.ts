import { describe, it, expect, beforeEach } from 'vitest';
import {
	initializeParty,
	addPartyMember,
	removePartyMember,
	switchActiveCharacter,
	getActivePartyMember,
	getActivePartyMemberStats,
	getPartyMemberById,
	updatePartyCharactersIdToNamesMap
} from './partyLogic';
import type { Party, PartyMember } from '$lib/ai/agents/characterAgent';
import type { PartyStats } from '$lib/ai/agents/characterStatsAgent';
import { initialCharacterState } from '$lib/ai/agents/characterAgent';
import { initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';

describe('Party Logic', () => {
	let party: Party;
	let partyStats: PartyStats;

	beforeEach(() => {
		party = initializeParty();
		partyStats = { members: [] };
	});

	describe('initializeParty', () => {
		it('should create an empty party with no active character', () => {
			const newParty = initializeParty();
			expect(newParty.members).toEqual([]);
			expect(newParty.activeCharacterId).toBe('');
		});
	});

	describe('addPartyMember', () => {
		it('should add a party member with unique ID', () => {
			const character = { ...initialCharacterState, name: 'Test Hero' };
			addPartyMember(party, character);
			
			expect(party.members).toHaveLength(1);
			expect(party.members[0].character.name).toBe('Test Hero');
			expect(party.members[0].id).toMatch(/player_character_\d+/);
		});

		it('should set first member as active character', () => {
			const character = { ...initialCharacterState, name: 'First Hero' };
			addPartyMember(party, character);
			
			expect(party.activeCharacterId).toBe(party.members[0].id);
		});

		it('should not change active character when adding subsequent members', () => {
			const character1 = { ...initialCharacterState, name: 'Hero 1' };
			const character2 = { ...initialCharacterState, name: 'Hero 2' };
			
			addPartyMember(party, character1);
			const firstActiveId = party.activeCharacterId;
			
			addPartyMember(party, character2);
			expect(party.activeCharacterId).toBe(firstActiveId);
		});

		it('should not add more than 4 party members', () => {
			for (let i = 0; i < 5; i++) {
				const character = { ...initialCharacterState, name: `Hero ${i + 1}` };
				addPartyMember(party, character);
			}
			
			expect(party.members).toHaveLength(4);
		});
	});

	describe('removePartyMember', () => {
		beforeEach(() => {
			for (let i = 0; i < 3; i++) {
				const character = { ...initialCharacterState, name: `Hero ${i + 1}` };
				addPartyMember(party, character);
			}
		});

		it('should remove a party member by index', () => {
			removePartyMember(party, 1);
			expect(party.members).toHaveLength(2);
		});

		it('should not allow removing the last party member', () => {
			removePartyMember(party, 0);
			removePartyMember(party, 0);
			removePartyMember(party, 0);
			
			expect(party.members).toHaveLength(1);
		});

		it('should update active character if removed member was active', () => {
			const secondMemberId = party.members[1].id;
			party.activeCharacterId = secondMemberId;
			
			removePartyMember(party, 1);
			expect(party.activeCharacterId).not.toBe(secondMemberId);
			expect(party.activeCharacterId).toBe(party.members[0].id);
		});

		it('should handle removing out of bounds index', () => {
			const initialLength = party.members.length;
			removePartyMember(party, 10);
			expect(party.members).toHaveLength(initialLength);
		});
	});

	describe('switchActiveCharacter', () => {
		beforeEach(() => {
			for (let i = 0; i < 3; i++) {
				const character = { ...initialCharacterState, name: `Hero ${i + 1}` };
				addPartyMember(party, character);
			}
		});

		it('should switch to existing party member', () => {
			const targetId = party.members[2].id;
			switchActiveCharacter(party, targetId);
			
			expect(party.activeCharacterId).toBe(targetId);
		});

		it('should not switch to non-existent party member', () => {
			const currentActive = party.activeCharacterId;
			switchActiveCharacter(party, 'non_existent_id');
			
			expect(party.activeCharacterId).toBe(currentActive);
		});
	});

	describe('getActivePartyMember', () => {
		it('should return undefined for empty party', () => {
			const result = getActivePartyMember(party);
			expect(result).toBeUndefined();
		});

		it('should return the active party member', () => {
			const character = { ...initialCharacterState, name: 'Active Hero' };
			addPartyMember(party, character);
			
			const result = getActivePartyMember(party);
			expect(result?.character.name).toBe('Active Hero');
		});
	});

	describe('getActivePartyMemberStats', () => {
		beforeEach(() => {
			const character = { ...initialCharacterState, name: 'Hero' };
			addPartyMember(party, character);
			
			partyStats.members.push({
				id: party.members[0].id,
				stats: { ...initialCharacterStatsState, level: 5 }
			});
		});

		it('should return stats for active party member', () => {
			const result = getActivePartyMemberStats(party, partyStats);
			expect(result?.level).toBe(5);
		});

		it('should return undefined if no matching stats found', () => {
			party.activeCharacterId = 'non_existent_id';
			const result = getActivePartyMemberStats(party, partyStats);
			expect(result).toBeUndefined();
		});
	});

	describe('getPartyMemberById', () => {
		beforeEach(() => {
			for (let i = 0; i < 2; i++) {
				const character = { ...initialCharacterState, name: `Hero ${i + 1}` };
				addPartyMember(party, character);
			}
		});

		it('should find party member by ID', () => {
			const targetId = party.members[1].id;
			const result = getPartyMemberById(party, targetId);
			
			expect(result?.id).toBe(targetId);
			expect(result?.character.name).toBe('Hero 2');
		});

		it('should return undefined for non-existent ID', () => {
			const result = getPartyMemberById(party, 'non_existent_id');
			expect(result).toBeUndefined();
		});
	});

	describe('updatePartyCharactersIdToNamesMap', () => {
		it('should map all party member IDs to names', () => {
			for (let i = 0; i < 3; i++) {
				const character = { ...initialCharacterState, name: `Hero ${i + 1}` };
				addPartyMember(party, character);
			}

			const nameMap: Record<string, string> = {};
			updatePartyCharactersIdToNamesMap(party, nameMap);

			expect(Object.keys(nameMap)).toHaveLength(3);
			expect(nameMap[party.members[0].id]).toBe('Hero 1');
			expect(nameMap[party.members[1].id]).toBe('Hero 2');
			expect(nameMap[party.members[2].id]).toBe('Hero 3');
		});

		it('should handle empty party', () => {
			const nameMap: Record<string, string> = {};
			updatePartyCharactersIdToNamesMap(party, nameMap);
			
			expect(Object.keys(nameMap)).toHaveLength(0);
		});
	});

	describe('Party member ID generation', () => {
		it('should generate unique IDs for multiple members', () => {
			for (let i = 0; i < 4; i++) {
				const character = { ...initialCharacterState, name: `Hero ${i + 1}` };
				addPartyMember(party, character);
			}

			const ids = party.members.map(m => m.id);
			const uniqueIds = new Set(ids);
			
			expect(uniqueIds.size).toBe(4);
		});
	});

	describe('Party state consistency', () => {
		it('should maintain active character when party is modified', () => {
			for (let i = 0; i < 3; i++) {
				const character = { ...initialCharacterState, name: `Hero ${i + 1}` };
				addPartyMember(party, character);
			}

			const initialActive = party.activeCharacterId;
			switchActiveCharacter(party, party.members[2].id);
			
			expect(party.activeCharacterId).not.toBe(initialActive);
			expect(party.activeCharacterId).toBe(party.members[2].id);
		});

		it('should handle adding stats for party members', () => {
			for (let i = 0; i < 2; i++) {
				const character = { ...initialCharacterState, name: `Hero ${i + 1}` };
				addPartyMember(party, character);
				
				partyStats.members.push({
					id: party.members[i].id,
					stats: { ...initialCharacterStatsState, level: i + 1 }
				});
			}

			expect(partyStats.members).toHaveLength(2);
			expect(partyStats.members[0].stats.level).toBe(1);
			expect(partyStats.members[1].stats.level).toBe(2);
		});
	});
});
