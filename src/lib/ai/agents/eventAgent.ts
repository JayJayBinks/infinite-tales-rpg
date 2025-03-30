import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';

export const initialCharacterTransformState: CharacterChangedInto = {
	changed_into: '',
	description: '',
	aiProcessingComplete: true
};
export const initialEventEvaluationState: EventEvaluation = {
	character_changed: initialCharacterTransformState,
	countdown_events: [],
	duration_events: [],
	cancel_events: []
};
export type CharacterChangedInto = {
	changed_into: string;
	description: string;
	aiProcessingComplete: boolean;
};
export type TimeEvent = { unique_id: string; num_of_actions: number; consequence: string; };
export type EventEvaluation = { character_changed: CharacterChangedInto; countdown_events: TimeEvent[]; duration_events: TimeEvent[]; cancel_events: string[] };

const jsonFormat =
	`{
	"character_changed": {"changed_into": single word only what the character transformed into, "description": string},
	"countdown_events": [{"unique_id": string, "num_of_actions": number smaller than 20; how long the event will count down, "consequence": string; story explanation for game consequences when countdown runs out}, ...],
	"duration_events": [{"unique_id": string, "num_of_actions": number no restriction; how long the event will last, "consequence": string; story explanation for game consequences during the event}, ...],
	"cancel_events": string array of unique_ids of events to cancel
	}`;

export class EventAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async evaluateEvents(storyHistory: string[], eventEvaluation: EventEvaluation): Promise<EventEvaluation> {
		const agent =
			'Scan the FULL STORY and evaluate if following events have occurred:\n' +
			'character_changed: Did the character SIGNIFICANTLY change? (E.g. granted the next profession rank, transformed into something else like vampire, possessed by a demon etc.) If yes describe the changes, else null.\n' +
			'countdown_events: Did an event occur that counts down? (e.g. a bomb needs to be defused) If yes describe the in-game consequence as story narration, else null.\n' +
			'duration_events: Did an event occur that lasts? (e.g. a storm that lasts a duration) If yes describe the in-game consequence as story narration, else null.\n' +
			'cancel_event: Should an event from RUNNING_EVENTS be cancelled? (e.g. a bomb was defused, a storm was cancelled) If yes return the event id, else null.\n' +
			'Always respond with following JSON! ' + jsonFormat;

		const request: LLMRequest = {
			userMessage:
				'Evaluate the events for STORY PROGRESSION:\n' +
				storyHistory.join('\n') + '\n' +
				'RUNNING_COUNTDOWN_EVENTS:\n' + eventEvaluation.countdown_events.map(e => e.unique_id).join(', ') + '\n' +
				'RUNNING_DURATION_EVENTS:\n' + eventEvaluation.duration_events.map(e => e.unique_id).join(', ')
				,
			systemInstruction: agent,
			model: 'gemini-2.0-flash',
			temperature: 0.1
		};
		const response = (await this.llm.generateContent(request)) as EventEvaluation;
		console.log(response, 'Event evaluation ', stringifyPretty(response));
		return response;
	}
}
