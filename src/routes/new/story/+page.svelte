<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import {aiState} from "$lib/state/aiState.svelte.js";
    import {getContext, onMount, setContext} from "svelte";
    import {StoryAgent} from "../../../lib/ai/agents/storyAgent";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import {storyStateForPrompt} from "$lib/ai/agents/storyAgent.ts";
    import useLocalStorage from "../../../lib/state/useLocalStorage.svelte";
    import {GeminiProvider} from "../../../lib/ai/llmProvider";
    import {initialStoryState} from "../../../lib/state/storyState.svelte";
    import debounce from 'lodash/debounce'
    import {initialCharacterState} from "../../../lib/state/characterState.svelte";

    const apiKey = useLocalStorage('apiKey');
    let storyAgent: StoryAgent;
    onMount(() => {
        if (apiKey.value) {
            storyAgent = new StoryAgent(new GeminiProvider(apiKey.value));
        }
    });

    const storyState = useLocalStorage('storyState', {...initialStoryState});
    let storyStateOverwrites = $state({});
    const characterState = useLocalStorage('characterState', {...initialCharacterState});
    const onRandomize = async (evt) => {
        aiState.isGenerating = true;
        const newState = await storyAgent.generateRandomStorySettings(storyStateOverwrites);
        if (newState) {
            storyState.value = newState;
            //TODO better way to reset?
            characterState.reset();
        }
        aiState.isGenerating = false;
    }

    function handleInput(evt, stateValue) {
        storyStateOverwrites[stateValue] = evt.target.value;
    }
    const debounceHandleInput = debounce(handleInput, 300);
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
            onclick={() => {storyState.reset(); storyStateOverwrites = {}}}>
        Clear All
    </button>
    <a class="btn btn-primary" href="/new/character">Next</a>
    {#if storyState.value}
        {#each Object.keys(storyStateForPrompt) as stateValue, i}
            <label class="form-control w-full mt-3">
                <div class=" lex-row">
                    {stateValue.charAt(0).toUpperCase() + stateValue.slice(1)}
                    {#if storyStateOverwrites[stateValue]}
                        <span class="badge badge-accent">overwritten</span>
                    {/if}
                </div>

                <textarea bind:value={storyState.value[stateValue]}
                        oninput="{(evt) => debounceHandleInput(evt, stateValue)}"
                        placeholder="{storyStateForPrompt[stateValue]}"
                        class="mt-2 textarea textarea-bordered textarea-md w-full"></textarea>

            </label>
            <button class="btn btn-neutral mt-2"
                    onclick={() => {
                    storyState.resetProperty(stateValue);
                    delete storyStateOverwrites[stateValue];
                }}>
                Clear
            </button>
        {/each}
        <a class="btn btn-primary" href="/new/character">Next</a>
    {/if}
</form>
