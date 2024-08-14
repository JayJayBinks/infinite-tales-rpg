<script>
    import logo from '$lib/assets/logo-removebg.png';
    import {page} from "$app/stores";
    let activeUrl = $state('');
    $effect(() => {
        activeUrl = $page.url.pathname;
    });
</script>

<a href="/">
    <img src="{logo}" alt="Infinite Tales Logo"
         class="w-1/2 sm:w-1/4 mt-3 m-auto"/>
</a>
<nav class="btm-nav bottom-[6vh] h-[7vh] bg-base-300 max-w-7xl ml-auto mr-auto overflow-auto">
    <ul class="menu gap-0 p-0 sm:text-lg">
        <li>
            <a href="/game/settings/" class:active={activeUrl==='/game/settings'}>Game Settings</a>
        </li>
        <li>
            <a href="/game/settings/ai" class:active={activeUrl==='/game/settings/ai'}>AI Settings</a>
        </li>
    </ul>
</nav>

<slot></slot>
