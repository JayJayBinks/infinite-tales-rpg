# Infinite Tales RPG - Architecture Analysis & Refactoring Plan

## Executive Summary

This document provides an in-depth analysis of the current codebase pain points, focusing on the god class `src/routes/game/+page.svelte` (2,349 lines), and proposes a comprehensive refactoring plan to create a maintainable, extensible architecture.

## Current Architecture Pain Points

### 1. **God Class: `game/+page.svelte` (2,349 lines)**

#### Critical Issues:
- **Massive Complexity**: Contains ~70 functions, 50+ state variables, and handles multiple responsibilities
- **Poor Separation of Concerns**: UI rendering, business logic, AI orchestration, state management all intertwined
- **Testing Nightmare**: Impossible to unit test business logic without mounting the entire component
- **Maintenance Overhead**: Any change requires understanding the entire 2,349-line file
- **Cognitive Load**: Developers must keep massive context in mind to make any change

#### What It Does (Too Much):
1. **State Management** (40+ `useLocalStorage` calls)
   - Character state (single & party)
   - Game actions history
   - AI configuration
   - Combat state
   - Event evaluation
   - Skills progression
   - Inventory
   - Campaign state
   - NPC state
   - Level-up state
   - Dice roll state
   - Per-member caches

2. **UI Rendering**
   - Dynamic action button generation
   - Combat action selection
   - Story progression display
   - Modal management (10+ modals)
   - Resource display
   - Party member switching

3. **AI Orchestration**
   - Initializing 8 AI agents
   - Managing streaming responses
   - Coordinating multi-agent workflows
   - Error handling for AI failures

4. **Game Logic Coordination**
   - Action processing
   - Combat resolution
   - Level-up mechanics
   - Skill progression
   - Event evaluation
   - NPC management
   - Inventory management
   - Campaign progression

5. **Business Rules**
   - Dice roll requirements
   - Resource validation
   - Combat action selection
   - Game-ending conditions
   - Character transformations

### 2. **State Management Issues**

#### Pain Points:
- **50+ State Variables**: Difficult to track data flow
- **Mixed Concerns**: Persistent (`useLocalStorage`) and ephemeral (`$state`) mixed
- **No Single Source of Truth**: State scattered across component
- **Party vs Single Character**: Dual-mode state handling adds complexity
- **Reactive Effects**: Multiple `$effect` blocks with unclear dependencies
- **State Synchronization**: Manual syncing between party and character states (lines 181-190)

#### Examples of Complexity:
```typescript
// Character state duplication
const characterState = useLocalStorage<CharacterDescription>(...)
const partyState = useLocalStorage<Party>(...)

// Effect syncing them
$effect(() => {
  if (partyState.value.members.length > 0) {
    const activeMember = getActivePartyMember(partyState.value);
    characterState.value = activeMember.character;
  }
});
```

### 3. **Function Responsibilities Too Broad**

#### `sendAction` (Lines 1221-1363)
- 143 lines of orchestration
- Handles: dice rolls, combat, AI generation, history management, state updates
- Multiple async operations
- Error handling mixed with business logic
- Should be split into 5+ focused functions

#### `processStoryProgression` (Lines 978-1106)
- 128 lines
- Coordinates: AI generation, event evaluation, action generation, state updates
- Too many dependencies
- Hard to test

#### `initializeGameFromSavedState` (Lines 419-496)
- Complex initialization logic
- Resource initialization
- Action generation
- Dice roll handling
- Mixed concerns

### 4. **Tight Coupling**

#### Issues:
- UI components directly call AI agents
- Business logic embedded in event handlers
- State management mixed with rendering
- Hard-coded dependencies throughout
- No dependency injection

#### Example:
```typescript
// Tight coupling: UI event → Direct AI call → State mutation
onclick={() => {
  const result = await gameAgent.generateStoryProgression(...); // AI call
  gameActionsState.value = [...]; // State mutation
  renderGameState(...); // UI update
}}
```

### 5. **Missing Abstractions**

#### What's Missing:
1. **Game Session Manager**: Centralized control of game lifecycle
2. **Action Pipeline**: Clear flow for action processing
3. **State Store**: Centralized state management
4. **Event Bus**: Decoupled communication
5. **Service Layer**: Business logic abstraction
6. **View Models**: UI-specific data structures

### 6. **Testing Challenges**

#### Current State:
- Only 2 test files in routes/game: `gameLogic.test.ts`, `partyLogic.test.ts`
- Cannot test component logic without full DOM
- AI dependencies make testing difficult
- No mocking strategy
- Hard to test error scenarios

### 7. **Code Duplication**

#### Examples:
1. **Resource Initialization**: Duplicated in `onMount` and `initializeGameFromSavedState`
2. **Action Generation**: Similar code for party vs single character
3. **Event Evaluation**: Repeated patterns for different event types
4. **State Reset**: Multiple reset functions with overlapping logic

### 8. **Error Handling**

#### Pain Points:
- Inconsistent error handling patterns
- Some errors logged, some thrown, some ignored
- No centralized error management
- Recovery logic scattered
- User-facing errors mixed with system errors

### 9. **Performance Concerns**

#### Issues:
- Large component re-renders everything
- No virtual scrolling for history
- Inefficient state updates trigger cascading effects
- Memory leaks possible with event listeners (line 625)
- No memoization strategy

### 10. **Scalability Limitations**

#### Future Feature Challenges:
- **Multiplayer**: Impossible without major refactor
- **Save/Load Different Slots**: State management too coupled
- **Mod Support**: No plugin architecture
- **A/B Testing**: Hard to swap implementations
- **Performance Monitoring**: No instrumentation points

## Existing Good Patterns to Preserve

### 1. **Logic Files** (Already Separated)
These demonstrate the intended direction:
- `gameLogic.ts` - Pure functions for game rules
- `combatLogic.ts` - Combat calculations
- `levelLogic.ts` - XP and leveling
- `resourceLogic.ts` - Resource management
- `characterLogic.ts` - Character operations
- `partyLogic.ts` - Party management
- `campaignLogic.ts` - Campaign progression
- `memoryLogic.ts` - History retrieval
- `npcLogic.ts` - NPC handling
- `restrainingLogic.ts` - Status effects

**Strengths**:
- Pure, testable functions
- Clear responsibilities
- Good test coverage (some have .test.ts)
- Stateless operations

### 2. **AI Agents** (Well-Structured)
- Clear separation: GameAgent, CombatAgent, ActionAgent, etc.
- Consistent patterns
- Dependency injection via constructor
- Good for unit testing

### 3. **Component Library**
31 reusable Svelte components in `src/lib/components/`
- Modals for specific interactions
- Focused, single-purpose components

## Proposed Target Architecture

### Phase 1: Extract State Management (HIGHEST PRIORITY)

#### Create `GameStateStore.svelte.ts`
```typescript
// Centralized state with clear domain boundaries
export class GameStateStore {
  // Character & Party
  character = useLocalStorage<CharacterDescription>('characterState', ...)
  party = useLocalStorage<Party>('partyState', ...)
  
  // Game Progress
  gameActions = useLocalStorage<GameActionState[]>('gameActionsState', [])
  campaign = useLocalStorage<Campaign>('campaignState', ...)
  
  // AI Configuration
  aiConfig = useLocalStorage<AIConfig>('aiConfigState')
  
  // Derived states
  activeCharacter = $derived(this.getActiveCharacter())
  
  // Methods
  getActiveCharacter() { ... }
  updateCharacter(updates) { ... }
}
```

**Benefits**:
- Single source of truth
- Easier testing
- Clear data flow
- Encapsulated state operations

#### Create Domain-Specific Stores:
1. `CharacterStore.svelte.ts` - Character/party state
2. `CombatStore.svelte.ts` - Combat-specific state
3. `AIStore.svelte.ts` - AI configuration/state
4. `InventoryStore.svelte.ts` - Items/inventory

### Phase 2: Create Service Layer

#### `GameSessionService.ts`
```typescript
export class GameSessionService {
  constructor(
    private gameStore: GameStateStore,
    private gameAgent: GameAgent,
    private actionAgent: ActionAgent,
    // ... other dependencies
  ) {}
  
  async initializeGame() { ... }
  async loadGame() { ... }
  async processAction(action: Action) { ... }
  async endGame() { ... }
}
```

#### `ActionProcessingService.ts`
```typescript
export class ActionProcessingService {
  async processAction(action: Action): Promise<GameActionState> {
    // 1. Validate action
    // 2. Check dice roll requirement
    // 3. Process AI generation
    // 4. Update state
    // 5. Generate next actions
  }
  
  private async validateAction(action: Action) { ... }
  private async requiresDiceRoll(action: Action) { ... }
  private async processAI(action: Action) { ... }
}
```

#### `CombatService.ts`
```typescript
export class CombatService {
  async processCombatTurn(actions: Map<string, Action>) { ... }
  async resolveCombatActions() { ... }
  async checkCombatEnd() { ... }
}
```

**Benefits**:
- Testable business logic
- Clear responsibilities
- Reusable across UI components
- Easier to mock for testing

### Phase 3: Refactor Main Component

#### New `game/+page.svelte` Structure (Target: <500 lines)
```svelte
<script lang="ts">
  // 1. Services (injected)
  const gameSession = new GameSessionService(...)
  const actionProcessor = new ActionProcessingService(...)
  
  // 2. Stores (imported)
  const gameStore = new GameStateStore()
  
  // 3. UI State (component-local only)
  let showModal = $state(false)
  
  // 4. Event Handlers (delegate to services)
  async function handleAction(action: Action) {
    await actionProcessor.processAction(action)
  }
  
  // 5. Lifecycle
  onMount(() => gameSession.initialize())
</script>

<!-- 6. Template (presentation only) -->
<GameLayout>
  <StoryView story={gameStore.currentStory} />
  <ActionsPanel 
    actions={gameStore.availableActions}
    onAction={handleAction}
  />
</GameLayout>
```

**Benefits**:
- Readable, maintainable
- Clear data flow
- Easy to add features
- UI-focused

### Phase 4: Extract UI Components

#### Create Composite Components:
1. `GameLayout.svelte` - Main layout structure
2. `StoryView.svelte` - Story display & history
3. `ActionsPanel.svelte` - Action buttons & input
4. `CombatPanel.svelte` - Combat-specific UI
5. `CharacterSheet.svelte` - Character/party display
6. `ResourceDisplay.svelte` - Resources/stats

#### Refactor to Smart/Dumb Pattern:
- **Smart Components** (connected to stores): `GameLayout`, `ActionsPanel`
- **Dumb Components** (props only): `ActionButton`, `StoryText`, `ResourceBar`

### Phase 5: Implement Event System

#### `GameEventBus.ts`
```typescript
export class GameEventBus {
  private listeners = new Map()
  
  emit(event: GameEvent) { ... }
  on(eventType: string, handler: Function) { ... }
  off(eventType: string, handler: Function) { ... }
}

// Events
type GameEvent = 
  | { type: 'action.processed', payload: GameActionState }
  | { type: 'combat.started', payload: CombatState }
  | { type: 'character.levelup', payload: CharacterId }
  | { type: 'game.ended', payload: EndReason }
```

**Benefits**:
- Decoupled components
- Easy to add features
- Event logging/replay
- Analytics integration

### Phase 6: Add Middleware/Pipeline Pattern

#### Action Processing Pipeline:
```typescript
type ActionMiddleware = (
  action: Action,
  next: () => Promise<void>
) => Promise<void>

const pipeline = [
  validationMiddleware,
  diceRollMiddleware,
  aiProcessingMiddleware,
  stateUpdateMiddleware,
  eventEmissionMiddleware,
]

// Easy to add new steps
pipeline.push(analyticsMiddleware)
```

**Benefits**:
- Extensible
- Cross-cutting concerns (logging, analytics)
- Easy to test individual steps
- Clear flow

## Implementation Plan

### Step 1: Create State Stores (Week 1) ✅ COMPLETE
- [x] Create `GameStateStore.svelte.ts`
- [x] Create `CharacterStateStore.svelte.ts`
- [x] Create `CombatStateStore.svelte.ts`
- [x] Create `AIStateStore.svelte.ts`
- [x] Create `StoryStateStore.svelte.ts`
- [x] Create `InventoryStateStore.svelte.ts`
- [x] Create `EventStateStore.svelte.ts`
- [x] Create `LevelUpStateStore.svelte.ts`
- [x] Create unified `GameStores` facade
- [x] Add comprehensive tests for stores
- [x] Add documentation (stores/README.md)
- [ ] Migrate state from +page.svelte to stores (Phase 3)

### Step 2: Extract Services (Week 2)
- [ ] Create `GameSessionService.ts`
- [ ] Create `ActionProcessingService.ts`
- [ ] Create `CombatService.ts`
- [ ] Move business logic from component
- [ ] Add tests for services

### Step 3: Refactor Main Component (Week 3)
- [ ] Create new component structure
- [ ] Extract UI components
- [ ] Wire services and stores
- [ ] Ensure feature parity
- [ ] Add integration tests

### Step 4: Add Event System (Week 4)
- [ ] Create `GameEventBus.ts`
- [ ] Implement key events
- [ ] Migrate to event-based communication
- [ ] Add event logging

### Step 5: Cleanup & Documentation (Week 5)
- [ ] Remove old code
- [ ] Update documentation
- [ ] Performance testing
- [ ] Add architecture diagrams

## Detailed Refactoring Steps for God Class

### Immediate Wins (Low Risk, High Impact):

#### 1. Extract Modal Management
**Current**: 10+ modal refs and handlers in main component  
**Target**: `ModalManager.svelte.ts`
```typescript
export class ModalManager {
  private modals = new Map<string, { show: () => void, close: () => void }>()
  
  register(id: string, modal: Modal) { ... }
  show(id: string, props?: any) { ... }
  close(id: string) { ... }
}
```

#### 2. Extract Action Rendering
**Current**: `renderGameState()` and `addActionButton()` (lines 1364-1453)  
**Target**: `ActionRenderer.svelte.ts` or pure `ActionPanel.svelte` component

#### 3. Extract Initialization Logic
**Current**: `onMount` with 100+ lines (lines 323-417)  
**Target**: `GameInitializer.ts`
```typescript
export class GameInitializer {
  async initialize(savedState?: SavedGame) { ... }
  async initializeAgents() { ... }
  async initializeParty() { ... }
  async migrateStates() { ... }
}
```

#### 4. Extract State Reset Logic
**Current**: Multiple reset functions scattered  
**Target**: Centralize in stores with `reset()` methods

#### 5. Extract Custom Action Handling
**Current**: `onCustomActionSubmitted()` (lines 1516-1676)  
**Target**: `CustomActionHandler.ts`

### Medium Priority (Requires Coordination):

#### 1. Extract Combat Flow
**Current**: Combat logic scattered across sendAction, confirmCombatActions, etc.  
**Target**: `CombatOrchestrator.ts`

#### 2. Extract Event Evaluation Flow
**Current**: `applyGameEventEvaluationForMember()` and related  
**Target**: `EventProcessor.ts`

#### 3. Extract Level-Up Flow
**Current**: `checkForLevelUp()`, `levelUpClicked()`, etc.  
**Target**: `LevelUpService.ts`

### High Priority (Architecture Changes):

#### 1. Implement Action Pipeline
Replace massive `sendAction()` with composable pipeline

#### 2. Implement State Hydration/Serialization
Proper save/load system

#### 3. Implement Service Locator or DI
Remove hard-coded dependencies

## Testing Strategy

### Current Coverage:
- `gameLogic.test.ts`: Game rules
- `partyLogic.test.ts`: Party operations
- **Missing**: Component logic, service layer, integration tests

### Target Coverage:
1. **Unit Tests** (Stores, Services, Logic files)
   - State stores: 90%+ coverage
   - Services: 85%+ coverage
   - Logic files: Maintain/improve existing

2. **Component Tests** (UI components)
   - Render tests
   - Interaction tests
   - Accessibility tests

3. **Integration Tests** (Feature flows)
   - Action processing end-to-end
   - Combat resolution
   - Level-up flow
   - Party management

4. **E2E Tests** (Critical paths)
   - New game creation
   - Action execution
   - Game saving/loading

### Mocking Strategy:
```typescript
// Mock AI agents for testing
export class MockGameAgent implements IGameAgent {
  async generateStoryProgression() {
    return mockStoryData
  }
}

// Dependency injection for testing
export class ActionProcessingService {
  constructor(
    private gameAgent: IGameAgent, // Interface, not concrete
    private store: IGameStore
  ) {}
}
```

## Performance Improvements

### Current Issues:
1. Entire component re-renders on state change
2. Large DOM with 2000+ lines of story history
3. No virtualization

### Solutions:
1. **Split Components**: Smaller components = smaller re-renders
2. **Virtual Scrolling**: Only render visible story progressions
3. **Memoization**: `$derived` for expensive computations
4. **Lazy Loading**: Load old game actions on-demand
5. **Web Workers**: Move AI processing off main thread (future)

## Backward Compatibility

### Migration Strategy:
1. **Parallel Development**: New architecture alongside old
2. **Feature Flags**: Toggle between old/new implementation
3. **State Migration**: Automated migration of saved games
4. **Gradual Rollout**: Migrate features one-by-one

### State Migration:
```typescript
export function migrateToNewStateStructure(oldState: any) {
  return {
    character: oldState.characterState,
    party: oldState.partyState,
    // ... map old → new
  }
}
```

## Success Metrics

### Code Quality:
- [ ] Main component reduced from 2,349 → <500 lines
- [ ] Test coverage increased from ~10% → >75%
- [ ] No function >50 lines
- [ ] No file >300 lines (except stores)

### Maintainability:
- [ ] New feature can be added without touching +page.svelte
- [ ] Business logic changes don't require UI changes
- [ ] Clear ownership of code (service responsible for X)

### Performance:
- [ ] Initial render time improved
- [ ] Action processing time maintained or improved
- [ ] Memory usage reduced

## Risks & Mitigations

### Risk 1: Breaking Existing Functionality
**Mitigation**: 
- Comprehensive test suite before refactoring
- Feature flags for gradual rollout
- Parallel implementation

### Risk 2: Scope Creep
**Mitigation**:
- Strict phase boundaries
- No new features during refactor
- Regular stakeholder check-ins

### Risk 3: Performance Regression
**Mitigation**:
- Performance benchmarks before/after
- Profiling at each phase
- Rollback plan

### Risk 4: Team Disruption
**Mitigation**:
- Clear communication
- Documentation
- Pair programming for knowledge transfer

## Alternative Architectures Considered

### 1. **State Machine (e.g., XState)**
**Pros**: Clear state transitions, visual modeling  
**Cons**: Learning curve, may be overkill  
**Decision**: Not now, revisit if state complexity increases

### 2. **Redux/Flux Pattern**
**Pros**: Predictable state, time-travel debugging  
**Cons**: Boilerplate, not idiomatic for Svelte 5  
**Decision**: Use Svelte 5 runes + custom stores instead

### 3. **MVC vs MVVM**
**Pros**: Well-known patterns  
**Cons**: Doesn't leverage Svelte's reactivity  
**Decision**: Hybrid approach with Svelte-specific patterns

## Conclusion

The current architecture, dominated by a 2,349-line god class, is:
- **Hard to maintain**: Any change requires understanding entire file
- **Hard to test**: Business logic trapped in component
- **Hard to extend**: No clear extension points
- **Performance limited**: Monolithic re-renders

The proposed architecture:
- **Modular**: Clear separation of concerns
- **Testable**: Services and stores easily unit tested
- **Performant**: Smaller components, targeted re-renders
- **Extensible**: Clear patterns for adding features

**Recommended Approach**: Incremental refactoring over 5 weeks, starting with state management (highest ROI, lowest risk).

## Appendix: File Structure (Target)

```
src/routes/game/
├── +page.svelte (< 500 lines, UI only)
├── services/
│   ├── GameSessionService.ts
│   ├── ActionProcessingService.ts
│   ├── CombatService.ts
│   ├── LevelUpService.ts
│   └── EventProcessor.ts
├── stores/
│   ├── GameStateStore.svelte.ts
│   ├── CharacterStore.svelte.ts
│   ├── CombatStore.svelte.ts
│   ├── AIStore.svelte.ts
│   └── InventoryStore.svelte.ts
├── components/
│   ├── GameLayout.svelte
│   ├── StoryView.svelte
│   ├── ActionsPanel.svelte
│   ├── CombatPanel.svelte
│   └── CharacterSheet.svelte
├── utils/
│   ├── GameEventBus.ts
│   ├── ActionPipeline.ts
│   └── GameInitializer.ts
└── logic/ (existing, keep)
    ├── gameLogic.ts
    ├── combatLogic.ts
    └── ...
```

## Next Steps

1. **Review this document** with team
2. **Prioritize phases** based on team capacity
3. **Create detailed tasks** for Phase 1 (State Stores)
4. **Set up feature flags** for gradual migration
5. **Begin implementation** with state extraction

---

**Document Version**: 1.1  
**Date**: 2025-10-24  
**Author**: AI Architecture Analysis  
**Status**: Phase 1 Complete - Ready for Phase 2  
**Phase 1 Implementation**: See `PHASE_1_COMPLETE.md` for details
