import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type {
	Action,
	InventoryState,
	NPCAction,
	PlayerCharactersGameState
} from '$lib/ai/agents/gameAgent';
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

	static getAdditionalStoryInput(actions: Array<NPCAction>, playerName: string, playerAction: Action, deadNPCs?: Array<string>) {
		// let bossFightPrompt = allNpcsDetailsAsList.some(npc => npc.rank === 'Boss' || npc.rank === 'Legendary')
		//     ? '\nFor now only use following difficulties: ' + bossDifficulties.join('|'): ''
		if(deadNPCs && deadNPCs.length > 0) {
			actions = actions.filter(action => !deadNPCs.includes(action.sourceId) && !deadNPCs.includes(action.targetId));
		}
		const mappedActions = [`Player Character named ${playerName}: ${playerAction.text}`].concat(actions.map(
			(action) =>
				`${action.sourceId} targets ${action.targetId} with result: ${action.simulated_outcome}`
		));
		return mappedActions.length === 1 ? '' : (
			'\nDescribe the player action and the following NPCS actions in the story progression and apply stats_update for each action:\n' +
			stringifyPretty(mappedActions) + '\n'
		);
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
