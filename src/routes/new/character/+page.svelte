<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import {generateCharacterStats} from "$lib/ai/agents/characterAgent";
    import {aiState} from "$lib/state/aiState.svelte.ts";
    import {characterState} from "$lib/state/characterState.svelte.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import {characterStateForPrompt} from "$lib/ai/agents/characterAgent.js";
    import {storyState} from "$lib/state/storyState.svelte.js";

    const onRandomize = async (evt) => {
        aiState.isGenerating = true;
        const newState = await generateCharacterStats(storyState.value, characterState.overwrites);
        if(newState){
            characterState.value = newState;
        }
        aiState.isGenerating = false;
    }

</script>

{#if aiState.isGenerating}
    <LoadingModal/>
{/if}
<ul class="steps w-full mt-3">
    <li class="step step-primary">Story</li>
    <li class="step step-primary">Character</li>
    <li class="step">Start Game</li>
</ul>
<form class="custom-main grid gap-2 m-6">
    <button class="btn btn-accent"
            disabled={aiState.isGenerating}
            onclick={onRandomize}>
        Randomize
    </button>
    <button class="btn btn-neutral"
            onclick={() => {characterState.clear()}}>
        Clear All
    </button>
    <a class="btn btn-primary" href="/new/story">Previous</a>
    <a class="btn btn-primary" href="/">Start Game</a>



    {#each Object.keys(characterState.value) as stateValue, i}
        <label class="form-control w-full mt-3">
            {stateValue.charAt(0).toUpperCase() + stateValue.slice(1)}
            <textarea bind:value={characterState.value[stateValue]}
                      placeholder="{characterStateForPrompt[stateValue]}"
                      onblur="{(evt) => {characterState.overwrites[stateValue] = evt.currentTarget.value}}"
                      class="mt-2 textarea textarea-bordered textarea-md w-full">

            </textarea>
        </label>
        <button class="btn btn-neutral mt-2"
                onclick={() => {
                    characterState.clearSingle(stateValue);
                }}>
            Clear
        </button>
        {#if stateValue === 'appearance'}
            <AIGeneratedImage prompt="${characterState.value.appearance} ${storyState.value.general_image_prompt}"/>
        {/if}

    {/each}

</form>
