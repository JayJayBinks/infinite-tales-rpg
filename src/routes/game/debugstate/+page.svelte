<script lang="ts">
	import { initialThoughtsState, stringifyPretty, type ThoughtsState } from '$lib/util.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { LLMMessage } from '$lib/ai/llm';

	const gameActionsState = useLocalStorage('gameActionsState');
	const npcState = useLocalStorage('npcState', {});
	const characterActionsState = useLocalStorage('characterActionsState', {});
	const historyMessagesState = useLocalStorage<LLMMessage[]>('historyMessagesState');
	let thoughtsState = useLocalStorage<ThoughtsState>('thoughtsState', initialThoughtsState);
</script>

<details class="menu collapse collapse-arrow menu-vertical mt-7 bg-base-200">
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">NPC State</p>
	</summary>
	<output style="white-space: pre-wrap">{stringifyPretty(npcState.value)}</output>
</details>

<details class="menu collapse collapse-arrow menu-vertical mt-7 bg-base-200">
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Current Simulation</p>
	</summary>
	<output style="white-space: pre-wrap"
		>{historyMessagesState.value?.findLast((message) => message.role === 'user')?.content ||
			'No simulation'}</output
	>
</details>

<details class="menu collapse collapse-arrow menu-vertical mt-7 bg-base-200">
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Action State</p>
	</summary>
	<output style="white-space: pre-wrap">{stringifyPretty(characterActionsState.value)}</output>
</details>

<details class="menu collapse collapse-arrow menu-vertical mt-7 bg-base-200">
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Game State</p>
	</summary>
	<output style="white-space: pre-wrap"
		>{stringifyPretty(
			gameActionsState.value ? gameActionsState.value[gameActionsState.value.length - 1] : {}
		)}</output
	>
</details>

<details class="menu collapse collapse-arrow menu-vertical mt-7 bg-base-200">
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Story Thoughts</p>
	</summary>
	<output style="white-space: pre-wrap">{thoughtsState.value.storyThoughts}</output>
</details>

<details class="menu collapse collapse-arrow menu-vertical mt-7 bg-base-200">
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Action Thoughts</p>
	</summary>
	<output style="white-space: pre-wrap">{thoughtsState.value.actionsThoughts}</output>
</details>

<details class="menu collapse collapse-arrow menu-vertical mt-7 bg-base-200">
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Character Change Thoughts</p>
	</summary>
	<output style="white-space: pre-wrap">{thoughtsState.value.eventThoughts}</output>
</details>
