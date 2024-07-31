<script>
    import '../../app.css';
    import {page} from "$app/stores";
    import {errorState} from "$lib/state/errorState.svelte.ts";
    import ErrorModal from "$lib/components/ErrorModal.svelte";
    import {handleError} from "$lib/util.svelte.ts";
    import {onMount} from "svelte";

    let activeUrl = $state('');
    $effect(() => {
        activeUrl = $page.url.pathname;
    })

    onMount(() => {
        window.onerror = (event, source, lineno, colno, error) => {
            handleError(JSON.stringify({event, source, lineno, colno, error}));
            return false;
        };
        window.onunhandledrejection = (a) => {
            handleError(a.reason);
            return false;
        };
    });
</script>
{#if errorState.userMessage}
    <ErrorModal/>
{/if}


<nav class="btm-nav h-[7vh] bg-base-300 max-w-7xl ml-auto mr-auto overflow-auto ">
    <ul class="menu gap-0 sm:text-lg">
        <li>
            <a href="/game" class:active={activeUrl==='/game'}>Game</a>
        </li>
        <li>
            <a href="/game/gamestate" class:active={activeUrl==='/game/gamestate'}>Game State</a>
        </li>
        <li class="b">
            <a href="/game/character" class:active={activeUrl==='/game/character'}>Character</a>
        </li>
        <li>
            <a href="/game/settings/ai" class:active={activeUrl==='/game/settings/ai'}>Menu</a>
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

<!--TODO max-h-[85vh] is just a workaround because the mobile browser address bar makes 93vh higher than it should...
-->
<main class="max-h-[85vh] md:max-h-[93vh] max-w-7xl ml-auto mr-auto overflow-auto">
    <slot></slot>
</main>


