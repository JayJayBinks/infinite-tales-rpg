<script lang="ts">
	import type { ResourcesWithCurrentValue } from '$lib/ai/agents/gameAgent';
	import { getXPNeededForLevel } from '../../routes/game/levelLogic';
	import MediaQuery from 'svelte-media-queries';

	let {
		resources,
		currentLevel
	}: {
		resources: ResourcesWithCurrentValue;
		currentLevel: number;
	} = $props();

	function getCurrentXPText() {
		return `${resources?.XP.current_value}/${getXPNeededForLevel(currentLevel)}`;
	}
</script>

<MediaQuery query="(max-width: 480px)" let:matches>
	{#if matches && Object.entries(resources || {}).length > 3}
		<details
			open
			class="menu collapse collapse-arrow menu-vertical sticky top-0 z-10 bg-base-200 p-0"
		>
			<summary class="collapse-title text-lg font-bold capitalize">
				<p class="pl-8 text-center">Resources</p>
			</summary>
			<div class="collapse-content grid grid-cols-2">
				{@render resourcesList(true)}
			</div>
		</details>
	{:else}
		<div class="menu menu-horizontal sticky top-0 z-10 grid grid-flow-col grid-rows-2 bg-base-200">
			{@render resourcesList(false)}
		</div>
	{/if}
</MediaQuery>

{#snippet resourcesList(isDisplayedInGrid)}
	{#each Object.entries(resources || {}) as [resourceKey, resourceValue] (resourceKey)}
		{#if resourceKey === 'XP'}
			<output
				id="XP"
				class:text-end={isDisplayedInGrid}
				class:mr-3={isDisplayedInGrid}
				class="text-center text-lg font-semibold text-green-500"
			>
				XP
			</output>
			<output
				id="XP"
				class:text-start={isDisplayedInGrid}
				class:ml-3={isDisplayedInGrid}
				class="text-center text-lg font-semibold text-green-500"
			>
				{getCurrentXPText()}
			</output>
		{:else}
			<output
				class="overflow-auto text-center text-lg font-semibold capitalize"
				class:text-end={isDisplayedInGrid}
				class:mr-3={isDisplayedInGrid}
				class:text-red-500={resourceValue.game_ends_when_zero}
				class:text-blue-500={!resourceValue.game_ends_when_zero}
			>
				{resourceKey.replaceAll('_', ' ')}
			</output>
			<output
				class="text-center text-lg font-semibold capitalize"
				class:text-start={isDisplayedInGrid}
				class:ml-3={isDisplayedInGrid}
				class:text-red-500={resourceValue.game_ends_when_zero}
				class:text-blue-500={!resourceValue.game_ends_when_zero}
			>
				{resourceValue.current_value || 0}/{resourceValue.max_value}
			</output>
		{/if}
	{/each}
{/snippet}
