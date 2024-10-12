<script lang="ts">
    import useLocalStorage from "$lib/state/useLocalStorage.svelte";
    import type {Action, DerivedGameState, GameActionState} from "$lib/ai/agents/gameAgent";
    import {GameAgent} from "$lib/ai/agents/gameAgent";
    import {DifficultyAgent} from "$lib/ai/agents/difficultyAgent";

    import {onMount, tick} from "svelte";
    import {handleError, stringifyPretty} from "$lib/util.svelte";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import StoryProgressionWithImage from "$lib/components/StoryProgressionWithImage.svelte";
    import {SummaryAgent} from "$lib/ai/agents/summaryAgent";
    import {CharacterStatsAgent, initialCharacterStatsState} from "$lib/ai/agents/characterStatsAgent";
    import {errorState} from "$lib/state/errorState.svelte";
    import ErrorDialog from "$lib/components/ErrorModal.svelte";
    import DiceBox from "@3d-dice/dice-box";
    import * as gameLogic from "./gameLogic";
    import * as combatLogic from "./combatLogic";
    import * as diceRollLogic from "./diceRollLogic";
    import UseSpellsAbilitiesModal from "$lib/components/UseSpellsAbilitiesModal.svelte";
    import {CombatAgent} from "$lib/ai/agents/combatAgent";
    import {LLMProvider} from "$lib/ai/llmProvider";
    import type {LLMMessage} from "$lib/ai/llm";
    import {initialStoryState} from "$lib/ai/agents/storyAgent";
    import {initialCharacterState} from "$lib/ai/agents/characterAgent";

    //ui declerations
    let diceBox, svgDice;
    // eslint-disable-next-line svelte/valid-compile
    let diceRollDialog, useSpellsAbilitiesModal, storyDiv, actionsDiv, customActionInput;

    //ai state
    const apiKeyState = useLocalStorage('apiKeyState');
    const temperatureState = useLocalStorage('temperatureState');
    const customSystemInstruction = useLocalStorage('customSystemInstruction');
    const aiLanguage = useLocalStorage('aiLanguage');
    let isAiGeneratingState = $state(false);
    let didAIProcessDiceRollAction = useLocalStorage('didAIProcessDiceRollAction', true);
    let gameAgent, difficultyAgent, summaryAgent, characterStatsAgent, combatAgent;

    //game state
    const gameActionsState = useLocalStorage('gameActionsState', []);
    const historyMessagesState = useLocalStorage('historyMessagesState', []);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const characterStatsState = useLocalStorage('characterStatsState', initialCharacterStatsState);
    const storyState = useLocalStorage('storyState', initialStoryState);
    const npcState = useLocalStorage('npcState', {});
    let chosenActionState = useLocalStorage('chosenActionState', {});
    let additionalActionInputState = useLocalStorage('additionalActionInputState');
    let isGameEnded = useLocalStorage('isGameEnded', false);
    let derivedGameState = $state({currentHP: 0, currentMP: 0})

    //dice roll state
    let rolledValueState = useLocalStorage('rolledValueState');
    let rollDifferenceHistoryState = useLocalStorage('rollDifferenceHistoryState', []);

    //feature toggles
    const difficultyState = useLocalStorage('difficultyState', 'Default');
    let useKarmicDice = useLocalStorage('useKarmicDice', true);
    let useDynamicCombat = useLocalStorage('useDynamicCombat', true);

    //derived states
    let diceRollRequiredValueState = $derived(diceRollLogic.getRequiredValue(chosenActionState.value?.action_difficulty, difficultyState.value));
    let modifierReasonState = $derived(chosenActionState.value?.dice_roll?.modifier_explanation);
    let modifierState = $derived(Number.parseInt(chosenActionState.value?.dice_roll?.modifier_value) || 0);
    let karmaModifierState = $derived(!useKarmicDice.value ? 0 : diceRollLogic.getKarmaModifier(rollDifferenceHistoryState.value, diceRollRequiredValueState));
    let diceRollResultState = $derived(diceRollLogic.determineDiceRollResult(diceRollRequiredValueState, rolledValueState.value, modifierState + karmaModifierState))
    const currentGameActionState: GameActionState = $derived((gameActionsState.value && gameActionsState.value[gameActionsState.value.length - 1]) || {});

    onMount(async () => {
        const llm = LLMProvider.provideLLM(
            {
                temperature: temperatureState.value,
                language: aiLanguage.value,
                apiKey: apiKeyState.value,
            });

        diceBox = new DiceBox("#dice-box", {
            assetPath: "/assets/dice-box/", // required
        });
        diceBox.init();

        gameAgent = new GameAgent(llm);
        characterStatsAgent = new CharacterStatsAgent(llm);
        combatAgent = new CombatAgent(llm);
        difficultyAgent = new DifficultyAgent(llm);
        summaryAgent = new SummaryAgent(llm);
        //Start game when not already started
        if (gameActionsState.value.length === 0) {
            handleStartingStats(derivedGameState);
            await sendAction({
                text: gameAgent.getStartingPrompt()
            });
        } else {
            gameLogic.applyGameActionStates(derivedGameState, npcState.value, gameActionsState.value);
            await renderGameState(currentGameActionState);
            tick().then(() => customActionInput.scrollIntoView(false));
        }
        if (!didAIProcessDiceRollAction.value) {
            openDiceRollDialog(additionalActionInputState.value);
        }
    });

    function handleStartingStats(derivedGameState: DerivedGameState) {
        const startingResourcesUpdateObject = gameAgent.getStartingResourcesUpdateObject(
            characterStatsState.value.resources.MAX_HP,
            characterStatsState.value.resources.MAX_MP
        );
        derivedGameState.currentHP = characterStatsState.value.resources.MAX_HP;
        derivedGameState.currentMP = characterStatsState.value.resources.MAX_MP;
        gameActionsState.value.push(
            startingResourcesUpdateObject
        );
    }

    async function getActionPromptForCombat(playerAction) {
        const allNpcsDetailsAsList = gameLogic.getAllTargetsAsList(currentGameActionState.targets)
            .map(npcName => ({
                nameId: npcName,
                ...npcState.value[npcName],
            }));

        const determinedActionsAndStatsUpdate = await combatAgent.generateActionsFromContext(playerAction.text, allNpcsDetailsAsList,
            customSystemInstruction.value, getLatestStoryMessages(), storyState.value);

        //need to apply already here to have most recent allResources
        gameLogic.applyStatsUpdate(derivedGameState, npcState.value, determinedActionsAndStatsUpdate);
        const deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
        const aliveNPCs = allNpcsDetailsAsList.filter(npc => npc.resources.current_hp > 0).map(npc => npc.nameId);

        let additionalActionInput = combatAgent.getAdditionalActionInput(determinedActionsAndStatsUpdate.actions, deadNPCs, aliveNPCs, derivedGameState);
        return {additionalActionInput, determinedActionsAndStatsUpdate};
    }

    function openDiceRollDialog(additionalActionInput: string) {
        //TODO showModal can not be used because it hides the dice roll
        didAIProcessDiceRollAction.value = false;
        diceRollDialog.show();
        diceRollDialog.addEventListener('close', function sendWithManuallyRolled() {
            this.removeEventListener('close', sendWithManuallyRolled);
            let actionText = chosenActionState.value.text + '\n ' + diceRollDialog.returnValue;
            sendAction({text: actionText}, false, additionalActionInput);
            rollDifferenceHistoryState.value = [...rollDifferenceHistoryState.value.slice(-2),
                (rolledValueState.value + modifierState + karmaModifierState) - diceRollRequiredValueState];
        });
    }

    function handleAIError() {
        if (!didAIProcessDiceRollAction.value) {
            openDiceRollDialog(additionalActionInputState.value);
        }
    }

    async function getCombatAndNPCState(action: Action) {
        let deadNPCs: string[] = [];
        let additionalActionInput = '';
        let allCombatDeterminedActionsAndStatsUpdate;
        if (!isGameEnded.value && currentGameActionState.is_character_in_combat) {
            additionalActionInput += combatAgent.getCombatPromptAddition();
            if (useDynamicCombat.value) {
                let combatObject = await getActionPromptForCombat(action);
                additionalActionInput += combatObject.additionalActionInput;
                allCombatDeterminedActionsAndStatsUpdate = combatObject.determinedActionsAndStatsUpdate;
            } else {
                deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
                additionalActionInput += combatAgent.getNPCsHealthStatePrompt(deadNPCs);
            }
        } else {
            deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
            additionalActionInput += combatAgent.getNPCsHealthStatePrompt(deadNPCs);
        }
        return {additionalActionInput, allCombatDeterminedActionsAndStatsUpdate};
    }

    async function checkGameEnded() {
        const hp = derivedGameState.currentHP;
        if (!isGameEnded.value && hp <= 0) {
            isGameEnded.value = true;
            await sendAction({
                text: gameAgent.getGameEndedPrompt()
            })
        }
        isGameEnded.value = hp <= 0;
    }

    function resetStatesAfterActionProcessed() {
        chosenActionState.reset();
        rolledValueState.reset();
        additionalActionInputState.reset();
        customActionInput.value = '';
        didAIProcessDiceRollAction.value = true;
    }

    function checkForNewNPCs(newState: GameActionState) {
        const newNPCs = gameLogic.getNewNPCs(newState.targets, npcState.value);
        if (newNPCs.length > 0) {
            characterStatsAgent.generateNPCStats(storyState.value, getLatestStoryMessages(), newNPCs, customSystemInstruction.value)
                .then(newState => {
                    combatLogic.addResourceValues(newState);
                    npcState.value = {...npcState.value, ...newState}
                    console.log(stringifyPretty(npcState.value));
                });
        }
    }

    function updateMessagesHistory(action: Action, newState: GameActionState) {
        const {userMessage, modelMessage} = gameAgent.buildHistoryMessages(action.text, newState);
        console.log(stringifyPretty(newState))
        historyMessagesState.value = [...historyMessagesState.value, userMessage, modelMessage];
    }

    async function sendAction(action: Action, rollDice = false, additionalActionInput = '') {
        additionalActionInputState.value = additionalActionInput;
        try {
            if (rollDice) {
                openDiceRollDialog(additionalActionInput);
            } else {
                isAiGeneratingState = true;
                //const slowStory = '\n Ensure that the narrative unfolds gradually, building up anticipation and curiosity before moving towards any major revelations or climactic moments.'
                // + slowStory
                additionalActionInput = additionalActionInput || '';
                const combatAndNPCState = await getCombatAndNPCState(action);
                additionalActionInput += combatAndNPCState.additionalActionInput;

                console.log(action.text, additionalActionInput);
                const newState = await gameAgent.generateStoryProgression(action.text, additionalActionInput, customSystemInstruction.value, historyMessagesState.value,
                    storyState.value, characterState.value, characterStatsState.value, derivedGameState);

                if (newState) {
                    if (combatAndNPCState.allCombatDeterminedActionsAndStatsUpdate) {
                        //override the gameActionsState stat update with the combat one
                        newState.stats_update = combatAndNPCState.allCombatDeterminedActionsAndStatsUpdate.stats_update;
                    } else {
                        //StatsUpdate did not come from combat agent
                        gameLogic.applyStatsUpdate(derivedGameState, npcState.value, newState);
                    }
                    updateMessagesHistory(action, newState);
                    checkForNewNPCs(newState);
                    resetStatesAfterActionProcessed();
                    //ai can more easily remember the middle part and prevents undesired writing style, action values etc...
                    historyMessagesState.value = await summaryAgent.summarizeStoryIfTooLong(historyMessagesState.value);
                    gameActionsState.value = [...gameActionsState.value, {
                        ...newState,
                        id: gameActionsState.value.length
                    }];
                    await checkGameEnded();
                    await renderGameState(newState);
                }
                isAiGeneratingState = false;
            }
        } catch (e) {
            isAiGeneratingState = false;
            handleError(e as string);
        }
    }

    async function renderGameState(state: GameActionState, addContinueStory = true) {
        actionsDiv.innerHTML = '';
        if (!isGameEnded.value) {
            state.actions = state?.actions || [];
            state.actions.forEach(action => addActionButton(action, state.is_character_in_combat));
            if (addContinueStory) {
                addActionButton({
                    text: 'Continue The Tale'
                });
            }
        }
    }

    function addActionButton(action: Action, is_character_in_combat?: boolean) {
        const button = document.createElement('button');
        button.className = 'btn btn-neutral mb-3 w-full text-md ';
        const mpCost = parseInt(action.mp_cost as unknown as string) || 0;
        const isEnoughMP = mpCost === 0 || derivedGameState.currentMP >= mpCost;
        if (mpCost > 0 && !action.text.includes("MP")) {
            action.text += " (" + mpCost + " MP)";
        }
        button.textContent = action.text;
        if (!isEnoughMP) {
            button.disabled = true;
        }
        button.addEventListener('click', () => {
            chosenActionState.value = $state.snapshot(action);
            sendAction(chosenActionState.value, gameLogic.mustRollDice(chosenActionState.value, is_character_in_combat));
        });
        actionsDiv.appendChild(button);
    }

    function getRollResult() {
        return `${rolledValueState.value || '?'}  + ${modifierState + karmaModifierState} = ${(rolledValueState.value + modifierState + karmaModifierState) || '?'}`;
    }

    function getLatestStoryMessages(numOfActions = 2) {
        const historyMessages : LLMMessage[] = historyMessagesState.value.slice(numOfActions * -2);
        return historyMessages.map(message => {
            try {
                return {...message, content: JSON.parse(message.content).story};
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                return message;
            }
        })
    }

    const onTargetedSpellsOrAbility = async (action: Action, targets: string[]) => {
        isAiGeneratingState = true;
        const difficultyResponse = await difficultyAgent.generateDifficulty(action.text,
            customSystemInstruction.value, getLatestStoryMessages(), characterState.value, characterStatsState.value);
        if (difficultyResponse) {
            action = {...action, ...difficultyResponse}
        }
        console.log('difficultyResponse', stringifyPretty(difficultyResponse));
        chosenActionState.value = action;
        await sendAction(action,
            gameLogic.mustRollDice(action, currentGameActionState.is_character_in_combat),
            gameLogic.getTargetPromptAddition(targets));
        isAiGeneratingState = false;
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
    <UseSpellsAbilitiesModal bind:dialogRef={useSpellsAbilitiesModal}
                             currentMP={derivedGameState.currentMP}
                             abilities={characterStatsState.value?.spells_and_abilities}
                             targets={currentGameActionState.targets}
                             onclose={onTargetedSpellsOrAbility}
    >
    </UseSpellsAbilitiesModal>


    <dialog bind:this={diceRollDialog} id="dice-rolling-dialog" class="modal z-20"
            style="background: rgba(0, 0, 0, 0.3);">
        <div class="modal-box flex flex-col items-center text-center">
            <p class="mt-3 text-xl">Difficulty class: </p>
            <output id="dice-roll-difficulty"
                    class="font-semibold text-xl">{diceRollRequiredValueState}</output>

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
            <button onclick={() => {diceBox.clear(); diceRollDialog.close($state.snapshot(diceRollResultState));}}
                    id="dice-rolling-dialog-continue"
                    disabled={!rolledValueState.value}
                    class="btn btn-neutral m-3">Continue
            </button>
            {#if karmaModifierState > 0}
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
        {#each gameActionsState.value.filter(s => s.story).slice(-3) as gameActionState (gameActionState.id)}
            <StoryProgressionWithImage story={gameActionState.story}
                                       imagePrompt="{gameActionState.image_prompt} {storyState.value.general_image_prompt}"
                                       statsUpdates={gameActionState.id === 0 ? [] :
                                       gameLogic.renderStatUpdates(gameActionState.stats_update)}
            />
        {/each}
        {#if isGameEnded.value}
            <StoryProgressionWithImage story={gameLogic.getGameEndedMessage()}/>
        {/if}
    </div>
    <div id="actions" bind:this={actionsDiv} class="mt-4 p-4 pb-0"></div>
    {#if Object.keys(currentGameActionState).length !== 0}
        {#if !isGameEnded.value}
            <div id="static-actions" class="p-4 pt-0 pb-0">
                <button
                        onclick="{() => {useSpellsAbilitiesModal.showModal();}}"
                        class="btn btn-primary w-full text-md">Spells & Abilities
                </button>
            </div>
        {/if}
        <form id="input-form" class="p-4 pb-2">
            <div class="join w-full">
                <input type="text"
                       bind:this={customActionInput}
                       class="input input-bordered w-full" id="user-input"
                       placeholder="Enter your action">
                <button type="submit"
                        onclick="{() => {sendAction({text: customActionInput.value});}}"
                        class="btn btn-neutral" id="submit-button">Submit
                </button>
            </div>
        </form>
    {/if}

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
