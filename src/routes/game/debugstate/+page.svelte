<script lang="ts">
	import { initialThoughtsState, stringifyPretty, type ThoughtsState } from '$lib/util.svelte';
	import { getFromLocalStorage, saveToLocalStorage } from '$lib/state/localStorageUtil';
	import type { LLMMessage } from '$lib/ai/llm';

	function localState<T>(key: string, initial: T | undefined = undefined as any) {
		let _v = $state<T>(getFromLocalStorage(key, initial as T));
		return { get value() { return _v; }, set value(val: T) { _v = val; saveToLocalStorage(key, val); }, reset() { this.value = initial as T; }, resetProperty(prop: keyof T) { if (typeof _v === 'object' && _v !== null && initial) { (_v as any)[prop] = (initial as any)[prop]; saveToLocalStorage(key, _v);} } };
	}
	const gameActionsState = localState<any[]>('gameActionsState', []);
	const npcState = localState<Record<string, any>>('npcState', {});
	const characterActionsState = localState<Record<string, any>>('characterActionsState', {});
	const historyMessagesState = localState<LLMMessage[]>('historyMessagesState', []);
	let thoughtsState = localState<ThoughtsState>('thoughtsState', initialThoughtsState);
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
