<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { navigate } from '$lib/util.svelte';
	import ImportExportSaveGame from '$lib/components/ImportExportSaveGame.svelte';
	import type { Campaign } from '$lib/ai/agents/campaignAgent';
	import GameSettingsModal from '$lib/components/interaction_modals/settings/GameSettingsModal.svelte';
	import AiGameSettingsModal from '$lib/components/interaction_modals/settings/AiGameSettings.svelte';

	let showGameSettingsModal = $state<boolean>(false);
	let showAiGameSettingsModal = $state<boolean>(false);

	const campaignState = useLocalStorage<Campaign>('campaignState');
	const customMemoriesState = useLocalStorage<string>('customMemoriesState');
	const customGMNotesState = useLocalStorage<string>('customGMNotesState');
	//TODO migrate all settings that can be changed during game here

	const taleSettingsClicked = () => {
		if (campaignState.value?.chapters.length > 0) {
			navigate('/new/campaign');
		} else {
			navigate('/new/tale');
		}
	};
</script>

{#if showGameSettingsModal}
	<GameSettingsModal onclose={() => (showGameSettingsModal = false)} />
{/if}
{#if showAiGameSettingsModal}
	<AiGameSettingsModal onclose={() => (showAiGameSettingsModal = false)} />
{/if}
<form class="m-6 flex flex-col items-center text-center">
	<button
		class="btn btn-neutral mt-2 w-3/4 sm:w-1/2"
		onclick={() => (showGameSettingsModal = true)}
	>
		Game Settings
	</button>
	<button
		class="btn btn-neutral mt-2 w-3/4 sm:w-1/2"
		onclick={() => (showAiGameSettingsModal = true)}
	>
		AI Settings
	</button>

	<ImportExportSaveGame isSaveGame={true}>
		{#snippet exportButton(onclick)}
			<button {onclick} class="btn btn-neutral m-auto mt-4 w-3/4 sm:w-1/2">
				Export Save Game
			</button>
		{/snippet}
		{#snippet importButton(onclick)}
			<button {onclick} class="btn btn-neutral m-auto mt-2 w-3/4 sm:w-1/2">
				Import Save Game
			</button>
		{/snippet}
	</ImportExportSaveGame>
	<button class="btn btn-neutral mt-2 w-3/4 sm:w-1/2" onclick={taleSettingsClicked}>
		View Tale Settings
	</button>
	<label class="form-control mt-2 w-full">
		<p>Custom Tale Memories</p>
		<textarea
			rows={3}
			placeholder="If the AI forgets important events during the Tale, you can enter custom memories here. Added to every action, don't make it too long."
			bind:value={customMemoriesState.value}
			class="textarea textarea-bordered mt-2 w-full"
		></textarea>
	</label>
	<label class="form-control mt-2 w-full">
		<p>Custom GM Notes</p>
		<textarea
			rows={3}
			placeholder="Use for specific/temporary game rules, added to every action, don't make it too long."
			bind:value={customGMNotesState.value}
			class="textarea textarea-bordered mt-2 w-full"
		></textarea>
	</label>
</form>
