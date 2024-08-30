import {handleError, stringifyPretty} from "$lib/util.svelte.ts";
import {GeminiProvider} from "../llmProvider";


export const characterStatsStateForPrompt = {
    resources: 'Starting maximum HP and MP in range 20 - 100, based on overall description of the character. Format: {"MAX_HP": startingHP, "MAX_MP": startingMP}',
    traits: 'list of the beginning traits of the character in following format: {"trait1": startingValue1, "trait2": startingValue2, ...}',
    expertise: 'Traits where CHARACTER has a high value and a positive dice roll modifier format: {"trait1": value between 1-5, "trait2": 1-5, ...}',
    disadvantages: 'Traits where CHARACTER has a low value and a negative dice roll modifier format: {"trait1": value between -1 to -5, "trait2": -1 to -5, ...}',
    spells_and_abilities: 'Array of spells and abilities. Only list actively usable spells and abilities. Format: [{"name": "", "effect": "", "mp_cost": integer, "difficulty", "simple|medium|difficult|very_difficult"}]',
}

export class CharacterStatsAgent {

    llmProvider: GeminiProvider;

    constructor(llmProvider: GeminiProvider) {
        this.llmProvider = llmProvider;
    }

    async generateCharacterStats(storyState, characterState, statsOverwrites) {
        let agentInstruction = "You are RPG character stats agent, generating the starting stats for a character according to game system, adventure and character description.\n" +
            "Always respond with following JSON!\n" +
            stringifyPretty(characterStatsStateForPrompt);

        return await this.llmProvider.sendToAI(
            [{
                role: "user",
                parts: [{"text": "Description of the story: " + stringifyPretty(storyState)}]
            },
                {
                    role: "user",
                    parts: [{"text": "Description of the character: " + stringifyPretty(characterState)}]
                },
                {
                    role: "user",
                    parts: [{"text": "Already existing stats to be reused: " + stringifyPretty(statsOverwrites)}]
                }],
            {parts: [{"text": agentInstruction}]}
        );
    }

}
