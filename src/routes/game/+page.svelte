<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import {
		getTextForActionButton,
		handleError,
		initialThoughtsState,
		stringifyPretty,
		type ThoughtsState
	} from '$lib/util.svelte';
	// Import state stores
	import { aiStateStore, characterStateStore } from '$lib/state/stores';
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
		type NPCStats,
		type SkillsProgression,
		type PartyStats,
		initialPartyStatsState
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
		initialCharacterState,
		type Party,
		initialPartyState
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
		addCharacterToPlayerCharactersIdToNamesMap,
		getCharacterKnownNames
	} from './characterLogic';
	import {
		getActivePartyMember,
		getActivePartyMemberStats,
		updatePartyMemberCharacter,
		updatePartyMemberStats,
		getPartyMemberByCharacterName,
		getPartyMemberStatsByCharacterName,
		updatePlayerCharactersIdToNamesMapForParty,
		switchActiveCharacter
	} from './partyLogic';
	import { getDiceRollPromptAddition, type DiceRollResult } from '$lib/components/interaction_modals/dice/diceRollLogic';
	import NewAbilitiesConfirmatonModal from '$lib/components/interaction_modals/character/NewAbilitiesConfirmatonModal.svelte';
	import SimpleDiceRoller from '$lib/components/interaction_modals/dice/SimpleDiceRoller.svelte';
	import StoryProgressionWithImage, {
		type StoryProgressionWithImageProps
	} from '$lib/components/StoryProgressionWithImage.svelte';
	import { ImagePromptAgent } from '$lib/ai/agents/imagePromptAgent';
	import UtilityModal from '$lib/components/interaction_modals/UtilityModal.svelte';
	import PartyMemberSwitcher from '$lib/components/PartyMemberSwitcher.svelte';
	import { getActiveRestrainingState } from './restrainingLogic';
	// eslint-disable-next-line svelte/valid-compile
	let diceRollDialog,
		useSpellsAbilitiesModal,
		useItemsModal,
		utilityModal,
		actionsDiv,
		customActionInput;

	//ai state - now using aiStateStore
	// const apiKeyState = useLocalStorage<string>('apiKeyState');
	// const temperatureState = useLocalStorage<number>('temperatureState');
	// const systemInstructionsState = useLocalStorage<SystemInstructionsState>(
	// 	'systemInstructionsState',
	// 	initialSystemInstructionsState
	// );
	// const aiLanguage = useLocalStorage<string>('aiLanguage');
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
	const characterActionsByMemberState = useLocalStorage<Record<string, Action[]>>('characterActionsByMemberState', {});
	// Per-member restrained explanation state (party-aware). Value is explanation string or null.
	const restrainedExplanationByMemberState = useLocalStorage<Record<string, string | null>>(
		'restrainedExplanationByMemberState',
		{}
	);
	const selectedCombatActionsByMemberState = useLocalStorage<Record<string, Action | null>>('selectedCombatActionsByMemberState', {});
	const historyMessagesState = useLocalStorage<LLMMessage[]>('historyMessagesState', []);
	// Character state - now using characterStateStore
	// const characterState = useLocalStorage<CharacterDescription>(
	// 	'characterState',
	// 	initialCharacterState
	// );
	// const characterStatsState = useLocalStorage<CharacterStats>(
	// 	'characterStatsState',
	// 	initialCharacterStatsState
	// );
	const partyState = useLocalStorage<Party>('partyState', initialPartyState);
	const partyStatsState = useLocalStorage<PartyStats>('partyStatsState', initialPartyStatsState);

	// Sync character state with active party member
	$effect(() => {
		if (partyState.value.members.length > 0) {
			const activeMember = getActivePartyMember(partyState.value);
			const activeMemberStats = getActivePartyMemberStats(partyState.value, partyStatsState.value);
			if (activeMember && activeMemberStats) {
				characterStateStore.character.value = activeMember.character;
				characterStateStore.characterStats.value = activeMemberStats;
			}
		}
	});
	let storyChunkState = $state<string>('');
	let thoughtsState = useLocalStorage<ThoughtsState>('thoughtsState', initialThoughtsState);

	// Skills progression - now per party member
	const skillsProgressionState = useLocalStorage<Record<string, SkillsProgression>>(
		'skillsProgressionByMemberState',
		{}
	);
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
	// Returns the game state (resources etc.) for the requested character id.
	// Priority:
	// 1. Explicit id param
	// 2. Currently active party member id
	// 3. Derived playerCharacterIdState (fallback single-character mode)
	const getCurrentCharacterGameState = (id?: string) => {
		const effectiveId =
			id ||
			partyState.value.activeCharacterId ||
			(getCharacterTechnicalId(
				playerCharactersIdToNamesMapState.value,
				characterStateStore.character.value.name
			) || '');
		return playerCharactersGameState[effectiveId];
	};

	let levelUpState = useLocalStorage<{
		buttonEnabled: boolean;
		dialogOpened: boolean;
		playerName: string;
		partyLevelUpStatus?: Record<string, boolean>;
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
		getCharacterTechnicalId(playerCharactersIdToNamesMapState.value, characterStateStore.character.value.name) ||
			''
	);
	const getRenderedGameUpdates = (gameState: GameActionState, playerId: string) =>
		gameState &&
		gameLogic
			.renderStatUpdates(
				$state.snapshot(gameState.stats_update),
				getCurrentCharacterGameState(),
				playerCharactersIdToNamesMapState.value[playerId],
				partyState.value.members.length > 1 // Pass isParty flag
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

	// New combat dice roll + locking state
	// Stores dice roll prompt additions per selected combat action (not yet applied until confirm)
	let selectedCombatActionsDiceAdditionsState: Record<string, string> = $state({});
	// Stores whether a combat action selection for a member is locked (cannot be changed)
	let selectedCombatActionsLockedState: Record<string, boolean> = $state({});

	let gmQuestionState: string = $state('');
	let customDiceRollNotation: string = $state('');
	let itemForSuggestActionsState: (Item & { item_id: string }) | undefined = $state();
	const eventEvaluationState = useLocalStorage<EventEvaluation>(
		'eventEvaluationState',
		initialEventEvaluationState
	);
	// NEW: Per-party-member event evaluations (mapping id -> EventEvaluation)
	const eventEvaluationByMemberState = useLocalStorage<Record<string, EventEvaluation>>(
		'eventEvaluationByMemberState',
		{}
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
		const llm = LLMProvider.provideLLM({
			temperature: aiStateStore.temperature.value,
			language: aiStateStore.language.value,
			apiKey: aiStateStore.apiKey.value
		});
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
		const currentCharacterName = characterStateStore.character.value.name;
		let characterId = getCharacterTechnicalId(
			playerCharactersIdToNamesMapState.value,
			currentCharacterName
		);

		// Initialize party if it exists
		if (partyState.value.members.length > 0) {
			// Initialize resources for all party members
			for (const member of partyState.value.members) {
				const memberStats = partyStatsState.value.members.find((m) => m.id === member.id)?.stats;
				if (memberStats) {
					// Always reinitialize to ensure all members have resources
					playerCharactersGameState[member.id] = {};

					// Convert resources to have current_value
					for (const [key, resource] of Object.entries(memberStats.resources)) {
						playerCharactersGameState[member.id][key] = {
							max_value: resource.max_value,
							current_value: resource.start_value || resource.max_value,
							game_ends_when_zero: resource.game_ends_when_zero
						};
					}

					// Initialize XP
					playerCharactersGameState[member.id].XP = {
						max_value: 9999,
						current_value: 0,
						game_ends_when_zero: false
					};
				}
			}

			// Update playerCharactersIdToNamesMapState
			updatePlayerCharactersIdToNamesMapForParty(
				partyState.value,
				playerCharactersIdToNamesMapState.value
			);

			// Set character ID to active party member
			characterId = partyState.value.activeCharacterId;
		} else if (!characterId) {
			// Fallback to old single character system
			characterId = getFreeCharacterTechnicalId(playerCharactersIdToNamesMapState.value);
			addCharacterToPlayerCharactersIdToNamesMap(
				playerCharactersIdToNamesMapState.value,
				characterId,
				currentCharacterName
			);

			// Initialize the player's resource state if it doesn't exist.
			playerCharactersGameState[characterId] = {
				...$state.snapshot(characterStateStore.characterStats.value.resources),
				XP: { current_value: 0, max_value: 0, game_ends_when_zero: false }
			};
		}
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
				$state.snapshot(characterStateStore.characterStats.value.resources),
				playerCharacterIdState,
				characterStateStore.character.value.name,
				$state.snapshot(gameActionsState.value),
				$state.snapshot(playerCharactersGameState)
			);
		gameActionsState.value = updatedGameActionsState;
		playerCharactersGameState = updatedPlayerCharactersGameState;
		tick().then(() => customActionInput && customActionInput.scrollIntoView(false));
		if (characterActionsState.value.length === 0) {
			// Get current resources for the active character
			const currentResources = getCurrentCharacterGameState();
			const characterStatsWithCurrentResources = {
				...characterStateStore.characterStats.value,
				resources: Object.fromEntries(
					Object.entries(characterStateStore.characterStats.value.resources).map(([key, resource]) => [
						key,
						{
							...resource,
							current_value: currentResources?.[key]?.current_value ?? resource.start_value ?? resource.max_value
						}
					])
				)
			};
			

					const restrainingStateForActive = getActiveRestrainingState(
						partyState.value,
						playerCharactersIdToNamesMapState.value,
						characterStateStore.character.value.name,
						restrainedExplanationByMemberState.value,
						currentGameActionState
					);
			const { thoughts, actions } = await actionAgent.generateActions(
				currentGameActionState,
				historyMessagesState.value,
				storyState.value,
				characterStateStore.character.value,
				characterStatsWithCurrentResources,
				inventoryState.value,
				aiStateStore.systemInstructions.value.generalSystemInstruction,
				aiStateStore.systemInstructions.value.actionAgentInstruction,
				await getRelatedHistory(
					summaryAgent,
					undefined,
					undefined,
					relatedStoryHistoryState.value,
					customMemoriesState.value
				),
				gameSettingsState.value?.aiIntroducesSkills,
				restrainingStateForActive,
				additionalActionInputState.value
			);
			characterActionsState.value = actions;
			thoughtsState.value.actionsThoughts = thoughts;
			// Cache generated actions for active character
			const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
			characterActionsByMemberState.value[activeId] = actions;
		}
		renderGameState(currentGameActionState, characterActionsState.value);
		if (!didAIProcessDiceRollActionState.value) {
			openDiceRollDialog(undefined, undefined, undefined, undefined);
		}
		checkForLevelUp();
	}

	async function initializeGame() {
		await sendAction({
			characterName: characterStateStore.character.value.name,
			text: GameAgent.getStartingPrompt()
		});
		if (gameActionsState.value.length === 0) return;
		// Initialize all resources when the game is first started.

		const { updatedGameActionsState, updatedPlayerCharactersGameState } = refillResourcesFully(
			$state.snapshot(characterStateStore.characterStats.value.resources),
			playerCharacterIdState,
			characterStateStore.character.value.name,
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
		combatAgent: CombatAgent
	): Promise<Array<NPCAction>> {
		// Get details for all NPC targets based on the current game action state.
		const allNpcsDetailsAsList = gameLogic
			.getAllNpcsIds(currentGameActionState.currently_present_npcs)
			.map((npcId) => {
				const npc = npcState[npcId.uniqueTechnicalNameId];
				if (!npc) return undefined;
				return {
					technicalId: npcId.uniqueTechnicalNameId,
					relation: npcLogic.deriveRelationForNpc(
						currentGameActionState.currently_present_npcs,
						npcId.uniqueTechnicalNameId
					),
					is_party_member: npc.is_party_member,
					class: npc.class,
					rank_enum_english: npc.rank_enum_english,
					level: npc.level,
					spells_and_abilities: npc.spells_and_abilities.map(
						(ability: Ability) => ability.name + ': ' + ability.effect
					)
				};
			})
			.filter((npc) => npc !== undefined);

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
		const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
		const requiredSkillProgression = getRequiredSkillProgression(
			skillName,
			characterStateStore.characterStats.value
		);
		if (requiredSkillProgression) {
			// Initialize member's skills progression if not exists
			if (!skillsProgressionState.value[activeId]) {
				skillsProgressionState.value[activeId] = {};
			}
			if (!skillsProgressionState.value[activeId][skillName]) {
				skillsProgressionState.value[activeId][skillName] = 0;
			}
			
			if (skillsProgressionState.value[activeId][skillName] >= requiredSkillProgression) {
				console.log('Advancing skill ' + skillName + ' by 1 for character ' + activeId);
				characterStateStore.characterStats.value.skills[skillName] += 1;
				skillsProgressionState.value[activeId][skillName] = 0;
				gameActionsState.value[gameActionsState.value.length].stats_update.push({
					sourceName: characterStateStore.character.value.name,
					targetName: characterStateStore.character.value.name,
					value: { result: skillName },
					type: 'skill_increased'
				});
				
				// Update party stats for the active member
				const memberStats = partyStatsState.value.members.find(m => m.id === activeId);
				if (memberStats) {
					memberStats.stats.skills[skillName] = characterStateStore.characterStats.value.skills[skillName];
				}
			}
		} else {
			console.log('No required skill progression found for skill: ' + skillName);
		}
	};

	const addSkillProgression = (skillName: string, skillProgression: number) => {
		if (skillProgression) {
			const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
			// Initialize member's skills progression if not exists
			if (!skillsProgressionState.value[activeId]) {
				skillsProgressionState.value[activeId] = {};
			}
			if (!skillsProgressionState.value[activeId][skillName]) {
				skillsProgressionState.value[activeId][skillName] = 0;
			}
			console.log('Adding skill progression for ' + skillName + ': ' + skillProgression + ' to character ' + activeId);
			skillsProgressionState.value[activeId][skillName] += skillProgression;
		}
	};
	function openDiceRollDialog(
			waitForFunction?: Promise<void>,
			waitForActionsResult?: Promise<void>,
			deadNPCs?: Array<string>,
			onResultCallback?: (result: DiceRollResult | undefined) => void
		) {

		didAIProcessDiceRollActionState.value = false;
		diceRollDialog?.show();
		diceRollDialog?.addEventListener('close', function handleDiceModalClose() {
			diceRollDialog?.removeEventListener('close', handleDiceModalClose);
			const diceRollResult = diceRollDialog?.returnValue as DiceRollResult | undefined;
			const dice_roll_addition_text = getDiceRollPromptAddition(diceRollResult);

				// Callback path (combat immediate roll). We do not send the action yet.
				if (onResultCallback) {
					onResultCallback(diceRollResult);
				didAIProcessDiceRollActionState.value = true;
				return;
			}

			// Original single-action flow: apply skill progression + send immediately.
			const skillName = getSkillIfApplicable(characterStateStore.characterStats.value, chosenActionState.value);
			if (skillName && diceRollResult) {
				skillsProgressionForCurrentActionState = getSkillProgressionForDiceRoll(diceRollResult);
			}
			additionalStoryInputState.value += '\n' + dice_roll_addition_text + '\n';
			sendAction(
				chosenActionState.value,
				false,
				dice_roll_addition_text,
				waitForFunction,
				waitForActionsResult,
				deadNPCs
			);
		});
	}

	function handleAIError() {
		if (!didAIProcessDiceRollActionState.value) {
				openDiceRollDialog(undefined, undefined, undefined, undefined);
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
			await handleActionSelection(chosenActionState.value, { forceRollDice: true });
		}
		customActionInput && (customActionInput.value = '');
		customActionImpossibleReasonState = undefined;
	}

    // Centralized handler to either queue a combat action (with optional dice roll) or immediately send it when not in combat.
    // Options:
    //  - forceRollDice: always trigger dice roll dialog even if mustRollDice() returns false (used for impossible actions retry)
    //  - skipDice: never open dice dialog (even if mustRollDice would require) – default false
    async function handleActionSelection(action: Action, options?: { forceRollDice?: boolean; skipDice?: boolean }) {
        const inCombat = currentGameActionState.is_character_in_combat;
        const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
        if (inCombat) {
            // Queue action for party combat turn
            selectedCombatActionsByMemberState.value[activeId] = action;
            const needsDice = !options?.skipDice && (options?.forceRollDice || mustRollDice(action, true));
            if (needsDice) {
                // Open dice dialog and store outcome when resolved
                chosenActionState.value = $state.snapshot(action);
                openDiceRollDialog(undefined, undefined, undefined, (result) => {
                    selectedCombatActionsDiceAdditionsState[activeId] = getDiceRollPromptAddition(result);
                    selectedCombatActionsLockedState[activeId] = true;
                    if (actionsDiv) actionsDiv.innerHTML = '';
                    renderGameState(currentGameActionState, characterActionsState.value);
                });
            } else {
                selectedCombatActionsLockedState[activeId] = true;
                if (actionsDiv) actionsDiv.innerHTML = '';
                renderGameState(currentGameActionState, characterActionsState.value);
            }
        } else {
            // Immediate resolution path
            chosenActionState.value = $state.snapshot(action);
            await sendAction(action, mustRollDice(action, false));
        }
    }

	//TODO sendAction should not be handled here so it can be externally called
	async function checkGameEnded() {
		// Check if ALL party members are dead (for party mode)
		if (partyState.value.members.length > 0) {
			const allDead = partyState.value.members.every(member => {
				const memberState = playerCharactersGameState[member.id];
				const emptyKeys = getEmptyCriticalResourceKeys(memberState);
				return emptyKeys.length > 0;
			});
			
			if (!isGameEnded.value && allDead) {
				isGameEnded.value = true;
				await sendAction({
					characterName: characterStateStore.character.value.name,
					text: 'All party members have fallen. The adventure ends here.'
				});
			}
		} else {
			// Single character mode
			const emptyResourceKeys = getEmptyCriticalResourceKeys(
				playerCharactersGameState[playerCharacterIdState]
			);
			if (!isGameEnded.value && emptyResourceKeys.length > 0) {
				isGameEnded.value = true;
				await sendAction({
					characterName: characterStateStore.character.value.name,
					text: GameAgent.getGameEndedPrompt(emptyResourceKeys)
				});
			}
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
		characterActionsByMemberState.reset();
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
					characterStateStore.characterStats.value,
					aiStateStore.systemInstructions.value.generalSystemInstruction
				)
				.then((newNPCState: NPCState) => {
					if (newNPCState) {
						combatLogic.addResourceValues(newNPCState);
						newNPCsIds.forEach((id) => {
							if (newNPCState[id.uniqueTechnicalNameId]) {
								newNPCState[id.uniqueTechnicalNameId].known_names = [id.displayName];
							}
						});
						npcState.value = { ...npcState.value, ...newNPCState };
						console.log(stringifyPretty(npcState.value));
					}
				});
		}
	}

	function checkForLevelUp() {
		// Check level-up for all party members
		partyState.value.members.forEach(member => {
			const memberGameState = playerCharactersGameState[member.id];
			const memberStats = partyStatsState.value.members.find(m => m.id === member.id);
			
			if (memberGameState && memberStats) {
				const neededXP = getXPNeededForLevel(memberStats.stats.level);
				const canLevelUp = neededXP && memberGameState.XP.current_value >= neededXP;
				
				// Store level-up availability per member
				if (!levelUpState.value.partyLevelUpStatus) {
					levelUpState.value.partyLevelUpStatus = {};
				}
				levelUpState.value.partyLevelUpStatus[member.id] = canLevelUp || false;
			}
		});
		
		// Enable button if ANY party member can level up
		const anyCanLevelUp = Object.values(levelUpState.value.partyLevelUpStatus || {}).some(status => status);
		levelUpState.value.buttonEnabled = anyCanLevelUp;
		
		// For active character (for backward compatibility)
		const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
		const neededXP = getXPNeededForLevel(characterStateStore.characterStats.value.level);
		if (
			neededXP &&
			playerCharactersGameState[activeId]?.XP.current_value >= neededXP
		) {
			levelUpState.value.buttonEnabled = true;
		}
	}
	
	async function confirmCombatActions() {
		if (!currentGameActionState.is_character_in_combat) return;

		isAiGeneratingState = true;

		// Aggregate combat actions with inline dice outcomes
		let combatActionsPrompt = '\n\nPARTY COMBAT ACTIONS:\n';
		let actionsCount = 0
		for (const member of partyState.value.members) {
			const selectedAction = selectedCombatActionsByMemberState.value[member.id];
			const outcomeText = selectedCombatActionsDiceAdditionsState[member.id];
			if (selectedAction) {
				// Insert outcome directly after the action sentence if present
				combatActionsPrompt += `- ${member.character.name}: ${selectedAction.text}; ${outcomeText}\n`;
				actionsCount += 1;
			} else {
				combatActionsPrompt += `- ${member.character.name}: [AI choose an appropriate action]\n`;
			}
		}
		combatActionsPrompt += actionsCount >= partyState.value.members.length ? '' 
		:'\nFor party members without chosen actions, generate appropriate actions based on the combat situation and their abilities.';

		const partyAction: Action = {
			characterName: partyState.value.members.map((m) => m.character.name).join(', '),
			text: combatActionsPrompt,
			type: 'Party Combat Turn'
		};

		chosenActionState.value = $state.snapshot(partyAction);
		await sendAction(chosenActionState.value, false);

		// Reset combat selection states
		selectedCombatActionsByMemberState.value = {};
		selectedCombatActionsDiceAdditionsState = {};
		selectedCombatActionsLockedState = {};

		isAiGeneratingState = false;
	}
	
	function hasAnySelectedCombatActions(): boolean {
		return Object.values(selectedCombatActionsByMemberState.value).some(action => action !== null && action !== undefined);
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
			? 'The following action outcome context is the hidden truth. On a success, include this truth in the narration. On a failure, do not reaveal it: ' +
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
		// Use neutral regular_success to avoid triggering failure/critical branches pre-confirm.
		additionalStoryInput = gameLogic.addAdditionsFromActionSideeffects(
			action,
			additionalStoryInput,
			gameSettingsState.value.randomEventsHandling,
			currentGameActionState.is_character_in_combat,
			'regular_success'
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

	const applyGameEventEvaluationForMember = (memberId: string, evaluated: EventEvaluation) => {
				if (!evaluated) return;
				const currentStored = eventEvaluationByMemberState.value[memberId] || initialEventEvaluationState;
				let updated: EventEvaluation = { ...currentStored };

				// Character transformation detection
				const changeInto = evaluated?.character_changed?.changed_into;
				if (changeInto && changeInto !== currentStored.character_changed?.changed_into) {
					updated = {
						...updated,
						character_changed: {
							...evaluated.character_changed!,
							aiProcessingComplete: false,
							showEventConfirmationDialog: false
						}
					};
				}

				// Abilities learned filtering (exclude already known & duplicates in stored state)
				const abilities = evaluated?.abilities_learned?.abilities
					?.filter(
						(a) => !characterStateStore.characterStats.value?.spells_and_abilities.some((b) => b.name === a.name)
					)
					.filter(
						(newAbility) =>
							!currentStored.abilities_learned?.abilities?.some(
								(existing) =>
									existing.uniqueTechnicalId === newAbility.uniqueTechnicalId ||
									existing.name === newAbility.name
								)
						);
				if (abilities && abilities.length > 0) {
					updated = {
						...updated,
						abilities_learned: {
							...updated.abilities_learned,
							abilities: abilities,
							aiProcessingComplete: false,
							showEventConfirmationDialog: false
						}
					};
				}

				// Persist in mapping
				eventEvaluationByMemberState.value = {
					...eventEvaluationByMemberState.value,
					[memberId]: updated
				};
				// If active member, reflect in single-character reactive state for existing UI compatibility
				const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
				if (memberId === activeId) {
					eventEvaluationState.value = updated;
				}
			}

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
			aiStateStore.systemInstructions.value.generalSystemInstruction,
			aiStateStore.systemInstructions.value.storyAgentInstruction,
			isCharacterInCombat ? aiStateStore.systemInstructions.value.combatAgentInstruction : '',
			historyMessagesState.value,
			storyState.value,
			characterStateStore.character.value,
			playerCharactersGameState[playerCharacterIdState],
			inventoryState.value,
			relatedHistory,
			gameSettingsState.value,
			simulation
		);
		console.log('New game action state:', newState);

		if (newState.story) {
			await processPostStory(newState, action, simulation);

			const skillName = getSkillIfApplicable(characterStateStore.characterStats.value, action);
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
				getRelatedHistoryForStory();
				// Build party evaluation input (fallback to single active character if party not initialized)
				const partyMembersForEvaluation = (partyState.value.members.length
					? partyState.value.members
					: [{ id: playerCharacterIdState, character: characterStateStore.character.value }]
				).map((m) => ({
					id: m.id,
					name: m.character.name,
					known_abilities:
						(partyStatsState.value.members.find((ms) => ms.id === m.id)?.stats.spells_and_abilities || characterStateStore.characterStats.value.spells_and_abilities).map(
							(a) => a.name
						)
				}));

				eventAgent
					.evaluatePartyEvents(
						historyMessagesState.value.slice(-1).map((m) => m.content),
						partyMembersForEvaluation
					)
					.then((evaluation) => {
						console.log('Event evaluation result:', evaluation);
						evaluation.events_by_member.forEach((ev) => {
							console.log(`Applying event evaluation for member ${JSON.stringify(ev)}:`, ev);
							applyGameEventEvaluationForMember(ev.character_id, {
								character_changed: ev.character_changed,
								abilities_learned: ev.abilities_learned
							});
							// Apply per-member restraining state if provided by EventAgent
							if (typeof ev.restrained_state_explanation !== 'undefined') {
								
								restrainedExplanationByMemberState.value = {
									...restrainedExplanationByMemberState.value,
									[ev.character_id]: ev.restrained_state_explanation || null
								};
								console.log(`applied event ${JSON.stringify(restrainedExplanationByMemberState.value)}:`, restrainedExplanationByMemberState.value);
						
							}else{
								restrainedExplanationByMemberState.value = {
									...restrainedExplanationByMemberState.value,
									[ev.character_id]: null
								};
							}
							});
						const perCharThoughts = evaluation.events_by_member
							.map((ev) => `${ev.character_name}: ${ev.reasoning || ''}`)
							.join('\n');
						thoughtsState.value.eventThoughts = evaluation.thoughts + '\n' + perCharThoughts;
					});

				// Generate the next set of actions for all party members
				const generateActionsForAllMembers = async () => {
					const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
					
					// Generate actions for all party members concurrently
					const actionsPromises = partyState.value.members.map(async (member) => {
						// Skip if actions already exist for this member
						if (characterActionsByMemberState.value[member.id]) {
							return null;
						}
						
						try {
							const memberStats = partyStatsState.value.members.find(m => m.id === member.id);
							if (!memberStats) return null;
							
							// Get current resources for this member
							const currentResources = playerCharactersGameState[member.id];
							const memberStatsWithCurrentResources = {
								...memberStats.stats,
								resources: Object.fromEntries(
									Object.entries(memberStats.stats.resources).map(([key, resource]) => [
										key,
										{
											...resource,
											current_value: currentResources?.[key]?.current_value ?? resource.start_value ?? resource.max_value
										}
									])
								)
							};
							
							const memberRestrainingState = getActiveRestrainingState(
								partyState.value,
								playerCharactersIdToNamesMapState.value,
								member.character.name,
								restrainedExplanationByMemberState.value,
								newState
							);
							
							const { thoughts, actions } = await actionAgent.generateActions(
								currentGameActionState,
								historyMessagesState.value,
								storyState.value,
								member.character,
								memberStatsWithCurrentResources,
								inventoryState.value,
								aiStateStore.systemInstructions.value.generalSystemInstruction,
								aiStateStore.systemInstructions.value.actionAgentInstruction,
								relatedHistory,
								gameSettingsState.value?.aiIntroducesSkills,
								memberRestrainingState,
								additionalActionInputState.value
							);
							
							return { memberId: member.id, actions, thoughts, isActive: member.id === activeId };
						} catch (error) {
							console.warn(`Failed to generate actions for ${member.character.name}:`, error);
							return null;
						}
					});
					
					const results = await Promise.all(actionsPromises);
					
					// Process results
					results.forEach(result => {
						if (result && result.actions) {
							characterActionsByMemberState.value[result.memberId] = result.actions;
							
							// If this is the active character, also update the main state and render
							if (result.isActive) {
								characterActionsState.value = result.actions;
								thoughtsState.value.actionsThoughts = result.thoughts;
								renderGameState(currentGameActionState, result.actions);
								addSkillsIfApplicable(result.actions);
							}
						}
					});
					
					resetStatesAfterActionsGenerated();
				};
				
				generateActionsForAllMembers();
				handlePostActionProcessedState();
			}
		}
	}

	// Runs post-story async tasks (image prompt + stats generation) concurrently, then applies results.
	async function processPostStory(newState: GameActionState, action: Action, simulation: string) {
		newState.image_prompt = '';
		checkForNewNPCs(newState);
		npcLogic.addNPCNamesToState(newState.currently_present_npcs, npcState.value);

		const imagePromptPromise = (async () => {
			try {
				const prompt = await imagePromptAgent.generateImagePrompt(
					getLatestStoryMessages(),
					newState.story || '',
					characterStateStore.character.value.name,
					currentGameActionState.image_prompt || ''
				);
				return prompt || 'big letters showing ERROR GENERATING IMAGE PROMPT';
			} catch (e) {
				console.warn('Failed to generate image prompt', e);
				return 'big letters showing ERROR GENERATING IMAGE PROMPT';
			}
		})();

		const statsUpdatesPromise = (async () => {
			try {
				const partyResourcesByName = partyState.value.members.length > 0
					? Object.fromEntries(
							partyState.value.members.map(m => [
								m.character.name,
								playerCharactersGameState[m.id] || {}
							])
					  )
					: { [characterStateStore.character.value.name]: playerCharactersGameState[playerCharacterIdState] };
				const generated = await combatAgent.generateStatsUpdatesFromStory(
					newState.story || '',
					action,
					partyResourcesByName,
					gameLogic.getAllTargetsAsList(currentGameActionState.currently_present_npcs),
					aiStateStore.systemInstructions.value.generalSystemInstruction,
					currentGameActionState.is_character_in_combat
						? aiStateStore.systemInstructions.value.combatAgentInstruction
						: ''
				);
				return generated;
			} catch (e) {
				console.warn('Failed to post-generate stats updates', e);
				return [];
			}
		})();

		const [imagePrompt, statsUpdates] = await Promise.all([
			imagePromptPromise,
			statsUpdatesPromise
		]);

		newState.image_prompt = imagePrompt;
		newState.stats_update = statsUpdates;

		gameLogic.applyGameActionState(
			playerCharactersGameState,
			playerCharactersIdToNamesMapState.value,
			npcState.value,
			inventoryState.value,
			$state.snapshot(newState)
		);
		console.log('new state', stringifyPretty(newState));
	}

	const addSkillsIfApplicable = (actions: Action[]) => {
		if (gameSettingsState.value?.aiIntroducesSkills) {
			actions.forEach((action: Action) => {
				const skill = isNewSkill($state.snapshot(characterStateStore.characterStats.value), action);
				//TODO skill can be trait sometimes which we dont want?
				if (skill) {
					characterStateStore.characterStats.value.skills[skill] = 0;
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
		waitForActionsResult?: Promise<void>,
		deadNPCs?: Array<string>
	) {
		//TODO can happen if action fails multiple times, for retry state is not cleaned then
		if (additionalStoryInputState.value.length > 10_000) {
			console.warn('Additional story input is too long, reducing it to under 10_000 characters.');
			//take the last 10000 characters as it is probably the real input
			additionalStoryInputState.value = additionalStoryInputState.value.slice(-10_000);
		}
		if (!deadNPCs) {
			deadNPCs = npcLogic.removeDeadNPCs(npcState.value);
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
				aiStateStore.systemInstructions.value.generalSystemInstruction,
				aiStateStore.systemInstructions.value.combatAgentInstruction,
				getLatestStoryMessages(),
				storyState.value,
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
				openDiceRollDialog(waitForGroundTruthResult, waitForActionsResult, deadNPCs, undefined);
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

				additionalStoryInputState.value += CombatAgent.getAdditionalStoryInput(
					relatedNPCActionsState.value,
					deadNPCs
				);
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
		const level = $state.snapshot(characterStateStore.characterStats.value.level);
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

		// Get active character ID for resource checks
		const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
		const isLocked = is_character_in_combat && selectedCombatActionsLockedState[activeId];
		
		if (
			!isEnoughResource(
				action,
				playerCharactersGameState[activeId],
				inventoryState.value
			)
		) {
			button.disabled = true;
		}

		// Check if this action is selected for this character in combat
		const isSelected =
			is_character_in_combat && selectedCombatActionsByMemberState.value[activeId] === action;
		if (isSelected) button.className += ' btn-accent';
		if (isLocked) button.disabled = true;

		button.addEventListener('click', () => {
			if (is_character_in_combat) {
				// Prevent changes after lock
				if (selectedCombatActionsLockedState[activeId]) return;
				selectedCombatActionsByMemberState.value[activeId] = action;
				// If dice roll required open dialog with callback, else lock immediately
				if (mustRollDice(action, true)) {
					chosenActionState.value = $state.snapshot(action);
					openDiceRollDialog(undefined, undefined, undefined, (result) => {
						selectedCombatActionsDiceAdditionsState[activeId] = getDiceRollPromptAddition(result);
						selectedCombatActionsLockedState[activeId] = true;
						// Re-render to reflect lock
						if (actionsDiv) actionsDiv.innerHTML = '';
						renderGameState(currentGameActionState, characterActionsState.value);
					});
				} else {
					selectedCombatActionsLockedState[activeId] = true;
					if (actionsDiv) actionsDiv.innerHTML = '';
					renderGameState(currentGameActionState, characterActionsState.value);
				}
			} else {
				// Outside combat original behavior
				chosenActionState.value = $state.snapshot(action);
				sendAction(
					chosenActionState.value,
					gameLogic.mustRollDice(chosenActionState.value, is_character_in_combat)
				);
			}
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
			characterStateStore.character.value,
			characterStateStore.characterStats.value,
			inventoryState.value,
			aiStateStore.systemInstructions.value.generalSystemInstruction,
			aiStateStore.systemInstructions.value.actionAgentInstruction,
			relatedActionHistoryState.value,
			gameSettingsState.value?.aiIntroducesSkills,
			getActiveRestrainingState(
				partyState.value,
				playerCharactersIdToNamesMapState.value,
				characterStateStore.character.value.name,
				restrainedExplanationByMemberState.value,
				currentGameActionState
			),
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
		
		await handleActionSelection(action);
		isAiGeneratingState = false;
	};
	const onCustomDiceRollClosed = () => {
		customDiceRollNotation = '';
		customActionInput && (customActionInput.value = '');
	};
	const onLevelUpModalClosed = (aiLevelUp: AiLevelUp) => {
		if (aiLevelUp) {
			characterStateStore.characterStats.value = applyLevelUp(aiLevelUp, characterStateStore.characterStats.value);
		} else {
			characterStateStore.characterStats.value = {
				...characterStateStore.characterStats.value,
				level: characterStateStore.characterStats.value.level + 1
			};
		}
		levelUpState.reset();

		const { updatedGameActionsState, updatedPlayerCharactersGameState } = refillResourcesFully(
			$state.snapshot(characterStateStore.characterStats.value.resources),
			playerCharacterIdState,
			characterStateStore.character.value.name,
			$state.snapshot(gameActionsState.value),
			$state.snapshot(playerCharactersGameState)
		);
		gameActionsState.value = updatedGameActionsState;
		playerCharactersGameState = updatedPlayerCharactersGameState;
		checkForLevelUp();
	};

	const onSuggestItemActionClosed = async (action?: Action) => {
		if (action) {
			
			
			if (action.is_custom_action) {
				generateActionFromCustomInput(action);
			} else {
				addSkillsIfApplicable([action]);
				await handleActionSelection(action);
			}
		}
		itemForSuggestActionsState = undefined;
	};

	const getCurrentCampaignChapter = (): CampaignChapter | undefined =>
		campaignState.value?.chapters?.find(
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
			characterStateStore.character.value,
			characterStateStore.characterStats.value,
			inventoryState.value,
			aiStateStore.systemInstructions.value.generalSystemInstruction,
			aiStateStore.systemInstructions.value.actionAgentInstruction,
			relatedActionHistoryState.value,
			gameSettingsState.value?.aiIntroducesSkills,
			getActiveRestrainingState(
				partyState.value,
				playerCharactersIdToNamesMapState.value,
				characterStateStore.character.value.name,
				restrainedExplanationByMemberState.value,
				currentGameActionState
			),
			additionalActionInputState.value
		);
		console.log('generatedAction', stringifyPretty(generatedAction));
		action = { ...generatedAction, ...action };
		chosenActionState.value = action;
		addSkillsIfApplicable([action]);
		if (action.is_possible === false) {
			customActionImpossibleReasonState = 'not_plausible';
		} else {
			const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
			if (
				!isEnoughResource(
					action,
					playerCharactersGameState[activeId],
					inventoryState.value
				)
			) {
				customActionImpossibleReasonState = 'not_enough_resource';
			} else {
				customActionImpossibleReasonState = undefined;
				await handleActionSelection(action);
			}
		}
		isAiGeneratingState = false;
	};

	const onCustomActionSubmitted = async (text: string, mustGenerateCustomAction = false) => {
		let action: Action = {
			characterName: characterStateStore.character.value.name,
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
					characterName: characterStateStore.character.value.name,
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
		// Sync mapping immediately (dialog closed)
		const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
		eventEvaluationByMemberState.value[activeId] = eventEvaluationState.value;
		if (confirmed === undefined) {
			return;
		}
		if (confirmed) {
			isAiGeneratingState = true;
			const { transformedCharacter, transformedCharacterStats } = await applyCharacterChange(
				changedInto,
				$state.snapshot(storyState.value),
				$state.snapshot(characterStateStore.character.value),
				$state.snapshot(characterStateStore.characterStats.value),
				characterAgent,
				characterStatsAgent
			);

			if (transformedCharacter) {
				const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
				
				// Update character ID mapping
				addCharacterToPlayerCharactersIdToNamesMap(
					playerCharactersIdToNamesMapState.value,
					activeId,
					transformedCharacter.name
				);
				characterStateStore.character.value = transformedCharacter;
				
				// Update party member if in party mode
				const partyMember = partyState.value.members.find(m => m.id === activeId);
				if (partyMember) {
					partyMember.character = transformedCharacter;
				}
			}
			if (transformedCharacterStats) {
				characterStateStore.characterStats.value = transformedCharacterStats;
				
				// Update party stats if in party mode
				const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
				const memberStats = partyStatsState.value.members.find(m => m.id === activeId);
				if (memberStats) {
					memberStats.stats = transformedCharacterStats;
				}
				
				//generate new actions considering resources might have changed
				regenerateActions();
				additionalStoryInputState.value +=
					'\n After transformation make sure that stats_update refer to the new resources from now on for character ' + characterStateStore.character.value.name + '!\n' +
					stringifyPretty(characterStateStore.characterStats.value.resources);
			}

			//apply new resources
			const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
			playerCharactersGameState[activeId] = {
				...$state.snapshot(characterStateStore.characterStats.value.resources),
				XP: playerCharactersGameState[activeId].XP
			};
			const { updatedGameActionsState, updatedPlayerCharactersGameState } = refillResourcesFully(
				$state.snapshot(characterStateStore.characterStats.value.resources),
				activeId,
				characterStateStore.character.value.name,
				$state.snapshot(gameActionsState.value),
				$state.snapshot(playerCharactersGameState)
			);
			gameActionsState.value = updatedGameActionsState;
			playerCharactersGameState = updatedPlayerCharactersGameState;
		}
		eventEvaluationState.value.character_changed!.aiProcessingComplete = true;
		// Persist updated processing flag
		eventEvaluationByMemberState.value[activeId] = eventEvaluationState.value;
		isAiGeneratingState = false;
	}

	const confirmAbilitiesLearned = (abilities?: Ability[]) => {
		eventEvaluationState.value.abilities_learned!.showEventConfirmationDialog = false;
		if (!abilities) {
			return;
		}
		const activeId = partyState.value.activeCharacterId || playerCharacterIdState;
		eventEvaluationByMemberState.value[activeId] = eventEvaluationState.value;
		eventEvaluationState.value.abilities_learned!.aiProcessingComplete = true;
		if (abilities.length === 0) {
			return;
		}
		console.log('Added new abilities:', stringifyPretty(abilities));
		characterStateStore.characterStats.value = {
			...characterStateStore.characterStats.value,
			spells_and_abilities: [...characterStateStore.characterStats.value.spells_and_abilities, ...abilities]
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

		const restrainingStateForActive = getActiveRestrainingState(
			partyState.value,
			playerCharactersIdToNamesMapState.value,
			characterStateStore.character.value.name,
			restrainedExplanationByMemberState.value,
			currentGameActionState
		);
		const { thoughts, actions } = await actionAgent.generateActions(
			currentGameActionState,
			historyMessagesState.value,
			storyState.value,
			characterStateStore.character.value,
			characterStateStore.characterStats.value,
			inventoryState.value,
			aiStateStore.systemInstructions.value.generalSystemInstruction,
			aiStateStore.systemInstructions.value.actionAgentInstruction,
			await getRelatedHistory(
				summaryAgent,
				undefined,
				undefined,
				relatedStoryHistoryState.value,
				customMemoriesState.value
			),
			gameSettingsState.value?.aiIntroducesSkills,
			restrainingStateForActive,
			additionalActionInputState.value
		);
		characterActionsState.value = actions;
		thoughtsState.value.actionsThoughts = thoughts;
		renderGameState(currentGameActionState, characterActionsState.value);
	}

	function migrateStates() {
		characterStateStore.characterStats.value = migrateIfApplicable(
			'characterStatsState',
			$state.snapshot(characterStateStore.characterStats.value)
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
			? historyMessagesState.value
			: updatedHistoryMessages;
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

	// Derived convenience flags for disabling further selections when combat action is locked
	const activeMemberId = $derived(partyState.value.activeCharacterId || playerCharacterIdState);
	const isActiveCombatActionLocked = $derived(
		currentGameActionState.is_character_in_combat && selectedCombatActionsLockedState[activeMemberId]
	);

	async function handleStateCommand(action: Action) {
		isAiGeneratingState = true;
		action.text += SUDO_COMMAND + '\nOnly apply the mentioned state updates, but nothing else.';
		const newState = await gameAgent.generateStateOnlyNoStory(
			action,
			characterStateStore.character.value.name,
			playerCharactersGameState[playerCharacterIdState],
			inventoryState.value,
			npcState.value
		);
		isAiGeneratingState = false;
		if (customActionInput) customActionInput.value = '';
	
		if (newState) {
			// Apply the new state to the game logic
			console.log('Generated new state from state command:', stringifyPretty(newState));
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


	// Track in-flight generations so we don't start duplicate calls for same character
	let actionGenerationInFlight: Record<string, boolean> = {};

	const onSwitchCharacter = async (characterId: string) => {
		const activeId = characterId;

		// Update active character id first so resource lookups use the new id.
		if (partyState.value.activeCharacterId !== activeId) {
			partyState.value.activeCharacterId = activeId;
			// Sync character + stats to selected member for immediate UI consistency
			const member = partyState.value.members.find((m) => m.id === activeId);
			if (member) {
				characterStateStore.character.value = member.character;
				const memberStats = partyStatsState.value.members.find((m) => m.id === activeId);
				if (memberStats) {
					characterStateStore.characterStats.value = memberStats.stats;
				}
			}
		}
					// Load per-member event evaluation state for UI
			eventEvaluationState.value =
				eventEvaluationByMemberState.value[activeId] || initialEventEvaluationState;

		// If a generation is already running for this character and no cached actions yet, just bail.
		if (actionGenerationInFlight[activeId]) {
			return; // Prevent spawning another LLM request
		}

		// Persist current visible actions with the previously active character id
		if (characterActionsState.value.length > 0) {
			const prevId = Object.keys(characterActionsByMemberState.value).find(
				id => characterActionsByMemberState.value[id] === characterActionsState.value
			);
			if (prevId && prevId !== activeId) {
				characterActionsByMemberState.value[prevId] = characterActionsState.value;
			}
		}

		// If cached actions exist, show them immediately (only if still the active character)
		if (
			characterActionsByMemberState.value[activeId] &&
			characterActionsByMemberState.value[activeId].length > 0
		) {
			if (partyState.value.activeCharacterId === activeId) {
				characterActionsState.value = characterActionsByMemberState.value[activeId];
				if (actionsDiv) actionsDiv.innerHTML = '';
				renderGameState(currentGameActionState, characterActionsState.value);
			}
			checkForLevelUp();
			return;
		}

		actionGenerationInFlight[activeId] = true;
		if (partyState.value.activeCharacterId === activeId) {
			characterActionsState.reset();
			if (actionsDiv) actionsDiv.innerHTML = '';
		}

		const currentCharacter = partyState.value.members.find(m => m.id === activeId)?.character;
		const currentStats = partyStatsState.value.members.find(m => m.id === activeId)?.stats;


		let thoughts, actions;
		try {
			const restrainingStateForActive = getActiveRestrainingState(
				partyState.value,
				playerCharactersIdToNamesMapState.value,
				currentCharacter!.name,
				restrainedExplanationByMemberState.value,
				currentGameActionState
			);
			({ thoughts, actions } = await actionAgent.generateActions(
				currentGameActionState,
				historyMessagesState.value,
				storyState.value,
				currentCharacter!,
				currentStats!,
				inventoryState.value,
				aiStateStore.systemInstructions.value.generalSystemInstruction,
				aiStateStore.systemInstructions.value.actionAgentInstruction,
				await getRelatedHistory(
					summaryAgent,
					undefined,
					undefined,
					relatedStoryHistoryState.value,
					customMemoriesState.value
				),
				gameSettingsState.value?.aiIntroducesSkills,
				restrainingStateForActive,
				additionalActionInputState.value
			));
		} catch (e) {
			// On failure clear in-flight flag and rethrow/log
			console.warn('Action generation failed for character', activeId, e);
			actionGenerationInFlight[activeId] = false;
			return; // Do not proceed
		}
		finally {
			// Nothing here yet; keep for future cleanup.
		}

		// Always save generated actions for this character
		characterActionsByMemberState.value[activeId] = actions;

		// Only update UI if still active character
		if (partyState.value.activeCharacterId === activeId) {
			characterActionsState.value = actions;
			thoughtsState.value.actionsThoughts = thoughts;
			if (actionsDiv) actionsDiv.innerHTML = '';
			renderGameState(currentGameActionState, characterActionsState.value);
		}

		actionGenerationInFlight[activeId] = false;
		checkForLevelUp();
	};
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
			restrainedExplanationByMemberState={restrainedExplanationByMemberState.value}
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
		playerName={characterStateStore.character.value.name}
		resources={playerCharactersGameState[playerCharacterIdState]}
		abilities={characterStateStore.characterStats.value?.spells_and_abilities}
		storyImagePrompt={storyState.value.general_image_prompt}
		targets={currentGameActionState.currently_present_npcs}
		onclose={onTargetedSpellsOrAbility}
		party={partyState.value}
		disableSelection={isActiveCombatActionLocked}
	></UseSpellsAbilitiesModal>
	<UseItemsModal
		bind:dialogRef={useItemsModal}
		{onDeleteItem}
		playerName={characterStateStore.character.value.name}
		inventoryState={inventoryState.value}
		storyImagePrompt={storyState.value.general_image_prompt}
		oncrafting={(craftingPrompt) => {
			if (craftingPrompt) {
				onCustomActionSubmitted(craftingPrompt, true);
			}
		}}
		onclose={onItemUseChosen}
		disableSelection={isActiveCombatActionLocked}
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
		currentLevel={characterStateStore.characterStats.value?.level}
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
	
	<!-- Party Member Switcher above actions -->
	{#if partyState.value.members.length > 1 && !isGameEnded.value}
		<div class="mt-4">
			<PartyMemberSwitcher
				party={partyState.value}
				onSwitch={() => onSwitchCharacter($state.snapshot(partyState.value.activeCharacterId))}
			/>
		</div>
	{/if}
	
	<div id="actions" bind:this={actionsDiv} class="mt-2 p-4 pb-0 pt-0"></div>
	
	{#if currentGameActionState.is_character_in_combat && !isGameEnded.value}
		<div class="p-4 pb-0 pt-0">
			<button
				onclick={() => confirmCombatActions()}
				class="text-md btn btn-success mb-3 w-full"
				>
				{#if hasAnySelectedCombatActions()}
					Confirm Combat Actions ({Object.keys(selectedCombatActionsByMemberState.value).filter(k => selectedCombatActionsByMemberState.value[k]).length}/{partyState.value.members.length} selected)
				{:else}
					Confirm Combat Actions (Let AI choose for all)
				{/if}
			</button>
		</div>
	{/if}
	
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
							characterName: characterStateStore.character.value.name,
							text: 'Continue The Tale'
						})}
					class="text-md btn btn-neutral mb-3 w-full"
					>Continue The Tale.
				</button>

				{#if levelUpState.value.buttonEnabled}
					<button
						onclick={() => {
							levelUpClicked(characterStateStore.character.value.name);
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
					disabled={isActiveCombatActionLocked && customActionReceiver === 'Character Action'}
					title={isActiveCombatActionLocked && customActionReceiver === 'Character Action' ? 'Combat action already chosen for this round' : ''}
					id="user-input"
					placeholder={getCustomActionPlaceholder(customActionReceiver)}
				/>
				<button
					onclick={() => onCustomActionSubmitted(customActionInput.value)}
					disabled={isActiveCombatActionLocked && customActionReceiver === 'Character Action'}
					title={isActiveCombatActionLocked && customActionReceiver === 'Character Action' ? 'Combat action already chosen for this round' : ''}
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
