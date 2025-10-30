<script lang="ts">
	import { getFromLocalStorage, saveToLocalStorage } from '$lib/state/localStorageUtil';
	import { handleError, navigate, parseState, initialThoughtsState, type ThoughtsState } from '$lib/util.svelte';
	import { CharacterAgent, initialCharacterState, initialPartyState, type Party } from '$lib/ai/agents/characterAgent';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { initialStoryState, type Story, StoryAgent } from '$lib/ai/agents/storyAgent';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { goto } from '$app/navigation';
	import {
		CharacterStatsAgent,
		initialCharacterStatsState,
		type PartyStats
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
	// Import state stores
	import { aiStateStore, } from '$lib/state/stores';

	// Use AI state store instead of individual useLocalStorage calls
	// const apiKeyState = localState<string>('apiKeyState');
	// const aiLanguage = localState<string>('aiLanguage');
	//TODO migrate all AI settings into this object to avoid too many vars in local storage
	const aiConfigState = localState<AIConfig>('aiConfigState', {
		disableAudioState: false,
		disableImagesState: false
	});
	let showGenerationSettingsModal = $state<boolean>(false);
	let showOutputFeaturesModal = $state<boolean>(false);
	let showSystemPromptsModal = $state<boolean>(false);

	const gameActionsState = localState('gameActionsState', []);
	const historyMessagesState = localState('historyMessagesState', []);
	const characterState = localState('characterState', initialCharacterState);
	const inventoryState = localState('inventoryState', {});
	const characterImageState = localState('characterImageState');
	const characterStatsState = localState('characterStatsState', initialCharacterStatsState);
	const npcState = localState('npcState', []);
	const storyState = localState('storyState', initialStoryState);
	const isGameEnded = localState('isGameEnded', false);
	const rollDifferenceHistoryState = localState('rollDifferenceHistoryState', []);
	const campaignState = localState('campaignState', initialCampaignState);
	const currentChapterState = localState('currentChapterState');
	const characterActionsState = localState('characterActionsState');
	const levelUpState = localState('levelUpState');
	const customMemoriesState = localState<string>('customMemoriesState');
	const customGMNotesState = localState<string>('customGMNotesState');
	const skillsProgressionState = localState('skillsProgressionState', {});
	const characterTransformState = localState<CharacterChangedInto>(
		'characterTransformState',
		initialCharacterTransformState
	);
	const diceRollRequiredValueState = localState('diceRollRequiredValueState');

	const relatedStoryHistoryState = localState<RelatedStoryHistory>(
		'relatedStoryHistoryState',
		{ relatedDetails: [] }
	);
	const relatedActionHistoryState = localState<string[]>('relatedActionHistoryState', []);
	const eventEvaluationState = localState<EventEvaluation>(
		'eventEvaluationState',
		initialEventEvaluationState
	);
	const playerCharactersIdToNamesMapState = localState<PlayerCharactersIdToNamesMap>(
		'playerCharactersIdToNamesMapState',
		{}
	);
	const relatedActionGroundTruthState = localState('relatedActionGroundTruthState');
	const relatedNPCActionsState = localState<NPCAction[]>('relatedNPCActionsState', []);
	const partyState = localState('partyState');
	const partyStatsState = localState('partyStatsState');
	// Additional per-party / per-tale states (must be cleared on new tale)
	const characterActionsByMemberState = localState<Record<string, any>>(
		'characterActionsByMemberState',
		{}
	);
	const restrainedExplanationByMemberState = localState<Record<string, string | null>>(
		'restrainedExplanationByMemberState',
		{}
	);
	const selectedCombatActionsByMemberState = localState<Record<string, any>>(
		'selectedCombatActionsByMemberState',
		{}
	);
	const eventEvaluationByMemberState = localState<Record<string, EventEvaluation>>(
		'eventEvaluationByMemberState',
		{}
	);
	const chosenActionState = localState('chosenActionState');
	const additionalStoryInputState = localState<string>('additionalStoryInputState', '');
	const additionalActionInputState = localState<string>('additionalActionInputState', '');
	const thoughtsState = localState<ThoughtsState>('thoughtsState', initialThoughtsState);
	const didAIProcessDiceRollActionState = localState<boolean>('didAIProcessDiceRollAction', true);

	function localState<T>(key: string, initial: T | undefined = undefined as any) {
		let _v = $state<T>(getFromLocalStorage(key, initial as T));
		return {
			get value() {
				return _v;
			},
			set value(val: T) {
				_v = val;
				saveToLocalStorage(key, val);
			},
			reset() {
				this.value = initial as T;
				saveToLocalStorage(key, this.value);
			},
			resetProperty(prop: keyof T) {
				if (typeof _v === 'object' && _v !== null && initial) {
					(_v as any)[prop] = (initial as any)[prop];
					saveToLocalStorage(key, _v);
				}
			}
		};
	}

	let isGeneratingState = $state(false);
	let quickstartModalOpen = $state(false);
	let llm: LLM;
	let storyAgent: StoryAgent | undefined = $state();

	onMount(async () => {
		if (aiStateStore.apiKey) {
			provideLLM();
		}
	});

	const provideLLM = () => {
		llm = LLMProvider.provideLLM({
			temperature: 1.3,
			apiKey: aiStateStore.apiKey,
			language: aiStateStore.language
		});
		storyAgent = new StoryAgent(llm);
	};

	const onQuickstartClicked = () => {
		provideLLM();
		if (aiStateStore.apiKey) {
			quickstartModalOpen = true;
		}
	};

	function clearStates() {
		historyMessagesState.reset();
		diceRollRequiredValueState.reset();
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
		partyState.reset();
		partyStatsState.reset();
		// Newly added party / multi-member states
		characterActionsByMemberState.reset();
		restrainedExplanationByMemberState.reset();
		selectedCombatActionsByMemberState.reset();
		eventEvaluationByMemberState.reset();
		chosenActionState.reset();
		additionalStoryInputState.reset();
		additionalActionInputState.reset();
		thoughtsState.reset();
		didAIProcessDiceRollActionState.reset();
	}

	async function onQuickstartNew(data: any) {
		clearStates();
		isGeneratingState = true;
		let newStoryState;
		try {
			console.log('[Quickstart] Start quickstart flow', data);
			const story = data.story || data;
			const partyDescription = data.partyDescription || '';
			const partyMemberCount = data.partyMemberCount || 1;
			
			if (story && isPlainObject(story)) {
				newStoryState = story as Story;
			} else {
				const overwriteStory = !story
					? {}
					: {
						adventure_and_main_event: story as string,
						party_description: partyDescription || (story as string),
						party_count: (partyMemberCount || 1).toString()
					};
				newStoryState = await storyAgent!.generateRandomStorySettings(overwriteStory);
			}
			if (newStoryState) {
				console.log('[Quickstart] Generated story state');
				storyState.value = newStoryState;
				const characterAgent = new CharacterAgent(llm);
				const characterStatsAgent = new CharacterStatsAgent(llm);
				
				// Generate party
				const partyDescriptions = await characterAgent.generatePartyDescriptions(
					$state.snapshot(storyState.value),
					partyDescription
						? [{ background: partyDescription }]
						: undefined,
					partyMemberCount
				);
				console.log('[Quickstart] Party descriptions', partyDescriptions?.length);
				
				if (partyDescriptions && partyDescriptions.length > 0) {
					// Generate stats for all party members
					const partyStats = await characterStatsAgent.generatePartyStats(
						storyState.value,
						partyDescriptions,
						partyDescriptions.map(() => ({
							level: 1,
							resources: {
								HP: { max_value: 0, game_ends_when_zero: true },
								MP: { max_value: 0, game_ends_when_zero: false }
							}
						}))
					);
					console.log('[Quickstart] Party stats generated', partyStats?.length);
					
					if (partyStats && partyStats.length === partyDescriptions.length) {
						// Initialize party state with all generated members
						const party: Party = {
							members: partyDescriptions.map((desc, index) => ({
								id: `player_character_${index + 1}`,
								character: desc
							})),
							activeCharacterId: 'player_character_1'
						};
						
						const partyStatsData: PartyStats = {
							members: partyStats.map((stats, index) => ({
								id: `player_character_${index + 1}`,
								stats
							}))
						};
						
						partyState.value = party;
						partyStatsState.value = partyStatsData;
						
						// Set first character as active character
						characterState.value = partyDescriptions[0];
						characterStatsState.value = partyStats[0];
						parseState(characterStatsState.value);
						
						quickstartModalOpen = false;
						console.log('[Quickstart] Navigating to /game');
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
			bind:value={aiStateStore.apiKey}
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
		disabled={!aiStateStore.apiKey}
		onclick={onStartCustom}
	>
		New Custom Tale
	</button>
	<small class="m-auto mt-2">Customize your Tale with a brief, open-ended plot</small>
	<button
		class="btn btn-neutral m-auto mt-5 w-1/2"
		disabled={!aiStateStore.apiKey}
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
