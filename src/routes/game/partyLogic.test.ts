import { describe, it, expect, beforeEach } from 'vitest';
import {
createPartyFromCharacters,
switchActiveCharacter,
getActivePartyMember,
getActivePartyMemberStats,
getPartyMemberById,
updatePlayerCharactersIdToNamesMapForParty,
getAllPartyCharacterNames,
getPartyMemberByCharacterName,
updatePartyMemberCharacter,
updatePartyMemberStats
} from './partyLogic';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { PartyStats, CharacterStats } from '$lib/ai/agents/characterStatsAgent';
import type { Party } from '$lib/types/party';
import { initialCharacterState } from '$lib/ai/agents/characterAgent';
import { initialCharacterStatsState } from '$lib/ai/agents/characterStatsAgent';
import type { PlayerCharactersIdToNamesMap } from '$lib/ai/agents/gameAgent';

describe('Party Logic', () => {
let party: Party;
let partyStats: PartyStats;

beforeEach(() => {
party = { members: [], activeCharacterId: '' };
partyStats = { members: [] };
});

describe('createPartyFromCharacters', () => {
it('should create an empty party with no active character for empty arrays', () => {
const { party: newParty, partyStats: newStats } = createPartyFromCharacters([], []);
expect(newParty.members).toEqual([]);
expect(newParty.activeCharacterId).toBe('');
expect(newStats.members).toEqual([]);
});

it('should create a party with unique IDs for each character', () => {
const characters = [
{ ...initialCharacterState, name: 'Test Hero' },
{ ...initialCharacterState, name: 'Second Hero' }
];
const stats = [initialCharacterStatsState, initialCharacterStatsState];

const { party, partyStats } = createPartyFromCharacters(characters, stats);

expect(party.members).toHaveLength(2);
expect(party.members[0].character.name).toBe('Test Hero');
expect(party.members[0].id).toBe('player_character_1');
expect(party.members[1].id).toBe('player_character_2');
expect(partyStats.members).toHaveLength(2);
});

it('should set first member as active character', () => {
const characters = [{ ...initialCharacterState, name: 'First Hero' }];
const stats = [initialCharacterStatsState];

const { party } = createPartyFromCharacters(characters, stats);

expect(party.activeCharacterId).toBe(party.members[0].id);
});

it('should create up to 4 party members', () => {
const characters = Array(4).fill(null).map((_, i) => ({
...initialCharacterState,
name: `Hero ${i + 1}`
}));
const stats = Array(4).fill(initialCharacterStatsState);

const { party } = createPartyFromCharacters(characters, stats);

expect(party.members).toHaveLength(4);
});
});

describe('switchActiveCharacter', () => {
beforeEach(() => {
const characters = Array(3).fill(null).map((_, i) => ({
...initialCharacterState,
name: `Hero ${i + 1}`
}));
const stats = Array(3).fill(initialCharacterStatsState);
({ party, partyStats } = createPartyFromCharacters(characters, stats));
});

it('should switch to an existing party member', () => {
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
const characters = [{ ...initialCharacterState, name: 'Active Hero' }];
const stats = [initialCharacterStatsState];
({ party } = createPartyFromCharacters(characters, stats));

const result = getActivePartyMember(party);
expect(result?.character.name).toBe('Active Hero');
});
});

describe('getActivePartyMemberStats', () => {
beforeEach(() => {
const characters = [{ ...initialCharacterState, name: 'Hero' }];
const statsData: CharacterStats[] = [{ ...initialCharacterStatsState, level: 5 }];
({ party, partyStats } = createPartyFromCharacters(characters, statsData));
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
const characters = Array(2).fill(null).map((_, i) => ({
...initialCharacterState,
name: `Hero ${i + 1}`
}));
const stats = Array(2).fill(initialCharacterStatsState);
({ party } = createPartyFromCharacters(characters, stats));
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

describe('updatePlayerCharactersIdToNamesMapForParty', () => {
it('should map all party member IDs to names', () => {
const characters = Array(3).fill(null).map((_, i) => ({
...initialCharacterState,
name: `Hero ${i + 1}`
}));
const stats = Array(3).fill(initialCharacterStatsState);
({ party } = createPartyFromCharacters(characters, stats));

const nameMap: PlayerCharactersIdToNamesMap = {};
updatePlayerCharactersIdToNamesMapForParty(party, nameMap);

expect(Object.keys(nameMap)).toHaveLength(3);
expect(nameMap[party.members[0].id]).toContain('Hero 1');
expect(nameMap[party.members[1].id]).toContain('Hero 2');
expect(nameMap[party.members[2].id]).toContain('Hero 3');
});

it('should handle empty party', () => {
const nameMap: PlayerCharactersIdToNamesMap = {};
updatePlayerCharactersIdToNamesMapForParty(party, nameMap);

expect(Object.keys(nameMap)).toHaveLength(0);
});
});

describe('getAllPartyCharacterNames', () => {
it('should return all character names', () => {
const characters = Array(3).fill(null).map((_, i) => ({
...initialCharacterState,
name: `Hero ${i + 1}`
}));
const stats = Array(3).fill(initialCharacterStatsState);
({ party } = createPartyFromCharacters(characters, stats));

const names = getAllPartyCharacterNames(party);

expect(names).toEqual(['Hero 1', 'Hero 2', 'Hero 3']);
});

it('should return empty array for empty party', () => {
const names = getAllPartyCharacterNames(party);
expect(names).toEqual([]);
});
});

describe('getPartyMemberByCharacterName', () => {
beforeEach(() => {
const characters = Array(2).fill(null).map((_, i) => ({
...initialCharacterState,
name: `Hero ${i + 1}`
}));
const stats = Array(2).fill(initialCharacterStatsState);
({ party } = createPartyFromCharacters(characters, stats));
});

it('should find party member by character name', () => {
const result = getPartyMemberByCharacterName(party, 'Hero 2');

expect(result?.character.name).toBe('Hero 2');
expect(result?.id).toBe('player_character_2');
});

it('should return undefined for non-existent character name', () => {
const result = getPartyMemberByCharacterName(party, 'Non Existent');
expect(result).toBeUndefined();
});
});

describe('updatePartyMemberCharacter', () => {
beforeEach(() => {
const characters = [{ ...initialCharacterState, name: 'Original' }];
const stats = [initialCharacterStatsState];
({ party } = createPartyFromCharacters(characters, stats));
});

it('should update character for a party member', () => {
const updatedCharacter: CharacterDescription = {
...initialCharacterState,
name: 'Updated Hero'
};

updatePartyMemberCharacter(party, party.members[0].id, updatedCharacter);

expect(party.members[0].character.name).toBe('Updated Hero');
});

it('should not update non-existent member', () => {
const updatedCharacter: CharacterDescription = {
...initialCharacterState,
name: 'Updated'
};

updatePartyMemberCharacter(party, 'non_existent_id', updatedCharacter);

// Original should be unchanged
expect(party.members[0].character.name).toBe('Original');
});
});

describe('updatePartyMemberStats', () => {
beforeEach(() => {
const characters = [{ ...initialCharacterState, name: 'Hero' }];
const statsData: CharacterStats[] = [{ ...initialCharacterStatsState, level: 1 }];
({ party, partyStats } = createPartyFromCharacters(characters, statsData));
});

it('should update stats for a party member', () => {
const updatedStats: CharacterStats = {
...initialCharacterStatsState,
level: 10
};

updatePartyMemberStats(partyStats, party.members[0].id, updatedStats);

expect(partyStats.members[0].stats.level).toBe(10);
});

it('should not update non-existent member stats', () => {
const updatedStats: CharacterStats = {
...initialCharacterStatsState,
level: 10
};

updatePartyMemberStats(partyStats, 'non_existent_id', updatedStats);

// Original should be unchanged
expect(partyStats.members[0].stats.level).toBe(1);
});
});

describe('Party member ID generation', () => {
it('should generate unique IDs for multiple members', () => {
const characters = Array(4).fill(null).map((_, i) => ({
...initialCharacterState,
name: `Hero ${i + 1}`
}));
const stats = Array(4).fill(initialCharacterStatsState);
({ party } = createPartyFromCharacters(characters, stats));

const ids = party.members.map(m => m.id);
const uniqueIds = new Set(ids);

expect(uniqueIds.size).toBe(4);
expect(ids).toEqual([
'player_character_1',
'player_character_2',
'player_character_3',
'player_character_4'
]);
});
});

describe('Party state consistency', () => {
it('should maintain active character when party is modified', () => {
const characters = Array(3).fill(null).map((_, i) => ({
...initialCharacterState,
name: `Hero ${i + 1}`
}));
const stats = Array(3).fill(initialCharacterStatsState);
({ party } = createPartyFromCharacters(characters, stats));

const initialActive = party.activeCharacterId;
switchActiveCharacter(party, party.members[2].id);

expect(party.activeCharacterId).not.toBe(initialActive);
expect(party.activeCharacterId).toBe(party.members[2].id);
});

it('should handle adding stats for party members', () => {
const characters = Array(2).fill(null).map((_, i) => ({
...initialCharacterState,
name: `Hero ${i + 1}`
}));
const statsData = Array(2).fill(null).map((_, i) => ({
...initialCharacterStatsState,
level: i + 1
}));
({ party, partyStats } = createPartyFromCharacters(characters, statsData));

expect(partyStats.members).toHaveLength(2);
expect(partyStats.members[0].stats.level).toBe(1);
expect(partyStats.members[1].stats.level).toBe(2);
});
});
});
