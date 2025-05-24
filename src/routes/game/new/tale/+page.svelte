<script lang="ts">
	import { onMount } from 'svelte';
	import {
		initialStoryState,
		type Story,
		StoryAgent,
		storyStateForPrompt
	} from '$lib/ai/agents/storyAgent';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { getRowsForTextarea, navigate, loadPDF } from '$lib/util.svelte';
	import isEqual from 'lodash.isequal';
	import { goto } from '$app/navigation';
	import ImportExportSaveGame from '$lib/components/ImportExportSaveGame.svelte';
	import { type CharacterDescription, initialCharacterState } from '$lib/ai/agents/characterAgent';
	import type { AIConfig } from '$lib';
	let isGeneratingState = $state(false);
	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	let storyAgent: StoryAgent;

	const storyState = useLocalStorage<Story>('storyState', { ...initialStoryState });
	const textAreaRowsDerived = $derived(getRowsForTextarea(storyState.value));
	let storyStateOverwrites = $state({});
	const characterState = useLocalStorage<CharacterDescription>('characterState', {
		...initialCharacterState
	});
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');

	onMount(() => {
		storyAgent = new StoryAgent(
			LLMProvider.provideLLM(
				{
					temperature: 2,
					apiKey: apiKeyState.value,
					language: aiLanguage.value
				},
				aiConfigState.value?.useFallbackLlmState
			)
		);
	});

	function getCharacterDescription() {
		let characterDescription = $state.snapshot(characterState.value);
		if (isEqual(characterDescription, initialCharacterState)) {
			return undefined;
		}
		return characterDescription;
	}

	const onRandomize = async () => {
		isGeneratingState = true;

		const newState = await storyAgent.generateRandomStorySettings(
			storyStateOverwrites,
			getCharacterDescription()
		);
		if (newState) {
			storyState.value = newState;
		}
		isGeneratingState = false;
	};
	const onRandomizeSingle = async (stateValue) => {
		isGeneratingState = true;
		const currentStory = { ...storyState.value };
		currentStory[stateValue] = undefined;
		const agentInput = { ...currentStory, ...storyStateOverwrites };
		const newState = await storyAgent.generateRandomStorySettings(
			agentInput,
			getCharacterDescription()
		);
		if (newState) {
			storyState.value[stateValue] = newState[stateValue];
		}
		isGeneratingState = false;
	};

	function handleInput(evt, stateValue) {
		storyStateOverwrites[stateValue] = evt.target.value;
	}

	const onUploadClicked = async () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/pdf'; // Ensure only PDF files are accepted
		input.onchange = async (e) => {
			const target = e.target as HTMLInputElement;
			const file = target?.files?.[0];
			if (!file) {
				return;
			}
			isGeneratingState = true;
			try {
				const text = await loadPDF(file);
				const pdfOverwrites = { adventure_and_main_event: text };
				// For now, we assume the PDF primarily drives the main content.
				// Existing storyStateOverwrites could be merged if needed,
				// but for this feature, let's prioritize PDF content for adventure_and_main_event.
				// Other fields in storyStateOverwrites will still be passed if they were set by the user.
				const combinedOverwrites = { ...storyStateOverwrites, ...pdfOverwrites };

				const newState = await storyAgent.generateRandomStorySettings(
					combinedOverwrites,
					getCharacterDescription()
				);
				if (newState) {
					storyState.value = newState;
					// Clear the specific PDF overwrite after generation, so it doesn't stick if user randomizes again
					// or we can decide to keep it, for this iteration, let's clear it.
					// delete storyStateOverwrites['adventure_and_main_event'];
					// Or, if we want to clear all overwrites after PDF processing:
					// storyStateOverwrites = {}; 
				}
			} catch (error) {
				console.error('Error processing PDF or generating story:', error);
				// Optionally, show an error message to the user
			} finally {
				isGeneratingState = false;
			}
		};
		input.click();
	};
</script>

{#if isGeneratingState}
	<LoadingModal />
{/if}
<ul class="steps mt-3 w-full">
	<li class="step step-primary">Tale</li>
	<!--TODO  -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={() => goto('character')}>Character</li>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions  -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={() => goto('characterStats')}>Stats</li>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions  -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={() => goto('character')}>Start</li>
</ul>
<form class="m-6 grid items-center gap-2 text-center">
	<p>Quickstart: Click on Randomize All to generate a random Tale.</p>
	<p>You can also customize any setting and play the Tale suited to your liking.</p>
	<p>The custom settings will be considered for the Randomize feature.</p>
	<p>You can even create the Character first and the Tale after.</p>
	<p>
		Example: Enter 'Call of Cthulhu' as Game and click Randomize All. A random Cthulhu Tale will be
		generated.
	</p>
	<button
		class="btn btn-accent m-auto mt-3 w-3/4 sm:w-1/2"
		disabled={isGeneratingState}
		onclick={onRandomize}
	>
		Randomize All
	</button>
	<button
		type="button"
		class="btn btn-neutral m-auto w-3/4 sm:w-1/2"
		on:click={onUploadClicked}
		disabled={isGeneratingState}
	>
		Generate Story from PDF
	</button>
	<button
		class="btn btn-neutral m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			storyState.reset();
			storyStateOverwrites = {};
		}}
	>
		Clear All
	</button>
	<ImportExportSaveGame isSaveGame={false}>
		{#snippet exportButton(onclick)}
			<button {onclick} class="btn btn-neutral m-auto w-3/4 sm:w-1/2"> Export Settings </button>
		{/snippet}
		{#snippet importButton(onclick)}
			<button {onclick} class="btn btn-neutral m-auto w-3/4 sm:w-1/2"> Import Settings </button>
		{/snippet}
	</ImportExportSaveGame>
	<button
		class="btn btn-primary m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			navigate('/new/character');
		}}
	>
		Next Step:<br /> Customize Character
	</button>
	{#if storyState.value}
		{#each Object.keys(storyStateForPrompt) as stateValue}
			<label class="form-control mt-3 w-full">
				<div class=" flex-row capitalize">
					{stateValue.replaceAll('_', ' ')}
					{#if storyStateOverwrites[stateValue]}
						<span class="badge badge-accent ml-2">overwritten</span>
					{/if}
				</div>

				<textarea
					bind:value={storyState.value[stateValue]}
					rows={textAreaRowsDerived ? textAreaRowsDerived[stateValue] : 2}
					oninput={(evt) => handleInput(evt, stateValue)}
					placeholder={storyStateForPrompt[stateValue]}
					class="textarea textarea-bordered textarea-md mt-2 w-full"
				></textarea>
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
					storyState.resetProperty(stateValue);
					delete storyStateOverwrites[stateValue];
				}}
			>
				Clear {stateValue.replaceAll('_', ' ')}
			</button>
		{/each}
		<button
			class="btn btn-primary m-auto mt-2 w-3/4 sm:w-1/2"
			onclick={() => {
				navigate('/new/character');
			}}
		>
			Next Step:<br /> Customize Character
		</button>
	{/if}
</form>
