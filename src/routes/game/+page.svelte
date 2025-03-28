<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import {
		type Action,
		defaultGameSettings,
		type GameActionState,
		GameAgent,
		type GameSettings,
		type InventoryState,
		type Item,
		type PlayerCharactersGameState
	} from '$lib/ai/agents/gameAgent';
	import { DifficultyAgent } from '$lib/ai/agents/difficultyAgent';
	import { onMount, tick } from 'svelte';
	import { getTextForActionButton, handleError, stringifyPretty } from '$lib/util.svelte';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import StoryProgressionWithImage from '$lib/components/StoryProgressionWithImage.svelte';
	import type { RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
	import { SummaryAgent } from '$lib/ai/agents/summaryAgent';
	import {
		type AiLevelUp,
		type CharacterStats,
		CharacterStatsAgent,
		initialCharacterStatsState,
		type NPCState
	} from '$lib/ai/agents/characterStatsAgent';
	import { errorState } from '$lib/state/errorState.svelte';
	import ErrorDialog from '$lib/components/interaction_modals/ErrorModal.svelte';
	import * as gameLogic from './gameLogic';
	import {
		ActionDifficulty,
		applyInventoryUpdate,
		getEmptyCriticalResourceKeys,
		isEnoughResource,
		mustRollDice
	} from './gameLogic';
	import * as combatLogic from './combatLogic';
	import UseSpellsAbilitiesModal from '$lib/components/interaction_modals/UseSpellsAbilitiesModal.svelte';
	import { CombatAgent } from '$lib/ai/agents/combatAgent';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import type { LLMMessage } from '$lib/ai/llm';
	import { initialStoryState, type Story } from '$lib/ai/agents/storyAgent';
	import { type CharacterDescription, initialCharacterState } from '$lib/ai/agents/characterAgent';
	import DiceRollComponent from '$lib/components/interaction_modals/DiceRollComponent.svelte';
	import UseItemsModal from '$lib/components/interaction_modals/UseItemsModal.svelte';
	import { type Campaign, CampaignAgent, type CampaignChapter } from '$lib/ai/agents/campaignAgent';
	import { ActionAgent } from '$lib/ai/agents/actionAgent';
	import LoadingIcon from '$lib/components/LoadingIcon.svelte';
	import TTSComponent from '$lib/components/TTSComponent.svelte';
	import { applyLevelUp, getXPNeededForLevel } from './levelLogic';
	import LevelUpModal from '$lib/components/interaction_modals/LevelUpModal.svelte';
	import { migrateIfApplicable } from '$lib/state/versionMigration';
	import ImpossibleActionModal from '$lib/components/interaction_modals/ImpossibleActionModal.svelte';
	import GMQuestionModal from '$lib/components/interaction_modals/GMQuestionModal.svelte';
	import SuggestedActionsModal from '$lib/components/interaction_modals/SuggestedActionsModal.svelte';
	import type { AIConfig } from '$lib';
	import ResourcesComponent from '$lib/components/ResourcesComponent.svelte';

	import { initializeMissingResources, refillResourcesFully } from './resourceLogic';
	import {
		advanceChapterIfApplicable,
		getGameMasterNotesForCampaignChapter,
		getNextChapterPrompt
	} from './campaignLogic';
	import { getRelatedHistory } from './memoryLogic';
	// eslint-disable-next-line svelte/valid-compile
	let diceRollDialog, useSpellsAbilitiesModal, useItemsModal, actionsDiv, customActionInput;

	//ai state
	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const temperatureState = useLocalStorage<number>('temperatureState');
	const customSystemInstruction = useLocalStorage<string>('customSystemInstruction');
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	let isAiGeneratingState = $state(false);
	let didAIProcessDiceRollActionState = useLocalStorage<boolean>('didAIProcessDiceRollAction');
	let didAIProcessActionState = useLocalStorage<boolean>('didAIProcessActionState', true);
	let gameAgent: GameAgent,
		difficultyAgent: DifficultyAgent,
		summaryAgent: SummaryAgent,
		characterStatsAgent: CharacterStatsAgent,
		combatAgent: CombatAgent,
		campaignAgent: CampaignAgent,
		actionAgent: ActionAgent;

	//game state
	const gameActionsState = useLocalStorage<GameActionState[]>('gameActionsState', []);
	const characterActionsState = useLocalStorage<Action[]>('characterActionsState', []);
	const historyMessagesState = useLocalStorage<LLMMessage[]>('historyMessagesState', []);
	const characterState = useLocalStorage<CharacterDescription>(
		'characterState',
		initialCharacterState
	);
	const characterStatsState = useLocalStorage<CharacterStats>(
		'characterStatsState',
		initialCharacterStatsState
	);
	const inventoryState = useLocalStorage<InventoryState>('inventoryState', {});
	const storyState = useLocalStorage<Story>('storyState', initialStoryState);
	const relatedStoryHistoryState = useLocalStorage<RelatedStoryHistory>(
		'relatedStoryHistoryState',
		{ relatedDetails: [] }
	);
	const relatedActionHistoryState = useLocalStorage<string[]>('relatedActionHistoryState', []);
	const customMemoriesState = useLocalStorage<string>('customMemoriesState');
	const customGMNotesState = useLocalStorage<string>('customGMNotesState');
	const currentChapterState = useLocalStorage<number>('currentChapterState');
	const campaignState = useLocalStorage<Campaign>('campaignState', {} as Campaign);

	const npcState = useLocalStorage<NPCState>('npcState', {});
	const chosenActionState = useLocalStorage<Action>('chosenActionState', {} as Action);
	const additionalStoryInputState = useLocalStorage<string>('additionalStoryInputState');
	const isGameEnded = useLocalStorage<boolean>('isGameEnded', false);
	let playerCharactersGameState: PlayerCharactersGameState = $state({});
	let levelUpState = useLocalStorage<{
		buttonEnabled: boolean;
		dialogOpened: boolean;
		playerName: string;
	}>('levelUpState', {
		buttonEnabled: false,
		dialogOpened: false,
		playerName: ''
	});
	const currentGameActionState: GameActionState = $derived(
		(gameActionsState.value && gameActionsState.value[gameActionsState.value.length - 1]) ||
			({} as GameActionState)
	);
	let actionsTextForTTS: string = $state('');
	//TODO const lastCombatSinceXActions: number = $derived(
	//	gameActionsState.value && (gameActionsState.value.length - (gameActionsState.value.findLastIndex(state => state.is_character_in_combat ) + 1))
	//);
	let customActionReceiver: 'Game Command' | 'Character Action' | 'GM Question' =
		$state('Character Action');
	let customActionImpossibleReasonState: 'not_enough_resource' | 'not_plausible' | undefined =
		$state(undefined);

	let gmQuestionState: string = $state('');
	let itemForSuggestActionsState: (Item & { item_id: string }) | undefined = $state();

	//feature toggles
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	let useDynamicCombat = useLocalStorage('useDynamicCombat', false);
	let gameSettingsState = useLocalStorage<GameSettings>('gameSettingsState', defaultGameSettings());
	const ttsVoiceState = useLocalStorage<string>('ttsVoice');

	onMount(async () => {
		const llm = LLMProvider.provideLLM(
			{
				temperature: temperatureState.value,
				language: aiLanguage.value,
				apiKey: apiKeyState.value
			},
			aiConfigState.value?.useFallbackLlmState
		);
		gameAgent = new GameAgent(llm);
		characterStatsAgent = new CharacterStatsAgent(llm);
		combatAgent = new CombatAgent(llm);
		difficultyAgent = new DifficultyAgent(llm);
		summaryAgent = new SummaryAgent(llm);
		campaignAgent = new CampaignAgent(llm);
		actionAgent = new ActionAgent(llm);

		characterStatsState.value = migrateIfApplicable(
			'characterStatsState',
			$state.snapshot(characterStatsState.value)
		);

		const currentCharacterName = characterState.value.name;

		// Initialize the player's resource state if it doesn't exist.
		playerCharactersGameState[currentCharacterName] = {
			...$state.snapshot(characterStatsState.value.resources),
			XP: { current_value: 0, max_value: 0, game_ends_when_zero: false }
		};
		if (relatedStoryHistoryState.value.relatedDetails.length === 0) {
			getRelatedHistoryForStory();
		}

		// Start game when not already started
		if (!currentGameActionState?.story) {
			await initializeGame();
		} else {
			await initializeGameFromSavedState();
		}
	});

	async function initializeGameFromSavedState() {
		// Apply previously saved game actions
		gameLogic.applyGameActionStates(
			playerCharactersGameState,
			npcState.value,
			inventoryState.value,
			$state.snapshot(gameActionsState.value)
		);
		const { updatedGameActionsState, updatedPlayerCharactersGameState } =
			initializeMissingResources(
				$state.snapshot(characterStatsState.value.resources),
				$state.snapshot(characterState.value.name),
				$state.snapshot(gameActionsState.value),
				$state.snapshot(playerCharactersGameState)
			);
		gameActionsState.value = updatedGameActionsState;
		playerCharactersGameState = updatedPlayerCharactersGameState;
		tick().then(() => customActionInput.scrollIntoView(false));
		if (characterActionsState.value.length === 0) {
			characterActionsState.value = await actionAgent.generateActions(
				currentGameActionState,
				historyMessagesState.value,
				storyState.value,
				characterState.value,
				characterStatsState.value,
				inventoryState.value,
				customSystemInstruction.value,
				await getRelatedHistory(
					summaryAgent,
					undefined,
					undefined,
					relatedStoryHistoryState.value,
					customMemoriesState.value
				)
			);
		}
		renderGameState(currentGameActionState, characterActionsState.value);
		if (!didAIProcessDiceRollActionState.value) {
			openDiceRollDialog(additionalStoryInputState.value);
		}
		checkForLevelUp();
	}

	async function initializeGame() {
		await sendAction({
			characterName: characterState.value.name,
			text: GameAgent.getStartingPrompt()
		});
		if (gameActionsState.value.length === 0) return;
		// Initialize all resources when the game is first started.
		const { updatedGameActionsState, updatedPlayerCharactersGameState } = refillResourcesFully(
			$state.snapshot(characterStatsState.value.resources),
			$state.snapshot(characterState.value.name),
			$state.snapshot(gameActionsState.value),
			$state.snapshot(playerCharactersGameState)
		);
		gameActionsState.value = updatedGameActionsState;
		playerCharactersGameState = updatedPlayerCharactersGameState;
	}

	//TODO applyGameActionState should not be handled here so it can be externally called
	async function getActionPromptForCombat(
		playerAction: Action,
		currentGameActionState: GameActionState,
		npcState: NPCState,
		inventoryState: InventoryState,
		customSystemInstruction: string,
		latestStoryMessages: LLMMessage[],
		storyState: Story,
		playerCharactersGameState: PlayerCharactersGameState,
		combatAgent: CombatAgent
	): Promise<{
		additionalStoryInput: string;
		determinedActionsAndStatsUpdate: ReturnType<typeof combatAgent.generateActionsFromContext>;
	}> {
		// Get details for all NPC targets based on the current game action state.
		const allNpcsDetailsAsList = gameLogic
			.getAllTargetsAsList(currentGameActionState.currently_present_npcs)
			.map((technicalNameId) => ({
				technicalNameId,
				...npcState[technicalNameId]
			}));

		// Compute the determined combat actions and stats update.
		const determinedActionsAndStatsUpdate = await combatAgent.generateActionsFromContext(
			playerAction,
			playerCharactersGameState[characterState.value.name],
			inventoryState,
			allNpcsDetailsAsList,
			customSystemInstruction,
			latestStoryMessages,
			storyState
		);

		// Apply the action state update on the playerCharactersGameState (and related states)
		// by passing a snapshot of the determined update.
		gameLogic.applyGameActionState(
			playerCharactersGameState,
			npcState,
			inventoryState,
			$state.snapshot(determinedActionsAndStatsUpdate)
		);

		// Filter to find the alive NPCs.
		const aliveNPCs = allNpcsDetailsAsList
			.filter((npc) => npc?.resources && npc.resources.current_hp > 0)
			.map((npc) => npc.technicalNameId);

		// Generate additional story input based on the combat results.
		const additionalStoryInput = CombatAgent.getAdditionalStoryInput(
			determinedActionsAndStatsUpdate.actions,
			[],
			aliveNPCs,
			playerCharactersGameState
		);

		return { additionalStoryInput, determinedActionsAndStatsUpdate };
	}

	function openDiceRollDialog(additionalStoryInput: string) {
		//TODO showModal can not be used because it hides the dice roll
		didAIProcessDiceRollActionState.value = false;
		diceRollDialog.show();
		diceRollDialog.addEventListener('close', function sendWithManuallyRolled() {
			diceRollDialog.removeEventListener('close', sendWithManuallyRolled);
			additionalStoryInput = diceRollDialog.returnValue + '\n' + (additionalStoryInput || '');
			sendAction(chosenActionState.value, false, additionalStoryInput);
		});
	}

	function handleAIError() {
		if (!didAIProcessDiceRollActionState.value) {
			openDiceRollDialog(additionalStoryInputState.value);
		}
	}

	async function handleImpossibleAction(tryAnyway: boolean) {
		if (tryAnyway) {
			if (customActionImpossibleReasonState === 'not_enough_resource') {
				chosenActionState.value = {
					...chosenActionState.value,
					action_difficulty:
						chosenActionState.value.action_difficulty === ActionDifficulty.simple
							? ActionDifficulty.medium
							: chosenActionState.value.action_difficulty,
					dice_roll: {
						modifier: chosenActionState.value.dice_roll!.modifier!,
						modifier_explanation:
							chosenActionState.value.dice_roll!.modifier_explanation! +
							` -3 for trying without enough ${chosenActionState.value.resource_cost?.resource_key?.replaceAll('_', ' ')}`,
						modifier_value: (chosenActionState.value.dice_roll?.modifier_value || 0) - 3
					}
				};
			}
			//either not enough resource or impossible, anyway no resource cost
			let costString = 'No resource cost';
			if (chosenActionState.value.resource_cost) {
				chosenActionState.value.resource_cost.cost = 0;
				costString = `\n${chosenActionState.value.resource_cost?.resource_key} cost: 0`;
			}
			if (additionalStoryInputState.value) {
				additionalStoryInputState.value += costString;
			} else {
				additionalStoryInputState.value = costString;
			}
			await sendAction(chosenActionState.value, true, additionalStoryInputState.value);
		}
		customActionInput.value = '';
		customActionImpossibleReasonState = undefined;
	}

	//TODO depends on getActionPromptForCombat
	async function getCombatAndNPCState(
		action: Action,
		isGameEnded: boolean,
		currentGameActionState: GameActionState,
		npcState: NPCState,
		inventoryState: InventoryState,
		customSystemInstruction: string,
		latestStoryMessages: LLMMessage[],
		storyState: Story,
		playerCharactersGameState: PlayerCharactersGameState,
		combatAgent: CombatAgent,
		useDynamicCombat: boolean
	): Promise<{
		additionalStoryInput: string;
		allCombatDeterminedActionsAndStatsUpdate?: ReturnType<
			typeof combatAgent.generateActionsFromContext
		>;
	}> {
		let deadNPCs: string[] = [];
		let additionalStoryInput = '';
		let allCombatDeterminedActionsAndStatsUpdate;
		if (!isGameEnded && currentGameActionState.is_character_in_combat) {
			additionalStoryInput += CombatAgent.getCombatPromptAddition();
			if (useDynamicCombat) {
				const combatObject = await getActionPromptForCombat(
					action,
					currentGameActionState,
					npcState,
					inventoryState,
					customSystemInstruction,
					latestStoryMessages,
					storyState,
					playerCharactersGameState,
					combatAgent
				);
				//dynamic combat already handled the getNPCsHealthStatePrompt
				additionalStoryInput += combatObject.additionalStoryInput;
				allCombatDeterminedActionsAndStatsUpdate = combatObject.determinedActionsAndStatsUpdate;
			}
		}
		deadNPCs = gameLogic.removeDeadNPCs(npcState);
		additionalStoryInput += CombatAgent.getNPCsHealthStatePrompt(deadNPCs);
		return { additionalStoryInput, allCombatDeterminedActionsAndStatsUpdate };
	}

	//TODO sendAction should not be handled here so it can be externally called
	async function checkGameEnded() {
		const emptyResourceKeys = getEmptyCriticalResourceKeys(
			playerCharactersGameState[characterState.value.name]
		);
		if (!isGameEnded.value && emptyResourceKeys.length > 0) {
			isGameEnded.value = true;
			await sendAction({
				characterName: characterState.value.name,
				text: GameAgent.getGameEndedPrompt(emptyResourceKeys)
			});
		}
	}

	function resetStatesAfterActionProcessed() {
		chosenActionState.reset();
		additionalStoryInputState.reset();
		characterActionsState.reset();
		relatedActionHistoryState.reset();
		relatedStoryHistoryState.reset();
		if (actionsDiv) actionsDiv.innerHTML = '';
		if (customActionInput) customActionInput.value = '';
		didAIProcessDiceRollActionState.value = true;
	}

	function checkForNewNPCs(newState: GameActionState) {
		const newNPCs = gameLogic.getNewNPCs(newState.currently_present_npcs, npcState.value);
		if (newNPCs.length > 0) {
			characterStatsAgent
				.generateNPCStats(
					storyState.value,
					getLatestStoryMessages(),
					newNPCs,
					characterStatsState.value,
					customSystemInstruction.value
				)
				.then((newState: NPCState) => {
					if (newState) {
						combatLogic.addResourceValues(newState);
						npcState.value = { ...npcState.value, ...newState };
						console.log(stringifyPretty(npcState.value));
					}
				});
		}
	}

	function checkForLevelUp() {
		const neededXP = getXPNeededForLevel(characterStatsState.value.level);
		if (
			neededXP &&
			playerCharactersGameState[characterState.value.name]?.XP.current_value >= neededXP
		) {
			levelUpState.value.buttonEnabled = true;
		}
	}

	function updateMessagesHistory(updatedHistoryMessages: Array<LLMMessage>) {
		historyMessagesState.value = updatedHistoryMessages;
	}

	async function addCampaignAdditionalStoryInput(action: Action, additionalStoryInput: string) {
		// If the game is played in campaign mode
		if (campaignState.value?.chapters?.length > 0) {
			//advance the chapter if applicable.
			const { newAdditionalStoryInput, newChapter } = await advanceChapterIfApplicable(
				action,
				additionalStoryInput,
				didAIProcessActionState.value,
				campaignState.value,
				currentChapterState.value,
				currentGameActionState,
				gameActionsState.value,
				campaignAgent,
				historyMessagesState.value
			);
			additionalStoryInput = newAdditionalStoryInput;

			if (newChapter) {
				currentChapterState.value += 1;
				currentGameActionState.currentPlotPoint = 'PLOT_ID: 1';
				const { prompt, updatedStory } = getNextChapterPrompt(
					campaignState.value,
					currentChapterState.value,
					storyState.value
				);
				additionalStoryInput += prompt;
				storyState.value = updatedStory;
			}
		}
		return additionalStoryInput;
	}

	// Helper to prepare additional story input by incorporating combat prompts
	async function prepareAdditionalStoryInput(
		action: Action,
		initialAdditionalStoryInput: string
	): Promise<{
		finalAdditionalStoryInput: string;
		combatAndNPCState: {
			additionalStoryInput: string;
			allCombatDeterminedActionsAndStatsUpdate?: ReturnType<
				typeof combatAgent.generateActionsFromContext
			>;
		};
	}> {
		let additionalStoryInput = initialAdditionalStoryInput || '';

		// Retrieve combat and NPC-related story additions.
		const combatAndNPCState = await getCombatAndNPCState(
			action,
			isGameEnded.value,
			currentGameActionState,
			npcState.value,
			inventoryState.value,
			customSystemInstruction.value,
			getLatestStoryMessages(),
			storyState.value,
			playerCharactersGameState,
			combatAgent,
			useDynamicCombat.value
		);
		// Combine combat-related additional story input.
		additionalStoryInput += combatAndNPCState.additionalStoryInput;

		additionalStoryInput = await addCampaignAdditionalStoryInput(action, additionalStoryInput);

		const gmNotes = getGameMasterNotesForCampaignChapter(
			getCurrentCampaignChapter(),
			currentGameActionState.currentPlotPoint
		);
		if (customGMNotesState.value) {
			gmNotes.unshift(customGMNotesState.value);
		}
		additionalStoryInput += GameAgent.getPromptForGameMasterNotes(gmNotes);

		// Add any extra side effects that should modify the story input.
		additionalStoryInput = gameLogic.addAdditionsFromActionSideeffects(
			action,
			additionalStoryInput
		);

		// Update the store for additional story input.
		additionalStoryInputState.value = additionalStoryInput;

		return { finalAdditionalStoryInput: additionalStoryInput, combatAndNPCState };
	}

	// Helper to process the AI story progression and update game state accordingly.
	async function processStoryProgression(
		action: Action,
		additionalStoryInput: string,
		relatedHistory: string[],
		combatAndNPCState: {
			additionalStoryInput: string;
			allCombatDeterminedActionsAndStatsUpdate?: ReturnType<
				typeof combatAgent.generateActionsFromContext
			>;
		}
	) {
		didAIProcessActionState.value = false;
		const { newState, updatedHistoryMessages } = await gameAgent.generateStoryProgression(
			action,
			additionalStoryInput,
			customSystemInstruction.value,
			historyMessagesState.value,
			storyState.value,
			characterState.value,
			playerCharactersGameState,
			inventoryState.value,
			relatedHistory,
			gameSettingsState.value
		);
		didAIProcessActionState.value = true;

		if (newState?.story) {
			// If combat provided a specific stat update, use it.
			if (combatAndNPCState.allCombatDeterminedActionsAndStatsUpdate) {
				newState.stats_update =
					combatAndNPCState.allCombatDeterminedActionsAndStatsUpdate.stats_update;
				applyInventoryUpdate(inventoryState.value, newState);
			} else {
				// Otherwise, apply the new state to the game state.
				gameLogic.applyGameActionState(
					playerCharactersGameState,
					npcState.value,
					inventoryState.value,
					$state.snapshot(newState)
				);
			}
			console.log('new state', stringifyPretty(newState));
			updateMessagesHistory(updatedHistoryMessages);
			checkForNewNPCs(newState);
			resetStatesAfterActionProcessed();

			// Let the summary agent shorten the history, if needed.
			const { newHistory, summary } = await summaryAgent.summarizeStoryIfTooLong(
				historyMessagesState.value
			);
			historyMessagesState.value = newHistory;
			// Append the new game state to the game actions.
			gameActionsState.value = [
				...gameActionsState.value,
				{
					...newState,
					id: gameActionsState.value.length
				}
			];
			await checkGameEnded();

			if (!isGameEnded.value) {
				getRelatedHistoryForStory();
				// Generate the next set of actions.
				actionAgent
					.generateActions(
						currentGameActionState,
						historyMessagesState.value,
						storyState.value,
						characterState.value,
						characterStatsState.value,
						inventoryState.value,
						customSystemInstruction.value,
						relatedHistory
					)
					.then((actions) => {
						if (actions) {
							console.log(stringifyPretty(actions));
							characterActionsState.value = actions;
							renderGameState(currentGameActionState, actions);
						}
					});
				checkForLevelUp();
			}
		}
	}

	function getRelatedHistoryForStory() {
		summaryAgent
			.retrieveRelatedHistory(currentGameActionState.story, gameActionsState.value, 2)
			.then((relatedHistory) => {
				if (relatedHistory) {
					relatedStoryHistoryState.value = relatedHistory;
				} else {
					relatedStoryHistoryState.reset();
				}
			});
	}

	// Main sendAction function that orchestrates the action processing.
	async function sendAction(action: Action, rollDice = false, additionalStoryInput = '') {
		try {
			if (rollDice) {
				if (relatedActionHistoryState.value.length === 0) {
					getRelatedHistory(
						summaryAgent,
						action,
						gameActionsState.value,
						$state.snapshot(relatedStoryHistoryState.value),
						$state.snapshot(customMemoriesState.value)
					).then((relatedHistory) => {
						relatedActionHistoryState.value = relatedHistory;
					});
				}
				openDiceRollDialog(additionalStoryInput);
			} else {
				isAiGeneratingState = true;

				// Prepare the additional story input (including combat and chapter info)
				const { finalAdditionalStoryInput, combatAndNPCState } = await prepareAdditionalStoryInput(
					action,
					additionalStoryInput
				);
				if (relatedActionHistoryState.value.length === 0) {
					relatedActionHistoryState.value = await getRelatedHistory(
						summaryAgent,
						action,
						gameActionsState.value,
						$state.snapshot(relatedStoryHistoryState.value),
						$state.snapshot(customMemoriesState.value)
					);
				}
				// Process the AI story progression and update game state
				await processStoryProgression(
					action,
					finalAdditionalStoryInput,
					relatedActionHistoryState.value,
					combatAndNPCState
				);

				isAiGeneratingState = false;
			}
		} catch (e) {
			isAiGeneratingState = false;
			handleError(e as string);
		}
	}

	function renderGameState(state: GameActionState, actions: Array<Action>) {
		if (!isGameEnded.value) {
			actions.forEach((action) =>
				addActionButton(action, state.is_character_in_combat, 'ai-gen-action')
			);
			actionsTextForTTS =
				Array.from(document.querySelectorAll('.ai-gen-action'))
					.map((elm) => elm.textContent || ' ')
					.join(' ') || ' ';
		}
	}

	function levelUpClicked(playerName: string) {
		levelUpState.value.playerName = playerName;
		const level = $state.snapshot(characterStatsState.value.level);
		const xpNeededForLevel = getXPNeededForLevel(level);
		if (!xpNeededForLevel) {
			handleError('Could not calculate XP needed for level up!');
			return;
		}
		const buyLevelUpObject = GameAgent.getLevelUpCostObject(xpNeededForLevel, playerName, level);
		playerCharactersGameState[playerName].XP.current_value -= xpNeededForLevel;
		gameActionsState.value[gameActionsState.value.length - 1].stats_update.push(buyLevelUpObject);
		levelUpState.value.dialogOpened = true;
	}

	function addActionButton(action: Action, is_character_in_combat?: boolean, addClass?: string) {
		if (!actionsDiv) {
			return;
		}
		const button = document.createElement('button');
		button.className = 'btn btn-neutral mb-3 w-full text-md';
		if (addClass) {
			button.className += ' ' + addClass;
		}
		button.textContent = getTextForActionButton(action);
		if (
			!isEnoughResource(
				action,
				playerCharactersGameState[characterState.value.name],
				inventoryState.value
			)
		) {
			button.disabled = true;
		}
		button.addEventListener('click', () => {
			chosenActionState.value = $state.snapshot(action);
			sendAction(
				chosenActionState.value,
				gameLogic.mustRollDice(chosenActionState.value, is_character_in_combat),
				additionalStoryInputState.value
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

	const onItemUseChosen = async (item: Action & Item & { item_id: string }) => {
		itemForSuggestActionsState = item;
	};

	const onTargetedSpellsOrAbility = async (action: Action, targets: string[]) => {
		isAiGeneratingState = true;
		let targetAddition = '';
		if (targets?.length > 0 && !targets.some((t) => t === undefined)) {
			targetAddition = targets?.length === 0 ? '' : gameLogic.getTargetPromptAddition(targets);
		}
		relatedActionHistoryState.value = await getRelatedHistory(
			summaryAgent,
			action,
			gameActionsState.value,
			$state.snapshot(relatedStoryHistoryState.value),
			$state.snapshot(customMemoriesState.value)
		);
		const difficultyResponse = await difficultyAgent.generateDifficulty(
			action.text + targetAddition,
			customSystemInstruction.value,
			getLatestStoryMessages(),
			characterState.value,
			characterStatsState.value,
			relatedActionHistoryState.value
		);
		if (difficultyResponse) {
			action = { ...action, ...difficultyResponse };
		}
		console.log('difficultyResponse', stringifyPretty(difficultyResponse));
		chosenActionState.value = action;
		const abilityAddition =
			'\n If this is a friendly action used on an enemy, play out the effect as described, even though the result may be unintended.' +
			'\n Hostile NPCs stay hostile unless explicitly described otherwise by the actions effect.' +
			'\n Friendly NPCs turn hostile if attacked.';

		additionalStoryInputState.value =
			targetAddition + abilityAddition + (additionalStoryInputState.value || '');
		await sendAction(
			action,
			gameLogic.mustRollDice(action, currentGameActionState.is_character_in_combat),
			additionalStoryInputState.value
		);
		isAiGeneratingState = false;
	};
	const onLevelUpModalClosed = (aiLevelUp: AiLevelUp) => {
		if (aiLevelUp) {
			characterStatsState.value = applyLevelUp(aiLevelUp, characterStatsState.value);
		} else {
			characterStatsState.value = {
				...characterStatsState.value,
				level: characterStatsState.value.level + 1
			};
		}
		levelUpState.reset();
		const { updatedGameActionsState, updatedPlayerCharactersGameState } = refillResourcesFully(
			$state.snapshot(characterStatsState.value.resources),
			$state.snapshot(characterState.value.name),
			$state.snapshot(gameActionsState.value),
			$state.snapshot(playerCharactersGameState)
		);
		gameActionsState.value = updatedGameActionsState;
		playerCharactersGameState = updatedPlayerCharactersGameState;
		checkForLevelUp();
	};

	const onSuggestItemActionClosed = (action?: Action) => {
		if (action) {
			if (action.is_custom_action) {
				generateActionFromCustomInput(action);
			} else {
				chosenActionState.value = $state.snapshot(action);
				sendAction(action, mustRollDice(action, currentGameActionState.is_character_in_combat));
			}
		}
		itemForSuggestActionsState = undefined;
	};

	const getCurrentCampaignChapter = (): CampaignChapter | undefined =>
		campaignState.value?.chapters.find(
			(chapter) => chapter.chapterId === currentChapterState.value
		);

	const generateActionFromCustomInput = async (action: Action) => {
		isAiGeneratingState = true;
		relatedActionHistoryState.value = await getRelatedHistory(
			summaryAgent,
			action,
			gameActionsState.value,
			$state.snapshot(relatedStoryHistoryState.value),
			$state.snapshot(customMemoriesState.value)
		);
		console.log(
			'relatedHistoryDetails',
			stringifyPretty($state.snapshot(relatedStoryHistoryState.value))
		);
		const generatedAction = await actionAgent.generateSingleAction(
			action,
			currentGameActionState,
			historyMessagesState.value,
			storyState.value,
			characterState.value,
			characterStatsState.value,
			inventoryState.value,
			customSystemInstruction.value,
			relatedActionHistoryState.value
		);
		console.log('action', stringifyPretty(generatedAction));
		action = { ...generatedAction, ...action };
		chosenActionState.value = action;
		if (action.is_possible === false) {
			customActionImpossibleReasonState = 'not_plausible';
		} else {
			if (
				!isEnoughResource(
					action,
					playerCharactersGameState[characterState.value.name],
					inventoryState.value
				)
			) {
				customActionImpossibleReasonState = 'not_enough_resource';
			} else {
				customActionImpossibleReasonState = undefined;
				await sendAction(
					action,
					gameLogic.mustRollDice(action, currentGameActionState.is_character_in_combat)
				);
			}
		}
		isAiGeneratingState = false;
	};

	const onCustomActionSubmitted = async () => {
		let action: Action = {
			characterName: characterState.value.name,
			text: customActionInput.value,
			is_custom_action: true
		};
		if (customActionReceiver === 'Character Action') {
			await generateActionFromCustomInput(action);
		}
		if (customActionReceiver === 'GM Question') {
			gmQuestionState = action.text;
		}
		if (customActionReceiver === 'Game Command') {
			await sendAction(
				action,
				false,
				'\nsudo: Ignore the rules and play out this action even if it should not be possible!\nIf this action contradicts the PAST STORY PLOT, adjust the narrative to fit the action.'
			);
		}
	};
	const onGMQuestionClosed = (closedByPlayer: boolean) => {
		if (closedByPlayer) {
			customActionInput.value = '';
		}
		gmQuestionState = '';
	};

	function onDeleteItem(item_id: string): void {
		delete inventoryState.value[item_id];
		if (gameActionsState.value[gameActionsState.value.length - 1].inventory_update) {
			gameActionsState.value[gameActionsState.value.length - 1].inventory_update.push({
				item_id,
				type: 'remove_item'
			});
		}
	}
</script>

<div id="game-container" class="container mx-auto p-4">
	{#if isAiGeneratingState}
		<LoadingModal></LoadingModal>
	{/if}
	{#if errorState.userMessage}
		<ErrorDialog onclose={handleAIError} />
	{/if}
	{#if customActionImpossibleReasonState}
		<ImpossibleActionModal action={chosenActionState.value} onclose={handleImpossibleAction} />
	{/if}
	{#if gmQuestionState}
		<GMQuestionModal
			onclose={onGMQuestionClosed}
			question={gmQuestionState}
			{playerCharactersGameState}
		/>
	{/if}
	<UseSpellsAbilitiesModal
		bind:dialogRef={useSpellsAbilitiesModal}
		playerName={characterState.value.name}
		resources={playerCharactersGameState[characterState.value.name]}
		abilities={characterStatsState.value?.spells_and_abilities}
		storyImagePrompt={storyState.value.general_image_prompt}
		targets={currentGameActionState.currently_present_npcs}
		onclose={onTargetedSpellsOrAbility}
	></UseSpellsAbilitiesModal>
	<UseItemsModal
		bind:dialogRef={useItemsModal}
		{onDeleteItem}
		playerName={characterState.value.name}
		inventoryState={inventoryState.value}
		storyImagePrompt={storyState.value.general_image_prompt}
		onclose={onItemUseChosen}
	></UseItemsModal>
	{#if itemForSuggestActionsState}
		<SuggestedActionsModal
			onclose={onSuggestItemActionClosed}
			resources={playerCharactersGameState[characterState.value.name]}
			{itemForSuggestActionsState}
			{currentGameActionState}
		/>
	{/if}
	{#if levelUpState.value?.dialogOpened}
		<LevelUpModal onclose={onLevelUpModalClosed} />
	{/if}
	<DiceRollComponent
		bind:diceRollDialog
		action={chosenActionState.value}
		resetState={didAIProcessDiceRollActionState.value}
	></DiceRollComponent>
	<ResourcesComponent
		resources={playerCharactersGameState[characterState.value.name]}
		currentLevel={characterStatsState.value?.level}
	/>
	<div id="story" class="mt-4 justify-items-center rounded-lg bg-base-100 p-4 shadow-md">
		<!-- For proper updating, need to use gameActionsState.id as each block id -->
		{#each gameActionsState.value.slice(-3) as gameActionState (gameActionState.id)}
			<StoryProgressionWithImage
				story={gameActionState.story}
				imagePrompt="{gameActionState.image_prompt} {storyState.value.general_image_prompt}"
				gameUpdates={gameLogic
					.renderStatUpdates(
						$state.snapshot(gameActionState.stats_update),
						playerCharactersGameState[characterState.value.name],
						characterState.value.name
					)
					.concat(gameLogic.renderInventoryUpdate(gameActionState.inventory_update))}
			/>
			{#if gameActionState['fallbackUsed']}
				<small class="text-sm text-red-500"> For this action the fallback LLM was used.</small>
			{/if}
		{/each}
		{#if isGameEnded.value}
			<StoryProgressionWithImage story={gameLogic.getGameEndedMessage()} />
		{/if}
	</div>

	{#if !aiConfigState.value?.disableAudioState}
		<div class="mt-4 flex">
			<TTSComponent
				text={actionsTextForTTS}
				voice={ttsVoiceState.value}
				hidden={characterActionsState.value?.length === 0}
			></TTSComponent>
		</div>
	{/if}
	<div id="actions" bind:this={actionsDiv} class="mt-2 p-4 pb-0 pt-0"></div>
	{#if Object.keys(currentGameActionState).length !== 0}
		{#if !isGameEnded.value}
			{#if characterActionsState.value?.length === 0}
				<div class="flex flex-col">
					<span class="m-auto">Generating next actions...</span>
					<div class="m-auto">
						<LoadingIcon />
					</div>
				</div>
			{/if}
			<div id="static-actions" class="p-4 pb-0 pt-0">
				<button
					onclick={() =>
						sendAction({
							characterName: characterState.value.name,
							text: 'Continue The Tale'
						})}
					class="text-md btn btn-neutral mb-3 w-full"
					>Continue The Tale.
				</button>

				{#if levelUpState.value.buttonEnabled}
					<button
						onclick={() => {
							levelUpClicked(characterState.value.name);
						}}
						class="text-md btn btn-success mb-3 w-full"
						>Level up!
					</button>
				{/if}
				<button
					onclick={() => {
						useSpellsAbilitiesModal.showModal();
					}}
					class="text-md btn btn-primary w-full"
					>Spells & Abilities
				</button>
				<button
					onclick={() => {
						useItemsModal.showModal();
					}}
					class="text-md btn btn-primary mt-3 w-full"
					>Inventory
				</button>
			</div>
		{/if}
		<form id="input-form" class="p-4 pb-2">
			<div class="w-full lg:join">
				<select bind:value={customActionReceiver} class="select select-bordered w-full lg:w-fit">
					<option selected>Character Action</option>
					<option>Game Command</option>
					<option>GM Question</option>
				</select>
				<input
					type="text"
					bind:this={customActionInput}
					class="input input-bordered w-full"
					id="user-input"
					placeholder={customActionReceiver === 'Character Action'
						? 'What do you want to do?'
						: customActionReceiver === 'GM Question'
							? 'Message to the Game Master'
							: 'Command without restrictions'}
				/>
				<button
					type="submit"
					onclick={onCustomActionSubmitted}
					class="btn btn-neutral w-full lg:w-1/4"
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
