<script>
	import { stringifyPretty } from '$lib/util.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	const gameActionsState = useLocalStorage('gameActionsState');
	const npcState = useLocalStorage('npcState', {});
	const characterActionsState = useLocalStorage('characterActionsState', {});
</script>

<div class="divider mt-7">NPC State</div>
<output style="white-space: pre-wrap">{stringifyPretty(npcState.value)}</output>
<div class="divider mt-7">Action State</div>
<output style="white-space: pre-wrap">{stringifyPretty(characterActionsState.value)}</output>
<div class="divider mt-7">Game State</div>
<output style="white-space: pre-wrap"
	>{stringifyPretty(
		gameActionsState.value ? gameActionsState.value[gameActionsState.value.length - 1] : {}
	)}</output
>
