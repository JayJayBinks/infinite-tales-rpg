import { stringifyPretty, type ThoughtsState } from '$lib/util.svelte';
import { ActionDifficulty } from '../../../routes/game/gameLogic';
import { type StatsUpdate, statsUpdatePromptObject } from '$lib/ai/agents/combatAgent';
import type { LLM, LLMMessage, LLMRequest, SystemInstructionsState } from '$lib/ai/llm';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { Story } from '$lib/ai/agents/storyAgent';
import { mapGameState } from '$lib/ai/agents/mappers';
import {
	currentlyPresentNPCSForPrompt,
	type NpcID,
	type NPCState,
	type Resources
} from '$lib/ai/agents/characterStatsAgent';
import type { CampaignChapter } from '$lib/ai/agents/campaignAgent';
import { jsonRule } from './agentUtils';
import { GEMINI_MODELS } from '../geminiProvider';
import {
	buildLocalStoryPromptView,
	compactHistoryMessages,
	promptViewToRequestMetadata,
	reduceNpcStateForNames,
	shouldUseLocalPromptViews
} from '$lib/ai/localPromptViews';

export type InventoryUpdate = {
	type: 'add_item' | 'remove_item';
	item_id: string;
	item_added?: Item;
};
export type InventoryState = { [item_id: string]: Item };
export type ItemWithId = Item & { item_id: string };
export type Item = { description: string; effect: string };
export type DiceRollDifficulty = {
	action_difficulty?: ActionDifficulty;
	dice_roll?: {
		modifier: 'none' | 'bonus' | 'malus';
		modifier_value: number;
		modifier_explanation: string;
	};
};

export type ReasonedEnum = {
	reasoning: string;
	enum_english: string;
};
export type Action = {
	characterName: string;
	text: string;
	related_attribute?: string;
	related_skill?: string;
	action_difficulty?: ActionDifficulty;
	is_custom_action?: boolean;
	is_possible?: boolean;
	plausibility?: string;
	difficulty_explanation?: string;
	type?: string;
	narration_details?: object;
	actionSideEffects?: string;
	enemyEncounterExplanation?: object;
	is_interruptible?: ReasonedEnum;
	resource_cost?: {
		resource_key: string | undefined;
		cost: number;
	};
} & DiceRollDifficulty;

export type ResourcesWithCurrentValue = {
	[resourceKey: string]: { max_value: number; current_value: number; game_ends_when_zero: boolean };
};

export type PlayerCharactersIdToNamesMap = {
	[playerCharacterId: string]: Array<string>;
};

export type PlayerCharactersGameState = {
	[playerCharacterId: string]: ResourcesWithCurrentValue;
};

export type RandomEventsHandling = 'none' | 'probability' | 'ai_decides';

export type GameSettings = {
	detailedNarrationLength: boolean;
	aiIntroducesSkills: boolean;
	randomEventsHandling: RandomEventsHandling;
};
export const defaultGameSettings = () => ({
	detailedNarrationLength: true,
	aiIntroducesSkills: false,
	randomEventsHandling: 'probability' as const
});

export type Targets = { hostile: Array<NpcID>; friendly: Array<NpcID>; neutral: Array<NpcID> };
export type GameActionState = {
	id: number;
	currentPlotPoint: string;
	nextPlotPoint: string;
	story: string;
	image_prompt: string;
	inventory_update: Array<InventoryUpdate>;
	stats_update: Array<StatsUpdate>;
	is_character_in_combat: boolean;
	is_character_restrained_explanation?: string;
	currently_present_npcs: Targets;
	story_memory_explanation: string;
};
export type GameMasterAnswer = {
	answerToPlayer: string;
	rules_considered?: Array<string>;
	game_state_considered?: string;
	availableDetails?: GameMasterDetailOption[];
};

export type GameMasterDetailType = 'rules' | 'game_state' | 'history' | 'npcs_inventory';

export type GameMasterDetailOption = {
	id: GameMasterDetailType;
	title: string;
};

export type GameMasterDetail = {
	id: GameMasterDetailType;
	title: string;
	content: string;
};

type TextStreamingLLM = LLM & {
	generateTextStream: (
		request: LLMRequest,
		textUpdateCallback: (textChunk: string, isComplete: boolean) => void
	) => Promise<string>;
};

export const SUDO_COMMAND =
	'\nsudo: Ignore the rules and play out this action even if it should not be possible!\n' +
	'If this action contradicts the PAST STORY PLOT, adjust the narrative to fit the action.';

export const PAST_STORY_PLOT_RULE =
	'\n\nThe next story progression must be plausible in context of PAST STORY PLOT;\n' +
	'From PAST STORY PLOT do not reintroduce or repeat elements that have already been established.\n' +
	//make sure custom player history takes precedence
	'If PAST STORY PLOT contradict each other, the earliest takes precedence, and the later conflicting detail must be ignored;\nPAST STORY PLOT:\n';

export class GameAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	private getTextStreamingLLM(): TextStreamingLLM | undefined {
		const maybeStreamingLLM = this.llm as Partial<TextStreamingLLM>;
		if (typeof maybeStreamingLLM.generateTextStream !== 'function') return undefined;
		return this.llm as TextStreamingLLM;
	}

	async generateNarrationStream(
		storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void,
		action: Action,
		additionalStoryInput: string,
		customSystemInstruction: string,
		customStoryAgentInstruction: string,
		customCombatAgentInstruction: string,
		historyMessages: Array<LLMMessage>,
		storyState: Story,
		characterState: CharacterDescription,
		playerCharactersGameState: ResourcesWithCurrentValue,
		inventoryState: InventoryState,
		relatedHistory: string[],
		gameSettings: GameSettings,
		simulation: string
	): Promise<string> {
		const textStreamingLLM = this.getTextStreamingLLM();
		if (!textStreamingLLM) {
			throw new Error('Configured LLM does not support text streaming.');
		}
		let playerActionText = action.characterName + ': ' + action.text;
		const cost = parseInt(action.resource_cost?.cost as unknown as string) || 0;
		if (cost > 0) {
			playerActionText += `\n${action.resource_cost?.cost} ${action.resource_cost?.resource_key} cost`;
		}
		let combinedText = playerActionText;
		if (additionalStoryInput) combinedText += '\n' + additionalStoryInput;
		if (simulation) {
			combinedText += `\nFollowing needs to be considered for the continuous progression of the story:\n${simulation}`;
		}
		const localPromptView = buildLocalStoryPromptView({
			actionText: combinedText,
			storyState,
			characterState,
			playerCharactersGameState,
			inventoryState,
			historyMessages,
			relatedHistory
		});
		const relatedHistoryForPrompt = localPromptView.relatedHistory;
		if (relatedHistoryForPrompt.length > 0) {
			combinedText += PAST_STORY_PLOT_RULE + relatedHistoryForPrompt.join('\n');
		}
		const narrationAgent = this.getGameAgentSystemInstructionsFromStates(
			localPromptView.storyState,
			localPromptView.characterState,
			localPromptView.playerCharactersGameState,
			localPromptView.inventoryState,
			customSystemInstruction,
			customStoryAgentInstruction,
			customCombatAgentInstruction,
			gameSettings
		);
		narrationAgent.push(
			'Return only the final story narration as HTML/text. Do not output JSON. Do not use markdown fences. Do not include analysis.'
		);

		const finalStory = await textStreamingLLM.generateTextStream(
			{
				userMessage: combinedText,
				historyMessages: localPromptView.historyMessages,
				systemInstruction: narrationAgent,
				model: GEMINI_MODELS.FLASH_2_5,
				strictJson: false,
				debugMetadata: promptViewToRequestMetadata(localPromptView.debug)
			},
			storyUpdateCallback
		);
		if (!finalStory.trim()) {
			throw new Error('Local narration stream returned an empty story.');
		}
		return finalStory;
	}

	async generateStateDelta(
		action: Action,
		finalStory: string,
		additionalStoryInput: string,
		customSystemInstruction: string,
		customStoryAgentInstruction: string,
		customCombatAgentInstruction: string,
		historyMessages: Array<LLMMessage>,
		storyState: Story,
		characterState: CharacterDescription,
		playerCharactersGameState: ResourcesWithCurrentValue,
		inventoryState: InventoryState,
		relatedHistory: string[],
		gameSettings: GameSettings,
		simulation: string
	): Promise<{ newState: GameActionState; updatedHistoryMessages: Array<LLMMessage> }> {
		let playerActionText = action.characterName + ': ' + action.text;
		const cost = parseInt(action.resource_cost?.cost as unknown as string) || 0;
		if (cost > 0) {
			playerActionText += `\n${action.resource_cost?.cost} ${action.resource_cost?.resource_key} cost`;
		}
		const playerActionTextForHistory = playerActionText;
		let combinedText =
			'Player action:\n' +
			playerActionText +
			'\n\nFinal narration already shown to the player:\n' +
			finalStory;
		if (additionalStoryInput)
			combinedText += '\n\nAdditional state context:\n' + additionalStoryInput;
		if (simulation) {
			combinedText += `\n\nSimulation to consider:\n${simulation}`;
		}
		const localPromptView = buildLocalStoryPromptView({
			actionText: combinedText,
			storyState,
			characterState,
			playerCharactersGameState,
			inventoryState,
			historyMessages,
			relatedHistory
		});
		if (localPromptView.relatedHistory.length > 0) {
			combinedText += PAST_STORY_PLOT_RULE + localPromptView.relatedHistory.join('\n');
		}
		const stateAgent = this.getGameAgentSystemInstructionsFromStates(
			localPromptView.storyState,
			localPromptView.characterState,
			localPromptView.playerCharactersGameState,
			localPromptView.inventoryState,
			customSystemInstruction,
			customStoryAgentInstruction,
			customCombatAgentInstruction,
			gameSettings
		);
		stateAgent.push(jsonSystemInstructionForStateDelta(gameSettings));

		const stateDelta = (
			await this.llm.generateContent({
				userMessage: combinedText,
				historyMessages: localPromptView.historyMessages,
				systemInstruction: stateAgent,
				returnFallbackProperty: true,
				model: GEMINI_MODELS.FLASH_LITE_2_5,
				debugMetadata: promptViewToRequestMetadata(localPromptView.debug),
				validationContext: {
					playerResourceKeys: Object.keys(playerCharactersGameState),
					inventoryItemIds: Object.keys(inventoryState),
					actionDifficulties: Object.keys(ActionDifficulty)
				}
			})
		)?.content as Partial<GameActionState>;
		const newState = {
			...stateDelta,
			story: finalStory,
			image_prompt: ''
		} as GameActionState;
		const { userMessage, modelMessage } = this.buildHistoryMessages(
			playerActionTextForHistory,
			newState
		);
		if (simulation) {
			userMessage.content += `\nFollowing needs to be considered for the continuous progression of the story:\n${simulation}`;
		}
		mapGameState(newState);
		return { newState, updatedHistoryMessages: [...historyMessages, userMessage, modelMessage] };
	}
	async generateStateOnlyNoStory(
		action: Action,
		characterName: string,
		playerCharactersGameState: ResourcesWithCurrentValue,
		inventoryState: InventoryState,
		ncState: NPCState
	) {
		const useLocalPromptView = shouldUseLocalPromptViews(this.llm);
		const inventoryKeysForPrompt = useLocalPromptView
			? reduceInventoryKeysForStateOnly(inventoryState, action.text, 25)
			: Object.keys(inventoryState);
		const npcNamesForPrompt = useLocalPromptView
			? reduceNpcStateForNames(ncState, 25)
			: Object.keys(ncState).map((key) => ncState[key].known_names?.join(', '));
		const systemInstruction: string[] = [];
		systemInstruction.push(jsonRule + '\n{' + jsonStoryCharacterStatusPart() + '}');
		systemInstruction.push(
			'If targetName is a NPC then resourceKey must be one of hp,mp else one of related CHARACTER resources: \n' +
				stringifyPretty(playerCharactersGameState)
		);
		systemInstruction.push(
			"The following is the character's inventory\n" + stringifyPretty(inventoryKeysForPrompt)
		);
		systemInstruction.push(
			'Determine stats_update targetName from the player prompt, map it to one of NPC NAMES LIST, if none present use player character name ' +
				characterName +
				'\nNPC NAMES LIST: ' +
				npcNamesForPrompt
		);
		const request: LLMRequest = {
			userMessage: action.text,
			historyMessages: [],
			systemInstruction,
			returnFallbackProperty: true,
			model: GEMINI_MODELS.FLASH_LITE_2_5,
			debugMetadata: useLocalPromptView
				? {
						promptViewType: 'state-only',
						promptPreview: stringifyPretty({
							action: action.text,
							resources: playerCharactersGameState,
							inventoryKeys: inventoryKeysForPrompt,
							npcNames: npcNamesForPrompt
						}),
						promptViewReductions: [
							`state-only inventory keys: ${Object.keys(inventoryState).length} -> ${inventoryKeysForPrompt.length}`,
							`state-only npc names: ${Object.keys(ncState).length} -> ${npcNamesForPrompt.length}`
						]
					}
				: undefined,
			validationContext: {
				playerResourceKeys: Object.keys(playerCharactersGameState),
				npcIds: Object.keys(ncState),
				inventoryItemIds: Object.keys(inventoryState),
				actionDifficulties: Object.keys(ActionDifficulty)
			}
		};
		const newState = (await this.llm.generateContent(request))?.content as GameActionState;

		mapGameState(newState);
		return newState;
	}

	/**
	 *
	 * @param actionText text from the user action, will be added to the historyMessages
	 * @param additionalStoryInput additional text to act as asinge message system instruction, e.g combat, not added to historyMessages
	 * @param customSystemInstruction
	 * @param historyMessages
	 * @param storyState
	 * @param characterState
	 * @param playerCharactersGameState
	 */
	async generateStoryProgression(
		storyUpdateCallback: (storyChunk: string, isComplete: boolean) => void,
		thoughtUpdateCallback: (thoughtChunk: string, isComplete: boolean) => void,
		action: Action,
		additionalStoryInput: string,
		customSystemInstruction: string,
		customStoryAgentInstruction: string,
		customCombatAgentInstruction: string,
		historyMessages: Array<LLMMessage>,
		storyState: Story,
		characterState: CharacterDescription,
		playerCharactersGameState: ResourcesWithCurrentValue,
		inventoryState: InventoryState,
		relatedHistory: string[],
		gameSettings: GameSettings,
		simulation: string
	): Promise<{ newState: GameActionState; updatedHistoryMessages: Array<LLMMessage> }> {
		let playerActionText = action.characterName + ': ' + action.text;
		const cost = parseInt(action.resource_cost?.cost as unknown as string) || 0;
		if (cost > 0) {
			playerActionText += `\n${action.resource_cost?.cost} ${action.resource_cost?.resource_key} cost`;
		}
		const playerActionTextForHistory = playerActionText;
		let combinedText = playerActionText;
		if (additionalStoryInput) combinedText += '\n' + additionalStoryInput;

		const localPromptView = shouldUseLocalPromptViews(this.llm)
			? buildLocalStoryPromptView({
					actionText: combinedText,
					storyState,
					characterState,
					playerCharactersGameState,
					inventoryState,
					historyMessages,
					relatedHistory
				})
			: undefined;
		const storyStateForPrompt = localPromptView?.storyState ?? storyState;
		const characterStateForPrompt = localPromptView?.characterState ?? characterState;
		const playerCharactersGameStateForPrompt =
			localPromptView?.playerCharactersGameState ?? playerCharactersGameState;
		const inventoryStateForPrompt = localPromptView?.inventoryState ?? inventoryState;
		const historyMessagesForPrompt = localPromptView?.historyMessages ?? historyMessages;
		const relatedHistoryForPrompt = localPromptView?.relatedHistory ?? relatedHistory;

		if (relatedHistoryForPrompt.length > 0) {
			combinedText += PAST_STORY_PLOT_RULE + relatedHistoryForPrompt.join('\n');
		}
		const gameAgent = this.getGameAgentSystemInstructionsFromStates(
			storyStateForPrompt,
			characterStateForPrompt,
			playerCharactersGameStateForPrompt,
			inventoryStateForPrompt,
			customSystemInstruction,
			customStoryAgentInstruction,
			customCombatAgentInstruction,
			gameSettings
		);
		gameAgent.push(jsonSystemInstructionForGameAgent(gameSettings));

		console.log(combinedText);
		const request: LLMRequest = {
			userMessage: combinedText,
			historyMessages: historyMessagesForPrompt,
			systemInstruction: gameAgent,
			returnFallbackProperty: true,
			model: GEMINI_MODELS.FLASH_2_5,
			debugMetadata: promptViewToRequestMetadata(localPromptView?.debug),
			validationContext: {
				playerResourceKeys: Object.keys(playerCharactersGameState),
				inventoryItemIds: Object.keys(inventoryState),
				actionDifficulties: Object.keys(ActionDifficulty)
			}
		};
		const time = new Date().toLocaleTimeString();
		console.log('Starting game agent:', time);
		const newState = (await this.llm.generateContentStream(
			request,
			storyUpdateCallback,
			thoughtUpdateCallback
		)) as GameActionState;
		const { userMessage, modelMessage } = this.buildHistoryMessages(
			playerActionTextForHistory,
			newState
		);
		//add simulation to short term context
		if (simulation) {
			userMessage.content += `\nFollowing needs to be considered for the continuous progression of the story:\n${simulation}`;
		}
		const updatedHistoryMessages = [...historyMessages, userMessage, modelMessage];
		mapGameState(newState);
		return { newState, updatedHistoryMessages };
	}

	async generateAnswerForPlayerQuestion(
		question: string,
		thoughtsState: ThoughtsState,
		customSystemInstruction: SystemInstructionsState,
		historyMessages: Array<LLMMessage>,
		storyState: Story,
		characterState: CharacterDescription,
		playerCharactersGameState: PlayerCharactersGameState | ResourcesWithCurrentValue,
		inventoryState: InventoryState,
		npcState: NPCState,
		relatedHistory: string[],
		gameSettings: GameSettings,
		campaignChapterState?: CampaignChapter,
		customGmNotes?: string,
		is_character_restrained_explanation?: string
	): Promise<{ thoughts?: string; answer: GameMasterAnswer }> {
		const useLocalPromptView = shouldUseLocalPromptViews(this.llm);
		const historyMessagesForPrompt = useLocalPromptView
			? compactHistoryMessages(historyMessages, 2, 1200)
			: historyMessages;
		const compactContext = buildGmQuestionContext({
			question,
			storyState,
			characterState,
			playerCharactersGameState,
			inventoryState,
			npcState,
			relatedHistory,
			campaignChapterState,
			customGmNotes,
			isCharacterRestrainedExplanation: is_character_restrained_explanation
		});
		if (useLocalPromptView) {
			const request: LLMRequest = {
				userMessage:
					'Answer this player question outside of character. Give a clear general answer in 60-120 words.\n\nQUESTION:\n' +
					question +
					'\n\nCOMPACT GAME CONTEXT:\n' +
					stringifyPretty(compactContext),
				historyMessages: historyMessagesForPrompt,
				systemInstruction: [
					'You are an RPG Game Master reviewer. Answer directly without narrating new story events.',
					'Do not expose hidden secrets unless the question asks about information the player already knows.',
					'Choose only detail sections that could add useful information. Return JSON only.',
					jsonSystemInstructionForPlayerQuestionOverview
				],
				responseJsonSchema: gameMasterOverviewJsonSchema,
				debugMetadata: {
					promptViewType: 'gm-question',
					promptPreview: stringifyPretty({
						question,
						context: compactContext,
						historyMessages: historyMessagesForPrompt
					}),
					promptViewReductions: [
						`gm question history messages: ${historyMessages.length} -> ${historyMessagesForPrompt.length}`,
						`gm question inventory items: ${Object.keys(inventoryState).length} -> ${Object.keys(compactContext.inventory).length}`,
						`gm question npc entries: ${Object.keys(npcState).length} -> ${compactContext.npcs.length}`
					]
				}
			};
			const response = await this.llm.generateContent(request);
			return {
				thoughts: response?.thoughts,
				answer: normalizeGameMasterAnswer(response?.content)
			};
		}

		const gameAgent = [
			'You are Reviewer Agent, your task is to answer a players question.\n' +
				'You can refer to the internal state, rules and previous messages that the Game Master has considered',
			'The following is the internal state of the NPCs.' + '\n' + stringifyPretty(npcState)
		];
		if (campaignChapterState) {
			gameAgent.push(
				'The following is the state of the current campaign chapter.' +
					'\n' +
					stringifyPretty(campaignChapterState)
			);
		}
		if (customGmNotes) {
			gameAgent.push(
				'The following are custom gm notes considered to be rules.' + '\n' + customGmNotes
			);
		}
		if (thoughtsState.storyThoughts) {
			gameAgent.push(
				'The following are thoughts of the Game Master regarding how to progress the story.' +
					'\n' +
					JSON.stringify(thoughtsState)
			);
		}
		if (relatedHistory.length > 0) {
			gameAgent.push('History Rules:\n' + PAST_STORY_PLOT_RULE + relatedHistory.join('\n'));
		}
		if (is_character_restrained_explanation) {
			gameAgent.push(
				`Character is restrained: ${is_character_restrained_explanation}; consider the implications in your response.`
			);
		}
		gameAgent.push(jsonSystemInstructionForPlayerQuestion);
		const userMessage =
			'Most important! Answer outside of character, do not describe the story, but give an explanation to this question:\n' +
			question +
			"\n\nIn your answer, identify the relevant Game Master's rules that are related to the question:\n" +
			"Game Master's rules:\n" +
			this.getGameAgentSystemInstructionsFromStates(
				storyState,
				characterState,
				playerCharactersGameState,
				inventoryState,
				customSystemInstruction.generalSystemInstruction,
				customSystemInstruction.storyAgentInstruction,
				customSystemInstruction.combatAgentInstruction,
				gameSettings
			).join('\n');
		const request: LLMRequest = {
			userMessage: userMessage,
			historyMessages: historyMessagesForPrompt,
			systemInstruction: gameAgent
		};
		const response = await this.llm.generateContent(request);
		return {
			thoughts: response?.thoughts,
			answer: normalizeGameMasterAnswer(response?.content)
		};
	}

	async generateAnswerForPlayerQuestionDetail(
		detailType: GameMasterDetailType,
		question: string,
		generalAnswer: GameMasterAnswer,
		customSystemInstruction: SystemInstructionsState,
		historyMessages: Array<LLMMessage>,
		storyState: Story,
		characterState: CharacterDescription,
		playerCharactersGameState: PlayerCharactersGameState | ResourcesWithCurrentValue,
		inventoryState: InventoryState,
		npcState: NPCState,
		relatedHistory: string[],
		gameSettings: GameSettings,
		campaignChapterState?: CampaignChapter,
		customGmNotes?: string,
		isCharacterRestrainedExplanation?: string
	): Promise<GameMasterDetail | undefined> {
		const useLocalPromptView = shouldUseLocalPromptViews(this.llm);
		const historyMessagesForPrompt = useLocalPromptView
			? compactHistoryMessages(historyMessages, 2, 1000)
			: historyMessages;
		const compactContext = buildGmQuestionContext({
			question,
			storyState,
			characterState,
			playerCharactersGameState,
			inventoryState,
			npcState,
			relatedHistory,
			campaignChapterState,
			customGmNotes,
			isCharacterRestrainedExplanation
		});
		const detailInstruction = getGameMasterDetailInstruction(detailType);
		const rules =
			detailType === 'rules'
				? selectRelevantGmQuestionRules(
						question,
						gameSettings,
						customSystemInstruction,
						customGmNotes
					)
				: '';
		const request: LLMRequest = {
			userMessage: stringifyPretty({
				question,
				generalAnswer: generalAnswer.answerToPlayer,
				requestedDetail: detailType,
				context: compactContext,
				rules: rules || undefined
			}),
			historyMessages: historyMessagesForPrompt,
			systemInstruction: [
				'You are an RPG Game Master reviewer. Expand exactly one requested detail for an existing answer.',
				'Do not repeat the whole general answer. Do not narrate new events or reveal unknown secrets.',
				detailInstruction,
				`${jsonRule} {"content": "Focused detail in 80-180 words."}`
			],
			responseJsonSchema: gameMasterDetailJsonSchema,
			debugMetadata: useLocalPromptView
				? {
						promptViewType: `gm-question-${detailType}`,
						promptPreview: stringifyPretty({
							question,
							generalAnswer: generalAnswer.answerToPlayer,
							context: compactContext,
							rules: rules || undefined
						}),
						promptViewReductions: [
							`gm detail history messages: ${historyMessages.length} -> ${historyMessagesForPrompt.length}`
						]
					}
				: undefined
		};
		const response = (await this.llm.generateContent(request))?.content as
			| { content?: string }
			| undefined;
		if (!response?.content) return undefined;
		return {
			id: detailType,
			title: gameMasterDetailTitles[detailType],
			content: String(response.content)
		};
	}

	private getGameAgentSystemInstructionsFromStates(
		storyState: Story | Partial<Story>,
		characterState: CharacterDescription | Partial<CharacterDescription>,
		playerCharactersGameState: PlayerCharactersGameState | ResourcesWithCurrentValue,
		inventoryState: InventoryState,
		customSystemInstruction: string,
		customStoryAgentInstruction: string,
		customCombatAgentInstruction: string,
		gameSettings: GameSettings
	) {
		const gameAgent = [
			systemBehaviour(gameSettings),
			stringifyPretty(storyState),
			'The following is a description of the player character, always refer to it when considering appearance, reasoning, motives etc.' +
				'\n' +
				stringifyPretty(characterState),
			"The following are the character's CURRENT resources, consider it in your response\n" +
				stringifyPretty(Object.entries(playerCharactersGameState)),
			"The following is the character's inventory, check items for relevant passive effects relevant for the story progression or effects that are triggered every action.\n" +
				stringifyPretty(inventoryState)
		];
		if (customSystemInstruction) {
			gameAgent.push('Following instructions overrule all others: ' + customSystemInstruction);
		}
		if (customStoryAgentInstruction) {
			gameAgent.push('Following instructions overrule all others: ' + customStoryAgentInstruction);
		}
		if (customCombatAgentInstruction) {
			gameAgent.push('Following instructions overrule all others: ' + customCombatAgentInstruction);
		}
		return gameAgent;
	}

	static getGameEndedPrompt(emptyResourceKey: string[]) {
		return `The CHARACTER has fallen to 0 ${emptyResourceKey.join(' and ')}; Describe how the GAME is ending.`;
	}

	static getStartingPrompt() {
		return (
			'Begin the story by setting the scene in a vivid and detailed manner, describing the environment and atmosphere with rich sensory details.' +
			'\nAt the beginning do not disclose story secrets, which are meant to be discovered by the player later into the story.' +
			'\nIf the player character is accompanied by party members, give them names and add them to currently_present_npcs' +
			'\nCHARACTER starts with some random items.'
		);
	}

	buildHistoryMessages = function (userText: string, modelStateObject: GameActionState) {
		const userMessage: LLMMessage = { role: 'user', content: userText };
		const modelMessage: LLMMessage = { role: 'model', content: stringifyPretty(modelStateObject) };
		return { userMessage, modelMessage };
	};

	static getRefillValue(maxResource: Resources[string]): number {
		return maxResource.max_value === maxResource.start_value
			? maxResource.max_value
			: maxResource.start_value;
	}

	static getRefillResourcesUpdateObject(
		maxResources: Resources,
		currentResources: ResourcesWithCurrentValue,
		playerCharacterName: string
	): Pick<GameActionState, 'stats_update'> {
		const returnObject: Pick<GameActionState, 'stats_update'> = { stats_update: [] };
		Object.entries(maxResources)
			.filter(([resourceKey]) => resourceKey !== 'XP')
			.forEach(([resourceKey, maxResource]) => {
				const refillValue = GameAgent.getRefillValue(maxResource);
				if (refillValue === 0) {
					return;
				}
				returnObject.stats_update.push({
					sourceName: playerCharacterName,
					targetName: playerCharacterName,
					type: resourceKey + '_gained',
					value: { result: refillValue - (currentResources[resourceKey]?.current_value || 0) || 0 }
				});
			});
		return returnObject;
	}

	static getLevelUpCostObject(xpCost: number, playerName: string, level: number): StatsUpdate {
		return {
			sourceName: playerName,
			targetName: playerName,
			type: 'now_level_' + (level + 1),
			value: { result: xpCost }
		};
	}

	static getItemImagePrompt(item_id: string, item: Item, storyImagePrompt: string): string {
		return `${storyImagePrompt} RPG game icon ${item_id} ${item.description}`;
	}

	static getPromptForGameMasterNotes = (notes: Array<string>) => {
		if (!notes || notes.length === 0) {
			return '';
		}
		return (
			'\nFollowing are Game Master Notes to consider for the next story progression:\n' +
			notes.join('\n') +
			'\n'
		);
	};

	static getCraftingPrompt(): string {
		return (
			'\nCrafting:' +
			'\nOn success, create a new item and remove the combined items.' +
			'\nOn partial failure, do not create a new item but do not remove the combined items.' +
			'\nOn failure, do not create a new item and remove the combined items.'
		);
	}
}

const storyWordLimit = 'must be between 100 and 160 words, do not exceed this range.';

export const SLOW_STORY_PROMPT =
	'Ensure that the narrative unfolds gradually, building up anticipation and curiosity before moving towards any major revelations or climactic moments.';
const systemBehaviour = (gameSettingsState: GameSettings) => `
You are a Pen & Paper Game Master, crafting captivating, limitless GAME experiences using ADVENTURE_AND_MAIN_EVENT, THEME, TONALITY for CHARACTER.

The Game Master's General Responsibilities Include:
- Narrate compelling stories in TONALITY for my CHARACTER.
- Generate settings and places, adhering to THEME and TONALITY, and naming GAME elements.
- Never narrate events briefly or summarize; Always describe detailed scenes with character conversation in direct speech
- Show, Don't Tell: Do not narrate abstract concepts or the "meaning" of an event. Instead, communicate the theme through tangible, sensory details
- Use GAME's core knowledge and rules.
- Handle CHARACTER resources per GAME rules, e.g. in a survival game hunger decreases over time; Blood magic costs blood; etc...
- Handle NPC resources, you must exactly use resourceKey "hp" or "mp", and no deviations of that
${!gameSettingsState.detailedNarrationLength ? '- The story narration ' + storyWordLimit : ''}
- Ensure a balanced mix of role-play, combat, and puzzles. Integrate these elements dynamically and naturally based on context.
- Craft varied NPCs, ranging from good to evil.

Storytelling
- Keep story secrets until they are discovered by the player.
- Introduce key characters by describing their actions, appearance, and manner of speaking. Reveal their emotions, motivations, and backstories gradually through their dialogue and how they react to the player character and the world.
- Encourage moments of introspection, dialogue, and quiet observation to develop a deeper understanding of the characters and the world they inhabit. 
- ${SLOW_STORY_PROMPT}
- Deconstruct Player Actions: Do not make decisions on behalf of the player character. More importantly, treat complex player intentions (e.g., 'I perform the ritual,' 'I persuade the guard,' 'I search the library') as the start of a scene, not a single action to be resolved immediately. Narrate the first step of the character's attempt and the immediate consequence or obstacle. Then, pause and wait for the player's next specific action within that scene.
- For the story narration never mention game meta elements like dice rolls; Only describe the narrative the character experiences
- The story history always takes precedence over the story progression, if the history does not allow for the progression to happen, the progression must be adjusted to fit the history.

Actions:
- Let the player guide actions and story relevance.
- Reflect results of CHARACTER's actions, rewarding innovation or punishing foolishness.
- Involve other characters' reactions, doubts, or support during the action, encouraging a deeper exploration of relationships and motivations.
- On each action review the character's inventory and spells_and_abilities for items and skills that have passive effects such as defense or health regeneration and apply them

XP:
- Award XP only for contributions to a challenge according to significance.
	- SMALL: Obtaining clues, engaging in reconnaissance, or learning background information.
	- MEDIUM: Major progress toward a challenge, such as uncovering a vital piece of evidence, or getting access to a crucial location.
	- HIGH: Achieving breakthroughs or resolving significant challenges.
- XP is also granted for the character’s growth (e.g. a warrior mastering a new technique).
- Never grant XP for routine tasks (e.g. basic dialogue, non-story shopping) or actions that build tension but don’t change outcomes.

Combat:
- Pace All Challenges Like Combat: All significant challenges—not just combat—are slow-paced and multi-round. Treat tense negotiations, intricate rituals, disarming magical traps, or navigating a collapsing ruin as a series of actions and reactions between the CHARACTER and the environment. Never resolve a complex challenge in one response.
- Never decide on your own that NPCs or CHARACTER die, apply appropriate damage instead. Only the player will tell you when they die.
- NPCs and CHARACTER cannot simply be finished off with a single attack.

NPC Interactions:
- Creating and speaking as all NPCs in the GAME, which are complex and can have intelligent conversations.
- Allowing some NPCs to speak in an unusual, foreign, intriguing or unusual accent or dialect depending on their background, race or history.
- Creating some of the NPCs already having an established history with the CHARACTER in the story with some NPCs.
- When the player character interacts with a NPC you must always include the NPC response within the same action

Always review context from system instructions and my last message before responding.`;

const jsonStoryCharacterStatusPart = () => `
  ${statsUpdatePromptObject},
  "inventory_update": [
        #Add this to the JSON if the story implies that an item is added or removed from the character's inventory
		#This section is only for items and never spells or abilities
        #For each item addition or removal this object is added once, the whole inventory does not need to be tracked here
        #The starting items are also listed here as add_item
    {
      "type": "add_item",
      "item_id": "unique name of the item to identify it",
      "item_added": {
        "description": "A description of the item",
        "effect": "Clearly state effect(s) and whether an effect is active or passive"
      }
    },
    {
      "type": "remove_item",
      "item_id": "unique name of the item to identify it"
    }
  ]`;
const jsonSystemInstructionForGameAgent = (gameSettingsState: GameSettings) => `${jsonRule}
{
  "currentPlotPoint": VALUE MUST BE ALWAYS IN ENGLISH; Identify the most relevant plotId in ADVENTURE_AND_MAIN_EVENT that the story aligns with; Explain your reasoning briefly; Format "{Reasoning} - PLOT_ID: {plotId}",
  "gradualNarrativeExplanation": "Reasoning how the story development is broken down to meaningful narrative moments. Each step should represent a significant part of the process, giving the player the opportunity to make impactful choices.",
  "plotPointAdvancingNudgeExplanation": "VALUE MUST BE ALWAYS IN ENGLISH; Explain what could happen next to advance the story towards NEXT_PLOT_ID according to ADVENTURE_AND_MAIN_EVENT; Include brief explanation of NEXT_PLOT_ID; Format "CURRENT_PLOT_ID: {plotId}; NEXT_PLOT_ID: {currentPlotId + 1}; {Reasoning}",
  "story": "depending on If The Action Is A Success Or Failure progress the story further with appropriate consequences. ${!gameSettingsState.detailedNarrationLength ? storyWordLimit : ''} For character speech use single quotes. Format the narration using HTML tags for easier reading.",
  "story_memory_explanation": "Explanation if story progression has Long-term Impact: Remember events that significantly influence character arcs, plot direction, or the game world in ways that persist or resurface later; Format: {explanation} LONG_TERM_IMPACT: LOW, MEDIUM, HIGH",
  "image_prompt": "Based on the most recent events, generate a a prompt for an image AI, describing the current scene. My character must never be described or shown. Instead, focus entirely on what I see: the environment, objects, and any NPCs. When describing an NPC, never use their name; instead, describe them by their gender and a consistent set of key visual features. Your prompt must weave together the scene's main focus, the setting, the artistic style and mood, the precise lighting and color, and a cinematic composition to vividly capture this specific moment.",
  "xpGainedExplanation": "Explain why or why nor the CHARACTER gains xp in this situation", 
  ${jsonStoryCharacterStatusPart()},
  "is_character_in_combat": true if CHARACTER is in active combat else false,
  "is_character_restrained_explanation": null | string; "If not restrained null, else Briefly explain how the character has entered a TEMPORARY state or condition that SIGNIFICANTLY RESTRICTS their available actions, changes how they act, or puts them under external control? (Examples: Put to sleep, paralyzed, charmed, blinded,  affected by an illusion, under a compulsion spell)",
  "currently_present_npcs_explanation": "For each NPC explain why they are or are not present in list currently_present_npcs",
  "currently_present_npcs": List of NPCs or party members that are present in the current situation. Format: ${currentlyPresentNPCSForPrompt}
}`;

const jsonSystemInstructionForStateDelta = (gameSettingsState: GameSettings) => `${jsonRule}
{
  "currentPlotPoint": VALUE MUST BE ALWAYS IN ENGLISH; Identify the most relevant plotId in ADVENTURE_AND_MAIN_EVENT that the story aligns with; Explain your reasoning briefly; Format "{Reasoning} - PLOT_ID: {plotId}",
  "gradualNarrativeExplanation": "Reasoning how the already generated narration was broken down to meaningful narrative moments.",
  "plotPointAdvancingNudgeExplanation": "VALUE MUST BE ALWAYS IN ENGLISH; Explain what could happen next to advance the story towards NEXT_PLOT_ID according to ADVENTURE_AND_MAIN_EVENT; Include brief explanation of NEXT_PLOT_ID; Format "CURRENT_PLOT_ID: {plotId}; NEXT_PLOT_ID: {currentPlotId + 1}; {Reasoning}",
  "story_memory_explanation": "Explanation if the final narration has Long-term Impact: Remember events that significantly influence character arcs, plot direction, or the game world in ways that persist or resurface later; Format: {explanation} LONG_TERM_IMPACT: LOW, MEDIUM, HIGH",
  "xpGainedExplanation": "Explain why or why not the CHARACTER gains xp in this situation",
  "state_update_rules": "If no resource, XP, or inventory changed, return empty arrays for stats_update and inventory_update. Never create placeholder updates. Never use type N/A, none, null, or value null. For every stats_update value must be an object like {"result": number|string}; XP is awarded only for meaningful progress and must be omitted when no XP is gained.",
  ${jsonStoryCharacterStatusPart()},
  "is_character_in_combat": true if CHARACTER is in active combat else false,
  "is_character_restrained_explanation": null | string; "If not restrained null, else briefly explain how the character has entered a TEMPORARY state or condition that SIGNIFICANTLY RESTRICTS their available actions, changes how they act, or puts them under external control.",
  "currently_present_npcs_explanation": "For each NPC explain why they are or are not present in list currently_present_npcs",
  "currently_present_npcs": List of NPCs or party members that are present in the current situation. Format: ${currentlyPresentNPCSForPrompt}
}`;

const jsonSystemInstructionForPlayerQuestion = `${jsonRule}
{
  "game_state_considered": Brief explanation on how the game state is involved in the answer; mention relevant variables explicitly,
  "rules_considered": String Array; Identify the relevant Game Master's rules that are related to the question; Include the exact text of a rule,
  "answerToPlayer": Answer outside of character, do not describe the story, but give an explanation
}`;

const jsonSystemInstructionForPlayerQuestionOverview = `${jsonRule}
{
  "answerToPlayer": "Direct general answer outside of character.",
  "availableDetails": [
    {"id": "rules|game_state|history|npcs_inventory", "title": "Short localized title"}
  ]
}`;

const gameMasterOverviewJsonSchema = {
	name: 'game_master_answer_overview',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['answerToPlayer', 'availableDetails'],
		properties: {
			answerToPlayer: { type: 'string', maxLength: 1200 },
			availableDetails: {
				type: 'array',
				maxItems: 4,
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['id', 'title'],
					properties: {
						id: {
							type: 'string',
							enum: ['rules', 'game_state', 'history', 'npcs_inventory']
						},
						title: { type: 'string', maxLength: 80 }
					}
				}
			}
		}
	}
};

const gameMasterDetailJsonSchema = {
	name: 'game_master_answer_detail',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['content'],
		properties: {
			content: { type: 'string', maxLength: 2200 }
		}
	}
};

const gameMasterDetailTitles: Record<GameMasterDetailType, string> = {
	rules: 'Relevant Rules',
	game_state: 'Game State',
	history: 'Previous Events',
	npcs_inventory: 'NPCs and Inventory'
};

function normalizeGameMasterAnswer(content: unknown): GameMasterAnswer {
	const answer = (content || {}) as Partial<GameMasterAnswer>;
	const availableDetails = Array.isArray(answer.availableDetails)
		? answer.availableDetails.filter(
				(option): option is GameMasterDetailOption =>
					Boolean(option?.title) && option?.id in gameMasterDetailTitles
			)
		: [];
	return {
		answerToPlayer: String(answer.answerToPlayer || ''),
		game_state_considered: answer.game_state_considered,
		rules_considered: Array.isArray(answer.rules_considered) ? answer.rules_considered : undefined,
		availableDetails:
			availableDetails.length > 0
				? availableDetails
				: [
						{ id: 'game_state', title: gameMasterDetailTitles.game_state },
						{ id: 'rules', title: gameMasterDetailTitles.rules }
					]
	};
}

function buildGmQuestionContext(input: {
	question: string;
	storyState: Story;
	characterState: CharacterDescription;
	playerCharactersGameState: PlayerCharactersGameState | ResourcesWithCurrentValue;
	inventoryState: InventoryState;
	npcState: NPCState;
	relatedHistory: string[];
	campaignChapterState?: CampaignChapter;
	customGmNotes?: string;
	isCharacterRestrainedExplanation?: string;
}) {
	const inventoryKeys = reduceInventoryKeysForStateOnly(input.inventoryState, input.question, 12);
	return {
		setting: {
			game: input.storyState.game,
			theme: input.storyState.theme,
			tonality: input.storyState.tonality,
			world_details: trimForGmQuestion(input.storyState.world_details, 900)
		},
		character: Object.fromEntries(
			Object.entries(input.characterState || {})
				.filter(([, value]) => value !== undefined && value !== null && value !== '')
				.slice(0, 8)
				.map(([key, value]) => [key, trimForGmQuestion(String(value), 500)])
		),
		resources: input.playerCharactersGameState,
		inventory: Object.fromEntries(
			inventoryKeys.map((key) => [
				key,
				{
					description: trimForGmQuestion(input.inventoryState[key]?.description, 300),
					effect: trimForGmQuestion(input.inventoryState[key]?.effect, 300)
				}
			])
		),
		npcs: reduceNpcStateForNames(input.npcState, 25),
		relatedHistory: input.relatedHistory.slice(-4).map((entry) => trimForGmQuestion(entry, 900)),
		campaignChapter: input.campaignChapterState
			? trimForGmQuestion(stringifyPretty(input.campaignChapterState), 1200)
			: undefined,
		customGmNotes: trimForGmQuestion(input.customGmNotes, 1000),
		restrained: input.isCharacterRestrainedExplanation
	};
}

function getGameMasterDetailInstruction(detailType: GameMasterDetailType): string {
	switch (detailType) {
		case 'rules':
			return 'Explain only the rules relevant to the question and how they apply.';
		case 'game_state':
			return 'Explain only which current state values and conditions affect the answer.';
		case 'history':
			return 'Explain only which known previous events affect the answer and why.';
		case 'npcs_inventory':
			return 'Explain only relevant visible NPC and inventory implications.';
	}
}

function selectRelevantGmQuestionRules(
	question: string,
	gameSettings: GameSettings,
	customSystemInstruction: SystemInstructionsState,
	customGmNotes?: string
): string {
	const terms = question
		.toLowerCase()
		.split(/[^a-z0-9_]+/)
		.filter((term) => term.length >= 4);
	const ruleLines = systemBehaviour(gameSettings)
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('-'));
	const scoredRules = ruleLines
		.map((rule, index) => ({
			rule,
			index,
			score: terms.filter((term) => rule.toLowerCase().includes(term)).length
		}))
		.toSorted((a, b) => b.score - a.score || a.index - b.index)
		.slice(0, 8)
		.map(({ rule }) => rule);
	const customRules = [
		customSystemInstruction.generalSystemInstruction,
		customSystemInstruction.storyAgentInstruction,
		customSystemInstruction.combatAgentInstruction,
		customGmNotes
	]
		.filter(Boolean)
		.map((rule) => trimForGmQuestion(rule, 800));
	return [...customRules, ...scoredRules].join('\n');
}

function trimForGmQuestion(text: string | undefined, maxCharacters: number): string {
	if (!text || text.length <= maxCharacters) return text || '';
	return text.slice(0, maxCharacters) + '\n[...trimmed for GM question...]';
}

function reduceInventoryKeysForStateOnly(
	inventoryState: InventoryState,
	relevanceText: string,
	limit: number
): string[] {
	const keys = Object.keys(inventoryState || {});
	if (keys.length <= limit) return keys;
	const terms = new Set(
		relevanceText
			.toLowerCase()
			.split(/[^a-z0-9_]+/)
			.filter((term) => term.length >= 4)
	);
	return keys
		.map((key, index) => {
			const item = inventoryState[key];
			const text = [key, item?.description, item?.effect].join(' ').toLowerCase();
			let score = 0;
			terms.forEach((term) => {
				if (text.includes(term)) score += 1;
			});
			return { key, index, score };
		})
		.toSorted((a, b) => b.score - a.score || b.index - a.index)
		.slice(0, limit)
		.toSorted((a, b) => a.index - b.index)
		.map((entry) => entry.key);
}
