<script>
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";

    let {story, imagePrompt} = $props();
</script>
<article class="m-auto prose prose-neutral mt-2" style="color: unset">
    {@html story}
</article>
<AIGeneratedImage className="m-auto mt-3"
                  showLoadingSpinner={false}
                  imagePrompt="{imagePrompt}" showGenerateButton={false}
/>
