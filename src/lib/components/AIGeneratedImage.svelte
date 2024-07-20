<script lang="ts" xmlns="http://www.w3.org/1999/html">
    import useLocalStorage from "../state/useLocalStorage.svelte";

    let {storageKey, showGenerateButton, prompt} = $props();

    let initialImageState = {
        isGenerating: false,
        link: {
            className: "m-auto",
            title: "Vegas Bleeds Neon, CC BY-SA 3.0 <https://creativecommons.org/licenses/by-sa/3.0>, via Wikimedia Commons",
            href: "https://commons.wikimedia.org/wiki/File:Placeholder_female_superhero_c.png"
        },
        image: {
            width: 256,
            alt: "Placeholder female superhero c",
            src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Placeholder_female_superhero_c.png/256px-Placeholder_female_superhero_c.png?20110305190235"
        }
    };
    let imageState = useLocalStorage(storageKey, initialImageState);
    let imageToReplace;



    function replaceWithAiGenerated() {
        if (prompt) {
            imageState.value.isGenerating = true;
            const aiGeneratedImage = new Image();
            //wait till ai has generated image
            aiGeneratedImage.onload = function () {
                const newImgState = {
                    isGenerating: false,
                    link: {
                        ...initialImageState.link,
                        title: '',
                        href: aiGeneratedImage.src,
                    },
                    image: {
                        ...initialImageState.image,
                        src: aiGeneratedImage.src,
                        alt: prompt
                    }
                }
                imageState.value = newImgState;
            }
            aiGeneratedImage.src = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt)
                + "?width=256&height=256";
        }
    }

</script>

<span class:block={imageState.value.isGenerating} class:hidden={!imageState.value.isGenerating}
      class="m-auto loading loading-infinity loading-lg"></span>
<a target="_blank" class:hidden={imageState.value.isGenerating} class={imageState.value.link.className}
   title={imageState.value.link.title}
   href={imageState.value.link.href}>
    <img bind:this={imageToReplace}
         width={imageState.value.image.width}
         alt={imageState.value.image.alt}
         src={imageState.value.image.src}>
</a>
{#if showGenerateButton}
    <button class="btn btn-accent m-auto"
            onclick="{replaceWithAiGenerated}"
    >
        Generate Image
    </button>
{/if}

