<script>
    import {onMount} from "svelte";
    import {StoryAgent} from "$lib/ai/agents/storyAgent.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import {storyStateForPrompt} from "$lib/ai/agents/storyAgent.ts";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte";
    import {GeminiProvider} from "$lib/ai/llmProvider.ts";
    import {navigate} from "$lib/util.svelte.ts";
    import isEqual from 'lodash.isequal';
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates.ts";

    let isGeneratingState = $state(false);
    const apiKeyState = useLocalStorage('apiKeyState');
    let storyAgent;
    onMount(() => {
        if (apiKeyState.value) {
            storyAgent = new StoryAgent(new GeminiProvider(apiKeyState.value));
        }
    });

    const storyState = useLocalStorage('storyState', {...initialStoryState});
    let storyStateOverwrites = $state({});
    const characterState = useLocalStorage('characterState', {...initialCharacterState});
    const characterImageState = useLocalStorage('characterImageState');
    const onRandomize = async (evt) => {
        isGeneratingState = true;
        const newState = await storyAgent.generateRandomStorySettings(storyStateOverwrites);
        if (newState) {
            storyState.value = newState;
            //TODO better way to reset?
            characterState.reset();
            characterImageState.reset();
        }
        isGeneratingState = false;
    }
    const onRandomizeSingle = async (stateValue) => {
        isGeneratingState = true;
        const currentStory = {...storyState.value};
        currentStory[stateValue] = undefined;
        const agentInput = {...currentStory, ...storyStateOverwrites}
        const newState = await storyAgent.generateRandomStorySettings(agentInput);
        if (newState) {
            storyState.value[stateValue] = newState[stateValue];
        }
        isGeneratingState = false;
    }

    function handleInput(evt, stateValue) {
        storyStateOverwrites[stateValue] = evt.target.value;
    }
</script>

{#if isGeneratingState}
    <LoadingModal/>
{/if}
<ul class="steps w-full mt-3">
    <li class="step step-primary">Tale</li>
    <li class="step">Character</li>
    <li class="step">Start Game</li>
</ul>
<form class="custom-main grid gap-2 m-6">
    <p>Customize or randomize the tale settings. For suggestions see
        <a href="https://www.rpgprompts.com/" target="_blank" class="link">
            https://www.rpgprompts.com/</a>
        <br>
        You can also just enter certain elements to be considered for Randomize.
    </p>
    <button class="btn btn-accent"
            disabled={isGeneratingState}
            onclick={onRandomize}>
        Randomize
    </button>
    <button class="btn btn-neutral"
            onclick={() => {
                storyState.reset();
                storyStateOverwrites = {};
                characterState.reset();
                characterImageState.reset();
                }
            }>
        Clear All
    </button>
    <button class="btn btn-primary"
            onclick={() => {navigate('/new/character')}}
            disabled="{isEqual(storyState.value , initialStoryState)}">
        Next
    </button>
    {#if storyState.value}
        {#each Object.keys(storyStateForPrompt) as stateValue, i}
            <label class="form-control w-full mt-3">
                <div class=" flex-row">
                    {stateValue.charAt(0).toUpperCase() + stateValue.slice(1)}
                    {#if storyStateOverwrites[stateValue]}
                        <span class="badge badge-accent">overwritten</span>
                    {/if}
                </div>

                <textarea bind:value={storyState.value[stateValue]}
                          oninput="{(evt) => handleInput(evt, stateValue)}"
                          placeholder="{storyStateForPrompt[stateValue]}"
                          class="mt-2 textarea textarea-bordered textarea-md w-full"></textarea>

            </label>
            <button class="btn btn-accent mt-2"
                    onclick={() => {
                    onRandomizeSingle(stateValue);
                }}>
                Randomize
            </button>
            <button class="btn btn-neutral mt-2"
                    onclick={() => {
                    storyState.resetProperty(stateValue);
                    delete storyStateOverwrites[stateValue];
                }}>
                Clear
            </button>
        {/each}
        <button class="btn btn-primary mt-2"
                onclick={() => {navigate('/new/character')}}
                disabled="{isEqual(storyState.value , initialStoryState)}">
            Next
        </button>
    {/if}
</form>
