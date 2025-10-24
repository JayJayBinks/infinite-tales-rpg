/**
 * StoryStateStore - Centralized state management for story and narrative state
 *
 * This store manages:
 * - Story state
 * - Campaign state
 * - History messages
 * - Related history
 * - Custom memories and GM notes
 */

import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
import type { Story } from '$lib/ai/agents/storyAgent';
import { initialStoryState } from '$lib/ai/agents/storyAgent';
import type { Campaign } from '$lib/ai/agents/campaignAgent';
import type { LLMMessage } from '$lib/ai/llm';
import type { RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
import type { TruthOracleResult } from '$lib/ai/agents/actionAgent';
import type { NPCAction } from '$lib/ai/agents/gameAgent';

export class StoryStateStore {
	// Story and narrative
	readonly story = useLocalStorage<Story>('storyState', initialStoryState);
	readonly campaign = useLocalStorage<Campaign>('campaignState', {} as Campaign);
	readonly currentChapter = useLocalStorage<number>('currentChapterState');

	// History and memory
	readonly historyMessages = useLocalStorage<LLMMessage[]>('historyMessagesState', []);
	readonly relatedStoryHistory = useLocalStorage<RelatedStoryHistory>('relatedStoryHistoryState', {
		relatedDetails: []
	});
	readonly relatedActionHistory = useLocalStorage<string[]>('relatedActionHistoryState', []);
	readonly relatedActionGroundTruth = useLocalStorage<TruthOracleResult | null>(
		'relatedActionGroundTruthState'
	);
	readonly relatedNPCActions = useLocalStorage<NPCAction[]>('relatedNPCActionsState', []);

	// Custom content
	readonly customMemories = useLocalStorage<string>('customMemoriesState');
	readonly customGMNotes = useLocalStorage<string>('customGMNotesState');

	/**
	 * Reset story state (for new game)
	 */
	resetStoryState(): void {
		this.story.reset();
		this.campaign.reset();
		this.currentChapter.reset();
		this.historyMessages.reset();
		this.relatedStoryHistory.reset();
		this.relatedActionHistory.reset();
		this.relatedActionGroundTruth.reset();
		this.relatedNPCActions.reset();
		this.customMemories.reset();
		this.customGMNotes.reset();
	}

	/**
	 * Reset ephemeral history state after action processed
	 */
	resetHistoryAfterAction(): void {
		this.relatedActionHistory.reset();
		this.relatedStoryHistory.reset();
		this.relatedNPCActions.reset();
		this.relatedActionGroundTruth.reset();
	}
}
