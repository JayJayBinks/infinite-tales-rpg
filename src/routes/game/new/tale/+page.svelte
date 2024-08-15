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
        importJsonFromFile
    } from "$lib/util.svelte.ts";
    import isEqual from 'lodash.isequal';
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates.ts";

    let isGeneratingState = $state(false);
    const apiKeyState = useLocalStorage('apiKeyState');
    let storyAgent;

    const storyState = useLocalStorage('storyState', {...initialStoryState});
    let storyStateOverwrites = $state({});
    const characterState = useLocalStorage('characterState', {...initialCharacterState});

    onMount(() => {
        if (apiKeyState.value) {
            storyAgent = new StoryAgent(new GeminiProvider(apiKeyState.value, 2));
        }
    });
    const onRandomize = async (evt) => {
        isGeneratingState = true;
        const newState = await storyAgent.generateRandomStorySettings(storyStateOverwrites, $state.snapshot(characterState.value));
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
        const newState = await storyAgent.generateRandomStorySettings(agentInput);
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
        });
    };

</script>

{#if isGeneratingState}
    <LoadingModal/>
{/if}
<ul class="steps w-full mt-3">
    <li class="step step-primary">Tale</li>
    <li class="step"><a href="/game/new/character">Character</a></li>
    <li class="step">Start Tale</li>
</ul>
<form class="custom-main grid gap-2 m-6">
    <p>Customize or randomize the tale settings. You can also create the Character first and the Tale after.</p>
    <p>Overriding any setting will be considered for Randomize</p>

    <button class="btn btn-accent"
            disabled={isGeneratingState}
            onclick={onRandomize}>
        Randomize
    </button>
    <button class="btn btn-neutral"
            onclick={() => {
                storyState.reset();
                storyStateOverwrites = {};
                }
            }>
        Clear All
    </button>
    <button class="btn btn-neutral"
            onclick={downloadLocalStorageAsJson}>
        Export All Settings
    </button>
    <button class="btn btn-neutral"
            onclick={importSettings}>
        Import All Settings
    </button>
    <button class="btn btn-primary"
            onclick={() => {navigate('/new/character')}}>
        Customize Character
    </button>
    {#if storyState.value}
        {#each Object.keys(storyStateForPrompt) as stateValue, i}
            <label class="form-control w-full mt-3">
                <div class=" flex-row capitalize">
                    {stateValue.replaceAll('_', ' ')}
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
                onclick={() => {navigate('/new/character')}}>
            Customize Character
        </button>
    {/if}
</form>
