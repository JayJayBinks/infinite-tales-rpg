<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {difficultyDiceRollModifier} from "../diceRollLogic.ts";
    import {downloadLocalStorageAsJson, importJsonFromFile} from "$lib/util.svelte.ts";
    import {navigate} from "$lib/util.svelte.ts";
    const difficultyState = useLocalStorage('difficultyState', 'Default');
    let useKarmicDice = useLocalStorage('useKarmicDice', true);
    let useDynamicCombat = useLocalStorage('useDynamicCombat', true);

    const importSavegame = () => {
        importJsonFromFile((parsed) => {
            Object.keys(parsed).forEach(key => localStorage.setItem(key, JSON.stringify(parsed[key])));
            alert('Import successfull.');
        });
    };

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
        <small class="m-auto mt-2 mb-3">Complex combat with NPC stats and reactions, can take many rounds<br>Turn off for quicker story focused combat</small>
    </label>

    <button class="btn btn-neutral w-1/2 mt-4"
            onclick={downloadLocalStorageAsJson}>
        Export Tale
    </button>
    <button class="btn btn-neutral w-1/2 mt-2"
            onclick={importSavegame}>
        Import Tale
    </button>
    <button class="btn btn-neutral w-1/2 mt-2"
            onclick={() => navigate('/new/tale')}>
        View Tale Settings
    </button>
</form>
