<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import {
		type Action,
		defaultGameSettings,
		type GameActionState,
		GameAgent,
		type GameMasterAnswer,
		type GameSettings,
		type InventoryState,
		type Item,
		type NPCAction,
		type PlayerCharactersGameState,
		type PlayerCharactersIdToNamesMap,
		SUDO_COMMAND
	} from '$lib/ai/agents/gameAgent';
	import { onMount, tick } from 'svelte';
	import {
		getTextForActionButton,
		handleError,
		initialThoughtsState,
		stringifyPretty,
		type ThoughtsState
	} from '$lib/util.svelte';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import type { RelatedStoryHistory } from '$lib/ai/agents/summaryAgent';
	import { SummaryAgent } from '$lib/ai/agents/summaryAgent';
	import {
		type Ability,
		type AiLevelUp,
		type CharacterStats,
		CharacterStatsAgent,
		initialCharacterStatsState,
		type NPCState,
		type SkillsProgression
	} from '$lib/ai/agents/characterStatsAgent';
	import { errorState } from '$lib/state/errorState.svelte';
	import ErrorDialog from '$lib/components/interaction_modals/ErrorModal.svelte';
	import * as gameLogic from './gameLogic';
	import * as npcLogic from './npcLogic';
	import {
		ActionDifficulty,
		getEmptyCriticalResourceKeys,
		isEnoughResource,
		mustRollDice,
		utilityPlayerActions
	} from './gameLogic';
	import * as combatLogic from './combatLogic';
	import UseSpellsAbilitiesModal from '$lib/components/interaction_modals/UseSpellsAbilitiesModal.svelte';
	import { CombatAgent } from '$lib/ai/agents/combatAgent';
	import { LLMProvider } from '$lib/ai/llmProvider';
	import {
		initialSystemInstructionsState,
		type LLMMessage,
		type SystemInstructionsState
	} from '$lib/ai/llm';
	import { initialStoryState, type Story } from '$lib/ai/agents/storyAgent';
	import {
		CharacterAgent,
		type CharacterDescription,
		initialCharacterState
	} from '$lib/ai/agents/characterAgent';
	import DiceRollComponent from '$lib/components/interaction_modals/dice/DiceRollComponent.svelte';
	import UseItemsModal from '$lib/components/interaction_modals/UseItemsModal.svelte';
	import { type Campaign, CampaignAgent, type CampaignChapter } from '$lib/ai/agents/campaignAgent';
	import { ActionAgent, type TruthOracleResult } from '$lib/ai/agents/actionAgent';
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
	import {
		type CharacterChangedInto,
		EventAgent,
		type EventEvaluation,
		initialEventEvaluationState
	} from '$lib/ai/agents/eventAgent';
	import CharacterChangedConfirmationModal from '$lib/components/interaction_modals/CharacterChangedConfirmationModal.svelte';
	import {
		applyCharacterChange,
		getRequiredSkillProgression,
		isNewSkill,
		getSkillProgressionForDiceRoll,
		getSkillProgressionForDifficulty,
		getSkillIfApplicable,
		getFreeCharacterTechnicalId,
		getCharacterTechnicalId,
		addCharacterToPlayerCharactersIdToNamesMap
	} from './characterLogic';
	import { getDiceRollPromptAddition } from '$lib/components/interaction_modals/dice/diceRollLogic';
	import NewAbilitiesConfirmatonModal from '$lib/components/interaction_modals/character/NewAbilitiesConfirmatonModal.svelte';
	import SimpleDiceRoller from '$lib/components/interaction_modals/dice/SimpleDiceRoller.svelte';
	import StoryProgressionWithImage, {
		type StoryProgressionWithImageProps
	} from '$lib/components/StoryProgressionWithImage.svelte';
	import { ImagePromptAgent } from '$lib/ai/agents/imagePromptAgent';
	import UtilityModal from '$lib/components/interaction_modals/UtilityModal.svelte';
	// eslint-disable-next-line svelte/valid-compile
	let diceRollDialog,
		useSpellsAbilitiesModal,
		useItemsModal,
		utilityModal,
		actionsDiv,
		customActionInput;

	//ai state
	const apiKeyState = useLocalStorage<string>('apiKeyState');
	const temperatureState = useLocalStorage<number>('temperatureState');
	const systemInstructionsState = useLocalStorage<SystemInstructionsState>(
		'systemInstructionsState',
		initialSystemInstructionsState
	);
	const aiLanguage = useLocalStorage<string>('aiLanguage');
	let isAiGeneratingState = $state(false);
	let didAIProcessDiceRollActionState = useLocalStorage<boolean>('didAIProcessDiceRollAction');
	let didAIProcessActionState = $state<boolean>(true);
	let imagePromptAgent: ImagePromptAgent;
	let gameAgent: GameAgent,
		summaryAgent: SummaryAgent,
		characterAgent: CharacterAgent,
		characterStatsAgent: CharacterStatsAgent,
		combatAgent: CombatAgent,
		campaignAgent: CampaignAgent,
		actionAgent: ActionAgent,
		eventAgent: EventAgent;

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
	let storyChunkState = $state<string>('');
	let thoughtsState = useLocalStorage<ThoughtsState>('thoughtsState', initialThoughtsState);

	const skillsProgressionState = useLocalStorage<SkillsProgression>('skillsProgressionState', {});
	let skillsProgressionForCurrentActionState = $state<number | undefined>(undefined);
	const inventoryState = useLocalStorage<InventoryState>('inventoryState', {});
	const storyState = useLocalStorage<Story>('storyState', initialStoryState);
	const relatedStoryHistoryState = useLocalStorage<RelatedStoryHistory>(
		'relatedStoryHistoryState',
		{ relatedDetails: [] }
	);
	const relatedActionHistoryState = useLocalStorage<string[]>('relatedActionHistoryState', []);
	const relatedActionGroundTruthState = useLocalStorage<TruthOracleResult | null>(
		'relatedActionGroundTruthState'
	);
	const relatedNPCActionsState = useLocalStorage<NPCAction[]>('relatedNPCActionsState', []);
	const customMemoriesState = useLocalStorage<string>('customMemoriesState');
	const customGMNotesState = useLocalStorage<string>('customGMNotesState');
	const currentChapterState = useLocalStorage<number>('currentChapterState');
	const campaignState = useLocalStorage<Campaign>('campaignState', {} as Campaign);

	const npcState = useLocalStorage<NPCState>('npcState', {});
	const chosenActionState = useLocalStorage<Action>('chosenActionState', {} as Action);
	const additionalStoryInputState = useLocalStorage<string>('additionalStoryInputState', '');
	const additionalActionInputState = useLocalStorage<string>('additionalActionInputState', '');
	const isGameEnded = useLocalStorage<boolean>('isGameEnded', false);
	let playerCharactersIdToNamesMapState = useLocalStorage<PlayerCharactersIdToNamesMap>(
		'playerCharactersIdToNamesMapState',
		{}
	);
	let playerCharactersGameState: PlayerCharactersGameState = $state({});
	const getCurrentCharacterGameState = () => {
		return playerCharactersGameState[
			getCharacterTechnicalId(playerCharactersIdToNamesMapState.value, characterState.value.name) ||
				''
		];
	};

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

	const playerCharacterIdState = $derived(
		getCharacterTechnicalId(playerCharactersIdToNamesMapState.value, characterState.value.name) ||
			''
	);
	const getRenderedGameUpdates = (gameState: GameActionState, playerId: string) =>
		gameState &&
		gameLogic
			.renderStatUpdates(
				$state.snapshot(gameState.stats_update),
				getCurrentCharacterGameState(),
				playerCharactersIdToNamesMapState.value[playerId]
			)
			.concat(gameLogic.renderInventoryUpdate($state.snapshot(gameState.inventory_update)));

	let showXLastStoryPrgressions = $state<number>(0);
	const latestStoryProgressionState = $derived<StoryProgressionWithImageProps>({
		story: storyChunkState || currentGameActionState.story,
		gameUpdates: storyChunkState
			? []
			: getRenderedGameUpdates(currentGameActionState, playerCharacterIdState),
		imagePrompt: storyChunkState
			? ''
			: [currentGameActionState.image_prompt, storyState.value.general_image_prompt].join(' '),
		stream_finished: !storyChunkState
	});
	let latestStoryProgressionTextComponent = $state<HTMLElement | undefined>();

	let actionsTextForTTS: string = $state('');
	//TODO const lastCombatSinceXActions: number = $derived(
	//	gameActionsState.value && (gameActionsState.value.length - (gameActionsState.value.findLastIndex(state => state.is_character_in_combat ) + 1))
	//);
	let customActionReceiver:
		| 'Story Command'
		| 'State Command'
		| 'Character Action'
		| 'GM Question'
		| 'Dice Roll' = $state('Character Action');
	let customActionImpossibleReasonState: 'not_enough_resource' | 'not_plausible' | undefined =
		$state(undefined);

	let gmQuestionState: string = $state('');
	let customDiceRollNotation: string = $state('');
	let itemForSuggestActionsState: (Item & { item_id: string }) | undefined = $state();
	const eventEvaluationState = useLocalStorage<EventEvaluation>(
		'eventEvaluationState',
		initialEventEvaluationState
	);

	//feature toggles
	const aiConfigState = useLocalStorage<AIConfig>('aiConfigState');
	let useDynamicCombat = useLocalStorage('useDynamicCombat', false);
	let gameSettingsState = useLocalStorage<GameSettings>('gameSettingsState', defaultGameSettings());
	const ttsVoiceState = useLocalStorage<string>('ttsVoice');

	onMount(async () => {
		// TODO for some reason does not work, as its also shown on custom action despite everything being loaded already
		// beforeNavigate(({ cancel }) => {
		// 	if (!didAIProcessActionState) {
		// 		if (!confirm('Navigation will cancel the current AI generation. Are you sure?')) {
		// 			didAIProcessActionState = true;
		// 			cancel();
		// 		}
		// 	}
		// });
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
		summaryAgent = new SummaryAgent(llm);
		campaignAgent = new CampaignAgent(llm);
		actionAgent = new ActionAgent(llm);
		eventAgent = new EventAgent(llm);
		characterAgent = new CharacterAgent(llm);

		// image prompt generator
		imagePromptAgent = new ImagePromptAgent(llm);

		migrateStates();
		const currentCharacterName = characterState.value.name;
		let characterId = getCharacterTechnicalId(
			playerCharactersIdToNamesMapState.value,
			currentCharacterName
		);
		if (!characterId) {
			characterId = getFreeCharacterTechnicalId(playerCharactersIdToNamesMapState.value);
			addCharacterToPlayerCharactersIdToNamesMap(
				playerCharactersIdToNamesMapState.value,
				characterId,
				currentCharacterName
			);
		}
		// Initialize the player's resource state if it doesn't exist.
		playerCharactersGameState[characterId] = {
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
		//TODO what happens when character transformed, if stat existed before damage/heal will be applied
		gameLogic.applyGameActionStates(
			playerCharactersGameState,
			playerCharactersIdToNamesMapState.value,
			npcState.value,
			inventoryState.value,
			$state.snapshot(gameActionsState.value)
		);
		const { updatedGameActionsState, updatedPlayerCharactersGameState } =
			initializeMissingResources(
				$state.snapshot(characterStatsState.value.resources),
				playerCharacterIdState,
				characterState.value.name,
				$state.snapshot(gameActionsState.value),
				$state.snapshot(playerCharactersGameState)
			);
		gameActionsState.value = updatedGameActionsState;
		playerCharactersGameState = updatedPlayerCharactersGameState;
		tick().then(() => customActionInput.scrollIntoView(false));
		if (characterActionsState.value.length === 0) {
			const { thoughts, actions } = await actionAgent.generateActions(
				currentGameActionState,
				historyMessagesState.value,
				storyState.value,
				characterState.value,
				characterStatsState.value,
				inventoryState.value,
				systemInstructionsState.value.generalSystemInstruction,
				systemInstructionsState.value.actionAgentInstruction,
				await getRelatedHistory(
					summaryAgent,
					undefined,
					undefined,
					relatedStoryHistoryState.value,
					customMemoriesState.value
				),
				gameSettingsState.value?.aiIntroducesSkills,
				currentGameActionState.is_character_restrained_explanation,
				additionalActionInputState.value
			);
			characterActionsState.value = actions;
			thoughtsState.value.actionsThoughts = thoughts;
		}
		renderGameState(currentGameActionState, characterActionsState.value);
		if (!didAIProcessDiceRollActionState.value) {
			openDiceRollDialog();
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
			playerCharacterIdState,
			characterState.value.name,
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
		customCombatAgentInstruction: string,
		latestStoryMessages: LLMMessage[],
		storyState: Story,
		playerCharactersGameState: PlayerCharactersGameState,
		combatAgent: CombatAgent
	): Promise<Array<NPCAction>> {
		// Get details for all NPC targets based on the current game action state.
		const allNpcsDetailsAsList = gameLogic
			.getAllTargetsAsList(currentGameActionState.currently_present_npcs)
			.map((technicalId) => {
				const npc = npcState[technicalId];
				return {
					technicalId,
					is_party_member: npc.is_party_member,
					class: npc.class,
					rank_enum_english: npc.rank_enum_english,
					level: npc.level,
					spells_and_abilities: npc.spells_and_abilities.map(
						(ability: Ability) => ability.name + ': ' + ability.effect
					)
				};
			});

		// Compute the determined combat actions and stats update.
		const determinedActions = await combatAgent.generateActionsFromContext(
			playerAction,
			inventoryState,
			allNpcsDetailsAsList,
			customSystemInstruction,
			customCombatAgentInstruction,
			latestStoryMessages,
			storyState
		);
		return determinedActions;
	}

	const advanceSkillIfApplicable = (skillName: string) => {
		const requiredSkillProgression = getRequiredSkillProgression(
			skillName,
			characterStatsState.value
		);
		if (requiredSkillProgression) {
			if (skillsProgressionState.value[skillName] >= requiredSkillProgression) {
				console.log('Advancing skill ' + skillName + ' by 1');
				characterStatsState.value.skills[skillName] += 1;
				skillsProgressionState.value[skillName] = 0;
				gameActionsState.value[gameActionsState.value.length].stats_update.push({
					sourceName: characterState.value.name,
					targetName: characterState.value.name,
					value: { result: skillName },
					type: 'skill_increased'
				});
			}
		} else {
			console.log('No required skill progression found for skill: ' + skillName);
		}
	};

	const addSkillProgression = (skillName: string, skillProgression: number) => {
		if (skillProgression) {
			if (!skillsProgressionState.value[skillName]) {
				skillsProgressionState.value[skillName] = 0;
			}
			console.log('Adding skill progression for ' + skillName + ': ' + skillProgression);
			skillsProgressionState.value[skillName] += skillProgression;
		}
	};

	function openDiceRollDialog(
		waitForFunction?: Promise<void>,
		waitForActionsResult?: Promise<void>
	) {
		//TODO showModal can not be used because it hides the dice roll
		didAIProcessDiceRollActionState.value = false;
		diceRollDialog.show();
		diceRollDialog.addEventListener('close', function sendWithManuallyRolled() {
			diceRollDialog.removeEventListener('close', sendWithManuallyRolled);
			const result = diceRollDialog.returnValue;

			const skillName = getSkillIfApplicable(characterStatsState.value, chosenActionState.value);
			if (skillName) {
				skillsProgressionForCurrentActionState = getSkillProgressionForDiceRoll(result);
			}

			const dice_roll_addition_text = getDiceRollPromptAddition(result);
					// Add dice roll addition text if available.
		additionalStoryInputState.value += '\n' + dice_roll_addition_text + '\n';
			sendAction(
				chosenActionState.value,
				false,
				dice_roll_addition_text,
				waitForFunction,
				waitForActionsResult
			);
		});
	}

	function handleAIError() {
		if (!didAIProcessDiceRollActionState.value) {
			openDiceRollDialog();
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
						modifier_value:
							(Number.parseInt(
								chosenActionState.value.dice_roll?.modifier_value as unknown as string
							) || 0) - 3
					}
				};
			}
			//either not enough resource or impossible, anyway no resource cost
			let costString = 'No resource cost';
			if (chosenActionState.value.resource_cost) {
				chosenActionState.value.resource_cost.cost = 0;
				costString = `\n${chosenActionState.value.resource_cost?.resource_key} cost: 0`;
			}
			additionalStoryInputState.value += costString;
			await sendAction(chosenActionState.value, true);
		}
		customActionInput.value = '';
		customActionImpossibleReasonState = undefined;
	}

	//TODO sendAction should not be handled here so it can be externally called
	async function checkGameEnded() {
		const emptyResourceKeys = getEmptyCriticalResourceKeys(
			playerCharactersGameState[playerCharacterIdState]
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
		relatedNPCActionsState.reset();
		relatedActionGroundTruthState.reset();
		skillsProgressionForCurrentActionState = undefined;
		if (actionsDiv) actionsDiv.innerHTML = '';
		if (customActionInput) customActionInput.value = '';
		didAIProcessDiceRollActionState.value = true;
	}
	function resetStatesAfterActionsGenerated() {
		additionalActionInputState.reset();
	}

	function checkForNewNPCs(newState: GameActionState) {
		const newNPCsIds = gameLogic.getNewNPCs(newState.currently_present_npcs, npcState.value);
		if (newNPCsIds.length > 0) {
			characterStatsAgent
				.generateNPCStats(
					storyState.value,
					getLatestStoryMessages(),
					newNPCsIds.map((id) => id.uniqueTechnicalNameId),
					characterStatsState.value,
					systemInstructionsState.value.generalSystemInstruction
				)
				.then((newState: NPCState) => {
					if (newState) {
						combatLogic.addResourceValues(newState);
						newNPCsIds.forEach((id) => {
							if (newState[id.uniqueTechnicalNameId]) {
								newState[id.uniqueTechnicalNameId].known_names = [id.displayName];
							}
						});
						npcState.value = { ...npcState.value, ...newState };
						console.log(stringifyPretty(npcState.value));
					}
				});
		}
	}

	function checkForLevelUp() {
		levelUpState.value.buttonEnabled = false;
		const neededXP = getXPNeededForLevel(characterStatsState.value.level);

		if (
			neededXP &&
			playerCharactersGameState[playerCharacterIdState]?.XP.current_value >= neededXP
		) {
			levelUpState.value.buttonEnabled = true;
		}
	}

	async function addCampaignAdditionalStoryInput(action: Action, additionalStoryInput: string) {
		// If the game is played in campaign mode
		if (campaignState.value?.chapters?.length > 0) {
			//advance the chapter if applicable.
			const { newAdditionalStoryInput, newChapter } = await advanceChapterIfApplicable(
				action,
				additionalStoryInput,
				didAIProcessActionState,
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
		simulationAddition: string,
		initialAdditionalStoryInput: string
	): Promise<string> {
		let additionalStoryInput = initialAdditionalStoryInput || '';
		additionalStoryInput += simulationAddition
			? 'The following action outcome context is the hidden truth. On a success, narrate the character discovering this truth. On a failure, describe their attempt without revealing it: ' +
				simulationAddition +
				'\n'
			: '';
		additionalStoryInput = await addCampaignAdditionalStoryInput(action, additionalStoryInput);

		const gmNotes = getGameMasterNotesForCampaignChapter(
			getCurrentCampaignChapter(),
			currentGameActionState.currentPlotPoint
		);
		if (customGMNotesState.value) {
			gmNotes.unshift(customGMNotesState.value);
		}
		additionalStoryInput += GameAgent.getPromptForGameMasterNotes(gmNotes);

		if (action.type?.toLowerCase() === 'crafting') {
			additionalStoryInput += GameAgent.getCraftingPrompt();
		}
		// Add any extra side effects that should modify the story input.
		additionalStoryInput = gameLogic.addAdditionsFromActionSideeffects(
			action,
			additionalStoryInput,
			gameSettingsState.value.randomEventsHandling,
			currentGameActionState.is_character_in_combat,
			diceRollDialog.returnValue //TODO better way to pass the result ?, its string here
		);
		if (!additionalStoryInput.includes('sudo')) {
			additionalStoryInput +=
				'\n\n' +
				'Before responding always review the system instructions and apply the given rules.';
		}

		// Update the store for additional story input.
		additionalStoryInputState.value = additionalStoryInput;

		return additionalStoryInput;
	}

	const applyGameEventEvaluation = (evaluated: EventEvaluation) => {
		if (!evaluated) {
			return;
		}
		const changeInto = evaluated?.character_changed?.changed_into;
		if (changeInto && changeInto !== eventEvaluationState.value.character_changed?.changed_into) {
			evaluated.character_changed!.aiProcessingComplete = false;
			eventEvaluationState.value = {
				...eventEvaluationState.value,
				character_changed: evaluated.character_changed
			};
		}
		const abilities = evaluated?.abilities_learned?.abilities
			?.filter(
				(a) => !characterStatsState.value?.spells_and_abilities.some((b) => b.name === a.name)
			)
			.filter(
				(newAbility) =>
					!eventEvaluationState.value.abilities_learned?.abilities?.some(
						(existing) =>
							existing.uniqueTechnicalId === newAbility.uniqueTechnicalId ||
							existing.name === newAbility.name
					)
			);
		if (abilities && abilities.length > 0) {
			evaluated.abilities_learned!.aiProcessingComplete = false;
			eventEvaluationState.value = {
				...eventEvaluationState.value,
				abilities_learned: { ...evaluated?.abilities_learned, abilities }
			};
		}
	};

	// Helper to process the AI story progression and update game state accordingly.
	async function processStoryProgression(
		action: Action,
		additionalStoryInput: string,
		relatedHistory: string[],
		isCharacterInCombat: boolean,
		simulation: string
	) {
		thoughtsState.value.storyThoughts = '';

		const { newState, updatedHistoryMessages } = await gameAgent.generateStoryProgression(
			onStoryStreamUpdate,
			onThoughtStreamUpdate,
			action,
			additionalStoryInput,
			systemInstructionsState.value.generalSystemInstruction,
			systemInstructionsState.value.storyAgentInstruction,
			isCharacterInCombat ? systemInstructionsState.value.combatAgentInstruction : '',
			historyMessagesState.value,
			storyState.value,
			characterState.value,
			playerCharactersGameState[playerCharacterIdState],
			inventoryState.value,
			relatedHistory,
			gameSettingsState.value,
			simulation
		);

		if (newState.story) {
			newState.image_prompt = '';
			try {
				newState.image_prompt = await imagePromptAgent.generateImagePrompt(
					getLatestStoryMessages(),
					newState.story,
					characterState.value.name,
					currentGameActionState.image_prompt!
				);
				if (!newState.image_prompt) {
					newState.image_prompt = 'big letters showing FAILED TO GENERATE IMAGE PROMPT';
				}
			} catch (e) {
				console.warn('Failed to generate image prompt', e);
				newState.image_prompt = 'big letters showing FAILED TO GENERATE IMAGE PROMPT';
			}
			checkForNewNPCs(newState);
			npcLogic.addNPCNamesToState(newState.currently_present_npcs, npcState.value);
			// Otherwise, apply the new state to the game state.
			gameLogic.applyGameActionState(
				playerCharactersGameState,
				playerCharactersIdToNamesMapState.value,
				npcState.value,
				inventoryState.value,
				$state.snapshot(newState)
			);
			console.log('new state', stringifyPretty(newState));

			const skillName = getSkillIfApplicable(characterStatsState.value, action);
			console.log('skillName to improve', skillName);
			if (skillName) {
				//if no dice was rolled, use difficulty
				if (skillsProgressionForCurrentActionState === undefined) {
					skillsProgressionForCurrentActionState = getSkillProgressionForDifficulty(
						action.action_difficulty
					);
				}
				addSkillProgression(skillName, skillsProgressionForCurrentActionState);
				advanceSkillIfApplicable(skillName);
			}

			resetStatesAfterActionProcessed();

			handleUpdateHistoryAndGameActionState(newState, updatedHistoryMessages);

			const time = new Date().toLocaleTimeString();
			console.log('Complete parsing:', time);
			storyChunkState = '';
			await checkGameEnded();

			if (!isGameEnded.value) {
				getRelatedHistoryForStory();
				eventAgent
					.evaluateEvents(
						historyMessagesState.value.slice(-6).map((m) => m.content),
						characterStatsState.value.spells_and_abilities.map((a) => a.name)
					)
					.then((evaluation) => {
						applyGameEventEvaluation(evaluation.event_evaluation);
						thoughtsState.value.eventThoughts = evaluation.thoughts;
					});

				// Generate the next set of actions.
				actionAgent
					.generateActions(
						currentGameActionState,
						historyMessagesState.value,
						storyState.value,
						characterState.value,
						characterStatsState.value,
						inventoryState.value,
						systemInstructionsState.value.generalSystemInstruction,
						systemInstructionsState.value.actionAgentInstruction,
						relatedHistory,
						gameSettingsState.value?.aiIntroducesSkills,
						newState.is_character_restrained_explanation,
						additionalActionInputState.value
					)
					.then(({ thoughts, actions }) => {
						if (actions) {
							console.log(stringifyPretty(actions));
							characterActionsState.value = actions;
							renderGameState(currentGameActionState, actions);
							addSkillsIfApplicable(actions);
						}
						thoughtsState.value.actionsThoughts = thoughts;
						resetStatesAfterActionsGenerated();
					});
				handlePostActionProcessedState();
			}
		}
	}

	const addSkillsIfApplicable = (actions: Action[]) => {
		if (gameSettingsState.value?.aiIntroducesSkills) {
			actions.forEach((action: Action) => {
				const skill = isNewSkill($state.snapshot(characterStatsState.value), action);
				//TODO skill can be trait sometimes which we dont want?
				if (skill) {
					characterStatsState.value.skills[skill] = 0;
				}
			});
		}
	};

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

	function removeCluesFromSimulationOnFailure(diceRollAdditionText: string): any {
		let sim = { ...(relatedActionGroundTruthState.value?.simulation || {}) };
		if (relatedActionGroundTruthState.value) {
			if (
				!diceRollAdditionText.includes('major success') &&
				!diceRollAdditionText.includes('critical success')
			) {
				// sanitize simulation: remove "discoverable_weakness_or_clue" if present, otherwise remove the last key
				if ('discoverable_weakness_or_clue' in sim) {
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { discoverable_weakness_or_clue, ...rest } = sim;
					sim = rest as typeof sim;
				} else {
					const keys = Object.keys(sim);
					if (keys.length > 0) {
						const lastKey = keys[keys.length - 1];
						delete sim[lastKey];
					}
				}
			}
		}
		return sim;
	}

	// Main sendAction function that orchestrates the action processing.
	async function sendAction(
		action: Action,
		rollDice = false,
		diceRollAdditionText = '',
		waitForFunction?: Promise<void>,
		waitForActionsResult?: Promise<void>
	) {
		//TODO can happen if action fails multiple times, for retry state is not cleaned then
		if (additionalStoryInputState.value.length > 10_000) {
			console.warn('Additional story input is too long, reducing it to under 10_000 characters.');
			//take the last 10000 characters as it is probably the real input
			additionalStoryInputState.value = additionalStoryInputState.value.slice(-10_000);
		}
		// Retrieve combat and NPC-related story additions.
		if (
					!waitForActionsResult &&
					useDynamicCombat.value &&
					!isGameEnded.value &&
					currentGameActionState.is_character_in_combat
				) {
					waitForActionsResult = getActionPromptForCombat(
						action,
						currentGameActionState,
						npcState.value,
						inventoryState.value,
						systemInstructionsState.value.generalSystemInstruction,
						systemInstructionsState.value.combatAgentInstruction,
						getLatestStoryMessages(),
						storyState.value,
						playerCharactersGameState,
						combatAgent
					).then((actions) => {
						relatedNPCActionsState.value = actions;
					});
				}
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
				//determine if the game state yields an outcome (trap even present etc.)
				let waitForGroundTruthResult;
				if (!relatedActionGroundTruthState.value) {
					waitForGroundTruthResult = actionAgent
						.get_ground_truth(
							action,
							getLatestStoryMessages(5),
							$state.snapshot(storyState.value),
							await getRelatedHistory(
								undefined,
								undefined,
								undefined,
								// never actually await cause no action
								$state.snapshot(relatedStoryHistoryState.value),
								$state.snapshot(customMemoriesState.value)
							)
						)
						.then((groundTruth) => {
							relatedActionGroundTruthState.value = groundTruth;
						});
				}
				openDiceRollDialog(waitForGroundTruthResult, waitForActionsResult);
			} else {
				showXLastStoryPrgressions = 0;
				isAiGeneratingState = true;
				if (waitForFunction) {
					console.log('Waiting for function...', new Date().toLocaleTimeString());
					await waitForFunction;
					console.log('Waiting for function finished', new Date().toLocaleTimeString());
				}
				if (waitForActionsResult) {
					console.log('Waiting for combat actions result...', new Date().toLocaleTimeString());
					await waitForActionsResult;
					console.log(
						'Waiting for combat actions result finished',
						new Date().toLocaleTimeString()
					);
				}

				if (relatedActionHistoryState.value.length === 0) {
					relatedActionHistoryState.value = await getRelatedHistory(
						summaryAgent,
						action,
						gameActionsState.value,
						$state.snapshot(relatedStoryHistoryState.value),
						$state.snapshot(customMemoriesState.value)
					);
				}
				let simulationToUse = stringifyPretty(
					removeCluesFromSimulationOnFailure(diceRollAdditionText)
				);

				const deadNPCs = npcLogic.removeDeadNPCs(npcState.value);
				additionalStoryInputState.value += CombatAgent.getAdditionalStoryInput(relatedNPCActionsState.value, deadNPCs);
				additionalStoryInputState.value += CombatAgent.getNPCsHealthStatePrompt(deadNPCs);

				// Prepare the additional story input (including combat and chapter info)
				const finalAdditionalStoryInput = await prepareAdditionalStoryInput(
					action,
					simulationToUse !== '{}' ? simulationToUse : '',
					additionalStoryInputState.value
				);
				//prepare additional action input
				if (!diceRollAdditionText?.toLowerCase().includes('failure')) {
					//if the character didnt reckognize the simulation, do not generate actions based on it
					const simulation = relatedActionGroundTruthState.value?.simulation;
					additionalActionInputState.value += simulation
						? '\nThe character reckognized following truths and so actions could be based on them:\n' +
							stringifyPretty(simulation) +
							'\n'
						: '';
				}
				// Process the AI story progression and update game state
				didAIProcessActionState = false;
				await processStoryProgression(
					action,
					finalAdditionalStoryInput,
					relatedActionHistoryState.value,
					currentGameActionState.is_character_in_combat,
					simulationToUse
				);
				didAIProcessActionState = true;
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
		playerCharactersGameState[playerCharacterIdState].XP.current_value -= xpNeededForLevel;
		gameActionsState.value[gameActionsState.value.length - 1].stats_update.push(buyLevelUpObject);
		levelUpState.value.dialogOpened = true;
		checkForLevelUp();
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
				playerCharactersGameState[playerCharacterIdState],
				inventoryState.value
			)
		) {
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

	const onItemUseChosen = async (item: Action & Item & { item_id: string }) => {
		itemForSuggestActionsState = item;
	};

	const onTargetedSpellsOrAbility = async (action: Action, targets: string[]) => {
		isAiGeneratingState = true;
		let targetAddition = '';
		if (targets?.length > 0 && !targets.some((t) => t === undefined)) {
			targetAddition = targets?.length === 0 ? '' : gameLogic.getTargetPromptAddition(targets);
		}
		action.text += targetAddition;
		relatedActionHistoryState.value = await getRelatedHistory(
			summaryAgent,
			action,
			gameActionsState.value,
			$state.snapshot(relatedStoryHistoryState.value),
			$state.snapshot(customMemoriesState.value)
		);
		const generatedAction = await actionAgent.generateSingleAction(
			action,
			currentGameActionState,
			getLatestStoryMessages(),
			storyState.value,
			characterState.value,
			characterStatsState.value,
			inventoryState.value,
			systemInstructionsState.value.generalSystemInstruction,
			systemInstructionsState.value.actionAgentInstruction,
			relatedActionHistoryState.value,
			gameSettingsState.value?.aiIntroducesSkills,
			currentGameActionState.is_character_restrained_explanation,
			additionalActionInputState.value
		);
		if (generatedAction) {
			for (const key in generatedAction) {
				if (action[key] === undefined) {
					action[key] = generatedAction[key];
				}
			}
		}
		action.is_custom_action = true;
		console.log('generatedAction', stringifyPretty(action));
		chosenActionState.value = action;
		addSkillsIfApplicable([action]);
		const abilityAddition =
			'\n If this is a friendly action used on an enemy, play out the effect as described, even though the result may be unintended.' +
			'\n Hostile NPCs stay hostile unless explicitly described otherwise by the actions effect.' +
			'\n Friendly NPCs turn hostile if attacked.';

		additionalStoryInputState.value =
			targetAddition + abilityAddition + (additionalStoryInputState.value || '');
		await sendAction(
			action,
			gameLogic.mustRollDice(action, currentGameActionState.is_character_in_combat)
		);
		isAiGeneratingState = false;
	};
	const onCustomDiceRollClosed = () => {
		customDiceRollNotation = '';
		customActionInput.value = '';
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
			playerCharacterIdState,
			characterState.value.name,
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
				addSkillsIfApplicable([action]);
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
			systemInstructionsState.value.generalSystemInstruction,
			systemInstructionsState.value.actionAgentInstruction,
			relatedActionHistoryState.value,
			gameSettingsState.value?.aiIntroducesSkills,
			currentGameActionState.is_character_restrained_explanation,
			additionalActionInputState.value
		);
		console.log('generatedAction', stringifyPretty(generatedAction));
		action = { ...generatedAction, ...action };
		chosenActionState.value = action;
		addSkillsIfApplicable([action]);
		if (action.is_possible === false) {
			customActionImpossibleReasonState = 'not_plausible';
		} else {
			if (
				!isEnoughResource(
					action,
					playerCharactersGameState[playerCharacterIdState],
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

	const onCustomActionSubmitted = async (text: string, mustGenerateCustomAction = false) => {
		let action: Action = {
			characterName: characterState.value.name,
			text,
			is_custom_action: true
		};
		if (customActionReceiver === 'Character Action' || mustGenerateCustomAction) {
			await generateActionFromCustomInput(action);
		}
		if (customActionReceiver === 'GM Question') {
			gmQuestionState = action.text;
		}
		if (customActionReceiver === 'Dice Roll') {
			customDiceRollNotation = action.text;
		}
		if (customActionReceiver === 'State Command') {
			await handleStateCommand(action);
		}
		if (['Story Command'].includes(customActionReceiver)) {
			additionalStoryInputState.value += SUDO_COMMAND;
			await sendAction(action, false, '');
		}
	};
	const onGMQuestionClosed = (
		closedByPlayer: boolean,
		gmAnswerStateAsContext?: GameMasterAnswer
	) => {
		if (closedByPlayer) {
			customActionInput.value = '';
		}
		if (gmAnswerStateAsContext) {
			const context = '\nGM Context:\n' + stringifyPretty(gmAnswerStateAsContext);
			additionalStoryInputState.value += context;
			additionalActionInputState.value += context;
			historyMessagesState.value.push({
				role: 'user',
				content: stringifyPretty(gmAnswerStateAsContext)
			});
		}
		gmQuestionState = '';
	};

	function handleUtilityAction(actionValue: string) {
		if (!actionValue) {
			return;
		}
		let text = '';
		if (actionValue === 'short-rest') {
			text =
				'Player character is doing a short rest, handle the resources regeneration according GAME rules and describe the scene. If there are no specific GAME rules, increase all resources by 50% of the maximum.';
		} else if (actionValue === 'long-rest') {
			text =
				'Player character is doing a long rest, handle the resources regeneration according GAME rules and describe the scene. If there are no specific GAME rules, increase all resources by 100% of the maximum.';
		}
		if (text) {
			sendAction(
				{
					characterName: characterState.value.name,
					text,
					is_custom_action: false
				},
				false
			);
		}
	}

	function onDeleteItem(item_id: string): void {
		delete inventoryState.value[item_id];
		if (gameActionsState.value[gameActionsState.value.length - 1].inventory_update) {
			gameActionsState.value[gameActionsState.value.length - 1].inventory_update.push({
				item_id,
				type: 'remove_item'
			});
		}
	}

	function getEventToConfirm(gamEvent: CharacterChangedInto): {
		title: string;
		description: string;
	} {
		return {
			title: 'Character Change: ' + gamEvent.changed_into,
			description: gamEvent.description
		};
	}

	async function confirmCharacterChangeEvent(
		changedInto: CharacterChangedInto,
		confirmed: boolean
	) {
		eventEvaluationState.value.character_changed!.showEventConfirmationDialog = false;
		if (confirmed === undefined) {
			return;
		}
		if (confirmed) {
			isAiGeneratingState = true;
			const { transformedCharacter, transformedCharacterStats } = await applyCharacterChange(
				changedInto,
				$state.snapshot(storyState.value),
				$state.snapshot(characterState.value),
				$state.snapshot(characterStatsState.value),
				characterAgent,
				characterStatsAgent
			);

			if (transformedCharacter) {
				addCharacterToPlayerCharactersIdToNamesMap(
					playerCharactersIdToNamesMapState.value,
					playerCharacterIdState,
					transformedCharacter.name
				);
				characterState.value = transformedCharacter;
			}
			if (transformedCharacterStats) {
				characterStatsState.value = transformedCharacterStats;
				//generate new actions considering resources might have changed
				regenerateActions();
				additionalStoryInputState.value +=
					'\n After transformation make sure that stats_update refer to the new resources from now on!\n' +
					stringifyPretty(characterStatsState.value.resources);
			}

			//apply new resources
			playerCharactersGameState[playerCharacterIdState] = {
				...$state.snapshot(characterStatsState.value.resources),
				XP: playerCharactersGameState[playerCharacterIdState].XP
			};
			const { updatedGameActionsState, updatedPlayerCharactersGameState } = refillResourcesFully(
				$state.snapshot(characterStatsState.value.resources),
				playerCharacterIdState,
				characterState.value.name,
				$state.snapshot(gameActionsState.value),
				$state.snapshot(playerCharactersGameState)
			);
			gameActionsState.value = updatedGameActionsState;
			playerCharactersGameState = updatedPlayerCharactersGameState;
		}
		eventEvaluationState.value.character_changed!.aiProcessingComplete = true;
		isAiGeneratingState = false;
	}

	const confirmAbilitiesLearned = (abilities?: Ability[]) => {
		eventEvaluationState.value.abilities_learned!.showEventConfirmationDialog = false;
		if (!abilities) {
			return;
		}
		eventEvaluationState.value.abilities_learned!.aiProcessingComplete = true;
		if (abilities.length === 0) {
			return;
		}
		console.log('Added new abilities:', stringifyPretty(abilities));
		characterStatsState.value = {
			...characterStatsState.value,
			spells_and_abilities: [...characterStatsState.value.spells_and_abilities, ...abilities]
		};
	};

	function onStoryStreamUpdate(storyChunk: string, isComplete: boolean): void {
		if (!storyChunkState && !isComplete) {
			latestStoryProgressionTextComponent?.scrollIntoView();
			const time = new Date().toLocaleTimeString();
			console.log('First story chunk received at:', time);
			if (gameActionsState.value.length === 1) {
				//TODO workaround because of the scrollIntoView not working properly for second story
				setTimeout(() => {
					console.log('For second story chunk, scroll again');
					latestStoryProgressionTextComponent?.scrollIntoView();
				}, 50);
			}
		}
		storyChunkState = storyChunk;
		isAiGeneratingState = false;
	}

	function onThoughtStreamUpdate(thoughtChunk: string, isComplete: boolean): void {
		if (!thoughtsState.value.storyThoughts && !isComplete) {
			const time = new Date().toLocaleTimeString();
			console.log('First thought chunk received at:', time);
		}
		thoughtsState.value.storyThoughts += thoughtChunk;
	}

	async function regenerateActions() {
		characterActionsState.reset();
		if (actionsDiv) actionsDiv.innerHTML = '';

		const { thoughts, actions } = await actionAgent.generateActions(
			currentGameActionState,
			historyMessagesState.value,
			storyState.value,
			characterState.value,
			characterStatsState.value,
			inventoryState.value,
			systemInstructionsState.value.generalSystemInstruction,
			systemInstructionsState.value.actionAgentInstruction,
			await getRelatedHistory(
				summaryAgent,
				undefined,
				undefined,
				relatedStoryHistoryState.value,
				customMemoriesState.value
			),
			gameSettingsState.value?.aiIntroducesSkills,
			currentGameActionState.is_character_restrained_explanation,
			additionalActionInputState.value
		);
		characterActionsState.value = actions;
		thoughtsState.value.actionsThoughts = thoughts;
		renderGameState(currentGameActionState, characterActionsState.value);
	}

	function migrateStates() {
		characterStatsState.value = migrateIfApplicable(
			'characterStatsState',
			$state.snapshot(characterStatsState.value)
		);
		gameActionsState.value = migrateIfApplicable(
			'gameActionsState',
			$state.snapshot(gameActionsState.value)
		);
		gameSettingsState.value = migrateIfApplicable(
			'gameSettingsState',
			$state.snapshot(gameSettingsState.value)
		);
	}

	function getCustomActionPlaceholder(customActionReceiver: string): string | null | undefined {
		switch (customActionReceiver) {
			case 'Character Action':
				return 'What do you want to do?';
			case 'GM Question':
				return 'Message to the Game Master';
			case 'Dice Roll':
				return 'notation like 1d20, 2d6+3';
			case 'State Command':
				return 'Updates character state only, not story';
			case 'Story Command':
				return 'Story update with no restrictions';
			default:
				return 'No action selected';
		}
	}

	async function handleUpdateHistoryAndGameActionState(
		gameState: GameActionState,
		updatedHistoryMessages: LLMMessage[] = []
	) {
		// Determine which history to summarize
		const isStateUpdateOnly = updatedHistoryMessages.length === 0;
		const historyToSummarize = isStateUpdateOnly
			? updatedHistoryMessages
			: historyMessagesState.value;
		// Let the summary agent shorten the history, if needed.
		const { newHistory } = await summaryAgent.summarizeStoryIfTooLong(historyToSummarize);

		const updatedGameActions = gameLogic.mergeUpdatedGameActions(
			gameState,
			gameActionsState.value,
			isStateUpdateOnly
		);
		gameActionsState.value = updatedGameActions;
		// Update history messages based on game state
		if (isStateUpdateOnly) {
			//update last model message
			newHistory[newHistory.length - 1] = gameAgent.buildHistoryMessages(
				'',
				updatedGameActions[updatedGameActions.length - 1]
			).modelMessage;
		}
		historyMessagesState.value = newHistory;
	}

	function handlePostActionProcessedState() {
		checkForLevelUp();
	}

	async function handleStateCommand(action: Action) {
		isAiGeneratingState = true;
		action.text += SUDO_COMMAND + '\nOnly apply the mentioned state updates, but nothing else.';
		const newState = await gameAgent.generateStateOnlyNoStory(
			action,
			characterState.value.name,
			playerCharactersGameState[playerCharacterIdState],
			inventoryState.value,
			npcState.value
		);
		isAiGeneratingState = false;
		if (customActionInput) customActionInput.value = '';
		if (newState) {
			// Apply the new state to the game logic
			gameLogic.applyGameActionState(
				playerCharactersGameState,
				playerCharactersIdToNamesMapState.value,
				npcState.value,
				inventoryState.value,
				$state.snapshot(newState)
			);
			handleUpdateHistoryAndGameActionState(newState);
			handlePostActionProcessedState();
		}
	}
</script>

<div id="game-container" class="container mx-auto p-4">
	{#if isAiGeneratingState}
		<LoadingModal></LoadingModal>
	{/if}
	{#if errorState.userMessage && errorState.code != 'memory_retrieval'}
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
	{#if eventEvaluationState.value.character_changed?.showEventConfirmationDialog && !eventEvaluationState.value.character_changed?.aiProcessingComplete}
		<CharacterChangedConfirmationModal
			onclose={(confirmed) =>
				confirmCharacterChangeEvent(eventEvaluationState.value.character_changed!, confirmed)}
			eventToConfirm={getEventToConfirm(eventEvaluationState.value.character_changed)}
		/>
	{/if}
	{#if eventEvaluationState.value.abilities_learned?.showEventConfirmationDialog && !eventEvaluationState.value.abilities_learned?.aiProcessingComplete}
		<NewAbilitiesConfirmatonModal
			spells_abilities={eventEvaluationState.value.abilities_learned?.abilities || []}
			onclose={(confirmedAbilities?: Ability[]) => confirmAbilitiesLearned(confirmedAbilities)}
		/>
	{/if}
	<UseSpellsAbilitiesModal
		bind:dialogRef={useSpellsAbilitiesModal}
		playerName={characterState.value.name}
		resources={playerCharactersGameState[playerCharacterIdState]}
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
		oncrafting={(craftingPrompt) => {
			if (craftingPrompt) {
				onCustomActionSubmitted(craftingPrompt, true);
			}
		}}
		onclose={onItemUseChosen}
	></UseItemsModal>
	{#if itemForSuggestActionsState}
		<SuggestedActionsModal
			onclose={onSuggestItemActionClosed}
			resources={getCurrentCharacterGameState()}
			{itemForSuggestActionsState}
			{currentGameActionState}
		/>
	{/if}
	{#if levelUpState.value?.dialogOpened}
		<LevelUpModal onclose={onLevelUpModalClosed} />
	{/if}
	<UtilityModal
		bind:dialogRef={utilityModal}
		is_character_in_combat={currentGameActionState.is_character_in_combat}
		actions={utilityPlayerActions}
		onclose={(action) => {
			handleUtilityAction(action);
		}}
	/>
	<DiceRollComponent
		bind:diceRollDialog
		action={chosenActionState.value}
		resetState={didAIProcessDiceRollActionState.value}
	></DiceRollComponent>
	{#if customDiceRollNotation}
		<SimpleDiceRoller onClose={onCustomDiceRollClosed} notation={customDiceRollNotation} />
	{/if}
	<ResourcesComponent
		resources={getCurrentCharacterGameState()}
		currentLevel={characterStatsState.value?.level}
	/>
	<div id="story" class="mt-4 justify-items-center rounded-lg bg-base-100 p-4 shadow-md">
		<button onclick={() => showXLastStoryPrgressions++} class="btn-xs w-full"
			>Show Previous Story
		</button>
		{#if currentGameActionState?.story}
			{#each !latestStoryProgressionState.stream_finished ? [currentGameActionState] : gameActionsState.value.slice(-2 + showXLastStoryPrgressions * -1, -1) as gameActionState (gameActionState.id)}
				<StoryProgressionWithImage
					story={gameActionState.story}
					imagePrompt="{gameActionState.image_prompt} {storyState.value.general_image_prompt}"
					gameUpdates={getRenderedGameUpdates(gameActionState, playerCharacterIdState)}
				/>
				{#if gameActionState['fallbackUsed']}
					<small class="text-sm text-red-500"> For this action the fallback LLM was used.</small>
				{/if}
			{/each}
		{/if}
		<StoryProgressionWithImage
			bind:storyTextRef={latestStoryProgressionTextComponent}
			story={latestStoryProgressionState.story}
			imagePrompt={latestStoryProgressionState.imagePrompt}
			gameUpdates={latestStoryProgressionState.gameUpdates}
			stream_finished={latestStoryProgressionState.stream_finished}
		/>
		{#if latestStoryProgressionState.stream_finished && currentGameActionState['fallbackUsed']}
			<small class="text-sm text-red-500"> For this action the fallback LLM was used.</small>
		{/if}
		{#if isGameEnded.value}
			<StoryProgressionWithImage story={gameLogic.getGameEndedMessage()} />
		{/if}
	</div>

	{#if !aiConfigState.value?.disableAudioState && actionsTextForTTS}
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

				{#if !eventEvaluationState.value.character_changed?.aiProcessingComplete}
					<button
						onclick={() => {
							eventEvaluationState.value.character_changed!.showEventConfirmationDialog = true;
						}}
						class="text-md btn btn-success mb-3 w-full"
						>Transform into {eventEvaluationState.value.character_changed?.changed_into}
					</button>
				{/if}
				{#if !eventEvaluationState.value.abilities_learned?.aiProcessingComplete}
					<button
						onclick={() =>
							(eventEvaluationState.value.abilities_learned!.showEventConfirmationDialog = true)}
						class="text-md btn btn-success mb-3 w-full"
						>Learn new Spells & Abilities
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
				<button
					onclick={() => {
						utilityModal.showModal();
					}}
					class="text-md btn btn-primary mt-3 w-full"
					>Utility
				</button>
			</div>
		{/if}
		<form id="input-form" class="p-4 pb-2">
			<div class="w-full lg:join">
				<select bind:value={customActionReceiver} class="select select-bordered w-full lg:w-fit">
					<option selected>Character Action</option>
					<option>Story Command</option>
					<option>State Command</option>
					<option>GM Question</option>
					<option>Dice Roll</option>
				</select>
				<input
					type="text"
					bind:this={customActionInput}
					class="input input-bordered w-full"
					id="user-input"
					placeholder={getCustomActionPlaceholder(customActionReceiver)}
				/>
				<button
					onclick={() => onCustomActionSubmitted(customActionInput.value)}
					class="btn btn-neutral w-full lg:w-1/4"
					id="submit-button"
					>Submit
				</button>
			</div>
		</form>
	{/if}

	<style>
		.btn {
			height: auto;
			padding: 1rem;
		}

		canvas {
			height: 100%;
			width: 100%;
		}
	</style>
</div>
