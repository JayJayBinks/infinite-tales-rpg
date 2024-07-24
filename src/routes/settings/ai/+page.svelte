<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {goto} from "$app/navigation";
    import {initialGameState} from "$lib/ai/agents/gameAgent.ts";
    import {initialCharacterState} from "$lib/state/characterState.svelte.ts";
    import {initialStoryState} from "$lib/state/storyState.svelte.ts";
    import {navigate} from "$lib/util.svelte.ts";

    const apiKey = useLocalStorage('apiKey');
    const temperature = useLocalStorage('temperature', 2);

    const gameState = useLocalStorage('gameState', initialGameState);
    const historyMessages = useLocalStorage('historyMessages', []);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const storyState = useLocalStorage('storyState', initialStoryState);

    function onStartNew() {
        historyMessages.reset();
        gameState.reset();
        characterState.reset();
        storyState.reset();
        navigate('/new/story')
    }
</script>

<form class="m-6 grid">
    <label class="form-control w-full">
        Gemini API Key
        <input type="text" id="apikey" bind:value={apiKey.value}
               class="mt-2 input input-bordered"/>
        <small class="m-auto">Don't worry, it is only saved in your browser</small>
    </label>
    <label class="form-control w-full mt-3">
        Temperature: {temperature.value}
        <input type="range" min="0" max="2" step="0.05" id="temperature" bind:value={temperature.value}
               class="mt-2 range"/>
        <small class="m-auto">Higher temperature means more random output</small>
    </label>

    <!--   // TODO for some reason goto('/new/story') does not work with existing pages -->
    <button class="btn btn-neutral mt-5 m-auto"
            disabled="{!apiKey.value}"
            onclick="{onStartNew}">
        Start New Game
    </button>
    <small class="text-red-800 m-auto">Beware! This will delete your current game!</small>
</form>