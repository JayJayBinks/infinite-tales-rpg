<script>
    import '../app.css';
    import {browser} from '$app/environment';
    import {aiState} from '$lib/state/aiState.svelte.ts';
    import {page} from "$app/stores";

    $: activeUrl = $page.url.pathname;
    if (browser) {
        let apiKey = localStorage.getItem('geminiApiKey');

        if (!apiKey) {
            alert('Set Gemini API Key in Menu first!');
        } else {
            aiState.apiKey = apiKey;
        }

        aiState.temperature = localStorage.getItem('temperature') || aiState.temperature;
    }
</script>

<style>
    main :global(.custom-main){
        max-height: 85vh;
        overflow-y: auto;
    }
</style>

<nav class="btm-nav bg-base-300">
    <ul class="menu menu-horizontal justify-around">
        <li>
            <a href="/" class:active={activeUrl==='/'} >Game</a>
        </li>
        <li>
            <a href="/gamestate" class:active={activeUrl==='/gamestate'} >Game State</a>
        </li>
        <li class="b">
            <a  href="/character" class:active={activeUrl==='/character'}>Character</a>
        </li>
        <li>
            <a href="/settings/ai" class:active={activeUrl==='/settings/ai'}>Menu</a>
        </li>
    </ul>
</nav>

<!--<nav class="sub-menu" id="character">-->
<!--	<a href="/character/inventory" class="menu-tab" data-tab="inventory">Inventory</a>-->
<!--	<a href="/character" class="menu-tab" data-tab="stats">Stats</a>-->
<!--</nav>-->
<!--<nav class="sub-menu" id="menu">-->
<!--	<a href="/settings/ai" class="menu-tab" data-tab="ai-settings">AI Settings</a>-->
<!--	<a href="/settings/game" class="menu-tab" data-tab="game-settings">Game Settings</a>-->
<!--</nav>-->
<main>
    <slot></slot>
</main>


