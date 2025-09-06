<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { handleError, navigate, parseState } from '$lib/util.svelte';
	import { CharacterAgent, initialCharacterState } from '$lib/ai/agents/characterAgent';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { initialStoryState, type Story, StoryAgent } from '$lib/ai/agents/storyAgent';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { goto } from '$app/navigation';
	import {
		CharacterStatsAgent,
		initialCharacterStatsState
	} from '$lib/ai/agents/characterStatsAgent';
	import { initialCampaignState } from '$lib/ai/agents/campaignAgent';
	import { onMount } from 'svelte';
	import type { AIConfig } from '$lib';
	import type { RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
	import QuickstartStoryGenerationModal from '$lib/components/interaction_modals/QuickstartStoryGenerationModal.svelte';
	import type { LLM } from '$lib/ai/llm';
	import isPlainObject from 'lodash.isplainobject';
	import {
		initialCharacterTransformState,
		initialEventEvaluationState
	} from '$lib/ai/agents/eventAgent';
	import type { CharacterChangedInto, EventEvaluation } from '$lib/ai/agents/eventAgent';
	import type { NPCAction, PlayerCharactersIdToNamesMap } from '$lib/ai/agents/gameAgent';
	import AiGenerationSettings from '$lib/components/interaction_modals/settings/AiGenerationSettings.svelte';
	import OutputFeaturesModal from '$lib/components/interaction_modals/settings/OutputFeaturesModal.svelte';
	import SystemPromptsModal from '$lib/components/interaction_modals/settings/SystemPromptsModal.svelte';

	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	//TODO migrate all AI settings into this object to avoid too many vars in local storage
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState', {
		disableAudioState: false,
		disableImagesState: false,
		useFallbackLlmState: false
	});
	let showGenerationSettingsModal = $state<boolean>(false);
	let showOutputFeaturesModal = $state<boolean>(false);
	let showSystemPromptsModal = $state<boolean>(false);

	const gameActionsState = useLocalStorage('gameActionsState', []);
	const historyMessagesState = useLocalStorage('historyMessagesState', []);
	const characterState = useLocalStorage('characterState', initialCharacterState);
	const inventoryState = useLocalStorage('inventoryState', {});
	const characterImageState = useLocalStorage('characterImageState');
	const characterStatsState = useLocalStorage('characterStatsState', initialCharacterStatsState);
	const npcState = useLocalStorage('npcState', []);
	const storyState = useLocalStorage('storyState', initialStoryState);
	const isGameEnded = useLocalStorage('isGameEnded', false);
	const rollDifferenceHistoryState = useLocalStorage('rollDifferenceHistoryState', []);
	const campaignState = useLocalStorage('campaignState', initialCampaignState);
	const currentChapterState = useLocalStorage('currentChapterState');
	const characterActionsState = useLocalStorage('characterActionsState');
	const levelUpState = useLocalStorage('levelUpState');
	const customMemoriesState = useLocalStorage<string>('customMemoriesState');
	const customGMNotesState = useLocalStorage<string>('customGMNotesState');
	const skillsProgressionState = useLocalStorage('skillsProgressionState', {});
	const characterTransformState = useLocalStorage<CharacterChangedInto>(
		'characterTransformState',
		initialCharacterTransformState
	);

	const relatedStoryHistoryState = useLocalStorage<RelatedStoryHistory>(
		'relatedStoryHistoryState',
		{ relatedDetails: [] }
	);
	const relatedActionHistoryState = useLocalStorage<string[]>('relatedActionHistoryState', []);
	const eventEvaluationState = useLocalStorage<EventEvaluation>(
		'eventEvaluationState',
		initialEventEvaluationState
	);
	const playerCharactersIdToNamesMapState = useLocalStorage<PlayerCharactersIdToNamesMap>(
		'playerCharactersIdToNamesMapState',
		{}
	);
	const relatedActionGroundTruthState = useLocalStorage('relatedActionGroundTruthState');
	const relatedNPCActionsState = useLocalStorage<NPCAction[]>('relatedNPCActionsState', []);

	let isGeneratingState = $state(false);
	let quickstartModalOpen = $state(false);
	let llm: LLM;
	let storyAgent: StoryAgent | undefined = $state();

	onMount(async () => {
		if (apiKeyState.value) {
			provideLLM();
		}
	});

	const provideLLM = () => {
		llm = LLMProvider.provideLLM(
			{
				temperature: 2,
				apiKey: apiKeyState.value,
				language: aiLanguage.value
			},
			aiConfigState.value?.useFallbackLlmState
		);
		storyAgent = new StoryAgent(llm);
	};

	const onQuickstartClicked = () => {
		provideLLM();
		if (apiKeyState.value) {
			quickstartModalOpen = true;
		}
	};

	function clearStates() {
		historyMessagesState.reset();
		gameActionsState.reset();
		characterState.reset();
		characterImageState.reset();
		characterStatsState.reset();
		storyState.reset();
		isGameEnded.reset();
		rollDifferenceHistoryState.reset();
		npcState.reset();
		inventoryState.reset();
		campaignState.reset();
		currentChapterState.reset();
		characterActionsState.reset();
		levelUpState.reset();
		relatedStoryHistoryState.reset();
		relatedActionHistoryState.reset();
		customMemoriesState.reset();
		customGMNotesState.reset();
		characterTransformState.reset();
		skillsProgressionState.reset();
		eventEvaluationState.reset();
		playerCharactersIdToNamesMapState.reset();
		relatedActionGroundTruthState.reset();
		relatedNPCActionsState.reset();
	}

	async function onQuickstartNew(story: string | Story | undefined) {
		clearStates();
		isGeneratingState = true;
		let newStoryState;
		try {
			if (story && isPlainObject(story)) {
				newStoryState = story as Story;
			} else {
				const overwriteStory = !story ? {} : { adventure_and_main_event: story as string };
				newStoryState = await storyAgent!.generateRandomStorySettings(overwriteStory);
			}
			if (newStoryState) {
				storyState.value = newStoryState;
				const characterAgent = new CharacterAgent(llm);
				const newCharacterState = await characterAgent.generateCharacterDescription(
					$state.snapshot(storyState.value)
				);
				if (newCharacterState) {
					characterState.value = newCharacterState;
					const characterStatsAgent = new CharacterStatsAgent(llm);
					const newCharacterStatsState = await characterStatsAgent.generateCharacterStats(
						storyState.value,
						characterState.value,
						{
							level: 1,
							resources: {
								HP: { max_value: 0, game_ends_when_zero: true },
								MP: { max_value: 0, game_ends_when_zero: false }
							}
						},
						true
					);
					parseState(newCharacterStatsState);
					if (newCharacterStatsState) {
						characterStatsState.value = newCharacterStatsState;
						quickstartModalOpen = false;
						await goto('/game');
					}
				}
			}
			isGeneratingState = false;
		} catch (e) {
			isGeneratingState = false;
			handleError(e);
		}
	}

	function onStartCustom() {
		clearStates();
		navigate('/new/tale');
	}

	function onNewCampaign() {
		clearStates();
		navigate('/new/campaign');
	}
</script>

{#if quickstartModalOpen}
	<QuickstartStoryGenerationModal
		{storyAgent}
		onsubmit={onQuickstartNew}
		onclose={() => (quickstartModalOpen = false)}
	/>
{/if}
{#if isGeneratingState}
	<LoadingModal loadingText="Creating Your New Tale, this may take a minute..." />
{/if}
<form class="m-6 flex flex-col items-center text-center">
	<label class="form-control w-full sm:w-2/3">
		<p>Google Gemini API Key</p>
		<input
			type="text"
			id="apikey"
			bind:value={apiKeyState.value}
			placeholder="Copy your API Key from Google AI Studio and paste here"
			class="input input-bordered mt-2"
		/>
		<small class="m-auto mt-2"
			>View the
			<a
				target="_blank"
				href="https://github.com/JayJayBinks/infinite-tales-rpg/wiki/Create-your-free-Google-Gemini-API-Key-%F0%9F%94%91"
				class="link text-blue-400 underline"
			>
				guide to create the API Key</a
			></small
		>
	</label>
	<button class="btn btn-accent m-auto mt-5 w-1/2" onclick={onQuickstartClicked}>
		Quickstart:<br />New Tale
	</button>
	<small class="m-auto mt-2">Let the AI generate a Tale for you</small>
	<button
		class="btn btn-neutral m-auto mt-5 w-1/2"
		disabled={!apiKeyState.value}
		onclick={onStartCustom}
	>
		New Custom Tale
	</button>
	<small class="m-auto mt-2">Customize your Tale with a brief, open-ended plot</small>
	<button
		class="btn btn-neutral m-auto mt-5 w-1/2"
		disabled={!apiKeyState.value}
		onclick={onNewCampaign}
	>
		New Campaign
	</button>
	<small class="m-auto mt-2">Structured Tale with in-detail planned plot</small>
	<div class="divider mt-7">Advanced Settings</div>

	{#if showGenerationSettingsModal}
		<AiGenerationSettings onclose={() => (showGenerationSettingsModal = false)} />
	{/if}
	<button
		class="btn btn-neutral m-auto mt-5 w-1/2"
		onclick={() => (showGenerationSettingsModal = true)}
	>
		Generation Settings
	</button>
	{#if showOutputFeaturesModal}
		<OutputFeaturesModal onclose={() => (showOutputFeaturesModal = false)} />
	{/if}
	<button
		class="btn btn-neutral m-auto mt-5 w-1/2"
		onclick={() => (showOutputFeaturesModal = true)}
	>
		Output Features
	</button>
	{#if showSystemPromptsModal}
		<SystemPromptsModal onclose={() => (showSystemPromptsModal = false)} />
	{/if}
	<button class="btn btn-neutral m-auto mt-5 w-1/2" onclick={() => (showSystemPromptsModal = true)}>
		System Prompts
	</button>
</form>
