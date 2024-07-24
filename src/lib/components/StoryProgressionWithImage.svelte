<script>
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";

    let {story, imagePrompt} = $props();
</script>

{@html story}
<AIGeneratedImage className="w-auto max-w-[37vh] h-[33vh] m-auto mt-3"
                  showLoadingSpinner={false}
                  imagePrompt="{imagePrompt}" showGenerateButton={false}
/>
