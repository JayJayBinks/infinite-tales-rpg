<script>
    import '../app.css';
    import {page} from "$app/stores";
    import {errorState} from "$lib/state/errorState.svelte.ts";
    import ErrorModal from "$lib/components/ErrorModal.svelte";
    import {handleError} from "$lib/util.svelte.ts";
    import {onMount} from "svelte";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {goto} from "$app/navigation";

    let activeUrl = $state('');
    $effect(() => {
        activeUrl = $page.url.pathname;
    })
    const apiKey = useLocalStorage('apiKey');
    onMount(() => {
        window.onerror = (event, source, lineno, colno, error) => {
            handleError(JSON.stringify({event, source, lineno, colno, error}));
            return false;
        };
        window.onunhandledrejection = (a) => {
            handleError(a.reason);
            return false;
        };

        if (!apiKey.value) {
            if (activeUrl !== '/settings/ai') {
                goto('/settings/ai').then(() => {
                    alert('Set the API key first!')
                });
            }
        }
    });

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


