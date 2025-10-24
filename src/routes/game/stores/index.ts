/**
 * GameStores - Unified facade for all game state stores
 *
 * This provides a single entry point for accessing all game state.
 * Instead of importing individual stores, components can import this
 * and access all state through a single object.
 *
 * Usage:
 *   const stores = new GameStores()
 *   stores.game.currentGameAction
 *   stores.character.isPartyMode
 *   stores.combat.hasAnySelectedCombatActions()
 */

import { GameStateStore } from './GameStateStore.svelte';
import { CharacterStateStore } from './CharacterStateStore.svelte';
import { CombatStateStore } from './CombatStateStore.svelte';
import { AIStateStore } from './AIStateStore.svelte';
import { StoryStateStore } from './StoryStateStore.svelte';
import { InventoryStateStore } from './InventoryStateStore.svelte';
import { EventStateStore } from './EventStateStore.svelte';
import { LevelUpStateStore } from './LevelUpStateStore.svelte';

export class GameStores {
	readonly game: GameStateStore;
	readonly character: CharacterStateStore;
	readonly combat: CombatStateStore;
	readonly ai: AIStateStore;
	readonly story: StoryStateStore;
	readonly inventory: InventoryStateStore;
	readonly event: EventStateStore;
	readonly levelUp: LevelUpStateStore;

	constructor() {
		this.game = new GameStateStore();
		this.character = new CharacterStateStore();
		this.combat = new CombatStateStore();
		this.ai = new AIStateStore();
		this.story = new StoryStateStore();
		this.inventory = new InventoryStateStore();
		this.event = new EventStateStore();
		this.levelUp = new LevelUpStateStore();
	}

	/**
	 * Reset all state (for new game)
	 */
	resetAllStores(): void {
		this.game.resetGameState();
		this.character.resetCharacterState();
		this.combat.resetCombatState();
		this.ai.resetAIState();
		this.story.resetStoryState();
		this.inventory.resetInventoryState();
		this.event.resetEventState();
		this.levelUp.resetLevelUpState();
	}

	/**
	 * Reset ephemeral state after action processed
	 */
	resetAfterActionProcessed(): void {
		this.game.resetAfterActionProcessed();
		this.character.resetActionsAfterProcessed();
		this.story.resetHistoryAfterAction();
	}

	/**
	 * Reset ephemeral state after actions generated
	 */
	resetAfterActionsGenerated(): void {
		this.game.resetAfterActionsGenerated();
	}
}

// Export individual stores for cases where only one is needed
export {
	GameStateStore,
	CharacterStateStore,
	CombatStateStore,
	AIStateStore,
	StoryStateStore,
	InventoryStateStore,
	EventStateStore,
	LevelUpStateStore
};
