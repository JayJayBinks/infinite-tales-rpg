<script>
    import {stringifyPretty} from "$lib/util.svelte.ts";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";

    const gameActionsState = useLocalStorage('gameActionsState');
</script>
<output style="white-space: pre-wrap">{stringifyPretty(gameActionsState.value ? gameActionsState.value[gameActionsState.value.length - 1] : {})}</output>