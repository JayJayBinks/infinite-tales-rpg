<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {navigate} from "$lib/util.svelte.ts";
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates.ts";

    const apiKeyState = useLocalStorage('apiKeyState');
    const temperatureState = useLocalStorage('temperatureState', 1.3);

    const gameActionsState = useLocalStorage('gameActionsState', []);
    const historyMessagesState = useLocalStorage('historyMessagesState', []);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const characterImageState = useLocalStorage('characterImageState');
    const storyState = useLocalStorage('storyState', initialStoryState);
    const isGameEnded = useLocalStorage('isGameEnded', false);

    function onStartNew() {
        historyMessagesState.reset();
        gameActionsState.reset();
        characterState.reset();
        characterImageState.reset();
        storyState.reset();
        isGameEnded.reset();
        navigate('/new/tale')
    }
</script>

<form class="m-6 flex flex-col items-center">
    <label class="form-control w-full">
        <p>Gemini API Key</p>
        <input type="text" id="apikey" bind:value={apiKeyState.value}
               class="mt-2 input input-bordered"/>
        <small class="m-auto mt-2">The free tier is not available in EU, use a browser extension to move to another country</small>
    </label>
    <label class="form-control w-full mt-3">
        Temperature: {temperatureState.value}
        <input type="range" min="0" max="2" step="0.05" id="temperature" bind:value={temperatureState.value}
               class="mt-2 range"/>
        <small class="m-auto mt-2">Higher temperature makes the AI more creative, but also errors more likely</small>
    </label>

    <button class="btn btn-neutral mt-5 m-auto"
            disabled={!apiKeyState.value}
            onclick="{onStartNew}">
        Start New Tale
    </button>
    <small class="text-red-800 m-auto">This will delete your current tale!</small>
</form>
