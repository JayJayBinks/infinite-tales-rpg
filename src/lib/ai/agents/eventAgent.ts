import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';
import type { Ability } from './characterStatsAgent';
import { GEMINI_MODELS } from '../geminiProvider';
import { jsonRule } from './agentUtils';

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
	character_changed?: CharacterChangedInto;
	abilities_learned?: AbilitiesLearned;
};

// =============================
// Party Evaluation (New)
// =============================
export interface PartyMemberEventContext {
	id: string; // technical id e.g. player_character_1
	name: string; // display name
	known_abilities: string[]; // ability names already known
}

export interface CharacterEventEvaluation extends EventEvaluation {
	character_id: string;
	character_name: string;
	reasoning?: string; // optional per-character reasoning from model
}

export interface PartyEventEvaluationResponse {
	party_events: CharacterEventEvaluation[];
}

const jsonFormat = `{
	"reasoning": "string; Briefly explain how the character changed from the CURRENT CHARACTER DESCRIPTION and how abilities learned if any",
	"character_changed": null | {"changed_into": "string; single word only what the character transformed into", "description": string},
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
	): Promise<{ thoughts: string; event_evaluation: EventEvaluation }> {
		const agent = [
			'Scan the FULL STORY provided and evaluate if the following events have occurred recently or are currently active. These events must be explicitly described or strongly implied by the narrative, not just hypothetical possibilities:',
			`1. **Significant Character Change ('character_changed'):** Has the character undergone a MAJOR and likely PERMANENT transformation or alteration? (Examples: Gained a new profession rank, transformed into a vampire/werewolf, became possessed by a permanent entity, received new powers from a crystal).
    *   If yes, describe the significant change.
    *   If no, state null.`,
			`2. **New Abilities Learned ('abilities_learned'):** Has the character explicitly learned or gained access to new abilities, spells, or skills? (Examples: Read a spellbook and learned 'Fireball', trained with a master and learned 'Parry', unlocked a racial trait). Ensure the story clearly states the learning event.
    *   Do not list abilities already known: ${currentAbilitiesNames.join(', ')}
    *   If yes, describe the new ability/spell/skill.
    *   If no, empty array.`,
			`${jsonRule}\n` + jsonFormat
		];

		const request: LLMRequest = {
			userMessage: 'Evaluate the events for STORY PROGRESSION:\n' + storyHistory.join('\n'),
			systemInstruction: agent,
			model: GEMINI_MODELS.FLASH_THINKING_2_0,
			temperature: 0.1,
			reportErrorToUser: false
		};
		const response = await this.llm.generateContent(request);
		console.log(response, 'Event evaluation ', stringifyPretty(response));

		return {
			thoughts: response?.thoughts || '',
			event_evaluation: this.mapResponse(response?.content || {})
		};
	}

	// NEW: Evaluate events for ALL party members in a single LLM call
	async evaluatePartyEvents(
		storyHistory: string[],
		partyMembers: PartyMemberEventContext[]
	): Promise<{ thoughts: string; events_by_member: CharacterEventEvaluation[] }> {
		/**
		 * Contract:
		 * Input:
		 *  - storyHistory: last N story/history message contents (ordered oldest -> newest)
		 *  - partyMembers: array of PartyMemberEventContext (id, name, known_abilities)
		 * Output:
		 *  - thoughts: overall model meta reasoning string
		 *  - events_by_member: one element per input member preserving order; each may contain
		 *      character_changed or abilities_learned (or both/none)
		 * Behavior:
		 *  - Does NOT hallucinate members; strictly mirrors provided list
		 *  - Skips abilities already in known_abilities
		 *  - Ensures null/empty when no event
		 */
		// Build a compact representation of party context for model
		const partyContext = partyMembers.map((m) => ({
			character_id: m.id,
			character_name: m.name,
			known_abilities: m.known_abilities
		}));

		const partyJsonFormat = `{
	"party_events": [
		{
			"character_id": "string; EXACT id from input",
			"character_name": "string; reuse provided name",
			"reasoning": "Brief reasoning for this specific character (1-2 sentences)",
			"character_changed": null | {"changed_into": "string; single word only what the character transformed into", "description": string},
			"abilities_learned": [{"uniqueTechnicalId": string, "name": string, "effect": string}, ...]
		}, ... one object per party member, keep order of input
	]
}`;

		const agent = [
			'You are an RPG EVENT EVALUATION agent. Evaluate recent STORY for EACH party member independently.',
			'ONLY report events that are explicitly stated or strongly implied. Do NOT infer hypothetical future possibilities.',
			'For each member decide:',
			"1. character_changed: Major, likely permanent transformation (profession rank change, species change, possession, crystal power infusion, etc). If none => null.",
			"2. abilities_learned: New abilities/spells/skills explicitly gained in story (exclude already known abilities). If none => empty array.",
			'You MUST return one entry per provided party member (even if both fields empty/null).',
			'Party context (DO NOT hallucinate new members): ' + stringifyPretty(partyContext),
			`${jsonRule}\n` + partyJsonFormat
		];

		const request: LLMRequest = {
			userMessage: 'Evaluate party events for STORY PROGRESSION (recent excerpts):\n' + storyHistory.join('\n'),
			systemInstruction: agent,
			model: GEMINI_MODELS.FLASH_THINKING_2_0,
			temperature: 0.1,
			reportErrorToUser: false
		};

		const response = await this.llm.generateContent(request);
		const raw = response?.content as PartyEventEvaluationResponse | undefined;
		let events: CharacterEventEvaluation[] = [];
		if (raw && Array.isArray(raw.party_events)) {
			events = raw.party_events.map((e) => this.mapPartyCharacterEvent(e));
		}
		return {
			thoughts: response?.thoughts || '',
			events_by_member: events
		};
	}

	private mapPartyCharacterEvent(e: CharacterEventEvaluation): CharacterEventEvaluation {
		return {
			character_id: e.character_id,
			character_name: e.character_name,
			reasoning: e.reasoning,
			character_changed: e.character_changed
				? {
					...e.character_changed,
					aiProcessingComplete: true,
					showEventConfirmationDialog: false
				}
				: undefined,
			abilities_learned: e.abilities_learned
				? {
					...e.abilities_learned,
					aiProcessingComplete: true,
					showEventConfirmationDialog: false
				}
				: undefined
		};
	}
}
