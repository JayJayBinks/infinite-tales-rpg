<script lang="ts">
	import LoadingIcon from '$lib/components/LoadingIcon.svelte';
	let { loadingText = 'Asking the AI' } = $props();
</script>

<dialog class="z-999 modal" open style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center">
		<LoadingIcon />
		<span class="mt-2 text-center">{loadingText}</span>
	</div>
</dialog>
