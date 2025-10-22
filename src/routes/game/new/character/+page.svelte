<script lang="ts">
	import { onMount } from 'svelte';
	import {
		CharacterAgent,
		type CharacterDescription,
		initialCharacterState,
		type Party,
		initialPartyState
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
	import {
		createPartyFromCharacters,
		updatePlayerCharactersIdToNamesMapForParty
	} from '../../partyLogic';

	let isGeneratingState = $state(false);
	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	const storyState = useLocalStorage<Story>('storyState', initialStoryState);
	const campaignState = useLocalStorage<Campaign>('campaignState');
	const characterState = useLocalStorage<CharacterDescription>(
		'characterState',
		initialCharacterState
	);
	const partyState = useLocalStorage<Party>('partyState', initialPartyState);

	// Track which character index we're editing (0-3 for party members)
	let currentCharacterIndex = $state(0);
	const textAreaRowsDerived = $derived(getRowsForTextarea(characterState.value));

	let characterStateOverwrites: Partial<CharacterDescription> = $state({});
	let resetImageState = $state(false);
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	const playerCharactersIdToNamesMapState = useLocalStorage<PlayerCharactersIdToNamesMap>(
		'playerCharactersIdToNamesMapState',
		{}
	);
	let characterAgent: CharacterAgent;

	// Initialize party with 4 empty slots if not exists
	$effect(() => {
		if (partyState.value.members.length === 0) {
			for (let i = 0; i < 4; i++) {
				const id = `player_character_${i + 1}`;
				partyState.value.members.push({
					id,
					character: { ...initialCharacterState }
				});
			}
			partyState.value.activeCharacterId = 'player_character_1';
		}
	});

	onMount(() => {
		characterAgent = new CharacterAgent(
			LLMProvider.provideLLM(
				{
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
			// Update party state
			if (partyState.value.members.length > 0) {
				updatePlayerCharactersIdToNamesMapForParty(
					partyState.value,
					playerCharactersIdToNamesMapState.value
				);
			} else if (playerCharacterId) {
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

	const onRandomizeParty = async () => {
		isGeneratingState = true;
		const partyDescriptions = await characterAgent.generatePartyDescriptions(
			$state.snapshot(storyState.value)
		);
		if (partyDescriptions && partyDescriptions.length === 4) {
			for (let i = 0; i < 4; i++) {
				partyState.value.members[i].character = partyDescriptions[i];
			}
			// Set first character as active
			characterState.value = partyState.value.members[0].character;
			resetImageState = true;
		}
		isGeneratingState = false;
	};

	const onRandomize = async () => {
		isGeneratingState = true;
		const newState = await characterAgent.generateCharacterDescription(
			$state.snapshot(storyState.value),
			characterStateOverwrites
		);
		if (newState) {
			characterState.value = newState;
			// Update current party member
			partyState.value.members[currentCharacterIndex].character = newState;
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
			// Update current party member
			partyState.value.members[currentCharacterIndex].character = characterState.value;
			if (stateValue === 'appearance') {
				resetImageState = true;
			}
		}
		isGeneratingState = false;
	};

	const switchToCharacter = (index: number) => {
		// Save current character state to party
		partyState.value.members[currentCharacterIndex].character = characterState.value;

		// Switch to new character
		currentCharacterIndex = index;
		characterState.value = partyState.value.members[index].character;
		characterStateOverwrites = {};
		resetImageState = true;
	};

	const isPartyComplete = $derived(
		partyState.value.members.every((m) => !isEqual(m.character, initialCharacterState))
	);
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
	<li class="step step-primary">Characters</li>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={() => goto('characterStats')}>Stats</li>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={() => goto('characterStats')}>Start</li>
</ul>

<!-- Party Member Tabs -->
<div class="tabs-boxed tabs mt-4 flex justify-center">
	{#each partyState.value.members as member, index}
		<button
			class="tab"
			class:tab-active={currentCharacterIndex === index}
			onclick={() => switchToCharacter(index)}
		>
			{member.character.name || `Character ${index + 1}`}
		</button>
	{/each}
</div>

<form class="m-6 grid items-center gap-2 text-center">
	<p>Generate a party of 4 characters, or customize each character individually</p>
	<button
		class="btn btn-accent m-auto mt-3 w-3/4 sm:w-1/2"
		disabled={isGeneratingState}
		onclick={onRandomizeParty}
	>
		Randomize Entire Party
	</button>
	<div class="divider">OR</div>
	<p>
		Customize Current Character ({partyState.value.members[currentCharacterIndex]?.character.name ||
			`Character ${currentCharacterIndex + 1}`})
	</p>
	<button
		class="btn btn-accent m-auto mt-3 w-3/4 sm:w-1/2"
		disabled={isGeneratingState}
		onclick={onRandomize}
	>
		Randomize Current Character
	</button>
	<button
		class="btn btn-neutral m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			characterState.reset();
			partyState.value.members[currentCharacterIndex].character = { ...initialCharacterState };
			characterStateOverwrites = {};
			resetImageState = true;
		}}
	>
		Clear Current Character
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
		disabled={!isPartyComplete}
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
				characterState.resetProperty(stateValue as keyof CharacterDescription);
				partyState.value.members[currentCharacterIndex].character = characterState.value;
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
					storageKey="characterImageState_{currentCharacterIndex}"
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
		disabled={!isPartyComplete}
	>
		Next Step:<br /> Customize Stats & Abilities
	</button>
</form>
