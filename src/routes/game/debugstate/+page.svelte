<script lang="ts">
	import { navigate, stringifyPretty } from '$lib/util.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	const uiTempContext = useLocalStorage<string[]>('uiTempContext', []);
	const gameStateTempContext = useLocalStorage<string[]>('gameStateTempContext', []);
	const npcState = useLocalStorage('npcState', {});
	const characterActionsState = useLocalStorage('characterActionsState', {});
	const dynamicGameState = useLocalStorage<any>('dynamicGameState');
	let uiData = useLocalStorage('uiData', { html: '', css: '', javascript: '' });
</script>

<div class="divider mt-7">Contextual Game State Rules</div>
<output style="white-space: pre-wrap">{stringifyPretty(gameStateTempContext.value)}</output>
<div class="divider mt-7">Contextual UI Rules</div>
<output style="white-space: pre-wrap">{stringifyPretty(uiTempContext.value)}</output>
<div class="divider mt-7">Game State</div>
<output style="white-space: pre-wrap"
>{stringifyPretty(
	dynamicGameState.value
)}</output
>

<button
	type="submit"
	onclick={() => {uiData.reset(); navigate('/')}}
	class="btn btn-neutral w-full lg:w-1/4 mt-5"
>Regenerate UI
</button>

