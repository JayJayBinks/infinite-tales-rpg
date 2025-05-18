<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { difficultyDiceRollModifier } from '../dice/diceRollLogic';

	let { onclose }: { onclose?: () => void } = $props();

	const difficultyState = useLocalStorage<string>('difficultyState', 'Default');
	const useKarmicDice = useLocalStorage<boolean>('useKarmicDice', true);
</script>

<dialog open class="modal z-50" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center text-center">
		<h3 class="text-lg font-bold">Game Settings</h3>
		<label class="form-control mt-5 w-full sm:w-2/3">
			<div class="flex flex-col items-center gap-2">
				<span>Difficulty</span>
				<select
					id="difficultyState"
					bind:value={difficultyState.value}
					class="select select-bordered mt-2 text-center"
				>
					<option selected>Default</option>
					<option>Easy</option>
				</select>
				<small class="m-auto mt-2 text-xs text-base-content/70">
					Easy will reduce required dice rolls by {difficultyDiceRollModifier.Easy}
				</small>
			</div>
		</label>

		<label class="form-control mt-5 w-full sm:w-2/3">
			<span>Karmic Dice</span>
			<input
				type="checkbox"
				id="useKarmicDice"
				bind:checked={useKarmicDice.value}
				class="toggle m-auto mt-2 text-center"
			/>
			<small class="m-auto mt-2 text-xs text-base-content/70">
				If 3 consecutive dice rolls fail, you will get a bonus on the next roll
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
