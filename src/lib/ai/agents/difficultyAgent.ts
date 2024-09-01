import {stringifyPretty} from "$lib/util.svelte.ts";
import {GeminiProvider} from "../llmProvider";
import {ActionDifficulty} from "../../../routes/game/gameLogic";

export class DifficultyAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }

    async generateDifficulty(actionText, customSystemInstruction, historyMessages, characterState, characterStatsState) {
        const messages = historyMessages.map(message => {
            try{
                return {...message, content: JSON.parse(message.content).story};
            }catch (e) {
                return message;
            }
        });
        let {["spells_and_abilities"]: _, ...characterStatsStateMapped} = characterStatsState;
        let agent = {
            parts: [{
                "text": "You are RPG difficulty agent, the player will try to perform an action " +
                    "and you determine how difficult it is in the current situation, considering the story, action effect, number of targets and character description. " +
                    " Any action is allowed to target anything per game rules."
            },
                {
                    "text": "The following is a description of the player character" +
                        "\n" + stringifyPretty(characterState)
                },
                {
                    "text": "The following are the character's stats " +
                        "\n" + stringifyPretty(characterStatsStateMapped)
                },
                {
                    "text": `Most important instruction! You must always respond with following JSON format! 
               {
                   "difficulty_explanation": "Keep the text short, max 20 words. Explain the reasoning for action_difficulty. Format: Chose {action_difficulty} because {reason}",
                   "action_difficulty": "${Object.keys(ActionDifficulty)}",
                   "dice_roll": {
                      "modifier_explanation": "Keep the text short, max 20 words. Modifier can be applied due to situational factors specific to the story. Give an explanation why a modifier is applied or not and how you decided that.",
                      "modifier": "none|bonus|malus",
                      "modifier_value": "positive or negative value (-5 to +5)"
                    }
                }`
                },
            ]
        }
        if (customSystemInstruction) {
            agent.parts.push({"text": customSystemInstruction});
        }

        let contents = this.buildAIContentsFormat(actionText, messages);
        return await this.llmProvider.sendToAI(contents, agent, 1);
    }

    private buildAIContentsFormat(actionText, historyMessages) {
        let contents = []
        historyMessages.forEach(message => {
            contents.push({
                "role": message["role"],
                "parts": [{"text": message["content"]}]
            })
        });
        let message = {"role": "user", "content": actionText}
        contents.push({
            "role": message["role"],
            "parts": [{"text": message["content"]}]
        })
        return contents;
    }
}