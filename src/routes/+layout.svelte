<script>
    import '../app.css';
    import {browser} from '$app/environment';
    import {aiState} from '$lib/state/aiState.svelte.ts';
    import {page} from "$app/stores";
    import {errorState} from "$lib/state/errorState.svelte.ts";
    import ErrorModal from "$lib/components/ErrorModal.svelte";
    import {handleError} from "$lib/util.svelte.ts";

    $: activeUrl = $page.url.pathname;
    if (browser) {
        window.onerror = (event, source, lineno, colno, error)  => {
            handleError(JSON.stringify({event, source, lineno, colno, error}));
            return false;
        };
        window.onunhandledrejection = (a) => {
            handleError(a.reason);
            return false;
        };

        let apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            alert('Set Gemini API Key in Menu first!');
        } else {
            aiState.apiKey = apiKey;
        }

        aiState.temperature = localStorage.getItem('temperature') || aiState.temperature;
    }
</script>

{#if errorState.userMessage}
    <ErrorModal/>
{/if}


<nav class="btm-nav bg-base-300 max-w-7xl ml-auto mr-auto overflow-auto">
    <ul class="menu text-lg">
        <li>
            <a href="/" class:active={activeUrl==='/'}>Game</a>
        </li>
        <li>
            <a href="/gamestate" class:active={activeUrl==='/gamestate'}>Game State</a>
        </li>
        <li class="b">
            <a href="/character" class:active={activeUrl==='/character'}>Character</a>
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
<main class="max-w-7xl max-h-[93vh] ml-auto mr-auto overflow-auto">
    <slot></slot>
</main>


