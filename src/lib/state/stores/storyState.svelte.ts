/**
 * Story State Store
 * Manages story progression, history, and related story context
 */

import type { Story } from '$lib/ai/agents/storyAgent';
import type { RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
import { initialStoryState } from '$lib/ai/agents/storyAgent';

/**
 * Helper to get value from localStorage with fallback
 */
function getFromLocalStorage<T>(key: string, defaultValue: T): T {
	if (typeof window === 'undefined') return defaultValue;
	const stored = localStorage.getItem(key);
	if (stored === null) return defaultValue;
	try {
		return JSON.parse(stored) as T;
	} catch {
		return defaultValue;
	}
}

/**
 * Helper to save value to localStorage
 */
function saveToLocalStorage<T>(key: string, value: T): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Story state store
 * Manages current story, history, and related context
 */
export class StoryStateStore {
	// Current story state
	private _story = $state<Story>(getFromLocalStorage('storyState', initialStoryState));
	
	// Story chunk for streaming updates
	storyChunk = $state<string>('');
	
	// Related story history for context
	private _relatedStoryHistory = $state<RelatedStoryHistory>(
		getFromLocalStorage('relatedStoryHistoryState', { relatedDetails: [] })
	);
	
	// Custom memories added by user
	private _customMemories = $state<string>(getFromLocalStorage('customMemoriesState', ''));
	
	// Custom GM notes
	private _customGMNotes = $state<string>(getFromLocalStorage('customGMNotesState', ''));
	
	get story() {
		return this._story;
	}
	
	set story(value: Story) {
		this._story = value;
		saveToLocalStorage('storyState', value);
	}
	
	get relatedStoryHistory() {
		return this._relatedStoryHistory;
	}
	
	set relatedStoryHistory(value: RelatedStoryHistory) {
		this._relatedStoryHistory = value;
		saveToLocalStorage('relatedStoryHistoryState', value);
	}
	
	get customMemories() {
		return this._customMemories;
	}
	
	set customMemories(value: string) {
		this._customMemories = value;
		saveToLocalStorage('customMemoriesState', value);
	}
	
	get customGMNotes() {
		return this._customGMNotes;
	}
	
	set customGMNotes(value: string) {
		this._customGMNotes = value;
		saveToLocalStorage('customGMNotesState', value);
	}
	
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
		this.story = story;
	}
	
	/**
	 * Add custom memory
	 */
	addCustomMemory(memory: string) {
		this.customMemories = memory;
	}
	
	/**
	 * Add custom GM note
	 */
	addCustomGMNote(note: string) {
		this.customGMNotes = note;
	}
	
	/**
	 * Update related story history
	 */
	updateRelatedHistory(history: RelatedStoryHistory) {
		this.relatedStoryHistory = history;
	}
	
	/**
	 * Reset story state
	 */
	reset() {
		this.story = initialStoryState;
		this.storyChunk = '';
		this.relatedStoryHistory = { relatedDetails: [] };
		this.customMemories = '';
		this.customGMNotes = '';
	}
}

/**
 * Create and export a singleton story state instance
 */
export const storyStateStore = new StoryStateStore();
