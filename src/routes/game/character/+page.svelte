<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { stringifyPretty } from '$lib/util.svelte';
	import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent.ts';
	import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
	import type { Story } from '$lib/ai/agents/storyAgent';
	import type { AIConfig } from '$lib';

	const characterState = useLocalStorage<CharacterDescription>('characterState');
	const characterStatsState = useLocalStorage<CharacterStats>('characterStatsState');
	const storyState = useLocalStorage<Story>('storyState');
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
</script>

{#if characterState.value}
	<div class="menu-content flex min-h-screen items-center justify-center p-4" id="stats">
		<div class="character-profile w-full max-w-md rounded-lg p-6 text-white shadow-lg">
			<h1 id="name" class="class mb-4 border-b border-gray-600 text-center text-3xl font-bold">
				{characterState.value.name}
			</h1>
			{#if !aiConfigState.value.disableImagesState}
				<div class="m-auto flex w-full flex-col">
					<AIGeneratedImage
						storageKey="characterImageState"
						imagePrompt="{storyState.value.general_image_prompt} {characterState.value.appearance}"
					></AIGeneratedImage>
				</div>
			{/if}
			<div class="section mb-6">
				<h2 class="mb-2 mt-2 border-b border-gray-600 pb-1 text-xl font-semibold">
					Basic Information
				</h2>
				<div class="flex flex-col space-y-1">
					<p><strong>Race:</strong> <span id="race">{characterState.value.race}</span></p>
					<p><strong>Gender:</strong> <span id="gender">{characterState.value.gender}</span></p>
					<p><strong>Class:</strong> <span id="class">{characterState.value.class}</span></p>
					<p><strong>Level:</strong> <span id="class">{characterStatsState.value.level}</span></p>
					{#each Object.entries(characterStatsState.value.resources || {}) as [resourceKey, resourceValue] (resourceKey)}
						<output class="capitalize">
							Max. {resourceKey.replaceAll('_', ' ')}: {resourceValue.max_value}
						</output>
					{/each}
					<p>
						<strong>Alignment:</strong> <span id="alignment">{characterState.value.alignment}</span>
					</p>
					<p>
						<strong>Background:</strong>
						<span id="background">{characterState.value.background}</span>
					</p>
				</div>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Appearance</h2>
				<p id="appearance">{characterState.value.appearance}</p>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Personality</h2>
				<p id="personality">{characterState.value.personality}</p>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Motivation</h2>
				<p id="motivation">{characterState.value.motivation}</p>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Traits</h2>
				<ul id="traits" class="class list-inside list-disc space-y-1">
					{stringifyPretty(characterStatsState.value.traits)}
				</ul>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">Expertise</h2>
				<ul id="expertise" class="class list-inside list-disc space-y-1">
					{stringifyPretty(characterStatsState.value.expertise)}
				</ul>
			</div>

			<div class="section mb-6">
				<h2 class="class mb-2 border-b border-gray-600 pb-1 text-xl font-semibold">
					Disadvantages
				</h2>
				<ul id="disadvantages" class="class list-inside list-disc space-y-1">
					{stringifyPretty(characterStatsState.value.disadvantages)}
				</ul>
			</div>
		</div>
	</div>
{/if}
