<script lang="ts">
	import { type CharacterStats } from '$lib/ai/agents/characterStatsAgent';
	import { onMount } from 'svelte';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { type CharacterDescription } from '$lib/ai/agents/characterAgent';
	import type { LLMMessage } from '$lib/ai/llm';
	import type { Story } from '$lib/ai/agents/storyAgent';
	import { ActionAgent } from '$lib/ai/agents/actionAgent';
	import type {
		Action,
		GameActionState,
		InventoryState,
		ItemWithId,
		ResourcesWithCurrentValue
	} from '$lib/ai/agents/gameAgent';
	import { getTextForActionButton } from '$lib/util.svelte';
	import { isEnoughResource } from '../../../routes/game/gameLogic';
	import LoadingIcon from '$lib/components/LoadingIcon.svelte';
	import type { AIConfig } from '$lib';

	let {
		onclose,
		currentGameActionState,
		resources,
		itemForSuggestActionsState
	}: {
		onclose?;
		currentGameActionState: GameActionState;
		resources: ResourcesWithCurrentValue;
		itemForSuggestActionsState: ItemWithId;
	} = $props();

	const storyState = useLocalStorage<Story>('storyState');
	const characterState = useLocalStorage<CharacterDescription>('characterState');
	const characterStatsState = useLocalStorage<CharacterStats>('characterStatsState');
	const historyMessagesState = useLocalStorage<LLMMessage[]>('historyMessagesState');
	const inventoryState = useLocalStorage<InventoryState>('inventoryState', {});

	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	const temperatureState = useLocalStorage<number>('temperatureState');
	const customSystemInstruction = useLocalStorage<string>('customSystemInstruction');
	const storySummaryState = useLocalStorage<string>('storySummaryState');
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	let suggestedActions: Array<Action> = $state([]);
	let customActionInput: string = $state('');

	let isGeneratingState = $state(false);
	let actionAgent: ActionAgent;

	onMount(async () => {
		const llm = LLMProvider.provideLLM(
			{
				temperature: temperatureState.value,
				language: aiLanguage.value,
				apiKey: apiKeyState.value
			},
			aiConfigState.value?.useFallbackLlmState
		);
		actionAgent = new ActionAgent(llm);

		isGeneratingState = true;
		suggestedActions = await actionAgent.generateActionsForItem(
			itemForSuggestActionsState,
			currentGameActionState,
			historyMessagesState.value,
			storyState.value,
			characterState.value,
			characterStatsState.value,
			inventoryState.value,
			customSystemInstruction.value,
			storySummaryState.value
		);
		console.log('suggestedActions', suggestedActions);
		isGeneratingState = false;
	});
</script>

<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center text-center">
		<span class="m-auto font-bold">Suggested Actions</span>
		<button onclick={() => onclose()} class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2"
			>✕</button
		>
		{#if isGeneratingState}
			<div class="mt-2 flex flex-col">
				<span class="m-auto">Generating actions...</span>
				<div class="m-auto">
					<LoadingIcon />
				</div>
			</div>
		{:else}
			{#each suggestedActions as action}
				<button
					type="button"
					disabled={!isEnoughResource(action, resources, inventoryState.value)}
					class="components btn btn-neutral no-animation mt-2"
					onclick={() => onclose(action)}
				>
					{getTextForActionButton(action)}
				</button>
			{/each}
		{/if}
		<div class="mt-2 w-full lg:join">
			<input
				type="text"
				bind:value={customActionInput}
				class="input input-bordered w-full"
				id="user-input"
				placeholder="Custom action for item"
			/>
			<button
				type="submit"
				onclick={() =>
					onclose({
						characterName: characterState.value.name,
						text: 'Use item ' + itemForSuggestActionsState.item_id + ' - ' + customActionInput,
						is_custom_action: true
					})}
				class="btn btn-neutral w-full lg:w-1/4"
				id="submit-button"
				>Submit
			</button>
		</div>
	</div>
</dialog>
