import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';
import type { GameActionState } from './gameAgent';

export const initialCharacterTransformState: CharacterChangedInto = {
	changed_into: '',
	description: '',
	aiProcessingComplete: true
};
export type CharacterChangedInto = {
	changed_into: string;
	description: string;
	aiProcessingComplete: boolean;
};
export type EventEvaluation = { character_changed: CharacterChangedInto };

export class EventAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async evaluateEvents(gameStatesToConsider: GameActionState[]): Promise<EventEvaluation> {
		const agent =
			'Scan the FULL STORY and evaluate if following events have occurred:\n' +
			'character_changed: Did the character SIGNIFICANTLY change? (E.g. granted the next profession rank, transformed into something else like vampire, possessed by a demon etc.) If yes describe the changes, else null.\n' +
			'Always respond with following JSON! {"character_changed": {"changed_into": single word only what the character transformed into, "description": string}}';

		const request: LLMRequest = {
			userMessage:
				'Evaluate the events for STORY PROGRESSION:\n' +
				gameStatesToConsider.map(stringifyPretty).join('\n'),
			systemInstruction: agent,
			model: 'gemini-2.0-flash',
			temperature: 0.1
		};
		const response = (await this.llm.generateContent(request)) as EventEvaluation;
		console.log(response, 'Event evaluation ', stringifyPretty(response));
		return response;
	}
}
