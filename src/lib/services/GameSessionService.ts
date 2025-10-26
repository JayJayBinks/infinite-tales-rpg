/**
 * Game Session Service
 * Orchestrates the main game loop, session state, and high-level game flow
 * Coordinates between state stores, AI services, and game logic
 */

import type { GameActionState } from '$lib/ai/agents/gameAgent';
import type { Action } from '$lib/ai/agents/gameAgent';
import type { LLMMessage } from '$lib/ai/llm';
import { gameState } from '$lib/state/stores/gameState.svelte';
import { partyState } from '$lib/state/stores/partyState.svelte';
import { storyStateStore } from '$lib/state/stores/storyState.svelte';
import { aiStateStore } from '$lib/state/stores/aiState.svelte';
import type { AIService } from './AIService';
import type { ActionService } from './ActionService';

/**
 * Game session service
 * Manages the overall game session lifecycle
 */
export class GameSessionService {
	private aiService?: AIService;
	private actionService?: ActionService;
	
	/**
	 * Initialize the service with dependencies
	 */
	initialize(aiService: AIService, actionService: ActionService) {
		this.aiService = aiService;
		this.actionService = actionService;
	}
	
	/**
	 * Check if service is initialized
	 */
	isInitialized(): boolean {
		return !!this.aiService && !!this.actionService;
	}
	
	/**
	 * Start a new game session
	 */
	async startNewGame() {
		// Reset all game state
		gameState.resetGameState();
		partyState.resetPartyState();
		storyStateStore.reset();
		
		console.log('New game session started');
	}
	
	/**
	 * Check if the game has ended
	 */
	isGameEnded(): boolean {
		return gameState.progression.isGameEnded;
	}
	
	/**
	 * Mark the game as ended
	 */
	endGame(reason?: string) {
		gameState.progression.isGameEnded = true;
		console.log('Game ended:', reason || 'Unknown reason');
	}
	
	/**
	 * Get the current game action state
	 */
	getCurrentGameAction(): GameActionState {
		return gameState.progression.currentGameAction;
	}
	
	/**
	 * Get history messages for AI context
	 */
	getHistoryMessages(): LLMMessage[] {
		return gameState.memory.historyMessages;
	}
	
	/**
	 * Add a new game action to history
	 */
	addGameAction(action: GameActionState) {
		gameState.progression.gameActions = [
			...gameState.progression.gameActions,
			action
		];
	}
	
	/**
	 * Update history messages
	 */
	updateHistoryMessages(messages: LLMMessage[]) {
		gameState.memory.historyMessages = messages;
	}
	
	/**
	 * Get the active party member
	 */
	getActiveMember() {
		return partyState.getActiveMember();
	}
	
	/**
	 * Get all party members
	 */
	getPartyMembers() {
		return partyState.party.members;
	}
	
	/**
	 * Check if party mode is active (always true now)
	 */
	isPartyMode(): boolean {
		return true; // Always party mode, even for single character (party of 1)
	}
	
	/**
	 * Get the party size
	 */
	getPartySize(): number {
		return partyState.party.members.length;
	}
	
	/**
	 * Save current game state
	 */
	saveGame() {
		// State is automatically saved via useLocalStorage
		// This method can be extended for additional save logic
		console.log('Game state saved');
	}
	
	/**
	 * Load game state
	 */
	loadGame() {
		// State is automatically loaded via useLocalStorage
		// This method can be extended for additional load logic
		console.log('Game state loaded');
	}
}

/**
 * Create and export a singleton game session service
 */
export const gameSessionService = new GameSessionService();
