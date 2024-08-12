<dialog bind:this={dialog} {onclose} class="modal z-100" open style="background: rgba(0, 0, 0, 0.3);">
    <div class="modal-box flex flex-col flex-wrap items-center">
        <span>Error</span>
        <span class="mt-2 max-w-md">{errorState.userMessage}</span>
        <button class="btn btn-info mt-3"
                onclick={() => {dialog.close(); errorState.clear();}}
        >
            Close
        </button>
    </div>
</dialog>

<script>
    import {errorState} from "$lib/state/errorState.svelte.ts";
    let dialog;
    let { onclose } = $props();
</script>