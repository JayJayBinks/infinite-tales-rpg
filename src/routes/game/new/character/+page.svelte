<script lang="ts">
	import { onMount } from 'svelte';
	import {
		CharacterAgent,
		type CharacterDescription,
		initialCharacterState
	} from '$lib/ai/agents/characterAgent';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { getRowsForTextarea, navigate } from '$lib/util.svelte';
	import isEqual from 'lodash.isequal';
	import { beforeNavigate, goto } from '$app/navigation';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { initialStoryState, type Story } from '$lib/ai/agents/storyAgent';
	import type { Campaign } from '$lib/ai/agents/campaignAgent';
	import type { AIConfig } from '$lib';
	import type { PlayerCharactersIdToNamesMap } from '$lib/ai/agents/gameAgent';
	import {
		addCharacterToPlayerCharactersIdToNamesMap,
		getCharacterTechnicalId
	} from '../../characterLogic';

	let isGeneratingState = $state(false);
	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	type LlmProviderState = 'gemini' | 'openai-compatible' | 'pollinations';
	const llmProviderState = useLocalStorage<LlmProviderState>('llmProviderState', 'gemini');
	const llmBaseUrlState = useLocalStorage<string>('llmBaseUrlState', 'http://localhost:1234');
	const llmModelState = useLocalStorage<string>('llmModelState', '');
	const storyState = useLocalStorage<Story>('storyState', initialStoryState);
	const campaignState = useLocalStorage<Campaign>('campaignState');
	const characterState = useLocalStorage<CharacterDescription>(
		'characterState',
		initialCharacterState
	);
	const textAreaRowsDerived = $derived(getRowsForTextarea(characterState.value));

	let characterStateOverwrites: Partial<CharacterDescription> = $state({});
	let resetImageState = $state(false);
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	const playerCharactersIdToNamesMapState = useLocalStorage<PlayerCharactersIdToNamesMap>(
		'playerCharactersIdToNamesMapState',
		{}
	);
	let characterAgent: CharacterAgent;
	onMount(() => {
		characterAgent = new CharacterAgent(
			LLMProvider.provideLLM(
				{
					provider: llmProviderState.value,
					baseUrl: llmBaseUrlState.value,
					model: llmModelState.value || undefined,
					temperature: 2,
					apiKey: apiKeyState.value,
					language: aiLanguage.value
				},
				aiConfigState.value?.useFallbackLlmState
			)
		);
		let playerCharacterId = getCharacterTechnicalId(
			playerCharactersIdToNamesMapState.value,
			characterState.value.name
		);
		beforeNavigate(() => {
			if (playerCharacterId) {
				addCharacterToPlayerCharactersIdToNamesMap(
					playerCharactersIdToNamesMapState.value,
					playerCharacterId,
					characterState.value.name
				);
			} else {
				console.error('Player character id not found to add new name');
			}
		});
	});

	const onRandomize = async () => {
		isGeneratingState = true;
		const newState = await characterAgent.generateCharacterDescription(
			$state.snapshot(storyState.value),
			characterStateOverwrites
		);
		if (newState) {
			characterState.value = newState;
			resetImageState = true;
		}
		isGeneratingState = false;
	};
	const onRandomizeSingle = async (stateValue) => {
		isGeneratingState = true;
		const currentCharacter = { ...characterState.value };
		currentCharacter[stateValue] = undefined;
		const characterInput = { ...currentCharacter, ...characterStateOverwrites };
		const newState = await characterAgent.generateCharacterDescription(
			$state.snapshot(storyState.value),
			characterInput
		);
		if (newState) {
			characterState.value[stateValue] = newState[stateValue];
			if (stateValue === 'appearance') {
				resetImageState = true;
			}
		}
		isGeneratingState = false;
	};
</script>

{#if isGeneratingState}
	<LoadingModal />
{/if}
<ul class="steps mt-3 w-full">
	<!--TODO  -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	{#if campaignState.value?.campaign_title}
		<li class="step step-primary cursor-pointer" onclick={() => goto('campaign')}>Campaign</li>
	{:else}
		<li class="step step-primary cursor-pointer" onclick={() => goto('tale')}>Tale</li>
	{/if}
	<li class="step step-primary">Character</li>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={() => goto('characterStats')}>Stats</li>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={() => goto('characterStats')}>Start</li>
</ul>
<form class="m-6 grid items-center gap-2 text-center">
	<p>Click on Randomize All to generate a random Character based on the Tale settings</p>
	<button
		class="btn btn-accent m-auto mt-3 w-3/4 sm:w-1/2"
		disabled={isGeneratingState}
		onclick={onRandomize}
	>
		Randomize All
	</button>
	<button
		class="btn btn-neutral m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			characterState.reset();
			characterStateOverwrites = {};
			resetImageState = true;
		}}
	>
		Clear All
	</button>
	{#if campaignState.value?.campaign_title}
		<button
			class="btn btn-primary m-auto w-3/4 sm:w-1/2"
			onclick={() => {
				navigate('/new/campaign');
			}}
		>
			Previous Step:<br /> Customize Campaign
		</button>
	{:else}
		<button
			class="btn btn-primary m-auto w-3/4 sm:w-1/2"
			onclick={() => {
				navigate('/new/tale');
			}}
		>
			Previous Step:<br /> Customize Tale
		</button>
	{/if}

	<button
		class="btn btn-primary m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			navigate('/new/characterStats');
		}}
		disabled={isEqual(characterState.value, initialCharacterState)}
	>
		Next Step:<br /> Customize Stats & Abilities
	</button>

	{#each Object.keys(characterState.value) as stateValue}
		<label class="form-control mt-3 w-full">
			<div class="flex-row capitalize">
				{stateValue.replaceAll('_', ' ')}
				{#if characterStateOverwrites[stateValue]}
					<span class="badge badge-accent ml-2">overwritten</span>
				{/if}
			</div>
			<textarea
				bind:value={characterState.value[stateValue]}
				rows={textAreaRowsDerived ? textAreaRowsDerived[stateValue] : 2}
				placeholder=""
				oninput={(evt) => {
					characterStateOverwrites[stateValue] = evt.currentTarget.value;
				}}
				class="textarea textarea-bordered textarea-md mt-2 w-full"
			>
			</textarea>
		</label>
		<button
			class="btn btn-accent m-auto mt-2 w-3/4 capitalize sm:w-1/2"
			onclick={() => {
				onRandomizeSingle(stateValue);
			}}
		>
			Randomize {stateValue.replaceAll('_', ' ')}
		</button>
		<button
			class="btn btn-neutral m-auto mt-2 w-3/4 capitalize sm:w-1/2"
			onclick={() => {
				characterState.resetProperty(stateValue);
				delete characterStateOverwrites[stateValue];
				if (stateValue === 'appearance') {
					resetImageState = true;
				}
			}}
		>
			Clear {stateValue.replaceAll('_', ' ')}
		</button>
		{#if !aiConfigState.value?.disableImagesState && stateValue === 'appearance'}
			<div class="m-auto flex w-full flex-col">
				<AIGeneratedImage
					storageKey="characterImageState"
					{resetImageState}
					imagePrompt="{storyState.value.general_image_prompt} {characterState.value.appearance}"
				/>
			</div>
		{/if}
	{/each}
	<button
		class="btn btn-primary m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			navigate('/new/characterStats');
		}}
		disabled={isEqual(characterState.value, initialCharacterState)}
	>
		Next Step:<br /> Customize Stats & Abilities
	</button>
</form>
