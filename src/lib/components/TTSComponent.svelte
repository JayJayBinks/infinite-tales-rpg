<script lang="ts">
	import { getTTSUrl } from '$lib/util.svelte';

	type Props = { text: string; voice: string; hidden?: boolean };
	let { text, voice }: Props = $props();
	let storyTTSAudioElement: HTMLAudioElement;
	$effect(() => {
		if (!text) storyTTSAudioElement.src = '';
		if (text && storyTTSAudioElement) {
			storyTTSAudioElement.currentTime = 0;
			storyTTSAudioElement.src = getTTSUrl(text, voice);
		}
	});
</script>

<audio preload="none" bind:this={storyTTSAudioElement} controls class="m-auto">
	The "audio" tag is not supported by your browser.
</audio>
