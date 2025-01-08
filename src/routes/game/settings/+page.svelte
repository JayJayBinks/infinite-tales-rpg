<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { difficultyDiceRollModifier } from '../diceRollLogic';
	import { navigate } from '$lib/util.svelte';
	import ImportExportSaveGame from '$lib/components/ImportExportSaveGame.svelte';
	import type { Campaign } from '$lib/ai/agents/campaignAgent';

	const difficultyState = useLocalStorage<string>('difficultyState', 'Default');
	let useKarmicDice = useLocalStorage<boolean>('useKarmicDice', true);
	let useDynamicCombat = useLocalStorage<boolean>('useDynamicCombat', false);
	const campaignState = useLocalStorage<Campaign>('campaignState');

	const taleSettingsClicked = () => {
		if (campaignState.value?.chapters.length > 0) {
			navigate('/new/campaign');
		} else {
			navigate('/new/tale');
		}
	};
</script>

<form class="m-6 flex flex-col items-center text-center">
	<label class="form-control w-full sm:w-1/2">
		<p>Difficulty</p>
		<select
			id="difficultyState"
			bind:value={difficultyState.value}
			class="select select-bordered mt-2 text-center"
		>
			<option selected>Default</option>
			<option>Easy</option>
		</select>
		<small class="m-auto mt-2"
			>Easy will reduce required dice rolls by {difficultyDiceRollModifier.Easy}</small
		>
	</label>
	<label class="form-control mt-2 w-full">
		<p>Karmic Dice</p>
		<input
			type="checkbox"
			id="useKarmicDice"
			bind:checked={useKarmicDice.value}
			class="toggle m-auto mt-2 text-center"
		/>
		<small class="m-auto mb-3 mt-2"
			>If 3 consecutive dice rolls fail, you will get a bonus on the next roll</small
		>
	</label>
	<label class="form-control mt-2 w-full">
		<p>Dynamic Combat</p>
		<input
			type="checkbox"
			id="useDynamicCombat"
			bind:checked={useDynamicCombat.value}
			class="toggle m-auto mt-2 text-center"
		/>
		<small class="m-auto mb-3 mt-2"
			>Complex combat with stats and reactions, spanning multiple rounds<br />
			Disable for faster, story-focused combat.</small
		>
	</label>
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
	<button class="btn btn-neutral mt-2 w-1/2" onclick={taleSettingsClicked}>
		View Tale Settings
	</button>
</form>
