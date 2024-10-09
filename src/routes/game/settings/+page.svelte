<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte";
    import {difficultyDiceRollModifier} from "../diceRollLogic";
    import {navigate} from "$lib/util.svelte";
    import ImportExportSaveGame from "$lib/components/ImportExportSaveGame.svelte";

    const difficultyState = useLocalStorage('difficultyState', 'Default');
    let useKarmicDice = useLocalStorage('useKarmicDice', true);
    let useDynamicCombat = useLocalStorage('useDynamicCombat', true);

</script>

<form class="m-6 flex flex-col items-center text-center">
    <label class="form-control w-full sm:w-1/2">
        <p>Difficulty</p>
        <select id="difficultyState" bind:value={difficultyState.value}
                class="mt-2 select select-bordered text-center"
        >
            <option selected>Default</option>
            <option>Easy</option>
        </select>
        <small class="m-auto mt-2">Easy will reduce required dice rolls by {difficultyDiceRollModifier.Easy}</small>
    </label>
    <label class="form-control w-full mt-2">
        <p>Karmic Dice</p>
        <input type="checkbox" id="useKarmicDice" bind:checked={useKarmicDice.value}
               class="mt-2 m-auto toggle text-center"/>
        <small class="m-auto mt-2 mb-3">If 3 consecutive dice rolls fail, you will get a bonus on the next roll</small>
    </label>
    <label class="form-control w-full mt-2">
        <p>Dynamic Combat</p>
        <input type="checkbox" id="useDynamicCombat" bind:checked={useDynamicCombat.value}
               class="mt-2 m-auto toggle text-center"/>
        <small class="m-auto mt-2 mb-3">Complex combat with stats and reactions, spanning multiple rounds<br>
            Disable for faster, story-focused combat.</small>
    </label>

    <ImportExportSaveGame isSaveGame={true}>
        {#snippet exportButton(onclick)}
            <button {onclick}
                    class="btn w-3/4 sm:w-1/2 m-auto btn-neutral mt-4">
                Export Save Game
            </button>
        {/snippet}
        {#snippet importButton(onclick)}
            <button {onclick}
                    class="btn w-3/4 sm:w-1/2 m-auto btn-neutral mt-2">
                Import Save Game
            </button>
        {/snippet}
    </ImportExportSaveGame>
    <button class="btn btn-neutral w-1/2 mt-2"
            onclick={() => navigate('/new/tale')}>
        View Tale Settings
    </button>
</form>
