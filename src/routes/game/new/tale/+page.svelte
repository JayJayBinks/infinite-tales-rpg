<script lang="ts">
	import { onMount } from 'svelte';
	import { initialStoryState, type Story, StoryAgent, storyStateForPrompt } from '$lib/ai/agents/storyAgent';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { getRowsForTextarea, navigate } from '$lib/util.svelte';
	import isEqual from 'lodash.isequal';
	import { goto } from '$app/navigation';
	import ImportExportSaveGame from '$lib/components/ImportExportSaveGame.svelte';
	import { type CharacterDescription, initialCharacterState } from '$lib/ai/agents/characterAgent';
	import { gameStateRules, systemBehaviour } from '$lib/ai/agents/dynamicGameAgent';
	import { uiFeatureInstructions, uiTechnicalInstructions } from '$lib/ai/agents/uiAgent';

	let isGeneratingState = $state(false);
	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	let storyAgent: StoryAgent;

	const storyState = useLocalStorage<Story>('storyState', { ...initialStoryState });

	const dynamicStoryState = useLocalStorage<string>('dynamicStoryState');
	const gameMasterInstructionsState = useLocalStorage<{
		systemBehaviour,
		gameStateRules
	}>('gameMasterInstructionsState', { systemBehaviour, gameStateRules });

	const uiInstructionsState = useLocalStorage<{
		uiFeatureInstructions,
		uiTechnicalInstructions
	}>('uiInstructionsState', { uiFeatureInstructions, uiTechnicalInstructions });

	const textAreaRowsDerived = $derived(getRowsForTextarea(storyState.value));
	let storyStateOverwrites = $state({});
	const characterState = useLocalStorage<CharacterDescription>('characterState', {
		...initialCharacterState
	});

	onMount(() => {
		storyAgent = new StoryAgent(
			LLMProvider.provideLLM({
				temperature: 2,
				apiKey: apiKeyState.value,
				language: aiLanguage.value
			})
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
			dynamicStoryState.value = Object.entries(newState).map(entr => entr[0].replaceAll('_', ' ') + ': ' + entr[1]).join('\n\n');
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
</script>

{#if isGeneratingState}
	<LoadingModal />
{/if}
<ul class="steps mt-5 w-full">
	<li class="step step-primary">Tale</li>
	<!--TODO  -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={() => goto('')}>Start</li>
</ul>
<form class="m-6 grid items-center gap-2 text-center">
	<p>These are the settings for the very experimental dynamic game generation</p>
	<button
		class="btn btn-neutral m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			dynamicStoryState.reset();
			gameMasterInstructionsState.reset();
			uiInstructionsState.reset();
			storyStateOverwrites = {};
		}}
	>
		Reset All
	</button>
	<ImportExportSaveGame isSaveGame={false}>
		{#snippet exportButton(onclick)}
			<button {onclick} class="btn btn-neutral m-auto w-3/4 sm:w-1/2"> Export Settings</button>
		{/snippet}
		{#snippet importButton(onclick)}
			<button {onclick} class="btn btn-neutral m-auto w-3/4 sm:w-1/2"> Import Settings</button>
		{/snippet}
	</ImportExportSaveGame>
	<button
		class="btn btn-primary m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			navigate('');
		}}
	>
		Start Game
	</button>
	<label class="form-control w-full mt-5">
		<p>Story</p>
		<p>Describe the story, RPG system and characters</p>
		<textarea
			bind:value={dynamicStoryState.value}
			oninput={(evt) => handleInput(evt, 'story')}
			rows=10
			class="textarea textarea-bordered textarea-md mt-2 w-full"
		></textarea>
	</label>
	<button
		class="btn btn-accent m-auto mt-5 w-3/4 sm:w-1/2"
		disabled={isGeneratingState}
		onclick={onRandomize}
	>
		Randomize Story
	</button>


	<label class="form-control w-full mt-5">
		<p>Game Master Instructions</p>
		<p>You can put any rules here that the Game Master should consider</p>
		<textarea
			bind:value={gameMasterInstructionsState.value.systemBehaviour}
			rows=10
			class="textarea textarea-bordered textarea-md mt-2 w-full"
		></textarea>
	</label>


	<label class="form-control mt-5 w-full">
		<p>Game State Instructions (only change if you know what you are doing)</p>
		<p>You can instruct the AI to create the game state, track custom variables etc. </p>
		<textarea
			bind:value={gameMasterInstructionsState.value.gameStateRules}
			rows=10
			class="textarea textarea-bordered textarea-md mt-2 w-full"
		></textarea>
	</label>

	<label class="form-control mt-5 w-full">
		<p>UI Feature Instruction</p>
		<p>Include the description of the features you want in the UI, like special buttons or menus</p>
		<textarea
			bind:value={uiInstructionsState.value.uiFeatureInstructions}
			rows=10
			class="textarea textarea-bordered textarea-md mt-2 w-full"
		></textarea>
	</label>


	<label class="form-control mt-5 w-full">
		<p>UI Technical Instructions (only change if you know what you are doing)</p>
		<p>These are technical instructions for rendering the UI, change at your own risk as it easily breaks!</p>
		<textarea
			bind:value={uiInstructionsState.value.uiTechnicalInstructions}
			rows=10
			class="textarea textarea-bordered textarea-md mt-2 w-full"
		></textarea>
	</label>
	<button
		class="btn btn-primary m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			navigate('');
		}}
	>
		Start Game
	</button>

</form>
