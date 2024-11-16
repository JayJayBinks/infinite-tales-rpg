<script lang="ts">
	import { onMount } from 'svelte';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { getRowsForTextarea, navigate, stringifyPretty } from '$lib/util.svelte';
	import isEqual from 'lodash.isequal';
	import { goto } from '$app/navigation';
	import ImportExportSaveGame from '$lib/components/ImportExportSaveGame.svelte';
	import { initialCharacterState } from '$lib/ai/agents/characterAgent';
	import {
		CampaignAgent,
		type CampaignChapter,
		initialCampaignState
	} from '$lib/ai/agents/campaignAgent';
	import { initialStoryState, type Story, StoryAgent } from '$lib/ai/agents/storyAgent';

	let isGeneratingState = $state(false);
	const apiKeyState = useLocalStorage('apiKeyState');
	const aiLanguage = useLocalStorage('aiLanguage');
	let campaignAgent: CampaignAgent;
	let storyAgent: StoryAgent;

	const campaignState = useLocalStorage('campaignState', {});
	const storyState = useLocalStorage('storyState', initialStoryState);
	const currentChapterState = useLocalStorage('currentChapterState');
	const textAreaRowsDerived = $derived(getRowsForTextarea(campaignState.value));
	let campaignStateOverwrites = $state({});
	const characterState = useLocalStorage('characterState', { ...initialCharacterState });

	onMount(() => {
		campaignAgent = new CampaignAgent(
			LLMProvider.provideLLM({
				temperature: 2,
				apiKey: apiKeyState.value,
				language: aiLanguage.value
			})
		);
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
			characterDescription = undefined;
		}
		return characterDescription;
	}

	const onStory = async () => {
		isGeneratingState = true;
		const firstChapter: CampaignChapter = $state.snapshot(campaignState.value.chapters[0]);
		//chapterId is actually next chapter as it starts with 1
		firstChapter.plotPoints.push({
			...campaignState.value.chapters[firstChapter.chapterId]?.plotPoints[0],
			plotId: firstChapter.plotPoints.length + 1
		});

		const overwrites: Partial<Story> = {
			game: campaignState.value.game,
			adventure_and_main_event: stringifyPretty(firstChapter)
		};
		const newState = await storyAgent.generateRandomStorySettings(overwrites);
		if (newState) {
			console.log(stringifyPretty(newState));
			storyState.value = newState;
			currentChapterState.value = 1;
		}
		isGeneratingState = false;
	};
	const onRandomize = async () => {
		isGeneratingState = true;

		const newState = await campaignAgent.generateCampaign(
			campaignStateOverwrites,
			getCharacterDescription()
		);
		if (newState) {
			console.log(stringifyPretty(newState));
			campaignState.value = newState;
		}
		isGeneratingState = false;
	};
	const onRandomizeSingle = async (stateValue) => {
		isGeneratingState = true;
		const currentStory = { ...campaignState.value };
		currentStory[stateValue] = undefined;
		const agentInput = { ...currentStory, ...campaignStateOverwrites };
		const newState = await campaignAgent.generateCampaign(agentInput, getCharacterDescription());
		if (newState) {
			campaignState.value[stateValue] = newState[stateValue];
		}
		isGeneratingState = false;
	};

	function handleInput(evt, stateValue) {
		campaignStateOverwrites[stateValue] = evt.target.value;
	}
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
<form class="m-6 grid gap-2">
	<button
		class="btn btn-accent m-auto mt-3 w-3/4 sm:w-1/2"
		disabled={isGeneratingState}
		onclick={onRandomize}
	>
		Randomize All
	</button>
	<button
		class="btn btn-accent m-auto mt-3 w-3/4 sm:w-1/2"
		disabled={isGeneratingState}
		onclick={onStory}
	>
		Story
	</button>
	<button
		class="btn btn-neutral m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			campaignState.reset();
			campaignStateOverwrites = {};
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
	{#if campaignState.value}
		{#each Object.keys(initialCampaignState) as stateValue}
			<label class="form-control mt-3 w-full">
				<div class=" flex-row capitalize">
					{stateValue.replaceAll('_', ' ')}
					{#if campaignStateOverwrites[stateValue]}
						<span class="badge badge-accent ml-2">overwritten</span>
					{/if}
				</div>

				<textarea
					bind:value={campaignState.value[stateValue]}
					rows={textAreaRowsDerived ? textAreaRowsDerived[stateValue] : 2}
					oninput={(evt) => handleInput(evt, stateValue)}
					placeholder={initialCampaignState[stateValue]}
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
					campaignState.resetProperty(stateValue);
					delete campaignStateOverwrites[stateValue];
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
