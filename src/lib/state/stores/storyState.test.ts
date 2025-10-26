import { describe, it, expect, beforeEach } from 'vitest';
import { StoryStateStore } from './storyState.svelte';
import { initialStoryState } from '$lib/ai/agents/storyAgent';
import type { Story } from '$lib/ai/agents/storyAgent';

describe('StoryStateStore', () => {
	let store: StoryStateStore;

	beforeEach(() => {
		store = new StoryStateStore();
		store.reset();
	});

	describe('Initialization', () => {
		it('should initialize with default story state', () => {
			expect(store.story.value).toEqual(initialStoryState);
			expect(store.storyChunk).toBe('');
			expect(store.relatedStoryHistory.value).toEqual({ relatedDetails: [] });
		});
	});

	describe('Story chunk management', () => {
		it('should update story chunk', () => {
			store.updateStoryChunk('Test chunk');
			expect(store.storyChunk).toBe('Test chunk');
		});

		it('should clear story chunk', () => {
			store.updateStoryChunk('Test chunk');
			store.clearStoryChunk();
			expect(store.storyChunk).toBe('');
		});
	});

	describe('Story state management', () => {
		it('should update story state', () => {
			const newStory: Story = {
				...initialStoryState,
				general_image_prompt: 'A dark forest'
			};
			store.updateStory(newStory);
			expect(store.story.value.general_image_prompt).toBe('A dark forest');
		});
	});

	describe('Custom memories', () => {
		it('should add custom memory', () => {
			store.addCustomMemory('Remember the dragon');
			expect(store.customMemories.value).toBe('Remember the dragon');
		});

		it('should overwrite previous memory', () => {
			store.addCustomMemory('First memory');
			store.addCustomMemory('Second memory');
			expect(store.customMemories.value).toBe('Second memory');
		});
	});

	describe('Custom GM notes', () => {
		it('should add custom GM note', () => {
			store.addCustomGMNote('Party is heading north');
			expect(store.customGMNotes.value).toBe('Party is heading north');
		});
	});

	describe('Related history', () => {
		it('should update related story history', () => {
			const history = { relatedDetails: ['Detail 1', 'Detail 2'] };
			store.updateRelatedHistory(history);
			expect(store.relatedStoryHistory.value).toEqual(history);
		});
	});

	describe('Reset', () => {
		it('should reset all story state', () => {
			store.updateStoryChunk('Test chunk');
			store.addCustomMemory('Test memory');
			store.addCustomGMNote('Test note');

			store.reset();

			expect(store.storyChunk).toBe('');
			expect(store.customMemories.value).toBe('');
			expect(store.customGMNotes.value).toBe('');
		});
	});
});
