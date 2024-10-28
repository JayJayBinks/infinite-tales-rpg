<script>
	import logo from '$lib/assets/logo-removebg.png';
	import { page } from '$app/stores';
	import discord from '$lib/assets/socials/discord-logo-blue.png';
	import github from '$lib/assets/socials/icone-github-jaune.png';

	let { children } = $props();
	let activeUrl = $state('');
	$effect(() => {
		activeUrl = $page.url.pathname;
	});
</script>

<a href="/">
	<img src={logo} alt="Infinite Tales Logo" class="m-auto mt-3 w-1/2 sm:w-1/4" />
</a>
<nav class="btm-nav bottom-[6vh] ml-auto mr-auto h-[7vh] max-w-7xl overflow-auto bg-base-300">
	<ul class="menu gap-0 p-0 sm:text-lg">
		<li>
			<a href="/game/settings/" class:active={activeUrl === '/game/settings'}>Tale Settings</a>
		</li>
		<li>
			<a href="/game/settings/ai" class:active={activeUrl === '/game/settings/ai'}>AI Settings</a>
		</li>
	</ul>
</nav>

{@render children()}

<div class="mt-8">
	<a
		target="_blank"
		href="https://discord.gg/CUvgRQR77y"
		class="link m-auto flex flex-col items-center"
	>
		<span>Community Discussion at Discord</span>
		<img class="m-auto mt-3 w-2/3 sm:w-1/4" src={discord} alt="Discord invite" />
	</a>
	<a
		target="_blank"
		class="link m-auto mt-3 flex flex-col items-center"
		href="https://github.com/JayJayBinks/infinite-tales-rpg"
	>
		<span>Source Code at Github</span>
		<img class="m-auto mt-3 w-1/4 sm:w-1/12" src={github} alt="Github Logo" />
	</a>
</div>
