<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import {storyState} from "$lib/state/storyState.svelte.ts";
    import {generateRandomStorySettings, storyStateForPrompt} from "$lib/ai/agents/storyAgent.ts";
    import {aiState} from "$lib/state/aiState.svelte.js";
    import LoadingModal from "$lib/components/LoadingModal.svelte";

    const onRandomize = async (evt) => {
        aiState.isGenerating = true;
        storyState.value = await generateRandomStorySettings(storyState.overwrites);
        aiState.isGenerating = false;
    }
</script>
{#if aiState.isGenerating}
    <LoadingModal/>
{/if}
<ul class="steps w-full mt-3">
    <li class="step step-primary">Story</li>
    <li class="step">Character</li>
    <li class="step">Start Game</li>
</ul>
<form class="custom-main grid gap-2 m-6">
    <p>Customize or randomize the story settings. For suggestions see
        <a href="https://www.rpgprompts.com/" target="_blank" class="link">
            https://www.rpgprompts.com/</a>
        <br/>
        You can also let the AI decide at game start and just click "Next"
    </p>
    <button class="btn btn-accent"
            disabled={aiState.isGenerating}
            onclick={onRandomize}>
        Randomize
    </button>
    <button class="btn btn-neutral"
            onclick={() => {storyState.clear()}}>
        Clear All
    </button>
    <a class="btn btn-primary" href="/new/character">Next</a>
    {#each Object.keys(storyStateForPrompt) as stateValue, i}
        <label class="form-control w-full mt-3">
            <div class=" lex-row">
                {stateValue.charAt(0).toUpperCase() + stateValue.slice(1)}
                {#if storyState.overwrites[stateValue]}
                    <span class="badge badge-accent">overwritten</span>
                {/if}
            </div>

            <textarea bind:value={storyState.value[stateValue]}
                      placeholder="{storyStateForPrompt[stateValue]}"
                      oninput="{(evt) => {storyState.overwrites[stateValue] = evt.currentTarget.value}}"
                      class="mt-2 textarea textarea-bordered textarea-md w-full">
            </textarea>
        </label>
        <button class="btn btn-neutral mt-2"
                onclick={() => {
                    storyState.clearSingle(stateValue);
                }}>
            Clear
        </button>
    {/each}
</form>
