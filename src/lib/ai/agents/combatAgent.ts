import { stringifyPretty } from '$lib/util.svelte';
import type { LLM, LLMMessage, LLMRequest } from '$lib/ai/llm';
import type {
	Action,
	InventoryState,
	PlayerCharactersGameState,
	ResourcesWithCurrentValue
} from '$lib/ai/agents/gameAgent';
import { ActionDifficulty, getEmptyCriticalResourceKeys } from '../../../routes/game/gameLogic';
import type { Story } from '$lib/ai/agents/storyAgent';
import { mapStatsUpdates } from '$lib/ai/agents/mappers';

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
        # You must include one object for each action
        # Do not apply self damage to CHARACTER because of a failed action unless explicitly stated
        # Also include one object per turn effect like poisoned or bleeding
        {
        		"explanation": "Short explanation for the reason of this change",
        		# if targetName is a NPC then resourceKey must be one of hp,mp else one of related CHARACTER resources
        		"type": "{resourceKey}_lost|{resourceKey}_gained",
            "sourceName": "NPC name or player CHARACTER name, who is the initiator of this action",
            "targetName": "NPC name or player CHARACTER name, whose stats must be updated.",
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
		playerCharResources: ResourcesWithCurrentValue,
		inventoryState: InventoryState,
		npcsList: Array<object>,
		customSystemInstruction: string,
		customCombatAgentInstruction: string,
		historyMessages: Array<LLMMessage>,
		storyState: Story
	) {
		const agent = [
			"You are RPG combat agent, you decide which actions the NPCs take in response to the player character's action " +
				'and what the consequences of these actions are. ' +
				'\n You must not apply self damage to player character because of a failed action unless explicitly stated!' +
				'\n You must include an action for each NPC from the list. You must also describe one action for player character, even if the action is a failure.' +
				'\n You must include the results of the actions as stats_update for each action. NPCs can never be finished off with a single attack!',
			`Only for the player character ${action.characterName} use the following resources:\n ${stringifyPretty(playerCharResources)}\n\nFor stats_update regarding NPC, you must exactly use resourceKey "hp" or "mp", and no deviations of that.`,
			"The following is the character's inventory, if an item is relevant in the current situation then apply it's effect." +
				'\n' +
				stringifyPretty(inventoryState),
			'The following is a description of the story setting to keep the actions consistent on.' +
				'\n' +
				stringifyPretty(storyState),
			`Most important instruction! You must always respond with following JSON format! 
                 {
                  "actions": [
                    # You must include one object for each npc and one for the player character
                    {
                      "sourceId": "NPC id or player character name, who is the initiator of this action",
                      "targetId": "NPC id or player character name, whose stats must be updated. if sourceId targets self then same as sourceId",
					  "text": "description of the action the NPC takes",
                      "explanation": "Short explanation for the reason of this action"
                    },
                    ...
                  ],
                  ${statsUpdatePromptObject}
                }`
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
			'Decide the action and consequences for each of the following NPCs. It can be a spell, ability or any other action. Important: You must reuse the exact nameIds that are given!' +
			'\n' +
			stringifyPretty(npcsList);
		console.log('combat', actionToSend);
		const request: LLMRequest = {
			userMessage: actionToSend,
			historyMessages: historyMessages,
			systemInstruction: agent
		};

		const state = (await this.llm.generateContent(request)) as any;
		mapStatsUpdates(state);
		return state;
	}

	static getAdditionalStoryInput(
		actions: Array<Action>,
		deadNPCs: string[],
		aliveNPCs: string[],
		playerCharactersGameState: PlayerCharactersGameState
	) {
		// let bossFightPrompt = allNpcsDetailsAsList.some(npc => npc.rank === 'Boss' || npc.rank === 'Legendary')
		//     ? '\nFor now only use following difficulties: ' + bossDifficulties.join('|'): ''
		return (
			'\nNPCs can never be finished off with a single attack!' +
			'\nYou must not apply stats_update for following actions, as this was already done!' +
			'\nDescribe the following actions in the story progression:\n' +
			stringifyPretty(actions) +
			'\n\nMost important! ' +
			this.getNPCsHealthStatePrompt(deadNPCs, aliveNPCs, playerCharactersGameState)
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
				stringifyPretty(deadNPCs);
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
		//TODO rather do this programatically? Keep an eye on if influence future actions, it is not used in the history
		// but very_difficult may not be used anymore even when fight has finished
		const combatDifficulties = [
			ActionDifficulty.simple,
			ActionDifficulty.medium,
			ActionDifficulty.difficult
		];
		return (
			'\nFor now only use following difficulties: ' +
			combatDifficulties.join('|') +
			'\nFor now only apply bonus to dice_roll'
		);
	}
}
