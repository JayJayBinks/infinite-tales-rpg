<script lang="ts">
	import DiceBox from '@3d-dice/dice-box';
	import * as diceRollLogic from './diceRollLogic';
	import type { Action } from '$lib/ai/agents/gameAgent';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import { onMount } from 'svelte';

	type Props = { diceRollDialog; action: Action; resetState: boolean };
	let { diceRollDialog = $bindable(), action, resetState }: Props = $props();

	const rolledValueState = useLocalStorage('rolledValueState');
	const rollDifferenceHistoryState = useLocalStorage('rollDifferenceHistoryState', []);
	const difficultyState = useLocalStorage('difficultyState', 'Default');
	const useKarmicDice = useLocalStorage('useKarmicDice', true);
	const diceRollRequiredValueState = useLocalStorage('diceRollRequiredValueState');
	let modifierReasonState = $derived(action?.dice_roll?.modifier_explanation);
	let modifierState = $derived(
		Number.parseInt(action?.dice_roll?.modifier_value as unknown as string) || 0
	);
	let karmaModifierState = $derived(
		!useKarmicDice.value
			? 0
			: diceRollLogic.getKarmaModifier(
					rollDifferenceHistoryState.value,
					diceRollRequiredValueState.value
				)
	);
	let diceRollResultState = $derived(
		diceRollLogic.determineDiceRollResult(
			diceRollRequiredValueState.value,
			rolledValueState.value,
			modifierState + karmaModifierState
		)
	);
	let isMounted = $state(false);

	$effect(() => {
		if (resetState) {
			rolledValueState.reset();
			diceRollRequiredValueState.reset();
		}
	});
	$effect(() => {
		if (isMounted && action && !diceRollRequiredValueState.value && !resetState) {
			if (action.is_possible === false) {
				rollDifferenceHistoryState.reset();
				diceRollRequiredValueState.value = 20;
			} else {
				diceRollRequiredValueState.value = diceRollLogic.getRequiredValue(
					action?.action_difficulty,
					difficultyState.value
				);
			}
		}
	});
	let diceBox;
	onMount(() => {
		diceBox = new DiceBox('#dice-box', {
			assetPath: '/assets/dice-box/' // required
		});
		diceBox.init();
		isMounted = true;
	});

	function getRollResult() {
		return `${rolledValueState.value || '?'}  + ${modifierState + karmaModifierState} = ${rolledValueState.value + modifierState + karmaModifierState || '?'}`;
	}

	let onRoll = (evt) => {
		//for easy testing rolledValueState.value = getRandomInteger(1, 20);
		evt.currentTarget.disabled = true;
		diceBox.roll('1d20').then((results) => {
			rolledValueState.value = results[0].value;
		});
	};

	const onClose = () => {
		diceBox.clear();
		diceRollDialog.close($state.snapshot(diceRollResultState));
		rollDifferenceHistoryState.value = [
			...rollDifferenceHistoryState.value.slice(-2),
			rolledValueState.value + modifierState + karmaModifierState - diceRollRequiredValueState.value
		];
	};
</script>

<div id="dice-box" class="pointer-events-none fixed inset-0 z-30"></div>
<dialog
	bind:this={diceRollDialog}
	id="dice-rolling-dialog"
	class="modal z-20"
	style="background: rgba(0, 0, 0, 0.3);"
>
	<div class="modal-box flex flex-col items-center text-center">
		<p class="mt-3 text-xl">Difficulty class:</p>
		<output id="dice-roll-difficulty" class="text-xl font-semibold"
			>{diceRollRequiredValueState.value}</output
		>
		{#if action.is_custom_action}
			<output>{action.plausibility}</output>
			<output>{action.difficulty_explanation}</output>
			<output class="font-semibold"
				>This action will cost <p class="text-blue-500">{action.mp_cost} MP</p></output
			>
		{/if}
		<button
			id="roll-dice-button"
			class="btn btn-ghost m-3"
			disabled={!!rolledValueState.value}
			onclick={onRoll}
		>
			<div class="flex flex-col items-center justify-center">
				<svg
					fill="black"
					class:fill-green-700={diceRollResultState?.includes('success')}
					class:fill-red-700={diceRollResultState?.includes('failure')}
					class="mb-3 h-1/3 w-1/3"
					viewBox="-16 0 512 512"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M106.75 215.06L1.2 370.95c-3.08 5 .1 11.5 5.93 12.14l208.26 22.07-108.64-190.1zM7.41 315.43L82.7 193.08 6.06 147.1c-2.67-1.6-6.06.32-6.06 3.43v162.81c0 4.03 5.29 5.53 7.41 2.09zM18.25 423.6l194.4 87.66c5.3 2.45 11.35-1.43 11.35-7.26v-65.67l-203.55-22.3c-4.45-.5-6.23 5.59-2.2 7.57zm81.22-257.78L179.4 22.88c4.34-7.06-3.59-15.25-10.78-11.14L17.81 110.35c-2.47 1.62-2.39 5.26.13 6.78l81.53 48.69zM240 176h109.21L253.63 7.62C250.5 2.54 245.25 0 240 0s-10.5 2.54-13.63 7.62L130.79 176H240zm233.94-28.9l-76.64 45.99 75.29 122.35c2.11 3.44 7.41 1.94 7.41-2.1V150.53c0-3.11-3.39-5.03-6.06-3.43zm-93.41 18.72l81.53-48.7c2.53-1.52 2.6-5.16.13-6.78l-150.81-98.6c-7.19-4.11-15.12 4.08-10.78 11.14l79.93 142.94zm79.02 250.21L256 438.32v65.67c0 5.84 6.05 9.71 11.35 7.26l194.4-87.66c4.03-1.97 2.25-8.06-2.2-7.56zm-86.3-200.97l-108.63 190.1 208.26-22.07c5.83-.65 9.01-7.14 5.93-12.14L373.25 215.06zM240 208H139.57L240 383.75 340.43 208H240z"
					/>
				</svg>
				Click to roll
			</div>
		</button>

		<p>Result:</p>
		<output id="dice-roll-result" class="mt-2">{getRollResult()}</output>
		<output>{diceRollResultState}</output>
		<button
			onclick={onClose}
			id="dice-rolling-dialog-continue"
			disabled={!rolledValueState.value}
			class="btn btn-neutral m-3"
			>Continue
		</button>
		{#if karmaModifierState > 0}
			<output id="Karma" class="mt-2">Karma Modifier: {karmaModifierState}</output>
		{/if}
		<output id="modifier" class="mt-2">Modifier: {modifierState}</output>
		<p>Reason:</p>
		<output id="modifier-reason" class="mt-2">{modifierReasonState}</output>
		<br />
	</div>
</dialog>
