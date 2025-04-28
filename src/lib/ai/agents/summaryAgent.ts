import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { GameActionState } from './gameAgent';
import { GEMINI_MODELS, THINKING_BUDGET } from '../geminiProvider';

export type RelatedStoryHistory = {
	relatedDetails: { storyReference: string; relevanceScore: number }[];
};

export class SummaryAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	/**
	 * Keep first and last numOfLastActions and summarize everything in the middle
	 * @param historyMessages
	 * @param startSummaryAtSize Start summarizing the story when historyMessages reaches a certain size, each action has 2 parts, user and model message
	 * @param numOfLastActions number of last actions to keep for detailed memory
	 */
	async summarizeStoryIfTooLong(
		historyMessages: Array<LLMMessage>,
		startSummaryAtSize = 12 * 2,
		numOfLastActions = 3 * 2
	): Promise<{ newHistory: Array<LLMMessage>; summary: string }> {
		if (historyMessages.length < startSummaryAtSize) {
			return { newHistory: historyMessages, summary: '' };
		}
		const agent =
			'You are a Summary Agent for a RPG adventure, who is responsible for summarizing the most important bits of a continuous story.' +
			' Summarize the story so the most important events, which have a long term impact on the story, and characters are included.\n' +
			' Emphasize on the most important events, and include their details.\n' +
			'Always respond with following JSON! {"keyDetails": string array, "story": ""}';

		const toSummarize = historyMessages.slice(2, (numOfLastActions + 1) * -1);
		console.log('toSummarize', toSummarize);
		const request: LLMRequest = {
			userMessage: 'Summarize the following story: \n' + stringifyPretty(toSummarize),
			systemInstruction: agent,
			temperature: 1,
			model: GEMINI_MODELS.FLASH_THINKING_2_0
		};
		const response = (await this.llm.generateContent(request)) as {
			story: string;
		};
		console.log('Summary returned ' + stringifyPretty(response));
		if (!response) {
			return { newHistory: historyMessages, summary: '' };
		}
		const newHistory = historyMessages.slice(0, 2);
		newHistory.push({ role: 'model', content: JSON.stringify(response) });
		historyMessages.slice(numOfLastActions * -1).forEach((message) => newHistory.push(message));
		return { newHistory: newHistory, summary: response.story };
	}

	async retrieveRelatedHistory(
		storyProgression: string,
		gameStates: GameActionState[],
		maxRelatedDetails = 3,
		additionalHistory?: string[]
	): Promise<RelatedStoryHistory> {
		if ((!additionalHistory || additionalHistory?.length === 0) && gameStates.length <= 20) {
			return { relatedDetails: [] };
		}
		const jsonPrompt =
			'Always respond with following JSON! {"relatedDetails": [{"storyReference": string, "relevanceScore": decimal number; 0-1}] array length ' +
			maxRelatedDetails +
			'}';
		const agent =
			'Scan the FULL STORY HISTORY and identify any SPECIFIC STORY REFERENCES from past events that are HIGHLY RELEVANT to the current STORY PROGRESSION. Focus on details that will help maintain consistency and plausibility.\n' +
			'The RELEVANT REFERENCES must be only relevant to the current STORY PROGRESSION and not the whole story.\n' +
			'Never reference the STORY PROGRESSION itself in your response!\n' +
			'List the RELEVANT STORY REFERENCES including narration details from the story history.\n' +
			jsonPrompt;

		const currentGameStateId = gameStates[gameStates.length - 1]?.id;
		const isRelevant = (state: GameActionState) =>
			state.id <= currentGameStateId - 10 &&
			(!state.story_memory_explanation ||
				state.story_memory_explanation?.includes('HIGH') ||
				state.story_memory_explanation?.includes('MEDIUM'));

		const consideredHistory: LLMMessage[] = gameStates.filter(isRelevant).map((state) => ({
			role: 'model',
			content: state.story
		}));
		if (additionalHistory) {
			additionalHistory.forEach((note) => {
				consideredHistory.push({ role: 'model', content: note });
			});
		}
		const request: LLMRequest = {
			userMessage: 'STORY PROGRESSION:\n' + storyProgression + '\n\n' + jsonPrompt,
			systemInstruction: agent,
			historyMessages: consideredHistory,
			model: GEMINI_MODELS.FLASH_2_0,
			temperature: 0.1
		};
		const response = (await this.llm.generateContent(request)) as RelatedStoryHistory;
		console.log(storyProgression, 'Related history returned ', stringifyPretty(response));
		if (!response.relatedDetails) {
			return { relatedDetails: [] };
		}
		return response;
	}
}
