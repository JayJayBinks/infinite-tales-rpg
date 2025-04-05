import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';
import type { Ability } from './characterStatsAgent';

export const initialCharacterTransformState: CharacterChangedInto = {
	changed_into: '',
	description: '',
	aiProcessingComplete: true,
	showEventConfirmationDialog: false
};
export type AbilitiesLearned = {
	showEventConfirmationDialog?: boolean;
	aiProcessingComplete?: boolean;
	abilities: (Partial<Ability> & { uniqueTechnicalId: string })[];
};
const initialAbilitiesLearnedState: AbilitiesLearned = {
	showEventConfirmationDialog: false,
	aiProcessingComplete: true,
	abilities: []
};
export const initialEventEvaluationState: EventEvaluation = {
	character_changed: initialCharacterTransformState,
	abilities_learned: initialAbilitiesLearnedState
};
export type CharacterChangedInto = {
	changed_into: string;
	description: string;
	aiProcessingComplete: boolean;
	showEventConfirmationDialog: boolean;
};

export type EventEvaluation = {
	character_changed: CharacterChangedInto;
	abilities_learned: AbilitiesLearned;
};

const jsonFormat = `{
	"reasoning": Briefly explain how the character changed from the CURRENT CHARACTER DESCRIPTION and how abilities learned if any,
	"character_changed": {"changed_into": single word only what the character transformed into, "description": string},
	"abilities_learned": [{"uniqueTechnicalId": string, "name": string, "effect": string}, ...]
	}`;

export class EventAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	mapResponse = (response: any): EventEvaluation => {
		return (
			response && {
				character_changed: response.character_changed,
				abilities_learned: {
					showEventConfirmationDialog: false,
					abilities: response.abilities_learned
				}
			}
		);
	};

	async evaluateEvents(
		storyHistory: string[],
		currentAbilitiesNames: string[]
	): Promise<EventEvaluation> {
		const agent = [
			'Scan the FULL STORY and evaluate if following events have occurred, they must be plausible in this moment and not just hypothetically:\n',
			'character_changed: Did the character SIGNIFICANTLY change? (E.g. granted the next profession rank, transformed into something else like vampire, possessed by a demon etc.) If yes describe the changes, else null.\n' +
				'abilities_learned: Did the character learn new abilities or spells? (E.g. from a book, a teacher or other circumstances). Pay attention if the story clearly states that the character learned a new ability or spell. If yes describe the ability or spell, else null.\n' +
				'Do not suggest already known abilities: ' +
				currentAbilitiesNames.join(', '),
			'Always respond with following JSON!\n' + jsonFormat
		];

		const request: LLMRequest = {
			userMessage: 'Evaluate the events for STORY PROGRESSION:\n' + storyHistory.join('\n'),
			systemInstruction: agent,
			model: 'gemini-2.0-flash',
			temperature: 0.1
		};
		const response = await this.llm.generateContent(request);
		console.log(response, 'Event evaluation ', stringifyPretty(response));

		return this.mapResponse(response);
	}
}
