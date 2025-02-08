<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

	let {
		dialogRef = $bindable()
	}: {
		dialogRef;
	} = $props();

	const disableStoryImagesState = useLocalStorage<boolean>('disableStoryImagesState', false);
	const disableCharacterImagesState = useLocalStorage<boolean>('disableCharacterImagesState', false);
	const disableAbilityImagesState = useLocalStorage<boolean>('disableAbilityImagesState', false);
	const disableItemImagesState = useLocalStorage<boolean>('disableItemImagesState', false);
	const disableImagesState = useLocalStorage<boolean>('disableImagesState', false);

	let isInitialized = $state(false);

	$effect(() => {
		if (!isInitialized) {
			// Initialize individual states based on main toggle
			if (disableImagesState.value) {
				disableStoryImagesState.value = true;
				disableCharacterImagesState.value = true;
				disableAbilityImagesState.value = true;
				disableItemImagesState.value = true;
			}
			isInitialized = true;
		}
	});

	function handleMainToggle(checked: boolean) {
		disableImagesState.value = checked;
		disableStoryImagesState.value = checked;
		disableCharacterImagesState.value = checked;
		disableAbilityImagesState.value = checked;
		disableItemImagesState.value = checked;
	}

	function handleClose() {
		dialogRef?.close();
	}
</script>

<dialog bind:this={dialogRef} class="modal z-100" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center">
		<div class="flex w-full items-center justify-between">
			<span class="font-bold">Image Generation Settings</span>
			<button class="btn btn-circle btn-ghost btn-sm" onclick={handleClose}>✕</button>
		</div>

		<div class="w-full max-w-md">
			<label class="form-control mt-5 w-full">
				<div class="flex items-center justify-between">
					<span>Story & Scene Images</span>
					<input
						type="checkbox"
						class="toggle toggle-accent"
						bind:checked={disableStoryImagesState.value}
						disabled={disableImagesState.value}
					/>
				</div>
				<small class="mt-1 text-left">Images generated for story events and scenes</small>
			</label>

			<label class="form-control mt-5 w-full">
				<div class="flex items-center justify-between">
					<span>Character Portrait</span>
					<input
						type="checkbox"
						class="toggle toggle-accent"
						bind:checked={disableCharacterImagesState.value}
						disabled={disableImagesState.value}
					/>
				</div>
				<small class="mt-1 text-left">Character portrait image on character page</small>
			</label>

			<label class="form-control mt-5 w-full">
				<div class="flex items-center justify-between">
					<span>Ability & Spell Icons</span>
					<input
						type="checkbox"
						class="toggle toggle-accent"
						bind:checked={disableAbilityImagesState.value}
						disabled={disableImagesState.value}
					/>
				</div>
				<small class="mt-1 text-left">Icons for spells and abilities</small>
			</label>

			<label class="form-control mt-5 w-full">
				<div class="flex items-center justify-between">
					<span>Item Icons</span>
					<input
						type="checkbox"
						class="toggle toggle-accent"
						bind:checked={disableItemImagesState.value}
						disabled={disableImagesState.value}
					/>
				</div>
				<small class="mt-1 text-left">Icons for inventory items</small>
			</label>

			<div class="divider mt-7">Global Setting</div>

			<label class="form-control mt-3 w-full">
				<div class="flex items-center justify-between">
					<span class="font-bold">Disable All Image Generation</span>
					<input
						type="checkbox"
						class="toggle toggle-accent"
						bind:checked={disableImagesState.value}
						onchange={(e) => handleMainToggle(e.currentTarget.checked)}
					/>
				</div>
				<small class="mt-1 text-left">Turn off all image generation features</small>
			</label>
		</div>
	</div>
</dialog> 