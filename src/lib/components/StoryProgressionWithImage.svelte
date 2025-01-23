<script lang="ts">
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { marked } from 'marked';
	import type { RenderedGameUpdate } from '../../routes/game/gameLogic';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import TTSComponent from '$lib/components/TTSComponent.svelte';

	type Props = { story: string; gameUpdates?: Array<RenderedGameUpdate>; imagePrompt?: string };
	let { story, gameUpdates = [], imagePrompt = '' }: Props = $props();
	const ttsVoiceState = useLocalStorage<string>('ttsVoice');
	let rendered = (marked(story) as string)
		.replaceAll('\\n', '<br>')
		.replaceAll(' n ', '<br>')
		.replaceAll('\\&quot;', '&quot;')
		.replaceAll('```html', '')
		.replaceAll('```', '')
		.replaceAll('_', ' ');
</script>

<div class="mt-4 flex">
	<TTSComponent text={story.replaceAll('_', ' ')} voice={ttsVoiceState.value}></TTSComponent>
</div>
<article class="prose prose-neutral m-auto mb-2 mt-2" style="color: unset">
	<div id="story">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html rendered}
	</div>
	<div id="gameUpdates mt-2">
		{#each gameUpdates as gameUpdate}
			<p class="m-1 text-center text-sm capitalize">
				{gameUpdate.text} <span class={gameUpdate.color}>{gameUpdate.resourceText}</span>
			</p>
		{/each}
	</div>
</article>
{#if imagePrompt}
	<AIGeneratedImage showLoadingSpinner={false} {imagePrompt} showGenerateButton={false} />
{/if}
