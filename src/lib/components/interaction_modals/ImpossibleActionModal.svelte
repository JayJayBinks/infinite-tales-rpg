<script lang="ts">
	import type { Action } from '$lib/ai/agents/gameAgent';

	let {
		onclose,
		action
	}: {
		onclose?;
		action: Action;
	} = $props();
</script>

<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center text-center">
		<span class="m-auto font-bold">Action is not possible!</span>
		{#if action.is_possible !== false}
			You do not have enough {action.resource_cost?.resource_key} to perform this action: <span class="text-blue-500"
				>{action.resource_cost?.cost} {action.resource_cost?.resource_key}</span
			>
		{:else}
			This action is not plausible: <p>{action.plausibility}</p>
		{/if}
		<button
			type="button"
			class="components btn btn-neutral mt-2 w-1/2"
			onclick={() => onclose(false)}
		>
			Ok
		</button>
		<p class="mt-4">
			{#if action.is_possible === false}
				You can perform this action if you roll a natural 20!
			{:else}
				Attempt without using {action.resource_cost?.resource_key} but with -3 disadvantage.
			{/if}
		</p>
		<button
			type="button"
			class="components btn btn-primary mt-2 w-1/2"
			onclick={() => onclose(true)}
		>
			Try anyway
		</button>
	</div>
</dialog>
