<script>
    let disclaimer;
    let {disclaimerOpen, onAgree} = $props();
</script>

<dialog bind:this={disclaimer} open={disclaimerOpen} class="modal z-100" style="background: rgba(0, 0, 0, 0.3);">
    <div class="modal-box flex flex-col items-center">
        <span>Disclaimer</span>
        <span> AI-Generated Content</span>
        <span class="mt-2">This game allows you to customize settings to shape your experience.
                However, please be aware that the AI-generated content may still produce unexpected or inappropriate material, including content that may not be suitable for all audiences.
                While you can minimize exposure to certain content through your settings, complete avoidance cannot be guaranteed.</span>
        <span class="mt-2">By playing this game, you acknowledge and accept the potential for such content and agree to proceed at your own discretion.
                The developers are not responsible for any distress or offense caused by AI-generated material.</span>
        <span class="mt-2">Age Restriction</span>
        <span class="mt-2">This game is intended for players aged 18 and above. Please ensure that younger users are supervised while playing.</span>
        <span class="mt-2">Privacy Notice</span>
        <span class="mt-2">This game does not collect, store, or share any personal data. No cookies or tracking technologies are used.</span>


        <button class="btn btn-info mt-3"
                onclick={() => {disclaimer.close(); onAgree();}}
        >
            I Agree
        </button>
    </div>
</dialog>