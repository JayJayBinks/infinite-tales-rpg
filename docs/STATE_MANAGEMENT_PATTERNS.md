# State Management Patterns

## Problem: Deep Mutations Don't Trigger Persistence

When using Svelte 5's `$state` runes with localStorage persistence, deep mutations of nested objects **do not trigger setters**, which means changes aren't saved to localStorage.

### ❌ BAD Pattern (Deep Mutation)

```typescript
// This DOES NOT trigger the setter!
partyState.value.members[0].character = newCharacter;

// Even this workaround is ugly and error-prone:
partyState.value = { ...partyState.value };  // Force setter trigger
```

**Why it fails:**
- Only the top-level assignment (`partyState.value = ...`) triggers the setter
- Mutating nested properties (`members[0].character = ...`) does NOT trigger it
- Changes are made in memory but NOT persisted to localStorage
- Leads to data loss on page refresh

## ✅ GOOD Pattern: Immutable Update Methods

Use dedicated update methods that create new objects and trigger setters automatically.

### PartyState Examples

```typescript
// ✅ Update a member's character
partyState.updateMemberCharacter('player_1', newCharacter);

// ✅ Update a member's stats
partyState.updateMemberStats('player_1', newStats);

// ✅ Set active character
partyState.setActiveCharacterId('player_2');

// ✅ Add a new member
partyState.addMember({ id: 'player_3', character: newCharacter });

// ✅ Update skills progression
partyState.setMemberSkillProgression('player_1', 'Swordsmanship', 10);
```

### GameState Examples

```typescript
// ✅ Add a game action
gameState.progression.addGameAction(newAction);

// ✅ Update current game action
gameState.progression.updateCurrentGameAction({ story: 'Updated story' });

// ✅ Update inventory
gameState.progression.updateInventoryItem('sword', 1);

// ✅ Update NPC
gameState.progression.updateNPC('goblin_1', npcData);

// ✅ Set player character state
gameState.progression.setPlayerCharacterGameState('player_1', characterState);
```

## Benefits of Immutable Updates

1. **Automatic Persistence**: Setter is always triggered, changes are saved
2. **Svelte Reactivity**: Reactive statements and derived values update properly
3. **Predictable**: Clear API makes it obvious how to update state
4. **Testable**: Easy to unit test update methods
5. **Type-Safe**: TypeScript enforces correct data shapes
6. **Debuggable**: Can log before/after state in one place

## Implementation Pattern

All store update methods follow this pattern:

```typescript
/**
 * Update nested data immutably
 */
updateNestedData(id: string, newData: DataType) {
	// Find the item to update
	const index = this._data.items.findIndex(item => item.id === id);
	if (index === -1) return;
	
	// Create new array with updated item
	this._data = {
		...this._data,
		items: this._data.items.map((item, i) =>
			i === index ? { ...item, ...newData } : item
		)
	};
	// Setter is triggered automatically, saves to localStorage
}
```

## Migration Guide

### Before (Bad)
```typescript
// Character creation page
partyState.value.members[currentCharacterIndex].character = newState;
partyState.value = { ...partyState.value };  // Force trigger
```

### After (Good)
```typescript
// Character creation page
const memberId = partyState.party.members[currentCharacterIndex].id;
partyState.updateMemberCharacter(memberId, newState);
```

## Available Update Methods

### PartyState
- `updateMemberCharacter(memberId, character)` - Update character description
- `updateMemberStats(memberId, stats)` - Update character stats
- `setActiveCharacterId(id)` - Set active character
- `addMember(member)` - Add new party member
- `addMemberStats(memberStats)` - Add new member stats
- `removeMember(memberId)` - Remove party member by ID
- `removeMemberStats(memberId)` - Remove party member stats by ID
- `setMemberActions(memberId, actions)` - Cache actions for member
- `setMemberEventEvaluation(memberId, evaluation)` - Set event evaluation
- `setMemberSkillProgression(memberId, skillName, progression)` - Update skill progression

### GameState.progression
- `addGameAction(action)` - Add new game action
- `updateCurrentGameAction(updates)` - Update latest game action
- `updateInventoryItem(itemId, quantity)` - Update inventory
- `updateNPC(npcId, npcData)` - Update NPC state
- `setPlayerCharacterGameState(characterId, state)` - Set character game state

## Testing

All update methods have unit tests verifying:
1. State is updated correctly
2. Immutability (new object created)
3. Other data unchanged
4. Persistence triggered

Run tests:
```bash
npm run test:unit -- src/lib/state/stores/partyState.test.ts
npm run test:unit -- src/lib/state/stores/gameState.test.ts
```

## Common Mistakes to Avoid

❌ **Direct mutation**
```typescript
partyState.party.members[0].character.name = "New Name";
```

❌ **Accessing via .value and mutating**
```typescript
partyState.value.members[0].character = newCharacter;
```

❌ **Manual spread workaround**
```typescript
partyState.value = { ...partyState.value };  // Don't do this
```

✅ **Use update methods**
```typescript
partyState.updateMemberCharacter(memberId, newCharacter);
```

## Summary

**Golden Rule**: Never mutate nested state directly. Always use the provided update methods that create new objects and trigger persistence automatically.

This pattern ensures:
- All state changes are persisted
- Svelte reactivity works correctly
- Code is predictable and maintainable
- Tests verify behavior
- TypeScript catches errors
