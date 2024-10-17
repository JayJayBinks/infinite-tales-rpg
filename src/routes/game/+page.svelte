<script lang="ts">
	import useLocalStorage from '$lib/state/useLocalStorage.svelte';
	import type { Action, DerivedGameState, GameActionState } from '$lib/ai/agents/gameAgent';
	import { GameAgent } from '$lib/ai/agents/gameAgent';
	import { DifficultyAgent } from '$lib/ai/agents/difficultyAgent';

	import { onMount, tick } from 'svelte';
	import { handleError, stringifyPretty } from '$lib/util.svelte';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import StoryProgressionWithImage from '$lib/components/StoryProgressionWithImage.svelte';
	import { SummaryAgent } from '$lib/ai/agents/summaryAgent';
	import {
		CharacterStatsAgent,
		initialCharacterStatsState,
		type NPCState
	} from '$lib/ai/agents/characterStatsAgent';
	import { errorState } from '$lib/state/errorState.svelte';
	import ErrorDialog from '$lib/components/ErrorModal.svelte';
	import * as gameLogic from './gameLogic';
	import * as combatLogic from './combatLogic';
	import UseSpellsAbilitiesModal from '$lib/components/UseSpellsAbilitiesModal.svelte';
	import { CombatAgent } from '$lib/ai/agents/combatAgent';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import type { LLMMessage } from '$lib/ai/llm';
	import { initialStoryState } from '$lib/ai/agents/storyAgent';
	import { initialCharacterState } from '$lib/ai/agents/characterAgent';
	import DiceRollComponent from '$lib/components/DiceRollComponent.svelte';

	// eslint-disable-next-line svelte/valid-compile
	let diceRollDialog, useSpellsAbilitiesModal, actionsDiv, customActionInput;

	//ai state
	const apiKeyState = useLocalStorage('apiKeyState');
	const temperatureState = useLocalStorage('temperatureState');
	const customSystemInstruction = useLocalStorage('customSystemInstruction');
	const aiLanguage = useLocalStorage('aiLanguage');
	let isAiGeneratingState = $state(false);
	let didAIProcessDiceRollActionState = useLocalStorage('didAIProcessDiceRollAction');
	let gameAgent, difficultyAgent, summaryAgent, characterStatsAgent, combatAgent;

	//game state
	const gameActionsState = useLocalStorage('gameActionsState', []);
	const historyMessagesState = useLocalStorage('historyMessagesState', []);
	const characterState = useLocalStorage('characterState', initialCharacterState);
	const characterStatsState = useLocalStorage('characterStatsState', initialCharacterStatsState);
	const storyState = useLocalStorage('storyState', initialStoryState);
	const npcState = useLocalStorage('npcState', {});
	const chosenActionState = useLocalStorage('chosenActionState', {});
	const additionalActionInputState = useLocalStorage('additionalActionInputState');
	const isGameEnded = useLocalStorage('isGameEnded', false);
	let derivedGameState = $state({ currentHP: 0, currentMP: 0 });
	const currentGameActionState: GameActionState = $derived(
		(gameActionsState.value && gameActionsState.value[gameActionsState.value.length - 1]) || {}
	);

	//feature toggles
	let useDynamicCombat = useLocalStorage('useDynamicCombat', true);

	onMount(async () => {
		const llm = LLMProvider.provideLLM({
			temperature: temperatureState.value,
			language: aiLanguage.value,
			apiKey: apiKeyState.value
		});

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
		if (!didAIProcessDiceRollActionState.value) {
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
		gameActionsState.value.push(startingResourcesUpdateObject);
	}

	async function getActionPromptForCombat(playerAction: Action) {
		const allNpcsDetailsAsList = gameLogic
			.getAllTargetsAsList(currentGameActionState.targets)
			.map((npcName) => ({
				nameId: npcName,
				...npcState.value[npcName]
			}));

		const determinedActionsAndStatsUpdate = await combatAgent.generateActionsFromContext(
			playerAction.text,
			allNpcsDetailsAsList,
			customSystemInstruction.value,
			getLatestStoryMessages(),
			storyState.value
		);

		//need to apply already here to have most recent allResources
		gameLogic.applyStatsUpdate(derivedGameState, npcState.value, determinedActionsAndStatsUpdate);
		const deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
		const aliveNPCs = allNpcsDetailsAsList
			.filter((npc) => npc.resources.current_hp > 0)
			.map((npc) => npc.nameId);

		let additionalActionInput = combatAgent.getAdditionalActionInput(
			determinedActionsAndStatsUpdate.actions,
			deadNPCs,
			aliveNPCs,
			derivedGameState
		);
		return { additionalActionInput, determinedActionsAndStatsUpdate };
	}

	function openDiceRollDialog(additionalActionInput: string) {
		//TODO showModal can not be used because it hides the dice roll
		didAIProcessDiceRollActionState.value = false;
		diceRollDialog.show();
		diceRollDialog.addEventListener('close', function sendWithManuallyRolled() {
			diceRollDialog.removeEventListener('close', sendWithManuallyRolled);
			let actionText = chosenActionState.value.text + '\n ' + diceRollDialog.returnValue;
			sendAction({ text: actionText }, false, additionalActionInput);
		});
	}

	function handleAIError() {
		if (!didAIProcessDiceRollActionState.value) {
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
		return { additionalActionInput, allCombatDeterminedActionsAndStatsUpdate };
	}

	async function checkGameEnded() {
		const hp = derivedGameState.currentHP;
		if (!isGameEnded.value && hp <= 0) {
			isGameEnded.value = true;
			await sendAction({
				text: gameAgent.getGameEndedPrompt()
			});
		}
		isGameEnded.value = hp <= 0;
	}

	function resetStatesAfterActionProcessed() {
		chosenActionState.reset();
		additionalActionInputState.reset();
		customActionInput.value = '';
		didAIProcessDiceRollActionState.value = true;
	}

	function checkForNewNPCs(newState: GameActionState) {
		const newNPCs = gameLogic.getNewNPCs(newState.targets, npcState.value);
		if (newNPCs.length > 0) {
			characterStatsAgent
				.generateNPCStats(
					storyState.value,
					getLatestStoryMessages(),
					newNPCs,
					customSystemInstruction.value
				)
				.then((newState: NPCState) => {
					combatLogic.addResourceValues(newState);
					npcState.value = { ...npcState.value, ...newState };
					console.log(stringifyPretty(npcState.value));
				});
		}
	}

	function updateMessagesHistory(action: Action, newState: GameActionState) {
		const { userMessage, modelMessage } = gameAgent.buildHistoryMessages(action.text, newState);
		console.log(stringifyPretty(newState));
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
				const newState = await gameAgent.generateStoryProgression(
					action.text,
					additionalActionInput,
					customSystemInstruction.value,
					historyMessagesState.value,
					storyState.value,
					characterState.value,
					characterStatsState.value,
					derivedGameState
				);

				if (newState) {
					if (combatAndNPCState.allCombatDeterminedActionsAndStatsUpdate) {
						//override the gameActionsState stat update with the combat one
						newState.stats_update =
							combatAndNPCState.allCombatDeterminedActionsAndStatsUpdate.stats_update;
					} else {
						//StatsUpdate did not come from combat agent
						gameLogic.applyStatsUpdate(derivedGameState, npcState.value, newState);
					}
					updateMessagesHistory(action, newState);
					checkForNewNPCs(newState);
					resetStatesAfterActionProcessed();
					//ai can more easily remember the middle part and prevents undesired writing style, action values etc...
					historyMessagesState.value = await summaryAgent.summarizeStoryIfTooLong(
						historyMessagesState.value
					);
					gameActionsState.value = [
						...gameActionsState.value,
						{
							...newState,
							id: gameActionsState.value.length
						}
					];
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
			state.actions.forEach((action) => addActionButton(action, state.is_character_in_combat));
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
		if (mpCost > 0 && !action.text.includes('MP')) {
			action.text += ' (' + mpCost + ' MP)';
		}
		button.textContent = action.text;
		if (!isEnoughMP) {
			button.disabled = true;
		}
		button.addEventListener('click', () => {
			chosenActionState.value = $state.snapshot(action);
			sendAction(
				chosenActionState.value,
				gameLogic.mustRollDice(chosenActionState.value, is_character_in_combat)
			);
		});
		actionsDiv.appendChild(button);
	}

	function getLatestStoryMessages(numOfActions = 2) {
		const historyMessages: LLMMessage[] = historyMessagesState.value.slice(numOfActions * -2);
		return historyMessages.map((message) => {
			try {
				return { ...message, content: JSON.parse(message.content).story };
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
			} catch (e) {
				return message;
			}
		});
	}

	const onTargetedSpellsOrAbility = async (action: Action, targets: string[]) => {
		isAiGeneratingState = true;
		const difficultyResponse = await difficultyAgent.generateDifficulty(
			action.text,
			customSystemInstruction.value,
			getLatestStoryMessages(),
			characterState.value,
			characterStatsState.value
		);
		if (difficultyResponse) {
			action = { ...action, ...difficultyResponse };
		}
		console.log('difficultyResponse', stringifyPretty(difficultyResponse));
		chosenActionState.value = action;
		await sendAction(
			action,
			gameLogic.mustRollDice(action, currentGameActionState.is_character_in_combat),
			gameLogic.getTargetPromptAddition(targets)
		);
		isAiGeneratingState = false;
	};
</script>

<!--TODO refactor to component with dialog-->

<div id="game-container" class="container mx-auto p-4">
	{#if isAiGeneratingState}
		<LoadingModal></LoadingModal>
	{/if}
	{#if errorState.userMessage}
		<ErrorDialog onclose={handleAIError} />
	{/if}
	<UseSpellsAbilitiesModal
		bind:dialogRef={useSpellsAbilitiesModal}
		currentMP={derivedGameState.currentMP}
		abilities={characterStatsState.value?.spells_and_abilities}
		targets={currentGameActionState.targets}
		onclose={onTargetedSpellsOrAbility}
	></UseSpellsAbilitiesModal>

	<DiceRollComponent
		bind:diceRollDialog
		action={chosenActionState.value}
		resetState={didAIProcessDiceRollActionState.value}
	></DiceRollComponent>
	<div class="menu menu-horizontal sticky top-0 z-10 flex justify-between bg-base-200">
		<output id="hp" class="ml-1 text-lg font-semibold text-red-500">
			HP: {derivedGameState.currentHP}</output
		>
		<output id="mp" class="ml-1 text-lg font-semibold text-blue-500">
			MP: {derivedGameState.currentMP}</output
		>
	</div>
	<div id="story" class="mt-4 rounded-lg bg-base-100 p-4 shadow-md">
		<!-- For proper updating, need to use gameActionsState.id as each block id -->
		{#each gameActionsState.value
			.filter((s) => s.story)
			.slice(-3) as gameActionState (gameActionState.id)}
			<StoryProgressionWithImage
				story={gameActionState.story}
				imagePrompt="{gameActionState.image_prompt} {storyState.value.general_image_prompt}"
				statsUpdates={gameActionState.id === 0
					? []
					: gameLogic.renderStatUpdates(gameActionState.stats_update)}
			/>
		{/each}
		{#if isGameEnded.value}
			<StoryProgressionWithImage story={gameLogic.getGameEndedMessage()} />
		{/if}
	</div>
	<div id="actions" bind:this={actionsDiv} class="mt-4 p-4 pb-0"></div>
	{#if Object.keys(currentGameActionState).length !== 0}
		{#if !isGameEnded.value}
			<div id="static-actions" class="p-4 pb-0 pt-0">
				<button
					onclick={() => {
						useSpellsAbilitiesModal.showModal();
					}}
					class="text-md btn btn-primary w-full"
					>Spells & Abilities
				</button>
			</div>
		{/if}
		<form id="input-form" class="p-4 pb-2">
			<div class="join w-full">
				<input
					type="text"
					bind:this={customActionInput}
					class="input input-bordered w-full"
					id="user-input"
					placeholder="Enter your action"
				/>
				<button
					type="submit"
					onclick={() => {
						sendAction({ text: customActionInput.value });
					}}
					class="btn btn-neutral"
					id="submit-button"
					>Submit
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
