<script lang="ts">
	import {
		type Action,
		GameAgent,
		type InventoryState,
		type Item,
		type ItemWithId
	} from '$lib/ai/agents/gameAgent';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { formatItemId } from '../../../routes/game/gameLogic';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { AIConfig } from '$lib';

	let {
		inventoryState,
		onDeleteItem,
		playerName,
		storyImagePrompt,
		onclose,
		dialogRef = $bindable()
	}: {
		inventoryState: InventoryState;
		onDeleteItem: (item_id: string) => void;
		playerName: string;
		storyImagePrompt: string;
		onclose;
		dialogRef;
	} = $props();

	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');

	function mapToAction(item_id: string, item: Item): ItemWithId & Action {
		return {
			...item,
			item_id,
			type: 'Misc.',
			characterName: playerName,
			text: playerName + ' uses ' + item_id + ': ' + item.effect
		};
	}
</script>

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
							class:sm:grid-cols-6={!aiConfigState.value?.disableImagesState}
							class="grid grid-cols-1 overflow-hidden overflow-ellipsis text-center"
						>
							<div class="m-auto sm:col-span-3">
								{#if !aiConfigState.value?.disableImagesState}
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
								{/if}
							</div>
							<div class="m-auto w-full sm:col-span-2">
								<p class="mt-2 overflow-hidden overflow-ellipsis capitalize">
									{formatItemId(item_id)}
								</p>
								<button
									type="button"
									class="components btn btn-neutral no-animation mt-2"
									onclick={() => {
										dialogRef.close();
										onclose(mapToAction(item_id, item));
									}}
								>
									Suggest Actions
								</button>
							</div>
						</div>
					</summary>
					<div class="collapse-content flex flex-col items-center justify-center">
						<p class="m-5 mt-2">
							{item.effect}
						</p>
						<p class="m-5 mt-2">
							{item.description}
						</p>
						<button
							class="components btn btn-error no-animation btn-sm m-auto mt-2"
							onclick={() => onDeleteItem(item_id)}
						>
							Delete
						</button>
					</div>
				</details>
			</label>
		{/each}
	</div>
</dialog>
