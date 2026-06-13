<script lang="ts">
	import { initialThoughtsState, stringifyPretty, type ThoughtsState } from '$lib/util.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { LLMMessage } from '$lib/ai/llm';
	import { LLM_DEBUG_STATE_KEY, type LlmDebugState } from '$lib/ai/llmDebug';
	import type { GameActionState } from '$lib/ai/agents/gameAgent';
	import type { Action } from '$lib/ai/agents/gameAgent';

	const gameActionsState = useLocalStorage<GameActionState[]>('gameActionsState', []);
	const npcState = useLocalStorage('npcState', {});
	const characterActionsState = useLocalStorage<Action[]>('characterActionsState', []);
	const historyMessagesState = useLocalStorage<LLMMessage[]>('historyMessagesState');
	let thoughtsState = useLocalStorage<ThoughtsState>('thoughtsState', initialThoughtsState);
	const llmDebugState = useLocalStorage<LlmDebugState>(LLM_DEBUG_STATE_KEY, {});
</script>

<details class="menu collapse collapse-arrow menu-vertical mt-7 bg-base-200" open>
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Local AI Diagnostics</p>
	</summary>
	<div class="grid gap-2 p-4 text-sm">
		<div><strong>Provider:</strong> {llmDebugState.value?.provider || 'No request recorded'}</div>
		<div><strong>Base URL:</strong> {llmDebugState.value?.baseUrl || '-'}</div>
		<div><strong>Model:</strong> {llmDebugState.value?.model || '-'}</div>
		<div><strong>Last request:</strong> {llmDebugState.value?.lastRequestStartedAt || '-'}</div>
		<div><strong>Duration:</strong> {llmDebugState.value?.lastRequestDurationMs ?? '-'} ms</div>
		<div>
			<strong>Prompt size:</strong>
			{llmDebugState.value?.promptCharactersAfterBudget ?? '-'} chars
			{#if llmDebugState.value?.promptCharacters}
				<span class="text-base-content/60">
					(from {llmDebugState.value.promptCharacters})
				</span>
			{/if}
		</div>
		<div><strong>Trimmed messages:</strong> {llmDebugState.value?.trimmedMessages ?? '-'}</div>
		<div><strong>Strict JSON:</strong> {llmDebugState.value?.strictJson ? 'yes' : 'no'}</div>
		<div>
			<strong>JSON mode attempted:</strong>
			{llmDebugState.value?.jsonModeAttempted ? 'yes' : 'no'}
		</div>
		<div>
			<strong>JSON schema attempted:</strong>
			{llmDebugState.value?.jsonSchemaAttempted ? 'yes' : 'no'}
		</div>
		<div>
			<strong>Retried without JSON schema:</strong>
			{llmDebugState.value?.jsonSchemaRetriedWithout ? 'yes' : 'no'}
		</div>
		<div>
			<strong>Retried without JSON mode:</strong>
			{llmDebugState.value?.jsonModeRetriedWithout ? 'yes' : 'no'}
		</div>
		<div>
			<strong>Response-format cache hit:</strong>
			{llmDebugState.value?.responseFormatCapabilityCacheHit ? 'yes' : 'no'}
		</div>
		<div>
			<strong>JSON schema capability:</strong>
			{llmDebugState.value?.jsonSchemaCapability || 'unknown'}
		</div>
		<div>
			<strong>JSON object capability:</strong>
			{llmDebugState.value?.jsonObjectCapability || 'unknown'}
		</div>
		<div>
			<strong>Sanitizing or repair used:</strong>
			{llmDebugState.value?.sanitizingOrRepairUsed ? 'yes' : 'no'}
		</div>
		{#if llmDebugState.value?.promptViewType}
			<div><strong>Prompt view:</strong> {llmDebugState.value.promptViewType}</div>
		{/if}
		{#if llmDebugState.value?.promptViewReductions?.length}
			<div>
				<strong>Prompt reductions:</strong>
				<output style="white-space: pre-wrap"
					>{llmDebugState.value.promptViewReductions.join('\n')}</output
				>
			</div>
		{/if}
		{#if llmDebugState.value?.validationErrors?.length}
			<div>
				<strong>Validation errors:</strong>
				<output style="white-space: pre-wrap"
					>{llmDebugState.value.validationErrors.join('\n')}</output
				>
			</div>
		{/if}
		{#if llmDebugState.value?.validationDetails?.length}
			<div>
				<strong>Validation details:</strong>
				<output style="white-space: pre-wrap"
					>{llmDebugState.value.validationDetails.join('\n')}</output
				>
			</div>
		{/if}
		{#if llmDebugState.value?.lastError}
			<div class="text-error"><strong>Last error:</strong> {llmDebugState.value.lastError}</div>
		{/if}
	</div>
</details>

<details class="menu collapse collapse-arrow menu-vertical mt-7 bg-base-200">
	<summary class="collapse-title text-lg font-bold capitalize">
		<p class="text-center">Last Local Prompt Preview</p>
	</summary>
	<output class="block p-4 text-sm" style="white-space: pre-wrap"
		>{llmDebugState.value?.promptPreview || 'No prompt preview recorded'}</output
	>
</details>

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
