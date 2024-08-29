<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import {onMount} from "svelte";
    import {CharacterAgent} from "$lib/ai/agents/characterAgent.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import {characterStateForPrompt} from "$lib/ai/agents/characterAgent.ts";
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte";
    import {StoryAgent} from "$lib/ai/agents/storyAgent";
    import {GeminiProvider} from "$lib/ai/llmProvider";
    import {navigate, getRowsForTextarea} from "$lib/util.svelte.ts";
    import isEqual from 'lodash.isequal';
    import isString from 'lodash.isstring';
    import isPlainObject from 'lodash.isplainobject';
    import {initialCharacterState, initialCharacterStatsState, initialStoryState} from "$lib/state/initialStates";
    import {CharacterStatsAgent, characterStatsStateForPrompt} from "$lib/ai/agents/characterStatsAgent";
    import {goto} from "$app/navigation";

    let isGeneratingState = $state(false);
    const apiKeyState = useLocalStorage('apiKeyState');
    const aiLanguage = useLocalStorage('aiLanguage');

    let characterStatsAgent: CharacterStatsAgent;
    onMount(() => {
        if (apiKeyState.value) {
            characterStatsAgent = new CharacterStatsAgent(new GeminiProvider(apiKeyState.value, 2, aiLanguage.value));
        }
    });
    const storyState = useLocalStorage('storyState', initialStoryState);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const characterStatsState = useLocalStorage('characterStatsState', initialCharacterStatsState);
    const textAreaRowsDerived = $derived(getRowsForTextarea(characterStatsState.value))

    let characterStatsStateOverwrites = $state({...initialCharacterStatsState});

    function parseState(newState) {
        Object.keys(newState).forEach(key => {
            if (isString(newState[key])) {
                const parsedValue = JSON.parse(newState[key]);
                newState[key] = parsedValue;
            }
        })
    }

    const onRandomize = async () => {
        isGeneratingState = true;
        const newState = await characterStatsAgent.generateCharacterStats(
            $state.snapshot(storyState.value),
            $state.snapshot(characterState.value),
            characterStatsStateOverwrites);
        if (newState) {
            parseState(newState);
            characterStatsState.value = newState;
        }
        isGeneratingState = false;
    }
    const onRandomizeSingle = async (stateValue) => {
        isGeneratingState = true;
        const currentCharacterStats = {...characterStatsState.value};
        currentCharacterStats[stateValue] = undefined;
        const characterStatsInput = {...currentCharacterStats, ...characterStatsStateOverwrites}

        const newState = await characterStatsAgent.generateCharacterStats(
            $state.snapshot(storyState.value),
            $state.snapshot(characterState.value),
            characterStatsInput);
        if (newState) {
            parseState(newState);
            characterStatsState.value[stateValue] = newState[stateValue];
        }
        isGeneratingState = false;
    }

    const nextStepClicked = async () => {
        if (isEqual(characterStatsState.value, initialCharacterStatsState)) {
            await onRandomize();
        }
        await goto('/game');
    };

</script>

{#if isGeneratingState}
    <LoadingModal/>
{/if}
<ul class="steps w-full mt-3">
    <li class="step step-primary cursor-pointer" onclick={() => goto('tale')}>Tale</li>
    <li class="step step-primary cursor-pointer" onclick={() => goto('character')}>Character</li>
    <li class="step step-primary">Stats</li>
    <li class="step cursor-pointer" onclick={nextStepClicked}>Start</li>
</ul>
<form class="custom-main grid gap-2 m-6">
    <p>Click on Randomize All to generate random Stats based on the Character settings</p>
    <button class="btn btn-accent mt-3"
            disabled={isGeneratingState}
            onclick={onRandomize}>
        Randomize All
    </button>
    <button class="btn btn-neutral"
            onclick={() => {characterStatsState.reset(); characterStatsStateOverwrites = {};}}>
        Clear All
    </button>
    <button class="btn btn-primary"
            onclick="{() => {navigate('/new/character')}}"
    >
        Previous Step: Customize Character
    </button>
    <button class="btn btn-primary"
            onclick="{() => {navigate('/')}}"
            disabled={isEqual(characterStatsState.value, initialCharacterStatsState)}
    >
        Start Your Tale
    </button>


    {#each Object.keys(characterStatsState.value) as stateValue, i}
        <label class="form-control w-full mt-3">
            <details class="collapse collapse-arrow border-base-300 bg-base-200 border">
                <summary class="collapse-title capitalize">{stateValue.replaceAll('_', ' ')}</summary>
                <div class="collapse-content">
                    <!--{#if characterStatsStateOverwrites[stateValue]}-->
                    <!--    <span class="badge badge-accent">overwritten</span>-->
                    <!--{/if}-->
                    {#each Object.keys(characterStatsState.value[stateValue]) as statValue, i}
                        <label class="form-control w-full mt-3">
                            {#if isPlainObject(characterStatsState.value[stateValue][statValue])}
                                <details class="collapse collapse-arrow border-base-300 bg-base-200 border">
                                    {#each Object.keys(characterStatsState.value[stateValue][statValue]) as deepNestedValue, i}
                                        {#if i === 0}
                                            <summary
                                                    class="collapse-title capitalize"> {isNaN(parseInt(statValue)) ? statValue.replaceAll('_', ' ') :
                                                `${characterStatsState.value[stateValue][statValue][deepNestedValue]}`}
                                            </summary>
                                        {/if}
                                        <div class="collapse-content">
                                            <label class="form-control w-full mt-3">
                                                <div class="capitalize">
                                                    {deepNestedValue.replaceAll('_', ' ')}
                                                </div>
                                                <!--   characterStatsStateOverwrites -->
                                                <textarea
                                                        bind:value={characterStatsState.value[stateValue][statValue][deepNestedValue]}
                                                        rows="{characterStatsState.value[stateValue][statValue][deepNestedValue].length > 30 ? 2 : 1}"
                                                        oninput="{(evt) => {characterStatsStateOverwrites[stateValue][statValue] = evt.currentTarget.value}}"
                                                        class="mt-2 textarea textarea-bordered textarea-md w-full">
                                        </textarea>
                                            </label>
                                        </div>
                                    {/each}
                                </details>
                            {:else}
                                <div class="flex-row capitalize">
                                    {statValue.replaceAll('_', ' ')}
                                    {#if characterStatsStateOverwrites[stateValue][statValue]}
                                        <span class="badge badge-accent ml-2">overwritten</span>
                                    {/if}
                                </div>
                                <textarea bind:value={characterStatsState.value[stateValue][statValue]}
                                          rows="{textAreaRowsDerived ? textAreaRowsDerived[stateValue][statValue] : 1}"
                                          oninput="{(evt) => {characterStatsStateOverwrites[stateValue][statValue] = evt.currentTarget.value}}"
                                          class="mt-2 textarea textarea-bordered textarea-md w-full">
                                </textarea>
                            {/if}
                        </label>
                    {/each}
                </div>
            </details>
        </label>
        <button class="btn btn-neutral mt-2 capitalize"
                onclick={() => {
                    const name = prompt('Enter the name');
                    if(Array.isArray(characterStatsState.value[stateValue])){
                        //TODO abilities not generic yet
                        characterStatsState.value[stateValue].push({name, effect: '', mp_cost: 0, difficulty: 'simple'});
                    }else{
                        characterStatsStateOverwrites[stateValue][name] = '';
                        characterStatsState.value[stateValue][name] = '';
                    }
                }}>
            Add {stateValue.replaceAll('_', ' ')}
        </button>
        <button class="btn btn-accent mt-2 capitalize"
                onclick={() => {
                    onRandomizeSingle(stateValue);
                }}>
            Randomize {stateValue.replaceAll('_', ' ')}
        </button>
        <button class="btn btn-neutral mt-2 capitalize"
                onclick={() => {
                    characterStatsState.resetProperty(stateValue);
                    delete characterStatsStateOverwrites[stateValue];
                }}>
            Clear {stateValue.replaceAll('_', ' ')}
        </button>
    {/each}
    <button class="btn btn-primary mt-2"
            onclick="{() => {navigate('/')}}"
            disabled={isEqual(characterStatsState.value, initialCharacterStatsState)}
    >
        Start Your Tale
    </button>
</form>
