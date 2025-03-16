<script>
	import { stringifyPretty } from '$lib/util.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	const gameActionsState = useLocalStorage('gameActionsState');
	const npcState = useLocalStorage('npcState', {});
	const characterActionsState = useLocalStorage('characterActionsState', {});
</script>

<details
	class="menu collapse collapse-arrow menu-vertical bg-base-200 mt-7"
>
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">NPC State</p>
	</summary>
	<output style="white-space: pre-wrap">{stringifyPretty(npcState.value)}</output>
</details>

<details
	class="menu collapse collapse-arrow menu-vertical bg-base-200 mt-7"
>
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Action State</p>
	</summary>
	<output style="white-space: pre-wrap">{stringifyPretty(characterActionsState.value)}</output>
</details>

<details
	class="menu collapse collapse-arrow menu-vertical bg-base-200 mt-7"
>
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Game State</p>
	</summary>
	<output style="white-space: pre-wrap"
	>{stringifyPretty(
		gameActionsState.value ? gameActionsState.value[gameActionsState.value.length - 1] : {}
	)}</output
	>

</details>
