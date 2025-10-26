<script context="module" lang="ts">
	// Export types from a module context so they can be imported elsewhere without causing Svelte compile errors
	export type StoryProgressionWithImageProps = {
		storyTextRef?: HTMLElement;
		story: string;
		gameUpdates?: Array<import('../../routes/game/gameLogic').RenderedGameUpdate | undefined>;
		imagePrompt?: string;
		stream_finished?: boolean;
	};
</script>
<script lang="ts">
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { marked } from 'marked';
	import type { RenderedGameUpdate } from '../../routes/game/gameLogic';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import TTSComponent from '$lib/components/TTSComponent.svelte';
	import type { AIConfig } from '$lib';
	let {
		storyTextRef = $bindable(),
		story,
		gameUpdates = [],
		imagePrompt = '',
		stream_finished = true
	}: StoryProgressionWithImageProps = $props();
	const ttsVoiceState = useLocalStorage<string>('ttsVoice');
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');

	let rendered = (toRender: string) => {
		if (!toRender) return '';
		return (marked(toRender) as string)
			.replaceAll('\\n', '<br>')
			.replaceAll(' n ', '<br>')
			.replaceAll('\\&quot;', '&quot;')
			.replaceAll('```html', '')
			.replaceAll('```', '')
			.replaceAll('<html>', '')
			.replaceAll('</html>', '')
			.replaceAll('html', '')
			.replaceAll('_', ' ');
	};
</script>

{#if !aiConfigState.value?.disableAudioState}
	<div class="mt-4 flex">
		<TTSComponent
			text={stream_finished ? story?.replaceAll('_', ' ') : ''}
			voice={ttsVoiceState.value}
		></TTSComponent>
	</div>
{/if}
<article
	bind:this={storyTextRef}
	class="prose prose-neutral m-auto mb-2 mt-2 scroll-mt-24"
	style="color: unset"
>
	<div id="story">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html rendered(story)}
	</div>
	<div id="gameUpdates mt-2">
		{#each gameUpdates as gameUpdate}
			<p class="m-1 text-center text-sm capitalize">
				{gameUpdate.text} <span class={gameUpdate.color}>{gameUpdate.resourceText}</span>
			</p>
		{/each}
	</div>
</article>
{#if imagePrompt?.trim() && !aiConfigState.value?.disableImagesState}
	<AIGeneratedImage showLoadingSpinner={false} {imagePrompt} showGenerateButton={false} />
{/if}
