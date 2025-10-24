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
	import type { AIConfig } from '$lib';
	import AbilityComponent from './AbilityComponent.svelte';

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
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	let aiLevelUp: AiLevelUp | undefined = $state();

	let isGeneratingState = $state(false);
	let characterStatsAgent: CharacterStatsAgent;

	onMount(async () => {
		characterStatsAgent = new CharacterStatsAgent(
			LLMProvider.provideLLM(
				{
					temperature: 1.3,
					apiKey: apiKeyState.value,
					language: aiLanguage.value
				},
				aiConfigState.value?.useFallbackLlmState
			)
		);
		aiLevelUp = await generateLevelUp();
	});

	const generateLevelUp = async (maxRetries = 3) => {
		isGeneratingState = true;
		let attempt = 0;
		let validSuggestion: AiLevelUp | undefined = undefined;

		try {
			while (attempt < maxRetries && !validSuggestion) {
				attempt++;
				console.log(`Attempt ${attempt}/${maxRetries} to generate level up suggestion...`);

				const suggestion = await characterStatsAgent.levelUpCharacter(
					$state.snapshot(storyState.value),
					$state.snapshot(historyMessagesState.value),
					characterState.value,
					characterStatsState.value
				);

				// Basic validation of the AI response structure
				if (!suggestion || typeof suggestion.attribute !== 'string' || !suggestion.attribute) {
					console.warn(`Attempt ${attempt}: AI returned invalid suggestion structure:`, suggestion);
					continue; // Try again if attempts remain
				}

				validSuggestion = suggestion;
			}

			if (!validSuggestion) {
				console.error(`Failed to get a valid level up suggestion after ${maxRetries} attempts.`);
				return undefined;
			}
			return validSuggestion;
		} catch (error) {
			console.error('Error during level up generation:', error);
			return undefined;
		} finally {
			isGeneratingState = false;
		}
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
			<p class="m-1 font-bold capitalize">{aiLevelUp.attribute.replaceAll('_', ' ')}:</p>
			<p>
				{characterStatsState.value.attributes[aiLevelUp.attribute] || 'New attribute'} -> {characterStatsState
					.value.attributes[aiLevelUp.attribute] + 1}
			</p>
			{#each Object.keys(aiLevelUp.resources) as resourceKey}
				<p class="m-1 font-bold capitalize">{resourceKey.replaceAll('_', ' ')}:</p>
				<p>
					{characterStatsState.value.resources[resourceKey]?.max_value || 'New resource'} -> {aiLevelUp
						.resources[resourceKey]}
				</p>
			{/each}
			{#if aiLevelUp.formerAbilityName}
				<p class="mt-4 font-bold">{aiLevelUp.formerAbilityName} has leveled up to:</p>
			{:else}
				<p class="mt-2 font-bold">New ability gained:</p>
			{/if}
			<AbilityComponent ability={aiLevelUp.ability} />
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
