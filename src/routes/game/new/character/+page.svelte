<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import {onMount} from "svelte";
    import {CharacterAgent, type CharacterState, characterStateForPrompt} from "$lib/ai/agents/characterAgent";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte";
    import {getRowsForTextarea, navigate} from "$lib/util.svelte";
    import isEqual from 'lodash.isequal';
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates";
    import {goto} from "$app/navigation";
    import {LLMProvider} from "$lib/ai/llmProvider";

    let isGeneratingState = $state(false);
    const apiKeyState = useLocalStorage('apiKeyState');
    const aiLanguage = useLocalStorage('aiLanguage');

    let characterAgent: CharacterAgent;
    onMount(() => {
        characterAgent = new CharacterAgent(
            LLMProvider.provideLLM({temperature: 2, apiKey: apiKeyState.value, language: aiLanguage.value}));
    });
    const storyState = useLocalStorage('storyState', initialStoryState);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const textAreaRowsDerived = $derived(getRowsForTextarea(characterState.value))

    let characterStateOverwrites : Partial<CharacterState> = $state({});
    let resetImageState = $state(false);

    const onRandomize = async () => {
        isGeneratingState = true;
        const newState = await characterAgent.generateCharacterDescription($state.snapshot(storyState.value), characterStateOverwrites);
        if (newState) {
            characterState.value = newState;
            resetImageState = true;
        }
        isGeneratingState = false;
    }
    const onRandomizeSingle = async (stateValue) => {
        isGeneratingState = true;
        const currentCharacter = {...characterState.value};
        currentCharacter[stateValue] = undefined;
        const characterInput = {...currentCharacter, ...characterStateOverwrites}
        const newState = await characterAgent.generateCharacterDescription($state.snapshot(storyState.value), characterInput);
        if (newState) {
            characterState.value[stateValue] = newState[stateValue];
            if (stateValue === 'appearance') {
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
    <li class="step step-primary cursor-pointer" onclick={() => goto('tale')}>Tale</li>
    <li class="step step-primary">Character</li>
    <li class="step cursor-pointer" onclick={() => goto('characterStats')}>Stats</li>
    <li class="step cursor-pointer" onclick={() => goto('characterStats')}>Start</li>
</ul>
<form class="grid gap-2 m-6">
    <p>Click on Randomize All to generate a random Character based on the Tale settings</p>
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-accent mt-3"
            disabled={isGeneratingState}
            onclick={onRandomize}>
        Randomize All
    </button>
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-neutral"
            onclick={() => {characterState.reset(); characterStateOverwrites = {}; resetImageState = true;}}>
        Clear All
    </button>
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-primary"
            onclick={() => {navigate('/new/tale')}}
    >
        Previous Step:<br> Customize Tale
    </button>
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-primary"
            onclick={() => {navigate('/new/characterStats')}}
            disabled={isEqual(characterState.value, initialCharacterState)}
    >
        Next Step:<br> Customize Stats & Abilities
    </button>


    {#each Object.keys(characterState.value) as stateValue}
        <label class="form-control w-full mt-3">
            <div class="flex-row capitalize">
                {stateValue.replaceAll('_', ' ')}
                {#if characterStateOverwrites[stateValue]}
                    <span class="badge badge-accent ml-2">overwritten</span>
                {/if}
            </div>
            <textarea bind:value={characterState.value[stateValue]}
                      rows="{textAreaRowsDerived ? textAreaRowsDerived[stateValue] : 2}"
                      placeholder="{characterStateForPrompt[stateValue]}"
                      oninput={(evt) => {characterStateOverwrites[stateValue] = evt.currentTarget.value}}
                      class="mt-2 textarea textarea-bordered textarea-md w-full">
            </textarea>
        </label>
        <button class="btn w-3/4 sm:w-1/2 m-auto btn-accent mt-2 capitalize"
                onclick={() => {
                    onRandomizeSingle(stateValue);
                }}>
            Randomize {stateValue.replaceAll('_', ' ')}
        </button>
        <button class="btn w-3/4 sm:w-1/2 m-auto btn-neutral mt-2 capitalize"
                onclick={() => {
                    characterState.resetProperty(stateValue);
                    delete characterStateOverwrites[stateValue];
                    if(stateValue === 'appearance'){
                        resetImageState = true;
                    }
                }}>
            Clear {stateValue.replaceAll('_', ' ')}
        </button>
        {#if stateValue === 'appearance'}
            <AIGeneratedImage
                    className="m-auto w-full flex flex-col "
                    storageKey='characterImageState'
                    showGenerateButton={true}
                    {resetImageState}
                    onClickGenerate={() => {resetImageState = false;}}
                    imagePrompt="{characterState.value.gender} {characterState.value.race} {characterState.value.appearance} {storyState.value.general_image_prompt}"
            />
        {/if}

    {/each}
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-primary"
            onclick={() => {navigate('/new/characterStats')}}
            disabled={isEqual(characterState.value, initialCharacterState)}
    >
        Next Step:<br> Customize Stats & Abilities
    </button>
</form>
