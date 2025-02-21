<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import {
		type Action,
		type GameActionState,
		GameAgent,
		type InventoryState,
		type Item,
		type PlayerCharactersGameState,
		type ResourcesWithCurrentValue,
		SLOW_STORY_PROMPT
	} from '$lib/ai/agents/gameAgent';
	import { DifficultyAgent } from '$lib/ai/agents/difficultyAgent';
	import { onMount, tick } from 'svelte';
	import { getTextForActionButton, handleError, stringifyPretty } from '$lib/util.svelte';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import StoryProgressionWithImage from '$lib/components/StoryProgressionWithImage.svelte';
	import { SummaryAgent } from '$lib/ai/agents/summaryAgent';
	import {
		type AiLevelUp,
		type CharacterStats,
		CharacterStatsAgent,
		initialCharacterStatsState,
		type NPCState,
		type Resources
	} from '$lib/ai/agents/characterStatsAgent';
	import { errorState } from '$lib/state/errorState.svelte';
	import ErrorDialog from '$lib/components/interaction_modals/ErrorModal.svelte';
	import * as gameLogic from './gameLogic';
	import {
		ActionDifficulty,
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
	import { type Campaign, CampaignAgent } from '$lib/ai/agents/campaignAgent';
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
	let useDynamicCombat = useLocalStorage('useDynamicCombat', true);
	const ttsVoiceState = useLocalStorage<string>('ttsVoice');

	onMount(async () => {
		const llm = LLMProvider.provideLLM({
			temperature: temperatureState.value,
			language: aiLanguage.value,
			apiKey: apiKeyState.value
		}, aiConfigState.value?.useFallbackLlmState);
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
		// This sets all the resources along with an initial XP value.
		playerCharactersGameState[currentCharacterName] = {
			...$state.snapshot(characterStatsState.value.resources),
			XP: { current_value: 0, max_value: 0, game_ends_when_zero: false }
		};

		// Start game when not already started
		if (!currentGameActionState?.story) {
			await sendAction({
				characterName: currentCharacterName,
				text: GameAgent.getStartingPrompt()
			});
			// Initialize all resources when the game is first started.
			refillResourcesFully(
				characterStatsState.value.resources,
				currentCharacterName
			);
		} else {
			// Apply previously saved game actions
			gameLogic.applyGameActionStates(
				playerCharactersGameState,
				npcState.value,
				inventoryState.value,
				$state.snapshot(gameActionsState.value)
			);
			initializeMissingResources(characterStatsState.value.resources, currentCharacterName);
			tick().then(() => customActionInput.scrollIntoView(false));
			if (characterActionsState.value.length === 0) {
				characterActionsState.value = await actionAgent.generateActions(
					currentGameActionState,
					historyMessagesState.value,
					storyState.value,
					characterState.value,
					characterStatsState.value,
					inventoryState.value,
					customSystemInstruction.value
				);
			}
			renderGameState(currentGameActionState, characterActionsState.value);
		}
		if (!didAIProcessDiceRollActionState.value) {
			openDiceRollDialog(additionalStoryInputState.value);
		}
		checkForLevelUp();
	});

	function refillResourcesFully(
		maxResources: Resources,
		playerName: string,
	) {
		//first apply the difference in the update log
		const statsUpdate = GameAgent.getRefillResourcesUpdateObject(
			maxResources,
			playerCharactersGameState[playerName],
			playerName
		);
		gameActionsState.value[gameActionsState.value.length - 1].stats_update = [
			...gameActionsState.value[gameActionsState.value.length - 1].stats_update,
			...statsUpdate.stats_update
		];

		//then set current values to max
		playerCharactersGameState[playerName] = {
			...playerCharactersGameState[playerName], // Preserve existing properties (like XP)
			...Object.keys(maxResources).reduce((acc, key) => {
				acc[key] = {
					...$state.snapshot(maxResources[key]),
					current_value: maxResources[key].max_value
				};
				return acc;
			}, {})
		};
	}

	function initializeMissingResources(resources: Resources, playerName: string) {
				// Check for any resources that are missing in the player's state.
				const missingResources: Resources = Object.entries(resources)
					.filter(
						([resourceKey]) =>
							playerCharactersGameState[playerName][resourceKey]?.current_value === undefined
					)
					.reduce((acc, [resourceKey, resource]) => ({ ...acc, [resourceKey]: resource }), {});
				if (Object.keys(missingResources).length > 0) {
						refillResourcesFully(
				missingResources,
				playerName
			);
		}
	}

	async function getActionPromptForCombat(playerAction: Action) {
		const allNpcsDetailsAsList = gameLogic
			.getAllTargetsAsList(currentGameActionState.currently_present_npcs)
			.map((npcName) => ({
				nameId: npcName,
				...npcState.value[npcName]
			}));

		const determinedActionsAndStatsUpdate = await combatAgent.generateActionsFromContext(
			playerAction,
			inventoryState.value,
			allNpcsDetailsAsList,
			customSystemInstruction.value,
			getLatestStoryMessages(),
			storyState.value
		);

		//need to apply already here to have most recent allResources
		gameLogic.applyGameActionState(
			playerCharactersGameState,
			npcState.value,
			inventoryState.value,
			$state.snapshot(determinedActionsAndStatsUpdate)
		);
		//const deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
		const aliveNPCs = allNpcsDetailsAsList
			.filter((npc) => npc?.resources && npc.resources.current_hp > 0)
			.map((npc) => npc?.nameId);

		let additionalStoryInput = CombatAgent.getAdditionalStoryInput(
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
			additionalStoryInput = (additionalStoryInput || '') + '\n ' + diceRollDialog.returnValue;
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
			chosenActionState.value.resource_cost!.cost = 0;
			const costString = `\n${chosenActionState.value.resource_cost?.resource_key} cost: 0`;
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

	async function getCombatAndNPCState(action: Action) {
		let deadNPCs: string[] = [];
		let additionalStoryInput = '';
		let allCombatDeterminedActionsAndStatsUpdate;
		if (!isGameEnded.value && currentGameActionState.is_character_in_combat) {
			additionalStoryInput += CombatAgent.getCombatPromptAddition();
			if (useDynamicCombat.value) {
				let combatObject = await getActionPromptForCombat(action);
				additionalStoryInput += combatObject.additionalStoryInput;
				allCombatDeterminedActionsAndStatsUpdate = combatObject.determinedActionsAndStatsUpdate;
			} else {
				deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
				additionalStoryInput += CombatAgent.getNPCsHealthStatePrompt(deadNPCs);
			}
		} else {
			deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
			additionalStoryInput += CombatAgent.getNPCsHealthStatePrompt(deadNPCs);
		}
		return { additionalStoryInput, allCombatDeterminedActionsAndStatsUpdate };
	}

	async function checkGameEnded() {
		const emptyResourceKey = getEmptyCriticalResourceKeys(
			playerCharactersGameState[characterState.value.name]
		);
		if (!isGameEnded.value && emptyResourceKey.length > 0) {
			isGameEnded.value = true;
			await sendAction({
				characterName: characterState.value.name,
				text: GameAgent.getGameEndedPrompt(emptyResourceKey)
			});
		}
		//calculate again as dying action could also be a rescue in some cases
		isGameEnded.value = Object.values(playerCharactersGameState[characterState.value.name]).some(
			(v) => v.game_ends_when_zero && v.current_value <= 0
		);
	}

	function resetStatesAfterActionProcessed() {
		chosenActionState.reset();
		additionalStoryInputState.reset();
		characterActionsState.reset();
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

	function startNextChapter() {
		currentChapterState.value += 1;
		const newChapter = $state
			.snapshot(campaignState.value)
			.chapters.find((chapter) => chapter.chapterId === currentChapterState.value);

		if (newChapter) {
			newChapter.plot_points.push({
				...campaignState.value.chapters[newChapter.chapterId]?.plot_points[0],
				plotId: newChapter.plot_points.length + 1
			});
			const newChapterJson = stringifyPretty(newChapter);
			storyState.value = {
				...storyState.value,
				adventure_and_main_event: newChapterJson
			};
			return (
				'\nA new chapter begins, ' +
				SLOW_STORY_PROMPT +
				'\nSet currentPlotPoint to 1, nextPlotPoint to 2 and nudge the story into plotId 1: ' +
				'\n' +
				newChapterJson
			);
		}
		return '\nNotify the players that the campaign has ended but they can continue with free exploration.';
	}

	function mapPlotStringToIds(text: string, splitDelimeter: string = 'plotId: ') {
		if (!text) {
			return [0];
		}
		try {
			//allow reasoning to stay in the current plot point and trigger to get to the next
			const regex = new RegExp(`${splitDelimeter}(\\d+)`, 'g');
			let match;
			const plotIds: number[] = [];
			// Extract matches
			while ((match = regex.exec(text)) !== null) {
				plotIds.push(Number(match[1]));
			}
			return plotIds;
		} catch (e) {
			console.log('can not mapPlotStringToId', e);
			return [0];
		}
	}

	async function advanceChapterIfApplicable(action: Action, additionalStoryInput: string) {
		if (
			didAIProcessActionState.value &&
			campaignState.value.chapters &&
			campaignState.value.chapters[currentChapterState.value - 1] &&
			!currentGameActionState.is_character_in_combat
		) {
			let campaignDeviations;
			if (gameActionsState.value.length % 5 === 0) {
				campaignDeviations = await campaignAgent.checkCampaignDeviations(
					action,
					campaignState.value,
					historyMessagesState.value
				);
				console.log(stringifyPretty(campaignDeviations));
				if (campaignDeviations) {
					if (campaignDeviations.deviation > 70) {
						additionalStoryInput +=
							'\n' +
							campaignDeviations.plotNudge.nudgeExplanation +
							'\n' +
							campaignDeviations.plotNudge.nudgeStory +
							'Always describe the story as a Game Master and never mention meta elements such as plot points or story progression.';
					}
				}
			}
			const mappedCurrentPlotPoint: number = mapPlotStringToIds(
				currentGameActionState.currentPlotPoint,
				'plotId: '
			)[0];
			const mappedCampaignChapterId: number = mapPlotStringToIds(
				campaignDeviations?.currentChapter,
				'chapterId: '
			)[0];
			if (
				mappedCurrentPlotPoint >
					campaignState.value.chapters[currentChapterState.value - 1]?.plot_points?.length ||
				mappedCampaignChapterId > currentChapterState.value
			) {
				additionalStoryInput += startNextChapter();
			}
		}
		return additionalStoryInput;
	}

	function addAdditionsFromActionSideeffects(action: Action, additionalStoryInput: string) {
		if ((action.is_straightforward + '').includes('false')) {
			additionalStoryInput += '\n' + SLOW_STORY_PROMPT;
		}
		const encounterString = '' + action.enemyEncounterExplanation;
		if (encounterString.includes('high') && !encounterString.includes('low')) {
			additionalStoryInput +=
				'\nenemyEncounter: ' +
				action.enemyEncounterExplanation +
				' Players take first turn, wait for their action.';
		}
		if (!additionalStoryInput.includes('sudo')) {
			additionalStoryInput +=
				'\n' + 'Before responding always review the system instructions and apply the given rules.';
		}
		return additionalStoryInput;
	}

	async function sendAction(action: Action, rollDice = false, additionalStoryInput = '') {
		try {
			if (rollDice) {
				openDiceRollDialog(additionalStoryInput);
			} else {
				isAiGeneratingState = true;
				additionalStoryInput = additionalStoryInput || '';
				const combatAndNPCState = await getCombatAndNPCState(action);

				if (campaignState.value?.chapters?.length > 0) {
					additionalStoryInput = await advanceChapterIfApplicable(action, additionalStoryInput);
				}
				additionalStoryInput += combatAndNPCState.additionalStoryInput;
				additionalStoryInput = addAdditionsFromActionSideeffects(action, additionalStoryInput);
				//additionalStoryInput += '\nIn a conversation always include the NPC response!';
				//TODO additionalStoryInput += '\nInclude the actions for this scene of all currently_present_npcs';

				additionalStoryInputState.value = additionalStoryInput;
				didAIProcessActionState.value = false;
				const { newState, updatedHistoryMessages } = await gameAgent.generateStoryProgression(
					action,
					additionalStoryInput,
					customSystemInstruction.value,
					historyMessagesState.value,
					storyState.value,
					characterState.value,
					playerCharactersGameState,
					inventoryState.value
				);
				didAIProcessActionState.value = true;
				if (newState) {
					if (combatAndNPCState.allCombatDeterminedActionsAndStatsUpdate) {
						//override the gameActionsState stat update with the combat one
						newState.stats_update =
							combatAndNPCState.allCombatDeterminedActionsAndStatsUpdate.stats_update;
					} else {
						//StatsUpdate did not come from combat agent
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
					if (!isGameEnded.value) {
						actionAgent
							.generateActions(
								currentGameActionState,
								historyMessagesState.value,
								storyState.value,
								characterState.value,
								characterStatsState.value,
								inventoryState.value,
								customSystemInstruction.value
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
		if (!isEnoughResource(action, playerCharactersGameState[characterState.value.name])) {
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
		if (targets?.length > 0 && !targets.includes('No specific target')) {
			targetAddition = targets?.length === 0 ? '' : gameLogic.getTargetPromptAddition(targets);
		}
		const difficultyResponse = await difficultyAgent.generateDifficulty(
			action.text + targetAddition,
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
		refillResourcesFully(
			characterStatsState.value.resources,
			characterState.value.name
		);
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

	function getCurrentXPText() {
		return `XP: ${playerCharactersGameState[characterState.value.name]?.XP.current_value}/${getXPNeededForLevel(characterStatsState.value?.level)}`;
	}

	const generateActionFromCustomInput = async (action: Action) => {
		isAiGeneratingState = true;
		const generatedAction = await actionAgent.generateSingleAction(
			action,
			currentGameActionState,
			historyMessagesState.value,
			storyState.value,
			characterState.value,
			characterStatsState.value,
			inventoryState.value,
			customSystemInstruction.value
		);
		console.log('action', stringifyPretty(action));
		action = { ...generatedAction, ...action };
		chosenActionState.value = action;
		if (action.is_possible === false) {
			customActionImpossibleReasonState = 'not_plausible';
		} else {
			if (!isEnoughResource(action, playerCharactersGameState[characterState.value.name])) {
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
				'\nsudo: Ignore the rules and play out this action even if it should not be possible!'
			);
		}
	};
	const onGMQuestionClosed = (closedByPlayer: boolean) => {
		if (closedByPlayer) {
			customActionInput.value = '';
		}
		gmQuestionState = '';
	};
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
	<div class="menu menu-horizontal sticky top-0 z-10 flex justify-between bg-base-200">
		{#each Object.entries(playerCharactersGameState[characterState.value.name] || {}) as [resourceKey, resourceValue] (resourceKey)}
			{#if resourceKey === 'XP'}
				<output id="XP" class="ml-1 text-lg font-semibold text-green-500 w-full lg:w-fit">
					{getCurrentXPText()}
				</output>
			{:else}
				<output
					class="ml-1 text-lg font-semibold capitalize w-full lg:w-fit"
					class:text-red-500={resourceValue.game_ends_when_zero}
					class:text-blue-500={!resourceValue.game_ends_when_zero}
				>
					{resourceKey.replaceAll('_', ' ')}: {resourceValue.current_value ||
						0}/{resourceValue.max_value}
				</output>
			{/if}
		{/each}
	</div>
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
				<small class="text-sm text-red-500">
					For this action GPT-4o-mini was used.
				</small>
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
