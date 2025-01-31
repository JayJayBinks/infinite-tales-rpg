<script lang="ts">
	import { errorState } from '$lib/state/errorState.svelte';
	let dialog;
	let { onclose } = $props();
</script>

<dialog
	bind:this={dialog}
	{onclose}
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
				>Please retry the action or reload the page. If the error persists report it in the Discord.</span
			>
		{/if}
		<button
			class="btn btn-info mt-3"
			onclick={() => {
				dialog.close();
				errorState.clear();
			}}
		>
			Close
		</button>
	</div>
</dialog>
