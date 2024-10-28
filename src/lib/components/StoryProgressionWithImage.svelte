<script lang="ts">
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { marked } from 'marked';
	import type { RenderedGameUpdate } from '../../routes/game/gameLogic';

	type Props = { story: string; gameUpdates?: Array<RenderedGameUpdate>; imagePrompt?: string };
	let { story, gameUpdates = [], imagePrompt = '' }: Props = $props();
	let rendered = (marked(story) as string)
		.replaceAll('\\n', '<br>')
		.replaceAll(' n ', '<br>')
		.replaceAll('\\&quot;', '&quot;');
</script>

<article class="prose prose-neutral m-auto mt-2" style="color: unset">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html rendered}
	{#each gameUpdates as gameUpdate}
		<p class="m-1 text-center text-sm capitalize">
			{gameUpdate.text} <span class={gameUpdate.color}>{gameUpdate.resourceText}</span>
		</p>
	{/each}
</article>
{#if imagePrompt}
	<div class="m-auto mt-3">
		<AIGeneratedImage showLoadingSpinner={false} {imagePrompt} showGenerateButton={false} />
	</div>
{/if}
