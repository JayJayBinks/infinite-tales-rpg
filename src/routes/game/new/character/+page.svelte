<script lang="ts">
	import { onMount } from 'svelte';
	import {
		CharacterAgent,
		type CharacterDescription,
		initialCharacterState,
	} from '$lib/ai/agents/characterAgent';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { getFromLocalStorage, saveToLocalStorage } from '$lib/state/localStorageUtil';
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
	import { partyState } from '$lib/state/stores';

	let isGeneratingState = $state(false);
	function localState<T>(key: string, initial: T | undefined = undefined as any) {
		let _v = $state<T>(getFromLocalStorage(key, initial as T));
		return {
			get value() { return _v; },
			set value(val: T) { _v = val; saveToLocalStorage(key, val); },
			reset() { this.value = initial as T; },
			resetProperty(prop: keyof T) { if (typeof _v === 'object' && _v !== null && initial) { (_v as any)[prop] = (initial as any)[prop]; saveToLocalStorage(key, _v);} }
		};
	}
	const apiKeyState = localState<string>('apiKeyState', '');
	const aiLanguage = localState<string>('aiLanguage', 'English');
	const storyState = localState<Story>('storyState', initialStoryState);
	const campaignState = localState<Campaign>('campaignState', {} as Campaign);
	const characterState = localState<CharacterDescription>('characterState', initialCharacterState);

	// Track which character index we're editing (0-3 for party members)
	let currentCharacterIndex = $state(0);
	const textAreaRowsDerived = $derived(getRowsForTextarea(characterState.value));

	let characterStateOverwrites: Partial<CharacterDescription> = $state({});
	let resetImageState = $state(false);
    const aiConfigState = localState<AIConfig>('aiConfigState', { disableAudioState: false, disableImagesState: false } as AIConfig);
    const playerCharactersIdToNamesMapState = localState<PlayerCharactersIdToNamesMap>('playerCharactersIdToNamesMapState', {});
	let characterAgent: CharacterAgent;

	// Initialize party based on storyState.party_count (auto-create tabs 1-4)
	$effect(() => {
		// Ensure at least one member exists
		if (partyState.value.members.length === 0) {
			const id = 'player_character_1';
			partyState.value.members.push({
				id,
				character: { ...initialCharacterState }
			});
			partyState.value.activeCharacterId = id;
			currentCharacterIndex = 0;
		}
		// Derive desired party size from storyState.value.party_count (string)
		const rawCount = storyState.value.party_count;
		let desiredCount = parseInt(rawCount || '1', 10);
		if (Number.isNaN(desiredCount)) desiredCount = 1;
		// Clamp between 1 and 4
		desiredCount = Math.min(4, Math.max(1, desiredCount));
		// Add members until we reach desired count
		while (partyState.value.members.length < desiredCount) {
			const nextId = `player_character_${partyState.value.members.length + 1}`;
			partyState.value.members.push({
				id: nextId,
				character: { ...initialCharacterState }
			});
		}
		// Do NOT auto-remove if user already added more than desired; user can manually adjust.
	});

	function addPartyMember() {
		if (partyState.value.members.length >= 4) return;
		
		const nextId = `player_character_${partyState.value.members.length + 1}`;
		partyState.value.members.push({
			id: nextId,
			character: { ...initialCharacterState }
		});
	}

	function removePartyMember(index: number) {
		if (partyState.value.members.length <= 1) return;
		
		partyState.value.members.splice(index, 1);
		
		// Adjust current index if needed
		if (currentCharacterIndex >= partyState.value.members.length) {
			currentCharacterIndex = partyState.value.members.length - 1;
		}
		
		// Update active character if we removed the active one
		if (partyState.value.activeCharacterId === `player_character_${index + 1}`) {
			partyState.value.activeCharacterId = partyState.value.members[currentCharacterIndex].id;
		}
		
		// Load the current character
		characterState.value = partyState.value.members[currentCharacterIndex].character;
	}

	onMount(() => {
		characterAgent = new CharacterAgent(
			LLMProvider.provideLLM({
				temperature: 1.3,
				apiKey: apiKeyState.value,
				language: aiLanguage.value
			})
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
		const party = partyState.value.members;
		const partyDescriptions = await characterAgent.generatePartyDescriptions(
			$state.snapshot(storyState.value),
			undefined,
			party.length
		);
		if (partyDescriptions && partyDescriptions.length === party.length) {
			for (let i = 0; i < party.length; i++) {
				partyState.value.members[i].character = partyDescriptions[i];
			}
			// Trigger setter to save to localStorage
			partyState.value = { ...partyState.value };
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
			// Trigger setter to save to localStorage
			partyState.value = { ...partyState.value };
			resetImageState = true;
		}
		isGeneratingState = false;
	};
	const onRandomizeSingle = async (stateValue: string) => {
		isGeneratingState = true;
		const currentCharacter = { ...characterState.value };
		// Clear just the targeted property so model focuses on regenerating it
		currentCharacter[stateValue] = undefined as any;
		const characterInput = { ...currentCharacter, ...characterStateOverwrites };
		const newState = await characterAgent.generateCharacterDescription(
			$state.snapshot(storyState.value),
			characterInput
		);
		if (newState) {
			characterState.value[stateValue] = newState[stateValue];
			// Update current party member
			partyState.value.members[currentCharacterIndex].character = characterState.value;
			// Trigger setter to save to localStorage
			partyState.value = { ...partyState.value };
			if (stateValue === 'appearance') {
				resetImageState = true;
			}
		}
		isGeneratingState = false;
	};

	const switchToCharacter = (index: number) => {
		// Save current character state to party
			partyState.value.members[currentCharacterIndex].character = characterState.value;
			// Trigger setter to save to localStorage
			partyState.value = { ...partyState.value };

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
<div class="mt-4 flex flex-col items-center gap-2">
	<div class="tabs tabs-boxed flex justify-center flex-wrap">
		{#each partyState.value.members as member, index}
			<button
				class="tab"
				class:tab-active={currentCharacterIndex === index}
				onclick={() => switchToCharacter(index)}
			>
				{member.character.name || `Character ${index + 1}`}
				{#if partyState.value.members.length > 1}
					<span
						role="button"
						tabindex="0"
						class="btn btn-circle btn-ghost btn-xs ml-1"
						onclick={(e) => {
							e.stopPropagation();
							removePartyMember(index);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								removePartyMember(index);
							}
						}}
					>
						✕
					</span>
				{/if}
			</button>
		{/each}
	</div>
	<div class="flex gap-2 items-center">
		{#if partyState.value.members.length < 4}
			<button class="btn btn-sm btn-primary" onclick={addPartyMember}>
				+ Add Party Member
			</button>
		{/if}
		<span class="text-sm text-gray-500">
			{partyState.value.members.length}/4 party members
		</span>
	</div>
</div>

<form class="m-6 grid items-center gap-2 text-center">
	<p>Generate party of {partyState.value.members.length} character{partyState.value.members.length > 1 ? 's' : ''}, or customize each character individually</p>
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
			// Trigger setter to save to localStorage
			partyState.value = { ...partyState.value };
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
				// Trigger setter to save to localStorage
				partyState.value = { ...partyState.value };
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
