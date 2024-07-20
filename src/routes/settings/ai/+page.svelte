<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import debounce from 'lodash/debounce'
    import {goto} from "$app/navigation";

    const apiKey = useLocalStorage('apiKey');
    const temperature = useLocalStorage('temperature', 2);
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
            onclick="{() => {
    const a = document.createElement('a');
    a.href = '/new/story';
    a.click();
}}"

    >

        Start Game
    </button>
</form>