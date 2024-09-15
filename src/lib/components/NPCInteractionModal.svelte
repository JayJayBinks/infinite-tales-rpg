<script>
    import TargetModal from "$lib/components/TargetModal.svelte";

    let {targets, onclose, dialogRef = $bindable()} = $props();
    let actionModalRef;
    let chosenTargets = $state([]);
    const availableActions = [
        {renderedText: 'Start Conversation', text: 'I start a conversation'},
        {renderedText: 'Attack', text: 'I attack'}]

    function onTargetsChosen(ability, targets) {
        chosenTargets = targets;
        actionModalRef.showModal();
    }
</script>

{#if targets}
    <TargetModal bind:dialogRef={dialogRef} {targets} onclose={onTargetsChosen}/>
{/if}
    <dialog bind:this={actionModalRef} class="modal z-100" style="background: rgba(0, 0, 0, 0.3);">
        <div class="modal-box flex flex-col items-center">
            <form method="dialog">
                <span class="m-auto">Interact with NPC</span>
                <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>
            {#each availableActions as action, i}
                <label class="form-control w-full mt-3">
                    <button type="button" class="btn btn-neutral mt-2 components"
                            onclick="{() => {actionModalRef.close(); onclose(action, chosenTargets)}}">
                        {action.renderedText}
                    </button>
                </label>
            {/each}
        </div>
    </dialog>
