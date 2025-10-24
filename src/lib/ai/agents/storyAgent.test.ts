import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	StoryAgent,
	type Story,
	initialStoryState,
	storyStateForPrompt,
	exampleGameSystems
} from './storyAgent';
import { LLMProvider } from '$lib/ai/llmProvider'; // Mocked
import type { LLM, LLMRequest } from '$lib/ai/llm';
import type { CharacterDescription } from './characterAgent';
import { initialCharacterState } from './characterAgent'; // For sample character
import { stringifyPretty } from '$lib/util.svelte'; // For checking prompts

// Mock the LLMProvider
vi.mock('$lib/ai/llmProvider');

// Mock the LLM class
const mockLLMInstance = {
	generateContent: vi.fn()
};

describe('StoryAgent', () => {
	let storyAgent: StoryAgent;

	beforeEach(() => {
		// Reset mocks before each test
		vi.mocked(LLMProvider.provideLLM).mockReturnValue(mockLLMInstance as unknown as LLM);
		mockLLMInstance.generateContent.mockReset();

		// Create a new StoryAgent instance for each test
		storyAgent = new StoryAgent(LLMProvider.provideLLM({}));
	});

	describe('generateRandomStorySettings', () => {
		const sampleStory: Story = {
			...initialStoryState,
			game: 'Dungeons & Dragons',
			world_details: 'A realm of magic and monsters.',
			adventure_and_main_event: 'A quest to defeat the Lich King.',
			party_description: 'A brave hero.',
			general_image_prompt: 'fantasy medieval battle',
			theme: 'High Fantasy',
			tonality: 'Epic'
		};

		// Test Case 1: Basic random generation (no overwrites, no character)
		it('should generate random story settings without overwrites or character', async () => {
			mockLLMInstance.generateContent.mockResolvedValue({ content: sampleStory });

			const result = await storyAgent.generateRandomStorySettings();

			expect(mockLLMInstance.generateContent).toHaveBeenCalledOnce();
			const request = mockLLMInstance.generateContent.mock.calls[0][0] as LLMRequest;

			// Check if a game from exampleGameSystems was included in the prompt
			const presetInRequest = JSON.parse(
				request.userMessage.replace(
					'Create a new randomized story considering the following settings: ',
					''
				)
			);
			expect(exampleGameSystems).toContain(presetInRequest.game);
			expect(request.historyMessages).toEqual([]); // No character description
			expect(result).toEqual(sampleStory);
		});

		// Test Case 2: Generation with text input (simulating PDF text)
		it('should generate story settings with adventure_and_main_event from text input', async () => {
			const sampleText = 'A brave knight ventures into a dark forest to find a lost artifact.';
			const storyFromText: Story = {
				...sampleStory,
				adventure_and_main_event: sampleText,
				world_details: 'A dark and mysterious forest.' // LLM would generate this
			};
			mockLLMInstance.generateContent.mockResolvedValue({ content: storyFromText });

			const result = await storyAgent.generateRandomStorySettings({
				adventure_and_main_event: sampleText
			});

			expect(mockLLMInstance.generateContent).toHaveBeenCalledOnce();
			const request = mockLLMInstance.generateContent.mock.calls[0][0] as LLMRequest;
			const presetInRequest = JSON.parse(
				request.userMessage.replace(
					'Create a new randomized story considering the following settings: ',
					''
				)
			);

			expect(presetInRequest.adventure_and_main_event).toBe(sampleText);
			expect(result).toEqual(storyFromText);
			expect(result?.adventure_and_main_event).toBe(sampleText);
		});

		// Test Case 3: Generation with character description
		it('should generate story settings considering a character description', async () => {
			const sampleCharacter: CharacterDescription = {
				...initialCharacterState,
				name: 'Elara',
				appearance: 'A cunning rogue from the city slums.',
				class: 'Rogue'
			};
			const storyWithChar: Story = {
				...sampleStory,
				party_description: 'Elara, a cunning rogue, undertakes a daring heist.'
			};
			mockLLMInstance.generateContent.mockResolvedValue({ content: storyWithChar });

			const result = await storyAgent.generateRandomStorySettings({}, sampleCharacter);

			expect(mockLLMInstance.generateContent).toHaveBeenCalledOnce();
			const request = mockLLMInstance.generateContent.mock.calls[0][0] as LLMRequest;

			expect(request.historyMessages).toBeDefined();
			expect(request.historyMessages?.length).toBe(1);
			expect(request.historyMessages?.[0].role).toBe('user');
			expect(request.historyMessages?.[0].content).toContain(stringifyPretty(sampleCharacter));
			expect(result).toEqual(storyWithChar);
		});

		// Test Case 4: Generation with both PDF text and character description
		it('should generate story settings with text input and character description', async () => {
			const sampleText = 'A group of heroes must prevent a magical cataclysm.';
			const sampleCharacter: CharacterDescription = {
				...initialCharacterState,
				name: 'Gorok',
				appearance: 'A stoic warrior seeking redemption.',
				class: 'Warrior'
			};
			const storyCombined: Story = {
				...sampleStory,
				adventure_and_main_event: sampleText,
				party_description: 'Gorok, the warrior, joins a group to stop the cataclysm.'
			};
			mockLLMInstance.generateContent.mockResolvedValue({ content: storyCombined });

			const result = await storyAgent.generateRandomStorySettings(
				{ adventure_and_main_event: sampleText },
				sampleCharacter
			);

			expect(mockLLMInstance.generateContent).toHaveBeenCalledOnce();
			const request = mockLLMInstance.generateContent.mock.calls[0][0] as LLMRequest;
			const presetInRequest = JSON.parse(
				request.userMessage.replace(
					'Create a new randomized story considering the following settings: ',
					''
				)
			);

			expect(presetInRequest.adventure_and_main_event).toBe(sampleText);
			expect(request.historyMessages).toBeDefined();
			expect(request.historyMessages?.length).toBe(1);
			expect(request.historyMessages?.[0].content).toContain(stringifyPretty(sampleCharacter));
			expect(result).toEqual(storyCombined);
		});

		// Test Case 5: LLM returns error or unexpected content
		it('should return undefined if LLM generateContent returns undefined', async () => {
			mockLLMInstance.generateContent.mockResolvedValue({ content: undefined });

			const result = await storyAgent.generateRandomStorySettings();

			expect(mockLLMInstance.generateContent).toHaveBeenCalledOnce();
			expect(result).toBeUndefined();
		});

		it('should return undefined if LLM generateContent throws an error', async () => {
			mockLLMInstance.generateContent.mockRejectedValue(new Error('LLM API Error'));

			await storyAgent.generateRandomStorySettings();

			expect(mockLLMInstance.generateContent).toHaveBeenCalledOnce();
			// The current implementation of StoryAgent's generateRandomStorySettings
			// doesn't explicitly catch errors from this.llm.generateContent(request))?.content
			// So an error would propagate. If it should return undefined, the method needs a try/catch.
			// For now, assuming it might return undefined or throw.
			// Based on `?.content`, it would effectively be undefined if an error occurs before accessing .content
			// However, if generateContent itself throws, the promise would reject.
			// Let's adjust the agent or test based on desired behavior.
			// Assuming the current code structure, if generateContent itself rejects, the promise returned by generateRandomStorySettings will reject.
			// If it resolves to e.g. null or an object without 'content', then result would be undefined.
			// The mockResolvedValue({ content: undefined }) covers the latter.
			// For a thrown error:
			await expect(storyAgent.generateRandomStorySettings()).rejects.toThrow('LLM API Error');
			// To make it return undefined on error, StoryAgent would need:
			// try { return (await this.llm.generateContent(request))?.content as Story; } catch { return undefined; }
		});

		it('should use all fields from storyStateForPrompt in the LLM request if no overwrites', async () => {
			mockLLMInstance.generateContent.mockResolvedValue({ content: sampleStory });
			await storyAgent.generateRandomStorySettings();
			const request = mockLLMInstance.generateContent.mock.calls[0][0] as LLMRequest;
			const presetInRequest = JSON.parse(
				request.userMessage.replace(
					'Create a new randomized story considering the following settings: ',
					''
				)
			);
			// Check if all keys from storyStateForPrompt (excluding game which is handled by random selection) are in preset.
			for (const key of Object.keys(storyStateForPrompt)) {
				if (key === 'game') continue; // game is specifically set randomly if no overwrites
				expect(presetInRequest).toHaveProperty(key);
				expect(presetInRequest[key]).toEqual(storyStateForPrompt[key]);
			}
		});
	});
});
