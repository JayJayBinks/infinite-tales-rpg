<script>
    let {onclose, abilities, dialogRef = $bindable()} = $props();

    function mapAbilityToAction(ability) {
        return {
            ...ability, type: 'Spell', text: 'I cast ' + ability.name + ": " + ability.effect + " (" + ability.mp_cost + " MP)",
            action_difficulty: ability.difficulty
        };
    }
</script>

<dialog bind:this={dialogRef} class="modal z-100" style="background: rgba(0, 0, 0, 0.3);">
    <div class="modal-box flex flex-col items-center">
        {#each abilities as ability, i}
            <label class="form-control w-full mt-3">
                <details class="collapse collapse-arrow bg-base-200 border textarea-bordered">
                    <summary class="collapse-title capitalize">
                        <span>{ability.name}</span>
                        <span class="badge badge-info">MP {ability.mp_cost}</span>
                        <button class="btn btn-neutral mt-5 m-auto"
                                onclick="{() => {dialogRef.close(); onclose(mapAbilityToAction(ability))}}">
                            Use
                        </button>
                    </summary>
                    <div className="collapse-content">
                        <p class="m-5 mt-2">
                            {ability.effect}
                        </p>
                    </div>
                </details>
            </label>
        {/each}
    </div>
</dialog>