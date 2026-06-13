import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMRequest } from '$lib/ai/llm';
import type { Ability } from './characterStatsAgent';
import { GEMINI_MODELS } from '../geminiProvider';
import { jsonRule } from './agentUtils';
import { shouldUseLocalPromptViews } from '$lib/ai/localPromptViews';

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

const jsonFormat = `{
	"reasoning": "string; Briefly explain how the character changed from the CURRENT CHARACTER DESCRIPTION and how abilities learned if any",
	"character_changed": null | {"changed_into": "string; single word only what the character transformed into", "description": string},
	"abilities_learned": [{"uniqueTechnicalId": string, "name": string, "effect": string}, ...]
}`;

const eventEvaluationSchema = {
	name: 'event_evaluation',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['reasoning', 'character_changed', 'abilities_learned'],
		properties: {
			reasoning: { type: 'string', maxLength: 300 },
			character_changed: {
				anyOf: [
					{ type: 'null' },
					{
						type: 'object',
						additionalProperties: false,
						required: ['changed_into', 'description'],
						properties: {
							changed_into: { type: 'string', maxLength: 80 },
							description: { type: 'string', maxLength: 300 }
						}
					}
				]
			},
			abilities_learned: {
				type: 'array',
				maxItems: 4,
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['uniqueTechnicalId', 'name', 'effect'],
					properties: {
						uniqueTechnicalId: { type: 'string', maxLength: 80 },
						name: { type: 'string', maxLength: 80 },
						effect: { type: 'string', maxLength: 240 }
					}
				}
			}
		}
	}
};

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
		const useLocalPromptView = shouldUseLocalPromptViews(this.llm);
		const storyHistoryForPrompt = useLocalPromptView
			? storyHistory.slice(-3).map((entry) => trimMiddle(entry, 1600))
			: storyHistory;
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
			userMessage: 'Evaluate the events for STORY PROGRESSION:\n' + storyHistoryForPrompt.join('\n'),
			systemInstruction: agent,
			model: GEMINI_MODELS.FLASH_THINKING_2_0,
			temperature: 0.1,
			reportErrorToUser: false,
			responseJsonSchema: useLocalPromptView ? eventEvaluationSchema : undefined,
			debugMetadata: useLocalPromptView
				? {
						promptViewType: 'event',
						promptPreview: storyHistoryForPrompt.join('\n\n'),
						promptViewReductions: [
							`event history entries: ${storyHistory.length} -> ${storyHistoryForPrompt.length}`
						]
					}
				: undefined
		};
		const response = await this.llm.generateContent(request);
		console.log(response, 'Event evaluation ', stringifyPretty(response));

		return {
			thoughts: response?.thoughts || '',
			event_evaluation: this.mapResponse(response?.content || {})
		};
	}
}

function trimMiddle(text: string | undefined, maxCharacters: number): string {
	if (!text || text.length <= maxCharacters) return text || '';
	const half = Math.floor(maxCharacters / 2);
	return text.slice(0, half) + '\n[...trimmed for local event evaluation...]\n' + text.slice(half * -1);
}
