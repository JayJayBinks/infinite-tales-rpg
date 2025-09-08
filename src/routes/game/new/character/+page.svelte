<script lang="ts">
    import { $state, $effect } from 'svelte';
    import LoadingIcon from '$lib/components/LoadingIcon.svelte';
    import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';

    interface AIGeneratedImageProps {
        storageKey?: string;
        showGenerateButton?: boolean;
        buttonClassesString?: string;
        showLoadingSpinner?: boolean;
        noLogo?: boolean;
        enhance?: boolean;
        onClickGenerate?: (e: MouseEvent) => void;
        resetImageState?: boolean;
        imagePrompt?: string;
        imageClassesString?: string;
        width?: number;
        height?: number;
        minPromptLength?: number;
    }

    const {
        storageKey = '',
        showGenerateButton = true,
        buttonClassesString = 'btn-md',
        showLoadingSpinner = true,
        noLogo = false,
        enhance = false,
        onClickGenerate = () => {},
        resetImageState = false,
        imagePrompt = '',
        imageClassesString = 'm-auto h-[296px] sm:h-[512px]',
        width = 768,
        height = 768,
        minPromptLength = 4
    } = $props<AIGeneratedImageProps>();

    type ImageState = {
        prompt: string;
        isGenerating: boolean;
        error?: string | null;
        link: { title: string; href: string };
        image: { alt: string; src: string };
    };

    const placeholder: ImageState = {
        prompt: imagePrompt.trim(),
        isGenerating: false,
        error: null,
        link: {
            title:
                'Vegas Bleeds Neon, CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0>, via Wikimedia Commons',
            href: 'https://commons.wikimedia.org/wiki/File:Placeholder_female_superhero_c.png'
        },
        image: {
            alt: 'Placeholder female superhero c',
            src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Placeholder_female_superhero_c.png/256px-Placeholder_female_superhero_c.png?20110305190235'
        }
    };

    const imageState = storageKey
        ? useLocalStorage<ImageState>(storageKey, { ...placeholder })
        : $state<{ value: ImageState }>({ value: { ...placeholder } });

    let lastRequestedPrompt = $state('');
    let lastCompletedPrompt = $state('');
    let currentRequestId = $state(0);
    const inMemoryCache = new Map<string, string>(); // key -> URL

    const buildKey = (prompt: string) =>
        `${prompt}::${enhance ? 1 : 0}::${noLogo ? 1 : 0}::${width}x${height}`;

    const handleGenerateImage = (manual = false) => {
        const prompt = imageState.value.prompt.trim();
        if (!prompt || prompt.length < minPromptLength) return;
        if (imageState.value.isGenerating) return;
        const key = buildKey(prompt);
        // Cached
        if (inMemoryCache.has(key)) {
            imageState.value = {
                ...imageState.value,
                isGenerating: false,
                error: null,
                link: { title: '', href: inMemoryCache.get(key)! },
                image: { alt: prompt, src: inMemoryCache.get(key)! }
            };
            lastCompletedPrompt = prompt;
            return;
        }

        imageState.value.isGenerating = true;
        imageState.value.error = null;
        const requestId = ++currentRequestId;
        lastRequestedPrompt = prompt;

        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
            prompt
        )}?width=${width}&height=${height}&enhance=${enhance}&nologo=${noLogo}`;

        const img = new Image();
        img.onload = () => {
            if (requestId !== currentRequestId) return; // stale
            inMemoryCache.set(key, url);
            imageState.value = {
                prompt,
                isGenerating: false,
                error: null,
                link: { title: '', href: url },
                image: { alt: prompt, src: url }
            };
            lastCompletedPrompt = prompt;
        };
        img.onerror = () => {
            if (requestId !== currentRequestId) return;
            imageState.value.isGenerating = false;
            imageState.value.error = 'Failed to load AI image';
        };
        img.src = url;

        if (manual) onClickGenerate(new MouseEvent('click'));
    };

	// Prop -> state synchronization
    $effect(() => {
        const trimmed = imagePrompt.trim();
        if (trimmed && trimmed !== imageState.value.prompt) {
            imageState.value.prompt = trimmed;
        }
    });

    // Reset logic
    $effect(() => {
        if (resetImageState) {
            imageState.value = { ...placeholder, prompt: imagePrompt.trim() };
            lastRequestedPrompt = '';
            lastCompletedPrompt = '';
        }
    });

    // Auto-generate when button hidden & prompt changes
    $effect(() => {
        const p = imageState.value.prompt.trim();
        if (
            !showGenerateButton &&
            p &&
            p.length >= minPromptLength &&
            p !== lastCompletedPrompt &&
            !imageState.value.isGenerating
        ) {
            handleGenerateImage();
        }
    });
</script>

<div
    class="flex flex-col items-center"
    role="group"
    aria-busy={imageState.value.isGenerating}
    aria-label="AI generated image section"
>
    {#if showLoadingSpinner && imageState.value.isGenerating}
        <div class={'content-center ' + imageClassesString} aria-live="polite">
            <LoadingIcon />
            <span class="sr-only">Generating image…</span>
        </div>
    {/if}

    <img
        class:hidden={showLoadingSpinner && imageState.value.isGenerating}
        class={imageClassesString}
        alt={imageState.value.image.alt}
        src={imageState.value.image.src}
        loading="lazy"
        decoding="async"
    />

    {#if imageState.value.error}
        <p class="mt-2 text-sm text-error">{imageState.value.error}</p>
    {/if}

    {#if showGenerateButton}
        <button
            class="btn btn-accent mt-3 {buttonClassesString}"
            disabled={imageState.value.isGenerating}
            aria-label="Generate AI image"
            onclick={() => handleGenerateImage(true)}
        >
            {imageState.value.isGenerating ? 'Generating…' : 'Generate Image'}
        </button>
    {/if}
</div>