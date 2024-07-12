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

<style>
    label{
        margin-top: 10px;
    }

</style>

<div class="menu-content" id="ai-settings">
    <label for="apikey">Gemini API Key</label>
    <input type="text" id="apikey" bind:value={aiState.apiKey}/>
    <label for="temperature">Temperature: {aiState.temperature}</label>
    <input type="range" min="0" max="2" step="0.05" id="temperature" bind:value={aiState.temperature}/>
</div>
