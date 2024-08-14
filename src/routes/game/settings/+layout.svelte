<script>
    import logo from '$lib/assets/logo-removebg.png';
    import {page} from "$app/stores";
    import discord from '$lib/assets/socials/discord-logo-blue.png';
    import github from '$lib/assets/socials/icone-github-jaune.png';

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

<div class="mt-8">
    <a target="_blank" href="https://discord.gg/CUvgRQR77y" class="link m-auto flex flex-col items-center ">
        <span>Community Discussion at Discord</span>
        <img class="w-2/3 sm:w-1/4 mt-3 m-auto" src="{discord}" alt="Discord invite"/>
    </a>
    <a target="_blank" class="link m-auto mt-3 flex flex-col items-center "
       href="https://github.com/JayJayBinks/infinite-tales-rpg">
        <span>Source Code at Github</span>
        <img class="w-1/4 sm:w-1/12 mt-3 m-auto" src="{github}"
             alt="Github Logo"/>
    </a>
</div>
