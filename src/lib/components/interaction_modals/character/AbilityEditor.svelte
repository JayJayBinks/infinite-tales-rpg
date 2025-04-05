<script lang="ts">
	import type { AIConfig } from '$lib';
	import {
		CharacterStatsAgent,
		type Ability,
		type Resources
	} from '$lib/ai/agents/characterStatsAgent';
	import { initialStoryState, type Story } from '$lib/ai/agents/storyAgent';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	type Props = {
		ability: Ability;
		index: number;
		availableResources: Resources;
		isGenerating: boolean;
		onDelete: (index: number) => void;
		onUpdate: (index: number, updatedFields: Partial<Ability>) => void;
		onRandomize: (index: number) => void;
	};

	const {
		ability,
		index,
		availableResources,
		isGenerating,
		onDelete,
		onUpdate,
		onRandomize
	}: Props = $props();

	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	const storyState = useLocalStorage<Story>('storyState', initialStoryState);

	let isOverwritten = $state(false);

	const handleDelete = (event: Event) => {
		event.preventDefault();
		onDelete(index);
	};

	const handleRandomize = (event: Event) => {
		event.preventDefault();
		onRandomize(index);
	};

	const _onUpdate = (index: number, updatedFields: Partial<Ability>) => {
		onUpdate(index, updatedFields);
		isOverwritten = true;
	};

	const handleNameInput = (event: Event & { currentTarget: HTMLInputElement }) => {
		_onUpdate(index, { name: event.currentTarget.value });
	};

	const handleEffectInput = (event: Event & { currentTarget: HTMLTextAreaElement }) => {
		_onUpdate(index, { effect: event.currentTarget.value });
	};

	const handleCostInput = (event: Event & { currentTarget: HTMLInputElement }) => {
		const cost = parseInt(event.currentTarget.value) || 0; // Ensure it's a number
		_onUpdate(index, { resource_cost: { ...ability.resource_cost, cost } });
	};

	const handleResourceKeyChange = (event: Event & { currentTarget: HTMLSelectElement }) => {
		const resource_key = event.currentTarget.value || undefined; // Handle empty string as undefined
		_onUpdate(index, { resource_cost: { ...ability.resource_cost, resource_key } });
	};

	const handleImagePromptInput = (event: Event & { currentTarget: HTMLInputElement }) => {
		_onUpdate(index, { image_prompt: event.currentTarget.value });
	};
</script>

<details class="collapse collapse-arrow textarea-bordered mb-4 border bg-base-200">
	<summary class="collapse-title capitalize" tabindex="0">
		<div class="grid overflow-hidden overflow-ellipsis text-center">
			{#if !aiConfigState.value?.disableImagesState}
				<div class="m-auto mb-3">
					<AIGeneratedImage
						noLogo={true}
						enhance={false}
						imageClassesString="w-[90px] sm:w-[100px] h-[90px] sm:h-[100px] m-auto"
						imagePrompt={CharacterStatsAgent.getSpellImagePrompt(
							ability,
							storyState.value?.general_image_prompt || ''
						)}
						buttonClassesString="btn-xs no-animation"
					/>
				</div>
			{/if}
			<div class="m-auto w-full">
				<p
					class="content-center overflow-hidden overflow-ellipsis"
					title={ability.name || 'Unnamed Ability'}
				>
					{ability.name || 'Unnamed Ability'}
				</p>
				<button
					class="components btn btn-error no-animation btn-sm m-auto mt-2"
					aria-label={`Delete ability: ${ability.name || 'Unnamed Ability'}`}
					onclick={handleDelete}
					tabindex="0"
				>
					Delete
				</button>
			</div>
		</div>
	</summary>
	<div class="collapse-content">
		<div class="form-control m-auto w-full max-w-md rounded-lg">
			<div class="grid grid-cols-1 gap-2">
				{#if isOverwritten}
					<span class="badge badge-accent m-auto">overwritten</span>
				{/if}
				<div>
					<label for={`ability-${index}-name`} class="label">
						<span class="m-auto">Name</span>
					</label>
					<input
						type="text"
						id={`ability-${index}-name`}
						class="input input-bordered w-full"
						value={ability.name}
						oninput={handleNameInput}
						aria-label="Ability Name"
					/>
				</div>

				<div>
					<label for={`ability-${index}-effect`} class="label">
						<span class="m-auto">Effect</span>
					</label>
					<textarea
						id={`ability-${index}-effect`}
						class="textarea textarea-bordered w-full"
						value={ability.effect}
						rows={4}
						oninput={handleEffectInput}
						aria-label="Ability Effect"
					></textarea>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<div>
					<label for={`ability-${index}-resource-cost`} class="label">
						<span class="m-auto">Cost</span>
					</label>
					<input
						type="number"
						id={`ability-${index}-resource-cost`}
						class="input input-bordered w-full"
						value={ability.resource_cost.cost}
						oninput={handleCostInput}
						aria-label="Resource Cost"
					/>
				</div>

				<div>
					<label for={`ability-${index}-resource-key`} class="label">
						<span class="m-auto">Resource</span>
					</label>
					<select
						id={`ability-${index}-resource-key`}
						class="select select-bordered w-full"
						value={ability.resource_cost.resource_key ?? undefined}
						onchange={handleResourceKeyChange}
						aria-label="Resource Type"
					>
						<option value={undefined}>No Cost</option>
						{#each Object.keys(availableResources) as resourceName}
							<option value={resourceName}>{resourceName.replace(/_/g, ' ')}</option>
						{/each}
					</select>
				</div>
			</div>
			<label class="label mt-2 cursor-pointer" for={`ability-${index}-image-prompt`}
				><span class="m-auto">Image Prompt</span></label
			>

			<input
				type="text"
				id={`ability-${index}-image-prompt`}
				class="input input-bordered w-full"
				value={ability.image_prompt}
				oninput={handleImagePromptInput}
				aria-label="Image Prompt"
			/>

			<button
				class="btn btn-accent btn-sm mt-2 w-full"
				onclick={handleRandomize}
				disabled={isGenerating}
				aria-label="Randomize this ability"
				tabindex="0"
			>
				Randomize Ability
			</button>
		</div>
	</div>
</details>
