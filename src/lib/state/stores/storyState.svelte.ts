/**
 * Story State Store
 * Manages story progression, history, and related story context
 */

import { useLocalStorage } from '../useLocalStorage.svelte';
import type { Story } from '$lib/ai/agents/storyAgent';
import type { RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
import { initialStoryState } from '$lib/ai/agents/storyAgent';

/**
 * Story state store
 * Manages current story, history, and related context
 */
export class StoryStateStore {
	// Current story state
	story = useLocalStorage<Story>('storyState', initialStoryState);
	
	// Story chunk for streaming updates
	storyChunk = $state<string>('');
	
	// Related story history for context
	relatedStoryHistory = useLocalStorage<RelatedStoryHistory>(
		'relatedStoryHistoryState',
		{ relatedDetails: [] }
	);
	
	// Custom memories added by user
	customMemories = useLocalStorage<string>('customMemoriesState', '');
	
	// Custom GM notes
	customGMNotes = useLocalStorage<string>('customGMNotesState', '');
	
	/**
	 * Update story chunk (for streaming)
	 */
	updateStoryChunk(chunk: string) {
		this.storyChunk = chunk;
	}
	
	/**
	 * Clear story chunk
	 */
	clearStoryChunk() {
		this.storyChunk = '';
	}
	
	/**
	 * Update story state
	 */
	updateStory(story: Story) {
		this.story.value = story;
	}
	
	/**
	 * Add custom memory
	 */
	addCustomMemory(memory: string) {
		this.customMemories.value = memory;
	}
	
	/**
	 * Add custom GM note
	 */
	addCustomGMNote(note: string) {
		this.customGMNotes.value = note;
	}
	
	/**
	 * Update related story history
	 */
	updateRelatedHistory(history: RelatedStoryHistory) {
		this.relatedStoryHistory.value = history;
	}
	
	/**
	 * Reset story state
	 */
	reset() {
		this.story.reset();
		this.storyChunk = '';
		this.relatedStoryHistory.reset();
		this.customMemories.reset();
		this.customGMNotes.reset();
	}
}

/**
 * Create and export a singleton story state instance
 */
export const storyStateStore = new StoryStateStore();
