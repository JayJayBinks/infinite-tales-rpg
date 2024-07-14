<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import {storyStateForPrompt} from "$lib/state/storyState.svelte.ts";
    import {storyState} from "$lib/state/storyState.svelte.ts";
    import {generateRandomStorySettings} from "$lib/ai/agents/storyAgent.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";


    let isGenerating: boolean = $state(false);

    const onRandomize = async (evt) => {
        isGenerating = true;
        await generateRandomStorySettings();
        isGenerating = false;
    }
</script>
{#if isGenerating}
    <LoadingModal />
{/if}
<form class="custom-main grid gap-2 m-6">
    <p>Customize or randomize the story settings. <br/> For suggestions see
        <a href="https://www.rpgprompts.com/" target="_blank" class="link">
            https://www.rpgprompts.com/</a>
    </p>
    <button class="btn btn-accent"
            disabled={isGenerating}
            onclick={onRandomize}>
        Randomize
    </button>
    <button class="btn btn-neutral"
            onclick={() => {storyState.clear()}}>
        Clear
    </button>
    {#each Object.keys(storyStateForPrompt) as stateValue, i}
        <label class="form-control w-full mt-3">
            {stateValue.charAt(0).toUpperCase() + stateValue.slice(1)}
            <textarea bind:value={storyState.value[stateValue]}
                      placeholder="{storyStateForPrompt[stateValue]}"
                      onblur="{(evt) => {storyState.overwrites[stateValue] = evt.currentTarget.value}}"
                      class="mt-2 textarea textarea-bordered textarea-md w-full">

            </textarea>
        </label>
    {/each}
</form>
