<script lang="ts">
	import { errorState } from '$lib/state/errorState.svelte';
	let dialog;
	let { onclose } = $props();
</script>

<dialog
	bind:this={dialog}
	class="modal z-[1000]"
	open
	style="background: rgba(0, 0, 0, 0.3);"
>
	<div class="modal-box flex flex-col flex-wrap items-center">
		<span>Error</span>
		<span class="mt-2 max-w-sm sm:max-w-md"
		>{(errorState.userMessage + '').replaceAll(',', ', ').replaceAll(':', ': ')}</span
		>
		{#if errorState.exception && errorState.retryable}
			<span class="mt-3"
			>The AI has a bug in the UI most probably. Try reloading the page or Regenerate UI button.</span
			>
		{/if}
		<button
			class="btn btn-info mt-3"
			onclick={() => {
				dialog.close();
				errorState.clear();
				onclose();
			}}
		>
			Close
		</button>
		<button
			class="btn btn-info mt-3"
			onclick={() => {
				dialog.close();
				const error = $state.snapshot(errorState.userMessage);
				errorState.clear();
				onclose(error);
			}}
		>
			Try to fix
		</button>
	</div>
</dialog>
