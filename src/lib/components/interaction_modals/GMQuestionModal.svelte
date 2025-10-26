<script lang="ts">
import { aiStateStore } from '$lib/state/stores';
	import { onMount } from 'svelte';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import {
		defaultGameSettings,
		type GameActionState,
		GameAgent,
		type GameMasterAnswer,
		type GameSettings,
		type InventoryState,
		type PlayerCharactersGameState
	} from '$lib/ai/agents/gameAgent';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { Story } from '$lib/ai/agents/storyAgent';
	import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
	import {
		initialSystemInstructionsState,
		type LLMMessage,
		type SystemInstructionsState
	} from '$lib/ai/llm';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { initialThoughtsState, type ThoughtsState } from '$lib/util.svelte';
	import type { AIConfig } from '$lib';
	import { SummaryAgent } from '$lib/ai/agents/summaryAgent';
	import type { NPCState } from '$lib/ai/agents/characterStatsAgent';
	import type { Campaign, CampaignChapter } from '$lib/ai/agents/campaignAgent';

	let {
		onclose,
		question,
		playerCharactersGameState,
		restrainedExplanationByMemberState
	}: {
		onclose?;
		question: string;
		playerCharactersGameState: PlayerCharactersGameState;
		restrainedExplanationByMemberState: Record<string, string | null>;
	} = $props();

	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const systemInstructionsState = useLocalStorage<SystemInstructionsState>(
		'systemInstructionsState',
		initialSystemInstructionsState
	);
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	const storyState = useLocalStorage<Story>('storyState');
	const characterState = useLocalStorage<CharacterDescription>('characterState');
	const historyMessagesState = useLocalStorage<LLMMessage[]>('historyMessagesState');
	const inventoryState = useLocalStorage<InventoryState>('inventoryState', {});
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	const gameActionsState = useLocalStorage<GameActionState[]>('gameActionsState');
	const customMemoriesState = useLocalStorage<string>('customMemoriesState');
	const customGMNotesState = useLocalStorage<string>('customGMNotesState');
	const npcState = useLocalStorage<NPCState>('npcState', {});
	const gameSettingsState = useLocalStorage<GameSettings>(
		'gameSettingsState',
		defaultGameSettings()
	);
	const thoughtsState = useLocalStorage<ThoughtsState>('thoughtsState', initialThoughtsState);
	const campaignState = useLocalStorage<Campaign>('campaignState');
	const currentChapterState = useLocalStorage<number>('currentChapterState');
	const getCurrentCampaignChapter = (): CampaignChapter | undefined =>
		campaignState.value?.chapters.find(
			(chapter) => chapter.chapterId === currentChapterState.value
		);
	const currentGameActionState: GameActionState = $derived(
		(gameActionsState.value && gameActionsState.value[gameActionsState.value.length - 1]) ||
			({} as GameActionState)
	);

	let gameAgent: GameAgent;
	let gmAnswerState: GameMasterAnswer | undefined = $state();
	let gmThoughtsState: string | undefined = $state();
	let isGeneratingState: boolean = $state(false);

	onMount(async () => {
		const llm = LLMProvider.provideLLM({
			temperature: 0.7,
			language: aiLanguage.value,
			apiKey: aiStateStore.apiKey
		});
		gameAgent = new GameAgent(llm);
		const summaryAgent = new SummaryAgent(llm);
		isGeneratingState = true;
		const relatedQuestionHistory = (
			await summaryAgent.retrieveRelatedHistory(question, gameActionsState.value)
		)?.relatedDetails
			.filter((detail) => detail.relevanceScore >= 0.7)
			.map((detail) => detail.storyReference);

		if (customMemoriesState.value) {
			relatedQuestionHistory.push(customMemoriesState.value);
		}
		const { thoughts, answer } = await gameAgent.generateAnswerForPlayerQuestion(
			question,
			thoughtsState.value,
			aiStateStore.systemInstructions,
			historyMessagesState.value,
			storyState.value,
			characterState.value,
			playerCharactersGameState,
			inventoryState.value,
			npcState.value,
			relatedQuestionHistory,
			gameSettingsState.value,
			getCurrentCampaignChapter(),
			customGMNotesState.value,
			undefined,
			restrainedExplanationByMemberState
		);
		gmAnswerState = answer;
		gmThoughtsState = thoughts;
		isGeneratingState = false;
		if (!gmAnswerState) {
			onclose(false);
		}
	});
</script>

{#if isGeneratingState}
	<LoadingModal />
{:else}
	<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
		<div class="modal-box flex flex-col items-center text-center">
			<span class="m-auto font-bold">Game Master Answer</span>
			<p class="mt-4 max-h-48 overflow-y-scroll">{gmAnswerState?.answerToPlayer}</p>
			<details
				class="collapse collapse-arrow textarea-bordered mt-4 overflow-y-scroll border bg-base-200"
			>
				<summary class="collapse-title capitalize">
					<p>Considered Game State</p>
				</summary>
				<p>{gmAnswerState?.game_state_considered || 'The AI did not return a response...'}</p>
			</details>
			<details
				class="collapse collapse-arrow textarea-bordered mt-4 overflow-y-scroll border bg-base-200"
			>
				<summary class="collapse-title capitalize">
					<p>Considered Rules</p>
				</summary>
				<ul class="text-start">
					{#each gmAnswerState?.rules_considered || [] as rule}
						<li class="ml-2 mt-1 list-item">
							{rule.startsWith('-') ? rule : '- ' + rule}
						</li>
					{/each}
				</ul>
			</details>
			{#if gmThoughtsState}
				<details
					class="collapse collapse-arrow textarea-bordered mt-4 overflow-y-scroll border bg-base-200"
				>
					<summary class="collapse-title capitalize">
						<p>Thoughts</p>
					</summary>
					<p>{gmThoughtsState}</p>
				</details>
			{/if}
			<div class="mt-3 flex w-full flex-row gap-2">
				<button
					class="btn btn-info flex-1"
					onclick={() => onclose(true, { question, ...gmAnswerState })}>Add to context</button
				>
				<button class="btn btn-info flex-1" onclick={() => onclose(true)}>Close</button>
			</div>
		</div>
	</dialog>
{/if}
