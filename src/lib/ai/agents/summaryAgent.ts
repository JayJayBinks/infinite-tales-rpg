import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';

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
	): Promise<{newHistory: Array<LLMMessage>, summary: string}> {
		if (historyMessages.length < startSummaryAtSize) {
			return {newHistory: historyMessages, summary: ''};
		}
		const agent =
			'You are a Summary Agent for a RPG adventure, who is responsible for summarizing the most important bits of a continuous story.' +
			' Summarize the story so the most important events and characters can be introduced to a storytelling AI.\n' +
			'Always respond with following JSON! {"story": ""}';

		const toSummarize = historyMessages.slice(2, (numOfLastActions + 1) * -1);
		const request: LLMRequest = {
			userMessage: 'Summarize the following story: \n' + stringifyPretty(toSummarize),
			systemInstruction: agent,
			temperature: 1
		};
		const response = (await this.llm.generateReasoningContent(request))?.parsedObject as {
			story: string;
		};
		console.log('Summary returned ' + stringifyPretty(response));
		if (!response) {
			return {newHistory: historyMessages, summary: ''};
		}
		const newHistory = historyMessages.slice(0, 2);
		newHistory.push({ role: 'model', content: JSON.stringify(response) });
		historyMessages.slice(numOfLastActions * -1).forEach((message) => newHistory.push(message));
		return {newHistory, summary: response.story};
	}
}
