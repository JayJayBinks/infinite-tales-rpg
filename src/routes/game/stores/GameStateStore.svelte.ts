/**
 * GameStateStore - Centralized state management for game progression
 *
 * This store manages the core game state including:
 * - Game actions history
 * - Current game action
 * - Game ending state
 * - Additional story/action inputs
 */

import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
import type { GameActionState, Action } from '$lib/ai/agents/gameAgent';

export class GameStateStore {
	// Core game progression
	readonly gameActions = useLocalStorage<GameActionState[]>('gameActionsState', []);
	readonly chosenAction = useLocalStorage<Action>('chosenActionState', {} as Action);
	readonly additionalStoryInput = useLocalStorage<string>('additionalStoryInputState', '');
	readonly additionalActionInput = useLocalStorage<string>('additionalActionInputState', '');
	readonly isGameEnded = useLocalStorage<boolean>('isGameEnded', false);

	// Ephemeral UI state (not persisted)
	storyChunk = $state<string>('');
	showXLastStoryProgressions = $state<number>(0);

	/**
	 * Get the current (most recent) game action state
	 */
	get currentGameAction(): GameActionState {
		return (
			(this.gameActions.value && this.gameActions.value[this.gameActions.value.length - 1]) ||
			({} as GameActionState)
		);
	}

	/**
	 * Add a new game action to the history
	 */
	addGameAction(action: GameActionState): void {
		this.gameActions.value = [...this.gameActions.value, action];
	}

	/**
	 * Update the current game action (last in array)
	 */
	updateCurrentGameAction(updates: Partial<GameActionState>): void {
		if (this.gameActions.value.length > 0) {
			const lastIndex = this.gameActions.value.length - 1;
			this.gameActions.value[lastIndex] = {
				...this.gameActions.value[lastIndex],
				...updates
			};
		}
	}

	/**
	 * Reset all game state (for new game)
	 */
	resetGameState(): void {
		this.gameActions.reset();
		this.chosenAction.reset();
		this.additionalStoryInput.reset();
		this.additionalActionInput.reset();
		this.isGameEnded.value = false;
		this.storyChunk = '';
		this.showXLastStoryProgressions = 0;
	}

	/**
	 * Reset ephemeral state after action processed
	 */
	resetAfterActionProcessed(): void {
		this.chosenAction.reset();
		this.additionalStoryInput.reset();
	}

	/**
	 * Reset ephemeral state after actions generated
	 */
	resetAfterActionsGenerated(): void {
		this.additionalActionInput.reset();
	}
}
