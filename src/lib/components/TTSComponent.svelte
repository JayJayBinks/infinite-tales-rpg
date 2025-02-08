<script lang="ts">
	import { getTTSUrl } from '$lib/util.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	type Props = { text: string; voice: string; hidden?: boolean };
	let { text, voice, hidden }: Props = $props();
	let storyTTSAudioElement: HTMLAudioElement;
	const disableAudioState = useLocalStorage<boolean>('disableAudioState', false);

	$effect(() => {
		if (text && storyTTSAudioElement) {
			storyTTSAudioElement.currentTime = 0;
			storyTTSAudioElement.src = getTTSUrl(text, voice);
		}
	});
</script>

{#if !disableAudioState.value}
	<audio preload="none" {hidden} bind:this={storyTTSAudioElement} controls class="m-auto">
		The "audio" tag is not supported by your browser.
	</audio>
{/if}
