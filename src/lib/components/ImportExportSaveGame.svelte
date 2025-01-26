<script lang="ts">
	import { useLocalStorage } from '../state/useLocalStorage.svelte';
	import { downloadLocalStorageAsJson, importJsonFromFile } from '$lib/util.svelte';
	import type { Snippet } from 'svelte';
	import { migrateIfApplicable } from '$lib/state/versionMigration';

	let {
		isSaveGame,
		exportButton,
		importButton
	}: {
		isSaveGame: boolean;
		exportButton: Snippet<[() => void]>;
		importButton: Snippet<[() => void]>;
	} = $props();
	const storyState = useLocalStorage('storyState');
	const campaignState = useLocalStorage('campaignState');
	const currentChapterState = useLocalStorage('currentChapterState');
	const characterState = useLocalStorage('characterState');
	const characterStatsState = useLocalStorage('characterStatsState');
	const difficultyState = useLocalStorage('difficultyState');
	const useKarmicDice = useLocalStorage('useKarmicDice');
	const useDynamicCombat = useLocalStorage('useDynamicCombat');

	const importSettings = () => {
		importJsonFromFile((parsed) => {
			if (isSaveGame) {
				Object.keys(parsed).forEach((key) => {
					const state = migrateIfApplicable(key, parsed[key]);
					localStorage.setItem(key, JSON.stringify(state));
				});
				alert('Import successfull.');
			} else {
				campaignState.value = parsed.campaignState;
				currentChapterState.value = 1;
				storyState.value = parsed.storyState;
				characterState.value = parsed.characterState;
				characterStatsState.value = parsed.characterStatsState;
				//settings
				difficultyState.value = parsed.difficultyState;
				useKarmicDice.value = parsed.useKarmicDice;
				useDynamicCombat.value = parsed.useDynamicCombat;
				window.location.reload();
			}
		});
	};
</script>

{@render exportButton(downloadLocalStorageAsJson)}
{@render importButton(importSettings)}
