<script>
    import {stringifyPretty} from "$lib/util.svelte.ts";
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";

    const gameActionsState = useLocalStorage('gameActionsState');
    const npcState = useLocalStorage('npcState', {});
</script>
<div class="divider mt-7">Game State</div>
<output style="white-space: pre-wrap">{stringifyPretty(gameActionsState.value ? gameActionsState.value[gameActionsState.value.length - 1] : {})}</output>
<div class="divider mt-7">NPC State</div>
<output style="white-space: pre-wrap">{stringifyPretty(npcState.value)}</output>