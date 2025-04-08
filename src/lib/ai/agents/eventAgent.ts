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
	action_restricting_state?: { state: string; description: string };
};

const jsonFormat = `{
	"reasoning": "string; Briefly explain how the character changed from the CURRENT CHARACTER DESCRIPTION and how abilities learned if any",
	"character_changed": null | {"changed_into": "string; single word only what the character transformed into", "description": string},
	"abilities_learned": [{"uniqueTechnicalId": string, "name": string, "effect": string}, ...],
	"action_restricting_state": null | {"state": string, "description": string}
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
			'Scan the FULL STORY provided and evaluate if the following events have occurred recently or are currently active. These events must be explicitly described or strongly implied by the narrative, not just hypothetical possibilities:',
			`1. **Significant Character Change ('character_changed'):** Has the character undergone a MAJOR and likely PERMANENT transformation or alteration? (Examples: Gained a new profession rank, transformed into a vampire/werewolf, became possessed by a permanent entity, received new powers from a crystal).
    *   If yes, describe the significant change.
    *   If no, state null.`,
			`2. **New Abilities Learned ('abilities_learned'):** Has the character explicitly learned or gained access to new abilities, spells, or skills? (Examples: Read a spellbook and learned 'Fireball', trained with a master and learned 'Parry', unlocked a racial trait). Ensure the story clearly states the learning event.
    *   Do not list abilities already known: ${currentAbilitiesNames.join(', ')}
    *   If yes, describe the new ability/spell/skill.
    *   If no, empty array.`,
			`3. **Action-Restricting State ('action_restricting_state'):** Has the character entered a TEMPORARY state or condition that SIGNIFICANTLY RESTRICTS their available actions, changes how they act, or puts them under external control impacting their actions? (Examples: Put to sleep, paralyzed, charmed, blinded, silenced, confused, trapped, bound, under extreme duress limiting choices, affected by an illusion impacting action choice, under a compulsion spell).
    *   If yes, describe the state and its primary effect on actions.
    *   If no, state null.`,
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
