<script lang="ts">
	import { defaultGameSettings, type GameSettings } from '$lib/ai/agents/gameAgent';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	let { onclose }: { onclose?: () => void } = $props();
	let gameSettingsState = useLocalStorage<GameSettings>('gameSettingsState', defaultGameSettings());

	const useDynamicCombat = useLocalStorage<boolean>('useDynamicCombat', false);
</script>

<dialog open class="modal z-50" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center text-center">
		<h3 class="text-lg font-bold">AI Settings</h3>

		<label class="form-control mt-5 w-full sm:w-2/3">
			<span>Dynamic Combat</span>
			<input
				type="checkbox"
				id="useDynamicCombat"
				bind:checked={useDynamicCombat.value}
				class="toggle m-auto mt-2 text-center"
			/>
			<small class="m-auto mt-2 text-xs text-base-content/70">
				Enable for reactions for every NPC during combat.<br />
				Disable for faster, story-focused combat.
			</small>
		</label>

		<label class="form-control mt-5 w-full sm:w-2/3">
			<span>Detailed Narration Length</span>
			<input
				type="checkbox"
				bind:checked={gameSettingsState.value.detailedNarrationLength}
				class="toggle m-auto mt-2 text-center"
			/>
			<small class="m-auto mt-2 text-xs text-base-content/70">
				Enabled longer detailed narration, disabled shorter concise length
			</small>
		</label>

		<label class="form-control mt-5 w-full sm:w-2/3">
			<span>AI creates new skills</span>
			<input
				type="checkbox"
				bind:checked={gameSettingsState.value.aiIntroducesSkills}
				class="toggle m-auto mt-2 text-center"
			/>
			<small class="m-auto mt-2 text-xs text-base-content/70">
				When no existing skill fits the action, the AI will create a new one.
			</small>
		</label>

		<label class="form-control mt-5 w-full sm:w-2/3">
			<span>Random events</span>
			<select
				bind:value={gameSettingsState.value.randomEventsHandling}
				class="select select-bordered mt-2 text-center"
			>
				<option value="none">None</option>
				<option value="probability">Probability</option>
				<option value="ai_decides">AI decides</option>
			</select>
			<small class="m-auto mt-2 text-xs text-base-content/70">
				E.g. travel or spell channelling is interrupted
				<br />
				None: action is never interrupted
				<br />
				Probability: E.g. 75% ambush in dangerous area
				<br />
				AI decides: based on context
			</small>
		</label>

		<!-- Close Button -->
		<div class="modal-action mt-6">
			<button class="btn btn-info" onclick={onclose}>Close</button>
		</div>
	</div>
	<!-- Optional: Click outside to close -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={onclose}>close</button>
	</form>
</dialog>
