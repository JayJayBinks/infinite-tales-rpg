<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {GameAgent} from "$lib/ai/agents/gameAgent.ts";
    import {onMount, tick} from "svelte";
    import {GeminiProvider} from "$lib/ai/llmProvider.ts";
    import {handleError, stringifyPretty} from "$lib/util.svelte.ts";
    import AIGeneratedImage from "$lib/components/AIGeneratedImage.svelte";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import StoryProgressionWithImage from "$lib/components/StoryProgressionWithImage.svelte";
    import {initialCharacterState, initialStoryState} from "$lib/state/initialStates.ts";
    import {SummaryAgent} from "$lib/ai/agents/summaryAgent.ts";

    let diceRollDialog, storyDiv, actionsDiv, customActionInput;

    function getRndInteger(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

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
            if (rolledValueState.value) {
                openDiceRollDialog();
            }
        }
    });


    function openDiceRollDialog() {
        diceRollDialog.showModal();
        diceRollDialog.addEventListener('close', function sendWithManuallyRolled(event) {
            this.removeEventListener('close', sendWithManuallyRolled);
            const actionSnap = $state.snapshot(chosenActionState.value);
            sendAction({text: chosenActionState.value.text + '\n ' + diceRollResultState})
        });
    }

    function determineDiceRollResult(action, rolledValue, modifier) {
        if (!action.dice_roll || rolledValue === '?') {
            return undefined;
        }
        const evaluatedModifier = isNaN(Number.parseInt(modifier)) ? 0 : Number.parseInt(modifier);
        const evaluatedRolledValue = isNaN(Number.parseInt(rolledValue)) ? 0 : Number.parseInt(rolledValue);
        const evaluatedValue = evaluatedRolledValue + evaluatedModifier;
        if (rolledValue === 1) {
            return 'The action is a critical failure!';
        }
        if (rolledValue === 20) {
            return 'The action is a critical success!';
        }
        const diff = evaluatedValue - action.dice_roll.required_value;
        if (diff <= -6) {
            return 'The action is a major failure.';
        }
        if (diff <= -3) {
            return 'The action is a regular failure.';
        }
        if (diff <= -1) {
            return 'The action is a partial failure.';
        }
        if (diff >= 6) {
            return 'The action is a major success.';
        }
        if (diff >= 3) {
            return 'The action is a regular success.';
        }
        if (diff >= 0) {
            return 'The action is a partial success.';
        }
        //Error fallback (e.g. '10 to 14')
        return `Determine the action outcome with a rolled value of ${evaluatedValue} and required value of ${action.dice_roll.required_value}`
    }

    async function sendAction(action, rollDice = false) {
        //TODO this dialog is above the error dialog despite lower z-index, user does not know error ocurred
        function handleAIError() {
            if (rolledValueState.value) {
                openDiceRollDialog();
            }
        }

        try {
            if (rollDice) {
                rolledValueState.value = '?';
                openDiceRollDialog();
            } else {
                isAiGeneratingState = true;
                const newState = await gameAgent.generateStoryProgression(chosenActionState.value.text, historyMessagesState.value, storyState.value, characterState.value);
                isAiGeneratingState = false;
                if (newState) {
                    const newStateJson = stringifyPretty(newState);
                    console.log(newStateJson)
                    const message = {"role": "model", "content": JSON.stringify(newStateJson)}
                    historyMessagesState.value = [...historyMessagesState.value, message];
                    updateGameState(newState);
                    if (historyMessagesState.value.length > 25) {
                        //ai can more easily remember the middle part and prevents undesired writing style, action values etc...
                        historyMessagesState.value = await summaryAgent.summarizeHistoryMessages(historyMessagesState.value);
                    }
                    chosenActionState.reset();
                    rolledValueState.reset();
                } else {
                    handleAIError();
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

        let rollDice = false
        //TODO implement parsing to enums
        if (action.text.toLowerCase() !== 'continue the story' && (JSON.parse(is_character_in_combat) ||
            (action.action_difficulty.toLowerCase() !== 'none' && action.action_difficulty.toLowerCase() !== 'simple')
            || action.type.toLowerCase() === 'social_manipulation')) {

            rollDice = true;
        }
        button.addEventListener('click', () => {
            chosenActionState.value = {...action};
            sendAction({...action}, rollDice)
        });
        actionsDiv.appendChild(button);
    }
</script>

<div id="game-container" class="container mx-auto p-4">
    {#if isAiGeneratingState}
        <LoadingModal></LoadingModal>
    {/if}

    <dialog bind:this={diceRollDialog} id="dice-rolling-dialog" class="modal z-10"
            style="background: rgba(0, 0, 0, 0.3);">
        <div class="modal-box flex flex-col items-center">
            <output id="dice-roll-title" class=" font-bold">{chosenActionState.value.text}</output>
            <br>
            <p class="mt-2">Roll a d20!</p>
            <p class="mt-1">Difficulty class: </p>
            <output id="dice-roll-difficulty"
                    class="font-semibold">{chosenActionState.value.dice_roll?.required_value}</output>

            <p>Rolled:</p>
            <output id="dice-roll-result" class="mt-2">{rolledValueState.value}</output>
            <p>Modifier:</p>
            <output id="modifier" class="mt-2">{modifierState}</output>
            <p>Reason:</p>
            <output id="modifier-reason" class="mt-2">{modifierReasonState}</output>
            <br>
            <div class="flex justify-center flex-col mt-2">
                <button id="roll-dice-button"
                        class="btn btn-neutral mb-3"
                        disabled={rolledValueState.value !== '?'}
                        onclick={(evt) => {evt.target.disabled = true; rolledValueState.value = getRndInteger(1,20);}}>
                    Roll
                </button>
                {#if diceRollResultState}
                    <output>{diceRollResultState}</output>
                {/if}
                <button onclick={() => (diceRollDialog.close())} id="dice-rolling-dialog-continue"
                        disabled={rolledValueState.value === '?'}
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
    </style>
</div>