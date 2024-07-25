<script>
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";

    let {story, imagePrompt} = $props();
</script>
<article class="m-auto prose prose-neutral" style="color: unset">
    {@html story}
</article>
<AIGeneratedImage className="w-auto max-w-[37vh] h-[37vh] m-auto mt-3"
                  showLoadingSpinner={false}
                  imagePrompt="{imagePrompt}" showGenerateButton={false}
/>
