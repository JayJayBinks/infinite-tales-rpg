<script lang="ts">
	import { goto } from '$app/navigation';
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
	<div class="modal-box flex flex-col">
		<span class="text-center font-bold">Error</span>
		<span class="mt-2 max-w-sm break-words sm:max-w-md">{errorState.userMessage}</span>
		{#if errorState.exception && errorState.retryable}
			<span class="mt-3 font-bold">
				Please retry the action or reload the page. If the error persists report it in the Discord.
			</span>
		{/if}
		<button
			class="btn btn-info mt-3"
			onclick={() => {
				dialog.close();
				errorState.clear();
				goto('/game/settings/ai');
			}}
		>
			Go To Settings
		</button>
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
