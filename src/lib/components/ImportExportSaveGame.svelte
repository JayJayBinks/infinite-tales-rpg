<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import useLocalStorage from "../state/useLocalStorage.svelte";
    import {downloadLocalStorageAsJson, importJsonFromFile} from "$lib/util.svelte";
    import type {Snippet} from "svelte";

    let {isSaveGame, exportButton, importButton}: {
        isSaveGame: boolean,
        exportButton: Snippet<[() => void]>,
        importButton: Snippet<[() => void]>
    } = $props();
    const storyState = useLocalStorage('storyState');
    const characterState = useLocalStorage('characterState');
    const characterStatsState = useLocalStorage('characterStatsState');
    const difficultyState = useLocalStorage('difficultyState');
    const useKarmicDice = useLocalStorage('useKarmicDice');
    const useDynamicCombat = useLocalStorage('useDynamicCombat');

    const importSettings = () => {
        importJsonFromFile((parsed) => {
            if (isSaveGame) {
                Object.keys(parsed).forEach(key => localStorage.setItem(key, JSON.stringify(parsed[key])));
                alert('Import successfull.');
            } else {
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
