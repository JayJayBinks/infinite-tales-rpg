<!-- src/lib/components/OutputFeaturesModal.svelte -->
<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { AIConfig } from '$lib'; // Assuming AIConfig defines disableImagesState, disableAudioState
	import type { Voice } from 'msedge-tts';
	import { onMount } from 'svelte';
	import { playAudioFromStream } from '$lib/util.svelte';

	let { onclose }: { onclose: () => void } = $props();

	// --- State Management ---
	// Assuming a default structure for AIConfig
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState', {
		useFallbackLlmState: false,
		disableImagesState: false,
		disableAudioState: false
	});
	const ttsVoiceState = useLocalStorage<string>('ttsVoice');
	let ttsVoices: Voice[] = $state([]);

	onMount(async () => {
		ttsVoices = (await (await fetch('/api/edgeTTSStream/voices')).json()).sort((a, b) =>
			a.Locale === b.Locale ? 0 : a.Locale.includes(navigator.language) ? -1 : 1
		);
	});
</script>

<dialog open class="modal z-50" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center text-center">
		<h3 class="text-lg font-bold">Output Features & Media Settings</h3>

		<!-- Disable Image Generation -->
		<label class="form-control mt-5 w-full sm:w-2/3">
			<div class="flex flex-col items-center gap-2">
				<span>Disable Image Generation</span>
				<input
					type="checkbox"
					class="toggle toggle-info"
					bind:checked={aiConfigState.value.disableImagesState}
				/>
			</div>
		</label>

		<!-- Disable Text To Speech Generation -->
		<label class="form-control mt-5 w-full sm:w-2/3">
			<div class="flex flex-col items-center gap-2">
				<span>Disable Text To Speech Generation</span>
				<input
					type="checkbox"
					class="toggle toggle-info"
					bind:checked={aiConfigState.value.disableAudioState}
				/>
			</div>
		</label>

		<!-- Voice For Text To Speech (Only show if TTS is enabled) -->
		{#if !aiConfigState.value.disableAudioState}
			<label class="form-control mt-5 w-full sm:w-1/2">
				<p class="mb-2">Voice For Text To Speech</p>
				<!-- Dropdown -->
				<select bind:value={ttsVoiceState.value} class="select select-bordered w-full text-center">
					{#each ttsVoices as v (v.ShortName)}
						<option value={v.ShortName}>{v.FriendlyName} - {v.Gender}</option>
					{/each}
				</select>
				<!-- Test Button -->
				<button
					class="btn btn-outline btn-sm mt-3"
					onclick={() => {
						playAudioFromStream("Let's embark on an epic adventure!", ttsVoiceState.value);
					}}
					>Test Voice
				</button>
			</label>
		{/if}

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
