<script lang="ts">
	import { useLocalStorage } from '$lib/state/useLocalStorage.svelte';
	import {
		type Action,
		type GameActionState,
		GameAgent,
		type InventoryState,
		type PlayerCharactersGameState,
		SLOW_STORY_PROMPT
	} from '$lib/ai/agents/gameAgent';
	import { DifficultyAgent } from '$lib/ai/agents/difficultyAgent';
	import { onMount, tick } from 'svelte';
	import { handleError, stringifyPretty } from '$lib/util.svelte';
	import LoadingModal from '$lib/components/LoadingModal.svelte';
	import StoryProgressionWithImage from '$lib/components/StoryProgressionWithImage.svelte';
	import { SummaryAgent } from '$lib/ai/agents/summaryAgent';
	import {
		type CharacterStats,
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
	import { initialStoryState, type Story } from '$lib/ai/agents/storyAgent';
	import { type CharacterDescription, initialCharacterState } from '$lib/ai/agents/characterAgent';
	import DiceRollComponent from '$lib/components/DiceRollComponent.svelte';
	import UseItemsModal from '$lib/components/UseItemsModal.svelte';
	import { type Campaign, CampaignAgent } from '$lib/ai/agents/campaignAgent';
	import { ActionAgent } from '$lib/ai/agents/actionAgent';
	import LoadingIcon from '$lib/components/LoadingIcon.svelte';
	import TTSComponent from '$lib/components/TTSComponent.svelte';

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
	let gameAgent,
		difficultyAgent,
		summaryAgent,
		characterStatsAgent,
		combatAgent,
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
	const additionalActionInputState = useLocalStorage<string>('additionalActionInputState');
	const isGameEnded = useLocalStorage<boolean>('isGameEnded', false);
	let playerCharactersGameState: PlayerCharactersGameState = $state({});
	const currentGameActionState: GameActionState = $derived(
		(gameActionsState.value && gameActionsState.value[gameActionsState.value.length - 1]) ||
			({} as GameActionState)
	);
	let actionsTextForTTS: string = $state('');
	//TODO const lastCombatSinceXActions: number = $derived(
	//	gameActionsState.value && (gameActionsState.value.length - (gameActionsState.value.findLastIndex(state => state.is_character_in_combat ) + 1))
	//);

	//feature toggles
	let useDynamicCombat = useLocalStorage('useDynamicCombat', true);
	const ttsVoiceState = useLocalStorage<string>('ttsVoice');

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
		campaignAgent = new CampaignAgent(llm);
		actionAgent = new ActionAgent(llm);
		//Start game when not already started
		playerCharactersGameState = { [characterState.value.name]: { currentHP: 0, currentMP: 0 } };
		if (!currentGameActionState?.story) {
			if (!currentGameActionState?.stats_update) {
				handleStartingStats(playerCharactersGameState, characterState.value.name);
			}
			await sendAction({
				characterName: characterState.value.name,
				text: gameAgent.getStartingPrompt()
			});
		} else {
			gameLogic.applyGameActionStates(
				playerCharactersGameState,
				npcState.value,
				inventoryState.value,
				gameActionsState.value
			);
			if (characterActionsState.value.length === 0) {
				characterActionsState.value = await actionAgent.generateActions(
					currentGameActionState,
					historyMessagesState.value,
					storyState.value,
					characterState.value,
					characterStatsState.value,
					inventoryState.value,
					additionalActionInputState.value,
					customSystemInstruction.value
				);
			}
			renderGameState(currentGameActionState, characterActionsState.value);
			tick().then(() => customActionInput.scrollIntoView(false));
		}
		if (!didAIProcessDiceRollActionState.value) {
			openDiceRollDialog(additionalActionInputState.value);
		}
	});

	function handleStartingStats(
		playerCharactersGameState: PlayerCharactersGameState,
		playerName: string
	) {
		const startingResourcesUpdateObject = gameAgent.getStartingResourcesUpdateObject(
			characterStatsState.value.resources.MAX_HP,
			characterStatsState.value.resources.MAX_MP,
			playerName
		);
		playerCharactersGameState[playerName].currentHP = characterStatsState.value.resources.MAX_HP;
		playerCharactersGameState[playerName].currentMP = characterStatsState.value.resources.MAX_MP;
		gameActionsState.value.push(startingResourcesUpdateObject);
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
			determinedActionsAndStatsUpdate
		);
		const deadNPCs = gameLogic.removeDeadNPCs(npcState.value);
		const aliveNPCs = allNpcsDetailsAsList
			.filter((npc) => npc?.resources && npc.resources.current_hp > 0)
			.map((npc) => npc?.nameId);

		let additionalActionInput = combatAgent.getAdditionalActionInput(
			determinedActionsAndStatsUpdate.actions,
			deadNPCs,
			aliveNPCs,
			playerCharactersGameState
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
			sendAction({ ...chosenActionState.value, text: actionText }, false, additionalActionInput);
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
		if (!isGameEnded.value && playerCharactersGameState[characterState.value.name].currentHP <= 0) {
			isGameEnded.value = true;
			await sendAction({
				characterName: characterState.value.name,
				text: gameAgent.getGameEndedPrompt()
			});
		}
		isGameEnded.value = playerCharactersGameState[characterState.value.name].currentHP <= 0;
	}

	function resetStatesAfterActionProcessed() {
		chosenActionState.reset();
		additionalActionInputState.reset();
		characterActionsState.reset();
		actionsDiv.innerHTML = '';
		customActionInput.value = '';
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

	async function advanceChapterIfApplicable(action: Action, additionalActionInput: string) {
		if (
			didAIProcessActionState.value &&
			campaignState.value.chapters &&
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
						additionalActionInput +=
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
					campaignState.value.chapters[currentChapterState.value - 1].plot_points.length ||
				mappedCampaignChapterId > currentChapterState.value
			) {
				additionalActionInput += startNextChapter();
			}
		}
		return additionalActionInput;
	}

	function addAdditionsFromActionSideeffects(action: Action, additionalActionInput: string) {
		if ((action.is_straightforward + '').includes('false')) {
			additionalActionInput += '\n' + SLOW_STORY_PROMPT;
		}
		const encounterString = '' + action.enemyEncounterExplanation;
		if (encounterString.includes('high') && !encounterString.includes('low')) {
			additionalActionInput +=
				'\nenemyEncounter: ' +
				action.enemyEncounterExplanation +
				' Players take first turn, wait for their action.';
		}
		if (action.text.includes('sudo')) {
			additionalActionInput += '\nPlay out this action even if it is not plausible!';
		} else {
			additionalActionInput +=
				'\n' +
				'For the story narration never mention game meta elements like dice rolls; Only describe the narrative the character experiences.';
		}
		return additionalActionInput;
	}

	async function sendAction(action: Action, rollDice = false, additionalActionInput = '') {
		try {
			if (rollDice) {
				openDiceRollDialog(additionalActionInput);
			} else {
				isAiGeneratingState = true;
				additionalActionInput = additionalActionInput || '';
				const combatAndNPCState = await getCombatAndNPCState(action);

				if (campaignState.value?.chapters?.length > 0) {
					additionalActionInput = await advanceChapterIfApplicable(action, additionalActionInput);
				}
				additionalActionInput += combatAndNPCState.additionalActionInput;
				additionalActionInput = addAdditionsFromActionSideeffects(action, additionalActionInput);

				//TODO additionalActionInput += '\nInclude the actions for this scene of all currently_present_npcs';

				additionalActionInputState.value = additionalActionInput;
				didAIProcessActionState.value = false;
				const { newState, updatedHistoryMessages } = await gameAgent.generateStoryProgression(
					action,
					additionalActionInput,
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
							newState
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
								additionalActionInput,
								customSystemInstruction.value
							)
							.then((actions) => {
								if (actions) {
									console.log(stringifyPretty(actions));
									characterActionsState.value = actions;
									renderGameState(currentGameActionState, actions);
								}
							});
					}
				}
				isAiGeneratingState = false;
			}
		} catch (e) {
			isAiGeneratingState = false;
			handleError(e as string);
		}
	}

	function renderGameState(
		state: GameActionState,
		actions: Array<Action>,
		addContinueStory = true
	) {
		if (!isGameEnded.value) {
			actions.forEach((action) =>
				addActionButton(action, state.is_character_in_combat, 'ai-gen-action')
			);
			if (addContinueStory) {
				addActionButton({
					characterName: characterState.value.name,
					text: 'Continue The Tale'
				});
			}
			actionsTextForTTS =
				Array.from(document.querySelectorAll('.ai-gen-action'))
					.map((elm) => elm.textContent || '')
					.join(' ') || '';
		}
	}

	function addActionButton(action: Action, is_character_in_combat?: boolean, addClass?: string) {
		const button = document.createElement('button');
		button.className = 'btn btn-neutral mb-3 w-full text-md';
		if (addClass) {
			button.className += ' ' + addClass;
		}
		const mpCost = parseInt(action.mp_cost as unknown as string) || 0;
		const isEnoughMP =
			mpCost === 0 || playerCharactersGameState[characterState.value.name].currentMP >= mpCost;
		if (mpCost > 0) {
			const mpString = ' (' + mpCost + ' MP).';
			button.textContent = action.text.replaceAll('.', '');
			button.textContent += mpString;
		} else {
			button.textContent = action.text.endsWith('.') ? action.text : action.text + '.';
		}
		if (!isEnoughMP) {
			button.disabled = true;
		}
		button.addEventListener('click', () => {
			chosenActionState.value = $state.snapshot(action);
			sendAction(
				chosenActionState.value,
				gameLogic.mustRollDice(chosenActionState.value, is_character_in_combat),
				additionalActionInputState.value
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

		await sendAction(
			action,
			gameLogic.mustRollDice(action, currentGameActionState.is_character_in_combat),
			targetAddition + abilityAddition + additionalActionInputState.value
		);
		isAiGeneratingState = false;
	};
</script>

<div id="game-container" class="container mx-auto p-4">
	{#if isAiGeneratingState}
		<LoadingModal></LoadingModal>
	{/if}
	{#if errorState.userMessage}
		<ErrorDialog onclose={handleAIError} />
	{/if}
	<UseSpellsAbilitiesModal
		bind:dialogRef={useSpellsAbilitiesModal}
		playerName={characterState.value.name}
		currentMP={playerCharactersGameState[characterState.value.name]?.currentMP}
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
		targets={currentGameActionState.currently_present_npcs}
		onclose={onTargetedSpellsOrAbility}
	></UseItemsModal>

	<DiceRollComponent
		bind:diceRollDialog
		action={chosenActionState.value}
		resetState={didAIProcessDiceRollActionState.value}
	></DiceRollComponent>
	<div class="menu menu-horizontal sticky top-0 z-10 flex justify-between bg-base-200">
		<output id="hp" class="ml-1 text-lg font-semibold text-red-500">
			HP: {playerCharactersGameState[characterState.value.name]?.currentHP}</output
		>
		<output id="mp" class="ml-1 text-lg font-semibold text-blue-500">
			MP: {playerCharactersGameState[characterState.value.name]?.currentMP}</output
		>
	</div>
	<div id="story" class="mt-4 justify-items-center rounded-lg bg-base-100 p-4 shadow-md">
		<!-- For proper updating, need to use gameActionsState.id as each block id -->
		{#each gameActionsState.value
			.filter((s) => s.story)
			.slice(-3) as gameActionState (gameActionState.id)}
			<StoryProgressionWithImage
				story={gameActionState.story}
				imagePrompt="{gameActionState.image_prompt} {storyState.value.general_image_prompt}"
				gameUpdates={gameLogic
					.renderStatUpdates(gameActionState.stats_update, characterState.value.name)
					.concat(gameLogic.renderInventoryUpdate(gameActionState.inventory_update))}
			/>
		{/each}
		{#if isGameEnded.value}
			<StoryProgressionWithImage story={gameLogic.getGameEndedMessage()} />
		{/if}
	</div>
	<div class="mt-4 flex">
		<TTSComponent
			text={actionsTextForTTS}
			voice={ttsVoiceState.value}
			hidden={characterActionsState.value?.length === 0}
		></TTSComponent>
	</div>
	<div id="actions" bind:this={actionsDiv} class="mt-2 p-4 pb-0 pt-0"></div>
	{#if Object.keys(currentGameActionState).length !== 0}
		{#if !isGameEnded.value}
			{#if characterActionsState.value?.length > 0}
				<div id="static-actions" class="p-4 pb-0 pt-0">
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
			{:else}
				<div class="flex flex-col">
					<span class="m-auto">Generating next actions...</span>
					<div class="m-auto">
						<LoadingIcon />
					</div>
				</div>
			{/if}
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
						sendAction(
							{ characterName: characterState.value.name, text: customActionInput.value },
							false,
							additionalActionInputState.value
						);
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
