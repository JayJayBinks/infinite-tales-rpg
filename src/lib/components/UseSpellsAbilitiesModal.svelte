<script lang="ts">
    import TargetModal from "$lib/components/TargetModal.svelte";
    import type {Ability} from "$lib/ai/agents/characterStatsAgent";
    import type {Action, Targets} from "$lib/ai/agents/gameAgent";

    let {abilities, currentMP, targets, onclose, dialogRef = $bindable()}: {
        abilities: Array<Ability>,
        currentMP: number,
        targets: Targets,
        onclose,
        dialogRef
    } = $props();

    // eslint-disable-next-line svelte/valid-compile
    let targetModalRef;
    let abilityActionState = $state({} as Action);

    function mapAbilityToAction(ability: Ability) {
        abilityActionState = {
            ...ability,
            type: 'Spell',
            text: 'I cast ' + ability.name + ": " + ability.effect + " (" + ability.mp_cost + " MP)"
        };
    }
</script>

{#if targets}
    <TargetModal bind:dialogRef={targetModalRef} {targets} {abilityActionState} {onclose}></TargetModal>
{/if}
<dialog bind:this={dialogRef} class="modal z-100" style="background: rgba(0, 0, 0, 0.3);">
    <div class="modal-box flex flex-col items-center">
        <form method="dialog">
            <span class="m-auto">Spells & Abilities</span>
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        {#each abilities as ability}
            <label class="form-control w-full mt-3">
                <details class="collapse collapse-arrow bg-base-200 border textarea-bordered">
                    <summary class="collapse-title capitalize">
                        <div class="flex flex-col items-center text-center">
                            <span class="badge badge-info">{ability.mp_cost} MP</span>
                            <span class="mt-2">{ability.name}</span>
                            <button type="button" class="btn btn-neutral mt-2 components"
                                    disabled={ability.mp_cost > 0 && ability.mp_cost > currentMP}
                                    onclick="{() => {mapAbilityToAction(ability); dialogRef.close(); targetModalRef.showModal(); }}">
                                Cast
                            </button>
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