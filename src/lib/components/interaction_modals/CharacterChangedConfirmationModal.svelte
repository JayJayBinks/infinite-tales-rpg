<script lang="ts">

	import { downloadLocalStorageAsJson } from '$lib/util.svelte';

	let {
		onclose,
		eventToConfirm
	}: {
		onclose: any;
		eventToConfirm: {title: string; description: string}
	} = $props();
</script>

<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center">
		<span class="m-auto">Game Event</span>
		<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2" onclick={() => onclose(false)}
			>✕
		</button>
		<p class="mt-2">{eventToConfirm.title}</p>
		<p class="mt-2">{eventToConfirm.description}</p>
		<p class="mt-5">Based on the event the AI will completely regenerate parts of the game! Use Save Game before!</p>
		<div class="mt-3 flex gap-2">
			<button class="btn btn-primary" onclick={downloadLocalStorageAsJson}>Save Game</button>
			<button class="btn btn-primary" onclick={() => onclose(false)}>Decline</button>
			<button class="btn btn-accent" onclick={() => onclose(true)}>Accept</button>
		</div>
	</div>
</dialog>
