# Party System Implementation Guide

## Overview

This document details the refactoring from a single character system to a party-based system supporting 4 characters.

## Completed Work

### 1. Data Structures (✅ Complete)

#### New Types Added

- `Party` - Container for party members with active character tracking
- `PartyMember` - Individual party member with id and character description
- `PartyStats` - Container for all party member stats
- `PartyMemberStats` - Stats for individual party member

#### Files Modified

- `src/lib/ai/agents/characterAgent.ts` - Added party types and `generatePartyDescriptions()` method
- `src/lib/ai/agents/characterStatsAgent.ts` - Added party stats types and `generatePartyStats()` method
- `src/routes/game/partyLogic.ts` - New file with party helper functions

### 2. Character Generation (✅ Complete)

#### Updated Pages

- `/game/new/character/+page.svelte`

  - Added party state tracking
  - Added character switcher tabs
  - Added "Randomize Entire Party" button
  - Added individual character randomization
  - Updates party state when navigating away

- `/game/new/characterStats/+page.svelte`
  - Added party stats state
  - Added `onRandomizePartyStats()` method
  - Added character stats switcher
  - Syncs stats with party state

### 3. Main Game Integration (🔄 Partial)

#### Updated Files

- `src/routes/game/+page.svelte`
  - Imported party types and helpers
  - Added `partyState` and `partyStatsState`
  - Added effect to sync character state with active party member
  - Changed skills progression to track per member

## Remaining Work

### Critical Path Items

#### 1. Party Initialization in Main Game (HIGH PRIORITY)

The main game page needs to initialize party/partyStats from character generation:

```typescript
// In onMount or effect:
if (partyState.value.members.length > 0) {
	// Initialize playerCharactersGameState for all party members
	for (const member of partyState.value.members) {
		const memberStats = partyStatsState.value.members.find((m) => m.id === member.id)?.stats;
		if (memberStats && !playerCharactersGameState[member.id]) {
			playerCharactersGameState[member.id] = {
				...memberStats.resources
			};
			// Convert resources to have current_value
			for (const [key, resource] of Object.entries(memberStats.resources)) {
				playerCharactersGameState[member.id][key] = {
					max_value: resource.max_value,
					current_value: resource.start_value,
					game_ends_when_zero: resource.game_ends_when_zero
				};
			}
		}
	}

	// Update playerCharactersIdToNamesMapState
	updatePlayerCharactersIdToNamesMapForParty(
		partyState.value,
		playerCharactersIdToNamesMapState.value
	);
}
```

#### 2. Action Generation for Party (HIGH PRIORITY)

Update action generation to consider all party members:

**File**: `src/lib/ai/agents/actionAgent.ts`

- Modify `generateActions()` to accept party information
- Generate actions contextual to all party members
- Consider which character is best suited for each action

**File**: `src/routes/game/+page.svelte`

- Pass party state to action generation
- Display which character performs each action
- Allow switching active character before action selection

#### 3. Stats Updates for Party Members (HIGH PRIORITY)

**File**: `src/routes/game/gameLogic.ts` - Already handles this via `playerCharactersIdToNamesMapState`

- Stats updates use character name to find ID
- Need to ensure party member names are registered correctly
- Add validation that stats update targets exist in party

#### 4. Skills Progression per Party Member (MEDIUM PRIORITY)

**Current**: Single skills progression object
**Needed**: Skills progression keyed by party member ID

```typescript
// Update locations using skillsProgressionState:
const currentMemberId = partyState.value.activeCharacterId;
const currentMemberSkills = skillsProgressionState.value[currentMemberId] || {};

// When updating skills:
if (!skillsProgressionState.value[currentMemberId]) {
	skillsProgressionState.value[currentMemberId] = {};
}
skillsProgressionState.value[currentMemberId][skillName] = progression;
```

Files to update:

- Character page displaying skills progression
- Level up logic
- Skill progression tracking during actions

#### 5. Resource Display (MEDIUM PRIORITY)

**File**: `src/lib/components/ResourcesComponent.svelte`

- Currently displays single character resources
- Should display active party member resources
- Optionally show all party member health bars

#### 6. Abilities & Spells (MEDIUM PRIORITY)

**File**: `src/lib/components/interaction_modals/UseSpellsAbilitiesModal.svelte`

- Display abilities for active character
- Optionally show dropdown to select which party member casts
- Deduct resources from correct party member

**File**: `src/lib/components/interaction_modals/UseItemsModal.svelte`

- Items could be party-wide (current approach)
- Or allow targeting which party member uses item

#### 7. Character Sheet Page (LOW PRIORITY)

**File**: `src/routes/game/character/+page.svelte`

- Add party overview tab
- Show all party members' basic info
- Allow switching between detailed views

#### 8. Party Switcher UI Component (MEDIUM PRIORITY)

Create a reusable component for switching active character:

```svelte
<!-- PartyMemberSwitcher.svelte -->
<script>
	import { switchActiveCharacter } from './partyLogic';
	let { party, onSwitch } = $props();
</script>

<div class="party-switcher">
	{#each party.members as member}
		<button
			class:active={party.activeCharacterId === member.id}
			onclick={() => {
				switchActiveCharacter(party, member.id);
				onSwitch?.();
			}}
		>
			{member.character.name}
		</button>
	{/each}
</div>
```

#### 9. AI Prompt Updates (HIGH PRIORITY)

Update prompts in these agents to include party context:

**GameAgent** (`src/lib/ai/agents/gameAgent.ts`):

```typescript
// Add to system instructions:
`The player controls a party of ${party.members.length} characters:
${party.members.map((m) => `- ${m.character.name} (${m.character.class})`).join('\n')}

Currently active character: ${activeCharacter.name}

Consider all party members when generating story and determining consequences.`;
```

**ActionAgent** (`src/lib/ai/agents/actionAgent.ts`):

```typescript
// Include party member information:
`Generate actions for the entire party. For each action, specify which party member(s) perform it.
Party members:
${party.members.map((m) => `- ${m.character.name}: ${m.character.class}, Level ${getMemberStats(m).level}`).join('\n')}`;
```

**CombatAgent** (`src/lib/ai/agents/combatAgent.ts`):

```typescript
// Already partially supports this via playerCharactersGameState
// Ensure all party members are included in combat logic
```

#### 10. Character Transformation (LOW PRIORITY)

**File**: `src/routes/game/characterLogic.ts` - `applyCharacterChange()`

- Add party member ID parameter
- Update correct party member when transformation occurs
- Update party state, not just character state

#### 11. Level Up for Party Members (MEDIUM PRIORITY)

**Files**:

- `src/routes/game/levelLogic.ts`
- Level up modal component

Changes:

- Check XP for all party members
- Allow leveling up any party member
- Show which character can level up
- Update correct party member stats

#### 12. Migration Logic (HIGH PRIORITY)

**File**: `src/lib/state/versionMigration.ts`

Add migration to convert single character saves to party:

```typescript
export function migrateToPartySystem(
	characterState: CharacterDescription,
	characterStatsState: CharacterStats
): { party: Party; partyStats: PartyStats } {
	const party: Party = {
		members: [
			{
				id: 'player_character_1',
				character: characterState
			}
		],
		activeCharacterId: 'player_character_1'
	};

	const partyStats: PartyStats = {
		members: [
			{
				id: 'player_character_1',
				stats: characterStatsState
			}
		]
	};

	// Initialize 3 additional empty slots
	for (let i = 2; i <= 4; i++) {
		const id = `player_character_${i}`;
		party.members.push({
			id,
			character: { ...initialCharacterState }
		});
		partyStats.members.push({
			id,
			stats: { ...initialCharacterStatsState }
		});
	}

	return { party, partyStats };
}
```

### Testing Checklist

- [ ] Generate new party of 4 characters
- [ ] Navigate through all character generation steps
- [ ] Start game with party
- [ ] Verify all party member resources initialize
- [ ] Test action generation with party
- [ ] Switch active character
- [ ] Use abilities from different party members
- [ ] Verify stats updates apply to correct member
- [ ] Test combat with party
- [ ] Test level up for party members
- [ ] Test character transformation in party
- [ ] Verify old saves migrate correctly
- [ ] Test inventory with party
- [ ] Verify skills progression per member
- [ ] Test quest/story progression with party

### API/Agent Updates Needed

#### Action Agent

- Pass party info to action generation
- Generate party-appropriate actions
- Specify which character performs action

#### Game Agent

- Include all party members in prompts
- Consider party composition in story
- Handle party-wide effects

#### Combat Agent

- Already handles multiple characters via playerCharactersGameState
- Verify all party members included in combat

#### Character Stats Agent

- Already has generatePartyStats() ✅
- Test with actual party generation

#### Story Agent

- Include party context in story generation
- Reference multiple party members in narration

## Architecture Notes

### Character ID System

- Party members use IDs: `player_character_1` through `player_character_4`
- `playerCharactersIdToNamesMapState` maps IDs to known names
- `playerCharactersGameState` maps IDs to current resources
- This allows characters to be renamed/transformed while maintaining identity

### State Synchronization

- `characterState` and `characterStatsState` represent the ACTIVE character
- These sync with the active party member via `$effect`
- When switching characters, states update automatically
- Party state is the source of truth

### Backward Compatibility

- Old saves use single character
- Migration creates party with 1 character + 3 empty slots
- Empty slots can be filled later (potential feature)
- All existing logic works with single-character parties

## Quick Start for Developers

1. **To generate a party**: Go to `/game/new/character`, click "Randomize Entire Party"
2. **To switch active character in code**:
   ```typescript
   switchActiveCharacter(partyState.value, memberId);
   ```
3. **To get active character stats**:
   ```typescript
   const activeStats = getActivePartyMemberStats(partyState.value, partyStatsState.value);
   ```
4. **To update a party member**:
   ```typescript
   updatePartyMemberCharacter(partyState.value, memberId, newCharacter);
   updatePartyMemberStats(partyStatsState.value, memberId, newStats);
   ```

## Known Issues

1. Skills progression needs update to per-member tracking
2. Action generation doesn't yet consider party context
3. UI doesn't show party member switcher in main game
4. Character sheet page shows only active character
5. Level up only checks active character
6. AI prompts don't include full party context

## Next Steps Priority

1. **Add party initialization** in main game onMount
2. **Update action generation** to include party
3. **Add party member switcher UI** to main game
4. **Update AI prompts** for party context
5. **Test and fix** skills progression per member
6. **Add migration** for old saves
7. **Update character sheet** for party overview
8. **Test full flow** end-to-end
