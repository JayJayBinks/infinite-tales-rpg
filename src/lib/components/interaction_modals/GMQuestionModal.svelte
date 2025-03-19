<script lang="ts">
	import { onMount } from 'svelte';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import {
		GameAgent,
		type GameActionState,
		type GameMasterAnswer,
		type InventoryState,
		type PlayerCharactersGameState,
		type GameSettings,
		defaultGameSettings
	} from '$lib/ai/agents/gameAgent';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { Story } from '$lib/ai/agents/storyAgent';
	import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
	import type { LLMMessage } from '$lib/ai/llm';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { stringifyPretty } from '$lib/util.svelte';
	import type { AIConfig } from '$lib';
	import { SummaryAgent } from '$lib/ai/agents/summaryAgent';
	import type { NPCState } from '$lib/ai/agents/characterStatsAgent';

	let {
		onclose,
		question,
		playerCharactersGameState
	}: {
		onclose?;
		question: string;
		playerCharactersGameState: PlayerCharactersGameState;
	} = $props();

	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const customSystemInstruction = useLocalStorage<string>('customSystemInstruction');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	const storyState = useLocalStorage<Story>('storyState');
	const characterState = useLocalStorage<CharacterDescription>('characterState');
	const historyMessagesState = useLocalStorage<LLMMessage[]>('historyMessagesState');
	const inventoryState = useLocalStorage<InventoryState>('inventoryState', {});
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	const gameActionsState = useLocalStorage<GameActionState[]>('gameActionsState');
	const customMemoriesState = useLocalStorage<string>('customMemoriesState');
	const npcState = useLocalStorage<NPCState>('npcState', {});
	let gameSettingsState = useLocalStorage<GameSettings>('gameSettingsState', defaultGameSettings());

	let gameAgent: GameAgent;
	let gmAnswerState: GameMasterAnswer | undefined = $state();
	let isGeneratingState: boolean = $state(false);

	onMount(async () => {
		const llm = LLMProvider.provideLLM(
			{
				temperature: 0.7,
				language: aiLanguage.value,
				apiKey: apiKeyState.value
			},
			aiConfigState.value?.useFallbackLlmState
		);
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
		gmAnswerState = await gameAgent.generateAnswerForPlayerQuestion(
			question,
			customSystemInstruction.value,
			historyMessagesState.value,
			storyState.value,
			characterState.value,
			playerCharactersGameState,
			inventoryState.value,
			npcState.value,
			relatedQuestionHistory,
			gameSettingsState.value
		);
		console.log(stringifyPretty(gmAnswerState));
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
			<button class="btn btn-info mt-3" onclick={() => onclose(true)}>Close</button>
		</div>
	</dialog>
{/if}
