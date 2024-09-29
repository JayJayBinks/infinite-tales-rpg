<script>
    import {onMount} from "svelte";
    import {StoryAgent} from "$lib/ai/agents/storyAgent.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import {storyStateForPrompt} from "$lib/ai/agents/storyAgent.ts";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte";
    import {GeminiProvider} from "$lib/ai/llmProvider.ts";
    import {
        navigate,
        downloadLocalStorageAsJson,
        importJsonFromFile, getRowsForTextarea
    } from "$lib/util.svelte.ts";
    import isEqual from 'lodash.isequal';
    import {initialCharacterState, initialCharacterStatsState, initialStoryState} from "$lib/state/initialStates.ts";
    import {goto} from "$app/navigation";

    let isGeneratingState = $state(false);
    //TODO select provider
    const apiKeyState = useLocalStorage('apiKeyState', "todo use multiple provider");
    const aiLanguage = useLocalStorage('aiLanguage');
    let storyAgent;

    const storyState = useLocalStorage('storyState', {...initialStoryState});
    const textAreaRowsDerived = $derived(getRowsForTextarea(storyState.value))
    let storyStateOverwrites = $state({});
    const characterState = useLocalStorage('characterState', {...initialCharacterState});
    const characterStatsState = useLocalStorage('characterStatsState', {...initialCharacterStatsState});

    onMount(() => {
        if (apiKeyState.value) {
            storyAgent = new StoryAgent(new GeminiProvider(apiKeyState.value, 2, aiLanguage.value));
        }
    });

    function getCharacterDescription() {
        let characterDescription = $state.snapshot(characterState.value);
        if (isEqual(characterDescription, initialCharacterState)) {
            characterDescription = undefined;
        }
        return characterDescription;
    }

    const onRandomize = async (evt) => {
        isGeneratingState = true;

        const newState = await storyAgent.generateRandomStorySettings(storyStateOverwrites, getCharacterDescription());
        if (newState) {
            storyState.value = newState;
        }
        isGeneratingState = false;
    }
    const onRandomizeSingle = async (stateValue) => {
        isGeneratingState = true;
        const currentStory = {...storyState.value};
        currentStory[stateValue] = undefined;
        const agentInput = {...currentStory, ...storyStateOverwrites}
        const newState = await storyAgent.generateRandomStorySettings(agentInput, getCharacterDescription());
        if (newState) {
            storyState.value[stateValue] = newState[stateValue];
        }
        isGeneratingState = false;
    }

    function handleInput(evt, stateValue) {
        storyStateOverwrites[stateValue] = evt.target.value;
    }

    const importSettings = () => {
        importJsonFromFile((parsed) => {
            storyState.value = parsed.storyState;
            characterState.value = parsed.characterState;
            characterStatsState.value = parsed.characterStatsState;
            alert('Import successfull.');
        });
    };
</script>

{#if isGeneratingState}
    <LoadingModal/>
{/if}
<ul class="steps w-full mt-3">
    <li class="step step-primary">Tale</li>
    <li class="step cursor-pointer" onclick={() => goto('character')}>Character</li>
    <li class="step cursor-pointer" onclick={() => goto('characterStats')}>Stats</li>
    <li class="step cursor-pointer" onclick={() => goto('character')}>Start</li>
</ul>
<form class="custom-main grid gap-2 m-6">
<p>Quickstart: Click on Randomize All to generate a random Tale.</p>
<p>You can also customize any setting and play the Tale suited to your liking.</p>
<p>The custom settings will be considered for the Randomize feature.</p>
<p>You can even create the Character first and the Tale after.</p>
<p>Example: Enter 'Call of Cthulhu' as Game and click Randomize All. A random Cthulhu Tale will be generated.</p>
<button class="btn w-3/4 sm:w-1/2 m-auto btn-accent mt-3"
        disabled={isGeneratingState}
        onclick={onRandomize}>
    Randomize All
</button>
<button class="btn w-3/4 sm:w-1/2 m-auto btn-neutral"
        onclick={() => {
                storyState.reset();
                storyStateOverwrites = {};
                }
            }>
    Clear All
</button>
<button class="btn w-3/4 sm:w-1/2 m-auto btn-neutral"
        onclick={downloadLocalStorageAsJson}>
    Export All Settings
</button>
<button class="btn w-3/4 sm:w-1/2 m-auto btn-neutral"
        onclick={importSettings}>
    Import All Settings
</button>
<button class="btn w-3/4 sm:w-1/2 m-auto btn-primary"
        onclick={() => {navigate('/new/character')}}>
    Next Step:<br> Customize Character
</button>
{#if storyState.value}
    {#each Object.keys(storyStateForPrompt) as stateValue, i}
        <label class="form-control w-full mt-3">
            <div class=" flex-row capitalize">
                {stateValue.replaceAll('_', ' ')}
                {#if storyStateOverwrites[stateValue]}
                    <span class="badge badge-accent ml-2">overwritten</span>
                {/if}
            </div>

            <textarea bind:value={storyState.value[stateValue]}
                      rows="{textAreaRowsDerived ? textAreaRowsDerived[stateValue] : 2}"
                      oninput="{(evt) => handleInput(evt, stateValue)}"
                      placeholder="{storyStateForPrompt[stateValue]}"
                      class="mt-2 textarea textarea-bordered textarea-md w-full"></textarea>

        </label>
        <button class="btn w-3/4 sm:w-1/2 m-auto btn-accent mt-2 capitalize"
                onclick={() => {
                    onRandomizeSingle(stateValue);
                }}>
            Randomize {stateValue.replaceAll('_', ' ')}
        </button>
        <button class="btn w-3/4 sm:w-1/2 m-auto btn-neutral mt-2 capitalize"
                onclick={() => {
                    storyState.resetProperty(stateValue);
                    delete storyStateOverwrites[stateValue];
                }}>
            Clear {stateValue.replaceAll('_', ' ')}
        </button>
    {/each}
    <button class="btn w-3/4 sm:w-1/2 m-auto btn-primary mt-2"
            onclick={() => {navigate('/new/character')}}>
        Next Step:<br> Customize Character
    </button>
{/if}
</form>
