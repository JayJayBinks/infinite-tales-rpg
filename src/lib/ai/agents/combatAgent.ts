import {stringifyPretty} from "$lib/util.svelte";
import type {LLM, LLMMessage, LLMRequest} from "$lib/ai/llm";
import type {Action, DerivedGameState} from "$lib/ai/agents/gameAgent";
import {ActionDifficulty} from "../../../routes/game/gameLogic";
import type {Story} from "$lib/ai/agents/storyAgent";


export type StatsUpdate = { sourceId: string, targetId: string, value: any, type: string };
export const statsUpdatePromptObject = `
    "stats_update": [
        # You must include one object for each action
        # Do not apply self damage to player_character because of a failed action unless explicitly stated
        # Also include one object per turn effect like poisoned or bleeding
        {
            "sourceId": "NPC id or player_character, which is the initiator of this action",
            "targetId": "NPC id or player_character, which stats must be updated.",
            "explanation": "Short explanation for the reason of this change",
            "type": "hp_change",
            "value": positive integer if character recovers hp, negative if character looses hp
        },
        {
            "sourceId": "NPC id or player_character, which is the initiator of this action",
            "targetId": "NPC id or player_character, which stats must be updated.",
            "explanation": "Short explanation for the reason of this change",
            "type": "mp_change",
            "value": positive integer if character recovers mp, negative if character looses mp
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
    async generateActionsFromContext(actionText: string, npcsList: Array<object>, customSystemInstruction: string, historyMessages: Array<LLMMessage>, storyState: Story) {
        const agent = ["You are RPG combat agent, you decide which actions the NPCs take in response to the player character's action " +
        "and what the consequences of these actions are. " +
        "\n You must not apply self damage to player_character because of a failed action unless explicitly stated!" +
        "\n You must include an action for each NPC from the list. You must also describe one action for the player_character, even if the action is a failure." +
        "\n You must include the results of the actions as stats_update for each action. NPCs can never be finished off with a single attack!",
            "The following is a description of the story setting to keep the actions consistent on." +
            "\n" + stringifyPretty(storyState),
            `Most important instruction! You must always respond with following JSON format! 
                 {
                  "actions": [
                    # You must include one object for each npc and one for the player_character
                    {
                      "sourceId": "NPC id or player_character, which is the initiator of this action",
                      "targetId": "NPC id or player_character, which stats must be updated. can be same as sourceId",
                      "text": "description of the action the NPC takes",
                      "explanation": "Short explanation for the reason of this action"
                    },
                    ...
                  ],
                  ${statsUpdatePromptObject}
                }`,
        ];
        if (customSystemInstruction) {
            agent.push(customSystemInstruction);
        }
        const action = "The player takes following action: " + actionText + "\n" +
            "Decide the action and consequences for each of the following NPCs. It can be a spell, ability or any other action." +
            "\n" + stringifyPretty(npcsList);
        console.log('combat', action);
        const request: LLMRequest = {
            userMessage: action,
            historyMessages: historyMessages,
            systemInstruction: agent
        }
        return await this.llm.generateContent(request);
    }

    getAdditionalActionInput(actions: Array<Action>, deadNPCs: string[], aliveNPCs: string[], derivedGameState: DerivedGameState) {
        // let bossFightPrompt = allNpcsDetailsAsList.some(npc => npc.rank === 'Boss' || npc.rank === 'Legendary')
        //     ? '\nFor now only use following difficulties: ' + bossDifficulties.join('|'): ''
        return "\nNPCs can never be finished off with a single attack!" +
            "\nYou must not apply stats_update for following actions, as this was already done!" +
            "\nDescribe the following actions in the story progression:\n" + stringifyPretty(actions) +
            "\n\nMost important! " + this.getNPCsHealthStatePrompt(deadNPCs, aliveNPCs, derivedGameState)
    }

    getNPCsHealthStatePrompt(deadNPCs: Array<string>, aliveNPCs: Array<string>, derivedGameState?: DerivedGameState) {
        let text = ''
        if (aliveNPCs && aliveNPCs.length > 0) {
            text += '\n ' + "Following NPCs are still alive after the attacks!" +
                "\n" + stringifyPretty(aliveNPCs)
        }
        if (deadNPCs && deadNPCs.length > 0) {
            text += '\n ' + "Following NPCs have died, describe their death in the story progression." +
                "\n" + stringifyPretty(deadNPCs)
        }
        if (derivedGameState && derivedGameState.currentHP > 0) text += "\n player_character is alive after the attacks!";
        return text;
    }

    getCombatPromptAddition() {
        //TODO rather do this programatically? Keep an eye on if influence future actions, it is not used in the history
        // but very_difficult may not be used anymore even when fight has finished
        const combatDifficulties = [ActionDifficulty.simple, ActionDifficulty.medium, ActionDifficulty.difficult];
        return "\nFor now only use following difficulties: " + combatDifficulties.join('|') +
            "\nFor now only apply bonus to dice_roll";
    }

}