<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import {aiState} from "$lib/state/aiState.svelte.ts";
    import {onMount} from "svelte";
    import {CharacterAgent} from "$lib/ai/agents/characterAgent";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import {characterStateForPrompt} from "$lib/ai/agents/characterAgent.ts";
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import useLocalStorage from "../../../lib/state/useLocalStorage.svelte";
    import {StoryAgent} from "../../../lib/ai/agents/storyAgent";
    import {GeminiProvider} from "../../../lib/ai/llmProvider";
    import {initialStoryState} from "../../../lib/state/storyState.svelte";
    import {initialCharacterState} from "../../../lib/state/characterState.svelte";

    const apiKey = useLocalStorage('apiKey');
    let characterAgent: CharacterAgent;
    onMount(() => {
        if (apiKey.value) {
            characterAgent = new CharacterAgent(new GeminiProvider(apiKey.value));
        }
    });
    const storyState = useLocalStorage('storyState', initialStoryState);
    const characterState = useLocalStorage('characterState', initialCharacterState);

    let characterStateOverwrites = $state({});

    const onRandomize = async (evt) => {
        aiState.isGenerating = true;
        const newState = await characterAgent.generateCharacterStats(storyState.value, characterStateOverwrites);
        if (newState) {
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
            onclick={() => {characterState.reset();}}>
        Clear All
    </button>
    <a class="btn btn-primary" href="/new/story">Previous</a>
    <a class="btn btn-primary" href="/">Start Game</a>


    {#each Object.keys(characterState.value) as stateValue, i}
        <label class="form-control w-full mt-3">
            {stateValue.charAt(0).toUpperCase() + stateValue.slice(1)}
            <textarea bind:value={characterState.value[stateValue]}
                      placeholder="{characterStateForPrompt[stateValue]}"
                      onblur="{(evt) => {characterStateOverwrites[stateValue] = evt.currentTarget.value}}"
                      class="mt-2 textarea textarea-bordered textarea-md w-full">

            </textarea>
        </label>
        <button class="btn btn-neutral mt-2"
                onclick={() => {
                    characterState.resetProperty(stateValue);
                }}>
            Clear
        </button>
        {#if stateValue === 'appearance'}
            <AIGeneratedImage
                    storageKey='characterImageState'
                    showGenerateButton={true}
                    prompt="{characterState.value.appearance} {storyState.value.general_image_prompt}"/>
        {/if}

    {/each}
    <a class="btn btn-primary" href="/">Start Game</a>
</form>
