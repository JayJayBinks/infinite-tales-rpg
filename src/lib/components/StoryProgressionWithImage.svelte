<script lang="ts">
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import {marked} from "marked";
    import type {RenderedStatsUpdate} from "../../routes/game/gameLogic";

    type Props = { story: string, statsUpdates?: Array<RenderedStatsUpdate>, imagePrompt?: string };
    let {story, statsUpdates = [], imagePrompt = ''}: Props = $props();
    let rendered = (marked(story) as string).replaceAll('\\n', '<br>').replaceAll(' n ', '<br>').replaceAll('\\&quot;', '&quot;');
</script>
<article class="m-auto prose prose-neutral mt-2" style="color: unset">
    {@html rendered}
    {#each statsUpdates as statsUpdate}
        <p class="capitalize text-center text-sm m-1">{statsUpdate.text} <span
                class="{statsUpdate.color}">{statsUpdate.resourceText}</span></p>
    {/each}
</article>
{#if imagePrompt}
    <AIGeneratedImage className="m-auto mt-3"
                      showLoadingSpinner={false}
                      imagePrompt={imagePrompt}
                      showGenerateButton={false}
    />
{/if}
