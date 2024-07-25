<script>
    import {stringifyPretty} from "$lib/util.svelte.ts";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    const gameState = useLocalStorage('gameState');
</script>
<output style="white-space: pre-wrap">{stringifyPretty(gameState.value)}</output>