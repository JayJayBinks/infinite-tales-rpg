<script lang="ts">
	import { onMount } from 'svelte';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import { getRowsForTextarea, navigate, parseState, removeEmptyValues } from '$lib/util.svelte';
	import isEqual from 'lodash.isequal';
	import cloneDeep from 'lodash.clonedeep';
	import isPlainObject from 'lodash.isplainobject';
	import {
		CharacterStatsAgent,
		initialCharacterStatsState
	} from '$lib/ai/agents/characterStatsAgent';
	import { goto } from '$app/navigation';
	import { initialStoryState } from '$lib/ai/agents/storyAgent';
	import { initialCharacterState } from '$lib/ai/agents/characterAgent';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import type { Campaign } from '$lib/ai/agents/campaignAgent';
	import type { AIConfig } from '$lib';

	let isGeneratingState = $state(false);
	const apiKeyState = useLocalStorage('apiKeyState');
	const aiLanguage = useLocalStorage('aiLanguage');

	let characterStatsAgent: CharacterStatsAgent;
	const storyState = useLocalStorage('storyState', initialStoryState);
	const characterState = useLocalStorage('characterState', initialCharacterState);
	const characterStatsState = useLocalStorage('characterStatsState', initialCharacterStatsState);
	const campaignState = useLocalStorage<Campaign>('campaignState');
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	const textAreaRowsDerived = $derived(getRowsForTextarea(characterStatsState.value));

	onMount(() => {
		characterStatsAgent = new CharacterStatsAgent(
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

	let characterStatsStateOverwrites = $state(cloneDeep(initialCharacterStatsState));

	const mapResourceCost = (resourceCost?: any) => {
		return resourceCost ? resourceCost : { cost: 0, resource_key: undefined };
	};

	const onRandomize = async () => {
		isGeneratingState = true;
		const filteredOverwrites = removeEmptyValues(characterStatsStateOverwrites);
		const newState = await characterStatsAgent.generateCharacterStats(
			$state.snapshot(storyState.value),
			$state.snapshot(characterState.value),
			filteredOverwrites
		);
		if (newState) {
			console.log(newState);
			parseState(newState);
			newState.spells_and_abilities = newState.spells_and_abilities.map((ability) => ({
				...ability,
				resource_cost: mapResourceCost(ability.resource_cost)
			}));
			characterStatsState.value = newState;
		}
		isGeneratingState = false;
	};

	const onRandomizeSingle = async (stateValue: string, deepNested: string = '') => {
		isGeneratingState = true;
		const currentCharacterStats = $state.snapshot(characterStatsState.value);
		if (deepNested) {
			currentCharacterStats[stateValue][deepNested] = undefined;
		} else {
			currentCharacterStats[stateValue] = undefined;
		}
		const filteredOverwrites = removeEmptyValues($state.snapshot(characterStatsStateOverwrites));
		const singleAbilityOverwritten =
			filteredOverwrites.spells_and_abilities &&
			filteredOverwrites.spells_and_abilities[deepNested];
		//TODO not generic
		filteredOverwrites.spells_and_abilities =
			filteredOverwrites.spells_and_abilities &&
			Object.entries(removeEmptyValues(filteredOverwrites.spells_and_abilities)).map(
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				([_, value]) => value
			);
		const characterStatsInput = { ...currentCharacterStats, ...filteredOverwrites };

		if (deepNested) {
			// TODO only works for ability section
			let newAbility = await characterStatsAgent.generateSingleAbility(
				$state.snapshot(storyState.value),
				$state.snapshot(characterState.value),
				characterStatsInput,
				singleAbilityOverwritten
			);
			newAbility = {
				...newAbility,
				resource_cost: mapResourceCost(newAbility.resource_cost)
			};
			characterStatsState.value[stateValue][deepNested] = newAbility;
		} else {
			const newState = await characterStatsAgent.generateCharacterStats(
				$state.snapshot(storyState.value),
				$state.snapshot(characterState.value),
				characterStatsInput
			);
			if (newState) {
				parseState(newState);
				characterStatsState.value[stateValue] = newState[stateValue];
			}
		}
		isGeneratingState = false;
	};

	const nextStepClicked = async () => {
		if (isEqual(characterStatsState.value, initialCharacterStatsState)) {
			await onRandomize();
		}
		await goto('/game');
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
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step step-primary cursor-pointer" onclick={() => goto('character')}>Character</li>
	<li class="step step-primary">Stats</li>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events  -->
	<li class="step cursor-pointer" onclick={nextStepClicked}>Start</li>
</ul>
<form class="m-6 grid items-center gap-2 text-center">
	<p>Click on Randomize All to generate random Stats based on the Character settings</p>
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
			characterStatsState.reset();
			characterStatsStateOverwrites = cloneDeep(initialCharacterStatsState);
		}}
	>
		Clear All
	</button>
	<button
		class="btn btn-primary m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			navigate('/new/character');
		}}
	>
		Previous Step:<br /> Customize Character
	</button>
	<button
		class="btn btn-primary m-auto w-3/4 sm:w-1/2"
		onclick={() => {
			navigate('/');
		}}
		disabled={isEqual(characterStatsState.value, initialCharacterStatsState)}
	>
		Start Your Tale
	</button>

	{#each Object.keys(characterStatsState.value) as stateValue}
		{#if stateValue === 'level'}
			<div class="form-control mt-3 w-full">
				<div class="capitalize">
					<p>Level</p>
					{#if characterStatsStateOverwrites.level}
						<span class="badge badge-accent ml-2">overwritten</span>
					{/if}
				</div>
				<input
					type="number"
					min="1"
					bind:value={characterStatsState.value.level}
					oninput={(evt) => {
						characterStatsStateOverwrites.level = evt.target?.value;
					}}
					class="textarea textarea-bordered textarea-md m-auto mt-2 w-1/2"
				/>
			</div>
		{:else}
			<div class="form-control mt-3 w-full">
				<details class="collapse collapse-arrow border border-base-300 bg-base-200">
					<summary class="collapse-title items-center text-center capitalize"
					>{stateValue.replaceAll('_', ' ')}</summary
					>
					<div class="collapse-content">
						{#each Object.keys(characterStatsState.value[stateValue]) as statValue}
							<div class="form-control mt-3 w-full">
								{#if stateValue !== 'resources' && isPlainObject(characterStatsState.value[stateValue][statValue])}
									<!-- SpellsAndAbilities TODO refactor or leave for now?-->
									<details class="collapse collapse-arrow textarea-bordered border bg-base-200">
										{#each Object.keys(characterStatsState.value[stateValue][statValue]) as deepNestedValue, i (deepNestedValue)}
											{#if i === 0}
												<summary class="collapse-title capitalize">
													<div
														class:sm:grid-cols-6={!aiConfigState.value?.disableImagesState}
														class="grid overflow-hidden overflow-ellipsis text-center"
													>
														{#if !aiConfigState.value?.disableImagesState}
															<div class="m-auto sm:col-span-3">
																<AIGeneratedImage
																	noLogo={true}
																	enhance={false}
																	imageClassesString="w-[90px] sm:w-[100px] h-[90px] sm:h-[100px] m-auto"
																	imagePrompt={CharacterStatsAgent.getSpellImagePrompt(
																		characterStatsState.value[stateValue][statValue],
																		storyState.value.general_image_prompt
																	)}
																	buttonClassesString="btn-xs no-animation"
																></AIGeneratedImage>
															</div>
														{/if}
														<div class="m-auto w-full sm:col-span-2">
															<p class="content-center overflow-hidden overflow-ellipsis">
																{isNaN(parseInt(statValue))
																	? statValue.replaceAll('_', ' ')
																	: `${characterStatsState.value[stateValue][statValue][deepNestedValue] || 'Enter A Name'}`}
															</p>
															<button
																class="components btn btn-error no-animation btn-sm m-auto mt-2"
																onclick={(evt) => {
																	evt.preventDefault();
																	characterStatsState.value[stateValue].splice(statValue, 1);
																}}
															>
																Delete
															</button>
														</div>
													</div>
												</summary>
											{/if}
											<div class="collapse-content">
												<div class="form-control mt-3 w-full">
													<div class="capitalize">
														{deepNestedValue.replaceAll('_', ' ')}
														{#if characterStatsStateOverwrites[stateValue] && characterStatsStateOverwrites[stateValue][statValue] && characterStatsStateOverwrites[stateValue][statValue][deepNestedValue]}
															<span class="badge badge-accent ml-2">overwritten</span>
														{/if}
													</div>
													{#if deepNestedValue === 'resource_cost'}
														{#if characterStatsState.value[stateValue][statValue][deepNestedValue]?.resource_key}
															<input
																class="input input-bordered mt-2"
																type="number"
																placeholder="Cost as number"
																bind:value={characterStatsState.value[stateValue][statValue][
																	deepNestedValue
																].cost}
															/>
														{/if}
														<select
															bind:value={characterStatsState.value[stateValue][statValue][
																deepNestedValue
															].resource_key}
															class="select select-bordered mt-2 text-center"
														>
															<option class="capitalize" value={undefined}> No Cost</option>
															{#each Object.keys(characterStatsState.value.resources || {}) as resourceKey (resourceKey)}
																<option class="capitalize" value={resourceKey}>
																	{resourceKey.replaceAll('_', ' ')}
																</option>
															{/each}
														</select>
													{:else}
														<textarea
															bind:value={characterStatsState.value[stateValue][statValue][
																deepNestedValue
															]}
															rows={characterStatsState.value[stateValue][statValue][
																deepNestedValue
															]?.length > 30
																? 2
																: 1}
															oninput={(evt) => {
																if (!characterStatsStateOverwrites[stateValue]) {
																	characterStatsStateOverwrites[stateValue] = {};
																}
																if (!characterStatsStateOverwrites[stateValue][statValue]) {
																	characterStatsStateOverwrites[stateValue][statValue] = {};
																}
																characterStatsStateOverwrites[stateValue][statValue][
																	deepNestedValue
																] = evt.target?.value;
															}}
															class="textarea textarea-bordered textarea-md mt-2 w-full"
														>
														</textarea>
													{/if}
												</div>
											</div>
										{/each}
										<button
											class="btn btn-accent m-5 m-auto mb-2 mt-2 w-3/4 sm:w-1/2"
											onclick={() => {
												onRandomizeSingle(stateValue, statValue);
											}}
										>
											Randomize {isNaN(parseInt(statValue)) ? statValue.replaceAll('_', ' ') : ''}
										</button>
									</details>
									<!-- SpellsAndAbilities -->
								{:else}
									<!-- Resources Traits etc. TODO refactor or leave for now?-->
									<div class="m-auto flex-row capitalize">
										{statValue.replaceAll('_', ' ')}

										{#if characterStatsStateOverwrites[stateValue][statValue]}
											<span class="badge badge-accent ml-2">overwritten</span>
										{/if}
										<button
											class="components btn btn-error no-animation btn-xs ml-2"
											onclick={(evt) => {
												evt.preventDefault();
												delete characterStatsStateOverwrites[stateValue][statValue];
												delete characterStatsState.value[stateValue][statValue];
											}}
										>
											Delete
										</button>
									</div>
									{#if stateValue === 'resources'}
										<div class="form-control m-auto mt-2 sm:w-1/4">
											<p>Maximum Value</p>
											<input
												type="number"
												bind:value={characterStatsState.value[stateValue][statValue].max_value}
												oninput={(evt) => {
													if (!characterStatsStateOverwrites[stateValue][statValue]) {
														characterStatsStateOverwrites[stateValue][statValue] = {};
													}
													characterStatsStateOverwrites[stateValue][statValue].max_value =
														evt.currentTarget.value;
												}}
												class="input input-bordered"
											/>
										</div>
										<div class="form-control m-auto mt-2 sm:w-1/4">
											<p>Starting Value</p>
											<input
												type="number"
												bind:value={characterStatsState.value[stateValue][statValue].start_value}
												oninput={(evt) => {
													if (!characterStatsStateOverwrites[stateValue][statValue]) {
														characterStatsStateOverwrites[stateValue][statValue] = {};
													}
													characterStatsStateOverwrites[stateValue][statValue].start_value =
														evt.currentTarget.value;
												}}
												class="input input-bordered"
											/>
										</div>
										<div class="form-control m-auto mb-4 mt-2 sm:w-1/4">
											<p>Game Ends When Zero</p>
											<input
												type="checkbox"
												bind:checked={characterStatsState.value[stateValue][statValue]
													.game_ends_when_zero}
												oninput={(evt) => {
													if (!characterStatsStateOverwrites[stateValue][statValue]) {
														characterStatsStateOverwrites[stateValue][statValue] = {};
													}
													characterStatsStateOverwrites[stateValue][statValue].game_ends_when_zero =
														evt.currentTarget.checked;
												}}
												class="toggle m-auto"
											/>
										</div>
									{:else}
										<textarea
											bind:value={characterStatsState.value[stateValue][statValue]}
											rows={textAreaRowsDerived ? textAreaRowsDerived[stateValue][statValue] : 1}
											oninput={(evt) => {
												characterStatsStateOverwrites[stateValue][statValue] =
													evt.currentTarget.value;
											}}
											class="textarea textarea-bordered textarea-md m-auto mt-2 sm:w-1/4"
										>
										</textarea>
									{/if}
									<!-- Traits etc. -->
								{/if}
							</div>
						{/each}
					</div>
				</details>
			</div>
			<button
				class="btn btn-neutral m-auto mt-2 w-3/4 capitalize sm:w-1/2"
				onclick={() => {
					if (Array.isArray(characterStatsState.value[stateValue])) {
						//TODO spells_and_abilities not generic yet
						characterStatsState.value[stateValue].push({
							name: '',
							effect: '',
							resource_cost: mapResourceCost(),
							image_prompt: ''
						});
					} else {
						const name = prompt('Enter the name');
						if (!name) return;
						if (!characterStatsStateOverwrites[stateValue]) {
							characterStatsStateOverwrites[stateValue] = {};
						}
						if (stateValue === 'resources') {
							characterStatsState.value[stateValue][name] = {
								max_value: 0,
								start_value: 0,
								game_ends_when_zero: false
							};
						} else {
							characterStatsStateOverwrites[stateValue][name] = '';
							characterStatsState.value[stateValue][name] = '';
						}
					}
				}}
			>
				Add {stateValue.replaceAll('_', ' ')}
			</button>
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
					if (Array.isArray(characterStatsStateOverwrites[stateValue])) {
						//TODO not generic
						characterStatsState.value.spells_and_abilities = [];
						characterStatsStateOverwrites[stateValue] = [];
					} else {
						characterStatsState.resetProperty(stateValue);
						characterStatsStateOverwrites[stateValue] = {};
					}
				}}
			>
				Clear {stateValue.replaceAll('_', ' ')}
			</button>
		{/if}
	{/each}
	<button
		class="btn btn-primary m-auto mt-2 w-3/4 sm:w-1/2"
		onclick={() => {
			navigate('/');
		}}
		disabled={isEqual(characterStatsState.value, initialCharacterStatsState)}
	>
		Start Your Tale
	</button>
</form>
