<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {navigate} from "$lib/util.svelte.ts";
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates.ts";
    import discord from '$lib/assets/socials/discord-logo-blue.png';
    import github from '$lib/assets/socials/icone-github-jaune.png';
    import logo from '$lib/assets/logo-removebg.png';

    const apiKeyState = useLocalStorage('apiKeyState');
    const temperatureState = useLocalStorage('temperatureState', 1);

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

<img src="{logo}" alt="Infinite Tales Logo"
     class="w-1/2 sm:w-1/4 mt-3 m-auto"/>
<form class="m-6 flex flex-col items-center">
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

    <button class="btn btn-neutral mt-5 m-auto"
            disabled={!apiKeyState.value}
            onclick="{onStartNew}">
        Start New Game
    </button>
    <small class="text-red-800 m-auto">This will delete your current game!</small>

    <div class="mt-32">
        <a target="_blank" href="https://discord.gg/CUvgRQR77y" class="link m-auto flex flex-col items-center ">
            <span>Community Discussion at Discord</span>
            <img class="w-2/3 sm:w-1/4 mt-3 m-auto" src="{discord}" alt="Discord invite"/>
        </a>
        <a target="_blank" class="link m-auto mt-3 flex flex-col items-center "
           href="https://github.com/JayJayBinks/infinite-tales-rpg">
            <span>Source Code at Github</span>
            <img class="w-1/4 sm:w-1/12 mt-3 m-auto" src="{github}"
                 alt="Github Logo"/>
        </a>
    </div>
</form>
