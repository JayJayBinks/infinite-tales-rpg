<script>
    import {storyStateForPrompt} from "$lib/state/storyState.svelte.ts";
    import {storyState} from "$lib/state/storyState.svelte.ts";
</script>
<form class="custom-main grid gap-2 m-6">
        <p>Customize or randomize the story settings. <br/> For suggestions see
            <a href="https://www.rpgprompts.com/" target="_blank" class="link">
            https://www.rpgprompts.com/</a>
        </p>
        <button class="btn btn-accent">Randomize</button>
        {#each Object.keys(storyStateForPrompt) as name, i}
            <label class="form-control w-full mt-3">
                {name.charAt(0).toUpperCase() + name.slice(1)}
                <input type="text" bind:value={storyState.value[name]}
                       placeholder="{storyStateForPrompt[name]}"
                       class="mt-2 input input-bordered w-full"/>
            </label>
        {/each}
</form>
