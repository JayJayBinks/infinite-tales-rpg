import { shuffleArray, stringifyPretty } from '$lib/util.svelte';
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
import { jsonRule } from './agentUtils';
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

export interface TruthOracleResult {
	state: boolean;
	simulation: { discoverable_weakness_or_clue: string } & Record<string, string>;
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
		return `{
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

	addAdditionalActionInputToUserMessage = (
		userMessage: string,
		additionalActionInputState?: string
	) => {
		if (additionalActionInputState) {
			userMessage += '\n' + additionalActionInputState;
		}
		return userMessage;
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
		restrainingState?: string,
		additionalActionInputState?: string
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
			`${jsonRule} ${this.jsonFormatAndRules(Object.keys(characterStats.attributes), Object.keys(characterStats.skills), newSkillsAllowed)}`
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

		userMessage = this.addAdditionalActionInputToUserMessage(
			userMessage,
			additionalActionInputState
		);

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
		- Actions must be branching choices for the character, not a sequence.
		- Keep the actions text short, max 20 words.
		- as action text never mention meta elements like stats or difficulty, only use an in-game story driven description
		- Review the character's spells_and_abilities and inventory for passive attributes that could alter the dice_roll
		- NPCs and CHARACTER cannot simply be finished off with a single attack.
		- Any action is allowed to target anything per game rules.
		- Suggest actions that make creative use of environmental features or interactions with NPCs when possible.
		- Only suggest actions that are plausible in the current situation.
		- Do not suggest actions that include information the players do not know, such as undiscovered secrets or future plot points.
		`;

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
		restrainingState?: string,
		additionalActionInputState?: string
	): Promise<{ thoughts: string; actions: Array<Action> }> {
		//remove knowledge of story secrets etc
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { ['adventure_and_main_event']: _, ...storySettingsMapped } = storySettings;

		const currentGameStateMapped = this.getCurrentGameStateMapped(currentGameState);
		const agent = [
			'You are RPG action agent, you are given a RPG story and then suggest actions for the currently active party member, considering the story, currently_present_npcs and character stats. Remember that other party members may also be present and could assist or interact.',
			this.actionRules,
			'The suggested actions must fit to the setting of the story:' +
				'\n' +
				stringifyPretty(storySettingsMapped),
			'Suggest actions according to the following description of the currently active character temper, e.g. acting smart or with force, ...' +
				'\n' +
				stringifyPretty(characterDescription),
			'As an action, the character can make use of items from the party inventory:' +
				'\n' +
				stringifyPretty(inventoryState),
			'dice_roll modifier can be applied based on high or low resources of the active character:' +
				'\n' +
				stringifyPretty(characterStats.resources),
			`${jsonRule}
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
			'Suggest specific actions the currently active party member (' + characterDescription.name + ') can take, considering their personality, skills and items.\n' +
			'Each action must clearly outline what the character does and how they do it. \n The actions must be directly related to the current story: ' +
			stringifyPretty(currentGameStateMapped) +
			'\nThe actions must be plausible in the current situation, e.g. before investigating, a tense situation must be resolved.';
		if (currentGameState.is_character_in_combat) {
			userMessage += CombatAgent.getCombatPromptAddition();
		}
		if (restrainingState) {
			userMessage += '\n' + this.getRestrainingStatePrompt(restrainingState) + '\n';
		}
		userMessage = this.addAdditionalActionInputToUserMessage(
			userMessage,
			additionalActionInputState
		);

		console.log('actions prompt: ', userMessage);
		const request: LLMRequest = {
			userMessage,
			historyMessages,
			systemInstruction: agent
		};
		const response = (await this.llm.generateContent(request)) as any;
		console.log('actions response: ', response);
		//can get not directly arrays but wrapped responses from ai sometimes...
		const actions = response?.content.actions || response?.content.jsonArray || response.content;
		// if actions were adjusted via custom prompt, make sure that they do not have an order
		shuffleArray(actions);
		return { thoughts: response?.thoughts, actions };
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
		newSkillsAllowed: boolean = false,
		additionalActionInputState?: string
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
			`${jsonRule}
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
		userMessage = this.addAdditionalActionInputToUserMessage(
			userMessage,
			additionalActionInputState
		);

		console.log('actions prompt: ', userMessage);
		const request: LLMRequest = {
			userMessage,
			historyMessages,
			systemInstruction: agent,
			model: GEMINI_MODELS.FLASH_LITE_2_5,
			thinkingConfig: {
				thinkingBudget: 0
			}
		};
		const response = (await this.llm.generateContent(request)) as any;

		//can get not directly arrays but wrapped responses from ai sometimes...
		const actions = response?.content.actions || response?.content.jsonArray || response.content;
		// if actions were adjusted via custom prompt, make sure that they do not have an order
		shuffleArray(actions);
		return { thoughts: response?.thoughts, actions };
	}

	TRUTH_ORACLE_PROMPT_TEMPLATE = `### INSTRUCTIONS ###
You are a Impartial World Logic Simulator and Cold, Logical Referee for a text-based RPG.
Your absolute primary directive is to simulate a neutral, often challenging, world based on its internal logic.
**You MUST prioritize the direct, causal consequences of recent story event and WORLD CONTEXT over generic genre tropes (like 'convenient secret passages').** 

Analyze the RECENT STORY, WORLD CONTEXT to simulate any relevant objective hidden truth regarding PLAYER ACTION. Simulation means not what could be, but what actually is the truth!
Treat the RECENT STORY as a set of initial conditions. Your goal is to determine what *must also be true* in this world, even if it has not been written yet.
Maintain plausibility and avoid repetition. If many similar events have already occurred, significantly decrease the probability of another one happening right away.

Your response MUST be a single, valid JSON object with the following five keys, **in this exact logical order**:
1.  simulation_reasoning: explain the in-world logic and cause-and-effect that directly led to the specific truths in your simulation. Justify your conclusion.
2.  impartiality_check: A mandatory, meta-level explanation of how this decision is based on world logic and not to drive the story forward or help the character but is impartial.
3.  repetition_awareness: A brief, meta-level explanation if you detected repetition and how to address it in the simulation.
4.  simulation: **The Complete Hidden Truth.** This must be a dynamic JSON object containing all relevant, discoverable facts about the situation as key-value pairs in format {"key": "string; brief description of the simulation"}
				One entry must always be "discoverable_weakness_or_clue" (english and never translated!); it describes how to overcome the challenge, which a successful action reveals.

### EXAMPLE 1 (Impartiality Simulation) ###
RECENT STORY: "The player stands before the main military barracks, a fortress of stone and steel. The front gate is heavily guarded."
PLAYER ACTION: "Search for any hidden entrances to bypass the main gate."
RESPONSE:
{
  "simulation_reasoning": "Simulating a Security-Focused entity. An easy secret entrance is an illogical design flaw, but structural imperfections and predictable routines are plausible realities in any fortress.",
  "impartiality_check": "The decision directly denies the player a convenient solution (a secret door). Instead, it presents logical, but more difficult and complex, opportunities that require further planning and risk.",
  "repetition_awareness": "Repetition is not a factor. This is a fresh challenge.",
  "simulation": {
    "secret_entrance_exists": "No, the barracks was built for high security; all entrances are reinforced and guarded. There are no convenient, secret 'back doors'.",
    "potential_structural_weakness": "However, a detailed survey of the outer wall might reveal that the sewer outflow grate on the north wall is older and less reinforced than the rest of the structure.",
    "observable_guard_routine": "The guards at the main gate perform a shift change with predictable precision every two hours, creating a brief window of heightened activity and potential distraction."
  }
}

### EXAMPLE 2 (Causality Simulation) ###
RECENT STORY: "A massive explosion rocked the engine room. Alarms blared as the lights flickered and died..."
PLAYER ACTION: "Exit the room through the door."
RESPONSE:
{
  "simulation_reasoning": "A massive explosion on a ship with a Failing-Power-Grid would logically cause power loss and secondary damage. The presence of an emergency override is a plausible design feature for any critical door.",
  "impartiality_check": "The outcome is a direct, negative consequence of the explosion. It doesn't provide an easy pass but transforms the door from a simple obstacle into a more complex, multi-stage challenge (hazard + strength test).",
  "repetition_awareness": "Repetition is not a factor. This is a direct causal consequence.",
  "simulation": {
    "door_is_operational": "No, the door is completely unpowered and its magnetic locks have seized. It is inoperable.",
    "environmental_hazard": "Sparks are intermittently arcing from the damaged control panel next to the door, making the immediate area dangerous.",
    "manual_override_option": "A heavily-reinforced emergency release lever is visible, though it looks rusted and would require significant physical force to operate."
  }
}

### EXAMPLE 3 (Repetition-Aware Simulation) ###
RECENT STORY: "This new chamber looks much like the others. The previous two rooms contained traps."
PLAYER ACTION: "Search for any hidden traps."
RESPONSE:
{
  "simulation_reasoning": "This decision subverts the established pattern to create a more varied experience. The unique features of the room provide a logical in-world explanation for the lack of traps.",
  "impartiality_check": "The decision denies the player's expectation (a trap) but rewards their perception with a new, more interesting mystery. It replaces a repetitive physical challenge with a narrative one.",
  "repetition_awareness": "The decision is directly driven by the story history to avoid predictable, repetitive encounters. The secondary truths answer the question 'Why is this room different?'",
  "simulation": {
    "contains_traps": "No, this particular chamber, while ominous, is free of any mechanical or magical traps.",
    "unique_point_of_interest": "The reason it is untrapped is that it served a different purpose. Faded, almost invisible ritualistic runes are carved in a complex circle in the center of the floor.",
    "subtle_clue": "A faint, unusual scent—like ozone and dried herbs—lingers in the air, a smell not present in the other trapped chambers."
  }
}
### END OF EXAMPLES ###`;

	get_ground_truth = async (
		action: Action,
		historyMessages: Array<LLMMessage>,
		storyState: Story,
		relatedHistory?: string[]
	): Promise<TruthOracleResult | null> => {
		// Construct the prompt
		const agent = [
			this.TRUTH_ORACLE_PROMPT_TEMPLATE,
			//"CHARACTER CONTEXT:\n" + JSON.stringify(characterState),
			'WORLD CONTEXT:\n' + JSON.stringify(storyState)
		];
		const userMessage = 'Simulate the hidden truths for following \nPLAYER ACTION:\n' + action.text;

		//shallow clone array historyMessages
		const historyMessagesClone: Array<LLMMessage> = [];
		relatedHistory?.forEach((message) => {
			historyMessagesClone.push({ role: 'user', content: message });
		});
		historyMessages.forEach((message) => {
			historyMessagesClone.push({ role: 'user', content: message.content });
		});
		const request: LLMRequest = {
			userMessage,
			historyMessages: historyMessagesClone,
			systemInstruction: agent,
			temperature: 0.2,
			model: GEMINI_MODELS.FLASH_LITE_2_5,
			thinkingConfig: {
				thinkingBudget: 0
			},
			reportErrorToUser: false
		};
		try {
			const response = await this.llm.generateContent(request);
			console.log(action.text, stringifyPretty(response));
			if (!response) return null;
			return response.content as TruthOracleResult;
			//eslint-disable-next-line
		} catch (error: any) {
			return null;
		}
	};

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
