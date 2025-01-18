<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		type AiLevelUp,
		type CharacterStats,
		CharacterStatsAgent
	} from '$lib/ai/agents/characterStatsAgent';
	import { onMount } from 'svelte';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { type CharacterDescription } from '$lib/ai/agents/characterAgent';
	import type { LLMMessage } from '$lib/ai/llm';
	import type { Story } from '$lib/ai/agents/storyAgent';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { getLevelUpText } from '../../routes/game/levelLogic';

	let {
		onclose
	}: {
		onclose?;
	} = $props();

	const storyState = useLocalStorage<Story>('storyState');
	const characterState = useLocalStorage<CharacterDescription>('characterState');
	const characterStatsState = useLocalStorage<CharacterStats>('characterStatsState');
	const historyMessagesState = useLocalStorage<LLMMessage[]>('historyMessagesState');
	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	let aiLevelUp: AiLevelUp | undefined = $state();
	let levelUpText:
		| {
				prefix: string;
				traitUpdate: string;
		  }
		| undefined = $state();

	let isGeneratingState = $state(false);
	let characterStatsAgent: CharacterStatsAgent;

	onMount(async () => {
		characterStatsAgent = new CharacterStatsAgent(
			LLMProvider.provideLLM({
				temperature: 2,
				apiKey: apiKeyState.value,
				language: aiLanguage.value
			})
		);
		await generateLevelUp();
	});

	const generateLevelUp = async () => {
		isGeneratingState = true;
		aiLevelUp = await characterStatsAgent.levelUpCharacter(
			$state.snapshot(storyState.value),
			$state.snapshot(historyMessagesState.value),
			characterState.value,
			characterStatsState.value
		);
		console.log(aiLevelUp);
		if (aiLevelUp) {
			levelUpText = getLevelUpText(aiLevelUp?.trait, characterStatsState.value);
		}
		isGeneratingState = false;
	};
	let acceptAILevelUp = () => {
		if (onclose) {
			onclose(aiLevelUp);
		}
		aiLevelUp = undefined;
	};
</script>

{#if isGeneratingState}
	<LoadingModal loadingText="AI is choosing the level up..." />
{/if}
{#if aiLevelUp}
	<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
		<div class="modal-box flex flex-col items-center text-center">
			<form method="dialog">
				<span class="m-auto font-bold">Leveled up to {characterStatsState.value.level + 1}!</span>
			</form>
			<p class="mt-2">{aiLevelUp.level_up_explanation}</p>
			<p class="mt-4 font-bold">The AI has chosen following updates:</p>
			<p class="m-1 font-bold">{levelUpText?.prefix}</p>
			<p class="m-1">{levelUpText?.traitUpdate}</p>
			{#each Object.keys(aiLevelUp.resources) as resourceKey}
				<p class="m-1 font-bold">{resourceKey.replaceAll('_', ' ')}:</p>
				<p>
					{characterStatsState.value.resources[resourceKey]} -> {aiLevelUp.resources[resourceKey]}
				</p>
			{/each}
			{#if aiLevelUp.formerAbilityName}
				<p class="mt-4 font-bold">{aiLevelUp.formerAbilityName} has leveled up to:</p>
			{:else}
				<p class="mt-2 font-bold">New ability gained:</p>
			{/if}
			<label class="form-control textarea-bordered mt-3 w-full border bg-base-200">
				<div
					class="mt-4 grid grid-cols-2 overflow-hidden overflow-ellipsis text-center sm:grid-cols-6"
				>
					<div class="m-auto sm:col-span-3">
						<AIGeneratedImage
							noLogo={true}
							enhance={false}
							imageClassesString="w-[90px] sm:w-[100px] h-[90px] sm:h-[100px] m-auto"
							imagePrompt={CharacterStatsAgent.getSpellImagePrompt(
								aiLevelUp?.ability,
								storyState?.value?.general_image_prompt
							)}
							showGenerateButton={false}
						></AIGeneratedImage>
					</div>
					<div class="m-auto w-full sm:col-span-2">
						<p class="badge badge-info">{aiLevelUp.ability.mp_cost} MP</p>
						<p class="mt-2 overflow-hidden overflow-ellipsis">{aiLevelUp.ability.name}</p>
					</div>
				</div>
				<p class="m-5 mt-2">
					{aiLevelUp.ability.effect}
				</p>
			</label>
			<button type="button" class="components btn btn-primary mt-2" onclick={acceptAILevelUp}>
				Accept
			</button>
			<p class="mt-4">
				You can also choose the level up yourself, you will be directed to the Character Stats and
				can edit freely
			</p>
			<button
				type="button"
				class="components btn btn-neutral mt-2"
				onclick={() => {
					if (onclose) {
						onclose();
					}
					goto('game/new/characterStats');
				}}
			>
				Manual Level Up
			</button>
		</div>
	</dialog>
{/if}
