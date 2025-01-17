import { stringifyPretty } from '$lib/util.svelte';
import { ActionDifficulty } from '../../../routes/game/gameLogic';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import { type Action, type GameActionState, type InventoryState } from '$lib/ai/agents/gameAgent';
import type { Story } from '$lib/ai/agents/storyAgent';

export class ActionAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	async generateActions(
		currentGameState: GameActionState,
		historyMessages: Array<LLMMessage>,
		storySettings: Story,
		characterDescription: CharacterDescription,
		characterStats: CharacterStats,
		inventoryState: InventoryState,
		additionalActionInput?: string,
		customSystemInstruction?: string
	): Promise<Array<Action>> {
		//remove knowledge of story secrets etc
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { ['adventure_and_main_event']: _, ...storySettingsMapped } = storySettings;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { ['spells_and_abilities']: __, ...characterStatsMapped } = characterStats;
		const currentGameStateMapped = {
			currently_present_npcs_explanation: currentGameState['currently_present_npcs_explanation'],
			currently_present_npcs: currentGameState.currently_present_npcs,
			plotPointAdvancingNudgeExplanation: currentGameState['plotPointAdvancingNudgeExplanation'],
			gradualNarrativeExplanation: currentGameState['gradualNarrativeExplanation'],
			story: currentGameState.story,
			is_character_in_combat: currentGameState.is_character_in_combat
		};
		const agent = [
			`You are RPG action agent, you are given a RPG story and then suggest the next action the player character can take, considering the story, currently_present_npcs and character traits.
				Action Rules:
				- Always provide at least 3 potential actions the CHARACTER can take, fitting the THEME.
				- Keep the actions text short, max 20 words.
				- as action text never mention meta elements like stats or difficulty, only use an in-game story driven description
				- Review the character's spells_and_abilities and inventory for passive attributes that could alter the dice_roll
				- NPCs and CHARACTER cannot simply be finished off with a single attack.
				- Any action is allowed to target anything per game rules.
				- Suggest actions that make creative use of environmental features or interactions with NPCs when possible.
				- Only suggest actions that are plausible in the current situation.
				- Do not suggest actions that include information the players do not know, such as undiscovered secrets or future plot points`,
			'The suggested actions must fit to the setting of the story:' +
				'\n' +
				stringifyPretty(storySettingsMapped),
			'Suggest actions according to the following description of the character temper, e.g. acting smart or with force, ...' +
				'\n' +
				stringifyPretty(characterDescription),
			'As an action, the character can make use of items from the inventory:' +
				'\n' +
				stringifyPretty(inventoryState),
			'Consider the following character stats only for dice_roll modifiers' +
				'\n' +
				stringifyPretty(characterStatsMapped),
			`Most important instruction! You must always respond with following JSON format! 
      [
				{
					"characterName": "Player character name who performs this action",
					"plausibility": "Brief explanation why this action is plausible in the current situation",
					"text": "Keep the text short, max 20 words. Description of the action to display to the player, do not include modifier or difficulty here.",
					"type": "Misc|Attack|Spell|Conversation|Social_Manipulation",
					"required_trait": "the skill the dice is rolled for",
					"difficulty_explanation": "Keep the text short, max 20 words. Explain the reasoning for action_difficulty. Format: Chose {action_difficulty} because {reason}",
					"action_difficulty": "${Object.keys(ActionDifficulty)}",
					"mp_cost": cost of this action as integer; 0 if this action does not use mp,
					"is_straightforward": true if it involves few steps or has a clear outcome; false if it involves multiple narrative moments or decisions; include brief {reasoning}. Use the string format: "{reasoning}: true|false",
					"actionSideEffects": "Reasoning whether this action causes any side effects on the environment or responses from NPCs",
  				"enemyEncounterExplanation": {reasoning} for the {probability: low|medium|high} of an enemy encounter; if probable describe enemy details; low probability if an encounter recently happened; Format "{reasoning} - {probability}",
					"dice_roll": {probable
						"modifier_explanation": "Keep the text short, max 15 words. Modifier can be applied due to a character's proficiency, disadvantage, high difficulty, passive attributes in spells_and_abilities and inventory, or situational factors specific to previous actions. Give an in game story explanation why a modifier is applied or not and how you decided that.",
						# If action_difficulty is difficult apply a bonus.
						"modifier": "none|bonus|malus",
						"modifier_value": positive or negative value (-5 to +5)
					}
				},
				...
  		]`
		];
		if (customSystemInstruction) {
			agent.push(customSystemInstruction);
		}
		const userMessage =
			'Suggest specific actions the CHARACTER can take, considering their personality, skills and items.\n' +
			'Each action must clearly outline what the character does and how they do it. \n The actions must be directly related to the current story: ' +
			stringifyPretty(currentGameStateMapped) +
			'\nThe actions must be plausible in the current situation, e.g. before investigating, a combat or tense situation must be resolved.' +
			'\n' +
			(additionalActionInput || '');
		console.log('actions prompt: ', userMessage);
		const request: LLMRequest = {
			userMessage,
			historyMessages,
			systemInstruction: agent
		};
		const response = (await this.llm.generateContent(request)) as any;

		//can get not directly arrays but wrapped responses from ai sometimes...
		if (response && response.actions) {
			return response.actions as Array<Action>;
		}
		if (response && response.jsonArray) {
			return response.jsonArray as Array<Action>;
		}
		return response as Array<Action>;
	}
}
