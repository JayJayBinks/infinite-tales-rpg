<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {difficultyDiceRollModifier} from "../gameLogic.ts";
    const difficultyState = useLocalStorage('difficultyState', 'Default');
</script>

<form class="m-6 flex flex-col items-center text-center">
    <label class="form-control w-1/2">
        <p>Difficulty</p>
        <select id="difficultyState" bind:value={difficultyState.value}
               class="mt-2 select select-bordered text-center"
        >
            <option selected>Default</option>
            <option>Easy</option>
        </select>
        <small class="m-auto mt-2">Easy will reduce required dice rolls by {difficultyDiceRollModifier.Easy}</small>
    </label>
</form>
