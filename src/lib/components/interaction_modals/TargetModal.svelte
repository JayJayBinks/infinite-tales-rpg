<script lang="ts">
	import type { Action, Targets } from '$lib/ai/agents/gameAgent';
	import { getNPCDisplayName } from '$lib/util.svelte';

	let {
		targets,
		action,
		onclose,
		dialogRef = $bindable()
	}: {
		targets: Targets;
		action: Action;
		onclose;
		dialogRef;
	} = $props();

	let targetForm;
	let customTargetState = $state();

	function mapTargets() {
		const mappedTargets = Array.from(targetForm.elements)
			.filter((elm) => elm.checked)
			.map((elm) => {
				elm.checked = false;
				if(typeof elm.value === 'string') {
					return { uniqueTechnicalNameId: undefined, displayName: elm.value };
				}
				return elm.value;
			});
		if (customTargetState) {
			mappedTargets.push({ uniqueTechnicalNameId: undefined, displayName: customTargetState });
		}
		customTargetState = undefined;
		return mappedTargets;
	}
</script>

<dialog bind:this={dialogRef} class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center">
		<form method="dialog">
			<span class="m-auto">Choose Targets</span>
			<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2">✕</button>
		</form>
		<form bind:this={targetForm} class="mt-3 flex flex-col items-start">
			<div class="form-control">
				<label class="label cursor-pointer">
					<input type="checkbox" class="checkbox" value="Self" />
					<span class="ml-2 capitalize">Self</span>
				</label>
			</div>
			<div class="form-control">
				<label class="label cursor-pointer">
					<input type="checkbox" class="checkbox" value={undefined} />
					<span class="ml-2 capitalize">No specific target</span>
				</label>
			</div>
			<span class="m-auto mt-3">Hostile:</span>
			{#if targets?.hostile?.length === 0}
				<span class="m-auto mt-2">-</span>
			{/if}
			{#each targets?.hostile as target}
				<div class="form-control">
					<label class="label cursor-pointer">
						<input type="checkbox" class="checkbox" value={target} />
						<span class="ml-2 capitalize"
							>{getNPCDisplayName(target).replaceAll('_', ' ').replaceAll('id', '')}</span
						>
					</label>
				</div>
			{/each}
			<span class="m-auto mt-3">Friendly:</span>
			{#if targets?.friendly?.length === 0}
				<span class="m-auto mt-2">-</span>
			{/if}
			{#each targets?.friendly as target}
				<div class="form-control">
					<label class="label cursor-pointer">
						<input type="checkbox" class="checkbox" value={target} />
						<span class="ml-2 capitalize"
							>{getNPCDisplayName(target).replaceAll('_', ' ').replaceAll('id', '')}</span
						>
					</label>
				</div>
			{/each}
			<span class="m-auto mt-3">Neutral:</span>
			{#if targets?.neutral?.length === 0}
				<span class="m-auto mt-2">-</span>
			{/if}
			{#each targets?.neutral as target}
				<div class="form-control">
					<label class="label cursor-pointer">
						<input type="checkbox" class="checkbox" value={target} />
						<span class="ml-2 capitalize"
							>{getNPCDisplayName(target).replaceAll('_', ' ').replaceAll('id', '')}</span
						>
					</label>
				</div>
			{/each}
			<div class="form-control mt-5 w-full items-center">
				<label for="customTargetState" class="capitalize">Custom Target</label>
				<input
					id="customTargetState"
					class="input input-bordered mt-3"
					bind:value={customTargetState}
					placeholder="Enter any target"
				/>
			</div>
			<button
				type="submit"
				class="btn btn-neutral m-auto mt-5"
				onclick={() => {
					dialogRef.close();
					onclose(action, mapTargets());
				}}
			>
				Continue
			</button>
		</form>
	</div>
</dialog>
