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
    import {errorState} from "$lib/state/errorState.svelte.ts";
    import ErrorDialog from "$lib/components/ErrorModal.svelte";
    import DiceBox from "@3d-dice/dice-box";
    import * as gameLogic from "./gameLogic.ts";
    import {difficultyDiceRollModifier} from "./gameLogic.ts";

    let diceBox, svgDice;
    let diceRollDialog, storyDiv, actionsDiv, customActionInput;

    const gameActionsState = useLocalStorage('gameActionsState', []);
    const historyMessagesState = useLocalStorage('historyMessagesState', []);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const storyState = useLocalStorage('storyState', initialStoryState);

    const apiKeyState = useLocalStorage('apiKeyState');
    const temperatureState = useLocalStorage('temperatureState', 1.3);
    const customSystemInstruction = useLocalStorage('customSystemInstruction');
    const aiLanguage = useLocalStorage('aiLanguage');

    let didAIProcessDiceRollAction = useLocalStorage('didAIProcessDiceRollAction', true);
    let chosenActionState = useLocalStorage('chosenActionState', {});
    let isGameEnded = useLocalStorage('isGameEnded', false);
    let isAiGeneratingState = $state(false);

    const difficultyState = useLocalStorage('difficultyState', 'Default');
    let modifierReasonState = $derived(chosenActionState.value?.dice_roll?.modifier_explanation);
    let modifierState = $derived(Number.parseInt(chosenActionState.value?.dice_roll?.modifier_value) || 0);
    let rolledValueState = useLocalStorage('rolledValueState');
    let rollDifferenceHistoryState = useLocalStorage('rollDifferenceHistoryState', []);
    let useKarmicDice = useLocalStorage('useKarmicDice', true);
    let karmaModifierState = $derived(gameLogic.getKarmaModifier(rollDifferenceHistoryState.value, chosenActionState.value?.dice_roll?.required_value || 0));

    let diceRollResultState = $derived(gameLogic.determineDiceRollResult(chosenActionState.value, rolledValueState.value, modifierState + karmaModifierState))
    let derivedGameState = $state({currentHP: 0, currentMP: 0})

    let gameAgent, summaryAgent;

    onMount(async () => {
        diceBox = new DiceBox("#dice-box", {
            assetPath: "/assets/dice-box/", // required
        });
        diceBox.init();
        if (apiKeyState.value) {
            gameAgent = new GameAgent(new GeminiProvider(apiKeyState.value, temperatureState.value, aiLanguage.value));
            summaryAgent = new SummaryAgent(new GeminiProvider(apiKeyState.value, 1, aiLanguage.value));
            //Start game when not already started
            if (gameActionsState.value.length === 0) {
                await sendAction({
                    text: 'With you as the Dungeon Master, start the ADVENTURE_AND_MAIN_EVENT ' +
                        'with introducing the adventure background, characters and circumstances. Then describe the starting scene.'
                });
            } else {
                gameLogic.applyGameActionStates(derivedGameState, gameActionsState.value);
                renderGameState(gameActionsState.value[gameActionsState.value.length - 1]);
                tick().then(() => customActionInput.scrollIntoView(false));
            }
            if (!didAIProcessDiceRollAction.value) {
                openDiceRollDialog();
            }
        }
    });


    function openDiceRollDialog() {
        //TODO showModal can not be used because it hides the dice roll
        didAIProcessDiceRollAction.value = false;
        diceRollDialog.show();
        diceRollDialog.addEventListener('close', function sendWithManuallyRolled(event) {
            rollDifferenceHistoryState.value = [...rollDifferenceHistoryState.value.slice(-2),
                (rolledValueState.value + modifierState + karmaModifierState) - chosenActionState.value.dice_roll.required_value];
            this.removeEventListener('close', sendWithManuallyRolled);
            sendAction({text: chosenActionState.value.text + '\n ' + diceRollResultState})
        });
    }

    function handleAIError() {
        if (!didAIProcessDiceRollAction.value) {
            openDiceRollDialog();
        }
    }

    async function sendAction(action, rollDice = false) {
        try {
            if (rollDice) {
                openDiceRollDialog();
            } else {
                isAiGeneratingState = true;
                const newState = await gameAgent.generateStoryProgression(action.text, customSystemInstruction.value, historyMessagesState.value,
                    storyState.value, characterState.value, derivedGameState);

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
                    customActionInput.value = '';
                    didAIProcessDiceRollAction.value = true;
                }
            }
        } catch (e) {
            isAiGeneratingState = false;
            handleError(e);
        }
    }

    function updateGameState(state) {
        gameActionsState.value = [...gameActionsState.value, {...state, id: gameActionsState.value.length}];
        // TODO inventoryStore.set(state?.inventory_update || []);
        gameLogic.applyGameActionState(derivedGameState, state);
        renderGameState(state);
    }

    async function renderGameState(state, addContinueStory = true) {
        const hp = derivedGameState.currentHP;
        if(!isGameEnded.value && hp <= 0){
            await sendAction({
                text: 'The CHARACTER has fallen to 0 HP. Describe how this tale ends.'
            })
        }
        isGameEnded.value = hp <= 0;
        if (actionsDiv) {
            actionsDiv.innerHTML = '';
            if (!isGameEnded.value) {
                state.actions = state?.actions || [];
                state.actions.forEach(action => addActionButton(action));
                if (addContinueStory) {
                    addActionButton({
                        text: 'Continue The Tale'
                    });
                }
            }
        }
    }

    function addActionButton(action) {
        const button = document.createElement('button');
        button.className = 'btn btn-neutral mb-3 w-full text-md ';
        const mpCost = parseInt(action.mp_cost) || 0;
        const isEnoughMP = mpCost === 0 || derivedGameState.currentMP >= mpCost;
        button.textContent = action.text;
        if (mpCost > 0 && !button.textContent.includes("MP")) {
            button.textContent += "(" + mpCost + " MP)";
        }
        if (!isEnoughMP) {
            button.disabled = true;
        }
        button.addEventListener('click', () => {
            const chosenAction = $state.snapshot(action);
            if (chosenAction.dice_roll) {
                chosenAction.dice_roll.required_value -= difficultyDiceRollModifier[difficultyState.value];
            }
            chosenActionState.value = chosenAction;
            sendAction(chosenActionState.value, gameLogic.mustRollDice(chosenActionState.value))
        });
        actionsDiv.appendChild(button);
    }

    function getRollResult() {
        let karmaValue = 0
        if (useKarmicDice.value) {
            karmaValue = karmaModifierState;
        }
        return `${rolledValueState.value || '?'}  + ${modifierState + karmaValue} = ${(rolledValueState.value + modifierState + karmaValue) || '?'}`;
    }

</script>

<!--TODO refactor to component with dialog-->
<div id="dice-box" class="fixed inset-0 z-30 pointer-events-none"></div>
<div id="game-container" class="container mx-auto p-4">
    {#if isAiGeneratingState}
        <LoadingModal></LoadingModal>
    {/if}
    {#if errorState.userMessage}
        <ErrorDialog onclose={handleAIError}/>
    {/if}


    <dialog bind:this={diceRollDialog} id="dice-rolling-dialog" class="modal z-20"
            style="background: rgba(0, 0, 0, 0.3);">
        <div class="modal-box flex flex-col items-center text-center">
            <p class="mt-3 text-xl">Difficulty class: </p>
            <output id="dice-roll-difficulty"
                    class="font-semibold text-xl">{chosenActionState.value.dice_roll?.required_value}</output>

            <button id="roll-dice-button"
                    class="btn btn-ghost m-3 "
                    disabled={rolledValueState.value}
                    onclick={(evt) => {evt.currentTarget.disabled = true; diceBox.roll("1d20").then(results => {rolledValueState.value = results[0].value;})}}>
                <div class="flex justify-center flex-col items-center">
                    <svg
                            bind:this={svgDice}
                            fill="black"
                            class:fill-green-700={diceRollResultState?.includes('success')}
                            class:fill-red-700={diceRollResultState?.includes('failure')}
                            class="h-1/3 w-1/3 mb-3"
                            viewBox="-16 0 512 512"
                            xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                                d="M106.75 215.06L1.2 370.95c-3.08 5 .1 11.5 5.93 12.14l208.26 22.07-108.64-190.1zM7.41 315.43L82.7 193.08 6.06 147.1c-2.67-1.6-6.06.32-6.06 3.43v162.81c0 4.03 5.29 5.53 7.41 2.09zM18.25 423.6l194.4 87.66c5.3 2.45 11.35-1.43 11.35-7.26v-65.67l-203.55-22.3c-4.45-.5-6.23 5.59-2.2 7.57zm81.22-257.78L179.4 22.88c4.34-7.06-3.59-15.25-10.78-11.14L17.81 110.35c-2.47 1.62-2.39 5.26.13 6.78l81.53 48.69zM240 176h109.21L253.63 7.62C250.5 2.54 245.25 0 240 0s-10.5 2.54-13.63 7.62L130.79 176H240zm233.94-28.9l-76.64 45.99 75.29 122.35c2.11 3.44 7.41 1.94 7.41-2.1V150.53c0-3.11-3.39-5.03-6.06-3.43zm-93.41 18.72l81.53-48.7c2.53-1.52 2.6-5.16.13-6.78l-150.81-98.6c-7.19-4.11-15.12 4.08-10.78 11.14l79.93 142.94zm79.02 250.21L256 438.32v65.67c0 5.84 6.05 9.71 11.35 7.26l194.4-87.66c4.03-1.97 2.25-8.06-2.2-7.56zm-86.3-200.97l-108.63 190.1 208.26-22.07c5.83-.65 9.01-7.14 5.93-12.14L373.25 215.06zM240 208H139.57L240 383.75 340.43 208H240z"
                        />
                    </svg>
                    Click to roll
                </div>
            </button>

            <p>Result:</p>
            <output id="dice-roll-result" class="mt-2">{getRollResult()}</output>
            <output>{diceRollResultState}</output>
            <button onclick={() => {diceBox.clear(); diceRollDialog.close();}}
                    id="dice-rolling-dialog-continue"
                    disabled={!rolledValueState.value}
                    class="btn btn-neutral m-3">Continue
            </button>
            {#if useKarmicDice.value && karmaModifierState > 0}
                <output id="Karma" class="mt-2">Karma Modifier: {karmaModifierState}</output>
            {/if}
            <output id="modifier" class="mt-2">Modifier: {modifierState}</output>
            <p>Reason:</p>
            <output id="modifier-reason" class="mt-2">{modifierReasonState}</output>
            <br>
        </div>
    </dialog>
    <div class="sticky top-0 z-10 menu menu-horizontal bg-base-200 flex justify-between">
        <output id="hp" class="ml-1 font-semibold text-lg text-red-500">
            HP: {derivedGameState.currentHP}</output>
        <output id="mp" class="ml-1 font-semibold text-lg text-blue-500">
            MP: {derivedGameState.currentMP}</output>
    </div>
    <div id="story" bind:this={storyDiv} class="mt-4 p-4 bg-base-100 rounded-lg shadow-md">
        <!-- For proper updating, need to use gameActionsState.id as each block id -->
        {#each gameActionsState.value.slice(-3) as gameActionState, i (gameActionState.id)}
            <StoryProgressionWithImage story={gameActionState.story}
                                       statsUpdates={gameActionState.id === 0 ? [] : gameLogic.renderStatUpdates(gameActionState.stats_update)}
                                       imagePrompt="{gameActionState.image_prompt} {storyState.value.general_image_prompt}"/>
        {/each}
        {#if isGameEnded.value}
            <StoryProgressionWithImage story={gameLogic.getGameEndedMessage()}/>
        {/if}
    </div>
    <div id="actions" bind:this={actionsDiv} class="mt-4 p-4 bg-base-100 rounded-lg shadow-md"></div>
    <form id="input-form" class="mt-4 flex">
        <input type="text"
               bind:this={customActionInput}
               class="input input-bordered flex-grow mr-2" id="user-input"
               placeholder="Enter your action">
        <button type="submit"
                onclick="{(evt) => {sendAction({text: customActionInput.value});}}"
                class="btn btn-neutral" id="submit-button">Submit
        </button>
    </form>

    <style>
        .btn {
            height: fit-content;
            padding: 1rem;
        }

        canvas {
            height: 100%;
            width: 100%;
        }
    </style>
</div>