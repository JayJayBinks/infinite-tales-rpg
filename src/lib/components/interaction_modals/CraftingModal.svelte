<script lang="ts">
	import type { InventoryState, ItemWithId } from '$lib/ai/agents/gameAgent';
	import { formatItemId } from '../../../routes/game/gameLogic';

	let {
		inventory,
		onclose
	}: {
		inventory: InventoryState; // Pass the player's inventory here
		onclose: (selectedItems: ItemWithId[], craftDescription: string) => void;
	} = $props();

	let itemForm;
	let craftDescription = $state<string>('');

	function mapSelectedItems(): ItemWithId[] {
		const selectedItemIds = Array.from(itemForm.elements)
			.filter((elm) => elm.checked && elm.value)
			.map((elm) => {
				elm.checked = false; // Uncheck after selection
				return elm.value as string;
			});

		// Find the actual Item objects based on selected ids
		return Object.entries(inventory)
			.filter(([itemId]) => selectedItemIds.includes(itemId))
			.map(([itemId, item]) => ({
				...item,
				item_id: itemId
			}));
	}

	function handleCraft() {
		const selectedItems = mapSelectedItems();
		onclose(selectedItems, craftDescription);
		craftDescription = ''; // Reset description
	}
</script>

<dialog open class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center">
		<span class="m-auto">Choose Items to Craft With</span>
		<span class="m-auto">On failure the selected items will be lost!</span>
		<button
			class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2"
			onclick={() => {
				itemForm.reset();
				onclose([], craftDescription);
			}}>✕</button
		>
		<form bind:this={itemForm} class="mt-3 flex w-full flex-col items-start">
			<span class="m-auto mt-3">Inventory:</span>
			{#if Object.keys(inventory)?.length === 0}
				<span class="m-auto mt-2">Inventory is empty.</span>
			{/if}
			{#each Object.keys(inventory) as item}
				<div class="form-control items-center">
					<label class="label cursor-pointer">
						<input type="checkbox" class="checkbox" value={item} />
						<span class="ml-2 capitalize">{formatItemId(item)}</span>
					</label>
				</div>
			{/each}

			<div class="form-control mt-5 w-full items-center">
				<label for="craftDescription" class="capitalize">Crafting Instructions</label>
				<input
					id="craftDescription"
					class="input input-bordered mt-3 w-full"
					bind:value={craftDescription}
					placeholder="e.g. 'Make a light source'"
				/>
			</div>

			<button type="button" class="btn btn-neutral m-auto mt-5" onclick={handleCraft}>
				Craft
			</button>
		</form>
	</div>
</dialog>
