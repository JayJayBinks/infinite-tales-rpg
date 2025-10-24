# Game State Stores

## Overview

The state stores provide a centralized, organized way to manage game state. Instead of having 50+ state variables scattered in the main component, state is now organized into domain-specific stores.

## Store Architecture

```
stores/
├── index.ts                    - Unified facade (GameStores)
├── GameStateStore.svelte.ts    - Core game progression
├── CharacterStateStore.svelte.ts - Character & party data
├── CombatStateStore.svelte.ts  - Combat-specific state
├── AIStateStore.svelte.ts      - AI configuration
├── StoryStateStore.svelte.ts   - Story & narrative
├── InventoryStateStore.svelte.ts - Inventory items
├── EventStateStore.svelte.ts   - Character events
└── LevelUpStateStore.svelte.ts - Level-up state
```

## Usage

### Basic Usage

```typescript
import { GameStores } from './stores';

const stores = new GameStores();

// Access game state
const currentAction = stores.game.currentGameAction;

// Check if in party mode
if (stores.character.isPartyMode) {
  // Party-specific logic
}

// Check combat state
if (stores.combat.hasAnySelectedCombatActions()) {
  // Process combat
}
```

### Using Individual Stores

```typescript
import { GameStateStore, CharacterStateStore } from './stores';

const gameStore = new GameStateStore();
const characterStore = new CharacterStateStore();

// Use specific stores
gameStore.addGameAction(newAction);
```

## Store Details

### GameStateStore

Manages core game progression:
- Game actions history
- Current game action (derived)
- Chosen action
- Game ending state
- Story chunk (ephemeral UI state)

**Key Methods:**
- `addGameAction(action)` - Add action to history
- `updateCurrentGameAction(updates)` - Partial update
- `resetGameState()` - Reset all state
- `resetAfterActionProcessed()` - Reset ephemeral state

**Properties:**
- `gameActions` - Persisted action history
- `currentGameAction` - Getter for latest action
- `isGameEnded` - Game end state
- `storyChunk` - Current streaming story chunk (ephemeral)

### CharacterStateStore

Manages character and party data:
- Character descriptions (single & party)
- Character stats (single & party)
- Player character ID mapping
- Character actions (per member)
- Skills progression (per member)

**Key Methods:**
- `syncActiveCharacter()` - Call in $effect to sync party state
- `getActiveCharacterId(fallback)` - Get active character ID
- `resetCharacterState()` - Reset all character state

**Properties:**
- `character` - Current character description
- `characterStats` - Current character stats
- `party` - Party state
- `partyStats` - Party stats
- `isPartyMode` - Getter for party mode check
- `playerCharactersGameState` - Runtime resource state (ephemeral)

### CombatStateStore

Manages combat-specific state:
- NPC state
- Combat action selections (per member)
- Dice roll states
- Restraining states

**Key Methods:**
- `hasAnySelectedCombatActions()` - Check if any selected
- `resetCombatSelections()` - Reset after combat turn
- `resetCombatState()` - Reset all combat state

**Properties:**
- `npcState` - NPC data
- `selectedCombatActionsByMember` - Combat selections
- `selectedCombatActionsDiceAdditions` - Dice outcomes (ephemeral)
- `selectedCombatActionsLocked` - Lock state (ephemeral)

### AIStateStore

Manages AI configuration and state:
- API key, temperature, language
- System instructions
- AI processing state
- Thoughts state

**Key Methods:**
- `setGenerating(bool)` - Set AI generating state
- `resetAIState()` - Reset AI state

**Properties:**
- `apiKey` - API key for LLM
- `temperature` - LLM temperature
- `systemInstructions` - System instruction config
- `thoughts` - AI thoughts state
- `isAiGenerating` - Current generation state (ephemeral)

### StoryStateStore

Manages story and narrative state:
- Story state
- Campaign state & chapters
- History messages
- Related history
- Custom memories & GM notes

**Key Methods:**
- `resetStoryState()` - Reset all story state
- `resetHistoryAfterAction()` - Reset ephemeral history

**Properties:**
- `story` - Story state
- `campaign` - Campaign data
- `currentChapter` - Current chapter number
- `historyMessages` - LLM message history
- `customMemories` - User-defined memories

### InventoryStateStore

Manages inventory:
- Inventory items
- Item suggestions (ephemeral)

**Key Methods:**
- `resetInventoryState()` - Reset inventory

**Properties:**
- `inventory` - Inventory items
- `itemForSuggestActions` - Item for suggestions (ephemeral)

### EventStateStore

Manages character events:
- Event evaluations (transformations, abilities)
- Per-member event evaluations

**Key Methods:**
- `resetEventState()` - Reset event state

**Properties:**
- `eventEvaluation` - Current character event evaluation
- `eventEvaluationByMember` - Per-member evaluations

### LevelUpStateStore

Manages level-up state:
- Level-up button state
- Level-up dialog state
- Party-wide level-up status

**Key Methods:**
- `setButtonEnabled(bool)` - Enable/disable button
- `setMemberLevelUpStatus(id, bool)` - Set member status
- `anyMemberCanLevelUp()` - Check if any can level up
- `resetLevelUpState()` - Reset state

**Properties:**
- `levelUpState` - Level-up state

## Benefits Over Previous Approach

### Before (God Class)
```typescript
// 50+ scattered state variables in +page.svelte
const gameActionsState = useLocalStorage<GameActionState[]>('gameActionsState', []);
const characterState = useLocalStorage<CharacterDescription>('characterState', ...);
const npcState = useLocalStorage<NPCState>('npcState', {});
const inventoryState = useLocalStorage<InventoryState>('inventoryState', {});
// ... 46 more state variables
```

**Problems:**
- No organization
- Hard to understand relationships
- Difficult to reset related state
- No encapsulation

### After (Stores)
```typescript
// Organized, encapsulated stores
const stores = new GameStores();

// Clear domain boundaries
stores.game.currentGameAction
stores.character.isPartyMode
stores.combat.hasAnySelectedCombatActions()

// Easy to reset related state
stores.resetAfterActionProcessed() // Resets game, character, story ephemeral state
```

**Benefits:**
- Clear organization by domain
- Encapsulated logic
- Easy to test
- Better IntelliSense
- Single source of truth per domain

## Testing

Each store has comprehensive unit tests:

```bash
npm run test:unit -- src/routes/game/stores/
```

Tests cover:
- State initialization
- State mutations
- Derived properties
- Reset functionality
- Immutability

## Migration Guide

To migrate existing code to use stores:

### Step 1: Import stores
```typescript
import { GameStores } from './stores';
const stores = new GameStores();
```

### Step 2: Replace direct state access
```typescript
// Before
const currentAction = gameActionsState.value[gameActionsState.value.length - 1];

// After
const currentAction = stores.game.currentGameAction;
```

### Step 3: Replace state mutations
```typescript
// Before
gameActionsState.value = [...gameActionsState.value, newAction];

// After
stores.game.addGameAction(newAction);
```

### Step 4: Replace reset logic
```typescript
// Before
chosenActionState.reset();
additionalStoryInputState.reset();
characterActionsState.reset();
// ... many more

// After
stores.resetAfterActionProcessed();
```

## Next Steps

1. **Phase 2**: Create service layer that uses these stores
2. **Phase 3**: Refactor main component to use stores instead of direct state
3. **Phase 4**: Extract UI components
4. **Phase 5**: Implement event system

## Performance

Stores are lightweight and have minimal overhead:
- Reactive primitives use Svelte 5 runes
- No unnecessary re-renders
- Derived properties are computed efficiently
- LocalStorage operations are batched

## TypeScript Support

All stores have full TypeScript support:
- Type-safe properties
- Type-safe methods
- IntelliSense for all members
- Compile-time error checking
