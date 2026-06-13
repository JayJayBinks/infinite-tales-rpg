import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { GameActionState } from './gameAgent';
import { GEMINI_MODELS } from '../geminiProvider';
import { jsonRule } from './agentUtils';
import { shouldUseLocalPromptViews } from '$lib/ai/localPromptViews';

export type RelatedStoryHistory = {
	relatedDetails: { storyReference: string; relevanceScore: number }[];
};

type RelatedHistorySearchTerms = {
	specificKeywords?: string[];
	entities?: string[];
	locations?: string[];
	plotHooks?: string[];
};

const relatedHistorySearchSchema = {
	name: 'related_history_search_terms',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['specificKeywords', 'entities', 'locations', 'plotHooks'],
		properties: {
			specificKeywords: {
				type: 'array',
				minItems: 1,
				maxItems: 8,
				items: { type: 'string', maxLength: 80 }
			},
			entities: {
				type: 'array',
				maxItems: 6,
				items: { type: 'string', maxLength: 80 }
			},
			locations: {
				type: 'array',
				maxItems: 5,
				items: { type: 'string', maxLength: 80 }
			},
			plotHooks: {
				type: 'array',
				maxItems: 5,
				items: { type: 'string', maxLength: 100 }
			}
		}
	}
};

const genericHistoryTerms = new Set([
	'action',
	'adventure',
	'abenteuer',
	'attack',
	'attaque',
	'ataque',
	'battle',
	'bataille',
	'batalla',
	'character',
	'charakter',
	'personnage',
	'personaje',
	'city',
	'ciudad',
	'stadt',
	'ville',
	'clue',
	'hinweis',
	'indice',
	'combat',
	'combate',
	'kampf',
	'danger',
	'gefahr',
	'peligro',
	'door',
	'puerta',
	'tuer',
	'tur',
	'porte',
	'enemy',
	'ennemi',
	'enemigo',
	'feind',
	'fight',
	'pelea',
	'guard',
	'garde',
	'guardia',
	'waechter',
	'wache',
	'help',
	'aide',
	'ayuda',
	'hilfe',
	'investigate',
	'investigar',
	'untersuchen',
	'item',
	'gegenstand',
	'objet',
	'objeto',
	'location',
	'lugar',
	'ort',
	'magic',
	'magia',
	'magie',
	'memory',
	'erinnerung',
	'memoria',
	'memoire',
	'mission',
	'mystery',
	'geheimnis',
	'misterio',
	'mystere',
	'npc',
	'place',
	'player',
	'joueur',
	'jugador',
	'spieler',
	'quest',
	'quete',
	'room',
	'habitation',
	'habitacion',
	'raum',
	'secret',
	'geheim',
	'secreto',
	'story',
	'geschichte',
	'historia',
	'histoire',
	'thing',
	'ding',
	'chose',
	'cosa',
	'travel',
	'reise',
	'viaje',
	'voyage',
	'weapon',
	'arme',
	'arma',
	'world',
	'welt',
	'monde',
	'mundo'
]);

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
			jsonRule +
			'{"keyDetails": string array, "story": ""}';

		const toSummarize = historyMessages.slice(2, (numOfLastActions + 1) * -1);
		console.log('toSummarize', toSummarize);
		const request: LLMRequest = {
			userMessage: 'Summarize the following story: \n' + stringifyPretty(toSummarize),
			systemInstruction: agent,
			temperature: 1,
			model: GEMINI_MODELS.FLASH_THINKING_2_0,
			reportErrorToUser: false
		};
		const response = (await this.llm.generateContent(request))?.content as {
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
		if (shouldUseLocalPromptViews(this.llm)) {
			return this.retrieveRelatedHistoryLocal(
				storyProgression,
				gameStates,
				maxRelatedDetails,
				additionalHistory
			);
		}
		if ((!additionalHistory || additionalHistory?.length === 0) && gameStates.length <= 20) {
			return { relatedDetails: [] };
		}
		const jsonPrompt =
			`${jsonRule} {"relatedDetails": [{"storyReference": string, "relevanceScore": decimal number; 0-1}] array length ` +
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
			temperature: 0.1,
			reportErrorToUser: false
		};
		const response = (await this.llm.generateContent(request))?.content as
			| RelatedStoryHistory
			| undefined;
		console.log(storyProgression, 'Related history returned ', stringifyPretty(response));
		if (!response || !Array.isArray(response.relatedDetails)) {
			return { relatedDetails: [] };
		}
		return {
			relatedDetails: response.relatedDetails
				.filter((detail) => Boolean(detail?.storyReference))
				.map((detail) => ({
					storyReference: String(detail.storyReference),
					relevanceScore: Number(detail.relevanceScore)
				}))
		};
	}

	private async retrieveRelatedHistoryLocal(
		storyProgression: string,
		gameStates: GameActionState[],
		maxRelatedDetails = 3,
		additionalHistory?: string[]
	): Promise<RelatedStoryHistory> {
		if ((!additionalHistory || additionalHistory.length === 0) && gameStates.length <= 20) {
			return { relatedDetails: [] };
		}
		const terms = await this.extractLocalRelatedHistoryTerms(storyProgression);
		const scoredHistory = this.searchRelatedHistoryLocally(
			storyProgression,
			gameStates,
			terms,
			maxRelatedDetails,
			additionalHistory
		);
		console.log(storyProgression, 'Local related history returned ', stringifyPretty(scoredHistory));
		return scoredHistory;
	}

	private async extractLocalRelatedHistoryTerms(
		storyProgression: string
	): Promise<RelatedHistorySearchTerms> {
		const agent = [
			'Extract search terms for finding relevant past RPG story memories. Return only specific terms that could identify old events.',
			'Prefer proper names, unique item names, factions, places, plot IDs, unusual phrases and concrete problems.',
			'Never return generic genre words like danger, mystery, guard, city, magic, enemy, door, quest, clue or story.',
			'This applies in every language: avoid generic translations like Stadt, Magie, Feind, ville, magie, ennemi, ciudad, magia, enemigo.',
			`${jsonRule} {"specificKeywords": string[], "entities": string[], "locations": string[], "plotHooks": string[]}`
		];
		const request: LLMRequest = {
			userMessage: 'CURRENT STORY OR ACTION:\n' + trimMiddle(storyProgression, 2200),
			systemInstruction: agent,
			model: GEMINI_MODELS.FLASH_LITE_2_5,
			temperature: 0.1,
			reportErrorToUser: false,
			responseJsonSchema: relatedHistorySearchSchema,
			debugMetadata: {
				promptViewType: 'related-history-query',
				promptPreview: trimMiddle(storyProgression, 1200),
				promptViewReductions: ['related history uses keyword extraction plus local search']
			}
		};
		try {
			const response = (await this.llm.generateContent(request))?.content as
				| RelatedHistorySearchTerms
				| undefined;
			const sanitized = sanitizeSearchTerms(response);
			if (flattenTerms(sanitized).length > 0) return sanitized;
		} catch (error) {
			console.warn('Failed to extract local related history search terms', error);
		}
		return {
			specificKeywords: deterministicSearchTerms(storyProgression),
			entities: [],
			locations: [],
			plotHooks: []
		};
	}

	private searchRelatedHistoryLocally(
		storyProgression: string,
		gameStates: GameActionState[],
		terms: RelatedHistorySearchTerms,
		maxRelatedDetails: number,
		additionalHistory?: string[]
	): RelatedStoryHistory {
		const cleanTerms = flattenTerms(sanitizeSearchTerms(terms));
		if (cleanTerms.length === 0) return { relatedDetails: [] };
		const currentGameStateId = gameStates[gameStates.length - 1]?.id ?? Number.MAX_SAFE_INTEGER;
		const candidates = gameStates
			.filter((state) => {
				if (!state?.story) return false;
				return (
					state.id <= currentGameStateId - 10 &&
					(!state.story_memory_explanation ||
						state.story_memory_explanation.includes('HIGH') ||
						state.story_memory_explanation.includes('MEDIUM'))
				);
			})
			.map((state) => ({
				storyReference: state.story,
				searchText: [
					state.story,
					state.currentPlotPoint,
					state.nextPlotPoint,
					state.story_memory_explanation,
					(state as Partial<GameActionState> & { currently_present_npcs_explanation?: string })
						.currently_present_npcs_explanation
				].join('\n'),
				recency: state.id
			}));
		additionalHistory?.forEach((note, index) => {
			candidates.push({
				storyReference: note,
				searchText: note,
				recency: currentGameStateId + index + 1
			});
		});
		const queryTerms = deterministicSearchTerms(storyProgression);
		console.log('Local related history search terms', stringifyPretty({ cleanTerms, queryTerms }));
		return {
			relatedDetails: candidates
				.map((candidate) => {
					const score =
						scoreHistoryCandidate(candidate.searchText, cleanTerms) +
						scoreHistoryCandidate(candidate.searchText, queryTerms) * 0.35;
					return {
						storyReference: trimMiddle(candidate.storyReference, 1200),
						relevanceScore: Math.min(0.99, score),
						recency: candidate.recency
					};
				})
				.filter((detail) => detail.relevanceScore >= 0.7)
				.toSorted((a, b) => b.relevanceScore - a.relevanceScore || b.recency - a.recency)
				.slice(0, maxRelatedDetails)
				.map(({ storyReference, relevanceScore }) => ({ storyReference, relevanceScore }))
		};
	}
}

function sanitizeSearchTerms(terms?: RelatedHistorySearchTerms): RelatedHistorySearchTerms {
	return {
		specificKeywords: sanitizeTermList(terms?.specificKeywords, 8),
		entities: sanitizeTermList(terms?.entities, 6),
		locations: sanitizeTermList(terms?.locations, 5),
		plotHooks: sanitizeTermList(terms?.plotHooks, 5)
	};
}

function sanitizeTermList(values: unknown, limit: number): string[] {
	if (!Array.isArray(values)) return [];
	const seen = new Set<string>();
	return values
		.map((value) => String(value || '').trim())
		.map((value) => value.replace(/^["']|["']$/g, ''))
		.filter((value) => value.length >= 4 && value.length <= 100)
		.filter((value) => {
			const normalized = normalizeTerm(value);
			if (genericHistoryTerms.has(normalized)) return false;
			const words = normalized.split(' ').filter(Boolean);
			if (words.length === 1 && genericHistoryTerms.has(words[0])) return false;
			if (words.length > 0 && words.every((word) => genericHistoryTerms.has(word))) return false;
			if (seen.has(normalized)) return false;
			seen.add(normalized);
			return true;
		})
		.slice(0, limit);
}

function flattenTerms(terms: RelatedHistorySearchTerms): string[] {
	return [
		...(terms.specificKeywords || []),
		...(terms.entities || []),
		...(terms.locations || []),
		...(terms.plotHooks || [])
	];
}

function deterministicSearchTerms(text: string, limit = 10): string[] {
	const phrases =
		text.match(/\b[A-Z][A-Za-z0-9_-]*(?:\s+[A-Z][A-Za-z0-9_-]*){0,3}\b/g) || [];
	const quoted = text.match(/"([^"]{4,80})"/g)?.map((value) => value.replaceAll('"', '')) || [];
	const technical = text.match(/\b[A-Za-z]+[-_][A-Za-z0-9_-]+\b/g) || [];
	const words = text
		.split(/[^A-Za-z0-9_-]+/)
		.filter((word) => word.length >= 6)
		.filter((word) => !genericHistoryTerms.has(normalizeTerm(word)));
	return sanitizeTermList([...phrases, ...quoted, ...technical, ...words], limit);
}

function scoreHistoryCandidate(text: string, terms: string[]): number {
	const normalizedText = normalizeTerm(text);
	let score = 0;
	for (const term of terms) {
		const normalizedTerm = normalizeTerm(term);
		if (!normalizedTerm) continue;
		if (normalizedText.includes(normalizedTerm)) {
			score += scoreExactTermMatch(normalizedTerm);
			continue;
		}
		const words = normalizedTerm
			.split(' ')
			.filter((word) => word.length >= 4 && !genericHistoryTerms.has(word));
		if (words.length >= 2 && words.every((word) => normalizedText.includes(word))) {
			score += 0.28;
		} else {
			score += Math.min(0.24, words.filter((word) => normalizedText.includes(word)).length * 0.06);
		}
	}
	return score;
}

function scoreExactTermMatch(normalizedTerm: string): number {
	if (normalizedTerm.includes('_') || normalizedTerm.includes('-') || /\d/.test(normalizedTerm)) {
		return 0.85;
	}
	if (normalizedTerm.includes(' ')) {
		const words = normalizedTerm.split(' ').filter(Boolean);
		return words.length >= 2 ? 0.75 : 0.18;
	}
	return 0.18;
}

function normalizeTerm(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/ß/g, 'ss')
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/[^a-z0-9_-]+/g, ' ')
		.trim();
}

function trimMiddle(text: string | undefined, maxCharacters: number): string {
	if (!text || text.length <= maxCharacters) return text || '';
	const half = Math.floor(maxCharacters / 2);
	return text.slice(0, half) + '\n[...trimmed for local related history...]\n' + text.slice(half * -1);
}
