<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import {stringifyPretty} from "$lib/util.svelte.ts";

    const characterState = useLocalStorage('characterState');
    const characterStatsState = useLocalStorage('characterStatsState');
    const storyState = useLocalStorage('storyState');
</script>

{#if characterState.value}
    <div class="menu-content p-4 min-h-screen flex justify-center items-center" id="stats">
        <div class="character-profile p-6 rounded-lg shadow-lg w-full max-w-md text-white">
            <h1 id="name"
                class="text-3xl font-bold text-center mb-4 class border-b border-gray-600">{characterState.value.name}</h1>
            <AIGeneratedImage className="w-full m-auto mt-3 flex flex-col"
                              imagePrompt="{characterState.value.gender} {characterState.value.race} {characterState.value.appearance} {storyState.value.general_image_prompt}"
                              storageKey="characterImageState"></AIGeneratedImage>
            <div class="section mb-6">
                <h2 class="text-xl font-semibold mt-2 border-b border-gray-600 pb-1 mb-2">Basic Information</h2>
                <div class="flex flex-col space-y-1">
                    <p><strong>Race:</strong> <span id="race">{characterState.value.race}</span></p>
                    <p><strong>Gender:</strong> <span id="gender">{characterState.value.gender}</span></p>
                    <p><strong>Class:</strong> <span id="class">{characterState.value.class}</span></p>
                    <p><span id="hpmp">{stringifyPretty(characterStatsState.value.resources)}</span></p>
                    <p><strong>Alignment:</strong> <span id="alignment">{characterState.value.alignment}</span></p>
                    <p><strong>Background:</strong> <span id="background">{characterState.value.background}</span></p>
                </div>
            </div>

            <div class="section mb-6">
                <h2 class="text-xl font-semibold class border-b border-gray-600 pb-1 mb-2">Appearance</h2>
                <p id="appearance">{characterState.value.appearance}</p>
            </div>

            <div class="section mb-6">
                <h2 class="text-xl font-semibold class border-b border-gray-600 pb-1 mb-2">Personality</h2>
                <p id="personality">{characterState.value.personality}</p>
            </div>

            <div class="section mb-6">
                <h2 class="text-xl font-semibold class border-b border-gray-600 pb-1 mb-2">Motivation</h2>
                <p id="motivation">{characterState.value.motivation}</p>
            </div>

            <div class="section mb-6">
                <h2 class="text-xl font-semibold class border-b border-gray-600 pb-1 mb-2">Traits</h2>
                <ul id="traits" class="list-disc list-inside space-y-1 class">
                    {stringifyPretty(characterStatsState.value.traits)}
                </ul>
            </div>

            <div class="section mb-6">
                <h2 class="text-xl font-semibold class border-b border-gray-600 pb-1 mb-2">Expertise</h2>
                <ul id="expertise" class="list-disc list-inside space-y-1 class">
                    {stringifyPretty(characterStatsState.value.expertise)}
                </ul>
            </div>

            <div class="section mb-6">
                <h2 class="text-xl font-semibold class border-b border-gray-600 pb-1 mb-2">Disadvantages</h2>
                <ul id="disadvantages" class="list-disc list-inside space-y-1 class">
                    {stringifyPretty(characterStatsState.value.disadvantages)}
                </ul>
            </div>
        </div>
    </div>
{/if}