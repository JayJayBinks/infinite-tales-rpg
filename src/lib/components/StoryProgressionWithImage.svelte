<script lang="ts">
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { marked } from 'marked';
	import type { RenderedGameUpdate } from '../../routes/game/gameLogic';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import TTSComponent from '$lib/components/TTSComponent.svelte';
	import type { AIConfig } from '$lib';
	import LightBulb from './visuals/LightBulb.svelte';
	import type { MemoryAgent } from '$lib/ai/agents/memoryAgent';
	import { onDestroy, onMount } from 'svelte';

	type Props = {
		story: string;
		gameStateId?: number;
		memoryAgent: MemoryAgent;
		gameUpdates?: Array<RenderedGameUpdate | undefined>;
		imagePrompt?: string;
	};
	let { story, gameUpdates = [], imagePrompt = '', memoryAgent, gameStateId }: Props = $props();
	const ttsVoiceState = useLocalStorage<string>('ttsVoice');
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');

	let isMemory = $state(false);
	const onMemoryClick = () => {
			if (isMemory) {
				memoryAgent.deleteMemoryByGameStateId(gameStateId!);
			} else {
				memoryAgent.saveMemory(story, gameStateId);
			}
	};

	let subscription;

	onMount(() => {
		if (gameStateId) {
			subscription = memoryAgent.isMemoryAsObservable(gameStateId!).subscribe((hasMemory) => {
				isMemory = hasMemory !== undefined;
			});
		}
	});

	onDestroy(() => {
		if (subscription) subscription.unsubscribe();
	});

	let rendered = (marked(story) as string)
		.replaceAll('\\n', '<br>')
		.replaceAll(' n ', '<br>')
		.replaceAll('\\&quot;', '&quot;')
		.replaceAll('```html', '')
		.replaceAll('```', '')
		.replaceAll('<html>', '')
		.replaceAll('</html>', '')
		.replaceAll('html', '')
		.replaceAll('_', ' ');
</script>

{#if !aiConfigState.value?.disableAudioState}
	<div class="mt-4 flex">
		<TTSComponent text={story.replaceAll('_', ' ')} voice={ttsVoiceState.value}></TTSComponent>
	</div>
{/if}
<article class="prose prose-neutral m-auto mb-2 mt-2" style="color: unset">
	<div id="story">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html rendered}
	</div>
	<div id="gameUpdates mt-2">
		{#if gameStateId}
			<button class="btn btn-ghost w-full p-0" onclick={onMemoryClick}>
				<LightBulb fill={isMemory ? 'yellow' : 'gray'} />
				{isMemory ? 'Memorized' : 'Not Memorized'}
			</button>
		{/if}
		{#each gameUpdates as gameUpdate}
			<p class="m-1 text-center text-sm capitalize">
				{gameUpdate.text} <span class={gameUpdate.color}>{gameUpdate.resourceText}</span>
			</p>
		{/each}
	</div>
</article>
{#if imagePrompt && !aiConfigState.value?.disableImagesState}
	<AIGeneratedImage showLoadingSpinner={false} {imagePrompt} showGenerateButton={false} />
{/if}
