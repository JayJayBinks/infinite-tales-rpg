<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {navigate} from "$lib/util.svelte.ts";
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates.ts";

    const apiKeyState = useLocalStorage('apiKeyState');
    const temperatureState = useLocalStorage('temperatureState', 2);

    const gameActionsState = useLocalStorage('gameActionsState', []);
    const historyMessagesState = useLocalStorage('historyMessagesState', []);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const characterImageState = useLocalStorage('characterImageState');
    const storyState = useLocalStorage('storyState', initialStoryState);

    function onStartNew() {
        historyMessagesState.reset();
        gameActionsState.reset();
        characterState.reset();
        characterImageState.reset();
        storyState.reset();
        navigate('/new/story')
    }
</script>

<form class="m-6 grid">
    <label class="form-control w-full">
        Gemini API Key
        <input type="text" id="apikey" bind:value={apiKeyState.value}
               class="mt-2 input input-bordered"/>
        <small class="m-auto">Don't worry, it is only saved in your browser</small>
    </label>
    <label class="form-control w-full mt-3">
        Temperature: {temperatureState.value}
        <input type="range" min="0" max="2" step="0.05" id="temperature" bind:value={temperatureState.value}
               class="mt-2 range"/>
        <small class="m-auto">Higher temperature means more random output</small>
    </label>

    <!--   // TODO for some reason goto('/new/story') does not work with existing pages -->
    <button class="btn btn-neutral mt-5 m-auto"
            disabled="{!apiKeyState.value}"
            onclick="{onStartNew}">
        Start New Game
    </button>
    <small class="text-red-800 m-auto">This will delete your current game!</small>
</form>