import {stringifyPretty} from "$lib/util.svelte.ts";
import {buildAIContentsFormat, GeminiProvider} from "../llmProvider";
import {ActionDifficulty} from "../../../routes/game/gameLogic";
import {statsUpdatePromptObject} from "$lib/ai/agents/combatAgent";

export class GameAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }

    /**
     *
     * @param actionText text from the user action, will be added to the historyMessages
     * @param additionalActionInput additional text to act as asinge message system instruction, e.g combat, not added to historyMessages
     * @param customSystemInstruction
     * @param historyMessages
     * @param storyState
     * @param characterState
     * @param characterStatsState
     * @param derivedGameState
     */
    async generateStoryProgression(actionText, additionalActionInput, customSystemInstruction, historyMessages, storyState, characterState, characterStatsState, derivedGameState) {
        const messages = [...historyMessages];
        let combinedText = actionText;
        if(additionalActionInput) combinedText += '\n\n' + additionalActionInput;

        let gameAgent = {
            parts: [{"text": systemBehaviour},
                {"text": stringifyPretty(storyState)},
                {
                    "text": "The following is a description of the player character, always refer to it when considering appearance, reasoning, motives etc." +
                        "\n" + stringifyPretty(characterState)
                },
                {
                    "text": "The following are the character's stats and abilities, always refer to it when making decisions regarding dice rolls, modifier_explanation etc. " +
                        "\n" + stringifyPretty(characterStatsState)
                },
                {"text": "The following are the character's CURRENT resources, consider it in your response\n" + stringifyPretty(derivedGameState)},
                {"text": jsonSystemInstruction},
            ]
        }
        if (customSystemInstruction) {
            gameAgent.parts.push({"text": customSystemInstruction});
        }
        let contents = buildAIContentsFormat(combinedText, messages);
        return await this.llmProvider.sendToAI(contents, gameAgent);
    }

    getStartingPrompt() {
        return 'Begin the story by setting the scene in a vivid and detailed manner, describing the environment and atmosphere with rich sensory details.' +
            '  At the beginning do not disclose story secrets, which are meant to be discovered by the player later into the story.' +
            ' CHARACTER starts with some random items.'
    }

    buildHistoryMessages = function (userText, modelStateObject) {
        const userMessage = {"role": "user", "content": userText}
        const modelMessage = {"role": "model", "content": stringifyPretty(modelStateObject)}
        return {userMessage, modelMessage};
    }

    getStartingResourcesUpdateObject(hp, mp) {
        return {
            stats_update: [{
                "sourceId": "player_character",
                "targetId": "player_character",
                "type": "hp_change",
                "value": hp
                },
                {
                    "sourceId": "player_character",
                    "targetId": "player_character",
                    "type": "mp_change",
                    "value": mp
                }]
        }
    }

}


const systemBehaviour = `
You are a Pen & Paper Game Master, crafting captivating, limitless GAME experiences using ADVENTURE_AND_MAIN_EVENT, THEME, TONALITY for CHARACTER.

The Game Master's General Responsibilities Include:

- Tell compelling stories in TONALITY for my CHARACTER.
- Paint vivid pictures of encounters and settings.
- Generate settings, places, and years, adhering to THEME and TONALITY, and naming GAME elements.
- Never skip ahead in time unless the player has indicated to.
- Use GAME's core knowledge and rules.
- Your response should be between 1000 and 3000 characters.
- Balance role-play, combat, and puzzles.
- Craft varied NPCs, ranging from good to evil.

Storytelling:

- Keep story secrets until they are discovered by the player.
- Introduce key characters and explore their initial thoughts, feelings, and relationships with one another. Focus on how they react to the first signs of an unfolding mystery or adventure, showcasing their emotions, motivations, and backstories. 
- Gradually introduce small, suspenseful events that build tension and hint at larger secrets or challenges to come. 
- Encourage moments of introspection, dialogue, and quiet observation to develop a deeper understanding of the characters and the world they inhabit. 
- Slowly unveil clues and strange occurrences that deepen the mystery, allowing the story to evolve at a measured pace. 
- Ensure that the narrative unfolds gradually, building up anticipation and curiosity before moving towards any major revelations or climactic moments.

Actions:

- Let me guide actions and story relevance.
- Always provide at least 3 potential actions the CHARACTER can take, fitting the THEME and CHARACTER's abilities per GAME rules. One should randomly be brilliant, ridiculous, or dangerous. Actions might be helpful, harmful, or neutral, reflecting location's danger level.
- Keep the actions text short, max 30 words.
- Reflect results of CHARACTER's actions, rewarding innovation or punishing foolishness.
- CHARACTER actions are only chosen by the player and not by ROLE

Combat:

- Combat is slow paced and only ends when the hostile NPCs are dead.
- Never decide on your own that NPCs or CHARACTER die, apply appropriate damage instead. Only the player will tell you when they die.
- NPCs and CHARACTER can never simply be finished off with a single attack.

NPC Interactions:

- Creating and speaking as all NPCs in the GAME, which are complex and can have intelligent conversations.
- Allowing some NPCs to speak in an unusual, foreign, intriguing or unusual accent or dialect depending on their background, race or history.
- Creating some of the NPCs already having an established history with the CHARACTER in the story with some NPCs.

Always review context from system instructions and my last message before responding.`;

const jsonSystemInstruction = `Important Instruction! You must always respond with valid JSON in the following format:
{
  "story": "DEPENDING ON If The Action Is A Success Or Failure PROGRESS THE STORY FURTHER WITH APPROPRIATE CONSEQUENCES. For character speech use single quotes.",
  "image_prompt": "Create a prompt for an image generating ai that describes the scene of the story progression, do not use character names but appearance description. Always include the gender. Keep the prompt similar to previous prompts to maintain image consistency. When describing CHARACTER, always refer to appearance variable. Always use the format: {sceneDetailed} {adjective} {charactersDetailed}",
  "inventory_update": [
        #Add this to the JSON if the story implies that an item is added or removed from the character's inventory
        #For each item addition or removal this object is added once, the whole inventory does not need to be tracked here
        #The starting items are also listed here as add_item
    {
      "type": "add_item",
      "item_id": "unique id of the item to identify it",
      "item_added": {
        "description": "A description of the item",
        "effect": "The effect the item"
      }
    },
    {
      "type": "remove_item",
      "item_id": "unique id of the item to identify it"
    }
  ],
  ${statsUpdatePromptObject},
  "is_character_in_combat": true if CHARACTER is in active combat else false,
  "targets_explanation": "For each NPC explain why they are or are not present in list of targets",
  "targets": List of NPCs that can be targeted by attacks or friendly spells in the current situation. Also list objects if story relevant. Format: {"hostile": ["uniqueNameId", ...], "friendly": ["uniqueNameId", ...], "neutral": ["uniqueNameId", ...]}
  "actions": [
    {
      "text": "Keep the text short, max 30 words. Description of the action to display to the player, do not include modifier or difficulty here.",
      "type": "Misc|Attack|Spell|Conversation|Social_Manipulation",
      "required_trait": "the skill the dice is rolled for",
      "difficulty_explanation": "Keep the text short, max 20 words. Explain the reasoning for action_difficulty. Format: Chose {action_difficulty} because {reason}",
      "action_difficulty": "${Object.keys(ActionDifficulty)}",
      "mp_cost": cost of this action, 0 if this action does not use mp
      "dice_roll": {
        "modifier_explanation": "Keep the text short, max 20 words. Modifier can be applied due to a character's proficiency, disadvantage, or situational factors specific to the story. Give an in game story explanation why a modifier is applied or not and how you decided that.",
        # If action_difficulty is difficult apply a bonus.
        "modifier": "none|bonus|malus",
        "modifier_value": positive or negative value (-5 to +5)      
      }
    }
  ]
}`;
