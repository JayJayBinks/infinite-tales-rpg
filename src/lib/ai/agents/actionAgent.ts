import { stringifyPretty } from '$lib/util.svelte';
import { ActionDifficulty } from '../../../routes/game/gameLogic';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type { CharacterStats } from '$lib/ai/agents/characterStatsAgent';
import type { CharacterDescription } from '$lib/ai/agents/characterAgent';
import {
	type Action,
	type GameActionState,
	type InventoryState,
	type Item
} from '$lib/ai/agents/gameAgent';
import type { Story } from '$lib/ai/agents/storyAgent';
import { GEMINI_MODELS, THINKING_BUDGET } from '../geminiProvider';
import { CombatAgent } from './combatAgent';

export const diceRollPrompt = `"dice_roll": {
						"modifier_explanation": "Keep the text short, max 15 words. Never based on attributes and skills, they are already applied! Instead based on situational factors specific to the story progression or passive attributes in spells_and_abilities and inventory. Give an in game story explanation why a modifier is applied or not and how you decided that.",
						# If action_difficulty is difficult apply a bonus.
						"modifier": "none|bonus|malus",
						"modifier_value": negative number for malus, 0 if none, positive number for bonus
					}`;

export enum InterruptProbability {
	NEVER = 'NEVER',
	LOW = 'LOW',
	MEDIUM = 'MEDIUM',
	HIGH = 'HIGH',
	ALWAYS = 'ALWAYS'
}
export class ActionAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	private readonly jsonFormatAndRules = (
		attributes: string[],
		skills: string[],
		newSkillsAllowed: boolean
	): string => {
		let newSkillRule = '';
		if (newSkillsAllowed) {
			newSkillRule = `Choose or create a single skill that is more specific than the related_attribute but broad enough for multiple actions (e.g. 'Melee Combat' instead of 'Strength'). Use an exact same spelled EXISTING SKILL if applicable; otherwise, add a fitting new one.`;
		} else {
			newSkillRule = `Choose an exact same spelled single skill from EXISTING SKILLS or null if none fits; Never create a new skill;`;
		}
		return `
					"characterName": "Player character name who performs this action",
					"plausibility": "Brief explanation why this action is plausible in the current situation",
					"text": "Keep the text short, max 20 words. Description of the action to display to the player, do not include modifier or difficulty here.",
					"type": "Misc|Attack|Spell|Conversation|Social_Manipulation|Investigation|Travel|Crafting",
					"related_attribute": "a single attribute the dice is rolled for, must be an exact same spelled attribute from this list: ${attributes.join(', ')}; never create new Attributes!",
					"existing_related_skill_explanation": "Explanation if an existing skill is used instead of creating a new one",
					"related_skill": "a single skill the dice is rolled for; ${newSkillRule} EXISTING SKILLS: ${skills.join(', ')}",
					"difficulty_explanation": "Keep the text short, max 20 words. Explain the reasoning for action_difficulty. Format: Chose {action_difficulty} because {reason}",
					"action_difficulty": "${Object.keys(ActionDifficulty).join('|')}",
					"is_possible": true|false,
					"resource_cost": if no cost null else { 
						"resource_key": "the resource to pay for this action; one of character_stats.resources",
						"cost": number,
					},
					"narration_details": Format {"reasoning": string, "enum_english": LOW|MEDIUM|HIGH}; Brief {reasoning} how many details the narration for this action should include; LOW if it involves few steps or can be done quickly; MEDIUM|HIGH if it involves thorough planning or decisions,
					"actionSideEffects": "Reasoning whether this action causes any side effects on the environment or reactions from NPCs",
  					"enemyEncounterExplanation": Format {"reasoning": string, "enum_english": LOW|MEDIUM|HIGH}; Brief {reasoning} for the probability of an enemy encounter; if probable describe enemy details; LOW probability if an encounter recently happened,
					"is_interruptible": Format {"reasoning": string, "enum_english": ${Object.keys(InterruptProbability).join('|')}}; Brief {reasoning} for the probability that this action is interrupted; e.g. travel in dangerous environment is HIGH,
					${diceRollPrompt}
				}`;
	};

	getRestrainingStatePrompt = (restraining_state: string) =>
		`The character is currently affected by a restraining state: ${restraining_state}. Only suggest actions that are possible while under this effect.`;

	addRestrainingStateToAgent = (agent: string[], restrainingState?: string) => {
		if (restrainingState) {
			agent.push(this.getRestrainingStatePrompt(restrainingState));
		}
	};

	async generateSingleAction(
		action: Action,
		currentGameState: GameActionState,
		historyMessages: Array<LLMMessage>,
		storySettings: Story,
		characterDescription: CharacterDescription,
		characterStats: CharacterStats,
		inventoryState: InventoryState,
		customSystemInstruction?: string,
		customActionAgentInstruction?: string,
		relatedHistory?: string[],
		newSkillsAllowed: boolean = false,
		restrainingState?: string
	): Promise<Action> {
		//remove knowledge of story secrets etc
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { ['adventure_and_main_event']: _, ...storySettingsMapped } = storySettings;
		const currentGameStateMapped = this.getCurrentGameStateMapped(currentGameState);

		const agent = [
			`You are RPG action agent, you are given a RPG story and one action the player wants to perform; Determine difficulty, resource cost etc. for this action; Consider the story, currently_present_npcs and character stats.
				Action Rules:
				- Review the character's spells_and_abilities and inventory for passive attributes that could alter the dice_roll
				- For puzzles, the player —not the character— must solve them. Offer a set of possible actions, including both correct and incorrect choices.
				- Any action is allowed to target anything per game rules.`,
			'The suggested action must fit to the setting of the story:' +
				'\n' +
				stringifyPretty(storySettingsMapped),
			'dice_roll can be modified by following description of the character, e.g. acting smart or with force, ...' +
				'\n' +
				stringifyPretty(characterDescription),
			'dice_roll can be modified by items from the inventory:' +
				'\n' +
				stringifyPretty(inventoryState),
			'dice_roll modifier can be applied based on high or low resources:' +
				'\n' +
				stringifyPretty(characterStats.resources),
			`Most important instruction! You must always respond with following JSON format! 
				${this.jsonFormatAndRules(Object.keys(characterStats.attributes), Object.keys(characterStats.skills), newSkillsAllowed)}`
		];
		this.addRestrainingStateToAgent(agent, restrainingState);
		if (customSystemInstruction) {
			agent.push('Following instructions overrule all others: ' + customSystemInstruction);
		}
		if (customActionAgentInstruction) {
			agent.push('Following instructions overrule all others: ' + customActionAgentInstruction);
		}

		let userMessage =
			'The player wants to perform following action, you must use these exact words as action text: ' +
			action.text +
			'\nDetermine the difficulty and resource cost with considering their personality, skills, items, story summary and following game state\n' +
			stringifyPretty(currentGameStateMapped);

		if (restrainingState) {
			userMessage += '\n' + this.getRestrainingStatePrompt(restrainingState) + '\n';
		}

		if (relatedHistory && relatedHistory.length > 0) {
			userMessage +=
				'\n\nFollowing is related past story plot, check if the action is possible in this context, it must be plausible in this moment and not just hypothetically;\n' +
				'If no history detail directly contradicts the action, it is possible.\n' +
				relatedHistory.join('\n');
		}
		console.log('actions prompt: ', userMessage);
		const request: LLMRequest = {
			userMessage,
			historyMessages,
			systemInstruction: agent,
			thinkingConfig: {
				thinkingBudget: THINKING_BUDGET.FAST
			}
		};
		console.log('action generate start time: ', new Date());
		const actionGenerated = (await this.llm.generateContent(request))?.content as Action;
		console.log('action generate end time: ', new Date());
		return actionGenerated;
	}

	private readonly actionRules = `Action Rules:
		- Always provide at least 3 potential actions the CHARACTER can take, fitting the THEME.
		- Keep the actions text short, max 20 words.
		- as action text never mention meta elements like stats or difficulty, only use an in-game story driven description
		- Review the character's spells_and_abilities and inventory for passive attributes that could alter the dice_roll
		- NPCs and CHARACTER cannot simply be finished off with a single attack.
		- Any action is allowed to target anything per game rules.
		- Suggest actions that make creative use of environmental features or interactions with NPCs when possible.
		- Only suggest actions that are plausible in the current situation.
		- Do not suggest actions that include information the players do not know, such as undiscovered secrets or future plot points`;

	async generateActions(
		currentGameState: GameActionState,
		historyMessages: Array<LLMMessage>,
		storySettings: Story,
		characterDescription: CharacterDescription,
		characterStats: CharacterStats,
		inventoryState: InventoryState,
		customSystemInstruction?: string,
		customActionAgentInstruction?: string,
		relatedHistory?: string[],
		newSkillsAllowed: boolean = false,
		restrainingState?: string
	): Promise<{ thoughts: string; actions: Array<Action> }> {
		//remove knowledge of story secrets etc
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { ['adventure_and_main_event']: _, ...storySettingsMapped } = storySettings;

		const currentGameStateMapped = this.getCurrentGameStateMapped(currentGameState);
		const agent = [
			'You are RPG action agent, you are given a RPG story and then suggest the next action the player character can take, considering the story, currently_present_npcs and character stats.',
			this.actionRules,
			'The suggested actions must fit to the setting of the story:' +
				'\n' +
				stringifyPretty(storySettingsMapped),
			'Suggest actions according to the following description of the character temper, e.g. acting smart or with force, ...' +
				'\n' +
				stringifyPretty(characterDescription),
			'As an action, the character can make use of items from the inventory:' +
				'\n' +
				stringifyPretty(inventoryState),
			'dice_roll modifier can be applied based on high or low resources:' +
				'\n' +
				stringifyPretty(characterStats.resources),
			`Most important instruction! You must always respond with following JSON format! 
      [
				${this.jsonFormatAndRules(Object.keys(characterStats.attributes), Object.keys(characterStats.skills), newSkillsAllowed)},
				...
  		]`
		];

		this.addRestrainingStateToAgent(agent, restrainingState);
		if (relatedHistory && relatedHistory.length > 0) {
			agent.push(
				'The actions must be plausible with PAST STORY PLOT;\n' +
					'Never suggest actions to investigate PAST STORY PLOT as they are already known;\n' +
					//make sure custom player history takes precedence
					'If PAST STORY PLOT contradict each other, the earliest takes precedence, and the later conflicting detail must be ignored;\nPAST STORY PLOT:\n' +
					relatedHistory.join('\n')
			);
		}
		if (customSystemInstruction) {
			agent.push('Following instructions overrule all others: ' + customSystemInstruction);
		}
		if (customActionAgentInstruction) {
			agent.push('Following instructions overrule all others: ' + customActionAgentInstruction);
		}
		let userMessage =
			'Suggest specific actions the CHARACTER can take, considering their personality, skills and items.\n' +
			'Each action must clearly outline what the character does and how they do it. \n The actions must be directly related to the current story: ' +
			stringifyPretty(currentGameStateMapped) +
			'\nThe actions must be plausible in the current situation, e.g. before investigating, a tense situation must be resolved.';
		if (currentGameState.is_character_in_combat) {
			userMessage += CombatAgent.getCombatPromptAddition();
		}
		if (restrainingState) {
			userMessage += '\n' + this.getRestrainingStatePrompt(restrainingState) + '\n';
		}
		console.log('actions prompt: ', userMessage);
		const request: LLMRequest = {
			userMessage,
			historyMessages,
			systemInstruction: agent
		};
		const response = (await this.llm.generateContent(request)) as any;
		console.log('actions response: ', response);
		//can get not directly arrays but wrapped responses from ai sometimes...
		if (response && response.actions) {
			return { thoughts: response.thoughts, actions: response.actions };
		}
		if (response && response.jsonArray) {
			return { thoughts: response.thoughts, actions: response.jsonArray };
		}
		return { thoughts: response?.thoughts, actions: response?.content };
	}

	async generateActionsForItem(
		item: Item,
		currentGameState: GameActionState,
		historyMessages: Array<LLMMessage>,
		storySettings: Story,
		characterDescription: CharacterDescription,
		characterStats: CharacterStats,
		inventoryState: InventoryState,
		restrainingState?: string,
		customSystemInstruction?: string,
		customActionAgentInstruction?: string,
		newSkillsAllowed: boolean = false
	): Promise<{ thoughts: string; actions: Array<Action> }> {
		//remove knowledge of story secrets etc
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { ['adventure_and_main_event']: _, ...storySettingsMapped } = storySettings;

		const currentGameStateMapped = this.getCurrentGameStateMapped(currentGameState);
		const agent = [
			'You are RPG action agent, you are given an item description and then suggest the actions the player character can take with that item, considering the story, currently_present_npcs and character stats.',
			this.actionRules,
			'The suggested actions must fit to the setting of the story:' +
				'\n' +
				stringifyPretty(storySettingsMapped),
			'Suggest actions according to the following description of the character temper, e.g. acting smart or with force, ...' +
				'\n' +
				stringifyPretty(characterDescription),
			'As an action, the character could also combine the item with other items from the inventory:' +
				'\n' +
				stringifyPretty(inventoryState),
			'dice_roll modifier can be applied based on high or low resources:' +
				'\n' +
				stringifyPretty(characterStats.resources),
			`Most important instruction! You must always respond with following JSON format! 
      [
				${this.jsonFormatAndRules(Object.keys(characterStats.attributes), Object.keys(characterStats.skills), newSkillsAllowed)},
				...
  		]`
		];
		this.addRestrainingStateToAgent(agent, restrainingState);
		if (customSystemInstruction) {
			agent.push('Following instructions overrule all others: ' + customSystemInstruction);
		}
		if (customActionAgentInstruction) {
			agent.push('Following instructions overrule all others: ' + customActionAgentInstruction);
		}
		let userMessage =
			'Suggest specific actions the CHARACTER can take with the item:\n' +
			stringifyPretty(item) +
			'\nEach action must clearly outline what the character does and how they do it. \n The actions must be directly related to the current story: ' +
			stringifyPretty(currentGameStateMapped) +
			'\nThe actions must be plausible in the current situation, e.g. before investigating, a combat or tense situation must be resolved.';

		if (restrainingState) {
			userMessage += '\n' + this.getRestrainingStatePrompt(restrainingState) + '\n';
		}
		console.log('actions prompt: ', userMessage);
		const request: LLMRequest = {
			userMessage,
			historyMessages,
			systemInstruction: agent,
			model: GEMINI_MODELS.FLASH_THINKING_2_0
		};
		const response = (await this.llm.generateContent(request)) as any;

		//can get not directly arrays but wrapped responses from ai sometimes...
		if (response && response.actions) {
			return { thoughts: response.thoughts, actions: response.actions };
		}
		if (response && response.jsonArray) {
			return { thoughts: response.thoughts, actions: response.jsonArray };
		}
		return { thoughts: response.thoughts, actions: response.content };
	}

	private getCurrentGameStateMapped(currentGameState: GameActionState) {
		return {
			currently_present_npcs_explanation: currentGameState['currently_present_npcs_explanation'],
			currently_present_npcs: currentGameState.currently_present_npcs,
			plotPointAdvancingNudgeExplanation: currentGameState['plotPointAdvancingNudgeExplanation'],
			gradualNarrativeExplanation: currentGameState['gradualNarrativeExplanation'],
			story: currentGameState.story,
			is_character_in_combat: currentGameState.is_character_in_combat
		};
	}
}
