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
	import { partyState } from '$lib/state/stores';
	import type { PartyMemberProfile } from '$lib/types/party';
	import {
		addCharacterToPlayerCharactersIdToNamesMap,
		getFreeCharacterTechnicalId
	} from '../../characterLogic';
	import cloneDeep from 'lodash.clonedeep';

	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	//TODO migrate all AI settings into this object to avoid too many vars in local storage
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState', {
			disableAudioState: false,
			disableImagesState: false
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
	const partyMembersState = useLocalStorage<PartyMemberProfile[]>('partyMembersState', []);
  const activePartyMemberIdState = useLocalStorage<string | null>('activePartyMemberIdState', null);

	let isGeneratingState = $state(false);
	let quickstartModalOpen = $state(false);
	let llm: LLM;
	let storyAgent: StoryAgent | undefined = $state();
	const MIN_PARTY_SIZE = 1;
	const MAX_PARTY_SIZE = 4;
	type QuickstartSubmission = {
		story?: string | Story;
		partyDescription?: string;
		partyMemberCount?: number;
	};
	const isStoryState = (value: unknown): value is Story =>
		isPlainObject(value) && 'adventure_and_main_event' in value && 'party_count' in value;

	onMount(async () => {
		if (apiKeyState.value) {
			provideLLM();
		}
	});

	const provideLLM = () => {
		llm = LLMProvider.provideLLM({
			temperature: 2,
			apiKey: apiKeyState.value,
			language: aiLanguage.value
		});
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
		partyMembersState.reset();
		activePartyMemberIdState.reset();
		partyState.resetPartyState();
	}

	async function onQuickstartNew(
		input: string | Story | QuickstartSubmission | undefined
	) {
		clearStates();
		isGeneratingState = true;
		try {
			let requestedPartySize: number | undefined;
			let explicitPartyDescription: string | undefined;
			let storyCandidate: string | Story | undefined = input;

			if (isPlainObject(input) && !isStoryState(input)) {
				const submission = input as QuickstartSubmission;
				storyCandidate = submission.story;
				explicitPartyDescription = submission.partyDescription;
				requestedPartySize = submission.partyMemberCount ?? undefined;
				if (requestedPartySize !== undefined) {
					requestedPartySize = Math.min(
						MAX_PARTY_SIZE,
						Math.max(MIN_PARTY_SIZE, Math.round(requestedPartySize))
					);
				}
			}

			let newStoryState: Story | undefined;
			if (isStoryState(storyCandidate)) {
				newStoryState = cloneDeep(storyCandidate);
			} else {
				const overwriteStory: Partial<Story> = {};
				if (typeof storyCandidate === 'string' && storyCandidate.trim().length > 0) {
					overwriteStory.adventure_and_main_event = storyCandidate;
				}
				if (explicitPartyDescription) {
					overwriteStory.party_description = explicitPartyDescription;
				}
				if (requestedPartySize) {
					overwriteStory.party_count = requestedPartySize.toString();
				}
				newStoryState = await storyAgent!.generateRandomStorySettings(overwriteStory);
			}

			if (newStoryState) {
				if (explicitPartyDescription) {
					newStoryState.party_description = explicitPartyDescription;
				}
				if (requestedPartySize) {
					newStoryState.party_count = requestedPartySize.toString();
				}

				storyState.value = newStoryState;
				const characterAgent = new CharacterAgent(llm);
				const characterStatsAgent = new CharacterStatsAgent(llm);

				const parsedPartyCount = parseInt(newStoryState.party_count || '', 10);
				const fallbackPartySize = Number.isNaN(parsedPartyCount)
					? MAX_PARTY_SIZE
					: parsedPartyCount;
				const resolvedPartySize = Math.min(
					MAX_PARTY_SIZE,
					Math.max(MIN_PARTY_SIZE, requestedPartySize ?? fallbackPartySize)
				);

				const descriptions = await characterAgent.generatePartyCharacterDescriptions(
					$state.snapshot(storyState.value),
					resolvedPartySize
				);
				if (descriptions.length) {
					const trimmedDescriptions = descriptions.slice(0, resolvedPartySize);
					const generatedStats = await characterStatsAgent.generatePartyCharacterStats(
						storyState.value,
						trimmedDescriptions
					);
					const partyMembers: PartyMemberProfile[] = [];
					trimmedDescriptions.forEach((description, index) => {
						if (!description) return;
						const statsSource = generatedStats[index]
							? cloneDeep(generatedStats[index]!)
							: cloneDeep(initialCharacterStatsState);
						parseState(statsSource);
						const displayName = (description.name || `Hero ${index + 1}`).trim();
						const id = getFreeCharacterTechnicalId(playerCharactersIdToNamesMapState.value);
						addCharacterToPlayerCharactersIdToNamesMap(
							playerCharactersIdToNamesMapState.value,
							id,
							displayName
						);
						const knownNames = new Set<string>();
						if (displayName) knownNames.add(displayName);
						if (description.name) knownNames.add(description.name);
						partyMembers.push({
							id,
							displayName,
							knownNames: Array.from(knownNames),
							description,
							stats: statsSource
						});
					});
					if (partyMembers.length) {
						partyMembersState.value = partyMembers;
						const firstMember = partyMembers[0];
						activePartyMemberIdState.value = firstMember?.id ?? null;
						partyState.resetPartyState();
						for (const member of partyMembers) {
							const descriptionClone = cloneDeep(member.description);
							const statsClone = cloneDeep(member.stats);
							partyState.addMember({ id: member.id, character: descriptionClone });
							partyState.addMemberStats({ id: member.id, stats: statsClone });
						}
						if (firstMember) {
							partyState.setActiveCharacterId(firstMember.id);
							characterState.value = cloneDeep(firstMember.description);
							characterStatsState.value = cloneDeep(firstMember.stats);
						}
						quickstartModalOpen = false;
						await goto('/game');
					}
				}
			}
		} catch (e) {
			handleError(e);
		} finally {
			isGeneratingState = false;
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
