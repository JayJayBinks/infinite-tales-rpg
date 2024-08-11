<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {GameAgent} from "$lib/ai/agents/gameAgent.ts";
    import {onMount, tick} from "svelte";
    import {GeminiProvider} from "$lib/ai/llmProvider.ts";
    import {handleError, stringifyPretty} from "$lib/util.svelte.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import StoryProgressionWithImage from "$lib/components/StoryProgressionWithImage.svelte";
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates.ts";
    import {SummaryAgent} from "$lib/ai/agents/summaryAgent.ts";
    import {determineDiceRollResult, mustRollDice, getRndInteger} from "./gameLogic.ts";
    import {errorState} from "$lib/state/errorState.svelte.ts";
    import ErrorDialog from "$lib/components/ErrorModal.svelte";
    import DiceBox from "@3d-dice/dice-box";

    const diceBox = new DiceBox("#dice-box", {
        assetPath: "/assets/dice-box/", // required
    });

    let diceRollDialog, storyDiv, actionsDiv, customActionInput;

    const gameActionsState = useLocalStorage('gameActionsState', []);
    const historyMessagesState = useLocalStorage('historyMessagesState', []);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const storyState = useLocalStorage('storyState', initialStoryState);
    const apiKeyState = useLocalStorage('apiKeyState');
    let rolledValueState = useLocalStorage('rolledValueState');
    let chosenActionState = useLocalStorage('chosenActionState', {});
    let modifierReasonState = $derived(chosenActionState.value?.dice_roll?.modifier_explanation);
    let modifierState = $derived(Number.parseInt(chosenActionState.value?.dice_roll?.modifier_value) || 0);
    let diceRollResultState = $derived(determineDiceRollResult(chosenActionState.value, rolledValueState.value, modifierState))
    let isAiGeneratingState = $state(false);

    let gameAgent;
    let summaryAgent;

    onMount(async () => {
        diceBox.init();
        if (apiKeyState.value) {
            gameAgent = new GameAgent(new GeminiProvider(apiKeyState.value));
            summaryAgent = new SummaryAgent(new GeminiProvider(apiKeyState.value));
            //Start game when not already started
            if (gameActionsState.value.length === 0) {
                await sendAction({
                    text: 'With you as the Dungeon Master, start the ADVENTURE_AND_MAIN_EVENT ' +
                        'with introducing the adventure background, characters and circumstances. Then describe the starting scene.'
                });
            } else {
                renderGameState(gameActionsState.value[gameActionsState.value.length - 1]);
                tick().then(() => customActionInput.scrollIntoView(false));
            }
            if (chosenActionState.value.text) {
                openDiceRollDialog();
            }
        }
    });


    function openDiceRollDialog() {
        //TODO showModal can not be used because it hides the dice roll
        diceRollDialog.show();
        diceRollDialog.addEventListener('close', function sendWithManuallyRolled(event) {
            this.removeEventListener('close', sendWithManuallyRolled);
            sendAction({text: chosenActionState.value.text + '\n ' + diceRollResultState})
        });
    }

    function handleAIError() {
        if (rolledValueState.value) {
            openDiceRollDialog();
        }
    }

    async function sendAction(action, rollDice = false) {
        try {
            if (rollDice) {
                openDiceRollDialog();
            } else {
                isAiGeneratingState = true;
                const newState = await gameAgent.generateStoryProgression(action.text, historyMessagesState.value, storyState.value, characterState.value);
                isAiGeneratingState = false;
                if (newState) {
                    const newStateJson = stringifyPretty(newState);
                    console.log(newStateJson)
                    const userMessage = {"role": "user", "content": action.text}
                    const modelMessage = {"role": "model", "content": JSON.stringify(newStateJson)}
                    historyMessagesState.value = [...historyMessagesState.value, userMessage, modelMessage];
                    updateGameState(newState);
                    //ai can more easily remember the middle part and prevents undesired writing style, action values etc...
                    historyMessagesState.value = await summaryAgent.summarizeStoryIfTooLong(historyMessagesState.value);
                    chosenActionState.reset();
                    rolledValueState.reset();
                }
            }
        } catch (e) {
            isAiGeneratingState = false;
            handleError(e);
        }
    }

    function updateGameState(state) {
        gameActionsState.value = [...gameActionsState.value, {...state}];
        // TODO inventoryStore.set(state?.inventory_update || []);
        renderGameState(state);
    }

    function renderGameState(state, addContinueStory = true) {
        if (actionsDiv) {
            actionsDiv.innerHTML = '';
            state.actions = state?.actions || [];
            state.actions.push();
            state.actions.forEach(action => addActionButton(action, state.is_character_in_combat));
            if (addContinueStory && state.hp > 0) {
                addActionButton({
                    text: 'Continue the story'
                });
            }
        }
    }

    function addActionButton(action, is_character_in_combat = false) {
        const button = document.createElement('button');
        button.className = 'btn btn-neutral mb-3 w-full text-md ';
        button.textContent = action.text;
        button.addEventListener('click', () => {
            chosenActionState.value = {...action};
            sendAction({...action}, mustRollDice(action, is_character_in_combat))
        });
        actionsDiv.appendChild(button);
    }
</script>

<!--TODO refactor to component with dialog-->
<div id="dice-box" class="fixed inset-0 w-screen h-screen z-50 pointer-events-none"></div>
<div id="game-container" class="container mx-auto p-4">
    {#if isAiGeneratingState}
        <LoadingModal></LoadingModal>
    {/if}
    {#if errorState.userMessage}
        <ErrorDialog onclose={handleAIError}/>
    {/if}


    <dialog bind:this={diceRollDialog} id="dice-rolling-dialog" class="modal z-10"
            style="background: rgba(0, 0, 0, 0.3);">
        <div class="modal-box flex flex-col items-center">
            <h1 class="mt-2 text-xl">Roll a d20!</h1>
            <p class="mt-1">Difficulty class: </p>
            <output id="dice-roll-difficulty"
                    class="font-semibold">{chosenActionState.value.dice_roll?.required_value}</output>

            <p>Rolled:</p>
            <output id="dice-roll-result" class="mt-2">{rolledValueState.value || '?'}</output>
            <p>Modifier:</p>
            <output id="modifier" class="mt-2">{modifierState}</output>
            <p>Reason:</p>
            <output id="modifier-reason" class="mt-2">{modifierReasonState}</output>
            <br>
            <div class="flex justify-center flex-col mt-2">
                <button id="roll-dice-button"
                        class="btn btn-neutral mb-3"
                        disabled={rolledValueState.value}
                        onclick={(evt) => {diceBox.show(); diceBox.roll("1d20").then(results => rolledValueState.value = results[0].value)}}>
                    Roll
                </button>
                {#if diceRollResultState}
                    <output>{diceRollResultState}</output>
                {/if}
                <button onclick={() => {diceBox.hide(); diceBox.clear(); diceRollDialog.close();}} id="dice-rolling-dialog-continue"
                        disabled={!rolledValueState.value}
                        class="btn btn-neutral">Continue
                </button>
            </div>
        </div>
    </dialog>
    <div class="sticky top-0 z-50 menu menu-horizontal bg-base-200 flex justify-between">
        <output id="hp" class="ml-1 font-semibold text-lg text-red-500">
            HP: {gameActionsState.value[gameActionsState.value.length - 1]?.hp}</output>
        <output id="mp" class="ml-1 font-semibold text-lg text-blue-500">
            MP: {gameActionsState.value[gameActionsState.value.length - 1]?.mp}</output>
    </div>
    <div id="story" bind:this={storyDiv} class="mt-4 p-4 bg-base-100 rounded-lg shadow-md">
        {#each gameActionsState.value as gameActionsState}
            <StoryProgressionWithImage story={gameActionsState.story}
                                       imagePrompt="{gameActionsState.image_prompt} {storyState.value.general_image_prompt}"/>
        {/each}
    </div>
    <div id="actions" bind:this={actionsDiv} class="mt-4 p-4 bg-base-100 rounded-lg shadow-md"></div>
    <form id="input-form" class="mt-4 flex">
        <input type="text"
               bind:this={customActionInput}
               class="input input-bordered flex-grow mr-2" id="user-input"
               placeholder="Enter your action">
        <button type="submit"
                onclick="{(evt) => {sendAction({text: customActionInput.value}); customActionInput.value = '';}}"
                class="btn btn-neutral" id="submit-button">Submit
        </button>
    </form>

    <style>
        .btn {
            height: fit-content;
            padding: 1rem;
        }

        canvas{
            height: 100%;
            width: 100%;
        }
    </style>
</div>