<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	let {
		dialogRef = $bindable()
	}: {
		dialogRef;
	} = $props();

	const disableStoryAudioState = useLocalStorage<boolean>('disableStoryAudioState', false);
	const disableVoiceTestState = useLocalStorage<boolean>('disableVoiceTestState', false);
	const disableAudioState = useLocalStorage<boolean>('disableAudioState', false);

	let isInitialized = $state(false);

	$effect(() => {
		if (!isInitialized) {
			// Initialize individual states based on main toggle
			if (disableAudioState.value) {
				disableStoryAudioState.value = true;
				disableVoiceTestState.value = true;
			}
			isInitialized = true;
		}
	});

	function handleMainToggle(checked: boolean) {
		disableAudioState.value = checked;
		disableStoryAudioState.value = checked;
		disableVoiceTestState.value = checked;
	}

	function handleClose() {
		dialogRef?.close();
	}
</script>

<dialog bind:this={dialogRef} class="modal z-100" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center">
		<div class="flex w-full items-center justify-between">
			<span class="font-bold">Audio Generation Settings</span>
			<button class="btn btn-circle btn-ghost btn-sm" onclick={handleClose}>✕</button>
		</div>

		<div class="w-full max-w-md">
			<label class="form-control mt-5 w-full">
				<div class="flex items-center justify-between">
					<span>Story & Scene Audio</span>
					<input
						type="checkbox"
						class="toggle toggle-accent"
						bind:checked={disableStoryAudioState.value}
						disabled={disableAudioState.value}
					/>
				</div>
				<small class="mt-1 text-left">Text-to-speech for story events and scenes</small>
			</label>

			<label class="form-control mt-5 w-full">
				<div class="flex items-center justify-between">
					<span>Voice Test</span>
					<input
						type="checkbox"
						class="toggle toggle-accent"
						bind:checked={disableVoiceTestState.value}
						disabled={disableAudioState.value}
					/>
				</div>
				<small class="mt-1 text-left">Voice test feature in settings</small>
			</label>

			<div class="divider mt-7">Global Setting</div>

			<label class="form-control mt-3 w-full">
				<div class="flex items-center justify-between">
					<span class="font-bold">Disable All Audio Generation</span>
					<input
						type="checkbox"
						class="toggle toggle-accent"
						bind:checked={disableAudioState.value}
						onchange={(e) => handleMainToggle(e.currentTarget.checked)}
					/>
				</div>
				<small class="mt-1 text-left">Turn off all audio generation features</small>
			</label>
		</div>
	</div>
</dialog> 