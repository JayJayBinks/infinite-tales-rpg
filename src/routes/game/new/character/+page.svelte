<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import {onMount} from "svelte";
    import {CharacterAgent} from "$lib/ai/agents/characterAgent.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import {characterStateForPrompt} from "$lib/ai/agents/characterAgent.ts";
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte";
    import {StoryAgent} from "$lib/ai/agents/storyAgent";
    import {GeminiProvider} from "$lib/ai/llmProvider";
    import {navigate} from "$lib/util.svelte.ts";
    import isEqual from 'lodash.isequal';
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates";

    let isGeneratingState = $state(false);
    const apiKeyState = useLocalStorage('apiKeyState');
    let characterAgent: CharacterAgent;
    onMount(() => {
        if (apiKeyState.value) {
            characterAgent = new CharacterAgent(new GeminiProvider(apiKeyState.value));
        }
    });
    const storyState = useLocalStorage('storyState', initialStoryState);
    const characterState = useLocalStorage('characterState', initialCharacterState);

    let characterStateOverwrites = $state({});

    let resetImageState = $state(false);

    const onRandomize = async (evt) => {
        isGeneratingState = true;
        const newState = await characterAgent.generateCharacterStats(storyState.value, characterStateOverwrites);
        if (newState) {
            characterState.value = newState;
            resetImageState = true;
        }
        isGeneratingState = false;
    }
    const onRandomizeSingle = async (stateValue) => {
        isGeneratingState = true;
        const agentInput = {...storyState.value, ...characterStateOverwrites}
        const newState = await characterAgent.generateCharacterStats(agentInput);
        if (newState) {
            characterState.value[stateValue] = newState[stateValue];
            if(stateValue === 'appearance'){
                resetImageState = true;
            }
        }
        isGeneratingState = false;
    }

</script>

{#if isGeneratingState}
    <LoadingModal/>
{/if}
<ul class="steps w-full mt-3">
    <li class="step step-primary">Story</li>
    <li class="step step-primary">Character</li>
    <li class="step">Start Game</li>
</ul>
<form class="custom-main grid gap-2 m-6">
    <p>When randomized, the Character will be created based on the story.</p>
    <button class="btn btn-accent"
            disabled={isGeneratingState}
            onclick={onRandomize}>
        Randomize
    </button>
    <button class="btn btn-neutral"
            onclick={() => {characterState.reset(); characterStateOverwrites = {}; resetImageState = true;}}>
        Clear All
    </button>
    <button class="btn btn-primary"
        onclick="{() => {navigate('/new/story')}}"
    >
        Previous
    </button>
    <button class="btn btn-primary"
            onclick="{() => {navigate('/')}}"
            disabled={isEqual(characterState.value, initialCharacterState)}
    >
        Start Game
    </button>


    {#each Object.keys(characterState.value) as stateValue, i}
        <label class="form-control w-full mt-3">
            <div class=" flex-row">
                {stateValue.charAt(0).toUpperCase() + stateValue.slice(1)}
                {#if characterStateOverwrites[stateValue]}
                    <span class="badge badge-accent">overwritten</span>
                {/if}
            </div>
            <textarea bind:value={characterState.value[stateValue]}
                      placeholder="{characterStateForPrompt[stateValue]}"
                      oninput="{(evt) => {characterStateOverwrites[stateValue] = evt.currentTarget.value}}"
                      class="mt-2 textarea textarea-bordered textarea-md w-full">

            </textarea>
        </label>
        <button class="btn btn-neutral mt-2"
                onclick={() => {
                    characterState.resetProperty(stateValue);
                    delete characterStateOverwrites[stateValue];
                    if(stateValue === 'appearance'){
                        resetImageState = true;
                    }
                }}>
            Clear
        </button>
        <button class="btn btn-accent mt-2"
                onclick={() => {
                    onRandomizeSingle(stateValue);
                }}>
            Randomize
        </button>
        {#if stateValue === 'appearance'}
            <AIGeneratedImage
                    className="m-auto w-full flex flex-col "
                    storageKey='characterImageState'
                    showGenerateButton={true}
                    {resetImageState}
                    onClickGenerate="{() => {resetImageState = false;}}"
                    imagePrompt="{characterState.value.appearance} {storyState.value.general_image_prompt}"/>
        {/if}

    {/each}
    <button class="btn btn-primary mt-2"
            onclick="{() => {navigate('/')}}"
            disabled={isEqual(characterState.value, initialCharacterState)}
    >
        Start Game
    </button>
</form>
