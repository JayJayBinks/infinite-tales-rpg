<script>
    import LoadingIcon from "$lib/components/LoadingIcon.svelte";

    let {loadingText = 'Asking the AI'} = $props();
</script>

<div class="modal z-999" open style="background: rgba(0, 0, 0, 0.3);">
    <div class="modal-box flex flex-col items-center">
        <LoadingIcon/>
        <span class="mt-2">{loadingText}</span>
    </div>
</div>