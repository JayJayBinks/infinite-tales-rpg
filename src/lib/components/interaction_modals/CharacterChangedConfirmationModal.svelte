<script lang="ts">
	import { downloadLocalStorageAsJson } from '$lib/util.svelte';

	let {
		onclose,
		eventToConfirm
	}: {
		onclose: any;
		eventToConfirm: { title: string; description: string };
	} = $props();
</script>

<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center text-center">
		<span class="m-auto">Game Event</span>
		<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2" onclick={() => onclose()}
			>✕
		</button>
		<p class="mt-2">{eventToConfirm.title}</p>
		<p class="mt-2">{eventToConfirm.description}</p>
		<p class="mt-5">AI will re generate the character description and stats!</p>
		<p class="mt-2">
			Current Abilities will be kept, but resource cost removed. Edit them manually in the Tale
			Settings.
		</p>
		<button class="btn btn-primary mt-3" onclick={downloadLocalStorageAsJson}>Save Game</button>
		<div class="mt-2 flex gap-2">
			<button class="btn btn-primary flex-1" onclick={() => onclose(false)}>Cancel</button>
			<button class="btn btn-accent flex-1" onclick={() => onclose(true)}>Accept</button>
		</div>
	</div>
</dialog>
