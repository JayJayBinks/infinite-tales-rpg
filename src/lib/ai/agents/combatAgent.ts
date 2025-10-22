import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type {
	Action,
	InventoryState,
	NPCAction,
	PlayerCharactersGameState,
	ResourcesWithCurrentValue
} from '$lib/ai/agents/gameAgent';
import { mapStatsUpdates } from '$lib/ai/agents/mappers';
import { ActionDifficulty, getEmptyCriticalResourceKeys } from '../../../routes/game/gameLogic';
import type { Story } from '$lib/ai/agents/storyAgent';
import { jsonRule } from './agentUtils';
import { GEMINI_MODELS, THINKING_BUDGET } from '../geminiProvider';

export type DiceRoll = {
	result;
	number?: number;
	type?: number;
	modifier?: number;
	rolls?: number[];
};
export type StatsUpdate = {
	sourceName?: string;
	targetName: string;
	value: DiceRoll;
	type: string;
};
export const statsUpdatePromptObject = `
    "stats_update": [
        # You must include one update for each action
        # Also include one update per turn effect like poisoned or bleeding
        {
        	"explanation": "Short explanation for the reason of this change",
        	# if targetName is a NPC then resourceKey must be one of hp,mp else one of related CHARACTER resources
            "sourceName": "NPC name or player CHARACTER name, who is the initiator of this action",
            "targetName": "NPC name or player CHARACTER name, whose stats must be updated.",
			"type": "{resourceKey}_lost|{resourceKey}_gained; resourceKey must be one of the targetName's resources",
            "value": "must be dice roll notation in format 1d6+3 or 3d4 etc."
        },
        {
        	"targetName": "Player CHARACTER name who gains XP.",
        	"explanation": "Short explanation for the reason of this change",
           	"type": "xp_gained",
           	"value": "SMALL|MEDIUM|HIGH"
        },
        ...
        ]`;

export class CombatAgent {
	llm: LLM;

	constructor(llm: LLM) {
		this.llm = llm;
	}

	/**
	 * Generates ONLY stats_update (including xp_gained) after the story narration has been produced.
	 * Inventory is intentionally excluded (still handled in GameAgent story generation).
	 */
	async generateStatsUpdatesFromStory(
		story: string,
		playerAction: Action,
		playerCharacterNames: string[],
		playerResources: ResourcesWithCurrentValue,
		presentNPCKnownNames: string[],
		customSystemInstruction: string,
		customCombatAgentInstruction: string
	): Promise<StatsUpdate[]> {
		const npcNames = presentNPCKnownNames.slice(-50);

		const systemInstruction: string[] = [];
		// Role description
		systemInstruction.push(
			'You are Stats Update Agent. Your tasks: 1. determine what ACTIVE ACTIONS player character and NPCs take from STORY; 2. Derive precise stats_update entries from the determined ACTIONS. Do not invent events absent from the STORY.'
		);
		// Provide resource context
		systemInstruction.push(
			`The following are PLAYER CHARACTER with known names '${playerCharacterNames.join(', ')}' resources, derive EXACTLY one of these names and following resourceKeys exactly typed for that target:
			${Object.keys(playerResources).join(', ')}
			Action resource costs will be explicitly stated in the user prompt, you dont have to infer it.`
		);
		systemInstruction.push(
			'NPC names you may reference EXACTLY (hp/mp only):\n' + npcNames.join(', ')
		);
		// Reuse original stats update spec
		systemInstruction.push(
			`${jsonRule}\n{\n"determined_actions": "string array; one entry per ACTIVE action but not outcomes", ${statsUpdatePromptObject}\n}\n` +
				'# Rules:\n' +
				`ACTIONS:
			**Strict Adherence to Text:** Derive stat changes ONLY from events EXPLICITLY stated in the STORY. If the story says an attack *missed* or a character *dodged*, you MUST NOT create a hp_lost entry for that attack. 
			Do not infer damage from descriptions of attack preparation, heat, close calls, or environmental damage unless the character is explicitly stated to be harmed.
			**Action vs. Outcome Distinction:** In determined_actions, list only the initial, active action (e.g., 'Character A attacks Character B'). Do NOT list the result or outcome of that action (e.g., 'Character B's shield is hit', 'The attack misses and hits a wall') as a separate, new action.
			**Confirmed Hits Only:** Only generate a hp_lost entry if the STORY explicitly describes an attack *connecting* with its target and causing harm.\n` +
				`STATS_UPDATE:
			- Determine if stats_update is necessary for each ACTION or ongoing effect (bleeding/poison/etc.) if present in STORY.
			- Use dice notation (e.g. 1d6+2) for value for non-xp changes, or if mentioned directly COST OF THE PLAYER ACTION
			- Types follow pattern {resourceKey}_lost or {resourceKey}_gained OR xp_gained.\n` +
				`- Handle PLAYER CHARACTER resources per GAME rules, e.g. in a survival game hunger decreases over time; Blood magic costs blood; etc...
			XP:
				- Award XP only for contributions to a challenge according to significance.
				- SMALL: Obtaining clues, engaging in reconnaissance, or learning background information.
				- MEDIUM: Major progress toward a challenge, such as uncovering a vital piece of evidence, or getting access to a crucial location.
				- HIGH: Achieving breakthroughs or resolving significant challenges.
			- XP is also granted for the character’s growth (e.g. a warrior mastering a new technique).
			- Never grant XP for routine tasks (e.g. basic dialogue, non-story shopping) or actions that build tension but don’t change outcomes.
			`
		);
		if (customSystemInstruction) {
			systemInstruction.push(
				'Additional instructions which can override others: ' + customSystemInstruction
			);
		}
		if (customCombatAgentInstruction) {
			systemInstruction.push(
				'Additional instructions which can override others: ' + customCombatAgentInstruction
			);
		}

		const userMessage =
			'STORY (reference only, do NOT repeat):\n' +
			story +
			(playerAction.resource_cost
				? '\n\nCOST OF THE PLAYER ACTION:\n' + JSON.stringify(playerAction.resource_cost)
				: '') +
			'\n\nReturn ONLY JSON with determined_actions and stats_update.';

		const request: LLMRequest = {
			userMessage,
			historyMessages: [],
			systemInstruction,
			returnFallbackProperty: true,
			reportErrorToUser: false,
			temperature: 0.7,
			model: GEMINI_MODELS.FLASH_LITE_2_5,
			thinkingConfig: { includeThoughts: true, thinkingBudget: THINKING_BUDGET.DEFAULT }
		};
		const response = await this.llm.generateContent(request);
		console.log('stats updates thoughts: ', response?.thoughts);
		// Expect either {stats_update: [...]} or just [...]
		let stats_update: StatsUpdate[] = [];
		const content: any = response?.content;
		if (Array.isArray(content)) {
			stats_update = content as StatsUpdate[];
		} else if (content?.stats_update && Array.isArray(content.stats_update)) {
			stats_update = content.stats_update as StatsUpdate[];
		}
		console.log('stats updates raw: ', stringifyPretty(content));
		// Map dice notations
		const updates = { stats_update };
		mapStatsUpdates(updates);
		return updates.stats_update || [];
	}

	//TODO are effects like stunned etc. considered via historyMessages?
	//TODO far future improvement, include initiative with chain of actions, some actions then are skipped due to stun, death etc.
	async generateActionsFromContext(
		action: Action,
		inventoryState: InventoryState,
		npcsList: Array<object>,
		customSystemInstruction: string,
		customCombatAgentInstruction: string,
		historyMessages: Array<LLMMessage>,
		storyState: Story
	): Promise<NPCAction[]> {
		const agent = [
			"You are RPG combat agent, you decide which actions the NPCs take in response to the player character's action and the outcomes of these actions" +
				'\n For deciding the outcome simulate if the NPC action can be successfull based on the circumstances.' +
				'\n You must include an action for each NPC from the list.',
			"The following is the character's inventory, if an item is relevant in combat then apply it's effect." +
				'\n' +
				stringifyPretty(inventoryState),
			'The following is a description of the story setting to keep the actions consistent on.' +
				'\n' +
				stringifyPretty(storyState),
			`${jsonRule}
                 [
                    # You must include one object for each npc
                    {
                      "sourceId": "NPC id",
                      "targetId": "NPC id or player character name, whose stats must be updated. if sourceId targets self then same as sourceId",
					  "actionOnly": "only description of the action the NPC takes",
					  "simulated_outcome": "short description of the simulated outcome (success or failure) of the action"
                    },
                    ...
                ]`
		];
		if (customSystemInstruction) {
			agent.push('Following instructions overrule all others: ' + customSystemInstruction);
		}
		if (customCombatAgentInstruction) {
			agent.push('Following instructions overrule all others: ' + customCombatAgentInstruction);
		}
		const actionToSend =
			'player character named ' +
			action.characterName +
			' takes following action: ' +
			action.text +
			'\n' +
			'Decide the action for each of the following NPCs. It can be a spell, ability or any other action. Important: You must reuse the exact nameIds that are given!' +
			'\n' +
			stringifyPretty(npcsList);
		console.log('combat', actionToSend);
		const request: LLMRequest = {
			userMessage: actionToSend,
			historyMessages: historyMessages,
			systemInstruction: agent,
			reportErrorToUser: false,
			model: GEMINI_MODELS.FLASH_LITE_2_5,
			thinkingConfig: {
				thinkingBudget: THINKING_BUDGET.DEFAULT
			}
		};

		const state = (await this.llm.generateContent(request))?.content as Array<NPCAction>;
		return state;
	}

	static getAdditionalStoryInput(actions: Array<NPCAction>, deadNPCs?: Array<string>) {
		// let bossFightPrompt = allNpcsDetailsAsList.some(npc => npc.rank === 'Boss' || npc.rank === 'Legendary')
		//     ? '\nFor now only use following difficulties: ' + bossDifficulties.join('|'): ''
		if (deadNPCs && deadNPCs.length > 0) {
			actions = actions.filter(
				(action) => !deadNPCs.includes(action.sourceId) && !deadNPCs.includes(action.targetId)
			);
		}
		const mappedActions = actions.map(
			(action) =>
				`${action.sourceId} targets ${action.targetId} with result: ${action.simulated_outcome}`
		);
		return mappedActions.length === 0
			? ''
			: '\nDescribe the player action and the following NPCS actions in the story progression:\n' +
					stringifyPretty(mappedActions) +
					'\n';
	}

	static getNPCsHealthStatePrompt(
		deadNPCs: Array<string>,
		aliveNPCs?: Array<string>,
		playerCharactersGameState?: PlayerCharactersGameState
	) {
		let text = '';
		if (aliveNPCs && aliveNPCs.length > 0) {
			text +=
				'\n ' +
				'Following NPCs are still alive after the attacks!' +
				'\n' +
				stringifyPretty(aliveNPCs);
		}
		if (deadNPCs && deadNPCs.length > 0) {
			text +=
				'\n ' +
				'Following NPCs have died, describe their death in the story progression.' +
				'\n' +
				stringifyPretty(deadNPCs) +
				'\n';
		}
		if (playerCharactersGameState) {
			const aliveChars = Object.keys(playerCharactersGameState).filter(
				(playerName) =>
					getEmptyCriticalResourceKeys(playerCharactersGameState[playerName]).length === 0
			);
			text += '\n Player Characters ' + aliveChars.join(', ') + ' are alive after the attacks!';
		}

		return text;
	}

	static getCombatPromptAddition() {
		//TODO rather do this programatically?
		const combatDifficulties = [
			ActionDifficulty.simple,
			ActionDifficulty.medium,
			ActionDifficulty.difficult
		];
		return (
			'\nOnly suggest combat actions given the situation' +
			'\nOnly use following difficulties: ' +
			combatDifficulties.join('|') +
			'\nOnly apply bonus to dice_roll'
		);
	}
}
