<script>
    let {targets, abilityActionState, onclose, dialogRef = $bindable()} = $props();
    let targetForm;
    let customTargetState = $state();

    function mapTargets() {
        const mappedTargets = Array.from(targetForm.elements).filter(elm => elm.checked).map(elm => {
            elm.checked = false;
            return elm.value;
        });
        if (customTargetState) {
            mappedTargets.push(customTargetState);
        }
        customTargetState = undefined;
        return mappedTargets;
    }
</script>

<dialog bind:this={dialogRef} class="modal z-100" style="background: rgba(0, 0, 0, 0.3);">
    <div class="modal-box flex flex-col items-center">
        <form method="dialog">
            <span class="m-auto">Choose Targets</span>
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <form bind:this={targetForm} class="mt-3 flex flex-col items-start">
            <div class="form-control">
                <label class="label cursor-pointer">
                    <input type="checkbox" class="checkbox" value="Self"/>
                    <span class="capitalize  ml-2">Self</span>
                </label>
            </div>
            <div class="form-control">
                <label class="label cursor-pointer">
                    <input type="checkbox" class="checkbox" value="No specific target"/>
                    <span class="capitalize ml-2">No specific target</span>
                </label>
            </div>
            <span class="m-auto mt-3">Hostile:</span>
            {#if targets?.hostile?.length === 0}
                <span class="m-auto mt-2">-</span>
            {/if}
            {#each targets?.hostile as target, i}
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <input type="checkbox" class="checkbox" value={target}/>
                        <span class="capitalize ml-2">{target.toLowerCase().replaceAll("_", " ").replaceAll("id", "")}</span>
                    </label>
                </div>
            {/each}
            <span class="m-auto mt-3">Friendly:</span>
            {#if targets?.friendly?.length === 0}
                <span class="m-auto mt-2">-</span>
            {/if}
            {#each targets?.friendly as target, i}
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <input type="checkbox" class="checkbox" value={target}/>
                        <span class="capitalize ml-2">{target.toLowerCase().replaceAll("_", " ").replaceAll("id", "")}</span>
                    </label>
                </div>
            {/each}
            <span class="m-auto mt-3">Neutral:</span>
            {#if targets?.neutral?.length === 0}
                <span class="m-auto mt-2">-</span>
            {/if}
            {#each targets?.neutral as target, i}
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <input type="checkbox" class="checkbox" value={target}/>
                        <span class="capitalize ml-2">{target.toLowerCase().replaceAll("_", " ").replaceAll("id", "")}</span>
                    </label>
                </div>
            {/each}
            <div class="form-control items-center mt-5 w-full">
                <label for="customTargetState" class="capitalize">Custom Target</label>
                <input id="customTargetState" class="input input-bordered mt-3" bind:value={customTargetState}
                       placeholder="Enter any target">
            </div>
            <button type="submit" class="btn btn-neutral mt-5 m-auto"
                    onclick="{() => {dialogRef.close(); onclose(abilityActionState, mapTargets())}}">
                Continue
            </button>
        </form>
    </div>
</dialog>
