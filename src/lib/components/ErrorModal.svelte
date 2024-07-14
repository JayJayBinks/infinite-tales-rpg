<div class="modal z-100" open style="background: rgba(0, 0, 0, 0.3);">
    <div class="modal-box flex flex-col items-center">
        <span>Error</span>
        <span class="mt-2 max-w-md">{errorState.userMessage}</span>
        <button class="btn btn-info mt-3"
                onclick={() => errorState.clear()}
        >
            Close
        </button>
    </div>
</div>

<script>
    import {errorState} from "$lib/state/errorState.svelte.ts";
</script>