<nav class="menu active" id="main-menu">
    <a href="/" class="menu-tab active" data-tab="game">Game</a>
    <a href="/gamestate" class="menu-tab" data-tab="gamestate">Game State</a>
    <a href="/character" class="menu-tab" data-tab="character">Character</a>
    <a href="/settings/ai" class="menu-tab" data-tab="menu">Menu</a>
</nav>
<nav class="sub-menu" id="character">
    <a href="/character/inventory" class="menu-tab" data-tab="inventory">Inventory</a>
    <a href="/character" class="menu-tab" data-tab="stats">Stats</a>
</nav>
<nav class="sub-menu" id="menu">
    <a href="/settings/ai" class="menu-tab" data-tab="ai-settings">AI Settings</a>
    <a href="/settings/game" class="menu-tab" data-tab="game-settings">Game Settings</a>
</nav>


<slot/>


<style>
    :global(.menu-content) {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
    }

    a {
        color: white
    }

    .menu {
        display: none;
    }

    .sub-menu {
        display: none;
    }

    .menu.active {
        display: flex;
        overflow-x: auto;
        margin-bottom: 10px;
    }

    .sub-menu.active {
        display: flex;
        justify-content: space-around;
        margin-bottom: 10px;
    }

    .menu-tab {
        padding: 10px 20px;
        cursor: pointer;
        background-color: #444;
        border: 1px solid #666;
        flex-grow: 1;
        text-align: center;
    }

    .menu-tab.active {
        background-color: #666;
    }

</style>

<script>
    import {browser} from "$app/environment";
    import {aiState} from "$lib/state/aiState.svelte.ts";


    if (browser) {
        let apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            alert("Set Gemini API Key in Menu first!");
        } else {
            aiState.apiKey = apiKey;
        }

        aiState.temperature = localStorage.getItem('temperature') || aiState.temperature;
    }

</script>
