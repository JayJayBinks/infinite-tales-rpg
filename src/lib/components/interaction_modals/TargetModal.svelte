<script lang="ts">
	import type { Action, Targets } from '$lib/ai/agents/gameAgent';
	import { getNPCDisplayName } from '$lib/util.svelte';
	import type { Party } from '$lib/types/party';

	let {
		targets,
		action,
		onclose,
		dialogRef = $bindable(),
		party
	}: {
		targets: Targets;
		action: Action;
		onclose;
		dialogRef;
		party?: Party;
	} = $props();

	let targetForm: HTMLFormElement | undefined;
	let customTargetState = $state<string>();

	function mapTargets(): string[] {
		if (!targetForm) {
			const result = customTargetState ? [customTargetState] : [];
			customTargetState = undefined;
			return result;
		}
		const mappedTargets = Array.from(targetForm.elements)
			.filter((elm): elm is HTMLInputElement => elm instanceof HTMLInputElement && elm.type === 'checkbox')
			.filter((elm) => elm.checked && elm.value)
			.map((elm) => {
				elm.checked = false;
				return elm.value as string;
			});
		if (customTargetState) {
			mappedTargets.push(customTargetState);
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
			{#if party && party.members.length > 0}
				<span class="m-auto mt-3 font-bold">Party Members:</span>
				{#each party.members as member}
					<div class="form-control">
						<label class="label cursor-pointer">
							<input type="checkbox" class="checkbox" value={member.character.name} />
							<span class="ml-2 capitalize">{member.character.name}</span>
						</label>
					</div>
				{/each}
			{/if}
			<div class="form-control">
				<label class="label cursor-pointer">
					<input type="checkbox" class="checkbox" value={''} />
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
						<input type="checkbox" class="checkbox" value={getNPCDisplayName(target)} />
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
						<input type="checkbox" class="checkbox" value={getNPCDisplayName(target)} />
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
						<input type="checkbox" class="checkbox" value={getNPCDisplayName(target)} />
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
