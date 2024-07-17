<script lang="ts" xmlns="http://www.w3.org/1999/html">

    let {prompt} = $props();

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
    let imageState = $state({...initialImageState});
    let imageToReplace;

    function replaceWithAiGenerated() {
        if (prompt) {
            imageState.isGenerating = true;
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
                imageState = newImgState;
            }
            aiGeneratedImage.src = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt)
                + "?width=256&height=256";
        }
    }

</script>

<span class:block={imageState.isGenerating} class:hidden={!imageState.isGenerating}
      class="m-auto loading loading-infinity loading-lg"></span>
<a target="_blank" class:hidden={imageState.isGenerating} class={imageState.link.className}
   title={imageState.link.title}
   href={imageState.link.href}>
    <img bind:this={imageToReplace}
         width={imageState.image.width}
         alt={imageState.image.alt}
         src={imageState.image.src}>
</a>
<button class="btn btn-accent m-auto"
        onclick="{replaceWithAiGenerated}"
>
    Generate Image
</button>

