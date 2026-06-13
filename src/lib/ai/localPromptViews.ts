import type { LLM, LLMMessage } from '$lib/ai/llm';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { CharacterStats, NPCState } from '$lib/ai/agents/characterStatsAgent';
import type {
	GameActionState,
	InventoryState,
	ResourcesWithCurrentValue,
	Targets
} from '$lib/ai/agents/gameAgent';
import type { Story } from '$lib/ai/agents/storyAgent';

export type PromptViewType = 'story' | 'action' | 'combat' | 'state-only' | 'question';

export type PromptViewDebug = {
	type: PromptViewType;
	preview: string;
	reductions: string[];
};

export type PromptViewResult<T> = T & {
	debug: PromptViewDebug;
};

const MAX_PREVIEW_CHARS = 4000;
const MAX_HISTORY_MESSAGE_CHARS = 2500;

export function shouldUseLocalPromptViews(llm: LLM): boolean {
	return llm.llmConfig.provider === 'openai-compatible';
}

export function compactHistoryMessages(
	historyMessages: LLMMessage[],
	turns = 3,
	maxMessageCharacters = MAX_HISTORY_MESSAGE_CHARS
): LLMMessage[] {
	const maxMessages = Math.max(0, turns * 2);
	return historyMessages.slice(maxMessages * -1).map((message) => ({
		...message,
		content: trimMiddle(message.content, maxMessageCharacters)
	}));
}

export function buildLocalStoryPromptView(input: {
	actionText: string;
	storyState: Story;
	characterState: CharacterDescription;
	playerCharactersGameState: ResourcesWithCurrentValue;
	inventoryState: InventoryState;
	historyMessages: LLMMessage[];
	relatedHistory: string[];
}): PromptViewResult<{
	storyState: Partial<Story>;
	characterState: Partial<CharacterDescription>;
	playerCharactersGameState: ResourcesWithCurrentValue;
	inventoryState: InventoryState;
	historyMessages: LLMMessage[];
	relatedHistory: string[];
}> {
	const relevanceText = [
		input.actionText,
		input.historyMessages.at(-1)?.content,
		input.relatedHistory.join('\n')
	].join('\n');
	const inventoryState = reduceInventory(input.inventoryState, relevanceText, 10);
	const historyMessages = compactHistoryMessages(input.historyMessages, 3);
	const relatedHistory = input.relatedHistory.slice(-5).map((entry) => trimMiddle(entry, 1200));
	const characterState = reduceCharacterDescription(input.characterState);
	const storyState = reduceStory(input.storyState);
	const reductions = [
		reductionText('history messages', input.historyMessages.length, historyMessages.length),
		reductionText(
			'inventory items',
			Object.keys(input.inventoryState || {}).length,
			Object.keys(inventoryState).length
		),
		reductionText('related history entries', input.relatedHistory.length, relatedHistory.length)
	].filter(Boolean);

	return {
		storyState,
		characterState,
		playerCharactersGameState: input.playerCharactersGameState,
		inventoryState,
		historyMessages,
		relatedHistory,
		debug: buildDebug(
			'story',
			{ ...input, storyState, characterState, inventoryState, historyMessages, relatedHistory },
			reductions
		)
	};
}

export function buildLocalActionPromptView(input: {
	currentGameState: GameActionState;
	historyMessages: LLMMessage[];
	storySettings: Story;
	characterDescription: CharacterDescription;
	characterStats: CharacterStats;
	inventoryState: InventoryState;
	relatedHistory?: string[];
	actionText?: string;
}): PromptViewResult<{
	currentGameState: Partial<GameActionState>;
	historyMessages: LLMMessage[];
	storySettings: Partial<Story>;
	characterDescription: Partial<CharacterDescription>;
	characterStats: Partial<CharacterStats>;
	inventoryState: InventoryState;
	relatedHistory?: string[];
}> {
	const relevanceText = [
		input.actionText,
		input.currentGameState?.story,
		input.relatedHistory?.join('\n')
	].join('\n');
	const currentGameState = reduceGameState(input.currentGameState);
	const historyMessages = compactHistoryMessages(input.historyMessages, 2);
	const storySettings = reduceStoryForActions(input.storySettings);
	const characterDescription = reduceCharacterDescription(input.characterDescription);
	const characterStats = reduceCharacterStats(input.characterStats, relevanceText);
	const inventoryState = reduceInventory(input.inventoryState, relevanceText, 8);
	const relatedHistory = input.relatedHistory?.slice(-4).map((entry) => trimMiddle(entry, 1000));
	const reductions = [
		reductionText('history messages', input.historyMessages.length, historyMessages.length),
		reductionText(
			'inventory items',
			Object.keys(input.inventoryState || {}).length,
			Object.keys(inventoryState).length
		),
		reductionText(
			'abilities',
			input.characterStats.spells_and_abilities?.length || 0,
			characterStats.spells_and_abilities?.length || 0
		),
		reductionText(
			'related history entries',
			input.relatedHistory?.length || 0,
			relatedHistory?.length || 0
		)
	].filter(Boolean);

	return {
		currentGameState,
		historyMessages,
		storySettings,
		characterDescription,
		characterStats,
		inventoryState,
		relatedHistory,
		debug: buildDebug(
			'action',
			{
				currentGameState,
				storySettings,
				characterDescription,
				characterStats,
				inventoryState,
				relatedHistory
			},
			reductions
		)
	};
}

export function buildLocalCombatPromptView(input: {
	actionText: string;
	playerCharResources: ResourcesWithCurrentValue;
	inventoryState: InventoryState;
	npcsList: Array<object>;
	historyMessages: LLMMessage[];
	storyState: Story;
}): PromptViewResult<{
	playerCharResources: ResourcesWithCurrentValue;
	inventoryState: InventoryState;
	npcsList: Array<object>;
	historyMessages: LLMMessage[];
	storyState: Partial<Story>;
}> {
	const relevanceText = [input.actionText, JSON.stringify(input.npcsList)].join('\n');
	const inventoryState = reduceInventory(input.inventoryState, relevanceText, 6);
	const historyMessages = compactHistoryMessages(input.historyMessages, 2);
	const npcsList = input.npcsList.map(reduceNpcObject);
	const storyState = reduceStoryForActions(input.storyState);
	const reductions = [
		reductionText('history messages', input.historyMessages.length, historyMessages.length),
		reductionText(
			'inventory items',
			Object.keys(input.inventoryState || {}).length,
			Object.keys(inventoryState).length
		)
	].filter(Boolean);
	return {
		playerCharResources: input.playerCharResources,
		inventoryState,
		npcsList,
		historyMessages,
		storyState,
		debug: buildDebug(
			'combat',
			{ actionText: input.actionText, storyState, npcsList, inventoryState },
			reductions
		)
	};
}

export function reduceNpcStateForNames(npcState: NPCState, limit = 50): string[] {
	return Object.entries(npcState || {})
		.slice(limit * -1)
		.map(([id, npc]) => [id, ...(npc.known_names || [])].join(', '));
}

export function reduceTargets(targets?: Targets): Targets | undefined {
	if (!targets) return targets;
	return {
		hostile: targets.hostile || [],
		friendly: targets.friendly || [],
		neutral: targets.neutral || []
	};
}

export function promptViewToRequestMetadata(debug?: PromptViewDebug) {
	if (!debug) return undefined;
	return {
		promptViewType: debug.type,
		promptPreview: debug.preview,
		promptViewReductions: debug.reductions
	};
}

function reduceInventory(
	inventory: InventoryState,
	relevanceText: string,
	limit: number
): InventoryState {
	const entries = Object.entries(inventory || {});
	if (entries.length <= limit) return inventory || {};
	const terms = keywordSet(relevanceText);
	const scored = entries
		.map(([id, item], index) => ({
			id,
			item,
			index,
			score: scoreText(id + ' ' + item.description + ' ' + item.effect, terms)
		}))
		.toSorted((a, b) => b.score - a.score || b.index - a.index)
		.slice(0, limit)
		.toSorted((a, b) => a.index - b.index);
	return Object.fromEntries(scored.map(({ id, item }) => [id, item]));
}

function reduceCharacterDescription(
	character: CharacterDescription
): Partial<CharacterDescription> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(character || {})) {
		if (value === undefined || value === null || value === '') continue;
		const valueText = String(value);
		const important =
			['name', 'appearance', 'class', 'personality', 'background'].includes(key) ||
			Object.keys(result).length < 5;
		if (important) result[key] = trimMiddle(valueText, 900);
	}
	return result as Partial<CharacterDescription>;
}

function reduceCharacterStats(
	stats: CharacterStats,
	relevanceText: string
): Partial<CharacterStats> {
	const terms = keywordSet(relevanceText);
	const abilities = (stats.spells_and_abilities || [])
		.map((ability, index) => ({
			ability,
			index,
			score: scoreText(ability.name + ' ' + ability.effect, terms)
		}))
		.toSorted((a, b) => b.score - a.score || b.index - a.index)
		.slice(0, 8)
		.toSorted((a, b) => a.index - b.index)
		.map(({ ability }) => ability);
	return {
		level: stats.level,
		resources: stats.resources,
		attributes: stats.attributes,
		skills: stats.skills,
		spells_and_abilities: abilities
	};
}

function reduceStory(story: Story): Partial<Story> {
	return {
		game: story.game,
		world_details: trimMiddle(story.world_details, 1600),
		adventure_and_main_event: trimMiddle(story.adventure_and_main_event, 2500),
		character_simple_description: trimMiddle(story.character_simple_description, 900),
		theme: story.theme,
		tonality: story.tonality,
		general_image_prompt: story.general_image_prompt
	};
}

function reduceStoryForActions(story: Story): Partial<Story> {
	return {
		game: story.game,
		world_details: trimMiddle(story.world_details, 1200),
		theme: story.theme,
		tonality: story.tonality,
		general_image_prompt: story.general_image_prompt
	};
}

function reduceGameState(currentGameState: GameActionState): Partial<GameActionState> {
	return {
		currentPlotPoint: currentGameState.currentPlotPoint,
		nextPlotPoint: currentGameState.nextPlotPoint,
		story: trimMiddle(currentGameState.story, 2200),
		is_character_in_combat: currentGameState.is_character_in_combat,
		is_character_restrained_explanation: currentGameState.is_character_restrained_explanation,
		currently_present_npcs: reduceTargets(currentGameState.currently_present_npcs),
		story_memory_explanation: trimMiddle(currentGameState.story_memory_explanation, 800)
	};
}

function reduceNpcObject(npc: object): object {
	const record = npc as Record<string, any>;
	return {
		technicalId: record.technicalId ?? record.uniqueTechnicalNameId,
		uniqueTechnicalNameId: record.uniqueTechnicalNameId,
		displayName: record.displayName,
		known_names: record.known_names,
		is_party_member: record.is_party_member,
		resources: record.resources,
		class: record.class,
		rank_enum_english: record.rank_enum_english,
		level: record.level,
		spells_and_abilities: Array.isArray(record.spells_and_abilities)
			? record.spells_and_abilities.slice(0, 4)
			: record.spells_and_abilities
	};
}

function buildDebug(
	type: PromptViewType,
	previewSource: unknown,
	reductions: string[]
): PromptViewDebug {
	return {
		type,
		preview: trimMiddle(JSON.stringify(previewSource, null, 2), MAX_PREVIEW_CHARS),
		reductions
	};
}

function trimMiddle(text: string | undefined, maxCharacters: number): string {
	if (!text || text.length <= maxCharacters) return text || '';
	const half = Math.floor(maxCharacters / 2);
	return text.slice(0, half) + '\n[...trimmed for local prompt view...]\n' + text.slice(half * -1);
}

function keywordSet(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.split(/[^a-z0-9_]+/)
			.filter((term) => term.length >= 4)
	);
}

function scoreText(text: string, terms: Set<string>): number {
	const normalized = text.toLowerCase();
	let score = 0;
	for (const term of terms) {
		if (normalized.includes(term)) score += 1;
	}
	return score;
}

function reductionText(label: string, before: number, after: number): string {
	if (before <= after) return '';
	return `${label}: ${before} -> ${after}`;
}
