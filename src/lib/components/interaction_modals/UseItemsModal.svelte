<script lang="ts">
	import TargetModal from '$lib/components/interaction_modals/TargetModal.svelte';
	import {
		type Action,
		GameAgent,
		type InventoryState,
		type Item,
		type Targets
	} from '$lib/ai/agents/gameAgent';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { formatItemId } from '../../../routes/game/gameLogic';

	let {
		inventoryState,
		playerName,
		storyImagePrompt,
		targets,
		onclose,
		dialogRef = $bindable()
	}: {
		inventoryState: InventoryState;
		playerName: string;
		storyImagePrompt: string;
		targets: Targets;
		onclose;
		dialogRef;
	} = $props();

	// eslint-disable-next-line svelte/valid-compile
	let targetModalRef;
	let action = $state({} as Action);

	function mapToAction(item_id: string, item: Item) {
		action = {
			...item,
			type: 'Misc.',
			characterName: playerName,
			text: playerName + ' uses ' + item_id + ': ' + item.effect
		};
	}
</script>

{#if targets}
	<TargetModal bind:dialogRef={targetModalRef} {targets} {action} {onclose}></TargetModal>
{/if}
<dialog bind:this={dialogRef} class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center">
		<form method="dialog">
			<span class="m-auto">Inventory</span>
			<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2">✕</button>
		</form>
		{#each Object.entries(inventoryState || {}) as [item_id, item] (item_id)}
			<label class="form-control mt-3 w-full">
				<details class="collapse collapse-arrow textarea-bordered border bg-base-200">
					<summary class="collapse-title capitalize">
						<div
							class="grid grid-cols-2 overflow-hidden overflow-ellipsis text-center sm:grid-cols-6"
						>
							<div class="m-auto sm:col-span-3">
								<AIGeneratedImage
									noLogo={true}
									enhance={false}
									imageClassesString="w-[90px] sm:w-[100px] h-[90px] sm:h-[100px] m-auto"
									imagePrompt={GameAgent.getItemImagePrompt(
										formatItemId(item_id),
										item,
										storyImagePrompt
									)}
									showGenerateButton={false}
								></AIGeneratedImage>
							</div>
							<div class="m-auto w-full sm:col-span-2">
								<p class="mt-2 overflow-hidden overflow-ellipsis capitalize">
									{formatItemId(item_id)}
								</p>
								<button
									type="button"
									class="components btn btn-neutral no-animation mt-2"
									onclick={() => {
										mapToAction(item_id, item);
										dialogRef.close();
										targetModalRef.showModal();
									}}
								>
									Use
								</button>
							</div>
						</div>
					</summary>
					<div class="collapse-content">
						<p class="m-5 mt-2">
							{item.effect}
						</p>
						<p class="m-5 mt-2">
							{item.description}
						</p>
					</div>
				</details>
			</label>
		{/each}
	</div>
</dialog>
