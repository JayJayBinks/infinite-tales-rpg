<script>
    import '../../app.css';
    import {page} from "$app/stores";
    import {errorState} from "$lib/state/errorState.svelte.ts";
    import ErrorModal from "$lib/components/ErrorModal.svelte";
    import {handleError} from "$lib/util.svelte.ts";
    import {onMount} from "svelte";
    import { stringifyPretty } from "$lib/util.svelte";

    let {children} = $props();
    let activeUrl = $state('');
    let hasSubMenu = $state(false);
    $effect(() => {
        activeUrl = $page.url.pathname;
        hasSubMenu = activeUrl.includes('game/settings');
    })

    onMount(() => {
        window.onerror = (event, source, lineno, colno, error) => {
            handleError(stringifyPretty({event, source, lineno, colno, error}));
            return false;
        };
        window.onunhandledrejection = (a) => {
            handleError(a.reason);
            return false;
        };
    });

</script>
{#if errorState.userMessage && activeUrl!=='/game'}
    <ErrorModal/>
{/if}


<nav class="btm-nav h-[7vh] bg-base-300 max-w-7xl ml-auto mr-auto overflow-auto">
    <ul class="menu gap-0 p-0 sm:text-lg">
        <li>
            <a href="/game" class:active={activeUrl==='/game'}>Tale</a>
        </li>
        <li>
            <a href="/game/debugstate" class:active={activeUrl==='/game/debugstate'}>Debug Info</a>
        </li>
        <li>
            <a href="/game/character" class:active={activeUrl==='/game/character'}>Character</a>
        </li>
        <li>
            <a href="/game/settings/ai" class:active={activeUrl.includes('/game/settings')}>Menu</a>
        </li>
    </ul>
</nav>

<!--TODO max-h-[85vh] is just a workaround because the mobile browser address bar makes 93vh higher than it should...
-->
<main
      class:max-h-[78vh]={hasSubMenu}
      class:lg:max-h-[86vh]={hasSubMenu}
      class:max-h-[85vh]={!hasSubMenu}
      class:lg:max-h-[93vh]={!hasSubMenu}
      class='max-w-7xl ml-auto mr-auto overflow-auto'>
    {@render children()}
</main>


