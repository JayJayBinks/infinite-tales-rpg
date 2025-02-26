import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { GameActionState } from './gameAgent';

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
		gameActions: Array<GameActionState>,
		startSummaryAtSize = 12 * 2,
		numOfLastActions = 3 * 2
	): Promise<{ newHistory: Array<LLMMessage>; summary: string }> {
		if (historyMessages.length < startSummaryAtSize) {
			return { newHistory: historyMessages, summary: '' };
		}
		const mostImportantEvents = gameActions
			.filter((state) => state.story_memory_explanation?.includes('HIGH'))
			.map((state) => state.story);
		const agent =
			'You are a Summary Agent for a RPG adventure, who is responsible for summarizing the most important bits of a continuous story.' +
			' Summarize the story so the most important events, which have a long term impact on the story, and characters are included.\n' +
			' Emphasize on the most important events, and include their details.\n' +
			'Always respond with following JSON! {"keyDetails": string array, "story": ""}';

		const toSummarize = historyMessages.slice(2, (numOfLastActions + 1) * -1);
		console.log('toSummarize', toSummarize);
		const request: LLMRequest = {
			userMessage:
				'Summarize the following story: \n' +
				stringifyPretty(toSummarize) +
				'\n\n' +
				'Most important events: \n' +
				stringifyPretty(mostImportantEvents),
			systemInstruction: agent,
			temperature: 1
		};
		const response = (await this.llm.generateReasoningContent(request))?.parsedObject as {
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
}
