import {stringifyPretty} from "$lib/util.svelte";
import {ActionDifficulty} from "../../../routes/game/gameLogic";
import type {LLM, LLMMessage, LLMRequest} from "$lib/ai/llm";

export class DifficultyAgent {

    llm: LLM;

    constructor(llm: LLM) {
        this.llm = llm;
    }

    async generateDifficulty(actionText: string, customSystemInstruction: string, historyMessages: Array<LLMMessage>, characterState: object, characterStatsState: { [x: string]: any; spells_and_abilities: object; }) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {["spells_and_abilities"]: _, ...characterStatsStateMapped} = characterStatsState;
        const agent = ["You are RPG difficulty agent, the player will try to perform an action " +
            "and you determine how difficult it is in the current situation, considering the story, action effect, number of targets and character description. " +
            " The difficulty increases with more targets. If player_character is in combat apply a bonus to dice_roll" +
            " Any action is allowed to target anything per game rules.",
                "The following is a description of the player character" +
                "\n" + stringifyPretty(characterState),
                "The following are the character's stats " +
                "\n" + stringifyPretty(characterStatsStateMapped),
                `Most important instruction! You must always respond with following JSON format! 
               {
                   "difficulty_explanation": "Keep the text short, max 20 words. Explain the reasoning for action_difficulty. Format: Chose {action_difficulty} because {reason}",
                   "action_difficulty": "${Object.keys(ActionDifficulty)}",
                   "dice_roll": {
                      "modifier_explanation": "Keep the text short, max 20 words. Modifier can be applied due to a character's proficiency, disadvantage, or situational factors specific to the story. Give an in game story explanation why a modifier is applied or not and how you decided that.",,
                      "modifier": "none|bonus|malus",
                      "modifier_value": "positive or negative value (-5 to +5)"
                    }
                }`,
            ]
        if (customSystemInstruction) {
            agent.push(customSystemInstruction);
        }
        const request: LLMRequest = {
            userMessage: actionText,
            historyMessages: historyMessages,
            systemInstruction: agent,
            temperature: this.llm.getDefaultTemperature(),
        }
        return await this.llm.generateContent(request);
    }

}