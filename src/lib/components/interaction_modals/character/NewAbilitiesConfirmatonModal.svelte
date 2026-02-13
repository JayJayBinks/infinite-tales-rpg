<script lang="ts">
	import { CharacterStatsAgent, type Ability } from '$lib/ai/agents/characterStatsAgent';
	import { onMount } from 'svelte';
	import AbilityComponent from '../AbilityComponent.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { Story } from '$lib/ai/agents/storyAgent';
	import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
	import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';
	import type { AIConfig } from '$lib';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import LoadingModal from '$lib/components/LoadingModal.svelte';

	let {
		onclose,
		spells_abilities
	}: {
		onclose: (spellsAbilities?: Ability[]) => void;
		spells_abilities: Partial<Ability>[];
	} = $props();

	const storyState = useLocalStorage<Story>('storyState');
	const characterState = useLocalStorage<CharacterDescription>('characterState');
	const characterStatsState = useLocalStorage<CharacterStats>('characterStatsState');
	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	type LlmProviderState = 'gemini' | 'openai-compatible' | 'pollinations';
	const llmProviderState = useLocalStorage<LlmProviderState>('llmProviderState', 'gemini');
	const llmBaseUrlState = useLocalStorage<string>('llmBaseUrlState', 'http://localhost:1234');
	const llmModelState = useLocalStorage<string>('llmModelState', '');
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');

	let isConfirmed = $state(false);
	let isGeneratingState = $state(false);
	let characterStatsAgent: CharacterStatsAgent;
	let newSpellsAbilities: Ability[] = $state([]);

	onMount(async () => {
		characterStatsAgent = new CharacterStatsAgent(
			LLMProvider.provideLLM(
				{
					provider: llmProviderState.value,
					baseUrl: llmBaseUrlState.value,
					model: llmModelState.value || undefined,
					temperature: 0.5,
					apiKey: apiKeyState.value,
					language: aiLanguage.value
				},
				aiConfigState.value?.useFallbackLlmState
			)
		);
	});

	const onGenerate = async () => {
		isConfirmed = true;
		await generateSpellsAbilities();
	};

	const onConfirm = async () => {
		onclose(newSpellsAbilities);
	};

	const generateSpellsAbilities = async () => {
		isGeneratingState = true;
		newSpellsAbilities = await characterStatsAgent.generateAbilitiesFromPartial(
			$state.snapshot(storyState.value),
			$state.snapshot(characterState.value),
			$state.snapshot(characterStatsState.value),
			spells_abilities
		);
		isGeneratingState = false;
	};
</script>

{#if isGeneratingState}
	<LoadingModal loadingText="AI is generating new Spells & Abilities..." />
{:else}
	<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
		<div class="modal-box flex flex-col items-center text-center">
			<span class="m-auto">New Abilities Learned</span>
			<button
				class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2"
				onclick={() => onclose()}
				>✕
			</button>
			{#if isConfirmed}
				<span class="m-auto mt-4"
					>You can edit the details afterwards in the Character Settings.</span
				>
				{#each newSpellsAbilities as ability}
					<AbilityComponent {ability} />
				{/each}
				<div class="mt-4 flex gap-2">
					<button class="btn btn-primary flex-1" onclick={() => onclose([])}>Cancel</button>
					<button class="btn btn-accent flex-1" onclick={onConfirm}>Learn</button>
				</div>
			{:else}
				<span class="m-auto mt-4">Details will be generated after confirmation.</span>
				{#each spells_abilities as ability (ability.name)}
					<div class="form-control textarea-bordered mt-3 w-full border bg-base-200">
						<span class="m-auto mt-4 font-bold">{ability.name}</span>
						<span class="m-auto mt-4">{ability.effect}</span>
					</div>
				{/each}
				<div class="mt-4 flex gap-2">
					<button class="btn btn-primary flex-1" onclick={() => onclose([])}>Cancel</button>
					<button class="btn btn-accent flex-1" onclick={onGenerate}>Generate</button>
				</div>
			{/if}
		</div>
	</dialog>
{/if}
