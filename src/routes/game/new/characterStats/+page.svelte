<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Campaign } from '$lib/ai/agents/campaignAgent';
	import { initialCharacterState, type CharacterDescription } from '$lib/ai/agents/characterAgent';
	import {
		CharacterStatsAgent,
		initialCharacterStatsState,
		type CharacterStats,
		type Ability,
		type Resource
	} from '$lib/ai/agents/characterStatsAgent';
	import { type Story, initialStoryState } from '$lib/ai/agents/storyAgent';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { navigate, parseState, removeEmptyValues } from '$lib/util.svelte';
	import { onMount } from 'svelte';
	import cloneDeep from 'lodash/cloneDeep';
	import isEqual from 'lodash/isEqual';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { defaultGameSettings, type GameSettings } from '$lib/ai/agents/gameAgent';
	import type { AIConfig } from '$lib';
	import AbilityEditor from '$lib/components/interaction_modals/character/AbilityEditor.svelte';

	let isGeneratingState = $state(false);
	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	type LlmProviderState = 'gemini' | 'openai-compatible' | 'pollinations';
	const llmProviderState = useLocalStorage<LlmProviderState>('llmProviderState', 'gemini');
	const llmBaseUrlState = useLocalStorage<string>('llmBaseUrlState', 'http://localhost:1234');
	const llmModelState = useLocalStorage<string>('llmModelState', '');

	let characterStatsAgent: CharacterStatsAgent;
	const storyState = useLocalStorage<Story>('storyState', initialStoryState);
	const characterState = useLocalStorage<CharacterDescription>(
		'characterState',
		initialCharacterState
	);
	const characterStatsState = useLocalStorage<CharacterStats>(
		'characterStatsState',
		initialCharacterStatsState
	);
	const campaignState = useLocalStorage<Campaign>('campaignState');
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	const gameSettingsState = useLocalStorage<GameSettings>(
		'gameSettingsState',
		defaultGameSettings()
	);

	let characterStatsStateOverwrites = $state(cloneDeep(initialCharacterStatsState));

	onMount(() => {
		characterStatsAgent = new CharacterStatsAgent(
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
	});

	const onRandomize = async () => {
		isGeneratingState = true;
		const filteredOverwrites = removeEmptyValues($state.snapshot(characterStatsStateOverwrites));
		const newState = await characterStatsAgent.generateCharacterStats(
			$state.snapshot(storyState.value),
			$state.snapshot(characterState.value),
			filteredOverwrites
		);
		if (newState) {
			console.log(newState);
			parseState(newState);
			characterStatsState.value = newState;
		}
		isGeneratingState = false;
	};

	const onRandomizeAttributes = async () => {
		isGeneratingState = true;
		const currentCharacterStats = $state.snapshot(characterStatsState.value);

		// Clear all Attributes to regenerate them
		currentCharacterStats.attributes = {};

		// Prepare input with current state and overwrites
		const filteredOverwrites = removeEmptyValues($state.snapshot(characterStatsStateOverwrites));
		const characterStatsInput = { ...currentCharacterStats, ...filteredOverwrites };

		// Generate new stats
		const newState = await characterStatsAgent.generateCharacterStats(
			$state.snapshot(storyState.value),
			$state.snapshot(characterState.value),
			characterStatsInput
		);

		if (newState && newState.attributes) {
			parseState(newState);
			// Update all Attributes
			characterStatsState.value.attributes = newState.attributes;
		}

		isGeneratingState = false;
	};

	const onRandomizeSkills = async () => {
		isGeneratingState = true;
		const currentCharacterStats = $state.snapshot(characterStatsState.value);

		// Clear all skills to regenerate them
		currentCharacterStats.skills = {};

		// Prepare input with current state and overwrites
		const filteredOverwrites = removeEmptyValues($state.snapshot(characterStatsStateOverwrites));
		const characterStatsInput = { ...currentCharacterStats, ...filteredOverwrites };

		// Generate new stats
		const newState = await characterStatsAgent.generateCharacterStats(
			$state.snapshot(storyState.value),
			$state.snapshot(characterState.value),
			characterStatsInput
		);

		if (newState && newState.skills) {
			parseState(newState);
			// Update all skills
			characterStatsState.value.skills = newState.skills;
		}

		isGeneratingState = false;
	};

	const onRandomizeResources = async () => {
		isGeneratingState = true;
		const currentCharacterStats = $state.snapshot(characterStatsState.value);

		// Clear all resources to regenerate them
		currentCharacterStats.resources = {};

		// Prepare input with current state and overwrites
		const filteredOverwrites = removeEmptyValues($state.snapshot(characterStatsStateOverwrites));
		const characterStatsInput = { ...currentCharacterStats, ...filteredOverwrites };

		// Generate new stats
		const newState = await characterStatsAgent.generateCharacterStats(
			$state.snapshot(storyState.value),
			$state.snapshot(characterState.value),
			characterStatsInput
		);

		if (newState && newState.resources) {
			parseState(newState);
			// Update all resources
			characterStatsState.value.resources = newState.resources;
		}

		isGeneratingState = false;
	};

	const onRandomizeAbility = async (abilityIndex: number) => {
		isGeneratingState = true;
		// Prepare input with current state
		const currentCharacterStats = $state.snapshot(characterStatsState.value);
		let overwrittenAbility = removeEmptyValues(
			$state.snapshot(characterStatsStateOverwrites.spells_and_abilities[abilityIndex])
		);
		if (!overwrittenAbility) {
			overwrittenAbility = characterStatsState.value.spells_and_abilities[abilityIndex];
		}
		// Generate new ability
		const newAbility = await characterStatsAgent.generateAbilitiesFromPartial(
			$state.snapshot(storyState.value),
			$state.snapshot(characterState.value),
			currentCharacterStats,
			[overwrittenAbility]
		);

		// Update the state with new ability
		characterStatsState.value.spells_and_abilities[abilityIndex] = newAbility[0];

		isGeneratingState = false;
	};

	const onRandomizeAllAbilities = async () => {
		isGeneratingState = true;
		const currentCharacterStats = $state.snapshot(characterStatsState.value);

		// Clear all abilities to regenerate them
		currentCharacterStats.spells_and_abilities = [];

		// Prepare input with current state and overwrites
		const filteredOverwrites = removeEmptyValues($state.snapshot(characterStatsStateOverwrites));
		const characterStatsInput = { ...currentCharacterStats, ...filteredOverwrites };

		// Generate new stats
		const newState = await characterStatsAgent.generateCharacterStats(
			$state.snapshot(storyState.value),
			$state.snapshot(characterState.value),
			characterStatsInput
		);

		if (newState && newState.spells_and_abilities) {
			parseState(newState);
			// Update all abilities
			characterStatsState.value.spells_and_abilities = newState.spells_and_abilities;
		}

		isGeneratingState = false;
	};

	const onContinue = () => {
		nextStepClicked();
	};

	const nextStepClicked = async () => {
		if (isEqual(characterStatsState.value, initialCharacterStatsState)) {
			await onRandomize();
		}
		navigate('/');
	};

	function addLevelOverwrite(value: number): void {
		if (!value) {
			delete characterStatsStateOverwrites.level;
		} else {
			characterStatsStateOverwrites.level = value;
		}
	}

	function addAttributeOverwrite(key: string, value: number): void {
		if (value === undefined || isNaN(value)) {
			delete characterStatsStateOverwrites.attributes[key];
		} else {
			if (!characterStatsStateOverwrites.attributes) {
				characterStatsStateOverwrites.attributes = {};
			}
			characterStatsStateOverwrites.attributes[key] = value;
		}
	}

	function addSkillOverwrite(key: string, value: number): void {
		if (value === undefined || isNaN(value)) {
			delete characterStatsStateOverwrites.skills[key];
		} else {
			if (!characterStatsStateOverwrites.skills) {
				characterStatsStateOverwrites.skills = {};
			}
			characterStatsStateOverwrites.skills[key] = value;
		}
	}

	function addResourceOverwrite(resourceName: string, resourceData: Partial<Resource>): void {
		characterStatsStateOverwrites.resources[resourceName] = {
			...characterStatsStateOverwrites.resources[resourceName],
			...resourceData
		};
	}

	function addSpellOverwrite(index: number, spellData: Partial<Ability>): void {
		if (!characterStatsStateOverwrites.spells_and_abilities[index]) {
			characterStatsStateOverwrites.spells_and_abilities[index] = {};
		}
		characterStatsStateOverwrites.spells_and_abilities[index] = {
			...characterStatsStateOverwrites.spells_and_abilities[index],
			...spellData
		};
		characterStatsState.value.spells_and_abilities[index] = {
			...characterStatsState.value.spells_and_abilities[index],
			...spellData
		};
	}
</script>

<ul class="steps mt-3 w-full">
	<!--TODO  -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	{#if campaignState.value?.campaign_title}
		<li class="step step-primary cursor-pointer" onclick={() => goto('campaign')}>Campaign</li>
	{:else}
		<li class="step step-primary cursor-pointer" onclick={() => goto('tale')}>Tale</li>
	{/if}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step step-primary cursor-pointer" onclick={() => goto('character')}>Character</li>
	<li class="step step-primary cursor-pointer">Stats</li>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={nextStepClicked}>Start</li>
</ul>
{#if isGeneratingState}
	<LoadingModal />
{/if}
<form class="m-6 grid items-center gap-2 text-center">
	{@render navigation()}
	<div class="form-control m-auto w-full">
		<div class="flex items-center justify-center">
			<label for="level" class="label">
				<span class="m-auto">Level</span>
				{#if characterStatsStateOverwrites.level}
					<span class="badge badge-accent ml-2">overwritten</span>
				{/if}
			</label>
		</div>
		<input
			type="number"
			id="level"
			class="input input-bordered m-auto w-full max-w-md"
			bind:value={characterStatsState.value.level}
			oninput={(e) => addLevelOverwrite(parseInt(e.target.value))}
		/>
	</div>

	<!-- Dynamically render resources -->
	<details class="collapse collapse-arrow border border-base-300 bg-base-200">
		<summary class="collapse-title items-center text-center">Resources</summary>
		<div class="collapse-content">
			{#if characterStatsState.value.resources}
				{#each Object.entries(characterStatsState.value.resources) as [resourceName]}
					<div class="form-control m-auto w-full max-w-md rounded-lg border border-base-300 p-3">
						<div class="flex flex-col items-center justify-center sm:flex-row">
							{#if characterStatsStateOverwrites.resources[resourceName]}
								<span class="badge badge-accent ml-2">overwritten</span>
							{/if}
							<label for={`resource-${resourceName}`} class="label flex-1 text-center">
								<span class="m-auto max-w-48 overflow-clip overflow-ellipsis capitalize sm:max-w-96"
									>{resourceName.replace(/_/g, ' ')}</span
								>
							</label>
							<button
								class="btn btn-error no-animation btn-xs m-auto"
								onclick={(e) => {
									e.preventDefault();
									delete characterStatsStateOverwrites.resources[resourceName];
									delete characterStatsState.value.resources[resourceName];
								}}
							>
								Delete
							</button>
						</div>

						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<div>
								<label for={`${resourceName}-max`} class="label">
									<span class="m-auto">Max Value</span>
								</label>
								<input
									type="number"
									id={`${resourceName}-max`}
									class="input input-bordered w-full"
									oninput={(e) =>
										addResourceOverwrite(resourceName, { max_value: parseInt(e.target.value) })}
									bind:value={characterStatsState.value.resources[resourceName].max_value}
								/>
							</div>

							<div>
								<label for={`${resourceName}-start`} class="label">
									<span class="m-auto">Start Value</span>
								</label>
								<input
									type="number"
									id={`${resourceName}-start`}
									class="input input-bordered w-full"
									oninput={(e) =>
										addResourceOverwrite(resourceName, { start_value: parseInt(e.target.value) })}
									bind:value={characterStatsState.value.resources[resourceName].start_value}
								/>
							</div>
						</div>

						<label class="label mt-2 cursor-pointer">
							<span class="m-auto">Game Ends When Zero</span>
							<input
								type="checkbox"
								class="toggle"
								oninput={(e) =>
									addResourceOverwrite(resourceName, { game_ends_when_zero: e.target.checked })}
								bind:checked={characterStatsState.value.resources[resourceName].game_ends_when_zero}
							/>
						</label>
					</div>
				{/each}
			{/if}

			<!-- Button to add new resource -->
			<div class="m-auto mt-4 flex w-full max-w-md flex-col justify-center gap-2 sm:flex-row">
				<button
					class="btn btn-neutral flex-1"
					onclick={(e) => {
						e.preventDefault();
						const newResourceName = window.prompt('Enter new resource name:');
						if (newResourceName && !characterStatsState.value.resources[newResourceName]) {
							addResourceOverwrite(newResourceName, {
								max_value: 0,
								start_value: 0,
								game_ends_when_zero: false
							});
							characterStatsState.value.resources[newResourceName] = {
								max_value: 0,
								start_value: 0,
								game_ends_when_zero: false
							};
						}
					}}
				>
					Add Resource
				</button>
				<button
					class="btn btn-accent flex-1"
					onclick={(e) => {
						e.preventDefault();
						onRandomizeResources();
					}}
					disabled={isGeneratingState}
				>
					Randomize Resources
				</button>
			</div>
		</div>
	</details>

	<!-- Dynamically render attributes -->
	<details class="collapse collapse-arrow border border-base-300 bg-base-200">
		<summary class="collapse-title items-center text-center">Attributes</summary>
		<div class="collapse-content">
			<p class="m-auto mt-4">Attributes increase on level up.</p>
			{#if characterStatsState.value.attributes}
				{#each Object.entries(characterStatsState.value.attributes) as [statName]}
					<div class="form-control m-auto flex w-full max-w-md">
						<div class="m-3 flex flex-col items-center justify-center sm:flex-row">
							{#if characterStatsStateOverwrites.attributes[statName]}
								<span class="badge badge-accent">overwritten</span>
							{/if}
							<label for={`attributes-${statName}`} class="label flex-1 text-center">
								<span class="sm:max-w-90 m-auto max-w-48 overflow-clip overflow-ellipsis capitalize"
									>{statName.replace(/_/g, ' ')}</span
								>
							</label>
							<button
								class="btn btn-error no-animation btn-xs ml-2"
								onclick={(e) => {
									e.preventDefault();
									delete characterStatsStateOverwrites.attributes[statName];
									delete characterStatsState.value.attributes[statName];
								}}
							>
								Delete
							</button>
						</div>
						<input
							type="number"
							min={-10}
							max={10}
							id={`attributes-${statName}`}
							class="input input-bordered w-full"
							bind:value={characterStatsState.value.attributes[statName]}
							oninput={(e) => addAttributeOverwrite(statName, parseInt(e.target.value))}
						/>
					</div>
				{/each}
			{/if}

			<!-- Button to add new attribute -->
			<div class="m-auto mt-4 flex w-full max-w-md flex-col justify-center gap-2 sm:flex-row">
				<button
					class="btn btn-neutral flex-1"
					onclick={(e) => {
						e.preventDefault();
						const newStatName = window.prompt('Enter new attribute name:');
						if (newStatName && !characterStatsState.value.attributes[newStatName]) {
							characterStatsState.value.attributes[newStatName] = 0;
							addAttributeOverwrite(newStatName, 0);
						}
					}}
				>
					Add attribute
				</button>
				<button
					class="btn btn-accent flex-1"
					onclick={(e) => {
						e.preventDefault();
						onRandomizeAttributes();
					}}
					disabled={isGeneratingState}
				>
					Randomize Attributes
				</button>
			</div>
		</div>
	</details>

	<!-- Dynamically render skills -->
	<details class="collapse collapse-arrow border border-base-300 bg-base-200">
		<summary class="collapse-title items-center text-center">Skills</summary>
		<div class="collapse-content">
			<label class="form-control mt-2 w-full">
				<p>AI creates new skills</p>
				<input
					type="checkbox"
					bind:checked={gameSettingsState.value.aiIntroducesSkills}
					class="toggle m-auto mt-2 text-center"
				/>
				<small class="m-auto mb-1 mt-2"
					>When no existing skill fits the action, the AI will create a new one.</small
				>
			</label>
			<p class="m-auto mt-4">Skills increase the more you use them.</p>
			{#if characterStatsState.value.skills}
				{#each Object.entries(characterStatsState.value.skills) as [statName]}
					<div class="form-control m-auto flex w-full max-w-md">
						<div class="m-3 flex flex-col items-center justify-center sm:flex-row">
							{#if characterStatsStateOverwrites.skills[statName]}
								<span class="badge badge-accent ml-2">overwritten</span>
							{/if}
							<label for={`skills-${statName}`} class="label flex-1 text-center">
								<span class="m-auto max-w-48 overflow-clip overflow-ellipsis capitalize sm:max-w-96"
									>{statName.replace(/_/g, ' ')}</span
								>
							</label>
							<button
								class="btn btn-error no-animation btn-xs ml-2"
								onclick={(e) => {
									e.preventDefault();
									delete characterStatsStateOverwrites.skills[statName];
									delete characterStatsState.value.skills[statName];
								}}
							>
								Delete
							</button>
						</div>
						<input
							type="number"
							min={-10}
							max={10}
							id={`skills-${statName}`}
							class="input input-bordered w-full"
							bind:value={characterStatsState.value.skills[statName]}
							oninput={(e) => addSkillOverwrite(statName, parseInt(e.target.value))}
						/>
					</div>
				{/each}
			{/if}

			<!-- Button to add new skill -->
			<div class="m-auto mt-4 flex w-full max-w-md flex-col justify-center gap-2 sm:flex-row">
				<button
					class="btn btn-neutral flex-1"
					onclick={(e) => {
						e.preventDefault();
						const newStatName = window.prompt('Enter new skill name:');
						if (newStatName && !characterStatsState.value.skills[newStatName]) {
							characterStatsState.value.skills[newStatName] = 0;
							addSkillOverwrite(newStatName, 0);
						}
					}}
				>
					Add Skill
				</button>
				<button
					class="btn btn-accent flex-1"
					onclick={(e) => {
						e.preventDefault();
						onRandomizeSkills();
					}}
					disabled={isGeneratingState}
				>
					Randomize Skills
				</button>
			</div>
		</div>
	</details>

	<details class="collapse collapse-arrow border border-base-300 bg-base-200">
		<summary class="collapse-title items-center text-center">Spells & Abilities</summary>
		<div class="collapse-content">
			<!-- Basic editor for spells and abilities -->
			{#if characterStatsState.value.spells_and_abilities}
				{#each characterStatsState.value.spells_and_abilities as ability, index}
					<AbilityEditor
						{ability}
						{index}
						availableResources={characterStatsState.value.resources}
						isGenerating={isGeneratingState}
						onRandomize={onRandomizeAbility}
						onDelete={() => {
							characterStatsStateOverwrites.spells_and_abilities.splice(index, 1);
							characterStatsState.value.spells_and_abilities.splice(index, 1);
						}}
						onUpdate={addSpellOverwrite}
					></AbilityEditor>
				{/each}
			{/if}

			<div class="m-auto flex w-full max-w-md flex-col justify-center gap-2 sm:flex-row">
				<button
					class="btn btn-neutral flex-1"
					onclick={() => {
						characterStatsState.value.spells_and_abilities.push({
							name: '',
							effect: '',
							resource_cost: { cost: 0, resource_key: undefined },
							image_prompt: ''
						});
						addSpellOverwrite(characterStatsState.value.spells_and_abilities.length - 1, {
							name: '',
							effect: '',
							resource_cost: { cost: 0, resource_key: undefined },
							image_prompt: ''
						});
					}}
				>
					Add Spell/Ability
				</button>
				<button
					class="btn btn-accent flex-1"
					onclick={(e) => {
						e.preventDefault();
						onRandomizeAllAbilities();
					}}
					disabled={isGeneratingState}
				>
					Randomize Abilities
				</button>
			</div>
		</div>
	</details>

	{@render navigation(true)}
</form>
{#snippet navigation(isLast?: boolean)}
	<div class="card-actions m-auto mt-4 flex w-full flex-col sm:flex-row">
		{#if !isLast}
			<button
				class="btn btn-accent m-auto w-3/4 sm:w-1/2"
				onclick={onRandomize}
				disabled={isGeneratingState}
			>
				Randomize All
			</button>
			<button
				class="btn btn-neutral m-auto w-3/4 sm:w-1/2"
				onclick={() => {
					characterStatsState.value = cloneDeep(initialCharacterStatsState);
				}}
			>
				Clear All
			</button>
		{/if}
		<button class="btn btn-primary m-auto w-3/4 sm:w-1/2" onclick={onContinue}>
			Start Your Tale
		</button>
	</div>
{/snippet}
