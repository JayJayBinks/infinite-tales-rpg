<script>
    let disclaimer;
    let {disclaimerOpen = false, onAgree} = $props();
</script>

<dialog bind:this={disclaimer} open={disclaimerOpen} class="modal z-100" style="background: rgba(0, 0, 0, 0.3);">
    <div class="modal-box flex flex-col items-center">
        <span class="text-xl">Disclaimer</span>
        <span class="mt-2 font-semibold"> AI-Generated Content</span>
        <span class="mt-2">Please be aware that the AI-generated content may produce unexpected or inappropriate material, including content that may not be suitable for all audiences.
                While you can minimize exposure to certain content through the settings, complete avoidance cannot be guaranteed.</span>
        <span class="mt-2">By playing this game, you acknowledge and accept the potential for such content and agree to proceed at your own discretion.
                The developers are not responsible for any distress or offense caused by AI-generated material.</span>
        <span class="mt-2">Adhere to the <a class="link" target="_blank" href="https://ai.google.dev/gemini-api/terms">Google Gemini Terms</a>
            and for image generation the <a class="link" target="_blank" href="https://pollinations.ai/terms">Pollinations Terms</a></span>
        <span class="mt-2 font-semibold">Age Restriction</span>
        <span class="mt-2">This game is intended for players aged 18 and above.</span>
        <span class="mt-2 font-semibold">Privacy Notice</span>
        <span class="mt-2">This website uses Vercel Web Analytics and Speed Insights. They collect information such as page views, country, browser and load times.
            No personal data is collected at all that could identify individual users. It is used solely for the purpose of improving this website.
            We are committed to protecting user privacy and do not share this data with any third parties.</span>
        
        <button class="btn btn-info mt-3"
                onclick={() => {disclaimer.close(); onAgree();}}
        >
            I Agree
        </button>
    </div>
</dialog>