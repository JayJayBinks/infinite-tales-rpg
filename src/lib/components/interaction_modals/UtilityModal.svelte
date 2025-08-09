<script lang="ts">
	let {
		is_character_in_combat,
		actions,
		onclose,
		dialogRef = $bindable()
	}: {
		is_character_in_combat: boolean;
		actions: { label: string; value: string }[];
		onclose: (action) => void;
		dialogRef: HTMLDialogElement;
	} = $props();

	function close(value?: string) {
		onclose(value);
		dialogRef.close();
	}
</script>

<dialog bind:this={dialogRef} class="modal">
	<div class="modal-box flex flex-col items-center">
		<form method="dialog">
			<span class="m-auto">Utility</span>
			<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2">✕</button>
		</form>
		<div class="py-4">
			{#each actions as action}
				<button
					class="btn btn-primary mb-2 w-full"
					disabled={is_character_in_combat}
					onclick={() => close(action.value)}
				>
					{action.label}
				</button>
			{/each}
			{#if is_character_in_combat}
				<p class="mt-2 text-center text-error">Cannot perform utility actions while in combat.</p>
			{/if}
		</div>
	</div>
</dialog>
