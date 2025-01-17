import { stringifyPretty } from '$lib/util.svelte';
import { ActionDifficulty } from '../../../routes/game/gameLogic';
import { type StatsUpdate, statsUpdatePromptObject } from '$lib/ai/agents/combatAgent';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import type { Story } from '$lib/ai/agents/storyAgent';
import type { DiceRollDifficulty } from '$lib/ai/agents/difficultyAgent';
import { mapGameState } from '$lib/ai/agents/mappers';

export type InventoryUpdate = {
	type: 'add_item' | 'remove_item';
	item_id: string;
	item_added?: Item;
};
export type InventoryState = { [item_id: string]: Item };
export type Item = { description: string; effect: string };
export type Action = {
	characterName: string;
	text: string;
	action_difficulty?: ActionDifficulty;
	type?: string;
	is_straightforward?: string;
	actionSideEffects?: string;
	enemyEncounterExplanation?: string;
	mp_cost?: number;
} & DiceRollDifficulty;
export type PlayerCharactersGameState = {
	[playerCharacterName: string]: { currentHP: number; currentMP: number };
};
export type Targets = { hostile: Array<string>; friendly: Array<string>; neutral: Array<string> };
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
};

export class GameAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	/**
	 *
	 * @param actionText text from the user action, will be added to the historyMessages
	 * @param additionalActionInput additional text to act as asinge message system instruction, e.g combat, not added to historyMessages
	 * @param customSystemInstruction
	 * @param historyMessages
	 * @param storyState
	 * @param characterState
	 * @param playerCharactersGameState
	 */
	async generateStoryProgression(
		action: Action,
		additionalActionInput: string,
		customSystemInstruction: string,
		historyMessages: Array<LLMMessage>,
		storyState: Story,
		characterState: CharacterDescription,
		playerCharactersGameState: PlayerCharactersGameState,
		inventoryState: InventoryState
	): Promise<{ newState: GameActionState; updatedHistoryMessages: Array<LLMMessage> }> {
		let playerActionText = action.characterName + ': ' + action.text;
		const mpCost = parseInt(action.mp_cost as unknown as string) || 0;
		if (mpCost > 0) {
			playerActionText += '\nMP cost ' + mpCost;
		}
		const playerActionTextForHistory = playerActionText;
		let combinedText = playerActionText;
		if (additionalActionInput) combinedText += '\n\n' + additionalActionInput;
		const gameAgent = [
			systemBehaviour,
			stringifyPretty(storyState),
			'The following is a description of the player character, always refer to it when considering appearance, reasoning, motives etc.' +
				'\n' +
				stringifyPretty(characterState),
			"The following are the character's CURRENT resources, consider it in your response\n" +
				stringifyPretty(playerCharactersGameState),
			"The following is the character's inventory, check items for relevant passive effects relevant for the story progression or effects that are triggered every action.\n" +
				stringifyPretty(inventoryState),
			jsonSystemInstruction
		];
		if (customSystemInstruction) {
			gameAgent.push(customSystemInstruction);
		}
		console.log(combinedText);
		const request: LLMRequest = {
			userMessage: combinedText,
			historyMessages: historyMessages,
			systemInstruction: gameAgent
		};
		const newState = (await this.llm.generateContent(request)) as GameActionState;
		const { userMessage, modelMessage } = this.buildHistoryMessages(
			playerActionTextForHistory,
			newState
		);
		const updatedHistoryMessages = [...historyMessages, userMessage, modelMessage];
		mapGameState(newState);
		return { newState, updatedHistoryMessages };
	}

	getGameEndedPrompt() {
		return 'The CHARACTER has fallen to 0 HP and is dying.';
	}

	getStartingPrompt() {
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

	getStartingResourcesUpdateObject(
		hp: number,
		mp: number,
		playerName: string
	): Pick<GameActionState, 'stats_update'> {
		return {
			stats_update: [
				{
					sourceId: playerName,
					targetId: playerName,
					type: 'hp_gained',
					value: { result: hp }
				},
				{
					sourceId: playerName,
					targetId: playerName,
					type: 'mp_gained',
					value: { result: mp }
				}
			]
		};
	}

	static getItemImagePrompt(item_id: string, item: Item, storyImagePrompt: string): string {
		return `${storyImagePrompt} RPG game icon ${item_id} ${item.description}`;
	}
}

const storyWordLimit = 'must be between 100 and 150 words, do not exceed this range.';

export const SLOW_STORY_PROMPT =
	'Ensure that the narrative unfolds gradually, building up anticipation and curiosity before moving towards any major revelations or climactic moments.';
const systemBehaviour = `
You are a Pen & Paper Game Master, crafting captivating, limitless GAME experiences using ADVENTURE_AND_MAIN_EVENT, THEME, TONALITY for CHARACTER.

The Game Master's General Responsibilities Include:

- Tell compelling stories in TONALITY for my CHARACTER.
- Paint vivid pictures of encounters and settings.
- Generate settings, places, and years, adhering to THEME and TONALITY, and naming GAME elements.
- Never skip ahead in time unless the player has indicated to.
- Never narrate events briefly or summarize; Always describe detailed scenes with character conversation in direct speech
- Use GAME's core knowledge and rules.
- The story narration ${storyWordLimit}
- Balance role-play, combat, and puzzles.
- Craft varied NPCs, ranging from good to evil.

Storytelling:

- Keep story secrets until they are discovered by the player.
- Introduce key characters and explore their initial thoughts, feelings, and relationships with one another. Focus on how they react to the first signs of an unfolding mystery or adventure, showcasing their emotions, motivations, and backstories. 
- Gradually introduce small, suspenseful events that build tension and hint at larger secrets or challenges to come. 
- Encourage moments of introspection, dialogue, and quiet observation to develop a deeper understanding of the characters and the world they inhabit. 
- Slowly unveil clues and strange occurrences that deepen the mystery, allowing the story to evolve at a measured pace. 
- ${SLOW_STORY_PROMPT}

Actions:

- Let the player guide actions and story relevance.
- Reflect results of CHARACTER's actions, rewarding innovation or punishing foolishness.
- CHARACTER actions are only chosen by the player and not by ROLE
- Involve other characters' reactions, doubts, or support during the action, encouraging a deeper exploration of relationships and motivations.
- On each action review the character's inventory and spells_and_abilities for items and skills that have passive effects such as defense or health regeneration and apply them

Combat:

- Combat is slow paced with actions and reactions, spanning multiple rounds
- Never decide on your own that NPCs or CHARACTER die, apply appropriate damage instead. Only the player will tell you when they die.
- NPCs and CHARACTER cannot simply be finished off with a single attack.

NPC Interactions:

- Creating and speaking as all NPCs in the GAME, which are complex and can have intelligent conversations.
- Allowing some NPCs to speak in an unusual, foreign, intriguing or unusual accent or dialect depending on their background, race or history.
- Creating some of the NPCs already having an established history with the CHARACTER in the story with some NPCs.
- When the player character speaks to an NPC always include the NPC response

Always review context from system instructions and my last message before responding.`;

const jsonSystemInstruction = `Important Instruction! You must always respond with valid JSON in the following format:
{
  "currentPlotPoint": Identify the most relevant plotId in ADVENTURE_AND_MAIN_EVENT that the story aligns with; Explain your reasoning briefly; Format "{Reasoning} - plotId: {plotId}",
  "nextPlotPoint": Identify the next plotId according to ADVENTURE_AND_MAIN_EVENT, must be greater than currentPlotPoint or null if there is no next plot point; Explain your reasoning briefly; Format "{Reasoning} - plotId: {plotId}",
  "gradualNarrativeExplanation": "Reasoning how the story development is broken down to meaningful narrative moments. Each step should represent a significant part of the process, giving the player the opportunity to make impactful choices.",
  "plotPointAdvancingNudgeExplanation": "Explain the currentPlotPoint and what could happen next to advance the story towards nextPlotPoint",
  "story": "depending on If The Action Is A Success Or Failure progress the story further with appropriate consequences. ${storyWordLimit} For character speech use single quotes. Format the different parts of the narration using HTML tags for easier reading.",
  "image_prompt": "Create a prompt for an image generating ai that describes the scene of the story progression, do not use character names but appearance description. Always include the gender. Keep the prompt similar to previous prompts to maintain image consistency. When describing CHARACTER, always refer to appearance variable. Always use the format: {sceneDetailed} {adjective} {charactersDetailed}",
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
  ${statsUpdatePromptObject},
  "is_character_in_combat": true if CHARACTER is in active combat else false,
  "currently_present_npcs_explanation": "For each NPC explain why they are or are not present in list currently_present_npcs",
  "currently_present_npcs": List of NPCs or party members that are present in the current situation. Also list objects if story relevant. Format: {"hostile": ["uniqueNameId", ...], "friendly": ["uniqueNameId", ...], "neutral": ["uniqueNameId", ...]}
}`;
