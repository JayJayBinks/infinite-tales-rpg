import { stringifyPretty } from '$lib/util.svelte';
import { ActionDifficulty } from '../../../routes/game/gameLogic';
import { type StatsUpdate, statsUpdatePromptObject } from '$lib/ai/agents/combatAgent';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { Story } from '$lib/ai/agents/storyAgent';
import type { DiceRollDifficulty } from '$lib/ai/agents/difficultyAgent';
import { mapGameState } from '$lib/ai/agents/mappers';
import {
	currentlyPresentNPCSForPrompt,
	type NpcID,
	type NPCState,
	type Resources
} from '$lib/ai/agents/characterStatsAgent';
import type { CampaignChapter } from '$lib/ai/agents/campaignAgent';

export type InventoryUpdate = {
	type: 'add_item' | 'remove_item';
	item_id: string;
	item_added?: Item;
};
export type InventoryState = { [item_id: string]: Item };
export type ItemWithId = Item & { item_id: string };
export type Item = { description: string; effect: string };
export type Action = {
	characterName: string;
	text: string;
	action_difficulty?: ActionDifficulty;
	is_custom_action?: boolean;
	is_possible?: boolean;
	plausibility?: string;
	difficulty_explanation?: string;
	type?: string;
	narration_details?: object;
	actionSideEffects?: string;
	enemyEncounterExplanation?: object;
	is_interruptible?: object;
	resource_cost?: {
		resource_key: string | undefined;
		cost: number;
	};
} & DiceRollDifficulty;

export type ResourcesWithCurrentValue = {
	[resourceKey: string]: { max_value: number; current_value: number; game_ends_when_zero: boolean };
};

export type PlayerCharactersGameState = {
	[playerCharacterName: string]: ResourcesWithCurrentValue;
};

export type GameSettings = {
	detailedNarrationLength: boolean;
};
export const defaultGameSettings = () => ({
	detailedNarrationLength: true
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
	currently_present_npcs: Targets;
	story_memory_explanation: string;
};
export type GameMasterAnswer = {
	answerToPlayer: string;
	rules_considered: Array<string>;
	game_state_considered: string;
};

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
		action: Action,
		additionalStoryInput: string,
		customSystemInstruction: string,
		historyMessages: Array<LLMMessage>,
		storyState: Story,
		characterState: CharacterDescription,
		playerCharactersGameState: PlayerCharactersGameState,
		inventoryState: InventoryState,
		relatedHistory: string[],
		gameSettings: GameSettings
	): Promise<{ newState: GameActionState; updatedHistoryMessages: Array<LLMMessage> }> {
		let playerActionText = action.characterName + ': ' + action.text;
		const cost = parseInt(action.resource_cost?.cost as unknown as string) || 0;
		if (cost > 0) {
			playerActionText += `\n${action.resource_cost?.cost} ${action.resource_cost?.resource_key} cost`;
		}
		const playerActionTextForHistory = playerActionText;
		let combinedText = playerActionText;
		if (additionalStoryInput) combinedText += '\n' + additionalStoryInput;

		if (relatedHistory.length > 0) {
			combinedText += PAST_STORY_PLOT_RULE + relatedHistory.join('\n');
		}
		const gameAgent = this.getGameAgentSystemInstructionsFromStates(
			storyState,
			characterState,
			playerCharactersGameState,
			inventoryState,
			customSystemInstruction,
			gameSettings
		);
		gameAgent.push(jsonSystemInstructionForGameAgent(gameSettings));

		console.log(combinedText);
		const request: LLMRequest = {
			userMessage: combinedText,
			historyMessages: historyMessages,
			systemInstruction: gameAgent,
			returnFallbackProperty: true
		};
		const newState = (await this.llm.generateReasoningContent(request))
			?.parsedObject as GameActionState;
		const { userMessage, modelMessage } = this.buildHistoryMessages(
			playerActionTextForHistory,
			newState
		);
		const updatedHistoryMessages = [...historyMessages, userMessage, modelMessage];
		mapGameState(newState);
		return { newState, updatedHistoryMessages };
	}

	async generateAnswerForPlayerQuestion(
		question: string,
		customSystemInstruction: string,
		historyMessages: Array<LLMMessage>,
		storyState: Story,
		characterState: CharacterDescription,
		playerCharactersGameState: PlayerCharactersGameState,
		inventoryState: InventoryState,
		npcState: NPCState,
		relatedHistory: string[],
		gameSettings: GameSettings,
		campaignChapterState?: CampaignChapter,
		customGmNotes?: string
	): Promise<GameMasterAnswer> {
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
		if (relatedHistory.length > 0) {
			gameAgent.push('History Rules:\n' + PAST_STORY_PLOT_RULE + relatedHistory.join('\n'));
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
				customSystemInstruction,
				gameSettings
			).join('\n');
		const request: LLMRequest = {
			userMessage: userMessage,
			historyMessages: historyMessages,
			systemInstruction: gameAgent
		};
		return (await this.llm.generateReasoningContent(request))?.parsedObject as GameMasterAnswer;
	}

	private getGameAgentSystemInstructionsFromStates(
		storyState: Story,
		characterState: CharacterDescription,
		playerCharactersGameState: PlayerCharactersGameState,
		inventoryState: InventoryState,
		customSystemInstruction: string,
		gameSettings: GameSettings
	) {
		const gameAgent = [
			systemBehaviour(gameSettings),
			stringifyPretty(storyState),
			'The following is a description of the player character, always refer to it when considering appearance, reasoning, motives etc.' +
				'\n' +
				stringifyPretty(characterState),
			"The following are the character's CURRENT resources, consider it in your response\n" +
				stringifyPretty(playerCharactersGameState),
			"The following is the character's inventory, check items for relevant passive effects relevant for the story progression or effects that are triggered every action.\n" +
				stringifyPretty(inventoryState)
		];
		if (customSystemInstruction) {
			gameAgent.push(customSystemInstruction);
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
		playerName: string
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
					sourceId: playerName,
					targetId: playerName,
					type: resourceKey + '_gained',
					value: { result: refillValue - (currentResources[resourceKey].current_value || 0) || 0 }
				});
			});
		return returnObject;
	}

	static getLevelUpCostObject(xpCost: number, playerName: string, level: number): StatsUpdate {
		return {
			sourceId: playerName,
			targetId: playerName,
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
}

const storyWordLimit = 'must be between 100 and 160 words, do not exceed this range.';

export const SLOW_STORY_PROMPT =
	'Ensure that the narrative unfolds gradually, building up anticipation and curiosity before moving towards any major revelations or climactic moments.';
const systemBehaviour = (gameSettingsState: GameSettings) => `
You are a Pen & Paper Game Master, crafting captivating, limitless GAME experiences using ADVENTURE_AND_MAIN_EVENT, THEME, TONALITY for CHARACTER.

The Game Master's General Responsibilities Include:
- Tell compelling stories in TONALITY for my CHARACTER.
- Paint vivid pictures of encounters and settings.
- Generate settings, places, and years, adhering to THEME and TONALITY, and naming GAME elements.
- Never narrate events briefly or summarize; Always describe detailed scenes with character conversation in direct speech
- Use GAME's core knowledge and rules.
- Handle CHARACTER resources per GAME rules, e.g. in a survival game hunger decreases over time; Blood magic costs blood; etc...
- Handle NPC resources, you must exactly use resourceKey "hp" or "mp", and no deviations of that
${!gameSettingsState.detailedNarrationLength ? '- The story narration ' + storyWordLimit : ''}
- Ensure a balanced mix of role-play, combat, and puzzles. Integrate these elements dynamically and naturally based on context.
- Craft varied NPCs, ranging from good to evil.

Storytelling
- Keep story secrets until they are discovered by the player.
- Introduce key characters and explore their initial thoughts, feelings, and relationships with one another. Showcase their emotions, motivations, and backstories. 
- Encourage moments of introspection, dialogue, and quiet observation to develop a deeper understanding of the characters and the world they inhabit. 
- ${SLOW_STORY_PROMPT}
- Do not make decisions on behalf of the player character. If the story reaches a point where the player character must make a choice, pause the narration and wait for the player's action before continuing.
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
- Combat is slow paced with actions and reactions, spanning multiple rounds
- Never decide on your own that NPCs or CHARACTER die, apply appropriate damage instead. Only the player will tell you when they die.
- NPCs and CHARACTER cannot simply be finished off with a single attack.

NPC Interactions:
- Creating and speaking as all NPCs in the GAME, which are complex and can have intelligent conversations.
- Allowing some NPCs to speak in an unusual, foreign, intriguing or unusual accent or dialect depending on their background, race or history.
- Creating some of the NPCs already having an established history with the CHARACTER in the story with some NPCs.
- When the player character interacts with a NPC you must always include the NPC response within the same action

Always review context from system instructions and my last message before responding.`;

const jsonSystemInstructionForGameAgent = (
	gameSettingsState: GameSettings
) => `Important Instruction! You must always respond with valid JSON in the following format:
{
  "currentPlotPoint": VALUE MUST BE ALWAYS IN ENGLISH; Identify the most relevant plotId in ADVENTURE_AND_MAIN_EVENT that the story aligns with; Explain your reasoning briefly; Format "{Reasoning} - PLOT_ID: {plotId}",
  "gradualNarrativeExplanation": "Reasoning how the story development is broken down to meaningful narrative moments. Each step should represent a significant part of the process, giving the player the opportunity to make impactful choices.",
  "plotPointAdvancingNudgeExplanation": "VALUE MUST BE ALWAYS IN ENGLISH; Explain what could happen next to advance the story towards NEXT_PLOT_ID according to ADVENTURE_AND_MAIN_EVENT; Include brief explanation of NEXT_PLOT_ID; Format "CURRENT_PLOT_ID: {plotId}; NEXT_PLOT_ID: {currentPlotId + 1}; {Reasoning}",
  "story": "depending on If The Action Is A Success Or Failure progress the story further with appropriate consequences. ${!gameSettingsState.detailedNarrationLength ? storyWordLimit : ''} For character speech use single quotes. Format the narration using HTML tags for easier reading.",
  "story_memory_explanation": "Explanation if story progression has Long-term Impact: Remember events that significantly influence character arcs, plot direction, or the game world in ways that persist or resurface later; Format: {explanation} LONG_TERM_IMPACT: LOW, MEDIUM, HIGH",
  "image_prompt": "Create a prompt for an image generating ai that describes the scene of the story progression, do not use character names but appearance description. Always include the gender. Keep the prompt similar to previous prompts to maintain image consistency. When describing CHARACTER, always refer to appearance variable. Always use the format: {sceneDetailed} {adjective} {charactersDetailed}",
  "xpGainedExplanation": "Explain why or why nor the CHARACTER gains xp in this situation",
  ${statsUpdatePromptObject},
  "inventory_update": [
        #Add this to the JSON if the story implies that an item is added or removed from the character's inventory
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
  ],
  "is_character_in_combat": true if CHARACTER is in active combat else false,
  "currently_present_npcs_explanation": "For each NPC explain why they are or are not present in list currently_present_npcs",
  "currently_present_npcs": List of NPCs or party members that are present in the current situation. Format: ${currentlyPresentNPCSForPrompt}
}`;

const jsonSystemInstructionForPlayerQuestion = `Important Instruction! You must always respond with valid JSON in the following format:
{
  "game_state_considered": Brief explanation on how the game state is involved in the answer; mention relevant variables explicitly,
  "rules_considered": String Array; Identify the relevant Game Master's rules that are related to the question; Include the exact text of a rule,
  "answerToPlayer": Answer outside of character, do not describe the story, but give an explanation
}`;
