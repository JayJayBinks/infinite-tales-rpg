<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { AIConfig } from '$lib';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import type { Story } from '$lib/ai/agents/storyAgent';
	import { CharacterStatsAgent } from '$lib/ai/agents/characterStatsAgent';
	import type { Ability } from '$lib/ai/agents/characterStatsAgent';

	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	const storyState = useLocalStorage<Story>('storyState');

	let { ability }: { ability: Ability } = $props();
</script>

<label class="form-control textarea-bordered mt-3 w-full border bg-base-200">
	<div
		class:sm:grid-cols-6={!aiConfigState.value?.disableImagesState}
		class="grid-cols mt-4 grid overflow-hidden overflow-ellipsis text-center"
	>
		<div class="m-auto sm:col-span-3">
			{#if !aiConfigState.value?.disableImagesState}
				<AIGeneratedImage
					noLogo={true}
					enhance={false}
					imageClassesString="w-[90px] sm:w-[100px] h-[90px] sm:h-[100px] m-auto"
					imagePrompt={CharacterStatsAgent.getSpellImagePrompt(
						ability,
						storyState?.value?.general_image_prompt
					)}
					showGenerateButton={false}
				></AIGeneratedImage>
			{/if}
		</div>
		<div
			class:sm:col-span-3={aiConfigState.value?.disableImagesState}
			class="m-auto w-full sm:col-span-2"
		>
			{#if ability.resource_cost?.cost > 0}
				<p class="badge badge-info h-fit capitalize">
					{ability.resource_cost?.cost}
					{(ability.resource_cost?.resource_key || '').replaceAll('_', ' ')}
				</p>
			{/if}
			<p class="mt-2 overflow-hidden overflow-ellipsis">{ability.name}</p>
		</div>
	</div>
	<p class="m-5 mt-2">
		{ability.effect}
	</p>
</label>
