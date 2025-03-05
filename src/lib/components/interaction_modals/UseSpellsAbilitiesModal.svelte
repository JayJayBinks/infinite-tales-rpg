<script lang="ts">
	import TargetModal from '$lib/components/interaction_modals/TargetModal.svelte';
	import { type Ability, CharacterStatsAgent } from '$lib/ai/agents/characterStatsAgent';
	import type { Action, ResourcesWithCurrentValue, Targets } from '$lib/ai/agents/gameAgent';
	import AIGeneratedImage from '$lib/components/AIGeneratedImage.svelte';
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import type { AIConfig } from '$lib';

	let {
		abilities,
		playerName,
		storyImagePrompt,
		resources,
		targets,
		onclose,
		dialogRef = $bindable()
	}: {
		abilities: Array<Ability>;
		playerName: string;
		storyImagePrompt: string;
		resources: ResourcesWithCurrentValue;
		targets: Targets;
		onclose;
		dialogRef;
	} = $props();

	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	// eslint-disable-next-line svelte/valid-compile
	let targetModalRef;
	let abilityActionState = $state({} as Action);

	function mapAbilityToAction(ability: Ability) {
		abilityActionState = {
			characterName: playerName,
			...ability,
			type: 'Spell',
			text:
				playerName +
				' casts ' +
				ability.name +
				': ' +
				ability.effect
		};
	}
</script>

{#if targets}
	<TargetModal bind:dialogRef={targetModalRef} {targets} action={abilityActionState} {onclose}
	></TargetModal>
{/if}
<dialog bind:this={dialogRef} class="z-100 modal" style="background: rgba(0, 0, 0, 0.3);">
	<div class="modal-box flex flex-col items-center">
		<form method="dialog">
			<span class="m-auto">Spells & Abilities</span>
			<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2">✕</button>
		</form>
		{#each abilities as ability (ability.name)}
			<label class="form-control mt-3 w-full">
				<details class="collapse collapse-arrow textarea-bordered border bg-base-200">
					<summary class="collapse-title capitalize">
						<div class="flex flex-col h-full justify-between text-center">
							<!-- Top: Badge always at the top -->
							<div>
								{#if ability.resource_cost?.cost > 0}
									<p class="badge badge-info h-fit break-all overflow-auto">
										{ability.resource_cost?.cost} {(ability.resource_cost?.resource_key || '').replaceAll('_', ' ')}
									</p>
								{/if}
							</div>

							<!-- Middle: Image (if enabled) and ability name -->
							<div class="flex flex-col mt-3 items-center">
								{#if !aiConfigState.value?.disableImagesState}
									<AIGeneratedImage
										noLogo={true}
										enhance={false}
										imageClassesString="w-[90px] sm:w-[100px] h-[90px] sm:h-[100px] m-auto"
										imagePrompt={CharacterStatsAgent.getSpellImagePrompt(ability, storyImagePrompt)}
										showGenerateButton={false}
									/>
								{/if}
								<p class="mt-2 overflow-hidden overflow-ellipsis">{ability.name}</p>
							</div>

							<!-- Bottom: Cast Button always at the bottom -->
							<div>
								<button
									type="button"
									class="components btn btn-neutral no-animation mt-2"
									disabled={ability.resource_cost?.cost > 0 && ability.resource_cost?.cost > resources[ability.resource_cost?.resource_key || '']?.current_value}
									onclick={() => {
        mapAbilityToAction(ability);
        dialogRef.close();
        targetModalRef.showModal();
      }}
								>
									Cast
								</button>
							</div>
						</div>

					</summary>
					<div class="collapse-content">
						<p class="m-5 mt-2">
							{ability.effect}
						</p>
					</div>
				</details>
			</label>
		{/each}
	</div>
</dialog>
