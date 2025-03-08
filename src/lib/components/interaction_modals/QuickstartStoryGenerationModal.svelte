<script lang="ts">
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import type { Story, StoryAgent } from '$lib/ai/agents/storyAgent';

	let {
		onclose,
		onsubmit,
		storyAgent
	}: {
		onsubmit: any;
		onclose: any;
		storyAgent: StoryAgent | undefined;
	} = $props();
	let storyDescription: string | undefined = $state(undefined);
	let storyState: Story | undefined = $state(undefined);
	let isGenerating = $state(false);

	function generateStory() {
		if (storyState) {
			onsubmit(storyState);
		} else {
			onsubmit(storyDescription);
		}
	}

	async function generateIdea() {
		isGenerating = true;
		let overwriteStory: Partial<Story> = {};
		if (storyState) {
			storyDescription = undefined;
		}
		if (storyDescription) {
			overwriteStory = {
				adventure_and_main_event: storyDescription,
				character_simple_description: storyDescription
			};
		}
		const generated = await storyAgent!.generateRandomStorySettings(overwriteStory);
		if (generated) {
			storyDescription = generated.game + '\n' + generated.adventure_and_main_event;
			storyState = generated;
		}
		isGenerating = false;
	}
</script>

<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	{#if isGenerating}
		<LoadingModal />
	{/if}
	<div class="modal-box flex flex-col items-center">
		<span class="m-auto">Tale Description</span>
		<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2" onclick={onclose}
			>✕
		</button>

		<textarea
			bind:value={storyDescription}
			class="textarea textarea-bordered mt-3 w-full"
			rows="5"
			oninput={() => (storyState = undefined)}
			placeholder="Type your idea or let the AI generate one.
By entering an idea and click Generate Idea, the AI will enhance what you entered."
		>
		</textarea>

		<div class="mt-3 flex gap-2">
			<button class="btn btn-primary" onclick={generateIdea}>Generate Idea</button>
			<button class="btn btn-accent" onclick={generateStory}>Start</button>
		</div>
	</div>
</dialog>
