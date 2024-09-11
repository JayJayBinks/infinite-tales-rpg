<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import {onMount} from "svelte";
    import {CharacterAgent} from "$lib/ai/agents/characterAgent.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import {characterStateForPrompt} from "$lib/ai/agents/characterAgent.ts";
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte";
    import {StoryAgent} from "$lib/ai/agents/storyAgent";
    import {GeminiProvider} from "$lib/ai/llmProvider";
    import {navigate, getRowsForTextarea, parseState} from "$lib/util.svelte.ts";
    import isEqual from 'lodash.isequal';
    import cloneDeep from "lodash.clonedeep";
    import isPlainObject from 'lodash.isplainobject';
    import {initialCharacterState, initialCharacterStatsState, initialStoryState} from "$lib/state/initialStates";
    import {CharacterStatsAgent} from "$lib/ai/agents/characterStatsAgent";
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

    let characterStatsStateOverwrites = $state(cloneDeep(initialCharacterStatsState));

    const onRandomize = async () => {
        isGeneratingState = true;
        const filteredOverwrites = removeEmptyValues(characterStatsStateOverwrites);
        const newState = await characterStatsAgent.generateCharacterStats(
            $state.snapshot(storyState.value),
            $state.snapshot(characterState.value),
            filteredOverwrites);
        if (newState) {
            parseState(newState);
            characterStatsState.value = newState;
        }
        isGeneratingState = false;
    }
    const removeEmptyValues = (object) =>
        Object.fromEntries(
            Object.entries(object)
                .filter(([_, value]) => value && Object.keys(value).length > 0)
        )

    const onRandomizeSingle = async (stateValue, deepNested) => {
        isGeneratingState = true;
        const currentCharacterStats = $state.snapshot(characterStatsState.value);
        if (deepNested) {
            currentCharacterStats[stateValue][deepNested] = undefined;
        } else {
            currentCharacterStats[stateValue] = undefined;
        }
        const filteredOverwrites = removeEmptyValues($state.snapshot(characterStatsStateOverwrites));
        const singleAbilityOverwritten = filteredOverwrites.spells_and_abilities && filteredOverwrites.spells_and_abilities[deepNested];
        //TODO not generic
        filteredOverwrites.spells_and_abilities = filteredOverwrites.spells_and_abilities &&
            Object.entries(removeEmptyValues(filteredOverwrites.spells_and_abilities)).map(([_, value]) => value);
        const characterStatsInput = {...currentCharacterStats, ...filteredOverwrites}

        if (deepNested) {
            // TODO only works for ability
            const newAbility = await characterStatsAgent.generateSingleAbility(
                $state.snapshot(storyState.value),
                $state.snapshot(characterState.value),
                characterStatsInput,
                singleAbilityOverwritten);
            characterStatsState.value[stateValue][deepNested] = newAbility;
        } else {
            const newState = await characterStatsAgent.generateCharacterStats(
                $state.snapshot(storyState.value),
                $state.snapshot(characterState.value),
                characterStatsInput);
            if (newState) {
                parseState(newState);
                characterStatsState.value[stateValue] = newState[stateValue];
            }
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
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-accent mt-3"
            disabled={isGeneratingState}
            onclick={onRandomize}>
        Randomize All
    </button>
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-neutral"
            onclick={() => {characterStatsState.reset(); characterStatsStateOverwrites = cloneDeep(initialCharacterStatsState);}}>
        Clear All
    </button>
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-primary"
            onclick="{() => {navigate('/new/character')}}"
    >
        Previous Step:<br> Customize Character
    </button>
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-primary"
            onclick="{() => {navigate('/')}}"
            disabled={isEqual(characterStatsState.value, initialCharacterStatsState)}
    >
        Start Your Tale
    </button>


    {#each Object.keys(characterStatsState.value) as stateValue, i}
        <label class="form-control w-full mt-3">
            <details class="collapse collapse-arrow border-base-300 bg-base-200 border">
                <summary
                        class="collapse-title capitalize items-center text-center">{stateValue.replaceAll('_', ' ')}</summary>
                <div class="collapse-content">
                    {#each Object.keys(characterStatsState.value[stateValue]) as statValue, i}
                        <label class="form-control w-full mt-3">
                            {#if isPlainObject(characterStatsState.value[stateValue][statValue])}
                                <details class="collapse collapse-arrow bg-base-200 border textarea-bordered">
                                    {#each Object.keys(characterStatsState.value[stateValue][statValue]) as deepNestedValue, i}
                                        {#if i === 0}
                                            <summary class="collapse-title capitalize">
                                                <div class="flex flex-col items-center text-center">
                                                    <p class="content-center"> {isNaN(parseInt(statValue)) ? statValue.replaceAll('_', ' ') :
                                                        `${characterStatsState.value[stateValue][statValue][deepNestedValue] || 'Enter A Name'}`}</p>
                                                    <button class="btn btn-error btn-sm  no-animation mt-2 components"
                                                            onclick={(evt) => {evt.preventDefault(); characterStatsState.value[stateValue].splice(statValue, 1)}}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </summary>
                                        {/if}
                                        <div class="collapse-content">
                                            <label class="form-control w-full mt-3">
                                                <div class="capitalize">
                                                    {deepNestedValue.replaceAll('_', ' ')}
                                                    {#if characterStatsStateOverwrites[stateValue] &&
                                                    characterStatsStateOverwrites[stateValue][statValue] &&
                                                    characterStatsStateOverwrites[stateValue][statValue][deepNestedValue]}
                                                        <span class="badge badge-accent ml-2">overwritten</span>
                                                    {/if}
                                                </div>
                                                <textarea
                                                        bind:value={characterStatsState.value[stateValue][statValue][deepNestedValue]}
                                                        rows="{characterStatsState.value[stateValue][statValue][deepNestedValue]?.length > 30 ? 2 : 1}"
                                                        oninput="{(evt) => {
                                                            if(!characterStatsStateOverwrites[stateValue]){
                                                                characterStatsStateOverwrites[stateValue] = {};
                                                            }
                                                            if(!characterStatsStateOverwrites[stateValue][statValue]){
                                                                characterStatsStateOverwrites[stateValue][statValue] = {};
                                                            }
                                                            characterStatsStateOverwrites[stateValue][statValue][deepNestedValue] = evt.target.value;
                                                        }}"
                                                        class="mt-2 textarea textarea-bordered textarea-md w-full">
                                                     </textarea>
                                            </label>
                                        </div>
                                    {/each}
                                    <button class="btn w-3/4 sm:w-1/2 m-auto btn-accent mt-2 mb-2 m-5"
                                            onclick={() => {
                                                onRandomizeSingle(stateValue, statValue);
                                            }}>
                                        Randomize {isNaN(parseInt(statValue)) ?
                                        statValue.replaceAll('_', ' ') : ''}
                                    </button>
                                </details>
                            {:else}
                                <div class="flex-row capitalize">
                                    {statValue.replaceAll('_', ' ')}

                                    {#if characterStatsStateOverwrites[stateValue][statValue]}
                                        <span class="badge badge-accent ml-2">overwritten</span>
                                    {/if}
                                    <button class="btn btn-error btn-xs no-animation ml-2 components"
                                            onclick={(evt) => {evt.preventDefault(); delete characterStatsState.value[stateValue][statValue]}}>
                                        Delete
                                    </button>
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
        <button class="btn w-3/4 sm:w-1/2 m-auto btn-neutral mt-2 capitalize"
                onclick={() => {
                    if(Array.isArray(characterStatsState.value[stateValue])){
                        //TODO spells_and_abilities not generic yet
                        characterStatsState.value[stateValue].push({name: '', effect: '', mp_cost: ''});
                    }else{
                        const name = prompt('Enter the name');
                        if(!characterStatsStateOverwrites[stateValue]){
                            characterStatsStateOverwrites[stateValue] = {};
                        }
                        characterStatsStateOverwrites[stateValue][name] = '';
                        characterStatsState.value[stateValue][name] = '';
                    }
                }}>
            Add {stateValue.replaceAll('_', ' ')}
        </button>
        <button class="btn w-3/4 sm:w-1/2 m-auto btn-accent mt-2 capitalize"
                onclick={() => {
                    onRandomizeSingle(stateValue);
                }}>
            Randomize {stateValue.replaceAll('_', ' ')}
        </button>
        <button class="btn w-3/4 sm:w-1/2 m-auto btn-neutral mt-2 capitalize"
                onclick={() => {
                     if(Array.isArray(characterStatsStateOverwrites[stateValue])){
                            //TODO not generic
                             characterStatsState.value.spells_and_abilities = [];
                             characterStatsStateOverwrites[stateValue] = [];
                     }else{
                            characterStatsState.resetProperty(stateValue);
                             characterStatsStateOverwrites[stateValue] = {};
                     }
                }}>
            Clear {stateValue.replaceAll('_', ' ')}
        </button>
    {/each}
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-primary mt-2"
            onclick="{() => {navigate('/')}}"
            disabled={isEqual(characterStatsState.value, initialCharacterStatsState)}
    >
        Start Your Tale
    </button>
</form>
