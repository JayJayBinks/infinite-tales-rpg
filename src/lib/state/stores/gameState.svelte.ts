/**
 * Centralized game state store
 * Consolidates all core game-related state that was previously scattered across useLocalStorage calls
 */

import { getFromLocalStorage, saveToLocalStorage } from '$lib/state/localStorageUtil';
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
	private _gameActions = $state<GameActionState[]>(
		getFromLocalStorage('gameActionsState', [])
	);
	private _story = $state<Story>(getFromLocalStorage('storyState', {} as Story));
	storyChunk = $state<string>('');
	private _inventory = $state<InventoryState>(getFromLocalStorage('inventoryState', {}));
	private _npcs = $state<NPCState>(getFromLocalStorage('npcState', {}));
	private _playerCharactersIdToNamesMap = $state<PlayerCharactersIdToNamesMap>(
		getFromLocalStorage('playerCharactersIdToNamesMapState', {})
	);
	playerCharactersGame = $state<PlayerCharactersGameState>({});
	private _isGameEnded = $state<boolean>(getFromLocalStorage('isGameEnded', false));

	get gameActions() { return this._gameActions; }
	set gameActions(v: GameActionState[]) { this._gameActions = v; saveToLocalStorage('gameActionsState', v); }

	get story() { return this._story; }
	set story(v: Story) { this._story = v; saveToLocalStorage('storyState', v); }

	get inventory() { return this._inventory; }
	set inventory(v: InventoryState) { this._inventory = v; saveToLocalStorage('inventoryState', v); }

	get npcs() { return this._npcs; }
	set npcs(v: NPCState) { this._npcs = v; saveToLocalStorage('npcState', v); }

	get playerCharactersIdToNamesMap() { return this._playerCharactersIdToNamesMap; }
	set playerCharactersIdToNamesMap(v: PlayerCharactersIdToNamesMap) { this._playerCharactersIdToNamesMap = v; saveToLocalStorage('playerCharactersIdToNamesMapState', v); }

	get isGameEnded() { return this._isGameEnded; }
	set isGameEnded(v: boolean) { this._isGameEnded = v; saveToLocalStorage('isGameEnded', v); }
	
	/**
	 * Get the current (latest) game action state
	 */
	get currentGameAction(): GameActionState {
		return (this.gameActions && this.gameActions[this.gameActions.length - 1]) || 
			({} as GameActionState);
	}
	
	/**
	 * Get player character game state by ID
	 */
	getPlayerCharacterGameState(characterId: string) {
		return this.playerCharactersGame[characterId];
	}
	
	/**
	 * Add a new game action (immutable pattern)
	 */
	addGameAction(action: GameActionState) {
		this.gameActions = [...this.gameActions, action];
	}
	
	/**
	 * Update the latest game action (immutable pattern)
	 */
	updateCurrentGameAction(updates: Partial<GameActionState>) {
		if (this.gameActions.length === 0) return;
		
		const lastIndex = this.gameActions.length - 1;
		this.gameActions = this.gameActions.map((action, i) =>
			i === lastIndex ? { ...action, ...updates } : action
		);
	}
	
	/**
	 * Update inventory item (immutable pattern)
	 */
	updateInventoryItem(itemId: string, quantity: number) {
		this.inventory = {
			...this.inventory,
			[itemId]: quantity
		};
	}
	
	/**
	 * Update NPC state (immutable pattern)
	 */
	updateNPC(npcId: string, npcData: NPCState[string]) {
		this.npcs = {
			...this.npcs,
			[npcId]: npcData
		};
	}
	
	/**
	 * Add or update player character game state (immutable pattern)
	 */
	setPlayerCharacterGameState(characterId: string, state: PlayerCharactersGameState[string]) {
		this.playerCharactersGame = {
			...this.playerCharactersGame,
			[characterId]: state
		};
	}
}

/**
 * Memory and history state
 */
export class MemoryState {
	private _historyMessages = $state<LLMMessage[]>(getFromLocalStorage('historyMessagesState', []));
	private _relatedStoryHistory = $state<RelatedStoryHistory>(
		getFromLocalStorage('relatedStoryHistoryState', { relatedDetails: [] })
	);
	private _relatedActionHistory = $state<string[]>(
		getFromLocalStorage('relatedActionHistoryState', [])
	);
	private _relatedActionGroundTruth = $state<TruthOracleResult | null>(
		getFromLocalStorage('relatedActionGroundTruthState', null)
	);
	private _relatedNPCActions = $state<NPCAction[]>(
		getFromLocalStorage('relatedNPCActionsState', [])
	);
	private _customMemories = $state<string>(getFromLocalStorage('customMemoriesState', ''));
	private _customGMNotes = $state<string>(getFromLocalStorage('customGMNotesState', ''));

	get historyMessages() { return this._historyMessages; }
	set historyMessages(v: LLMMessage[]) { this._historyMessages = v; saveToLocalStorage('historyMessagesState', v); }

	get relatedStoryHistory() { return this._relatedStoryHistory; }
	set relatedStoryHistory(v: RelatedStoryHistory) { this._relatedStoryHistory = v; saveToLocalStorage('relatedStoryHistoryState', v); }

	get relatedActionHistory() { return this._relatedActionHistory; }
	set relatedActionHistory(v: string[]) { this._relatedActionHistory = v; saveToLocalStorage('relatedActionHistoryState', v); }

	get relatedActionGroundTruth() { return this._relatedActionGroundTruth; }
	set relatedActionGroundTruth(v: TruthOracleResult | null) { this._relatedActionGroundTruth = v; saveToLocalStorage('relatedActionGroundTruthState', v); }

	get relatedNPCActions() { return this._relatedNPCActions; }
	set relatedNPCActions(v: NPCAction[]) { this._relatedNPCActions = v; saveToLocalStorage('relatedNPCActionsState', v); }

	get customMemories() { return this._customMemories; }
	set customMemories(v: string) { this._customMemories = v; saveToLocalStorage('customMemoriesState', v); }

	get customGMNotes() { return this._customGMNotes; }
	set customGMNotes(v: string) { this._customGMNotes = v; saveToLocalStorage('customGMNotesState', v); }
}

/**
 * Campaign state
 */
export class CampaignState {
	private _campaign = $state<Campaign>(getFromLocalStorage('campaignState', {} as Campaign));
	private _currentChapter = $state<number>(getFromLocalStorage('currentChapterState', 0));

	get campaign() { return this._campaign; }
	set campaign(v: Campaign) { this._campaign = v; saveToLocalStorage('campaignState', v); }

	get currentChapter() { return this._currentChapter; }
	set currentChapter(v: number) { this._currentChapter = v; saveToLocalStorage('currentChapterState', v); }
}

/**
 * Additional input state for actions and story
 */
export class InputState {
	private _additionalStoryInput = $state<string>(
		getFromLocalStorage('additionalStoryInputState', '')
	);
	private _additionalActionInput = $state<string>(
		getFromLocalStorage('additionalActionInputState', '')
	);

	get additionalStoryInput() { return this._additionalStoryInput; }
	set additionalStoryInput(v: string) { this._additionalStoryInput = v; saveToLocalStorage('additionalStoryInputState', v); }

	get additionalActionInput() { return this._additionalActionInput; }
	set additionalActionInput(v: string) { this._additionalActionInput = v; saveToLocalStorage('additionalActionInputState', v); }
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
		this.progression.gameActions = [];
		this.progression.story = {} as Story;
		this.progression.storyChunk = '';
		this.progression.inventory = {};
		this.progression.npcs = {};
		this.progression.isGameEnded = false;
		this.progression.playerCharactersGame = {};

		this.memory.historyMessages = [];
		this.memory.relatedStoryHistory = { relatedDetails: [] };
		this.memory.relatedActionHistory = [];
		this.memory.relatedActionGroundTruth = null;
		this.memory.relatedNPCActions = [];
		this.memory.customMemories = '';
		this.memory.customGMNotes = '';

		this.campaign.campaign = {} as Campaign;
		this.campaign.currentChapter = 0;

		this.input.additionalStoryInput = '';
		this.input.additionalActionInput = '';
	}
}

/**
 * Create and export a singleton game state instance
 */
export const gameState = new GameState();
