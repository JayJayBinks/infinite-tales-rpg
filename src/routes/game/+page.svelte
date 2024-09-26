<script>
    import useLocalStorage from "$lib/state/useLocalStorage.svelte.ts";
    import {GameAgent} from "$lib/ai/agents/gameAgent.ts";
    import {DifficultyAgent} from "$lib/ai/agents/difficultyAgent.ts";

    import {onMount, tick} from "svelte";
    import {GeminiProvider} from "$lib/ai/llmProvider.ts";
    import {handleError, stringifyPretty} from "$lib/util.svelte.ts";
    import LoadingModal from "$lib/components/LoadingModal.svelte";
    import StoryProgressionWithImage from "$lib/components/StoryProgressionWithImage.svelte";
    import {initialCharacterState, initialCharacterStatsState, initialStoryState} from "$lib/state/initialStates.ts";
    import {SummaryAgent} from "$lib/ai/agents/summaryAgent.ts";
    import {CharacterStatsAgent} from "$lib/ai/agents/characterStatsAgent.ts";
    import {errorState} from "$lib/state/errorState.svelte.ts";
    import ErrorDialog from "$lib/components/ErrorModal.svelte";
    import DiceBox from "@3d-dice/dice-box";
    import * as gameLogic from "./gameLogic.ts";
    import * as combatLogic from "./combatLogic.ts";
    import * as diceRollLogic from "./diceRollLogic.ts";
    import {goto} from "$app/navigation";
    import UseSpellsAbilitiesModal from "$lib/components/UseSpellsAbilitiesModal.svelte";
    import {CombatAgent} from "$lib/ai/agents/combatAgent.ts";

    let diceBox, svgDice;
    let diceRollDialog, useSpellsAbilitiesModal, storyDiv, actionsDiv, customActionInput = {};

    const gameActionsState = useLocalStorage('gameActionsState', []);
    const historyMessagesState = useLocalStorage('historyMessagesState', []);
    const characterState = useLocalStorage('characterState', initialCharacterState);
    const characterStatsState = useLocalStorage('characterStatsState', initialCharacterStatsState);
    const storyState = useLocalStorage('storyState', initialStoryState);
    const npcState = useLocalStorage('npcState', {});

    const apiKeyState = useLocalStorage('apiKeyState');
    const temperatureState = useLocalStorage('temperatureState', 1.3);
    const customSystemInstruction = useLocalStorage('customSystemInstruction');
    const aiLanguage = useLocalStorage('aiLanguage');

    let didAIProcessDiceRollAction = useLocalStorage('didAIProcessDiceRollAction', true);
    let chosenActionState = useLocalStorage('chosenActionState', {});
    let isGameEnded = useLocalStorage('isGameEnded', false);
    let isAiGeneratingState = $state(false);

    const difficultyState = useLocalStorage('difficultyState', 'Default');
    let diceRollRequiredValueState = $derived(diceRollLogic.getRequiredValue(chosenActionState.value?.action_difficulty, difficultyState.value));
    let modifierReasonState = $derived(chosenActionState.value?.dice_roll?.modifier_explanation);
    let modifierState = $derived(Number.parseInt(chosenActionState.value?.dice_roll?.modifier_value) || 0);
    let rolledValueState = useLocalStorage('rolledValueState');
    let rollDifferenceHistoryState = useLocalStorage('rollDifferenceHistoryState', []);
    let useKarmicDice = useLocalStorage('useKarmicDice', true);
    let karmaModifierState = $derived(!useKarmicDice.value ? 0 : diceRollLogic.getKarmaModifier(rollDifferenceHistoryState.value, diceRollRequiredValueState));

    let diceRollResultState = $derived(diceRollLogic.determineDiceRollResult(diceRollRequiredValueState, rolledValueState.value, modifierState + karmaModifierState))
    let derivedGameState = $state({currentHP: 0, currentMP: 0})
    const currentGameActionState = $derived((gameActionsState.value && gameActionsState.value[gameActionsState.value.length - 1]) || {});

    let gameAgent, difficultyAgent, summaryAgent, characterStatsAgent, combatAgent;

    onMount(async () => {
        if (!apiKeyState.value) {
            errorState.userMessage = 'Please enter your Google Gemini API Key first in the settings.'
            goto('game/settings/ai');
            return;
        }
        diceBox = new DiceBox("#dice-box", {
            assetPath: "/assets/dice-box/", // required
        });
        diceBox.init();

        const geminiProvider = new GeminiProvider(apiKeyState.value, temperatureState.value, aiLanguage.value, customSystemInstruction.value);
        gameAgent = new GameAgent(geminiProvider);
        characterStatsAgent = new CharacterStatsAgent(geminiProvider);
        combatAgent = new CombatAgent(geminiProvider);
        difficultyAgent = new DifficultyAgent(geminiProvider);
        summaryAgent = new SummaryAgent(geminiProvider);
        //Start game when not already started
        if (gameActionsState.value.length === 0) {
            await sendAction({
                text: gameAgent.getStartingPrompt()
            });
        } else {
            gameLogic.applyGameActionStates(derivedGameState, npcState.value, gameActionsState.value);
            await renderGameState(currentGameActionState);
            tick().then(() => customActionInput.scrollIntoView(false));
        }
        if (!didAIProcessDiceRollAction.value) {
            openDiceRollDialog();
        }
    });

    function getAllTargetsAsList(targets) {
        if (!targets) {
            return []
        }
        return [...targets.hostile, ...targets.neutral, ...targets.friendly];
    }

    //TODO extract prompts to different file
    async function getActionPromptForCombat(playerAction) {
        const allNpcsDetailsAsList = getAllTargetsAsList(currentGameActionState.targets)
            .map(npcName => ({
                nameId: npcName,
                ...npcState.value[npcName],
            }));
        const allResources = allNpcsDetailsAsList
            .map(npc => ({
                nameId: npc.nameId,
                resources: npc.resources
            }));
        allResources.push({
            nameId: 'player_character',
            resources: derivedGameState
        })

        let determinedActionsAndStatsUpdate = await combatAgent.generateActionsFromContext(playerAction.text, allNpcsDetailsAsList,
            customSystemInstruction.value, getLatestStoryMessages(), storyState.value);

        //need to apply already here to have most recent allResources
        gameLogic.applyStatsUpdate(derivedGameState, npcState.value, determinedActionsAndStatsUpdate);
        let deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
        let aliveNPCs = allNpcsDetailsAsList.filter(npc => npc.resources.current_hp > 0).map(npc => npc.nameId);
        let healthStatePrompt = getNPCsHealthStatePrompt(deadNPCs, aliveNPCs);
        let bossPrompt = allNpcsDetailsAsList.some(npc => npc.rank = 'Boss')

        //TODO include this to provide actions for current health?
        // "\n\nMost important! NPCs and CHARACTER only die if their current_hp falls to 0. Current resources:\n" + stringifyPretty(allResources) +
        let additionalActionInput = "\nNPCs can never be finished off with a single attack!" +
            "\nYou must not apply stats_update for this actions, as this was already done!" +
            "\nYou must not apply stats_update for this actions, as this was already done!" +
            "\nDescribe the following actions in the story progression:\n" + stringifyPretty(determinedActionsAndStatsUpdate.actions) +
            "\n\nMost important! " + healthStatePrompt

        return {additionalActionInput, determinedActionsAndStatsUpdate};
    }

    function getNPCsHealthStatePrompt(deadNPCs, aliveNPCs) {
        let text = ''
        if (aliveNPCs && aliveNPCs.length > 0) {
            text += '\n ' + "Following NPCs are alive!" +
                "\n" + stringifyPretty(aliveNPCs)
        }
        if (deadNPCs && deadNPCs.length > 0) {
            text += '\n ' + "Following NPCs have died, describe their death in the story progression." +
                "\n" + stringifyPretty(deadNPCs)
        }
        return text;
    }

    function openDiceRollDialog() {
        //TODO showModal can not be used because it hides the dice roll
        didAIProcessDiceRollAction.value = false;
        diceRollDialog.show();
        diceRollDialog.addEventListener('close', function sendWithManuallyRolled() {
            this.removeEventListener('close', sendWithManuallyRolled);
            let actionText = chosenActionState.value.text + '\n ' + diceRollDialog.returnValue;
            sendAction({text: actionText});
            rollDifferenceHistoryState.value = [...rollDifferenceHistoryState.value.slice(-2),
                (rolledValueState.value + modifierState + karmaModifierState) - diceRollRequiredValueState];
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
                //const slowStory = '\n Ensure that the narrative unfolds gradually, building up anticipation and curiosity before moving towards any major revelations or climactic moments.'
                // + slowStory
                let deadNPCs, additionalActionInput, allCombatDeterminedActionsAndStatsUpdate;
                if (!isGameEnded.value && currentGameActionState.is_character_in_combat) {
                    let combatObject = await getActionPromptForCombat(action);
                    additionalActionInput = combatObject.additionalActionInput;
                    allCombatDeterminedActionsAndStatsUpdate = combatObject.determinedActionsAndStatsUpdate;
                } else {
                    deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
                    additionalActionInput = getNPCsHealthStatePrompt(deadNPCs);
                }
                console.log(action.text, additionalActionInput);
                const newState = await gameAgent.generateStoryProgression(action.text, additionalActionInput, customSystemInstruction.value, historyMessagesState.value,
                    storyState.value, characterState.value, characterStatsState.value, derivedGameState);

                if (newState) {
                    if (allCombatDeterminedActionsAndStatsUpdate) {
                        //override the gameActionsState stat update with the combat one
                        newState.stats_update = allCombatDeterminedActionsAndStatsUpdate.stats_update;
                    } else {
                        //StatsUpdate did not come from combat agent
                        gameLogic.applyStatsUpdate(derivedGameState, npcState.value, newState);
                    }
                    const {userMessage, modelMessage} = gameAgent.buildHistoryMessages(action.text, newState);
                    console.log(stringifyPretty(newState))
                    historyMessagesState.value = [...historyMessagesState.value, userMessage, modelMessage];

                    const newNPCs = getAllTargetsAsList(newState.targets).filter(newNPC => !Object.keys(npcState.value).includes(newNPC));
                    if (newNPCs.length > 0) {
                        characterStatsAgent.generateNPCStats(storyState.value, getLatestStoryMessages(), newNPCs)
                            .then(newState => {
                                combatLogic.addResourceValues(newState);
                                npcState.value = {...npcState.value, ...newState}
                                console.log(stringifyPretty(npcState.value));
                            });
                    }

                    chosenActionState.reset();
                    rolledValueState.reset();
                    customActionInput.value = '';
                    didAIProcessDiceRollAction.value = true;
                    //ai can more easily remember the middle part and prevents undesired writing style, action values etc...
                    historyMessagesState.value = await summaryAgent.summarizeStoryIfTooLong(historyMessagesState.value);
                    gameActionsState.value = [...gameActionsState.value, {
                        ...newState,
                        id: gameActionsState.value.length
                    }];
                    await renderGameState(newState);
                }
                isAiGeneratingState = false;
            }
        } catch (e) {
            isAiGeneratingState = false;
            handleError(e);
        }
    }

    async function renderGameState(state, addContinueStory = true) {
        const hp = derivedGameState.currentHP;
        if (!isGameEnded.value && hp <= 0) {
            isGameEnded.value = true;
            await sendAction({
                text: 'The CHARACTER has fallen to 0 HP. Describe how this tale ends.'
            })
        }
        isGameEnded.value = hp <= 0;
        if (actionsDiv) {
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
    }

    function addActionButton(action, is_character_in_combat) {
        const button = document.createElement('button');
        button.className = 'btn btn-neutral mb-3 w-full text-md ';
        const mpCost = parseInt(action.mp_cost) || 0;
        const isEnoughMP = mpCost === 0 || derivedGameState.currentMP >= mpCost;
        if (mpCost > 0 && !action.text.includes("MP")) {
            action.text += " (" + mpCost + " MP)";
        }
        button.textContent = action.text;
        //TODO only for debugging, remove before release,
        button.textContent += "   " + action.action_difficulty;
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
        const historyMessages = historyMessagesState.value.slice(numOfActions * -2);
        return historyMessages.map(message => {
            try {
                return {...message, content: JSON.parse(message.content).story};
            } catch (e) {
                return message;
            }
        })
    }

    const onTargetedSpellsOrAbility = async (action, targets) => {
        action.text += '\n' + gameLogic.getTargetText(targets);

        isAiGeneratingState = true;
        const difficultyResponse = await difficultyAgent.generateDifficulty(action.text,
            customSystemInstruction.value, getLatestStoryMessages(), characterState.value, characterStatsState.value);
        if (difficultyResponse) {
            action = {...action, ...difficultyResponse}
        }
        console.log('difficultyResponse', stringifyPretty(difficultyResponse));
        chosenActionState.value = action;
        await sendAction(action,
            gameLogic.mustRollDice(action, currentGameActionState.is_character_in_combat));
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
        {#each gameActionsState.value.slice(-3) as gameActionState, i (gameActionState.id)}
            <StoryProgressionWithImage story={gameActionState.story}
                                       imagePrompt="{gameActionState.image_prompt} {storyState.value.general_image_prompt}"
                                       statsUpdates={gameActionState.id === 0 ? [] :
                                       gameLogic.renderStatUpdates(gameActionState.stats_update, npcState.value)}
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
                        onclick="{(evt) => {useSpellsAbilitiesModal.showModal();}}"
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
                        onclick="{(evt) => {sendAction({text: customActionInput.value});}}"
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
