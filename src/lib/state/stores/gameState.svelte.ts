/**
 * Centralized game state store
 * Consolidates all core game-related state that was previously scattered across useLocalStorage calls
 */

import { useLocalStorage } from '../useLocalStorage.svelte';
import type {
	GameActionState,
	InventoryState,
	PlayerCharactersGameState,
	PlayerCharactersIdToNamesMap
} from '$lib/ai/agents/gameAgent';
import type { NPCState } from '$lib/ai/agents/characterStatsAgent';
import type { LLMMessage } from '$lib/ai/llm';
import type { Campaign } from '$lib/ai/agents/campaignAgent';
import type { RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
import type { TruthOracleResult } from '$lib/ai/agents/actionAgent';
import type { NPCAction } from '$lib/ai/agents/gameAgent';
import type { Story } from '$lib/ai/agents/storyAgent';

/**
 * Core game progression state
 */
export class GameProgressionState {
	// Game actions history
	gameActions = useLocalStorage<GameActionState[]>('gameActionsState', []);
	
	// Story state
	story = useLocalStorage<Story>('storyState', {} as Story);
	storyChunk = $state<string>('');
	
	// Inventory
	inventory = useLocalStorage<InventoryState>('inventoryState', {});
	
	// NPCs
	npcs = useLocalStorage<NPCState>('npcState', {});
	
	// Player character mappings
	playerCharactersIdToNamesMap = useLocalStorage<PlayerCharactersIdToNamesMap>(
		'playerCharactersIdToNamesMapState',
		{}
	);
	
	// Player characters game state (resources, etc.)
	playerCharactersGame = $state<PlayerCharactersGameState>({});
	
	// Game ended flag
	isGameEnded = useLocalStorage<boolean>('isGameEnded', false);
	
	/**
	 * Get the current (latest) game action state
	 */
	get currentGameAction(): GameActionState {
		return (this.gameActions.value && this.gameActions.value[this.gameActions.value.length - 1]) || 
			({} as GameActionState);
	}
	
	/**
	 * Get player character game state by ID
	 */
	getPlayerCharacterGameState(characterId: string) {
		return this.playerCharactersGame[characterId];
	}
}

/**
 * Memory and history state
 */
export class MemoryState {
	// History messages for LLM context
	historyMessages = useLocalStorage<LLMMessage[]>('historyMessagesState', []);
	
	// Related story history
	relatedStoryHistory = useLocalStorage<RelatedStoryHistory>(
		'relatedStoryHistoryState',
		{ relatedDetails: [] }
	);
	
	// Related action history
	relatedActionHistory = useLocalStorage<string[]>('relatedActionHistoryState', []);
	
	// Ground truth for related actions
	relatedActionGroundTruth = useLocalStorage<TruthOracleResult | null>(
		'relatedActionGroundTruthState',
		null
	);
	
	// Related NPC actions
	relatedNPCActions = useLocalStorage<NPCAction[]>('relatedNPCActionsState', []);
	
	// Custom memories
	customMemories = useLocalStorage<string>('customMemoriesState', '');
	
	// Custom GM notes
	customGMNotes = useLocalStorage<string>('customGMNotesState', '');
}

/**
 * Campaign state
 */
export class CampaignState {
	campaign = useLocalStorage<Campaign>('campaignState', {} as Campaign);
	currentChapter = useLocalStorage<number>('currentChapterState', 0);
}

/**
 * Additional input state for actions and story
 */
export class InputState {
	additionalStoryInput = useLocalStorage<string>('additionalStoryInputState', '');
	additionalActionInput = useLocalStorage<string>('additionalActionInputState', '');
}

/**
 * Master game state container
 * Provides centralized access to all game-related state
 */
export class GameState {
	progression = new GameProgressionState();
	memory = new MemoryState();
	campaign = new CampaignState();
	input = new InputState();
	
	/**
	 * Reset all game state (for new game)
	 */
	resetGameState() {
		this.progression.gameActions.reset();
		this.progression.story.reset();
		this.progression.storyChunk = '';
		this.progression.inventory.reset();
		this.progression.npcs.reset();
		this.progression.isGameEnded.reset();
		this.progression.playerCharactersGame = {};
		
		this.memory.historyMessages.reset();
		this.memory.relatedStoryHistory.reset();
		this.memory.relatedActionHistory.reset();
		this.memory.relatedActionGroundTruth.reset();
		this.memory.relatedNPCActions.reset();
		this.memory.customMemories.reset();
		this.memory.customGMNotes.reset();
		
		this.campaign.campaign.reset();
		this.campaign.currentChapter.reset();
		
		this.input.additionalStoryInput.reset();
		this.input.additionalActionInput.reset();
	}
}

/**
 * Create and export a singleton game state instance
 */
export const gameState = new GameState();
