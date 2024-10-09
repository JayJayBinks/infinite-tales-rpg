<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import useLocalStorage from "../state/useLocalStorage.svelte";
    import isEqual from "lodash.isequal";
    import {onMount } from 'svelte';
    import LoadingIcon from "$lib/components/LoadingIcon.svelte";

    let {className = '', storageKey = '', showGenerateButton = true,
        showLoadingSpinner = true,
        onClickGenerate = () => {},
        resetImageState = false,
        imagePrompt = ''} = $props();

    const initialImageState = {
        prompt: imagePrompt,
        isGenerating: false,
        link: {
            title: "Vegas Bleeds Neon, CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0>, via Wikimedia Commons",
            href: "https://commons.wikimedia.org/wiki/File:Placeholder_female_superhero_c.png"
        },
        image: {
            alt: "Placeholder female superhero c",
            src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Placeholder_female_superhero_c.png/256px-Placeholder_female_superhero_c.png?20110305190235"
        }
    };
    let imageState = $state({value: {...initialImageState}});
    if (storageKey) {
        imageState = useLocalStorage(storageKey, {...initialImageState, prompt: imagePrompt});
    }

    $effect(() => {
        if(imagePrompt?.trim()){
            imageState.value.prompt = imagePrompt;
        }
        if (resetImageState) {
            imageState.value = {...initialImageState};
            resetImageState = false;
        }
    })

    function replaceWithAiGenerated() {
        if (imageState.value.prompt) {
            imageState.value.isGenerating = true;
            const aiGeneratedImage = new Image();
            //wait till ai has generated image
            aiGeneratedImage.onload = function () {
                const newImgState = {
                    prompt: imageState.value.prompt,
                    isGenerating: false,
                    link: {
                        ...initialImageState.link,
                        title: '',
                        href: aiGeneratedImage.src,
                    },
                    image: {
                        ...initialImageState.image,
                        src: aiGeneratedImage.src,
                        alt: imagePrompt
                    }
                }
                imageState.value = newImgState;
            }
            // @ts-expect-error wrong type here dont care
            aiGeneratedImage.onerror = aiGeneratedImage.onload;

            aiGeneratedImage.src = "https://image.pollinations.ai/prompt/" + encodeURIComponent(imageState.value.prompt)
                + "?width=768&height=768&enhance=true";
        }
    }

    onMount(() => {
        if (imageState.value.isGenerating || (!showGenerateButton && isEqual(initialImageState, imageState.value))) {
            replaceWithAiGenerated();
        }
    })
</script>


<div class={className}>
    {#if showLoadingSpinner && imageState.value.isGenerating}
        <LoadingIcon additionalClass="h-[296px] sm:h-[512px] m-auto"/>
    {/if}
    <a target="_blank"
       class:hidden={showLoadingSpinner && imageState.value.isGenerating}
       title={imageState.value.link.title}
       href={imageState.value.link.href}>
        <img
             class="w-[296px] sm:w-[512px] m-auto"
             alt={imageState.value.image.alt}
             src={imageState.value.image.src}>
    </a>

    {#if showGenerateButton}
        <button class="btn btn-accent mt-3"
                disabled={imageState.value.isGenerating}
                onclick={(e) => {
		replaceWithAiGenerated();
		onClickGenerate(e);
	}}
        >
            Generate Image
        </button>
    {/if}
</div>


