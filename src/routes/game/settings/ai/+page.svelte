<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {navigate} from "$lib/util.svelte.ts";
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates.ts";
    import {errorState} from "$lib/state/errorState.svelte.ts";
    import {CharacterAgent} from "$lib/ai/agents/characterAgent.ts";
    import {GeminiProvider} from "$lib/ai/llmProvider.ts";
    import {StoryAgent} from "$lib/ai/agents/storyAgent.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";

    const apiKeyState = useLocalStorage('apiKeyState');
    const temperatureState = useLocalStorage('temperatureState', 1.3);
    const customSystemInstruction = useLocalStorage('customSystemInstruction');
    const aiLanguage = useLocalStorage('aiLanguage');

    const gameActionsState = useLocalStorage('gameActionsState', []);
    const historyMessagesState = useLocalStorage('historyMessagesState', []);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const characterImageState = useLocalStorage('characterImageState');
    const storyState = useLocalStorage('storyState', initialStoryState);
    const isGameEnded = useLocalStorage('isGameEnded', false);
    const rollDifferenceHistoryState = useLocalStorage('rollDifferenceHistoryState', []);
    let isGeneratingState = $state(false);

    function clearStates() {
        historyMessagesState.reset();
        gameActionsState.reset();
        characterState.reset();
        characterImageState.reset();
        storyState.reset();
        isGameEnded.reset();
        rollDifferenceHistoryState.reset();
    }

    async function onQuickstartNew() {
        if (!apiKeyState.value) {
            errorState.userMessage = 'Please enter your Google Gemini API Key first in the settings.'
            return;
        }
        clearStates();
        // TODO refactor
        const storyAgent = new StoryAgent(new GeminiProvider(apiKeyState.value, 2, aiLanguage.value));
        isGeneratingState = true;
        const newStoryState = await storyAgent.generateRandomStorySettings();
        if (newStoryState) {
            storyState.value = newStoryState;
            const characterAgent = new CharacterAgent(new GeminiProvider(apiKeyState.value, 2, aiLanguage.value));
            const newCharacterState = await characterAgent.generateCharacterStats($state.snapshot(storyState.value));
            if (newCharacterState) {
                characterState.value = newCharacterState;
                navigate('/');
            }
        }
        isGeneratingState = false;
    }

    function onStartNew() {
        clearStates();
        navigate('/new/tale')
    }
</script>

{#if isGeneratingState}
    <LoadingModal loadingText="Creating Your New Tale..."/>
{/if}
<form class="m-6 flex flex-col items-center text-center">
    <label class="form-control w-full sm:w-2/3">
        <p>Google Gemini API Key</p>
        <input type="text" id="apikey" bind:value={apiKeyState.value}
               class="mt-2 input input-bordered"/>
        <small class="m-auto mt-2">For EU players: The free tier is not available in EU, use a browser extension to move to another country</small>
    </label>
    <button class="btn btn-accent mt-5 m-auto"
            onclick="{onQuickstartNew}">
        Quickstart: New Random Tale
    </button>
    <small class="m-auto mt-2">Let the AI generate a Tale for you</small>
    <button class="btn btn-neutral m-auto  mt-5"
            disabled={!apiKeyState.value}
            onclick="{onStartNew}">
        New Custom Tale
    </button>
    <small class="m-auto mt-2">Customize any setting of your Tale</small>
    <div class="divider mt-7">Advanced Settings</div>
    <label class="form-control w-full sm:w-2/3 mt-3">
        AI Language
        <input bind:value={aiLanguage.value}
                  placeholder="AI will respond in this language, leave empty for English"
                  class="mt-2 input input-bordered"/>
        <small class="m-auto mt-2">The Game UI will not be translated yet</small>


    </label>
    <label class="form-control w-full sm:w-2/3 mt-5">
        Temperature: {temperatureState.value}
        <input type="range" min="0" max="2" step="0.05" id="temperature" bind:value={temperatureState.value}
               class="mt-2 range"/>
        <small class="m-auto mt-2">Higher temperature makes the AI more creative, but also errors more likely</small>
    </label>
    <label class="form-control w-full sm:w-2/3 mt-5">
        Tale System Instruction
        <textarea bind:value={customSystemInstruction.value}
                  placeholder="For example: Make every action difficulty easy. Make every character speak in riddles."
               class="mt-2 textarea textarea-bordered">
        </textarea>
        <small class="m-auto mt-2">You may have to start a new Tale after setting the instruction.</small>
    </label>
</form>