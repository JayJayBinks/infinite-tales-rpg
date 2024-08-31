<script>
    let {onclose, abilities, currentMP, dialogRef = $bindable()} = $props();

    function mapAbilityToAction(ability) {
        return {
            ...ability, type: 'Spell', text: 'I cast ' + ability.name + ": " + ability.effect + " (" + ability.mp_cost + " MP)",
            action_difficulty: ability.difficulty
        };
    }
</script>

<dialog bind:this={dialogRef} class="modal z-100" style="background: rgba(0, 0, 0, 0.3);">
    <div class="modal-box flex flex-col items-center">
        <form method="dialog">
            <span class="m-auto">Spells & Abilities</span>
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        {#each abilities as ability, i}
            <label class="form-control w-full mt-3">
                <details class="collapse collapse-arrow bg-base-200 border textarea-bordered">
                    <summary class="collapse-title capitalize">
                        <div class="flex flex-col items-center text-center">
                            <span class="badge badge-info">{ability.mp_cost} MP</span>
                            <span class="mt-2">{ability.name}</span>
                            <button class="btn btn-neutral mt-2"
                                    disabled={ability.mp_cost > currentMP}
                                    onclick="{() => {dialogRef.close(); onclose(mapAbilityToAction(ability))}}">
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