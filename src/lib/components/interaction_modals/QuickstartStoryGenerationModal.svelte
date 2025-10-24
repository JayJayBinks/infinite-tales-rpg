<script lang="ts">
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import type { Story, StoryAgent } from '$lib/ai/agents/storyAgent';
	import type { unescape } from 'querystring';

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
	let partyDescription: string | undefined = $state(undefined);
	let partyMemberCount: number | undefined = $state(undefined);
	let storyState: Story | undefined = $state(undefined);
	let isGenerating = $state(false);

	function generateStory() {
		const data = {
			story: storyState || storyDescription,
			partyDescription,
			partyMemberCount
		};
		onsubmit(data);
	}

	async function generateIdea() {
		isGenerating = true;
		let overwriteStory: Partial<Story> = {};
		if (storyState) {
			storyDescription = undefined;
		}
		if (storyDescription || partyDescription || partyMemberCount) {
			overwriteStory = {
				adventure_and_main_event: storyDescription,
				party_description: partyDescription || storyDescription,
				party_count: partyMemberCount?.toString() || ''
			};
		}
		const generated = await storyAgent!.generateRandomStorySettings(overwriteStory);
		if (generated) {
			storyDescription = generated.game + '\n' + generated.adventure_and_main_event;
			storyState = generated;
			partyDescription = generated.party_description;
			partyMemberCount = parseInt(generated.party_count) || undefined;
		}
		isGenerating = false;
	}
</script>

<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	{#if isGenerating}
		<LoadingModal />
	{/if}
	<div class="modal-box flex flex-col items-center">
		<span class="m-auto text-lg font-bold">Tale Description</span>
		<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2" onclick={onclose}
			>✕
		</button>

		<textarea
			bind:value={storyDescription}
			class="textarea textarea-bordered mt-3 w-full"
			rows="4"
			oninput={() => (storyState = undefined)}
			placeholder="Type your adventure idea or let the AI generate one.
Example: A dark fantasy quest to stop a necromancer from raising an undead army."
		>
		</textarea>

		<div class="divider my-2">Party Configuration</div>

		<div class="form-control w-full">
			<label class="label">
				<span class="label-text">Number of Party Members</span>
			</label>
			<div class="flex gap-2 justify-center">
				{#each [1, 2, 3, 4] as count}
					<button
						class="btn btn-sm"
						class:btn-primary={partyMemberCount === count}
						class:btn-outline={partyMemberCount !== count}
						onclick={() => (partyMemberCount = count)}
					>
						{count}
					</button>
				{/each}
			</div>
		</div>

		<textarea
			bind:value={partyDescription}
			class="textarea textarea-bordered mt-3 w-full"
			rows="3"
			placeholder="Optional: Describe your party.
Example: A balanced party with a warrior, mage, rogue, and cleric."
		>
		</textarea>

		<div class="mt-3 flex gap-2 w-full">
			<button class="btn btn-primary flex-1" onclick={generateIdea}>Generate Idea</button>
			<button class="btn btn-accent flex-1" onclick={generateStory}>Start</button>
		</div>
	</div>
</dialog>
