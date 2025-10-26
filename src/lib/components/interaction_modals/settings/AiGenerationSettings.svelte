<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { AIConfig } from '$lib';

	let { onclose }: { onclose?: () => void } = $props();

	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState', {
		disableImagesState: false,
		disableAudioState: false
	});
	const temperatureState = useLocalStorage<number>('temperatureState', 1);
	const aiLanguage = useLocalStorage<string>('aiLanguage', '');
</script>

<dialog open class="modal z-50" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center text-center">
		<h3 class="text-lg font-bold">AI Generation Settings</h3>

		<!-- Fallback is now always enabled automatically (removed toggle) -->

		<!-- Temperature -->
		<label class="form-control mt-5 w-full sm:w-2/3">
			Temperature: {temperatureState.value.toFixed(2)}
			<!-- Show formatted value -->
			<input
				type="range"
				min="0"
				max="2"
				step="0.05"
				id="temperature"
				bind:value={temperatureState.value}
				class="range range-info mt-2"
			/>
			<small class="m-auto mt-2 text-xs text-base-content/70">
				Higher temperature makes the AI more creative, but also errors more likely.
			</small>
		</label>

		<!-- AI Language -->
		<label class="form-control mt-5 w-full sm:w-2/3">
			AI Language
			<input
				bind:value={aiLanguage.value}
				placeholder="AI will respond in this language (e.g., 'fr', 'de', 'es'). Leave empty for English."
				class="input input-bordered mt-2"
			/>
			<small class="m-auto mt-2 text-xs text-base-content/70">
				The Game UI will not be translated yet. Ensure the AI supports the entered language code.
			</small>
		</label>

		<!-- Close Button -->
		<div class="modal-action mt-6">
			<button class="btn btn-info" onclick={onclose}>Close</button>
			<!-- No explicit "Save" needed as bind:value updates localStorage directly -->
		</div>
	</div>
	<!-- Optional: Click outside to close -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={onclose}>close</button>
	</form>
</dialog>
