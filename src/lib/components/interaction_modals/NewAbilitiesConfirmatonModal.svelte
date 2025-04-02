<script lang="ts">
	import type { Ability } from '$lib/ai/agents/characterStatsAgent';
	import AbilityComponent from './AbilityComponent.svelte';

	let {
		onclose,
		spells_abilities
	}: {
		onclose: any;
		spells_abilities: Ability[];
	} = $props();
</script>

<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center text-center">
		<span class="m-auto">New Abilities Learned</span>
		<span class="m-auto">After confirming they can be edited in the Character Settings.</span>
		<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2" onclick={() => onclose()}
			>✕
		</button>
		{#each spells_abilities as ability (ability.name)}
			<AbilityComponent {ability} />
		{/each}
		<div class="mt-2 flex gap-2">
			<button class="btn btn-primary flex-1" onclick={() => onclose([])}>Cancel</button>
			<button class="btn btn-accent flex-1" onclick={() => onclose(spells_abilities)}>Learn</button>
		</div>
	</div>
</dialog>
