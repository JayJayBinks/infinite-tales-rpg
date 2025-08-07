<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let dialogRef: HTMLDialogElement;
	export let is_character_in_combat: boolean;
	export let actions: { label: string; value: string }[];

	const dispatch = createEventDispatcher();

	function close(value?: string) {
		if (value) {
			dispatch('close', value);
		}
		dialogRef.close();
	}
</script>

<dialog bind:this={dialogRef} class="modal">
	<div class="modal-box">
		<h3 class="font-bold text-lg">Utility</h3>
		<div class="py-4">
			{#each actions as action}
				<button
					class="btn btn-primary w-full mb-2"
					disabled={is_character_in_combat}
					on:click={() => close(action.value)}
				>
					{action.label}
				</button>
			{/each}
			{#if is_character_in_combat}
				<p class="text-error text-center mt-2">Cannot perform utility actions while in combat.</p>
			{/if}
		</div>
		<div class="modal-action">
			<button class="btn" on:click={() => close()}>Close</button>
		</div>
	</div>
</dialog>
