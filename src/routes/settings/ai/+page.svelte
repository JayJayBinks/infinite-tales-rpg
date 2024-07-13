<script>
    import {browser} from "$app/environment";
    import {aiState} from "$lib/state/aiState.svelte.ts";
    $effect(() => {
        if (browser) {
            localStorage.setItem('geminiApiKey', aiState.apiKey);
            localStorage.setItem('temperature', aiState.temperature);
        }
    });
</script>

<form class="m-6">
    <label class="form-control w-full">
        Gemini API Key
        <input type="text" id="apikey" bind:value={aiState.apiKey}
               class="mt-2 input input-bordered"/>
    </label>
    <label class="form-control w-full mt-3">
        Temperature: {aiState.temperature}
        <input type="range" min="0" max="2" step="0.05" id="temperature" bind:value={aiState.temperature}
               class="mt-2 range"/>
    </label>
</form>