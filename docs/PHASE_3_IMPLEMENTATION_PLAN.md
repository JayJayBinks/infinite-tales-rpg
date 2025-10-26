# Phase 3: Component Refactoring - Complete Implementation Plan

## Current State
- **File**: `src/routes/game/+page.svelte`
- **Lines**: 2455
- **State Variables**: 40+ `useLocalStorage` calls
- **AI Agents**: 9+ direct instantiations
- **Functions**: 70+ functions
- **UI Sections**: Multiple complex sections

## Target State
- **Lines**: <500 (target: 300-400)
- **State**: Use centralized stores
- **Services**: Use service layer for AI/logic
- **Components**: Extract UI into focused components

## Refactoring Phases

### Phase 3.1: State Migration (PRIORITY)
Replace all `useLocalStorage` calls with store imports.

**Batch 1: AI Configuration (4 variables)**
```typescript
// Before
const apiKeyState = useLocalStorage<string>('apiKeyState');
const temperatureState = useLocalStorage<number>('temperatureState');
const systemInstructionsState = useLocalStorage<SystemInstructionsState>(...);
const aiLanguage = useLocalStorage<string>('aiLanguage');

// After
import { aiStateStore } from '$lib/state/stores';
// Use aiStateStore.apiKey, .temperature, .systemInstructions, .language
```

**Batch 2: Character State (2 variables)**
```typescript
// Before
const characterState = useLocalStorage<CharacterDescription>(...);
const characterStatsState = useLocalStorage<CharacterStats>(...);

// After
import { characterStateStore } from '$lib/state/stores';
// Use characterStateStore.character, .characterStats
```

**Batch 3: Story State (4 variables)**
```typescript
// Before
const storyState = useLocalStorage<Story>('storyState', initialStoryState);
const relatedStoryHistoryState = useLocalStorage<RelatedStoryHistory>(...);
const customMemoriesState = useLocalStorage<string>('customMemoriesState');
const customGMNotesState = useLocalStorage<string>('customGMNotesState');

// After
import { storyStateStore } from '$lib/state/stores';
// Use storyStateStore.story, .relatedStoryHistory, .customMemories, .customGMNotes
```

**Batch 4: Game State (12 variables)**
```typescript
// Before
const gameActionsState = useLocalStorage<GameActionState[]>(...);
const isGameEnded = useLocalStorage<boolean>('isGameEnded', false);
const npcState = useLocalStorage<NPCState>('npcState', {});
const historyMessagesState = useLocalStorage<LLMMessage[]>(...);
// ... and 8 more

// After
import { gameState } from '$lib/state/stores';
// Use gameState.progression.*, gameState.memory.*, gameState.campaign.*, gameState.input.*
```

**Batch 5: Party State (6 variables)**
```typescript
// Before
const partyState = useLocalStorage<Party>('partyState', initialPartyState);
const partyStatsState = useLocalStorage<PartyStats>(...);
const characterActionsByMemberState = useLocalStorage<Record<string, Action[]>>(...);
// ... and 3 more

// After
import { partyState as partyStateStore } from '$lib/state/stores';
// Use partyStateStore.party, .partyStats, .characterActionsByMember, etc.
```

**Batch 6: Combat State (2 variables)**
```typescript
// Before
const selectedCombatActionsByMemberState = useLocalStorage<Record<string, Action | null>>(...);
const chosenActionState = useLocalStorage<Action>(...);

// After
import { combatState } from '$lib/state/stores';
// Use combatState.selectedActionsByMember
```

**Batch 7: Event & Level Up State (3 variables)**
```typescript
// Before
const eventEvaluationState = useLocalStorage<EventEvaluation>(...);
const eventEvaluationByMemberState = useLocalStorage<Record<string, EventEvaluation>>(...);
const levelUpState = useLocalStorage<{...}>(...);

// After
import { eventStateStore, levelUpStateStore } from '$lib/state/stores';
// Use eventStateStore.*, levelUpStateStore.*
```

**Batch 8: Inventory State (1 variable)**
```typescript
// Before
const inventoryState = useLocalStorage<InventoryState>('inventoryState', {});

// After
import { inventoryStateStore } from '$lib/state/stores';
// Use inventoryStateStore.inventory
```

### Phase 3.2: Service Integration
Replace direct AI agent instantiation with service layer.

**Step 1: Initialize Services**
```typescript
import { aiService, gameSessionService, actionProcessingService } from '$lib/services';

// Initialize on mount
onMount(() => {
  aiService.initialize({
    apiKey: aiStateStore.apiKey.value,
    temperature: aiStateStore.temperature.value,
    systemInstructions: aiStateStore.systemInstructions.value,
    aiLanguage: aiStateStore.language.value
  });
  gameSessionService.initialize(aiService, actionService);
});
```

**Step 2: Replace Agent Calls**
```typescript
// Before
const gameAgent = new GameAgent(llmProvider);
const result = await gameAgent.generateStory(...);

// After
const gameAgent = aiService.getGameAgent();
const result = await gameAgent.generateStory(...);
```

### Phase 3.3: UI Component Extraction

**Component 1: StoryDisplay.svelte**
- Story rendering
- Image display
- TTS integration
- ~200 lines extracted

**Component 2: ActionsPanel.svelte**
- Action buttons
- Custom action input
- Utility actions
- ~250 lines extracted

**Component 3: CombatPanel.svelte**
- Combat action selection
- Dice rolling
- Combat status
- ~200 lines extracted

**Component 4: StatusBar.svelte**
- Resources display
- Party member switcher
- Level up button
- ~150 lines extracted

**Component 5: GameModals.svelte**
- All modal components
- Dialog management
- ~300 lines extracted

### Phase 3.4: Business Logic Simplification

**Delegate to Services**:
- Action processing → ActionProcessingService
- Combat flow → CombatService
- Event handling → EventProcessorService
- Session management → GameSessionService

**Keep in Component**:
- UI state management
- User interactions
- Component lifecycle
- Rendering logic

## Implementation Strategy

### Step-by-Step Approach

1. **Checkpoint 0**: Run all tests, ensure 216/217 passing ✅

2. **Checkpoint 1**: Migrate AI state (Batch 1)
   - Replace 4 variables
   - Update all references
   - Run tests

3. **Checkpoint 2**: Migrate Character state (Batch 2)
   - Replace 2 variables
   - Update all references
   - Run tests

4. **Checkpoint 3**: Migrate Story state (Batch 3)
   - Replace 4 variables
   - Update all references
   - Run tests

5. **Checkpoint 4**: Migrate Game state (Batch 4)
   - Replace 12 variables
   - Update all references
   - Run tests

6. **Checkpoint 5**: Migrate Party state (Batch 5)
   - Replace 6 variables
   - Update all references
   - Run tests

7. **Checkpoint 6**: Migrate Combat state (Batch 6)
   - Replace 2 variables
   - Update all references
   - Run tests

8. **Checkpoint 7**: Migrate Event/LevelUp state (Batch 7)
   - Replace 3 variables
   - Update all references
   - Run tests

9. **Checkpoint 8**: Migrate Inventory state (Batch 8)
   - Replace 1 variable
   - Update all references
   - Run tests

10. **Checkpoint 9**: Integrate Services
    - Initialize service layer
    - Replace agent instantiation
    - Run tests

11. **Checkpoint 10**: Extract StoryDisplay component
    - Create component
    - Move story rendering logic
    - Update parent
    - Run tests

12. **Checkpoint 11**: Extract ActionsPanel component
    - Create component
    - Move action logic
    - Update parent
    - Run tests

13. **Checkpoint 12**: Extract CombatPanel component
    - Create component
    - Move combat UI
    - Update parent
    - Run tests

14. **Checkpoint 13**: Extract StatusBar component
    - Create component
    - Move status logic
    - Update parent
    - Run tests

15. **Checkpoint 14**: Extract GameModals component
    - Create component
    - Move modals
    - Update parent
    - Run tests

16. **Final Checkpoint**: Verify all tests pass, measure line reduction

## Success Criteria

- ✅ All tests passing (216/217 minimum)
- ✅ Main component <500 lines (target: 300-400)
- ✅ No functionality regression
- ✅ Cleaner, more maintainable code
- ✅ Components are independently testable

## Risk Mitigation

1. **Incremental Changes**: Each checkpoint is small and testable
2. **Test After Each Step**: Catch regressions immediately
3. **Git Commits**: Can revert if needed
4. **Type Safety**: TypeScript will catch most issues
5. **Keep Original Logic**: Don't change behavior, just reorganize

## Estimated Impact

- **Before**: 2455 lines, 40+ state vars, 70+ functions
- **After**: ~350 lines main + 5 components (~1100 lines total)
- **Reduction**: ~45% fewer lines in main component
- **Maintainability**: Much improved (focused components)
- **Testability**: Each component independently testable
