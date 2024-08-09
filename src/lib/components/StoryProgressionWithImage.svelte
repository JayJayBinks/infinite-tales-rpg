<script>
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import {marked} from "marked";
    let {story, imagePrompt} = $props();
    let rendered = marked(story).replaceAll('\\n', '<br>').replaceAll('\\&quot;', '&quot;');
</script>
<article class="m-auto prose prose-neutral mt-2" style="color: unset">
    {@html rendered}
</article>
<AIGeneratedImage className="m-auto mt-3"
                  showLoadingSpinner={false}
                  imagePrompt="{imagePrompt}" showGenerateButton={false}
/>
