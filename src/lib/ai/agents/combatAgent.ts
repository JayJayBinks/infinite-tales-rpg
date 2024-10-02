import {stringifyPretty} from "$lib/util.svelte.ts";
import {buildAIContentsFormat, GeminiProvider} from "../llmProvider";

export const statsUpdatePromptObject = `
    "stats_update": [
        # You must include one object for each action
        # Do not apply self damage to player_character because of a failed action unless explicitly stated
        # Also include one object per turn effect like poisoned or bleeding
        {
            "sourceId": "NPC id or player_character, which is the initiator of this action",
            "targetId": "NPC id or player_character, which is the target of this action",
            "explanation": "Short explanation for the reason of this change",
            "type": "hp_change",
            "value": positive integer if character recovers hp, negative if character looses hp
        },
        {
            "sourceId": "NPC id or player_character, which is the initiator of this action",
            "targetId": "NPC id or player_character, which is the target of this action",
            "explanation": "Short explanation for the reason of this change",
            "type": "mp_change",
            "value": positive integer if character recovers mp, negative if character looses mp
        },
        {
            "sourceId": "NPC id or player_character, which is the initiator of this action",
            "targetId": "NPC id or player_character, which is the target of this action",
            "explanation": "Short explanation for the reason of this change",
            "type": "condition_applied",
            "conditionId", "unique id of this condition like stunned_01, protected_01, ...",
            "value": "short description e.g. stunned: can not take any action, protected: damage received reduced for 1d6, ...",
            "rounds_duration": integer how many rounds this condition lasts
        },
        {
            "sourceId": "NPC id or player_character, which is the initiator of this action",
            "targetId": "NPC id or player_character, which is the target of this action",
            "explanation": "Short explanation for the reason of this change",
            "type": "condition_removed",
            "conditionId", "unique id of this effect like stunned_01, poisoned_01, ..."
        },
        ...
        ]`;

export class CombatAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }


    //TODO are effects like stunned etc. considered via historyMessages?
    //TODO far future improvement, include initiative with chain of actions, some actions then are skipped due to stun, death etc.
    async generateActionsFromContext(actionText, playerStatsState, npcsList, customSystemInstruction, historyMessages, storyState) {
        const agent = {
            parts: [{
                "text": "You are RPG combat agent, you decide which actions the NPCs take in response to the player character's action " +
                    "and what the consequences of these actions are. " +
                    "\n You must not apply self damage to player_character because of a failed action unless explicitly stated!" +
                    "\n You must include an action for each NPC from the list. You must also describe one action for the player_character, even if the action is a failure." +
                    "\n You must include the results of the actions as stats_update for each action. NPCs can never be finished off with a single attack!"
            },
                {
                    "text": "The following is a description of the story setting to keep the actions consistent on." +
                        "\n" + stringifyPretty(storyState)
                },
                {
                    "text": `Most important instruction! You must always respond with following JSON format! 
                 {
                  "actions": [
                    # You must include one object for each npc and one for the player_character
                    {
                      "sourceId": "NPC id or player_character, which is the initiator of this action",
                      "targetId": "NPC id or player_character, which is the target of this action",
                      "text": "description of the action the NPC takes",
                      "explanation": "Short explanation for the reason of this action"
                    },
                    ...
                  ],
                  ${statsUpdatePromptObject}
                }`
                },
            ]
        }
        if (customSystemInstruction) {
            agent.parts.push({"text": customSystemInstruction});
        }
        let action = "The player_character takes following action: " + actionText +
            "\nCurrent player_character conditions, consider them in the actions:\n" + stringifyPretty(playerStatsState.conditions) +
            "\nDecide the action and consequences for each of the following NPCs. It can be a spell, ability or any other action." +
            "\nMost important! Consider all conditions, e.g. if stunned they can not take an action." +
            "\n" + stringifyPretty(npcsList);
        let contents = buildAIContentsFormat(action, historyMessages);
        console.log('combat', action);
        return await this.llmProvider.sendToAI(contents, agent);
    }

}